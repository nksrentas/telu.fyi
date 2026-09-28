---
phase: 02-evidence-linked-post-meeting-knowledge
plan: 20
subsystem: evaluation
tags: [know-07, thresholds, evaluation, status]

requires:
  - phase: 02-evidence-linked-post-meeting-knowledge
    provides: 02-18 telu-knowledge-eval CLI, fixtures and gating
provides:
  - thresholds-v1.json (invariants fixed, quality undeclared by the user's choice)
  - pilot and synthetic content-free reports
  - Derived KNOW-07 status file and its contract test
affects: []

actuals:
  tokens: 20000
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "KNOW-07 status is derived from thresholds-v1 and eval/representative-report.json by .github/verify-phase2-know07-status.test.cjs; the committed status must equal the derived one"

key-files:
  created:
    - frontend/src-tauri/tests/fixtures/knowledge-eval/thresholds-v1.json
    - .planning/phases/02-evidence-linked-post-meeting-knowledge/eval/pilot-report.json
    - .planning/phases/02-evidence-linked-post-meeting-knowledge/eval/synthetic-report.json
    - .planning/phases/02-evidence-linked-post-meeting-knowledge/eval/know-07-status.json
    - .github/verify-phase2-know07-status.test.cjs
  modified: []

key-decisions:
  - "User decision at the checkpoint: option-b, pilot first — every quality threshold (including abstention) is null in thresholds-v1"
  - "Undeclared abstention is written as quality.abstention null (the Thresholds type requires a number inside the object)"
  - "A representative report with any string longer than 80 characters is treated as not content-free and counts as pending"

patterns-established: []

requirements-completed: []

coverage:
  - id: D1
    description: "Thresholds committed alone before scoring; synthetic report tied to the thresholds hash and commit; derived status open"
    requirement: KNOW-07
    verification:
      - kind: integration
        ref: "node --test .github/verify-phase2-know07-status.test.cjs (4 pass); hash check node script passes"
        status: pass
      - kind: manual
        ref: "Representative-meeting evaluation with labeled gold data and declared thresholds"
        status: pending

duration: 30min
completed: 2026-09-28
---

# Phase 2 Plan 20: KNOW-07 thresholds and status Summary

**Thresholds v1 are committed with the fixed invariants and, by your choice, no quality values yet; KNOW-07 is recorded as open, not passed, until labeled representative meetings are scored against declared thresholds.**

## Results

- Thresholds file: `frontend/src-tauri/tests/fixtures/knowledge-eval/thresholds-v1.json`, sha256 `6af4ebe924cb0e57c3b2fe987fd0ad7d1acff152b1c0ad18f7b92f9b0c515f50`, committed alone in `61f30f7` (`test(02-20): declare KNOW-07 thresholds v1`).
- Pilot report (undeclared thresholds, orientation only): overall claim correctness 1.0 (6/6), semantic support 0.83 (5/6; fact 0/1), exact span 1.0, evidence coverage 1.0, attribution 1.0 where measurable, duplication 0.17, abstention on the insufficient-evidence fixture 1/1, resurrection 0. Synthetic fixtures are not representative meetings.
- Synthetic report against thresholds-v1: gate `undeclared`, git commit `61f30f7`.
- `eval/know-07-status.json`: `open` with `quality_thresholds_undeclared` and `representative_evaluation_pending`.

**KNOW-07 is not satisfied.** REQUIREMENTS.md keeps it Pending, the phase verification must report it as open, and Phase 3 stays blocked until the status file reads `satisfied`.

## Task Commits

1. **Task 1 (pilot report)** — `17019e4` (test)
2. **Task 2 (decision)** — option-b chosen by the user
3. **Task 3** — `61f30f7` (thresholds) and `8d0b0e3` (synthetic report, status, contract test)

## Human Check Pending

- With consent, run extraction on at least five representative meetings plus one insufficient-evidence and one degraded-capture meeting; `telu-knowledge-eval export`; write gold items and labels outside the repo; declare the quality values in thresholds-v1.json in a commit of its own before any scoring; score with `--db`; copy only the content-free report to `eval/representative-report.json`; update `know-07-status.json` to the derived value and rerun the contract test.

## Deviations from Plan

- None beyond the null abstention encoding above.

## Self-Check: PASSED

- Commits `17019e4`, `61f30f7` and `8d0b0e3` are on `codex/phase-01-baseline`.
