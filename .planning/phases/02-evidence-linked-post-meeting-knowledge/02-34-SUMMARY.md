---
phase: 02-evidence-linked-post-meeting-knowledge
plan: 34
subsystem: testing
tags: [knowledge-eval, know-07, evaluation-kind, held-out, clap, serde, node-test]

requires:
  - phase: 02-evidence-linked-post-meeting-knowledge
    provides: 02-31 strict KNOW-07 eval CLI (telu-knowledge-eval score) and thresholds-v2.json
  - phase: 02-evidence-linked-post-meeting-knowledge
    provides: 02-28 derived KNOW-07 status module (.github/verify-phase2-know07-status.cjs)
  - phase: 02-evidence-linked-post-meeting-knowledge
    provides: 02-32 keep-open decision (thresholds stay undeclared)
provides:
  - EvaluationKind enum (synthetic, real_meeting_pilot, representative) and optional evaluationKind report field
  - telu-knowledge-eval score --kind, parsed through the serde names by parse_kind
  - Status reason representative_kind_mismatch (report not labeled representative, fail-closed on missing kind)
  - Status reason representative_not_held_out (representative fixtures share an id with the real-meeting pilot, or either fixtures array is missing)
  - readCommittedInputs().pilotReport read from eval/real-meeting-pilot-report.json when present
affects: [02-35, 02-36, 02-37, KNOW-07, phase-03]

actuals:
  tokens: 3957
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Run-type label comes from the CLI, never a hand edit: score --kind writes evaluationKind by struct update over score()"
    - "Held-out disjointness is a derived-status rule, compared as sets and fail-closed on missing arrays"

key-files:
  created:
    - .planning/phases/02-evidence-linked-post-meeting-knowledge/02-34-SUMMARY.md
  modified:
    - frontend/src-tauri/src/knowledge/evaluation/mod.rs
    - frontend/src-tauri/src/bin/telu-knowledge-eval.rs
    - frontend/src-tauri/tests/knowledge_eval_cli.rs
    - .github/verify-phase2-know07-status.cjs
    - .github/verify-phase2-know07-status.test.cjs

key-decisions:
  - "evaluationKind is optional and additive, so REPORT_SCHEMA_VERSION stays 1. Unlabeled legacy reports (such as the 02-20 pilot-report.json) fail closed as representative_kind_mismatch"
  - "score_command takes its four input paths as a ScoreFiles struct so adding --kind does not push it past seven parameters"

patterns-established:
  - "Status module only gains checks: new reasons go at the end of reportReasons, and cleanReport() gains the new required fields so existing exact expectations stay unchanged"

requirements-completed: []

coverage:
  - id: D1
    description: "score --kind writes evaluationKind (synthetic, real_meeting_pilot, representative); no --kind writes no key and schemaVersion stays 1; --kind pilot exits non-zero with no report.json"
    requirement: "KNOW-07"
    verification:
      - kind: integration
        ref: "frontend/src-tauri/tests/knowledge_eval_cli.rs#score_labels_the_report_with_its_evaluation_kind"
        status: pass
      - kind: unit
        ref: "cargo test --manifest-path frontend/src-tauri/Cargo.toml knowledge::evaluation --lib (22 pass)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The status module refuses a report not labeled representative with representative_kind_mismatch, including a CLI-produced real_meeting_pilot report end to end"
    requirement: "KNOW-07"
    verification:
      - kind: unit
        ref: ".github/verify-phase2-know07-status.test.cjs#a report that is not labeled representative is not the representative evaluation"
        status: pass
      - kind: integration
        ref: "Task 1 tracer verify: telu-knowledge-eval run + score --kind real_meeting_pilot piped into deriveKnow07Status"
        status: pass
    human_judgment: false
  - id: D3
    description: "The status module refuses a representative report that shares any fixture id with the real-meeting pilot (order-independent, fail-closed on missing arrays) with representative_not_held_out"
    requirement: "KNOW-07"
    verification:
      - kind: unit
        ref: ".github/verify-phase2-know07-status.test.cjs#a representative report must be held out from the real-meeting pilot"
        status: pass
      - kind: other
        ref: "Task 2 verify 2: disjoint clean report is satisfied, overlapping one is exactly representative_not_held_out"
        status: pass
    human_judgment: false
  - id: D4
    description: "Committed KNOW-07 status unchanged (open: quality_thresholds_undeclared, representative_evaluation_pending); thresholds-v2.json, eval/ and REQUIREMENTS.md untouched"
    requirement: "KNOW-07"
    verification:
      - kind: other
        ref: "node .github/verify-phase2-know07-status.cjs equals eval/know-07-status.json && git diff --quiet HEAD -- thresholds-v2.json eval REQUIREMENTS.md"
        status: pass
      - kind: unit
        ref: "node --test .github/*.test.cjs (70 pass, 0 fail)"
        status: pass
    human_judgment: false

duration: 7min
completed: 2026-09-28
status: complete
---

# Phase 02 Plan 34: Evaluation Kind Labels and Held-Out Pilot Check Summary

**`telu-knowledge-eval score --kind` now labels every report with `evaluationKind`. The KNOW-07 status module counts a representative report only when it is labeled `representative` and shares no meeting id with the committed real-meeting pilot, so a pilot can never pass as or overlap the held-out evaluation.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-09-28T18:42:20Z
- **Completed:** 2026-09-28T18:49:30Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- `EvaluationKind` enum (`synthetic`, `real_meeting_pilot`, `representative`, serde snake_case) and `EvaluationReport.evaluation_kind` (JSON `evaluationKind`, omitted when absent). `score()` sets it to `None` and `REPORT_SCHEMA_VERSION` stays 1.
- `score --kind`: `parse_kind` deserializes through serde_json, so the names are defined only once. Unknown values are rejected by clap (exit 2) before any input is read or `report.json` is written, with the message `unknown kind 'pilot': expected synthetic, real_meeting_pilot or representative`.
- Status module: `REPRESENTATIVE_KIND`, `representative_kind_mismatch`, `REAL_MEETING_PILOT_REPORT_PATH`, `heldOutFromPilot`, `representative_not_held_out`, and a fourth `deriveKnow07Status` parameter `pilotReport = null`, which `readCommittedInputs` / `deriveCommittedStatus` pass through.
- The committed status is still `open` with `quality_thresholds_undeclared` and `representative_evaluation_pending`. No existing reason was relaxed.

## Task Commits

1. **Task 1: Tracer: score --kind writes evaluationKind; the status module counts only representative-labeled reports**
   - RED `bf276e3` (test)
   - GREEN `27e5795` (feat)
   - Tracer gate: auto mode, re-ran the end-to-end verify (CLI to report.json to status module): passed, then expanded
2. **Task 2: The status module refuses a representative report that reuses a real-meeting pilot meeting**
   - RED `24bc6b1` (test)
   - GREEN `14caad5` (feat)

**Plan metadata:** committed with this SUMMARY (docs)

## Files Created/Modified

- `frontend/src-tauri/src/knowledge/evaluation/mod.rs`: `EvaluationKind` enum and the optional `evaluation_kind` report field
- `frontend/src-tauri/src/bin/telu-knowledge-eval.rs`: `--kind` flag, `parse_kind`, `ScoreFiles` input bundle, and the labeled report built by struct update
- `frontend/src-tauri/tests/knowledge_eval_cli.rs`: `score_labels_the_report_with_its_evaluation_kind` plus the `score_labeled` / `report_at` helpers
- `.github/verify-phase2-know07-status.cjs`: kind and held-out checks, pilot report input
- `.github/verify-phase2-know07-status.test.cjs`: `cleanReport()` gains `evaluationKind` and `fixtures`, plus two new tests

## Decisions Made

- `evaluationKind` is optional, so older reports still parse and schemaVersion stays 1. The status module fails closed on a missing kind, so unlabeled legacy reports can never count as representative (as the plan's assumption-delta decision requires).
- `score_command`'s four input paths are grouped in a small `ScoreFiles` struct. Adding `kind` as an eighth positional parameter would have gone past clippy's `too_many_arguments` threshold.
- A small `readJsonIfPresent` helper reads both optional committed reports, so the existsSync/parse pattern isn't duplicated.

## Deviations from Plan

None. The plan was executed as written. The extra `test(02-34)` RED commits before each `feat(02-34)` commit follow the executor's TDD gate protocol for `tdd="true"` tasks. The `feat` commit messages match the plan exactly.

## TDD Gate Compliance

- RED `bf276e3` failed as expected: clap rejected `--kind`, and the node kind test got `[]` instead of `['representative_kind_mismatch']`. GREEN is `27e5795`.
- RED `24bc6b1` failed as expected: the held-out test got `[]` for overlapping fixtures. GREEN is `14caad5`.
- No REFACTOR commits were needed.

## Issues Encountered

- `cargo fmt --check` flags the existing `telu-knowledge-eval.rs`, which already uses lines of about 120 columns. New code follows the file's existing style and the file was not reformatted wholesale.
- The cargo build shows pre-existing warnings from `frontend/src-tauri/build/ffmpeg.rs` (the user's uncommitted work) and other unrelated modules. They are out of scope and were left untouched.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- 02-35 (real-meeting pilot) can now score with `--kind real_meeting_pilot` and commit `eval/real-meeting-pilot-report.json`. Once that file exists, the status module automatically enforces held-out disjointness for 02-37.
- KNOW-07 stays open and is not marked complete: thresholds are still undeclared (02-36) and there is no representative report yet (02-37).

## Self-Check: PASSED

- All 5 modified files exist on disk.
- Commits bf276e3, 27e5795, 24bc6b1 and 14caad5 exist in git history.
- Task 1: all 4 verify commands exit 0, and the acceptance greps print 1 / 1 / 1.
- Task 2: all 3 verify commands exit 0, and the acceptance greps print 1 / 1. Node tests show 14 pass, 0 fail, including 'a representative report must be held out from the real-meeting pilot'.

---
*Phase: 02-evidence-linked-post-meeting-knowledge*
*Completed: 2026-09-28*
