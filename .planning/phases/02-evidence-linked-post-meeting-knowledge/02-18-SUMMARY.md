---
phase: 02-evidence-linked-post-meeting-knowledge
plan: 18
subsystem: evaluation
tags: [rust, cli, clap, evaluation, know-07]

requires:
  - phase: 02-evidence-linked-post-meeting-knowledge
    provides: 02-03 extraction pipeline, 02-05 reviews, 02-12 matcher and suppressions
provides:
  - telu-knowledge-eval CLI with score, run (replay) and export subcommands
  - Per-type KNOW-07 metrics with not_measurable handling and pass/fail/undeclared gating
  - Shared pure extract_from_segments pipeline used by the app and the CLI
  - Resurrection measured by a reject-all then regenerate replay on an in-memory ledger
  - Synthetic fixtures (representative, insufficient_evidence, degraded_capture), labels, completions and test thresholds
affects: [02-20]

actuals:
  tokens: 30000
  tasks: 2
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Reports carry ids, counts, ratios and hashes only; a CLI test asserts no fixture segment or gold text appears"
    - "A declared threshold with a not_measurable metric fails the gate (no pass without evidence); a null threshold makes the gate undeclared"

key-files:
  created:
    - frontend/src-tauri/src/knowledge/evaluation/mod.rs
    - frontend/src-tauri/src/knowledge/evaluation/replay.rs
    - frontend/src-tauri/src/knowledge/evaluation/tests.rs
    - frontend/src-tauri/src/bin/telu-knowledge-eval.rs
    - frontend/src-tauri/tests/knowledge_eval_cli.rs
    - frontend/src-tauri/tests/fixtures/knowledge-eval/representative-standup.json
    - frontend/src-tauri/tests/fixtures/knowledge-eval/insufficient-evidence.json
    - frontend/src-tauri/tests/fixtures/knowledge-eval/degraded-capture.json
    - frontend/src-tauri/tests/fixtures/knowledge-eval/completions-sample.json
    - frontend/src-tauri/tests/fixtures/knowledge-eval/labels-sample.json
    - frontend/src-tauri/tests/fixtures/knowledge-eval/thresholds-test.json
  modified:
    - frontend/src-tauri/src/knowledge/extraction.rs
    - frontend/src-tauri/src/knowledge/mod.rs

key-decisions:
  - "Gold fixtures in a directory are recognized by a top-level fixtureId; other JSON files (labels, completions, thresholds) are ignored by the loader"
  - "Replay predictions get deterministic ids '<fixtureId>#<n>' in extraction order so committed labels can target them"
  - "Abstention on insufficient_evidence fixtures counts runs with zero shown items or with only unresolved owner/due fields, as RESEARCH Pattern 9 defines it"
  - "Deletion residue is reported as not measured by the CLI; 02-17's zero-residue test owns that invariant"
  - "Review outcome rates (--db) split accepted into accepted-as-is and corrected, plus rejected and pending, per item type"

patterns-established:
  - "Evaluation error codes: INPUT_NOT_FOUND, INPUT_UNSAFE, INPUT_TOO_LARGE, JSON_MALFORMED, OUTPUT_FAILED, INVALID_MEETING_ID, INVALID_FIXTURE, STORAGE_FAILED"

requirements-completed: []

coverage:
  - id: D1
    description: "Hand-computed per-type metrics in fixed order; exact-span invariant; adjacent evidence excluded; equal-to-threshold passes; not_measurable and undeclared gating"
    requirement: KNOW-07
    verification:
      - kind: unit
        ref: "frontend/src-tauri/src/knowledge/evaluation/tests.rs"
        status: pass
  - id: D2
    description: "score writes a content-free report with thresholdsSha256 and gate; inputs over 32 MiB fail with INPUT_TOO_LARGE; run replays with resurrection 0; export reads one meeting and rejects non-UUID ids"
    requirement: KNOW-07
    verification:
      - kind: integration
        ref: "frontend/src-tauri/tests/knowledge_eval_cli.rs"
        status: pass

duration: 70min
completed: 2026-09-28
---

# Phase 2 Plan 18: Knowledge evaluation harness Summary

**Maintainers can now score replayed or exported extraction runs offline with the exact production pipeline, per item type, against a hashed thresholds file, with a measured resurrection invariant and content-free reports.**

## Accomplishments

- `evaluation/mod.rs`: fixture, prediction, label, threshold and report types; claim correctness and semantic support kept separate; exact-span support re-slices every claim link; grounding, coverage (exact gold evidence ids only), attribution, duplication, abstention and degraded-capture metrics; `gate` → pass / fail / undeclared with named failures.
- `evaluation/replay.rs`: `run_replay` (replayed completions through `extract_from_segments`, then reject-all and regenerate on an in-memory migrated ledger to count resurrection), `export_from_db` (read-only), `review_outcomes`.
- `src/bin/telu-knowledge-eval.rs`: clap `Score`, `Run`, `Export`; 32 MiB cap, symlink refusal, canonicalized inputs, atomic writes to the explicit `--out` directory, content-free stdout.
- `extraction.rs`: `pub async fn extract_from_segments` is the shared pure pipeline; `run_extraction` delegates to it.

## Task Commits

1. **Tasks 1 and 2** — `5cdb8db` (feat)

## Verification

- `cargo test --manifest-path frontend/src-tauri/Cargo.toml knowledge:: --lib` → 61 passed (4 evaluation, 1 pure-vs-persisted extraction)
- `cargo test --manifest-path frontend/src-tauri/Cargo.toml --test knowledge_eval_cli` → 4 passed
- Acceptance greps: `MAX_INPUT_BYTES` and `Score` in the CLI; `not_measurable` (serde of `NotMeasurable`) and `thresholds_sha256` in evaluation; `pub async fn extract_from_segments` called by `run_extraction`; no `generate_summary` or `reqwest` in the evaluation module or the CLI.

## Deviations from Plan

1. **[Size rule] `evaluation.rs` became `evaluation/{mod,replay,tests}.rs`** to keep each file under 800 lines; the module path `knowledge::evaluation` is unchanged.
2. **[Process] One commit for both tasks.**

## Issues Encountered

None. Executed inline by the orchestrator.

## Next Phase Readiness

- 02-20 declares the real thresholds in `thresholds-v1.json` (user decision) and scores the synthetic suite; KNOW-07 stays open until a representative-meeting evaluation passes.

## Self-Check: PASSED

- All created files exist; commit `5cdb8db` is on `codex/phase-01-baseline`.
