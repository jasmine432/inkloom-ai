from typing import List
from pydantic import BaseModel


class SourceSection(BaseModel):
    section: str
    text: str


class ApprovedSource(BaseModel):
    id: str
    title: str
    category: str
    version: str
    lastAudited: str
    owner: str
    ruleCount: int
    description: str
    verifiedClaims: List[str]
    sections: List[SourceSection] = []
