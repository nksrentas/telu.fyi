---
phase: 02-evidence-linked-post-meeting-knowledge
plan: 09
subsystem: ui
tags: [re-skin, onboarding, import, updater]

requires:
  - phase: 02-evidence-linked-post-meeting-knowledge
    provides: 02-04 tokens and primitives; 02-06 Dialog; 02-07/02-08 re-skin patterns
provides:
  - Existing four-step onboarding on Telu tokens (same steps, copy and permission logic)
  - ImportAudio dialog and drop overlay, legacy database import and update surfaces on Telu tokens
affects: [02-21]

actuals:
  tokens: 20000
  tasks: 2
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Onboarding frame: `bg-window` + centred glass card (radius 20, shadow-window, blur 34)"
    - "Drop target: glass panel with a 2px dashed 70% accent outline inset 6px on the scrim"

key-files:
  created: []
  modified:
    - frontend/src/components/onboarding/OnboardingContainer.tsx
    - frontend/src/components/onboarding/steps/WelcomeStep.tsx
    - frontend/src/components/onboarding/steps/SetupOverviewStep.tsx
    - frontend/src/components/onboarding/steps/DownloadProgressStep.tsx
    - frontend/src/components/onboarding/steps/PermissionsStep.tsx
    - frontend/src/components/onboarding/shared/PermissionRow.tsx
    - frontend/src/components/onboarding/shared/ProgressIndicator.tsx
    - frontend/src/components/onboarding/shared/StatusIndicator.tsx
    - frontend/src/components/ImportAudio/ImportAudioDialog.tsx
    - frontend/src/components/ImportAudio/ImportDropOverlay.tsx
    - frontend/src/components/DatabaseImport/LegacyDatabaseImport.tsx
    - frontend/src/components/DatabaseImport/HomebrewDatabaseDetector.tsx
    - frontend/src/components/UpdateDialog.tsx
    - frontend/src/components/UpdateNotification.tsx

key-decisions:
  - "Completed onboarding steps show a label-2 check on fill-2 (green is not a Telu status color for progress); the current step is the accent dot"
  - "Legacy import: Browse is default, Import is the primary; Start Fresh is plain"
  - "Decorative header icons in the import and update dialogs moved from accent to label-2 (reserved-accent list)"

patterns-established: []

requirements-completed: []

coverage:
  - id: D1
    description: "Onboarding, import and update files pass the palette gate; branding contract passes"
    requirement: KNOW-03
    verification:
      - kind: other
        ref: "telu-palette.mjs check onboarding/ ImportAudio/ DatabaseImport/ UpdateDialog UpdateNotification (0 offending classes); node --test .github/verify-telu-branding.test.cjs + Phase 1 contracts (38 pass)"
        status: pass
  - id: D2
    description: "Every onboarding step, the ImportAudio dialog and the Update dialog render"
    requirement: KNOW-03
    verification:
      - kind: automated_ui
        ref: "TELU_GALLERY_PORT=3229 pnpm --dir frontend gallery (40 passed)"
        status: pass

duration: 30min
completed: 2026-09-28
---

# Phase 2 Plan 09: Onboarding, import and update re-skin Summary

**The existing onboarding flow is a centred Telu glass card with an accent step dot and one primary per step, and the import, legacy-database and update surfaces follow the same tokens, with steps, copy and logic unchanged.**

## Accomplishments

- OnboardingContainer: window background, glass card, 28px fill-2 nav circles (no hover scale), `title1` heading, 13px description.
- ProgressIndicator: accent current dot with an on-accent icon, fill-2 completed dots with a check, label-4/fill-3 connectors, arrow cursor.
- Steps: surface cards; Get Started / Continue / Finish Setup as `primary lg`; download cards with 6px accent progress and a primary Try again; permission rows as surface cards (coral-soft when denied) with glyph-plus-text status; StatusIndicator error on coral-ink.
- ImportAudio: primary Import, neutral header glyphs, 6px progress, borderless coral error; drop overlay as a glass panel with the dashed accent drop target and 13px label on the scrim.
- Legacy database import and Homebrew detector: neutral cards, Telu Buttons, borderless notes; Meetily compatibility wording untouched.
- UpdateDialog: neutral glyphs, primary Download and Install, 6px progress, borderless coral error.

## Task Commits

1. **Tasks 1–2** — `462a8a9` (feat)

## Verification

- Palette check on the onboarding, ImportAudio and DatabaseImport directories plus both update files → 0 offending classes
- `node --test .github/verify-telu-branding.test.cjs .github/verify-phase1-*.test.cjs` → 38 pass
- `NEXT_DIST_DIR=.next-gallery pnpm exec next build` → compiled and type-checked; `bun test` → 58 pass
- `TELU_GALLERY_PORT=3229 pnpm --dir frontend gallery` → 40 passed

## Deviations from Plan

1. **[Process] One commit for both tasks.**

## Issues Encountered

- Executed inline by the orchestrator.

## Next Phase Readiness

- 02-10 (summary, transcript, title, progress) and 02-11 (shared feedback, recovery, grouped primitives) finish the re-skin wave.

## Self-Check: PASSED

- Commit `462a8a9` is on `codex/phase-01-baseline`.
