import json
import logging
from pathlib import Path
from typing import Dict, List, Optional
from pydantic import BaseModel
from backend.app.config import settings
from backend.app.schemas.source import ApprovedSource
from backend.app.schemas.enums import EvidenceSourceType

logger = logging.getLogger(__name__)


class SourcePassage(BaseModel):
    passage_id: str
    source_id: str
    source_title: str
    source_type: EvidenceSourceType
    document_version: str
    last_updated: str
    section: str
    text: str


class SourceStore:
    """
    Manages loading, caching, and passage indexing of Approved Brand and Legal Guidelines.
    """
    def __init__(self, sources_dir: Optional[str] = None):
        raw_path = Path(sources_dir or settings.SOURCES_DIR)
        if not raw_path.is_absolute() and not raw_path.exists():
            from backend.app.config import BACKEND_DIR
            candidate = BACKEND_DIR / "data" / "sources"
            if candidate.exists():
                raw_path = candidate
        self.sources_dir = raw_path
        self._sources: Dict[str, ApprovedSource] = {}
        self._passages: List[SourcePassage] = []
        self.reload()

    def reload(self) -> None:
        self._sources.clear()
        self._passages.clear()

        if not self.sources_dir.exists():
            logger.warning(f"Sources directory not found: {self.sources_dir.resolve()}")
            return

        for file_path in sorted(self.sources_dir.glob("*.json")):
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    source = ApprovedSource(**data)
                    self._sources[source.id] = source

                    # Map sourceType string to Enum
                    source_type_enum = EvidenceSourceType.BRAND_GUIDELINE
                    for st in EvidenceSourceType:
                        if st.value.lower() == source.category.lower():
                            source_type_enum = st
                            break

                    # Index sections as searchable passages
                    for idx, sec in enumerate(source.sections):
                        self._passages.append(
                            SourcePassage(
                                passage_id=f"{source.id}-sec-{idx}",
                                source_id=source.id,
                                source_title=source.title,
                                source_type=source_type_enum,
                                document_version=source.version,
                                last_updated=source.lastAudited,
                                section=sec.section,
                                text=sec.text.strip(),
                            )
                        )

                    # Index verified claims for comprehensive grounding
                    for idx, claim in enumerate(source.verifiedClaims):
                        self._passages.append(
                            SourcePassage(
                                passage_id=f"{source.id}-claim-{idx}",
                                source_id=source.id,
                                source_title=source.title,
                                source_type=source_type_enum,
                                document_version=source.version,
                                last_updated=source.lastAudited,
                                section="Verified Claims & Policy",
                                text=claim.strip(),
                            )
                        )
            except Exception as e:
                logger.error(f"Failed to load source file {file_path}: {e}")

        logger.info(f"Loaded {len(self._sources)} approved sources with {len(self._passages)} passages.")

    def get_all_sources(self) -> List[ApprovedSource]:
        return list(self._sources.values())

    def get_source_by_id(self, source_id: str) -> Optional[ApprovedSource]:
        return self._sources.get(source_id)

    def get_all_passages(self) -> List[SourcePassage]:
        return self._passages


source_store = SourceStore()
