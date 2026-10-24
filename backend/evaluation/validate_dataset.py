"""
Dataset validation script for Inkloom AI Ground-Truth Evaluation Dataset.

Validates:
1. Structural integrity and JSONL formatting.
2. Field schema completeness.
3. Allowed values for status, severity, and verification_status.
4. Uniqueness of case_id.
5. Veracity of referenced source IDs against source_store.
6. Verbatim existence of expected evidence quotes in referenced sources.
7. Explicit separation of human_verified, pending_review, and synthetic records.
"""

import sys
import json
from pathlib import Path
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field

# Add project root to sys.path if not present
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.app.schemas.enums import FindingStatus, FindingCategory
from backend.app.services.source_store import source_store
from backend.app.services.validator import citation_validator, _normalize_text

ALLOWED_STATUSES = {status.value for status in FindingStatus} | {"NO_FINDINGS"}
ALLOWED_SEVERITIES = {"HIGH", "MEDIUM", "LOW"}
ALLOWED_VERIFICATION_STATUSES = {"human_verified", "pending_review", "synthetic"}
ALLOWED_CATEGORIES = {cat.value for cat in FindingCategory}

REQUIRED_FIELDS = [
    "case_id",
    "draft_title",
    "draft_text",
    "expected_findings",
    "expected_status",
    "expected_source_ids",
    "expected_evidence",
    "severity",
    "rationale",
    "case_type",
    "verification_status",
]


@dataclass
class ValidationIssue:
    case_id: str
    line_number: int
    field: str
    message: str


@dataclass
class ValidationReport:
    total_records: int = 0
    valid_records: int = 0
    human_verified_count: int = 0
    pending_review_count: int = 0
    synthetic_count: int = 0
    issues: List[ValidationIssue] = field(default_factory=list)

    @property
    def is_valid(self) -> bool:
        return len(self.issues) == 0 and self.total_records > 0


def validate_dataset_record(
    record: Dict[str, Any],
    line_number: int,
    seen_ids: set,
    known_source_ids: set
) -> List[ValidationIssue]:
    """Validates a single dataset record against schema and grounding rules."""
    issues: List[ValidationIssue] = []
    case_id = record.get("case_id", f"line_{line_number}")

    # 1. Check required fields
    for req_field in REQUIRED_FIELDS:
        if req_field not in record:
            issues.append(
                ValidationIssue(
                    case_id=case_id,
                    line_number=line_number,
                    field=req_field,
                    message=f"Missing mandatory field '{req_field}'."
                )
            )

    if issues:
        return issues

    # 2. Duplicate case_id check
    if case_id in seen_ids:
        issues.append(
            ValidationIssue(
                case_id=case_id,
                line_number=line_number,
                field="case_id",
                message=f"Duplicate case_id '{case_id}' detected."
            )
        )
    seen_ids.add(case_id)

    # 3. String content checks
    if not isinstance(record["draft_title"], str) or not record["draft_title"].strip():
        issues.append(
            ValidationIssue(
                case_id=case_id,
                line_number=line_number,
                field="draft_title",
                message="draft_title must be a non-empty string."
            )
        )

    if not isinstance(record["draft_text"], str) or not record["draft_text"].strip():
        issues.append(
            ValidationIssue(
                case_id=case_id,
                line_number=line_number,
                field="draft_text",
                message="draft_text must be a non-empty string."
            )
        )

    # 4. Allowed enum checks
    exp_status = record["expected_status"]
    if exp_status not in ALLOWED_STATUSES:
        issues.append(
            ValidationIssue(
                case_id=case_id,
                line_number=line_number,
                field="expected_status",
                message=f"Invalid expected_status '{exp_status}'. Allowed: {sorted(ALLOWED_STATUSES)}."
            )
        )

    severity = record["severity"]
    if severity not in ALLOWED_SEVERITIES:
        issues.append(
            ValidationIssue(
                case_id=case_id,
                line_number=line_number,
                field="severity",
                message=f"Invalid severity '{severity}'. Allowed: {sorted(ALLOWED_SEVERITIES)}."
            )
        )

    v_status = record["verification_status"]
    if v_status not in ALLOWED_VERIFICATION_STATUSES:
        issues.append(
            ValidationIssue(
                case_id=case_id,
                line_number=line_number,
                field="verification_status",
                message=f"Invalid verification_status '{v_status}'. Allowed: {sorted(ALLOWED_VERIFICATION_STATUSES)}."
            )
        )

    # 5. Expected findings validation
    findings = record.get("expected_findings")
    if not isinstance(findings, list) or (len(findings) == 0 and exp_status != "NO_FINDINGS"):
        issues.append(
            ValidationIssue(
                case_id=case_id,
                line_number=line_number,
                field="expected_findings",
                message="expected_findings must be a non-empty list of finding objects (can be empty only when expected_status is NO_FINDINGS)."
            )
        )
    elif exp_status != "NO_FINDINGS":
        for f_idx, finding in enumerate(findings):
            if not isinstance(finding, dict):
                issues.append(
                    ValidationIssue(
                        case_id=case_id,
                        line_number=line_number,
                        field=f"expected_findings[{f_idx}]",
                        message="Finding item must be a dictionary."
                    )
                )
                continue

            for sub_field in ["claim", "status", "explanation", "suggested_action", "category"]:
                if sub_field not in finding or not finding[sub_field]:
                    issues.append(
                        ValidationIssue(
                            case_id=case_id,
                            line_number=line_number,
                            field=f"expected_findings[{f_idx}].{sub_field}",
                            message=f"Missing or empty field '{sub_field}' in finding."
                        )
                    )

            f_status = finding.get("status")
            if f_status and f_status not in ALLOWED_STATUSES:
                issues.append(
                    ValidationIssue(
                        case_id=case_id,
                        line_number=line_number,
                        field=f"expected_findings[{f_idx}].status",
                        message=f"Invalid status '{f_status}' in finding."
                    )
                )

            f_cat = finding.get("category")
            if f_cat and f_cat not in ALLOWED_CATEGORIES:
                issues.append(
                    ValidationIssue(
                        case_id=case_id,
                        line_number=line_number,
                        field=f"expected_findings[{f_idx}].category",
                        message=f"Invalid category '{f_cat}' in finding."
                    )
                )

    # 6. Referenced source IDs check
    source_ids = record.get("expected_source_ids", [])
    if not isinstance(source_ids, list):
        issues.append(
            ValidationIssue(
                case_id=case_id,
                line_number=line_number,
                field="expected_source_ids",
                message="expected_source_ids must be a list."
            )
        )
    else:
        for sid in source_ids:
            if sid not in known_source_ids:
                issues.append(
                    ValidationIssue(
                        case_id=case_id,
                        line_number=line_number,
                        field="expected_source_ids",
                        message=f"Referenced source ID '{sid}' not found in known sources: {sorted(known_source_ids)}."
                    )
                )

    # 7. Evidence quotation verification against actual source documents
    evidence_list = record.get("expected_evidence", [])
    if not isinstance(evidence_list, list):
        issues.append(
            ValidationIssue(
                case_id=case_id,
                line_number=line_number,
                field="expected_evidence",
                message="expected_evidence must be a list of strings."
            )
        )
    else:
        for q_idx, quote in enumerate(evidence_list):
            if not isinstance(quote, str) or not quote.strip():
                issues.append(
                    ValidationIssue(
                        case_id=case_id,
                        line_number=line_number,
                        field=f"expected_evidence[{q_idx}]",
                        message="Evidence quote must be a non-empty string."
                    )
                )
                continue

            # Verify that the quote exists in at least one referenced source
            quote_found = False
            for sid in source_ids:
                src = source_store.get_source_by_id(sid)
                if not src:
                    continue
                norm_quote = _normalize_text(quote)
                for sec in src.sections:
                    if norm_quote in _normalize_text(sec.text):
                        quote_found = True
                        break
                if quote_found:
                    break
                for claim in src.verifiedClaims:
                    if norm_quote in _normalize_text(claim):
                        quote_found = True
                        break
                if quote_found:
                    break

            if source_ids and not quote_found:
                issues.append(
                    ValidationIssue(
                        case_id=case_id,
                        line_number=line_number,
                        field=f"expected_evidence[{q_idx}]",
                        message=f"Evidence quote '{quote[:40]}...' was not found verbatim in referenced sources: {source_ids}."
                    )
                )

    return issues


def validate_dataset(filepath: Path) -> ValidationReport:
    """Reads and validates an evaluation JSONL dataset file."""
    report = ValidationReport()
    seen_ids = set()
    known_source_ids = {s.id for s in source_store.get_all_sources()}

    if not filepath.exists():
        report.issues.append(
            ValidationIssue(
                case_id="FILE_NOT_FOUND",
                line_number=0,
                field="path",
                message=f"Dataset file does not exist at {filepath.resolve()}."
            )
        )
        return report

    with open(filepath, "r", encoding="utf-8") as f:
        for line_num, line in enumerate(f, start=1):
            stripped = line.strip()
            if not stripped:
                continue

            report.total_records += 1

            # Parse JSON
            try:
                record = json.loads(stripped)
            except json.JSONDecodeError as e:
                report.issues.append(
                    ValidationIssue(
                        case_id=f"line_{line_num}",
                        line_number=line_num,
                        field="syntax",
                        message=f"Malformed JSON on line {line_num}: {e}"
                    )
                )
                continue

            # Validate Record
            record_issues = validate_dataset_record(
                record=record,
                line_number=line_num,
                seen_ids=seen_ids,
                known_source_ids=known_source_ids
            )

            if record_issues:
                report.issues.extend(record_issues)
            else:
                report.valid_records += 1
                v_status = record.get("verification_status")
                if v_status == "human_verified":
                    report.human_verified_count += 1
                elif v_status == "pending_review":
                    report.pending_review_count += 1
                elif v_status == "synthetic":
                    report.synthetic_count += 1

    return report


def main():
    default_path = Path(__file__).parent / "dataset.jsonl"
    target_path = Path(sys.argv[1]) if len(sys.argv) > 1 else default_path

    print(f"============================================================")
    print(f"Inkloom AI - Dataset Ground-Truth Validator")
    print(f"Target: {target_path.resolve()}")
    print(f"============================================================")

    report = validate_dataset(target_path)

    print(f"Total Records Analyzed:     {report.total_records}")
    print(f"Valid Records:              {report.valid_records}")
    print(f"Human-Verified Records:     {report.human_verified_count}")
    print(f"Pending-Review Records:     {report.pending_review_count}")
    print(f"Synthetic Test Records:     {report.synthetic_count}")
    print(f"Issues / Violations Found:  {len(report.issues)}")
    print(f"============================================================")

    if not report.is_valid:
        print("\n[VALIDATION FAILED] The following errors must be fixed:")
        for issue in report.issues:
            print(f"  • Line {issue.line_number} [{issue.case_id}] -> {issue.field}: {issue.message}")
        sys.exit(1)
    else:
        print("\n[VALIDATION PASSED] All dataset records conform strictly to schema and evidence constraints.")
        sys.exit(0)


if __name__ == "__main__":
    main()
