---
phase: 02-evidence-linked-post-meeting-knowledge
plan: 02
subsystem: testing
tags: [playwright, webkit, visual-regression, tauri-ipc-stub]

requires:
  - phase: 01-baseline-observability-identity-and-trust-boundaries
    provides: the existing screens and Tauri commands being baselined
provides:
  - Repeatable WebKit screenshot gallery (pnpm --dir frontend gallery)
  - Tauri IPC stub that fails on any unmocked command
  - Before gallery of 20 existing screens in light and dark (40 PNGs)
affects: [02-04, 02-06, 02-07, 02-08, 02-09, 02-10, 02-11, 02-14, 02-16, 02-21]

actuals:
  tokens: 12000
  tasks: 2
  commits: 1

tech-stack:
  added: ["@playwright/test 1.63.0 (dev, exact pin; WebKit 26.6 browser build)"]
  patterns:
    - "Screens are JSON: path, ipc overrides, steps (click, waitFor, press, hover, dispatch), optional localStorage, IndexedDB seed and viewport"
    - "Fixtures can answer per argument with { \"$byArg\": \"<arg>\", \"cases\": {…}, \"default\": … }"

key-files:
  created:
    - frontend/tests/visual/playwright.config.ts
    - frontend/tests/visual/tauri-ipc-stub.js
    - frontend/tests/visual/gallery.visual.ts
    - frontend/tests/visual/fixtures/base-ipc.json
    - frontend/tests/visual/screens/existing-screens.json
    - .planning/phases/02-evidence-linked-post-meeting-knowledge/gallery/before/
  modified:
    - frontend/package.json
    - frontend/pnpm-lock.yaml
    - frontend/.gitignore
    - frontend/next.config.js
    - frontend/tsconfig.json

key-decisions:
  - "User approved @playwright/test 1.63.0 (Microsoft repository and maintainers, published 2026-09-04, no install scripts) at the blocking-human checkpoint"
  - "The gallery's Next dev server uses NEXT_DIST_DIR=.next-gallery so it never shares .next with a running tauri:dev"
  - "The transcript view is captured at 720px wide (below the md breakpoint) because at 1100px both panes are always visible"
  - "The update dialog screen allows the updater canary decision and serves a synthetic 0.5.0 update; the analytics screen opts in through store fixtures before toggling off"
  - "Dark PNGs look like light ones: the current app has no dark styles (window forced Light); they are the baseline for 02-04's dark tokens"

patterns-established:
  - "Later plans add screens/<area>.json; only shell plans edit fixtures/base-ipc.json"

requirements-completed: [KNOW-02, KNOW-03]

coverage:
  - id: D1
    description: "Gallery renders all 20 existing screens in light and dark with zero page errors and zero unmocked commands; before PNGs committed"
    requirement: KNOW-03
    verification:
      - kind: automated_ui
        ref: "GALLERY_LABEL=before pnpm --dir frontend gallery (40 passed)"
        status: pass

duration: 50min
completed: 2026-09-28
---

# Phase 2 Plan 02: Visual gallery Summary

**A one-command WebKit gallery now screenshots every existing screen in light and dark with a strict Tauri IPC stub, and the "before" set is committed as the D-01 baseline for the redesign.**

## Accomplishments

- Task 1 (checkpoint): registry evidence for `@playwright/test` presented and approved by the user as `1.63.0`.
- `pnpm --dir frontend add -D --save-exact @playwright/test@1.63.0` and `playwright install webkit`; `gallery` script added.
- `tauri-ipc-stub.js`: `__TAURI_INTERNALS__` with invoke, callbacks and window metadata; event listen/unlisten; frozen `Date` (2026-09-27 10:46 local); `dark` class for the dark theme; unmocked commands recorded and rejected.
- `gallery.visual.ts`: per screen and theme, merges fixtures, seeds storage, runs steps, waits for network idle, screenshots with animations disabled, and asserts no page errors and no unmocked commands.
- 20 screens: home idle and recording, meeting summary and transcript, six Settings tabs, four onboarding steps, transcript recovery, import audio, update, analytics data, model settings, notes.

## Task Commits

1. **Task 1** — checkpoint only (no files).
2. **Task 2** — `18f036c` (test)

## Verification

- `GALLERY_LABEL=before pnpm --dir frontend gallery` → 40 passed
- PNG count check → screens 40, pngs 40
- `bun test --cwd frontend tests/lib/summary-content.test.ts` → 3 pass (bun does not collect the gallery)
- `frontend/package.json` pins `"@playwright/test": "1.63.0"` with no range

## Deviations from Plan

1. **[Rule 3 - Blocking] `next.config.js` reads `distDir` from `NEXT_DIST_DIR`** (default `.next`) so the gallery can run while `tauri:dev` is up; `.next-gallery/` is gitignored and pre-listed in `tsconfig.json` so Next does not rewrite it.
2. **[Rule 3 - Blocking] `tsconfig.json` excludes `tests/visual`** so the Next type check does not compile Playwright files.
3. **[Scope note] The baseline includes 02-01's Knowledge section** on the meeting page; it was captured before any token change, which is what D-01 requires.

## Issues Encountered

Fixture discovery took five iterations (43 commands stubbed). Executed inline by the orchestrator.

## Next Phase Readiness

- 02-04 can run the gallery with `GALLERY_LABEL=after` (or unlabeled) and compare against `gallery/before/`.

## Self-Check: PASSED

- 40 PNGs under `gallery/before/{light,dark}`; commit `18f036c` is on `codex/phase-01-baseline`.
