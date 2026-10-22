---
sketch: 004
name: adaptive-meeting-home
question: "How should preparation and instant listening share Telu's home screen?"
winner: null
tags: [application-shell, home, preparation, recording, live-assistance, motion]
---

# Sketch 004: Adaptive Meeting Home

## Design Question

How should Telu balance the next scheduled conversation with immediate private listening, then preserve spatial continuity as the meeting becomes live?

## How to View

Open `.planning/sketches/004-adaptive-meeting-home/index.html`.

## Variants

- **A: Agenda Stage** — The next meeting is the visual anchor; preparation is primary and listening remains one click away.
- **B: Listening Portal** — Immediate capture is the anchor; the next meeting and recent memory form a contextual side rail.
- **C: Adaptive Focus** — Telu explains why one meeting deserves attention now, then gives preparation and listening equal, context-aware weight.

## Interactions

- Switch variants with the fixed tabs.
- Use `Start listening` to transition each home into its corresponding live state.
- Use `End` or `Finish` to return to preparation.
- Open evidence links to inspect the anchored provenance popover.
- Use the floating toolbar to preview desktop, tablet, and phone widths or inspect visual tokens.

## What to Look For

Compare which hierarchy makes Telu's purpose clearest in five seconds, whether `Start listening` remains effortless, and whether the transition into live assistance feels like one continuous product rather than navigation to another tool.

Motion is intentionally restrained: controls use 140–190ms feedback, major state transitions stay around 220–240ms, popovers originate from their trigger, and reduced-motion mode removes spatial movement.
