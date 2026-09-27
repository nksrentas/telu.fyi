# Calendar & Agenda

Everything that lives in the content column of the agenda views: the Today / Yesterday / Tomorrow timeline (time column, event cards, now line, free time, past dimming, selection), every EventCard state, the proposals banner, Upcoming, the New series popover with its natural-language parser, the recording capsule, the Review and Found in Calendar pages, search, and the calendar flows that detect, track, link, add and file meetings. The toolbar, sidebar, view model and keyboard map are in [app-shell-and-navigation.md](app-shell-and-navigation.md). Full props and states for every component named here are in [component-inventory.md](component-inventory.md).

## Design Decisions

1. **The agenda is a list, not a grid.** Each row is a 44px time column (`--a-time-w`), a 14px gap, then the card; rows are in start order, 8px apart. Duration is text, not height. Time column: start 12px/600, end 11px `--label-3`, right-aligned, 11px top padding; Review rows add a 10px/600 `--label-3` day label above. Content padding `6px 28px 72px` (20px sides when the main column is ≤ 900px). Adopted from 001 A.

2. **Every event carries a Telu state (its kind)**, derived by one function, never stored: personal → recording → summarizing → unfiled / filed → tracked (review > filed > preparing > ready, or tracking when no meeting exists yet) → proposal → recurring → one-off. The kind alone decides the chip, meta line, actions and the colour bar.

3. **Colour carries meaning.** A 3px series-colour bar (left 9px, radius 3) appears only on tracked events. `--accent` means Telu is on it or found something (Brief ready, ✓ Tracking, "Part of … ?", the banner, Found cards). `--amber` means it needs you ("N to review", Unfiled). `--coral` means live (recording eyebrow, ring and bar, Starting now, the now line, Record buttons). A dashed neutral chip means Telu is not tracking it (Not tracked, One-off). Shimmer means Telu is working on it. Mint appears nowhere in the agenda.

4. **Next up is the hero.** The next tracked meeting today grows: padding `13px 16px 14px 23px`, `--shadow-card-hover`, a 15px/600 title, an 11px/600 `--accent-strong` eyebrow ("Next up · in 19 min"), a one-line purpose excerpt (12.5px `--label-2`) and always-visible Join / Record ⌘R. At start time the eyebrow turns coral-ink "Starting now" with a pulsing 6px dot and Skip / Record; while recording it shows the rec dot, "Recording", the timer and a 5-bar wave, plus a coral bar and a 1px coral ring.

5. **Past dims but stays legible**: transparent background, 0.5px hairline ring, title / meta / chip at 55% opacity, bar at 45%, time in `--label-3`. Past rows that still need you (review, unfiled) stay bright.

6. **Secondary actions stay quiet until asked.** Track, Add to series…, Record once and Review fade in on hover (fine pointers only), stay visible on the selected card, and are always visible on touch. They overlay the right end of the meta line on a gradient, so nothing reflows. Primary actions (Join / Record / Stop / Skip on the next card, Add / Keep separate on a proposal) are always visible.

7. **The now line is placed, not animated.** It is a coral 1px line with an 8px dot and the time (10.5px/700) in the time column, sitting above the first event that has not ended (or after the last), on today only. Free time of 45 minutes or more between events shows as a dashed divider ("1 h 15 min free"), except where the now line sits.

8. **Personal events are busy blocks**: a 30px hatched strip reading "Personal · Busy", titled ("Lunch · Personal") only when that calendar is watched. Not selectable.

9. **Proposals never auto-join.** A new recurrence becomes a "new recurring meeting" proposal; an event that looks like an existing series becomes a "part of …?" proposal; a weak pattern becomes a quiet one. Each is decided once (Track as series / Not a series, Add to … / Keep separate, Track anyway / Stop suggesting), confirmed by a toast, with Undo where the decision is reversible. The Today banner surfaces only new-series finds.

10. **Creating a series is describing it.** One sentence is parsed live into five chips (Title, Repeats, Day, Time, With), or the series is linked to a calendar event. Create flies the new series into the sidebar and opens its living doc with the purpose focused. Chosen over 001 A's purpose sheet: the purpose lives only in the doc.

11. **Filing is suggested, never silent.** Recordings and files Telu cannot place show its best guess and the reason ("Mentions “Dana”, “SSO” and “audit logs”") with File there / Choose….

12. **Review and Found are destinations, not modals.** Review lists meetings with pending items (with their day) and Needs filing; rows leave once done. Found in Calendar lists proposals with a "Less likely" group and a privacy footnote. 002 opens no sheet anywhere.

13. **Search is a toolbar popover (⌘F)** over series and memory; results open living docs.

## Components

Full specs: component-inventory.md › Calendar and › Pages (and › Chip, › ContextMenu, › FlyChip, › Toast).

| Component | Role | Key variants/states | Maps to |
|---|---|---|---|
| TodayView | Agenda page: banner + timeline | before, live, after | Page composition in the view switch |
| Timeline | A day's rows, now line, gaps | before, starting, live, after, yesterday, tomorrow, empty | `role="listbox"` + framer `LayoutGroup` |
| EventRow | Time column + EventCard or busy block | upcoming, past, past-but-needs-you, personal busy/watched, with day label | Grid row, `motion.div layout="position"` |
| EventCard | One event with its Telu state | see the state table below | `motion.article` with layout; Buttons; Radix ContextMenu (`@radix-ui/react-context-menu`, not yet installed) |
| NowLine | Current time marker | before a meeting, at start, during, after | Static element, repositioned every 60s |
| FreeGap | "N free" divider for gaps ≥ 45 min | minutes, hours, hours + minutes | Plain component |
| DayHeader | Toolbar title + subtitle | day, page with count, page empty | h1 + description |
| DayStepper | ‹ Today › glass group | rest, prev/next disabled, both disabled | 3 Buttons in a glass group + Tooltip |
| ProposalsBanner | "Telu found N new recurring meetings" | several, one, collapsed, narrow | Collapsible (framer height) + Alert styling |
| UpcomingDay | Day group on Upcoming (and "To review") | mixed kinds, hidden when empty | section with h2 + rows |
| NewSeriesPopover | Describe-to-create + link an event | empty, partial parse, parsed, link menu, linked, nothing to link | Radix Popover + Input + DropdownMenu; `lib/parse-series.ts` |
| SeriesPickerMenu | Titled menu of tracked series | Add to series, File to, Link an event | Radix DropdownMenu |
| RecordingCapsule | Coral toolbar capsule while recording | live, hover/pressed Stop, series recording, fallback label, truncated | `motion.div` in `AnimatePresence` |
| ReviewPage | To review + Needs filing | before (5), after (10), all caught up | Page composition |
| DayGroupHeader | Inline section header past the time column | day, count, explanation, truncated | h2 + span |
| ReviewMeetingRow | EventRow (withDay) with "N to review" | pending, hover, selected, all reviewed, leaving | Row in the Review listbox |
| UnfiledCard | Recording / file Telu could not place | recording + suggestion, doc + suggestion, no match, selected, filed (leaving) | Card + Buttons + SeriesPickerMenu |
| FoundPage | Found in Calendar | 3 suggestions, deciding, caught up | Page composition |
| PageHeader | Large title + one line | default, wrapped | h1.t-large + p |
| ProposalCard | One pattern, decided once | new series, join a series, quiet, decided (leaving) | Card + Buttons + AvatarStack |
| CaughtUp | Replaces the proposal list at zero | shown, fading in | EmptyState |
| EmptyPage | Full-page empty states | all caught up, no calendar, welcome | EmptyState |
| PrivacyNote | "On this Mac" line | footnote, caption, panel | Small text + lock |
| SearchPopover | ⌘F search | hint, series + memory, memory only, no matches, nothing to search | cmdk inside Radix Popover |
| FlyChip | Ghost that flies into a sidebar row | series pill, link chip, waveform/doc chip | Portal + two nested `motion.div`s |

Build notes:
- **EventCard**: render six slots (eyebrow, chip, purpose, meta, actions, extra), each keyed by its content so that only the changed slots crossfade on a state change (see Motion). Keep `kind` a pure selector; the card receives the event, the derived kind, its tracked series, `next`, `starting`, `selected` and `past`.
- **Timeline**: build the list in one pass: walk events in start order, push a FreeGap before an event when the gap to the previous end is ≥ 45 min (unless the now line goes there), push the NowLine before the first event whose end is after now (today only), and append it at the end if every event has ended.
- **NewSeriesPopover**: port `Kit.parseSeries` as a pure, unit-tested function (rules and examples below) and debounce input by 90ms. Create stays disabled until a title parses.
- **ProposalCard / UnfiledCard / ReviewMeetingRow**: all leave through the same list-exit animation; decisions update the store first, then the element collapses.

### EventCard states

Meta joins its parts with a `·` in `--label-4`. "Where" gets a video glyph (and the card a Join button) when it matches `/meet|zoom|teams/i`; without a where, the meta shows "Work calendar". Avatars show at most 3.

| State (003 story) | Kind | Chip | Meta | Actions | Also |
|---|---|---|---|---|---|
| Tracked · brief ready | ready | accent "Brief ready" | where · avatars · #n | — | series bar |
| Tracked · preparing brief | preparing | shimmer "Preparing brief" (`--label-2`) | same | — | resolves to Brief ready (002 fakes 2.6s after the peek opens) |
| Tracked · brief tonight | ready, meeting tomorrow, no brief | neutral "Brief tonight" | same | — | |
| Tracked · no brief yet | ready, further out | accent "✓ Tracking" | same | — | |
| Tracking · just switched on | tracking (no meeting yet) | accent "✓ Tracking" | where/calendar · avatars | — | bar grows in |
| Next up | ready / preparing / tracking + next | as above | same (meta row 11px below the title block) | Join (virtual) + Record ⌘R | eyebrow "Next up · in 19 min" (or "in 4 h 19 min", "now"); purpose line |
| Starting now | starting | as above | same | Skip (plain) + Record ⌘R | coral-ink eyebrow, pulsing 6px dot |
| Next up · now | after Skip at start time | as above | same | Join + Record | eyebrow "Next up · now" |
| Recording | recording | none (the eyebrow carries it) | same | Join (virtual) + Stop ⌘R | rec dot + "Recording" + timer + wave; coral bar; 1px coral ring |
| Preparing summary | summarizing | shimmer "Preparing summary…" | unchanged | — | 900ms beat after Stop |
| Ended · N to review | review | amber "5 to review" | "Ended 10:44 · 44 min · #37" | hover: Review | |
| Ended · filed | filed | "✓ Filed" (icon `--label-3`) | Ended … | — | |
| Review (yesterday) | review | amber "3 to review" | "Room 2A · 58 min · #5" | hover: Review | not dimmed |
| Untracked recurring | recurring | dashed "↻ Daily · Not tracked" | where · duration · avatars | hover: tinted "+ Track" | no bar |
| One-off | oneoff | dashed "One-off" | where · duration · avatars | hover: tinted "Add to series…" + "Record once" | |
| One-off · records once | oneoff + recordOnce | "● Records at 17:00" (coral mini dot) | same | hover: Add to series… | Track is also hidden on a recurring card set to record once |
| One-off · past | oneoff, past | "One-off" | same | hover: Add to series… only | Record once disappears after the event |
| Proposal | proposal | accent "Part of Acme · Implementation?" | where · reason | tinted "Add" + plain "Keep separate", always visible | |
| Proposal → added | ready | "Brief tonight" | where · avatars (the new meeting has no number yet) | — | bar grows in |
| Proposal → kept separate | oneoff | "One-off" | where · duration | hover as one-off | |
| Unfiled recording | unfiled | amber "Unfiled" | "8 min · Recorded on this Mac" (lock glyph before the text) | — | suggestion row: series icon · "Looks like **Acme · Implementation** — mentions “Dana”, “SSO” and “audit logs”" · tinted "File" |
| Unfiled · no confident match | unfiled | amber "Unfiled" | same | — | no suggestion row (file from the peek: Choose…) |
| Unfiled → filed | filed | "✓ Filed" | "8 min · Filed to Acme · Implementation" | — | bar grows in, series colour |
| Personal · busy / watched | (row) | — | hatched block "Personal · Busy" / "Lunch · Personal" | — | crossfades when the calendar is toggled |
| Selected · Hover · Pressed | any | — | — | selection reveals hover actions | 2px accent ring · `--shadow-card-hover` · scale(0.992) |

Chip slot kinds (`chipMarkup`): ready → Brief ready | Brief tonight | ✓ Tracking; preparing → shimmer; tracking → ✓ Tracking; review → amber count; summarizing → shimmer; filed → ✓ Filed; recurring → dashed repeat + "· Not tracked"; oneoff → dashed One-off; proposal → accent "Part of … ?"; unfiled → amber Unfiled; recurring/oneoff with record-once → "● Records at HH:MM"; recording → no chip. Container ≤ 520px hides avatars and the purpose line; ≤ 400px tightens chips to `0 7px` and hides kbd hints. Long titles truncate; the chip never shrinks.

Card context menu (right-click, not on busy blocks): Open in side peek ↩ · Open as page (tracked only) · Record / Stop recording ⌘R (enabled only for recordable events today that have not passed, while nothing else records) · Edit purpose… ⌘E (tracked only) · Add to series… (untracked, not unfiled) · — · Stop tracking… (danger; tracked, not unfiled) → Alert "Stop tracking Product Sync?" / "Telu keeps its memory and past meetings, but won’t prepare briefs for new ones." (Cancel · Stop Tracking).

## Motion

Tokens: `--ease-out` [0.23, 1, 0.32, 1], `--ease-in-out` [0.77, 0, 0.175, 1]. Keyboard navigation never animates (←/→, ↑/↓, Enter); ⌘R animates its change like a click.

| Animation | Trigger | Properties | Enter / exit | Interruptible | Keyboard path | Reduced motion |
|---|---|---|---|---|---|---|
| Day slide | ‹ / › / Today | opacity + translateX: out to −16px·dir, in from +16px·dir; scroll resets to top | in 220ms ease-out / out 140ms ease-out (fill forwards) | restart; a token drops stale swaps | ←/→ swap instantly | instant swap |
| Page arrival | Upcoming, Review, Found | opacity 0→1 + blur(2px)→0 | 200ms ease-out, no exit | restart | see shell | none |
| Card hover / press | pointer | box-shadow → `--shadow-card-hover`; scale(0.992) | 200ms ease; 160ms ease-out | yes | — | shadow fades, scale snaps |
| Hover actions | hover (fine pointer), selection | opacity 0→1 | 150ms ease | yes | selection shows them; add `:focus-within` | unchanged |
| Selection ring | select | `::after` 2px accent ring | instant | — | ↑/↓ instant | same |
| Card state morph | track, record, stop, skip, add, keep separate, file, preparing → ready | class and `--c` swap at once; each changed slot: out opacity→0 + blur 2px, swap, in opacity 0→1 + blur 2px→0 | out 110ms ease-out / in 190ms ease-out | restart per slot | ⌘R morphs like a click | instant swap |
| Series bar | becomes tracked / live | scaleY(0.2)→1 + opacity 0→1; colour → coral while recording | 360ms ease-out; opacity 200ms ease; colour 220ms ease | yes (CSS) | same | fades without the grow |
| Row reflow (FLIP) | record / stop changes card heights | translateY(old − new → 0) | 320ms ease-in-out | restart | ⌘R same | rows jump |
| After fade | the meeting ends (After) | ended card opacity 0→1 + blur(2px)→0 | 240ms ease-out | restart | — | none |
| Row stagger (dormant) | whole day appears (calendar just connected) | opacity 0→1 + translateY(6px)→0, 40ms per row | 280ms ease-out | restart | — | off |
| Now line | clock / scenario change | none, re-placed | — | — | — | — |
| Banner collapse | × or last new proposal decided | grid-template-rows 1fr→0fr + opacity | rows 260ms ease-out, opacity 200ms ease | yes (CSS) | — | opacity only |
| Banner text | proposal count changes | crossfade with 2px blur | 110ms out / 190ms in | restart | — | instant |
| Personal label | calendar watched / unwatched | crossfade with 2px blur | 110ms out / 190ms in | restart | — | instant |
| Recording capsule | recording starts / stops | in: opacity, scale 0.96→1, blur 2px→0 · out: opacity, scale→0.96, then removed | 240ms ease-out / 150ms ease-out | a new capsule only when none exists | ⌘R same | instant |
| Status loops | recording, starting, preparing | rec dot 1.4s opacity pulse; wave bars scaleY 0.3↔1 900ms with −200/−450/−650/−100ms offsets; shimmer 1.3s linear; timer 1s | loop | — | — | dot 2.4s; wave and shimmer stop; mini dot keeps 1.4s (gap) |
| Popovers (New series, Search) | click, ⌥⌘N, ⌘F | opacity + scale 0.96→1 from the trigger (`--origin`) | opacity 150ms, scale 190ms ease-out / 110ms | yes | 002 uses the same scale | opacity only |
| Parsed chips | typing (90ms debounce) | changed values opacity 0.2→1 + blur 2px→0; chip `--fill` → `--accent-soft` | 180ms ease-out; colour 180ms ease | restart per chip | typing is the trigger | colour only |
| Linked row | link / unlink | collapsible grid rows + opacity | 260ms / 200ms | yes | — | opacity only |
| Menus (series picker, link, context) | click / right-click | open instantly; chosen row blinks at 60ms; close at 130ms, 120ms fade | 0 / 120ms | n/a | ↑/↓ + Enter | unchanged |
| Fly to sidebar | Create, Track as series, Add to series, Add (proposal), File | flyer x on cubic-bezier(0.45, 0, 0.2, 1); y, scale (to target height ÷ source height, ≥ 0.4) and opacity → 0.35 on cubic-bezier(0.6, 0, 0.9, 0.7); then row receive + icon bump | 560ms; receive 900ms; bump 420ms | no | ⌥⌘N → Enter flies | no flight, row receives |
| List exit | proposal decided, unfiled filed, review row done | height, margins, paddings → 0 + opacity → 0 | 220ms ease-out (review rows after a 500ms beat) | no | — | instant |
| Caught up | last proposal decided | opacity 0→1 + blur 2px→0 | 220ms ease-out | restart | — | instant |

```tsx
const EASE_OUT = [0.23, 1, 0.32, 1] as const
const EASE_IN_OUT = [0.77, 0, 0.175, 1] as const

function Slot({ slotKey, children }: { slotKey: string; children: React.ReactNode }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={slotKey}
        initial={{ opacity: 0, filter: 'blur(2px)' }}
        animate={{ opacity: 1, filter: 'blur(0px)', transition: { duration: 0.19, ease: EASE_OUT } }}
        exit={{ opacity: 0, filter: 'blur(2px)', transition: { duration: 0.11, ease: 'easeOut' } }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

<motion.div layout="position" transition={{ duration: 0.32, ease: EASE_IN_OUT }} className="a-row">
  <motion.article layout whileTap={{ scale: 0.992 }} transition={{ layout: { duration: 0.32, ease: EASE_IN_OUT } }} className="a-card">
    <motion.span
      className="a-bar"
      animate={{ scaleY: tracked ? 1 : 0.2, opacity: tracked ? 1 : 0 }}
      transition={{ scaleY: { duration: 0.36, ease: EASE_OUT }, opacity: { duration: 0.2 } }}
    />
  </motion.article>
</motion.div>
```

```tsx
const daySlide = {
  enter: (dir: number) => ({ opacity: 0, x: 16 * dir }),
  center: { opacity: 1, x: 0, transition: { duration: 0.22, ease: EASE_OUT } },
  exit: (dir: number) => ({ opacity: 0, x: -16 * dir, transition: { duration: 0.14, ease: EASE_OUT } }),
}

{fromKeyboard ? (
  <Timeline day={day} />
) : (
  <AnimatePresence mode="wait" custom={dir} initial={false}>
    <motion.div key={day.key} custom={dir} variants={daySlide} initial="enter" animate="center" exit="exit">
      <Timeline day={day} />
    </motion.div>
  </AnimatePresence>
)}

<AnimatePresence initial={false}>
  {showBanner && (
    <motion.div
      key="banner"
      style={{ overflow: 'hidden' }}
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ height: { duration: 0.26, ease: EASE_OUT }, opacity: { duration: 0.2 } }}
    />
  )}
</AnimatePresence>

<AnimatePresence>
  {recording && (
    <motion.div
      className="a-rec-capsule"
      initial={{ opacity: 0, scale: 0.96, filter: 'blur(2px)' }}
      animate={{ opacity: 1, scale: 1, filter: 'blur(0px)', transition: { duration: 0.24, ease: EASE_OUT } }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15, ease: 'easeOut' } }}
    />
  )}
</AnimatePresence>

<motion.b key={value} initial={{ opacity: 0.2, filter: 'blur(2px)' }} animate={{ opacity: 1, filter: 'blur(0px)' }} transition={{ duration: 0.18, ease: EASE_OUT }}>
  {value || '—'}
</motion.b>

<motion.div
  key={item.id}
  exit={{ height: 0, opacity: 0, marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0, transition: { duration: 0.22, ease: EASE_OUT, delay: isReviewRow ? 0.5 : 0 } }}
  style={{ overflow: 'hidden' }}
/>

<motion.div style={{ position: 'fixed', left: from.left, top: from.top, zIndex: 5000, pointerEvents: 'none' }} animate={{ x: dx }} transition={{ duration: 0.56, ease: [0.45, 0, 0.2, 1] }}>
  <motion.div className="fly-chip" style={{ originX: 0 }} animate={{ y: dy, scale, opacity: 0.35 }} transition={{ duration: 0.56, ease: [0.6, 0, 0.9, 0.7] }} onAnimationComplete={land} />
</motion.div>
```

`dx` = target left − source left; `dy` = the difference between the vertical centres; the flyer is a glass pill (`--glass-strong`, `--shadow-float`, radius 10). `land` removes the flyer, flashes the row (`.receive`) and bumps its icon. Skip every flight, FLIP, slide and blur under `useReducedMotion()`.

## CSS Patterns

Tokens relied on: `--a-time-w` 44px, `--surface`, `--content-bg`, `--surface-sunken`, `--card-bg`, `--c` (series colour), `--shadow-card`, `--shadow-card-hover`, `--hairline`, `--separator`, `--fill`, `--fill-2`, `--fill-3`, `--label`…`--label-4`, `--accent`, `--accent-strong`, `--accent-soft`, `--accent-softer`, `--amber`, `--amber-soft`, `--coral`, `--coral-ink`, `--coral-soft`, `--glass-strong`, `--r-card` 12px, `--ease-out`.

Layout, rows, time column, gaps and the now line (002 app.css):

```css
.agenda-inner { display: flex; flex-direction: column; min-height: 100%; padding: 6px 28px 72px; container: agenda / inline-size; }
.t-app .main.peek-open .agenda-inner { padding-right: calc(var(--peek-w) + 24px); }
.a-timeline { display: flex; flex-direction: column; gap: 8px; }
.a-row { display: grid; grid-template-columns: var(--a-time-w) minmax(0, 1fr); column-gap: 14px; align-items: start; }
.a-time { display: flex; flex-direction: column; align-items: flex-end; padding-top: 11px; line-height: 1.25; white-space: nowrap; }
.a-time b { font-size: 12px; font-weight: 600; letter-spacing: -0.005em; }
.a-time span { font-size: 11px; color: var(--label-3); }
.a-time-day { font-size: 10px; font-weight: 600; color: var(--label-3); margin-bottom: 1px; }
.a-gap { display: grid; grid-template-columns: var(--a-time-w) minmax(0, 1fr); column-gap: 14px; }
.a-gap span { grid-column: 2; display: flex; align-items: center; gap: 10px; padding-left: 21px; font-size: 11px; color: var(--label-3); white-space: nowrap; }
.a-gap span::after { content: ""; flex: 1; border-top: 1px dashed var(--separator); }
.a-now { display: grid; grid-template-columns: var(--a-time-w) minmax(0, 1fr); column-gap: 14px; align-items: center; height: 12px; margin: -1px 0; }
.a-now-time { justify-self: end; font-size: 10.5px; font-weight: 700; color: var(--coral); font-variant-numeric: tabular-nums; }
.a-now-line { position: relative; height: 1px; background: var(--coral); }
.a-now-line::before { content: ""; position: absolute; left: -4px; top: -3.5px; width: 8px; height: 8px; border-radius: 50%; background: var(--coral); }
.a-personal { display: flex; align-items: center; gap: 6px; height: 30px; margin-top: 3px; padding: 0 12px; border-radius: 9px; font-size: 12px; color: var(--label-3); background: repeating-linear-gradient(-45deg, var(--fill) 0 5px, transparent 5px 10px); box-shadow: inset 0 0 0 0.5px var(--separator); }
.a-row.is-personal .a-time { padding-top: 4px; }
.a-row.is-personal .a-time b { font-weight: 500; color: var(--label-3); }
```

EventCard:

```css
.card { background: var(--surface); border-radius: var(--r-card); box-shadow: var(--shadow-card); }
.a-card { position: relative; min-width: 0; padding: 10px 14px 11px 21px; }
.a-card.card.interactive { transition: box-shadow 200ms ease, transform 160ms var(--ease-out); }
.card.interactive:active { transform: scale(0.992); }
.a-card::before { content: ""; position: absolute; left: 9px; top: 11px; bottom: 11px; width: 3px; border-radius: 3px; background: var(--c); opacity: 0; transform: scaleY(0.2); transition: transform 360ms var(--ease-out), opacity 200ms ease, background-color 220ms ease; }
.a-card.is-tracked::before { opacity: 1; transform: none; }
.a-card.is-live::before { background: var(--coral); }
.a-card::after { content: ""; position: absolute; inset: 0; border-radius: inherit; box-shadow: 0 0 0 2px var(--accent); opacity: 0; pointer-events: none; }
.a-card.is-selected::after { opacity: 1; }
.a-card-top { display: flex; align-items: center; gap: 10px; min-width: 0; min-height: 20px; }
.a-title { flex: 1; font-weight: 600; letter-spacing: -0.003em; }
.a-chip-slot { flex: none; display: inline-flex; }
.a-part:empty { display: none; }
.a-meta-row { position: relative; display: flex; align-items: center; gap: 10px; min-width: 0; min-height: 22px; margin-top: 2px; }
.a-meta { display: flex; align-items: center; gap: 6px; min-width: 0; overflow: hidden; font-size: 12px; color: var(--label-2); white-space: nowrap; }
.a-meta .avatar { width: 18px; height: 18px; font-size: 7.5px; box-shadow: 0 0 0 1.5px var(--surface); }
.a-sep { color: var(--label-4); }
.a-actions { flex: none; margin-left: auto; display: inline-flex; align-items: center; gap: 6px; }
.a-hover { position: absolute; right: -4px; top: 50%; display: inline-flex; align-items: center; gap: 6px; padding: 2px 4px 2px 28px; background: linear-gradient(90deg, transparent, var(--card-bg, var(--surface)) 26px); transform: translateY(-50%); opacity: 0; pointer-events: none; transition: opacity 150ms ease; }
.a-card.is-selected .a-hover { opacity: 1; pointer-events: auto; }
.a-card.is-next { padding: 13px 16px 14px 23px; box-shadow: var(--shadow-card-hover); }
.a-card.is-next::before { left: 10px; top: 14px; bottom: 14px; }
.a-card.is-next .a-title { font: 600 15px/1.3 var(--font); letter-spacing: -0.01em; }
.a-card.is-next .a-meta-row { margin-top: 11px; }
.a-eyebrow { display: flex; align-items: center; gap: 6px; margin-bottom: 3px; font-size: 11px; font-weight: 600; color: var(--accent-strong); }
.a-eyebrow .a-sep { color: color-mix(in srgb, var(--accent) 45%, transparent); }
.a-purpose p { margin: 3px 0 0; font-size: 12.5px; line-height: 1.4; color: var(--label-2); }
.a-card.is-live { box-shadow: 0 0 0 1px color-mix(in srgb, var(--coral) 45%, transparent), var(--shadow-card-hover); }
.a-card.is-live .a-eyebrow, .a-card.is-starting .a-eyebrow { color: var(--coral-ink); }
.a-card.is-starting .a-mini-dot { animation: kit-rec 1.4s ease-in-out infinite; }
.a-mini-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--coral); flex: none; }
.a-wave { height: 11px; color: var(--coral); }
.a-wave i { width: 2px; }
.a-row.is-past .a-card { --card-bg: var(--content-bg); background: transparent; box-shadow: inset 0 0 0 0.5px var(--hairline); }
.a-row.is-past .a-title, .a-row.is-past .a-meta, .a-row.is-past .a-chip-slot { opacity: 0.55; }
.a-row.is-past .a-card::before { opacity: 0.45; }
.a-row.is-past .a-time b { color: var(--label-3); }
.a-suggest { display: flex; align-items: center; gap: 8px; margin-top: 10px; padding: 6px 6px 6px 9px; border-radius: 9px; background: var(--surface-sunken); font-size: 12px; color: var(--label-2); }
.a-suggest-text { flex: 1; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
@media (hover: hover) and (pointer: fine) { .card.interactive:hover { box-shadow: var(--shadow-card-hover); } .a-card:hover .a-hover { opacity: 1; pointer-events: auto; } }
@media not all and (hover: hover) { .a-hover { opacity: 1; pointer-events: auto; } }
@container agenda (max-width: 520px) { .a-people, .a-people + .a-sep, .a-meta .a-sep:has(+ .a-people) { display: none; } .a-card.is-next .a-purpose { display: none; } .a-banner-text span { display: none; } }
@container agenda (max-width: 400px) { .a-chip-slot .chip { padding: 0 7px; } .a-actions .kbd { display: none; } }
```

Chips (kit) and the agenda variants:

```css
.chip { display: inline-flex; align-items: center; gap: 4px; height: 20px; padding: 0 8px; border-radius: 999px; font-size: 11px; font-weight: 500; white-space: nowrap; background: var(--fill-2); color: var(--label-2); }
.chip.accent { background: var(--accent-soft); color: var(--accent-strong); }
.chip.amber { background: var(--amber-soft); color: var(--amber); }
.chip.dashed { background: transparent; outline: 1px dashed var(--label-4); outline-offset: -1px; }
.shimmer { background: linear-gradient(90deg, var(--fill) 0%, var(--fill-3) 50%, var(--fill) 100%); background-size: 200% 100%; animation: kit-shimmer 1.3s linear infinite; }
@keyframes kit-shimmer { from { background-position: 100% 0; } to { background-position: -100% 0; } }
.a-chip-prep { color: var(--label-2); }
.a-chip-filed .i { color: var(--label-3); }
.a-chip-once { gap: 5px; }
```

Banner, day groups, capsule:

```css
.a-banner { display: flex; align-items: center; gap: 12px; margin: 2px 0 18px; padding: 9px 8px 9px 10px; border-radius: 12px; background: var(--accent-softer); box-shadow: inset 0 0 0 0.5px var(--accent-soft); }
.a-banner-icon { width: 30px; height: 30px; flex: none; display: grid; place-items: center; border-radius: 50%; background: var(--accent-soft); color: var(--accent); }
.a-banner-text { flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 1.3; }
.a-banner-text b { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.a-banner-text span { font-size: 12px; color: var(--label-2); }
.collapsible { display: grid; grid-template-rows: 1fr; transition: grid-template-rows 260ms var(--ease-out), opacity 200ms ease; }
.collapsible > * { overflow: hidden; min-height: 0; }
.collapsible.collapsed { grid-template-rows: 0fr; opacity: 0; }
.a-list { display: flex; flex-direction: column; gap: 28px; padding-top: 6px; }
.a-day-head { display: flex; align-items: baseline; gap: 8px; margin: 0 0 10px calc(var(--a-time-w) + 14px); }
.a-day-head h2 { margin: 0; font: 600 15px/1.2 var(--font); letter-spacing: -0.008em; white-space: nowrap; }
.a-day-head span { min-width: 0; font-size: 12px; color: var(--label-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.a-rec-capsule { display: inline-flex; align-items: center; gap: 8px; height: 30px; max-width: 300px; padding: 0 4px 0 12px; border-radius: 999px; background: var(--coral-soft); color: var(--coral-ink); font-size: 12px; box-shadow: inset 0 0 0 0.5px color-mix(in srgb, var(--coral) 35%, transparent); }
.a-rec-capsule b { font-weight: 600; }
.a-rec-time { font-variant-numeric: tabular-nums; min-width: 30px; }
.a-rec-capsule .btn.a-rec-stop { height: 22px; padding: 0 9px 0 7px; gap: 4px; background: var(--coral); color: #fff; font-size: 11.5px; }
```

Pages: Review, Needs filing, Found, empty states (002 app.css + doc.css):

```css
.pg-filing .card-list { display: flex; flex-direction: column; margin: 0 0 0 calc(var(--a-time-w) + 14px); gap: 10px; }
.uf-card { padding: 16px 18px; }
.uf-top { display: flex; align-items: center; gap: 12px; }
.uf-ico { flex: none; width: 36px; height: 36px; display: grid; place-items: center; border-radius: 10px; background: var(--fill); color: var(--label-2); }
.uf-suggest { display: flex; align-items: center; gap: 9px; margin-top: 12px; padding: 9px 12px; border-radius: 10px; background: var(--accent-softer); font-size: 12.5px; line-height: 1.4; }
.uf-actions { display: flex; gap: 8px; margin-top: 14px; }
.pg { width: min(720px, 100%); margin: 0 auto; padding: 22px 0 40px; }
.pg-head p { margin: 6px 0 0; color: var(--label-2); }
.a-pcards { display: flex; flex-direction: column; gap: 10px; margin-top: 24px; }
.a-pcard { padding: 12px 14px 14px; }
.a-pcard-kind { display: flex; align-items: center; gap: 6px; margin-bottom: 9px; font-size: 11px; font-weight: 600; color: var(--accent-strong); }
.a-pcard-main { display: flex; align-items: center; gap: 10px; min-width: 0; }
.a-pcard-main .series-icon, .a-pcard-icon { width: 30px; height: 30px; }
.a-pcard-icon { flex: none; border-radius: 9px; display: grid; place-items: center; background: var(--fill-2); color: var(--label-2); }
.a-pcard-text b { font-size: 14px; font-weight: 600; }
.a-pcard-text span { font-size: 12px; color: var(--label-2); }
.a-pcard-reason { margin: 8px 0 0 40px; font-size: 12px; color: var(--label-3); }
.a-pcard-actions { display: flex; gap: 8px; margin: 12px 0 0 40px; }
.a-pcard.is-quiet { padding: 10px 12px; background: transparent; box-shadow: inset 0 0 0 0.5px var(--hairline); }
.a-pcard.is-quiet .a-pcard-icon { width: 26px; height: 26px; }
.a-pcard.is-quiet .a-pcard-text b { font-size: 13px; }
.a-pcard-inline { flex: none; display: flex; gap: 6px; margin-left: auto; }
.pg-foot { display: flex; align-items: center; justify-content: center; gap: 6px; margin: 28px 0 0; font-size: 11.5px; color: var(--label-3); }
.a-first { flex: 1; display: grid; place-items: center; padding-bottom: 48px; }
.a-empty-badge { width: 56px; height: 56px; border-radius: 16px; display: grid; place-items: center; background: var(--accent-soft); color: var(--accent); }
.a-caught { padding: 28px 12px 22px; }
.a-caught .a-empty-badge { width: 52px; height: 52px; }
```

New series popover, search, fly chip:

```css
.popover { position: absolute; z-index: 150; min-width: 220px; padding: 6px; border-radius: 14px; background: var(--glass-strong); backdrop-filter: blur(26px) saturate(1.8); box-shadow: var(--shadow-float); opacity: 0; transform: scale(0.96); transform-origin: var(--origin, top center); transition: opacity 150ms var(--ease-out), transform 190ms var(--ease-out); }
.popover.open { opacity: 1; transform: none; }
.popover.closing { transition-duration: 110ms, 110ms; }
.popover.a-newpop { padding: 12px; }
.a-new-head { display: flex; align-items: center; padding: 0 2px 10px; }
.field.lg { height: 36px; font-size: 15px; padding: 0 12px; border-radius: 10px; }
.a-new-preview { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.a-pchip { display: inline-flex; align-items: center; gap: 5px; max-width: 100%; height: 24px; padding: 0 9px; border-radius: 999px; background: var(--accent-soft); color: var(--accent-strong); font-size: 12px; transition: background-color 180ms ease, color 180ms ease; }
.a-pchip small { font-size: 10.5px; font-weight: 500; opacity: 0.72; }
.a-pchip b { font-weight: 600; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.a-pchip.is-empty { background: var(--fill); color: var(--label-3); }
.a-new-linked { display: flex; align-items: center; gap: 6px; margin-top: 10px; padding: 4px 4px 4px 10px; border-radius: 9px; background: var(--fill); font-size: 12px; color: var(--label-2); }
.a-new-foot { display: flex; align-items: center; margin-top: 12px; padding-top: 10px; box-shadow: inset 0 0.5px 0 var(--separator); }
.a-new-foot .btn.plain { margin-left: -8px; color: var(--accent); }
.a-new-note { display: flex; align-items: center; gap: 6px; margin: 8px 2px 0; font-size: 11px; color: var(--label-3); }
.a-search { padding: 4px; }
.a-search .search .field { height: 32px; }
.a-search-results { max-height: 320px; margin-top: 6px; overflow: auto; }
.a-search-hint { padding: 8px 10px 4px; font-size: 11px; font-weight: 600; color: var(--label-3); }
.row.a-hit { gap: 8px; min-height: 32px; font-size: 13px; }
.a-hit-meta { max-width: 40%; font-size: 11px; }
.a-search-empty { padding: 18px 10px; text-align: center; font-size: 12px; color: var(--label-3); }
.fly-chip { display: inline-flex; align-items: center; gap: 8px; height: 30px; padding: 0 12px 0 9px; font-size: 12px; font-weight: 600; white-space: nowrap; color: var(--label); }
.fly-chip > .i { width: 14px; height: 14px; color: var(--accent); }
```

## HTML Structures

`<svg class="i" data-icon="…">` stands for the kit icon of that name (lucide names in component-inventory.md › Iconography).

Today (app-agenda.js `dayMarkup` / `timelineMarkup` / `rowMarkup` / `cardMarkup`):

```html
<div class="agenda-inner">
  <div class="a-banner-wrap collapsible" id="banner"><div><div class="a-banner">
    <span class="a-banner-icon"><svg class="i" data-icon="sparkles"></svg></span>
    <div class="a-banner-text"><b>Telu found 2 new recurring meetings in your calendar</b><span class="truncate">Growth Review · Daily Standup</span></div>
    <button class="btn sm tinted" data-act="open-found">Review</button>
    <button class="btn sm plain icon" data-act="hide-banner" data-tip="Hide"><svg class="i" data-icon="x"></svg></button>
  </div></div></div>
  <div class="a-timeline" data-day="tue">
    <div class="a-row is-past" data-row="t1">…Daily Standup…</div>
    <div class="a-now"><span class="a-now-time num">9:41</span><span class="a-now-line"></span></div>
    <div class="a-row" data-row="t2">
      <div class="a-time"><b class="num">10:00</b><span class="num">10:45</span></div>
      <article class="a-card card interactive k-ready is-tracked is-next is-selected" data-id="t2" data-act="select" style="--c:var(--series-blue)">
        <div class="a-part a-eyebrow" data-part="eyebrow"><span class="a-next-label">Next up</span><span class="a-sep">·</span><span class="num">in 19 min</span></div>
        <div class="a-card-top"><span class="a-title truncate">Product Sync</span><span class="a-part a-chip-slot" data-part="chip"><span class="chip accent">Brief ready</span></span></div>
        <div class="a-part a-purpose" data-part="purpose"><p class="truncate">Keep product, design and engineering pointed at the same three priorities…</p></div>
        <div class="a-meta-row">
          <span class="a-part a-meta" data-part="meta"><span class="a-where"><svg class="i" data-icon="video"></svg>Google Meet</span><span class="a-sep">·</span><span class="a-people"><span class="avatars">…</span></span><span class="a-sep">·</span><span class="num">#37</span></span>
          <span class="a-part a-actions" data-part="actions">
            <button class="btn sm" data-act="join" data-id="t2"><svg class="i" data-icon="video"></svg>Join</button>
            <button class="btn record sm" data-act="record" data-id="t2"><svg class="i" data-icon="record"></svg>Record<span class="kbd">⌘R</span></button>
          </span>
        </div>
        <div class="a-part a-extra" data-part="extra"></div>
      </article>
    </div>
    <div class="a-gap"><span>1 h 15 min free</span></div>
    <div class="a-row is-personal" data-row="t3"><div class="a-time">…</div><div class="a-personal" data-personal="t3"><svg class="i" data-icon="lock"></svg><span>Personal · Busy</span></div></div>
  </div>
</div>
```

Hover actions and the suggestion row sit in the same slots: `<span class="a-hover"><button class="btn sm tinted" data-act="add-to-series">Add to series…</button><button class="btn sm" data-act="record-once"><svg class="i" data-icon="record"></svg>Record once</button></span>` and `<div class="a-suggest"><span class="series-icon a-xs">…</span><span class="a-suggest-text">Looks like <b>Acme · Implementation</b> — mentions “Dana”, …</span><button class="btn sm tinted" data-act="file">File</button></div>`. The recording eyebrow is `<span class="rec-dot"></span><span class="a-live-label">Recording</span><span class="num a-live-time" data-rec-timer>12:04</span><span class="wave a-wave"><i></i><i></i><i></i><i></i><i></i></span>`.

Upcoming, Review and Found (app-pages.js):

```html
<div class="a-list">
  <section class="a-day"><div class="a-day-head"><h2>Tomorrow</h2><span>Wednesday, 30 September</span></div><div class="a-timeline">rows</div></section>
</div>

<div class="a-list pg-review">
  <section class="a-day"><div class="a-day-head"><h2>To review</h2><span>3 items · accept, correct or reject what Telu found</span></div><div class="a-timeline">rows with .a-time-day labels</div></section>
  <section class="a-day pg-filing"><div class="a-day-head"><h2>Needs filing</h2><span>Recordings and files Telu couldn’t place with confidence</span></div>
    <div class="card-list" id="ufList">
      <div class="card interactive uf-card" data-uid="u-rec" data-act="select-unfiled">
        <div class="uf-top"><span class="uf-ico"><svg class="i" data-icon="waveform"></svg></span>
          <div class="uf-main"><div class="t-title3">Untitled recording</div><div class="muted num">Mon 28 Sep · 16:40 · 8 min</div></div>
          <button class="btn sm icon plain" data-act="play" data-tip="Play"><svg class="i" data-icon="play"></svg></button></div>
        <div class="uf-suggest"><span class="series-icon">…</span><span>Telu thinks this belongs in <b>Acme · Implementation</b> — mentions “Dana”, “SSO” and “audit logs”</span></div>
        <div class="uf-actions"><button class="btn sm primary" data-act="file-there"><svg class="i" data-icon="tray-down"></svg>File there</button><button class="btn sm" data-act="file-choose">Choose…</button></div>
      </div>
    </div>
  </section>
</div>

<div class="pg">
  <header class="pg-head"><h1 class="t-large">Found in Calendar</h1><p>Telu noticed these patterns in your calendar. Decide once — it won’t ask again.</p></header>
  <div class="a-pcards" id="pcards">
    <article class="a-pcard card" data-proposal="pr-growth">
      <div class="a-pcard-kind"><svg class="i" data-icon="sparkles"></svg>New recurring meeting</div>
      <div class="a-pcard-main"><span class="a-pcard-icon"><svg class="i" data-icon="repeat"></svg></span><div class="a-pcard-text"><b>Growth Review</b><span>Every Thu · 11:00–11:45 · Work</span></div><span class="spacer"></span><span class="avatars">…</span><span class="a-more">+2</span></div>
      <p class="a-pcard-reason">New recurring event · created by Priya Nair yesterday</p>
      <div class="a-pcard-actions"><button class="btn sm primary" data-act="prop-track">Track as series</button><button class="btn sm" data-act="prop-dismiss">Not a series</button></div>
    </article>
    <article class="a-pcard card" data-proposal="pr-acme-sso">
      <div class="a-pcard-kind"><svg class="i" data-icon="link"></svg>Looks like part of Acme · Implementation</div>
      <div class="a-pcard-main"><span class="series-icon">…</span><div class="a-pcard-text"><b>Acme · SSO deep-dive</b><span>Wed 30 Sep · 13:00</span></div></div>
      <p class="a-pcard-reason">Same 3 attendees as Acme · Implementation</p>
      <div class="a-pcard-actions"><button class="btn sm primary" data-act="prop-join">Add to Acme · Implementation</button><button class="btn sm" data-act="prop-separate">Keep separate</button></div>
    </article>
    <div class="t-eyebrow a-pcards-sub">Less likely</div>
    <article class="a-pcard card is-quiet" data-proposal="pr-standup"><div class="a-pcard-main"><span class="a-pcard-icon"><svg class="i" data-icon="repeat"></svg></span>
      <div class="a-pcard-text"><b>Daily Standup</b><span>You skipped it 3 times · short daily check-in</span></div>
      <div class="a-pcard-inline"><button class="btn sm" data-act="prop-track">Track anyway</button><button class="btn sm plain" data-act="prop-dismiss">Stop suggesting</button></div></div></article>
  </div>
  <p class="pg-foot"><svg class="i sm" data-icon="lock"></svg>Your calendar is read on this Mac. Nothing is uploaded.</p>
</div>
```

New series popover (app-flows.js `newMarkup`), search popover and the capsule:

```html
<div class="popover a-newpop" role="dialog" style="width:380px"><div class="a-newser">
  <div class="a-new-head"><b>New series</b><span class="spacer"></span><span class="kbd">⌥⌘N</span></div>
  <input class="field lg a-new-field" placeholder="Describe it — e.g. Weekly 1:1 with Priya, Thu 11am" spellcheck="false">
  <div class="a-new-preview" id="newPreview">
    <span class="a-pchip is-empty" data-k="title"><small>Title</small><b>—</b></span>
    <span class="a-pchip is-empty" data-k="cadence"><small>Repeats</small><b>—</b></span>
    <span class="a-pchip is-empty" data-k="day"><small>Day</small><b>—</b></span>
    <span class="a-pchip is-empty" data-k="time"><small>Time</small><b>—</b></span>
    <span class="a-pchip is-empty" data-k="people"><small>With</small><b>—</b></span>
  </div>
  <div class="collapsible collapsed" id="newLinkWrap"><div><div class="a-new-linked" id="newLinked"><svg class="i" data-icon="link"></svg><span class="truncate">Linked to <b>Daily Standup</b> · Work calendar</span><button class="btn sm plain icon" data-new="unlink" data-tip="Unlink"><svg class="i" data-icon="x"></svg></button></div></div></div>
  <div class="a-new-foot"><button class="btn sm plain" data-new="link"><svg class="i" data-icon="link"></svg>or link a calendar event…</button><span class="spacer"></span><button class="btn sm primary" data-new="create" disabled>Create<span class="kbd">↩</span></button></div>
  <p class="a-new-note"><svg class="i sm" data-icon="doc"></svg>Opens its living doc — purpose, memory and meetings in one place</p>
</div></div>

<div class="popover" role="dialog" style="width:400px"><div class="a-search">
  <div class="search"><svg class="i" data-icon="search"></svg><input class="field" placeholder="Search series, people, decisions" spellcheck="false"></div>
  <div class="a-search-results"><div class="a-search-hint">Series</div>
    <div class="row hoverable a-hit" data-hit data-series="product-sync"><span class="series-icon">…</span><span class="truncate">Product Sync</span><span class="spacer"></span><span class="faint truncate">Every Tue</span></div>
    <div class="a-search-hint">In memory</div>
    <div class="row hoverable a-hit" data-hit data-series="acme"><span class="ktype" data-type="decision">…</span><span class="truncate">…</span><span class="spacer"></span><span class="faint truncate a-hit-meta">Acme · Implementation</span></div>
  </div>
</div></div>

<div class="a-rec-capsule" id="recCapsule"><span class="rec-dot"></span><b class="truncate">Product Sync</b><span class="num a-rec-time" data-rec-timer>12:04</span><button class="btn sm a-rec-stop" data-act="stop"><svg class="i" data-icon="stop"></svg>Stop</button></div>
```

## Behavior & State

### Kind, next up and time rules

- `kindOf(event)`: `personal` for events whose state is `personal` (Personal-calendar events); `recording` if it is the recording event; `summarizing` if its meeting is being summarized; unfiled events → `filed` when `filedTo` is set, else `unfiled`; a tracked series → `review` (pending candidates) > `filed` (meeting done, review or cancelled) > `preparing` > `ready`, or `tracking` when the event has no meeting yet; a live proposal → `proposal`; otherwise `recurring` if it has a `repeat`, else `oneoff`.
- Next up (`nextUpId`): the recording event if one records today; else the first event today whose start is ≥ now − 1 min and whose kind is ready, preparing or tracking. Only one card per day is `is-next`.
- Countdown on the next card: "in 19 min", "in 4 h 19 min", or "now". Past = the day is before today, or today and the end ≤ now.
- Starting: `starting` holds the meeting id from start time until Record or Skip. Only the next card shows it.

### Card actions and their results

| Action | Where | Result | Feedback | Undo |
|---|---|---|---|---|
| Select | click a card or unfiled card; ↑/↓ | ring moves; click opens the peek, keys update it only if open | — | — |
| Join | next / recording card (virtual where only) | opens the call (002: toast "Opening Google Meet…") | toast | — |
| Record / Stop ⌘R | next card, Starting card, peek, context menu | see the shell's recording state | morph + FLIP + capsule | — |
| Skip | Starting card | `starting = null` | "Won’t record Product Sync this time" | yes |
| Track | untracked recurring (hover), peek "Track this series" | Daily Standup → its standup series with a drafted purpose; a known untracked series → re-tracked; anything else → New series prefilled with the title and linked to the event | row grows in, series pill flies; "Telu will prepare briefs for …" | yes |
| Add to series… | one-off (hover), peek, context menu | SeriesPickerMenu ("Add to series", tracked series with swatches, —, "New series…") → the event becomes an upcoming meeting of that series | card morphs; pill flies; "Added Coffee with Alex Kim to …" | yes |
| Record once | one-off (hover); recurring or one-off in the peek | `recordOnce[id] = true` → chip "Records at 17:00"; the peek button becomes "Don’t record" | "Telu will record … once, at 17:00" / "Won’t record …" | yes |
| Add / Keep separate | proposal card, peek, Found | joins the target series as a meeting / proposal dropped, stays a one-off | link chip flies; "… now files into …" / "Kept separate — … stays a one-off" | yes |
| File, File there, Choose… | card suggestion row, Review › Needs filing, peek | recording → a meeting of the series (inserted by date); document → the series' docs | waveform/doc chip flies; card collapses on Review; "Filed to …" | yes (restores the snapshot) |
| Review | ended card (hover), Review rows | selects it; the peek opens on its review | — | — |
| Stop tracking… | context menu → Alert | series untracked, sidebar row removed, memory and past meetings kept | "Stopped tracking …" | yes |
| Hide banner | × on the banner | `bannerHidden = true` | "Hidden — they’re waiting in Found in Calendar" | — |

### Proposals and the banner

- Proposal kinds: `new` (a recurring event not yet tracked: title, rule, calendar, people, extra, reason, first date), `join` (an event that looks like part of a tracked series: when, target, reason), and `quiet` (a low-confidence `new`, listed under "Less likely").
- Track as series drafts the series from the invite (purpose v1 "Drafted from the calendar invite", colour, icon, group, first meeting), grows its sidebar row and flies the pill in: "Created a living doc for Growth Review" (Undo). Not a series: "Okay — Growth Review stays a regular event". Track anyway on the quiet Daily Standup tracks it. Stop suggesting: "Telu will stop suggesting Daily Standup". Add to …: the event becomes a meeting of the target and its agenda chip "Part of … ?" becomes that series' ready chip ("Brief tonight" for tomorrow's Acme · SSO deep-dive). Decided cards collapse; at zero, CaughtUp fades in ("You’re all caught up" / "Telu will mention it when something new starts repeating.").
- The banner shows on Today only, with a connected calendar, outside first run, when there are `new` proposals and it is not hidden: "Telu found a new recurring meeting in your calendar" or "Telu found N new recurring meetings in your calendar", plus the titles joined by " · ". Review opens Found; the count crossfades as proposals are decided, and the banner collapses at zero.
- Onboarding's "choose what to remember" list (component-inventory.md › DetectedRow) is the first-run form of detection; afterwards everything arrives as proposals.

### New series and the parser

Opened from the toolbar New (aligned to its end), the sidebar Series + (start), File › New Series… / ⌥⌘N (the toolbar New, the doc toolbar group, or the sidebar +), Track on an unmatched event, and "New series…" in Add to series. The input autofocuses; typing refreshes the chips after 90ms; Enter or Create commits.

`parseSeries(text)` rules (kit mac-kit.js):
- **1:1**: "1:1", "1-1" or "one on one" → title "1:1 · {first name of the first person}".
- **People**: the text after "with " up to the first stop word (every, on, at, weekly, monthly, daily, biweekly, tomorrow, today, next, first, a weekday) or digit, split on "," / "and" / "&", title-cased.
- **Cadence**: every other / biweekly / fortnightly / every 2 (two) weeks → "Every 2 weeks"; monthly / every month / first {weekday} → "Monthly"; daily / every day / weekdays → "Daily"; weekly / every week / every {weekday} → "Weekly"; a weekday alone → "Weekly"; otherwise "One-off".
- **Day**: the first weekday name or abbreviation (mon, tue(s), wed, thu(r/rs), fri, sat, sun) → "Mon"…"Sun".
- **Time**: the cadence phrase "every 2/two weeks" is blanked first so its digit is never read as a time; then a time is accepted only with minutes ("9:30"), am/pm ("11am"), after "at" ("at 11") or after a weekday ("thu 11"); bare hours 1–7 become PM; output "HH:MM".
- **Title**: what is left after removing cadence, day, time and filler words (on, at, the, a, an, punctuation), title-cased; one word plus a person → "{Word} with {Person}"; nothing left → "Meeting with {Person}".

| Input | Title | Repeats | Day | Time | With |
|---|---|---|---|---|---|
| Weekly 1:1 with Priya, Thu 11am | 1:1 · Priya | Weekly | Thu | 11:00 | Priya |
| Growth review every Thursday at 11 | Growth Review | Weekly | Thu | 11:00 | — |
| Design crit every other Wednesday 3pm | Design Crit | Every 2 weeks | Wed | 15:00 | — |
| Budget review first monday | Budget Review | Monthly | Mon | — | — |
| Standup weekdays at 9 | Standup | Daily | — | 09:00 | — |
| Sync with Jon and Leo on Fri at 4 | Sync with Jon | Weekly | Fri | 16:00 | Jon, Leo |
| Coffee with Alex | Coffee with Alex | One-off | — | — | Alex |
| with Dana | Meeting with Dana | One-off | — | — | Dana |
| Retro every 2 weeks fri 16:30 | Retro | Every 2 weeks | Fri | 16:30 | — |

Fixed during wrap-up (2026-09-27): "Retro every 2 weeks fri 16:30" used to return 14:00 because the "2" in "every 2 weeks" was read as the hour. The kit now blanks the cadence phrase before matching the time (`timeText` in `parseSeries`); keep that step when porting.

Applying a parse to a new series (`applyParsed`): people are matched by prefix to known people ("Priya" → Priya Nair); Daily becomes Weekly on Weekdays; a 1:1 gets the person icon and the 1:1s group; two or more people get the people icon; the colour comes from the first person when that person is known; with a day and a time the rule reads "Every Thu · 11:00–11:30" (30 minutes by default; "Every other Thu", "First Thu" and "Every weekday" for the other cadences) and an upcoming meeting is created on the next matching date. The title keeps the parsed first name. The toast reads "Created 1:1 · Priya — first brief the evening before Thu 1 Oct", or "Created … — add a purpose to shape its first brief" when there is no upcoming meeting. Create flies the preview row into the new sidebar row (hidden with `.landing` until it lands), then opens the doc with the purpose focused.

Link a calendar event: "or link a calendar event…" opens a menu titled "Not tracked yet" listing untracked recurring or one-off events from today on, deduplicated by title (icon repeat/calendar, hint "Daily" or "Today 17:00"); with none: "Every calendar event is tracked" (disabled). Picking one fills the input with its title, shows "Linked to **Daily Standup** · Work calendar" with ×, and fills the chips from the event (repeat, day, start, people). Creating a linked series binds every untracked event with that title; linking Daily Standup takes the standup tracking path. 002 limits linkable events to a two-item fixture (`T.LINKABLE`); production lists the real untracked events.

### Review and filing

- To review lists every loaded day's events of kind review with a day label; the subtitle counts pending items ("3 items · accept, correct or reject what Telu found"). The review itself happens in the peek or the living doc. When a meeting has no pending items left: a 500ms beat, the row collapses, and the page re-renders once no rows remain.
- Needs filing lists unfiled items. The suggestion appears only when the suggested series is tracked; without one, only Choose… (SeriesPickerMenu titled "File to"). Recordings offer Play. Filing removes the item, adds the meeting (or doc) to the series, morphs matching agenda cards to "✓ Filed" and updates counts.
- Empty: "All caught up" / "Everything Telu found has been reviewed and filed." (check-circle badge).

### Search

With no query it shows the first six tracked series under "Series" (meta: the first part of the rule, e.g. "Every Tue", or "Manual"). A query matches series by name or person and memory items by text (at most five, under "In memory", with the knowledge-type glyph and the series name). Empty result: “No matches for “…””; nothing tracked: "Connect your calendar or add a series to search it". Enter opens the first hit; a click opens that series' living doc. 002 has no ↑/↓ in results; cmdk provides it.

### Data shapes

```ts
type EventState = 'untracked' | 'ready' | 'preparing' | 'review' | 'unfiled' | 'personal' | 'proposal'
interface CalendarEvent {
  id: string
  start: string
  end: string
  title: string
  calendar: string | null
  repeat?: string
  where?: string
  people?: string[]
  series?: string
  meeting?: string
  state: EventState
  proposal?: string
  unfiled?: string
  filedTo?: string
}
interface Day { key: string; label: string; date: string; long: string; events: CalendarEvent[] }
interface Proposal { id: string; kind: 'new' | 'join'; title: string; rule?: string; calendar?: string; people?: string[]; extra?: number; reason: string; first?: string; when?: string; target?: string; quiet?: boolean }
interface UnfiledItem { id: string; kind: 'recording' | 'doc'; title: string; when: string; duration?: string; suggestion?: { series: string; why: string } }
interface Meeting { id: string; n: number | null; date: string; time: string; status: 'upcoming' | 'preparing' | 'review' | 'done' | 'cancelled'; where?: string | null; title?: string; duration?: string; ended?: string; brief?: object | null; candidates?: object[] }
interface Series { id: string; name: string; color: string; icon: string; group: string; cadence: string; rule: string; source: 'calendar' | 'manual'; people: string[]; purpose: object; memory: object[]; docs: object[]; meetings: Meeting[]; tracked: boolean }
```

In 002 the day view loads Yesterday, Today and Tomorrow. Upcoming shows Tomorrow (every event) and then later days (Thursday, Friday) with tracked meetings only; empty days are hidden, rows carry no day label and there is no now line.

### Calendar source (EventKit)

From 001's implementation notes: read EventKit through `objc2-event-kit` with `NSCalendarsFullAccessUsageDescription` in Info.plist (neither exists in `frontend/` yet). Map each EKEvent occurrence to a CalendarEvent: identity = event identifier + occurrence start (occurrences of a recurring event share one identifier); `startDate`/`endDate` → `start`/`end` in local time and the day group; `title`; the calendar's title → `calendar` and its colour → the SidebarCalendarRow check; location or URL → `where`; attendees → `people`. A recurrence rule becomes the `repeat` label (daily → "Daily", weekly → "Weekly", weekly every 2 → "Every 2 weeks", monthly → "Monthly", weekdays → "Every weekday · 09:00–09:15" in rule text) and, when no tracked series owns it, a `new` proposal. **It never makes the event a member of a series on its own.** Attendee overlap with a tracked series yields a `join` proposal ("Same 3 attendees as …"). Unwatched calendars appear only as busy blocks. Everything is read on this Mac (the Found footnote and the calendar toggle toasts say so).

### Accessibility

- Timeline `role="listbox"` labelled with the long date; cards `role="option"` with `aria-selected` and a roving tabindex (002 cards are clickable articles, not focusable); inner actions are real buttons; hover-only actions also appear on `:focus-within`; Record carries `aria-keyshortcuts="Meta+R"`.
- The now line is `aria-hidden` with a visually hidden "Now 9:41"; the free-gap text is plain and its rule `aria-hidden`; a busy block reads "Personal, busy, 12:00 to 12:45".
- The banner is `role="status"`; × needs `aria-label="Hide"`; the collapsed wrapper is `inert`. DayStepper is `role="group"` `aria-label="Day"` with "Previous day" / "Next day" labels; the DayHeader title is the page h1 and announces changes politely.
- RecordingCapsule `role="status"` with "Recording Product Sync, 12 minutes" (update the label per minute; the timer text is `aria-hidden`).
- New series is `role="dialog"` "New series"; the chips form a polite live summary ("Weekly, Thursday 11:00, with Priya"); Create is disabled until a title parses. Menus are `role="menu"`; UnfiledCard and ProposalCard are articles labelled by their titles; Play needs `aria-label`; CaughtUp is `role="status"`; search follows cmdk's combobox/listbox pattern.

### Known gaps

- Reduced motion does not gate the starting mini dot, the receive flash, the spinner or the progress hairline in 002.
- Icon-only buttons (banner ×, Play, stepper chevrons) lack `aria-label`s.
- FLIP measures before the slot crossfade, so a card that shrinks after 110ms makes the rows jump the last few pixels; use layout animation on the card and rows together.
- The linkable-events fixture; the fake 2.6s "preparing → ready"; Join only toasts.
- Not in 002, do not invent: a paused capsule, pending counts on sidebar series rows, any sheet.

## What to Avoid

- **A's permanent inspector column** (001 A, 380px beside the agenda at all times). The side peek opens only when asked and renders the meeting with the living doc's components (002 README), so the timeline keeps its width.
- **A's purpose sheet** (001 A: a 640px sheet "… · Purpose" with Why we meet, What good looks like, Standing agenda, Not for this meeting, and Done). The purpose is edited only in the living doc; ⌘E and "Edit purpose…" open the doc with the purpose focused, and the brief everywhere is built from it.
- **A's detect sheet after connecting** ("Telu found N recurring meetings" with switches and "Track N series"). Replaced by C's onboarding picks, then the banner and Found in Calendar; 002 opens no sheet.
- **B's Up Next list and Suggestions / Unfiled smart views.** Today's agenda, Found in Calendar and Review › Needs filing cover them in the four-tab model.
- **Auto-joining events to series on Telu's own initiative** (recurrence rules, similar titles, attendee overlap). Telu proposes; binding happens only when you track, add, link or file, and each of those offers Undo.
- **Silent filing.** Always show the guess, the reason and a way to choose another series.
- **Animating the now line, staggering every render, or sliding the day on ←/→.** The line is placed, the stagger is only for a whole day arriving, and keys are instant.
- **Height jumps when a card changes state.** Crossfade only the changed slots and animate layout.
- **Hover-only affordances** with no selection, focus or touch path; **Record once on past events** (002 removes it).
- **Colour drift**: mint anywhere in the agenda (it means "worth asking" on the Island and in the doc), coral beyond live / starting / now / Record and genuine attention, amber for anything but "needs you".
- **`transition: all`, `scale(0)`, springs on menus, popovers or chips.** Popovers start at 0.96 from the trigger; menus open instantly.

## Origin

Synthesized from sketches: 001, 002, 003 (001 for the not-adopted inspector column, purpose sheet and detect sheet; 002 as the source of truth; 003 for component specs, stories and animation entries).

Source files available in:
- `sources/002-final-app/`: app-agenda.js, app-pages.js, app-flows.js, app-actions.js, app-data.js, app-model.js (`kindOf`, `nextUpId`, countdowns), app-peek.js (peek bodies for untracked, proposal and unfiled), app-shell.js (`recCapsule`, `titleFor`, `stepDay`), app-record.js (record targets), doc-edit.js (Join), app.css, doc.css (`.uf-*`, `.fly-chip`, `.card-list`)
- `sources/003-component-catalog/`: sec-calendar.js, sec-calendar-2.js, sec-pages.js, sec-motion.js (day stepper, stagger, card morph, FLIP, now line, capsule, parsed chips), sec-motion-2.js (collapsible, list, receive, fly to sidebar, recording loops, shimmer), COMPONENTS.md, README.md (gaps)
- `sources/kit/`: mac-kit.js (`parseSeries`, `flyTo`, `removeAnimated`, `enterAnimated`, `stagger`, `popover`, `menu`, `timer`), mac-kit.css (chips, cards, collapsible, keyframes), data.js (days, proposals, unfiled, calendars, series)
- `sources/themes/`: default.css, dark.css
- `sources/001-app-mental-model/`: README.md only. The rejected pieces live outside the skill in `.planning/sketches/001-app-mental-model/`: a-today-flows.js (purpose sheet, detect sheet), a-today-inspector.js and a-today.css (inspector column), b-living-doc-views.js (Up Next, Suggestions, Unfiled).
- Live: http://localhost:4318/002-final-app/ and http://localhost:4318/003-component-catalog/ (Calendar and Pages sections).
