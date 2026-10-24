from datetime import datetime, timezone
from typing import List, Optional
import uuid
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.app.config import settings
from backend.app.schemas.source import ApprovedSource
from backend.app.schemas.finding import Finding
from backend.app.schemas.review import (
    ReviewDraftRequest,
    ReviewDraftResponse,
    ReviewMetrics,
    ReviewDecisionsCount,
    HealthResponse,
    ReviewSummary,
)
from backend.app.schemas.enums import FindingStatus, ReviewerDecision
from backend.app.services.source_store import source_store
from backend.app.services.llm_auditor import llm_auditor
from backend.app.services.firebase_auth import (
    AuthenticatedUser,
    get_current_user,
    get_optional_user,
    require_verified_user,
    check_auth_rate_limit,
    firebase_auth_service,
)
from backend.app.services.database import (
    get_db,
    check_db_connectivity,
    get_db_dialect,
    get_active_database_name,
    get_last_db_error,
)
from backend.app.services.review_repository import ReviewRepository

import logging

logger = logging.getLogger("inkloom_routes")
router = APIRouter(prefix="/api")


class UpdateFindingDecisionRequest(BaseModel):
    decision: ReviewerDecision
    notes: Optional[str] = None


@router.get("/health", response_model=HealthResponse, tags=["Health"])
def get_health() -> HealthResponse:
    """
    Health check endpoint returning service status, configured LLM provider,
    verified approved sources count, auth readiness, and database connection status.
    """
    db_ok = check_db_connectivity()
    dialect = get_db_dialect()
    db_name = get_active_database_name()
    last_err = get_last_db_error() if not db_ok else None

    return HealthResponse(
        status="ok",
        version="1.0.0",
        llmProvider=settings.LLM_PROVIDER,
        isLlmConfigured=settings.is_llm_configured,
        sourcesCount=len(source_store.get_all_sources()),
        isAuthConfigured=firebase_auth_service.is_configured,
        isDbConfigured=settings.is_db_configured,
        dbStatus="connected" if db_ok else "disconnected",
        dbDialect=dialect,
        dbName=db_name,
        dbError=last_err,
    )


@router.get(
    "/auth/me",
    response_model=AuthenticatedUser,
    dependencies=[Depends(check_auth_rate_limit)],
    tags=["Authentication"],
)
def get_current_user_profile(
    user: AuthenticatedUser = Depends(get_current_user),
) -> AuthenticatedUser:
    """
    Protected endpoint returning the authenticated user's verified identity,
    email verification status, and token claims from Firebase Admin SDK.
    """
    return user


@router.get("/sources", response_model=List[ApprovedSource], tags=["Approved Sources"])
def get_approved_sources() -> List[ApprovedSource]:
    """
    Retrieves all indexed approved guidelines, SLA covenants, and technical benchmark sources.
    """
    return source_store.get_all_sources()


@router.post("/review", response_model=ReviewDraftResponse, tags=["Content Review"])
async def review_draft(
    request: ReviewDraftRequest,
    user: Optional[AuthenticatedUser] = Depends(get_optional_user),
    db: Session = Depends(get_db),
) -> ReviewDraftResponse:
    """
    Cross-references marketing draft claims against approved brand guidelines and sources.
    Returns structured findings categorized by status with verbatim evidence citations.
    When invoked by an authenticated user, automatically persists the review, findings,
    and citations to the PostgreSQL database with strict user_id ownership binding.
    """
    clean_title = request.title.strip()
    clean_content = request.content.strip()

    if not clean_title:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Draft title cannot be empty."
        )

    if not clean_content:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Draft content cannot be empty."
        )

    # Perform audit via real LLM or deterministic rule-based evaluation
    findings, is_demo, execution_mode = await llm_auditor.audit_draft(
        title=clean_title,
        content=clean_content,
        channel=request.channel,
    )

    # Compute review metrics
    total = len(findings)
    supported = sum(1 for f in findings if f.status == FindingStatus.SUPPORTED)
    contradicted = sum(1 for f in findings if f.status == FindingStatus.CONTRADICTED)
    insufficient = sum(1 for f in findings if f.status == FindingStatus.INSUFFICIENT_EVIDENCE)
    conflicting = sum(1 for f in findings if f.status == FindingStatus.CONFLICTING_SOURCES)
    needs_review = sum(1 for f in findings if f.status == FindingStatus.NEEDS_HUMAN_REVIEW)

    trust_score = (
        round(((supported + 0.5 * needs_review) / total) * 100)
        if total > 0
        else 100
    )

    metrics = ReviewMetrics(
        totalFindings=total,
        supported=supported,
        contradicted=contradicted,
        insufficientEvidence=insufficient,
        conflictingSources=conflicting,
        needsHumanReview=needs_review,
        decisions=ReviewDecisionsCount(
            accepted=0,
            rejected=0,
            needsReview=0,
            pending=total,
        ),
        overallTrustScore=trust_score,
    )

    initial_response = ReviewDraftResponse(
        id=f"rev_{uuid.uuid4().hex[:12]}",
        draftTitle=clean_title,
        draftContent=clean_content,
        channel=request.channel,
        targetAudience=request.targetAudience,
        isDemo=is_demo,
        executionMode=execution_mode,
        findings=findings,
        metrics=metrics,
        analyzedAt=datetime.now(timezone.utc).isoformat(),
        userId=user.uid if user else None,
    )

    # If the user is authenticated, persist the review to PostgreSQL
    if user:
        try:
            persisted = ReviewRepository.save_review(
                db=db,
                user_id=user.uid,
                draft_title=clean_title,
                draft_content=clean_content,
                review_response=initial_response,
                channel=request.channel,
                target_audience=request.targetAudience,
                email=user.email,
                display_name=user.name,
                email_verified=user.email_verified,
            )
            return persisted
        except Exception as e:
            # Fall back safely to unpersisted response if DB transaction fails
            logger.warning("Could not persist review to database: %s", str(e))
            return initial_response

    return initial_response


# ---------------------------------------------------------------------------
# Authenticated User Reviews & History Endpoints (Protected by Firebase Auth)
# ---------------------------------------------------------------------------

@router.get("/reviews", response_model=List[ReviewSummary], tags=["User Reviews"])
def list_user_reviews(
    limit: int = 50,
    offset: int = 0,
    user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[ReviewSummary]:
    """
    Retrieves past content review audits belonging strictly to the authenticated user.
    Enforces user isolation at the database query level.
    """
    return ReviewRepository.list_user_reviews(db=db, user_id=user.uid, limit=limit, offset=offset)


@router.get("/reviews/{review_id}", response_model=ReviewDraftResponse, tags=["User Reviews"])
def get_user_review(
    review_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReviewDraftResponse:
    """
    Retrieves full details of a past review audit including findings and verbatim evidence citations.
    Enforces ownership: returns 404 if the review does not belong to the authenticated caller.
    """
    review = ReviewRepository.get_user_review(db=db, review_id=review_id, user_id=user.uid)
    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Review audit not found or access denied.",
        )
    return review


@router.patch(
    "/reviews/{review_id}/findings/{finding_id}/decision",
    response_model=Finding,
    tags=["User Reviews"],
)
def update_finding_decision(
    review_id: str,
    finding_id: str,
    request: UpdateFindingDecisionRequest,
    user: AuthenticatedUser = Depends(require_verified_user),
    db: Session = Depends(get_db),
) -> Finding:
    """
    Updates a reviewer decision (ACCEPTED, REJECTED, NEEDS_REVIEW) and optional reviewer notes.
    Enforces ownership: only the review owner can update decisions.
    Requires email verification.
    """
    updated = ReviewRepository.update_finding_decision(
        db=db,
        review_id=review_id,
        finding_id=finding_id,
        user_id=user.uid,
        decision=request.decision,
        notes=request.notes,
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Finding not found or access denied.",
        )
    return updated


@router.delete("/reviews/{review_id}", tags=["User Reviews"])
def delete_user_review(
    review_id: str,
    user: AuthenticatedUser = Depends(require_verified_user),
    db: Session = Depends(get_db),
):
    """
    Deletes a review audit and cascades deletion of all its findings and citations.
    Enforces ownership: only the review owner can delete it.
    Requires email verification.
    """
    deleted = ReviewRepository.delete_user_review(db=db, review_id=review_id, user_id=user.uid)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Review not found or access denied.",
        )
    return {"deleted": True, "id": review_id}
