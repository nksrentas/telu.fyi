---
sketch: 003
name: component-catalog
question: "What is the complete set of components in the final app, with every variant and state, ready to become reusable React components?"
winner: "approved — component inventory"
tags: [components, design-system, states, variants, inventory]
---

# Sketch 003: Component Catalog

## Design Question
An exhaustive, living inventory of every component in the approved final app (sketch 002) and the shared kit it's built from: each one rendered with all of its variants and states, plus a spec to build it as a reusable component in the real app (Tauri + Next.js + Tailwind + shadcn/Radix + framer-motion + cmdk + sonner + BlockNote).

This is an inventory, not a design exploration, so it has a single variant. It renders the real thing: the page loads sketch 002's CSS and JS and calls 002's own markup functions, so what you see is exactly what ships in 002.

## How to View
```bash
python3 -m http.server 4318 --bind 127.0.0.1 --directory .planning/sketches
```
Open http://localhost:4318/003-component-catalog/ — filter with the search field (press `/`), switch Light / Dark at the top right, jump between components in the left nav.

## Structure
11 sections · 183 components · 742 rendered examples (variants, states and replayable animations).

- **Foundations** — color, type, radii, elevation, materials, focus ring, motion tokens, icons, app icon
- **Animations** — every animation in 002 as its own entry (trigger, properties, timing, easing, interruptibility, keyboard and reduced-motion paths, framer-motion mapping, Replay), plus Motion principles and a Timing map
- **Primitives** — buttons, controls, chips, badges, avatars, indicators
- **Overlays** — popover, menu, sheet, alert, toast, notification, tooltip, evidence
- **Chrome** — menu bar and status item, window, toolbars, sidebar
- **Calendar** — event card in every state, timeline, banner, new-series popover
- **Pages** — Review, Found in Calendar, filing, search
- **Onboarding** — the first-run panel, every step
- **Side peek** — the calendar → doc bridge
- **Living doc** — header, purpose, memory, next, past meetings, review, transcript
- **Island** — every mode, plus a live playground

Each component shows: the future React component name, what it maps to in the stack, where it's used, its source in 002, props, states, tokens, motion and accessibility.

## Spec Export
`COMPONENTS.md` in this folder is generated from the same registry as the page (`Catalog.toMarkdown()`), so the written spec and the visual catalog never drift.

## Gaps Found While Cataloging (fix when building the real components)
- Switch has no visible focus ring; text fields and checkboxes have no disabled style.
- Some effects ignore reduced motion: receive flash, chip-in, spinner, mini dots, progress hairline.
- Icon-only buttons are missing `aria-label`s in places.
- Documented as absent in 002 rather than invented: a paused state for the toolbar recording capsule and menu-bar item (only the Island pauses), an "Editing…" save state (002 says "Saving…"), pending counts on sidebar series rows (they live on the Review row), a second segmented-control size, and any sheet actually opened by 002 (the Sheet demo uses 001's "Paste text" sheet).
- Catalog quirk: a Replay pressed in the first few seconds after load can be closed by another section's startup demo — wait a moment or press it again.
