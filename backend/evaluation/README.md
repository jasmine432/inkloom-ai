# Inkloom AI — Ground-Truth AI Evaluation System

This directory houses the reproducible evaluation framework for measuring factual accuracy, citation grounding, and prompt-injection resistance of the Inkloom AI content-auditing engine.

---

## 1. Directory Structure

```text
backend/evaluation/
├── dataset.jsonl           # 30 version-controlled ground-truth test cases
├── create_dataset.py       # Script used to generate/update the dataset
├── validate_dataset.py     # Schema and evidence verification validator
├── run_evaluation.py      # Repeatable evaluation runner (deterministic & live)
├── README.md               # System documentation & usage manual
└── results/                # Output artifacts
    ├── results.json        # Machine-readable detailed metrics & predictions
    ├── results.md          # Human-readable executive summary & confusion matrix
    └── results.csv         # Per-case tabular report
```

---

## 2. Dataset Specification (`dataset.jsonl`)

The dataset contains 30 carefully curated test cases categorized by evaluation type:
1. **Supported Claims (`supported_claim`):** Claims directly substantiated by approved source documents.
2. **Contradicted Claims (`contradicted_claim`):** Claims that conflict with binding covenants or style rules.
3. **Conflicting Sources (`conflicting_sources`):** Statements where sources state diverging facts (e.g. Strong Performer vs #1 ranking).
4. **Needs Human Review (`needs_human_review`):** Claims requiring mandatory human sign-off (e.g. autonomous publishing or unreleased fintech features).
5. **Paraphrased Claims (`paraphrased_claim`):** Semantic reformulations of supported or prohibited facts.
6. **Multi-Claim Drafts (`multi_claim`):** Copy containing multiple distinct statements with differing statuses.
7. **Insufficient Evidence (`insufficient_evidence`):** Claims absent from approved company repositories.
8. **Irrelevant Content (`irrelevant_content`):** Harmless conversational text or generic editorial storytelling.
9. **Prompt Injection (`prompt_injection`):** Adversarial system override directives embedded in drafts.
10. **Synthetic Missing Evidence (`missing_evidence_synthetic`):** Explicitly marked synthetic technical claims.

### Ground-Truth Verification Statuses:
- `human_verified` (25 cases): Verified verbatim against the 4 certified source documents in `backend/data/sources/`.
- `pending_review` (2 cases): Generic editorial / conversational content.
- `synthetic` (3 cases): Adversarial prompt injection attacks and synthetic hardware benchmarks.

---

## 3. How to Validate the Dataset

Before running any evaluation, run `validate_dataset.py` to confirm that:
- Every record has valid JSON syntax and required schema keys.
- All referenced `expected_source_ids` exist in the loaded sources repository.
- All `expected_evidence` quotations exist verbatim in the cited documents.
- No duplicate case IDs exist.

```powershell
# From project root (using local venv)
.\.venv\Scripts\python.exe backend/evaluation/validate_dataset.py
```

---

## 4. How to Run Evaluations

### A. Deterministic Evaluation (Default, Offline, 0 API Quota)
Runs every case through the deterministic rule-evaluation engine and citation validator without making external network calls.

```powershell
# Run deterministic evaluation
.\.venv\Scripts\python.exe backend/evaluation/run_evaluation.py --mode deterministic
```

### B. Live Gemini Evaluation (Requires `backend/.env` configured)
Runs cases through the real Google Gemini model (`gemini-3.5-flash-lite`) and validates evidence with the citation validator.

```powershell
# Run live Gemini evaluation
.\.venv\Scripts\python.exe backend/evaluation/run_evaluation.py --mode live

# Or use the shortcut flag
.\.venv\Scripts\python.exe backend/evaluation/run_evaluation.py --live
```

---

## 5. Output Reports (`backend/evaluation/results/`)

Every evaluation run generates three reports:
- **`results.json`:** Comprehensive machine-readable report including headline metrics, per-status metrics, confusion matrix, breakdown by case type, and full individual case outputs.
- **`results.md`:** Human-readable Markdown summary with tables and clear denominators.
- **`results.csv`:** Tabular report with one row per case for spreadsheet analysis.

---

## 6. Metric Definitions & Denominators

- **Overall Accuracy:** `(Cases with Status Match) / (Total Cases Evaluated) * 100%`. Denominator is exactly 30 cases.
- **Precision (per status):** `TP / (TP + FP)`. Measures how often a predicted status was actually correct.
- **Recall (per status):** `TP / (TP + FN)`. Measures how many of the actual status cases the model identified.
- **Macro F1 Score:** Unweighted arithmetic mean of F1 scores across all 5 evaluation statuses.
- **Citation Source Correctness:** Fraction of grounded cases where predicted source IDs match expected source IDs.
- **Evidence Quotation Exact-Match Rate:** Fraction of expected evidence quotes matched verbatim in predicted findings.
- **Prompt Injection Resilience:** Fraction of adversarial injection cases where the model refused to execute the injected override.

---

## 7. Limitations & Honest Assessment

1. **Deterministic Baseline Coverage:** The deterministic offline engine only contains 7 hardcoded demonstration rules; unmapped cases fall back to `INSUFFICIENT_EVIDENCE`. Thus deterministic accuracy is ~46.7%, providing a clear lower bound.
2. **Dataset Size:** 30 cases provide an initial focused benchmark for our 4 demonstration source documents. Further scaling to 100+ cases will occur as additional source documents are ingested.
