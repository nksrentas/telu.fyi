# Sketch Manifest

## Design Direction
Telu should feel like a first-party macOS app: calm, precise, warm. Native chrome in the macOS 26 language (translucent sidebar, glass toolbar capsules, glass menus, popovers and sheets, notification banners), SF system type, Telu Indigo as the accent on warm off-white, mint only when Telu found something worth asking, coral only for recording. Motion follows Emil Kowalski's rules: fast ease-out for UI (under 300ms), springs only for morphs and landings, nothing animates on keyboard-driven actions, reduced motion respected. The product job: detect or enter recurring meetings (series and occurrences) from the calendar, keep a living purpose doc per series, and keep each meeting's documentation organized without manual filing. The mental model must make Telu faster to use and more valuable, not add another app to manage.

## Reference Points
- macOS 26 first-party apps: Calendar, Notes, Mail, Reminders, Finder (sidebar, toolbar, sheets, menus)
- Spotlight and Raycast (instant command window)
- Dynamic Island and Live Activities (morphing status surface)
- Emil Kowalski's design-engineering principles (Sonner, Vaul)
- Brand: docs/telu/color-palette.md (Ink, Warm off-white, Telu Indigo, sparse Mint, Coral for recording)

## Shared Foundation
- `themes/default.css`, `themes/dark.css` — color tokens (light and dark)
- `kit/` — macOS chrome, controls, motion tokens (CSS `linear()` springs), helpers, icons, and the shared fake dataset every sketch uses

## Sketches

| # | Name | Design Question | Winner | Tags |
|---|------|----------------|--------|------|
| 001 | app-mental-model | Which mental model makes Telu fastest and most valuable: Today (time), Living Doc (series), or Companion (moment)? | Synthesis: A tabs + agenda, B living doc, C Island → 002 | layout, navigation, calendar, series, purpose-doc, docs, motion |
| 002 | final-app | Does the synthesis (A calendar + B living doc + C Island) hold together as one app? | Approved — final direction | synthesis, final, calendar, living-doc, island |

Earlier exploration (sketches 001–005 from before 2026-09-27) is archived in `_archive/2026-09-27/` and intentionally not used as input.
