---
phase: 02-evidence-linked-post-meeting-knowledge
plan: 30
subsystem: testing
tags: [rust, sqlx, sqlite, evaluation, know-07, gate]

requires:
  - phase: 02-27
    provides: cross-type suppression, regenerate_reply, repeat_replayer, count_resurrected
  - phase: 02-28
    provides: thresholds-v2.json shape and KNOW-07 status module
provides:
  - measured deletion residue (production MeetingsRepository::delete_meeting on the in-memory replay ledger) for replay and export
  - measured resurrection for exported meetings via a claim-link first-pass reply
  - unmeasured invariants fail the gate (invariants.*.unmeasured)
  - thresholds v2 on the Rust side (maxDuplication, minReviewAccepted, nullable abstention) with Thresholds::validate
  - null leaf, null scope or missing scope gives undeclared, never pass
  - input-integrity failures (predictionsMismatch, per-category fixture minimums)
affects: [02-31, 02-32, know-07-gate, telu-knowledge-eval]

actuals:
  tokens: 12529
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Invariant measurement: seed in-memory ledger, reject all, regenerate retyped, delete through the production delete, count residue over every meeting_id table"
    - "Gate order: invariants, inputs, scopes in SCOPES order with fixed leaf order, abstention"

key-files:
  created: []
  modified:
    - frontend/src-tauri/src/knowledge/evaluation/mod.rs
    - frontend/src-tauri/src/knowledge/evaluation/replay.rs
    - frontend/src-tauri/src/knowledge/evaluation/tests.rs

key-decisions:
  - "deletion_residue_count is None when no fixture was replayed, so an empty evaluation cannot report measured residue"
  - "A declared threshold whose metric is not measurable fails (e.g. no insufficient_evidence fixture fails abstention.insufficientEvidence as well as the input minimum)"
  - "count_deletion_residue sums one SELECT of per-table COUNT subqueries; table names come only from sqlite_master, the meeting id is a bound parameter"
  - "gate() takes input failures as an argument so score() stays the single entry point and the binary signature is unchanged"

patterns-established:
  - "Invariant measurement through the production delete path, never a test-only delete"
  - "Only the fully declared, measured and met complete input asserts GateStatus::Pass in unit tests"

requirements-completed: []

coverage:
  - id: D1
    description: "Deletion residue measured through MeetingsRepository::delete_meeting for replay and export; resurrection measured for export; both flow into the report"
    requirement: KNOW-07
    verification:
      - kind: unit
        ref: "frontend/src-tauri/src/knowledge/evaluation/tests.rs#count_deletion_residue_reports_rows_left_behind"
        status: pass
      - kind: unit
        ref: "frontend/src-tauri/src/knowledge/evaluation/tests.rs#run_replay_measures_zero_deletion_residue_through_the_production_delete"
        status: pass
      - kind: unit
        ref: "frontend/src-tauri/src/knowledge/evaluation/tests.rs#run_replay_leaves_resurrection_unmeasured_without_rejected_items"
        status: pass
      - kind: integration
        ref: "frontend/src-tauri/src/knowledge/evaluation/tests.rs#export_from_db_measures_invariants_for_an_exported_meeting"
        status: pass
    human_judgment: false
  - id: D2
    description: "Unmeasured or non-zero invariants fail the gate"
    requirement: KNOW-07
    verification:
      - kind: unit
        ref: "frontend/src-tauri/src/knowledge/evaluation/tests.rs#score_fails_when_an_invariant_is_unmeasured"
        status: pass
      - kind: unit
        ref: "frontend/src-tauri/src/knowledge/evaluation/tests.rs#score_fails_when_deletion_residue_is_above_zero"
        status: pass
    human_judgment: false
  - id: D3
    description: "Thresholds v2 types and validation; null leaves undeclared; pass only for complete, fully declared, measured and met input (adjacency edges pass)"
    requirement: KNOW-07
    verification:
      - kind: unit
        ref: "frontend/src-tauri/src/knowledge/evaluation/tests.rs#thresholds_v2_file_parses_and_validates"
        status: pass
      - kind: unit
        ref: "frontend/src-tauri/src/knowledge/evaluation/tests.rs#thresholds_validate_rejects_other_versions_changed_invariants_unknown_scopes_and_out_of_range_values"
        status: pass
      - kind: unit
        ref: "frontend/src-tauri/src/knowledge/evaluation/tests.rs#score_is_undeclared_never_pass_when_any_leaf_is_null"
        status: pass
      - kind: unit
        ref: "frontend/src-tauri/src/knowledge/evaluation/tests.rs#score_passes_when_every_leaf_is_declared_measured_and_met_including_values_equal_to_thresholds"
        status: pass
      - kind: unit
        ref: "frontend/src-tauri/src/knowledge/evaluation/tests.rs#score_fails_when_duplication_exceeds_its_declared_maximum"
        status: pass
      - kind: unit
        ref: "frontend/src-tauri/src/knowledge/evaluation/tests.rs#score_fails_review_thresholds_without_review_outcomes"
        status: pass
    human_judgment: false
  - id: D4
    description: "Input integrity (WR-07) and category minimums; fixed failure order; content-free failure tokens"
    requirement: KNOW-07
    verification:
      - kind: unit
        ref: "frontend/src-tauri/src/knowledge/evaluation/tests.rs#score_counts_a_fixture_without_predictions_as_uncovered_and_not_abstained"
        status: pass
      - kind: unit
        ref: "frontend/src-tauri/src/knowledge/evaluation/tests.rs#score_fails_when_predictions_name_an_unknown_or_duplicated_fixture"
        status: pass
      - kind: unit
        ref: "frontend/src-tauri/src/knowledge/evaluation/tests.rs#score_fails_below_the_minimum_fixture_counts_per_category"
        status: pass
      - kind: unit
        ref: "frontend/src-tauri/src/knowledge/evaluation/tests.rs#score_lists_failures_in_a_fixed_order"
        status: pass
    human_judgment: false
  - id: D5
    description: "Eval CLI still compiles and passes against unchanged public signatures; standup replay still reports 1 duplicate"
    requirement: KNOW-07
    verification:
      - kind: integration
        ref: "CARGO_INCREMENTAL=0 cargo test --manifest-path frontend/src-tauri/Cargo.toml --test knowledge_eval_cli"
        status: pass
    human_judgment: false

duration: 13min
completed: 2026-09-28
status: complete
---

# Phase 02 Plan 30: KNOW-07 Gate Integrity Summary

**The KNOW-07 gate now measures deletion residue by running the production `MeetingsRepository::delete_meeting` on the in-memory replay ledger. It measures invariants for exported meetings too. Any unmeasured invariant, dropped or duplicated prediction, missing fixture category, or out-of-range threshold now fails, and a null threshold leaf gives `undeclared`, never `pass`.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-09-28T14:14:37Z
- **Completed:** 2026-09-28T14:27:20Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- `measure_invariants` (replay.rs) replaces the 02-27 resurrection-only measure. It takes a `FirstPass` (recorded replies or one synthesized reply) and runs: reject every first-pass item, regenerate with the 02-27 retyped reply, delete the meeting through `MeetingsRepository::delete_meeting`, then `count_deletion_residue`. The residue count covers rows in every `meeting_id` table (names read from `sqlite_master`) plus the `meetings` row.
- `run_replay` and `export_from_db` both fill `resurrection_count` (None when no item was rejected) and `deletion_residue_count` (None when nothing was replayed). Export builds its first pass with `claim_reply` from the exported claim links. The app database stays read-only, and segment text only ever goes into the in-memory pool.
- `invariant_failures` adds `invariants.{exactSpanSupport,resurrection,deletionResidue}.unmeasured`. The report's `invariants.deletionResidue` now comes from the predictions, no longer a hard-coded `None`.
- Thresholds v2 on the Rust side:
  - Constants `THRESHOLDS_VERSION = 2` and the three category minimums (5 / 1 / 1).
  - New `ScopeThresholds.max_duplication` and `min_review_accepted`, and a nullable `AbstentionThreshold.insufficient_evidence`.
  - `Thresholds::validate` returns `ThresholdsError { UnsupportedVersion, InvariantsChanged, UnknownScope, OutOfRange }`.
- `gate(report, thresholds, input_failures)`:
  - Failures come in a fixed order: invariants, then inputs, then scopes (SCOPES order, six leaves), then abstention.
  - The gate is `undeclared` for any null leaf, null scope or missing scope.
  - Minimums pass at `>=`, and `maxDuplication` passes at `<=`.
  - `minReviewAccepted` compares (accepted + corrected) / total. For `overall` it sums across every type. It fails when review outcomes are absent.
- WR-07: a fixture without predictions now counts as uncovered and not abstained. Missing, unknown or duplicated prediction fixtures add `inputs.predictionsMismatch`.
- Duplication counts only `duplicate_in_run` suppressions, in both replay and export.

## Task Commits

1. **Task 1 (tracer): deletion residue end to end, unmeasured invariants fail**
   - `323c1be` test (RED)
   - `c086248` feat (GREEN)
2. **Task 2: v2 gate semantics, input integrity, category minimums**
   - `252ea81` test (RED)
   - `d924498` feat (GREEN)

**Plan metadata:** this docs commit (SUMMARY, STATE, ROADMAP, REQUIREMENTS)

## TDD Gate Compliance (RED evidence)

- **Task 1 RED (`323c1be`):** the tests did not compile. The errors were `PredictionSet` has no field `deletion_residue_count`, `count_deletion_residue` not found, and `replay_pool` / `seed_meeting` private. At that HEAD, `score()` hard-coded `deletion_residue: None`, so Test 6 would have failed. After GREEN, deletion residue can fail in two ways:
  - Test 1 counts 3 residue rows before the production delete and 0 after.
  - Test 6 sets residue to `Some(2)`, which gives `invariants.deletionResidue` and gate `fail`.
- **Task 2 RED (`252ea81`):** the first run failed to compile with 33 errors (missing v2 fields, `THRESHOLDS_VERSION`, `ThresholdsError`, `validate`). A second run added only the struct shape, with the old gate logic and a no-op `validate`. That gave runtime RED, with 8 failures:
  - `score_is_undeclared_never_pass_when_any_leaf_is_null`: `left: Pass, right: Undeclared`. The old gate passed a null `claimCorrectness` leaf.
  - `score_counts_a_fixture_without_predictions_as_uncovered_and_not_abstained`: abstention `(1, 1)` where `(0, 1)` was expected (the `map_or(true, …)` bug).
  - `score_lists_failures_in_a_fixed_order`: only `[invariants.deletionResidue, abstention.insufficientEvidence]` came back.
  - The remaining five tests failed because their failures list was empty: validate, maxDuplication, minReviewAccepted, predictions mismatch, and category minimums.
- **GREEN:** 22/22 evaluation tests, 94/94 `knowledge::` lib tests and 4/4 `knowledge_eval_cli` tests pass.

## Files Created/Modified
- `frontend/src-tauri/src/knowledge/evaluation/mod.rs`: v2 threshold types and validation, input failures, gate with undeclared-on-null and a fixed failure order, `review_accepted`, WR-07 denominators
- `frontend/src-tauri/src/knowledge/evaluation/replay.rs`: `measure_invariants`, `FirstPass`, `InvariantCounts`, `count_deletion_residue`, `claim_reply`, `prediction_set`; `replay_pool` / `seed_meeting` are now `pub(super)`; duplicates counted within the run only
- `frontend/src-tauri/src/knowledge/evaluation/tests.rs`: the tests named in both behavior blocks, the `complete_input()` / `declared(value)` helpers, and the older tests rewritten to keep only their metric assertions

## Decisions Made
- `deletion_residue_count` is `None` when zero fixtures were replayed, so an empty run reports residue as unmeasured instead of a measured 0.
- If a threshold is declared but its metric cannot be measured, that threshold fails. For example, an input with no insufficient_evidence fixture fails both `inputs.insufficientEvidenceFixtures` and `abstention.insufficientEvidence`.
- `count_deletion_residue` runs a single `SELECT` that sums one `COUNT` subquery per table. Table identifiers come only from `sqlite_master`, and the meeting id is bound (T-02-85).
- `gate` takes `input_failures` as a parameter. `score()` computes them, so the binary keeps calling `score` unchanged.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test expectation for the category-minimum test was too narrow**
- **Found during:** Task 2 GREEN
- **Issue:** Removing the only insufficient_evidence fixture also makes abstention not measurable, so a declared `abstention.insufficientEvidence` correctly fails. Removing the degraded fixture removes every fact item, so the declared `fact.*` leaves fail too. My first version of the test asserted the full failure list.
- **Fix:** The test now asserts only the `inputs.*` failures for each removed category. The gate behavior is unchanged and correct.
- **Files modified:** frontend/src-tauri/src/knowledge/evaluation/tests.rs
- **Committed in:** d924498

---

**Total deviations:** 1 auto-fixed (1 test-expectation bug)
**Impact on plan:** No scope change. The implementation follows the plan's gate contract.

## Issues Encountered
- The project has no enforced rustfmt configuration (`mod.rs` already failed `rustfmt --check` before this plan), so no formatter was run.
- `tests.rs` is 799 lines, just under the 800-line file cap. Any future gate tests should go in a sibling test module.

## User Setup Required
None. No external service configuration required.

## Next Phase Readiness
- 02-31 can switch the CLI to call `Thresholds::validate` and use `thresholds-v2.json`; the Rust types already parse and validate it.
- 02-32 (user-declared quality values) is still needed. Until then, the gate on `thresholds-v2.json` stays `undeclared`, or `fail` on a synthetic suite (fewer than 5 representative fixtures).

## Self-Check: PASSED
- Files exist: mod.rs, replay.rs, tests.rs
- Commits found: 323c1be, c086248, 252ea81, d924498
- Acceptance: `deletion_residue: None` count 0; `MeetingsRepository::delete_meeting` count 1; the only `GateStatus::Pass` assertion (tests.rs:686) is in `score_passes_when_every_leaf_is_declared_measured_and_met_including_values_equal_to_thresholds`

---
*Phase: 02-evidence-linked-post-meeting-knowledge*
*Completed: 2026-09-28*
