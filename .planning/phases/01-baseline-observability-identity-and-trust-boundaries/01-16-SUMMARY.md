---
phase: 01-baseline-observability-identity-and-trust-boundaries
plan: 16
subsystem: local-evaluation-evidence
tags: [rust, sqlite, sqlx, tauri, observability, idempotency, tdd, privacy]

requires:
  - phase: 01-baseline-observability-identity-and-trust-boundaries/01-03
    provides: Canonical meeting identity committed before capture
  - phase: 01-baseline-observability-identity-and-trust-boundaries/01-04
    provides: Stable transcript evidence identity and post-commit final persistence seam
  - phase: 01-baseline-observability-identity-and-trust-boundaries/01-06
    provides: Authoritative bounded queue ledger and stable work identity
  - phase: 01-baseline-observability-identity-and-trust-boundaries/01-07
    provides: Durable terminal meeting lifecycle, queue, deadline, and gap truth
  - phase: 01-baseline-observability-identity-and-trust-boundaries/01-15
    provides: Per-meeting StageClock, run identity, monotonic stage records, and resource samples
provides:
  - A versioned local SQLite evaluation run keyed to the canonical meeting and StageClock run identity
  - Append-only typed stage, queue, resource, route, outbound, error, evidence-commit, gap, and terminal records
  - Post-product-commit evidence indexing and post-finalization terminal persistence
  - Transactionally idempotent retries with conflict detection and content-redacted schemas
  - Raw-evidence preservation plus an explicit typed error when derived summary aggregation fails
affects: [phase-01-evaluation, plan-01-17, plan-01-18, plan-01-19, latency-analysis, resource-gates]

actuals:
  tokens: 21997
  tasks: 2
  commits: 4
plan_head_before: 8d7a7e6b5cf8b82bddedd3914a5bd69325bb5976

tech-stack:
  added: []
  patterns:
    - StageClock run identity is the durable evaluation run identity for the canonical meeting
    - Product state commits before diagnostic indexing, and diagnostic failure never rolls product state back
    - Raw terminal evidence commits atomically before derived aggregation runs in an isolated transaction
    - Evaluation storage uses typed allowlisted columns and redacted codes instead of generic payload blobs

key-files:
  created:
    - frontend/src-tauri/migrations/20260920000400_phase1_evaluation_runs.sql
    - frontend/src-tauri/src/database/repositories/evaluation.rs
    - .planning/phases/01-baseline-observability-identity-and-trust-boundaries/01-16-task1-red.json
    - .planning/phases/01-baseline-observability-identity-and-trust-boundaries/01-16-task2-red.json
  modified:
    - frontend/src-tauri/src/database/repositories/mod.rs
    - frontend/src-tauri/src/database/repositories/transcript.rs
    - frontend/src-tauri/src/audio/recording_commands.rs

key-decisions:
  - "The QueueLedger StageClock run ID is persisted as the sole evaluation run for its canonical meeting; lifecycle wiring never mints a replacement diagnostic identity."
  - "Transcript evidence is indexed only after its product transaction commits, and evaluation-index failures are redacted diagnostics that cannot roll back or suppress the committed product evidence."
  - "Terminal raw evidence and derived summary aggregation use separate transactions so an aggregate failure preserves every raw measurement and appends SUMMARY_AGGREGATION_FAILED."
  - "Evaluation rows use typed allowlisted fields and stable fingerprints; transcript/audio content, secrets, request/response bodies, and sensitive full paths have no storage columns."

patterns-established:
  - "Post-commit diagnostics: authoritative product transitions commit first; durable evaluation claims are written afterward and can fail independently."
  - "Raw-before-derived persistence: append-only raw records are the source of truth, while recomputable aggregates are isolated and failure-attributed."
  - "Run-scoped idempotency: each typed record class has stable run/sequence uniqueness with same-record retries accepted and conflicting reuse rejected."

requirements-completed: [BASE-02, BASE-03, BASE-04]

coverage:
  - id: D1
    description: One versioned local run joins stage, queue, resource, route, outbound, error, and canonical meeting evidence with idempotent stable sequences and no content-bearing columns.
    requirement: BASE-02
    verification:
      - kind: unit
        ref: "cargo test --manifest-path frontend/src-tauri/Cargo.toml evaluation_repository --lib -- --nocapture"
        status: pass
    human_judgment: false
  - id: D2
    description: Final transcript evidence is indexed only after its product transaction commits, and terminal lifecycle persists queue, deadline, outcomes, gaps, routes, resources, and typed errors under the same run.
    requirement: BASE-03
    verification:
      - kind: integration
        ref: "cargo test --manifest-path frontend/src-tauri/Cargo.toml evaluation_wiring --lib -- --nocapture"
        status: pass
      - kind: unit
        ref: "cargo test --manifest-path frontend/src-tauri/Cargo.toml transcript_evidence_repository --lib -- --nocapture"
        status: pass
      - kind: unit
        ref: "cargo test --manifest-path frontend/src-tauri/Cargo.toml finalization_stop_contract_tests --lib -- --nocapture"
        status: pass
    human_judgment: false
  - id: D3
    description: A failed derived summary write leaves raw evaluation records intact and records a redacted SUMMARY_AGGREGATION_FAILED fact without changing product finalization.
    requirement: BASE-04
    verification:
      - kind: integration
        ref: "frontend/src-tauri/src/database/repositories/evaluation.rs#evaluation_wiring_summary_failure_preserves_raw_records_and_explicit_error"
        status: pass
      - kind: integration
        ref: "cargo test --manifest-path frontend/src-tauri/Cargo.toml --lib (337 passed, 3 ignored)"
        status: pass
    human_judgment: false

duration: 31m
completed: 2026-09-21
status: complete
---

# Phase 01 Plan 16: Durable Evaluation Run Summary

**Telu now persists its authoritative stage, queue, resource, route, evidence, error, and terminal lifecycle as one versioned, idempotent, content-redacted local run tied to the canonical meeting.**

## Performance

- **Duration:** 31m
- **Started:** 2026-09-21T09:42:57Z
- **Completed:** 2026-09-21T10:13:39Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Added a forward-only SQLite schema and repository for a single run manifest plus typed append-only stage, queue, resource, route, outbound, error, evidence-commit, gap, terminal, and derived-summary records.
- Made batch, transcript-redelivery, and terminal retries idempotent while rejecting conflicting run/sequence reuse and preserving historical product identities through fresh and legacy migration tests.
- Wired both recording starts to create the StageClock-backed run before transcription work and wired final transcript indexing strictly after its product evidence transaction commits.
- Persisted terminal measurements only after the authoritative meeting finalization commits, including final queue/deadline truth, gaps, redacted reason codes, stage/ledger overflow, a local resource sample, and meeting-attributed route/outbound attempts.
- Isolated derived aggregation from raw evidence so an injected aggregate write failure keeps all raw rows and appends a typed `SUMMARY_AGGREGATION_FAILED` record.

## Task Commits

Each TDD task was committed in RED/GREEN sequence:

1. **Task 1 RED: versioned evaluation repository contracts** - `d493d2f` (test)
2. **Task 1 GREEN: typed local evaluation schema and idempotent repository** - `33a91f6` (feat)
3. **Task 2 RED: post-commit and terminal lifecycle contracts** - `15e0b96` (test)
4. **Task 2 GREEN: authoritative evidence and terminal run wiring** - `1ff7ee8` (feat)

## Files Created/Modified

- `frontend/src-tauri/migrations/20260920000400_phase1_evaluation_runs.sql` - Defines the versioned run manifest, nine typed raw record tables, and the isolated derived summary table.
- `frontend/src-tauri/src/database/repositories/evaluation.rs` - Implements validation, redaction, stable fingerprints, idempotent transactions, terminal raw persistence, and failure-isolated aggregation.
- `frontend/src-tauri/src/database/repositories/mod.rs` - Registers the evaluation repository.
- `frontend/src-tauri/src/database/repositories/transcript.rs` - Indexes final evidence only after the product transaction commits and records redacted diagnostic failure without rolling product evidence back.
- `frontend/src-tauri/src/audio/recording_commands.rs` - Creates the per-meeting run and persists terminal stage/queue/resource/route/outbound/gap/error evidence after authoritative finalization.
- `01-16-task1-red.json` and `01-16-task2-red.json` - Preserve validated intentional RED evidence for both TDD tasks.

## Decisions Made

- Reused the queue-owned StageClock UUID as the evaluation run ID and enforced one run per meeting in SQLite, avoiding a second identity allocator.
- Kept evaluation writes downstream of product commits. A diagnostic failure is logged and, when storage permits, recorded with a typed code; it cannot undo canonical evidence or lifecycle state.
- Stored each evidence class in typed columns rather than a generic JSON payload, making the content-exclusion contract structural and testable.
- Reserved a high stable sequence namespace for terminal error facts so earlier evidence-index errors cannot collide with terminal reason codes.
- Wrote raw terminal records in one immediate transaction, then computed the summary separately; aggregate failure is explicit and cannot delete or rewrite raw evidence.

## TDD Gate Compliance

- **Task 1 RED:** Three repository behaviors failed because the placeholder migration had no evaluation tables and repository methods were unavailable; `01-16-task1-red.json` passed `RED_EVIDENCE_OK`.
- **Task 1 GREEN:** Fresh/legacy migration, cross-record run correlation, interrupted-batch retry, and redaction contracts pass.
- **Task 2 RED:** All three lifecycle contracts failed because evidence-commit, terminal, gap, and summary persistence did not exist; `01-16-task2-red.json` passed `RED_EVIDENCE_OK`.
- **Task 2 GREEN:** Post-commit evidence indexing, terminal same-run truth, idempotent terminal retry, and raw preservation under injected aggregation failure all pass.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- A full library test run inside the restricted sandbox produced 14 false failures because loopback test servers could not bind sockets. The identical suite was rerun with local socket permission and passed 337 tests with 3 intentionally ignored.
- A formatter invocation initially touched unrelated pre-existing layout in the large recording command file. That formatter churn was discarded and only the targeted semantic edits were reapplied before commit.

## Known Stubs

None. Touched-file scans found no TODOs, FIXMEs, skipped tests, placeholder implementation, content-bearing evaluation columns, or intentional RED behavior remaining.

## User Setup Required

None.

## Next Phase Readiness

- Plan 17 can serialize/export the durable run without reconstructing identity or reconciling independent measurement clocks.
- Plans 18 and 19 can query raw local evidence and derived counts while treating raw records as authoritative if aggregation is unavailable.
- No blocker remains for the remaining Phase 01 evidence-bundle and reference-run work.

## Self-Check: PASSED

- All seven task-created or task-modified files, both RED-evidence records, and this summary exist on disk.
- Task commits `d493d2f`, `33a91f6`, `15e0b96`, and `1ff7ee8` resolve in git history.
- The persisted plan ledger measures four task commits before metadata finalization; focused repository/lifecycle tests and the full 337-test Rust library suite pass, coverage classification is fully automated, and `git diff --check` is clean.

---
*Phase: 01-baseline-observability-identity-and-trust-boundaries*
*Completed: 2026-09-21*
