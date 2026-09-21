---
phase: 01-baseline-observability-identity-and-trust-boundaries
plan: 11
subsystem: provider-route-trust-ui
tags: [react, tauri, privacy, routing, accessibility, transcription, summaries, tdd]

requires:
  - phase: 01-baseline-observability-identity-and-trust-boundaries/01-10
    provides: Rust-owned EffectiveRoute DTOs, fail-closed route validation, and pre-dispatch provider enforcement
provides:
  - Shared React disclosure for Rust-owned Local, LAN, or Remote routes with sanitized expandable origins
  - Provider settings disclosures for transcription and summary capabilities
  - Fresh action-time route validation before recording and summary dispatch
  - Persistent no-fallback failure recovery with capability-specific retry, reconfigure, and cancel actions
affects: [privacy-settings, recording, meeting-summaries, provider-errors, phase-01-evaluation]

actuals:
  tokens: 13485
  tasks: 2
  commits: 4
plan_head_before: 3362b676aef9513d5d25f09946d9242b703122d2

tech-stack:
  added: []
  patterns:
    - React renders the Rust EffectiveRoute DTO directly and never classifies locality itself
    - A displayed route snapshot is freshly validated immediately before data-bearing work
    - Capability failures preserve selection and local data while offering ordered inline recovery

key-files:
  created:
    - frontend/src/services/providerRouteService.ts
    - frontend/src/components/ProviderBoundary.tsx
    - .planning/phases/01-baseline-observability-identity-and-trust-boundaries/01-11-task1-red.json
    - .planning/phases/01-baseline-observability-identity-and-trust-boundaries/01-11-task2-red.json
  modified:
    - frontend/src/components/TranscriptSettings.tsx
    - frontend/src/components/SummaryModelSettings.tsx
    - frontend/src/app/_components/SettingsModal.tsx
    - frontend/src/components/RecordingControls.tsx
    - frontend/src/app/meeting-details/page-content.tsx
    - frontend/src/hooks/useRecordingStart.ts

key-decisions:
  - "React treats the Rust EffectiveRoute record as presentation data: provider names, origins, and browser host information never infer or strengthen Local, LAN, or Remote classification."
  - "Recording and summary dispatch validate the exact route snapshot already shown to the user; a changed or unavailable route blocks only that capability action."
  - "Retry keeps the selected provider and route, reconfigure opens and focuses the existing provider control, and cancel dismisses only the attempted capability operation."
  - "Active transcription failures use the Rust-synchronized recording state for the separate Recording continues locally or Recording stopped outcome."

patterns-established:
  - "Disclose, validate, dispatch: display the Rust route, revalidate that snapshot at the CTA boundary, then invoke work only after validation succeeds."
  - "Trust failures remain inline and persistent, reveal only sanitized origins and stable technical codes, and never use a provider fallback."

requirements-completed: [PRIV-01, PRIV-02]

coverage:
  - id: D1
    description: Provider settings show the Rust-owned capability, Local/LAN/Remote boundary, sanitized origin, provider/model identity, validation state, and explicit unencrypted LAN warning.
    requirement: PRIV-01
    verification:
      - kind: integration
        ref: ".github/verify-phase1-provider-boundary.test.cjs#settings route disclosure contracts"
        status: pass
      - kind: other
        ref: "pnpm --dir frontend build"
        status: pass
    human_judgment: true
    rationale: "Compact layout, wrapping, long-origin expansion, and keyboard focus transfer still require packaged desktop visual inspection."
  - id: D2
    description: Recording and summary actions freshly validate the displayed Rust route and cannot dispatch while that route is loading, unavailable, or materially changed.
    requirement: PRIV-02
    verification:
      - kind: integration
        ref: ".github/verify-phase1-provider-boundary.test.cjs#recording and summary actions expose then freshly validate the Rust route"
        status: pass
      - kind: other
        ref: "pnpm --dir frontend build"
        status: pass
    human_judgment: false
  - id: D3
    description: Route failures preserve provider selection and local data while exposing exact capability-specific retry, change-provider, and cancel actions plus the Rust-confirmed recording outcome.
    requirement: PRIV-02
    verification:
      - kind: integration
        ref: ".github/verify-phase1-provider-boundary.test.cjs#route failure recovery and no-fallback contracts"
        status: pass
    human_judgment: true
    rationale: "The native recording-state transition and provider-control focus behavior require packaged Tauri interaction verification."

duration: 20m
completed: 2026-09-21
status: complete
---

# Phase 01 Plan 11: Provider Route Trust UI Summary

**Rust-authoritative provider routes now appear in settings and at recording or summary actions, with fresh pre-dispatch validation and explicit no-fallback recovery.**

## Performance

- **Duration:** 20m
- **Started:** 2026-09-21T07:23:57Z
- **Completed:** 2026-09-21T07:43:37Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments

- Added a typed Tauri route service and shared accessible boundary that displays the Rust-owned capability, provider/model, sanitized destination, validation state, neutral Local/LAN/Remote chip, and explicit `Not encrypted` LAN warning.
- Added route disclosures to existing transcription and summary settings, including keyboard-expandable selectable full origins for long destinations.
- Required the displayed transcription or summary route to pass fresh Rust validation immediately before recording, generation, regeneration, or automatic summary dispatch.
- Added persistent capability-specific failure alerts with exact preservation copy, ordered retry/change/cancel actions, redacted technical codes, and Rust-synchronized active-recording outcomes.
- Removed the remaining recording-readiness Parakeet fallback so a missing configuration fails visibly instead of substituting a provider.

## Task Commits

Each TDD task was committed in RED/GREEN sequence:

1. **Task 1 RED: provider settings disclosure contracts** - `c747244` (test)
2. **Task 1 GREEN: disclose Rust routes in provider settings** - `59e62bd` (feat)
3. **Task 2 RED: action route and recovery contracts** - `002941d` (test)
4. **Task 2 GREEN: validate routes and recover without fallback** - `4350146` (feat)

## Files Created/Modified

- `frontend/src/services/providerRouteService.ts` - Defines the typed EffectiveRoute wrapper, Tauri commands, availability narrowing, stable route-error detection, and redacted failure normalization.
- `frontend/src/components/ProviderBoundary.tsx` - Renders route loading, validation, boundary disclosure, long-origin expansion, unencrypted warning, and the shared capability failure alert.
- `frontend/src/components/TranscriptSettings.tsx` - Shows the authoritative transcription route after the existing provider controls and exposes the reconfiguration focus target.
- `frontend/src/components/SummaryModelSettings.tsx` - Shows the authoritative summary route after provider selection.
- `frontend/src/app/_components/SettingsModal.tsx` - Adds the summary route disclosure to the existing legacy settings surface.
- `frontend/src/components/RecordingControls.tsx` - Places the transcription route above Start recording, validates it before dispatch, and owns retry/cancel plus capture-outcome behavior.
- `frontend/src/app/meeting-details/page-content.tsx` - Places the summary route at the generation surface and gates manual, regeneration, retry, and automatic summary actions.
- `frontend/src/app/page.tsx` and `frontend/src/components/ModelSettingsModal.tsx` - Reuse and focus existing provider controls for reconfiguration.
- `frontend/src/hooks/useRecordingStart.ts` - Removes the frontend Parakeet fallback from recording readiness.
- `.github/verify-phase1-provider-boundary.test.cjs` - Guards Rust DTO consumption, disclosure placement, exact recovery actions, capture outcome copy, and absence of frontend inference or action fallback.
- `01-11-task1-red.json` and `01-11-task2-red.json` - Preserve verified intentional RED evidence for both TDD tasks.

## Decisions Made

- Kept all route classification in Rust; React maps the received class to neutral presentation only.
- Revalidated the exact displayed route snapshot at the CTA boundary instead of fetching and trusting a different implicit route.
- Used one shared failure alert so recording and summary preserve identical no-fallback semantics while retaining capability-specific labels.
- Kept reconfiguration inside existing settings controls and made those controls programmatic focus targets instead of adding another provider modal.
- Treated the global recording context as the Rust-synchronized source for whether durable capture continues after an active transcription route failure.

## TDD Gate Compliance

- **Task 1 RED:** Four named settings disclosure tests failed before the route service and shared boundary existed; `01-11-task1-red.json` passed `tdd-red-evidence` with intentional RED evidence.
- **Task 1 GREEN:** All four settings disclosure contracts pass and the production frontend build succeeds.
- **Task 2 RED:** Five named action-boundary, recovery, capture-outcome, and no-fallback tests failed before integration; `01-11-task2-red.json` passed `tdd-red-evidence` with intentional RED evidence.
- **Task 2 GREEN:** All nine provider-boundary tests pass and the production frontend build succeeds.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Removed the remaining frontend transcription provider fallback**
- **Found during:** Task 2 (Enforce disclosure and capability-specific failure at action time)
- **Issue:** Recording readiness still converted absent or unreadable transcription configuration into Parakeet before the planned Rust route gate, contradicting the no-substitution trust contract.
- **Fix:** Return no provider on missing/error configuration and fail readiness without initializing a different engine.
- **Files modified:** `frontend/src/hooks/useRecordingStart.ts`
- **Verification:** The no-fallback Node guard and production frontend build pass.
- **Committed in:** `4350146`

**2. [Rule 3 - Blocking Integration] Connected reconfiguration actions to existing focusable provider controls**
- **Found during:** Task 2 (Enforce disclosure and capability-specific failure at action time)
- **Issue:** The planned action components could open settings but did not own the existing transcription modal or summary provider selector needed to satisfy the focus contract.
- **Fix:** Added stable provider-control IDs and narrow callbacks that open the existing settings surface and focus its corresponding control.
- **Files modified:** `frontend/src/app/page.tsx`, `frontend/src/components/ModelSettingsModal.tsx`, `frontend/src/components/TranscriptSettings.tsx`
- **Verification:** The provider-boundary guard and production frontend build pass.
- **Committed in:** `4350146`

---

**Total deviations:** 2 auto-fixed (1 missing critical trust-boundary fix, 1 blocking UI integration)
**Impact on plan:** Both changes were necessary for the specified no-fallback and reconfiguration behavior; they added no dependency, provider, network endpoint, schema, or architecture.

## Issues Encountered

- The production build emits the existing Node experimental warning that `localStorage` is unavailable during static generation; compilation, type checking, and all static pages still complete successfully.

## Known Stubs

None. Touched-file and added-line scans found no TODOs, FIXMEs, skipped tests, or placeholder/mock values that prevent the route-disclosure goal.

## User Setup Required

None.

## Next Phase Readiness

- Phase 1 evaluation and diagnostics can consume the same Rust-owned route identity now disclosed to users.
- Recording and summary paths fail visibly on unavailable or changed routes without changing provider choice or discarding local data.
- Packaged desktop UAT should verify compact wrapping, provider-control focus transfer, and live capture-outcome transitions; no implementation blocker remains.

## Self-Check: PASSED

- The route service, shared boundary, both RED-evidence records, and summary exist on disk.
- All four RED/GREEN task commits resolve in git history.
- The persisted plan ledger measures four task commits before metadata finalization, and `git diff --check` passes.

---
*Phase: 01-baseline-observability-identity-and-trust-boundaries*
*Completed: 2026-09-21*
