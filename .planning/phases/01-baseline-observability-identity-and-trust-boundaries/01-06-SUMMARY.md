---
phase: 01-baseline-observability-identity-and-trust-boundaries
plan: 06
subsystem: recording-finalization
tags: [rust, tauri, sqlite, sqlx, tokio, react, lifecycle, queue-ledger]

requires:
  - phase: 01-baseline-observability-identity-and-trust-boundaries/01-05
    provides: Authoritative per-meeting bounded queue ledger and terminal accounting
provides:
  - Idempotent SQLite terminal finalization with strict complete/incomplete predicate
  - Finite Rust-owned producer-close and queue-drain protocol with explicit deadline facts
  - Durable remaining-work and gap records keyed to the canonical meeting identity
  - React stop projection driven only by authoritative Rust lifecycle events
affects: [recording-recovery, lifecycle-ui, phase-01-evaluation, evidence-integrity]

actuals:
  tokens: 21232
  tasks: 2
  commits: 5
plan_head_before: d6bf189b3d5a2947f484cad0078314e072e16b03

tech-stack:
  added: []
  patterns:
    - Rust-owned close-drain-deadline-persist state transition
    - Immutable terminal snapshots with idempotent replay
    - Renderer projection that cannot strengthen native lifecycle claims

key-files:
  created:
    - frontend/src-tauri/migrations/20260920000300_phase1_finalization_gaps.sql
  modified:
    - frontend/src-tauri/src/database/repositories/meeting.rs
    - frontend/src-tauri/src/audio/recording_commands.rs
    - frontend/src-tauri/src/audio/recording_manager.rs
    - frontend/src-tauri/src/lib.rs
    - frontend/src/hooks/useRecordingStop.ts
    - .github/verify-phase1-evidence-contract.test.cjs

key-decisions:
  - "The first committed terminal snapshot is immutable and returned unchanged by repeated stop/finalization calls."
  - "TELU_FINALIZATION_DEADLINE_MS is a validated, capped experiment input recorded with each result; the fallback is explicitly an experiment default, not a release threshold."
  - "Work pending at the deadline is terminally cancelled in the ledger while its IDs remain durably recorded as the historical recovery set."
  - "React may display complete only from the Rust/SQLite FinalizationSnapshot and never from quiet time, fixed waits, queue depth, or buffered transcript state."

patterns-established:
  - "Terminal truth: close capture, persist finalizing, drain accepted work, save durable mirrors, then atomically persist complete or incomplete."
  - "Deadline honesty: abort the worker, terminally classify stranded work, and persist remaining IDs plus typed gap reasons before returning."

requirements-completed: [BASE-03, BASE-05]

coverage:
  - id: D1
    description: Strict idempotent SQLite finalization persists complete only when capture, queue, writes, and gaps all prove completion.
    requirement: BASE-05
    verification:
      - kind: integration
        ref: "cargo test --manifest-path frontend/src-tauri/Cargo.toml finalization_repository --lib -- --nocapture"
        status: pass
    human_judgment: false
  - id: D2
    description: Rust stop closes producers and returns bounded authoritative snapshots for empty, shallow, full, failed, and deadline-expired queues.
    requirement: BASE-03
    verification:
      - kind: unit
        ref: "frontend/src-tauri/src/audio/recording_commands.rs#finalization_stop_contract_tests"
        status: pass
    human_judgment: false
  - id: D3
    description: Renderer stop handling consumes Rust lifecycle without polling, fixed waits, flush authority, or frontend bulk persistence.
    requirement: BASE-05
    verification:
      - kind: integration
        ref: "node --test .github/verify-phase1-evidence-contract.test.cjs"
        status: pass
      - kind: other
        ref: "pnpm --dir frontend exec tsc --noEmit"
        status: pass
    human_judgment: false

duration: 26min
completed: 2026-09-20
status: complete
---

# Phase 01 Plan 06: Rust-Owned Recording Finalization Summary

**Finite producer close and ledger drain now end in an immutable SQLite complete/incomplete snapshot with explicit gaps, while React only projects that native result.**

## Performance

- **Duration:** 26 min
- **Started:** 2026-09-20T20:24:57Z
- **Completed:** 2026-09-20T20:50:18Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Added forward-only finalization and gap tables plus a strict transactional predicate that cannot promote quiet or partially durable work to complete.
- Replaced the unbounded/multi-timeout stop tail with one serialized, configurable close/drain deadline over the authoritative queue ledger, preserving typed failures and remaining-at-deadline IDs.
- Removed renderer polling, fixed waits, transcript-buffer authority, transcript content logging, and stop-time bulk database persistence from `useRecordingStop`.
- Preserved bounded transcription-model cleanup and made capture/file persistence failures visible to terminal lifecycle classification.

## Task Commits

Each TDD task was committed in RED/GREEN sequence:

1. **Task 1 RED: finalization repository behavior tests** - `8f795cd` (test)
2. **Task 1 GREEN: strict durable terminal finalization** - `3099dfa` (feat)
3. **Task 2 RED: bounded stop and renderer authority contracts** - `5ded059` (test)
4. **Task 2 GREEN: finite Rust stop and React lifecycle projection** - `35a600a` (feat)
5. **Task 2 REFACTOR: bounded model resource cleanup** - `1474d1e` (refactor)

## Files Created/Modified

- `frontend/src-tauri/migrations/20260920000300_phase1_finalization_gaps.sql` - Stores immutable terminal queue facts and idempotent typed gaps.
- `frontend/src-tauri/src/database/repositories/meeting.rs` - Persists `finalizing`, validates queue conservation, and atomically writes terminal snapshots.
- `frontend/src-tauri/src/audio/recording_commands.rs` - Serializes repeated stops, closes producers, drains/aborts to deadline, builds gap facts, and emits authoritative lifecycle payloads.
- `frontend/src-tauri/src/audio/recording_manager.rs` - Propagates producer and recording-mirror failures instead of silently claiming success.
- `frontend/src-tauri/src/lib.rs` - Returns the Rust terminal snapshot through the Tauri stop command, including idempotent repeated calls.
- `frontend/src/hooks/useRecordingStop.ts` - Projects progress/terminal lifecycle and retains recovery evidence for incomplete meetings.
- `.github/verify-phase1-evidence-contract.test.cjs` - Guards against renderer completion inference and stop-time bulk persistence.

## Decisions Made

- A successful worker join is insufficient when ledger work remains; stranded work is classified as dispatch failure before finalization.
- Deadline expiration captures nonterminal IDs before aborting the worker, then marks each item cancelled with a deadline reason so ledger conservation remains terminal and recovery facts remain explicit.
- File-mirror and evidence-persistence failures both prevent complete, but model unloading is resource cleanup and does not rewrite meeting evidence truth.
- Event-delivery failure after the terminal SQLite commit is logged but does not turn a durable terminal result into a failed stop response.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Preserved remaining-at-deadline IDs after ledger cancellation**
- **Found during:** Task 2 timeout implementation
- **Issue:** The initial repository validator required remaining IDs to equal current queue depth, but deadline handling terminally cancels those items and therefore reduces depth to zero.
- **Fix:** Allowed the historical remaining set to be covered by pending plus cancelled work while retaining queue conservation validation.
- **Files modified:** `frontend/src-tauri/src/database/repositories/meeting.rs`
- **Verification:** Deadline repository and stop tests pass with depth zero, cancelled one, and a durable remaining ID.
- **Committed in:** `35a600a`

**2. [Rule 2 - Missing Critical] Propagated producer and durable mirror failures**
- **Found during:** Task 2 strict terminal predicate wiring
- **Issue:** Existing manager methods logged stream, pipeline, and recording-save errors but returned success, which could falsely satisfy `capture_closed` or `durable_writes_succeeded`.
- **Fix:** Returned redacted typed failure facts to the stop orchestrator so terminal state becomes incomplete.
- **Files modified:** `frontend/src-tauri/src/audio/recording_manager.rs`, `frontend/src-tauri/src/audio/recording_commands.rs`
- **Verification:** Rust finalization tests and TypeScript build pass; complete remains gated on both booleans.
- **Committed in:** `35a600a`

**3. [Rule 2 - Missing Critical] Returned the authoritative snapshot through the Tauri command**
- **Found during:** Task 2 renderer integration
- **Issue:** The outer command discarded the Rust finalization result and short-circuited repeated stop calls before the idempotent native path could return the first durable snapshot.
- **Fix:** Changed the command result to `FinalizationSnapshot` and routed repeated calls through the serialized Rust stop protocol.
- **Files modified:** `frontend/src-tauri/src/lib.rs`
- **Verification:** Rust compilation and TypeScript compilation pass; renderer consumes the matching event payload.
- **Committed in:** `35a600a`

**4. [Rule 2 - Missing Critical] Kept transcription-model cleanup inside the declared bound**
- **Found during:** Task 2 resource-lifecycle review
- **Issue:** Replacing the legacy stop tail risked retaining the loaded native model after stop, while performing the old unbounded unload would violate finite-stop behavior.
- **Fix:** Preserved provider-aware model unloading under the same remaining finalization deadline without strengthening meeting lifecycle claims on cleanup success.
- **Files modified:** `frontend/src-tauri/src/audio/recording_commands.rs`
- **Verification:** Full finalization test filter passes after the refactor.
- **Committed in:** `1474d1e`

---

**Total deviations:** 4 auto-fixed (1 bug, 3 missing critical functionality)
**Impact on plan:** All fixes were required to keep terminal lifecycle claims honest and stop duration finite; no unrelated product scope was added.

## TDD Gate Compliance

- Task 1 RED evidence: `01-06-task1-red.json`, verified as `RED_EVIDENCE_OK`, then implemented in `3099dfa`.
- Task 2 RED evidence: `01-06-task2-red.json`, verified as `RED_EVIDENCE_OK`, then implemented in `35a600a` and refactored in `1474d1e`.
- Latest GREEN checks: 9 Rust finalization-filter tests pass, 4 Node evidence-contract tests pass, and TypeScript emits no errors.

## Issues Encountered

- The first GREEN build exposed a `String`/`anyhow::Error` boundary mismatch when recording-save failures became observable; it was converted explicitly and the suite passed.
- Existing unrelated Rust warnings remain unchanged; no workspace-wide formatting or cleanup was performed.

## Known Stubs

None. Stub-pattern matches were existing operational log text or intentional nullable state, not unwired plan output.

## User Setup Required

None. `TELU_FINALIZATION_DEADLINE_MS` is optional; when provided it must be a positive integer no greater than 1,800,000 ms and is recorded in the terminal snapshot.

## Next Phase Readiness

- Recovery can now distinguish clean completion from deadline, producer, evidence, worker, rejection, and durable-mirror failures using local persisted facts.
- Later baseline evaluation can vary the recorded deadline input and approve a release threshold from measured evidence rather than treating the experiment fallback as a product target.
- No blockers remain for the next Phase 01 plan.

## Self-Check: PASSED

- All declared implementation and summary files exist.
- All five RED/GREEN/refactor commits are present in git history.

---
*Phase: 01-baseline-observability-identity-and-trust-boundaries*
*Completed: 2026-09-20*
