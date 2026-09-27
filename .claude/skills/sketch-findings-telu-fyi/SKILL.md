---
name: sketch-findings-telu-fyi
description: Telu's validated UI design from the approved sketches — tokens, components, layouts, motion and flows (sketch 002 final app + sketch 003 component catalog). Load before building or changing any Telu UI in frontend/ (Next.js + Tauri) — the sidebar tabs and agenda, event cards, side peek, living doc (purpose, memory, review), the Island, onboarding, toolbars, overlays, or any animation.
---

<context>
## Project: telu-fyi

Telu is a local-first macOS desktop companion for recurring conversations: Tauri 2 + Next.js 14 + React 18 + Tailwind 3 + shadcn/ui (Radix) + framer-motion 11 + cmdk + sonner + BlockNote + lucide, in `frontend/`.

Design direction (from `.planning/sketches/MANIFEST.md`): Telu should feel like a first-party macOS app — calm, precise, warm. Native chrome in the macOS 26 language (translucent sidebar, glass toolbar capsules, glass menus, popovers and sheets, notification banners), SF system type, Telu Indigo as the accent on warm off-white, mint only when Telu found something worth asking, coral only for recording. Motion follows Emil Kowalski's rules: fast ease-out for UI (under 300ms), springs only for morphs and landings, nothing animates on keyboard-driven actions, reduced motion respected. The job: detect or enter recurring meetings (series and occurrences) from the calendar, keep a living purpose doc per series, and keep each meeting's documentation organized without manual filing.

Reference points: macOS 26 first-party apps (Calendar, Notes, Mail, Reminders, Finder), Spotlight/Raycast, Dynamic Island and Live Activities, Notion's side peek, Emil Kowalski's design-engineering principles, and the brand palette in `docs/telu/color-palette.md`.

Sketch sessions wrapped: 2026-09-27 (sketches 001–003).
</context>

<design_direction>
## Overall Direction

**Mental model — three surfaces, one state:**
- **When — the calendar.** The window opens on A's sidebar tabs (Today, Upcoming, Review, Found in Calendar) and a full-width agenda timeline. Every event carries a Telu state: not tracked, brief ready, preparing, starting, recording, to review, filed.
- **What — the living doc.** Every series (recurring conversation) is one Notion-style document: Header → Purpose → Reference → Memory → Next → Past meetings. The purpose is edited only here, and every brief is built from it.
- **Now — the Island.** A glass capsule under the menu bar that morphs before, during and after a meeting. It works with the window closed and carries at most one suggestion at a time.
- **Bridge — the side peek.** Clicking a meeting in the agenda opens a side peek that renders that meeting with the doc's own blocks. "Open as page" jumps into the doc.
- **First run is C's onboarding.** Welcome → calendar permission → choose what to remember → ⌥ Space → the icon flies into the menu bar. The window stays hidden until you summon it.

**Palette:** Ink `#17191F`, warm off-white `#F7F7F4`, white surfaces, Telu Indigo `#6366E8` for actions, selection and links. Mint `#67E8C5` only for "Telu found something" (1–2 places on screen). Coral `#FF6B62` only for recording and genuine attention. Amber for "needs review". Everything else is neutral. Dark theme values are in `sources/themes/dark.css`.

**Type:** SF system stack (`-apple-system`), 13px body, a 10-step scale from large title (26/700) to caption (11), tabular numbers for times and counts.

**Shape & material:** 16px window radius, 12px cards, capsule buttons and controls, 0.5px hairlines instead of borders. Glass (backdrop blur 16–40px + saturate) only on sidebar, toolbar groups, menus, popovers, sheets, notifications and the Island.

**Interaction:** arrow cursor everywhere, sidebar icons in accent and no hover highlight on sidebar rows. Menus open instantly. Sheets are window-modal. Esc closes the top layer. Every pressable element scales on press (0.97 for buttons). Evidence is first-class: every remembered item and brief claim links to its transcript or document source.

**Motion:** ease-out 150–260ms for enter and exit, and exits are faster than enters. Springs (duration 0.4 / bounce 0.12 and 0.5 / 0.28) are only for morphs, landings and drag. Nothing starts from scale(0). Only transform and opacity animate. State toggles use interruptible transitions. Stagger is 30–50ms. Keyboard actions never animate. Reduced motion means opacity only.
</design_direction>

<how_to_use>
## How to Use This Skill

1. Open the reference for the area you're building (table below). It has the decisions, component list, motion specs with framer-motion snippets, CSS patterns, markup skeletons, behavior rules and what to avoid.
2. Look up each component by its PascalCase name in `references/component-inventory.md` for full props, states, tokens, motion and accessibility notes. The inventory is generated from the catalog, so names match exactly.
3. When exact values matter (spacing, timing, markup), read the sources. To see every state and replay every animation, serve the sources:
   `python3 -m http.server 4318 --bind 127.0.0.1 --directory .claude/skills/sketch-findings-telu-fyi/sources`
   Then open `/002-final-app/` (the approved app, with a Scenario bar: First run, Before, Starting, Live, After) and `/003-component-catalog/` (183 components, 742 examples, 54 animations with Replay).
4. Build with the real stack: shadcn/Radix primitives styled to these tokens, framer-motion with `MotionConfig reducedMotion="user"`, sonner for toasts, cmdk for search, BlockNote for doc blocks, lucide icons. Tray, Island and onboarding run as Tauri windows.
5. Fix the known gaps listed in the Primitives and Foundations references while building: the Switch focus ring, disabled field and checkbox styles, reduced-motion misses, and missing labels on icon-only buttons. Don't copy these gaps into the product.
</how_to_use>

<open_decisions>
## Resolve Before Building (found during wrap-up)

**Conflicts with `.planning/REQUIREMENTS.md`** — the prototype must not win these:
- **KNOW-08:** 002's "Delete meeting" alert says items already in Memory stay. Deleting a meeting must invalidate or remove the knowledge that depends on it.
- **SERIES-05:** accepting a candidate silently supersedes an older fact. When facts conflict, show both and let the user supersede, dispute or leave it unresolved.
- **KNOW-04, KNOW-06, PREP-03:** there's no UI yet for correction history, abstaining or unresolved fields, or which sources a brief included or omitted.

**Decisions to confirm:**
- **Springs:** use `SPRING = { type: 'spring', bounce: 0.12, visualDuration: 0.33 }` and `SPRING_BOUNCE = { bounce: 0.28, visualDuration: 0.42 }`. They exactly match the approved CSS curves. Some inventory entries write `duration: 0.4 / 0.5` instead; those are approximations.
- **Menu-bar status item:** in 002, clicking it summons the window and there's no dropdown. The current `tray.rs` attaches a recording menu. Pick one.
- **Starting prompt:** desktop notifications can't carry action buttons with tauri-plugin-notification 2.3.3, so the Island's Starting pill offers Record / Skip instead.
- **Toast order:** accept sonner's newest-at-bottom order.
- **Keyboard motion:** a few keyboard paths still animate in 002 (⌘[ view fade, Esc peek slide-out, the ⌥⌘N and ⌘F popovers). Make them instant.
- **Back button:** 002 shows "‹ Back" even when the doc was opened from the sidebar; 003 shows none. Decide which.
- **Pause:** only the Island can pause in 002. In production, call the existing `pause_recording` / `resume_recording` commands and keep the app in sync.
- **First run:** ⌥Space and the status item open onboarding, not the window, until setup is done.

**Setup notes for `frontend/`:**
- The shadcn HSL variables in `globals.css` (`--accent`, `--border`) collide with the Telu tokens. Replace them in the same change as the Tailwind config.
- Add these Radix packages: toggle-group, checkbox, collapsible, context-menu, alert-dialog.
- `tailwindcss-animate` reserves the keyframe names `enter` and `exit`.
- Destructive alerts put default focus on Cancel.
- To make Radix popovers scale from their trigger, use a zero-size arrow with `arrowPadding={12}`.
- `layout.tsx` still loads Source Sans 3; switch it to the system font.
</open_decisions>

<findings_index>
## Design Areas

| Area | Reference | Key Decision |
|------|-----------|--------------|
| Foundations & Motion | references/foundations-and-motion.md | One token set for light and dark. Mint and coral are rationed by meaning. Motion rules and a full timing map with framer-motion equivalents. |
| Primitives & Overlays | references/primitives-and-overlays.md | Capsule controls with forced-state specs. Overlays: origin-aware popovers, instant menus, window-modal sheets, sonner toasts, evidence popover. |
| App Shell & Navigation | references/app-shell-and-navigation.md | A's four tabs + Series + Calendars sidebar. Agenda and doc toolbars. One state model with five scenarios and one shared recording state. The window hides and the Island takes over. |
| Calendar & Agenda | references/calendar-and-agenda.md | Full-width timeline with every EventCard state. Proposals never auto-join a series. Natural-language new series. Review and Found in Calendar pages. |
| Living Doc & Side Peek | references/living-doc-and-side-peek.md | One living doc per series with the purpose edited only there. Memory holds accepted items only. Review happens in the doc. The side peek reuses the doc's blocks. |
| Island & Onboarding | references/island-and-onboarding.md | The Island in every mode with spring morphs and at most one suggestion, plus the Island ⇄ App contract. First run is C's onboarding, unchanged. |
| Component Inventory | references/component-inventory.md | All 183 components across 11 sections: maps-to, source, props, states, tokens, motion, accessibility. |

## Theme

The winning theme files are at `sources/themes/default.css` (light) and `sources/themes/dark.css` (dark): CSS custom properties only. Motion and type tokens live in `sources/kit/mac-kit.css` `:root`.

## Source Files

- `sources/002-final-app/` — the approved app (index.html, app-*.js, doc-*.js, island.js, app.css, doc.css, island.css)
- `sources/003-component-catalog/` — the catalog (sec-*.js hold every component's spec and stories; COMPONENTS.md; README.md lists the gaps)
- `sources/kit/` — macOS chrome and controls (mac-kit.css), helpers (mac-kit.js: popover, menu, sheet, alert, toast, notify, flyTo, parseSeries…), icons.js, data.js (the shared fake dataset), app and menu-bar icons
- `sources/themes/` — color tokens
- `sources/001-app-mental-model/README.md` — the three original directions and what was picked from each (the rest is in each reference's "What to Avoid")
</findings_index>

<metadata>
## Processed Sketches

- 001-app-mental-model (partial — picked parts only: A's tabs + agenda, B's living doc, C's Island and onboarding)
- 002-final-app
- 003-component-catalog
</metadata>
