import logging
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import select, and_, desc

from backend.app.models.db_models import (
    ProfileModel,
    ReviewModel,
    FindingModel,
    EvidenceCitationModel,
)
from backend.app.schemas.review import (
    ReviewDraftResponse,
    ReviewMetrics,
    ReviewDecisionsCount,
    ReviewSummary,
)
from backend.app.schemas.finding import Finding
from backend.app.schemas.evidence import EvidenceItem
from backend.app.schemas.enums import (
    FindingStatus,
    ReviewerDecision,
    FindingCategory,
    EvidenceSourceType,
)

logger = logging.getLogger("inkloom_repo")


class ReviewRepository:
    """
    Data access layer for Profiles, Reviews, Findings, and Evidence Citations.
    Enforces user isolation and authorization on every query.
    """

    @staticmethod
    def ensure_profile(
        db: Session,
        user_id: str,
        email: Optional[str] = None,
        display_name: Optional[str] = None,
        email_verified: bool = False,
    ) -> ProfileModel:
        """
        Creates or updates user profile in database using verified Firebase identity.
        Never stores passwords in the database.
        """
        stmt = select(ProfileModel).where(ProfileModel.user_id == user_id)
        profile = db.scalars(stmt).first()

        now = datetime.now(timezone.utc)
        if not profile:
            profile = ProfileModel(
                user_id=user_id,
                email=email,
                display_name=display_name,
                email_verified=email_verified,
                created_at=now,
                updated_at=now,
            )
            db.add(profile)
            db.commit()
            db.refresh(profile)
        else:
            updated = False
            if email and profile.email != email:
                profile.email = email
                updated = True
            if display_name and profile.display_name != display_name:
                profile.display_name = display_name
                updated = True
            if profile.email_verified != email_verified:
                profile.email_verified = email_verified
                updated = True
            if updated:
                profile.updated_at = now
                db.commit()
                db.refresh(profile)

        return profile

    @staticmethod
    def save_review(
        db: Session,
        user_id: str,
        draft_title: str,
        draft_content: str,
        review_response: ReviewDraftResponse,
        channel: Optional[str] = None,
        target_audience: Optional[str] = None,
        email: Optional[str] = None,
        display_name: Optional[str] = None,
        email_verified: bool = False,
    ) -> ReviewDraftResponse:
        """
        Persists a complete review with all its claims, findings, and citations,
        strictly associating every record with user_id.
        """
        # Ensure profile exists
        ReviewRepository.ensure_profile(
            db,
            user_id=user_id,
            email=email,
            display_name=display_name,
            email_verified=email_verified,
        )

        review_id = review_response.id or f"rev_{uuid.uuid4().hex[:12]}"
        now = datetime.now(timezone.utc)

        review_model = ReviewModel(
            id=review_id,
            user_id=user_id,
            title=draft_title,
            content=draft_content,
            channel=channel,
            target_audience=target_audience,
            is_demo=review_response.isDemo,
            execution_mode=review_response.executionMode,
            overall_trust_score=review_response.metrics.overallTrustScore,
            total_findings=review_response.metrics.totalFindings,
            supported_count=review_response.metrics.supported,
            contradicted_count=review_response.metrics.contradicted,
            insufficient_count=review_response.metrics.insufficientEvidence,
            conflicting_count=review_response.metrics.conflictingSources,
            needs_review_count=review_response.metrics.needsHumanReview,
            created_at=now,
            updated_at=now,
        )
        db.add(review_model)

        # Persist structured findings and their evidence citations
        for f in review_response.findings:
            finding_id = f.id or f"fnd_{uuid.uuid4().hex[:10]}"
            f_model = FindingModel(
                id=finding_id,
                review_id=review_id,
                user_id=user_id,
                claim=f.claim,
                status=f.status.value if hasattr(f.status, "value") else str(f.status),
                explanation=f.explanation,
                suggested_action=f.suggestedAction,
                paragraph_index=f.paragraphIndex,
                reviewer_decision=(
                    f.reviewerDecision.value
                    if hasattr(f.reviewerDecision, "value")
                    else str(f.reviewerDecision)
                ),
                reviewer_notes=f.reviewerNotes,
                category=f.category.value if hasattr(f.category, "value") else str(f.category),
                created_at=now,
            )
            db.add(f_model)

            for ev in f.evidence:
                ev_id = ev.id or f"ev_{uuid.uuid4().hex[:10]}"
                ev_model = EvidenceCitationModel(
                    id=ev_id,
                    finding_id=finding_id,
                    user_id=user_id,
                    source_id=ev.sourceId,
                    source_title=ev.sourceTitle,
                    source_type=(
                        ev.sourceType.value
                        if hasattr(ev.sourceType, "value")
                        else str(ev.sourceType)
                    ),
                    document_version=ev.documentVersion,
                    last_updated=ev.lastUpdated,
                    quote=ev.quote,
                    section=ev.section,
                    confidence_score=ev.confidenceScore,
                    url=ev.url,
                    created_at=now,
                )
                db.add(ev_model)

        db.commit()
        db.refresh(review_model)

        return ReviewRepository._model_to_response(review_model)

    @staticmethod
    def list_user_reviews(
        db: Session,
        user_id: str,
        limit: int = 50,
        offset: int = 0,
    ) -> List[ReviewSummary]:
        """
        Lists past reviews belonging strictly to the authenticated user.
        Never returns another user's records.
        """
        stmt = (
            select(ReviewModel)
            .where(ReviewModel.user_id == user_id)
            .order_by(desc(ReviewModel.created_at))
            .limit(limit)
            .offset(offset)
        )
        models = db.scalars(stmt).all()

        return [
            ReviewSummary(
                id=m.id,
                userId=m.user_id,
                draftTitle=m.title,
                draftContent=m.content,
                channel=m.channel,
                isDemo=m.is_demo,
                overallTrustScore=m.overall_trust_score,
                totalFindings=m.total_findings,
                supportedCount=m.supported_count,
                contradictedCount=m.contradicted_count,
                createdAt=m.created_at.isoformat() if m.created_at else "",
                updatedAt=m.updated_at.isoformat() if m.updated_at else "",
            )
            for m in models
        ]

    @staticmethod
    def get_user_review(
        db: Session,
        review_id: str,
        user_id: str,
    ) -> Optional[ReviewDraftResponse]:
        """
        Retrieves a single review with its findings and citations.
        Enforces user ownership: returns None if the review does not belong to user_id.
        """
        stmt = select(ReviewModel).where(
            and_(ReviewModel.id == review_id, ReviewModel.user_id == user_id)
        )
        model = db.scalars(stmt).first()
        if not model:
            return None

        return ReviewRepository._model_to_response(model)

    @staticmethod
    def update_finding_decision(
        db: Session,
        review_id: str,
        finding_id: str,
        user_id: str,
        decision: ReviewerDecision,
        notes: Optional[str] = None,
    ) -> Optional[Finding]:
        """
        Updates a reviewer decision on a finding.
        Validates ownership of both review and finding before applying update.
        """
        stmt = select(FindingModel).where(
            and_(
                FindingModel.id == finding_id,
                FindingModel.review_id == review_id,
                FindingModel.user_id == user_id,
            )
        )
        finding_model = db.scalars(stmt).first()
        if not finding_model:
            return None

        finding_model.reviewer_decision = (
            decision.value if hasattr(decision, "value") else str(decision)
        )
        if notes is not None:
            finding_model.reviewer_notes = notes

        # Update parent review's updated_at timestamp
        review = db.get(ReviewModel, review_id)
        if review:
            review.updated_at = datetime.now(timezone.utc)

        db.commit()
        db.refresh(finding_model)

        return ReviewRepository._finding_model_to_pydantic(finding_model)

    @staticmethod
    def delete_user_review(
        db: Session,
        review_id: str,
        user_id: str,
    ) -> bool:
        """
        Deletes a review and all cascaded findings and citations.
        Enforces ownership: only deletes if owned by user_id.
        """
        stmt = select(ReviewModel).where(
            and_(ReviewModel.id == review_id, ReviewModel.user_id == user_id)
        )
        review = db.scalars(stmt).first()
        if not review:
            return False

        db.delete(review)
        db.commit()
        return True

    @staticmethod
    def _model_to_response(model: ReviewModel) -> ReviewDraftResponse:
        pydantic_findings: List[Finding] = [
            ReviewRepository._finding_model_to_pydantic(f) for f in model.findings
        ]

        # Calculate decision counts
        accepted = sum(1 for f in pydantic_findings if f.reviewerDecision == ReviewerDecision.ACCEPTED)
        rejected = sum(1 for f in pydantic_findings if f.reviewerDecision == ReviewerDecision.REJECTED)
        needs_rev = sum(1 for f in pydantic_findings if f.reviewerDecision == ReviewerDecision.NEEDS_REVIEW)
        pending = sum(1 for f in pydantic_findings if f.reviewerDecision == ReviewerDecision.PENDING)

        metrics = ReviewMetrics(
            totalFindings=model.total_findings,
            supported=model.supported_count,
            contradicted=model.contradicted_count,
            insufficientEvidence=model.insufficient_count,
            conflictingSources=model.conflicting_count,
            needsHumanReview=model.needs_review_count,
            decisions=ReviewDecisionsCount(
                accepted=accepted,
                rejected=rejected,
                needsReview=needs_rev,
                pending=pending,
            ),
            overallTrustScore=model.overall_trust_score,
        )

        return ReviewDraftResponse(
            id=model.id,
            draftTitle=model.title,
            draftContent=model.content,
            channel=model.channel,
            targetAudience=model.target_audience,
            isDemo=model.is_demo,
            executionMode=model.execution_mode,
            findings=pydantic_findings,
            metrics=metrics,
            analyzedAt=model.created_at.isoformat() if model.created_at else "",
            userId=model.user_id,
        )

    @staticmethod
    def _finding_model_to_pydantic(f: FindingModel) -> Finding:
        # Map status enum
        status_enum = FindingStatus.SUPPORTED
        for s in FindingStatus:
            if s.value == f.status:
                status_enum = s
                break

        # Map decision enum
        dec_enum = ReviewerDecision.PENDING
        for d in ReviewerDecision:
            if d.value == f.reviewer_decision:
                dec_enum = d
                break

        # Map category enum
        cat_enum = FindingCategory.FACTUAL_ACCURACY
        for c in FindingCategory:
            if c.value == f.category:
                cat_enum = c
                break

        pydantic_evidence: List[EvidenceItem] = []
        for ev in f.evidence:
            st_enum = EvidenceSourceType.BRAND_GUIDELINE
            for st in EvidenceSourceType:
                if st.value == ev.source_type:
                    st_enum = st
                    break

            pydantic_evidence.append(
                EvidenceItem(
                    id=ev.id,
                    sourceId=ev.source_id,
                    sourceTitle=ev.source_title,
                    sourceType=st_enum,
                    documentVersion=ev.document_version,
                    lastUpdated=ev.last_updated,
                    quote=ev.quote,
                    section=ev.section,
                    confidenceScore=ev.confidence_score,
                    url=ev.url,
                )
            )

        return Finding(
            id=f.id,
            claim=f.claim,
            status=status_enum,
            explanation=f.explanation,
            evidence=pydantic_evidence,
            suggestedAction=f.suggested_action,
            paragraphIndex=f.paragraph_index,
            reviewerDecision=dec_enum,
            reviewerNotes=f.reviewer_notes,
            category=cat_enum,
        )
