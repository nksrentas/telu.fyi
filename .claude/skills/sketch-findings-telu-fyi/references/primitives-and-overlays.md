# Primitives & Overlays

The single-purpose controls every Telu screen is composed from (buttons, fields, toggles, chips, badges, avatars, indicators, cards, rows) and the layers above the window (popover, menu, sheet, alert, toast, notification, tooltip, evidence, flying chip). All values use the tokens in foundations-and-motion.md and the presets in `motion.ts`. Per-component props and states: component-inventory.md, sections Primitives and Overlays.

## Design Decisions

**Controls**

1. **Capsule controls at macOS density.** Buttons are 999px capsules: md 28px (13px/500, padding 0 12px, gap 6px), sm 24px (12px, padding 0 10px), lg 34px (14px, padding 0 16px); icon-only buttons are square (28 / 24). Controls are fills, not borders. Hover exists only on fine pointers; disabled is `opacity: 0.45` + no pointer events; the cursor stays `default` on buttons (kit `button { cursor: default }`, the macOS convention). shadcn's defaults (rounded-md, h-9) are replaced.
2. **Five button variants, one meaning each.** default `--fill-2` (hover `--fill-3`) for neutral actions · primary `--accent` (hover `--accent-strong`, `inset 0 1px 0 rgba(255,255,255,0.18), 0 1px 2px rgba(23,25,31,0.14)`) for the one main action · record `--coral` with white text (hover `--coral-ink`, top highlight 0.22) only for recording · tinted `--accent-soft` with `--accent-strong` text for secondary accent actions (Review, toast Undo) · plain transparent (hover `--fill`) for tertiary actions. A shortcut can follow the label at 60% opacity (`.kbd`, e.g. Record ⌘R).
3. **Toolbar actions live in glass groups.** 34px capsule, 3px inset, glass material (blur 16px, saturate 1.6, 0.5px `--glass-edge`, inset `--glass-rim`); items are transparent 28px buttons with a `--fill-2` hover; sub-groups are split by a 0.5px × 16px `--hairline`. The Record button inside turns into rec dot + live timer + Stop while recording; the drawer toggle turns `--accent` when on.
4. **Segmented control = one size, sliding white thumb.** 28px `--fill-2` track, 2px inset, 24px items at 12px/500 in `--label-2` (selected `--label`), a `--content-bg` thumb with `0 1px 3px rgba(23,25,31,0.13), 0 0 0 0.5px rgba(23,25,31,0.06)` that slides 240ms. 002 uses it once (a draft series' Repeats: None / Weekly / Every 2 weeks / Monthly). No second size exists.
5. **Fields are white wells; focus is a soft ring.** `--content-bg` with `inset 0 0 0 0.5px var(--hairline)`, radius 8; focus → 0.5px accent inset + 3.5px accent ring at 32%. lg is 36px, 15px text, radius 10 (New series, onboarding manual entry). Search is a pill on `--fill` with a 14px `--label-3` glyph at 9px that turns `--content-bg` on focus; it is 32px inside the search popover.
6. **Pop-up buttons are native-looking pickers.** 24px, radius 7, `--content-bg` + hairline ring + `0 1px 1.5px rgba(23,25,31,0.06)`, 13px regular, trailing chevrons-up-down 11px `--label-2`; no hover change; opening shows an instant Menu (day min-width 170px, time 120px). Placeholders read "Day" / "Time"; both are disabled when Repeats is None.
7. **Switch and checkbox land physically.** Switch 32 × 18 (`--fill-3` → `--accent`), 14px white knob with `0 1px 2px rgba(0,0,0,0.22), 0 0 0 0.5px rgba(0,0,0,0.04)` that moves 14px on `--spring-bounce`. Checkbox 17px circle with a 1.3px `--label-4` ring → `--accent` fill, then an 11px white tick (stroke 2.2) draws itself; square variant radius 5; the sidebar calendar variant is 14px, radius 4, filled with the calendar's own color (`--cal`).
8. **Chips are 20px, and tone = meaning.** 11px/500 capsules, 12px icons. In 002: accent = Brief ready, Tracking, "Part of …?", countdown ("in 19 min"), drafted purpose · amber = "N to review", Unfiled · coral = Starting now (with a pulsing 6px dot) · dashed = recurring not tracked, One-off · neutral = Brief tonight, Preparing (shimmer), Filed, Reviewed, Records at 17:00 (static coral mini dot). Mint and outline tones exist in the kit but are unused. Chips never truncate; the title next to them does.
9. **Every claim carries its evidence.** SourceChip: 18px, radius 5, quote glyph + "Sep 22 · 18:42" (speech), "North-star metrics.docx · p.2" (document) or "06:12" (candidate timestamp), 10.5px/500 tabular on `--fill`, hover `--accent-soft` / `--accent-strong`. StatusBadge: 6px dot + 11px label (current and Done green, open accent, unresolved and disputed amber, superseded and cancelled `--label-4`; superseded text is struck through). KnowledgeType: colored icon + 11px/600 label, icon-only, or a tinted tile (22px radius 7; Island 20px radius 6).
10. **People are initials on a color.** Avatar 20px (8.5px/600 white initials, 1.5px ring in the background color), lg 28 (11px), 18 in agenda meta, 16 in doc meta and owners (no ring); "You" is an empty accent disc. Stacks overlap −5px (−4px in agenda meta and the people chip) and cap at 4 (agenda 3) with a "+n" count; proposal cards add the invite's extra count.
11. **Documents are chips with a type badge.** FileBadge 16 × 20 (22 × 28 in the reference popover head), radius 3, folded 5px corner, 6.5px/800 three-letter type (DOC for docx, XLS for xlsx, else the extension) on a fixed color per kind. DocChip 30px, radius 9, on `--fill` (hover `--fill-2`); on the Next card it is `--content-bg` with `--shadow-card`. Reference chips add a 7px include dot (accent = included in every brief, 1.3px ring = left out); the Add chip is transparent with a 1px `--separator` ring. New chips arrive with chip-in.
12. **Series identity.** SeriesIcon: white glyph on the series color, round; sizes 16 (peek, stroke 2.2), 18 (sidebar), 20, 28 (Island), 30 (cards), 36 (doc title). SeriesDot: 8px, for menus, the Island next pill and detected rows (`--label-4` before a series exists).
13. **Shortcuts are text, keycaps only teach.** Kbd: 11px/500 `--label-3`, +0.03em; inside a button it inherits the button color at 60%; in a menu row it right-aligns with 18px left padding and turns white at 85% on the active row. Keycap: 22px, radius 6, `--content-bg` with a hairline and a 1px bottom hairline; onboarding scales it to 54 × 48 (radius 10, 20px) and a 150px Space bar.
14. **Indicators are status, never decoration.** RecDot 8px coral, pulse 1.4s (7px in the sidebar and menu bar, 6px mini dots, a 9px static Record glyph with a 2.5px `--coral-soft` halo; the Island dims it to 45% when paused). Waveform: five 2.5px bars, 14px tall (agenda 11px with 2px bars, Island 13px), coral in recording contexts. Spinner: 14px ring (10px tiny, 13px Island), 700ms. Skeleton: shimmer on chips and 10px lines (third line 58%). ProgressHairline: 2px accent line on the toolbar's bottom edge, present but never triggered in 002.
15. **Empty states are calm and specific.** Centered; the glyph sits in a 56px `--accent-soft` tile (radius 16; 72/20 for large, 52 in "caught up", `--fill-2` when off); h3 17px/600 display; one sentence (max 340px); optional actions; a local-processing footnote ("Processed on this Mac", 11px `--label-3`, lock icon).
16. **Cards lift, rows invert.** Card: `--surface`, radius 12, `--shadow-card`; interactive cards take `--shadow-card-hover` on hover and press to 0.992; agenda selection is a 2px accent ring drawn by `::after`. ListRow (search results): min-height 28, radius 8, gap 10 (search hits: 32px, gap 8); hover `--fill`; the keyboard-selected row inverts to `--accent` with white text (meta at 78% white).
17. **Collapsibles unfold in place.** Grid rows 1fr ↔ 0fr with an opacity fade; a 13px `--label-3` chevron turns 90°; the one-line summary fades while open.
18. **Drop targets say where a file can land.** Kit: 2px dashed accent at 70%, inset 6px, over `--accent-softer`. The purpose section uses a larger dashed wash (1.5px, radius 18, inset −14px −18px) plus an accent "Drop to add to Reference" pill; "Docs for this meeting" uses the kit style with a −1px offset. Every drop has a keyboard path (⌘O).

**Overlays**

19. **Every floating layer is glass.** `--glass-strong` + blur + saturate + a shadow; blur by layer: tooltip 20, toast 24, popover and menu 26, sheet, alert and notification 34. In-window z-order: toolbar 30 · side peek 35 · drawer 40 · popover 150 · menu 160 · scrim 180 / sheet 181 · toast stack 200 · alert 400 · tooltip 1000 · flying chip 5000. The Island (260) and notifications (350) are separate surfaces in production.
20. **Popovers grow out of their trigger.** Radius 14, 6px inset, min-width 220 (usually 250–400 set per use), blur 26; 8px from the trigger, flip above when there is no room, clamp 8px inside the window; `transform-origin` is the trigger's centre (clamped 12px from the popover edges) on the edge facing it. Content is built from `.pop` parts (row with accent icon, sub line, actions, title, person rows, footer with lock note, switch row, empty text).
21. **Menus are macOS menus.** Radius 12, 5px inset, min-width 210, 13px; 24px rows, radius 6, 14px `--label-2` icons; the row under the pointer or keys is filled `--accent` with white text; danger rows are `--coral-ink` (active: `--coral` fill); disabled rows `--label-3`; section titles 11px/600 `--label-3`; 0.5px separators inset 9px. They open instantly, blink the chosen row, then fade. Series choices show a SeriesDot; detail text sits in the shortcut slot ("Weekdays 09:00", "Current").
22. **Context menus are the same menu at the pointer** (2px offset, clamped 8px inside the window). On an agenda card the rows enable from the event: Open in side peek ↩, Open as page, Record / Stop recording ⌘R, Edit purpose… ⌘E, Add to series…, Stop tracking… (danger).
23. **Sheets are window-modal and rare.** Centered glass (radius 20, blur 34, `--shadow-window`), default 520px, over a `--scrim`; head (17px/700 title, one line of help), body, right-aligned footer. 002 never opens one: 001's A used sheets for purpose editing, detection and proposals; the final app moved purpose editing into the living doc and proposals into Found in Calendar.
24. **Alerts are small, centered and decisive.** 280px at 42% from the top, radius 20, 22/18/16px padding, centered text: 56px app icon, 13px/700 title, one 11px `--label-2` line of consequences, two equal 28px buttons (cancel first, primary last). Destructive confirms turn the primary coral. Three exist: calendar permission ("Don't Allow" / "Allow Full Access"), Delete meeting, Stop tracking.
25. **Toasts confirm and offer Undo.** Glass capsule at the bottom centre of the window (18px from the edge, 8px gap), min-height 38, 13px, an accent icon, an optional tinted sm Undo. Lifetime 4.2s, paused while hovered. Every flight and most undoable changes are paired with a toast.
26. **Notification banners are native in production.** The kit banner (348px, radius 20, 32px app icon, title, one line, time, ≤ 2 actions) only simulates macOS in the prototype; production uses `@tauri-apps/plugin-notification`. Two exist: "Product Sync is starting" (Record / Not this time) and "Product Sync — N items to review" (Review).
27. **Tooltips wait, then are instant.** Glass label 6px below the target (11px, radius 6, padding 3px 8px), centered, clamped 8px from the left; first show after 650ms, neighbours within 600ms show with no delay and no transition; hidden on pointerdown. They repeat an accessible name, never replace it (shadcn's indigo `bg-primary` tooltip is replaced).
28. **Evidence shows the exact words.** Speech: eyebrow "EVIDENCE · {where} · {t}", the quote at 14px/1.45 with a 2px `--accent-soft` bar, avatar + speaker, and one open action ("Open transcript", "Jump to Sep 22", "Open Sep 22 in the doc", or none when no meeting is on file). Document: eyebrow with file and location, the excerpt, file badge + name, "Read on this Mac", Open.
29. **Flights show where things went.** A glass chip (30px, 12px/600, accent glyph) or a series chip flies on a curved path to its destination row, which then flashes and bumps.

## Components

| Component | Role | Key variants/states | Maps to |
|---|---|---|---|
| Button | Push button | default, primary, record, tinted, plain · sm/md/lg · icon · kbd · block · rest, hover, pressed, focus, disabled | shadcn Button with cva |
| GlassGroup | Toolbar capsule of buttons | day stepper, New + search, doc actions (recording), drawer toggle · item hover/pressed/disabled/on | `<div role="group">` + Button; Radix Toolbar for roving focus |
| SegmentedControl | Single choice, 2–4 options | each position selected · badge (kit) | Radix ToggleGroup `type="single"` + motion thumb |
| TextField | Text entry | md 28, lg 36, textarea · placeholder, focus, filled, disabled | shadcn Input / Textarea |
| SearchField | Search entry | 28, 32 in the popover · rest, focus, filled | cmdk `Command.Input` |
| PopupButton | Pick one value | value or placeholder · pressed, focus, disabled, open | Radix Select (or DropdownMenu + RadioGroup) |
| Switch | On/off | off, on, focus, disabled | Radix Switch |
| Checkbox | Done / watched | round, square, calendar 14px · unchecked, checked, pressed, focus, disabled | Radix Checkbox |
| Chip | Status label | neutral, accent, mint, coral, amber, outline, dashed · shimmer · mini dot (static/live) | shadcn Badge with cva |
| StatusBadge | Knowledge lifecycle | current, completed ("Done"), open, unresolved, disputed, superseded, cancelled | `<StatusBadge status>` |
| KnowledgeType | Knowledge kind | decision, commitment, question, fact · label, icon, tile | `<KnowledgeType type variant>` + lucide |
| SourceChip | Evidence trigger | speech, document, timestamp · rest, hover, pressed, focus | Button (ghost, xs) as `Popover.Trigger` |
| Avatar | Person | 16, 18, 20, 28 · You | shadcn Avatar (initials fallback) |
| AvatarStack | Group of people | 2, 4, overflow +n, extra | `<AvatarStack names max extra>` |
| FileBadge | File type glyph | pdf, docx, md, txt, xlsx, key, other · 16×20, 22×28 | `<FileBadge name>` |
| DocChip | Document | static, button, on card, include dot, add, entering | Button (secondary, sm) / Badge |
| SeriesIcon | Series identity | 16–36 · bump | `<SeriesIcon series size>` |
| SeriesDot | Series swatch | per color | `<SeriesDot color>` |
| Kbd | Shortcut text | standalone, in button, in menu, active row | shadcn Kbd / `DropdownMenuShortcut` |
| Keycap | Physical key | 22, 54×48, wide | `<kbd>` component |
| Spinner | Indeterminate local work | 10, 13, 14 | CSS ring (lucide loader-circle as alternative) |
| Skeleton | Content being prepared | chip, line, short line | shadcn Skeleton with the kit shimmer |
| RecDot | Recording | live, mini (static/pulsing), glyph, paused | `<RecDot variant paused>` |
| Waveform | Listening | 11, 13, 14 · paused | 5 bars |
| ProgressHairline | Short determinate job | idle, growing, fading | `motion.i` scaleX |
| EmptyState | Nothing here yet | bare, badge, with actions, footnote | `<EmptyState icon title description actions footnote badge>` |
| Card | Surface | static, interactive rest/hover/pressed, selected | shadcn Card (+ interactive) |
| ListRow | Picker / search result | rest, hover, selected | cmdk `Command.Item` |
| Collapsible | Disclosure | open, collapsed | Radix Collapsible |
| DropTarget | File landing zone | idle, drag over | drag hook + `data-drop-active`; Tauri drag-drop events |
| Popover | Anchored glass panel | rule, people, history, reference, empty · flipped | Radix Popover |
| Menu | Pull-down menu | text, icon + shortcut, swatch, detail, disabled, danger · title, separator | Radix DropdownMenu |
| ContextMenu | Right-click menu | tracked, untracked, recording | Radix ContextMenu |
| Sheet | Window-modal dialog | opening, open, closing | Radix Dialog |
| Alert | Confirmation | permission, confirm, destructive | Radix AlertDialog |
| Toast | Transient confirmation | plain, icon, Undo, stacked, paused | sonner |
| NotificationBanner | System banner | two actions, one, none, stacked | Native notification (`@tauri-apps/plugin-notification`) |
| Tooltip | Label on hover | delayed, instant, with shortcut | Radix Tooltip + `TooltipProvider` |
| EvidencePopover | Source of a claim | speech (4 open variants), candidate, document | Radix Popover with `<EvidenceSpeech>` / `<EvidenceDocument>` |
| FlyChip | Landing flight | series chip, glyph chip, drag ghost | Portal + two nested `motion.div`s |

Full props and states: component-inventory.md › Button, GlassGroup, SegmentedControl, TextField, SearchField, PopupButton, Switch, Checkbox, Chip, StatusBadge, KnowledgeType, SourceChip, Avatar, AvatarStack, FileBadge, DocChip, SeriesIcon, SeriesDot, Kbd, Keycap, Spinner, Skeleton, RecDot, Waveform, ProgressHairline, EmptyState, Card, ListRow, Collapsible, DropTarget, Popover, Menu, ContextMenu, Sheet, Alert, Toast, NotificationBanner, Tooltip, EvidencePopover, FlyChip.

Installed today: Radix dialog, dropdown-menu, popover, select, switch, tooltip (+ others), cmdk, sonner, framer-motion 11.18, `@tauri-apps/plugin-notification`. To add: `@radix-ui/react-toggle-group`, `-checkbox`, `-collapsible`, `-context-menu`, `-alert-dialog` (and `-toolbar` if GlassGroup gets roving focus).

- **Button.** Rewrite `components/ui/button.tsx` variants (snippet in Motion). Record is its own variant, not `destructive`. `kbd` renders a `<Kbd>` after the label; `aria-keyshortcuts` goes on the button.
- **GlassGroup.** A `role="group"` capsule with `aria-label` ("Day", "Document actions"); children are `Button` in a `glass` context that drops their fill. Separators are `aria-hidden`.
- **SegmentedControl.** ToggleGroup items with one `motion.span` thumb per instance (`layoutId` from `useId()`); the thumb moves only for pointer changes.
- **PopupButton.** Prefer Radix Select styled as the pop-up; its content uses the Menu styling and opens with no animation.
- **Switch / Checkbox.** Keep the kit CSS transitions (the spring and the stroke draw are exact in CSS). Give the switch a focus ring and both a disabled style.
- **Chip.** Badge with cva `tone`; `dot` renders a RecDot mini; `shimmer` adds the Skeleton gradient. Chips are `<span>`; the pressable doc-header meta chip (24px, `--fill`) is a Button variant.
- **SourceChip + EvidencePopover.** One `SourceChip` component owns the popover; the label decides speech or document; the open action closes the popover before opening the transcript drawer.
- **DocChip.** The include dot is a separate `<button aria-pressed>` inside the chip row (002 uses a span with `data-act`).
- **RecDot / Waveform / Spinner / Skeleton.** CSS keyframes (cheapest); production can drive waveform bars from the input level through a motion value.
- **ListRow.** Style cmdk's `data-[selected=true]` as the accent row; no hover or selection animation.
- **Collapsible.** Radix Collapsible with `forceMount` content so the grid-rows transition runs both ways; the header is a real button.
- **DropTarget.** Track dragenter/dragleave with a counter; files dropped from Finder arrive through Tauri's window drag-drop event, not HTML5 `dataTransfer`.
- **Popover.** Radix without an arrow sets its origin to the align edge (0% / 50% / 100%), not the trigger centre (verified in `@radix-ui/react-popper` 1.2.8). Render a zero-size `Popover.Arrow` with `arrowPadding={12}` so Radix reports the anchor centre (snippet below); compare with the catalog's "Live · origin and flip" tile.
- **Menu / ContextMenu.** Remove shadcn's open animation (`fade-in-0 zoom-in-95 slide-in-*`) from `dropdown-menu.tsx`; keep only a 120ms fade-out; add the blink.
- **Sheet / Alert.** Radix Dialog / AlertDialog with `forceMount` + `AnimatePresence`; replace the shadcn overlay (`bg-black/80`) with `--scrim`.
- **Toast.** sonner `toast.custom` renders the capsule; `expand` keeps the kit's flat stack.
- **NotificationBanner.** `sendNotification({ title, body })` after `isPermissionGranted()` / `requestPermission()`. The plugin's desktop code has no action buttons (in the 2.3.3 source `register_action_types` exists only in `mobile.rs`), so Record / Not this time / Review cannot ride on the banner as 003 assumes; the Island's starting pill already offers Record / Skip.
- **Tooltip.** One `TooltipProvider delayDuration={650} skipDelayDuration={600}` at the root; animate only `data-[state=delayed-open]`.
- **FlyChip.** A flight layer portal renders the chip with fixed coordinates measured from the source and target rects; `onAnimationComplete` plays receive + bump on the target.

## Motion

Keyboard rule: keyboard navigation never animates (menu ↑/↓, list selection, segmented changes by key); keyboard commands that change state (Space on a switch or checkbox, Enter to choose) animate like the pointer; Esc plays the normal exit.

| Component | Trigger → properties | Enter / exit | Interrupt | Keyboard | Reduced motion |
|---|---|---|---|---|---|
| Button, GlassGroup item | `:active` → scale 0.97; hover → background | 140 `--ease-out` · colors 150 ease | yes | Space/Enter: no scale; focus ring instant | scale snaps, colors fade |
| Card (interactive) | press → 0.992; hover → `--shadow-card-hover` | 160 `--ease-out` · shadow 200 ease | yes | selection ring (2px accent) instant | scale snaps |
| Chip (button), DocChip | press → 0.97; hover background | 140 `--ease-out` · 150 ease | yes | — | scale snaps |
| SourceChip | press → 0.96 (Island 0.95); hover → accent-soft | 140 `--ease-out` · 150 ease | yes | — | scale snaps |
| Checkbox | fill + ring; tick stroke-dashoffset 14 → 0; press 0.88 | fill 160 ease · tick 220 `--ease-out` after 40 · press 140 | yes (unchecking undraws) | Space same | tick appears at once, fill fades |
| Switch | knob translateX 0 → 14px; track color | knob 600 `--spring-bounce` · track 200 ease | yes | Space same (it is the state change) | knob jumps, track fades |
| SegmentedControl | thumb translateX + width; label color | 240 `--ease-out` · 160 ease | yes | no thumb animation | thumb jumps |
| TextField, SearchField | focus → ring box-shadow | 150 ease both ways | yes | — | unchanged |
| PopupButton | press 0.97; menu instant | 140 · menu 0 / 120 | yes | — | scale snaps |
| Collapsible | grid rows 1fr ↔ 0fr + opacity; chevron 0 ↔ 90° | rows 260 `--ease-out`, opacity 200 ease, chevron 200 `--ease-out` | yes | — | rows and chevron snap, opacity fades |
| DocChip attach / remove | in: opacity, translateY(3px) scale(0.95) → none; out: → 0, scale 0.95 | in 280 `--ease-out`, 40ms apart · out 150 ease-out | in restarts, out runs through | ⌘O attaches the same way | removal instant; chip-in still plays (gap) |
| SeriesIcon | landing → scale 1 → 1.18 (40%) → 1 | 420 `--ease-out` | restart | — | off |
| RecDot | opacity 1 → 0.3 → 1 loop | 1.4s ease-in-out | loop | — | slowed to 2.4s (mini dots not covered: gap) |
| Waveform | bars scaleY 0.3 → 1 loop, delays 0/−200/−450/−650/−100ms | 900ms ease-in-out | loop | — | bars rest at 0.3 |
| Spinner / Skeleton | rotate 360 / background-position 100% → −100% | 700ms linear / 1.3s linear | loop | — | spinner keeps turning (gap) / shimmer stops |
| ProgressHairline | scaleX 0 → 1 from the left, then opacity → 0 | job duration (900 default) linear · fade 220 ease-out | restart | — | not gated (gap) |
| EmptyState | its page fades in: opacity + blur(2px) → 0 | 200 `--ease-out` (220 for Found emptied) | restart | — | instant |
| ListRow | none | — | — | selection instant | — |
| Popover | opacity 0 → 1, scale 0.96 → 1 from the trigger | opacity 150, scale 190 `--ease-out` · exit 110/110, removed at 140 | yes | Esc plays the exit | opacity only |
| Menu, ContextMenu | open: none · choose: row off, on again at 60ms · close: opacity → 0 | 0 · blink 60 · fade 120 from 130, removed at 260 | no | ↑/↓ instant, Enter blinks, Esc fades | unchanged |
| Sheet | scrim opacity; sheet opacity + scale 0.96 → 1 | scrim 220 ease · 200 / 260 `--ease-out` · exit 140 / 160, removed at 200 | yes | Esc closes; first field focused after 60ms | opacity only |
| Alert | opacity + scale 0.95 → 1 | 180 / 220 `--ease-out` · exit 120 / 140, removed at 160 | yes | Enter = primary, Esc = cancel, both play the exit | opacity only |
| Toast | opacity; translateY(14px) scale(0.98) → none; exit translateY(10px) scale(0.98) | opacity 220 ease, transform 340 `--ease-out` · exit 160 / 180, removed at 200 | yes; hover pauses the 4.2s timer | Undo button | opacity only |
| NotificationBanner | translateX(calc(100% + 24px)) → none | 490 `--spring` · exit 240 `--ease-in-out`, removed at 260 | yes; hover pauses the 7s timer, leaving restarts 2.5s | — | appears and leaves in place |
| Tooltip | opacity + scale 0.97 → 1, origin top center | 650 wait, then 125 `--ease-out`; warm 0ms | leaving before 650 cancels | pointer-only in 002 | scale snaps |
| EvidencePopover | as Popover; Open transcript closes it, then the drawer slides in | 190 / 110 · drawer 300 `--ease-drawer` | yes | Esc returns focus to the chip | opacity only |
| FlyChip | outer x; inner y + scale → clamp(0.4, target h / source h, 1) + opacity → 0.35 | 560 (onboarding 620): x `cubic-bezier(0.45, 0, 0.2, 1)`, y `cubic-bezier(0.6, 0, 0.9, 0.7)`; then receive 900 + bump 420 | no | ⌥⌘N → Enter flies too (it confirms a creation) | no flight; the target receives |

Button (cva, CSS transitions per property):

```tsx
import { cva, type VariantProps } from 'class-variance-authority'

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-medium [transition:transform_140ms_var(--ease-out),background-color_150ms_ease,box-shadow_150ms_ease,color_150ms_ease] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-[0.45] [&_kbd]:text-inherit [&_kbd]:opacity-60',
  {
    variants: {
      variant: {
        default: 'bg-fill-2 text-label hover:bg-fill-3',
        primary: 'bg-accent text-accent-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_1px_2px_rgba(23,25,31,0.14)] hover:bg-accent-strong',
        record: 'bg-coral text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_1px_2px_rgba(23,25,31,0.14)] hover:bg-coral-ink',
        tinted: 'bg-accent-soft text-accent-strong hover:text-accent',
        plain: 'bg-transparent hover:bg-fill',
      },
      size: {
        sm: 'h-6 px-2.5 text-[12px]',
        md: 'h-7 px-3 text-[13px]',
        lg: 'h-[34px] px-4 text-[14px]',
      },
      icon: { true: 'px-0' },
    },
    compoundVariants: [
      { size: 'sm', icon: true, class: 'w-6' },
      { size: 'md', icon: true, class: 'w-7' },
    ],
    defaultVariants: { variant: 'default', size: 'md' },
  },
)

export type ButtonVariantProps = VariantProps<typeof buttonVariants>
```

SegmentedControl (pointer changes slide the thumb, keyboard changes do not):

```tsx
interface SegmentedControlProps {
  options: { value: string; label: string }[]
  value: string
  onValueChange: (value: string) => void
}

export function SegmentedControl({ options, value, onValueChange }: SegmentedControlProps) {
  const id = useId()
  const viaPointer = useRef(false)
  const [animate, setAnimate] = useState(false)
  const change = (next: string) => {
    if (!next) return
    setAnimate(viaPointer.current)
    viaPointer.current = false
    onValueChange(next)
  }
  return (
    <ToggleGroup.Root type="single" value={value} onValueChange={change} onPointerDown={() => { viaPointer.current = true }} className="inline-flex h-7 rounded-full bg-fill-2 p-0.5">
      {options.map((option) => (
        <ToggleGroup.Item key={option.value} value={option.value} className="relative h-6 rounded-full px-3 text-[12px] font-medium text-label-2 transition-colors duration-[160ms] data-[state=on]:text-label">
          {option.value === value && (
            <motion.span layoutId={`seg-${id}`} transition={animate ? { duration: 0.24, ease: EASE.out } : INSTANT} className="absolute inset-0 rounded-full bg-content shadow-[0_1px_3px_rgba(23,25,31,0.13),0_0_0_0.5px_rgba(23,25,31,0.06)]" />
          )}
          <span className="relative">{option.label}</span>
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  )
}
```

Popover (origin at the trigger centre, asymmetric enter/exit):

```tsx
<Popover.Root open={open} onOpenChange={setOpen}>
  <Popover.Trigger asChild>{trigger}</Popover.Trigger>
  <AnimatePresence>
    {open && (
      <Popover.Portal forceMount>
        <Popover.Content forceMount asChild align="start" sideOffset={8} collisionPadding={8} arrowPadding={12}>
          <motion.div
            className="z-[150] min-w-[220px] rounded-[14px] bg-glass-strong p-1.5 shadow-float backdrop-blur-[26px] backdrop-saturate-[1.8]"
            style={{ transformOrigin: 'var(--radix-popover-content-transform-origin)' }}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1, transition: PRESET.popoverIn }}
            exit={{ opacity: 0, scale: 0.96, transition: PRESET.popoverOut }}
          >
            {children}
            <Popover.Arrow width={0} height={0} />
          </motion.div>
        </Popover.Content>
      </Popover.Portal>
    )}
  </AnimatePresence>
</Popover.Root>
```

Menu (instant open, 60ms blink, 120ms fade; `open` is controlled):

```tsx
<DropdownMenu.Content sideOffset={4} collisionPadding={8} loop className="z-[160] min-w-[210px] rounded-[12px] bg-glass-strong p-[5px] text-[13px] shadow-float backdrop-blur-[26px] backdrop-saturate-[1.8] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-[120ms]">
  <DropdownMenu.Item
    data-blink={blinking === item.id || undefined}
    onSelect={(event) => {
      event.preventDefault()
      setBlinking(item.id)
      window.setTimeout(() => setBlinking(null), 60)
      window.setTimeout(() => { setOpen(false); item.onSelect() }, 130)
    }}
    className="flex h-6 items-center gap-2 rounded-[6px] px-[9px] outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[blink]:bg-transparent data-[blink]:text-label data-[disabled]:text-label-3"
  />
</DropdownMenu.Content>
```

Sheet and Alert (same pattern; Sheet uses 0.96 / 260 / 160 and a scrim, Alert 0.95 / 220 / 140):

```tsx
<AlertDialog.Root open={open} onOpenChange={setOpen}>
  <AnimatePresence>
    {open && (
      <AlertDialog.Portal forceMount>
        <AlertDialog.Content forceMount asChild>
          <motion.div
            className="fixed left-1/2 top-[42%] z-[400] w-[280px] rounded-[20px] bg-glass-strong px-[18px] pb-4 pt-[22px] text-center shadow-window backdrop-blur-[34px] backdrop-saturate-[1.8]"
            style={{ x: '-50%', y: '-50%' }}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1, transition: { duration: DURATION.alertOpen, ease: EASE.out, opacity: { duration: 0.18 } } }}
            exit={{ opacity: 0, scale: 0.95, transition: { duration: DURATION.alertClose, ease: EASE.out, opacity: { duration: 0.12 } } }}
          />
        </AlertDialog.Content>
      </AlertDialog.Portal>
    )}
  </AnimatePresence>
</AlertDialog.Root>
```

Centre with framer's `x` / `y` (as above), not Tailwind translate classes: framer writes the whole inline `transform`, which would drop a class-based translate.

Toast (sonner, kit capsule, flat stack):

```tsx
<Toaster position="bottom-center" expand gap={8} offset={18} duration={4200} toastOptions={{ unstyled: true }} />

interface ShowToastOptions {
  icon?: LucideIcon
  undo?: () => void
}

export function showToast(text: string, { icon: Icon = CircleCheck, undo }: ShowToastOptions = {}) {
  return toast.custom((id) => (
    <div role="status" className="mx-auto flex min-h-[38px] w-fit items-center gap-2.5 whitespace-nowrap rounded-full bg-glass-strong py-[5px] pl-3.5 pr-4 text-[13px] shadow-float backdrop-blur-[24px] backdrop-saturate-[1.8] has-[button]:pr-[5px]">
      <Icon size={16} strokeWidth={1.6} className="text-accent" aria-hidden />
      <span>{text}</span>
      {undo && <Button size="sm" variant="tinted" onClick={() => { undo(); toast.dismiss(id) }}>Undo</Button>}
    </div>
  ))
}
```

```css
[data-sonner-toaster] [data-sonner-toast] {
  transition: transform 340ms var(--ease-out), opacity 220ms ease, height 340ms var(--ease-out), box-shadow 200ms ease;
}
[data-sonner-toaster] [data-sonner-toast][data-mounted='false'] {
  --y: translateY(14px) scale(0.98);
}
[data-sonner-toaster] [data-sonner-toast][data-removed='true'][data-front='true'][data-swipe-out='false'] {
  --y: translateY(10px) scale(0.98);
  transition-duration: 180ms, 160ms, 180ms, 200ms;
}
```

sonner's own CSS (2.0.7) enters from `translateY(100%)` over 400ms, stacks the newest toast in front at the bottom and lifts older ones; the kit instead keeps the first toast at the bottom and stacks newer ones above it (`column-reverse` + append). Accept sonner's order (003's Toast · enter, stack, exit entry already describes newest-at-bottom). sonner also drops all toast transitions under reduced motion. sonner resumes after hover with the remaining time, without the kit's 1.2s minimum.

Tooltip:

```tsx
<TooltipProvider delayDuration={650} skipDelayDuration={600}>{app}</TooltipProvider>

<Tooltip.Content side="bottom" sideOffset={6} collisionPadding={8} className="z-[1000] rounded-[6px] bg-glass-strong px-2 py-[3px] text-[11px] text-label shadow-float backdrop-blur-[20px] origin-[--radix-tooltip-content-transform-origin] data-[state=delayed-open]:animate-[tip-in_125ms_var(--ease-out)] data-[state=closed]:animate-[tip-out_125ms_var(--ease-out)]" />
```

```css
@keyframes tip-in { from { opacity: 0; transform: scale(0.97); } }
@keyframes tip-out { to { opacity: 0; transform: scale(0.97); } }
```

Radix reports `instant-open` for warm tooltips, which gets no animation (the kit's `.instant`). It also closes on pointerdown, like the kit.

FlyChip (portal flight):

```tsx
<motion.div
  className="pointer-events-none fixed z-[5000]"
  style={{ left: from.left, top: from.top }}
  initial={{ x: 0 }}
  animate={{ x: to.left - from.left }}
  transition={{ duration: DURATION.flight, ease: EASE.flightX }}
>
  <motion.div
    className="rounded-[10px] bg-glass-strong shadow-float"
    style={{ transformOrigin: 'left center' }}
    initial={{ y: 0, scale: 1, opacity: 1 }}
    animate={{ y: to.top + to.height / 2 - (from.top + from.height / 2), scale: Math.min(1, Math.max(0.4, to.height / from.height)), opacity: 0.35 }}
    transition={{ duration: DURATION.flight, ease: EASE.flightY }}
    onAnimationComplete={onLand}
  >
    {chip}
  </motion.div>
</motion.div>
```

Switch, Checkbox and Collapsible keep the kit CSS transitions (below) on Radix parts: the switch thumb uses `transition: transform var(--spring-bounce-dur) var(--spring-bounce)` with `data-[state=checked]:translate-x-[14px]`; the checkbox indicator needs `forceMount` so the tick can undraw; the collapsible content needs `forceMount` and drives `grid-template-rows` from `data-state`. framer alternatives from 003: switch knob `animate={{ x: checked ? 14 : 0 }}` with `SPRING_BOUNCE`; tick `motion.path` `pathLength` 0 → 1 (0.22s, delay 0.04, `EASE.out`); collapsible `height: 'auto' ↔ 0` (0.26s `EASE.out`, opacity 0.2s).

## CSS Patterns

Tokens: foundations-and-motion.md. Hover rules sit in `@media (hover: hover) and (pointer: fine)` (grouped at the end of each block here).

### Button and GlassGroup

```css
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 28px; padding: 0 12px; border: 0; border-radius: 999px; font-size: 13px; font-weight: 500; white-space: nowrap; background: var(--fill-2); color: var(--label); transition: transform 140ms var(--ease-out), background-color 150ms ease, box-shadow 150ms ease, color 150ms ease; }
.btn:active { transform: scale(0.97); }
.btn.primary { background: var(--accent); color: var(--on-accent); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.18), 0 1px 2px rgba(23, 25, 31, 0.14); }
.btn.record { background: var(--coral); color: #fff; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.22), 0 1px 2px rgba(23, 25, 31, 0.14); }
.btn.plain { background: transparent; }
.btn.tinted { background: var(--accent-soft); color: var(--accent-strong); }
.btn.icon { width: 28px; padding: 0; }
.btn.sm { height: 24px; padding: 0 10px; font-size: 12px; }
.btn.sm.icon { width: 24px; padding: 0; }
.btn.lg { height: 34px; padding: 0 16px; font-size: 14px; }
.btn .kbd { color: inherit; opacity: 0.6; }
.btn:disabled { opacity: 0.45; pointer-events: none; }
.tb-record .rec-glyph { width: 9px; height: 9px; border-radius: 50%; background: var(--coral); box-shadow: 0 0 0 2.5px var(--coral-soft); }
.tb-record.live { color: var(--coral-ink); }
.tb-record .tb-timer { min-width: 30px; }
.danger-text { color: var(--coral-ink); }

.glass-group { display: inline-flex; align-items: center; height: 34px; padding: 3px; border-radius: 999px; background: var(--glass-strong); backdrop-filter: blur(16px) saturate(1.6); -webkit-backdrop-filter: blur(16px) saturate(1.6); box-shadow: 0 0 0 0.5px var(--glass-edge), inset 0 0.5px 0 var(--glass-rim), 0 2px 10px rgba(23, 25, 31, 0.06); }
.glass-group .btn { height: 28px; background: transparent; }
.glass-group .sep { width: 0.5px; height: 16px; margin: 0 2px; background: var(--hairline); }

@media (hover: hover) and (pointer: fine) {
  .btn:hover { background: var(--fill-3); }
  .btn.primary:hover { background: var(--accent-strong); }
  .btn.record:hover { background: var(--coral-ink); }
  .btn.plain:hover { background: var(--fill); }
  .btn.tinted:hover { background: var(--accent-soft); color: var(--accent); }
  .glass-group .btn:hover { background: var(--fill-2); }
}
```

### SegmentedControl, fields, PopupButton

```css
.seg { position: relative; display: inline-flex; height: 28px; padding: 2px; border-radius: 999px; background: var(--fill-2); }
.seg > button { position: relative; z-index: 1; display: inline-flex; align-items: center; gap: 5px; height: 24px; padding: 0 12px; border: 0; border-radius: 999px; background: transparent; font-size: 12px; font-weight: 500; color: var(--label-2); white-space: nowrap; transition: color 160ms ease; }
.seg > button[aria-selected="true"] { color: var(--label); }
.seg-thumb { position: absolute; top: 2px; left: 0; height: 24px; border-radius: 999px; background: var(--content-bg); box-shadow: 0 1px 3px rgba(23, 25, 31, 0.13), 0 0 0 0.5px rgba(23, 25, 31, 0.06); transition: transform 240ms var(--ease-out), width 240ms var(--ease-out); }
.seg .badge { display: inline-grid; place-items: center; min-width: 16px; height: 16px; padding: 0 5px; border-radius: 999px; font-size: 10px; font-weight: 600; background: var(--accent); color: #fff; }

.field { height: 28px; padding: 0 10px; border: 0; outline: none; border-radius: 8px; font: 13px var(--font); color: var(--label); background: var(--content-bg); box-shadow: inset 0 0 0 0.5px var(--hairline), 0 0.5px 1px rgba(23, 25, 31, 0.04); transition: box-shadow 150ms ease; }
.field::placeholder { color: var(--label-3); }
.field:focus { box-shadow: inset 0 0 0 0.5px var(--accent), 0 0 0 3.5px color-mix(in srgb, var(--accent) 32%, transparent); }
.field.lg { height: 36px; padding: 0 12px; border-radius: 10px; font-size: 15px; }
textarea.field { height: auto; padding: 8px 10px; line-height: 1.45; resize: none; }
.search { position: relative; display: flex; align-items: center; }
.search .i { position: absolute; left: 9px; width: 14px; height: 14px; color: var(--label-3); pointer-events: none; }
.search .field { width: 100%; padding-left: 30px; border-radius: 999px; background: var(--fill); box-shadow: none; }
.search .field:focus { background: var(--content-bg); box-shadow: 0 0 0 3.5px color-mix(in srgb, var(--accent) 32%, transparent); }
.a-search .search .field { height: 32px; }

.btn.popup { height: 24px; padding: 0 8px 0 10px; border-radius: 7px; font-weight: 400; background: var(--content-bg); box-shadow: 0 0 0 0.5px var(--hairline), 0 1px 1.5px rgba(23, 25, 31, 0.06); }
.btn.popup .i { width: 11px; height: 11px; margin-left: 2px; color: var(--label-2); }
@media (hover: hover) and (pointer: fine) { .btn.popup:hover { background: var(--content-bg); } }
```

### Switch and Checkbox

```css
.switch { position: relative; flex: none; width: 32px; height: 18px; padding: 0; border: 0; border-radius: 999px; background: var(--fill-3); transition: background-color 200ms ease; }
.switch::after { content: ""; position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: #fff; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.22), 0 0 0 0.5px rgba(0, 0, 0, 0.04); transition: transform var(--spring-bounce-dur) var(--spring-bounce); }
.switch[aria-checked="true"] { background: var(--accent); }
.switch[aria-checked="true"]::after { transform: translateX(14px); }
.switch:disabled { opacity: 0.45; }

.check { flex: none; display: inline-grid; place-items: center; width: 17px; height: 17px; padding: 0; border: 0; border-radius: 50%; background: transparent; box-shadow: inset 0 0 0 1.3px var(--label-4); transition: background-color 160ms ease, box-shadow 160ms ease, transform 140ms var(--ease-out); }
.check.square { border-radius: 5px; }
.check:active { transform: scale(0.88); }
.check svg { width: 11px; height: 11px; fill: none; stroke: #fff; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 14; stroke-dashoffset: 14; transition: stroke-dashoffset 220ms var(--ease-out) 40ms; }
.check[aria-checked="true"] { background: var(--accent); box-shadow: none; }
.check[aria-checked="true"] svg { stroke-dashoffset: 0; }
.a-cal .check.a-cal-check { width: 14px; height: 14px; border-radius: 4px; box-shadow: inset 0 0 0 1.3px var(--cal); pointer-events: none; }
.a-cal .check.a-cal-check[aria-checked="true"] { background: var(--cal); box-shadow: none; }
.a-cal .check.a-cal-check svg { width: 9px; height: 9px; }
```

### Chip, StatusBadge, KnowledgeType, SourceChip

```css
.chip { display: inline-flex; align-items: center; gap: 4px; height: 20px; padding: 0 8px; border-radius: 999px; font-size: 11px; font-weight: 500; white-space: nowrap; background: var(--fill-2); color: var(--label-2); }
.chip .i { width: 12px; height: 12px; stroke-width: 1.8; }
.chip.accent { background: var(--accent-soft); color: var(--accent-strong); }
.chip.mint { background: var(--mint-soft); color: var(--mint-ink); }
.chip.coral { background: var(--coral-soft); color: var(--coral-ink); }
.chip.amber { background: var(--amber-soft); color: var(--amber); }
.chip.outline { background: transparent; box-shadow: inset 0 0 0 1px var(--separator); }
.chip.dashed { background: transparent; outline: 1px dashed var(--label-4); outline-offset: -1px; }
.a-chip-prep { color: var(--label-2); }
.a-chip-filed .i { color: var(--label-3); }
.countdown { height: 22px; }
.a-mini-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--coral); flex: none; }
.a-card.is-starting .a-mini-dot { animation: kit-rec 1.4s ease-in-out infinite; }
.countdown .mini-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--coral); animation: kit-rec 1.4s ease-in-out infinite; }
.meta-chip { height: 24px; padding: 0 10px; gap: 6px; border: 0; font-size: 12px; background: var(--fill); color: var(--label-2); transition: background-color 150ms ease, color 150ms ease, transform 140ms var(--ease-out); }
button.meta-chip:active { transform: scale(0.97); }

.status { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; color: var(--label-2); white-space: nowrap; }
.status::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: var(--c, var(--label-3)); }
.status[data-s="current"], .status[data-s="completed"] { --c: var(--series-green); }
.status[data-s="open"] { --c: var(--accent); }
.status[data-s="unresolved"], .status[data-s="disputed"] { --c: var(--amber); }
.status[data-s="superseded"], .status[data-s="cancelled"] { --c: var(--label-4); }

.ktype { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 600; color: var(--c); }
.ktype .i { width: 13px; height: 13px; stroke-width: 1.9; }
.ktype[data-type="decision"], .k-ico[data-type="decision"] { --c: var(--accent); }
.ktype[data-type="commitment"], .k-ico[data-type="commitment"] { --c: var(--series-orange); }
.ktype[data-type="question"], .k-ico[data-type="question"] { --c: var(--amber); }
.ktype[data-type="fact"], .k-ico[data-type="fact"] { --c: var(--series-teal); }
.k-ico { flex: none; display: grid; place-items: center; width: 22px; height: 22px; border-radius: 7px; color: var(--c); background: color-mix(in srgb, var(--c) 14%, transparent); }

.source { display: inline-flex; align-items: center; gap: 3px; height: 18px; padding: 0 6px; border: 0; border-radius: 5px; font-size: 10.5px; font-weight: 500; color: var(--label-2); background: var(--fill); font-variant-numeric: tabular-nums; white-space: nowrap; transition: background-color 150ms ease, color 150ms ease; }
.source .i { width: 10px; height: 10px; stroke-width: 2; }
.doc-surface .source, .island .source { transition: background-color 150ms ease, color 150ms ease, transform 140ms var(--ease-out); }
.doc-surface .source:active { transform: scale(0.96); }
.island .source:active { transform: scale(0.95); }

@media (hover: hover) and (pointer: fine) {
  button.meta-chip:hover { background: var(--fill-2); color: var(--label); }
  .source:hover { background: var(--accent-soft); color: var(--accent-strong); }
}
```

### Avatar, FileBadge, DocChip, SeriesIcon, Kbd, Keycap

```css
.avatar { display: inline-grid; place-items: center; flex: none; width: 20px; height: 20px; border-radius: 50%; font-size: 8.5px; font-weight: 600; letter-spacing: 0.02em; color: #fff; background: var(--c, #8E8E93); box-shadow: 0 0 0 1.5px var(--content-bg); }
.avatar.lg { width: 28px; height: 28px; font-size: 11px; }
.avatars { display: inline-flex; align-items: center; }
.avatars .avatar + .avatar { margin-left: -5px; }
.avatars .more { margin-left: 5px; font-size: 11px; color: var(--label-2); }
.a-meta .avatar { width: 18px; height: 18px; font-size: 7.5px; box-shadow: 0 0 0 1.5px var(--surface); }
.a-meta .avatars .avatar + .avatar, .meta-chip .avatars .avatar + .avatar { margin-left: -4px; }
.meta-chip .avatars .avatar, .mem-meta .owner .avatar { width: 16px; height: 16px; font-size: 6.5px; }

.ftype { position: relative; flex: none; display: grid; place-items: end center; width: 16px; height: 20px; padding-bottom: 2.5px; border-radius: 3px; background: var(--c, #8E8E93); color: #fff; font-size: 6.5px; font-weight: 800; letter-spacing: 0.02em; box-shadow: inset 0 0 0 0.5px rgba(0, 0, 0, 0.08); }
.ftype::before { content: ""; position: absolute; top: 0; right: 0; width: 5px; height: 5px; background: linear-gradient(225deg, var(--content-bg) 50%, rgba(255, 255, 255, 0.55) 50%); border-bottom-left-radius: 1.5px; }
.ftype[data-kind="pdf"] { --c: #E5484D; }
.ftype[data-kind="docx"] { --c: #2F6BD8; }
.ftype[data-kind="txt"], .ftype[data-kind="md"] { --c: #8E8E93; }
.ftype[data-kind="xlsx"] { --c: #1F9A55; }
.ftype[data-kind="key"] { --c: #2E8FF0; }
.ref-pop-head .ftype { width: 22px; height: 28px; font-size: 8px; }

.doc-chip { display: inline-flex; align-items: center; gap: 7px; max-width: 100%; height: 30px; padding: 0 10px 0 7px; border-radius: 9px; background: var(--fill); font-size: 12px; }
.doc-chip small { font-size: 11px; color: var(--label-3); }
button.doc-chip { border: 0; color: var(--label); transition: transform 140ms var(--ease-out), background-color 150ms ease, box-shadow 150ms ease; }
button.doc-chip:active { transform: scale(0.97); }
.next-docs .doc-chip { background: var(--content-bg); box-shadow: var(--shadow-card); }
.inc-dot { flex: none; width: 7px; height: 7px; margin-left: 1px; border-radius: 50%; background: var(--accent); transition: background-color 150ms ease, box-shadow 150ms ease; }
.inc-dot.off { background: transparent; box-shadow: inset 0 0 0 1.3px var(--label-3); }
.add-chip { gap: 5px; padding: 0 11px 0 9px; background: transparent; color: var(--label-2); box-shadow: inset 0 0 0 1px var(--separator); }
.chip-in { animation: chip-in 280ms var(--ease-out) both; }
@keyframes chip-in { from { opacity: 0; transform: translateY(3px) scale(0.95); } }

.series-icon { display: grid; place-items: center; flex: none; width: 20px; height: 20px; border-radius: 50%; background: var(--c, var(--series-gray)); color: #fff; }
.series-icon .i { width: 12px; height: 12px; stroke-width: 2; }
.series-icon.lg { width: 36px; height: 36px; }
.series-icon.lg .i { width: 20px; height: 20px; }
.series-icon.a-xs { width: 16px; height: 16px; }
.series-icon.a-xs .i { width: 9px; height: 9px; stroke-width: 2.2; }
.series-dot { flex: none; width: 8px; height: 8px; border-radius: 50%; background: var(--c, var(--series-gray)); }

.kbd { font-size: 11px; font-weight: 500; color: var(--label-3); letter-spacing: 0.03em; white-space: nowrap; }
.keycap { display: inline-grid; place-items: center; min-width: 22px; height: 22px; padding: 0 6px; border-radius: 6px; font-size: 12px; font-weight: 500; background: var(--content-bg); box-shadow: 0 0 0 0.5px var(--hairline), 0 1px 0 var(--hairline); }
.ob-keys .keycap { min-width: 54px; height: 48px; border-radius: 10px; font-size: 20px; }
.ob-keys .keycap.wide { min-width: 150px; font-size: 15px; }

@media (hover: hover) and (pointer: fine) {
  button.doc-chip:hover { background: var(--fill-2); }
  .next-docs button.doc-chip:hover { background: var(--content-bg); box-shadow: var(--shadow-card-hover); }
}
```

Context sizes: sidebar series icon 18 (glyph 10), proposal cards 30 (glyph 15), Island head 28 (glyph 15).

### Indicators

```css
.rec-dot { flex: none; width: 8px; height: 8px; border-radius: 50%; background: var(--coral); animation: kit-rec 1.4s ease-in-out infinite; }
@keyframes kit-rec { 50% { opacity: 0.3; } }
.island .rec-dot.paused { animation: none; opacity: 0.45; }

.wave { display: inline-flex; align-items: center; gap: 2px; height: 14px; }
.wave i { width: 2.5px; height: 100%; border-radius: 2px; background: currentColor; transform: scaleY(0.3); animation: kit-wave 900ms ease-in-out infinite; }
.wave i:nth-child(2) { animation-delay: -200ms; }
.wave i:nth-child(3) { animation-delay: -450ms; }
.wave i:nth-child(4) { animation-delay: -650ms; }
.wave i:nth-child(5) { animation-delay: -100ms; }
@keyframes kit-wave { 50% { transform: scaleY(1); } }
.a-wave { height: 11px; color: var(--coral); }
.a-wave i { width: 2px; }
.il-wave { height: 13px; color: var(--coral); }
.island .wave.paused i { animation: none; transform: scaleY(0.3); }

.spinner { width: 14px; height: 14px; border-radius: 50%; border: 2px solid var(--fill-3); border-top-color: var(--label-2); animation: kit-spin 700ms linear infinite; }
.spinner.tiny { width: 10px; height: 10px; border-width: 1.5px; }
@keyframes kit-spin { to { transform: rotate(360deg); } }

.shimmer { background: linear-gradient(90deg, var(--fill) 0%, var(--fill-3) 50%, var(--fill) 100%); background-size: 200% 100%; animation: kit-shimmer 1.3s linear infinite; }
@keyframes kit-shimmer { from { background-position: 100% 0; } to { background-position: -100% 0; } }
.prep-lines { display: flex; flex-direction: column; gap: 10px; margin-top: 16px; }
.prep-lines .shimmer { height: 10px; border-radius: 5px; }
.prep-lines .short { width: 58%; }

.a-progress { position: absolute; left: 0; right: 0; bottom: -1px; height: 2px; background: var(--accent); transform: scaleX(0); transform-origin: left center; opacity: 0; pointer-events: none; }
```

### EmptyState, Card, ListRow, Collapsible, DropTarget

```css
.empty { display: grid; place-items: center; gap: 10px; padding: 40px 24px; text-align: center; color: var(--label-2); }
.empty .i.xl { color: var(--label-3); }
.empty h3 { margin: 0; font: 600 17px/1.25 var(--font-display); letter-spacing: -0.01em; color: var(--label); }
.empty p { margin: 0; max-width: 340px; }
.a-first { flex: 1; display: grid; place-items: center; padding-bottom: 48px; }
.a-first .empty { max-width: 440px; gap: 12px; }
.a-empty-badge { display: grid; place-items: center; width: 56px; height: 56px; border-radius: 16px; background: var(--accent-soft); color: var(--accent); }
.empty .a-empty-badge .i.xl { color: inherit; }
.a-empty-badge.a-badge-lg { width: 72px; height: 72px; border-radius: 20px; }
.a-empty-badge.is-off { background: var(--fill-2); color: var(--label-3); }
.a-empty-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin-top: 6px; }
.a-local { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; color: var(--label-3); white-space: nowrap; }
.a-caught { padding: 28px 12px 22px; }
.a-caught .a-empty-badge { width: 52px; height: 52px; }

.card { background: var(--surface); border-radius: var(--r-card); box-shadow: var(--shadow-card); }
.card.interactive { transition: box-shadow 200ms ease, transform 160ms var(--ease-out); }
.card.interactive:active { transform: scale(0.992); }
.a-card::after { content: ""; position: absolute; inset: 0; border-radius: inherit; box-shadow: 0 0 0 2px var(--accent); opacity: 0; pointer-events: none; }
.a-card.is-selected::after { opacity: 1; }
.well { background: var(--surface-sunken); border-radius: var(--r-card); }

.row { display: flex; align-items: center; gap: 10px; min-height: 28px; padding: 4px 10px; border-radius: 8px; }
.row.selected { background: var(--accent); color: var(--on-accent); }
.row.selected .muted, .row.selected .faint, .row.selected .kbd { color: rgba(255, 255, 255, 0.78); }
.row.a-hit { gap: 8px; min-height: 32px; font-size: 13px; }
.a-hit-meta { max-width: 40%; font-size: 11px; }

.collapsible { display: grid; grid-template-rows: 1fr; transition: grid-template-rows 260ms var(--ease-out), opacity 200ms ease; }
.collapsible > * { overflow: hidden; min-height: 0; }
.collapsible.collapsed { grid-template-rows: 0fr; opacity: 0; }
.disclosure { transition: transform 200ms var(--ease-out); }
.open > .disclosure, .disclosure.open { transform: rotate(90deg); }

.drop-target { outline: 2px dashed color-mix(in srgb, var(--accent) 70%, transparent); outline-offset: -6px; background-color: var(--accent-softer); }
.next-docs { margin: 18px -10px 0; padding: 0 10px 8px; border-radius: 12px; transition: background-color 150ms ease; }
.next-docs.drop-target { outline-offset: -1px; }
.purpose::after { content: ""; position: absolute; inset: -14px -18px; z-index: -1; border-radius: 18px; border: 1.5px dashed color-mix(in srgb, var(--accent) 60%, transparent); background: var(--accent-softer); opacity: 0; pointer-events: none; transition: opacity 150ms ease; }
.purpose.drop-target { outline: none; background: none; }
.purpose.drop-target::after { opacity: 1; }
.drop-hint { position: absolute; top: -26px; right: -8px; z-index: 2; display: flex; align-items: center; gap: 6px; height: 26px; padding: 0 11px; border-radius: 999px; background: var(--accent); color: var(--on-accent); font-size: 12px; font-weight: 500; box-shadow: var(--shadow-float); opacity: 0; transform: translateY(4px) scale(0.97); pointer-events: none; transition: opacity 150ms var(--ease-out), transform 200ms var(--ease-out); }
.drop-target > .drop-hint { opacity: 1; transform: none; }

@media (hover: hover) and (pointer: fine) {
  .card.interactive:hover { box-shadow: var(--shadow-card-hover); }
  .row.hoverable:hover:not(.selected) { background: var(--fill); }
}
```

### Popover and Menu

```css
.popover { position: absolute; z-index: 150; min-width: 220px; padding: 6px; border-radius: 14px; background: var(--glass-strong); backdrop-filter: blur(26px) saturate(1.8); -webkit-backdrop-filter: blur(26px) saturate(1.8); box-shadow: var(--shadow-float); opacity: 0; transform: scale(0.96); transform-origin: var(--origin, top center); transition: opacity 150ms var(--ease-out), transform 190ms var(--ease-out); pointer-events: none; }
.popover.open { opacity: 1; transform: none; pointer-events: auto; }
.popover.closing { transition-duration: 110ms, 110ms; }
.pop { padding: 8px 10px 10px; }
.pop-row { display: flex; align-items: flex-start; gap: 10px; }
.pop-row > .i { margin-top: 1px; color: var(--accent); }
.pop-row .muted { margin-top: 2px; font-size: 12px; line-height: 1.4; }
.pop-sub { margin: 8px 0 0 26px; font-size: 12px; color: var(--label-3); }
.pop-actions { display: flex; align-items: center; gap: 6px; margin-top: 12px; }
.pop-title { margin-bottom: 6px; font-size: 11px; font-weight: 600; color: var(--label-3); }
.pop-person { display: flex; align-items: center; gap: 9px; height: 28px; }
.pop-foot { display: flex; align-items: center; gap: 6px; margin-top: 10px; padding-top: 9px; font-size: 11px; color: var(--label-3); box-shadow: inset 0 0.5px 0 var(--separator); }
.pop-empty { padding: 6px 0; color: var(--label-2); }
.pop-switch { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 12px; padding: 10px 0; box-shadow: inset 0 0.5px 0 var(--separator), inset 0 -0.5px 0 var(--separator); }

.menu { position: absolute; z-index: 160; min-width: 210px; padding: 5px; border-radius: 12px; background: var(--glass-strong); backdrop-filter: blur(26px) saturate(1.8); -webkit-backdrop-filter: blur(26px) saturate(1.8); box-shadow: var(--shadow-float); font-size: 13px; outline: none; transition: opacity 120ms ease; }
.menu.closing { opacity: 0; pointer-events: none; }
.menu-item { display: flex; align-items: center; gap: 8px; height: 24px; padding: 0 9px; border-radius: 6px; white-space: nowrap; }
.menu-item .i { width: 14px; height: 14px; color: var(--label-2); }
.menu-item .kbd { margin-left: auto; padding-left: 18px; }
.menu-item.active { background: var(--accent); color: #fff; }
.menu-item.active .i, .menu-item.active .kbd { color: rgba(255, 255, 255, 0.85); }
.menu-item.danger { color: var(--coral-ink); }
.menu-item.danger.active { background: var(--coral); color: #fff; }
.menu-item.disabled { color: var(--label-3); pointer-events: none; }
.menu-sep { height: 0.5px; margin: 5px 9px; background: var(--separator); }
.menu-title { padding: 5px 9px 3px; font-size: 11px; font-weight: 600; color: var(--label-3); }
```

### Sheet, Alert, Toast, NotificationBanner, Tooltip, Evidence, FlyChip

```css
.scrim { position: absolute; inset: 0; z-index: 180; background: var(--scrim); opacity: 0; transition: opacity 220ms ease; }
.scrim.open { opacity: 1; }
.sheet { position: absolute; left: 50%; top: 50%; z-index: 181; width: min(var(--sheet-w, 520px), calc(100% - 48px)); max-height: calc(100% - 64px); overflow: auto; border-radius: 20px; background: var(--glass-strong); backdrop-filter: blur(34px) saturate(1.8); -webkit-backdrop-filter: blur(34px) saturate(1.8); box-shadow: var(--shadow-window); opacity: 0; transform: translate(-50%, -50%) scale(0.96); transition: opacity 200ms var(--ease-out), transform 260ms var(--ease-out); }
.sheet.open { opacity: 1; transform: translate(-50%, -50%) scale(1); }
.sheet.closing { transition-duration: 140ms, 160ms; }
.sheet-head { padding: 20px 22px 6px; }
.sheet-head h2 { margin: 0; font: 700 17px/1.25 var(--font-display); letter-spacing: -0.012em; }
.sheet-head p { margin: 4px 0 0; color: var(--label-2); }
.sheet-body { padding: 10px 22px 12px; }
.sheet-foot { display: flex; align-items: center; justify-content: flex-end; gap: 8px; padding: 12px 18px 18px; }

.alert { position: absolute; left: 50%; top: 42%; z-index: 400; width: 280px; padding: 22px 18px 16px; border-radius: 20px; text-align: center; background: var(--glass-strong); backdrop-filter: blur(34px) saturate(1.8); -webkit-backdrop-filter: blur(34px) saturate(1.8); box-shadow: var(--shadow-window); opacity: 0; transform: translate(-50%, -50%) scale(0.95); transition: opacity 180ms var(--ease-out), transform 220ms var(--ease-out); }
.alert.open { opacity: 1; transform: translate(-50%, -50%) scale(1); }
.alert.closing { transition-duration: 120ms, 140ms; }
.alert .app-icon { margin: 0 auto 12px; }
.alert h3 { margin: 0; font-size: 13px; font-weight: 700; }
.alert p { margin: 6px 0 0; font-size: 11px; line-height: 1.4; color: var(--label-2); }
.alert-actions { display: flex; gap: 8px; margin-top: 16px; }
.alert-actions .btn { flex: 1; height: 28px; }
.alert .alert-actions .btn { padding: 0 8px; }
.alert .btn.primary.danger { background: var(--coral); }

.toast-stack { position: absolute; left: 50%; bottom: 18px; z-index: 200; display: flex; flex-direction: column-reverse; align-items: center; gap: 8px; transform: translateX(-50%); pointer-events: none; }
.toast { display: flex; align-items: center; gap: 10px; min-height: 38px; padding: 5px 5px 5px 14px; border-radius: 999px; background: var(--glass-strong); backdrop-filter: blur(24px) saturate(1.8); -webkit-backdrop-filter: blur(24px) saturate(1.8); box-shadow: var(--shadow-float); font-size: 13px; white-space: nowrap; pointer-events: auto; opacity: 0; transform: translateY(14px) scale(0.98); transition: opacity 220ms ease, transform 340ms var(--ease-out); }
.toast:not(:has(.btn)) { padding-right: 16px; }
.toast .i { color: var(--accent); }
.toast.show { opacity: 1; transform: none; }
.toast.hide { opacity: 0; transform: translateY(10px) scale(0.98); transition-duration: 160ms, 180ms; }

.notif-stack { position: absolute; top: calc(var(--menubar-h) + 10px); right: 12px; z-index: 350; display: flex; flex-direction: column; gap: 8px; width: 348px; pointer-events: none; }
.notif { display: grid; grid-template-columns: 32px 1fr auto; gap: 10px; align-items: start; padding: 12px 14px; border-radius: 20px; background: var(--glass-strong); backdrop-filter: blur(34px) saturate(1.8); -webkit-backdrop-filter: blur(34px) saturate(1.8); box-shadow: var(--shadow-float); pointer-events: auto; transform: translateX(calc(100% + 24px)); transition: transform var(--spring-dur) var(--spring); }
.notif.show { transform: none; }
.notif.hide { transform: translateX(calc(100% + 24px)); transition: transform 240ms var(--ease-in-out); }
.notif .app-icon { width: 32px; height: 32px; border-radius: 8px; }
.notif p { margin: 1px 0 0; font-size: 12px; line-height: 1.35; color: var(--label-2); }
.notif time { font-size: 11px; color: var(--label-3); }
.notif-actions { grid-column: 2 / -1; display: flex; gap: 6px; margin-top: 6px; }

.tooltip { position: fixed; z-index: 1000; padding: 3px 8px; border-radius: 6px; font-size: 11px; white-space: nowrap; color: var(--label); background: var(--glass-strong); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); box-shadow: var(--shadow-float); pointer-events: none; opacity: 0; transform: scale(0.97); transform-origin: top center; transition: opacity 125ms var(--ease-out), transform 125ms var(--ease-out); }
.tooltip.show { opacity: 1; transform: none; }
.tooltip.instant { transition-duration: 0ms; }

.ev-pop { padding: 8px 10px 10px; }
.ev-quote { margin-top: 8px; padding-left: 10px; font-size: 14px; line-height: 1.45; box-shadow: inset 2px 0 0 var(--accent-soft); }
.ev-foot { margin-top: 10px; }

.fly-chip { display: inline-flex; align-items: center; gap: 8px; height: 30px; padding: 0 12px 0 9px; font-size: 12px; font-weight: 600; white-space: nowrap; color: var(--label); }
.fly-chip > .i { width: 14px; height: 14px; color: var(--accent); }
.a-fly { display: flex; align-items: center; gap: 8px; padding: 6px 12px 6px 8px; font: 500 13px var(--font); color: var(--label); white-space: nowrap; }
.drag-ghost { position: fixed; top: -200px; left: -200px; display: inline-flex; align-items: center; gap: 8px; height: 30px; padding: 0 12px 0 10px; border-radius: 10px; background: var(--glass-strong); box-shadow: var(--shadow-float); font-size: 12px; font-weight: 600; color: var(--label); }

@media (hover: hover) and (pointer: fine) { .alert .btn.primary.danger:hover { background: var(--coral-ink); } }
```

The flyer's wrapper gets `border-radius: 10px; box-shadow: var(--shadow-float); background: var(--glass-strong)` inline (Kit.flyTo).

## HTML Structures

Primitives as 002 renders them, with the missing ARIA added (`<svg class="i">` stands for a lucide icon):

```html
<button class="btn primary">Track 5 series</button>
<button class="btn record"><svg class="i"/>Record <span class="kbd">⌘R</span></button>
<button class="btn sm plain icon" aria-label="More"><svg class="i"/></button>
<button class="btn tb-record"><span class="rec-glyph"></span>Record<span class="kbd">⌘R</span></button>
<button class="btn tb-record live"><span class="rec-dot"></span><span class="num tb-timer">12:04</span><span>Stop</span></button>

<div class="glass-group" role="group" aria-label="Day">
  <button class="btn icon" data-tip="Previous day" aria-label="Previous day"><svg class="i"/></button>
  <button class="btn">Today</button>
  <button class="btn icon" data-tip="Next day" aria-label="Next day"><svg class="i"/></button>
</div>
<div class="glass-group">
  <button class="btn a-new-btn"><svg class="i"/>New<span class="kbd">⌥⌘N</span></button>
  <span class="sep" aria-hidden="true"></span>
  <button class="btn icon" data-tip="Search" aria-label="Search"><svg class="i"/></button>
</div>

<div class="repeats">
  <span class="repeats-label">Repeats</span>
  <div class="seg">
    <span class="seg-thumb"></span>
    <button data-value="None" aria-selected="false">None</button>
    <button data-value="Weekly" aria-selected="true">Weekly</button>
    <button data-value="Every 2 weeks" aria-selected="false">Every 2 weeks</button>
    <button data-value="Monthly" aria-selected="false">Monthly</button>
  </div>
  <button class="btn popup">Tuesday<svg class="i"/></button>
  <button class="btn popup">10:00<svg class="i"/></button>
</div>

<input class="field lg" placeholder="Describe it — e.g. Weekly 1:1 with Priya, Thu 11am">
<label class="search"><svg class="i"/><input class="field" placeholder="Search series, people, decisions"></label>

<button class="switch" role="switch" aria-checked="true" aria-label="Remember Product Sync"></button>
<div class="agenda-item">
  <button class="check" aria-checked="false" aria-label="Done"><svg viewBox="0 0 14 14"><path d="M3.2 7.4l2.4 2.4 5.2-5.6"/></svg></button>
  <span class="ag-t">Metrics pulse</span><span class="ag-d num">5m</span>
</div>

<span class="chip accent"><svg class="i"/>Tracking</span>
<span class="chip amber num">3 to review</span>
<span class="chip coral countdown"><span class="mini-dot"></span>Starting now</span>
<span class="chip dashed"><svg class="i"/>Every Tue · Not tracked</span>
<span class="chip shimmer a-chip-prep">Preparing brief</span>

<span class="status" data-s="superseded">Superseded</span>
<span class="ktype" data-type="decision"><svg class="i"/>Decision</span>
<button class="source" data-src="Sep 22 · 18:42"><svg class="i"/>Sep 22 · 18:42</button>

<span class="avatars">
  <span class="avatar" style="--c:#FF9F0A" title="Maria Chen">MC</span>
  <span class="avatar" style="--c:#0A84FF" title="Jon Park">JP</span>
  <span class="more">+2</span>
</span>

<button class="doc-chip ref-chip">
  <span class="ftype" data-kind="pdf">PDF</span><span class="truncate">Q4 Roadmap.pdf</span><small>v2</small><span class="inc-dot"></span>
</button>
<button class="doc-chip add-chip"><svg class="i"/>Add</button>

<span class="series-icon" style="--c: var(--series-blue)"><svg class="i"/></span>
<span class="series-dot" style="--c: var(--series-green)"></span>
<div class="ob-keys"><span class="keycap">⌥</span><span class="ob-plus">+</span><span class="keycap wide">Space</span></div>

<span class="rec-dot"></span>
<span class="wave"><i></i><i></i><i></i><i></i><i></i></span>
<div class="next-title"><span class="spinner"></span><span>Preparing summary…</span></div>
<div class="prep-lines"><div class="shimmer"></div><div class="shimmer"></div><div class="shimmer short"></div></div>

<div class="a-first"><div class="empty">
  <span class="a-empty-badge"><svg class="i xl"/></span>
  <h3>Nothing upcoming yet</h3>
  <p>Connect your calendar and the next few days show up here.</p>
</div></div>

<div class="row hoverable a-hit"><span class="series-icon"></span><span class="truncate">Product Sync</span><span class="spacer"></span><span class="faint truncate">Every Tue</span></div>

<div class="mtg open">
  <div class="mtg-head"><svg class="i disclosure open"/><span class="mtg-date">Tue 22 Sep</span><span class="mtg-n num">#36 · 43 min</span></div>
  <div class="collapsible"><div><div class="mtg-body">…</div></div></div>
</div>

<div class="nb-group next-docs drop-target">
  <div class="nb-label">Docs for this meeting</div>
  <div class="next-doc-list">…doc chips…</div>
  <div class="drop-note"><svg class="i"/>Drop files to attach</div>
</div>
```

Overlays:

```html
<div class="popover open" role="dialog" style="width:300px; --origin: 40px 0">
  <div class="pop">
    <div class="pop-row"><svg class="i"/><div><b>Linked to Calendar</b><div class="muted">Work · “Product Sync”</div></div></div>
    <div class="pop-sub num">Every Tue · 10:00–10:45</div>
    <div class="pop-actions"><button class="btn sm">Change…</button><button class="btn sm plain">Unlink</button></div>
  </div>
</div>

<div class="menu" role="menu" tabindex="-1">
  <div class="menu-title">Tue 22 Sep · #36</div>
  <div class="menu-item" role="menuitem"><svg class="i"/><span class="truncate">Move to another series…</span></div>
  <div class="menu-item active" role="menuitem"><svg class="i"/><span class="truncate">Open transcript</span></div>
  <div class="menu-sep"></div>
  <div class="menu-item danger" role="menuitem"><svg class="i"/><span class="truncate">Delete meeting…</span></div>
</div>

<div class="scrim open"></div>
<div class="sheet open" role="dialog" aria-modal="true">
  <div class="sheet-head"><h2>Paste text</h2><p>Attach notes, an email or an excerpt. It stays on this Mac.</p></div>
  <div class="sheet-body"><textarea class="field" rows="6" placeholder="Paste or type here…"></textarea></div>
  <div class="sheet-foot"><button class="btn" data-close>Cancel</button><button class="btn primary" disabled>Attach</button></div>
</div>

<div class="alert open" role="alertdialog">
  <div class="app-icon"><img src="telu-icon.png" alt=""></div>
  <h3>Delete Tue 22 Sep?</h3>
  <p>The recording, transcript and summary are removed from this Mac. Items already in Memory stay.</p>
  <div class="alert-actions"><button class="btn">Cancel</button><button class="btn primary danger">Delete</button></div>
</div>

<div class="toast-stack">
  <div class="toast show" role="status"><svg class="i"/><span>Added Coffee with Alex Kim to Product Sync</span><button class="btn sm tinted">Undo</button></div>
</div>

<div class="notif-stack">
  <div class="notif show" role="status">
    <div class="app-icon"><img src="telu-icon.png" alt=""></div>
    <div><b>Product Sync is starting</b><p>Google Meet · 10:00–10:45 · your brief is ready</p></div>
    <time>now</time>
    <div class="notif-actions"><button class="btn sm primary">Record</button><button class="btn sm">Not this time</button></div>
  </div>
</div>

<div class="tooltip show">Back · ⌘[</div>

<div class="popover open" role="dialog" style="width:320px">
  <div class="ev-pop">
    <div class="t-eyebrow">EVIDENCE · {where} · {t}</div>
    <div class="ev-quote">“{quote}”</div>
    <div class="row-flex ev-foot"><span class="avatar"></span><span class="muted">{who}</span><span class="spacer"></span><button class="btn sm plain">Open transcript</button></div>
  </div>
</div>

<div class="popover open" role="dialog" style="width:330px">
  <div class="ev-pop">
    <div class="t-eyebrow">EVIDENCE · {doc} · {loc}</div>
    <div class="ev-quote">“{quote}”</div>
    <div class="row-flex ev-foot"><span class="ftype" data-kind="docx">DOC</span><span class="muted truncate">{doc}</span><span class="spacer"></span><span class="a-local"><svg class="i sm"/>Read on this Mac</span><button class="btn sm plain">Open</button></div>
  </div>
</div>

<div class="fly-chip"><svg class="i"/><span>Acme · SSO deep-dive</span></div>
```

In 002 the speech evidence body uses inline styles with the same values as `.ev-pop` / `.ev-quote` / `.ev-foot`.

## Behavior & State

**Layers and dismissal**
- A layer stack handles Esc in the capture phase: the top popover, menu, sheet or alert closes first. With no layer open, 002's Esc walks: close onboarding → blur a focused field → close the transcript drawer → close the side peek → go back from a doc.
- A pointerdown outside a popover or menu closes it. Only one popover and one menu are open at a time; opening another closes the current one (a menu instantly, without the fade); clicking the same trigger again toggles it closed. Radix covers all of this.
- Plain-key shortcuts (arrows, Enter) do nothing while a layer is open or while typing; modifier shortcuts (⌘R, ⌥⌘N, ⌘F) still work.
- Menus take focus on open with no row highlighted; ↑/↓ wrap and skip disabled rows (Radix `loop`); Enter chooses with the blink; the action runs when the menu closes (130ms).
- Sheets focus `[autofocus]` or the first field 60ms after opening; `[data-close="value"]` buttons close with a result; closing on scrim click is off by default.
- Alert copy in 002: "“Telu” Would Like to Access Your Calendars" / "Telu reads events on this Mac to prepare briefs for your recurring meetings. Nothing is uploaded." / Don’t Allow · Allow Full Access (onboarding: allow advances to the next step, deny stays on the step) · "Delete {date}?" / "The recording, transcript and summary are removed from this Mac. Items already in Memory stay." / Cancel · Delete (coral) · "Stop tracking {series}?" / "Telu keeps its memory and past meetings, but won’t prepare briefs for new ones." / Cancel · Stop Tracking.
- Alerts return a Promise of the chosen value. Enter = primary, Esc = the cancel button (first non-primary). 002 binds Enter to the primary even in the Delete confirm; 003's a11y note says the destructive action should not be the default focus, so in production focus Cancel first in destructive alerts and let Enter activate the focused button.
- Toasts: 4200ms, hover pauses (remaining time kept), leaving resumes with at least 1200ms; the action runs, then dismisses. 002 shows toasts on the desktop when the window is hidden; production has no such surface, so decide per case (the Island's own flashes, or nothing).
- Notifications: 7000ms, hover cancels the timer, leaving dismisses after 2500ms; clicking the body runs `onClick` (open the meeting / open Review) and dismisses.
- Tooltips: one shared element; 650ms cold delay; warm (visible, or hidden < 600ms ago) shows at once; hidden on pointerdown.
- Search popover (⌘F): anchored to the toolbar search button, `align: 'end'`, width 400; input focused after 40ms; Enter opens the first hit; results group under "Series" and "In memory" hints. Build it as cmdk inside the Popover.

**Data shapes (from the kit API)**

```tsx
type MenuEntry =
  | { label: string; icon?: IconName; kbd?: string; swatch?: string; danger?: boolean; disabled?: boolean; onSelect?: () => void }
  | { title: string }
  | '-'

interface PopoverOptions { align?: 'start' | 'center' | 'end'; side?: 'bottom' | 'top'; width?: number; onClose?: () => void }
interface ToastOptions { icon?: IconName; action?: { label: string; onClick: () => void }; duration?: number }
interface NotifyOptions { title: string; body?: string; time?: string; actions?: { label: string; primary?: boolean; onClick: () => void }[]; duration?: number; onClick?: () => void }
interface AlertOptions<T extends string> { title: string; message?: string; buttons: { label: string; value: T; primary?: boolean }[] }
interface SpeechEvidence { where?: string; t: string; who: string; quote: string; openLabel?: 'Open transcript' | `Jump to ${string}` | `Open ${string} in the doc` }
interface DocumentEvidence { doc: string; loc?: string; quote: string }
```

Status mapping: `completed` renders "Done". FileBadge label: docx → DOC, xlsx → XLS, otherwise the first three letters of the extension, upper-case. Avatar initials: first letters of up to two name parts; "You" renders none.

**Accessibility requirements**
- Buttons are native `<button>`s with the focus-visible outline; icon-only buttons need `aria-label` (002 often has only `data-tip`: fix everywhere). Shortcuts go in `aria-keyshortcuts` ("Meta+R"); visible glyphs are `aria-hidden`.
- GlassGroup: `role="group"` + `aria-label`; separators `aria-hidden`.
- SegmentedControl: radiogroup semantics (Radix ToggleGroup) with arrow keys; keyboard changes never animate the thumb.
- TextField always has a visible label or `aria-label`. SearchField is a cmdk combobox with `aria-controls`.
- PopupButton: Select semantics (`aria-haspopup="listbox"`, arrows, typeahead).
- Switch: `role="switch"` + `aria-checked` + a visible focus ring. Checkbox: agenda checks carry `aria-label="Done"`; the sidebar calendar check is decorative (`tabindex="-1"`, pointer-events none) because the whole row toggles watching.
- Chips, status dots, series icons and dots, file badges, waveform are text or decoration; the label always states the meaning, never the tone alone. RecDot always sits next to "Recording" or a timer.
- SourceChip reads "Source: Sep 22, 18:42"; its popover is a dialog; Esc returns focus to the chip. EvidencePopover quotes are `<blockquote>` with a cite.
- AvatarStack: a group label ("5 people: Maria Chen, Jon Park, …"); the +n text is read. Avatar `title` carries the full name.
- Spinner: visible text + `role="status"` on the container. Skeleton: `aria-busy` on the region. ProgressHairline: `role="progressbar"`.
- Collapsible header: a button with `aria-expanded` / `aria-controls` (002 uses a div).
- DropTarget: always a keyboard path (⌘O Attach files) and an "Attached …" status announcement.
- Card (interactive): an option in a listbox or a button; arrows move the selection without animation. ListRow: `role="option"`, `aria-selected`.
- Popover `role="dialog"`, focus moves in and returns to the trigger (002 does not do this; Radix does). Menu `role="menu"`/`"menuitem"`. ContextMenu also opens from the keyboard (Shift+F10 / Menu key in Radix), after selecting the card.
- Sheet `role="dialog"` `aria-modal`, focus trapped and returned. Alert `role="alertdialog"`.
- Toast `role="status"` (polite); Undo is a real button and ⌘Z should also undo; never auto-dismiss while focused.
- Tooltip content is never interactive and never the only name. FlyChip is decorative; the paired toast announces the result.

**Known gaps (003 README and this synthesis)**
- Switch has no visible focus ring; text fields and checkboxes have no disabled style (use 0.45 opacity like buttons).
- Icon-only buttons missing `aria-label`s; the include dot is a span, not a toggle; the collapsible header is a div.
- Reduced motion does not cover the spinner, mini dots, chip-in or the progress hairline.
- Absent in 002 (do not invent without a decision): a paused state for the toolbar recording capsule and the menu-bar item (only the Island pauses), an "Editing…" save state (002 says "Saving…"), pending counts on sidebar series rows (they live on the Review row), a second segmented-control size, any sheet actually opened by 002 (the Sheet demo uses 001's Paste text sheet).
- Native notifications cannot show the Record / Not this time / Review buttons with the current plugin on desktop.
- Radix's default popover origin differs from the kit's (fix above); sonner's stack order differs from the kit's.

## What to Avoid

- **001 A's purpose sheet and sheet-driven flows** (purpose editing, detection and proposals in sheets): not adopted. Purpose editing lives only in the living doc; proposals live in Found in Calendar. Keep Sheet as a rare window-modal primitive.
- **001 C's ⌘K command window** (Spotlight-style palette for series, purpose and review): not adopted. Search is the ⌘F popover anchored to the toolbar, with cmdk inside it.
- **001 C's menu-bar dropdown panel**: not adopted. The status item summons the window (002 `T.summon`); meeting prompts come from the Island and notifications.
- **Animating menus in** (shadcn's fade/zoom/slide on DropdownMenu, Select and ContextMenu): menus open instantly.
- **Popovers scaling from their own centre or from scale(0)**, and shadcn's `zoom-in-95` + `slide-in-from-*` defaults.
- **Springing toasts or menus.** Toasts ease out; the notification slide is the only overlay spring.
- **shadcn defaults that fight the design:** `bg-black/80` overlays (use `--scrim`), indigo `bg-primary` tooltips (use glass), `rounded-md` / `h-9` buttons (use capsules at 28px), `hover:bg-accent` ghost buttons (now full indigo).
- **Hover-only actions without a focus or touch path.** Revealed actions also appear on `:focus-visible` and on non-hover devices.
- **Color as the only signal**: every chip, dot and status carries a label. **Mint chips as decoration** (the kit mint chip is unused for a reason). **Coral for anything but recording and destructive confirms.**
- **A custom notification banner in production**: macOS owns notifications; the kit banner is a prototype stand-in.
- **Tooltips with interactive content, or as the only label.**
- **Pointer cursors on buttons.** Buttons keep the default cursor like native macOS controls; text fields get the text cursor.
- **Different press scales for everything.** Use the ladder: 0.88 check, 0.95/0.96 source, 0.97 buttons and chips, 0.985 rows, 0.992 cards.

## Origin

Synthesized from sketches: 002, 003 (001 for the rejected alternatives).

Source files available in:
- `sources/kit/mac-kit.css`, `sources/kit/mac-kit.js` (popover, position, menu, contextMenu, sheet, alert, toast, notify, tooltips, segmented, flyTo, evidence), `sources/kit/icons.js`, `sources/kit/data.js`
- `sources/003-component-catalog/sec-primitives.js`, `sources/003-component-catalog/sec-primitives-2.js`, `sources/003-component-catalog/sec-overlays.js`, `sources/003-component-catalog/sec-motion.js`, `sources/003-component-catalog/sec-motion-2.js`, `sources/003-component-catalog/COMPONENTS.md`, `sources/003-component-catalog/README.md`
- `sources/002-final-app/app.css`, `sources/002-final-app/doc.css`, `sources/002-final-app/island.css`, `sources/002-final-app/app-agenda.js` (chipMarkup), `sources/002-final-app/app-pages.js` (empty states), `sources/002-final-app/doc-render.js` (docButton, agendaItem, repeatsMarkup), `sources/002-final-app/doc-review.js` (evidence), `sources/002-final-app/doc-organize.js` (menus, delete alert), `sources/002-final-app/app-actions.js` (stop-tracking alert), `sources/002-final-app/app-onboard.js` (calendar alert), `sources/002-final-app/app-record.js` (notifications), `sources/002-final-app/app-flows.js` (search popover), `sources/002-final-app/app.js` (keys, Esc order)
- `sources/001-app-mental-model/README.md`
