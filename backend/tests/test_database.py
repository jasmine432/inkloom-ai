import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import sessionmaker

from backend.app.main import app
from backend.app.models.db_models import Base, ProfileModel, ReviewModel, FindingModel, EvidenceCitationModel
from backend.app.services.database import get_db, init_db
from backend.app.services.firebase_auth import AuthenticatedUser, firebase_auth_service
from backend.app.schemas.enums import FindingStatus, ReviewerDecision, FindingCategory, EvidenceSourceType
from backend.app.schemas.review import ReviewDraftResponse, ReviewMetrics, ReviewDecisionsCount
from backend.app.schemas.finding import Finding
from backend.app.schemas.evidence import EvidenceItem
from backend.app.services.review_repository import ReviewRepository

from sqlalchemy.pool import StaticPool

# In-memory SQLite engine with StaticPool and foreign keys enabled for test suite
TEST_DATABASE_URL = "sqlite:///:memory:"
test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

from sqlalchemy import event
@event.listens_for(test_engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
client = TestClient(app)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def setup_database():
    """Create all tables before each test and drop after."""
    Base.metadata.create_all(bind=test_engine)
    app.dependency_overrides[get_db] = override_get_db
    yield
    app.dependency_overrides.pop(get_db, None)
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def mock_users():
    user_a = AuthenticatedUser(
        uid="usr_alice_101",
        email="alice@inkloom.test",
        name="Alice Creator",
        email_verified=True,
    )
    user_b = AuthenticatedUser(
        uid="usr_bob_202",
        email="bob@inkloom.test",
        name="Bob Outsider",
        email_verified=True,
    )
    return user_a, user_b


def test_schema_tables_and_columns_integrity():
    """Verify that all required tables exist and that no password column exists in profiles."""
    inspector = inspect(test_engine)
    tables = inspector.get_table_names()
    assert "profiles" in tables
    assert "reviews" in tables
    assert "findings" in tables
    assert "evidence_citations" in tables

    # Security verification: Profiles must NOT have any password or password_hash column
    profile_columns = [col["name"] for col in inspector.get_columns("profiles")]
    assert "user_id" in profile_columns
    assert "email" in profile_columns
    assert "password" not in profile_columns
    assert "password_hash" not in profile_columns
    assert "pwd" not in profile_columns


def test_unauthorized_access_to_user_reviews():
    """Endpoints for private reviews must require valid authentication."""
    res_list = client.get("/api/reviews")
    assert res_list.status_code == 401

    res_detail = client.get("/api/reviews/rev_test_123")
    assert res_detail.status_code == 401

    res_patch = client.patch(
        "/api/reviews/rev_test_123/findings/fnd_1/decision",
        json={"decision": "ACCEPTED"},
    )
    assert res_patch.status_code == 401

    res_delete = client.delete("/api/reviews/rev_test_123")
    assert res_delete.status_code == 401


def test_user_review_persistence_and_isolation(mock_users):
    """
    Test that reviews created by User A:
    1. Persist to database with findings and citations.
    2. Are retrievable by User A.
    3. Are completely invisible and inaccessible to User B (404/isolation).
    """
    user_a, user_b = mock_users

    # Configure mock verifier for User A
    firebase_auth_service.set_mock_verifier(lambda t: user_a if t == "token_alice" else user_b)

    # 1. User A submits a review
    review_payload = {
        "title": "Enterprise Cloud Migration SLA",
        "content": "Inkloom AI ensures 99.9% uptime for cloud content pipelines.",
        "channel": "Whitepaper",
    }
    create_res = client.post(
        "/api/review",
        json=review_payload,
        headers={"Authorization": "Bearer token_alice"},
    )
    assert create_res.status_code == 200
    created_data = create_res.json()
    review_id = created_data.get("id")
    assert review_id is not None
    assert created_data["userId"] == user_a.uid
    assert len(created_data["findings"]) > 0

    # 2. User A lists their reviews -> should see the review
    alice_list_res = client.get(
        "/api/reviews",
        headers={"Authorization": "Bearer token_alice"},
    )
    assert alice_list_res.status_code == 200
    alice_reviews = alice_list_res.json()
    assert len(alice_reviews) == 1
    assert alice_reviews[0]["id"] == review_id
    assert alice_reviews[0]["draftTitle"] == "Enterprise Cloud Migration SLA"

    # 3. User A retrieves full detail
    alice_detail_res = client.get(
        f"/api/reviews/{review_id}",
        headers={"Authorization": "Bearer token_alice"},
    )
    assert alice_detail_res.status_code == 200
    assert alice_detail_res.json()["id"] == review_id
    assert len(alice_detail_res.json()["findings"]) > 0

    # 4. USER ISOLATION CHECK: User B attempts to list reviews -> empty list!
    bob_list_res = client.get(
        "/api/reviews",
        headers={"Authorization": "Bearer token_bob"},
    )
    assert bob_list_res.status_code == 200
    bob_reviews = bob_list_res.json()
    assert len(bob_reviews) == 0

    # 5. USER ISOLATION CHECK: User B attempts to access User A's review by ID -> 404 Access Denied!
    bob_detail_res = client.get(
        f"/api/reviews/{review_id}",
        headers={"Authorization": "Bearer token_bob"},
    )
    assert bob_detail_res.status_code == 404
    assert "not found or access denied" in bob_detail_res.json()["detail"].lower()

    # 6. USER ISOLATION CHECK: User B attempts to delete User A's review -> 404 Access Denied!
    bob_del_res = client.delete(
        f"/api/reviews/{review_id}",
        headers={"Authorization": "Bearer token_bob"},
    )
    assert bob_del_res.status_code == 404

    # 7. Decision update by User A
    finding_id = created_data["findings"][0]["id"]
    alice_patch_res = client.patch(
        f"/api/reviews/{review_id}/findings/{finding_id}/decision",
        json={"decision": "ACCEPTED", "notes": "Verified against SLA agreement."},
        headers={"Authorization": "Bearer token_alice"},
    )
    assert alice_patch_res.status_code == 200
    assert alice_patch_res.json()["reviewerDecision"] == "ACCEPTED"
    assert alice_patch_res.json()["reviewerNotes"] == "Verified against SLA agreement."

    # 8. User B attempts to change decision on User A's finding -> 404 Access Denied!
    bob_patch_res = client.patch(
        f"/api/reviews/{review_id}/findings/{finding_id}/decision",
        json={"decision": "REJECTED", "notes": "Malicious override attempt"},
        headers={"Authorization": "Bearer token_bob"},
    )
    assert bob_patch_res.status_code == 404

    # 9. User A deletes their own review -> 200 OK and cascades
    alice_del_res = client.delete(
        f"/api/reviews/{review_id}",
        headers={"Authorization": "Bearer token_alice"},
    )
    assert alice_del_res.status_code == 200
    assert alice_del_res.json()["deleted"] is True

    # 10. Verify review is gone
    alice_after_del = client.get(
        f"/api/reviews/{review_id}",
        headers={"Authorization": "Bearer token_alice"},
    )
    assert alice_after_del.status_code == 404


def test_cascading_deletes_clean_up_findings_and_evidence():
    """Verify that deleting a review cascades to delete all associated findings and citations."""
    db = TestingSessionLocal()
    try:
        user_id = "usr_cascade_test"
        ReviewRepository.ensure_profile(db, user_id=user_id, email="cascade@test.com")

        finding = Finding(
            id="fnd_casc_1",
            claim="99.9% uptime is guaranteed.",
            status=FindingStatus.SUPPORTED,
            explanation="Supported by SLA covenant.",
            suggestedAction="No change needed.",
            category=FindingCategory.FACTUAL_ACCURACY,
            evidence=[
                EvidenceItem(
                    id="ev_casc_1",
                    sourceId="sla-doc",
                    sourceTitle="Service Level Agreement",
                    sourceType=EvidenceSourceType.BRAND_GUIDELINE,
                    lastUpdated="2026-Q1",
                    quote="99.9% uptime guaranteed",
                    section="SLA Section 3",
                    confidenceScore=95,
                )
            ],
        )

        resp = ReviewDraftResponse(
            id="rev_cascade_1",
            draftTitle="Cascade Draft",
            isDemo=False,
            executionMode="deterministic",
            findings=[finding],
            metrics=ReviewMetrics(
                totalFindings=1,
                supported=1,
                contradicted=0,
                insufficientEvidence=0,
                conflictingSources=0,
                needsHumanReview=0,
                decisions=ReviewDecisionsCount(),
                overallTrustScore=100,
            ),
            analyzedAt=datetime.now(timezone.utc).isoformat(),
            userId=user_id,
        )

        ReviewRepository.save_review(
            db=db,
            user_id=user_id,
            draft_title="Cascade Draft",
            draft_content="Draft content here",
            review_response=resp,
        )

        # Verify records exist in database
        assert db.get(ReviewModel, "rev_cascade_1") is not None
        assert db.get(FindingModel, "fnd_casc_1") is not None
        assert db.get(EvidenceCitationModel, "ev_casc_1") is not None

        # Delete review
        deleted = ReviewRepository.delete_user_review(db, "rev_cascade_1", user_id)
        assert deleted is True

        # Verify cascading deletion cleaned up findings and evidence
        assert db.get(ReviewModel, "rev_cascade_1") is None
        assert db.get(FindingModel, "fnd_casc_1") is None
        assert db.get(EvidenceCitationModel, "ev_casc_1") is None
    finally:
        db.close()


def test_polar_logistics_isolation_enforcement(monkeypatch):
    """Verify that Inkloom AI strictly refuses any connection configured to polar_logistics."""
    from backend.app.config import settings
    from backend.app.services.database import get_normalized_database_url

    monkeypatch.setattr(
        settings,
        "DATABASE_URL",
        "postgresql+psycopg://postgres:fake_pass@localhost:5432/polar_logistics",
    )
    with pytest.raises(ValueError, match="Database isolation violation: Inkloom AI cannot connect to 'polar_logistics'"):
        get_normalized_database_url()


def test_database_isolation_enforces_inkloom_ai_name(monkeypatch):
    """Verify that Inkloom AI local PostgreSQL URLs must strictly specify the inkloom_ai database."""
    from backend.app.config import settings
    from backend.app.services.database import get_normalized_database_url

    monkeypatch.setattr(
        settings,
        "DATABASE_URL",
        "postgresql+psycopg://postgres:fake_pass@localhost:5432/some_other_db",
    )
    with pytest.raises(ValueError, match="must target 'inkloom_ai' strictly"):
        get_normalized_database_url()


def test_remote_host_missing_expected_supabase_host_rejection(monkeypatch):
    """Verify that remote database connections fail when EXPECTED_SUPABASE_HOST is not configured."""
    from backend.app.config import settings
    from backend.app.services.database import get_normalized_database_url

    monkeypatch.setattr(
        settings,
        "DATABASE_URL",
        "postgresql+psycopg://postgres:fake_pass@db.xyzcompany.supabase.co:5432/postgres?sslmode=require",
    )
    monkeypatch.setattr(settings, "EXPECTED_SUPABASE_HOST", None)
    with pytest.raises(ValueError, match="Remote database connections require an explicitly configured EXPECTED_SUPABASE_HOST"):
        get_normalized_database_url()


def test_remote_host_exact_match_enforcement(monkeypatch):
    """Verify that remote connections with mismatching host are rejected, even if ending in supabase.co."""
    from backend.app.config import settings
    from backend.app.services.database import get_normalized_database_url

    monkeypatch.setattr(
        settings,
        "DATABASE_URL",
        "postgresql+psycopg://postgres:fake_pass@attacker-project.supabase.co:5432/postgres?sslmode=require",
    )
    monkeypatch.setattr(settings, "EXPECTED_SUPABASE_HOST", "db.legitproject.supabase.co")
    with pytest.raises(ValueError, match="does not match explicitly configured EXPECTED_SUPABASE_HOST"):
        get_normalized_database_url()


def test_remote_database_name_validation(monkeypatch):
    """Verify that remote connections must match EXPECTED_SUPABASE_DB_NAME (defaults to postgres)."""
    from backend.app.config import settings
    from backend.app.services.database import get_normalized_database_url

    monkeypatch.setattr(
        settings,
        "DATABASE_URL",
        "postgresql+psycopg://postgres:fake_pass@db.legitproject.supabase.co:5432/wrong_db?sslmode=require",
    )
    monkeypatch.setattr(settings, "EXPECTED_SUPABASE_HOST", "db.legitproject.supabase.co")
    monkeypatch.setattr(settings, "EXPECTED_SUPABASE_DB_NAME", "postgres")
    with pytest.raises(ValueError, match="does not match EXPECTED_SUPABASE_DB_NAME 'postgres'"):
        get_normalized_database_url()


def test_remote_tls_enforcement(monkeypatch):
    """Verify that remote database connections must enforce TLS when ENFORCE_SSL is True."""
    from backend.app.config import settings
    from backend.app.services.database import get_normalized_database_url

    # Missing sslmode
    monkeypatch.setattr(
        settings,
        "DATABASE_URL",
        "postgresql+psycopg://postgres:fake_pass@db.legitproject.supabase.co:5432/postgres",
    )
    monkeypatch.setattr(settings, "EXPECTED_SUPABASE_HOST", "db.legitproject.supabase.co")
    monkeypatch.setattr(settings, "ENFORCE_SSL", True)
    with pytest.raises(ValueError, match="Remote database connections must enforce TLS"):
        get_normalized_database_url()

    # Insecure sslmode=disable
    monkeypatch.setattr(
        settings,
        "DATABASE_URL",
        "postgresql+psycopg://postgres:fake_pass@db.legitproject.supabase.co:5432/postgres?sslmode=disable",
    )
    with pytest.raises(ValueError, match="Remote database connections must enforce TLS"):
        get_normalized_database_url()


def test_supabase_project_ref_validation(monkeypatch):
    """Verify that connection credentials must match SUPABASE_PROJECT_REF when configured."""
    from backend.app.config import settings
    from backend.app.services.database import get_normalized_database_url

    monkeypatch.setattr(
        settings,
        "DATABASE_URL",
        "postgresql+psycopg://postgres.wrongref:fake_pass@db.legitproject.supabase.co:5432/postgres?sslmode=require",
    )
    monkeypatch.setattr(settings, "EXPECTED_SUPABASE_HOST", "db.legitproject.supabase.co")
    monkeypatch.setattr(settings, "SUPABASE_PROJECT_REF", "correctprojectref")
    with pytest.raises(ValueError, match="Connection credentials do not match SUPABASE_PROJECT_REF"):
        get_normalized_database_url()

    # When ref matches username: postgres.correctprojectref
    monkeypatch.setattr(
        settings,
        "DATABASE_URL",
        "postgresql+psycopg://postgres.correctprojectref:fake_pass@db.legitproject.supabase.co:5432/postgres?sslmode=require",
    )
    url = get_normalized_database_url()
    assert "postgres.correctprojectref" in url


def test_unconditional_polar_logistics_rejection_even_on_remote(monkeypatch):
    """Verify that polar_logistics is rejected unconditionally, even if host is configured as expected."""
    from backend.app.config import settings
    from backend.app.services.database import get_normalized_database_url

    monkeypatch.setattr(
        settings,
        "DATABASE_URL",
        "postgresql+psycopg://postgres:fake_pass@db.legitproject.supabase.co:5432/polar_logistics?sslmode=require",
    )
    monkeypatch.setattr(settings, "EXPECTED_SUPABASE_HOST", "db.legitproject.supabase.co")
    with pytest.raises(ValueError, match="Inkloom AI cannot connect to 'polar_logistics'. Execution terminated unconditionally."):
        get_normalized_database_url()


def test_sanitize_db_url_or_error():
    """Verify that passwords are stripped from logs and error messages."""
    from backend.app.services.database import sanitize_db_url_or_error

    raw_msg = "connection to postgresql://postgres:super_secret_pwd@localhost:5432/inkloom_ai failed"
    sanitized = sanitize_db_url_or_error(raw_msg)
    assert "super_secret_pwd" not in sanitized
    assert "postgres:***@localhost:5432/inkloom_ai" in sanitized


def test_health_endpoint_reports_dialect_and_dbname():
    """Verify that GET /api/health exposes dbDialect and dbName safely."""
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert "dbDialect" in data
    assert "dbStatus" in data
    assert "dbName" in data


def test_health_check_returns_503_on_configured_db_failure(monkeypatch):
    """Verify that GET /api/health returns HTTP 503 when a configured database fails connectivity."""
    from backend.app.config import settings
    from backend.app.services import database as db_service

    monkeypatch.setattr(settings, "DATABASE_URL", "postgresql+psycopg://postgres:pwd@localhost:5432/inkloom_ai")
    monkeypatch.setattr(db_service, "check_db_connectivity", lambda: False)
    monkeypatch.setattr(
        db_service,
        "get_last_db_error",
        lambda: "connection to postgresql://postgres:secret_pass@localhost:5432/inkloom_ai failed (D:\\secret\\path\\conn.py)",
    )

    res = client.get("/api/health")
    assert res.status_code == 503
    data = res.json()
    assert data["status"] == "degraded"
    assert data["isDbConfigured"] is True
    assert data["dbStatus"] == "disconnected"
    assert data["dbError"] is not None
    # Confirm no credentials or sensitive internal paths leaked
    assert "secret_pass" not in data["dbError"]
    assert "D:\\secret" not in data["dbError"]


def test_health_check_returns_200_when_db_unconfigured(monkeypatch):
    """Verify that GET /api/health returns HTTP 200 when database is not configured for local dev."""
    from backend.app.config import settings
    from backend.app.services import database as db_service

    monkeypatch.setattr(settings, "DATABASE_URL", None)
    monkeypatch.setattr(db_service, "check_db_connectivity", lambda: True)

    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert data["isDbConfigured"] is False


def test_runtime_wire_level_guard_rejects_forbidden_database(monkeypatch):
    """Verify that check_db_connectivity rejects any connection where current_database() != 'inkloom_ai'."""
    from backend.app.services import database as db_service
    from sqlalchemy.engine import Engine

    class MockConn:
        def __enter__(self):
            return self
        def __exit__(self, exc_type, exc_val, exc_tb):
            pass
        def execute(self, stmt):
            class ScalarResult:
                def scalar(self):
                    return "polar_logistics"
            return ScalarResult()

    class MockEngine:
        dialect = type("Dialect", (), {"name": "postgresql"})()
        url = type("URL", (), {"database": "inkloom_ai"})()
        def connect(self):
            return MockConn()

    monkeypatch.setattr(db_service, "get_engine", lambda: MockEngine())

    assert db_service.check_db_connectivity() is False
    assert "Database isolation violation" in db_service.get_last_db_error()
    assert "polar_logistics" in db_service.get_last_db_error()


def test_runtime_wire_level_init_db_rejects_forbidden_database(monkeypatch):
    """Verify that init_db raises ValueError if connected database is not inkloom_ai."""
    from backend.app.services import database as db_service

    class MockConn:
        def __enter__(self):
            return self
        def __exit__(self, exc_type, exc_val, exc_tb):
            pass
        def execute(self, stmt):
            class ScalarResult:
                def scalar(self):
                    return "polar_logistics"
            return ScalarResult()

    class MockEngine:
        dialect = type("Dialect", (), {"name": "postgresql"})()
        url = type("URL", (), {"database": "inkloom_ai"})()
        def connect(self):
            return MockConn()

    monkeypatch.setattr(db_service, "get_engine", lambda: MockEngine())

    with pytest.raises(ValueError, match="Database isolation violation"):
        db_service.init_db()


