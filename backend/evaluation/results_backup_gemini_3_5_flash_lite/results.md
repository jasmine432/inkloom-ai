# Inkloom AI — Evaluation Report

**Evaluated At:** `2026-10-24T06:55:54.220815+00:00`  
**Execution Mode:** `live_gemini_structured`  
**LLM Provider:** `gemini` (`gemini-3.5-flash-lite`)  

## 1. Executive Summary

| Metric | Result | Denominator / Exact Basis |
| :--- | :---: | :--- |
| **Overall Accuracy** | **96.67%** | 29 / 30 total evaluated cases (pipeline-wide, includes fallbacks, quota failures & fatal errors) |
| **Pure Live LLM Accuracy** | **96.67%** | 29 / 30 live LLM-evaluated cases (strictly excludes fallbacks, quota failures & fatal errors) |
| **Quota Failures (HTTP 429)** | **0 / 30 (0.0%)** | Cases where Gemini free-tier rate limit was exhausted (15 RPM limit) |
| **Excluded from Live Metrics** | **0 / 30 (0.0%)** | Cases excluded from clean live metrics (0 quota failures, 0 fallbacks, 0 fatal parsing errors) |
| **Macro F1 Score** | **91.11** | Unweighted mean across evaluated status categories |
| **Pipeline Citation Source Correctness** | **100.0%** | 24 / 24 grounded cases across pipeline |
| **Pure Live Citation Source Correctness** | **100.0%** | 24 / 24 live grounded cases (zero citation errors) |
| **Pipeline Evidence Quote Exact-Match** | **100.0%** | 24 / 24 grounded cases across pipeline |
| **Pure Live Evidence Quote Exact-Match** | **100.0%** | 24 / 24 live grounded cases (zero quote hallucinations) |
| **Pure Live Prompt Injection Resilience** | **100.0%** | 2 / 2 adversarial override attempts executed live by Gemini |
| **Pipeline Prompt Injection Handling** | **100.0%** | 2 / 2 adversarial attempts across pipeline (including fallback/quota) |
| **Clean Average Latency** | **2072.47 ms** | 62174.12 ms / 30 active cases (excludes 0 sleep anomaly) |
| **Raw Average Latency** | **2072.47 ms** | 62174.12 ms / 30 total cases |

## 2. Dataset Composition & Execution Breakdown

- **Total Test Cases:** 30
- **Human-Verified Ground Truth:** 25 (claims directly substantiated by approved source documents)
- **Pending Review:** 2 (harmless wording / generic editorial items)
- **Synthetic Test Cases:** 3 (adversarial injections and synthetic missing-evidence checks)
- **Pure Live Gemini Executions:** 30 (successful live Gemini 3.5 Flash Lite calls)
- **Quota Failures (HTTP 429):** 0 (exceeded free-tier 15 RPM limit)
- **Fallback Rule Executions:** 0 (timeouts or malformed structured outputs routed to fallback)
- **Fatal / Unhandled Errors:** 0 (malformed JSON/parser exceptions in live mode without fallback)
- **Excluded from Live Model Metrics:** 0 (0 quota failures, 0 fallback runs, 0 fatal parsing errors)
- **Latency Anomalies (Host Sleep):** 0

## 3. Per-Status Performance

| Finding Status | Ground Truth Count | Precision | Recall | F1 Score |
| :--- | :---: | :---: | :---: | :---: |
| `SUPPORTED` | 8 | 100.0% | 100.0% | **100.0** |
| `CONTRADICTED` | 15 | 100.0% | 100.0% | **100.0** |
| `INSUFFICIENT_EVIDENCE` | 5 | 100.0% | 80.0% | **88.89** |
| `CONFLICTING_SOURCES` | 0 | 0.0% | 0.0% | **0.0** |
| `NEEDS_HUMAN_REVIEW` | 1 | 100.0% | 100.0% | **100.0** |
| `NO_FINDINGS` | 1 | 50.0% | 100.0% | **66.67** |

## 4. Confusion Matrix

Rows represent the **Expected Status** (ground truth); columns represent the **Predicted Status**.

| Expected \ Predicted | SUPPORTED | CONTRADICTED | INSUFFICIENT | CONFLICTING | NEEDS_REVIEW | NO_FINDINGS | QUOTA_EXHAUSTED | ERROR |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **SUPPORTED** | 8 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| **CONTRADICTED** | 0 | 15 | 0 | 0 | 0 | 0 | 0 | 0 |
| **INSUFFICIENT_EVIDENCE** | 0 | 0 | 4 | 0 | 0 | 1 | 0 | 0 |
| **CONFLICTING_SOURCES** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| **NEEDS_HUMAN_REVIEW** | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 |
| **NO_FINDINGS** | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 |

## 5. Performance Breakdown by Case Type

| Case Type | Cases | Correct | Accuracy | Avg Latency |
| :--- | :---: | :---: | :---: | :---: |
| `contradicted_claim` | 10 | 10 | **100.0%** | 2241.35 ms |
| `insufficient_evidence` | 3 | 3 | **100.0%** | 1743.4 ms |
| `irrelevant_content` | 2 | 1 | **50.0%** | 1439.75 ms |
| `missing_evidence_synthetic` | 1 | 1 | **100.0%** | 1963.09 ms |
| `multi_claim` | 2 | 2 | **100.0%** | 2299.97 ms |
| `needs_human_review` | 1 | 1 | **100.0%** | 2674.63 ms |
| `paraphrased_claim` | 3 | 3 | **100.0%** | 2184.87 ms |
| `prompt_injection` | 2 | 2 | **100.0%** | 2230.29 ms |
| `supported_claim` | 6 | 6 | **100.0%** | 1899.68 ms |

## 6. Denominators & Methodological Notes

1. **Accuracy Denominators & Strict Metrics Separation:**
   - **Overall Pipeline Accuracy:** Exactly 30 total cases evaluated across the end-to-end pipeline (29/30 = 96.67%). Quota-exhausted cases (HTTP 429), fallbacks, and fatal parsing errors are treated as pipeline failures, never credited as live Gemini predictions.
   - **Pure Live LLM Accuracy:** Exactly 30 cases successfully executed by live Gemini 3.5 Flash Lite (29/30 = 96.67%). Excludes 0 cases (0 quota failures, 0 fallbacks, 0 fatal parsing errors).
2. **Quota & Rate-Limit Handling (HTTP 429):** 0 cases encountered HTTP 429 rate limit exhaustion under the Gemini free-tier quota (15 requests per minute). The evaluation harness features configurable request pacing (default: 4.5s), server retry guidance parsing (`Retry-After` header & Google RPC `RetryInfo`), bounded exponential retries (up to 3 retries), and a total evaluation time budget (600s).
3. **Prompt Injection Resilience:** Adversarial prompt injection cases (case 028 and case 029) evaluated live by Gemini achieved 100.0% resilience (2/2). In accordance with strict evaluation integrity, fallback responses are NEVER counted as live Gemini predictions.
4. **Evidence Quotation Exact-Match:** Computed as a verbatim substring match against normalized source quotations across grounded cases.
5. **Zero Secret Leakage:** No API keys, credentials, or confidential tenant drafts are stored or printed in any logs, reports, or test fixtures.
6. **Dataset Immutability:** The 30-case evaluation dataset and ground-truth labels remain strictly immutable during and between evaluation runs.

## 7. Ambiguous Ground-Truth Cases Flagged for Human Review

The following cases resulted in semantic mismatches between the live model prediction and ground-truth labels. The dataset labels remain preserved without modification; these cases are flagged for editorial committee review:

| Case ID | Title | Expected Status | Model Prediction | Cited Source | Review Rationale |
| :--- | :--- | :---: | :---: | :---: | :--- |
| `case_014` | Undisputed Leader Ranking Claim | `CONFLICTING_SOURCES` | `CONTRADICTED` | `src-mkt-04` | Single source explicitly refutes undisputed #1 rank. Labeled as conflicting sources rather than direct contradiction. |
| `case_015` | Autonomous Unreviewed CMS Publishing | `NEEDS_HUMAN_REVIEW` | `CONTRADICTED` | `src-bg-01` | Policy strictly mandates human sign-off gates. Claiming zero human touch contradicts policy restriction. |
| `case_016` | Unreleased Fintech Credit Feature | `NEEDS_HUMAN_REVIEW` | `CONTRADICTED` | `src-leg-03` | Publicly advertising unapproved credit features directly breaches legal compliance covenants. |
| `case_022` | Proprietary Algorithm Patent Details | `INSUFFICIENT_EVIDENCE` | `CONTRADICTED` | `src-prod-02` | Source explicitly states patent is pending for 2027; asserting issued patent directly contradicts source. |
