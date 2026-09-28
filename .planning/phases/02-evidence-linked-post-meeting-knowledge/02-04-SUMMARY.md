---
phase: 02-evidence-linked-post-meeting-knowledge
plan: 04
subsystem: ui
tags: [tailwind, design-tokens, framer-motion, sonner, cva, palette-gate]

requires:
  - phase: 02-evidence-linked-post-meeting-knowledge
    provides: 02-02 visual gallery and the before screenshots
provides:
  - One Telu token vocabulary (light and dark) mapped straight into Tailwind
  - SF system font, MotionConfig reducedMotion user, shared motion presets
  - Glass capsule toasts through sonner classNames
  - telu-palette.mjs check/migrate gate with a deterministic mapping
  - Telu Button (default, primary, record, tinted, plain + legacy aliases)
  - telu-ui primitives Icon, GlassGroup, Chip, KnowledgeType, EmptyState, Spinner, Shimmer, Skeleton, RecDot, Waveform
affects: [02-06, 02-07, 02-08, 02-09, 02-10, 02-11, 02-14, 02-16, 02-19, 02-21, 02-23, 02-24, 02-26]

actuals:
  tokens: 45000
  tasks: 3
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Colors are token classes only (bg-fill-2, text-label-2, bg-accent-soft); opacity modifiers on tokens are not allowed because Tailwind 3 cannot apply them to hex variables"
    - "Re-skin plans run `node frontend/scripts/telu-palette.mjs migrate <their files>`, fix what is left for review by hand, then `check` must print 0 offending classes"
    - "Indicators take `active` and loop only while it is true; reduced motion stops loops and slows RecDot to 2.4s"
    - "cn() knows the Telu font sizes, radii and shadows, so text-caption survives next to text-label-2"

key-files:
  created:
    - frontend/src/lib/motion.ts
    - frontend/scripts/telu-palette.mjs
    - frontend/tests/components/telu-design-system.test.tsx
    - frontend/src/components/telu-ui/icon.tsx
    - frontend/src/components/telu-ui/glass-group.tsx
    - frontend/src/components/telu-ui/chip.tsx
    - frontend/src/components/telu-ui/knowledge-type.tsx
    - frontend/src/components/telu-ui/empty-state.tsx
    - frontend/src/components/telu-ui/indicators.tsx
  modified:
    - frontend/src/app/globals.css
    - frontend/tailwind.config.js
    - frontend/src/app/layout.tsx
    - frontend/src/components/ui/button.tsx
    - frontend/src/lib/utils.ts
    - .github/verify-phase1-completeness-ui.test.cjs

key-decisions:
  - "tailwind.config.js safelists `dark`: Tailwind purged the `.dark` token block from @layer base because no source file contains the bare word `dark` (this is also why the before dark gallery looked light)"
  - "Toast capsule classes go on the typed toast classNames (success, info, loading, warning, error), not on `toast`, so the one custom toast (DownloadProgressToast) keeps its own card"
  - "Button keeps `size=\"icon\"` (28px square) and `size=\"default\"` (md) for existing callers and adds the reference's boolean `icon` variant for squares at sm and lg"
  - "Buttons force 16px icons only when the svg has no `size-` class, so Telu Icon sizes (which carry a size class) are respected inside buttons"
  - "Green and teal backgrounds at 20% opacity or less map to bg-fill (there is no soft series token), matching their 50–200 shade mapping"

patterns-established:
  - "telu-ui components: \"use client\", data-slot, cn, token classes only, comment-free"

requirements-completed: []

coverage:
  - id: D1
    description: "Token swap: no HSL variables, SF font, MotionConfig, glass toasts; app builds and Phase 1 UI contracts pass"
    requirement: KNOW-03
    verification:
      - kind: automated_ui
        ref: "NEXT_DIST_DIR=.next-gallery pnpm exec next build; node --test .github/verify-phase1-*.test.cjs (29 pass)"
        status: pass
  - id: D2
    description: "Palette gate flags and maps palette shades, white/black, token opacity and HSL variables; CLI check exits 1 with file:line and 0 on clean files; migrate rewrites only given paths"
    requirement: KNOW-03
    verification:
      - kind: unit
        ref: "frontend/tests/components/telu-design-system.test.tsx (telu-palette gate, 5 tests)"
        status: pass
  - id: D3
    description: "Button legacy aliases render Telu styles; KnowledgeType glyphs and labels; indicators loop only while active; every existing screen still renders"
    requirement: KNOW-02
    verification:
      - kind: unit
        ref: "frontend/tests/components/telu-design-system.test.tsx (Telu primitives, 4 tests)"
        status: pass
      - kind: automated_ui
        ref: "TELU_GALLERY_PORT=3224 pnpm --dir frontend gallery (40 passed)"
        status: pass

duration: 75min
completed: 2026-09-28
---

# Phase 2 Plan 04: Telu design system foundation Summary

**The app now runs on one Telu token set (light and dark) with system type, shared motion presets, glass toasts, a tested palette gate and codemod, the Telu Button and the telu-ui primitives, and every existing screen still renders in the gallery.**

## Accomplishments

- `globals.css`: both shadcn HSL blocks replaced by the skill's token block; Telu base (13px SF body on `--window-bg`, `user-select: none` with inputs, contenteditable and `.selectable` opted back in), 45% accent focus outline, scrollbars, reduced-motion rule, type utilities and `kit-enter` / `kit-receive` / `kit-bump`; custom scrollbar uses `--fill-3` / `--label-4`; sonner transition overrides.
- `tailwind.config.js`: colors mapped straight to variables with the shadcn aliases, Telu font sizes, radii (`lg` = control, `md` 6px, `sm` 4px), shadows, curves, durations, and indicator keyframes (`animate-rec`, `rec-slow`, `wave`, `shimmer`, `spin-ring`).
- `layout.tsx`: Google font removed, `MotionConfig reducedMotion="user"`, `Toaster` bottom-center, expand, gap 8, offset 18, 4200ms, unstyled with capsule classNames.
- `telu-palette.mjs`: `check` (default scope `frontend/src`) and `migrate`; exports `mapClass` and `findOffenders`. Today `check` finds 1,163 offending classes in `frontend/src`, all of them mappable.
- `button.tsx`: Telu cva (default, primary, record, tinted, plain; sm 24, md 28, lg 34; press 0.97) with aliases outline/secondary → default, ghost → plain, link → plain accent text, destructive → coral; no palette variants remained to replace.
- `telu-ui/`: Icon, GlassGroup, Chip, KnowledgeType (label, icon, tile), EmptyState (badge, compact, actions, footnote), Spinner, Shimmer, Skeleton, RecDot, Waveform.

## Task Commits

1. **Tasks 1–3** — `62c0aaf` (feat)

## Verification

- `NEXT_DIST_DIR=.next-gallery pnpm exec next build` → compiled and type-checked; built CSS contains the light and dark tokens and no `hsl(var(`
- `node --test .github/verify-phase1-{completeness-ui,finalization-ui,provider-boundary,diagnostics-ui}.test.cjs` → 29 pass
- `bun test tests/components/telu-design-system.test.tsx` → 9 pass; full `bun test` → 58 pass, 0 fail
- `node frontend/scripts/telu-palette.mjs check frontend/src/components/ui/button.tsx frontend/src/components/telu-ui` → 0 offending classes
- `grep -rn 'variant="green"\|variant="blue"\|variant="red"\|variant="gray"' frontend/src` → nothing
- `TELU_GALLERY_PORT=3224 pnpm --dir frontend gallery` → 40 passed (no page errors, no unmocked commands)

## Deviations from Plan

1. **[Rule 1 - Bug] `safelist: ['dark']` in `tailwind.config.js`.** Without it the `.dark` token block never reached the built CSS.
2. **[Rule 2 - Missing critical] `frontend/src/lib/utils.ts` extends tailwind-merge** with the Telu font sizes, radii and shadows. tailwind-merge 3 treats unknown `text-*` values as colors, so `cn('text-caption', 'text-label-2')` silently dropped the font size.
3. **[Scope] `.truncate` from the type utilities was not added**: Tailwind already ships `truncate`, and redefining it would add `min-width: 0` to every existing use.
4. **[Scope] Shimmer is exported next to Skeleton** (the plan truth lists it; Skeleton renders a Shimmer shape).
5. **[Process] Verification builds used `NEXT_DIST_DIR=.next-gallery`** so the user's running `tauri:dev` (`.next`) was not disturbed.
6. **[Process] One commit for three tasks** because Task 1 and Task 3 share `tailwind.config.js` and Tasks 2 and 3 share the test file.

## Issues Encountered

- **Implicit default Buttons changed meaning.** shadcn's default was the accent-filled primary; Telu's default is the neutral `--fill-2` button. Existing `<Button>` calls with no variant (for example `Find knowledge`) now render neutral until their re-skin plan sets `variant="primary"` for the one main action per surface.
- **Selection:** body text is no longer selectable by default. Re-skin plans must add `selectable` to transcript text, evidence quotes and the evidence ID line.
- **Dark:** dark tokens ship but only the gallery applies `.dark`; `tauri.conf.json` stays Light (Assumption A1). Existing screens mix palette classes with tokens, so their dark screenshots are unreadable in places until the re-skins run the palette gate.
- Executed inline by the orchestrator.

## Next Phase Readiness

- Re-skin plans (02-06..02-11) can run `telu-palette.mjs migrate` on their files and must end with `check` at 0 offending classes.
- Primitives and motion presets are ready for the shell (02-14) and living doc plans.

## Self-Check: PASSED

- All created files exist; commit `62c0aaf` is on `codex/phase-01-baseline`.
