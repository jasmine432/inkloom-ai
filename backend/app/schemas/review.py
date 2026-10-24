from typing import List, Optional, Dict
from pydantic import BaseModel, Field
from backend.app.schemas.finding import Finding


class ReviewDraftRequest(BaseModel):
    title: str = Field(min_length=1, description="Marketing draft title")
    content: str = Field(min_length=1, description="Draft copy content to audit")
    channel: Optional[str] = None
    targetAudience: Optional[str] = None


class ReviewDecisionsCount(BaseModel):
    accepted: int = 0
    rejected: int = 0
    needsReview: int = 0
    pending: int = 0


class ReviewMetrics(BaseModel):
    totalFindings: int
    supported: int
    contradicted: int
    insufficientEvidence: int
    conflictingSources: int
    needsHumanReview: int
    decisions: ReviewDecisionsCount
    overallTrustScore: int


class ReviewDraftResponse(BaseModel):
    id: Optional[str] = None
    draftTitle: str
    draftContent: Optional[str] = None
    channel: Optional[str] = None
    targetAudience: Optional[str] = None
    isDemo: bool
    executionMode: str
    findings: List[Finding]
    metrics: ReviewMetrics
    analyzedAt: str
    userId: Optional[str] = None


class ReviewSummary(BaseModel):
    id: str
    userId: str
    draftTitle: str
    draftContent: Optional[str] = None
    channel: Optional[str] = None
    isDemo: bool
    overallTrustScore: int
    totalFindings: int
    supportedCount: int
    contradictedCount: int
    createdAt: str
    updatedAt: str


class HealthResponse(BaseModel):
    status: str
    version: str
    llmProvider: str
    isLlmConfigured: bool
    sourcesCount: int
    isAuthConfigured: bool = False
    isDbConfigured: bool = False
    dbStatus: str = "disconnected"
    dbDialect: Optional[str] = None
    dbName: Optional[str] = None
    dbError: Optional[str] = None
