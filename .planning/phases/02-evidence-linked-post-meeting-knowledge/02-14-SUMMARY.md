---
phase: 02-evidence-linked-post-meeting-knowledge
plan: 14
subsystem: ui
tags: [living-doc, meeting-page, doc-toolbar, transcript-drawer, gallery]

requires:
  - phase: 02-evidence-linked-post-meeting-knowledge
    provides: 02-01 KnowledgeSection and listMeetingEvidence; 02-06 menus and tooltips; 02-10 summary panel; 02-22 TranscriptDrawer
provides:
  - MeetingPage layout (doc toolbar, living-doc column, evidence drawer, retranscribe dialog)
  - MeetingHeader (title, date · time range, duration, completeness chip, Stored on this Mac)
  - DocToolbar (Back with origin label, compact title, More menu, Transcript toggle)
  - PageContent sections for `surface: 'page' | 'peek'`
  - Gallery screens for six meeting-page states and a `$repeat` fixture generator in the IPC stub
affects: [02-15, 02-16, 02-19, 02-21, 02-23, 02-24, 02-26]

actuals:
  tokens: 45000
  tasks: 2
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Route query `from` sets the Back label (default Today); `evidence` opens the drawer with that line highlighted"
    - "IPC fixtures can generate arrays: `{ \"$repeat\": n, \"template\": {...} }` with `$i`, `$i*k` and `$i*k+c` values"

key-files:
  created:
    - frontend/src/components/living-doc/meeting-page.tsx
    - frontend/src/components/living-doc/meeting-header.tsx
    - frontend/src/components/app-shell/doc-toolbar.tsx
    - frontend/tests/visual/screens/meeting-page.json
  modified:
    - frontend/src/app/meeting-details/page.tsx
    - frontend/src/app/meeting-details/page-content.tsx
    - frontend/tests/hooks/meeting-details-refresh.test.tsx
    - frontend/tests/visual/screens/existing-screens.json
    - frontend/tests/visual/tauri-ipc-stub.js
  deleted:
    - frontend/src/components/MeetingDetails/MeetingDetailsSplitView.tsx
    - frontend/src/components/MeetingDetails/TranscriptPanel.tsx
    - frontend/src/components/MeetingDetails/TranscriptButtonGroup.tsx

key-decisions:
  - "The H1 stays plain text styled as the doc title: the old meeting page had no inline rename (rename lives in the sidebar), so no new rename path was added"
  - "The summary context textarea moved into the Summary section (shown when the meeting has evidence or legacy lines) so the custom-prompt capability is not lost"
  - "Evidence count and duration load in page.tsx beside the summary; an evidence read failure counts as 'has evidence' for the Retranscribe gate (hidden, A2 / T-02-42) and as 'no evidence' for auto-generate"
  - "MeetingPage owns Copy transcript and Open recording folder through useCopyOperations/useMeetingOperations; the drawer header reuses the same handlers"
  - "Column shift follows the 002 formula; at narrow widths it is capped at the left padding, so the drawer can overlap the column edge"

patterns-established:
  - "Route-level tests mock `living-doc/meeting-page` with a passthrough so they keep testing page.tsx and the hooks"

requirements-completed: []

coverage:
  - id: D1
    description: "Living-doc page replaces the split view; summary disclosure order and completeness contracts intact"
    requirement: KNOW-02
    verification:
      - kind: other
        ref: "node --test .github/verify-phase1-provider-boundary.test.cjs .github/verify-phase1-completeness-ui.test.cjs (17 pass); grep for removed components (none)"
        status: pass
      - kind: unit
        ref: "bun test tests/hooks/meeting-details-refresh.test.tsx tests/components/transcript-drawer.test.tsx (8 pass); full bun test (66 pass)"
        status: pass
  - id: D2
    description: "Gallery covers complete, drawer-open, legacy, empty-transcript, incomplete and 1,500-segment meeting states"
    requirement: KNOW-02
    verification:
      - kind: automated_ui
        ref: "TELU_GALLERY_PORT=3234 pnpm --dir frontend gallery (52 passed)"
        status: pass

duration: 70min
completed: 2026-09-28
---

# Phase 2 Plan 14: Living-doc meeting page Summary

**`/meeting-details?id=…` is now a single-column living doc with a doc toolbar, a header of meta chips, an Unreviewed Summary section that keeps the provider disclosure first, the Knowledge section, and an evidence transcript drawer; the legacy split view is gone and every prior action is still reachable.**

## Accomplishments

- `meeting-page.tsx`: absolute 52px toolbar over a scroll container (`pt-[52px]`), glass once scrolled; compact title when the H1 passes under the toolbar; column `w-[min(720px,calc(100%-112px))]`, `pt-[30px] pb-[160px]`, shifted by the 002 formula when the drawer opens (300/200ms drawer curve); ⌘[ back; drawer wired with date label, copy and folder actions; Retranscribe dialog only when allowed.
- `doc-toolbar.tsx`: drag region on the strip, title and spacer only; accent Back with the `Back · ⌘[` tooltip; `More` menu and `Transcript` toggle (`aria-expanded`, accent when open) in glass groups.
- `meeting-header.tsx`: `text-large` H1 with `data-doc-title`, meta chips (`Sun 27 Sep · 12:00–12:44`, `44 min`), compact completeness chip only when not complete, lock chip `Stored on this Mac`; deterministic English date names.
- `page-content.tsx`: `surface`, `hasEvidence`, `durationSeconds` props; sections 44px apart (32px under 600px or in a peek); Summary eyebrow + `Unreviewed` chip + caption; ProviderBoundary → failure alert → context textarea → SummaryPanel card; KnowledgeSection; tab state and split-view logic removed.
- `page.tsx`: `from` and `evidence` query params, evidence info load, auto-generate precondition on evidence or legacy lines, token-styled error state, renders `MeetingPage` around `PageContent`.
- Gallery: six `meeting-page-*` screens; existing meeting, transcript and model-settings screens now mock `knowledge_list_evidence`, and the transcript screen opens the drawer.

## Task Commits

1. **Tasks 1–2** — `9fb3a5c` (feat)

## Verification

- `grep -rn "MeetingDetailsSplitView\|MeetingDetails/TranscriptPanel\|TranscriptButtonGroup" frontend/src` → nothing
- `doc-toolbar.tsx` contains `data-tauri-drag-region` and `aria-expanded`; `page-content.tsx` contains `Unreviewed` and `surface`
- Phase 1 provider-boundary + completeness contracts → 17 pass
- `bun test` → 66 pass; `next build` → compiled and type-checked; palette check on living-doc, app-shell and meeting-details → 0 offending classes
- `TELU_GALLERY_PORT=3234 pnpm --dir frontend gallery` → 52 passed

## Deviations from Plan

1. **[Rule 3 - Blocking] `existing-screens.json` and `tauri-ipc-stub.js` changed.** The meeting, transcript and model-settings screens needed a `knowledge_list_evidence` fixture (the plan forbade editing `base-ipc.json`), the transcript screen now opens the drawer instead of a removed tab, and the stub gained `$repeat` so the 1,500-segment fixture is generated instead of committed.
2. **[Rule 3 - Blocking] `meeting-details-refresh.test.tsx` mocks MeetingPage** with a passthrough that exposes `onRefetchTranscripts` (the refetch moved from PageContent to MeetingPage).
3. **[Scope] H1 is not editable** (see key decisions); **the context textarea** moved into the Summary section.
4. **[Process] One commit for both tasks.**

## Issues Encountered

- Headless WebKit renders the glass drawer without blur (see 02-06).
- The Record button in the doc toolbar belongs to the shell recording plan; it is not in this plan's scope.
- Executed inline by the orchestrator.

## Next Phase Readiness

- 02-16 can open the drawer at evidence by extending MeetingPage (the `evidence` route param already works) and calling `scrollToEvidence`.

## Self-Check: PASSED

- Commit `9fb3a5c` is on `codex/phase-01-baseline`.
