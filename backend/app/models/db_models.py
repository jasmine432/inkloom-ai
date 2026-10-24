from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class ProfileModel(Base):
    """
    User profiles mapped directly from authenticated Firebase User IDs.
    Passwords are never stored in the database.
    """
    __tablename__ = "profiles"

    user_id = Column(String(128), primary_key=True)
    email = Column(String(255), nullable=True, index=True)
    display_name = Column(String(255), nullable=True)
    email_verified = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    reviews = relationship("ReviewModel", back_populates="profile", cascade="all, delete-orphan")
    conversations = relationship("ConversationModel", back_populates="profile", cascade="all, delete-orphan")


class ReviewModel(Base):
    """
    Marketing content reviews and fact-checking audit sessions.
    Each review is strictly owned by the authenticated Firebase user.
    """
    __tablename__ = "reviews"

    id = Column(String(64), primary_key=True)
    user_id = Column(String(128), ForeignKey("profiles.user_id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(Text, nullable=False)
    content = Column(Text, nullable=False)
    channel = Column(String(100), nullable=True)
    target_audience = Column(String(100), nullable=True)
    is_demo = Column(Boolean, default=False)
    execution_mode = Column(String(64), default="live_gemini_structured")
    overall_trust_score = Column(Integer, default=100)
    total_findings = Column(Integer, default=0)
    supported_count = Column(Integer, default=0)
    contradicted_count = Column(Integer, default=0)
    insufficient_count = Column(Integer, default=0)
    conflicting_count = Column(Integer, default=0)
    needs_review_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    profile = relationship("ProfileModel", back_populates="reviews")
    findings = relationship(
        "FindingModel",
        back_populates="review",
        cascade="all, delete-orphan",
        order_by="FindingModel.created_at",
    )
    conversations = relationship("ConversationModel", back_populates="audit")


class FindingModel(Base):
    """
    Structured claim audit findings associated with a review.
    """
    __tablename__ = "findings"

    id = Column(String(64), primary_key=True)
    review_id = Column(String(64), ForeignKey("reviews.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(128), ForeignKey("profiles.user_id", ondelete="CASCADE"), nullable=False, index=True)
    claim = Column(Text, nullable=False)
    status = Column(String(64), nullable=False, index=True)
    explanation = Column(Text, nullable=False)
    suggested_action = Column(Text, nullable=False)
    paragraph_index = Column(Integer, nullable=True)
    reviewer_decision = Column(String(32), default="PENDING")
    reviewer_notes = Column(Text, nullable=True)
    category = Column(String(64), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    review = relationship("ReviewModel", back_populates="findings")
    evidence = relationship(
        "EvidenceCitationModel",
        back_populates="finding",
        cascade="all, delete-orphan",
        order_by="EvidenceCitationModel.created_at",
    )


class EvidenceCitationModel(Base):
    """
    Verbatim citations and ground-truth quotations proving or refuting claims.
    """
    __tablename__ = "evidence_citations"

    id = Column(String(64), primary_key=True)
    finding_id = Column(String(64), ForeignKey("findings.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(128), ForeignKey("profiles.user_id", ondelete="CASCADE"), nullable=False, index=True)
    source_id = Column(String(128), nullable=True, index=True)
    source_title = Column(Text, nullable=False)
    source_type = Column(String(64), nullable=False)
    document_version = Column(String(64), nullable=True)
    last_updated = Column(String(64), nullable=False)
    quote = Column(Text, nullable=False)
    section = Column(Text, nullable=False)
    confidence_score = Column(Integer, nullable=False)
    url = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    finding = relationship("FindingModel", back_populates="evidence")


class ConversationModel(Base):
    """
    Chat conversations between the authenticated user and Inkloom AI Assistant.
    Can be tied optionally to a specific audit review.
    """
    __tablename__ = "conversations"

    id = Column(String(64), primary_key=True)
    user_id = Column(String(128), ForeignKey("profiles.user_id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(Text, nullable=False)
    audit_id = Column(String(64), ForeignKey("reviews.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    profile = relationship("ProfileModel", back_populates="conversations")
    audit = relationship("ReviewModel", back_populates="conversations")
    messages = relationship(
        "ChatMessageModel",
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="ChatMessageModel.created_at",
    )


class ChatMessageModel(Base):
    """
    Individual chat messages in an assistant conversation.
    Stores content, role, and structured JSON payloads for evidence citations and related findings.
    """
    __tablename__ = "chat_messages"

    id = Column(String(64), primary_key=True)
    conversation_id = Column(String(64), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(128), ForeignKey("profiles.user_id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(32), nullable=False)  # "user", "assistant", "system"
    content = Column(Text, nullable=False)
    evidence_json = Column(Text, nullable=True)
    related_findings_json = Column(Text, nullable=True)
    suggested_prompts_json = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)

    conversation = relationship("ConversationModel", back_populates="messages")

