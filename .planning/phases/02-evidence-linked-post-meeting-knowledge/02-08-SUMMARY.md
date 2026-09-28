---
phase: 02-evidence-linked-post-meeting-knowledge
plan: 08
subsystem: ui
tags: [re-skin, audio-devices, analytics-consent, warnings]

requires:
  - phase: 02-evidence-linked-post-meeting-knowledge
    provides: 02-04 tokens and primitives; 02-06 Dialog, Select, Popover, Switch; 02-07 re-skin patterns
provides:
  - Audio device, backend, language and form components on Telu tokens
  - AnalyticsDataModal on the restyled Dialog
  - Warnings with icon plus text on amber-soft or coral-soft
affects: [02-09, 02-10, 02-11, 02-21]

actuals:
  tokens: 22000
  tasks: 2
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Warning text stays `text-label` on `bg-amber-soft`; the icon carries amber (amber body text fails contrast)"
    - "Field labels: `text-callout font-medium text-label-2`"

key-files:
  created: []
  modified:
    - frontend/src/components/AudioBackendSelector.tsx
    - frontend/src/components/DeviceSelection.tsx
    - frontend/src/components/LanguageSelection.tsx
    - frontend/src/components/LanguagePickerPopover.tsx
    - frontend/src/components/AudioLevelMeter.tsx
    - frontend/src/components/AnalyticsConsentSwitch.tsx
    - frontend/src/components/AnalyticsDataModal.tsx
    - frontend/src/components/ConfidenceIndicator.tsx
    - frontend/src/components/BluetoothPlaybackWarning.tsx
    - frontend/src/components/PermissionWarning.tsx
    - frontend/src/components/ComplianceNotification.tsx
    - frontend/src/components/Info.tsx
    - frontend/src/components/molecules/form-components/form-input-item.tsx
    - frontend/src/components/molecules/form-components/form-select-item.tsx

key-decisions:
  - "Level meter: below 70% series-green, at or above 70% amber (was green/yellow/red); coral stays for the recording state"
  - "Confidence dots: series-green, amber, coral-ink with the existing labels"
  - "Language picker rows hover on fill-2 and mark the current value with an accent check, instead of accent-filling rows outside a menu"
  - "PermissionWarning keeps `variant=\"destructive\"` on its Alert and overrides the tone to amber-soft, so the component API is unchanged"

patterns-established: []

requirements-completed: []

coverage:
  - id: D1
    description: "14 files pass the palette gate and the frontend builds"
    requirement: KNOW-03
    verification:
      - kind: other
        ref: "node frontend/scripts/telu-palette.mjs check <14 files> (0 offending classes); next build (compiled, type-checked)"
        status: pass
  - id: D2
    description: "AnalyticsData modal and the Settings screens hosting these components render"
    requirement: KNOW-03
    verification:
      - kind: automated_ui
        ref: "TELU_GALLERY_PORT=3228 pnpm --dir frontend gallery (40 passed)"
        status: pass

duration: 30min
completed: 2026-09-28
---

# Phase 2 Plan 08: Audio, consent, language, form and warning re-skin Summary

**Audio device and backend pickers, language selection, the analytics consent surfaces, confidence dots and all three warnings now use Telu tokens and primitives, with every handler, prop and string unchanged.**

## Accomplishments

- DeviceSelection / AudioBackendSelector / LanguageSelection: 13px section titles, 12px `label-2` field labels, 28px field-styled select, surface cards with an accent ring for the selected backend, `accent-color` radios, glass help tooltip, borderless coral error boxes.
- LanguagePickerPopover: glass surface, 11px uppercase section eyebrows, 6px-radius rows on `fill-2` hover, hairline separator.
- AudioLevelMeter (full and compact): green below 70%, amber at or above; tracks `fill-2`.
- AnalyticsConsentSwitch: sunken well for the toggle row, neutral info note, accent privacy link.
- AnalyticsDataModal: Radix `Dialog` (title, built-in labelled close, `aria-describedby={undefined}`), sunken wells, coral-soft "don't collect" block, default and destructive footer Buttons.
- Bluetooth, permission and compliance warnings: amber-soft with amber icons and label text; permission actions are Telu sm Buttons (Recheck plain); compliance notice is a glass float with a primary Done.

## Task Commits

1. **Tasks 1–2** — `9667949` (feat)

## Verification

- Palette check on the 14 files → 0 offending classes
- `NEXT_DIST_DIR=.next-gallery pnpm exec next build` → compiled and type-checked; `bun test` → 58 pass
- `node --test .github/verify-phase1-*.test.cjs` → 36 pass
- `TELU_GALLERY_PORT=3228 pnpm --dir frontend gallery` → 40 passed (dialog-analytics-data included)

## Deviations from Plan

1. **[Scope] Warnings use label-colored text** with amber icons and amber-soft fills instead of amber text (contrast).
2. **[Process] One commit for both tasks.**

## Issues Encountered

- Glass dialogs photograph without blur in headless WebKit (see 02-06).
- Executed inline by the orchestrator.

## Next Phase Readiness

- Onboarding and import surfaces (02-09) can reuse the warning and field patterns.

## Self-Check: PASSED

- Commit `9667949` is on `codex/phase-01-baseline`.
