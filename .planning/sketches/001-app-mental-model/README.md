---
sketch: 001
name: app-mental-model
question: "Which mental model makes Telu fastest and most valuable: Today (time), Living Doc (series), or Companion (moment)?"
winner: "synthesis — A sidebar tabs + agenda, B living doc, C Island (built as sketch 002)"
tags: [layout, navigation, calendar, series, purpose-doc, docs, motion]
---

# Sketch 001: App Mental Model

## Design Question
Three complete, interactive prototypes of the redesigned app. Each one covers the same three jobs with a different mental model:
1. Detect meetings, occurrences and recurring series from the calendar, or enter them manually.
2. Edit each series' Purpose document.
3. Keep each meeting's documentation organized: brief, agenda, attached documents, transcript, summary, and knowledge items (decisions, commitments, open questions, facts) with evidence and accept / correct / reject review.

## How to View
Serve the sketches folder and open the switcher (the variants load in iframes):

```bash
python3 -m http.server 4318 --bind 127.0.0.1 --directory .planning/sketches
```

Then open http://localhost:4318/001-app-mental-model/ — press 1 / 2 / 3 to switch variants, toggle Light / Dark in the top bar, and use the Scenario bar at the bottom-left of each prototype to cycle states (first run, everyday, after the meeting, …).

## Variants
- **A: Today** — Your calendar, with memory. The home is today's agenda; every event carries a Telu state, and selecting one opens its Brief in an inspector. Series live in the sidebar.
- **B: Living Doc** — One living document per recurring conversation. Purpose on top, then Memory, then the next meeting, then every past meeting as a section inside the doc.
- **C: Companion** — Telu comes to you. A menu-bar companion and a floating glass Island that morphs before, during and after each meeting; a Spotlight-style ⌘K window for series, purpose docs and review.

## Outcome
Cherry-picked synthesis, built as sketch 002 (this sketch stays the reference implementation):
- **From A:** the four sidebar tabs (Today, Upcoming, Review, Found in Calendar) and the calendar agenda UI.
- **From B:** the Notion-style living doc as the page for each series ("domain view").
- **From C:** the Island — a required feature.

## What to Look For
- Which model makes "what do I need to know for my next meeting?" fastest?
- Where does editing the purpose doc feel most natural: inspector sheet (A), in the document (B), or in place in the command window (C)?
- How much organizing work is left to the user in each model (tracking, filing, moving meetings between series)?
- Calendar flows: first-run detection, proposals for new series, attaching a one-off to a series, manual entry with natural language.
- Motion: does it feel native and fast? Keyboard actions should be instant; morphs and landings should feel physical, not decorative.

## Implementation Notes (target stack)
- Current app: Tauri 2, Next.js 14, Tailwind 3 with shadcn/Radix, framer-motion 11, cmdk, sonner, BlockNote, lucide icons, Source Sans 3. There is no calendar, series, purpose, or attachment model yet, and the window uses default decorations.
- Native feel path: `titleBarStyle: "Overlay"` with hidden title and inset traffic lights, sidebar vibrancy through the `window-vibrancy` crate, system font stack instead of Source Sans 3. `macOSPrivateApi` is already enabled, which transparent windows need (C's Island).
- Calendar: EventKit via `objc2-event-kit` (plus `NSCalendarsFullAccessUsageDescription` in Info.plist); recurrence rules become series proposals, never automatic membership.
- Command window (C) maps to `cmdk`; toasts map to `sonner`; purpose and living docs (B) map to BlockNote; springs map to framer-motion (use full `transform` strings for hardware acceleration).
