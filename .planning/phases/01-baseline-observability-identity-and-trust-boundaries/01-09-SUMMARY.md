---
phase: 01-baseline-observability-identity-and-trust-boundaries
plan: 09
subsystem: recovery-and-completeness-ui
tags: [react, tauri, rust, sqlite, recovery, accessibility, lifecycle, tdd]

requires:
  - phase: 01-baseline-observability-identity-and-trust-boundaries/01-08
    provides: Transactional same-ID reconciliation and authoritative RecoveryResult gap facts
  - phase: 01-baseline-observability-identity-and-trust-boundaries/01-06
    provides: Rust-owned terminal lifecycle, completeness, and durable finalization gaps
provides:
  - Same-ID renderer recovery that submits only canonical meeting and final evidence identities
  - Shared accessible completeness labels for complete, incomplete, recovered-with-gaps, and legacy-unverified meetings
  - Persistent meeting-detail notices and deterministic recording-relative gap review with explicit unknowns
  - Rust-to-renderer lifecycle and gap projection for meeting history and detail
  - Telu trust-surface color tokens and executable UI source contracts
affects: [meeting-history, meeting-detail, recovery-ui, phase-01-evaluation, evidence-integrity]

actuals:
  tokens: 19651
  tasks: 2
  commits: 4
plan_head_before: 94e86c95bb9ae1b91f4e59f33d3df81800b2c7cb

tech-stack:
  added: []
  patterns:
    - Renderer recovery reconciles and mirrors one Rust-owned meeting instead of allocating a replacement
    - Completeness is projected from Rust and rendered through one accessible shared component
    - Gap facts sort by known recording-relative start, then stable gap identity, with unknown intervals last

key-files:
  created:
    - frontend/src/components/MeetingCompleteness.tsx
    - .github/verify-phase1-completeness-ui.test.cjs
    - .planning/phases/01-baseline-observability-identity-and-trust-boundaries/01-09-task1-red.json
    - .planning/phases/01-baseline-observability-identity-and-trust-boundaries/01-09-task2-red.json
  modified:
    - frontend/src/hooks/useTranscriptRecovery.ts
    - frontend/src/services/indexedDBService.ts
    - frontend/src/components/TranscriptRecovery/TranscriptRecovery.tsx
    - frontend/src/components/Sidebar/SidebarProvider.tsx
    - frontend/src/components/Sidebar/index.tsx
    - frontend/src/app/meeting-details/page-content.tsx
    - frontend/src/app/meeting-details/page.tsx
    - frontend/src/app/page.tsx
    - frontend/src/app/globals.css
    - frontend/src/types/index.ts
    - frontend/src-tauri/src/api/api.rs
    - frontend/src-tauri/src/database/repositories/meeting.rs

key-decisions:
  - "Recovery success remains in the dialog until View meeting or Close recovery is explicitly selected; the page wrapper cannot auto-navigate or celebrate before the authoritative result is reviewed."
  - "History and detail receive lifecycle, completeness, gap count, and ordered gap facts from existing Rust Tauri APIs; the renderer never infers completion from an empty gap array."
  - "Pending meetings use the incomplete presentation rather than a fifth trust label, while migrated legacy meetings retain Completion not verified."
  - "One MeetingCompleteness component owns visible text-plus-icon status, persistent non-complete notices, and explicit Unknown gap fields across history, detail, and recovery."

patterns-established:
  - "Reconcile in place: recovery updates the existing IndexedDB candidate under the canonical Rust meeting ID and never removes or duplicates it on success."
  - "Rust says, UI shows: authoritative lifecycle fields cross Tauri DTOs intact and no gap-count heuristic can promote a meeting."
  - "Trust states are textual and persistent: color and icons supplement exact language but never replace it."

requirements-completed: [IDENT-03, BASE-05]

coverage:
  - id: D1
    description: Interrupted candidates reconcile final evidence into the same canonical meeting, remain selected during work, and expose persistent authoritative actions and results.
    requirement: IDENT-03
    verification:
      - kind: integration
        ref: "node --test .github/verify-phase1-completeness-ui.test.cjs#recovery contracts"
        status: pass
      - kind: integration
        ref: "cargo test --manifest-path frontend/src-tauri/Cargo.toml recovery_repository_tests --lib"
        status: pass
      - kind: other
        ref: "pnpm --dir frontend build"
        status: pass
    human_judgment: true
    rationale: Packaged-app confirmation must recover one interrupted device-local candidate twice and compare stable identity and counts.
  - id: D2
    description: History, detail, and recovery distinguish all four authoritative trust states with text and icons, preserving persistent incomplete, recovered, and legacy notices.
    requirement: BASE-05
    verification:
      - kind: automated_ui
        ref: "node --test .github/verify-phase1-completeness-ui.test.cjs#shared completeness contracts"
        status: pass
      - kind: other
        ref: "pnpm --dir frontend build"
        status: pass
    human_judgment: true
    rationale: Final wrapping, visual hierarchy, focus behavior, and calmness require packaged desktop inspection at supported widths.
  - id: D3
    description: Gap review uses deterministic recording-relative ordering and shows type, source, range, and reason with unknown facts explicit; zero gaps cannot promote lifecycle.
    requirement: BASE-05
    verification:
      - kind: automated_ui
        ref: "node --test .github/verify-phase1-completeness-ui.test.cjs#detail notices and zero-gap contracts"
        status: pass
      - kind: other
        ref: "cargo check --manifest-path frontend/src-tauri/Cargo.toml"
        status: pass
    human_judgment: false

duration: 9h 7m
completed: 2026-09-21
status: complete
---

# Phase 01 Plan 09: Authoritative Recovery and Completeness UI Summary

**Same-ID recovery now stays on one canonical meeting while history, detail, and recovery expose Rust-owned completeness and deterministic gap facts through accessible Telu trust surfaces.**

## Performance

- **Duration:** 9h 7m
- **Started:** 2026-09-20T21:40:14Z
- **Completed:** 2026-09-21T06:46:49Z
- **Tasks:** 2
- **Files modified:** 16

## Accomplishments

- Replaced save-as-new recovery with a canonical `reconcile_meeting` request containing only the Rust meeting ID and stable final evidence identities, then mirrored the authoritative result onto the same IndexedDB candidate.
- Kept recovery loading, error, gap-free, recovered-with-gaps, delete confirmation, and explicit View/Close actions inside the approved two-pane dialog without optimistic navigation.
- Added a shared text-and-icon completeness surface for Complete, Incomplete, Recovered with gaps, and Completion not verified across meeting history, detail, and recovery.
- Projected lifecycle, completeness, reason, gap count, and deterministic gap facts through the existing Rust Tauri meeting APIs so UI state cannot strengthen the durable claim.
- Added persistent non-complete notices and a contained gap review showing type, source, relative range, and reason with explicit Unknown values and exact empty copy.
- Applied Warm Off-white, Ink, Telu Indigo, Slate, Soft Grey, and Soft Coral variables to touched trust surfaces while keeping Fresh Mint reserved.

## Task Commits

Each TDD task was committed in RED/GREEN sequence:

1. **Task 1 RED: authoritative recovery UI contracts** - `c00a689` (test)
2. **Task 1 GREEN: canonical same-ID recovery flow** - `5d87e8d` (feat)
3. **Task 2 RED: completeness and gap visibility contracts** - `1571eaf` (test)
4. **Task 2 GREEN: authoritative history/detail completeness** - `e3c89d8` (feat)

## Files Created/Modified

- `frontend/src/components/MeetingCompleteness.tsx` - Owns accessible status labels, persistent notices, deterministic gap ordering, explicit unknowns, and gap-review dialog/list presentation.
- `frontend/src/components/TranscriptRecovery/TranscriptRecovery.tsx` - Keeps the authoritative recovery result in the two-pane dialog and reuses shared completeness/gap presentation.
- `frontend/src/hooks/useTranscriptRecovery.ts` - Sends canonical final evidence to `reconcile_meeting`, returns redacted factual failures, and updates the same candidate after Rust responds.
- `frontend/src/services/indexedDBService.ts` - Mirrors Rust lifecycle, completeness, counts, reasons, and reconciliation time onto the existing canonical cache key.
- `frontend/src/components/Sidebar/SidebarProvider.tsx` and `frontend/src/components/Sidebar/index.tsx` - Preserve Rust lifecycle fields and show a non-hover status beneath two-line meeting titles.
- `frontend/src/app/meeting-details/page-content.tsx` and `frontend/src/app/meeting-details/page.tsx` - Put status beside the detail title and retain a persistent non-complete notice above content.
- `frontend/src-tauri/src/api/api.rs` and `frontend/src-tauri/src/database/repositories/meeting.rs` - Project authoritative lifecycle and deterministically ordered durable gap facts through existing meeting APIs.
- `frontend/src/app/globals.css` - Defines the approved Telu Phase 1 trust palette as semantic CSS variables.
- `.github/verify-phase1-completeness-ui.test.cjs` - Guards canonical recovery, exact lifecycle/gap copy, accessible icons, DTO projection, no renderer promotion, and Telu tokens.
- `.planning/phases/01-baseline-observability-identity-and-trust-boundaries/01-09-task1-red.json` and `01-09-task2-red.json` - Preserve verified intentional RED evidence for both TDD tasks.

## Decisions Made

- Provisional cache text is never converted into durable recovery evidence; only canonical final transcript records are reconciled.
- Recovery leaves the candidate available after success so an exact repeat can prove idempotency against the same canonical identity.
- `pending` cannot introduce an unapproved fifth history label, so it uses the incomplete presentation until Rust commits a stronger terminal state.
- A zero-length gap array affects only the gap-list empty state; it never changes the Rust-provided completeness label.
- Unknown source and time bounds remain visible as `Unknown`, and known gaps sort before unknown intervals with stable gap IDs breaking ties.

## TDD Gate Compliance

- **Task 1 RED:** Four named source-contract tests failed against the prior save-as-new recovery flow; `01-09-task1-red.json` passed `tdd-red-evidence` with `target_test_failed`.
- **Task 1 GREEN:** All four recovery contracts passed and the frontend production build completed.
- **Task 2 RED:** Four new completeness/history/detail/token contracts failed against an intentional shared-component stub and DTOs that dropped lifecycle data; `01-09-task2-red.json` passed `tdd-red-evidence` with `target_test_failed`.
- **Task 2 GREEN:** All eight combined UI contracts pass, the frontend production build completes, Rust compiles, and all four focused recovery repository tests pass.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking Integration] Removed wrapper-level optimistic recovery completion**
- **Found during:** Task 1 (Drive the existing recovery dialog from authoritative reconciliation)
- **Issue:** `frontend/src/app/page.tsx` still displayed a success toast and navigated after recovery, which would close the newly persistent authoritative dialog result.
- **Fix:** Kept sidebar refresh but returned the result to the dialog without toast, timeout, or automatic navigation.
- **Files modified:** `frontend/src/app/page.tsx`
- **Verification:** Recovery source contract and frontend production build pass.
- **Committed in:** `5d87e8d`

**2. [Rule 2 - Missing Critical] Carried authoritative lifecycle and gaps through existing meeting APIs**
- **Found during:** Task 2 (Show authoritative completeness and time-ordered gaps)
- **Issue:** Existing Rust `api_get_meetings` and `api_get_meeting_metadata` DTOs discarded lifecycle/completeness, and detail metadata exposed no durable gap facts, so the planned renderer could only guess or hide state.
- **Fix:** Extended existing DTOs and repository reads, then preserved those fields through shared TypeScript types, the sidebar provider, and detail-page assembly. No new endpoint, table, or architecture was introduced.
- **Files modified:** `frontend/src-tauri/src/api/api.rs`, `frontend/src-tauri/src/database/repositories/meeting.rs`, `frontend/src/types/index.ts`, `frontend/src/components/Sidebar/SidebarProvider.tsx`, `frontend/src/app/meeting-details/page.tsx`
- **Verification:** Node UI contracts, frontend production build, `cargo check`, and focused recovery repository tests pass.
- **Committed in:** `e3c89d8`

---

**Total deviations:** 2 auto-fixed (1 blocking integration, 1 missing critical projection)
**Impact on plan:** Both changes were required to preserve the plan's authoritative-result and no-renderer-promotion guarantees; they reused existing APIs and storage without expanding product scope.

## Issues Encountered

- Repository-wide `cargo fmt --check` reports extensive pre-existing Rust formatting drift, including untouched build and audio files. No broad formatting rewrite was applied. The changed Rust code compiles and focused recovery tests pass.
- The Next.js build emits its existing experimental Node `localStorage` warning during page-data collection; static export still completes successfully.

## Known Stubs

None. Added-line and touched-file scans found no TODOs, FIXMEs, placeholders, skipped tests, or empty values that prevent the recovery/completeness goal.

## User Setup Required

None.

## Next Phase Readiness

- Phase 1 evaluation and trust work can consume one visible, Rust-owned completeness vocabulary across recovery, history, and detail.
- The packaged-app UAT should recover the same interrupted candidate twice, compare identity/count stability, inspect focus behavior, and exercise long titles plus known and unknown gap bounds.
- No implementation blocker remains for Plan 01-10.

## Self-Check: PASSED

- The shared component, executable guard, both RED-evidence records, and summary exist on disk.
- All four RED/GREEN task commits resolve in git history.
- The persisted plan ledger measures four task commits before metadata finalization, and `git diff --check` passes.

---
*Phase: 01-baseline-observability-identity-and-trust-boundaries*
*Completed: 2026-09-21*
