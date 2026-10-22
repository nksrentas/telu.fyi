# Sketch Manifest

## Design Direction

Telu's knowledge review should feel like a beautifully typeset thinking surface rather than an administration dashboard. The transcript remains available as evidence, but the knowledge pane uses editorial hierarchy, generous rhythm, and selective surfaces instead of grids of bordered cards and persistent controls. Review actions appear only around the current decision. Motion is brief, purposeful, interruptible, and limited to spatial/state explanation.

For the application shell, Telu should feel like a calm native meeting companion rather than a transcription utility. The home surface adapts to the user's immediate context: an upcoming meeting earns preparation emphasis, while private listening is always one obvious action away. Starting capture should transform the current surface into a live workspace without disorienting navigation or decorative motion.

## Reference Points

- Existing Telu meeting-detail split view: transcript anchored beside the right-hand working pane.
- Existing Radix/shadcn primitives: Accordion, Sheet, Dialog, Tabs, Tooltip, and ScrollArea.
- `docs/telu/color-palette.md`: calm, precise, warm, native productivity-tool direction.
- Emil Kowalski design-engineering principles: strong defaults, responsive press states, custom ease-out curves, precise transitions, and invisible edge-case handling.
- Apple Human Interface Guidelines: navigation and controls form a distinct translucent layer, content remains legible and quiet, windows support comfortable desktop density, and motion communicates state briefly without delaying work.

## Sketches

| # | Name | Design Question | Winner | Tags |
|---|------|-----------------|--------|------|
| 001 | Knowledge card density | What should a candidate show before the user expands it? | Rejected | knowledge, cards, density, review |
| 002 | Knowledge card expansion | What should progressive detail feel like when a candidate is opened? | Rejected | knowledge, evidence, accordion, sheet, dialog |
| 003 | Beautiful knowledge sections | How can typed meeting knowledge feel composed, calm, and genuinely beautiful without losing evidence or review control? | — | knowledge, sections, editorial, review, polish |
| 004 | Adaptive meeting home | How should preparation and instant listening share Telu's home screen? | Rejected | application-shell, home, preparation, recording, live-assistance, motion |
| 005 | Conversation mental models | Which product-level mental model gives Telu clear navigation without inheriting the current screen structure? | — | information-architecture, application-shell, meeting-lifecycle, chronology, series-memory, motion |
