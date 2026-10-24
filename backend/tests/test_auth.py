import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.config import settings
from backend.app.services.firebase_auth import (
    AuthenticatedUser,
    firebase_auth_service,
    extract_bearer_token,
    InMemoryRateLimiter,
)

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_auth_service():
    """Reset mock verifiers after each test run."""
    original_verifier = firebase_auth_service._mock_verifier
    yield
    firebase_auth_service._mock_verifier = original_verifier


def test_auth_me_missing_token_returns_401():
    response = client.get("/api/auth/me")
    assert response.status_code == 401
    assert "Missing Authorization header" in response.json()["detail"]


def test_auth_me_malformed_bearer_returns_401():
    response = client.get("/api/auth/me", headers={"Authorization": "Basic dXNlcjpwYXNz"})
    assert response.status_code == 401
    assert "Invalid Authorization header format" in response.json()["detail"]


def test_auth_me_empty_bearer_returns_401():
    response = client.get("/api/auth/me", headers={"Authorization": "Bearer   "})
    assert response.status_code == 401


def test_auth_me_invalid_token_returns_401():
    def mock_invalid(token: str):
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication token signature or claims.",
            headers={"WWW-Authenticate": "Bearer error=\"invalid_token\""},
        )

    firebase_auth_service.set_mock_verifier(mock_invalid)
    response = client.get("/api/auth/me", headers={"Authorization": "Bearer bad-token-xyz"})
    assert response.status_code == 401
    assert "Invalid authentication token" in response.json()["detail"]


def test_auth_me_expired_token_returns_401():
    def mock_expired(token: str):
        raise HTTPException(
            status_code=401,
            detail="Authentication token has expired. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer error=\"invalid_token\", error_description=\"Token expired\""},
        )

    firebase_auth_service.set_mock_verifier(mock_expired)
    response = client.get("/api/auth/me", headers={"Authorization": "Bearer expired-token"})
    assert response.status_code == 401
    assert "Authentication token has expired" in response.json()["detail"]


def test_auth_me_valid_token_returns_user_profile():
    mock_user = AuthenticatedUser(
        uid="usr_test_12345",
        email="testuser@example.com",
        name="Test User",
        email_verified=True,
        auth_time=1700000000,
        issuer="https://securetoken.google.com/inkloom-test",
        audience="inkloom-test",
    )

    def mock_valid(token: str):
        if token == "valid-firebase-jwt":
            return mock_user
        raise HTTPException(status_code=401, detail="Invalid token")

    firebase_auth_service.set_mock_verifier(mock_valid)
    response = client.get("/api/auth/me", headers={"Authorization": "Bearer valid-firebase-jwt"})
    assert response.status_code == 200
    data = response.json()
    assert data["uid"] == "usr_test_12345"
    assert data["email"] == "testuser@example.com"
    assert data["name"] == "Test User"
    assert data["email_verified"] is True


def test_unverified_email_restriction():
    from backend.app.services.firebase_auth import require_verified_user

    unverified_user = AuthenticatedUser(
        uid="usr_unverified_99",
        email="unverified@example.com",
        name="Unverified User",
        email_verified=False,
    )

    # When REQUIRE_EMAIL_VERIFIED is True, require_verified_user should raise 403
    original_setting = settings.REQUIRE_EMAIL_VERIFIED
    try:
        settings.REQUIRE_EMAIL_VERIFIED = True
        with pytest.raises(HTTPException) as exc_info:
            require_verified_user(unverified_user)
        assert exc_info.value.status_code == 403
        assert "Email verification required" in exc_info.value.detail

        # When email_verified is True, require_verified_user should succeed
        verified_user = AuthenticatedUser(
            uid="usr_verified_99",
            email="verified@example.com",
            name="Verified User",
            email_verified=True,
        )
        result = require_verified_user(verified_user)
        assert result.uid == "usr_verified_99"
        assert result.email_verified is True
    finally:
        settings.REQUIRE_EMAIL_VERIFIED = original_setting


def test_review_draft_unauthenticated_compatibility():
    """Ensure existing review endpoint remains backwards-compatible for unauthenticated calls."""
    response = client.post(
        "/api/review",
        json={
            "title": "Unauthenticated Draft Test",
            "content": "Inkloom AI ensures 99.9% uptime for cloud content pipelines.",
            "channel": "Website",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["draftTitle"] == "Unauthenticated Draft Test"
    assert data["userId"] is None
    assert "findings" in data
    assert "metrics" in data


def test_review_draft_authenticated_binds_user_id():
    """Ensure authenticated reviews bind the caller's verified userId without breaking review logic."""
    mock_user = AuthenticatedUser(
        uid="usr_author_777",
        email="author@example.com",
        name="Review Author",
        email_verified=True,
    )

    firebase_auth_service.set_mock_verifier(lambda t: mock_user)
    response = client.post(
        "/api/review",
        json={
            "title": "Authenticated Draft Test",
            "content": "Inkloom AI operates with strict factual citation validation.",
            "channel": "Website",
        },
        headers={"Authorization": "Bearer auth-token-author"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["draftTitle"] == "Authenticated Draft Test"
    assert data["userId"] == "usr_author_777"


def test_health_endpoint_includes_auth_status():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert "isAuthConfigured" in data
    assert isinstance(data["isAuthConfigured"], bool)


def test_rate_limiter_sliding_window():
    limiter = InMemoryRateLimiter(limit=3, window_seconds=10)
    client_ip = "192.168.1.100"

    assert limiter.is_allowed(client_ip) is True
    assert limiter.is_allowed(client_ip) is True
    assert limiter.is_allowed(client_ip) is True
    # 4th request within window exceeds limit of 3
    assert limiter.is_allowed(client_ip) is False


def test_extract_bearer_token_helper():
    assert extract_bearer_token(None) is None
    assert extract_bearer_token("Bearer mytoken123") == "mytoken123"

    with pytest.raises(HTTPException) as exc_info:
        extract_bearer_token("Token mytoken123")
    assert exc_info.value.status_code == 401


def test_simulation_tokens_rejected_in_production():
    """Verify that development simulation tokens are strictly rejected in non-development environments."""
    original_env = settings.ENVIRONMENT
    try:
        settings.ENVIRONMENT = "production"
        with pytest.raises(HTTPException) as exc_info:
            firebase_auth_service.verify_token("sim_token_user_123")
        assert exc_info.value.status_code == 401
        assert "rejected in production mode" in exc_info.value.detail
    finally:
        settings.ENVIRONMENT = original_env


def test_simulation_tokens_rejected_when_setting_disabled():
    """Verify that simulation tokens can be explicitly disabled even in development."""
    original_setting = settings.ALLOW_DEV_SIMULATION_TOKENS
    try:
        settings.ALLOW_DEV_SIMULATION_TOKENS = False
        with pytest.raises(HTTPException) as exc_info:
            firebase_auth_service.verify_token("sim_token_user_123")
        assert exc_info.value.status_code == 401
        assert "rejected in production mode" in exc_info.value.detail
    finally:
        settings.ALLOW_DEV_SIMULATION_TOKENS = original_setting


def test_simulation_tokens_distinguish_verified_and_unverified():
    """Verify that unverified simulation tokens produce email_verified=False."""
    original_env = settings.ENVIRONMENT
    original_setting = settings.ALLOW_DEV_SIMULATION_TOKENS
    try:
        settings.ENVIRONMENT = "development"
        settings.ALLOW_DEV_SIMULATION_TOKENS = True

        verified_user = firebase_auth_service.verify_token("sim_token_alice")
        assert verified_user.uid == "alice"
        assert verified_user.email_verified is True

        unverified_user = firebase_auth_service.verify_token("sim_token_unverified_bob")
        assert unverified_user.uid == "bob"
        assert unverified_user.email_verified is False
    finally:
        settings.ENVIRONMENT = original_env
        settings.ALLOW_DEV_SIMULATION_TOKENS = original_setting


def test_protected_routes_reject_unverified_simulation_tokens():
    """Verify that protected API endpoints return 403 Forbidden when invoked with an unverified token."""
    original_env = settings.ENVIRONMENT
    original_setting = settings.ALLOW_DEV_SIMULATION_TOKENS
    original_verified_req = settings.REQUIRE_EMAIL_VERIFIED
    try:
        settings.ENVIRONMENT = "development"
        settings.ALLOW_DEV_SIMULATION_TOKENS = True
        settings.REQUIRE_EMAIL_VERIFIED = True

        unverified_token = "Bearer sim_token_unverified_charlie"

        # Attempt to submit chat message
        chat_resp = client.post(
            "/api/chat",
            json={"message": "Hello assistant"},
            headers={"Authorization": unverified_token},
        )
        assert chat_resp.status_code == 403
        assert "Email verification required" in chat_resp.json()["detail"]

        # Attempt to update a finding decision
        update_resp = client.patch(
            "/api/reviews/rev_test_123/findings/f_test_456/decision",
            json={"decision": "accepted"},
            headers={"Authorization": unverified_token},
        )
        assert update_resp.status_code == 403
        assert "Email verification required" in update_resp.json()["detail"]

        # Attempt to delete a review
        delete_resp = client.delete(
            "/api/reviews/rev_test_123",
            headers={"Authorization": unverified_token},
        )
        assert delete_resp.status_code == 403
        assert "Email verification required" in delete_resp.json()["detail"]
    finally:
        settings.ENVIRONMENT = original_env
        settings.ALLOW_DEV_SIMULATION_TOKENS = original_setting
        settings.REQUIRE_EMAIL_VERIFIED = original_verified_req
