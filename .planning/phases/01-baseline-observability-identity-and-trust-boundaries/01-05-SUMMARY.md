---
phase: 01-baseline-observability-identity-and-trust-boundaries
plan: 05
subsystem: transcription-backpressure-observability
tags: [rust, tokio, bounded-mpsc, queue-ledger, monotonic-timing, tdd]

requires:
  - phase: 01-baseline-observability-identity-and-trust-boundaries
    provides: Stable meeting identity, durable final transcript evidence, and persist-before-publish ordering
provides:
  - Per-meeting content-free queue ledger with conserved accepted-work outcomes
  - Finite non-blocking transcription admission with attributable full and closed rejection gaps
  - Worker terminal accounting that joins workers before publishing a queue-terminal snapshot
affects: [recording-stop, finalization, recovery, baseline-diagnostics, live-assistance]

actuals:
  tokens: 17029
  tasks: 2
  commits: 4
plan_head_before: 8e265ef6285a29c42874bd42b9339ab2ad8e777b

tech-stack:
  added: []
  patterns:
    - Authoritative snapshots are derived from per-work records rather than independently maintained counters
    - Tokio permits reserve finite capacity before the ledger accepts a work ID
    - Rejected work is separate from accepted-work conservation and retains recording-relative bounds

key-files:
  created:
    - frontend/src-tauri/src/audio/transcription/queue_ledger.rs
    - .planning/phases/01-baseline-observability-identity-and-trust-boundaries/01-05-task1-red.json
    - .planning/phases/01-baseline-observability-identity-and-trust-boundaries/01-05-task2-red.json
  modified:
    - frontend/src-tauri/src/audio/transcription/mod.rs
    - frontend/src-tauri/src/audio/transcription/worker.rs
    - frontend/src-tauri/src/audio/pipeline.rs
    - frontend/src-tauri/src/audio/recording_state.rs
    - frontend/src-tauri/src/audio/recording_manager.rs
    - frontend/src-tauri/src/audio/recording_commands.rs

key-decisions:
  - "Queue counts are derived from one per-meeting work ledger; rejected work is tracked separately and never enters accepted-work conservation."
  - "Admission uses try_reserve before ledger acceptance and permit send, preventing a channel/accounting race while keeping the capture-facing seam non-blocking."
  - "TELU_TRANSCRIPTION_QUEUE_CAPACITY is recorded as a validated experiment input with a default of eight, not presented as a release threshold."
  - "The dispatcher may await the finite worker queue after callback-facing admission; shutdown joins workers and terminally accounts stranded work before emitting the final snapshot."

patterns-established:
  - "Conserved work lifecycle: accepted equals queued/active plus completed, failed, cancelled, and superseded; rejected is orthogonal."
  - "Stable operational identity: each mixed transcript chunk maps to one content-free work ID and admission sequence."
  - "Truthful failure semantics: model, dispatch, worker, IPC, and evidence-persistence failures cannot be counted as completed work."

requirements-completed: [BASE-03, BASE-05]

coverage:
  - id: D1
    description: "A shared per-meeting ledger reports capacity, depth, active work, oldest age, and conserved cumulative outcomes with stable equal-time ordering."
    requirement: BASE-03
    verification:
      - kind: unit
        ref: "cargo test --manifest-path frontend/src-tauri/Cargo.toml queue_ledger --lib -- --nocapture"
        status: pass
      - kind: integration
        ref: "cargo test --manifest-path frontend/src-tauri/Cargo.toml --lib"
        status: pass
    human_judgment: false
  - id: D2
    description: "Both transcription handoffs are finite; full or closed admission is immediate and attributable, and workers own exact terminal outcomes."
    requirement: BASE-05
    verification:
      - kind: unit
        ref: "cargo test --manifest-path frontend/src-tauri/Cargo.toml bounded_transcription --lib -- --nocapture"
        status: pass
      - kind: integration
        ref: "cargo check --manifest-path frontend/src-tauri/Cargo.toml"
        status: pass
      - kind: integration
        ref: "cargo test --manifest-path frontend/src-tauri/Cargo.toml transcript_evidence --lib -- --nocapture"
        status: pass
      - kind: integration
        ref: "cargo test --manifest-path frontend/src-tauri/Cargo.toml ui_acknowledgement --lib -- --nocapture"
        status: pass
    human_judgment: false

duration: 22min
completed: 2026-09-20
status: complete
---

# Phase 01 Plan 05: Bounded Transcription Ledger Summary

**Finite Tokio handoffs now feed one authoritative per-meeting ledger, making overload gaps, queue age, and every terminal outcome observable without weakening capture or evidence contracts.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-09-20T19:57:38Z
- **Completed:** 2026-09-20T20:19:32Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Added a content-free `QueueLedger` whose immutable snapshots derive depth, active work, oldest age, and outcome totals from authoritative per-work records.
- Replaced the pipeline-to-dispatcher and dispatcher-to-worker transcription handoffs with finite Tokio channels while preserving non-blocking capture-facing admission.
- Recorded full and closed admissions as explicit gaps with stable work IDs, monotonic event order, typed reasons, and recording-relative bounds.
- Removed fake completion counters and the early queue-complete event; worker results now select exactly one terminal outcome and the final snapshot is emitted only after worker joins.
- Preserved the prior meeting-identity, final-evidence persistence, and renderer-acknowledgement contracts across the transcription integration.

## Task Commits

Each TDD phase was committed atomically:

1. **Task 1 RED: queue conservation and stable-order tests** - `11c7ec6` (test)
2. **Task 1 GREEN: per-meeting queue conservation ledger** - `78182fd` (feat)
3. **Task 2 RED: bounded admission and terminal-order tests** - `b0af002` (test)
4. **Task 2 GREEN: bounded transcription handoffs and exact terminal accounting** - `c8cd7b4` (feat)

## Files Created/Modified

- `frontend/src-tauri/src/audio/transcription/queue_ledger.rs` - Defines typed work outcomes, rejection gaps, stable admission sequence, and derived snapshots.
- `frontend/src-tauri/src/audio/transcription/mod.rs` - Exposes the queue ledger contract and stable transcription work-ID helper.
- `frontend/src-tauri/src/audio/recording_state.rs` - Owns the one shared ledger for the current meeting.
- `frontend/src-tauri/src/audio/pipeline.rs` - Validates queue capacity and performs immediate permit-based admission or attributable rejection.
- `frontend/src-tauri/src/audio/transcription/worker.rs` - Uses the finite worker handoff and records start and terminal outcomes before the terminal snapshot.
- `frontend/src-tauri/src/audio/recording_manager.rs` - Constructs the bounded outer channel from the meeting ledger's configured capacity.
- `frontend/src-tauri/src/audio/recording_commands.rs` - Propagates the shared meeting ledger into the transcription task at both recording entry points.
- `.planning/phases/01-baseline-observability-identity-and-trust-boundaries/01-05-task1-red.json` - Records validated intentional RED evidence for ledger conservation behavior.
- `.planning/phases/01-baseline-observability-identity-and-trust-boundaries/01-05-task2-red.json` - Records validated intentional RED evidence for bounded admission and worker termination behavior.

## Decisions Made

- The ledger stores identifiers, monotonic timestamps, bounds, and typed reasons only; it does not retain audio or transcript content.
- `depth` covers every nonterminal accepted item and `active` is its started subset. An empty depth intentionally makes no meeting-lifecycle claim.
- `try_reserve` checks finite capacity before ledger acceptance, then the owned permit sends without another capacity race.
- Capacity accepts a validated environment override for experiments, but no threshold is claimed as a release decision.
- The internal dispatcher may await its finite channel because it is downstream from the non-blocking capture-facing seam; it still cannot grow work without bound.
- Failed model initialization, model unload, dispatch closure, worker panic, IPC failure, and evidence-persistence failure are terminal failures, never completions.

## TDD Gate Compliance

- **Task 1 RED:** Three named ledger tests failed intentionally against the initial stub for conservation, oldest-age/depth truthfulness, and equal-time stable ordering. The RED artifact passed `tdd-red-evidence`.
- **Task 1 GREEN:** The focused ledger suite passed 3/3.
- **Task 2 RED:** Three named bounded-transcription tests failed intentionally because full/closed admission still reported acceptance, model absence still mapped to completion, and completion preceded worker joins. The RED artifact passed `tdd-red-evidence`.
- **Task 2 GREEN:** The focused bounded-transcription suite passed 3/3.
- **Final:** `cargo check` passed; prior transcript-evidence tests passed 6/6; renderer-acknowledgement tests passed 3/3; and the full Rust library suite passed 276 runnable tests with 3 platform tests ignored.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Routed bounded channel construction and ledger ownership through recording start integration**
- **Found during:** Task 2 (wire bounded non-blocking admission and explicit rejection gaps)
- **Issue:** The plan named pipeline, worker, ledger, and recording state, but the outer transcription channel is actually constructed in `recording_manager.rs` and both worker tasks are spawned from `recording_commands.rs`.
- **Fix:** Initialized the meeting ledger before capture, built the bounded outer channel from its recorded capacity, propagated the shared ledger through both recording entry points, and cloned session ownership where the existing device processor also needs it.
- **Files modified:** `frontend/src-tauri/src/audio/recording_manager.rs`, `frontend/src-tauri/src/audio/recording_commands.rs`
- **Verification:** Focused queue/bounded tests, `cargo check`, prior evidence/acknowledgement suites, and the full Rust library suite all pass.
- **Committed in:** `c8cd7b4`

---

**Total deviations:** 1 auto-fixed blocking integration issue.
**Impact on plan:** The adjacent edits are the minimum needed to create and propagate the planned bounded queue and authoritative per-meeting ledger; no new dependency or architectural layer was introduced.

## Issues Encountered

- Context7 was unavailable and the `ctx7` CLI was not installed, so Tokio 1.52.3 channel semantics were verified against the exact locked crate source already present in the local Cargo registry.
- The full Rust suite's first sandboxed run could not bind loopback test servers or access test application directories. The permission-enabled rerun passed 276 tests with 3 ignored.
- The crate has pre-existing warnings and repository-wide formatting drift outside this plan. No unrelated formatter changes or warning fixes were retained.

## Known Stubs

None. The changed-file scan found no TODO, FIXME, placeholder, unavailable, or empty UI-bound value introduced by this plan.

## User Setup Required

None - no external service configuration required. `TELU_TRANSCRIPTION_QUEUE_CAPACITY` remains an optional bounded-queue experiment input.

## Next Phase Readiness

- Stop/finalization work can consume one truthful ledger rather than placeholder atomics or early completion events.
- Rejected gaps retain the meeting-bound work ID and recording-relative bounds needed for Phase 01's durable finalization and recovery work.
- The prior stable evidence identity and renderer acknowledgement paths remain regression-tested.
- No blocker remains for Plan 01-06.

## Self-Check: PASSED

All nine declared implementation/test artifacts and this summary exist, all four task commit hashes resolve, the persisted plan ledger measures four commits, and the working diff passes `git diff --check`.

---
*Phase: 01-baseline-observability-identity-and-trust-boundaries*
*Completed: 2026-09-20*
