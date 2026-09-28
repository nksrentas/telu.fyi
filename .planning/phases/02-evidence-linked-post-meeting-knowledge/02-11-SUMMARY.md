---
phase: 02-evidence-linked-post-meeting-knowledge
plan: 11
subsystem: ui
tags: [re-skin, completeness, recovery, toasts, button-group]

requires:
  - phase: 02-evidence-linked-post-meeting-knowledge
    provides: 02-04 tokens, toasts and primitives; 02-06 Dialog
provides:
  - MeetingCompleteness chips on Telu tones with unchanged labels, icons and copy
  - TranscriptRecovery as the 520px window-modal sheet
  - ConfirmationModal on Dialog with Cancel as the default focus
  - Glass custom toasts, glass ButtonGroup, field-well InputGroup, token Progress and Accordion
affects: [02-14, 02-16, 02-21]

actuals:
  tokens: 18000
  tasks: 2
  commits: 1

tech-stack:
  added: []
  patterns:
    - "ButtonGroup = GlassGroup look: inner Buttons go transparent at 28px, hover fill-2, hairline separators drawn as ::before on adjacent buttons"

key-files:
  created: []
  modified:
    - frontend/src/components/shared/DownloadProgressToast.tsx
    - frontend/src/components/MessageToast.tsx
    - frontend/src/lib/recordingNotification.tsx
    - frontend/src/components/ConfirmationModel/confirmation-modal.tsx
    - frontend/src/components/Logo.tsx
    - frontend/src/components/MeetingCompleteness.tsx
    - frontend/src/components/TranscriptRecovery/TranscriptRecovery.tsx
    - frontend/src/components/ui/button-group.tsx
    - frontend/src/components/ui/input-group.tsx
    - frontend/src/components/ui/progress.tsx
    - frontend/src/components/ui/accordion.tsx

key-decisions:
  - "The 520px recovery sheet stacks the meeting list above the preview (the old 900px two-column breakpoint no longer fits)"
  - "ConfirmationModal ignores outside clicks (kit: sheets do not close on scrim click); Esc and Cancel call onCancel"
  - "Recover meeting and Close recovery are the sheet's primary actions; Delete meeting keeps the coral destructive alias"

patterns-established: []

requirements-completed: []

coverage:
  - id: D1
    description: "11 files pass the palette gate; completeness contract and build pass"
    requirement: KNOW-03
    verification:
      - kind: other
        ref: "telu-palette.mjs check <11 files> (0 offending classes); node --test .github/verify-phase1-*.test.cjs .github/verify-telu-branding.test.cjs (38 pass)"
        status: pass
  - id: D2
    description: "Every screen renders, including transcript recovery"
    requirement: KNOW-03
    verification:
      - kind: automated_ui
        ref: "TELU_GALLERY_PORT=3231 pnpm --dir frontend gallery (40 passed)"
        status: pass

duration: 30min
completed: 2026-09-28
---

# Phase 2 Plan 11: Feedback surfaces, recovery sheet and grouped primitives Summary

**The remaining shared surfaces are on Telu tokens: completeness chips use amber and neutral tones with text and icons, recovery is a 520px window-modal sheet, confirmations focus Cancel first, custom toasts are glass, and ButtonGroup renders as a glass group.**

## Accomplishments

- MeetingCompleteness: 20px chips (amber for incomplete/pending and recovered-with-gaps, neutral for complete and completion-not-verified), sunken gap cards, neutral notice; labels, icons, `switch (completeness)` and dialog untouched.
- TranscriptRecovery: `max-w-[520px]`, 22px padding, sunken list and preview wells, accent ring on the selected meeting, primary Recover meeting and Close recovery.
- ConfirmationModal: Dialog with title, description, autofocused Cancel and a coral Delete; same props.
- DownloadProgressToast: glass capsule and accent progress; recording notification: fill hover, accent checkbox, tinted "Got it" action; Logo: neutral wordmark pill with arrow cursor.
- ButtonGroup/Text/Separator, InputGroup (28px well, 32% accent focus ring, coral invalid ring), Progress (6px fill-2 track, accent indicator), Accordion (separator borders, label triggers, label-3 chevron, no underline).

## Task Commits

1. **Tasks 1–2** — `cbaab4d` (feat)

## Verification

- Palette check on the 11 files → 0 offending classes
- `node --test .github/verify-phase1-*.test.cjs .github/verify-telu-branding.test.cjs` → 38 pass
- `NEXT_DIST_DIR=.next-gallery pnpm exec next build` → compiled and type-checked; `bun test` → 58 pass
- `TELU_GALLERY_PORT=3231 pnpm --dir frontend gallery` → 40 passed

## Deviations from Plan

1. **[Process] One commit for both tasks.**

## Issues Encountered

- Executed inline by the orchestrator.

## Next Phase Readiness

- Wave 3's re-skins are done; RecordingControls, Sidebar, MainContent and ProviderBoundary are the remaining legacy surfaces and belong to the shell plans (02-14 onward).

## Self-Check: PASSED

- Commit `cbaab4d` is on `codex/phase-01-baseline`.
