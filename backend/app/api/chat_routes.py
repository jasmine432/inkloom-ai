import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.config import settings
from backend.app.schemas.chat import (
    ChatRequest,
    ChatMessageResponse,
    ChatConversationSummary,
    ChatHistoryResponse,
)
from backend.app.services.firebase_auth import (
    AuthenticatedUser,
    get_current_user,
    get_optional_authenticated_user,
    require_verified_user,
    check_chat_rate_limit,
)
from backend.app.services.database import get_db
from backend.app.services.chat_service import ChatService

logger = logging.getLogger("inkloom_chat_routes")
router = APIRouter(prefix="/api/chat", tags=["Inkloom AI Assistant"])


@router.post(
    "",
    response_model=ChatMessageResponse,
    dependencies=[Depends(check_chat_rate_limit)],
    summary="Submit message to Inkloom AI Assistant",
)
async def submit_chat_message(
    request: ChatRequest,
    user: Optional[AuthenticatedUser] = Depends(get_optional_authenticated_user),
    db: Session = Depends(get_db),
) -> ChatMessageResponse:
    """
    Submits a message to the Inkloom AI Assistant.
    Supports safe public exploration for unauthenticated visitors with IP-based rate limiting,
    and persistent conversation history with tenant isolation for authenticated users.
    """
    if user and settings.REQUIRE_EMAIL_VERIFIED and not user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email verification required before accessing this resource. Please check your inbox or resend verification.",
        )

    try:
        response = await ChatService.process_chat_message(
            db=db,
            user_id=user.uid if user else None,
            request=request,
            user_email=user.email if user else None,
            user_name=user.name if user else None,
        )
        return response
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Unhandled exception processing chat message: %s", str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while generating the assistant response.",
        )


@router.get(
    "/conversations",
    response_model=List[ChatConversationSummary],
    summary="List past assistant conversations",
)
def list_user_conversations(
    limit: int = 20,
    user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[ChatConversationSummary]:
    """
    Retrieves past chat conversations belonging strictly to the authenticated user.
    Enforces tenant isolation.
    """
    return ChatService.list_conversations(db=db, user_id=user.uid, limit=limit)


@router.get(
    "/conversations/{conversation_id}",
    response_model=ChatHistoryResponse,
    summary="Get conversation history",
)
def get_conversation_history(
    conversation_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChatHistoryResponse:
    """
    Retrieves full message history for a specific conversation.
    Enforces ownership: returns 404 if conversation does not belong to the caller.
    """
    return ChatService.get_conversation_history(
        db=db,
        conversation_id=conversation_id,
        user_id=user.uid,
    )


@router.delete(
    "/conversations/{conversation_id}",
    summary="Delete conversation",
)
def delete_conversation(
    conversation_id: str,
    user: AuthenticatedUser = Depends(require_verified_user),
    db: Session = Depends(get_db),
):
    """
    Deletes a conversation and its messages.
    Enforces ownership: returns 404 if conversation does not belong to the caller.
    """
    ChatService.delete_conversation(
        db=db,
        conversation_id=conversation_id,
        user_id=user.uid,
    )
    return {"deleted": True, "id": conversation_id}
