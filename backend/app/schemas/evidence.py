from typing import Optional
from pydantic import BaseModel, Field
from backend.app.schemas.enums import EvidenceSourceType


class EvidenceItem(BaseModel):
    id: str
    sourceId: Optional[str] = None
    sourceTitle: str
    sourceType: EvidenceSourceType
    documentVersion: Optional[str] = None
    lastUpdated: str
    quote: str
    section: str
    confidenceScore: int = Field(ge=0, le=100)
    url: Optional[str] = None

