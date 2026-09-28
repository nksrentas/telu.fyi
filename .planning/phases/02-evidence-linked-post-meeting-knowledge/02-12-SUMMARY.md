---
phase: 02-evidence-linked-post-meeting-knowledge
plan: 12
subsystem: knowledge
tags: [rust, matching, strsim, suppression, regenerate]

requires:
  - phase: 02-evidence-linked-post-meeting-knowledge
    provides: 02-05 review projection and revisions; 02-03 chunked extraction
provides:
  - Pure matcher with rejection-first priority (matcher.rs)
  - Append-only knowledge_suppressions and run suppressed/reconfirmed/duplicate counts
  - KnowledgeRepository::load_match_index over original and revision wording
  - Proven zero-resurrection invariant for rejected and corrected items
affects: [02-15, 02-18, 02-24]

actuals:
  tokens: 14000
  tasks: 2
  commits: 1

tech-stack:
  added: [strsim 0.11.1 as a normal dependency]
  patterns:
    - "In-run items join the match index as proposed, so later windows dedupe as duplicate_in_run"

key-files:
  created:
    - frontend/src-tauri/migrations/20260927000300_phase2_knowledge_suppressions.sql
    - frontend/src-tauri/src/knowledge/matcher.rs
    - frontend/src-tauri/src/knowledge/extraction_regenerate_tests.rs
  modified:
    - frontend/src-tauri/Cargo.toml
    - Cargo.lock
    - frontend/src-tauri/src/knowledge/extraction.rs
    - frontend/src-tauri/src/knowledge/repository.rs
    - frontend/src-tauri/src/knowledge/models.rs
    - frontend/src-tauri/src/knowledge/mod.rs
    - frontend/src-tauri/src/knowledge/test_support.rs

key-decisions:
  - "duplicate_count covers both duplicate_pending and duplicate_in_run; suppressed_count counts matched_rejected only"
  - "Item normalized_key now uses matcher::normalized_key (normalization plus edge-punctuation strip); the match index recomputes keys from original and revision text rather than trusting stored keys"
  - "The unused strsim 0.10.0 dev-dependency was removed: with the new 0.11.1 normal dependency both were passed to rustc as `strsim` (E0464)"

patterns-established:
  - "Test files for a module can live beside it via #[path = \"<module>_*_tests.rs\"] to keep the module under 800 lines while staying under the module's test path"

requirements-completed: [KNOW-05, KNOW-01]

coverage:
  - id: D1
    description: "Matcher: exact keys, superseded revision wording, similarity only with shared evidence, type isolation, rejected-first priority, key normalization"
    requirement: KNOW-05
    verification:
      - kind: unit
        ref: "frontend/src-tauri/src/knowledge/matcher.rs#tests"
        status: pass
  - id: D2
    description: "Zero resurrection: regenerate after accept/reject/correct yields one new item, matched_rejected for the rejected item, reconfirmed for accepted and superseded wording"
    requirement: KNOW-05
    verification:
      - kind: unit
        ref: "frontend/src-tauri/src/knowledge/extraction_regenerate_tests.rs"
        status: pass

duration: 30min
completed: 2026-09-28
---

# Phase 2 Plan 12: Regenerate matching Summary

**Regeneration now matches every candidate against the meeting's reviewed items first, so rejected or corrected wording can never come back as a new suggestion, and every suppression is recorded.**

## Accomplishments

- `matcher.rs`: `normalized_key`, `match_candidate` with state priority rejected > accepted > proposed (then item id), exact key match or shared claim evidence plus `normalized_levenshtein ≥ 0.6`.
- Migration `20260927000300_phase2_knowledge_suppressions.sql`: insert-only `knowledge_suppressions` (reason, candidate key and text) and `knowledge_runs.duplicate_count`.
- `load_match_index` returns each item's projected state, keys for its original text and every revision, and its claim evidence ids.
- Extraction places each verified candidate through the matcher; suppressions persist in the run's finalization transaction with the new counts.

## Task Commits

1. **Tasks 1 and 2** — `e37e2d2` (feat)

## Verification

- `cargo test --manifest-path frontend/src-tauri/Cargo.toml knowledge:: --lib` → 56 passed (6 matcher, 5 regenerate, all earlier knowledge tests)
- Acceptance greps: `strsim = "0.11.1"`, `MATCH_SIMILARITY_THRESHOLD` and `normalized_levenshtein` in matcher.rs, `match_candidate` in extraction.rs, `CREATE TABLE knowledge_suppressions` and `ADD COLUMN duplicate_count` in the migration, no cascade.

## Deviations from Plan

1. **[Rule 3 - Blocking] Removed the strsim 0.10.0 dev-dependency** — it collided with the new normal dependency (E0464, two `--extern strsim`); nothing in the crate used it.
2. **[Size rule] Regenerate tests in `extraction_regenerate_tests.rs`** included via `#[path]` so they run under `knowledge::extraction`.
3. **[Process] One commit for both tasks.**

## Issues Encountered

The E0464 collision above. Executed inline by the orchestrator.

## Next Phase Readiness

- 02-18 can score duplication and suppression from `knowledge_suppressions` and run counts.
- 02-15/02-24 can show "Suppressed n · reconfirmed n" from `KnowledgeRunView` (`duplicateCount` added).

## Self-Check: PASSED

- matcher.rs, the migration and the test file exist; commit `e37e2d2` is on `codex/phase-01-baseline`.
