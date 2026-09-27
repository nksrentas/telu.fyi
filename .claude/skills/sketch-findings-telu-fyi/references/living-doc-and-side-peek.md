# Living Doc & Side Peek

Every series has one Notion-style living document (from 001 B, built in 002). It is the series page, the only place its purpose is edited, and the place where review lands accepted items in Memory. The side peek is the bridge from the calendar agenda (from 001 A) to that doc: it renders one meeting with the doc's own blocks, and "Open as page" jumps into the doc at that meeting. Rebuild target: `frontend/src/components/living-doc/*` and `frontend/src/components/side-peek/*` (kebab-case files), route `/series/[id]`.

## Design Decisions

1. **The doc is the series page; purpose is edited only here.** It beat A's permanent inspector column plus purpose sheet and C's in-place editing inside the ⌘K window. Every other surface only reads the purpose: the peek brief, the Island card and the agenda card's purpose line. "Edit purpose" (⌘E, the card context menu, the doc ⋯ menu) always opens the doc and focuses "Why we meet", with the caret at the end.
2. **Fixed section order, one column.** The order is Header (`#sec-top`), then Purpose (`#sec-purpose`, which ends with the Reference row), Memory (`#sec-memory`), Next (`#sec-next`) and Meetings (`#sec-past`, newest first). The column is `.doc { width: min(720px, calc(100% - 112px)); margin: 0 auto; padding: 30px 0 160px }` on `--content-bg`. Sections have `margin-top: 44px` and `scroll-margin-top: calc(var(--toolbar-h) + 20px)`, which is 72px. Section heads use an eyebrow at 11px/600, uppercase, 0.07em tracking, `--label-3`, followed by a "·" meta or caption at 11–11.5px `--label-3`.
3. **Header.** A 36px series icon (`.series-icon.lg`, circle in the series `--c`, white 20px glyph) sits 14px left of the title. The H1 uses `.t-large` (700 26px/1.15 SF Pro Display, −0.022em) and is contenteditable, with placeholder "Name this conversation" and a focus background of `--accent-softer`. The meta chips row has `padding-left: 50px` so it lines up under the title. Chips are 24px high on `--fill`, 12px `--label-2`, hover `--fill-2`, press `scale(0.97)`. The chips are:
   - Cadence link: repeat icon and "Every Tue · 10:00–10:45". For a manual series it shows a folder icon and "Grouped by you · no fixed time" or "Not linked to a calendar".
   - People: up to 3 avatars at 16px with −4px overlap, then "5 people".
   - Count (static): "36 meetings since Jan 2026", or "New · first meeting Thu 1 Oct".
   - Private (static): lock and "Private · this Mac only".
4. **Purpose fields.** They are "Why we meet" (15px/1.55), "What good looks like" (13.5px/1.6 list with 5px `--label-3` dots), "Standing agenda" (rows with a 64px right-aligned minutes column, a hairline under each row and a total such as "45 min" in the label) and "Not for this meeting" (`--label-2`). Labels are 12px/600 `--label-2`, and blocks sit 18px apart. Fields show `--fill` on hover (fine pointers only). On focus they show `--accent-softer` plus an inset 1px accent ring at 22%, with a −7px margin and 7px padding so the text doesn't shift.
5. **Autosave, never a Save button.** Typing sets the toolbar to "Saving…" (`--label-2`). "Saved" (`--label-3`) appears 700ms after the last keystroke. The first edit bumps the version meta once ("v3 · edited Sep 18" becomes "v4 · just now") and removes the accent "Drafted from the calendar invite — make it yours" chip. The first save toasts "Purpose v4 saved — Telu builds every brief from it". 002 has no "Editing…" state.
6. **Reference is the last row of Purpose.** Doc chips are 30px, radius 9, `--fill`, with a file badge, the name and a small version. Each has a 7px **include dot**: filled `--accent` means "Included in every brief"; a transparent dot with a 1.3px `--label-3` ring means "Not included in briefs". A "+ Add" chip (transparent, 1px `--separator` ring) opens "Recent on this Mac" and "Choose File… ⌘O". Dropping files anywhere on Purpose attaches them here.
7. **Memory holds only accepted items.** It is a two-column grid with a 12px gap, captioned "Only items you accepted". It has four groups on `--surface-sunken` with radius 12 and padding 10/14/6:
   - Decisions: `--accent`
   - Open commitments: `--series-orange`
   - Open questions: `--amber`
   - Facts: `--series-teal`

   Each group head shows the open count. Completed items sink to the bottom with `--label-2` text. An item has its text, a status dot and label, an owner avatar at 16px with first name, "Due Sep 29", and a source chip pushed right. A superseded decision is not a row of its own: it appears as "replaced ·" plus struck-through old text under its replacement. Empty states: "Nothing yet" per group, and a sunken card with a lightbulb when Memory is empty.
8. **Next is the brief, a tinted card.** `padding: 18px 22px 20px 26px`, radius 16, `--accent-softer` and a 3px `--accent` bar (inset 16px top and bottom). The head has "Next" (`--accent-strong`), then "· Today 10:00–10:45 · <title> · Google Meet", a countdown chip and today's actions: Skip (only while starting), Join (Meet/Zoom/Teams), and a coral Record with ⌘R. The block turns into other states in place:
   - Live: coral at 7% with a coral bar
   - Preparing summary: `--surface-sunken` with a `--label-4` bar
   - Not prepared yet: "Telu prepares this brief the evening before."
   - Idle: "Not scheduled" plus Record
9. **Brief contents are all provenance-carrying.** From top to bottom:
   1. A provenance line: "Prepared last night from your purpose, Memory and 2 reference docs", or a spinner with "Still preparing … ready before 15:30".
   2. "Since last time" carry rows: a 22px tinted type tile, text · owner, a note ("Due today", "Open for 2 meetings") and a source chip.
   3. "Worth asking".
   4. A 1.3fr / 1fr grid holding the Agenda (checklist plus "Add item") and "Docs for this meeting".
10. **Worth asking is the doc's one mint moment.** It sits on a `--content-bg` card with `--shadow-card`, radius 12, and a 3px `--mint` left bar. The head reads "Worth asking" in `--mint-ink` 12px/600 with a sparkle icon. During recording it becomes "Worth asking now". Nothing else in the doc is mint. Coral appears only for recording (Record, live strip, the "Starting now" chip) and destructive confirms. Amber means "needs your decision": the review bar, "N to review" and the eye icon.
11. **Agenda items keep their origin.** A pill of 10.5px on `--accent-soft` / `--accent-strong` reads "Added by Telu" or "From Worth asking". The checkbox is a 17px circle that fills with accent while the check stroke draws. Done items go `--label-3` with a `--label-4` line-through.
12. **Past meetings are disclosure rows.** The head is 46px with a 10px radius. It holds a hover grip at −24px (drag onto a sidebar row), a chevron that rotates 90°, the date (600), "#36 · 43 min" (or "from Product Sync" / "from Needs filing"), a one-line "title — first sentence of summary" that fades out while the row is open, count chips and ⋯. The body is indented 23px and holds the summary (13.5px/1.55, max 620px), knowledge rows or the review list, doc chips, then "Open transcript" and "Transcribed on this Mac". A cancelled meeting is a static row: "Tue 1 Sep — Cancelled in Calendar".
13. **Review happens inline, in the doc or the peek, not in a modal.** Candidates sit on `--surface-sunken`, radius 12, with a 2.5px amber bar while pending. An accepted row turns quiet: transparent with a hairline ring and "✓ In Memory". Accept lands the item in Memory, where it glows for 1.5s. There is no row animation.
14. **Evidence is one click from every claim.** Memory items, carry rows, asks, knowledge rows and candidates each carry a SourceChip: 18px high, quote icon, "Sep 22 · 18:42" or "North-star metrics.docx · p.2". It opens the EvidencePopover, and from there the transcript line. Privacy copy stays visible: "Transcribed on this Mac", "Stored on this Mac…", "Every version stays on this Mac".
15. **The transcript lives in a floating glass drawer, not a new page.** It is 340px wide at `top: calc(var(--toolbar-h) + 2px)`, 10px from the right and bottom, radius 18, `--glass-strong` with blur 30 and `--shadow-float`. The doc column slides left just enough to stay readable (at most up to the 366px drawer space), and the scrubber fades out.
16. **Scrubber.** Ticks on the right edge for Purpose, Memory, Next and each past meeting, with an 8px gap after Next. The active tick is full-width `--accent`; the others are `scaleX(0.56)` `--label-4`. Hover shows labels on a glass pill.
17. **Large-title collapse.** When the H1 scrolls under the 52px toolbar, the toolbar shows a compact title (series icon and name, 600 15px). The large title simply scrolls away.
18. **The side peek is a place beside the list, not a modal.**
    - Size and placement: `--peek-w: max(440px, 44%)` of `.main`, under the toolbar (`top: var(--toolbar-h)`, right and bottom 0), z-index 35, top-left radius 14, `--content-bg`.
    - Edges: hairline top and left edges plus `-22px 0 44px -24px rgba(0,0,0,0.22)`.
    - No scrim and no dimming. The agenda pads its right side by `--peek-w + 24px` (16px when `.main` ≤ 900px) so no card hides behind it.
    - It beat A's permanent inspector column: it appears on selection, and Esc or ✕ closes it.
19. **The peek uses the doc's own blocks.** The same NextBlock and MeetingBody render with `surface="peek"`. The peek body is `.doc-surface`, so the `@container surface (max-width: 600px)` compact rules apply: carry rows, candidates and knowledge rows stack, and the Next grid becomes one column. Peek-only cards cover untracked, proposed and unfiled items.
20. **Peek header.** A sticky 46px bar holds the series link (accent 600 12px, 16px series icon, chevron; opens the doc), "Open as page" (↗, `--label-2`) and ✕ ("Close · esc"). Below it: an H2 title (700 22px/1.2 display, −0.02em), "#37" (17px/500 `--label-3`), meta "Today · 10:00–10:45 · Google Meet" (12px `--label-2`) and up to 4 avatars. When the body scrolls past 2px, the bar turns into 82% `--content-bg` glass (blur 18, saturate 1.6) with a hairline.
21. **Z-order inside `.main`:** scrubber 25, toolbar 30, peek 35, drawer 40. Popovers are at 150, menus 160, toasts 200. The window has `isolation: isolate`.

## Components

| Component | Role | Key variants / states | Maps to |
|---|---|---|---|
| LivingDocPage | Route composition: header, sections, scrubber, drawer | before (brief), live, after (review), scrolled, drawer open | Next.js `/series/[id]`; sections are React, editable regions use BlockNote (see Behavior) |
| DocHeader | Icon, editable H1, meta chips; RepeatsControl on new docs | calendar series, private, grouped by you, just tracked, untitled draft, title focus, collapsed into toolbar | contentEditable H1 + shadcn Button chips + Radix Popover |
| PurposeBlock | The only purpose editor | read, hover, editing, version bump, saving/saved, drafted by Telu, empty placeholders, drop target | BlockNote with a locked custom schema, 700ms autosave |
| HistoryPopover | Purpose versions / doc activity | versions, after edit ("v4 · Just now", Current), activity, empty | Radix Popover `align="end"`, width 310 / 330 |
| ReferenceRow | Series files with include dots, + Add | included, left out, chip-in, empty, file popover (Switch), add menu | chip list + Radix Popover + Switch + DropdownMenu |
| MemoryGrid / MemoryGroup / MemoryItem | Accepted knowledge | filled, after review (new, resolved, replaced), empty; statuses current / open / done / unresolved / resolved today | CSS grid + lists |
| NextBlock | The next meeting's brief and its live / preparing / idle states | brief ready, starting now, live, listening, preparing summary, preparing brief, not prepared yet, idle, idle draft | card composed of the rows below |
| CarryRow | "Since last time" / "Carry forward so far" item | commitment + owner + note, question, fact from a doc, compact | list item |
| WorthAsking | Questions worth asking, + to agenda | rest, row hover (+ shows), added (disabled), live, compact | card + icon Button + Tooltip |
| AgendaChecklist | This meeting's agenda | unchecked, done, Added by Telu, From Worth asking, add field, standing-agenda preview | Radix Checkbox list + input |
| MeetingDocs | "Docs for this meeting" with per-brief include dots | included, left out, without brief, drop target, chip-in | chip list + drop zone |
| LiveStrip | Recording row in Next | Recording, Recording once, compact | status row |
| PastMeetings | "Meetings · Newest first · filed by Telu" | filled, review on top, empty, show earlier | list of MeetingRow |
| MeetingRow | One past meeting | collapsed, expanded, hover, needs review, reviewed, cancelled, moved from, filed from, dragging, received, ⋯ menu, delete confirm | Radix Collapsible + DropdownMenu + native drag source |
| KnowledgeRow | Filed meeting knowledge | current, open with owner, done, superseded, compact | grid row 112px / 1fr / auto |
| CandidateRow | One reviewable finding | pending, pending with owner and due, resolves a question, correcting, accepted, accepted and corrected, rejected, compact | row + buttons; Correct = inline contentEditable; Undo via sonner |
| ReviewHead | Review guidance + Accept all | several pending, one pending, reviewed | header row, `role="status"` |
| CountsChips | Row counts | to review (amber), reviewed, counts, none | badge group |
| EvidencePopover | Quote behind a claim | speech, speech · jump, speech · peek, no meeting on file, candidate, document | Radix Popover opened by SourceChip |
| SourceChip | The evidence trigger | rest, hover (accent), pressed 0.96 | button |
| TranscriptDrawer / DrawerInfo | Transcript with highlighted evidence / doc details | open, highlighted, no highlight, empty | non-modal side panel (Radix Dialog `modal={false}`, no overlay) |
| Scrubber | Section index | rest, hover labels, active, tick received, hidden while drawer open | `<nav aria-label="Sections">` + IntersectionObserver |
| RepeatsControl | New-doc cadence | None (day and time disabled), Weekly, linked to an event, day / time / link menus | Radix ToggleGroup + two DropdownMenus + link Button |
| DocMenu / DocToolbar | ⋯ menu, save state, compact title, Record | menu, stop-tracking confirm, scrolled, live | DropdownMenu + AlertDialog |
| PeekPanel | The right panel | closed, open, opening, closing, instant, content crossfade, scrolled | custom `<aside>` + framer-motion |
| PeekHeader | Series link, Open as page, close, title | tracked, untracked (calendar), needs filing, long title, scrolled | custom header |
| PeekBody | Router over doc blocks and peek-only cards | 20 states (see Behavior) | NextBlock / MeetingBody `surface="peek"` / note cards |
| FlyChip | Date chip flying to a sidebar row (move / unfile / split) | in flight, landed | portal flyer |

Full props, states and tokens are in component-inventory.md › DocHeader, PurposeBlock, HistoryPopover, ReferenceRow, MemoryGrid, MemoryGroup, MemoryItem, NextBlock, CarryRow, WorthAsking, AgendaChecklist, MeetingDocs, LiveStrip, PastMeetings, MeetingRow, KnowledgeRow, CandidateRow, ReviewHead, CountsChips, TranscriptDrawer, DrawerInfo, Scrubber, RepeatsControl, DocMenu, LivingDocPage, PeekPanel, PeekHeader, PeekBody, EvidencePopover, SourceChip, FlyChip, DocToolbar.

Build notes:
- **NextBlock** is one component that picks its body from `state: brief | pending | idle | live | preparing`. In `surface="peek"` the head drops "· when · title · place", because the peek header already shows them. Key the body by state so the repaint animation runs; see Motion.
- **ReferenceRow and MeetingDocs.** In 002 the include dot is a span nested inside the chip button. In React, make it a sibling toggle button with `aria-pressed` and the tooltip text as its label. Reference include affects every brief. Meeting-doc include affects only this brief (`brief.off[]`).
- **MeetingRow** drag uses the custom type `application/x-telu-meeting` and a glass ghost chip (calendar icon plus date). Valid targets are sidebar series rows other than the current one and the Review row. The keyboard path is ⋯ → "Move to another series…".
- **CandidateRow** state changes re-render the row with no animation. Correct turns the text into a textbox with its text selected: Enter saves, Esc cancels, and an unchanged text is treated as a plain accept.
- **PeekPanel** stays mounted in agenda views (Today, Upcoming, Review, Found in Calendar). Opening a doc hides it instantly, and Back restores it instantly with the agenda scroll position.

## Motion

Keyboard navigation never animates: ↑/↓ swaps the peek, Enter opens it instantly, and Back restores it instantly. Keyboard commands that change state, such as ⌘R or Enter adding a row, animate the change the way a click would. Easing: `--ease-out` cubic-bezier(0.23, 1, 0.32, 1); `--ease-drawer` cubic-bezier(0.32, 0.72, 0, 1).

| Animation | Trigger → properties | Enter / exit | Interruptible | Keyboard | Reduced motion |
|---|---|---|---|---|---|
| Page swap | open doc (sidebar, Open as page, Jump) → `#view` opacity→0 + blur 2px, paint, then opacity 0→1 + translateY(4px)→0 | out 120ms ease-out · in 180ms `--ease-out` | restart (a swap token drops stale paints) | ⌘[ Back = 200ms view fade, peek restored instantly | instant |
| Reveal flash | after Open as page / Jump → target scrolled to top (instant), then `.receive` (bg `--accent-soft` held to 30%) | 900ms `--ease-out`, 80ms after paint; Jump: smooth scroll, receive at 360ms | restart | same | flash stays (background only) |
| Large-title hand-off | H1 leaves under the toolbar → `.tb-title` opacity 0→1, translateY(4px)→0 | 180ms `--ease-out` both ways | yes | scroll-driven | opacity only |
| Save state / version bump | first keystroke → label text swaps, colour `--label-3`↔`--label-2`; `.ver-bump` from opacity 0 + translateY(3px), then accent | colour 150ms ease · bump 420ms `--ease-out` · "Saved" 700ms after last key | debounce resets per key | typing | 002 still plays the bump: make it opacity only |
| Drafted chip out | first edit → opacity→0, scale(0.96), removed | 160ms ease-out | no | — | removed instantly |
| Standing-agenda row | Enter → new row height 0→auto + opacity; Backspace on an empty row removes it instantly | 280ms `--ease-out` | no | Enter creates content, so it animates | instant |
| Chip-in / chip out | files attached → opacity 0, translateY(3px) scale(0.95)→none, 40ms stagger; Remove → opacity→0, scale(0.95) | in 280ms `--ease-out` · out 150ms ease-out | in restarts | ⌘O → same | 002 still plays chip-in: fix |
| Drop wash + hint | file drag over Purpose → `::after` dashed wash opacity; "Drop to add to Reference" pill opacity + translateY(4px) scale(0.97)→none; meeting docs get the kit dashed outline instantly | 150ms / 200ms `--ease-out` | yes | — | opacity and colour |
| Memory receive | accepted item lands → background `--accent-soft` held to 30% → transparent; scrubber Memory tick `scale(1.2, 2.4)` + accent at 30% | item 1500ms · tick 900ms `--ease-out` | restart | — | item flash stays; tick leaks in 002 |
| Next repaint | brief ↔ live ↔ preparing ↔ ready → out opacity→0 + blur 2px; in opacity 0→1 + translateY(4px)→0 | 120ms ease-out / 200ms `--ease-out` | restart | ⌘R same | instant |
| Live lines | line or "Worth asking now" arrives → opacity 0, translateY(6px)→0 (`.enter`) | 280ms `--ease-out` | restart | — | appear at once |
| Recording / loading loops | rec dot opacity 0.3 at 50% (1.4s ease-in-out ∞); wave bars scaleY 0.3↔1 (900ms, delays 0/−200/−450/−650/−100ms); timer +1s; shimmer 1.3s linear; spinner 700ms linear | loops while the state is true | — | — | dot slows to 2.4s; wave and shimmer stop |
| Meeting row toggle | head click → grid rows 0fr↔1fr + opacity; chevron 0→90°; summary line opacity 1→0 | rows 260ms `--ease-out` + opacity 200ms ease · chevron 200ms · line 180ms | yes | Open as page / Jump expand the target | rows snap, opacity fades |
| Meeting leaves | ⋯ Move / Remove / Split → FlyChip 560ms to the sidebar row (x: cubic-bezier(0.45,0,0.2,1); y + scale ≥0.4 + opacity→0.35: cubic-bezier(0.6,0,0.9,0.7)) while the row folds (height, margins, paddings→0 + opacity); row receives, icon bumps 1.18 | fold 220ms · flight 560ms · receive 900ms · bump 420ms | no | menu → same | no flight, no fold; row receives |
| Undo re-insert | Undo toast → height 0→h + opacity, then receive | 280ms + 900ms | no | — | instant |
| Drag to sidebar | grip drag → row opacity 0.45; sidebar rows inset accent ring; hovered row `--accent-soft` + scale(1.03) | scale 140ms `--ease-out`, bg 120ms | yes | ⋯ "Move to…" | colour only |
| Review rows | Accept / Correct / Reject / Undo → instant swap; Accept all accepts one pending row every 70ms | 70ms stagger | n/a | Enter saves, Esc cancels | same |
| Drawer + column | Open transcript / evidence / Details → drawer translateX(calc(100% + 24px))→0; column translateX(0 → −shift); scrubber opacity→0 | open 300ms · close 200ms `--ease-drawer`; scrubber 200ms | yes | Esc closes | no slide or shift |
| Evidence line | drawer: `.tl.hl` background 300ms ease, centred instantly · peek: inline transcript expands, smooth-scrolled to centre after 280ms | — | — | — | auto scroll |
| Scrubber | scroll → active tick scaleX(0.56)→1 + `--label-4`→`--accent`; hover → labels opacity + translateX(4px)→0, glass pill | 200ms / 150ms `--ease-out` / 200ms | yes | click = smooth scroll | ticks snap |
| Popovers | chip / History / source click → opacity 0→1 150ms, scale(0.96)→1 190ms from the trigger (`--origin`) | close 110ms | yes | Esc | opacity only |
| Menus | ⋯, Add, Day / Time → appear instantly; the chosen row blinks (off 60ms), close after 130ms, fade 120ms | — | — | arrows, Enter | — |
| Peek slide | card click → translateX(calc(100% + 48px))→0; visibility on at start, off after exit | 300ms `--ease-drawer` / 200ms `--ease-out` | yes (reverses mid-slide) | Enter opens instantly (`.instant`); Esc uses the 200ms exit | instant |
| Peek content swap | another card clicked → opacity→0 + blur 2px, swap, scroll to top, opacity 0→1 | 110ms ease-out / 190ms `--ease-out` | restart | ↑/↓ instant, no crossfade | instant |
| Peek bar glass | body scrollTop > 2 → background + hairline | 200ms ease | yes | — | same |
| Press feedback | pointer down → chips and buttons 0.97 · source 0.96 · checkbox 0.88 | 140ms `--ease-out` | — | — | — |

```tsx
export const EASE_OUT = [0.23, 1, 0.32, 1] as const;
export const EASE_DRAWER = [0.32, 0.72, 0, 1] as const;

export function PeekPanel({ open, instant, viaKeyboard, target, children }: PeekPanelProps) {
  const swap = viaKeyboard
    ? { initial: false as const, exit: { opacity: 0, transition: { duration: 0 } } }
    : {
        initial: { opacity: 0, filter: 'blur(2px)' },
        exit: { opacity: 0, filter: 'blur(2px)', transition: { duration: 0.11, ease: 'easeOut' } },
      };
  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          aria-label="Side peek"
          className="peek"
          initial={{ x: 'calc(100% + 48px)' }}
          animate={{ x: 0, transition: instant ? { duration: 0 } : { duration: 0.3, ease: EASE_DRAWER } }}
          exit={{ x: 'calc(100% + 48px)', transition: { duration: 0.2, ease: EASE_OUT } }}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={target.key}
              {...swap}
              animate={{ opacity: 1, filter: 'blur(0px)', transition: { duration: 0.19, ease: EASE_OUT } }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

export function NextBlockFrame({ state, children }: { state: NextState; children: React.ReactNode }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.section
        key={state}
        className={`doc-sec next ${state}`}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0, transition: { duration: 0.2, ease: EASE_OUT } }}
        exit={{ opacity: 0, filter: 'blur(2px)', transition: { duration: 0.12, ease: 'easeOut' } }}
      >
        {children}
      </motion.section>
    </AnimatePresence>
  );
}

export function MeetingBodyCollapse({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <motion.div
      initial={false}
      animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }}
      transition={{ height: { duration: 0.26, ease: EASE_OUT }, opacity: { duration: 0.2 } }}
      style={{ overflow: 'hidden' }}
    >
      {children}
    </motion.div>
  );
}

export function DocCanvas({ drawerOpen, shift, children }: { drawerOpen: boolean; shift: number; children: React.ReactNode }) {
  const t = { duration: drawerOpen ? 0.3 : 0.2, ease: EASE_DRAWER };
  return (
    <>
      <motion.div className="canvas-inner" animate={{ x: drawerOpen ? -shift : 0 }} transition={t}>{children}</motion.div>
      <motion.aside className="drawer" initial={false} animate={{ x: drawerOpen ? 0 : 'calc(100% + 24px)' }} transition={t} />
    </>
  );
}

export const acceptAll = (pending: Candidate[], accept: (id: string) => void) =>
  pending.forEach((c, i) => setTimeout(() => accept(c.id), i * 70));
```

Drawer shift, as computed in 002: `left = (mainWidth − columnWidth) / 2`, then `shift = max(0, min(left + columnWidth + 24 − (mainWidth − 366), left − 24))`. For the receive flash, keep 002's CSS and restart it by removing `.receive`, forcing a reflow and adding it again. That is cheaper than a JS animation per landed item.

## CSS Patterns

Tokens: `--content-bg`, `--surface-sunken`, `--fill*`, `--label*`, `--separator`, `--hairline`, `--accent*`, `--mint*`, `--coral*`, `--amber`, `--series-orange`, `--series-teal`, `--glass-strong`, `--shadow-card`, `--shadow-float`, `--r-card` (12px), `--toolbar-h` (52px), `--ease-out`, `--ease-drawer`. Both themes are in `sources/themes/`.

Column, sections and header:

```css
.doc-surface { container: surface / inline-size; }
.doc { width: min(720px, calc(100% - 112px)); margin: 0 auto; padding: 30px 0 160px; }
.doc-sec { position: relative; margin-top: 44px; scroll-margin-top: calc(var(--toolbar-h) + 20px); }
.sec-head { display: flex; align-items: center; gap: 8px; min-height: 26px; margin-bottom: 12px; }
.sec-eyebrow { font-size: 11px; font-weight: 600; letter-spacing: 0.07em; text-transform: uppercase; color: var(--label-3); }
.sec-meta::before { content: "·"; margin-right: 7px; }
.sec-caption { display: inline-flex; align-items: center; gap: 4px; font-size: 11.5px; color: var(--label-3); }
.sec-caption::before { content: "·"; margin-right: 3px; }
.doc-title-row { display: flex; align-items: center; gap: 14px; }
.doc-title { flex: 1; min-width: 0; margin-left: -6px; padding: 2px 6px; border-radius: 8px; outline: none; transition: background-color 150ms ease; }
.doc-title:empty::before { content: attr(data-placeholder); color: var(--label-3); }
.doc-title:focus { background: var(--accent-softer); }
.doc-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 12px; padding-left: 50px; }
.meta-chip { height: 24px; padding: 0 10px; gap: 6px; font-size: 12px; border: 0; background: var(--fill); color: var(--label-2); transition: background-color 150ms ease, color 150ms ease, transform 140ms var(--ease-out); }
button.meta-chip:active { transform: scale(0.97); }
.tb-title { opacity: 0; transform: translateY(4px); pointer-events: none; transition: opacity 180ms var(--ease-out), transform 180ms var(--ease-out); }
.tb-title.show { opacity: 1; transform: none; }
.save-state { font-size: 12px; color: var(--label-3); transition: color 150ms ease; }
.save-state.busy { color: var(--label-2); }
```

Purpose, editable fields, reference and drop:

```css
.editable { outline: none; border-radius: 7px; margin: 0 -7px; padding: 3px 7px; transition: background-color 150ms ease, box-shadow 150ms ease; }
.editable:focus { background: var(--accent-softer); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 22%, transparent); }
.p-block + .p-block { margin-top: 18px; }
.p-label { display: flex; align-items: baseline; gap: 8px; margin-bottom: 4px; font-size: 12px; font-weight: 600; color: var(--label-2); }
.p-why { font-size: 15px; line-height: 1.55; letter-spacing: -0.005em; }
.p-outcomes li { position: relative; padding-left: 16px; font-size: 13.5px; line-height: 1.6; }
.p-outcomes li::before { content: ""; position: absolute; left: 4px; top: 0.72em; width: 5px; height: 5px; border-radius: 50%; background: var(--label-3); }
.ag-row { display: flex; align-items: baseline; gap: 12px; padding: 2px 0; box-shadow: inset 0 -0.5px 0 var(--separator); }
.ag-row .ag-d { width: 64px; flex: none; text-align: right; font-size: 12px; color: var(--label-3); }
.ver-bump { animation: ver-bump 420ms var(--ease-out); color: var(--accent-strong); }
@keyframes ver-bump { from { opacity: 0; transform: translateY(3px); } }
.ref-row { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 20px; }
.inc-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--accent); transition: background-color 150ms ease, box-shadow 150ms ease; }
.inc-dot.off { background: transparent; box-shadow: inset 0 0 0 1.3px var(--label-3); }
.chip-in { animation: chip-in 280ms var(--ease-out) both; }
@keyframes chip-in { from { opacity: 0; transform: translateY(3px) scale(0.95); } }
.purpose { isolation: isolate; }
.purpose::after { content: ""; position: absolute; inset: -14px -18px; border-radius: 18px; border: 1.5px dashed color-mix(in srgb, var(--accent) 60%, transparent); background: var(--accent-softer); opacity: 0; pointer-events: none; transition: opacity 150ms ease; z-index: -1; }
.purpose.drop-target::after { opacity: 1; }
.drop-hint { position: absolute; top: -26px; right: -8px; height: 26px; padding: 0 11px; border-radius: 999px; background: var(--accent); color: var(--on-accent); font-size: 12px; font-weight: 500; box-shadow: var(--shadow-float); opacity: 0; transform: translateY(4px) scale(0.97); transition: opacity 150ms var(--ease-out), transform 200ms var(--ease-out); }
.drop-target > .drop-hint { opacity: 1; transform: none; }
```

Memory:

```css
.mem-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; align-items: start; }
.mem-group { padding: 10px 14px 6px; border-radius: var(--r-card); background: var(--surface-sunken); }
.mem-group[data-type="decision"] { --c: var(--accent); }
.mem-group[data-type="commitment"] { --c: var(--series-orange); }
.mem-group[data-type="question"] { --c: var(--amber); }
.mem-group[data-type="fact"] { --c: var(--series-teal); }
.mem-group-head { display: flex; align-items: center; gap: 7px; height: 26px; font-size: 12px; font-weight: 600; }
.mem-item { margin: 0 -8px; padding: 9px 8px; border-radius: 8px; box-shadow: inset 0 0.5px 0 var(--separator); }
.mem-item.done .mem-text { color: var(--label-2); }
.mem-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-top: 5px; }
.mem-meta .source { margin-left: auto; }
.mem-replaced { display: flex; gap: 5px; margin-top: 6px; font-size: 11.5px; color: var(--label-3); }
.mem-item.receive { animation-duration: 1500ms; }
.receive { animation: kit-receive 900ms var(--ease-out); }
@keyframes kit-receive { 0%, 30% { background-color: var(--accent-soft); } 100% { background-color: transparent; } }
```

Next block and its rows:

```css
.next { padding: 18px 22px 20px 26px; border-radius: 16px; background: var(--accent-softer); }
.next::before { content: ""; position: absolute; left: 0; top: 16px; bottom: 16px; width: 3px; border-radius: 0 3px 3px 0; background: var(--accent); }
.next.live { background: color-mix(in srgb, var(--coral) 7%, transparent); }
.next.live::before { background: var(--coral); }
.next.preparing, .next.idle { background: var(--surface-sunken); }
.next.preparing::before, .next.idle::before { background: var(--label-4); }
.next-title { display: flex; align-items: center; gap: 6px; font: 600 15px/1.3 var(--font); letter-spacing: -0.01em; }
.next-kicker { color: var(--accent-strong); }
.carry-row { display: flex; align-items: center; gap: 10px; min-height: 36px; padding: 6px 0; box-shadow: inset 0 -0.5px 0 var(--separator); }
.k-ico { width: 22px; height: 22px; border-radius: 7px; display: grid; place-items: center; color: var(--c); background: color-mix(in srgb, var(--c) 14%, transparent); }
.ask { position: relative; margin-top: 18px; padding: 11px 14px 6px 18px; border-radius: 12px; overflow: hidden; background: var(--content-bg); box-shadow: var(--shadow-card); }
.ask::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: var(--mint); }
.ask-head { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: var(--mint-ink); }
.next-grid { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); gap: 24px; }
.agenda-item { display: flex; align-items: center; gap: 10px; min-height: 32px; }
.agenda-item.done .ag-t { color: var(--label-3); text-decoration: line-through; text-decoration-color: var(--label-4); }
.added-by { padding: 1px 7px; border-radius: 999px; font-size: 10.5px; font-weight: 500; background: var(--accent-soft); color: var(--accent-strong); }
.next-docs .doc-chip { background: var(--content-bg); box-shadow: var(--shadow-card); }
.live-line b { flex: none; width: 92px; font-weight: 600; color: var(--label-2); }
@media (hover: hover) and (pointer: fine) { .ask-add { opacity: 0; } .ask-row:hover .ask-add, .ask-add:focus-visible { opacity: 1; } }
```

Meetings, review and drawer:

```css
.mtg + .mtg { box-shadow: inset 0 0.5px 0 var(--separator); }
.mtg-head { position: relative; display: flex; align-items: center; gap: 10px; height: 46px; padding: 0 6px; margin: 0 -6px; border-radius: 10px; transition: background-color 150ms ease; }
.grip { position: absolute; left: -24px; top: 50%; width: 18px; height: 24px; margin-top: -12px; opacity: 0; transition: opacity 150ms ease; }
.mtg-head:hover .grip { opacity: 1; }
.mtg-line { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--label-2); transition: opacity 180ms var(--ease-out); }
.mtg.open .mtg-line { opacity: 0; }
.mtg.dragging { opacity: 0.45; }
.mtg-body { padding: 2px 0 20px 23px; }
.k-row { display: grid; grid-template-columns: 112px minmax(0, 1fr) auto; align-items: center; gap: 12px; min-height: 34px; padding: 5px 0; box-shadow: inset 0 0.5px 0 var(--separator); }
.cand { position: relative; display: grid; grid-template-columns: 112px minmax(0, 1fr) auto; align-items: center; gap: 12px; padding: 10px 12px 10px 14px; border-radius: 12px; background: var(--surface-sunken); transition: opacity 200ms ease; }
.cand[data-state="pending"]::before, .cand[data-state="editing"]::before { content: ""; position: absolute; left: 0; top: 12px; bottom: 12px; width: 2.5px; border-radius: 0 2px 2px 0; background: var(--amber); }
.cand-text[contenteditable="true"] { margin: -3px -6px; padding: 3px 6px; background: var(--content-bg); box-shadow: inset 0 0 0 1px var(--accent), 0 0 0 3px color-mix(in srgb, var(--accent) 22%, transparent); }
.cand[data-state="accepted"] { background: transparent; box-shadow: inset 0 0 0 0.5px var(--separator); }
.cand[data-state="rejected"] .cand-text { color: var(--label-3); text-decoration: line-through; text-decoration-color: var(--label-4); }
.drawer { position: absolute; top: calc(var(--toolbar-h) + 2px); right: 10px; bottom: 10px; z-index: 40; width: 340px; border-radius: 18px; background: var(--glass-strong); backdrop-filter: blur(30px) saturate(1.8); box-shadow: var(--shadow-float); transform: translateX(calc(100% + 24px)); visibility: hidden; transition: transform 200ms var(--ease-drawer), visibility 0s linear 200ms; }
.drawer.open { transform: none; visibility: visible; transition: transform 300ms var(--ease-drawer), visibility 0s; }
.tl { display: grid; grid-template-columns: 42px minmax(0, 1fr); gap: 1px 8px; padding: 8px; border-radius: 10px; transition: background-color 300ms ease; }
.tl.hl { background: var(--accent-soft); }
.scrub-tick { width: 18px; height: 2px; border-radius: 2px; background: var(--label-4); transform: scaleX(0.56); transform-origin: right center; transition: transform 200ms var(--ease-out), background-color 200ms ease; }
.scrub-item.active .scrub-tick { transform: none; background: var(--accent); }
.main.drawer-open .scrubber { opacity: 0; pointer-events: none; }
```

Side peek (from `app.css`):

```css
.window.t-app { --peek-w: max(440px, 44%); }
.t-app .main.peek-open .agenda-inner { padding-right: calc(var(--peek-w) + 24px); }
.peek { position: absolute; top: var(--toolbar-h); right: 0; bottom: 0; z-index: 35; width: var(--peek-w); display: flex; flex-direction: column; border-top-left-radius: 14px; background: var(--content-bg); box-shadow: -0.5px 0 0 var(--separator), 0 -0.5px 0 var(--separator), -22px 0 44px -24px rgba(0, 0, 0, 0.22); transform: translateX(calc(100% + 48px)); visibility: hidden; transition: transform 200ms var(--ease-out), visibility 0s linear 200ms; }
.peek.open { transform: none; visibility: visible; transition: transform 300ms var(--ease-drawer), visibility 0s; }
.peek.instant { transition: none; }
.pk-bar { position: sticky; top: 0; z-index: 3; display: flex; align-items: center; gap: 4px; height: 46px; padding: 0 10px 0 20px; border-top-left-radius: 14px; transition: background-color 200ms ease, box-shadow 200ms ease; }
.peek.pk-scrolled .pk-bar { background: color-mix(in srgb, var(--content-bg) 82%, transparent); backdrop-filter: blur(18px) saturate(1.6); box-shadow: 0 0.5px 0 var(--separator); }
.pk-series { display: inline-flex; align-items: center; gap: 6px; max-width: 60%; margin-left: -4px; padding: 3px 7px 3px 4px; border-radius: 7px; font: 600 12px/1.3 var(--font); color: var(--accent); }
.pk-series.static { color: var(--label-3); font-weight: 500; }
.pk-head { padding: 0 24px 2px; }
.pk-title { display: flex; align-items: baseline; gap: 7px; margin: 2px 0 0; font: 700 22px/1.2 var(--font-display); letter-spacing: -0.02em; }
.pk-n { font-weight: 500; font-size: 17px; color: var(--label-3); }
.pk-meta { display: flex; align-items: center; gap: 10px; margin-top: 5px; font-size: 12px; color: var(--label-2); }
.pk-body { padding: 18px 24px 48px; }
.pk-body > .doc-sec:first-child { margin-top: 0; }
@container main (max-width: 900px) { .t-app .main.peek-open .agenda-inner { padding-right: calc(var(--peek-w) + 16px); } }
```

Compact layout (peek, or any doc surface ≤ 600px):

```css
@container surface (max-width: 600px) {
  .next { padding: 16px 16px 16px 20px; }
  .next-grid { grid-template-columns: minmax(0, 1fr); gap: 0; }
  .carry-row { display: grid; grid-template-columns: 22px minmax(0, 1fr); column-gap: 10px; row-gap: 3px; }
  .carry-side { grid-column: 2; justify-self: start; }
  .cand { grid-template-columns: minmax(0, 1fr); gap: 6px; }
  .k-row { grid-template-columns: minmax(0, 1fr) auto; }
  .k-row > .ktype { grid-column: 1 / -1; }
  .ask-row { flex-direction: column; align-items: stretch; gap: 5px; }
  .live-line { flex-direction: column; gap: 1px; }
  .live-note { display: none; }
}
```

## HTML Structures

Page skeleton (002 `D.docMarkup`):

```html
<article class="doc doc-surface" data-surface="page" data-sid="product-sync">
  <header class="doc-head" id="sec-top">
    <div class="doc-title-row"><span class="series-icon lg" style="--c:var(--series-blue)"></span><h1 class="t-large doc-title" contenteditable="true" data-placeholder="Name this conversation">Product Sync</h1></div>
    <div class="doc-meta"><button class="chip meta-chip" data-act="rule">Every Tue · 10:00–10:45</button><button class="chip meta-chip" data-act="people"><span class="avatars"></span><span>5 people</span></button><span class="chip meta-chip static">36 meetings since Jan 2026</span></div>
  </header>
  <section class="doc-sec purpose" id="sec-purpose" data-mark="Purpose"></section>
  <section class="doc-sec memory" id="sec-memory" data-mark="Memory"></section>
  <section class="doc-sec next" id="sec-next" data-mark="Next" data-sid="product-sync" data-mid="ps-37"></section>
  <section class="doc-sec past" id="sec-past">
    <div class="sec-head"><span class="sec-eyebrow">Meetings</span><span class="sec-caption">Newest first · filed by Telu</span></div>
    <div class="past-list"></div>
    <button class="btn sm plain show-earlier" data-act="earlier">Show 31 earlier meetings</button>
  </section>
</article>
<nav class="scrubber" aria-label="Sections"></nav>
<aside class="drawer" aria-label="Details"></aside>
```

Purpose:

```html
<section class="doc-sec purpose" id="sec-purpose" data-mark="Purpose">
  <div class="sec-head">
    <span class="sec-eyebrow">Purpose</span><span class="sec-meta">v1 · drafted just now</span>
    <span class="chip accent drafted">Drafted from the calendar invite — make it yours</span>
    <span class="spacer"></span><button class="btn sm plain" data-act="purpose-history">History</button>
  </div>
  <div class="p-block"><div class="p-label">Why we meet</div><p class="p-why editable" contenteditable="true" data-field="why" data-placeholder="Why does this conversation exist? One or two sentences."></p></div>
  <div class="p-block"><div class="p-label">What good looks like</div><ul class="p-outcomes editable" contenteditable="true" data-field="outcomes"><li></li></ul></div>
  <div class="p-block"><div class="p-label">Standing agenda<span class="p-total num">45 min</span></div><div class="p-agenda"><div class="ag-row"><span class="ag-t editable" contenteditable="true" data-placeholder="A topic you cover every time">Metrics pulse</span><span class="ag-d num">5 min</span></div></div></div>
  <div class="p-block"><div class="p-label">Not for this meeting</div><p class="p-notfor editable" contenteditable="true" data-field="notFor" data-placeholder="What belongs somewhere else?"></p></div>
  <div class="ref-row"><span class="ref-label">Reference</span><button class="doc-chip ref-chip" data-act="ref-doc"><span class="ftype" data-kind="pdf">PDF</span><span class="truncate">Q4 Roadmap.pdf</span><small>v2</small><span class="inc-dot" data-act="toggle-include"></span></button><button class="doc-chip add-chip" data-act="add-ref">Add</button></div>
  <div class="drop-hint">Drop to add to Reference</div>
</section>
```

Memory item, carry row, ask and agenda item:

```html
<div class="mem-item" data-key="product-sync-m1">
  <div class="mem-text">Pricing experiment runs until Oct 15</div>
  <div class="mem-meta"><span class="status" data-s="current">Current</span><button class="source" data-src="Sep 22 · 24:10">Sep 22 · 24:10</button></div>
  <div class="mem-replaced"><span>replaced ·</span><span class="superseded-text">Pricing experiment runs until Oct 1 · Sep 8</span></div>
</div>
<div class="carry-row"><span class="k-ico" data-type="commitment"></span><span class="carry-text">Share the API rate-limit plan<span class="carry-owner"> · Jon</span></span><span class="carry-side"><span class="carry-note">Due today</span><button class="source">Sep 22 · 18:42</button></span></div>
<div class="ask"><div class="ask-head">Worth asking</div><div class="ask-row"><span class="ask-text">Is Jon’s rate-limit plan ready to decide on today, or does it slip to Thursday?</span><span class="ask-side"><button class="source">Sep 22 · 18:42</button><button class="btn sm icon plain ask-add" data-act="ask-to-agenda" data-tip="Add to agenda"></button></span></div></div>
<div class="agenda-item" data-i="1"><button class="check" aria-checked="false" aria-label="Done"></button><span class="ag-t">Rate-limit plan — decide</span><span class="added-by">Added by Telu</span><span class="ag-d num">15m</span></div>
```

Meeting row with review:

```html
<div class="mtg open" id="m-ps-37" data-mid="ps-37" data-mark="Today">
  <div class="mtg-head" data-act="toggle-meeting">
    <span class="grip" draggable="true" data-tip="Drag onto another series"></span><svg class="i disclosure open"></svg>
    <span class="mtg-date">Today</span><span class="mtg-n num">#37 · 44 min</span><span class="mtg-line">Rate-limit plan approved…</span>
    <span class="mtg-counts"><span class="chip amber num">5 to review</span></span><button class="btn sm icon plain mtg-more" aria-label="More"></button>
  </div>
  <div class="collapsible"><div><div class="mtg-body">
    <p class="mtg-summary">Rate-limit plan approved with per-workspace limits…</p>
    <div class="review" data-review="ps-37">
      <div class="review-head"><span class="review-note">Review what Telu found — only what you accept reaches Memory.</span><span class="spacer"></span><button class="btn sm plain" data-act="accept-all">Accept all</button></div>
      <div class="cand-list"><div class="cand" data-cid="c2" data-state="pending"><span class="ktype" data-type="decision">Decision</span><div class="cand-main"><div class="cand-text">Start SOC 2 Type I now; Acme go-live stays Nov 3</div><div class="cand-meta"><span>Resolves an open question</span><button class="source" data-cand="c2">21:40</button></div></div><div class="cand-actions"><button class="btn sm tinted" data-act="accept">Accept</button><button class="btn sm" data-act="correct">Correct</button><button class="btn sm icon plain" data-act="reject" data-tip="Reject"></button></div></div></div>
    </div>
    <div class="mtg-foot"><button class="btn sm" data-act="transcript">Open transcript</button><span class="mtg-local">Transcribed on this Mac</span></div>
  </div></div></div>
</div>
```

Side peek (002 `app-peek.js headerMarkup` + `BODY`):

```html
<aside class="peek open" aria-label="Side peek"><div class="pk-scroll"><div class="pk-content">
  <div class="pk-bar">
    <button class="pk-series" data-act="open-doc" data-series="product-sync"><span class="series-icon a-xs"></span><span class="truncate">Product Sync</span><svg class="i"></svg></button>
    <span class="spacer"></span>
    <button class="btn sm plain pk-open" data-act="peek-open-page">Open as page</button>
    <button class="btn sm plain icon" data-act="peek-close" data-tip="Close · esc"></button>
  </div>
  <header class="pk-head"><h2 class="pk-title"><span>Product Sync</span><span class="pk-n num">#37</span></h2><div class="pk-meta"><span class="pk-when">Today<span class="a-sep">·</span>10:00–10:45<span class="a-sep">·</span>Google Meet</span><span class="avatars"></span></div></header>
  <div class="pk-body doc-surface" data-surface="peek">
    <section class="doc-sec next" data-sid="product-sync" data-mid="ps-37"></section>
  </div>
</div></div></aside>
```

## Behavior & State

**Data shapes, as used by 002 (`kit/data.js`, `app-model.js`):**

```ts
type KType = 'decision' | 'commitment' | 'question' | 'fact';
type Series = { id; name; color; icon; cadence; rule; source: 'calendar' | 'manual'; calendar?; count; since; people: string[]; private?: boolean; draft?: boolean;
  purpose: { version; edited; by; why; outcomes: string[]; agenda: { t: string; d: string }[]; notFor; drafted?: boolean; history: { v; date; note }[] };
  docs: { name; ver; size; added; include: boolean }[];
  memory: { id; type: KType; text; status: 'current' | 'open' | 'completed' | 'unresolved' | 'superseded'; owner?; due?; from; src; replaced?; resolvedToday?; fresh? }[];
  meetings: Meeting[] };
type Meeting = { id; n; date; time; status: 'upcoming' | 'preparing' | 'done' | 'review' | 'cancelled'; where?; title?; duration?; ended?; summary?; note?;
  counts?: { decisions; actions; questions }; items?; docs?: string[]; transcript?: { t; who; text }[]; movedFrom?; filedFrom?;
  brief?: { carry: { type: KType; text; owner?; note?; status; src }[]; ask: { text; src }[]; agenda: { t; d; done?; added?; fromAsk?; askIndex? }[]; docs: string[]; off?: string[] };
  candidates?: { id; type: KType; text; owner?; due?; resolves?: string; ev: { t; who; quote }; state: 'pending' | 'editing' | 'accepted' | 'rejected'; corrected? }[] };
type Evidence = { kind: 'speech'; where; t; who; quote; mid: string | null } | { kind: 'doc'; doc; loc; quote };
```

`src` is a string in 002: either "Sep 22 · 18:42" (short meeting date · transcript time) or "Q4 Roadmap.pdf · p.7" (document · locator). In production, replace it with a structured evidence reference: meeting id plus transcript segment id, or document id plus version plus locator (KNOW-02, PREP-02, DOC-02). UI state: `expanded: Record<meetingId, boolean>`, `edited: Record<seriesId, boolean>`, `peekOpen`, `selection { kind: 'event' | 'meeting' | 'unfiled', id }`, and `view { kind: 'doc', seriesId, from }`, where `from` is the agenda origin used by Back. All updates are immutable (`T.mapSeries` / `T.mapMeeting` return new objects), which keeps Undo a snapshot restore.

**Purpose editing.**
- Enter in a standing-agenda row inserts a row with duration "5 min". Backspace on an empty row removes it.
- Enter blurs single-line fields; Esc blurs any field.
- Every input marks the series edited and schedules the 700ms save. Save reads all four fields into the model, re-morphs agenda cards for the series and refreshes the Island. Leaving the page flushes a pending save.
- Title: typing renames the sidebar row and toolbar title live. On a draft, Enter parses natural language ("Weekly 1:1 with Priya, Thu 11am") into cadence, day, time and people, then toasts the parse and focuses "Why we meet".
- In 002 the minutes column is display-only: `.ag-d` is not editable.

**Header popovers.**
- Cadence chip, calendar series: "Linked to Calendar · Work · “Product Sync”", the rule, then Change… (menu "Follow a different event") and Unlink. Unlink sets the source to manual with rule "Grouped by you · no fixed time" and toasts "Unlinked from Calendar — recordings still file here" with Undo.
- Cadence chip, manual series: "Grouped by you · Not tied to a calendar event…".
- People chip: an attendee list with the footer "From the calendar invite" or "Added by you".
- Doc ⋯ menu: Rename, Edit purpose ⌘E, Export as Markdown ⇧⌘E, Stop tracking… (confirm: "Telu keeps its memory and past meetings, but won’t prepare briefs for new ones.").

**Reference and docs.**
- Clicking a chip opens its popover: file meta, the "Include in every brief" Switch, Open, and Remove (toast with Undo).
- Clicking the dot toggles include and toasts "… is included in every brief" or "… stays out of briefs". Meeting-doc dots toggle per brief: "… stays out of this brief".
- Dropped or picked files get unique names ("Plan 2.pdf").
- The purpose zone takes drops on `#sec-purpose`; the meeting zone takes drops on `.next-docs`, and the Island attaches there too.

**Review → Memory**, the trust core:
- Accept writes a Memory item. Status depends on type: commitment is open, question is unresolved, anything else is current. The item gets `src = "<date> · <ev.t>"`. It flashes 1500ms, the scrubber Memory tick bumps, and a toast reads "Added to Product Sync Memory" with Undo (Undo restores the whole series snapshot).
- A correction saves the user's wording ("Correction saved — Telu keeps your wording") and the row shows "✓ Corrected · in Memory".
- "Resolves an open question": accepting marks the matching question completed and "Resolved today".
- Reject strikes the row through and offers Undo.
- When nothing is left pending, the head turns to "Reviewed — Memory is up to date." and a toast reads "All reviewed · Memory is up to date". On the Review page, a fully reviewed meeting folds away after a 500ms beat.

**Evidence routing** (`D.openEvidence`):

| Chip location | Popover | Open action |
|---|---|---|
| Candidate (doc page) | speech, "EVIDENCE · Sep 28 · 52:10" (a meeting dated Today shows "Today"), quote, speaker | "Open transcript" → drawer with the line highlighted and centred |
| Candidate (peek) | same | expands the inline transcript, highlights the line, smooth-scrolls it to centre after 280ms |
| Inside a past meeting | speech | "Open transcript" → drawer |
| Memory, carry row, ask (doc page) | speech | "Jump to Sep 22" → expands that meeting, smooth scroll, receive after 360ms |
| Anything in the peek | speech | "Open Sep 22 in the doc" → Open as page at that meeting |
| No meeting on file | speech, no open button | — |
| Document source | "EVIDENCE · Q4 Roadmap.pdf · p.7", quote, file badge, "Read on this Mac", Open | Open → Preview (toast in 002) |

**Organizing past meetings.** The ⋯ menu has the title "Tue 22 Sep · #36" and these items:
- Move to another series… opens a second menu of series swatches, then fly and fold, with the toast "Moved Tue 22 Sep to Acme · Implementation" and Undo.
- Split into new doc creates a draft series with this meeting. It lands in the sidebar and toasts "Split … into a new doc" with the action "Name it".
- Open transcript.
- Remove from this doc sends the meeting to Review › Needs filing ("Moved … to Review · Needs filing", with Undo).
- Delete meeting… opens a coral confirm and toasts "Deleted … from this Mac", with no Undo.

Dragging the grip onto a sidebar row does a move without the flight (the row receives). Dragging onto the Review row unfiles. A moved meeting shows "from <series>".

**Side peek routing** (`T.peekTarget`):

| Selection | View | Body |
|---|---|---|
| Upcoming / preparing / recording / summarizing meeting of a tracked series | next | NextBlock `surface="peek"`: brief ready, not prepared yet (evening-before note, carry forward so far, standing-agenda preview), preparing brief, starting now, live, preparing summary |
| Past or needs-review meeting | past | "Summary" eyebrow + CountsChips + MeetingBody (summary, review or knowledge rows, docs, Open transcript → inline collapsible transcript) |
| Cancelled meeting | past | "Cancelled in Calendar. Nothing was recorded; open items carried forward to the next meeting." |
| Tracked series without a meeting | tracking | note card "Telu is tracking …" + "Open …" |
| Untracked recurring / one-off event | untracked | empty state + "Track this series" or "Add to series…" + "Record once" / "Don’t record" (none once the event has passed); one-off recording shows the "Recording once" strip |
| Proposed match | proposal | "Telu found a likely match" card: Add to … / Keep separate |
| Unfiled recording or file | unfiled | filing card (File there / Choose… / Play) + transcript or file chip |

"Open as page" and the series link appear only for tracked, filed items. Open as page reveals `#sec-next` for next items and `#m-<id>` (expanded) for past ones. Keyboard in agenda views:
- ↑/↓ moves the selection and swaps the peek instantly.
- Enter opens the selected card's peek instantly (only when no field has focus, no layer is open and the peek is closed).
- Esc blurs a field first, then closes the drawer, then the peek; in a doc it goes Back.
- ⌘[ goes Back.

**BlockNote mapping** (frontend has `@blocknote/core` / `react` / `shadcn` 0.36.0; the existing wrapper is `frontend/src/components/BlockNoteEditor/Editor.tsx`). The doc is not one free-form document. The structured model (Series / Purpose / Memory) is the source of truth, and BlockNote renders only the user-authored regions:

| Region | 002 behavior | Build as | Provenance rule |
|---|---|---|---|
| Title | single line; Enter commits, Esc blurs | controlled contentEditable `<h1>` (not BlockNote) | user-authored |
| Why we meet / Not for this meeting | one paragraph each; Enter blurs | one BlockNote editor per Purpose with a locked schema: `BlockNoteSchema.create({ blockSpecs: { ...defaultBlockSpecs, purposeWhy, purposeNotFor, agendaRow } })`, blocks from `createReactBlockSpec`; render with `slashMenu={false} sideMenu={false} formattingToolbar={false}` | user-authored; every save bumps `purpose.version` and appends to `history` |
| What good looks like | list; Enter makes a new item | `bulletListItem` blocks in the same editor | user-authored |
| Standing agenda | rows of text + minutes; Enter adds (5 min), Backspace on empty removes | custom `agendaRow` block: `propSchema: { minutes: { default: '5 min' } }`, `content: 'inline'` | user-authored |
| This meeting's agenda | checklist, add field, origin pills | Radix Checkbox list (or a `checkListItem`-style custom block) with props `{ done, minutes, origin: 'user' \| 'telu' \| 'ask', askIndex, evidenceRef }` | Telu-added items keep origin and source; never strip them on edit |
| Memory, carry rows, asks, knowledge rows, candidates, summaries | read-only; only Correct during review changes wording | React components over structured data, not editable BlockNote | always evidence-linked; a correction is a new revision (KNOW-04) |
| Free-form notes | not in 002 | none; add only with a new sketch | — |

Serialize the Purpose editor back to `{ why, outcomes[], agenda[{ t, d }], notFor }` on the 700ms debounce. Briefs read those fields, never raw BlockNote JSON. If a source must appear inside editable text, make it a custom inline node (`createReactInlineContentSpec`) with an immutable `evidenceRef` prop that renders a SourceChip. Export (⇧⌘E) renders sources as text references.

**Trust requirements vs 002** (`.planning/REQUIREMENTS.md`):

| Requirement | 002 shows | Production rule |
|---|---|---|
| SERIES-02: only accepted items become memory | "Only items you accepted"; the review head copy | enforce in the data layer; candidates stay meeting-scoped until accepted |
| KNOW-02: exact evidence per candidate | source chip → quote → highlighted transcript line | stable candidate id + transcript segment id; the chip opens that segment |
| KNOW-03: independent accept / correct / reject | per-row actions, Accept all, Undo | show eligibility immediately (row state + Memory) |
| KNOW-04: corrections are revisions | "Corrected · in Memory" only | store a revision linked to the original and its evidence; 002 shows no revision history (gap) |
| KNOW-05: rejected items stay out | Rejected + Undo | persist rejections; regeneration must not bring them back |
| KNOW-06: abstain / unresolved fields | absent | gap |
| KNOW-08: deleting invalidates knowledge | the delete alert says "Items already in Memory stay." | conflict: mark dependent Memory evidence as missing (source-missing), never a silently "supported" claim |
| SERIES-03: inspect provenance | source chip + "from" date | add a revision and status history view (gap) |
| SERIES-04: current / superseded / disputed / unresolved; open / completed / cancelled | current, open, Done, unresolved, "replaced ·", "Resolved today" | add disputed and cancelled display (`Kit.status` already styles them) |
| SERIES-05: conflicts are the user's call | accept auto-replaces the older fact (002's `SUPERSEDES`) | conflict: show both versions and offer supersede, dispute or leave unresolved |
| SERIES-06 / PREP-01: carry forward | brief "Since last time" rows come from the prepared brief (commitments, questions, facts); the not-yet-prepared preview uses open commitments + unresolved questions from Memory, max 4 | keep disputed, superseded, rejected and source-missing items separate |
| PREP-02: every brief claim opens its source | chips on carry rows and asks; doc popover shows name + locator | include the document version in the popover |
| PREP-03: inspect inclusion | include dots + provenance line | add truncated and omitted reasons (gap) |

**Accessibility.**
- Doc: the H1 is contenteditable with `aria-label`; purpose fields get `aria-label` and `aria-multiline`; save state is an `aria-live="polite"` region.
- Rows and actions: meeting heads are buttons with `aria-expanded` and `aria-controls`. Candidate actions are buttons: Reject needs `aria-label="Reject"`, and the correct field gets `role="textbox"`. After Accept, move focus to the next pending row.
- Status and structure: ReviewHead is `role="status"`; NextBlock status changes are `aria-live="polite"`. The scrubber is a `<nav aria-label="Sections">` with `aria-current`. The drawer is `role="complementary"`. The peek is `<aside aria-label="Side peek">`, non-modal, and focus stays in the agenda.

**Known gaps to fix** (003 README and this reading):
- `.ver-bump`, `.chip-in` and `tick-receive` ignore reduced motion.
- Some icon-only buttons have only `data-tip` and no `aria-label`: the peek ✕, "Add to agenda" +, and Reject.
- No "Editing…" state; no pending counts on sidebar series rows (they live on the Review row).
- The purpose minutes column is not editable.
- "Show N earlier meetings" only toasts.
- `maybePrepare` fakes "brief ready" 2.6s after the peek opens. In production this must be event-driven.

## What to Avoid

- **A's permanent inspector column and purpose sheet**, and **C's purpose editing inside the ⌘K window**. They were not adopted. The peek is transient, and purpose editing happens only inline in the doc.
- **B's search + grouped sidebar** (Team / 1:1s / Clients / Leadership / Other, a "Search docs" field, the Up Next / Suggestions / Unfiled smart rows, pending counts per doc row, the "New Living Doc" footer). Not adopted: A's four tabs (Today, Upcoming, Review, Found in Calendar) plus a flat Series list are the rule.
- **Editable Memory or auto-promotion.** Generated items become memory only through Accept. There is no inline Memory editing and no source-free claim; both are listed out of scope in REQUIREMENTS. Never overwrite a decision in place: keep the "replaced ·" chronology.
- **Mint as decoration.** Mint appears only in Worth asking (and "Worth asking now"). Coral appears only for recording and destructive confirms.
- **Animating keyboard navigation.** No peek slide or crossfade on ↑/↓, no animated review row swaps, no dimmed or modal peek.
- `transition: all`, scaling from `scale(0)`, or animating top, left, margins or shadow spread. The only layout animations are the documented height folds, grid-row collapsibles and the drawer column shift.
- **The include dot nested inside the chip button.** It is two controls in one; split them.
- **Leaving reduced-motion leaks** (ver-bump, chip-in, tick-receive) in production.

## Origin

Synthesized from sketches: 001 (B living doc; A and C only as rejected alternatives), 002, 003.

Source files available in:
- `sources/002-final-app/`: doc-render.js, doc-past.js, doc-page.js, doc-edit.js, doc-review.js, doc-organize.js, doc-popovers.js, doc.css, app-peek.js, app.css, app-shell.js, app-agenda.js, app-model.js, app-data.js, app-actions.js, app-record.js, app.js, index.html, README.md
- `sources/003-component-catalog/`: sec-doc.js, sec-doc-2.js, sec-peek.js, sec-motion.js, sec-motion-2.js, COMPONENTS.md, README.md
- `sources/kit/`: mac-kit.css, mac-kit.js, data.js
- `sources/themes/`: default.css, dark.css
- `sources/001-app-mental-model/`: README.md

Not copied into sources:
- `.planning/sketches/001-app-mental-model/`: b-living-doc*.js/.css, a-today-inspector.js, a-today-flows.js, c-companion-palette.js
- `.planning/PROJECT.md` and `.planning/REQUIREMENTS.md` (KNOW-*, SERIES-*, PREP-*)
