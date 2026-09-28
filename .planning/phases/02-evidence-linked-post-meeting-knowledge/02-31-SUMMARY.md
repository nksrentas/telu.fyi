---
phase: 02-evidence-linked-post-meeting-knowledge
plan: 31
subsystem: testing
tags: [rust, clap, serde, sqlx, sqlite, knowledge-eval, know-07]

requires:
  - phase: 02-30
    provides: Thresholds v2 types, Thresholds::validate, measured deletion residue, input-integrity failures
  - phase: 02-28
    provides: KNOW-07 status module (.github/verify-phase2-know07-status.cjs) and all-null thresholds-v2.json
provides:
  - telu-knowledge-eval score accepts only a v2 thresholds file that parses with no unknown keys and passes Thresholds::validate (THRESHOLDS_INVALID otherwise)
  - strict gold-dir loading (FIXTURE_INVALID for any non-fixture JSON or repeated fixtureId, NO_FIXTURES for an empty dir)
  - replay::review_outcomes(db_path, meeting_ids) scoped to the scored meetings with bound placeholders
  - synthetic fixtures in tests/fixtures/knowledge-eval/gold/, separate from sidecar files
  - eval/synthetic-report.json re-scored and bound to thresholds-v2.json
affects: [02-33 representative evaluation, KNOW-07 status, verify-phase2-know07-status]

actuals:
  tokens: 5346
  tasks: 3
  commits: 7

tech-stack:
  added: []
  patterns:
    - "Eval CLI inputs fail closed with typed error codes; nothing in a gold dir is silently skipped"
    - "Dynamic IN lists are built from the id count as ? placeholders and filled with bind()"

key-files:
  created:
    - frontend/src-tauri/tests/fixtures/knowledge-eval/gold/representative-standup.json
    - frontend/src-tauri/tests/fixtures/knowledge-eval/gold/insufficient-evidence.json
    - frontend/src-tauri/tests/fixtures/knowledge-eval/gold/degraded-capture.json
  modified:
    - frontend/src-tauri/src/bin/telu-knowledge-eval.rs
    - frontend/src-tauri/src/knowledge/evaluation/mod.rs
    - frontend/src-tauri/src/knowledge/evaluation/replay.rs
    - frontend/src-tauri/tests/knowledge_eval_cli.rs
    - frontend/src-tauri/tests/fixtures/knowledge-eval/thresholds-test.json
    - .planning/phases/02-evidence-linked-post-meeting-knowledge/eval/synthetic-report.json

key-decisions:
  - "Thresholds parse and validation failures both map to THRESHOLDS_INVALID; unknown scope keys are caught by validate (the flattened QualityThresholds map cannot use deny_unknown_fields), unknown metric keys by deny_unknown_fields on ScopeThresholds"
  - "An empty gold fixture file maps to FIXTURE_INVALID; size-cap, symlink and not-found errors keep their existing INPUT_* codes"
  - "The synthetic re-score used the binary built by the cargo test run (target/debug/telu-knowledge-eval) instead of cargo run, to keep every cargo invocation in the cargo test --manifest-path form"

patterns-established:
  - "Gold directories hold only GoldFixture JSON; sidecars (completions, labels, thresholds) live beside, not inside"

requirements-completed: [KNOW-07]

coverage:
  - id: D1
    description: "score refuses thresholds-v1.json, a misspelled scope key and a misspelled metric key with THRESHOLDS_INVALID"
    requirement: KNOW-07
    verification:
      - kind: integration
        ref: "frontend/src-tauri/tests/knowledge_eval_cli.rs#score_rejects_a_thresholds_file_that_is_not_v2"
        status: pass
    human_judgment: false
  - id: D2
    description: "A gold dir with a non-fixture JSON or a repeated fixtureId stops with FIXTURE_INVALID; an empty dir stops with NO_FIXTURES"
    requirement: KNOW-07
    verification:
      - kind: integration
        ref: "frontend/src-tauri/tests/knowledge_eval_cli.rs#score_rejects_a_gold_dir_that_is_not_only_fixtures"
        status: pass
    human_judgment: false
  - id: D3
    description: "score --db counts review outcomes only for the scored meetings and rejects non-UUID fixture ids with INVALID_MEETING_ID; export predictions carry measured resurrection and deletion residue of 0"
    requirement: KNOW-07
    verification:
      - kind: integration
        ref: "frontend/src-tauri/tests/knowledge_eval_cli.rs#score_with_db_counts_review_outcomes_only_for_the_scored_meetings"
        status: pass
      - kind: integration
        ref: "frontend/src-tauri/tests/knowledge_eval_cli.rs#export_reads_one_meeting_from_the_app_database_and_rejects_bad_ids"
        status: pass
    human_judgment: false
  - id: D4
    description: "eval/synthetic-report.json bound to thresholds-v2.json with measured invariants, gate fail on inputs.representativeFixtures, content-free; KNOW-07 status stays open"
    requirement: KNOW-07
    verification:
      - kind: other
        ref: "plan 02-31 Task 3 node check on synthetic-report.json"
        status: pass
      - kind: unit
        ref: "node --test .github/verify-phase2-know07-status.test.cjs"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-09-28
status: complete
---

# Phase 02 Plan 31: Strict KNOW-07 eval CLI inputs Summary

**telu-knowledge-eval now fails closed on non-v2 thresholds (THRESHOLDS_INVALID), mixed or empty gold dirs (FIXTURE_INVALID / NO_FIXTURES), and counts review outcomes only for the scored meeting UUIDs; the synthetic report is re-scored against thresholds-v2 with every invariant measured and a truthful fail gate.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-09-28T14:55:00Z
- **Completed:** 2026-09-28T15:10:17Z
- **Tasks:** 3
- **Files modified:** 9 (3 of them git renames)

## Accomplishments

- `score` parses thresholds into the v2 `Thresholds` type (`deny_unknown_fields` on `Thresholds`, `InvariantThresholds`, `ScopeThresholds`, `AbstentionThreshold`) and runs `Thresholds::validate()`; any failure is `THRESHOLDS_INVALID`.
- `load_fixtures` deserializes every `.json` in the gold dir as a `GoldFixture`, rejects repeated fixture ids, and refuses an empty dir; the three synthetic fixtures moved to `tests/fixtures/knowledge-eval/gold/`.
- `replay::review_outcomes(db_path, meeting_ids)` validates UUIDs and filters `knowledge_item_current` by `meeting_id IN (?, ...)` with bound parameters; `score --db` passes the loaded fixture ids.
- `eval/synthetic-report.json` re-scored at commit 61222ff:
  - `thresholdsSha256` = `aa1261fae592fb70282e68cdd02192191c1f8ef0c9d3d9541c47764c0693ae79` (sha256 of thresholds-v2.json)
  - invariants: exactSpanSupport 1 (measured, 6/6), resurrection 0, deletionResidue 0
  - gate: **fail**, failures: `["inputs.representativeFixtures"]`
  - This is a synthetic suite with one representative fixture. It is not a representative evaluation and is not an input to the KNOW-07 status. `node .github/verify-phase2-know07-status.cjs` still prints `open` with `quality_thresholds_undeclared` and `representative_evaluation_pending`, which matches the committed `know-07-status.json`.

## TDD Evidence

- **Task 1 RED (4471aac):** `score_rejects_a_thresholds_file_that_is_not_v2` failed with "thresholds candidate 0 was accepted" (v1 file produced a report); 4 passed, 1 failed.
- **Task 1 GREEN (3639538):** 5/5 CLI tests pass; `knowledge::evaluation` lib tests 22/22 pass.
- **Task 2 RED (c98a233):** `score_rejects_a_gold_dir_that_is_not_only_fixtures` failed at the mixed-dir assertion (labels-sample.json was skipped and score exited 0); 5 passed, 1 failed.
- **Task 2 GREEN (e1e4fbb):** 6/6 CLI tests pass.
- **Task 3 RED (dee04aa):** `score_with_db_counts_review_outcomes_only_for_the_scored_meetings` failed with `left: 2, right: 1` (the unrelated meeting was counted); 6 passed, 1 failed. The new export assertions (`resurrectionCount` 0, `deletionResidueCount` 0) passed already because 02-30 measures them; they stay as regression guards.
- **Task 3 GREEN (61222ff):** 7/7 CLI tests pass; lib evaluation tests 22/22 pass.
- **Tracer gate (Task 1):** auto mode active; the tracer verify commands were re-run end to end and passed before expansion.

## Task Commits

1. **Task 1: score refuses any thresholds file that is not a valid v2 file**: `4471aac` (test), `3639538` (feat)
2. **Task 2: gold directory holds only fixtures**: `c98a233` (test, includes the `git mv` of the fixtures), `e1e4fbb` (feat)
3. **Task 3: review outcomes scoped, measured export invariants, synthetic re-score**: `dee04aa` (test), `61222ff` (feat), `ffa8b28` (chore, synthetic report)

## Files Created/Modified

- `frontend/src-tauri/src/bin/telu-knowledge-eval.rs`: THRESHOLDS_INVALID, FIXTURE_INVALID, NO_FIXTURES; `parse_thresholds`, `load_fixture`, `scored_review_outcomes`
- `frontend/src-tauri/src/knowledge/evaluation/mod.rs`: `deny_unknown_fields` on the four threshold structs
- `frontend/src-tauri/src/knowledge/evaluation/replay.rs`: `review_outcomes(db_path, meeting_ids)` plus `review_rows` with bound placeholders
- `frontend/src-tauri/tests/knowledge_eval_cli.rs`: three new CLI tests, export invariant assertions, gold-dir helpers
- `frontend/src-tauri/tests/fixtures/knowledge-eval/thresholds-test.json`: v2 shape, keys version/invariants/quality only, all quality values 0.5
- `frontend/src-tauri/tests/fixtures/knowledge-eval/gold/*.json`: moved synthetic fixtures (unchanged content)
- `.planning/phases/02-evidence-linked-post-meeting-knowledge/eval/synthetic-report.json`: re-scored against thresholds-v2

## Decisions Made

- Parse and validation failures of the thresholds file share one code (THRESHOLDS_INVALID). The CLI does not echo which check failed, so it never prints paths or content.
- Filesystem errors on a gold file (too large, symlink, missing) keep their `INPUT_*` codes. An empty or undeserializable gold file is FIXTURE_INVALID.
- `review_rows` returns no rows for an empty id list rather than building `IN ()`. `load_fixtures` already guarantees at least one id, so this only guards the library function.

## Deviations from Plan

**1. [Rule 3 - Environment constraint] Synthetic re-score ran the built binary instead of `cargo run`**
- **Found during:** Task 3
- **Issue:** The orchestrator restricted cargo to `cargo test --manifest-path ...`. The plan's context block uses `cargo run --bin telu-knowledge-eval`.
- **Fix:** Ran `target/debug/telu-knowledge-eval` (built by the Task 3 GREEN `cargo test` run at 61222ff) with the plan's exact `run` and `score` arguments, `--commit $(git rev-parse HEAD)`, and a `mktemp -d` scratch directory outside the repo.
- **Verification:** The plan's node check passes. The report's `gitCommit` is 61222ff.
- **Committed in:** ffa8b28

---

**Total deviations:** 1 (environment constraint, no behavior change)
**Impact on plan:** None. The arguments and output are the same as with `cargo run`.

## Issues Encountered

- The debug binary also compiles the unrelated uncommitted `build/ffmpeg.rs` and `audio/recording_commands.rs` edits in the working tree. They do not touch the evaluation path, and none of this plan's tests or builds failed because of them. They were not staged.

## Known Stubs

None.

## Threat Flags

None. T-02-86 (strict fixtures and thresholds) and T-02-87 (bound-parameter review outcomes scoped to scored meetings, counts only) are mitigated and covered by the CLI tests.

## User Setup Required

None. No external service configuration required.

## Next Phase Readiness

- 02-33 can run the representative evaluation through this CLI: any malformed input stops it with a typed error, and review outcomes cover only the scored meetings.
- KNOW-07 stays open until the user declares quality thresholds in thresholds-v2.json and the representative evaluation is committed. REQUIREMENTS.md was not touched.

## Self-Check: PASSED

- Files present: gold/representative-standup.json, gold/insufficient-evidence.json, gold/degraded-capture.json, thresholds-test.json, eval/synthetic-report.json
- Commits present: 4471aac, 3639538, c98a233, e1e4fbb, dee04aa, 61222ff, ffa8b28
- Verification re-run: CLI suite 7/7, lib evaluation 22/22, synthetic node check exit 0, `node --test .github/verify-phase2-know07-status.test.cjs` 12/12, status still open

---
*Phase: 02-evidence-linked-post-meeting-knowledge*
*Completed: 2026-09-28*
