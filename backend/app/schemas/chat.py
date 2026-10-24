from datetime import datetime, timezone
from typing import List, Optional
from pydantic import BaseModel, Field


class ChatEvidenceItem(BaseModel):
    """
    Evidence citation returned to the chat user for verifiable source grounding.
    """
    sourceId: str
    sourceTitle: str
    sourceType: str
    section: str
    quote: str
    confidenceScore: int = Field(..., ge=0, le=100)
    url: Optional[str] = None


class ChatRelatedFinding(BaseModel):
    """
    Reference to an existing audit finding discussed by the assistant.
    """
    findingId: str
    claim: str
    status: str
    explanation: Optional[str] = None
    category: Optional[str] = None


class ChatRequest(BaseModel):
    """
    User chat message submission.
    Enforces strict message length validation and anti-abuse safeguards.
    """
    message: str = Field(..., min_length=1, max_length=4000, description="User prompt or verification query")
    conversation_id: Optional[str] = Field(None, description="Optional conversation ID to continue existing session")
    audit_id: Optional[str] = Field(None, description="Optional audit ID for contextual inquiry about a specific review")


class ChatMessageResponse(BaseModel):
    """
    Complete message entity returned from the chat assistant.
    """
    id: str
    conversationId: str
    role: str  # "user" | "assistant" | "system"
    content: str
    evidence: List[ChatEvidenceItem] = Field(default_factory=list)
    relatedFindings: List[ChatRelatedFinding] = Field(default_factory=list)
    suggestedPrompts: List[str] = Field(default_factory=list)
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class ChatConversationSummary(BaseModel):
    """
    Summary representation of a user conversation for listing past chat sessions.
    """
    id: str
    title: str
    auditId: Optional[str] = None
    messageCount: int = 0
    createdAt: str
    updatedAt: str


class ChatHistoryResponse(BaseModel):
    """
    Full conversation payload including bounded message history.
    """
    conversationId: str
    title: str
    auditId: Optional[str] = None
    messages: List[ChatMessageResponse] = Field(default_factory=list)
