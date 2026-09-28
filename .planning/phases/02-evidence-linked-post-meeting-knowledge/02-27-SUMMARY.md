---
phase: 02-evidence-linked-post-meeting-knowledge
plan: 27
subsystem: knowledge
tags: [rust, sqlx, matcher, regenerate, eval, strsim, gap-closure]

requires:
  - phase: 02-evidence-linked-post-meeting-knowledge
    provides: matcher.rs match_candidate, load_match_index, regenerate pipeline (02-12), eval replay harness
provides:
  - Type-agnostic suppression of rejected items on Regenerate (matched_rejected under any model-assigned type)
  - Type-agnostic matching of corrected-away wording (ExistingItem.superseded_keys)
  - Same-type dedupe preserved for current wording of accepted and proposed items
  - Non-tautological KNOW-07 resurrection measure (re-typed, re-cased second pass, type-ignored count)
affects: [phase-03-preparation, list_eligible_items consumers, knowledge-eval gate]

actuals:
  tokens: 5872
  tasks: 2
  commits: 5

tech-stack:
  added: []
  patterns:
    - "Candidacy by state: rejected items match on all keys regardless of type; same-type items on all keys; other-type non-rejected items on superseded_keys only"
    - "Eval replay second pass built with serde_json::json! from first-pass items, served to every window by repeat_replayer"

key-files:
  created: []
  modified:
    - frontend/src-tauri/src/knowledge/matcher.rs
    - frontend/src-tauri/src/knowledge/repository.rs
    - frontend/src-tauri/src/knowledge/extraction.rs
    - frontend/src-tauri/src/knowledge/extraction_regenerate_tests.rs
    - frontend/src-tauri/src/knowledge/evaluation/replay.rs
    - frontend/src-tauri/src/knowledge/evaluation/tests.rs

key-decisions:
  - "Rejection identity is wording or shared-evidence similarity, not (type, wording); type stays a match key only for reconfirmed/duplicate outcomes on current wording (D-11 2026-09-28 amendment)"
  - "Shared-evidence similarity applies unchanged to superseded_keys, so a different-type candidate similar to corrected-away wording on shared evidence is reconfirmed rather than proposed (accepted false-suppression bias, T-02-76)"

patterns-established:
  - "comparable_keys(candidate, item) chooses the key slice; is_match applies exact and shared-evidence similarity rules to that slice"
  - "load_match_index keys are de-duplicated with current wording first; superseded_keys = keys minus current"

requirements-completed: [KNOW-05, KNOW-07]

coverage:
  - id: D1
    description: "A rejected item re-emitted on Regenerate under any other type is suppressed as matched_rejected, creates no item, and never reaches meeting_view items or list_eligible_items"
    requirement: KNOW-05
    verification:
      - kind: integration
        ref: "frontend/src-tauri/src/knowledge/extraction_regenerate_tests.rs#knowledge_regenerate_never_resurrects_a_rejected_item_under_another_type"
        status: pass
      - kind: integration
        ref: "frontend/src-tauri/src/knowledge/extraction_regenerate_tests.rs#knowledge_regenerate_suppresses_a_rejected_item_under_every_other_type"
        status: pass
      - kind: unit
        ref: "frontend/src-tauri/src/knowledge/matcher.rs#match_candidate_suppresses_a_rejected_item_under_any_type"
        status: pass
    human_judgment: false
  - id: D2
    description: "Corrected-away wording is matched regardless of type; current wording keeps same-type dedupe"
    requirement: KNOW-05
    verification:
      - kind: unit
        ref: "frontend/src-tauri/src/knowledge/matcher.rs#match_candidate_matches_corrected_away_wording_under_any_type"
        status: pass
      - kind: unit
        ref: "frontend/src-tauri/src/knowledge/matcher.rs#match_candidate_keeps_type_for_current_wording_of_accepted_and_proposed_items"
        status: pass
      - kind: integration
        ref: "frontend/src-tauri/src/knowledge/extraction_regenerate_tests.rs#knowledge_regenerate_never_resurrects_corrected_away_wording_under_another_type"
        status: pass
      - kind: integration
        ref: "frontend/src-tauri/src/knowledge/extraction_regenerate_tests.rs#load_match_index_separates_current_from_corrected_away_wording"
        status: pass
    human_judgment: false
  - id: D3
    description: "KNOW-07 resurrection measure can fail: it re-types and re-cases every rejected item and counts any-type key matches (red 3 before fix, 0 after)"
    requirement: KNOW-07
    verification:
      - kind: unit
        ref: "frontend/src-tauri/src/knowledge/evaluation/tests.rs#count_resurrected_counts_a_rejected_key_under_any_type"
        status: pass
      - kind: integration
        ref: "frontend/src-tauri/src/knowledge/evaluation/tests.rs#run_replay_reports_zero_resurrection_when_rejected_items_return_under_other_types"
        status: pass
      - kind: integration
        ref: "cargo test --manifest-path frontend/src-tauri/Cargo.toml --test knowledge_eval_cli"
        status: pass
    human_judgment: false

duration: 11min
completed: 2026-09-28
status: complete
---

# Phase 2 Plan 27: Cross-Type Rejected-Item Suppression and Non-Tautological Resurrection Measure Summary

**Regenerate now suppresses a rejected claim, or wording the user corrected away, whatever type the model assigns it, and the KNOW-07 replay measure re-types rejected items so it reports 3 resurrections against the old matcher and 0 after the fix.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-09-28T13:30:39Z
- **Completed:** 2026-09-28T13:42:06Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- `match_candidate` considers a rejected item of any type (review CR-02, verification gap 1). Re-emitting "Cancel the offsite" as a commitment, question or fact now gives `matched_rejected` with zero new proposed items.
- `ExistingItem.superseded_keys` separates the current wording from wording the user corrected away. A different-type candidate is matched only against corrected-away wording. The reconfirmed and duplicate outcomes on current wording stay same-type, per the D-11 amendment.
- `load_match_index` reads the current text from `knowledge_item_current`. It returns de-duplicated keys with the current key first, and `superseded_keys` = keys minus the current key.
- The eval replay's resurrection measure is no longer tautological (review WR-06, verification gap 3). The second pass re-emits every rejected first-pass item under its own type and under a rotated type, with uppercased text and a trailing period. `count_resurrected` counts matching normalized keys with type ignored.

## TDD Evidence (RED before GREEN)

**Task 1 RED (commit `0db6878`, before the matcher fix):**
- `knowledge_regenerate_never_resurrects_a_rejected_item_under_another_type`: counts were `proposed: 1, suppressed: 0` (expected `proposed: 0, suppressed: 1`).
- `knowledge_regenerate_suppresses_a_rejected_item_under_every_other_type`: `(proposed, suppressed) = (3, 0)` (expected `(0, 3)`).
- `run_replay_reports_zero_resurrection_when_rejected_items_return_under_other_types`: **resurrection_count = Some(3)** against the pre-fix matcher (expected Some(0)). The measure is non-zero before the fix.

**Task 1 GREEN (commit `2779ca6`):** all 5 regenerate tests, 6 evaluation tests and 6 matcher tests pass. Test 4 now reports **resurrection_count = Some(0)**.

**Task 2 RED (commit `094bad7`, with `superseded_keys` added as always-empty scaffolding so the tests compile):**
- `match_candidate_matches_corrected_away_wording_under_any_type`: got `New`, expected `Reconfirmed("a")`.
- `knowledge_regenerate_never_resurrects_corrected_away_wording_under_another_type`: `(proposed, reconfirmed) = (1, 0)`, expected `(0, 1)`.
- `load_match_index_separates_current_from_corrected_away_wording`: keys were `["hire two engineers", "hire three engineers"]` (original first), expected current first.
- `match_candidate_keeps_type_for_current_wording_of_accepted_and_proposed_items` passed in RED. That is intended, because it guards behaviour that must be preserved.

**Task 2 GREEN (commit `9bd9f6f`):** `knowledge::` suite 69 passed, 0 failed.

## Task Commits

1. **Task 1: Tracer (rejected item under another type, plus the resurrection measure)**
   - `0db6878` test(02-27): add failing cross-type resurrection tests and non-tautological replay measure
   - `2779ca6` fix(02-27): suppress rejected items regardless of model-assigned type
2. **Task 2: Corrected-away wording under any type, same-type dedupe for current wording**
   - `094bad7` test(02-27): add failing tests for corrected-away wording under another type
   - `9bd9f6f` fix(02-27): match corrected-away wording under any type, keep same-type dedupe for current wording

Tracer feedback gate: auto mode was active. The tracer `<verify>` commands were re-run end-to-end after `2779ca6` and all passed, so work continued to Task 2.

## Files Created/Modified

- `frontend/src-tauri/src/knowledge/matcher.rs`: adds `superseded_keys`, `comparable_keys`, and an `is_match` that takes a key slice. Replaces `match_candidate_never_matches_another_type` with three new unit tests.
- `frontend/src-tauri/src/knowledge/repository.rs`: `load_match_index` selects `c.text` and `i.text`. A new `match_keys` helper splits the current key from the superseded keys.
- `frontend/src-tauri/src/knowledge/extraction.rs`: the in-run index entry for a new item gets an empty `superseded_keys`.
- `frontend/src-tauri/src/knowledge/extraction_regenerate_tests.rs`: adds the `typed_candidate` and `items_of_run` helpers and 4 new tests.
- `frontend/src-tauri/src/knowledge/evaluation/replay.rs`: adds `regenerate_reply`, `claim_evidence`, `rotate_type`, `repeat_replayer`, `reject_all`, `texts` and `pub(super) count_resurrected`. `replay_run` now takes a completion closure.
- `frontend/src-tauri/src/knowledge/evaluation/tests.rs`: adds `count_resurrected_counts_a_rejected_key_under_any_type` and `run_replay_reports_zero_resurrection_when_rejected_items_return_under_other_types`.

## Decisions Made

- Rejection identity no longer includes type. This follows the D-11 2026-09-28 amendment and the assumption-delta promote decision. Restore is still the only way back for a rejected item. No migration, suppression reason or `list_eligible_items` rule changed.
- As the plan specifies, the exact-key and shared-evidence similarity rules apply unchanged to whichever key slice is chosen. One consequence: a different-type candidate that shares claim evidence with a corrected item, and is at least 0.6 similar to its corrected-away wording, is reconfirmed rather than proposed. This can happen even when the candidate's text equals the current wording, as with "Hire three engineers" on S3. It falls under the accepted false-suppression bias in T-02-76. The suppression row is recorded and nothing is lost.

## Deviations from Plan

None - plan executed exactly as written. The `superseded_keys` field was added in the Task 2 RED commit as empty compile scaffolding, so Tests 1 and 3 could be observed failing on behaviour instead of on a compile error.

## Issues Encountered

None. The pre-existing uncommitted edits to `build/ffmpeg.rs` and `recording_commands.rs` compiled cleanly and were never staged.

## Verification

- `cargo test --manifest-path frontend/src-tauri/Cargo.toml knowledge:: --lib`: 69 passed, 0 failed
- `cargo test ... knowledge_regenerate --lib`: 5 passed
- `cargo test ... knowledge::evaluation --lib`: 6 passed
- `cargo test ... knowledge::matcher --lib`: 8 passed after Task 2
- `cargo test ... --test knowledge_eval_cli`: 4 passed (the CLI replay reports resurrectionCount 0 under the new, non-tautological measure)
- `cargo test ... --test knowledge_deletion`: 3 passed
- `grep -c "fn match_candidate_never_matches_another_type" matcher.rs` = 0. `grep -c "old.item_type == item.item_type" replay.rs` = 0. `superseded_keys` count: repository.rs 4, matcher.rs 4.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Verification gaps 1 (KNOW-05/SC3) and 3 (the resurrection half of KNOW-07) are closed at the matcher and replay levels. The deletion-residue half of WR-06 is not in this plan's scope.
- Phase 3 can keep reading `list_eligible_items` unchanged. A rejected item re-emitted under another type never becomes eligible.

## Self-Check: PASSED

- All 6 modified files exist on disk.
- Commits 0db6878, 2779ca6, 094bad7 and 9bd9f6f are present in `git log`.
- All acceptance criteria for Task 1 and Task 2 were re-run and pass.

---
*Phase: 02-evidence-linked-post-meeting-knowledge*
*Completed: 2026-09-28*
