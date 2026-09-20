---
phase: 01-baseline-observability-identity-and-trust-boundaries
plan: 03
subsystem: transcript-evidence-persistence
tags: [sqlite, sqlx, tauri, rust, transcript-evidence, idempotency, tdd]

requires:
  - phase: 01-baseline-observability-identity-and-trust-boundaries
    provides: Canonical Rust meeting identity and recoverable recording lifecycle
provides:
  - Final-only transcript evidence rows with stable source identity and recording-relative bounds
  - Transactional idempotent evidence upsert with immutable meeting/source attribution
  - Persist-before-canonical-publish worker flow with typed incomplete failure facts
affects: [transcription, recovery, evidence-attribution, live-assistance, knowledge-extraction]

actuals:
  tokens: 14389
  tasks: 2
  commits: 4
plan_head_before: 4086162fa4b2e1d08300290a142041968cd92af9

tech-stack:
  added: []
  patterns:
    - Stable transcript evidence identity enforced by SQLite and generated once in Rust
    - Canonical transcript publication sequenced strictly after durable transaction commit
    - Content-free typed failure facts for persistence failures

key-files:
  created:
    - frontend/src-tauri/migrations/20260920000200_phase1_transcript_evidence.sql
    - .planning/phases/01-baseline-observability-identity-and-trust-boundaries/01-03-task1-red.json
    - .planning/phases/01-baseline-observability-identity-and-trust-boundaries/01-03-task2-red.json
  modified:
    - frontend/src-tauri/src/database/models.rs
    - frontend/src-tauri/src/database/repositories/transcript.rs
    - frontend/src-tauri/src/audio/transcription/worker.rs
    - frontend/src-tauri/src/audio/recording_commands.rs
    - frontend/src-tauri/src/api/api.rs

key-decisions:
  - "A final segment is identified by its immutable evidence UUID and the stable meeting/source-track/source-segment tuple; sequence is ordering metadata only."
  - "Renderer-facing transcript output is canonical only when the evidence transaction has committed; partial output is explicitly provisional and non-citable."
  - "Persistence failures cross IPC as typed incomplete facts containing identity, bounds, and transcript length but never transcript content."

patterns-established:
  - "Persist before publish: durable evidence must exist before an event can claim canonical finality."
  - "Stable source retry: redelivery updates allowed transcript/timing/completeness metadata without creating a second logical row."
  - "Diagnostic minimization: transcript and search content stay out of logs; only lengths, IDs, and outcomes are recorded."

requirements-completed: [IDENT-02, BASE-02]

coverage:
  - id: D1
    description: "Final-only transcript evidence retains stable identity, source track and segment key, relative bounds, finality, and capture completeness across redelivery."
    requirement: IDENT-02
    verification:
      - kind: integration
        ref: "cargo test --manifest-path frontend/src-tauri/Cargo.toml transcript_evidence_repository --lib -- --nocapture"
        status: pass
    human_judgment: false
  - id: D2
    description: "Canonical transcript publication follows a committed evidence write, failure suppresses the durable claim, and partial output remains provisional."
    requirement: BASE-02
    verification:
      - kind: integration
        ref: "cargo test --manifest-path frontend/src-tauri/Cargo.toml transcript_evidence --lib -- --nocapture"
        status: pass
      - kind: other
        ref: "cargo check --manifest-path frontend/src-tauri/Cargo.toml"
        status: pass
    human_judgment: false

duration: 19min
completed: 2026-09-20
status: complete
---

# Phase 01 Plan 03: Stable Transcript Evidence Summary

**Final transcript segments now become canonical only after an idempotent SQLite evidence write commits, while partials remain provisional and write failures produce content-free typed incomplete facts.**

## Performance

- **Duration:** 19 min
- **Started:** 2026-09-20T19:01:56Z
- **Completed:** 2026-09-20T19:20:04Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Added a forward-only final-evidence schema with stable UUID identity, meeting/source attribution, relative audio bounds, finality, completeness, and a unique logical source key.
- Implemented a transactional repository upsert that validates identity and bounds, updates only allowed metadata, and preserves one logical row across redelivery.
- Wired the active transcription worker to persist each final before canonical publication while keeping partial events explicitly non-canonical and without an evidence ID.
- Added a typed incomplete failure event that suppresses canonical publication and exposes no transcript content.
- Removed transcript and search text samples from the touched diagnostic paths while retaining useful lengths, identifiers, and outcomes.

## Task Commits

Each TDD phase was committed atomically:

1. **Task 1 RED: final-evidence repository contract tests** - `970b839` (test)
2. **Task 1 GREEN: stable final transcript evidence storage** - `e7bf444` (feat)
3. **Task 2 RED: evidence publication ordering and failure tests** - `2176fdc` (test)
4. **Task 2 GREEN: persist-before-publish worker integration** - `4e08004` (feat)

## Files Created/Modified

- `frontend/src-tauri/migrations/20260920000200_phase1_transcript_evidence.sql` - Defines final-only evidence storage, immutable identity fields, logical uniqueness, bounds checks, and meeting-order index.
- `frontend/src-tauri/src/database/models.rs` - Adds `TranscriptEvidence`, `TranscriptEvidenceInput`, and typed `CaptureCompleteness` projections.
- `frontend/src-tauri/src/database/repositories/transcript.rs` - Validates and transactionally upserts final evidence with idempotent allowed metadata updates.
- `frontend/src-tauri/src/audio/transcription/worker.rs` - Carries evidence fields, persists finals before canonical events, keeps partials provisional, and emits typed incomplete failure facts.
- `frontend/src-tauri/src/audio/recording_commands.rs` - Threads the committed meeting ID and shared database pool into both active transcription start paths.
- `frontend/src-tauri/src/api/api.rs` - Removes transcript/search samples and user-controlled meeting titles from touched diagnostic logs.
- `.planning/phases/01-baseline-observability-identity-and-trust-boundaries/01-03-task1-red.json` - Records verified intentional RED evidence for the repository contract.
- `.planning/phases/01-baseline-observability-identity-and-trust-boundaries/01-03-task2-red.json` - Records verified intentional RED evidence for the worker publication contract.

## Decisions Made

- Evidence UUIDs and the meeting/source-track/source-segment tuple are immutable identity; sequence is never used as an identity substitute.
- Only a repository-returned committed row can promote a worker DTO to final canonical evidence.
- Persistence errors produce an explicit incomplete fact with stable machine code and metadata, never a transcript-bearing log or a false durable claim.

## TDD Gate Compliance

- **Task 1 RED:** Three named repository assertions failed intentionally because no evidence table or repository contract existed. The artifact passed `tdd-red-evidence` with the target test failed.
- **Task 1 GREEN:** The focused repository suite passed 3/3, proving existing-meeting insertion, single-row redelivery, identity preservation, allowed metadata correction, and partial rejection.
- **Task 2 RED:** Three named worker assertions failed intentionally because canonical publication did not wait for persistence, no typed failure fact existed, and partial DTOs had no explicit non-citable state. The artifact passed `tdd-red-evidence` with the target test failed.
- **Task 2 GREEN:** The focused evidence suite passed 6/6, including behavioral ordering, failure suppression, typed incomplete metadata, and provisional partial state.
- **Final:** The combined evidence suite passed 6/6, `cargo check` completed successfully, and the touched diagnostic scan found no transcript/search content logged by the changed paths.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Threaded evidence context through recording command call sites**
- **Found during:** Task 2 (persist final evidence before canonical publication)
- **Issue:** The planned worker boundary could not persist under the existing meeting identity because its public start function received neither the shared SQLite pool nor the committed meeting ID.
- **Fix:** Passed the existing pool and `StartMeetingResult.meeting_id` through both recording start call sites without minting, remapping, or inferring identity.
- **Files modified:** `frontend/src-tauri/src/audio/recording_commands.rs`
- **Verification:** The focused evidence suite passes 6/6 and `cargo check` succeeds.
- **Committed in:** `4e08004`

---

**Total deviations:** 1 auto-fixed (1 blocking integration issue)
**Impact on plan:** The added call-site wiring is the minimum required to make the planned durability boundary reachable; it adds no dependency or architectural layer.

## Issues Encountered

- Context7 was unavailable in this executor environment, so current SQLx transaction and SQLite UPSERT behavior was checked against primary official documentation before implementation.
- `cargo check` reports existing unused import, variable, and dead-code warnings outside this plan's changes; the command still completes successfully.

## Known Stubs

None. The changed-source scan found no TODO, FIXME, placeholder, unavailable, or empty UI-bound value introduced by this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Recovery and later knowledge features can cite stable, final-only transcript evidence during an active meeting.
- Canonical event consumers can trust that a visible final has a committed evidence row and can treat partials as non-citable UI state.
- Typed incomplete failure facts make persistence gaps observable without disclosing meeting content.
- No blocker remains for subsequent Phase 01 plans.

## Self-Check: PASSED

All declared implementation files exist, all four TDD task commit hashes resolve, the persisted plan ledger reports four commits, and the working diff passes `git diff --check`.

---
*Phase: 01-baseline-observability-identity-and-trust-boundaries*
*Completed: 2026-09-20*
