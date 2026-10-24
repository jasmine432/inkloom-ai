import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.config import settings
from backend.app.schemas.enums import FindingStatus, ReviewerDecision, FindingCategory, EvidenceSourceType
from backend.app.schemas.finding import Finding
from backend.app.schemas.evidence import EvidenceItem
from backend.app.services.source_store import source_store
from backend.app.services.retriever import retriever
from backend.app.services.validator import citation_validator

client = TestClient(app)


@pytest.fixture(autouse=True)
def isolate_demo_mode(monkeypatch):
    """Ensure baseline backend tests run in deterministic demo mode without live external API calls."""
    monkeypatch.setattr(settings, "LLM_PROVIDER", "none")
    monkeypatch.setattr(settings, "GEMINI_API_KEY", None)
    monkeypatch.setattr(settings, "OPENAI_API_KEY", None)


def test_health_endpoint():
    """Verify backend health endpoint returns status, provider, and loaded sources."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["version"] == "1.0.0"
    assert "llmProvider" in data
    assert "isLlmConfigured" in data
    assert data["sourcesCount"] >= 4


def test_get_sources_endpoint():
    """Verify GET /api/sources returns indexed approved guidelines."""
    response = client.get("/api/sources")
    assert response.status_code == 200
    sources = response.json()
    assert len(sources) >= 4
    source_ids = [s["id"] for s in sources]
    assert "src-bg-01" in source_ids
    assert "src-leg-03" in source_ids
    assert "src-prod-02" in source_ids
    assert "src-mkt-04" in source_ids


def test_passage_retriever_deterministic():
    """Verify deterministic retrieval finds relevant passages for specific terms."""
    # Test 1: Query for uptime availability
    results = retriever.retrieve("99.9% uptime monthly availability", top_k=2)
    assert len(results) > 0
    assert any("99.9%" in r.passage.text for r in results)

    # Test 2: Query for ingestion capacity
    results = retriever.retrieve("ingest 500 brand guideline manuals", top_k=2)
    assert len(results) > 0
    assert any("500" in r.passage.text for r in results)


def test_citation_validator_with_valid_quote():
    """Verify validator accepts real verbatim quotes from approved sources."""
    valid_quote = "Inkloom guarantees 99.9% monthly service availability for Enterprise subscriptions, and 99.5% for standard Business tiers."
    is_valid, confidence = citation_validator.validate_quote_in_source(
        quote=valid_quote,
        source_title="Q3 Enterprise SLA & Compliance Warranty"
    )
    assert is_valid is True
    assert confidence >= 90


def test_citation_validator_with_hallucinated_quote():
    """
    Verify validator rejects hallucinated quotes, strips fake evidence,
    and downgrades finding to INSUFFICIENT_EVIDENCE.
    """
    hallucinated_quote = "Inkloom guarantees 100% complete immunity from all lawsuits forever."
    finding = Finding(
        id="f-test-hallucinated",
        claim="Our AI guarantees total immunity from lawsuits.",
        status=FindingStatus.CONTRADICTED,
        explanation="Testing hallucinated quote safeguard.",
        evidence=[
            EvidenceItem(
                id="ev-fake",
                sourceTitle="Q3 Enterprise SLA & Compliance Warranty",
                sourceType=EvidenceSourceType.LEGAL_AND_COMPLIANCE,
                lastUpdated="Oct 02, 2026",
                quote=hallucinated_quote,
                section="Fake Section",
                confidenceScore=99,
            )
        ],
        suggestedAction="Remove claim.",
        reviewerDecision=ReviewerDecision.PENDING,
        category=FindingCategory.LEGAL_REGULATORY,
    )

    validated = citation_validator.validate_finding(finding)

    # Fake evidence must be purged
    assert len(validated.evidence) == 0
    # Must be downgraded to INSUFFICIENT_EVIDENCE
    assert validated.status == FindingStatus.INSUFFICIENT_EVIDENCE
    assert "No verbatim citation could be substantiated" in validated.explanation
    # Reviewer decision must remain PENDING
    assert validated.reviewerDecision == ReviewerDecision.PENDING


def test_review_endpoint_supported_and_contradicted():
    """Verify POST /api/review correctly identifies supported and contradicted claims."""
    payload = {
        "title": "Q4 Enterprise Launch Announcement",
        "content": (
            "Inkloom AI guarantees 99.999% uptime for all global corporate teams. "
            "Our engine can ingest up to 500 brand guideline manuals simultaneously."
        ),
        "channel": "Press Release"
    }
    response = client.post("/api/review", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["draftTitle"] == "Q4 Enterprise Launch Announcement"
    assert data["isDemo"] is True
    assert "executionMode" in data
    assert len(data["findings"]) >= 2

    statuses = [f["status"] for f in data["findings"]]
    assert FindingStatus.CONTRADICTED.value in statuses
    assert FindingStatus.SUPPORTED.value in statuses

    # Metrics verification
    metrics = data["metrics"]
    assert metrics["totalFindings"] == len(data["findings"])
    assert metrics["supported"] >= 1
    assert metrics["contradicted"] >= 1
    assert metrics["decisions"]["pending"] == len(data["findings"])


def test_review_endpoint_insufficient_evidence():
    """Verify arbitrary ungrounded claim receives INSUFFICIENT_EVIDENCE status."""
    payload = {
        "title": "Quantum Teleportation Campaign",
        "content": "Inkloom AI features quantum teleportation of marketing databases through subatomic wormholes.",
        "channel": "Social"
    }
    response = client.post("/api/review", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert len(data["findings"]) >= 1
    # Unknown assertion must be marked as INSUFFICIENT_EVIDENCE
    assert data["findings"][0]["status"] == FindingStatus.INSUFFICIENT_EVIDENCE.value


def test_review_endpoint_malformed_requests():
    """Verify 422 HTTP validation errors on invalid or empty payloads."""
    # Empty title
    res_empty_title = client.post("/api/review", json={"title": "", "content": "Valid content."})
    assert res_empty_title.status_code == 422

    # Empty content
    res_empty_content = client.post("/api/review", json={"title": "Valid Title", "content": "   "})
    assert res_empty_content.status_code == 422

    # Missing required content field
    res_missing_field = client.post("/api/review", json={"title": "Valid Title"})
    assert res_missing_field.status_code == 422


def test_missing_api_credentials_safe_behavior():
    """Verify backend operates safely without crashing when no API keys are present."""
    assert settings.is_llm_configured is False
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json()["isLlmConfigured"] is False
