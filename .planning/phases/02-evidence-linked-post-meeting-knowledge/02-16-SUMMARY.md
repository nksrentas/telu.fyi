---
phase: 02-evidence-linked-post-meeting-knowledge
plan: 16
subsystem: ui
tags: [shell, sidebar, window-chrome, vibrancy, navigation]

requires:
  - phase: 02-evidence-linked-post-meeting-knowledge
    provides: 02-13 agenda_counts and localDayBounds, 02-14 meeting page and doc toolbar, 02-06 restyled primitives, 02-17 telu:meetings-changed
provides:
  - AppShell framing every route, with the Sidebar (Today count, Import audio, Stored on this Mac, Settings)
  - Overlay window chrome with sidebar vibrancy and the start-dragging permission
  - Base gallery fixtures agenda_counts and agenda_list_day
affects: [02-19, 02-21, 02-25, 02-26]

actuals:
  tokens: 52000
  tasks: 3
  commits: 1

tech-stack:
  added: []
  patterns:
    - "AppShell owns Cmd+, and Cmd+[ on window and skips events a page already handled (the meeting page keeps its own Cmd+[ on document)"
    - "View switches fade (opacity + 2px blur, 200ms) only after pointer input, through the Web Animations API, so keyboard navigation stays instant"
    - "Content anchored to the bottom of a page uses absolute positioning inside the shell's relative main column, never fixed + sidebar margins"

key-files:
  created:
    - frontend/src/components/app-shell/app-shell.tsx
    - frontend/src/components/app-shell/sidebar.tsx
    - frontend/tests/components/app-shell.test.tsx
    - frontend/tests/visual/screens/shell.json
  modified:
    - frontend/src-tauri/tauri.conf.json
    - frontend/src/app/layout.tsx
    - frontend/src/app/page.tsx
    - frontend/src/app/_components/StatusOverlays.tsx
    - frontend/tests/lib/agenda-service.test.ts
    - frontend/tests/visual/fixtures/base-ipc.json
  deleted:
    - frontend/src/components/MainContent/index.tsx

key-decisions:
  - "Sidebar order follows UI-SPEC: Today, then the footer Stored on this Mac, then the plain action rows Import audio (beta flag, on by default) and Settings (label-2 icon, ⌘, hint, aria-keyshortcuts Meta+Comma)"
  - "The Today count's accessible name is Today, {n} meetings; a failed count load hides the count and logs to the console"
  - "Out-of-order count responses are dropped with a request counter"
  - "Selection is exact-path: / selects Today, /settings selects Settings, the meeting page selects nothing"

patterns-established:
  - "SidebarNavItem renders a next/link for destinations and a button for actions, 28px, radius 8, press 0.985, no hover fill"

requirements-completed: []

coverage:
  - id: D1
    description: "Overlay chrome, vibrancy, minimum size and the drag permission only"
    verification:
      - kind: integration
        ref: "cargo check (tauri-build validates tauri.conf.json); node --test .github/verify-phase1-egress-capabilities.test.cjs (3 pass)"
        status: pass
      - kind: manual
        ref: "Packaged-app check: vibrancy, traffic lights on the 52px band, fullscreen, drag strips, DMG transparency (tauri#13415)"
        status: pending
  - id: D2
    description: "Real-data sidebar, current-route marking, Import audio flag, count refresh events, shell shortcuts and pointer-only fade"
    verification:
      - kind: unit
        ref: "frontend/tests/components/app-shell.test.tsx (6 pass)"
        status: pass
      - kind: automated_ui
        ref: "TELU_GALLERY_PORT=3238 pnpm --dir frontend gallery (90 passed, every screen inside the shell, zero unmocked commands)"
        status: pass

duration: 70min
completed: 2026-09-28
---

# Phase 2 Plan 16: Telu shell Summary

**Every route now renders inside the Telu shell: native overlay chrome with sidebar vibrancy, a 244px sidebar showing only real data, and a content column with a hairline edge.**

## Accomplishments

- `tauri.conf.json`: `label main`, Overlay title bar, hidden title, traffic lights at 20/20, `transparent`, `windowEffects sidebar` following the active state, 900×600 minimum; `core:window:allow-start-dragging` is the only new permission. Close still hides.
- `app-shell.tsx`: sidebar + `main` (`bg-content`, 0.5px hairline shadow), Cmd+, → `/settings`, Cmd+[ → `router.back()`, pointer-only view fade.
- `sidebar.tsx`: 52px drag inset, Today (`sun`, accent) with the `agenda_counts` day count, drag spacer, footer, Import audio and Settings rows.
- `layout.tsx`: `<AppShell>{children}</AppShell>` inside the existing providers; `html` and `body` transparent; onboarding, tray forwarding and drag-drop import unchanged.

## Task Commits

1. **Tasks 1–3** — `382f66a` (feat)

## Verification

- `cargo check` → finished; egress capability contract → 3 pass; Phase 1 completeness + finalization UI contracts → 12 pass
- `bun test` → 87 pass; palette check on `app-shell/` and `layout.tsx` → 0 offending classes
- `next build` → compiled and type-checked; gallery → 90 passed

## Deviations from Plan

1. **[Rule 1 - Bug] Home controls and the finalization overlay covered the sidebar.** Both were `fixed` full-width bands offset by the old sidebar's collapse width, so they swallowed clicks on Import audio and Settings (caught by `dialog-import-audio`). They are now `absolute` inside the main column; the dead `sidebarCollapsed` prop is gone from `StatusOverlays`.
2. **[Rule 3 - Blocking] `agenda-service.test.ts` mocks `@tauri-apps/api/core` itself.** Loading the agenda service earlier (through the sidebar) exposed a Bun leak: `paginated-transcripts.test.tsx`'s core mock stays bound in modules imported before it, so the agenda test's window stub was never reached.
3. **[Process] One commit for all three tasks.**

## Issues Encountered

- React test renderer bails out when `update` receives the same element, so the shell test builds a fresh element per update; unmounts run inside `act` so effect cleanups finish before the window stub is restored.

## Human Check Pending

- Build with `pnpm --dir frontend tauri:build`, install the DMG, then verify vibrancy, traffic-light placement (centred on the 52px band, through fullscreen), dragging from the strips only, clickable toolbar buttons and close-to-hide. If DMG transparency fails (tauri#13415), keep the chrome config and paint the sidebar with `--window-bg`.

## Next Phase Readiness

- 02-25 replaces `/` with Today and deletes the old sidebar file; 02-26 adds the Review row; 02-19 moves the recording host into the shell (anchor overlays to the main column).
- `transparent: true` also applies on Windows and Linux, where there is no sidebar material; a platform config should turn it off there before those builds ship.

## Self-Check: PASSED

- Commit `382f66a` is on `codex/phase-01-baseline`.
