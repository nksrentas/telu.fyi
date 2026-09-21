---
phase: 01-baseline-observability-identity-and-trust-boundaries
plan: 13
subsystem: canary-egress-control
tags: [rust, tauri, react, updater, analytics, privacy, outbound-attribution, tdd]

requires:
  - phase: 01-baseline-observability-identity-and-trust-boundaries/01-12
    provides: Bounded fail-closed outbound attempt ledger and analytics/provider attribution
provides:
  - Run-scoped canary mode with reversible active-ledger replacement and retained evidence
  - Pre-initialization analytics and updater gating with recorded suppressed or permitted decisions
  - Read-only startup policy that preserves persistent consent, update, and provider settings
affects: [phase-01-evaluation, network-canary, provider-diagnostics, updater, analytics]

actuals:
  tokens: 9996
  tasks: 2
  commits: 4
plan_head_before: 89e2e32dcfa1168ad410a4e61c1a8d2cce9b7e6a

tech-stack:
  added: []
  patterns:
    - A run-scoped canary swaps only the active in-memory ledger and restores the previous process ledger on stop
    - Background services record their suppress or permit decision before network-capable initialization or dispatch
    - Frontend startup reads canary policy before loading stores that can migrate persistent settings

key-files:
  created:
    - .planning/phases/01-baseline-observability-identity-and-trust-boundaries/01-13-task1-red.json
    - .planning/phases/01-baseline-observability-identity-and-trust-boundaries/01-13-task2-red.json
  modified:
    - frontend/src-tauri/src/trust/outbound.rs
    - frontend/src-tauri/src/trust/provider_route.rs
    - frontend/src-tauri/src/trust/mod.rs
    - frontend/src-tauri/src/lib.rs
    - frontend/src/services/providerRouteService.ts
    - frontend/src/components/AnalyticsProvider.tsx
    - frontend/src/services/updateService.ts

key-decisions:
  - "Canary start replaces the process-active ledger with a bounded run ledger; stop restores the prior ledger while completed evidence remains queryable by run ID."
  - "Automatic analytics and updater work is suppressed by default; manual updater work or explicitly permitted background work records a canary decision before dispatch."
  - "Analytics startup reads active canary state before loading its store and skips all canary-time persistent-setting migrations."
  - "Telu reports application intent only; the OS or proxy method selected in Plan 19 remains authoritative for packets."

patterns-established:
  - "Canary policy, evidence write, and stop-time snapshot/restore share one runtime lock so an allowed dispatch cannot outrun its evidence."
  - "React Strict Mode startup effects use an attempt guard so one mount produces one policy decision."

requirements-completed: [PRIV-03]

coverage:
  - id: D1
    description: Canary mode is tied to one run, queryable while active and after completion, and restores the prior process behavior without persistent-setting mutation.
    requirement: PRIV-03
    verification:
      - kind: unit
        ref: "cargo test --manifest-path frontend/src-tauri/Cargo.toml canary_mode --lib -- --nocapture"
        status: pass
    human_judgment: false
  - id: D2
    description: Analytics and updater consult canary policy before network-capable initialization, suppress automatic traffic by default, and record every permitted decision before dispatch.
    requirement: PRIV-03
    verification:
      - kind: integration
        ref: "cargo test --manifest-path frontend/src-tauri/Cargo.toml canary_background --lib -- --nocapture"
        status: pass
      - kind: build
        ref: "pnpm --dir frontend build"
        status: pass
    human_judgment: false
  - id: D3
    description: Canary diagnostics distinguish application-level suppression from the OS or proxy packet blocker selected in Plan 19.
    requirement: PRIV-03
    verification:
      - kind: source-contract
        ref: "trust::outbound::tests::canary_background_copy_names_packet_authority_and_preserves_normal_behavior"
        status: pass
    human_judgment: false

duration: 21m
completed: 2026-09-21
status: complete
---

# Phase 01 Plan 13: Canary Startup Control Summary

**A reversible run-scoped canary now gates analytics and updater startup before network-capable work, records suppressed and permitted decisions in the outbound ledger, and leaves persistent user choices untouched.**

## Performance

- **Duration:** 21m
- **Started:** 2026-09-21T08:19:32Z
- **Completed:** 2026-09-21T08:40:42Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Added typed Tauri commands and frontend wrappers to start, stop, inspect, and evaluate background attempts for one bounded canary run.
- Replaced only the process-active outbound ledger during a canary, restored the prior ledger on exit, and retained completed evidence for later reconciliation.
- Recorded updater and analytics suppression or permission before network-capable work; automatic work is suppressed by default while a manual updater check remains explicit and attributable.
- Moved analytics canary lookup ahead of store loading so even existing migration writes cannot mutate persistent settings during the run.
- Serialized evidence recording with stop-time snapshot and restoration so a permitted dispatch cannot race ahead of its ledger record.
- Added diagnostics that state the selected OS or proxy method is authoritative for packets, avoiding a false claim that UI suppression is a physical blocker.

## Task Commits

Each TDD task was committed in RED/GREEN sequence:

1. **Task 1 RED: canary mode contracts** - `d3ec5b7` (test)
2. **Task 1 GREEN: run-scoped canary policy** - `5c26b8b` (feat)
3. **Task 2 RED: background startup gate contracts** - `694bbe9` (test)
4. **Task 2 GREEN: analytics and updater startup gates** - `e73cea8` (feat)

## Files Created/Modified

- `frontend/src-tauri/src/trust/outbound.rs` - Owns canary runtime state, bounded per-run evidence, lifecycle commands, and serialized background-attempt decisions.
- `frontend/src-tauri/src/trust/provider_route.rs` - Adds an updater capability so update decisions retain a distinct sanitized route identity.
- `frontend/src-tauri/src/trust/mod.rs` and `frontend/src-tauri/src/lib.rs` - Export and register the typed canary commands in the active Tauri core.
- `frontend/src/services/providerRouteService.ts` - Exposes typed start, stop, query, and background-decision wrappers to the desktop UI.
- `frontend/src/components/AnalyticsProvider.tsx` - Checks canary state before store loading or SDK initialization, suppresses automatic startup by default, and avoids duplicate Strict Mode decisions.
- `frontend/src/services/updateService.ts` - Evaluates canary policy before updater plugin checks and keeps manual checks explicit and attributable.
- `01-13-task1-red.json` and `01-13-task2-red.json` - Preserve verified intentional RED evidence for both TDD tasks.
- `deferred-items.md` - Records an unrelated pre-existing TypeScript test-fixture drift discovered during supplemental verification.

## Decisions Made

- Kept canary policy in memory and run-scoped; no provider, analytics, or updater preference is repurposed as temporary test state.
- Retained completed snapshots by run ID and rejected missing or incomplete evidence rather than treating absence as proof of no egress.
- Recorded intended analytics and updater destinations without performing DNS before the policy decision, preserving canary-before-network ordering.
- Allowed manual updater checks during a canary only as explicit permitted evidence, while preserving normal manual and opt-in behavior outside canary mode.
- Held the canary runtime lock through policy recording so stop cannot snapshot and restore before an allowed attempt is attributable.

## TDD Gate Compliance

- **Task 1 RED:** Three lifecycle, persistent-setting-integrity, and policy-evidence tests failed against intentional canary stubs; `01-13-task1-red.json` returns `RED_EVIDENCE_OK` with the target assertion failure.
- **Task 1 GREEN:** All three `canary_mode` tests pass, including restoration and byte-for-byte persistent-setting checks.
- **Task 2 RED:** Three startup-order, automatic-suppression, and normal-behavior source contracts failed before frontend gating was implemented; `01-13-task2-red.json` returns `RED_EVIDENCE_OK`.
- **Task 2 GREEN:** All three `canary_background` tests and the production Next.js static export pass. The existing outbound ledger and attribution suites also remain green.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added a distinct updater route capability**
- **Found during:** Task 1 (Add run-scoped canary policy and commands)
- **Issue:** The existing route contract represented analytics and model providers but had no updater identity, so updater policy evidence could not be attributed accurately.
- **Fix:** Added `Capability::Updater` with a fixed sanitized updater origin used only to record application intent before dispatch; no DNS or request occurs during policy evaluation.
- **Files modified:** `frontend/src-tauri/src/trust/provider_route.rs`, `frontend/src-tauri/src/trust/outbound.rs`
- **Verification:** `canary_mode`, `canary_background`, and the production frontend build pass.
- **Committed in:** `d3ec5b7`, `5c26b8b`

**2. [Rule 3 - Blocking] Registered canary commands in the active Tauri application**
- **Found during:** Task 1 (Add run-scoped canary policy and commands)
- **Issue:** The plan named the Rust policy and TypeScript wrapper, but the commands would not be reachable unless the trust module exported them and the application registered them.
- **Fix:** Exported the outbound canary API and registered start, stop, query, and evaluation commands in the Tauri invoke handler.
- **Files modified:** `frontend/src-tauri/src/trust/mod.rs`, `frontend/src-tauri/src/lib.rs`
- **Verification:** `cargo check` and all focused canary tests pass.
- **Committed in:** `5c26b8b`

**3. [Rule 2 - Missing Critical] Prevented analytics setting migration during an active canary**
- **Found during:** Task 2 (Gate updater and analytics before initialization)
- **Issue:** Checking policy after the analytics store loaded could still run default-off migration writes, violating the byte-for-byte persistent-settings requirement before SDK initialization was considered.
- **Fix:** Loaded active canary state first and skipped analytics store migration and persistence entirely while the run is active.
- **Files modified:** `frontend/src/components/AnalyticsProvider.tsx`
- **Verification:** The source-contract test asserts policy lookup precedes store access and the production frontend build passes.
- **Committed in:** `e73cea8`

---

**Total deviations:** 3 auto-fixed correctness and integration gaps.
**Impact on plan:** The changes make the planned trust boundary enforceable and attributable without adding dependencies, persistence, endpoints, or provider fallback.

## Issues Encountered

- Supplemental `pnpm --dir frontend exec tsc --noEmit` remains blocked by a pre-existing fixture in `tests/hooks/paginated-transcripts.test.tsx` that lacks newer lifecycle, completeness, gap-count, and gaps fields. The production `pnpm --dir frontend build` required by this plan passes, and the unrelated fixture drift is recorded in `deferred-items.md`.
- Rust verification emits existing warnings in unrelated audio, build-script, and summary code. No new compiler errors or task-blocking warnings were introduced.

## Known Stubs

None. Touched-file scans found no TODOs, FIXMEs, skipped tests, placeholder text, or intentional RED stubs remaining in production code.

## User Setup Required

None.

## Next Phase Readiness

- Plan 14 can orchestrate a Local-only application canary through typed commands and reconcile the retained per-run evidence.
- Plan 19 still selects and validates the OS or proxy mechanism that is authoritative for physical packet blocking; application suppression is deliberately not presented as that blocker.
- Missing, overflowed, or otherwise incomplete canary evidence fails explicitly, so a future evaluation cannot interpret an empty result as proof of zero egress.

## Self-Check: PASSED

- The Rust canary runtime, Tauri registrations, all three frontend gates/wrappers, both RED-evidence records, and this summary exist on disk.
- Task commits `d3ec5b7`, `5c26b8b`, `694bbe9`, and `e73cea8` resolve in git history.
- The persisted plan ledger measures four task commits before metadata finalization, all required verification commands pass, and `git diff --check` is clean.

---
*Phase: 01-baseline-observability-identity-and-trust-boundaries*
*Completed: 2026-09-21*
