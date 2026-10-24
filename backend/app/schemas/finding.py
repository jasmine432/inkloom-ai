from typing import List, Optional
from pydantic import BaseModel
from backend.app.schemas.enums import FindingStatus, ReviewerDecision, FindingCategory
from backend.app.schemas.evidence import EvidenceItem


class Finding(BaseModel):
    id: str
    claim: str
    status: FindingStatus
    explanation: str
    evidence: List[EvidenceItem] = []
    suggestedAction: str
    paragraphIndex: Optional[int] = None
    reviewerDecision: ReviewerDecision = ReviewerDecision.PENDING
    reviewerNotes: Optional[str] = None
    category: FindingCategory
