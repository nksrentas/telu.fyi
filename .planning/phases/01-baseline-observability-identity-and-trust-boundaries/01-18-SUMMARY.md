---
phase: 01-baseline-observability-identity-and-trust-boundaries
plan: 18
subsystem: diagnostics-trust-ui
tags: [rust, tauri, react, typescript, diagnostics, privacy, local-export, tdd]

requires:
  - phase: 01-baseline-observability-identity-and-trust-boundaries/01-17
    provides: Validated atomic local run bundles with redacted evidence and explicit unknowns
provides:
  - Calm final Settings Diagnostics tab for recent local run evidence and ordered detail
  - Typed redacted list/detail IPC projections that preserve limitations, unknowns, and outliers
  - Review-before-export dialog with separate transcript and audio choices reset off every time
  - Rust-owned local export authority with generated child paths, source preservation, revalidation, and an inclusion manifest
affects: [plan-01-19, diagnostics, local-evaluation, privacy-boundaries, support-export]

actuals:
  tokens: 22339
  tasks: 2
  commits: 4
plan_head_before: a3a0c5820ced2b222fa054943cd20c30e8b1f61a

tech-stack:
  added: []
  patterns:
    - Renderer diagnostics receive allowlisted typed projections rather than raw bundle files or filesystem paths
    - Folder selection authority remains in Rust behind opaque bounded tokens
    - Local exports are reserialized into a unique temporary child, revalidated, manifested, and atomically renamed
    - Sensitive per-export choices are independent, default off, and reset whenever the review dialog opens or closes

key-files:
  created:
    - frontend/src/services/diagnosticsService.ts
    - frontend/src/components/DiagnosticsPanel.tsx
    - frontend/src/components/DiagnosticExportDialog.tsx
    - .github/verify-phase1-diagnostics-ui.test.cjs
    - .planning/phases/01-baseline-observability-identity-and-trust-boundaries/01-18-task1-red.json
    - .planning/phases/01-baseline-observability-identity-and-trust-boundaries/01-18-task2-red.json
  modified:
    - frontend/src-tauri/src/observability/run_bundle.rs
    - frontend/src-tauri/src/lib.rs
    - frontend/src/app/_components/SettingsModal.tsx
    - frontend/src/app/settings/page.tsx
    - frontend/src/components/SettingTabs.tsx

key-decisions:
  - "Diagnostics IPC revalidates each local run bundle and returns only typed allowlisted fields; raw artifacts, filesystem paths, transcript text, and audio never cross the detail boundary."
  - "Folder selection and completed-export paths remain Rust-owned behind opaque UUID tokens; the renderer receives only a safe folder name and explicit export result metadata."
  - "Every export is a new generated child assembled through atomic writes, validated before publication, and rejected if its destination is the source bundle or any descendant."
  - "Transcript and audio choices record request versus actual inclusion separately; current content-redacted source bundles report those requested categories as unavailable rather than manufacturing or weakening source policy."
  - "Diagnostics was integrated into the active settings route and shared settings tabs as well as the legacy modal so the promised final tab is reachable across current settings entry points."

patterns-established:
  - "Review before local export: show categories, destination, redaction policy, and independent sensitive-content choices before the copy action is enabled."
  - "Path capability tokens: keep selected and completed paths native-side and expose bounded opaque tokens for follow-up actions."
  - "Source-preserving export: reject containment hazards, reserialize allowlisted evidence, validate the copy, and publish with rename without altering source files."

requirements-completed: [BASE-04]

coverage:
  - id: D1
    description: The final Settings Diagnostics tab exposes calm local run summaries and ordered redacted evidence while preserving unknowns, limitations, and outliers.
    requirement: BASE-04
    verification:
      - kind: contract
        ref: "node --test .github/verify-phase1-diagnostics-ui.test.cjs"
        status: pass
      - kind: unit
        ref: "cargo test --manifest-path frontend/src-tauri/Cargo.toml diagnostic_queries --lib -- --nocapture"
        status: pass
    human_judgment: false
  - id: D2
    description: Export requires explicit review and independent per-export transcript and audio choices that begin and reset off.
    requirement: BASE-04
    verification:
      - kind: contract
        ref: "node --test .github/verify-phase1-diagnostics-ui.test.cjs"
        status: pass
    human_judgment: false
  - id: D3
    description: Export creates a sanitized local-only child, records policy and choices, rejects unsafe destinations, and leaves the source bundle unchanged.
    requirement: BASE-04
    verification:
      - kind: unit
        ref: "cargo test --manifest-path frontend/src-tauri/Cargo.toml diagnostic_export --lib -- --nocapture"
        status: pass
      - kind: build
        ref: "pnpm --dir frontend build"
        status: pass
    human_judgment: false

duration: 20m
completed: 2026-09-21
status: complete
---

# Phase 01 Plan 18: Calm Diagnostics and Reviewed Local Export Summary

**Telu now exposes validated local run evidence in a calm final Settings tab and creates diagnostic copies only after an explicit review, with native-side path authority and sensitive choices reset off for every export.**

## Performance

- **Duration:** 20m
- **Started:** 2026-09-21T10:58:29Z
- **Completed:** 2026-09-21T11:18:03Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments

- Added typed Rust list/detail commands and a frontend service that project only redacted diagnostic evidence from validated local run bundles while keeping explicit unknowns, limitations, distributions, outliers, and copyable IDs visible.
- Added Diagnostics as the final tab across active Settings entry points with the approved privacy note, named loading/error/empty/populated states, one-column responsive detail, selectable technical evidence, and contained overflow.
- Added the exact review-before-export flow with categories, safe destination name, redaction policy, independent transcript/audio switches that reset off, exact local success copy, and filesystem retry/reselection actions.
- Kept all path capability native-side: Rust validates the selected directory, rejects symlinks and source containment, writes a generated temporary child, reserializes and revalidates the bundle, records an export manifest, atomically renames the copy, and retains only bounded opaque tokens for renderer follow-up.

## Task Commits

Each TDD task was committed in RED/GREEN sequence:

1. **Task 1 RED: diagnostics inspection contracts** - `7096c46` (test)
2. **Task 1 GREEN: local diagnostic run inspection** - `4cdfba4` (feat)
3. **Task 2 RED: reviewed local export contracts** - `429421e` (test)
4. **Task 2 GREEN: reviewed source-preserving local export** - `b8624c4` (feat)

## Files Created/Modified

- `.github/verify-phase1-diagnostics-ui.test.cjs` - Enforces final-tab placement, exact privacy/empty/export copy, detail order, switch resets, local-only behavior, and recovery actions.
- `frontend/src/services/diagnosticsService.ts` - Provides typed list, read, folder-selection, local-export, and reveal command wrappers.
- `frontend/src/components/DiagnosticsPanel.tsx` - Renders recent local runs and the ordered one-column evidence detail with explicit states and contained technical overflow.
- `frontend/src/components/DiagnosticExportDialog.tsx` - Implements accessible review-before-export state, separate sensitive-content consent, and exact success/failure actions.
- `frontend/src-tauri/src/observability/run_bundle.rs` - Adds redacted diagnostic projections, Rust-owned path capability tokens, sanitized local-copy export, manifesting, containment checks, and source-preservation tests.
- `frontend/src-tauri/src/lib.rs` - Registers list/read/select/export/reveal Tauri commands.
- `frontend/src/app/_components/SettingsModal.tsx`, `frontend/src/app/settings/page.tsx`, and `frontend/src/components/SettingTabs.tsx` - Place Diagnostics last across current Settings surfaces.
- `01-18-task1-red.json` and `01-18-task2-red.json` - Preserve validated intentional RED evidence for both TDD tasks.

## Decisions Made

- Derived UI evidence only from validated bundle documents and explicit typed projections instead of exposing raw JSON or bundle locations.
- Kept folder paths entirely in the Tauri process; the renderer receives a safe display name and one-time opaque capability token, never a full path.
- Reserialized all nine source artifacts through the existing atomic writer and validated the copied inner bundle before publishing its generated parent directory.
- Recorded requested and included transcript/audio flags separately. Because Plan 17 bundles deliberately exclude raw transcript/audio, an explicit request is recorded but reported as not included when that source material is absent.
- Used existing Telu semantic colors, Radix focus management, shared primitives, and responsive containers rather than adding styling or UI packages.

## TDD Gate Compliance

- **Task 1 RED:** The focused Rust diagnostic query failed because scenario and detail projections did not exist; `01-18-task1-red.json` passed `RED_EVIDENCE_OK` before implementation.
- **Task 1 GREEN:** Four UI source-contract tests and the focused Rust diagnostic query pass; the frontend production build validates the active settings integration.
- **Task 2 RED:** Four export review contracts and the focused Rust local-copy boundary failed before export behavior existed; `01-18-task2-red.json` passed `RED_EVIDENCE_OK` before implementation.
- **Task 2 GREEN:** Eight UI contract tests and two behavior-level Rust export tests pass, including unsafe destination rejection, manifest choices, sanitized copy validation, temporary cleanup, and byte-for-byte source preservation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Integrated Diagnostics into all active Settings surfaces**
- **Found during:** Task 1
- **Issue:** The plan named the legacy `SettingsModal`, but the current application also exposes a dedicated `/settings` route and shared sidebar tabs; changing only the modal would leave the promised final Diagnostics tab unreachable from active entry points.
- **Fix:** Added Diagnostics last in the modal, dedicated settings page, and shared settings tab navigation without changing existing tab order.
- **Files modified:** `frontend/src/app/_components/SettingsModal.tsx`, `frontend/src/app/settings/page.tsx`, `frontend/src/components/SettingTabs.tsx`
- **Commit:** `4cdfba4`

**2. [Rule 2 - Critical] Rejected destinations inside the immutable source bundle**
- **Found during:** Task 2
- **Issue:** A user-selected source directory or descendant would let a generated export child mutate the source directory tree despite artifact bytes remaining unchanged.
- **Fix:** Canonicalized both locations and reject the source or any descendant before creating temporary output; the test verifies the source manifest remains unchanged.
- **Files modified:** `frontend/src-tauri/src/observability/run_bundle.rs`
- **Commit:** `b8624c4`

## Issues Encountered

- The first Task 2 intentional RED test accidentally matched its own function-name literal. The boundary string was constructed dynamically so RED represented missing production behavior, then the evidence checker passed before implementation.
- Repository-wide `cargo fmt --all -- --check` still reports extensive pre-existing formatting drift outside this plan; the existing Phase 1 broken-windows ledger already tracks that maintenance issue. The touched export section itself passes direct `rustfmt --check`.
- The Next.js build emits its existing experimental `localStorage` warning during static generation but completes successfully.

## Known Stubs

None. Touched-file scans found no TODOs, FIXMEs, skipped tests, placeholder implementation, mock data path, or unwired empty data source introduced by this plan.

## User Setup Required

None.

## Next Phase Readiness

- Plan 19 can use the same validated run evidence while target-hardware checks remain visibly separate from ordinary recording.
- Maintainers can inspect failures, limitations, queue outcomes, resource evidence, route attempts, and redacted errors locally without exposing raw artifacts to the renderer.
- Support copies remain deliberate, locally written, manifested, source-preserving, and content-redacted by default; no upload or share path was added.

## Self-Check: PASSED

- All eleven task-created or task-modified files, both RED-evidence records, and this summary exist on disk.
- Task commits `7096c46`, `4cdfba4`, `429421e`, and `b8624c4` resolve in git history.
- The persisted plan ledger measures four task commits before metadata finalization; all exact plan verification commands pass and `git diff --check` is clean.

---
*Phase: 01-baseline-observability-identity-and-trust-boundaries*
*Completed: 2026-09-21*
