---
phase: 02-evidence-linked-post-meeting-knowledge
plan: 28
subsystem: knowledge-eval
tags: [node, node-test, know-07, thresholds, eval-gate, gap-closure, cr-80]

requires:
  - phase: 02-evidence-linked-post-meeting-knowledge
    provides: 02-20 thresholds-v1.json, eval/know-07-status.json and the in-test KNOW-07 derivation
provides:
  - KNOW-07 status derivation module .github/verify-phase2-know07-status.cjs with a print-derived-status entry point
  - Exhaustive thresholds-v2 schema validation (exact keys, fixed invariants, leaf ranges)
  - Report checks for content, schemaVersion, thresholdsSha256, gate plus empty failures, and invariants
  - thresholds-v2.json with per-scope maxDuplication and minReviewAccepted slots, all null
affects: [02-30 Rust scorer reading thresholds-v2, 02-31 CLI fixtures and synthetic report, phase-03 gate]

actuals:
  tokens: 4088
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Module plus node:test pair under .github/ (derivation module prints its own output; the committed status file is written only from that output)"
    - "Exact key-set comparison at every schema level instead of leaf walks"

key-files:
  created:
    - .github/verify-phase2-know07-status.cjs
    - frontend/src-tauri/tests/fixtures/knowledge-eval/thresholds-v2.json
  modified:
    - .github/verify-phase2-know07-status.test.cjs

key-decisions:
  - "thresholds-v2.json is the only authoritative KNOW-07 gate file; thresholds-v1.json stays byte-identical as the historical 02-20 record and derives thresholds_invalid if the derivation is pointed at it"
  - "A content-bearing representative report derives representative_report_contains_content and no further report reasons, so a privacy violation is never folded into pending"
  - "Report exactSpanSupport counts only when status is measured and value is exactly 1; a not_measurable invariant does not pass"

patterns-established:
  - "Reason codes are emitted sorted so the same inputs always produce byte-identical status files"

requirements-completed: []

coverage:
  - id: D1
    description: "KNOW-07 status is derived by a module from the committed thresholds-v2.json and representative report; the committed know-07-status.json equals the module's printed output"
    verification:
      - kind: unit
        ref: ".github/verify-phase2-know07-status.test.cjs#the committed KNOW-07 status equals the status derived from the committed files"
        status: pass
      - kind: unit
        ref: ".github/verify-phase2-know07-status.test.cjs#the module prints the derived status as JSON"
        status: pass
    human_judgment: false
  - id: D2
    description: "Both CR-80 reproductions, malformed or partial thresholds, weakened invariants, failing, wrong-schema, sha-mismatched and content-bearing reports all derive open"
    verification:
      - kind: unit
        ref: ".github/verify-phase2-know07-status.test.cjs#the two CR-80 reproduction cases derive open"
        status: pass
      - kind: unit
        ref: ".github/verify-phase2-know07-status.test.cjs#malformed thresholds are invalid"
        status: pass
      - kind: unit
        ref: ".github/verify-phase2-know07-status.test.cjs#a pass gate is not enough"
        status: pass
      - kind: unit
        ref: ".github/verify-phase2-know07-status.test.cjs#content in a report is reported as content, not as pending"
        status: pass
    human_judgment: false
  - id: D3
    description: "thresholds-v2.json adds maxDuplication and minReviewAccepted per scope and abstention.insufficientEvidence, all null, committed alone; thresholds-v1.json unchanged"
    verification:
      - kind: other
        ref: "git show --name-only --format= e6fe90c (only thresholds-v2.json); git diff --quiet HEAD -- thresholds-v1.json"
        status: pass
      - kind: unit
        ref: ".github/verify-phase2-know07-status.test.cjs#the historical thresholds-v1 file is rejected as invalid"
        status: pass
    human_judgment: false

duration: 3min
completed: 2026-09-28
status: complete
---

# Phase 2 Plan 28: KNOW-07 Status Derivation Hardening Summary

**KNOW-07 status now comes from a standalone derivation module that validates the thresholds-v2 schema exhaustively and requires a content-free, schema-1, sha-bound, pass-with-no-failures report with met invariants. Both CR-80 reproductions now derive open, and the committed status still reads open.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-09-28T13:45:31Z
- **Completed:** 2026-09-28T13:49Z
- **Tasks:** 2
- **Files modified:** 3 (plus know-07-status.json regenerated, byte-identical)

## Accomplishments

- `thresholds-v2.json` was committed on its own (e6fe90c) before anything was scored against it. It holds version 2, invariants 1.0/0/0, `abstention.insufficientEvidence`, and five scopes, each with `claimCorrectness`, `semanticSupport`, `evidenceCoverage`, `attribution`, `maxDuplication` and `minReviewAccepted`. Every quality value is null.
- `.github/verify-phase2-know07-status.cjs` exports `deriveKnow07Status`, `thresholdsValid`, `thresholdsDeclared`, `contentFree` and `readCommittedInputs`, plus the constants `THRESHOLDS_VERSION`, `REPORT_SCHEMA_VERSION`, `SCOPES`, `MIN_METRICS`, `MAX_METRICS` and `CONTENT_FREE_TOKEN`. When run directly it prints the derived status.
- The node:test suite has 12 tests, covering both CR-80 reproductions, 19 malformed-thresholds cases, 13 report failure cases, 4 content-bearing cases, the boundary declarations (minimum 1, maxDuplication 0), sorted reasons, the committed-equals-derived check and the print entry point.
- `eval/know-07-status.json` was regenerated only from the module output and reads open: `[quality_thresholds_undeclared, representative_evaluation_pending]`. KNOW-07 stays Pending in REQUIREMENTS.md and Phase 3 stays blocked.

## Task Commits

1. **Task 1 (tracer): derive KNOW-07 status from thresholds-v2 through a module**
   - `e6fe90c` test(02-28): add KNOW-07 thresholds v2 with every quality value undeclared (thresholds-v2.json only)
   - `79bda82` feat(02-28): derive KNOW-07 status from thresholds v2 through a module
2. **Task 2 (TDD): harden the derivation per CR-80**
   - `3d6ed5e` test(02-28): add failing CR-80 tests for KNOW-07 status derivation (RED)
   - `2d843b8` fix(02-28): harden KNOW-07 status derivation per CR-80 (GREEN)

## TDD Gate Compliance

RED evidence, observed against the Task 1 module before hardening:

```
derive(CR-80 case 1) => {"status":"satisfied","reasons":[]}
derive(CR-80 case 2) => {"status":"satisfied","reasons":[]}
tests 12, pass 6, fail 6
  ✖ the two CR-80 reproduction cases derive open        (actual 'satisfied', expected 'open')
  ✖ malformed thresholds are invalid                     (actual [], expected ['thresholds_invalid'])
  ✖ the historical thresholds-v1 file is rejected         (actual ['quality_thresholds_undeclared'])
  ✖ a pass gate is not enough                            (actual [], expected ['representative_gate_not_pass'])
  ✖ content in a report is reported as content           (actual [], expected ['representative_report_contains_content'])
  ✖ reasons are emitted sorted ...                       (missing schema_unknown and thresholds_invalid)
```

After GREEN, the two CR-80 cases each derive open with `[representative_gate_not_pass, representative_invariants_not_met, representative_schema_unknown, thresholds_invalid]`, and the result is `tests 12, pass 12, fail 0`. The `boundary declarations` test also passed during RED, because the old leaf walk accepted [0, 1]. It is kept as a regression guard for the new open/closed interval edges. No refactor commit was needed.

## Files Created/Modified

- `.github/verify-phase2-know07-status.cjs`: pure derivation module with a print entry point (node built-ins only, comment-free, every function under 50 lines)
- `.github/verify-phase2-know07-status.test.cjs`: requires the module and holds the 12 contract tests
- `frontend/src-tauri/tests/fixtures/knowledge-eval/thresholds-v2.json`: v2 thresholds schema with duplication and review-outcome slots
- `.planning/phases/02-evidence-linked-post-meeting-knowledge/eval/know-07-status.json`: regenerated from the module. The content did not change (open, same two reasons), so there was no diff to commit.

## Decisions Made

- Validation compares sorted key lists at every level: top level, invariants, quality, abstention and each scope. As a result, empty scopes, missing scopes or metrics, unknown scopes or metric keys and extra top-level keys all derive `thresholds_invalid`.
- The report `thresholdsSha256` must be a string equal to the committed file's sha256, so an absent sha can never match an absent expected sha.
- `requirements-completed` is empty. The plan's prohibition forbids marking KNOW-07 complete while the derived status is open, which follows the 02-20 precedent. For that reason, `requirements.mark-complete` was not run.

## Deviations from Plan

None. The plan was executed as written. Two additions stay within the plan's intent:
- The tests cover a few extra malformed cases beyond the listed minimum: a missing abstention, the v1 `abstention: null` shape, an extra invariant, null thresholds, a non-array `failures`, a missing `schemaVersion`, a `not_measurable` exactSpanSupport, missing report invariants, and content held in a report key or a failures entry.
- A test asserts that the on-disk `thresholds-v1.json` derives `thresholds_invalid`, which puts the plan's promote decision into code.

## Issues Encountered

None.

## Known Stubs

None. Null quality values in thresholds-v2.json are intentional: the user declares them, and they keep KNOW-07 open by design.

## Next Phase Readiness

- 02-30 can point the Rust scorer at `thresholds-v2.json`, whose shape is fixed and validated here.
- KNOW-07 remains open. It needs user-declared quality thresholds and a passing representative evaluation.

## Self-Check: PASSED

- FOUND: .github/verify-phase2-know07-status.cjs, .github/verify-phase2-know07-status.test.cjs, frontend/src-tauri/tests/fixtures/knowledge-eval/thresholds-v2.json, eval/know-07-status.json
- FOUND commits: e6fe90c, 79bda82, 3d6ed5e, 2d843b8
- `node --test .github/verify-phase2-know07-status.test.cjs`: tests 12, fail 0
- thresholds-v1.json unchanged (`git diff --quiet HEAD` exit 0); thresholds-v2.json's last commit touches only that file
