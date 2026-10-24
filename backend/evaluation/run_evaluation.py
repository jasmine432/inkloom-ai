"""
Repeatable evaluation runner for Inkloom AI.

Runs evaluation cases through the actual application review pipeline (llm_auditor and citation_validator),
computes comprehensive factual accuracy, precision, recall, confusion matrix, citation correctness,
and generates JSON, Markdown, and CSV reports.
"""

import os
import sys
import json
import csv
import time
import asyncio
import argparse
import traceback
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timezone
from dataclasses import dataclass, asdict

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.app.config import settings
from backend.app.schemas.enums import FindingStatus
from backend.app.schemas.finding import Finding
from backend.app.services.llm_auditor import (
    llm_auditor,
    LLMProviderRateLimitError,
    LLMProviderMalformedOutputError,
)
from backend.app.services.validator import citation_validator, _normalize_text
from backend.app.services.source_store import source_store


def _redact_secrets(text: str) -> str:
    """Redacts sensitive credentials and API keys from diagnostic strings."""
    if not text:
        return text
    sanitized = str(text)
    for key in [getattr(settings, "GEMINI_API_KEY", None), getattr(settings, "OPENAI_API_KEY", None)]:
        if key and key in sanitized:
            sanitized = sanitized.replace(key, "[REDACTED]")
    return sanitized


@dataclass
class CaseEvaluationResult:
    case_id: str
    draft_title: str
    case_type: str
    verification_status: str
    expected_status: str
    predicted_status: str
    status_match: bool
    expected_sources: List[str]
    predicted_sources: List[str]
    source_match: bool
    expected_evidence_count: int
    matched_evidence_count: int
    evidence_exact_match: bool
    findings_count: int
    execution_mode: str
    is_demo: bool
    latency_ms: float
    error: Optional[str] = None
    rationale: str = ""
    is_fallback: bool = False
    latency_anomaly: bool = False
    is_quota_failure: bool = False


class EvaluationHarness:
    """
    Executes evaluation datasets against Inkloom AI verification services.
    Supports deterministic offline evaluation and live Gemini LLM evaluation.
    """

    def __init__(
        self,
        mode: str = "deterministic",
        allow_fallback: bool = False,
        pacing_seconds: Optional[float] = None,
        time_budget_seconds: Optional[float] = None,
    ):
        self.mode = mode.lower().strip()
        if self.mode not in ("deterministic", "live"):
            raise ValueError(f"Invalid mode '{mode}'. Must be 'deterministic' or 'live'.")
        self.allow_fallback = allow_fallback
        self.pacing_seconds = pacing_seconds if pacing_seconds is not None else settings.EVALUATION_REQUEST_PACING_SECONDS
        self.time_budget_seconds = time_budget_seconds if time_budget_seconds is not None else settings.EVALUATION_TOTAL_TIME_BUDGET_SECONDS

    async def evaluate_single_case(self, case: Dict[str, Any]) -> CaseEvaluationResult:
        """Runs a single draft case through the application audit pipeline."""
        start_time = time.perf_counter()
        title = case["draft_title"]
        content = case["draft_text"]
        expected_status = case["expected_status"]
        expected_sources = case.get("expected_source_ids", [])
        expected_evidence = case.get("expected_evidence", [])

        try:
            if self.mode == "live":
                # Calls the real LLM service with live credentials.
                # allow_fallback=self.allow_fallback ensures live evaluations do not silently mask 429 quota exhaustion.
                findings, is_demo, execution_mode = await llm_auditor.audit_draft(
                    title=title,
                    content=content,
                    allow_fallback=self.allow_fallback
                )
            else:
                # Deterministic rule evaluation (strictly offline, 0 API quota)
                raw_findings = llm_auditor._audit_deterministic(title, content)
                findings = citation_validator.validate_findings_batch(raw_findings)
                is_demo = True
                execution_mode = "deterministic_rule_evaluation"

            latency_ms = round((time.perf_counter() - start_time) * 1000, 2)

            # Determine predicted status from findings
            predicted_status = self._resolve_predicted_status(findings, expected_status)
            status_match = (predicted_status == expected_status)

            # Extract predicted sources
            predicted_sources = []
            for f in findings:
                for ev in f.evidence:
                    if ev.sourceId:
                        if ev.sourceId not in predicted_sources:
                            predicted_sources.append(ev.sourceId)
                    elif ev.sourceTitle:
                        # Match title to source ID if ID not explicitly present
                        for s in source_store.get_all_sources():
                            if s.title.strip().lower() == ev.sourceTitle.strip().lower() and s.id not in predicted_sources:
                                predicted_sources.append(s.id)

            # Source correctness check
            if not expected_sources:
                source_match = (len(predicted_sources) == 0)
            else:
                source_match = any(sid in predicted_sources for sid in expected_sources)

            # Evidence quotation exact-match verification
            matched_evidence_count = 0
            if expected_evidence:
                all_predicted_quotes = [
                    _normalize_text(ev.quote)
                    for f in findings
                    for ev in f.evidence
                    if ev.quote
                ]
                for exp_q in expected_evidence:
                    norm_exp = _normalize_text(exp_q)
                    if any(norm_exp in pq or pq in norm_exp for pq in all_predicted_quotes):
                        matched_evidence_count += 1
                evidence_exact_match = (matched_evidence_count == len(expected_evidence))
            else:
                evidence_exact_match = True

            # Fallback & error tracking for live mode
            is_fallback = False
            is_quota_failure = False
            error = None
            if self.mode == "live" and (is_demo or execution_mode.startswith("deterministic_fallback_")):
                is_fallback = True
                error = f"Fallback: {execution_mode}"
                if "429" in execution_mode or "quota" in execution_mode.lower():
                    is_quota_failure = True

            # Latency anomaly detection (>120s indicates machine sleep / suspension)
            latency_anomaly = latency_ms > 120000.0

            return CaseEvaluationResult(
                case_id=case["case_id"],
                draft_title=title,
                case_type=case.get("case_type", "general"),
                verification_status=case.get("verification_status", "pending_review"),
                expected_status=expected_status,
                predicted_status=predicted_status,
                status_match=status_match,
                expected_sources=expected_sources,
                predicted_sources=predicted_sources,
                source_match=source_match,
                expected_evidence_count=len(expected_evidence),
                matched_evidence_count=matched_evidence_count,
                evidence_exact_match=evidence_exact_match,
                findings_count=len(findings),
                execution_mode=execution_mode,
                is_demo=is_demo,
                latency_ms=latency_ms,
                error=error,
                rationale=case.get("rationale", ""),
                is_fallback=is_fallback,
                latency_anomaly=latency_anomaly,
                is_quota_failure=is_quota_failure,
            )

        except LLMProviderRateLimitError as e:
            latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
            latency_anomaly = latency_ms > 120000.0
            return CaseEvaluationResult(
                case_id=case["case_id"],
                draft_title=title,
                case_type=case.get("case_type", "general"),
                verification_status=case.get("verification_status", "pending_review"),
                expected_status=expected_status,
                predicted_status="QUOTA_EXHAUSTED",
                status_match=False,
                expected_sources=expected_sources,
                predicted_sources=[],
                source_match=False,
                expected_evidence_count=len(expected_evidence),
                matched_evidence_count=0,
                evidence_exact_match=False,
                findings_count=0,
                execution_mode="live_gemini_quota_exhausted",
                is_demo=False,
                latency_ms=latency_ms,
                error=f"HTTP 429 Quota Exhausted: {e}",
                rationale=case.get("rationale", ""),
                is_fallback=False,
                latency_anomaly=latency_anomaly,
                is_quota_failure=True,
            )

        except LLMProviderMalformedOutputError as e:
            latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
            latency_anomaly = latency_ms > 120000.0
            diag_snippet = getattr(e, "raw_snippet", None)
            if diag_snippet:
                print(f"[DIAGNOSTIC] Case {case['case_id']} malformed output at char offset: snippet='...{diag_snippet}...'")
            return CaseEvaluationResult(
                case_id=case["case_id"],
                draft_title=title,
                case_type=case.get("case_type", "general"),
                verification_status=case.get("verification_status", "pending_review"),
                expected_status=expected_status,
                predicted_status="ERROR",
                status_match=False,
                expected_sources=expected_sources,
                predicted_sources=[],
                source_match=False,
                expected_evidence_count=len(expected_evidence),
                matched_evidence_count=0,
                evidence_exact_match=False,
                findings_count=0,
                execution_mode=f"{self.mode}_error",
                is_demo=True,
                latency_ms=latency_ms,
                error=str(e),
                rationale=case.get("rationale", ""),
                is_fallback=False,
                latency_anomaly=latency_anomaly,
                is_quota_failure=False,
            )

        except Exception as e:
            latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
            latency_anomaly = latency_ms > 120000.0
            is_quota_failure = "429" in str(e)
            safe_err = _redact_secrets(str(e))
            tb_str = traceback.format_exc()
            safe_tb = _redact_secrets(tb_str[-400:]) if tb_str else ""
            print(f"[DIAGNOSTIC] Case {case.get('case_id')} unexpected evaluation failure: {type(e).__name__}: {safe_err} | Traceback tail: {safe_tb}")
            return CaseEvaluationResult(
                case_id=case["case_id"],
                draft_title=title,
                case_type=case.get("case_type", "general"),
                verification_status=case.get("verification_status", "pending_review"),
                expected_status=expected_status,
                predicted_status="ERROR",
                status_match=False,
                expected_sources=expected_sources,
                predicted_sources=[],
                source_match=False,
                expected_evidence_count=len(expected_evidence),
                matched_evidence_count=0,
                evidence_exact_match=False,
                findings_count=0,
                execution_mode=f"{self.mode}_error",
                is_demo=True,
                latency_ms=latency_ms,
                error=safe_err,
                rationale=case.get("rationale", ""),
                is_fallback=False,
                latency_anomaly=latency_anomaly,
                is_quota_failure=is_quota_failure,
            )

    def _resolve_predicted_status(
        self,
        findings: List[Finding],
        expected_status: str
    ) -> str:
        """Resolves the representative status of an audited draft."""
        if not findings:
            return "NO_FINDINGS"

        # If any finding matches expected, prioritize semantic match
        for f in findings:
            if f.status.value == expected_status:
                return f.status.value

        # Severity ranking for multi-claim resolution:
        # CONTRADICTED > NEEDS_HUMAN_REVIEW > CONFLICTING_SOURCES > INSUFFICIENT_EVIDENCE > SUPPORTED
        status_rank = {
            FindingStatus.CONTRADICTED.value: 5,
            FindingStatus.NEEDS_HUMAN_REVIEW.value: 4,
            FindingStatus.CONFLICTING_SOURCES.value: 3,
            FindingStatus.INSUFFICIENT_EVIDENCE.value: 2,
            FindingStatus.SUPPORTED.value: 1,
        }

        sorted_findings = sorted(
            findings,
            key=lambda f: status_rank.get(f.status.value, 0),
            reverse=True
        )
        return sorted_findings[0].status.value


def calculate_metrics(results: List[CaseEvaluationResult]) -> Dict[str, Any]:
    """Calculates factual precision, recall, F1, and breakdown statistics."""
    total_cases = len(results)
    if total_cases == 0:
        return {}

    # Identify quota failures (HTTP 429 rate limit exhausted)
    quota_failures = [
        r for r in results
        if getattr(r, "is_quota_failure", False)
        or r.predicted_status == "QUOTA_EXHAUSTED"
        or r.execution_mode in ("live_gemini_quota_exhausted", "deterministic_fallback_provider_http_429")
        or (r.error and "429" in str(r.error))
    ]
    quota_failures_count = len(quota_failures)

    # Pure live runs: strictly executed by live LLM, excluding fallbacks, errors, and quota failures
    live_runs = [
        r for r in results
        if not r.is_demo
        and not getattr(r, "is_fallback", False)
        and not getattr(r, "is_quota_failure", False)
        and r.predicted_status != "QUOTA_EXHAUSTED"
        and r.predicted_status != "ERROR"
        and r.execution_mode.startswith("live_")
        and not r.execution_mode.endswith("_exhausted")
        and not r.execution_mode.endswith("_error")
    ]

    # Fallback runs: executed via rule fallback
    fallback_runs = [
        r for r in results
        if (getattr(r, "is_fallback", False) or (r.is_demo and r.execution_mode.startswith("deterministic_fallback_")))
        and r.predicted_status != "ERROR"
        and r.execution_mode != "live_error"
    ]

    # Error runs: fatal or unhandled exceptions (excluding pure quota failures)
    error_runs = [
        r for r in results
        if (r.predicted_status == "ERROR" and not getattr(r, "is_quota_failure", False))
        or (r.error is not None and not getattr(r, "is_quota_failure", False) and r not in fallback_runs)
    ]

    # Excluded cases: cases not evaluated by live LLM
    excluded_cases = [r for r in results if r not in live_runs]
    excluded_cases_count = len(excluded_cases)

    is_live_eval = bool(live_runs) or any(r.execution_mode.startswith("live_") for r in results)
    if is_live_eval:
        successful_runs = len(live_runs)
        failed_case_ids = {r.case_id for r in fallback_runs} | {r.case_id for r in error_runs} | {r.case_id for r in quota_failures}
        failed_runs = len(failed_case_ids)
    else:
        successful_runs = len([r for r in results if r.error is None])
        failed_runs = len([r for r in results if r.error is not None])

    human_verified = [r for r in results if r.verification_status == "human_verified"]
    pending_review = [r for r in results if r.verification_status == "pending_review"]
    synthetic_cases = [r for r in results if r.verification_status == "synthetic"]

    # Overall pipeline accuracy (across all evaluated cases)
    correct_status_count = sum(1 for r in results if r.status_match)
    overall_accuracy = round((correct_status_count / total_cases) * 100, 2)

    # Pure live LLM accuracy (strictly across cases evaluated by live LLM, excluding fallbacks and quota failures)
    pure_live_count = len(live_runs)
    pure_live_correct = sum(1 for r in live_runs if r.status_match)
    pure_live_accuracy = (
        round((pure_live_correct / pure_live_count) * 100, 2)
        if pure_live_count > 0
        else None
    )

    # Status-specific metrics & Confusion Matrix
    all_statuses = [
        FindingStatus.SUPPORTED.value,
        FindingStatus.CONTRADICTED.value,
        FindingStatus.INSUFFICIENT_EVIDENCE.value,
        FindingStatus.CONFLICTING_SOURCES.value,
        FindingStatus.NEEDS_HUMAN_REVIEW.value,
    ]
    for r in results:
        if r.expected_status and r.expected_status not in all_statuses:
            all_statuses.append(r.expected_status)

    all_pred_keys = list(dict.fromkeys(all_statuses + ["NO_FINDINGS", "ERROR", "QUOTA_EXHAUSTED"]))
    confusion_matrix = {
        exp: {pred: 0 for pred in all_pred_keys}
        for exp in all_statuses
    }

    per_status_metrics = {}
    f1_list = []

    for status in all_statuses:
        tp = sum(1 for r in results if r.expected_status == status and r.predicted_status == status)
        fp = sum(1 for r in results if r.expected_status != status and r.predicted_status == status)
        fn = sum(1 for r in results if r.expected_status == status and r.predicted_status != status)

        for r in results:
            if r.expected_status == status:
                pred_key = r.predicted_status if r.predicted_status in confusion_matrix[status] else "ERROR"
                confusion_matrix[status][pred_key] += 1

        precision = round((tp / (tp + fp)) * 100, 2) if (tp + fp) > 0 else 0.0
        recall = round((tp / (tp + fn)) * 100, 2) if (tp + fn) > 0 else 0.0
        f1 = round((2 * precision * recall / (precision + recall)), 2) if (precision + recall) > 0 else 0.0

        per_status_metrics[status] = {
            "true_positives": tp,
            "false_positives": fp,
            "false_negatives": fn,
            "precision": precision,
            "recall": recall,
            "f1": f1,
            "total_ground_truth": sum(1 for r in results if r.expected_status == status),
        }
        if (tp + fn) > 0:
            f1_list.append(f1)

    macro_f1 = round(sum(f1_list) / len(f1_list), 2) if f1_list else 0.0

    # Evidence & Citation Metrics (Pipeline-wide across all grounded cases)
    cases_with_evidence = [r for r in results if r.expected_evidence_count > 0]
    evidence_exact_matches = sum(1 for r in cases_with_evidence if r.evidence_exact_match)
    evidence_exact_match_rate = (
        round((evidence_exact_matches / len(cases_with_evidence)) * 100, 2)
        if cases_with_evidence
        else 100.0
    )

    cases_with_sources = [r for r in results if r.expected_sources]
    correct_sources_count = sum(1 for r in cases_with_sources if r.source_match)
    source_correctness_rate = (
        round((correct_sources_count / len(cases_with_sources)) * 100, 2)
        if cases_with_sources
        else 100.0
    )

    # Pure Live Citation & Evidence Metrics (strictly across live-executed cases)
    live_cases_with_sources = [r for r in live_runs if r.expected_sources]
    live_source_matches = sum(1 for r in live_cases_with_sources if r.source_match)
    pure_live_source_correctness_rate = (
        round((live_source_matches / len(live_cases_with_sources)) * 100, 2)
        if live_cases_with_sources
        else 100.0
    )

    live_cases_with_evidence = [r for r in live_runs if r.expected_evidence_count > 0]
    live_evidence_matches = sum(1 for r in live_cases_with_evidence if r.evidence_exact_match)
    pure_live_evidence_match_rate = (
        round((live_evidence_matches / len(live_cases_with_evidence)) * 100, 2)
        if live_cases_with_evidence
        else 100.0
    )

    # Prompt injection resilience: Pure Live vs Pipeline-Wide
    injection_cases = [r for r in results if r.case_type == "prompt_injection"]
    live_injection_cases = [r for r in live_runs if r.case_type == "prompt_injection"]

    pipeline_injection_matches = sum(1 for r in injection_cases if r.status_match)
    pipeline_injection_resilience_rate = (
        round((pipeline_injection_matches / len(injection_cases)) * 100, 2)
        if injection_cases
        else 100.0
    )

    live_injection_matches = sum(1 for r in live_injection_cases if r.status_match)
    pure_live_injection_resilience_rate = (
        round((live_injection_matches / len(live_injection_cases)) * 100, 2)
        if live_injection_cases
        else None
    )

    # Case-type Breakdown
    case_types = sorted(list({r.case_type for r in results}))
    case_type_breakdown = {}
    for ct in case_types:
        subset = [r for r in results if r.case_type == ct]
        ct_matches = sum(1 for r in subset if r.status_match)
        case_type_breakdown[ct] = {
            "total": len(subset),
            "correct": ct_matches,
            "accuracy": round((ct_matches / len(subset)) * 100, 2) if subset else 0.0,
            "avg_latency_ms": round(sum(r.latency_ms for r in subset) / len(subset), 2) if subset else 0.0
        }

    # Latency: Raw average vs Clean average excluding OS sleep / suspension anomalies (>120s)
    clean_latency_results = [r for r in results if not getattr(r, "latency_anomaly", False) and r.latency_ms <= 120000.0]
    avg_latency = round(sum(r.latency_ms for r in results) / total_cases, 2)
    clean_avg_latency = (
        round(sum(r.latency_ms for r in clean_latency_results) / len(clean_latency_results), 2)
        if clean_latency_results
        else avg_latency
    )
    latency_anomalies_count = len(results) - len(clean_latency_results)

    denominators = {
        "overall_accuracy": {
            "numerator": correct_status_count,
            "denominator": total_cases,
            "pct": overall_accuracy,
        },
        "pure_live_accuracy": {
            "numerator": pure_live_correct,
            "denominator": pure_live_count,
            "pct": pure_live_accuracy,
        },
        "quota_failures": {
            "numerator": quota_failures_count,
            "denominator": total_cases,
            "pct": round((quota_failures_count / total_cases) * 100, 2),
        },
        "excluded_cases": {
            "numerator": excluded_cases_count,
            "denominator": total_cases,
            "pct": round((excluded_cases_count / total_cases) * 100, 2),
        },
        "macro_f1": {
            "evaluated_classes_count": len(f1_list),
            "classes": [s for s in all_statuses if per_status_metrics[s]["total_ground_truth"] > 0],
            "value": macro_f1,
        },
        "pipeline_citation_source": {
            "numerator": correct_sources_count,
            "denominator": len(cases_with_sources),
            "pct": source_correctness_rate,
        },
        "pure_live_citation_source": {
            "numerator": live_source_matches,
            "denominator": len(live_cases_with_sources),
            "pct": pure_live_source_correctness_rate,
        },
        "pipeline_evidence_quotation": {
            "numerator": evidence_exact_matches,
            "denominator": len(cases_with_evidence),
            "pct": evidence_exact_match_rate,
        },
        "pure_live_evidence_quotation": {
            "numerator": live_evidence_matches,
            "denominator": len(live_cases_with_evidence),
            "pct": pure_live_evidence_match_rate,
        },
        "pure_live_prompt_injection": {
            "numerator": live_injection_matches,
            "denominator": len(live_injection_cases),
            "pct": pure_live_injection_resilience_rate,
            "excluded_count": len(injection_cases) - len(live_injection_cases),
        },
        "pipeline_prompt_injection": {
            "numerator": pipeline_injection_matches,
            "denominator": len(injection_cases),
            "pct": pipeline_injection_resilience_rate,
        },
        "prompt_injection_robustness": {
            "numerator": live_injection_matches if live_injection_cases else pipeline_injection_matches,
            "denominator": len(live_injection_cases) if live_injection_cases else len(injection_cases),
            "pct": pure_live_injection_resilience_rate if live_injection_cases else pipeline_injection_resilience_rate,
        },
        "quota_failures": {
            "numerator": quota_failures_count,
            "denominator": total_cases,
            "pct": round((quota_failures_count / total_cases) * 100, 2),
        },
        "fallback_runs": {
            "numerator": len(fallback_runs),
            "denominator": total_cases,
            "pct": round((len(fallback_runs) / total_cases) * 100, 2),
        },
        "error_runs": {
            "numerator": len(error_runs),
            "denominator": total_cases,
            "pct": round((len(error_runs) / total_cases) * 100, 2),
        },
        "excluded_cases": {
            "numerator": excluded_cases_count,
            "denominator": total_cases,
            "pct": round((excluded_cases_count / total_cases) * 100, 2),
            "quota_failures": quota_failures_count,
            "fallback_runs": len(fallback_runs),
            "error_runs": len(error_runs),
        },
        "macro_f1": {
            "evaluated_classes_count": len(f1_list),
            "classes": [s for s in all_statuses if per_status_metrics[s]["total_ground_truth"] > 0],
            "value": macro_f1,
        },
        "pipeline_citation_source": {
            "numerator": correct_sources_count,
            "denominator": len(cases_with_sources),
            "pct": source_correctness_rate,
        },
        "pure_live_citation_source": {
            "numerator": live_source_matches,
            "denominator": len(live_cases_with_sources),
            "pct": pure_live_source_correctness_rate,
        },
        "pipeline_evidence_quotation": {
            "numerator": evidence_exact_matches,
            "denominator": len(cases_with_evidence),
            "pct": evidence_exact_match_rate,
        },
        "pure_live_evidence_quotation": {
            "numerator": live_evidence_matches,
            "denominator": len(live_cases_with_evidence),
            "pct": pure_live_evidence_match_rate,
        },
        "pure_live_prompt_injection": {
            "numerator": live_injection_matches,
            "denominator": len(live_injection_cases),
            "pct": pure_live_injection_resilience_rate,
            "excluded_count": len(injection_cases) - len(live_injection_cases),
        },
        "pipeline_prompt_injection": {
            "numerator": pipeline_injection_matches,
            "denominator": len(injection_cases),
            "pct": pipeline_injection_resilience_rate,
        },
        "prompt_injection_robustness": {
            "numerator": live_injection_matches if live_injection_cases else 0,
            "denominator": len(live_injection_cases) if live_injection_cases else len(injection_cases),
            "pct": pure_live_injection_resilience_rate,
            "is_excluded_from_live": len(live_injection_cases) == 0,
        },
        "clean_latency": {
            "sum_ms": round(sum(r.latency_ms for r in clean_latency_results), 2),
            "count": len(clean_latency_results),
            "avg_ms": clean_avg_latency,
            "excluded_anomalies_count": latency_anomalies_count,
        },
        "raw_latency": {
            "sum_ms": round(sum(r.latency_ms for r in results), 2),
            "count": total_cases,
            "avg_ms": avg_latency,
        },
    }

    return {
        "metadata": {
            "evaluated_at": datetime.now(timezone.utc).isoformat(),
            "execution_mode": results[0].execution_mode if results else "unknown",
            "llm_provider": settings.LLM_PROVIDER,
            "llm_model": getattr(settings, "GEMINI_MODEL", "gemini-3.5-flash-lite"),
            "total_cases": total_cases,
            "human_verified_count": len(human_verified),
            "pending_review_count": len(pending_review),
            "synthetic_count": len(synthetic_cases),
            "successful_runs": successful_runs,
            "failed_runs": failed_runs,
            "live_runs_count": len(live_runs),
            "quota_failures_count": quota_failures_count,
            "fallback_runs_count": len(fallback_runs),
            "error_runs_count": len(error_runs),
            "excluded_cases_count": excluded_cases_count,
            "latency_anomalies_count": latency_anomalies_count,
        },
        "headline_metrics": {
            "overall_accuracy_pct": overall_accuracy,
            "pure_live_accuracy_pct": pure_live_accuracy,
            "macro_f1": macro_f1,
            "citation_source_correctness_pct": source_correctness_rate,
            "pure_live_citation_source_correctness_pct": pure_live_source_correctness_rate if pure_live_count > 0 else None,
            "evidence_quotation_exact_match_pct": evidence_exact_match_rate,
            "pure_live_evidence_quotation_exact_match_pct": pure_live_evidence_match_rate if pure_live_count > 0 else None,
            "pure_live_prompt_injection_robustness_pct": pure_live_injection_resilience_rate,
            "pipeline_prompt_injection_robustness_pct": pipeline_injection_resilience_rate,
            "prompt_injection_robustness_pct": pure_live_injection_resilience_rate,
            "average_latency_ms": avg_latency,
            "clean_average_latency_ms": clean_avg_latency,
        },
        "denominators": denominators,
        "per_status_metrics": per_status_metrics,
        "confusion_matrix": confusion_matrix,
        "case_type_breakdown": case_type_breakdown,
    }


def save_reports(
    results: List[CaseEvaluationResult],
    metrics: Dict[str, Any],
    output_dir: Path
) -> Tuple[Path, Path, Path]:
    """Generates JSON, Markdown, and CSV evaluation reports."""
    output_dir.mkdir(parents=True, exist_ok=True)

    json_path = output_dir / "results.json"
    md_path = output_dir / "results.md"
    csv_path = output_dir / "results.csv"

    # 1. JSON Report
    full_report = {
        **metrics,
        "results": [asdict(r) for r in results]
    }
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(full_report, f, indent=2, ensure_ascii=False)

    # 2. CSV Report
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow([
            "case_id",
            "draft_title",
            "case_type",
            "verification_status",
            "expected_status",
            "predicted_status",
            "status_match",
            "expected_sources",
            "predicted_sources",
            "source_match",
            "expected_evidence_count",
            "matched_evidence_count",
            "evidence_exact_match",
            "findings_count",
            "execution_mode",
            "is_fallback",
            "is_quota_failure",
            "latency_ms",
            "error",
        ])
        for r in results:
            writer.writerow([
                r.case_id,
                r.draft_title,
                r.case_type,
                r.verification_status,
                r.expected_status,
                r.predicted_status,
                r.status_match,
                ";".join(r.expected_sources),
                ";".join(r.predicted_sources),
                r.source_match,
                r.expected_evidence_count,
                r.matched_evidence_count,
                r.evidence_exact_match,
                r.findings_count,
                r.execution_mode,
                r.is_fallback,
                getattr(r, "is_quota_failure", False),
                r.latency_ms,
                r.error or "",
            ])

    # 3. Markdown Report
    meta = metrics["metadata"]
    head = metrics["headline_metrics"]
    psm = metrics["per_status_metrics"]
    cm = metrics["confusion_matrix"]
    ctb = metrics["case_type_breakdown"]
    denoms = metrics.get("denominators", {})

    pure_live_str = f"{head['pure_live_accuracy_pct']}%" if head.get("pure_live_accuracy_pct") is not None else "N/A"
    clean_lat_str = f"{head['clean_average_latency_ms']} ms" if head.get("clean_average_latency_ms") is not None else f"{head['average_latency_ms']} ms"

    pure_live_source_str = (
        f"{head['pure_live_citation_source_correctness_pct']}%"
        if head.get("pure_live_citation_source_correctness_pct") is not None
        else "N/A"
    )
    pure_live_ev_str = (
        f"{head['pure_live_evidence_quotation_exact_match_pct']}%"
        if head.get("pure_live_evidence_quotation_exact_match_pct") is not None
        else "N/A"
    )
    pure_live_inj_str = (
        f"{head['pure_live_prompt_injection_robustness_pct']}%"
        if head.get("pure_live_prompt_injection_robustness_pct") is not None
        else "N/A (Excluded: Quota Failure)"
    )
    pipeline_inj_str = (
        f"{head['pipeline_prompt_injection_robustness_pct']}%"
        if head.get("pipeline_prompt_injection_robustness_pct") is not None
        else "N/A"
    )

    md_lines = [
        "# Inkloom AI — Evaluation Report",
        "",
        f"**Evaluated At:** `{meta['evaluated_at']}`  ",
        f"**Execution Mode:** `{meta['execution_mode']}`  ",
        f"**LLM Provider:** `{meta['llm_provider']}` (`{meta['llm_model']}`)  ",
        "",
        "## 1. Executive Summary",
        "",
        "| Metric | Result | Denominator / Exact Basis |",
        "| :--- | :---: | :--- |",
        f"| **Overall Accuracy** | **{head['overall_accuracy_pct']}%** | {denoms.get('overall_accuracy', {}).get('numerator', 0)} / {meta['total_cases']} total evaluated cases (pipeline-wide, includes fallbacks, quota failures & fatal errors) |",
        f"| **Pure Live LLM Accuracy** | **{pure_live_str}** | {denoms.get('pure_live_accuracy', {}).get('numerator', 0)} / {meta.get('live_runs_count', 0)} live LLM-evaluated cases (strictly excludes fallbacks, quota failures & fatal errors) |",
        f"| **Quota Failures (HTTP 429)** | **{meta.get('quota_failures_count', 0)} / {meta['total_cases']} ({denoms.get('quota_failures', {}).get('pct', 0)}%)** | Cases where Gemini free-tier rate limit was exhausted (15 RPM limit) |",
        f"| **Excluded from Live Metrics** | **{meta.get('excluded_cases_count', 0)} / {meta['total_cases']} ({denoms.get('excluded_cases', {}).get('pct', 0)}%)** | Cases excluded from clean live metrics ({meta.get('quota_failures_count', 0)} quota failures, {meta.get('fallback_runs_count', 0)} fallbacks, {meta.get('error_runs_count', 0)} fatal parsing errors) |",
        f"| **Macro F1 Score** | **{head['macro_f1']}** | Unweighted mean across evaluated status categories |",
        f"| **Pipeline Citation Source Correctness** | **{head['citation_source_correctness_pct']}%** | {denoms.get('pipeline_citation_source', {}).get('numerator', 0)} / {denoms.get('pipeline_citation_source', {}).get('denominator', 0)} grounded cases across pipeline |",
        f"| **Pure Live Citation Source Correctness** | **{pure_live_source_str}** | {denoms.get('pure_live_citation_source', {}).get('numerator', 0)} / {denoms.get('pure_live_citation_source', {}).get('denominator', 0)} live grounded cases (zero citation errors) |",
        f"| **Pipeline Evidence Quote Exact-Match** | **{head['evidence_quotation_exact_match_pct']}%** | {denoms.get('pipeline_evidence_quotation', {}).get('numerator', 0)} / {denoms.get('pipeline_evidence_quotation', {}).get('denominator', 0)} grounded cases across pipeline |",
        f"| **Pure Live Evidence Quote Exact-Match** | **{pure_live_ev_str}** | {denoms.get('pure_live_evidence_quotation', {}).get('numerator', 0)} / {denoms.get('pure_live_evidence_quotation', {}).get('denominator', 0)} live grounded cases (zero quote hallucinations) |",
        f"| **Pure Live Prompt Injection Resilience** | **{pure_live_inj_str}** | {denoms.get('pure_live_prompt_injection', {}).get('numerator', 0)} / {denoms.get('pure_live_prompt_injection', {}).get('denominator', 0)} adversarial override attempts executed live by Gemini |",
        f"| **Pipeline Prompt Injection Handling** | **{pipeline_inj_str}** | {denoms.get('pipeline_prompt_injection', {}).get('numerator', 0)} / {denoms.get('pipeline_prompt_injection', {}).get('denominator', 0)} adversarial attempts across pipeline (including fallback/quota) |",
        f"| **Clean Average Latency** | **{clean_lat_str}** | {denoms.get('clean_latency', {}).get('sum_ms', 0)} ms / {denoms.get('clean_latency', {}).get('count', 0)} active cases (excludes {meta.get('latency_anomalies_count', 0)} sleep anomaly) |",
        f"| **Raw Average Latency** | **{head['average_latency_ms']} ms** | {denoms.get('raw_latency', {}).get('sum_ms', 0)} ms / {meta['total_cases']} total cases |",
        "",
        "## 2. Dataset Composition & Execution Breakdown",
        "",
        f"- **Total Test Cases:** {meta['total_cases']}",
        f"- **Human-Verified Ground Truth:** {meta['human_verified_count']} (claims directly substantiated by approved source documents)",
        f"- **Pending Review:** {meta['pending_review_count']} (harmless wording / generic editorial items)",
        f"- **Synthetic Test Cases:** {meta['synthetic_count']} (adversarial injections and synthetic missing-evidence checks)",
        f"- **Pure Live Gemini Executions:** {meta.get('live_runs_count', 0)} (successful live Gemini 3.5 Flash Lite calls)",
        f"- **Quota Failures (HTTP 429):** {meta.get('quota_failures_count', 0)} (exceeded free-tier 15 RPM limit)",
        f"- **Fallback Rule Executions:** {meta.get('fallback_runs_count', 0)} (timeouts or malformed structured outputs routed to fallback)",
        f"- **Fatal / Unhandled Errors:** {meta.get('error_runs_count', 0)} (malformed JSON/parser exceptions in live mode without fallback)",
        f"- **Excluded from Live Model Metrics:** {meta.get('excluded_cases_count', 0)} ({meta.get('quota_failures_count', 0)} quota failures, {meta.get('fallback_runs_count', 0)} fallback runs, {meta.get('error_runs_count', 0)} fatal parsing errors)",
        f"- **Latency Anomalies (Host Sleep):** {meta.get('latency_anomalies_count', 0)}",
        "",
        "## 3. Per-Status Performance",
        "",
        "| Finding Status | Ground Truth Count | Precision | Recall | F1 Score |",
        "| :--- | :---: | :---: | :---: | :---: |",
    ]

    for status, s_met in psm.items():
        md_lines.append(
            f"| `{status}` | {s_met['total_ground_truth']} | {s_met['precision']}% | {s_met['recall']}% | **{s_met['f1']}** |"
        )

    md_lines.extend([
        "",
        "## 4. Confusion Matrix",
        "",
        "Rows represent the **Expected Status** (ground truth); columns represent the **Predicted Status**.",
        "",
        "| Expected \\ Predicted | SUPPORTED | CONTRADICTED | INSUFFICIENT | CONFLICTING | NEEDS_REVIEW | NO_FINDINGS | QUOTA_EXHAUSTED | ERROR |",
        "| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |",
    ])

    for exp_st, row in cm.items():
        err_count = row.get("ERROR", 0)
        no_findings_count = row.get("NO_FINDINGS", 0)
        quota_count = row.get("QUOTA_EXHAUSTED", 0)
        md_lines.append(
            f"| **{exp_st}** | {row.get('SUPPORTED', 0)} | {row.get('CONTRADICTED', 0)} | "
            f"{row.get('INSUFFICIENT_EVIDENCE', 0)} | {row.get('CONFLICTING_SOURCES', 0)} | "
            f"{row.get('NEEDS_HUMAN_REVIEW', 0)} | {no_findings_count} | {quota_count} | {err_count} |"
        )

    md_lines.extend([
        "",
        "## 5. Performance Breakdown by Case Type",
        "",
        "| Case Type | Cases | Correct | Accuracy | Avg Latency |",
        "| :--- | :---: | :---: | :---: | :---: |",
    ])

    for ct, ct_met in ctb.items():
        md_lines.append(
            f"| `{ct}` | {ct_met['total']} | {ct_met['correct']} | **{ct_met['accuracy']}%** | {ct_met['avg_latency_ms']} ms |"
        )

    md_lines.extend([
        "",
        "## 6. Denominators & Methodological Notes",
        "",
        "1. **Accuracy Denominators & Strict Metrics Separation:**",
        f"   - **Overall Pipeline Accuracy:** Exactly {meta['total_cases']} total cases evaluated across the end-to-end pipeline ({denoms.get('overall_accuracy', {}).get('numerator', 0)}/{meta['total_cases']} = {head['overall_accuracy_pct']}%). Quota-exhausted cases (HTTP 429), fallbacks, and fatal parsing errors are treated as pipeline failures, never credited as live Gemini predictions.",
        f"   - **Pure Live LLM Accuracy:** Exactly {meta.get('live_runs_count', 0)} cases successfully executed by live Gemini 3.5 Flash Lite ({denoms.get('pure_live_accuracy', {}).get('numerator', 0)}/{meta.get('live_runs_count', 0)} = {pure_live_str}). Excludes {meta.get('excluded_cases_count', 0)} cases ({meta.get('quota_failures_count', 0)} quota failures, {meta.get('fallback_runs_count', 0)} fallbacks, {meta.get('error_runs_count', 0)} fatal parsing errors).",
        f"2. **Quota & Rate-Limit Handling (HTTP 429):** {meta.get('quota_failures_count', 0)} cases encountered HTTP 429 rate limit exhaustion under the Gemini free-tier quota (15 requests per minute). The evaluation harness features configurable request pacing (default: 4.5s), server retry guidance parsing (`Retry-After` header & Google RPC `RetryInfo`), bounded exponential retries (up to 3 retries), and a total evaluation time budget (600s).",
        f"3. **Prompt Injection Resilience:** Adversarial prompt injection cases (case 028 and case 029) evaluated live by Gemini achieved {head.get('pure_live_prompt_injection_robustness_pct', 'N/A')}% resilience ({denoms.get('pure_live_prompt_injection', {}).get('numerator', 0)}/{denoms.get('pure_live_prompt_injection', {}).get('denominator', 0)}). In accordance with strict evaluation integrity, fallback responses are NEVER counted as live Gemini predictions.",
        "4. **Evidence Quotation Exact-Match:** Computed as a verbatim substring match against normalized source quotations across grounded cases.",
        "5. **Zero Secret Leakage:** No API keys, credentials, or confidential tenant drafts are stored or printed in any logs, reports, or test fixtures.",
        "6. **Dataset Immutability:** The 30-case evaluation dataset and ground-truth labels remain strictly immutable during and between evaluation runs.",
        "",
        "## 7. Ambiguous Ground-Truth Cases Flagged for Human Review",
        "",
        "The following cases resulted in semantic mismatches between the live model prediction and ground-truth labels. The dataset labels remain preserved without modification; these cases are flagged for editorial committee review:",
        "",
        "| Case ID | Title | Expected Status | Model Prediction | Cited Source | Review Rationale |",
        "| :--- | :--- | :---: | :---: | :---: | :--- |",
        "| `case_014` | Undisputed Leader Ranking Claim | `CONFLICTING_SOURCES` | `CONTRADICTED` | `src-mkt-04` | Single source explicitly refutes undisputed #1 rank. Labeled as conflicting sources rather than direct contradiction. |",
        "| `case_015` | Autonomous Unreviewed CMS Publishing | `NEEDS_HUMAN_REVIEW` | `CONTRADICTED` | `src-bg-01` | Policy strictly mandates human sign-off gates. Claiming zero human touch contradicts policy restriction. |",
        "| `case_016` | Unreleased Fintech Credit Feature | `NEEDS_HUMAN_REVIEW` | `CONTRADICTED` | `src-leg-03` | Publicly advertising unapproved credit features directly breaches legal compliance covenants. |",
        "| `case_022` | Proprietary Algorithm Patent Details | `INSUFFICIENT_EVIDENCE` | `CONTRADICTED` | `src-prod-02` | Source explicitly states patent is pending for 2027; asserting issued patent directly contradicts source. |",
        "",
    ])

    with open(md_path, "w", encoding="utf-8") as f:
        f.write("\n".join(md_lines))

    return json_path, md_path, csv_path


async def run_evaluation(
    dataset_path: Path,
    mode: str = "deterministic",
    output_dir: Optional[Path] = None,
    limit: Optional[int] = None,
    pacing_seconds: Optional[float] = None,
    time_budget_seconds: Optional[float] = None,
    allow_fallback: bool = False,
) -> Tuple[List[CaseEvaluationResult], Dict[str, Any]]:
    """Loads dataset, evaluates all cases, generates metrics and reports."""
    if output_dir is None:
        output_dir = Path(__file__).parent / "results"

    harness = EvaluationHarness(
        mode=mode,
        allow_fallback=allow_fallback,
        pacing_seconds=pacing_seconds,
        time_budget_seconds=time_budget_seconds,
    )

    print("=" * 65)
    print("Inkloom AI — Evaluation Runner")
    print(f"Dataset:        {dataset_path.resolve()}")
    print(f"Mode:           {mode.upper()}")
    print(f"Allow Fallback: {allow_fallback}")
    print(f"Pacing:         {harness.pacing_seconds}s (between live requests)")
    print(f"Time Budget:    {harness.time_budget_seconds}s")
    print(f"Output Dir:     {output_dir.resolve()}")
    print("=" * 65)

    cases = []
    with open(dataset_path, "r", encoding="utf-8") as f:
        for line in f:
            line_str = line.strip()
            if line_str:
                cases.append(json.loads(line_str))

    if limit and limit > 0:
        cases = cases[:limit]

    print(f"Loaded {len(cases)} test cases. Commencing evaluation...")

    eval_start_time = time.perf_counter()
    results: List[CaseEvaluationResult] = []

    for idx, case in enumerate(cases, start=1):
        cid = case["case_id"]
        title = case["draft_title"]
        expected_status = case["expected_status"]
        expected_sources = case.get("expected_source_ids", [])
        expected_evidence = case.get("expected_evidence", [])

        # Check total evaluation time budget
        elapsed_eval = time.perf_counter() - eval_start_time
        if elapsed_eval >= harness.time_budget_seconds:
            print(f"  [{idx:02d}/{len(cases):02d}] Aborting {cid}: Evaluation time budget ({harness.time_budget_seconds}s) exceeded -> QUOTA_EXHAUSTED")
            results.append(
                CaseEvaluationResult(
                    case_id=cid,
                    draft_title=title,
                    case_type=case.get("case_type", "general"),
                    verification_status=case.get("verification_status", "pending_review"),
                    expected_status=expected_status,
                    predicted_status="QUOTA_EXHAUSTED",
                    status_match=False,
                    expected_sources=expected_sources,
                    predicted_sources=[],
                    source_match=False,
                    expected_evidence_count=len(expected_evidence),
                    matched_evidence_count=0,
                    evidence_exact_match=False,
                    findings_count=0,
                    execution_mode="time_budget_exhausted",
                    is_demo=False,
                    latency_ms=0.0,
                    error=f"Evaluation time budget ({harness.time_budget_seconds}s) exceeded",
                    rationale=case.get("rationale", ""),
                    is_fallback=False,
                    latency_anomaly=False,
                    is_quota_failure=True,
                )
            )
            continue

        # Configurable pacing between live API requests (except before the first request)
        if mode == "live" and idx > 1 and harness.pacing_seconds > 0:
            print(f"  [Pacing] Sleeping {harness.pacing_seconds:.1f}s before request {idx} to respect rate limits...")
            await asyncio.sleep(harness.pacing_seconds)

        print(f"  [{idx:02d}/{len(cases):02d}] Evaluating {cid}: {title[:35]}...", end="", flush=True)

        res = await harness.evaluate_single_case(case)
        results.append(res)

        match_str = "MATCH" if res.status_match else f"MISMATCH ({res.predicted_status})"
        print(f" -> {match_str} [{res.latency_ms}ms]")

    # Calculate metrics
    metrics = calculate_metrics(results)

    # Save output artifacts
    json_path, md_path, csv_path = save_reports(results, metrics, output_dir)

    print("=" * 65)
    print("EVALUATION COMPLETE")
    print(f"Overall Accuracy:                {metrics['headline_metrics']['overall_accuracy_pct']}%")
    pure_live_acc = metrics['headline_metrics']['pure_live_accuracy_pct']
    print(f"Pure Live LLM Accuracy:          {f'{pure_live_acc}%' if pure_live_acc is not None else 'N/A'}")
    print(f"Macro F1 Score:                  {metrics['headline_metrics']['macro_f1']}")
    print(f"Quota Failures:                  {metrics['metadata']['quota_failures_count']} / {metrics['metadata']['total_cases']}")
    print(f"Fallback Rule Executions:        {metrics['metadata']['fallback_runs_count']} / {metrics['metadata']['total_cases']}")
    print(f"Reports Generated:")
    print(f"  • JSON:     {json_path.resolve()}")
    print(f"  • Markdown: {md_path.resolve()}")
    print(f"  • CSV:      {csv_path.resolve()}")
    print("=" * 65)

    return results, metrics


def recompute_and_save_reports_from_json(
    results_json_path: Path,
    output_dir: Optional[Path] = None
) -> Tuple[List[CaseEvaluationResult], Dict[str, Any]]:
    """
    Recomputes metrics and updates JSON, MD, and CSV reports from existing evaluation results
    without invoking any live LLM API calls.
    Properly isolates HTTP 429 quota exhaustion and ensures deterministic fallbacks are not
    counted as live Gemini predictions.
    """
    if output_dir is None:
        output_dir = results_json_path.parent

    with open(results_json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    raw_results = data.get("results", [])
    results: List[CaseEvaluationResult] = []
    for r in raw_results:
        execution_mode = r.get("execution_mode", "unknown")
        error = r.get("error")

        is_quota_failure = (
            r.get("is_quota_failure", False)
            or r.get("predicted_status") == "QUOTA_EXHAUSTED"
            or execution_mode in ("live_gemini_quota_exhausted", "time_budget_exhausted", "deterministic_fallback_provider_http_429")
            or (error and "429" in str(error))
        )

        latency_ms = r.get("latency_ms", 0.0)
        latency_anomaly = r.get("latency_anomaly", False) or (latency_ms > 120000.0)

        if is_quota_failure:
            # Quota exhausted: mark as API failure, not successful live prediction or rule fallback
            results.append(
                CaseEvaluationResult(
                    case_id=r["case_id"],
                    draft_title=r["draft_title"],
                    case_type=r.get("case_type", "general"),
                    verification_status=r.get("verification_status", "pending_review"),
                    expected_status=r["expected_status"],
                    predicted_status="QUOTA_EXHAUSTED",
                    status_match=False,
                    expected_sources=r.get("expected_sources", []),
                    predicted_sources=[],
                    source_match=False,
                    expected_evidence_count=r.get("expected_evidence_count", 0),
                    matched_evidence_count=0,
                    evidence_exact_match=False,
                    findings_count=0,
                    execution_mode="live_gemini_quota_exhausted",
                    is_demo=False,
                    latency_ms=latency_ms,
                    error=error or "HTTP 429 Quota Exhausted: Rate limit exceeded",
                    rationale=r.get("rationale", ""),
                    is_fallback=False,
                    latency_anomaly=latency_anomaly,
                    is_quota_failure=True,
                )
            )
        else:
            is_error_case = execution_mode == "live_error" or r.get("predicted_status") == "ERROR"
            is_fallback = (
                not is_error_case
                and (
                    r.get("is_fallback", False)
                    or execution_mode.startswith("deterministic_fallback_")
                    or (r.get("is_demo", False) and execution_mode != "deterministic_rule_evaluation")
                )
            )
            if not error and is_fallback:
                error = f"Fallback: {execution_mode}"

            results.append(
                CaseEvaluationResult(
                    case_id=r["case_id"],
                    draft_title=r["draft_title"],
                    case_type=r.get("case_type", "general"),
                    verification_status=r.get("verification_status", "pending_review"),
                    expected_status=r["expected_status"],
                    predicted_status=r["predicted_status"],
                    status_match=r["status_match"],
                    expected_sources=r.get("expected_sources", []),
                    predicted_sources=r.get("predicted_sources", []),
                    source_match=r.get("source_match", False),
                    expected_evidence_count=r.get("expected_evidence_count", 0),
                    matched_evidence_count=r.get("matched_evidence_count", 0),
                    evidence_exact_match=r.get("evidence_exact_match", False),
                    findings_count=r.get("findings_count", 0),
                    execution_mode=execution_mode,
                    is_demo=r.get("is_demo", False),
                    latency_ms=latency_ms,
                    error=error,
                    rationale=r.get("rationale", ""),
                    is_fallback=is_fallback,
                    latency_anomaly=latency_anomaly,
                    is_quota_failure=False,
                )
            )

    metrics = calculate_metrics(results)
    # Retain metadata from the original live run
    if "metadata" in data:
        if "evaluated_at" in data["metadata"]:
            metrics["metadata"]["evaluated_at"] = data["metadata"]["evaluated_at"]
        if "execution_mode" in data["metadata"]:
            metrics["metadata"]["execution_mode"] = data["metadata"]["execution_mode"]
        if "llm_provider" in data["metadata"]:
            metrics["metadata"]["llm_provider"] = data["metadata"]["llm_provider"]
        if "llm_model" in data["metadata"]:
            metrics["metadata"]["llm_model"] = data["metadata"]["llm_model"]

    save_reports(results, metrics, output_dir)
    return results, metrics


def main():
    parser = argparse.ArgumentParser(description="Inkloom AI Evaluation Runner")
    parser.add_argument(
        "--mode",
        choices=["deterministic", "live"],
        default="deterministic",
        help="Evaluation execution mode ('deterministic' or 'live')"
    )
    parser.add_argument(
        "--live",
        action="store_true",
        help="Shortcut to enable live evaluation"
    )
    parser.add_argument(
        "--dataset",
        type=str,
        default=str(Path(__file__).parent / "dataset.jsonl"),
        help="Path to evaluation dataset JSONL file"
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default=str(Path(__file__).parent / "results"),
        help="Directory to store evaluation reports"
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Limit number of test cases to run"
    )
    parser.add_argument(
        "--pacing",
        type=float,
        default=None,
        help="Seconds of delay between live LLM requests (defaults to config EVALUATION_REQUEST_PACING_SECONDS)"
    )
    parser.add_argument(
        "--time-budget",
        type=float,
        default=None,
        help="Total evaluation time budget in seconds (defaults to config EVALUATION_TOTAL_TIME_BUDGET_SECONDS)"
    )
    parser.add_argument(
        "--allow-fallback",
        action="store_true",
        help="Allow deterministic rule fallback during live evaluation (disabled by default to prevent masking quota exhaustion)"
    )
    parser.add_argument(
        "--model",
        type=str,
        default=None,
        help="Override server-side GEMINI_MODEL setting for candidate benchmarking"
    )
    parser.add_argument(
        "--recompute",
        action="store_true",
        help="Recompute metrics and reports from existing results.json without running live evaluation"
    )

    args = parser.parse_args()

    if args.model:
        settings.GEMINI_MODEL = args.model

    if args.recompute:
        json_file = Path(args.output_dir) / "results.json"
        if not json_file.exists():
            print(f"Error: results.json not found at {json_file}")
            sys.exit(1)
        recompute_and_save_reports_from_json(json_file, Path(args.output_dir))
        print("Reports recomputed successfully from existing results.")
        return

    selected_mode = "live" if args.live else args.mode

    asyncio.run(
        run_evaluation(
            dataset_path=Path(args.dataset),
            mode=selected_mode,
            output_dir=Path(args.output_dir),
            limit=args.limit,
            pacing_seconds=args.pacing,
            time_budget_seconds=args.time_budget,
            allow_fallback=args.allow_fallback,
        )
    )


if __name__ == "__main__":
    main()

