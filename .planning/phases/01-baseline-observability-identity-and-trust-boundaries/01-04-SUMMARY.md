---
phase: 01-baseline-observability-identity-and-trust-boundaries
plan: 04
subsystem: renderer-evidence-observability
tags: [react, indexeddb, tauri, rust, transcript-evidence, monotonic-timing, tdd]

requires:
  - phase: 01-baseline-observability-identity-and-trust-boundaries
    provides: Durable final transcript evidence with stable identity and persist-before-publish ordering
provides:
  - Canonical final-evidence identity preserved through React state and IndexedDB recovery
  - Provisional transcript state structurally excluded from durable recovery evidence
  - Single-use correlated renderer acknowledgement measured exclusively with Rust Instant
affects: [transcription, recovery, live-assistance, evidence-attribution, latency-evaluation]

actuals:
  tokens: 13062
  tasks: 2
  commits: 4
plan_head_before: 3de653f3a66e2b0b83b853efe691643074fad767

tech-stack:
  added: []
  patterns:
    - Canonical React and IndexedDB records reuse Rust evidence identity without renderer remapping
    - Delivery tokens are opaque, single-use, time-limited, and bound to meeting/evidence identity
    - Renderer acknowledgement follows React commit plus animation-frame scheduling without claiming physical pixel proof

key-files:
  created:
    - .github/verify-phase1-evidence-contract.test.cjs
    - .planning/phases/01-baseline-observability-identity-and-trust-boundaries/01-04-task1-red.json
    - .planning/phases/01-baseline-observability-identity-and-trust-boundaries/01-04-task2-red.json
  modified:
    - frontend/src/services/transcriptService.ts
    - frontend/src/contexts/TranscriptContext.tsx
    - frontend/src/services/indexedDBService.ts
    - frontend/src-tauri/src/audio/recording_commands.rs
    - frontend/src-tauri/src/audio/transcription/worker.rs
    - frontend/src-tauri/src/lib.rs

key-decisions:
  - "Canonical React and IndexedDB transcript records use the Rust evidence UUID; legacy auto-increment transcript cache entries remain separate and are never promoted into evidence."
  - "ui_acknowledged means a correlated post-React-commit animation-frame callback, not proof that a physical pixel was observed."
  - "The Rust delivery token is minted inside the canonical emit closure after evidence persistence succeeds, preserving the persisted-before-publish invariant."

patterns-established:
  - "Stable recovery projection: reload retains evidence ID, meeting ID, source track/segment, relative bounds, and completeness."
  - "One-shot delivery timing: a valid acknowledgement consumes its token; unknown, duplicate, stale, or identity-mismatched requests cannot create a duration."
  - "Phase-owned stage vocabulary: Phase 4 context/generation/cancellation/supersession/visibility names are reserved but rejected in Phase 1."

requirements-completed: [IDENT-02, BASE-02]

coverage:
  - id: D1
    description: "React and IndexedDB preserve Rust-owned final evidence identity and metadata while provisional transcript text remains noncanonical and absent from recovery evidence."
    requirement: IDENT-02
    verification:
      - kind: integration
        ref: "node --test .github/verify-phase1-evidence-contract.test.cjs"
        status: pass
      - kind: other
        ref: "pnpm --dir frontend build"
        status: pass
    human_judgment: false
  - id: D2
    description: "Each canonical final delivery can produce one Rust-clock ui_acknowledged duration correlated to its meeting and evidence identity after React commits it."
    requirement: BASE-02
    verification:
      - kind: unit
        ref: "cargo test --manifest-path frontend/src-tauri/Cargo.toml ui_acknowledgement --lib -- --nocapture"
        status: pass
      - kind: integration
        ref: "cargo test --manifest-path frontend/src-tauri/Cargo.toml transcript_evidence --lib -- --nocapture"
        status: pass
      - kind: other
        ref: "pnpm --dir frontend build"
        status: pass
    human_judgment: false

duration: 23min
completed: 2026-09-20
status: complete
---

# Phase 01 Plan 04: Renderer Evidence and Acknowledgement Summary

**Rust-owned final evidence now survives renderer reload unchanged, while an opaque one-shot token closes each canonical delivery with a correlated Rust-clock post-commit acknowledgement.**

## Performance

- **Duration:** 23 min
- **Started:** 2026-09-20T19:25:19Z
- **Completed:** 2026-09-20T19:47:48Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Introduced discriminated provisional/final frontend DTOs and used the Rust evidence UUID as the canonical React and recovery identity.
- Added an IndexedDB v3 final-evidence store with a stable evidence key, unique meeting/source/segment index, and idempotent `put`, leaving legacy display cache data isolated.
- Added a Rust-owned delivery tracker whose unguessable tokens are bound to meeting/evidence identity, expire, and are consumed by the first valid acknowledgement.
- Acknowledged only after React commits a canonical final and schedules the next animation frame, measuring the interval exclusively with Rust `Instant` and labeling it `ui_acknowledged`.
- Preserved the prior persistence-before-publication boundary by minting and attaching delivery tokens only inside the successful canonical emit closure.

## Task Commits

Each TDD phase was committed atomically:

1. **Task 1 RED: frontend evidence/finality contract guard** - `5ac1d15` (test)
2. **Task 1 GREEN: canonical renderer and IndexedDB recovery semantics** - `880d302` (feat)
3. **Task 2 RED: renderer acknowledgement contract tests** - `3dd2c38` (test)
4. **Task 2 GREEN: Rust-clock delivery acknowledgement integration** - `bf4146b` (feat)

## Files Created/Modified

- `.github/verify-phase1-evidence-contract.test.cjs` - Guards provisional isolation, stable final-evidence keys, and complete reload projection.
- `frontend/src/services/transcriptService.ts` - Defines discriminated transcript DTOs, validates canonical finality/token fields, and invokes the typed acknowledgement command.
- `frontend/src/contexts/TranscriptContext.tsx` - Projects Rust identities into React state, persists finals only, reloads stable metadata, and acknowledges from a post-commit animation-frame callback.
- `frontend/src/services/indexedDBService.ts` - Adds the stable final-evidence object store and idempotent save/read API without promoting legacy cache rows.
- `frontend/src-tauri/src/audio/recording_commands.rs` - Owns delivery tokens, correlations, monotonic timing, validation, rejection, and the Tauri acknowledgement command.
- `frontend/src-tauri/src/audio/transcription/worker.rs` - Carries the optional token field and routes only committed canonical finals through the tokenizing emitter.
- `frontend/src-tauri/src/lib.rs` - Registers `acknowledge_transcript_visible` with the Tauri invoke handler.
- `.planning/phases/01-baseline-observability-identity-and-trust-boundaries/01-04-task1-red.json` - Records validated intentional RED evidence for frontend finality and recovery behavior.
- `.planning/phases/01-baseline-observability-identity-and-trust-boundaries/01-04-task2-red.json` - Records validated intentional RED evidence for acknowledgement correlation and rejection behavior.

## Decisions Made

- A final transcript becomes canonical in the renderer only when all Rust-owned identity, source, bound, completeness, and delivery-token fields are present; malformed final events are not strengthened into evidence.
- Legacy auto-increment transcript rows remain available only through the legacy store and are not migrated into the stable final-evidence store because doing so would invent canonical identity.
- The endpoint metric is deliberately named `ui_acknowledged`: React commit plus animation-frame scheduling is measurable, while physical display visibility is not.
- A correlation mismatch does not consume the token, allowing the legitimate renderer to acknowledge it; a valid acknowledgement or stale-token rejection removes it.

## TDD Gate Compliance

- **Task 1 RED:** Three named Node contract tests failed intentionally because the frontend lacked discriminated finality, stable evidence-key storage, and complete reload projection. The RED artifact passed `tdd-red-evidence`.
- **Task 1 GREEN:** The Node guard passed 3/3 and the frontend production build compiled all DTO, context, and IndexedDB consumers.
- **Task 2 RED:** Three focused Rust contract tests failed intentionally because no delivery tracker, rejection contract, or post-commit renderer acknowledgement existed. The RED artifact passed `tdd-red-evidence`.
- **Task 2 GREEN:** The focused acknowledgement suite passed 3/3, including correlation, one-shot consumption, stale/unknown/mismatch rejection, and reserved-stage rejection.
- **Final:** The prior transcript evidence suite passed 6/6, the frontend production build succeeded, and `git diff --check` reported no whitespace errors.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Routed the worker's canonical emit through the delivery tracker**
- **Found during:** Task 2 (close the monotonic path with renderer acknowledgement)
- **Issue:** The plan named the command and renderer files, but the actual post-persistence canonical event was emitted directly in `worker.rs`; attaching a token anywhere earlier would weaken the persistence-before-publish invariant.
- **Fix:** Added the token field to the worker DTO and replaced only the successful canonical emit closure with `emit_canonical_transcript`, which registers the token after the evidence transaction returns successfully and discards it if IPC emission fails.
- **Files modified:** `frontend/src-tauri/src/audio/transcription/worker.rs`
- **Verification:** The acknowledgement suite passes 3/3 and the prior persistence-ordering evidence suite passes 6/6.
- **Committed in:** `bf4146b`

---

**Total deviations:** 1 auto-fixed (1 blocking integration issue)
**Impact on plan:** The worker change is the minimum integration needed to place token creation on the correct side of the existing durability boundary; it adds no new dependency or architecture.

## Issues Encountered

- The Rust crate has pre-existing repository-wide formatting drift. Only the task-owned semantic edits were retained; unrelated formatter changes were discarded before verification and commit.
- Focused Rust verification reports existing unused-import, unused-variable, dead-code, and comparison warnings outside this plan's changes; all required tests pass.

## Known Stubs

None. The changed-file scan found no TODO, FIXME, placeholder, unavailable, or empty UI-bound value introduced by this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Final transcript evidence can be replayed and reloaded without identity multiplication or provisional promotion.
- Later latency evaluation can use the content-free `ui_acknowledged` endpoint as the Phase 1 renderer scheduling boundary.
- Phase 4 stage names remain unmeasured and unavailable, preventing later pipeline work from being implied by Phase 1 telemetry.
- No blocker remains for subsequent Phase 01 plans.

## Self-Check: PASSED

All nine declared implementation/test artifacts and the summary exist, all four TDD task commit hashes resolve, the persisted plan ledger measures four commits, and the working diff passes `git diff --check`.

---
*Phase: 01-baseline-observability-identity-and-trust-boundaries*
*Completed: 2026-09-20*
