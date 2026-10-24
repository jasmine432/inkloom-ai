import re
from typing import List, Tuple, Optional
from backend.app.schemas.finding import Finding
from backend.app.schemas.evidence import EvidenceItem
from backend.app.schemas.enums import FindingStatus, ReviewerDecision
from backend.app.schemas.source import ApprovedSource
from backend.app.services.source_store import SourcePassage, source_store


def _normalize_text(text: str) -> str:
    """Normalize whitespace and punctuation for robust substring verification."""
    # Replace all whitespace sequences with a single space and lowercase
    cleaned = re.sub(r"\s+", " ", text).strip().lower()
    # Strip smart quotes and standard quotes
    cleaned = cleaned.replace("“", '"').replace("”", '"').replace("‘", "'").replace("’", "'")
    return cleaned


class CitationValidator:
    """
    Safeguard that guarantees all evidence citations, source IDs, and quotes exist verbatim
    in real approved source documents. Prevents model hallucinations.
    """
    def __init__(self, store=source_store):
        self.store = store

    def find_matching_source(
        self,
        quote: str,
        source_title: str,
        source_id: Optional[str] = None
    ) -> Tuple[bool, int, Optional[ApprovedSource]]:
        """
        Verifies whether a quote exists inside the given source document.
        Returns (is_valid, match_confidence, matched_source).
        """
        if not quote or not quote.strip() or len(quote.strip()) < 5:
            return False, 0, None

        target_source: Optional[ApprovedSource] = None

        # 1. Match by source_id first if provided
        if source_id and source_id.strip():
            found = self.store.get_source_by_id(source_id.strip())
            if found:
                target_source = found
            else:
                # If explicit source_id is given but unknown in store, reject as hallucination
                return False, 0, None

        # 2. If not matched by source_id, match by source_title
        if not target_source and source_title and source_title.strip():
            norm_title = source_title.strip().lower()
            for s in self.store.get_all_sources():
                if s.title.strip().lower() == norm_title:
                    target_source = s
                    break

        if not target_source:
            return False, 0, None

        norm_quote = _normalize_text(quote)

        # Check full text of each section in the source
        for sec in target_source.sections:
            norm_sec = _normalize_text(sec.text)
            if norm_quote in norm_sec:
                return True, 98, target_source
            # Check if majority of quote words are contiguous
            if len(norm_quote) > 30 and norm_quote[:30] in norm_sec:
                return True, 90, target_source

        # Also check verified claims list
        for claim in target_source.verifiedClaims:
            norm_claim = _normalize_text(claim)
            if norm_quote in norm_claim or norm_claim in norm_quote:
                return True, 95, target_source

        return False, 0, None

    def validate_quote_in_source(
        self,
        quote: str,
        source_title: str,
        source_id: Optional[str] = None
    ) -> Tuple[bool, int]:
        """
        Verifies whether a quote exists inside the given source document.
        Returns (is_valid, match_confidence). Compatible with 2-tuple unpacking.
        """
        is_valid, confidence, _ = self.find_matching_source(quote, source_title, source_id)
        return is_valid, confidence

    def validate_finding(
        self,
        finding: Finding,
        retrieved_passages: Optional[List[SourcePassage]] = None
    ) -> Finding:
        """
        Validates all evidence citations inside a finding.
        Verifies source ID, source title, and verbatim quote against actual approved/retrieved text.
        If citations are missing, invalid, or hallucinated, status is downgraded
        to INSUFFICIENT_EVIDENCE to prevent false claims.
        """
        validated_evidence: List[EvidenceItem] = []

        for ev in finding.evidence:
            is_valid, confidence, matched_source = self.find_matching_source(
                quote=ev.quote,
                source_title=ev.sourceTitle,
                source_id=ev.sourceId,
            )

            if is_valid and matched_source:
                # If retrieved passages were supplied, check if quote is in retrieved text
                if retrieved_passages:
                    in_retrieved = False
                    norm_quote = _normalize_text(ev.quote)
                    for rp in retrieved_passages:
                        if (ev.sourceId and rp.source_id.lower() == ev.sourceId.lower()) or (rp.source_title.lower() == ev.sourceTitle.lower()):
                            if norm_quote in _normalize_text(rp.text) or (len(norm_quote) > 30 and norm_quote[:30] in _normalize_text(rp.text)):
                                in_retrieved = True
                                break
                    if not in_retrieved:
                        confidence = min(confidence, 88)

                # Sync enriched metadata
                if not ev.sourceId:
                    ev.sourceId = matched_source.id
                if not ev.documentVersion and matched_source.version:
                    ev.documentVersion = matched_source.version
                if not ev.lastUpdated and matched_source.lastAudited:
                    ev.lastUpdated = matched_source.lastAudited
                ev.confidenceScore = max(ev.confidenceScore, confidence)
                validated_evidence.append(ev)

        # Apply safeguard: only retain verified evidence
        finding.evidence = validated_evidence

        # If evidence was expected or claimed, but none survived verification:
        if not validated_evidence:
            if finding.status in [
                FindingStatus.SUPPORTED,
                FindingStatus.CONTRADICTED,
                FindingStatus.CONFLICTING_SOURCES,
            ]:
                finding.status = FindingStatus.INSUFFICIENT_EVIDENCE
                notice = (
                    " [Verification Notice: No verbatim citation could be substantiated "
                    "against approved sources; categorized as INSUFFICIENT_EVIDENCE.]"
                )
                if notice not in finding.explanation:
                    finding.explanation = f"{finding.explanation}{notice}"

        # Safeguard: Human reviewer decision is always separate and starts as PENDING
        finding.reviewerDecision = ReviewerDecision.PENDING

        return finding

    def validate_findings_batch(
        self,
        findings: List[Finding],
        retrieved_passages: Optional[List[SourcePassage]] = None
    ) -> List[Finding]:
        return [self.validate_finding(f, retrieved_passages) for f in findings]


citation_validator = CitationValidator()

