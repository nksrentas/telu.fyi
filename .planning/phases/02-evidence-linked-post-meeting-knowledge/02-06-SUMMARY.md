---
phase: 02-evidence-linked-post-meeting-knowledge
plan: 06
subsystem: ui
tags: [shadcn, radix, tailwindcss-animate, overlays, focus]

requires:
  - phase: 02-evidence-linked-post-meeting-knowledge
    provides: 02-04 Telu tokens, keyframes and palette gate
provides:
  - Instant glass menus with accent-filled highlighted rows, a 60ms chosen-row blink and a 120ms fade
  - Glass popovers scaling from the trigger, with `instant` and `PopoverArrow`
  - Window-modal Dialog and Sheet on the scrim with glass, radius 20 and a labelled close button
  - Glass tooltips with 650/600ms provider defaults
  - Kit Switch, Input, Textarea, segmented Tabs and inline Alert
affects: [02-07, 02-08, 02-09, 02-10, 02-11, 02-14, 02-16, 02-19, 02-23, 02-24, 02-26]

actuals:
  tokens: 30000
  tasks: 2
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Overlay motion is CSS keyframes in tailwind.config.js (popover-in/out, menu-out, menu-blink, tip-in/out) so Radix Presence waits for the exit"
    - "Overlays keep shadcn's shared z-50: portals opened from a dialog stack by DOM order"

key-files:
  created: []
  modified:
    - frontend/src/components/ui/dialog.tsx
    - frontend/src/components/ui/sheet.tsx
    - frontend/src/components/ui/command.tsx
    - frontend/src/components/ui/select.tsx
    - frontend/src/components/ui/dropdown-menu.tsx
    - frontend/src/components/ui/popover.tsx
    - frontend/src/components/ui/tooltip.tsx
    - frontend/src/components/ui/switch.tsx
    - frontend/src/components/ui/input.tsx
    - frontend/src/components/ui/textarea.tsx
    - frontend/src/components/ui/tabs.tsx
    - frontend/src/components/ui/alert.tsx
    - frontend/tailwind.config.js

key-decisions:
  - "The chosen-row blink marks the item with data-chosen on select; the content delays its 120ms fade by 130ms only when a row was chosen (`:has([data-chosen])`), so Esc and outside clicks fade at once"
  - "Keyboard-summoned popovers pass `instant` (UI-SPEC: ⌘F); modality is not guessed inside the primitive"
  - "Kept shadcn's uniform z-50 instead of the kit's 150/160/181 ladder, because Select and menus open from inside dialogs and must stack above them"
  - "Menu radius 12 and a capsule segmented control follow the skill's kit CSS where the plan text said 10 and 8"
  - "Field focus ring is the UI-SPEC 32% accent ring (inset 0.5px accent + 3.5px ring); inputs drop the global outline so there is one ring"

patterns-established:
  - "Danger menu rows: `variant=\"danger\"` (coral-ink text, coral highlight and blink)"

requirements-completed: []

coverage:
  - id: D1
    description: "Overlays restyled with unchanged exports; no zoom or slide classes on menus; tooltip delays 650/600; dialog scrim"
    requirement: KNOW-03
    verification:
      - kind: other
        ref: "grep acceptance checks and telu-palette.mjs check on the seven overlay files (0 offending classes)"
        status: pass
  - id: D2
    description: "Controls restyled; every existing screen renders"
    requirement: KNOW-03
    verification:
      - kind: automated_ui
        ref: "TELU_GALLERY_PORT=3226 pnpm --dir frontend gallery (40 passed)"
        status: pass

duration: 40min
completed: 2026-09-28
---

# Phase 2 Plan 06: Shared overlays and controls Summary

**Every shadcn overlay and control now uses Telu glass materials, instant menus with an accent-filled active row, trigger-origin popovers, scrim-backed dialogs and kit fields with visible focus, and no public API changed.**

## Accomplishments

- DropdownMenu: glass surface (blur 26, saturate 1.8, radius 12, 5px inset), 24px rows, `data-[highlighted]` accent fill (never on plain hover), chosen-row blink, 120ms fade, label/separator/shortcut restyled, `variant="danger"`.
- Select: popup-button trigger (28px well), instant glass content, accent highlighted row, separator `bg-separator`.
- Command: glass list, 36px borderless input with a hairline, accent-filled selected row.
- Popover: glass radius 14, `popover-in` (fade 150 + scale 190 from `--radix-popover-content-transform-origin`), `popover-out` 110ms, `instant` prop, `PopoverArrow` (0×0).
- Dialog / Sheet: `bg-scrim` overlay, glass blur 34, `shadow-window`, radius 20, 22px padding, 0.95→1 220ms / 140ms (Sheet slides with the drawer curve), 24px close button with `aria-label="Close"`.
- Tooltip: glass, 12px label, delayed-open scale-in, `TooltipProvider` defaults 650/600.
- Switch 32×18 with an explicit 45% accent focus outline and 40% disabled; Input/Textarea 28px wells; Tabs as a 28px capsule segmented control; Alert neutral `surface-sunken` / destructive `coral-soft`.

## Task Commits

1. **Tasks 1–2** — `30f86db` (feat)

## Verification

- `grep -n "zoom-in\|slide-in-from" dropdown-menu.tsx select.tsx` → nothing
- `tooltip.tsx` has `delayDuration = 650` and `skipDelayDuration = 600`; `dialog.tsx` has `bg-scrim`; `switch.tsx` has `focus-visible:outline`
- `node frontend/scripts/telu-palette.mjs check` on all twelve files → 0 offending classes
- `NEXT_DIST_DIR=.next-gallery pnpm exec next build` → compiled and type-checked; `bun test` → 58 pass
- `TELU_GALLERY_PORT=3226 pnpm --dir frontend gallery` → 40 passed

## Deviations from Plan

1. **[Design source] Menu radius 12 and capsule Tabs** follow the kit (plan text: 10 and 8).
2. **[Rule 1 - Bug] z-index ladder not adopted** (see key decisions).
3. **[Scope] Blink and fade apply to DropdownMenu only.** Radix Select unmounts its content immediately on close, and cmdk rows close through the caller's handler, so neither can show a blink.
4. **[Process] One commit for both tasks**; `tailwind.config.js` gained the overlay keyframes.

## Issues Encountered

- Headless WebKit screenshots do not render `backdrop-filter`, so glass layers in the gallery look like plain 84% white; Tailwind emits `-webkit-backdrop-filter`, which WKWebView renders.
- Settings, the settings modal and the meeting split view still override `TabsList` with underline classes; their re-skins (02-07, 02-10) remove the overrides so the segmented control shows.
- Executed inline by the orchestrator.

## Next Phase Readiness

- Re-skin plans can rely on the primitives for materials and focus; screen-level palette classes are theirs to migrate.

## Self-Check: PASSED

- Commit `30f86db` is on `codex/phase-01-baseline`.
