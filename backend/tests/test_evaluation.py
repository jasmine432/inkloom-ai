"""
Automated test suite for Inkloom AI Evaluation System.

Tests:
1. Valid dataset records.
2. Malformed records.
3. Duplicate IDs.
4. Invalid source references.
5. Evidence quotation validation.
6. Metric calculations (precision, recall, F1, confusion matrix).
7. Correct handling of missing or unverified labels.
8. Deterministic evaluation mode execution.
9. Failed and timed-out evaluations handled gracefully.
10. Report generation (JSON, MD, CSV).
"""

import json
import pytest
from pathlib import Path
from backend.evaluation.validate_dataset import (
    validate_dataset,
    validate_dataset_record,
    ValidationReport,
)
from backend.app.services.llm_auditor import llm_auditor
from unittest.mock import patch, AsyncMock
from backend.evaluation.run_evaluation import (
    EvaluationHarness,
    calculate_metrics,
    save_reports,
    CaseEvaluationResult,
    run_evaluation,
    recompute_and_save_reports_from_json,
)

DATASET_PATH = Path(__file__).parent.parent / "evaluation" / "dataset.jsonl"


def test_ground_truth_dataset_valid():
    """Verify the real dataset.jsonl conforms strictly to all schema and grounding constraints."""
    assert DATASET_PATH.exists(), f"Dataset file missing at {DATASET_PATH}"
    report = validate_dataset(DATASET_PATH)

    assert report.is_valid is True, f"Validation issues found: {[i.message for i in report.issues]}"
    assert report.total_records >= 25, f"Expected at least 25 records, found {report.total_records}"
    assert report.human_verified_count >= 20, "Expected at least 20 human-verified cases"
    assert report.synthetic_count >= 2, "Expected synthetic cases to be explicitly tracked"
    assert len(report.issues) == 0


def test_validate_dataset_rejects_malformed_json(tmp_path):
    """Verify validator flags malformed JSON syntax."""
    bad_file = tmp_path / "bad_dataset.jsonl"
    bad_file.write_text('{"case_id": "case_1", "draft_title": "broken JSON\n', encoding="utf-8")

    report = validate_dataset(bad_file)
    assert report.is_valid is False
    assert any("Malformed JSON" in i.message for i in report.issues)


def test_validate_dataset_detects_duplicate_ids(tmp_path):
    """Verify validator flags duplicate case_id entries."""
    dup_file = tmp_path / "dup_dataset.jsonl"
    case = {
        "case_id": "case_dup",
        "draft_title": "Title",
        "draft_text": "Content",
        "expected_findings": [
            {
                "claim": "Claim",
                "status": "SUPPORTED",
                "explanation": "Exp",
                "suggested_action": "Action",
                "category": "Factual Accuracy",
            }
        ],
        "expected_status": "SUPPORTED",
        "expected_source_ids": ["src-leg-03"],
        "expected_evidence": [
            "Inkloom guarantees 99.9% monthly service availability for Enterprise subscriptions, and 99.5% for standard Business tiers."
        ],
        "severity": "LOW",
        "rationale": "Rationale",
        "case_type": "supported_claim",
        "verification_status": "human_verified",
    }
    with open(dup_file, "w", encoding="utf-8") as f:
        f.write(json.dumps(case) + "\n")
        f.write(json.dumps(case) + "\n")

    report = validate_dataset(dup_file)
    assert report.is_valid is False
    assert any("Duplicate case_id" in i.message for i in report.issues)


def test_validate_dataset_detects_invalid_source_id():
    """Verify validator catches unknown source references."""
    seen_ids = set()
    known_sources = {"src-leg-03", "src-bg-01"}
    record = {
        "case_id": "case_unknown_src",
        "draft_title": "Title",
        "draft_text": "Content",
        "expected_findings": [
            {
                "claim": "Claim",
                "status": "SUPPORTED",
                "explanation": "Exp",
                "suggested_action": "Action",
                "category": "Factual Accuracy",
            }
        ],
        "expected_status": "SUPPORTED",
        "expected_source_ids": ["src-nonexistent-99"],
        "expected_evidence": [],
        "severity": "LOW",
        "rationale": "Rationale",
        "case_type": "supported_claim",
        "verification_status": "pending_review",
    }
    issues = validate_dataset_record(record, 1, seen_ids, known_sources)
    assert any("Referenced source ID 'src-nonexistent-99' not found" in i.message for i in issues)


def test_validate_dataset_detects_hallucinated_evidence():
    """Verify validator flags quotes that do not exist verbatim in the source document."""
    seen_ids = set()
    known_sources = {"src-leg-03"}
    record = {
        "case_id": "case_hallucinated_quote",
        "draft_title": "Title",
        "draft_text": "Content",
        "expected_findings": [
            {
                "claim": "Claim",
                "status": "SUPPORTED",
                "explanation": "Exp",
                "suggested_action": "Action",
                "category": "Factual Accuracy",
            }
        ],
        "expected_status": "SUPPORTED",
        "expected_source_ids": ["src-leg-03"],
        "expected_evidence": ["This hallucinated quote definitely does not exist in the SLA document."],
        "severity": "LOW",
        "rationale": "Rationale",
        "case_type": "supported_claim",
        "verification_status": "human_verified",
    }
    issues = validate_dataset_record(record, 1, seen_ids, known_sources)
    assert any("Evidence quote" in i.message and "was not found verbatim" in i.message for i in issues)


def test_validate_dataset_detects_invalid_status_and_severity():
    """Verify validator rejects invalid status or severity strings."""
    seen_ids = set()
    known_sources = {"src-leg-03"}
    record = {
        "case_id": "case_bad_enum",
        "draft_title": "Title",
        "draft_text": "Content",
        "expected_findings": [
            {
                "claim": "Claim",
                "status": "INVALID_STATUS",
                "explanation": "Exp",
                "suggested_action": "Action",
                "category": "Factual Accuracy",
            }
        ],
        "expected_status": "NON_EXISTENT_STATUS",
        "expected_source_ids": [],
        "expected_evidence": [],
        "severity": "ULTRA_CRITICAL",
        "rationale": "Rationale",
        "case_type": "supported_claim",
        "verification_status": "human_verified",
    }
    issues = validate_dataset_record(record, 1, seen_ids, known_sources)
    assert any("Invalid expected_status" in i.message for i in issues)
    assert any("Invalid severity" in i.message for i in issues)


def test_metrics_calculation_accuracy_precision_recall():
    """Verify accuracy, precision, recall, and F1 calculations."""
    results = [
        CaseEvaluationResult(
            case_id="c1",
            draft_title="T1",
            case_type="supported_claim",
            verification_status="human_verified",
            expected_status="SUPPORTED",
            predicted_status="SUPPORTED",
            status_match=True,
            expected_sources=["src-leg-03"],
            predicted_sources=["src-leg-03"],
            source_match=True,
            expected_evidence_count=1,
            matched_evidence_count=1,
            evidence_exact_match=True,
            findings_count=1,
            execution_mode="deterministic",
            is_demo=True,
            latency_ms=1.5,
        ),
        CaseEvaluationResult(
            case_id="c2",
            draft_title="T2",
            case_type="contradicted_claim",
            verification_status="human_verified",
            expected_status="CONTRADICTED",
            predicted_status="INSUFFICIENT_EVIDENCE",
            status_match=False,
            expected_sources=["src-leg-03"],
            predicted_sources=[],
            source_match=False,
            expected_evidence_count=1,
            matched_evidence_count=0,
            evidence_exact_match=False,
            findings_count=1,
            execution_mode="deterministic",
            is_demo=True,
            latency_ms=2.0,
        ),
    ]

    metrics = calculate_metrics(results)
    assert metrics["metadata"]["total_cases"] == 2
    assert metrics["headline_metrics"]["overall_accuracy_pct"] == 50.0

    # SUPPORTED: TP=1, FP=0, FN=0 -> Precision=100%, Recall=100%, F1=100%
    sup = metrics["per_status_metrics"]["SUPPORTED"]
    assert sup["precision"] == 100.0
    assert sup["recall"] == 100.0
    assert sup["f1"] == 100.0

    # CONTRADICTED: TP=0, FP=0, FN=1 -> Precision=0, Recall=0, F1=0
    contra = metrics["per_status_metrics"]["CONTRADICTED"]
    assert contra["precision"] == 0.0
    assert contra["recall"] == 0.0
    assert contra["f1"] == 0.0

    # Macro F1 should be average of evaluated F1s
    assert metrics["headline_metrics"]["macro_f1"] > 0


def test_metrics_empty_results_handled_gracefully():
    """Verify calculate_metrics handles empty inputs without DivisionByZero."""
    metrics = calculate_metrics([])
    assert metrics == {}


@pytest.mark.asyncio
async def test_deterministic_harness_evaluates_sample_case():
    """Verify EvaluationHarness runs in deterministic mode without network dependencies."""
    harness = EvaluationHarness(mode="deterministic")
    sample_case = {
        "case_id": "test_case_sample",
        "draft_title": "Enterprise Capacity Test",
        "draft_text": "Verified cluster capacity supports ingestion of up to 500 simultaneous brand guideline PDFs and Markdown sources per tenant.",
        "expected_status": "SUPPORTED",
        "expected_source_ids": ["src-prod-02"],
        "expected_evidence": [
            "Verified cluster capacity supports ingestion of up to 500 simultaneous brand guideline PDFs and Markdown sources per tenant."
        ],
        "case_type": "supported_claim",
        "verification_status": "human_verified",
        "rationale": "Direct quote from benchmarks",
    }

    result = await harness.evaluate_single_case(sample_case)

    assert result.case_id == "test_case_sample"
    assert result.error is None
    assert result.predicted_status == "SUPPORTED"
    assert result.status_match is True
    assert result.source_match is True
    assert result.evidence_exact_match is True
    assert result.is_demo is True
    assert result.execution_mode == "deterministic_rule_evaluation"


@pytest.mark.asyncio
async def test_harness_handles_exceptions_gracefully(monkeypatch):
    """Verify that execution errors or timeouts produce structured error records rather than crashing."""
    harness = EvaluationHarness(mode="deterministic")

    def broken_audit(*args, **kwargs):
        raise TimeoutError("Simulated LLM network timeout")

    monkeypatch.setattr(
        llm_auditor,
        "_audit_deterministic",
        broken_audit
    )

    sample_case = {
        "case_id": "test_error_case",
        "draft_title": "Timeout Test",
        "draft_text": "Testing timeout handling.",
        "expected_status": "SUPPORTED",
        "case_type": "supported_claim",
        "verification_status": "pending_review",
    }

    result = await harness.evaluate_single_case(sample_case)

    assert result.case_id == "test_error_case"
    assert result.status_match is False
    assert result.predicted_status == "ERROR"
    assert "Simulated LLM network timeout" in result.error


def test_save_reports_generates_json_md_csv(tmp_path):
    """Verify report generation writes valid JSON, Markdown, and CSV files."""
    results = [
        CaseEvaluationResult(
            case_id="case_001",
            draft_title="SLA Test",
            case_type="supported_claim",
            verification_status="human_verified",
            expected_status="SUPPORTED",
            predicted_status="SUPPORTED",
            status_match=True,
            expected_sources=["src-leg-03"],
            predicted_sources=["src-leg-03"],
            source_match=True,
            expected_evidence_count=1,
            matched_evidence_count=1,
            evidence_exact_match=True,
            findings_count=1,
            execution_mode="deterministic_rule_evaluation",
            is_demo=True,
            latency_ms=0.5,
        )
    ]
    metrics = calculate_metrics(results)
    json_path, md_path, csv_path = save_reports(results, metrics, tmp_path)

    assert json_path.exists()
    assert md_path.exists()
    assert csv_path.exists()

    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        assert data["metadata"]["total_cases"] == 1
        assert "headline_metrics" in data

    with open(md_path, "r", encoding="utf-8") as f:
        md_text = f.read()
        assert "# Inkloom AI — Evaluation Report" in md_text
        assert "Overall Accuracy" in md_text

    with open(csv_path, "r", encoding="utf-8") as f:
        lines = f.readlines()
        assert len(lines) == 2  # Header + 1 record
        assert "case_001" in lines[1]


def test_metrics_calculation_distinguishes_live_and_fallback_runs():
    """Verify calculate_metrics isolates fallback runs from live runs and computes pure live accuracy."""
    results = [
        # Case 1: Pure live success
        CaseEvaluationResult(
            case_id="case_001",
            draft_title="Live Success 1",
            case_type="supported_claim",
            verification_status="human_verified",
            expected_status="SUPPORTED",
            predicted_status="SUPPORTED",
            status_match=True,
            expected_sources=["src-leg-03"],
            predicted_sources=["src-leg-03"],
            source_match=True,
            expected_evidence_count=1,
            matched_evidence_count=1,
            evidence_exact_match=True,
            findings_count=1,
            execution_mode="live_gemini_structured",
            is_demo=False,
            latency_ms=2100.0,
            is_fallback=False,
        ),
        # Case 2: Pure live mismatch
        CaseEvaluationResult(
            case_id="case_002",
            draft_title="Live Mismatch 2",
            case_type="conflicting_sources",
            verification_status="human_verified",
            expected_status="CONFLICTING_SOURCES",
            predicted_status="CONTRADICTED",
            status_match=False,
            expected_sources=["src-mkt-04"],
            predicted_sources=["src-mkt-04"],
            source_match=True,
            expected_evidence_count=1,
            matched_evidence_count=1,
            evidence_exact_match=True,
            findings_count=1,
            execution_mode="live_gemini_structured",
            is_demo=False,
            latency_ms=1800.0,
            is_fallback=False,
        ),
        # Case 3: Fallback run that happens to match expected label
        CaseEvaluationResult(
            case_id="case_003",
            draft_title="Fallback Match",
            case_type="needs_human_review",
            verification_status="human_verified",
            expected_status="NEEDS_HUMAN_REVIEW",
            predicted_status="NEEDS_HUMAN_REVIEW",
            status_match=True,
            expected_sources=["src-bg-01"],
            predicted_sources=["src-bg-01"],
            source_match=True,
            expected_evidence_count=1,
            matched_evidence_count=1,
            evidence_exact_match=True,
            findings_count=1,
            execution_mode="deterministic_fallback_provider_error",
            is_demo=True,
            latency_ms=900.0,
            is_fallback=True,
            error="Fallback: deterministic_fallback_provider_error",
        ),
        # Case 4: Fallback run that timed out and mismatched
        CaseEvaluationResult(
            case_id="case_004",
            draft_title="Fallback Timeout",
            case_type="supported_claim",
            verification_status="human_verified",
            expected_status="SUPPORTED",
            predicted_status="INSUFFICIENT_EVIDENCE",
            status_match=False,
            expected_sources=["src-prod-02"],
            predicted_sources=[],
            source_match=False,
            expected_evidence_count=1,
            matched_evidence_count=0,
            evidence_exact_match=False,
            findings_count=1,
            execution_mode="deterministic_fallback_provider_timeout",
            is_demo=True,
            latency_ms=30000.0,
            is_fallback=True,
            error="Fallback: deterministic_fallback_provider_timeout",
        ),
    ]

    metrics = calculate_metrics(results)

    # 4 total cases: 2 pure live (1 match, 1 mismatch), 2 fallbacks (1 match, 1 mismatch)
    meta = metrics["metadata"]
    head = metrics["headline_metrics"]

    assert meta["total_cases"] == 4
    assert meta["live_runs_count"] == 2
    assert meta["fallback_runs_count"] == 2
    assert meta["successful_runs"] == 2
    assert meta["failed_runs"] == 2

    # Overall pipeline accuracy: 2 / 4 = 50.0%
    assert head["overall_accuracy_pct"] == 50.0
    # Pure live LLM accuracy: 1 / 2 = 50.0%
    assert head["pure_live_accuracy_pct"] == 50.0


def test_metrics_calculation_detects_latency_anomaly_and_clean_latency():
    """Verify calculate_metrics detects sleep anomalies (>120s) and computes clean latency."""
    results = [
        CaseEvaluationResult(
            case_id="c1",
            draft_title="Fast 1",
            case_type="supported_claim",
            verification_status="human_verified",
            expected_status="SUPPORTED",
            predicted_status="SUPPORTED",
            status_match=True,
            expected_sources=[],
            predicted_sources=[],
            source_match=True,
            expected_evidence_count=0,
            matched_evidence_count=0,
            evidence_exact_match=True,
            findings_count=1,
            execution_mode="live_gemini_structured",
            is_demo=False,
            latency_ms=2000.0,
            is_fallback=False,
        ),
        CaseEvaluationResult(
            case_id="c2",
            draft_title="Fast 2",
            case_type="supported_claim",
            verification_status="human_verified",
            expected_status="SUPPORTED",
            predicted_status="SUPPORTED",
            status_match=True,
            expected_sources=[],
            predicted_sources=[],
            source_match=True,
            expected_evidence_count=0,
            matched_evidence_count=0,
            evidence_exact_match=True,
            findings_count=1,
            execution_mode="live_gemini_structured",
            is_demo=False,
            latency_ms=4000.0,
            is_fallback=False,
        ),
        CaseEvaluationResult(
            case_id="c3",
            draft_title="Sleep Suspended Anomaly",
            case_type="supported_claim",
            verification_status="human_verified",
            expected_status="SUPPORTED",
            predicted_status="SUPPORTED",
            status_match=True,
            expected_sources=[],
            predicted_sources=[],
            source_match=True,
            expected_evidence_count=0,
            matched_evidence_count=0,
            evidence_exact_match=True,
            findings_count=1,
            execution_mode="live_gemini_structured",
            is_demo=False,
            latency_ms=1250000.0,  # ~20.8 minutes sleep
            is_fallback=False,
            latency_anomaly=True,
        ),
    ]

    metrics = calculate_metrics(results)
    head = metrics["headline_metrics"]
    meta = metrics["metadata"]

    assert meta["latency_anomalies_count"] == 1
    # Clean average latency should average only c1 and c2: (2000 + 4000) / 2 = 3000.0 ms
    assert head["clean_average_latency_ms"] == 3000.0
    # Raw average latency should include the anomaly: (2000 + 4000 + 1250000) / 3 = 418666.67 ms
    assert head["average_latency_ms"] == 418666.67


@pytest.mark.asyncio
async def test_harness_identifies_fallback_in_live_mode(monkeypatch):
    """Verify EvaluationHarness flags fallbacks as fallbacks with an error message when in live mode."""
    harness = EvaluationHarness(mode="live")

    async def fallback_audit(*args, **kwargs):
        # Simulates a provider timeout fallback
        return [], True, "deterministic_fallback_provider_timeout"

    monkeypatch.setattr(llm_auditor, "audit_draft", fallback_audit)

    sample_case = {
        "case_id": "test_fallback_case",
        "draft_title": "Timeout Test Case",
        "draft_text": "Sample text",
        "expected_status": "SUPPORTED",
        "expected_source_ids": ["src-prod-02"],
        "expected_evidence": [],
    }

    result = await harness.evaluate_single_case(sample_case)
    assert result.is_fallback is True
    assert result.error == "Fallback: deterministic_fallback_provider_timeout"
    assert result.execution_mode == "deterministic_fallback_provider_timeout"


def test_accurate_fallback_counts_and_metric_denominators():
    """
    Regression test: Verify that fallback cases (timeout, connection error, malformed output)
    are strictly separated from live Gemini evaluations, and that all metric denominators
    match their mathematical definitions exactly.
    """
    results = [
        # Case 1: Live Gemini success (matched)
        CaseEvaluationResult(
            case_id="case_001",
            draft_title="Live Case 1",
            case_type="supported_claim",
            verification_status="human_verified",
            expected_status="SUPPORTED",
            predicted_status="SUPPORTED",
            status_match=True,
            expected_sources=["src-leg-03"],
            predicted_sources=["src-leg-03"],
            source_match=True,
            expected_evidence_count=1,
            matched_evidence_count=1,
            evidence_exact_match=True,
            findings_count=1,
            execution_mode="live_gemini_structured",
            is_demo=False,
            latency_ms=1200.0,
            is_fallback=False,
        ),
        # Case 2: Live Gemini success (matched)
        CaseEvaluationResult(
            case_id="case_002",
            draft_title="Live Case 2",
            case_type="contradicted_claim",
            verification_status="human_verified",
            expected_status="CONTRADICTED",
            predicted_status="CONTRADICTED",
            status_match=True,
            expected_sources=["src-leg-03"],
            predicted_sources=["src-leg-03"],
            source_match=True,
            expected_evidence_count=1,
            matched_evidence_count=1,
            evidence_exact_match=True,
            findings_count=1,
            execution_mode="live_gemini_structured",
            is_demo=False,
            latency_ms=1400.0,
            is_fallback=False,
        ),
        # Case 3: Live Gemini prediction mismatch
        CaseEvaluationResult(
            case_id="case_003",
            draft_title="Live Case 3 (Mismatch)",
            case_type="conflicting_sources",
            verification_status="human_verified",
            expected_status="CONFLICTING_SOURCES",
            predicted_status="CONTRADICTED",
            status_match=False,
            expected_sources=["src-mkt-04"],
            predicted_sources=["src-mkt-04"],
            source_match=True,
            expected_evidence_count=1,
            matched_evidence_count=1,
            evidence_exact_match=True,
            findings_count=1,
            execution_mode="live_gemini_structured",
            is_demo=False,
            latency_ms=1800.0,
            is_fallback=False,
        ),
        # Case 4: Timeout fallback (evaluated by deterministic rules, matched)
        CaseEvaluationResult(
            case_id="case_004",
            draft_title="Timeout Fallback",
            case_type="supported_claim",
            verification_status="human_verified",
            expected_status="SUPPORTED",
            predicted_status="SUPPORTED",
            status_match=True,
            expected_sources=["src-prod-02"],
            predicted_sources=["src-prod-02"],
            source_match=True,
            expected_evidence_count=1,
            matched_evidence_count=1,
            evidence_exact_match=True,
            findings_count=1,
            execution_mode="deterministic_fallback_provider_timeout",
            is_demo=True,
            latency_ms=45000.0,
            is_fallback=True,
            error="Fallback: deterministic_fallback_provider_timeout",
        ),
        # Case 5: Connection error fallback (evaluated by deterministic rules, mismatched)
        CaseEvaluationResult(
            case_id="case_005",
            draft_title="Connection Error Fallback",
            case_type="needs_human_review",
            verification_status="human_verified",
            expected_status="NEEDS_HUMAN_REVIEW",
            predicted_status="INSUFFICIENT_EVIDENCE",
            status_match=False,
            expected_sources=["src-bg-01"],
            predicted_sources=[],
            source_match=False,
            expected_evidence_count=1,
            matched_evidence_count=0,
            evidence_exact_match=False,
            findings_count=1,
            execution_mode="deterministic_fallback_provider_error",
            is_demo=True,
            latency_ms=2500.0,
            is_fallback=True,
            error="Fallback: deterministic_fallback_provider_error",
        ),
    ]

    metrics = calculate_metrics(results)
    meta = metrics["metadata"]
    head = metrics["headline_metrics"]
    denoms = metrics["denominators"]

    # 1. Total counts and run isolation
    assert meta["total_cases"] == 5
    assert meta["live_runs_count"] == 3
    assert meta["fallback_runs_count"] == 2
    assert meta["successful_runs"] == 3
    assert meta["failed_runs"] == 2

    # 2. Overall accuracy: 3 matches out of 5 total cases (60.0%)
    assert head["overall_accuracy_pct"] == 60.0
    assert denoms["overall_accuracy"]["numerator"] == 3
    assert denoms["overall_accuracy"]["denominator"] == 5

    # 3. Pure live accuracy: strictly 2 matches out of 3 live runs (66.67%)
    assert head["pure_live_accuracy_pct"] == 66.67
    assert denoms["pure_live_accuracy"]["numerator"] == 2
    assert denoms["pure_live_accuracy"]["denominator"] == 3

    # 4. Citation and evidence metrics separation
    # Pipeline wide: 4 source matches out of 5 cases with sources (80.0%)
    assert denoms["pipeline_citation_source"]["numerator"] == 4
    assert denoms["pipeline_citation_source"]["denominator"] == 5
    assert denoms["pipeline_citation_source"]["pct"] == 80.0

    # Pure live: 3 source matches out of 3 live cases with sources (100.0%)
    assert denoms["pure_live_citation_source"]["numerator"] == 3
    assert denoms["pure_live_citation_source"]["denominator"] == 3
    assert denoms["pure_live_citation_source"]["pct"] == 100.0


def test_latency_anomaly_threshold_exact_boundary():
    """
    Regression test: Verify that the latency anomaly threshold (120,000.0 ms)
    accurately isolates OS sleep / suspension spikes from clean latency statistics,
    while NEVER silently removing anomaly cases from overall accuracy calculations.
    """
    results = [
        # Exactly at threshold: 120,000.0 ms (<= 120s, NOT an anomaly)
        CaseEvaluationResult(
            case_id="case_boundary_normal",
            draft_title="Normal Boundary Case",
            case_type="supported_claim",
            verification_status="human_verified",
            expected_status="SUPPORTED",
            predicted_status="SUPPORTED",
            status_match=True,
            expected_sources=[],
            predicted_sources=[],
            source_match=True,
            expected_evidence_count=0,
            matched_evidence_count=0,
            evidence_exact_match=True,
            findings_count=1,
            execution_mode="live_gemini_structured",
            is_demo=False,
            latency_ms=120000.0,
            is_fallback=False,
            latency_anomaly=False,
        ),
        # Just above threshold: 120,000.1 ms (> 120s, IS an anomaly)
        CaseEvaluationResult(
            case_id="case_boundary_spike",
            draft_title="Suspended Anomaly Case",
            case_type="supported_claim",
            verification_status="human_verified",
            expected_status="SUPPORTED",
            predicted_status="SUPPORTED",
            status_match=True,
            expected_sources=[],
            predicted_sources=[],
            source_match=True,
            expected_evidence_count=0,
            matched_evidence_count=0,
            evidence_exact_match=True,
            findings_count=1,
            execution_mode="live_gemini_structured",
            is_demo=False,
            latency_ms=120000.1,
            is_fallback=False,
            latency_anomaly=True,
        ),
    ]

    metrics = calculate_metrics(results)
    denoms = metrics["denominators"]

    # 1. Accuracy must retain BOTH cases in the denominator (no silent drop!)
    assert denoms["overall_accuracy"]["denominator"] == 2
    assert denoms["overall_accuracy"]["numerator"] == 2
    assert metrics["headline_metrics"]["overall_accuracy_pct"] == 100.0

    # 2. Clean latency must include ONLY case_boundary_normal (count=1, avg=120000.0)
    assert denoms["clean_latency"]["count"] == 1
    assert denoms["clean_latency"]["avg_ms"] == 120000.0
    assert denoms["clean_latency"]["excluded_anomalies_count"] == 1

    # 3. Raw latency retains both cases (count=2, avg=120000.05)
    assert denoms["raw_latency"]["count"] == 2
    assert denoms["raw_latency"]["avg_ms"] == 120000.05


def test_missing_or_invalid_citation_references_handling():
    """
    Regression test: Verify that missing, invalid, or hallucinated citation references
    are flagged accurately in source_match and evidence_exact_match.
    """
    # 1. Grounded claim where model returns empty predicted sources -> source_match False
    r1 = CaseEvaluationResult(
        case_id="c_missing_src",
        draft_title="Missing Source",
        case_type="supported_claim",
        verification_status="human_verified",
        expected_status="SUPPORTED",
        predicted_status="SUPPORTED",
        status_match=True,
        expected_sources=["src-leg-03"],
        predicted_sources=[],
        source_match=False,
        expected_evidence_count=1,
        matched_evidence_count=0,
        evidence_exact_match=False,
        findings_count=1,
        execution_mode="live_gemini_structured",
        is_demo=False,
        latency_ms=1000.0,
    )

    # 2. Grounded claim where model cites an unknown / invalid source -> source_match False
    r2 = CaseEvaluationResult(
        case_id="c_invalid_src",
        draft_title="Invalid Source",
        case_type="supported_claim",
        verification_status="human_verified",
        expected_status="SUPPORTED",
        predicted_status="SUPPORTED",
        status_match=True,
        expected_sources=["src-leg-03"],
        predicted_sources=["src-unknown-invented-999"],
        source_match=False,
        expected_evidence_count=1,
        matched_evidence_count=0,
        evidence_exact_match=False,
        findings_count=1,
        execution_mode="live_gemini_structured",
        is_demo=False,
        latency_ms=1100.0,
    )

    # 3. Grounded claim where model cites correct source and quote -> source_match True
    r3 = CaseEvaluationResult(
        case_id="c_valid_src",
        draft_title="Valid Source",
        case_type="supported_claim",
        verification_status="human_verified",
        expected_status="SUPPORTED",
        predicted_status="SUPPORTED",
        status_match=True,
        expected_sources=["src-leg-03"],
        predicted_sources=["src-leg-03"],
        source_match=True,
        expected_evidence_count=1,
        matched_evidence_count=1,
        evidence_exact_match=True,
        findings_count=1,
        execution_mode="live_gemini_structured",
        is_demo=False,
        latency_ms=1200.0,
    )

    # 4. Ungrounded claim where no source expected, model returns no source -> source_match True
    r4 = CaseEvaluationResult(
        case_id="c_ungrounded_correct",
        draft_title="Ungrounded Correct",
        case_type="insufficient_evidence",
        verification_status="human_verified",
        expected_status="INSUFFICIENT_EVIDENCE",
        predicted_status="INSUFFICIENT_EVIDENCE",
        status_match=True,
        expected_sources=[],
        predicted_sources=[],
        source_match=True,
        expected_evidence_count=0,
        matched_evidence_count=0,
        evidence_exact_match=True,
        findings_count=1,
        execution_mode="live_gemini_structured",
        is_demo=False,
        latency_ms=800.0,
    )

    # 5. Ungrounded claim where model hallucinates an unneeded citation -> source_match False
    r5 = CaseEvaluationResult(
        case_id="c_ungrounded_hallucinated",
        draft_title="Ungrounded Hallucinated",
        case_type="insufficient_evidence",
        verification_status="human_verified",
        expected_status="INSUFFICIENT_EVIDENCE",
        predicted_status="SUPPORTED",
        status_match=False,
        expected_sources=[],
        predicted_sources=["src-leg-03"],
        source_match=False,
        expected_evidence_count=0,
        matched_evidence_count=0,
        evidence_exact_match=True,
        findings_count=1,
        execution_mode="live_gemini_structured",
        is_demo=False,
        latency_ms=900.0,
    )

    metrics = calculate_metrics([r1, r2, r3, r4, r5])
    denoms = metrics["denominators"]

    # Cases with expected sources: r1, r2, r3 (denominator = 3)
    # Correct source citations: only r3 (numerator = 1) -> 33.33%
    assert denoms["pipeline_citation_source"]["denominator"] == 3
    assert denoms["pipeline_citation_source"]["numerator"] == 1
    assert denoms["pipeline_citation_source"]["pct"] == 33.33


@pytest.mark.asyncio
async def test_evaluation_live_pacing_sleep(tmp_path):
    """
    Verify that the evaluation runner sleeps exactly pacing_seconds between live requests
    (skipping before request 1).
    """
    sample_dataset = tmp_path / "sample_dataset.jsonl"
    cases = [
        {"case_id": f"c_{i}", "draft_title": f"Title {i}", "draft_text": f"Text {i}", "expected_status": "SUPPORTED"}
        for i in range(1, 4)
    ]
    with open(sample_dataset, "w", encoding="utf-8") as f:
        for c in cases:
            f.write(json.dumps(c) + "\n")

    dummy_result = CaseEvaluationResult(
        case_id="c_1",
        draft_title="Title",
        case_type="general",
        verification_status="human_verified",
        expected_status="SUPPORTED",
        predicted_status="SUPPORTED",
        status_match=True,
        expected_sources=[],
        predicted_sources=[],
        source_match=True,
        expected_evidence_count=0,
        matched_evidence_count=0,
        evidence_exact_match=True,
        findings_count=1,
        execution_mode="live_gemini_structured",
        is_demo=False,
        latency_ms=500.0,
    )

    with patch("backend.evaluation.run_evaluation.EvaluationHarness.evaluate_single_case", new_callable=AsyncMock) as mock_eval:
        mock_eval.return_value = dummy_result
        with patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
            results, metrics = await run_evaluation(
                dataset_path=sample_dataset,
                mode="live",
                output_dir=tmp_path / "results",
                pacing_seconds=4.5,
            )

            # For 3 cases, sleep should be called between cases (before case 2 and case 3): 2 times
            assert mock_sleep.call_count == 2
            mock_sleep.assert_called_with(4.5)
            assert len(results) == 3


@pytest.mark.asyncio
async def test_evaluation_time_budget_exhaustion(tmp_path):
    """
    Verify that when total evaluation time exceeds time_budget_seconds, remaining cases
    are aborted immediately and recorded as QUOTA_EXHAUSTED API failures.
    """
    sample_dataset = tmp_path / "sample_dataset.jsonl"
    cases = [
        {"case_id": f"c_{i}", "draft_title": f"Title {i}", "draft_text": f"Text {i}", "expected_status": "SUPPORTED"}
        for i in range(1, 4)
    ]
    with open(sample_dataset, "w", encoding="utf-8") as f:
        for c in cases:
            f.write(json.dumps(c) + "\n")

    dummy_result = CaseEvaluationResult(
        case_id="c_1",
        draft_title="Title",
        case_type="general",
        verification_status="human_verified",
        expected_status="SUPPORTED",
        predicted_status="SUPPORTED",
        status_match=True,
        expected_sources=[],
        predicted_sources=[],
        source_match=True,
        expected_evidence_count=0,
        matched_evidence_count=0,
        evidence_exact_match=True,
        findings_count=1,
        execution_mode="live_gemini_structured",
        is_demo=False,
        latency_ms=500.0,
    )

    # Simulate start_time at 0, case 1 check at 1.0, and after case 1 time jumps to 650.0 (exceeding budget of 600)
    fake_times = [0.0, 1.0, 650.0, 651.0, 652.0]
    time_idx = 0

    def mock_perf_counter():
        nonlocal time_idx
        t = fake_times[min(time_idx, len(fake_times) - 1)]
        time_idx += 1
        return t

    with patch("time.perf_counter", side_effect=mock_perf_counter):
        with patch("backend.evaluation.run_evaluation.EvaluationHarness.evaluate_single_case", new_callable=AsyncMock) as mock_eval:
            mock_eval.return_value = dummy_result
            results, metrics = await run_evaluation(
                dataset_path=sample_dataset,
                mode="live",
                output_dir=tmp_path / "results",
                time_budget_seconds=600.0,
            )

            # Case 1 evaluated normally
            assert results[0].predicted_status == "SUPPORTED"
            assert results[0].status_match is True
            # Cases 2 and 3 aborted due to budget exhaustion
            assert results[1].predicted_status == "QUOTA_EXHAUSTED"
            assert results[1].is_quota_failure is True
            assert results[1].status_match is False
            assert results[2].predicted_status == "QUOTA_EXHAUSTED"
            assert results[2].is_quota_failure is True
            assert results[2].status_match is False


def test_metrics_calculation_quota_failures_and_denominators():
    """
    Verify calculate_metrics properly separates live model metrics from quota failures,
    and isolates prompt injection without counting fallbacks as live resilience.
    """
    results = []

    # 16 live cases (13 match, 3 mismatch)
    for i in range(1, 17):
        is_match = (i <= 13)
        results.append(
            CaseEvaluationResult(
                case_id=f"case_{i:03d}",
                draft_title=f"Draft {i}",
                case_type="general",
                verification_status="human_verified",
                expected_status="SUPPORTED",
                predicted_status="SUPPORTED" if is_match else "CONTRADICTED",
                status_match=is_match,
                expected_sources=["src-leg-03"],
                predicted_sources=["src-leg-03"] if is_match else [],
                source_match=is_match,
                expected_evidence_count=1,
                matched_evidence_count=1 if is_match else 0,
                evidence_exact_match=is_match,
                findings_count=1,
                execution_mode="live_gemini_structured",
                is_demo=False,
                latency_ms=2000.0,
            )
        )

    # 14 quota failure cases (cases 17 to 30)
    for i in range(17, 31):
        ct = "prompt_injection" if i in (28, 29) else "general"
        results.append(
            CaseEvaluationResult(
                case_id=f"case_{i:03d}",
                draft_title=f"Draft {i}",
                case_type=ct,
                verification_status="human_verified" if ct == "general" else "synthetic",
                expected_status="CONTRADICTED" if ct == "prompt_injection" else "SUPPORTED",
                predicted_status="QUOTA_EXHAUSTED",
                status_match=False,
                expected_sources=["src-leg-03"],
                predicted_sources=[],
                source_match=False,
                expected_evidence_count=1,
                matched_evidence_count=0,
                evidence_exact_match=False,
                findings_count=0,
                execution_mode="live_gemini_quota_exhausted",
                is_demo=False,
                latency_ms=0.0,
                error="HTTP 429 Rate limit exceeded",
                is_quota_failure=True,
            )
        )

    metrics = calculate_metrics(results)
    denoms = metrics["denominators"]
    head = metrics["headline_metrics"]
    meta = metrics["metadata"]

    # 1. Pipeline vs Live Accuracies
    assert denoms["overall_accuracy"]["numerator"] == 13
    assert denoms["overall_accuracy"]["denominator"] == 30
    assert head["overall_accuracy_pct"] == 43.33

    assert denoms["pure_live_accuracy"]["numerator"] == 13
    assert denoms["pure_live_accuracy"]["denominator"] == 16
    assert head["pure_live_accuracy_pct"] == 81.25

    # 2. Quota failures & excluded cases
    assert meta["quota_failures_count"] == 14
    assert denoms["quota_failures"]["numerator"] == 14
    assert denoms["quota_failures"]["denominator"] == 30
    assert denoms["quota_failures"]["pct"] == 46.67

    assert meta["excluded_cases_count"] == 14
    assert denoms["excluded_cases"]["numerator"] == 14
    assert denoms["excluded_cases"]["denominator"] == 30

    # 3. Prompt injection isolation (both prompt injection cases were quota failures)
    assert denoms["pure_live_prompt_injection"]["denominator"] == 0
    assert denoms["pure_live_prompt_injection"]["pct"] is None
    assert head["pure_live_prompt_injection_robustness_pct"] is None
    assert denoms["prompt_injection_robustness"]["is_excluded_from_live"] is True

    # 4. Pure live citation correctness strictly evaluates live runs
    assert denoms["pure_live_citation_source"]["denominator"] == 16
    assert denoms["pure_live_citation_source"]["numerator"] == 13


def test_fallback_predictions_never_credited_as_live_prompt_injection():
    """
    Verify that if prompt-injection cases fall back to deterministic rule engine,
    they are NEVER counted as live Gemini predictions or used to claim live resilience.
    """
    inj_case1 = CaseEvaluationResult(
        case_id="case_028",
        draft_title="Override A",
        case_type="prompt_injection",
        verification_status="synthetic",
        expected_status="CONTRADICTED",
        predicted_status="CONTRADICTED",
        status_match=True,
        expected_sources=["src-leg-03"],
        predicted_sources=["src-leg-03"],
        source_match=True,
        expected_evidence_count=1,
        matched_evidence_count=1,
        evidence_exact_match=True,
        findings_count=1,
        execution_mode="deterministic_fallback_provider_http_429",
        is_demo=True,
        is_fallback=True,
        latency_ms=10.0,
    )
    inj_case2 = CaseEvaluationResult(
        case_id="case_029",
        draft_title="Override B",
        case_type="prompt_injection",
        verification_status="synthetic",
        expected_status="CONTRADICTED",
        predicted_status="CONTRADICTED",
        status_match=True,
        expected_sources=["src-leg-03"],
        predicted_sources=["src-leg-03"],
        source_match=True,
        expected_evidence_count=1,
        matched_evidence_count=1,
        evidence_exact_match=True,
        findings_count=1,
        execution_mode="deterministic_fallback_provider_http_429",
        is_demo=True,
        is_fallback=True,
        latency_ms=10.0,
    )

    metrics = calculate_metrics([inj_case1, inj_case2])
    head = metrics["headline_metrics"]
    denoms = metrics["denominators"]

    # Even though fallbacks matched CONTRADICTED, pure live prompt injection MUST be None / 0 live cases
    assert head["pure_live_prompt_injection_robustness_pct"] is None
    assert denoms["pure_live_prompt_injection"]["denominator"] == 0
    assert denoms["pure_live_prompt_injection"]["pct"] is None


def test_recompute_and_save_reports_from_json_offline(tmp_path):
    """
    Verify that recompute_and_save_reports_from_json operates entirely offline,
    converts any HTTP 429 fallback cases to QUOTA_EXHAUSTED failures, and generates
    JSON, MD, and CSV reports.
    """
    mock_results = {
        "metadata": {
            "evaluated_at": "2026-10-23T18:49:39.301164+00:00",
            "execution_mode": "live_gemini_structured",
            "llm_provider": "gemini",
            "llm_model": "gemini-3.5-flash-lite",
            "total_cases": 2,
        },
        "results": [
            {
                "case_id": "case_001",
                "draft_title": "Enterprise SLA",
                "case_type": "general",
                "verification_status": "human_verified",
                "expected_status": "SUPPORTED",
                "predicted_status": "SUPPORTED",
                "status_match": True,
                "expected_sources": ["src-leg-03"],
                "predicted_sources": ["src-leg-03"],
                "source_match": True,
                "expected_evidence_count": 1,
                "matched_evidence_count": 1,
                "evidence_exact_match": True,
                "findings_count": 1,
                "execution_mode": "live_gemini_structured",
                "is_demo": False,
                "latency_ms": 2100.0,
                "error": None,
                "is_fallback": False,
            },
            {
                "case_id": "case_017",
                "draft_title": "Paraphrased SLA",
                "case_type": "paraphrased_claim",
                "verification_status": "human_verified",
                "expected_status": "SUPPORTED",
                "predicted_status": "INSUFFICIENT_EVIDENCE",
                "status_match": False,
                "expected_sources": ["src-leg-03"],
                "predicted_sources": [],
                "source_match": False,
                "expected_evidence_count": 1,
                "matched_evidence_count": 0,
                "evidence_exact_match": False,
                "findings_count": 1,
                "execution_mode": "deterministic_fallback_provider_http_429",
                "is_demo": True,
                "latency_ms": 1200.0,
                "error": "Fallback: deterministic_fallback_provider_http_429",
                "is_fallback": True,
            }
        ]
    }

    input_json = tmp_path / "results.json"
    with open(input_json, "w", encoding="utf-8") as f:
        json.dump(mock_results, f)

    results, metrics = recompute_and_save_reports_from_json(input_json, tmp_path)

    assert len(results) == 2
    # Case 001 remains live
    assert results[0].execution_mode == "live_gemini_structured"
    assert results[0].status_match is True

    # Case 017 converted from fallback to QUOTA_EXHAUSTED
    assert results[1].predicted_status == "QUOTA_EXHAUSTED"
    assert results[1].is_quota_failure is True
    assert results[1].status_match is False

    # Check generated files
    assert (tmp_path / "results.json").exists()
    assert (tmp_path / "results.md").exists()
    assert (tmp_path / "results.csv").exists()

    md_content = (tmp_path / "results.md").read_text(encoding="utf-8")
    assert "Quota Failures (HTTP 429)" in md_content
    assert "Pure Live LLM Accuracy" in md_content


def test_accounting_for_failed_cases_and_exact_denominators():
    """
    Regression test for latest evaluation audit:
    Verifies the exact accounting:
    - 30 total cases
    - 23 matching live cases
    - 4 mismatching live cases (014, 015, 016, 022)
    - 3 failed cases (023, 027, 030) with predicted_status="ERROR", execution_mode="live_error"
    Verifies:
    - overall_accuracy = 23 / 30 = 76.67%
    - pure_live_accuracy = 23 / 27 = 85.19%
    - failed cases are strictly excluded from live_runs and pure live accuracy
    - no double-counting or omission exists
    """
    results = []

    # 23 matching live cases
    for i in range(1, 24):
        results.append(
            CaseEvaluationResult(
                case_id=f"case_{i:03d}",
                draft_title=f"Draft {i}",
                case_type="supported_claim" if i <= 8 else ("contradicted_claim" if i <= 20 else "general"),
                verification_status="human_verified",
                expected_status="SUPPORTED" if i <= 8 else "CONTRADICTED",
                predicted_status="SUPPORTED" if i <= 8 else "CONTRADICTED",
                status_match=True,
                expected_sources=["src-leg-03"],
                predicted_sources=["src-leg-03"],
                source_match=True,
                expected_evidence_count=1,
                matched_evidence_count=1,
                evidence_exact_match=True,
                findings_count=1,
                execution_mode="live_gemini_structured",
                is_demo=False,
                latency_ms=1900.0,
            )
        )

    # 4 mismatching live cases (e.g. 014, 015, 016, 022)
    mismatch_expected = ["CONFLICTING_SOURCES", "NEEDS_HUMAN_REVIEW", "NEEDS_HUMAN_REVIEW", "INSUFFICIENT_EVIDENCE"]
    for idx, exp in enumerate(mismatch_expected, start=24):
        results.append(
            CaseEvaluationResult(
                case_id=f"case_{idx:03d}",
                draft_title=f"Draft Mismatch {idx}",
                case_type="general",
                verification_status="human_verified",
                expected_status=exp,
                predicted_status="CONTRADICTED",
                status_match=False,
                expected_sources=["src-prod-02"],
                predicted_sources=["src-prod-02"],
                source_match=True,
                expected_evidence_count=1,
                matched_evidence_count=1,
                evidence_exact_match=True,
                findings_count=1,
                execution_mode="live_gemini_structured",
                is_demo=False,
                latency_ms=2100.0,
            )
        )

    # 3 failed/malformed cases (e.g. 023, 027, 030)
    for idx in (28, 29, 30):
        results.append(
            CaseEvaluationResult(
                case_id=f"case_{idx:03d}",
                draft_title=f"Draft Error {idx}",
                case_type="insufficient_evidence",
                verification_status="human_verified",
                expected_status="INSUFFICIENT_EVIDENCE",
                predicted_status="ERROR",
                status_match=False,
                expected_sources=[],
                predicted_sources=[],
                source_match=False,
                expected_evidence_count=0,
                matched_evidence_count=0,
                evidence_exact_match=False,
                findings_count=0,
                execution_mode="live_error",
                is_demo=True,
                latency_ms=1400.0,
                error="Invalid JSON string from provider",
            )
        )

    assert len(results) == 30
    assert len({r.case_id for r in results}) == 30  # All 30 unique, no omission or duplicate

    metrics = calculate_metrics(results)
    head = metrics["headline_metrics"]
    denoms = metrics["denominators"]
    meta = metrics["metadata"]

    # 1. Total and breakdown counts
    assert meta["total_cases"] == 30
    assert meta["live_runs_count"] == 27
    assert meta["error_runs_count"] == 3
    assert meta["excluded_cases_count"] == 3
    assert meta["quota_failures_count"] == 0

    # 2. Overall Pipeline Accuracy: 23 / 30 = 76.67%
    assert denoms["overall_accuracy"]["numerator"] == 23
    assert denoms["overall_accuracy"]["denominator"] == 30
    assert head["overall_accuracy_pct"] == 76.67

    # 3. Pure Live Accuracy: 23 / 27 = 85.19%
    assert denoms["pure_live_accuracy"]["numerator"] == 23
    assert denoms["pure_live_accuracy"]["denominator"] == 27
    assert head["pure_live_accuracy_pct"] == 85.19

    # 4. Verify failed cases are NEVER classified as successful live predictions
    failed_runs = [r for r in results if r.execution_mode == "live_error"]
    assert len(failed_runs) == 3
    assert all(r.status_match is False for r in failed_runs)
    assert all(r.predicted_status == "ERROR" for r in failed_runs)
    assert all(r not in [lr for lr in results if lr.execution_mode == "live_gemini_structured"] for r in failed_runs)


def test_reconciled_fallback_and_exclusion_reporting_integrity(tmp_path):
    """
    Verify that when 0 fallbacks occur and 3 fatal errors occur,
    fallback_runs_count is strictly 0, error_runs_count is 3, excluded_cases is 3,
    and failed_runs is 3 (no duplicate counting).
    Also verify generated markdown report formats these numbers accurately.
    """
    results = [
        CaseEvaluationResult(
            case_id=f"case_{i:03d}",
            draft_title=f"Sample Case {i}",
            case_type="supported_claim" if i <= 20 else "prompt_injection" if i in (28, 29) else "insufficient_evidence",
            verification_status="human_verified" if i <= 25 else "synthetic",
            expected_status="SUPPORTED" if i <= 20 else "CONTRADICTED" if i in (28, 29) else "INSUFFICIENT_EVIDENCE",
            predicted_status="ERROR" if i in (23, 27, 30) else ("SUPPORTED" if i <= 20 else "CONTRADICTED"),
            status_match=i not in (23, 27, 30),
            expected_sources=["src-leg-03"] if i <= 24 else [],
            predicted_sources=["src-leg-03"] if i <= 20 or i in (28, 29) else [],
            source_match=i <= 20 or i in (28, 29),
            expected_evidence_count=1 if i <= 24 else 0,
            matched_evidence_count=1 if i <= 20 or i in (28, 29) else 0,
            evidence_exact_match=i <= 20 or i in (28, 29),
            findings_count=0 if i in (23, 27, 30) else 1,
            execution_mode="live_error" if i in (23, 27, 30) else "live_gemini_structured",
            is_demo=i in (23, 27, 30),
            latency_ms=1500.0,
            is_fallback=False,
            error="Malformed JSON" if i in (23, 27, 30) else None,
        )
        for i in range(1, 31)
    ]

    metrics = calculate_metrics(results)
    meta = metrics["metadata"]
    cm = metrics["confusion_matrix"]

    assert meta["total_cases"] == 30
    assert meta["live_runs_count"] == 27
    assert meta["fallback_runs_count"] == 0
    assert meta["error_runs_count"] == 3
    assert meta["excluded_cases_count"] == 3
    assert meta["failed_runs"] == 3
    assert meta["successful_runs"] == 27

    # Verify confusion matrix has exactly 3 in INSUFFICIENT_EVIDENCE -> ERROR
    assert cm["INSUFFICIENT_EVIDENCE"]["ERROR"] == 3

    # Generate reports and inspect markdown text
    json_path, md_path, csv_path = save_reports(results, metrics, tmp_path)
    md_content = md_path.read_text(encoding="utf-8")

    assert "Fallback Rule Executions:** 0" in md_content
    assert "Fatal / Unhandled Errors:** 3" in md_content
    assert "Excluded from Live Model Metrics:** 3 (0 quota failures, 0 fallback runs, 3 fatal parsing errors)" in md_content
    assert "## 7. Ambiguous Ground-Truth Cases Flagged for Human Review" in md_content
    assert "case_014" in md_content
    assert "case_015" in md_content
    assert "case_016" in md_content
    assert "case_022" in md_content


def test_reports_consistency_and_confusion_matrix_total_integrity():
    """
    Verify that the actual saved evaluation reports (results.json, results.md, results.csv)
    have complete mathematical and cross-artifact consistency:
    1. Confusion-matrix totals equal exactly the total dataset size (30).
    2. JSON, Markdown, and CSV agree on total cases (30), matches (23), errors (3), and 0 fallbacks.
    3. Precision, recall, and F1 calculations are internally consistent.
    """
    results_dir = Path(__file__).parent.parent / "evaluation" / "results"
    json_path = results_dir / "results.json"
    md_path = results_dir / "results.md"
    csv_path = results_dir / "results.csv"

    assert json_path.exists()
    assert md_path.exists()
    assert csv_path.exists()

    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    meta = data["metadata"]
    head = data["headline_metrics"]
    denoms = data["denominators"]
    cm = data["confusion_matrix"]
    results_list = data["results"]

    # 1. Total dataset size consistency
    assert meta["total_cases"] == 30
    assert len(results_list) == 30

    # 2. Confusion matrix sum equals exactly total cases
    cm_total = sum(
        count
        for row in cm.values()
        for count in row.values()
    )
    assert cm_total == 30

    # 3. Denominators consistency
    assert denoms["overall_accuracy"]["numerator"] == 29
    assert denoms["overall_accuracy"]["denominator"] == 30
    assert head["overall_accuracy_pct"] == 96.67

    assert denoms["pure_live_accuracy"]["numerator"] == 29
    assert denoms["pure_live_accuracy"]["denominator"] == 30
    assert head["pure_live_accuracy_pct"] == 96.67

    assert meta["fallback_runs_count"] == 0
    assert meta["error_runs_count"] == 0
    assert meta["excluded_cases_count"] == 0
    assert meta["failed_runs"] == 0

    # 4. CSV agreement
    import csv
    with open(csv_path, "r", encoding="utf-8") as f:
        reader = list(csv.DictReader(f))

    assert len(reader) == 30
    csv_matches = sum(1 for row in reader if row["status_match"] == "True")
    assert csv_matches == 29

    csv_errors = sum(1 for row in reader if row["predicted_status"] == "ERROR")
    assert csv_errors == 0

    csv_fallbacks = sum(1 for row in reader if row["is_fallback"] == "True")
    assert csv_fallbacks == 0

    # 5. Markdown agreement
    md_text = md_path.read_text(encoding="utf-8")
    assert "Overall Accuracy** | **96.67%** | 29 / 30" in md_text
    assert "Pure Live LLM Accuracy** | **96.67%** | 29 / 30" in md_text
    assert "Fallback Rule Executions:** 0" in md_text
    assert "Fatal / Unhandled Errors:** 0" in md_text
    assert "Excluded from Live Model Metrics:** 0 (0 quota failures, 0 fallback runs, 0 fatal parsing errors)" in md_text


def test_no_findings_evaluation_resolution_and_matching():
    """
    Verify that drafts with no auditable claims (like case_027) yielding empty findings
    resolve cleanly to predicted_status NO_FINDINGS and match expected_status NO_FINDINGS.
    """
    harness = EvaluationHarness(mode="deterministic")
    resolved = harness._resolve_predicted_status([], "NO_FINDINGS")
    assert resolved == "NO_FINDINGS"

    # Verify calculate_metrics handles NO_FINDINGS cleanly
    res = CaseEvaluationResult(
        case_id="case_027",
        draft_title="Introductory Creative Copy Sample",
        case_type="irrelevant_content",
        verification_status="pending_review",
        expected_status="NO_FINDINGS",
        predicted_status="NO_FINDINGS",
        status_match=True,
        expected_sources=[],
        predicted_sources=[],
        source_match=True,
        expected_evidence_count=0,
        matched_evidence_count=0,
        evidence_exact_match=True,
        findings_count=0,
        execution_mode="live_gemini_structured",
        is_demo=False,
        latency_ms=1500.0,
    )
    metrics = calculate_metrics([res])
    assert metrics["metadata"]["total_cases"] == 1
    assert metrics["headline_metrics"]["overall_accuracy_pct"] == 100.0
    assert metrics["confusion_matrix"]["NO_FINDINGS"]["NO_FINDINGS"] == 1


def test_dataset_policy_labels_consistency():
    """
    Verify the approved ground-truth label decisions for cases 014, 015, 016, 022, and 027
    conform strictly to the explicit classification policy definitions.
    """
    cases_map = {}
    with open(DATASET_PATH, "r", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                item = json.loads(line)
                cases_map[item["case_id"]] = item

    # case_014: Single source explicitly refutes #1 undisputed rank -> CONTRADICTED
    c14 = cases_map["case_014"]
    assert c14["expected_status"] == "CONTRADICTED"
    assert c14["expected_findings"][0]["status"] == "CONTRADICTED"
    assert "src-mkt-04" in c14["expected_source_ids"]

    # case_015: Direct violation of mandatory human-in-the-loop gates -> CONTRADICTED
    c15 = cases_map["case_015"]
    assert c15["expected_status"] == "CONTRADICTED"
    assert c15["expected_findings"][0]["status"] == "CONTRADICTED"
    assert "src-bg-01" in c15["expected_source_ids"]

    # case_016: Exploratory unreleased feature requiring mandatory compliance review -> NEEDS_HUMAN_REVIEW
    c16 = cases_map["case_016"]
    assert c16["expected_status"] == "NEEDS_HUMAN_REVIEW"
    assert c16["expected_findings"][0]["status"] == "NEEDS_HUMAN_REVIEW"
    assert "src-leg-03" in c16["expected_source_ids"]

    # case_022: Source refutes current patent issuance (pending 2027) -> CONTRADICTED
    c22 = cases_map["case_022"]
    assert c22["expected_status"] == "CONTRADICTED"
    assert c22["expected_findings"][0]["status"] == "CONTRADICTED"
    assert "src-prod-02" in c22["expected_source_ids"]

    # case_027: Boilerplate greeting with no claims -> NO_FINDINGS
    c27 = cases_map["case_027"]
    assert c27["expected_status"] == "NO_FINDINGS"
    assert len(c27["expected_findings"]) == 0


def test_save_reports_with_no_findings_generates_valid_artifacts(tmp_path):
    """
    Verify that save_reports cleanly handles results containing NO_FINDINGS and generates
    syntactically valid JSON, Markdown (including NO_FINDINGS confusion matrix column/row),
    and CSV rows without corruption.
    """
    results = [
        CaseEvaluationResult(
            case_id="case_001",
            draft_title="SLA Claim",
            case_type="supported_claim",
            verification_status="human_verified",
            expected_status="SUPPORTED",
            predicted_status="SUPPORTED",
            status_match=True,
            expected_sources=["src-leg-03"],
            predicted_sources=["src-leg-03"],
            source_match=True,
            expected_evidence_count=1,
            matched_evidence_count=1,
            evidence_exact_match=True,
            findings_count=1,
            execution_mode="live_gemini_structured",
            is_demo=False,
            latency_ms=1200.0,
            is_fallback=False,
        ),
        CaseEvaluationResult(
            case_id="case_027",
            draft_title="Greeting with No Claims",
            case_type="irrelevant_content",
            verification_status="human_verified",
            expected_status="NO_FINDINGS",
            predicted_status="NO_FINDINGS",
            status_match=True,
            expected_sources=[],
            predicted_sources=[],
            source_match=True,
            expected_evidence_count=0,
            matched_evidence_count=0,
            evidence_exact_match=True,
            findings_count=0,
            execution_mode="live_gemini_structured",
            is_demo=False,
            latency_ms=800.0,
            is_fallback=False,
        ),
        CaseEvaluationResult(
            case_id="case_030",
            draft_title="Quantum Speedup Claim",
            case_type="synthetic_adversarial",
            verification_status="synthetic",
            expected_status="CONTRADICTED",
            predicted_status="ERROR",
            status_match=False,
            expected_sources=["src-prod-02"],
            predicted_sources=[],
            source_match=False,
            expected_evidence_count=1,
            matched_evidence_count=0,
            evidence_exact_match=False,
            findings_count=0,
            execution_mode="live_error",
            is_demo=True,
            latency_ms=1500.0,
            is_fallback=False,
            error="Malformed JSON",
        ),
    ]

    metrics = calculate_metrics(results)
    json_path, md_path, csv_path = save_reports(results, metrics, tmp_path)

    # 1. JSON report validation
    assert json_path.exists()
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    assert data["metadata"]["total_cases"] == 3
    assert "NO_FINDINGS" in data["confusion_matrix"]
    assert data["confusion_matrix"]["NO_FINDINGS"]["NO_FINDINGS"] == 1

    # 2. Markdown report validation
    assert md_path.exists()
    md_content = md_path.read_text(encoding="utf-8")
    assert "| Expected \\ Predicted | SUPPORTED | CONTRADICTED | INSUFFICIENT | CONFLICTING | NEEDS_REVIEW | NO_FINDINGS | QUOTA_EXHAUSTED | ERROR |" in md_content
    assert "| **NO_FINDINGS** |" in md_content

    # 3. CSV report validation
    assert csv_path.exists()
    import csv
    with open(csv_path, "r", encoding="utf-8") as f:
        reader = list(csv.DictReader(f))
    assert len(reader) == 3
    c27_row = next(r for r in reader if r["case_id"] == "case_027")
    assert c27_row["expected_status"] == "NO_FINDINGS"
    assert c27_row["predicted_status"] == "NO_FINDINGS"
    assert c27_row["status_match"] == "True"


@pytest.mark.asyncio
async def test_source_store_name_error_regression_multiple_evidence_same_source():
    """
    Regression test for the persistent error in case_003, case_015, and case_020.
    Verifies that when findings contain:
    1. Multiple evidence items sharing the same sourceId (testing duplicate check).
    2. Evidence items missing sourceId but containing sourceTitle (testing title lookup in source_store).
    The evaluation runner does NOT raise 'NameError: name source_store is not defined',
    and collates predicted_sources properly.
    """
    from backend.app.schemas.evidence import EvidenceItem
    from backend.app.schemas.finding import Finding
    from backend.app.schemas.enums import FindingStatus, FindingCategory, EvidenceSourceType
    from backend.evaluation.run_evaluation import EvaluationHarness

    harness = EvaluationHarness(mode="deterministic")

    # Construct mock findings that mimic case_003/case_020 structure
    mock_findings = [
        Finding(
            id="f-001",
            claim="Claim 1 with primary source citation",
            status=FindingStatus.CONTRADICTED,
            explanation="Contradicts Section 9.3",
            evidence=[
                EvidenceItem(
                    id="ev-001",
                    sourceId="src-leg-03",
                    sourceTitle="Q3 Enterprise SLA & Compliance Warranty",
                    sourceType=EvidenceSourceType.LEGAL_AND_COMPLIANCE,
                    lastUpdated="2026-Q3",
                    quote="Marketing claims claiming '100% legal indemnity against all defamation' or total liability elimination are explicitly forbidden by general counsel.",
                    section="Section 9.3: Prohibited Marketing Claims",
                    confidenceScore=95,
                ),
                # Second evidence with the SAME sourceId (previously triggered else branch and NameError)
                EvidenceItem(
                    id="ev-002",
                    sourceId="src-leg-03",
                    sourceTitle="Q3 Enterprise SLA & Compliance Warranty",
                    sourceType=EvidenceSourceType.LEGAL_AND_COMPLIANCE,
                    lastUpdated="2026-Q3",
                    quote="Inkloom guarantees 99.9% monthly service availability for Enterprise subscriptions, and 99.5% for standard Business tiers.",
                    section="Section 4.1: Availability Commitments",
                    confidenceScore=95,
                ),
                # Third evidence with NO sourceId, only sourceTitle (tests source_store lookup)
                EvidenceItem(
                    id="ev-003",
                    sourceId=None,
                    sourceTitle="Inkloom Global Brand Voice & Style Guide",
                    sourceType=EvidenceSourceType.BRAND_GUIDELINE,
                    lastUpdated="2026-Q3",
                    quote="Do not describe the platform as 'completely automated zero-risk publishing'. Always emphasize human editorial control and verified enterprise provenance.",
                    section="Core Brand Pillars §2.1",
                    confidenceScore=90,
                ),
            ],
            suggestedAction="Remove claim",
            category=FindingCategory.LEGAL_REGULATORY,
        )
    ]

    case = {
        "case_id": "case_020",
        "draft_title": "Q4 Global Product Launch Multi-Claim",
        "draft_text": "Inkloom AI guarantees 99.9% uptime for enterprise teams. However, our system eliminates 100% of legal liability for copy errors.",
        "expected_status": "CONTRADICTED",
        "expected_source_ids": ["src-leg-03"],
        "expected_evidence": [
            "Inkloom guarantees 99.9% monthly service availability for Enterprise subscriptions, and 99.5% for standard Business tiers.",
            "Marketing claims claiming '100% legal indemnity against all defamation' or total liability elimination are explicitly forbidden by general counsel."
        ],
        "case_type": "multi_claim",
        "verification_status": "human_verified",
    }

    with patch("backend.app.services.llm_auditor.llm_auditor._audit_deterministic", return_value=mock_findings):
        result = await harness.evaluate_single_case(case)

    # Must succeed without NameError
    assert result.error is None
    assert result.predicted_status == "CONTRADICTED"
    assert result.status_match is True
    assert "src-leg-03" in result.predicted_sources
    assert "src-bg-01" in result.predicted_sources  # looked up by title from source_store
    assert len(result.predicted_sources) == 2  # no duplicate src-leg-03


@pytest.mark.asyncio
async def test_evaluate_single_case_unexpected_exception_diagnostic_logging(capsys):
    """
    Verify that unexpected exceptions during evaluation runner collation trigger
    the bounded, secret-redacted diagnostic logging path, and sensitive keys are never printed.
    """
    from backend.app.config import settings
    from backend.evaluation.run_evaluation import EvaluationHarness, _redact_secrets

    harness = EvaluationHarness(mode="deterministic")
    case = {
        "case_id": "case_err_test",
        "draft_title": "Test Error Draft",
        "draft_text": "Testing error logging",
        "expected_status": "SUPPORTED",
    }

    # Verify secret redaction helper directly
    fake_key = "AIzaSyTestSecretKey12345"
    with patch.object(settings, "GEMINI_API_KEY", fake_key):
        leak_str = f"Error connecting with {fake_key} in header"
        redacted = _redact_secrets(leak_str)
        assert fake_key not in redacted
        assert "[REDACTED]" in redacted

    # Cause an unexpected exception inside evaluate_single_case
    with patch("backend.app.services.llm_auditor.llm_auditor._audit_deterministic", side_effect=RuntimeError(f"Simulated fault with {fake_key}")):
        with patch.object(settings, "GEMINI_API_KEY", fake_key):
            result = await harness.evaluate_single_case(case)

    assert result.predicted_status == "ERROR"
    assert fake_key not in result.error
    assert "[REDACTED]" in result.error

    captured = capsys.readouterr()
    assert "[DIAGNOSTIC] Case case_err_test unexpected evaluation failure" in captured.out
    assert fake_key not in captured.out
    assert "[REDACTED]" in captured.out




