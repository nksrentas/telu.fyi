---
sketch: 002
name: final-app
question: "Does the synthesis (A calendar + B living doc + C Island) hold together as one app?"
winner: "approved — final direction"
tags: [synthesis, final, calendar, living-doc, island]
---

# Sketch 002: Final App

## Design Question
One app built from the parts of sketch 001 the user picked (001 stays the source of truth):
- **A · Today:** the sidebar's Today, Upcoming, Review and Found in Calendar tabs, and the calendar agenda UI.
- **B · Living Doc:** the Notion-style living document as the page for every series (purpose, memory, next meeting, every past meeting).
- **C · Companion:** the Island — required. It floats above everything and keeps working when the window is closed.
- **C · Companion's first run:** the onboarding panel, unchanged (Connect Calendar → choose what to remember → ⌥ Space → the icon flies into the menu bar), plus C's Telu menu-bar item.

New connective tissue: clicking a meeting in the agenda opens a Notion-style **side peek** that renders that meeting with the living doc's own components; "Open as page" jumps into the full doc at that meeting. ⌥ Space, the menu-bar item or the Island bring the window back after it's closed.

## How to View
```bash
python3 -m http.server 4318 --bind 127.0.0.1 --directory .planning/sketches
```
Open http://localhost:4318/002-final-app/ in a browser window at least 1100px wide. It opens in light; add `?theme=dark` to the URL for dark. Use the Scenario bar at the bottom-left: First run, Before · 9:41, Starting · 10:00, Live · 10:12, After · 10:46.

## What to Look For
- Calendar → doc: does the agenda + side peek + "Open as page" flow feel like one product?
- Purpose editing lives only in the living doc; the brief everywhere (peek, Island) is built from it.
- First run: C's onboarding with the window hidden, then the Island takes over.
- The Island before, during and after a meeting, including with the window closed (red traffic light or ⌘W).
- Review happens in the doc (or its peek); accepted items land in Memory.
