---
phase: 02-evidence-linked-post-meeting-knowledge
plan: 19
subsystem: ui
tags: [recording, shell, capsule, live-transcript, provider-boundary, KNOW-01, KNOW-02]

requires:
  - phase: 02-evidence-linked-post-meeting-knowledge
    provides: 02-15 knowledge runs, 02-16 AppShell, 02-17 deletion, 02-25 Today and the toolbars
provides:
  - RecordingHost with RecordingControlsContext (controls, title, elapsed time, finalization snapshot)
  - RecordSlot (Record button or capsule) in the agenda and doc toolbars
  - LiveTranscript on the meeting page
affects: [02-21, 02-26]

actuals:
  tokens: 90000
  tasks: 3
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Recording hooks, recovery, modals, overlays and Cmd+R live only in RecordingHost; pages read state through useRecordingControlsContext"
    - "The host owns the transcription route state through a hidden ProviderBoundary; the toolbar shows a compact ProviderBoundary before Record"
    - "Window-level recording alerts and the finalization overlay stack at the bottom of the content column (fixed, left of --sidebar-w)"

key-files:
  created:
    - frontend/src/hooks/use-recording-controls.ts
    - frontend/src/components/app-shell/recording-host.tsx
    - frontend/src/components/app-shell/recording-capsule.tsx
    - frontend/src/components/living-doc/live-transcript.tsx
    - frontend/src/lib/format-elapsed.ts
    - frontend/tests/components/recording-host.test.tsx
  modified:
    - frontend/src/app/layout.tsx
    - frontend/src/app/page.tsx
    - frontend/src/app/meeting-details/page-content.tsx
    - frontend/src/app/_components/StatusOverlays.tsx
    - frontend/src/components/ProviderBoundary.tsx
    - frontend/src/components/app-shell/agenda-toolbar.tsx
    - frontend/src/components/app-shell/doc-toolbar.tsx
    - frontend/src/components/agenda/today-view.tsx
    - frontend/src/components/agenda/event-card.tsx
    - frontend/src/components/living-doc/source-chip.tsx
    - frontend/src/components/living-doc/evidence-popover.tsx
    - .github/verify-phase1-finalization-ui.test.cjs
    - .github/verify-phase1-provider-boundary.test.cjs
  deleted:
    - frontend/src/components/RecordingControls.tsx
    - frontend/src/app/_components/TranscriptPanel.tsx

key-decisions:
  - "The capsule replaces the Record glass group in the same toolbar slot (one control); it has no pause control, pause stays in the tray"
  - "Cmd+R stops while recording and otherwise starts through the same guarded start; it is ignored while typing, with a dialog open, or on key repeat"
  - "ProviderBoundary gained a compact form (location, short origin, Not encrypted) for the toolbar; the full card and alerts are unchanged"
  - "Device start failures now show as a dismissible alert in the host's bottom stack with shorter copy; route failures keep ProviderRouteFailureAlert"
  - "The home page keeps the permission warning above Today through a notice slot; the live TranscriptPanel is gone and live lines show on the meeting page"
  - "LiveTranscript shows while TranscriptContext's current meeting is this page's meeting and recording, stopping, processing or saving"

patterns-established:
  - "Listener counts per event are asserted with a mocked listen that tracks active subscriptions"

requirements-completed: [KNOW-01, KNOW-02]

coverage:
  - id: D1
    description: "Single host subscriptions (Today adds none), route revalidation before start, unvalidated route never starts, capture outcome continues_locally then stopped, retry keeps the provider, tray start once"
    verification:
      - kind: unit
        ref: "frontend/tests/components/recording-host.test.tsx (RecordingHost)"
        status: pass
  - id: D2
    description: "RecordSlot disclosure before Record, starting spinner, capsule label and hidden timer, nothing while stopping; LiveTranscript lines, Jump to latest and re-pin"
    verification:
      - kind: unit
        ref: "frontend/tests/components/recording-host.test.tsx (RecordSlot, LiveTranscript); 7 pass"
        status: pass
      - kind: automated_ui
        ref: "TELU_GALLERY_PORT=3239 pnpm --dir frontend gallery (122 passed; home-recording shows the capsule)"
        status: pass
  - id: D3
    description: "Phase 1 finalization and provider-boundary contracts re-pointed without weakening"
    verification:
      - kind: integration
        ref: "node --test .github/*.test.cjs (56 pass)"
        status: pass

duration: 120min
completed: 2026-09-28
---

# Phase 2 Plan 19: Recording in the shell Summary

**Recording now lives in the shell: Record and the recording capsule sit in the toolbars, recording state, recovery and finalization are hosted once for every route, and the meeting page shows the live transcript.**

## Accomplishments

- `use-recording-controls.ts`: route state from the transcription ProviderBoundary, `validateProviderRoute(transcriptionRouteState.route)` before `onRecordingStart()`, retry after refresh, Rust-synced `continues_locally` / `stopped`, terminal-finalization guard, stop with the Rust snapshot, transcript error handling.
- `recording-host.tsx`: `useRecordingStateSync`, `useRecordingStart`, `useRecordingStop`, startup recovery, `SettingsModals`, `TranscriptRecovery`, `StatusOverlays`, route failure and device alerts, Cmd+R, the finalization snapshot for Today cards.
- `recording-capsule.tsx`: `RecordButton` (coral glyph with halo, `⌘R`, `aria-keyshortcuts="Meta+R"`), `RecordingCapsule` (`role="status"`, `Recording {title}, {n} minutes`, tabular timer, coral Stop, 240ms in / 150ms out), `RecordSlot`.
- `live-transcript.tsx`: `LIVE TRANSCRIPT`, 280ms / 6px line entry, pinned scroll with `Jump to latest`.

## Task Commits

1. **Tasks 1–3** — `c49e13f` (feat)

## Verification

- `bun test` → 121 pass (recording-host 7)
- `node --test .github/*.test.cjs` → 56 pass
- Palette check on `app-shell/`, `living-doc/`, `agenda/`, `page.tsx` → 0 offending classes
- `next build` → compiled and type-checked; gallery → 122 passed

## Deviations from Plan

1. **[Rule 2 - Missing critical] Permission warning kept on Today** (it lived in the deleted TranscriptPanel) through a `notice` slot on TodayView.
2. **[Scope] `ProviderBoundary` compact prop** added; `StatusOverlays` lost its own positioning so the host can stack it with the alerts.
3. **[Rule 1 - Bug] Live card ring:** the arbitrary color-mix shadow did not render in the gallery; the card now uses `shadow-card-hover ring-1 ring-coral`.
4. **[Test] Subscriber counts:** `transcription-error` has two consumers by design (the modal toast and the controls) and `recording-stopped` / `recording-finalization-progress` have three (stop hook, overlays, controls or host snapshot); the test asserts these fixed counts stay constant and that Today adds none.
5. **[Process] One commit for all three tasks.**

## Human Check Pending

- In `pnpm --dir frontend tauri:dev`: Cmd+R on Today, speak 30 seconds, open the recording card, Stop from the capsule; Record from the tray; force-quit during a second recording and relaunch. Expected: capsule replaces Record, Today shows Recording then Finalizing with real queue detail, LIVE TRANSCRIPT then the finalized page, tray toggle works, relaunch offers recovery under the same meeting id.

## Next Phase Readiness

- 02-21 routes card activation through the side peek and adds the card context menu (with Stop recording); 02-26 adds the Review tab.

## Self-Check: PASSED

- Commit `c49e13f` is on `codex/phase-01-baseline`.
