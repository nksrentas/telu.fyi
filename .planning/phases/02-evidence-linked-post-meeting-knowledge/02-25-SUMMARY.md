---
phase: 02-evidence-linked-post-meeting-knowledge
plan: 25
subsystem: ui
tags: [today, agenda, event-card, day-stepper, keyboard]

requires:
  - phase: 02-evidence-linked-post-meeting-knowledge
    provides: 02-13 agenda_list_day and cardState, 02-16 AppShell and Sidebar, 02-17 telu:meetings-changed
provides:
  - TodayView on / with the listbox keyboard model 02-26 mirrors
  - EventCard for every Rust cardState, AgendaToolbar with DayStepper
  - Phase 1 completeness contract re-pointed to event-card.tsx; old sidebar deleted
affects: [02-19, 02-21, 02-26]

actuals:
  tokens: 60000
  tasks: 3
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Date-dependent UI resolves today's date in an effect, so prerendered HTML and the first client render match on any day"
    - "Plain-key shortcuts listen on window and act only when focus is on the body or inside the timeline, never on buttons for Enter"
    - "Card state, chip and meta come only from Rust cardState, counts and the finalization queue snapshot"

key-files:
  created:
    - frontend/src/components/agenda/today-view.tsx
    - frontend/src/components/agenda/event-card.tsx
    - frontend/src/components/app-shell/agenda-toolbar.tsx
    - frontend/tests/components/today-view.test.tsx
    - frontend/tests/visual/screens/today.json
  modified:
    - frontend/src/app/page.tsx
    - .github/verify-phase1-completeness-ui.test.cjs
    - frontend/src/app/_components/StatusOverlays.tsx
    - frontend/src/components/living-doc/knowledge-section.tsx
    - frontend/src/components/living-doc/meeting-header.tsx
    - frontend/src/components/telu-ui/empty-state.tsx
    - frontend/src/components/app-shell/app-shell.tsx
    - frontend/src/lib/motion.ts
  deleted:
    - frontend/src/components/Sidebar/index.tsx

key-decisions:
  - "The finalizing card reads the Rust queue snapshot from the recording-finalization-progress event (RecordingStateContext holds none) and reuses the Phase 1 finalizationDetail wording ({n} items remaining · oldest waiting {age}, or Waiting for authoritative recording status)"
  - "The recording card's timer is the Rust-synced activeDuration from RecordingStateContext; a stale recording row with no live recording shows no timer"
  - "Review and Find knowledge open /meeting-details?id=…&from=Today#knowledge; the Knowledge section scrolls itself into view for that hash"
  - "A step keeps the previous day's cards and heading until the new day arrives; a first-load failure shows the error copy inline with Try again as well as the toast"
  - "/ shows the live TranscriptPanel only while recording, stopping, processing or saving, otherwise TodayView"

patterns-established:
  - "motion.ts owns dayStepOut, dayStepIn and cssEase for Web Animations timings"

requirements-completed: []

coverage:
  - id: D1
    description: "Card states, chips, meta, dimming, truncation; toolbar headings and stepper"
    verification:
      - kind: unit
        ref: "frontend/tests/components/today-view.test.tsx (EventCard, AgendaToolbar)"
        status: pass
  - id: D2
    description: "TodayView bounds and order, empty copy, skeleton, error toast, keyboard, reload on meeting changes, Find knowledge anchor"
    verification:
      - kind: unit
        ref: "frontend/tests/components/today-view.test.tsx (9 pass)"
        status: pass
      - kind: automated_ui
        ref: "TELU_GALLERY_PORT=3245 pnpm --dir frontend gallery (102 passed, six today screens)"
        status: pass

duration: 90min
completed: 2026-09-28
---

# Phase 2 Plan 25: Today agenda Summary

**The app now opens on Today: every meeting recorded on the selected day appears in start order with its Rust-projected Telu state, and days step by pointer or keyboard.**

## Accomplishments

- `agenda-toolbar.tsx`: `AgendaToolbar` (drag strip, one-line title/subtitle, glass after 2px) and `DayStepper` (`Previous day`, `Today`, `Next day`, next disabled on today), plus day helpers.
- `event-card.tsx`: states per the UI-SPEC table (recording eyebrow with rec dot, timer and waveform plus the coral bar; shimmer `Finalizing…` / `Reading…`; amber `{n} to review`; `Reviewed` dimmed with `{a} accepted`; completeness chip; `Not reviewed yet`; `Transcript only` dimmed), hover/selected/focus actions `Review`, `Find knowledge`, `Open`.
- `today-view.tsx`: listbox timeline with 44px time columns, roving tabindex, ↑/↓/Enter/←/→, pointer slides (140ms out / 220ms in, ±16px), skeleton, empty and error states, refresh on knowledge, recording and meeting-change events.
- `page.tsx`: Today replaces the old home column; recording hooks, modals, recovery, the floating controls and `StatusOverlays` stay in place for 02-19.

## Task Commits

1. **Tasks 1–3** — `ce9739e` (feat)

## Verification

- `bun test` → 104 pass (today-view 9)
- Phase 1 completeness, finalization and provider-boundary contracts → 21 pass
- Palette check on `agenda/`, `app-shell/` and `page.tsx` → 0 offending classes; no raw HTML in `components/agenda`
- `next build` → compiled and type-checked; gallery → 102 passed

## Deviations from Plan

1. **[Rule 1 - Bug] Hydration mismatch.** The first gallery run failed because the prerendered heading used the build date; the requested day is now set on mount.
2. **[Plan premise] Queue snapshot source.** RecordingStateContext has no finalization snapshot, so TodayView subscribes to `recording-finalization-progress`; `StatusOverlays` exports `finalizationDetail` and `WAITING_FOR_STATUS` (the Phase 1 contract still passes). The Phase 1 wording says items, not segments.
3. **[Scope] Supporting edits:** `knowledge-section.tsx` (`id="knowledge"` + hash scroll), `meeting-header.tsx` (exports `clock`), `empty-state.tsx` (footnote accepts nodes for the lock glyph), `motion.ts` (`dayStepOut`, `dayStepIn`, `cssEase`), `app-shell.tsx` (uses them).
4. **[Deferred] Recording card `Stop ⌘R`** needs the shell recording host (02-19); the right-click menu is 02-21.
5. **[Process] One commit for all three tasks.**

## Known Interim State

- The legacy floating RecordingControls bar still overlaps the bottom of the Today list; 02-19 replaces it with the toolbar Record button and capsule.

## Next Phase Readiness

- 02-19 moves the recording host into the shell and removes `TranscriptPanel` and `RecordingControls` from `/`.
- 02-21 routes card activation through the side peek and adds the card context menu; 02-26 mirrors the listbox model for Review.

## Self-Check: PASSED

- Commit `ce9739e` is on `codex/phase-01-baseline`.
