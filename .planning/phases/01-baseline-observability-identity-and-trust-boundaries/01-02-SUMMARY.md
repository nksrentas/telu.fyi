---
phase: 01-baseline-observability-identity-and-trust-boundaries
plan: 02
subsystem: recording-recovery-persistence
tags: [sqlite, sqlx, tauri, rust, indexeddb, typescript, meeting-identity, tdd]

requires:
  - phase: 01-baseline-observability-identity-and-trust-boundaries
    provides: Transactional Rust-owned meeting identity committed before capture
provides:
  - UUID-owned recording directories and first-write metadata tied to the canonical meeting ID
  - Versioned IndexedDB recovery projection that preserves legacy keys and explicit uncertainty
  - Typed SQLx lifecycle/completeness projection with fresh and legacy migration coverage
affects: [recording-recovery, evidence-attribution, observability, meeting-lifecycle]

actuals:
  tokens: 9800
  tasks: 2
  commits: 4
plan_head_before: d2305f187c8b2e777b32ec6814459486e926511b

tech-stack:
  added: []
  patterns:
    - Canonical UUID as the only filesystem and recovery-cache identity authority
    - Typed SQLx text enums for lifecycle and completeness across fresh and migrated rows
    - Recovery mirrors inherit durable state and never promote lifecycle independently

key-files:
  created:
    - frontend/src-tauri/tests/meeting_identity_migration.rs
    - .planning/phases/01-baseline-observability-identity-and-trust-boundaries/01-02-task1-red.json
    - .planning/phases/01-baseline-observability-identity-and-trust-boundaries/01-02-task2-red.json
  modified:
    - frontend/src-tauri/src/audio/recording_saver.rs
    - frontend/src-tauri/src/audio/recording_manager.rs
    - frontend/src-tauri/src/audio/recording_commands.rs
    - frontend/src-tauri/src/database/models.rs
    - frontend/src-tauri/src/database/repositories/meeting.rs
    - frontend/src/services/indexedDBService.ts
    - frontend/src/contexts/TranscriptContext.tsx
    - frontend/src-tauri/build.rs

key-decisions:
  - "The committed Rust UUID is required before RecordingSaver can create a directory or metadata file; titles remain display metadata only."
  - "Filesystem and IndexedDB mirrors copy lifecycle/completeness from the durable start payload and cannot declare a meeting complete independently."
  - "Historical cache and SQLite records preserve their IDs while remaining explicitly completion_not_verified with reason legacy_pre_phase1."

patterns-established:
  - "Identity before mirror: configure recording and recovery mirrors only after the SQLite identity transaction commits."
  - "Path authority: use a validated UUID directory component and keep user-controlled titles out of storage identity."
  - "Conservative migration: preserve historical identity and content while projecting missing evidence as typed uncertainty."

requirements-completed: [IDENT-01, BASE-05]

coverage:
  - id: D1
    description: "Recording folders, metadata, and IndexedDB recovery entries reuse the canonical Rust meeting ID from their first write, including collision-safe same-title meetings."
    requirement: IDENT-01
    verification:
      - kind: integration
        ref: "cargo test --manifest-path frontend/src-tauri/Cargo.toml meeting_identity_propagation --lib -- --nocapture"
        status: pass
      - kind: other
        ref: "pnpm --dir frontend build"
        status: pass
    human_judgment: false
  - id: D2
    description: "Fresh and legacy databases deserialize the same typed lifecycle projection, preserve historical IDs and folder paths, and expose completion as unverified."
    requirement: BASE-05
    verification:
      - kind: integration
        ref: "cargo test --manifest-path frontend/src-tauri/Cargo.toml --test meeting_identity_migration -- --nocapture"
        status: pass
      - kind: integration
        ref: "cargo test --manifest-path frontend/src-tauri/Cargo.toml meeting_identity --lib -- --nocapture"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-09-20
status: complete
---

# Phase 01 Plan 02: Canonical Identity Mirrors Summary

**Canonical Rust meeting identity now owns recording paths, first-write metadata, typed SQLite projection, and versioned IndexedDB recovery without allowing any mirror to promote lifecycle state.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-09-20T18:37:01Z
- **Completed:** 2026-09-20T18:56:41Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments

- Replaced title-and-minute recording identity with a validated canonical UUID directory and required the durable lifecycle projection in the first metadata write.
- Upgraded IndexedDB in place so Rust IDs key new records while legacy records keep their keys and receive explicit legacy/unverified state.
- Added typed SQLx lifecycle/completeness fields to `MeetingModel`, migration-directory build invalidation, and representative fresh/legacy database integration tests.
- Preserved same-title meeting isolation, historical IDs, titles, timestamps, and folder paths across recovery and migration.

## Task Commits

Each TDD phase was committed atomically:

1. **Task 1 RED: recording and recovery identity propagation tests** - `d1822b4` (test)
2. **Task 1 GREEN: canonical identity in recording and recovery mirrors** - `d469d35` (feat)
3. **Task 2 RED: typed fresh/legacy migration tests** - `b5e4916` (test)
4. **Task 2 GREEN: typed meeting projection and migration rebuild tracking** - `39339b4` (feat)

## Files Created/Modified

- `frontend/src-tauri/src/audio/recording_saver.rs` - Requires the canonical ID and durable state before directory or metadata creation; tests first-write identity and collision behavior.
- `frontend/src-tauri/src/audio/recording_manager.rs` - Configures the saver with the committed meeting projection before capture begins.
- `frontend/src-tauri/src/audio/audio_processing.rs` - Threads committed meeting metadata into recording startup.
- `frontend/src-tauri/src/audio/recording_commands.rs` - Carries the committed start result into the capture closure and renderer projection.
- `frontend/src/services/indexedDBService.ts` - Bumps the database version, upgrades legacy records conservatively, and keys new records by Rust ID.
- `frontend/src/contexts/TranscriptContext.tsx` - Sends the Rust-owned lifecycle projection to the recovery cache.
- `frontend/src-tauri/src/database/models.rs` - Defines typed SQLx lifecycle/completeness enums and extends `MeetingModel`.
- `frontend/src-tauri/src/database/repositories/meeting.rs` - Projects all typed meeting fields through repository queries.
- `frontend/src-tauri/src/api/api.rs` - Keeps API-side `MeetingModel` queries compatible with the typed projection.
- `frontend/src-tauri/build.rs` - Rebuilds the embedded migration artifact when the migration directory changes.
- `frontend/src-tauri/tests/meeting_identity_migration.rs` - Proves fresh projection, legacy identity preservation, uncertainty, and build invalidation.
- `.planning/phases/01-baseline-observability-identity-and-trust-boundaries/01-02-task1-red.json` - Verified Task 1 intentional RED evidence.
- `.planning/phases/01-baseline-observability-identity-and-trust-boundaries/01-02-task2-red.json` - Verified Task 2 intentional RED evidence.

## Decisions Made

- The UUID returned by committed SQLite persistence is the sole identity used by native recording paths and renderer recovery keys.
- Metadata mirrors must receive lifecycle, completeness, and reason together; a file or browser cache is never allowed to infer completion.
- Legacy records remain usable under their original IDs and paths, but lack of historical evidence is surfaced as `completion_not_verified` rather than guessed.

## TDD Gate Compliance

- **Task 1 RED:** Three named propagation assertions failed intentionally because metadata permitted a missing ID, titles owned paths, and IndexedDB lacked a conservative upgrade. Evidence passed `tdd-red-evidence` with the target test failed.
- **Task 1 GREEN:** The focused propagation suite passed 5/5 and the production frontend build completed successfully.
- **Task 2 RED:** Three named migration assertions failed intentionally because `MeetingModel` lacked typed lifecycle fields and the build script did not track migrations. Evidence passed `tdd-red-evidence` with the target test failed.
- **Task 2 GREEN:** The migration integration target passed 3/3, covering fresh state, representative legacy upgrade, and migration build invalidation.
- **Final:** Propagation passed 5/5, migration passed 3/3, the full identity-filtered library suite passed 15/15, `pnpm --dir frontend build` passed, and `cargo check` completed successfully.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Threaded the committed start projection through the command and renderer integration**
- **Found during:** Task 1 (canonical ID in recording metadata and recovery cache)
- **Issue:** The plan-listed saver and cache could not receive canonical identity before their first writes unless the committed `StartMeetingResult` also crossed the surrounding command closure and renderer call site.
- **Fix:** Passed the committed result into recording startup and projected its identity/lifecycle fields into IndexedDB without minting or remapping an ID.
- **Files modified:** `frontend/src-tauri/src/audio/recording_commands.rs`, `frontend/src/contexts/TranscriptContext.tsx`
- **Verification:** Propagation tests pass 5/5 and the frontend production build passes.
- **Committed in:** `d469d35`

**2. [Rule 3 - Blocking] Updated all active `MeetingModel` projections for required typed fields**
- **Found during:** Task 2 (typed projection and forward migration)
- **Issue:** Extending `MeetingModel` made older explicit column lists incomplete, blocking deserialization at repository and API query sites.
- **Fix:** Updated the narrow active projections to select the complete migrated meeting row so lifecycle, completeness, reason, and UTC start are always available.
- **Files modified:** `frontend/src-tauri/src/database/repositories/meeting.rs`, `frontend/src-tauri/src/api/api.rs`
- **Verification:** Migration tests pass 3/3, the identity-filtered library suite passes 15/15, and `cargo check` passes.
- **Committed in:** `39339b4`

---

**Total deviations:** 2 auto-fixed (2 blocking integration issues)
**Impact on plan:** Both changes were the minimum required to connect the planned identity and typed-projection contracts through existing call sites; no new dependency or architecture was introduced.

## Issues Encountered

- A scoped formatter invocation unexpectedly touched Rust files across the workspace. The pre-command status was used as the authoritative boundary, every formatter-only change outside the four intended Rust patches was restored to HEAD, and the functional patches were reapplied and reverified. No unrelated or user-owned path was changed.
- `cargo check` reports existing unused import, variable, and dead-code warnings outside this plan's changes; the command still completed successfully.

## Known Stubs

None. The changed-source scan found no TODO, FIXME, placeholder, unavailable, or empty UI-bound values introduced by this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Native recording, SQLite, and browser recovery now share one durable identity suitable for later evidence and observability correlation.
- Historical rows and caches retain identity while exposing uncertainty honestly, so later reconciliation can operate without hidden completion claims.
- No blocker remains for subsequent Phase 01 plans.

## Self-Check: PASSED

All declared implementation files exist, all four TDD task commit hashes resolve, the persisted plan ledger reports four commits, and the working diff passes `git diff --check`.

---
*Phase: 01-baseline-observability-identity-and-trust-boundaries*
*Completed: 2026-09-20*
