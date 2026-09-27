# App Shell & Navigation

The frame around every Telu screen: the desktop composition (menu bar, status item, window, the Island's lane), the window chrome, the sidebar, both toolbars, the view model and back stack, the single app state with its five scenario states, the shared recording state, and the keyboard map. What renders inside the content column (agenda, pages, search, new series) is in [calendar-and-agenda.md](calendar-and-agenda.md). Full props and states for every component named here are in [component-inventory.md](component-inventory.md).

## Design Decisions

1. **Telu is a menu-bar companion with a window you summon.** The status item and the Island are always present; the main window comes and goes. The red light, ⌘W, File › Close Window and Telu › Hide Telu only hide it (002 also wires the yellow light to hide). ⌥Space (and ⌘0), a click on the status item, Window › Telu, and any Island action that opens a meeting bring it back (`T.summon`: show + focus; before setup it opens onboarding instead). Chosen over 001 C's ⌘K command window and menu-bar dropdown panel: one app, one window, one place to look.

2. **Desktop composition** (002 index.html, app.css, island.css), bottom to top:

   | Layer | Geometry | z-index |
   |---|---|---|
   | Wallpaper | `--wallpaper` (three radial gradients over a linear base) | — |
   | Window `.window.t-app` | `inset: calc(var(--menubar-h) + 56px) 132px 60px 24px` = 82 / 132 / 60 / 24px, `margin: auto`, max 1400×900 | auto (isolated) |
   | Desktop file icon `.il-file` | top 40px, right 12px, 108px wide; the window's 132px right inset keeps this column free | 2 |
   | Onboarding panel `.onboard` | top 92px, centred, 420×530, radius 22 | 40 |
   | Island `.island` | fixed, top 36px (`--menubar-h` + 10), centred, 300×36 pill, radius 18 | 260 |
   | Menu bar `.menubar` | 26px (`--menubar-h`), full width | 300 |
   | Notification stack | top 36px, right 12px, 348px wide | 350 |
   | Alert · tooltip · flyer | — | 400 · 1000 · 5000 |

   The 56px band above the window is the Island's lane (pill 36→72px, window starts at 82px). Zoom (green light) toggles `.zoomed`: `inset: 82px 12px 12px 12px`, no max size. Inside the window: traffic lights z 20, scrubber 25, toolbar 30, peek 35, drawer 40, popover 150, menu 160, scrim/sheet 180/181, toast stack 200.

3. **Window frame.** Radius 16 (`--r-window`). The whole window is sidebar material: `background: var(--sidebar)` (light `rgba(234,234,230,.6)`, dark `rgba(34,35,42,.62)`) with `backdrop-filter: blur(40px) saturate(1.7)` and `--shadow-window`. The content column paints opaque `--content-bg` and separates itself with a 0.5px `--hairline` shadow on its left edge. `--sidebar-w: 244px` (overrides the kit's 236), `--peek-w: max(440px, 44%)`. Traffic lights: 12px circles `#FF5F57 / #FEBC2E / #28C840` with a 0.5px inner ring, 8px apart, at top 20 / left 20, so their centre line (26px) is the vertical centre of the 52px toolbar band. Glyphs appear on hover of the whole group, with no transition.

4. **The sidebar is flat and quiet.** Order: the four destinations (Today `sun`, Upcoming `calendar`, Review `tray`, Found in Calendar `sparkles`), then "Series" with a hover-only +, the tracked series, "Calendars", and the footer "On this Mac · processed locally" with a lock. Rows are 28px high, radius 8, 13px text, 8px icon gap. Icons are `--accent`; counts are 12px `--label-3` tabular numbers; the selected row gets `--fill-2`. **There is no hover highlight** (macOS source-list behaviour), only a press scale. Visibility: Found in Calendar and Calendars need a connected calendar, Series needs at least one tracked series, counts hide at 0, and Upcoming never shows a count. Counts: Today = today's events that belong to a tracked series; Review = pending review items across tracked series + unfiled items; Found = open proposals. Before · 9:41 reads Today 3 · Review 5 · Found 3; After · 10:46 reads Review 10.

5. **Series rows say when, not how much.** Each row has the series icon (18px circle in the series colour, 10px white glyph), the name (truncates; a draft shows "Untitled"), and a hint: the start time if the next meeting is today ("10:00"), the weekday if it is 1–6 days out ("Thu"), otherwise a date ("6 Oct"). While that series records, a 7px pulsing coral dot replaces the hint. Series rows carry no pending counts; review is counted on the Review row. Rows are in creation order, and new series append at the end.

6. **Calendars are toggles, not settings.** Each calendar row has a 14px square check (radius 4) in the calendar's own colour: a 1.3px ring when off, filled with a 9px tick when on. An unwatched calendar shows its name in `--label-2` with an 11px `--label-3` "Not watched" caption. Toggling it toasts "Watching Work · Google — read on this Mac only" / "Stopped watching …" and re-labels Personal busy blocks in the agenda.

7. **One 52px toolbar strip, two modes.** It is transparent at rest. When content scrolls more than 2px beneath it, it becomes glass: `color-mix(in srgb, var(--content-bg) 76%, transparent)` + `blur(18px) saturate(1.6)` + a 0.5px `--separator` line. Agenda mode: title and subtitle, the recording capsule slot, the day stepper `‹ Today ›`, then `+ New ⌥⌘N | search`. Doc mode: `‹ Today` back, a compact title, the save state, `History · Share | Record · ⋯`, then the Details toggle. Buttons sit in glass capsules (34px, 3px padding, `--glass-strong`). A 2px accent progress hairline sits on the bottom edge (dormant in 002). The whole strip is the window drag region.

8. **Titles say where you are and what is waiting.** Title / subtitle pairs: Today / "Tuesday, 29 September" (Yesterday and Tomorrow likewise); Upcoming / "Next few days"; Review / "5 items need a look" or "All caught up"; Found in Calendar / "3 suggestions · decide once" or "Nothing new". The title is 15px/600 and the subtitle 11px `--label-2`; both ellipsize.

9. **The status item speaks one short phrase** from the same state the Island reads: icon only · "Product Sync · 19m" · "Product Sync · now" · "● Recording 12:04" · "Filing…" · "5 to review" (precedence under Behavior & State). "1:1 · " is dropped from names; keep the phrase under ~24 characters. A click summons the window. There is no dropdown.

10. **Navigation is shallow.** Views: `day` (Yesterday, Today, Tomorrow), `upcoming`, `review`, `found`, and `doc` (a series' living doc). A doc remembers one origin (`from`): Back returns there with its scroll and peek restored, and opening another doc from a doc keeps the original origin. The peek is a quick look beside the agenda; the page is the living doc. There is no history stack and no tabs.

11. **Keyboard navigation is instant.** ↑/↓, ←/→, Enter, ⌘W and ⌥Space never animate. Commands that change state (⌘R, or ⌥⌘N then Enter) animate the resulting change exactly as the pointer path does (003 Motion principles, rule 1). See the 002 exceptions in Motion.

12. **One state, read everywhere.** A single immutable app state feeds every surface: sidebar, toolbar, cards, peek, doc, status item and Island. There is exactly one recording object, so the capsule, the doc Record button, the card eyebrow, the sidebar dot, the status item and the Island all show the same timer, derived from the same `startedAt`.

## Components

Full specs: component-inventory.md › Chrome (and › GlassGroup, › ProgressHairline, › Tooltip, › Toast, › FlyChip).

| Component | Role | Key variants/states | Maps to |
|---|---|---|---|
| AppShell | Window content root: sidebar + main column (toolbar, scroll content, peek, scrubber, drawer) | agenda, doc | Root client component: SidebarProvider + `<main>` + scroll container |
| WindowFrame | Material, radius, shadow, traffic lights; hides instead of closing | shown, hidden, zoomed, traffic rest/hover | Tauri window: `titleBarStyle: "Overlay"`, `hiddenTitle`, `trafficLightPosition`, transparent + sidebar vibrancy; CloseRequested → hide |
| MenuBar | App menus with accelerators | rest, menu open (title active), row active, disabled row | Native Tauri Menu API; not React |
| MenuBarStatusItem | Template glyph + one phrase; click summons | icon only, next, starting, recording, filing, to review | Tauri TrayIcon: `icon_as_template(true)`, `set_title()`, click → show + focus |
| Toolbar | 52px strip, scroll-edge glass, progress hairline, drag region | rest, scrolled, progress | `<header data-tauri-drag-region data-scrolled>` + scroll listener |
| AgendaToolbar | DayHeader, RecordingCapsule, DayStepper, New ⌥⌘N, Search | day, first/last day, no calendar, upcoming, review, found, recording, narrow ≤ 900px | Toolbar + GlassGroup + shadcn Button; `AnimatePresence` for the capsule |
| DocToolbar | Back, compact title, save state, History / Share / Record / ⋯, Details | with/without back, compact title shown, saving/saved, recording, drawer open | Toolbar + GlassGroup; `useInView` on the doc title |
| GlassGroup | Capsule holding toolbar buttons | — | div with glass tokens; ghost Buttons inside |
| Sidebar | Source list | first run, before, doc selected, recording, after | shadcn Sidebar over native vibrancy |
| SidebarNavItem | Today / Upcoming / Review / Found + count | rest, selected, pressed, drop over (Review), count bump | SidebarMenuButton + SidebarMenuBadge |
| SidebarSectionTitle | "Series" (+ on hover), "Calendars" | rest, hover (+ visible), + focus-visible | SidebarGroupLabel + SidebarGroupAction |
| SidebarSeriesRow | Tracked series + next-meeting hint | rest, selected, pressed, recording, draft, drag candidate, drop over, receive, landing, entering | SidebarMenuButton + droppable |
| SidebarCalendarRow | Watch toggle per calendar | watched, not watched, pressed | SidebarMenuButton + Checkbox (`@radix-ui/react-checkbox`, not yet installed) |
| ProgressHairline | 2px determinate job line | idle, running | `motion.i` scaleX |
| Tooltip | `data-tip` labels | delayed, warm (instant) | Radix Tooltip: `delayDuration={650}`, `skipDelayDuration={600}` |
| Toast | Confirmation + Undo | — | sonner; mounted in the window, or on the desktop while the window is hidden |

Build notes:
- **MenuBarStatusItem**: compute the phrase with the same selectors the Island uses (never a second source of truth). A tray title is plain text, so the pulsing coral dot needs a separate non-template tray image while recording, and the timer means calling `set_title` once per second.
- **SidebarSeriesRow**: `landing` hides a freshly created row (opacity 0) until the FlyChip lands, then `receive` flashes it and its icon bumps. Rows (and the Review row) are drop targets for past meetings dragged out of a living doc: drop on a series moves the meeting, drop on Review unfiles it (002 doc-organize.js). Keep a "Move to…" menu as the non-drag path.
- **DocToolbar**: the Back label is the origin's label (`Today`, `Yesterday`, `Tomorrow`, `Upcoming`, `Review`, `Found in Calendar`), tooltip "Back · ⌘[". The compact title (series icon + name, 15px/600) shows only when the doc's H1 has scrolled above the toolbar, not when it is below the fold.
- **AgendaToolbar**: the ⌥⌘N hint on New hides when the main column is ≤ 900px. Stepper chevrons disable at the ends of the loaded range and when no calendar is connected; Today is always enabled.

## Motion

Tokens: `--ease-out` cubic-bezier(0.23, 1, 0.32, 1), `--ease-in-out` cubic-bezier(0.77, 0, 0.175, 1), `--ease-drawer` cubic-bezier(0.32, 0.72, 0, 1). Rule: keyboard navigation never animates; state changes animate the same whether clicked or typed.

| Animation | Trigger | Properties | Enter / exit | Interruptible | Keyboard path | Reduced motion |
|---|---|---|---|---|---|---|
| Window hide/show | red or yellow light, ⌘W, Hide Telu / ⌥Space, ⌘0, status item, Island | none in the webview (`hidden`) | instant; the OS animates real windows | n/a | instant | same |
| Menu-bar menus | click a title | opens at full opacity; chosen row blinks off, back on at 60ms; closes at 130ms with a 120ms ease fade | 0 / 120ms | n/a | ↑/↓ highlight instantly; Enter uses the same blink | unchanged |
| Toolbar glass | content `scrollTop > 2` | background-color, 0.5px separator shadow; blur switches on without a tween | 200ms ease / 200ms ease | yes (CSS) | doc ↑/↓ scroll 48px and cross the same threshold | unchanged |
| Toolbar mode swap | view becomes / leaves `doc` | strip rebuilt | instant | — | — | — |
| Compact title | doc H1 leaves above the toolbar | opacity 0→1, translateY(4px)→0 | 180ms ease-out both ways | yes (CSS) | scroll-driven | opacity only |
| Save state | typing in the purpose or title | text "Saving…" → "Saved" 700ms after the last keystroke; colour `--label-2` (busy) ↔ `--label-3` | colour 150ms ease | debounce resets | typing | unchanged |
| View switch | sidebar destination, View menu, Back | new view opacity 0→1 + blur(2px)→0; old view replaced at once | 200ms ease-out, no exit | restart | 002 also fades on ⌘[ and View-menu items | no fade |
| Doc Record button | recording toggles | content swaps (idle ↔ dot + timer + Stop) | instant | — | ⌘R same | — |
| Sidebar press | pointer down on a row | scale(0.985) | 140ms ease-out | yes | none | snaps |
| Sidebar selection | view changes | background → `--fill-2` | 120ms ease | yes | same fade | colour still fades |
| Series + reveal | hover on the title row, focus-visible | opacity 0→1 | 150ms ease | yes | focus-visible reveals it | unchanged |
| Count bump | a count changes | scale 1 → 1.18 (at 40%) → 1 | 420ms ease-out | restart | same | off |
| Row enter / exit | series tracked / untracked | height 0↔measured + opacity (overflow hidden) | 280ms / 220ms ease-out | no | same | instant |
| Fly to sidebar | Create, Track as series, Add to series, File | flyer 560ms: x on cubic-bezier(0.45, 0, 0.2, 1), y + scale (≥ 0.4) + opacity → 0.35 on cubic-bezier(0.6, 0, 0.9, 0.7); then row receive 900ms + icon bump 420ms; `.landing` row opacity 0→1 150ms | 560ms | no | ⌥⌘N → Enter flies the same | no flight; the row just receives |
| Receive flash | meeting ends (After) or a flight lands | background `--accent-soft`, held 30%, → transparent | 900ms ease-out | restart | — | still runs (known gap) |
| Drop target | meeting dragged over the sidebar | hovered row `--accent-soft` + scale(1.03); other rows get a 1px inset `--accent-soft` ring | 140ms ease-out (scale), 120ms (background) | yes | "Move to…" menu | colour only |
| Calendar toggle | click a calendar row | check fill; tick stroke draw; Personal blocks crossfade | fill 160ms ease; tick 220ms ease-out + 40ms delay; crossfade 110ms out / 190ms in | yes | — | fill fades, tick snaps, no crossfade |
| Status item | app state changes | phrase swaps; rec dot pulses; timer ticks | instant; dot 1.4s ease-in-out loop; 1s ticks | loop | — | dot slows to 2.4s |
| Tooltip | hover a `data-tip` | opacity + scale(0.97)→1 | 650ms delay, then 125ms ease-out; instant within 600ms of the last one | yes | — | — |
| Side peek open/close | card click / × / Esc | translateX(calc(100% + 48px)) ↔ 0 | 300ms ease-drawer / 200ms ease-out | yes (CSS) | Enter opens instantly; ↑/↓ swap instantly; Esc uses the 200ms exit in 002 | instant |
| Progress hairline | `T.runProgress(ms)` (no 002 caller) | scaleX 0→1, then opacity → 0 | duration linear (default 900ms), 220ms ease-out fade | restart | — | runs (known gap) |

002 deviations from rule 1, to align in production: ⌘[ and View-menu navigation use the 200ms view fade, Esc slides the peek out over 200ms, and ⌥⌘N / ⌘F open their popovers with the pointer's 190ms scale.

```tsx
export const EASE_OUT = [0.23, 1, 0.32, 1] as const
export const EASE_IN_OUT = [0.77, 0, 0.175, 1] as const
export const EASE_DRAWER = [0.32, 0.72, 0, 1] as const

<MotionConfig reducedMotion="user" transition={{ duration: 0.19, ease: EASE_OUT }}>
  <AppShell />
</MotionConfig>

<AnimatePresence initial={false} mode="popLayout">
  <motion.div
    key={viewKey}
    initial={fromKeyboard ? false : { opacity: 0, filter: 'blur(2px)' }}
    animate={{ opacity: 1, filter: 'blur(0px)' }}
    transition={{ duration: 0.2, ease: EASE_OUT }}
  />
</AnimatePresence>
```

```tsx
const { scrollY } = useScroll({ container: contentRef })
const [scrolled, setScrolled] = useState(false)
useMotionValueEvent(scrollY, 'change', (y) => setScrolled(y > 2))

const titleInView = useInView(docTitleRef, { root: contentRef, margin: '-52px 0px 0px 0px' })
const showCompact = !titleInView && titleAboveToolbar

<header className="toolbar" data-scrolled={scrolled} data-tauri-drag-region>
  <motion.div
    className="tb-title"
    animate={{ opacity: showCompact ? 1 : 0, y: showCompact ? 0 : 4 }}
    transition={{ duration: 0.18, ease: EASE_OUT }}
  />
</header>
```

```tsx
<AnimatePresence initial={false}>
  {tracked.map((s) => (
    <motion.div
      key={s.id}
      style={{ overflow: 'hidden' }}
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1, transition: { duration: 0.28, ease: EASE_OUT } }}
      exit={{ height: 0, opacity: 0, transition: { duration: 0.22, ease: EASE_OUT } }}
    >
      <motion.div
        whileTap={{ scale: 0.985 }}
        animate={{ scale: dropOver === s.id ? 1.03 : 1 }}
        transition={{ duration: 0.14, ease: EASE_OUT }}
      >
        <SidebarSeriesRow series={s} />
      </motion.div>
    </motion.div>
  ))}
</AnimatePresence>

const [scope, animate] = useAnimate()
const receive = () => animate(scope.current, { backgroundColor: ['var(--accent-soft)', 'var(--accent-soft)', 'rgba(0,0,0,0)'] }, { duration: 0.9, times: [0, 0.3, 1], ease: EASE_OUT })
const bump = (el: Element) => animate(el, { scale: [1, 1.18, 1] }, { duration: 0.42, times: [0, 0.4, 1], ease: EASE_OUT })
```

Run `bump` from an effect when a count changes (skip the first render), and gate `receive`, `bump` and flights with `useReducedMotion()`.

## CSS Patterns

Tokens relied on: `--menubar-h` 26px, `--toolbar-h` 52px, `--sidebar-w` 244px, `--r-window` 16px, `--sidebar`, `--menubar`, `--content-bg`, `--glass-strong`, `--glass-edge`, `--glass-rim`, `--hairline`, `--separator`, `--fill-2`, `--fill-3`, `--accent`, `--accent-soft`, `--accent-strong`, `--label-2`, `--label-3`, `--coral`, `--coral-soft`, `--coral-ink`, `--shadow-window`, `--template-filter`, `--ease-out`.

Window and traffic lights (kit mac-kit.css + 002 app.css):

```css
.window { position: absolute; margin: auto; max-width: 1400px; max-height: 900px; display: flex; border-radius: var(--r-window); overflow: hidden; background: var(--sidebar); backdrop-filter: blur(40px) saturate(1.7); box-shadow: var(--shadow-window); isolation: isolate; }
.window.t-app { inset: calc(var(--menubar-h) + 56px) 132px 60px 24px; --sidebar-w: 244px; --peek-w: max(440px, 44%); }
.window.t-app.zoomed { inset: calc(var(--menubar-h) + 56px) 12px 12px 12px; max-width: none; max-height: none; }
.traffic { position: absolute; top: 20px; left: 20px; z-index: 20; display: flex; gap: 8px; }
.traffic i { width: 12px; height: 12px; border-radius: 50%; background: #FF5F57; box-shadow: inset 0 0 0 0.5px rgba(0, 0, 0, 0.14); }
.traffic i:nth-child(2) { background-color: #FEBC2E; }
.traffic i:nth-child(3) { background-color: #28C840; }
.main { position: relative; flex: 1; min-width: 0; display: flex; flex-direction: column; background: var(--content-bg); box-shadow: -0.5px 0 0 var(--hairline); container: main / inline-size; }
.content { position: relative; flex: 1; min-height: 0; overflow: auto; padding-top: var(--toolbar-h); }
```

Menu bar and status item:

```css
.menubar { position: absolute; top: 0; left: 0; right: 0; height: var(--menubar-h); z-index: 300; display: flex; align-items: center; gap: 2px; padding: 0 10px; background: var(--menubar); backdrop-filter: blur(30px) saturate(1.8); box-shadow: 0 0.5px 0 var(--separator); font-size: 13px; }
.menubar .mb-item { height: 22px; display: inline-flex; align-items: center; gap: 6px; padding: 0 8px; border-radius: 5px; white-space: nowrap; }
.menubar .mb-item.app { font-weight: 700; }
.menubar .mb-item.active { background: var(--fill-3); }
.menubar .telu-status { gap: 6px; padding: 0 8px; }
.menubar .telu-status img { width: 16px; height: 16px; filter: var(--template-filter); }
.menubar .telu-status .ts-text { display: inline-flex; align-items: center; gap: 6px; font-weight: 500; }
.menubar .telu-status.icon-only { padding: 0 7px; }
.menubar .telu-status.icon-only .ts-text { display: none; }
.menubar .telu-status .rec-dot { width: 7px; height: 7px; }
```

Sidebar:

```css
.sidebar { width: var(--sidebar-w); flex: none; display: flex; flex-direction: column; padding: var(--toolbar-h) 10px 40px; overflow: auto; position: relative; }
.a-sb-group { display: flex; flex-direction: column; gap: 1px; }
.sb-title { display: flex; align-items: center; justify-content: space-between; padding: 14px 8px 4px; font-size: 11px; font-weight: 600; color: var(--label-3); }
.a-sb-title { min-height: 30px; }
.sb-item { position: relative; display: flex; align-items: center; gap: 8px; height: 28px; padding: 0 8px; border-radius: 8px; font-size: 13px; color: var(--label); white-space: nowrap; transition: transform 140ms var(--ease-out), background-color 120ms ease, opacity 150ms ease; }
.sb-item > .i { color: var(--accent); }
.sb-item:active { transform: scale(0.985); }
.sb-item.selected { background: var(--fill-2); }
.sb-item .count { margin-left: auto; font-size: 12px; color: var(--label-3); font-variant-numeric: tabular-nums; }
.sb-item.landing { opacity: 0; }
.sb-item.drop-over { background: var(--accent-soft); transform: scale(1.03); }
.sidebar.dnd .a-sb-row:not(.selected) { box-shadow: inset 0 0 0 1px var(--accent-soft); }
.a-sb-add { width: 20px; height: 20px; margin: -4px -2px -4px 0; color: var(--label-2); opacity: 0; transition: opacity 150ms ease, transform 140ms var(--ease-out); }
.a-sb-add:focus-visible { opacity: 1; }
.a-sb-row .series-icon { width: 18px; height: 18px; }
.a-sb-row .series-icon .i { width: 10px; height: 10px; }
.a-hint { margin-left: auto; padding-left: 8px; flex: none; display: inline-flex; align-items: center; font-size: 11px; color: var(--label-3); font-variant-numeric: tabular-nums; }
.a-sb-row .rec-dot { width: 7px; height: 7px; }
.sb-item.a-cal { height: auto; min-height: 28px; padding-top: 5px; padding-bottom: 5px; align-items: flex-start; }
.a-cal .check.a-cal-check { width: 14px; height: 14px; margin-top: 2px; border-radius: 4px; box-shadow: inset 0 0 0 1.3px var(--cal); pointer-events: none; }
.a-cal .check.a-cal-check[aria-checked="true"] { background: var(--cal); box-shadow: none; }
.a-cal-cap { display: none; font-size: 11px; color: var(--label-3); }
.a-cal.is-off .a-cal-cap { display: block; }
.a-cal.is-off .a-cal-text > .truncate { color: var(--label-2); }
.sb-foot { margin-top: auto; padding: 10px 8px 2px; display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--label-3); }
@media (hover: hover) and (pointer: fine) { .a-sb-title:hover .a-sb-add { opacity: 1; } }
@media not all and (hover: hover) { .a-sb-add { opacity: 1; pointer-events: auto; } }
```

Toolbar, glass group and both modes:

```css
.toolbar { position: absolute; top: 0; left: 0; right: 0; z-index: 30; height: var(--toolbar-h); display: flex; align-items: center; gap: 8px; padding: 0 12px 0 18px; transition: background-color 200ms ease, box-shadow 200ms ease; }
.toolbar.scrolled { background: color-mix(in srgb, var(--content-bg) 76%, transparent); backdrop-filter: blur(18px) saturate(1.6); box-shadow: 0 0.5px 0 var(--separator); }
.toolbar-title { display: flex; flex-direction: column; justify-content: center; min-width: 0; line-height: 1.15; }
.toolbar-title b { font: 600 15px/1.2 var(--font); letter-spacing: -0.01em; }
.toolbar-title span { font-size: 11px; color: var(--label-2); }
.a-tb-title b, .a-tb-title span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.glass-group { display: inline-flex; align-items: center; height: 34px; padding: 3px; border-radius: 999px; background: var(--glass-strong); backdrop-filter: blur(16px) saturate(1.6); box-shadow: 0 0 0 0.5px var(--glass-edge), inset 0 0.5px 0 var(--glass-rim), 0 2px 10px rgba(23, 25, 31, 0.06); }
.glass-group .btn { background: transparent; height: 28px; }
.glass-group .sep { width: 0.5px; height: 16px; background: var(--hairline); margin: 0 2px; }
.a-rec-slot { display: flex; align-items: center; min-width: 0; margin-left: 12px; }
.a-progress { position: absolute; left: 0; right: 0; bottom: -1px; height: 2px; background: var(--accent); transform: scaleX(0); transform-origin: left center; opacity: 0; pointer-events: none; }
.btn.tb-back { gap: 2px; padding: 0 9px 0 5px; margin-left: -6px; color: var(--accent); }
.btn.tb-back .i { width: 13px; height: 13px; stroke-width: 2; }
.tb-title { display: flex; align-items: center; gap: 8px; min-width: 0; opacity: 0; transform: translateY(4px); pointer-events: none; transition: opacity 180ms var(--ease-out), transform 180ms var(--ease-out); }
.tb-title.show { opacity: 1; transform: none; }
.save-state { margin-right: 4px; font-size: 12px; color: var(--label-3); white-space: nowrap; transition: color 150ms ease; }
.save-state.busy { color: var(--label-2); }
.tb-record { gap: 7px; }
.tb-record .rec-glyph { width: 9px; height: 9px; border-radius: 50%; background: var(--coral); box-shadow: 0 0 0 2.5px var(--coral-soft); }
.tb-record.live { color: var(--coral-ink); }
.tb-record .tb-timer { min-width: 30px; text-align: left; }
#tbInspector.on { color: var(--accent); }
@container main (max-width: 900px) { .a-new-btn .kbd { display: none; } }
```

Feedback keyframes and reduced motion (kit):

```css
.receive { animation: kit-receive 900ms var(--ease-out); }
@keyframes kit-receive { 0%, 30% { background-color: var(--accent-soft); } 100% { background-color: transparent; } }
.bump { animation: kit-bump 420ms var(--ease-out); }
@keyframes kit-bump { 40% { transform: scale(1.18); } }
.rec-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--coral); flex: none; animation: kit-rec 1.4s ease-in-out infinite; }
@keyframes kit-rec { 50% { opacity: 0.3; } }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { transition-property: opacity, background-color, color, box-shadow, border-color !important; scroll-behavior: auto !important; }
  .enter, .bump, .wave i, .shimmer { animation: none !important; }
  .rec-dot { animation-duration: 2.4s !important; }
}
```

## HTML Structures

Desktop and window (002 index.html; the menu bar, Island and file icon are injected at boot):

```html
<div class="desktop" id="desk">
  <header class="menubar">…</header>
  <div class="window t-app" id="win" tabindex="-1">
    <div class="traffic"><i data-act="win-close" aria-label="Close window"></i><i data-act="win-min" aria-label="Minimize"></i><i data-act="win-zoom" aria-label="Zoom"></i></div>
    <aside class="sidebar" id="sidebar"></aside>
    <section class="main" id="main">
      <div class="toolbar" id="toolbar" data-mode="agenda"></div>
      <div class="content" id="content"><div id="view" class="agenda-inner"></div></div>
      <aside class="peek" id="peek" aria-label="Side peek"></aside>
      <nav class="scrubber" id="scrubber" aria-label="Sections"></nav>
      <aside class="drawer" id="drawer" aria-label="Details"></aside>
    </section>
  </div>
  <section class="onboard" id="onboard" hidden role="dialog" aria-label="Set up Telu">…</section>
  <div class="island" id="island" role="region" aria-label="Telu" tabindex="0"></div>
  <div class="il-file" id="islandFile" draggable="true">…</div>
</div>
```

Menu bar with the status item (Kit.menubar). `<svg class="i" data-icon="…">` stands for the kit icon of that name (lucide equivalents in component-inventory.md › Iconography):

```html
<header class="menubar">
  <span class="mb-item"><svg class="i" data-icon="apple"></svg></span>
  <span class="mb-item app">Telu</span>
  <span class="mb-item">File</span><span class="mb-item">Edit</span><span class="mb-item">View</span>
  <span class="mb-item">Meeting</span><span class="mb-item">Window</span><span class="mb-item">Help</span>
  <span class="mb-right">
    <span class="mb-item telu-status" id="teluStatus" role="button" aria-label="Telu">
      <img src="telu-menubar.png" class="template-img" alt="">
      <span class="ts-text"><span class="num">Product Sync · 19m</span></span>
    </span>
    <span class="mb-item"><svg class="i" data-icon="battery"></svg></span><span class="mb-item"><svg class="i" data-icon="wifi"></svg></span>
    <span class="mb-item"><svg class="i" data-icon="search"></svg></span><span class="mb-item"><svg class="i" data-icon="control"></svg></span>
    <span class="mb-item num">Tue 29 Sep  9:41</span>
  </span>
</header>
```

Sidebar (T.renderSidebar):

```html
<nav class="a-sb-group">
  <div class="sb-item a-nav selected" data-act="nav" data-view="day"><svg class="i" data-icon="sun"></svg><span class="truncate">Today</span><span class="count num" data-count="day">3</span></div>
  <div class="sb-item a-nav" data-act="nav" data-view="upcoming"><svg class="i" data-icon="calendar"></svg><span class="truncate">Upcoming</span><span class="count num" data-count="upcoming"></span></div>
  <div class="sb-item a-nav" data-act="nav" data-view="review"><svg class="i" data-icon="tray"></svg><span class="truncate">Review</span><span class="count num" data-count="review">5</span></div>
  <div class="sb-item a-nav" data-act="nav" data-view="found"><svg class="i" data-icon="sparkles"></svg><span class="truncate">Found in Calendar</span><span class="count num" data-count="found">3</span></div>
</nav>
<div id="sbSeriesSection">
  <div class="sb-title a-sb-title"><span>Series</span><button class="btn plain icon a-sb-add" data-act="new-series" data-align="start" data-tip="New series"><svg class="i" data-icon="plus"></svg></button></div>
  <div id="sbSeries">
    <div class="sb-item a-sb-row" data-act="open-doc" data-series="product-sync">
      <span class="series-icon" style="--c:var(--series-blue)"><svg class="i" data-icon="people"></svg></span>
      <span class="truncate a-sb-name">Product Sync</span><span class="a-hint num">10:00</span>
    </div>
  </div>
</div>
<div class="sb-title">Calendars</div>
<div class="sb-item a-cal is-off" data-act="cal" data-cal="personal">
  <button class="check square a-cal-check" data-manual aria-checked="false" style="--cal:#30B955" tabindex="-1"><svg viewBox="0 0 14 14"><path d="M3.2 7.4l2.4 2.4 5.2-5.6"/></svg></button>
  <span class="a-cal-text"><span class="truncate">Personal · iCloud</span><small class="a-cal-cap">Not watched</small></span>
</div>
<div class="sb-foot"><svg class="i sm" data-icon="lock"></svg>On this Mac · processed locally</div>
```

Agenda toolbar and doc toolbar (app-shell.js):

```html
<div class="toolbar-title a-tb-title" id="tbTitle"><b>Today</b><span>Tuesday, 29 September</span></div>
<div class="a-rec-slot" id="recSlot"></div><span class="spacer"></span>
<div class="glass-group" id="stepper">
  <button class="btn icon" data-act="day-prev" data-tip="Previous day"><svg class="i" data-icon="chevron-left"></svg></button>
  <button class="btn" data-act="day-today">Today</button>
  <button class="btn icon" data-act="day-next" data-tip="Next day"><svg class="i" data-icon="chevron-right"></svg></button>
</div>
<div class="glass-group">
  <button class="btn a-new-btn" data-act="new-series" id="newBtn"><svg class="i" data-icon="plus"></svg>New<span class="kbd">⌥⌘N</span></button>
  <span class="sep"></span><button class="btn icon" data-act="search" id="searchBtn" data-tip="Search"><svg class="i" data-icon="search"></svg></button>
</div>
<i class="a-progress" id="progress"></i>
```

```html
<button class="btn sm plain tb-back" data-act="back" id="tbBack" data-tip="Back · ⌘["><svg class="i" data-icon="chevron-left"></svg><span>Today</span></button>
<div class="tb-title" id="tbDocTitle"><span class="series-icon" style="--c:var(--series-blue)"><svg class="i" data-icon="people"></svg></span><b>Product Sync</b></div>
<span class="spacer"></span><span class="save-state" id="saveState">Saved</span>
<div class="glass-group" id="tbDocGroup">
  <button class="btn icon" data-act="history" data-tip="History"><svg class="i" data-icon="history"></svg></button>
  <button class="btn icon" data-act="share" data-tip="Export as Markdown"><svg class="i" data-icon="share"></svg></button><span class="sep"></span>
  <button class="btn tb-record" data-act="tb-record" id="tbRecord"><span class="rec-glyph"></span>Record<span class="kbd">⌘R</span></button>
  <button class="btn icon" data-act="tb-more" data-tip="More"><svg class="i" data-icon="ellipsis"></svg></button>
</div>
<div class="glass-group"><button class="btn icon" data-act="inspector" id="tbInspector" data-tip="Details"><svg class="i" data-icon="inspector"></svg></button></div>
```

While recording, the Record button's content becomes `<span class="rec-dot"></span><span class="num tb-timer" data-rec-timer>12:04</span><span>Stop</span>` with `.live`.

## Behavior & State

### State model

One store, shallow immutable patches only (`T.set({...})`; `mapSeries`, `mapMeeting` and `mapEvents` return new arrays). Shape from 002 app-data.js `baseState()`:

```ts
type AgendaKind = 'day' | 'upcoming' | 'review' | 'found'
type Origin = { kind: AgendaKind; dayIndex: number; scroll: number; peekOpen: boolean; label: string }
type View = { kind: AgendaKind; dayIndex: number } | { kind: 'doc'; seriesId: string; from: Origin | null }
type Selection = { kind: 'event' | 'unfiled' | 'meeting'; id: string } | null

interface AppState {
  clock: string
  nowMin: number
  calendar: 'connected' | 'none'
  onboarded: boolean
  view: View
  selection: Selection
  peekOpen: boolean
  series: Series[]
  days: Day[]
  proposals: Proposal[]
  unfiled: UnfiledItem[]
  calendars: { id: string; name: string; account: string; color: string; watched: boolean }[]
  recording: { eventId: string | null; meetingId: string | null; seriesId: string | null; startedAt: number } | null
  summarizing: { meetingId: string | null; seriesId: string } | null
  starting: string | null
  lastEnded: string | null
  recordOnce: Record<string, boolean>
  bannerHidden: boolean
  expanded: Record<string, boolean>
  prepared: Record<string, boolean>
  seq: number
}
```

Derived, never stored: `kindOf(event)`, `nextUpId()`, `todayCount()`, `reviewCount()`, `foundCount()`, `nextHint(series)`, `isPast(event, dayIndex)`, `isStarting(meetingId)`, `trackedSeriesOf(event)`, `recordTarget()`. Series, Day, Proposal and UnfiledItem shapes are in calendar-and-agenda.md.

### Views, back stack, peek vs page

- `goView(kind)`: switching to a different view closes an open peek (animated, unless you are leaving a doc), scrolls to the top (or restores), fades the new view in (200ms), keeps the selection, and re-applies the selection ring if that card exists in the new view. The sidebar selection follows the view: the nav row for agenda views, the series row for a doc.
- `openDoc(seriesId, { reveal, focusPurpose })`: records `from = agendaOrigin()` (kind, dayIndex, scrollTop, peekOpen, label). From a doc it keeps the existing `from`, so there is one level of Back. The peek hides instantly, the doc paints, then it optionally scrolls to the next meeting or a given meeting, or focuses the purpose. In 002 the origin is recorded even when the doc is opened from its sidebar row (Back reads "‹ Today"); 003's "Opened from the sidebar · no back button" state only occurs when `from` is null.
- `goBack()` (Back button, ⌘[, Esc in a doc): `goView(from.kind, { dayIndex, restore: from })` restores scroll and reopens the peek instantly if it was open.
- `stepDay(±1)` works only with a connected calendar. From another view it goes to Today ± 1. It closes the peek if the selected event is not on the target day. It slides on a click and is instant on ←/→.
- **Peek vs page.** The side peek (`--peek-w: max(440px, 44%)`, below the toolbar, radius 14 on its top-left, agenda padding-right grows to `--peek-w + 24px`) is a quick look at the selected card, on agenda views only, never over a doc. It opens on a card click (animated) or Enter (instant). The page is a tracked series' living doc, reached via "Open as page" in the peek or the card's context menu, the series link in the peek header, a sidebar row, or a search result. Untracked events and unfiled items have no page.

### Window, summon and menus

- `hideWindow()` blurs focus inside the window, then hides it. `showWindow()` un-hides and restarts timers. Toasts render in the window, or on the desktop while the window is hidden.
- `summon()`: no-op while onboarding is open; if not onboarded, opens onboarding; otherwise shows and focuses the window. Many actions call `showWindow()` first: New series, Search, Edit Purpose, opening a meeting or review from the Island or a notification, and View-menu navigation.
- Menus (002 app.js `MENUS`): **Telu** About Telu · Hide Telu ⌘W. **File** New Series… ⌥⌘N · Close Window ⌘W. **Edit** Edit Purpose ⌘E · Find… ⌘F. **View** Today · Upcoming · Review · Found in Calendar (disabled until a calendar is connected). **Meeting** Record / Stop Recording ⌘R · Open Next Meeting (disabled when nothing is next). **Window** Telu ⌥Space (checked while shown) · Close Window ⌘W (disabled while hidden). **Help** Telu Help. Menus open under their title, which stays highlighted (`--fill-3`) while open; min width 220.

### Scenario states

The 002 Scenario bar (bottom-left) is a sketch control, not product UI. Each scenario is a pure builder over `baseState()`:

| Scenario | Clock | State | Window | Island | Status item | Also |
|---|---|---|---|---|---|---|
| First run | 9:41 | calendar `none`, not onboarded, no tracked series, proposals or unfiled items, no selection | hidden | `hidden` while onboarding is open (opens after 420ms), `setup` pill otherwise | icon only | ⌥Space and the status item open onboarding, not the window; a window opened from a menu (View, File, Edit) shows Welcome + Set up Telu, stepper disabled, sidebar with only Today, Upcoming, Review |
| Before | 9:41 | baseline: Today, Product Sync selected, peek open | shown | `before` | "Product Sync · 19m" | banner: 2 new recurring meetings |
| Starting | 10:00 | `starting = 'ps-37'` | shown | `starting` | "Product Sync · now" | notification after 600ms: "Product Sync is starting" · Record / Not this time |
| Live | 10:12 | `recording = { eventId: 't2', meetingId: 'ps-37', seriesId: 'product-sync', startedAt: now − 724s }` | shown | `live` | "● Recording 12:04" | capsule in the toolbar; live lines at 1.4s, 3.8s and 5.8s |
| After | 10:46 | `lastEnded = 'ps-37'`; the series rolls forward (5 pending, next #38 on Tue 6 Oct) | shown | `after` | "5 to review" | notification after 700ms: "Product Sync — 5 items to review" |

Switching scenario clears pending timers, live lines, onboarding, sheets, toasts and notifications, rebuilds state, re-renders everything and fades the view in (200ms). Finishing onboarding builds the Before state from the picks, selects the next meeting with the peek open, keeps the window hidden, and sets the Island to `before` 160ms later; ⌥Space then shows the window.

### The one recording state

- **Start** (`startRecording(target)`): `recording = { eventId, meetingId, seriesId, startedAt }` (meetingId and seriesId only if the series is tracked), `starting = null`, the starting notification is dismissed, the affected cards morph and rows FLIP, the capsule enters, live lines are scheduled, and the Island goes `live`. With no target: toast "Nothing left to record today".
- **Everyone reads it:** agenda RecordingCapsule (label: event title, else series name, else "Recording"), doc Record button, EventCard eyebrow, sidebar series hint, status item, Island (`TeluBridge.live()`), the peek and doc live strip, and Meeting › Stop Recording. `syncTimers()` restarts every `[data-rec-timer]` element from the same elapsed seconds.
- **Stop:** `recording = null`. For a tracked recording, `summarizing = { meetingId, seriesId }` for a 900ms beat (card chip "Preparing summary…", status "Filing…", Island `filing`), then it is filed: the 10:00 Product Sync enters After (the ended card fades in over 240ms, the sidebar row receives, Island `after`, review notification 250ms later); any other tracked recording is filed into its series with the toast "Filed today’s recording to …". A one-off recording saves locally ("Saved a one-off recording of … on this Mac"), clears its record-once flag, and the Island returns to `before` after 900ms.
- **Skip** (Starting): `starting = null`, Island `before`, toast "Won’t record Product Sync this time" with Undo.
- There is no paused state outside the Island: the capsule and status item keep counting while the Island is paused.

### Status item phrase

Precedence (002 app-bridge.js `statusMarkup`): not onboarded → nothing; recording → rec dot + "Recording 0:00"; summarizing → "Filing…"; the last ended meeting has pending items → "N to review"; the next meeting today (ready, preparing or recording, not yet ended) is starting → "Name · now"; otherwise → "Name · 19m" / "Name · 4h 19m"; nothing → icon only (the `.icon-only` padding). Every Island call re-renders the phrase, so the two never disagree.

### Keyboard map

| Keys | Action | Active when | Animation |
|---|---|---|---|
| ↑ / ↓ | Move the selection through cards and unfiled cards; the peek follows instantly if open. In a doc: scroll 48px | window shown, onboarding closed | none |
| ← / → | Previous / next day | day view | none (no slide) |
| Enter | Open the selected card in the peek | agenda view, a selection, peek closed, no layer open, focus not in a field, button or link | none (peek `.instant`) |
| ⌘R | Record / stop. Target: the doc's meeting today, else the doc's series; in the agenda, the selected event if today, not past and recordable, else the next-up event | any view | the resulting change animates like a click |
| ⌥⌘N | New series popover (anchored to New, the doc toolbar group, or the sidebar +) | any | popover 190ms in 002 |
| ⌘E | Edit purpose: focus it in a doc; else open the doc of the peeked or next-up tracked series with the purpose focused; else toast "Select a tracked meeting to edit its purpose" | onboarded | doc paint |
| ⌘F | Search popover (search button, or the doc toolbar group) | any | popover 190ms in 002 |
| ⌘[ | Back to the doc's origin | doc with `from` | 002: 200ms view fade |
| ⌘W | Hide the window | window shown | none |
| ⌥Space, ⌘0 | Summon (or open onboarding before setup) | always | none |
| Esc | Close the topmost layer; else close onboarding; else blur a field; else close the details drawer; else close the peek; else Back from a doc | — | 002: peek exits in 200ms |
| ⌘⇧E · ⌘O | Export as Markdown · attach files | doc | — |

Guards (kit `Kit.keys`): combos are built from `event.code`; keys without a modifier are ignored while typing in an input, textarea, select or contenteditable (except Escape) and while any popover, menu, sheet or alert is open; Escape is caught in the capture phase by the layer stack first.

### Island bridge

- App → Island: `Island.set(mode)` with `setup | before | starting | live | filing | after | hidden`, and `Island.refresh()`; the wrapper always re-renders the status item too. Mode choice: not onboarded → `setup` (`hidden` while onboarding is open); recording → `live`; starting → `starting`; otherwise the scenario (`before` / `after`).
- The Island reads through `TeluBridge`: `next()` → `{ series, meeting, countdown }`, `live()` → `{ series, meeting, elapsed, transcript, suggestion }`, `after()` → `{ series, meeting, pending }`, `evidence(seriesId, src)`.
- Island → app events: `island:setup`, `island:open {seriesId, meetingId}`, `island:record {meetingId}`, `island:skip {meetingId}`, `island:stop`, `island:review {meetingId}`, `island:attach {meetingId, files}`, `island:feedback {kind}`.

### Platform mapping (Tauri and Next.js)

Verified in `frontend/` today: the main window uses `decorations: true` with no title-bar style, `macOSPrivateApi` is already `true`, `tray.rs` builds a template tray icon with a native menu and never sets a title, and there is no vibrancy, no global-shortcut plugin and no Island window.

- **Main window**: `"titleBarStyle": "Overlay"`, `"hiddenTitle": true`, `"trafficLightPosition": { "x": 20, "y": 20 }` (the schema requires Overlay + `decorations: true`; tune on device so the lights centre on the 52px band), `"transparent": true`. For the sidebar material use `"windowEffects": { "effects": ["sidebar"] }` (Tauri 2 config) or the `window-vibrancy` crate (`NSVisualEffectMaterial::Sidebar`); the webview keeps `body` transparent and the main column paints `--content-bg`. Overlay needs an explicit drag region: put `data-tauri-drag-region` on the toolbar and its spacer.
- **Close = hide**: on `WindowEvent::CloseRequested { api, .. }` call `api.prevent_close()` and `window.hide()`. ⌘W is the native File › Close Window accelerator. 002 labels Telu › Hide Telu with ⌘W; the native predefined Hide item uses ⌘H.
- **⌥Space** must work while the window is hidden, so register it system-wide (`tauri-plugin-global-shortcut`, not yet a dependency).
- **Status item**: keep `icon_as_template(true)`, drive `set_title()` from the phrase selector, and show + focus the window on a left click. 002 has no dropdown on the item, while the current `tray.rs` attaches a recording menu; decide deliberately.
- **Island and onboarding** are separate transparent, undecorated, `alwaysOnTop`, `visibleOnAllWorkspaces` windows (`acceptFirstMouse` so one click works while Telu is inactive), positioned like the sketch: Island centred at top 36px, onboarding centred at top 92px. The Rust core owns recording and calendar state and emits events that every window listens to; the `island:*` names become Tauri commands or events.
- **Menus**: native Tauri Menu API with the accelerators above. Never render the menu bar in React.
- **Next.js**: `next.config.js` has `output: 'export'`, so runtime series ids cannot be static routes. Keep `view` in the client store (it carries `from`, scroll and peek state anyway) and render it from one page; if a URL is wanted, use query params (`?series=`). Suggested files (kebab-case): `components/app-shell/app-shell.tsx`, `sidebar.tsx`, `sidebar-nav-item.tsx`, `sidebar-series-row.tsx`, `sidebar-calendar-row.tsx`, `toolbar.tsx`, `agenda-toolbar.tsx`, `doc-toolbar.tsx`, `lib/app-store.ts`, `lib/motion.ts`. Switch the root font from Source Sans 3 (current `layout.tsx`) to the system stack `-apple-system, BlinkMacSystemFont, "SF Pro Text", …`. `@tailwindcss/container-queries` (installed) covers the `@container main` rules.

### Accessibility

- Landmarks: `nav` (sidebar), `main`, `role="toolbar"` with an aria-label; the window root is focusable (`tabindex="-1"`) so shortcuts work after summon.
- Rows: `aria-current="page"` on the selected row; the count is part of the name ("Review, 5 items"); the recording dot needs text ("recording"); calendar rows are `role="checkbox"` with `aria-checked`, and the inner check is decorative.
- Icon-only buttons need `aria-label` (Previous day, Next day, Search, New series, History, Export as Markdown, More, Details); 002 has only `data-tip`.
- Back reads "Back to Today"; Record uses `aria-pressed`; the Details toggle uses `aria-expanded`; the save state is a polite live region; the status item has `aria-label="Telu"`.

### Known gaps (003 README and cataloging)

- No visible focus ring on switches; no disabled style for text fields and checkboxes.
- Not gated by reduced motion: receive flash, mini dots, progress hairline (also chip-in and spinner elsewhere).
- Missing `aria-label`s on icon-only buttons.
- Absent in 002, not to be invented: a paused state for the toolbar capsule and the status item, an "Editing…" save state (002 says "Saving…"), pending counts on series rows, any sheet opened by 002.
- Back-button discrepancy: see Views above (002 always records an origin).

## What to Avoid

- **A permanent inspector column** (001 A: a 380px `.a-insp` beside the agenda, always taking that width). 002 replaced it with an on-demand side peek that renders the meeting with the living doc's own components (002 README), so the agenda keeps its full width until you ask.
- **Series as a view inside the agenda** (001 A: title "N meetings · cadence"). The series page is the living doc (001 B).
- **B's sidebar**: a search field on top, smart rows (Up Next, Suggestions, Unfiled), series grouped by Team / 1:1s / Clients / Leadership / Other, pending counts on doc rows, and a "New Living Doc" footer button. 002 keeps A's four destinations, a flat Series list, search in the toolbar (⌘F), review counts on Review only, and New in the toolbar plus the Series +.
- **C's ⌘K command window** (⌥Space / ⌘K toggled a Spotlight-style palette). ⌥Space summons the real window; there is no second navigation surface.
- **C's menu-bar dropdown panel** (`#mbPanel`, role menu). The phrase in the bar carries the state; a click summons.
- **C's fake Keynote backdrop** (menu bar reading "Keynote", a fake Keynote window). It was a staging device; Telu is frontmost in 002.
- **Hover highlights on sidebar rows**: macOS source lists don't have them; selection and press are the only feedback.
- **Animating keyboard navigation**: sliding the day on ←/→, sliding the peek on ↑/↓, fading on ⌘[.
- **Faking window open/close in the webview**: the OS animates real windows.
- **`transition: all`, `scale(0)` entrances, and springs on menus, toasts or view swaps**: animate transform and opacity only, start from 0.96–0.98, and keep springs for morphs and landings.
- **Mint or coral as decoration**: mint means "Telu found something worth asking" (the shell never uses it); coral is recording and genuine attention only (rec dots, capsule, Record glyph).
- **Rendering the menu bar or the Scenario bar in React**: the first is native, the second is a sketch control.

## Origin

Synthesized from sketches: 001, 002, 003 (001 for what was not adopted; 002 as the source of truth; 003 for component specs, stories and motion rules).

Source files available in:
- `sources/002-final-app/`: index.html, app.js, app-shell.js, app-model.js, app-data.js, app-record.js, app-bridge.js, app-onboard.js (`T.summon`), app-peek.js (peek open/close), app-agenda.js (`T.select`, `T.moveSelection`, `T.syncTimers`), doc-page.js (`observeTitle`), doc-edit.js (save state), doc-organize.js (sidebar drop targets), app.css, doc.css (`.tb-title`, `.save-state`, `.tb-record`), island.js, island.css (Island position and modes, `.il-file`), README.md
- `sources/003-component-catalog/`: sec-chrome.js, sec-motion.js (Motion principles, window, toolbar, view-switch entries), sec-motion-2.js (receive, fly to sidebar, drop targets, reduced motion), COMPONENTS.md, README.md (gaps)
- `sources/kit/`: mac-kit.css, mac-kit.js (`Kit.menubar`, `Kit.keys`, `Kit.scrollEdge`, `Kit.flyTo`, `Kit.enterAnimated`, `Kit.removeAnimated`, tooltips, layer stack), data.js, icons.js, telu-menubar.png
- `sources/themes/`: default.css, dark.css
- `sources/001-app-mental-model/`: README.md only. The rejected alternatives cited above live outside the skill in `.planning/sketches/001-app-mental-model/` (a-today.html, a-today-shell.js, a-today.css, b-living-doc.js, b-living-doc-views.js, c-companion.html, c-companion.js).
- Live: http://localhost:4318/002-final-app/ and http://localhost:4318/003-component-catalog/ (Chrome section).
