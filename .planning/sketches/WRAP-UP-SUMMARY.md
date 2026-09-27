# Sketch Wrap-Up Summary

**Date:** 2026-09-27
**Sketches processed:** 3 (001 partial, 002, 003)
**Design areas:** Foundations & Motion · Primitives & Overlays · App Shell & Navigation · Calendar & Agenda · Living Doc & Side Peek · Island & Onboarding (+ the full Component Inventory)
**Skill output:** `./.claude/skills/sketch-findings-telu-fyi/`

## Included Sketches
| # | Name | Winner | Design Area |
|---|------|--------|-------------|
| 001 | app-mental-model | Synthesis — A's tabs + agenda, B's living doc, C's Island and onboarding (partial: picked parts only) | App Shell & Navigation, Calendar & Agenda, Living Doc & Side Peek, Island & Onboarding (as "What to Avoid" for the unpicked parts) |
| 002 | final-app | Approved — final direction | App Shell & Navigation, Calendar & Agenda, Living Doc & Side Peek, Island & Onboarding |
| 003 | component-catalog | Approved — 183 components, every state and animation | Foundations & Motion, Primitives & Overlays, Component Inventory (and every area's component and motion specs) |

## Excluded Sketches
| # | Name | Reason |
|---|------|--------|
| — | Pre-2026-09-27 sketches in `_archive/2026-09-27/` | Intentionally ignored at the user's request ("start again"); never processed |

## Design Direction
Telu feels like a first-party macOS app: calm, precise, warm. Its structure is three surfaces sharing one state. The calendar (A's four sidebar tabs and the agenda timeline) answers *when*. A Notion-style living doc per series answers *what*: purpose on top, memory, next meeting, every past meeting. The Island under the menu bar answers *now*, before, during and after each meeting, even with the window closed. A side peek bridges the agenda and the doc. First run is C's onboarding, unchanged. The visuals follow the macOS 26 language: translucent sidebar, glass capsules, SF type, Telu Indigo on warm off-white, mint only for "Telu found something", and coral only for recording.

## Key Decisions
- **Layout:** full-width agenda in the window; clicking a meeting opens a side peek (≈44% width, min 440px, no dimming) rather than A's permanent inspector column. Series open as full living-doc pages. The window sits below a gap reserved for the Island.
- **Palette:** tokens in `themes/default.css` and `dark.css`. The accent is Telu Indigo. Mint and coral are rationed by meaning, and amber marks review.
- **Typography:** SF system stack, 13px body, scale from large title (26/700) to caption (11), tabular numbers.
- **Spacing and shape:** 16px window, 12px cards, capsule controls, 0.5px hairlines, glass only on floating or chrome surfaces.
- **Interaction:**
  - Purpose is edited only in the living doc, and every brief (peek, Island) is built from it.
  - Calendar proposals never join a series automatically.
  - Review happens in the doc or its peek, and only accepted items become Memory.
  - One recording state is shared by the app and the Island.
  - Keyboard actions are instant.
- **Motion:** ease-out 150–260ms, exits faster than enters, springs only for morphs and landings (Island, notifications, switch, "Attached"), never from scale(0), transform and opacity only, reduced motion means opacity only. There are 54 animations, each specified with framer-motion code in the catalog.
