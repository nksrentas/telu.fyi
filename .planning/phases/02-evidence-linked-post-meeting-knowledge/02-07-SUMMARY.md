---
phase: 02-evidence-linked-post-meeting-knowledge
plan: 07
subsystem: ui
tags: [re-skin, settings, model-managers, palette-gate]

requires:
  - phase: 02-evidence-linked-post-meeting-knowledge
    provides: 02-04 tokens, Button, Chip, Spinner and palette gate; 02-06 restyled primitives
provides:
  - Settings screen with a plain toolbar title and segmented tabs
  - Settings panels and every model manager on Telu tokens (0 palette offenders in 14 files)
  - Codemod support for legacy `bg-opacity-*` overlays
affects: [02-08, 02-09, 02-10, 02-11, 02-21]

actuals:
  tokens: 40000
  tasks: 2
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Settings groups: `rounded-card bg-surface p-6 shadow-card`; wells: `rounded-[10px] bg-surface-sunken p-4`; titles `text-title3`; captions `text-callout text-label-2`"
    - "Info notes are neutral (`bg-fill` + label text); warnings are `bg-amber-soft` with label text (amber text fails contrast)"
    - "Selectable cards: `ring-2 ring-accent` when selected, `hover:shadow-card-hover` otherwise, arrow cursor"

key-files:
  created: []
  modified:
    - frontend/src/app/settings/page.tsx
    - frontend/src/app/_components/SettingsModal.tsx
    - frontend/src/components/TranscriptSettings.tsx
    - frontend/src/components/SummaryModelSettings.tsx
    - frontend/src/components/SummaryLanguageSettings.tsx
    - frontend/src/components/PreferenceSettings.tsx
    - frontend/src/components/RecordingSettings.tsx
    - frontend/src/components/BetaSettings.tsx
    - frontend/src/components/About.tsx
    - frontend/src/components/ModelSettingsModal.tsx
    - frontend/src/components/WhisperModelManager.tsx
    - frontend/src/components/ParakeetModelManager.tsx
    - frontend/src/components/BuiltInModelManager.tsx
    - frontend/src/components/ModelDownloadProgress.tsx
    - frontend/scripts/telu-palette.mjs
    - frontend/tests/components/telu-design-system.test.tsx

key-decisions:
  - "Model list actions (Download, Retry, Re-download) are default sm Buttons, not primary: each row has one, and the surface's one primary is Save"
  - "The Recommended badge is a neutral white pill with a card shadow (it straddles the card edge, so a translucent accent tint would look uneven)"
  - "Body text moved from 14px to the 13px Telu body size in these files"

patterns-established:
  - "Re-skin order: telu-palette migrate → pattern pass (cards, titles, captions, notes) → hand-convert styled <button>s to Button variants → palette check"

requirements-completed: []

coverage:
  - id: D1
    description: "14 files pass the palette gate; ProviderBoundary disclosures intact; Phase 1 contracts pass"
    requirement: KNOW-03
    verification:
      - kind: other
        ref: "node frontend/scripts/telu-palette.mjs check <14 files> (0 offending classes); node --test .github/verify-phase1-*.test.cjs (36 pass)"
        status: pass
  - id: D2
    description: "Every Settings tab and the model settings modal render"
    requirement: KNOW-03
    verification:
      - kind: automated_ui
        ref: "TELU_GALLERY_PORT=3227 pnpm --dir frontend gallery (40 passed)"
        status: pass

duration: 55min
completed: 2026-09-28
---

# Phase 2 Plan 07: Settings and model managers re-skin Summary

**Settings and every model surface now read as Telu: a plain toolbar title, a segmented tab control, surface cards, chip statuses, accent selection rings and Telu buttons, with handlers, copy and Phase 1 disclosures unchanged.**

## Accomplishments

- `settings/page.tsx`: 52px drag-region toolbar with `Settings` (15px/600); the Back link and the spring underline (with its layout effect and refs) removed; `TabsList` renders the 28px segmented control with 14px icons.
- Settings panels: cards, wells, titles, captions, neutral notes, amber warnings, Beta badge, dashed "Add language" capsule and accent-soft pinned language chips; three Open Folder buttons and the About CTA (`primary`) are Telu Buttons.
- `SettingsModal.tsx`: scrim overlays (were becoming solid, see Issues), glass sheets (radius 20, blur 34), field-styled inputs, accent selection ring on Ollama models, Telu Buttons, a Telu-sized hand-rolled toggle with a focus ring, neutral alert text.
- Model managers: Chip `Ready` (circle-check), `Selected` (accent), `Corrupted` / `Error` (coral with glyphs); accent ring selection; `bg-fill-2` 6px tracks with `bg-accent` fills; `Spinner` in the download card; Download/Retry/Re-download default Buttons, corrupted Delete `destructive`; ProgressRing strokes on tokens.

## Task Commits

1. **Tasks 1–2** — `172449a` (feat)

## Verification

- Palette check on all 14 files → 0 offending classes
- `node --test .github/verify-phase1-*.test.cjs` → 36 pass (includes provider-boundary and diagnostics)
- `NEXT_DIST_DIR=.next-gallery pnpm exec next build` → compiled and type-checked; `bun test` → 58 pass
- `TELU_GALLERY_PORT=3227 pnpm --dir frontend gallery` → 40 passed; settings tabs render as the segmented control

## Deviations from Plan

1. **[Rule 1 - Bug] Codemod fix in `telu-palette.mjs`.** `bg-black bg-opacity-50` became an opaque `bg-label` overlay because the legacy `bg-opacity-*` utility sits in a separate token. `migrate` now merges `bg-black … bg-opacity-N` → `bg-scrim` and `bg-white … bg-opacity-N` → `bg-glass-strong`, and `check` flags leftover `*-opacity-*` utilities; covered by the palette unit tests. AnalyticsDataModal and confirmation-modal (02-08, 02-11) have the same pattern.
2. **[Rule 1 - Bug] A duplicate `variant` attribute** (the Ollama download button kept its old `variant="default"`) was removed.
3. **[Process] One commit for both tasks.**

## Issues Encountered

- Scratch helper scripts (not committed) inserted one import inside a multi-line import; the build caught it and it was fixed before commit.
- Executed inline by the orchestrator.

## Next Phase Readiness

- 02-08..02-11 can reuse the same pattern pass; `bg-opacity` overlays now migrate correctly.

## Self-Check: PASSED

- Commit `172449a` is on `codex/phase-01-baseline`.
