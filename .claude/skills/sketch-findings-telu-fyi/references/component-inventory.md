# Telu component inventory

Generated from sketch 003 (`.planning/sketches/003-component-catalog/`). Visual reference: open the catalog page. Source of truth for look and behavior: sketch 002.

## Foundations

Tokens and rules every component is built from: color in both themes, type, radii and sizes, elevation, materials, motion curves, icons and the app icon. Values are read live from the running theme, so switching Light / Dark updates every number.

### ColorTokens

Semantic color tokens for both themes. Swatches show the live value from the active theme and what the color means — brand colors are rationed by meaning, not decoration.

- **Maps to:** CSS variables consumed by Tailwind theme colors (colors.accent = "var(--accent)" …); light/dark swap by theme stylesheet or [data-theme]
- **Used in:** Every component
- **Source:** `themes/default.css · themes/dark.css (:root)`
- **States:** light, dark
- **Tokens:** `--accent`, `--mint`, `--coral`, `--amber`, `--label…-4`, `--window-bg`, `--content-bg`, `--surface`, `--surface-sunken`, `--fill…-3`, `--separator`, `--hairline`, `--glass-strong`, `--sidebar`, `--menubar`, `--scrim`
- **Motion:** None. Theme switch swaps the stylesheet instantly (no color transition on :root); components keep their own 150–200ms color transitions.
- **Accessibility:** label-3 and label-4 are for non-essential text only. Mint never carries body text — use mint-ink for its heading. Coral text uses coral-ink. Every state that uses color also changes shape or text (dot, chip label, strikethrough).

| Prop | Values | Default |
|---|---|---|
| `theme` | light (default.css) \| dark (dark.css) | system via prefers-color-scheme |

Shown: Brand · Labels 1–4 · Surfaces · Fills and separators · Glass and materials

### SeriesColors

Identity palette for series (and knowledge types), plus the fixed hex colors that do not change with the theme.

- **Maps to:** Tailwind colors.series.{blue…gray} = var(--series-*); stored per series as a token name, never a hex
- **Used in:** Sidebar, Agenda cards, Living doc, Menus (swatches), Island, Avatars
- **Source:** `themes/*.css --series-* · kit/data.js series[].color · DATA.people`
- **Tokens:** `--series-blue`, `--series-orange`, `--series-green`, `--series-purple`, `--series-teal`, `--series-pink`, `--series-gray`
- **Motion:** None.
- **Accessibility:** Series color is never the only identifier — the series icon glyph and name always accompany it.

| Prop | Values | Default |
|---|---|---|
| `color` | blue \| orange \| green \| purple \| teal \| pink \| gray | gray (drafts) |

Shown: Series palette · People colors · Fixed hex colors

### Typography

System type scale (SF Pro Text / Display). Metrics are measured from the rendered specimen.

- **Maps to:** Tailwind fontSize/fontFamily extension + a <Text variant> helper; tabular numerals via font-variant-numeric
- **Used in:** Every surface
- **Source:** `kit/mac-kit.css .t-* · 002 doc.css .sec-eyebrow`
- **Tokens:** `--font`, `--font-display`, `--font-rounded`, `--font-mono`, `--label`, `--label-2`, `--label-3`
- **Motion:** None.
- **Accessibility:** Body is 13px (macOS default); never go below 10.5px. Headings use semantic h1–h3 regardless of visual variant.

| Prop | Values | Default |
|---|---|---|
| `variant` | large \| title1 \| title2 \| title3 \| headline \| body \| callout \| caption \| eyebrow \| section-eyebrow | body |
| `numeric` | boolean (tabular-nums) | false |
| `tone` | default \| muted \| faint | default |
| `truncate` | boolean | false |

Shown: Type scale · Font stacks · Text utilities

### RadiiAndSpacing

Corner radii, layout metrics, control heights and the spacing values the app actually uses.

- **Maps to:** Tailwind borderRadius (window/card/control/full) + spacing scale; layout constants in a shared tokens file
- **Used in:** Every surface
- **Source:** `kit/mac-kit.css :root (--r-*, --menubar-h, --toolbar-h, --sidebar-w) · 002 app.css .t-app`
- **Tokens:** `--r-window`, `--r-card`, `--r-control`, `--menubar-h`, `--toolbar-h`, `--sidebar-w`
- **Motion:** None.
- **Accessibility:** Smallest hit target is 17px (check) inside ≥ 24px rows; icon buttons are 24–28px.

Shown: Radii · Layout metrics · Control heights · Spacing in use

### Elevation

Four shadows. Hairline rings (0.5px) do the work of borders; depth stays soft.

- **Maps to:** Tailwind boxShadow { card, card-hover, float, window } = var(--shadow-*)
- **Used in:** Cards, Popovers, Menus, Toasts, Notifications, Window, Sheets, Alerts
- **Source:** `themes/*.css --shadow-*`
- **Tokens:** `--shadow-card`, `--shadow-card-hover`, `--shadow-float`, `--shadow-window`
- **Motion:** Trigger: hover on an interactive card (fine pointers) · Animates: box-shadow --shadow-card → --shadow-card-hover · Duration: 200ms in and out · Easing: ease · Runtime: CSS transition (interruptible) · Reduced motion: unchanged (box-shadow is allowed) · framer-motion: none — CSS hover:shadow-card-hover
- **Accessibility:** Shadows are decorative; focus is never shown by shadow alone.

Shown: Shadows

### Materials

Translucent materials over the wallpaper: fill token + backdrop blur + saturation, with the exact recipe per surface.

- **Maps to:** Tailwind utilities (bg-glass-strong backdrop-blur-[26px] backdrop-saturate-[1.8]); Tauri window vibrancy (NSVisualEffectView) for the real sidebar
- **Used in:** Window, Menu bar, Toolbar, Popovers, Menus, Sheets, Alerts, Toasts, Notifications, Island
- **Source:** `kit/mac-kit.css .window .menubar .toolbar.scrolled .glass-group .popover .menu .sheet .alert .toast .notif · 002 island.css`
- **Tokens:** `--glass-strong`, `--glass-rim`, `--glass-edge`, `--sidebar`, `--menubar`, `--scrim`, `--content-bg`
- **Motion:** Trigger: content scrolls under the toolbar (scrollTop > 2) · Animates: background-color transparent → content-bg 76% and box-shadow hairline; the backdrop blur switches on without a transition · Duration: 200ms both ways · Easing: ease · Runtime: CSS transition (interruptible) · Reduced motion: unchanged · framer-motion: none — CSS on data-scrolled
- **Accessibility:** Text on glass always uses label tokens; reduce-transparency should fall back to opaque --content-bg (not implemented in 002).

Shown: Glass strong · popover, menu · Glass strong · sheet, alert, notification · Glass group · toolbar capsule · Sidebar · window material · Menu bar · Toolbar · scrolled · Scrim

### FocusRing

Keyboard focus treatments. Buttons and checks get an outline; fields and search draw a soft 3.5px ring instead.

- **Maps to:** Tailwind focus-visible:outline + ring utilities; Radix primitives expose focus-visible natively
- **Used in:** Buttons, Fields, Search, Checks, Menus
- **Source:** `kit/mac-kit.css :focus-visible · .field:focus · .search .field:focus`
- **Tokens:** `--accent`
- **Motion:** Trigger: focus (fields) / focus-visible (buttons, checks) · Animates: fields: box-shadow ring; buttons: outline (not transitioned) · Duration: field ring 150ms in and out; outline instant · Easing: ease · Runtime: CSS transition · Reduced motion: unchanged · framer-motion: none — CSS focus-visible utilities
- **Accessibility:** :focus-visible → 3px outline, accent 45%, offset 1px. Fields: inset 0.5px accent + 3.5px accent 32% ring. The kit removes the outline on .switch, .menu and .sheet — switches have no visible focus (gap to fix in React).

Shown: Focus treatments

### MotionTokens

Five easing curves and the duration scale. Plots are drawn from the live token values; Replay runs the real curve (top dot) against linear (bottom dot). Every animation instance is cataloged in the Animations section.

- **Maps to:** framer-motion transition presets (ease arrays and spring presets) + Tailwind transitionTimingFunction/duration
- **Used in:** Every animated component
- **Source:** `kit/mac-kit.css :root --ease-* --spring* · @media (prefers-reduced-motion)`
- **Tokens:** `--ease-out`, `--ease-in-out`, `--ease-drawer`, `--spring`, `--spring-dur`, `--spring-bounce`, `--spring-bounce-dur`
- **Motion:** Easings: --ease-out cubic-bezier(0.23, 1, 0.32, 1) → framer ease [0.23, 1, 0.32, 1]; --ease-in-out cubic-bezier(0.77, 0, 0.175, 1) → [0.77, 0, 0.175, 1]; --ease-drawer cubic-bezier(0.32, 0.72, 0, 1) → [0.32, 0.72, 0, 1]; --spring linear() 490ms (0.3% overshoot) → { type: "spring", duration: 0.49, bounce ≈ 0.12 }; --spring-bounce linear() 600ms (3.8% overshoot) → { type: "spring", duration: 0.6, bounce ≈ 0.28 }. Use the spring tokens only through transitions of transform/size; linear() is CSS-only, so in React prefer the framer spring equivalents.
- **Accessibility:** prefers-reduced-motion: kit CSS restricts transition-property to opacity, background-color, color, box-shadow, border-color (!important), disables .enter .bump .wave .shimmer keyframes and slows .rec-dot to 2.4s; Kit JS helpers return early. In React use useReducedMotion() and MotionConfig reducedMotion="user".

| Prop | Values | Default |
|---|---|---|
| `ease` | out \| in-out \| drawer \| spring \| spring-bounce | out |
| `duration` | press 140 \| fast 160 \| base 220 \| drawer 300 \| spring 490 \| spring-bounce 600 | base |

Shown: --ease-out · --ease-in-out · --ease-drawer · --spring · --spring-bounce · Duration scale · Enter vs exit · Motion rules

### Iconography

All 74 kit icons — 24×24 grid, round caps and joins, currentColor stroke — with the closest lucide-react name.

- **Maps to:** lucide-react (strokeWidth 1.6, size 16) — names below; keep a local Icon wrapper for the four custom glyphs (apple, control, decision, record/stop fills)
- **Used in:** Every surface
- **Source:** `kit/icons.js window.ICONS · icon(name, cls) · kit/mac-kit.css .i`
- **Tokens:** `currentColor`, `--accent (sidebar)`, `--label-2 (menus)`, `--label-3 (empty states)`
- **Motion:** None on the glyph itself. Containers animate (disclosure chevron rotates 90° in 200ms --ease-out).
- **Accessibility:** Icons are aria-hidden SVGs; the control carries the label (aria-label on icon-only buttons).

| Prop | Values | Default |
|---|---|---|
| `name` | keyof ICONS | — |
| `size` | sm 13 \| md 16 \| lg 20 \| xl 28 | md |
| `strokeWidth` | 1.6 (xl 1.4); contexts override | 1.6 |

Shown: All icons · Sizes · Context overrides

### AppIcon

The Telu mark on the indigo squircle, plus the monochrome template glyph used in the menu bar.

- **Maps to:** Static asset component <AppIcon size>; menu-bar glyph = Tauri tray icon with icon_as_template(true)
- **Used in:** Alerts, Notification banners, Welcome page, Onboarding, Menu bar status item, Island setup pill
- **Source:** `kit/mac-kit.css .app-icon (.sm .md) · .template-img · kit/telu-icon.png · kit/telu-menubar.png`
- **Tokens:** `--template-filter`
- **Motion:** Onboarding flies a 60px icon into the menu bar (Kit.flyTo, 620ms) — see Animations. The icon itself is static.
- **Accessibility:** Decorative (alt="") next to a visible app name; the status item has aria-label="Telu".

| Prop | Values | Default |
|---|---|---|
| `size` | 20 (sm) \| 32 (md) \| 56 (default) \| 60 (onboarding) | 56 |
| `template` | boolean — monochrome menu-bar glyph | false |

Shown: Sizes · Menu-bar template glyph · In the menu bar

## Animations

Every animation in the final app, one entry each: what triggers it, which properties move, exact durations and curves, whether it can be interrupted, what the keyboard and reduced-motion paths do, and the framer-motion or CSS it maps to. Replay runs the real kit and 002 code on real markup. Curves and springs are the Foundations motion tokens.

### Motion principles

The rules every animation in Telu follows, each with where Telu applies it. Read these before adding motion anywhere; the entries below are the evidence.

- **Maps to:** framer-motion at the root: <MotionConfig reducedMotion="user" transition={{ duration: 0.19, ease: [0.23, 1, 0.32, 1] }}>; motion tokens --ease-out, --ease-in-out, --ease-drawer, --spring(-dur), --spring-bounce(-dur) in globals.css (see Foundations · Motion)
- **Source:** `kit/mac-kit.css :root motion tokens · every 002 call site listed in this section`
- **Tokens:** `--ease-out`, `--ease-in-out`, `--ease-drawer`, `--spring`, `--spring-bounce`
- **Motion:** enter ease-out 150–260ms, exit faster, springs only for morphs and landings, never from scale(0), transform/opacity only, keyboard navigation instant, reduced motion = opacity only

Shown: Twelve rules · Do vs don’t

### Timing map

Every timed phase in this section (148), sorted by duration so the whole system reads at a glance: micro-feedback under 150ms, entrances and exits 150–260ms, layout and springs 280–600ms, flights and glows beyond.

- **Maps to:** Export these as constants next to the easing tokens (e.g. motion.ts: DURATION.popoverOpen = 0.19) so components never inline numbers
- **Source:** `generated at render from the timing rows of every entry in this section (both files)`
- **Motion:** interrupt: yes = CSS transition retargets · restart = WAAPI/keyframes cancel and replay · no = runs to completion · cancels / resets = timers · +N = delay before the phase starts

Shown: Durations, curves and interruptibility

### Button · press

The button answers the pointer the moment it goes down. Pressing is acknowledgement, so it is small (3%) and quick.

- **Maps to:** shadcn Button (cva): transition-[transform,background-color,box-shadow,color] active:scale-[0.97], transform 140ms var(--ease-out) — framer-motion alternative: whileTap={{ scale: 0.97 }} transition={{ duration: 0.14, ease: [0.23, 1, 0.32, 1] }}
- **Used in:** Everywhere
- **Source:** `kit/mac-kit.css .btn, .btn:active, @media (hover: hover) .btn:hover`
- **Tokens:** `--ease-out`, `--fill-3`, `--accent-strong`, `--coral-ink`
- **Motion:** scale(0.97) while pressed, 140ms --ease-out; hover background 150ms ease on fine pointers only

| Prop | Values | Default |
|---|---|---|
| `trigger` | pointer down on any .btn (:active); hover background only on (hover: hover) and (pointer: fine) |  |
| `element` | .btn — default, primary, record, tinted, plain, icon; buttons inside .glass-group |  |
| `properties` | transform scale(1) → scale(0.97) · background-color → --fill-3 on hover (primary → --accent-strong, record → --coral-ink) |  |
| `enter` | transform 140ms var(--ease-out) · background-color, box-shadow, color 150ms ease |  |
| `exit` | the same transition reverses on release |  |
| `interruptible` | yes — CSS transition, retargets mid-press |  |
| `keyboard` | Space / Enter activate with no scale; the focus ring (3px accent at 45%) appears instantly |  |
| `reduced` | scale applies without a tween; colours still fade |  |

Shown: Press any button · Timeline

### Cards, rows & chips · press

Bigger surfaces move less: the press scale tightens as the target grows, so a card and a checkbox feel equally responsive.

- **Maps to:** whileTap={{ scale: 0.992 }} on cards, 0.985 on sidebar rows, 0.97 on chips, 0.96 on source chips, 0.88 on checkboxes, transition={{ duration: 0.14, ease: [0.23, 1, 0.32, 1] }} (cards 0.16) — Tailwind active:scale-[0.992] transition-transform
- **Source:** `kit .card.interactive, .check:active · 002 app.css .t-app .sb-item, .pk-series · doc.css button.meta-chip, button.doc-chip, .scrub-item, .doc-surface .source · island.css .island[data-shape="pill"], .island .source`
- **Tokens:** `--ease-out`, `--shadow-card-hover`
- **Motion:** press scale 0.992 → 0.88 from the largest to the smallest target, 140–160ms --ease-out

| Prop | Values | Default |
|---|---|---|
| `trigger` | pointer down on any clickable surface |  |
| `element` | .card.interactive / .a-card · .t-app .sb-item · button.meta-chip, button.doc-chip, .pk-series, .island button.chip · .source · .scrub-item · .check · .island[data-shape="pill"] |  |
| `properties` | transform scale → 0.992 card · 0.985 sidebar row · 0.97 chips, peek series link, Island pill · 0.96 doc source chip, scrubber item · 0.95 Island source chip · 0.88 checkbox; card hover → --shadow-card-hover |  |
| `enter` | cards 160ms var(--ease-out) · rows, chips, sources, check 140ms var(--ease-out) · Island pill 180ms var(--ease-out) · card hover shadow 200ms ease |  |
| `exit` | reverses on release |  |
| `interruptible` | yes — CSS transitions |  |
| `keyboard` | ↑/↓ moves the selection ring (.is-selected::after, 2px accent) instantly — no press, no fade |  |
| `reduced` | scale snaps; the hover shadow still fades |  |

Shown: Press scale ladder · Timeline

### Hover · reveal actions

Secondary actions stay quiet until the pointer asks for them, then fade in place — nothing moves, so the layout never shifts.

- **Maps to:** Tailwind group: opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150, with future.hoverOnlyWhenSupported so touch never sticks
- **Source:** `002 app.css .a-hover, .a-sb-add, @media not all and (hover: hover) · doc.css .grip, .ask-add, .mtg-head:hover`
- **Tokens:** `--fill`
- **Motion:** opacity 150ms ease on the revealed control; the parent’s hover background 150ms ease

| Prop | Values | Default |
|---|---|---|
| `trigger` | pointer over the parent, only under (hover: hover) and (pointer: fine); touch shows the actions permanently (@media not all and (hover: hover)) |  |
| `element` | .a-card .a-hover (Track · Add to series · Review) · .a-sb-title .a-sb-add · .mtg-head .grip · .ask-row .ask-add · hover backgrounds on .btn, .source, .editable, .mtg-head |  |
| `properties` | opacity 0 → 1 (pointer-events none → auto) · background-color |  |
| `enter` | opacity 150ms ease |  |
| `exit` | opacity 150ms ease |  |
| `interruptible` | yes — CSS transitions |  |
| `keyboard` | focus-visible reveals .a-sb-add and .ask-add at once; a selected card (.is-selected) shows its actions without hover |  |
| `reduced` | unchanged — opacity only |  |

Shown: Card actions · Series + · meeting grip · Timeline

### Segmented control · thumb

The selection indicator travels to the new option, so the eye follows the choice instead of hunting for it.

- **Maps to:** Radix ToggleGroup (type="single") + framer-motion shared layout: {selected && <motion.span layoutId="seg-thumb" transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }} />} inside the active item
- **Source:** `kit/mac-kit.js Kit.segmented · mac-kit.css .seg-thumb · 002 doc-render.js repeatsMarkup, doc-organize.js D.mountDraft`
- **Tokens:** `--ease-out`, `--content-bg`
- **Motion:** thumb slides + resizes 240ms --ease-out; label colour 160ms ease

| Prop | Values | Default |
|---|---|---|
| `trigger` | click a segment (Kit.segmented) |  |
| `element` | .seg > .seg-thumb — Repeats (None / Weekly / Every 2 weeks / Monthly) in a draft doc; the catalog’s Light / Dark switch |  |
| `properties` | thumb transform translateX(button.offsetLeft) and width (button.offsetWidth) · label color --label-2 → --label |  |
| `enter` | transform + width 240ms var(--ease-out) · label color 160ms ease |  |
| `interruptible` | yes — retargets from the current position |  |
| `keyboard` | set(value, { animate: false }) places the thumb with transition: none (first paint); a parsed title updates it animated but silent |  |
| `reduced` | thumb jumps; label colour still fades |  |
| `notes` | width is the one layout property here — acceptable on a 24px-tall element; production can use a shared-layout thumb instead |  |

Shown: Repeats · Timeline

### Switch · knob spring

The knob lands with a small overshoot — a physical “click” that confirms the setting took.

- **Maps to:** Radix Switch; thumb <motion.span layout transition={{ type: 'spring', duration: 0.5, bounce: 0.28 }} /> — or CSS transform var(--spring-bounce-dur) var(--spring-bounce) on the thumb
- **Source:** `kit/mac-kit.css .switch, .switch::after · 002 app-onboard.js detectedRow · doc-popovers.js D.refPopover`
- **Tokens:** `--spring-bounce`, `--spring-bounce-dur`, `--accent`, `--fill-3`
- **Motion:** knob springs 14px with --spring-bounce (600ms); track colour 200ms ease

| Prop | Values | Default |
|---|---|---|
| `trigger` | click (the kit’s global handler flips aria-checked and emits a toggle event) |  |
| `element` | .switch::after (knob) and the .switch track — onboarding “which conversations” rows, Reference popover “Include in every brief” |  |
| `properties` | knob transform translateX(0 → 14px) · track background-color --fill-3 → --accent |  |
| `enter` | knob var(--spring-bounce-dur) var(--spring-bounce) — 600ms, bounce 0.28 (overshoots ≈ 3.8%) · track 200ms ease |  |
| `exit` | the same curve back |  |
| `interruptible` | yes — CSS transition |  |
| `keyboard` | Space toggles with the same spring — it is the state change itself, not navigation |  |
| `reduced` | knob jumps; track colour still fades |  |

Shown: Onboarding rows · Timeline

### Checkbox · stroke draw

The fill arrives first and the check mark draws itself a beat later, so “done” reads as an action completed.

- **Maps to:** Radix Checkbox + <motion.path initial={{ pathLength: 0 }} animate={{ pathLength: checked ? 1 : 0 }} transition={{ duration: 0.22, delay: 0.04, ease: [0.23, 1, 0.32, 1] }} />
- **Source:** `kit/mac-kit.css .check, .check svg · 002 app.css .a-cal-check · doc.css .agenda-item.done · doc-edit.js D.onToggle`
- **Tokens:** `--accent`, `--label-4`, `--ease-out`
- **Motion:** fill 160ms ease, then the mark draws 220ms --ease-out (+40ms)

| Prop | Values | Default |
|---|---|---|
| `trigger` | click (.check flips aria-checked; data-manual rows own their state) |  |
| `element` | .check (round), .check.square, .a-cal-check (calendar colour), .agenda-item.done |  |
| `properties` | background-color / inset ring → fill · svg stroke-dashoffset 14 → 0 · press scale(0.88) · agenda text colour → --label-3 and line-through (instant) |  |
| `enter` | fill 160ms ease · stroke 220ms var(--ease-out) after 40ms · press 140ms var(--ease-out) |  |
| `exit` | stroke retracts 220ms (40ms delay) while the fill clears 160ms |  |
| `interruptible` | yes — CSS transitions |  |
| `keyboard` | Space toggles the same way |  |
| `reduced` | the mark appears at once (stroke-dashoffset is not transitioned); the fill still fades |  |

Shown: Round · square · calendar · agenda item · Timeline

### Tooltip · delay, then instant

Tooltips wait long enough not to ambush a passing pointer; once one is open, neighbours answer immediately so scanning a toolbar is fast.

- **Maps to:** Radix Tooltip with <TooltipProvider delayDuration={650} skipDelayDuration={600}>; content initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: warm ? 0 : 0.125, ease: [0.23, 1, 0.32, 1] }} style={{ transformOrigin: 'top center' }}
- **Source:** `kit/mac-kit.js tooltips() · mac-kit.css .tooltip, .tooltip.show, .tooltip.instant`
- **Tokens:** `--glass-strong`, `--shadow-float`, `--ease-out`
- **Motion:** 650ms wait, 125ms --ease-out fade/scale from 0.97; warm tooltips appear with no delay and no transition

| Prop | Values | Default |
|---|---|---|
| `trigger` | pointerover [data-tip]; first show after 650ms; while one is visible or within 600ms of the last hide (“warm”) the next shows instantly |  |
| `element` | .tooltip — one global element, fixed, 6px below the target, origin top center |  |
| `properties` | opacity 0 → 1 · transform scale(0.97) → none |  |
| `enter` | cold: 125ms var(--ease-out) after the 650ms wait · warm: 0ms (.instant) |  |
| `exit` | 125ms var(--ease-out) on pointerout; hidden immediately on pointerdown |  |
| `interruptible` | yes — leaving before 650ms cancels the timer |  |
| `keyboard` | pointer-only in the prototype; labels also live in aria-label |  |
| `reduced` | scale snaps; opacity fades |  |

Shown: Doc toolbar group · Timeline

### Popover · origin-aware scale

The popover grows out of the control that opened it, so it is obviously “about” that control.

- **Maps to:** Radix Popover + <motion.div style={{ transformOrigin: 'var(--radix-popover-content-transform-origin)' }} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.11 } }} transition={{ duration: 0.19, ease: [0.23, 1, 0.32, 1], opacity: { duration: 0.15 } }} />
- **Source:** `kit/mac-kit.js popover(), position() · mac-kit.css .popover, .popover.open, .popover.closing · 002 doc-popovers.js, app-flows.js`
- **Tokens:** `--ease-out`, `--glass-strong`, `--shadow-float`
- **Motion:** scale 0.96 → 1 from the trigger, 190ms --ease-out; closes in 110ms

| Prop | Values | Default |
|---|---|---|
| `trigger` | click a trigger (Kit.popover): New series, Search, rule and people chips, History, source chips (evidence), Island evidence |  |
| `element` | .popover (glass) with transform-origin var(--origin) = trigger centre x (clamped 12px from the edges), y = 0 below or its height when flipped above |  |
| `properties` | opacity 0 → 1 · transform scale(0.96) → none |  |
| `enter` | opacity 150ms, transform 190ms var(--ease-out); .open is added on the next frame |  |
| `exit` | .closing → opacity and transform 110ms; removed after 140ms; the same trigger toggles it closed |  |
| `interruptible` | yes — CSS transitions (outside click or Esc mid-open reverses) |  |
| `keyboard` | ⌥⌘N / ⌘F open the same popovers with the same 190ms scale (002 behaviour — production may open keyboard-summoned popovers instantly); Esc closes via the kit layer stack |  |
| `reduced` | opacity only |  |

Shown: Two origins · Timeline

### Menu · instant open, blink, fade

Menus are tools you open many times a day: they appear instantly, confirm the choice with a blink and get out of the way.

- **Maps to:** Radix DropdownMenu / ContextMenu with no enter animation; onSelect: preventDefault, toggle data-highlighted off → on at 60ms, close at 130ms; content exit={{ opacity: 0, transition: { duration: 0.12, ease: "easeInOut" } }}
- **Source:** `kit/mac-kit.js menu(), choose(), contextMenu() · mac-kit.css .menu, .menu.closing · 002 doc-organize.js D.meetingMenu`
- **Tokens:** `--accent`, `--glass-strong`
- **Motion:** no enter animation; selection blink 60ms; fade out 120ms ease

| Prop | Values | Default |
|---|---|---|
| `trigger` | click a trigger or right-click (Kit.menu / Kit.contextMenu); menu-bar menus |  |
| `element` | .menu (glass) · .menu-item.active |  |
| `properties` | open: none — full opacity at once · choose: the active row turns off, back on after 60ms · close: opacity 1 → 0 |  |
| `enter` | instant (0ms) |  |
| `exit` | choose → blink at 60ms → close at 130ms (.closing, opacity 120ms ease), removed after 130ms; opening another menu closes this one instantly |  |
| `interruptible` | n/a — there is nothing to interrupt on open |  |
| `keyboard` | ↑/↓ move the highlight instantly (disabled rows skipped), Enter chooses with the same blink, Esc closes |  |
| `reduced` | unchanged (opacity only) |  |

Shown: Meeting ⋯ menu · Timeline

### Sheet · scale in over a scrim

A window-modal dialog: the scrim dims the window while the sheet settles from 96%, so focus clearly moves into it.

- **Maps to:** Radix Dialog: overlay <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }} />; content initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.16 } }} transition={{ duration: 0.26, ease: [0.23, 1, 0.32, 1], opacity: { duration: 0.2 } }}
- **Source:** `kit/mac-kit.js sheet() · mac-kit.css .scrim, .sheet, .sheet.closing`
- **Tokens:** `--scrim`, `--glass-strong`, `--shadow-window`, `--ease-out`
- **Motion:** sheet 0.96 → 1 in 260ms --ease-out over a 220ms scrim; exits in 160ms

| Prop | Values | Default |
|---|---|---|
| `trigger` | Kit.sheet(markup) — the kit’s window-modal dialog (002 flows use alerts; the content here is illustrative) |  |
| `element` | .scrim (window-wide) + .sheet (centred glass) |  |
| `properties` | scrim opacity 0 → 1 · sheet opacity 0 → 1, transform translate(-50%, -50%) scale(0.96) → scale(1) |  |
| `enter` | scrim 220ms ease · sheet opacity 200ms, transform 260ms var(--ease-out); autofocus after 60ms |  |
| `exit` | .closing → opacity 140ms, transform 160ms; scrim 220ms; removed after 200ms |  |
| `interruptible` | yes — CSS transitions |  |
| `keyboard` | Esc closes (kit layer stack); [data-close] buttons close with a result |  |
| `reduced` | opacity only |  |

Shown: Window-modal sheet · Timeline

### Alert · appear & dismiss

Confirmations for destructive or permission moments rise slightly less than sheets (95%) and leave quickly once answered.

- **Maps to:** Radix AlertDialog: content initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.14 } }} transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1], opacity: { duration: 0.18 } }}
- **Source:** `kit/mac-kit.js alert() · mac-kit.css .alert, .alert.closing · 002 app-actions.js T.confirmStopTracking, doc-organize.js D.deleteMeetingFlow, app-onboard.js askCalendar`
- **Tokens:** `--glass-strong`, `--shadow-window`, `--ease-out`
- **Motion:** scale 0.95 → 1 in 220ms --ease-out; closes in 140ms

| Prop | Values | Default |
|---|---|---|
| `trigger` | Kit.alert(): Stop tracking…, Delete meeting…, the calendar permission prompt in onboarding |  |
| `element` | .alert (centred glass at top 42%) |  |
| `properties` | opacity 0 → 1 · transform translate(-50%, -50%) scale(0.95) → scale(1) |  |
| `enter` | opacity 180ms, transform 220ms var(--ease-out) |  |
| `exit` | .closing → opacity 120ms, transform 140ms; removed after 160ms |  |
| `interruptible` | yes — CSS transitions |  |
| `keyboard` | Enter = primary, Esc = cancel — both play the exit |  |
| `reduced` | opacity only |  |

Shown: Stop tracking · Timeline

### Toast · enter, stack, exit

Confirmations rise from the bottom edge, stack newest-at-bottom, wait while you read them and offer Undo.

- **Maps to:** sonner <Toaster position="bottom-center" gap={8} duration={4200} /> (pauses on hover natively); style enter translateY(14px) scale(0.98) 340ms [0.23, 1, 0.32, 1], exit 180ms
- **Source:** `kit/mac-kit.js toast() · mac-kit.css .toast-stack, .toast.show, .toast.hide · 002 app-shell.js T.toast`
- **Tokens:** `--glass-strong`, `--shadow-float`, `--ease-out`
- **Motion:** rise 14px + 0.98 → 1 in 340ms --ease-out; leave 180ms; 4.2s lifetime, paused on hover

| Prop | Values | Default |
|---|---|---|
| `trigger` | T.toast / Kit.toast after an action (tracking, filing, saving, most Undo-able changes) |  |
| `element` | .toast-stack (column-reverse, 8px gap) > .toast (glass capsule, optional Undo) |  |
| `properties` | opacity 0 → 1 · transform translateY(14px) scale(0.98) → none; exit → translateY(10px) scale(0.98), opacity 0 |  |
| `enter` | opacity 220ms ease, transform 340ms var(--ease-out) (.show next frame) |  |
| `exit` | .hide → opacity 160ms, transform 180ms; removed after 200ms; auto-dismiss after 4200ms |  |
| `sequence` | a new toast appends at the bottom; older ones shift up without animation |  |
| `interruptible` | yes — hover pauses the timer (remaining time kept); leaving resumes with max(remaining, 1200ms) |  |
| `keyboard` | none — role=status; the Undo button runs the action, then dismisses |  |
| `reduced` | opacity only |  |

Shown: Two toasts, one with Undo · Timeline

### Notification banner · slide in & out

System-style banners slide in from the screen edge on a gentle spring and slide back out on ease-in-out — they come from outside the app.

- **Maps to:** Production: native macOS notification (tauri-plugin-notification) — the system animates it. Prototype: <motion.div initial={{ x: 'calc(100% + 24px)' }} animate={{ x: 0 }} exit={{ x: 'calc(100% + 24px)', transition: { duration: 0.24, ease: [0.77, 0, 0.175, 1] } }} transition={{ type: 'spring', duration: 0.4, bounce: 0.12 }} />
- **Source:** `kit/mac-kit.js notify() · mac-kit.css .notif, .notif.show, .notif.hide · 002 app-record.js T.notifyStarting, T.notifyReview`
- **Tokens:** `--spring`, `--spring-dur`, `--ease-in-out`
- **Motion:** slides in 490ms on --spring, out 240ms --ease-in-out; 7s lifetime

| Prop | Values | Default |
|---|---|---|
| `trigger` | Kit.notify(): “Product Sync is starting” (Starting, +600ms), “N items to review” (after filing, +250ms) |  |
| `element` | .notif-stack (top-right, under the menu bar) > .notif |  |
| `properties` | transform translateX(calc(100% + 24px)) → none |  |
| `enter` | var(--spring-dur) var(--spring) — 490ms, bounce 0.12 (≈ 0.3% overshoot); .show after two frames |  |
| `exit` | .hide → translateX(calc(100% + 24px)) 240ms var(--ease-in-out); removed after 260ms; auto-dismiss 7000ms |  |
| `interruptible` | yes — hover cancels the auto-dismiss; leaving dismisses after 2500ms |  |
| `keyboard` | none — click the body to open, action buttons act and dismiss |  |
| `reduced` | no slide — it appears and leaves in place (no opacity transition is declared) |  |

Shown: Product Sync is starting · Timeline

### Window · hide & show

The window disappears and returns instantly — macOS animates real windows, and the Island keeps working while it is closed.

- **Maps to:** Tauri getCurrentWindow().hide() / .show() + setFocus() — let the window server animate; never fake it in the webview
- **Source:** `002 app-shell.js T.hideWindow, T.showWindow · app-onboard.js T.summon`
- **Motion:** no animation in the app layer

| Prop | Values | Default |
|---|---|---|
| `trigger` | red traffic light, ⌘W, Hide Telu · ⌥Space, the menu-bar item or the Island bring it back |  |
| `element` | .window (hidden attribute) |  |
| `properties` | display none ↔ flex |  |
| `enter` | instant |  |
| `exit` | instant |  |
| `interruptible` | n/a |  |
| `keyboard` | ⌘W / ⌥Space — instant, like the pointer paths |  |
| `reduced` | same |  |

Shown: Hide · ⌘W, then show · ⌥Space · Timeline

### Toolbar · scroll-edge glass

The toolbar turns to frosted glass only once content slides under it, so the resting state stays flat and calm.

- **Maps to:** const { scrollY } = useScroll({ container: ref }); useMotionValueEvent(scrollY, 'change', (y) => setScrolled(y > 2)); CSS transition: background-color 200ms ease, box-shadow 200ms ease
- **Source:** `kit/mac-kit.js Kit.scrollEdge · mac-kit.css .toolbar.scrolled · 002 app.css .peek.pk-scrolled .pk-bar · app-peek.js T.wirePeek`
- **Tokens:** `--content-bg`, `--separator`
- **Motion:** background + hairline fade in 200ms ease when scrolled past 2px

| Prop | Values | Default |
|---|---|---|
| `trigger` | content scrollTop > 2px (Kit.scrollEdge, passive scroll listener); in the side peek #pkScroll > 2px adds .pk-scrolled |  |
| `element` | .toolbar.scrolled · .peek.pk-scrolled .pk-bar |  |
| `properties` | background-color transparent → color-mix(--content-bg 76% \| 82%) · box-shadow 0 0.5px --separator; backdrop-filter blur(18px) saturate(1.6) switches on without a tween |  |
| `enter` | 200ms ease |  |
| `exit` | 200ms ease |  |
| `interruptible` | yes — CSS transitions |  |
| `keyboard` | ↑/↓ in the doc scroll 48px steps and cross the same threshold |  |
| `reduced` | unchanged |  |

Shown: Agenda toolbar · Timeline

### Toolbar · large-title hand-off

The doc’s large title scrolls away with the page; a compact title fades into the toolbar exactly when the large one is gone.

- **Maps to:** const show = !useInView(titleRef, { root: scrollRef, margin: '-52px 0px 0px 0px' }) && scrolledPast; <motion.div animate={{ opacity: show ? 1 : 0, y: show ? 0 : 4 }} transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }} />
- **Source:** `002 doc-page.js observeTitle · doc.css .tb-title, .tb-title.show`
- **Tokens:** `--ease-out`, `--toolbar-h`
- **Motion:** compact title rises 4px and fades in, 180ms --ease-out

| Prop | Values | Default |
|---|---|---|
| `trigger` | IntersectionObserver on #docTitle (root .content, rootMargin −toolbar-h): shows when the H1 has left above the toolbar |  |
| `element` | .tb-title (series icon + name) in the doc toolbar |  |
| `properties` | opacity 0 → 1 · translateY(4px) → 0; the large title itself just scrolls (no scale) |  |
| `enter` | 180ms var(--ease-out) |  |
| `exit` | 180ms var(--ease-out) |  |
| `interruptible` | yes — CSS transition |  |
| `keyboard` | same — driven by scroll position |  |
| `reduced` | opacity only |  |

Shown: Product Sync doc · Timeline

### View switch · fade

Switching sidebar sections swaps the content and lets only the new view arrive — a soft blur-fade that says “new place”, without implying direction.

- **Maps to:** <AnimatePresence initial={false} mode="popLayout"><motion.div key={view} initial={{ opacity: 0, filter: 'blur(2px)' }} animate={{ opacity: 1, filter: 'blur(0px)' }} transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }} /></AnimatePresence> — no exit prop
- **Source:** `002 app-shell.js T.goView → T.fx.fadeIn(view, { duration: 200 }) · app-agenda.js fadeIn`
- **Tokens:** `--ease-out`
- **Motion:** arrival fade with 2px blur, 200ms --ease-out; no exit

| Prop | Values | Default |
|---|---|---|
| `trigger` | click Today / Upcoming / Review / Found in the sidebar; leaving a doc (Back, ⌘[) |  |
| `element` | #view (the agenda content host) |  |
| `properties` | new content: opacity 0 → 1, filter blur(2px) → 0 (translateY 0); the old view is replaced instantly |  |
| `enter` | 200ms var(--ease-out) (WAAPI) |  |
| `exit` | none |  |
| `interruptible` | restart — a new fade replaces the running one |  |
| `keyboard` | View-menu items and ⌘[ use the same fade; a restored side peek reopens instantly |  |
| `reduced` | no fade |  |

Shown: Sidebar sections · Timeline

### Day stepper · directional slide

Stepping days moves the agenda a short way in the direction of time, so yesterday feels to the left and tomorrow to the right.

- **Maps to:** <AnimatePresence mode="wait" custom={dir} initial={false}><motion.div key={day} custom={dir} initial={{ opacity: 0, x: 16 * dir }} animate={{ opacity: 1, x: 0, transition: { duration: 0.22, ease: [0.23, 1, 0.32, 1] } }} exit={{ opacity: 0, x: -16 * dir, transition: { duration: 0.14, ease: [0.23, 1, 0.32, 1] } }} /></AnimatePresence> — skip it for key presses
- **Source:** `002 app-agenda.js slideSwap, T.renderView({ direction }) · app-shell.js T.stepDay · app.js dayKey`
- **Tokens:** `--ease-out`
- **Motion:** out 16px/140ms, in 16px/220ms, both --ease-out, in the direction of travel

| Prop | Values | Default |
|---|---|---|
| `trigger` | click ‹ / › or Today in the toolbar stepper |  |
| `element` | #view (agenda day) |  |
| `properties` | out: opacity 1 → 0, translateX(0 → −16px × dir) · swap + scrollTop 0 · in: opacity 0 → 1, translateX(16px × dir → 0) |  |
| `enter` | 220ms var(--ease-out) |  |
| `exit` | 140ms var(--ease-out), fill forwards |  |
| `interruptible` | restart — each step cancels running animations and a token drops stale swaps (the latest click wins) |  |
| `keyboard` | ← / → step days instantly (renderView with direction 0) |  |
| `reduced` | instant swap |  |

Shown: Yesterday · Today · Tomorrow · Timeline

### Agenda · stagger in

When a whole day appears at once (calendar just connected), rows cascade top to bottom so the eye reads the day in order.

- **Maps to:** <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.04 } } }}> with children variants hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.23, 1, 0.32, 1] } }
- **Source:** `kit/mac-kit.js Kit.stagger · mac-kit.css .enter, @keyframes kit-enter · 002 app-agenda.js T.renderView({ stagger })`
- **Tokens:** `--ease-out`
- **Motion:** rows rise 6px and fade in 280ms --ease-out, 40ms apart

| Prop | Values | Default |
|---|---|---|
| `trigger` | T.renderView({ stagger: true }) — kept in 002 from sketch 001’s calendar-connect flow; 002’s onboarding path renders without it (dormant) |  |
| `element` | .a-timeline > * (rows, gaps, now line) via Kit.stagger → .enter with --i |  |
| `properties` | opacity 0 → 1 · translateY(6px) → 0 |  |
| `enter` | 280ms var(--ease-out), fill both, delay = i × 40ms |  |
| `sequence` | 40ms per row; input is never blocked |  |
| `interruptible` | restart — the class is re-applied |  |
| `reduced` | .enter animation off — rows appear at once |  |

Shown: Today · Timeline

### Progress hairline · grow & fade

A 2px line along the toolbar’s bottom edge shows a determinate background job, then fades rather than snapping away.

- **Maps to:** <motion.i style={{ originX: 0 }} initial={{ scaleX: 0, opacity: 1 }} animate={{ scaleX: 1 }} transition={{ duration: 0.9, ease: 'linear' }} onAnimationComplete={() => fadeOut(0.22)} /> — bind to real sync progress when available
- **Source:** `002 app-shell.js T.runProgress · app.css .a-progress`
- **Tokens:** `--accent`
- **Motion:** grows linearly over the job’s duration, fades 220ms

| Prop | Values | Default |
|---|---|---|
| `trigger` | T.runProgress(ms) — defined in 002 (sketch 001 ran it for 900ms while calendar events loaded); no 002 flow calls it yet (dormant) |  |
| `element` | .a-progress (2px accent line, toolbar bottom edge, origin left) |  |
| `properties` | transform scaleX(0 → 1) · then opacity 1 → 0 |  |
| `enter` | duration (default 900ms) linear, fill forwards |  |
| `exit` | 220ms ease-out fade |  |
| `interruptible` | restart — running animations are cancelled first |  |
| `reduced` | runs as is (it is information, not decoration) |  |

Shown: Toolbar progress · Timeline

### Event card · state morph

A meeting card changes state in place: only the parts that changed blur-crossfade, so the card never jumps and the change is easy to spot.

- **Maps to:** Per part: <AnimatePresence mode="wait" initial={false}><motion.div key={partKey} initial={{ opacity: 0, filter: 'blur(2px)' }} animate={{ opacity: 1, filter: 'blur(0px)', transition: { duration: 0.19, ease: [0.23, 1, 0.32, 1] } }} exit={{ opacity: 0, filter: 'blur(2px)', transition: { duration: 0.11, ease: 'easeOut' } }} /></AnimatePresence>
- **Source:** `002 app-agenda.js T.morphCard, crossfade, T.morphAll · app-record.js repaint, enterAfter · app.css .a-card::before`
- **Tokens:** `--ease-out`, `--coral`, `--c (series colour)`
- **Motion:** per-part crossfade 110ms out / 190ms in with 2px blur; accent bar grows 360ms

| Prop | Values | Default |
|---|---|---|
| `trigger` | state changes — track, record start/stop, starting, preparing → ready, review done, purpose saved (T.morphCard / T.morphAll) |  |
| `element` | .a-card: class list swaps at once; each changed [data-part] (eyebrow, chip, purpose, meta, actions, extra) crossfades on its own |  |
| `properties` | part out: opacity → 0, blur → 2px · swap · part in: opacity 0 → 1, blur 2px → 0 · ::before accent bar scaleY(0.2) → 1 + opacity when tracked, → coral when live |  |
| `enter` | part in 190ms var(--ease-out) · bar transform 360ms var(--ease-out), opacity 200ms ease, colour 220ms ease |  |
| `exit` | part out 110ms ease-out, fill forwards |  |
| `sequence` | T.morphAll staggers cards 40ms apart; recording stop → summarizing (morph) → after (full re-render + card fadeIn 240ms) |  |
| `interruptible` | restart — running part animations are cancelled first |  |
| `keyboard` | ⌘R morphs exactly like clicking Record |  |
| `reduced` | parts swap instantly; the bar snaps |  |

Shown: Product Sync · before → starting → recording → summarizing → after · Daily Standup · Not tracked → Tracking · Timeline

### Agenda rows · FLIP reflow

When a card changes height, the rows below glide to their new place instead of jumping — you keep track of where everything went.

- **Maps to:** framer-motion layout: <motion.div layout="position" transition={{ duration: 0.32, ease: [0.77, 0, 0.175, 1] }} /> on each row, and layout on the card so its height animates with them
- **Source:** `002 app-agenda.js flipRows (T.fx.flipRows) · app-record.js repaint · kit Kit.flip`
- **Tokens:** `--ease-in-out`
- **Motion:** rows translate from their old position, 320ms --ease-in-out

| Prop | Values | Default |
|---|---|---|
| `trigger` | recording start/stop repaint (T.fx.flipRows around T.morphCard) |  |
| `element` | #view [data-row] rows |  |
| `properties` | transform translateY(previous top − new top → 0) |  |
| `enter` | 320ms var(--ease-in-out) — on-screen movement uses ease-in-out |  |
| `interruptible` | restart |  |
| `keyboard` | ⌘R triggers the same repaint |  |
| `reduced` | no FLIP — rows jump |  |
| `notes` | the class swap is measured, but parts that empty after the 110ms crossfade shrink the card later, so rows finish the last few pixels with a jump — in production animate the card with layout so height and siblings move together. The sidebar never reorders in 002 (rows insert/remove with height); Kit.flip is the generic helper (x/y, 320ms, EASE_OUT) |  |

Shown: Product Sync next ↔ summarizing · Timeline

### Now line · static by design

The coral now line is placed, not animated: a line that crept every minute would pull the eye for no reason.

- **Maps to:** Static element in the list; recompute its position on a 60s interval without transitions
- **Source:** `002 app-agenda.js nowMarkup, timelineMarkup · app.css .a-now`
- **Tokens:** `--coral`
- **Motion:** no animation; the only moving thing near it is the starting card’s pulsing dot

| Prop | Values | Default |
|---|---|---|
| `trigger` | none — placed between rows by the clock (re-rendered on minute / scenario change) |  |
| `element` | .a-now (time label + 1px coral line + 8px dot) |  |
| `properties` | none |  |
| `enter` | none |  |
| `exit` | none |  |
| `interruptible` | n/a |  |
| `reduced` | same |  |

Shown: Today at 9:41 · Timeline

### Recording capsule · in & out

While recording, a coral capsule sits in the toolbar; it pops in softly and leaves faster, so starting feels deliberate and stopping feels done.

- **Maps to:** <AnimatePresence>{recording && <motion.div initial={{ opacity: 0, scale: 0.96, filter: 'blur(2px)' }} animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }} exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15, ease: 'easeOut' } }} transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }} />}</AnimatePresence>
- **Source:** `002 app-shell.js syncCapsule, recCapsule · app.css .a-rec-capsule`
- **Tokens:** `--coral-soft`, `--coral-ink`, `--ease-out`
- **Motion:** in 240ms --ease-out from 0.96 + 2px blur; out 150ms

| Prop | Values | Default |
|---|---|---|
| `trigger` | recording starts / stops while the agenda is showing (T.updateToolbar({ animate: true })) |  |
| `element` | #recSlot .a-rec-capsule (rec dot · title · timer · Stop) |  |
| `properties` | in: opacity 0 → 1, scale(0.96) → none, blur 2px → 0 · out: opacity → 0, scale(0.96), then removed |  |
| `enter` | 240ms var(--ease-out) |  |
| `exit` | 150ms ease-out |  |
| `interruptible` | restart (a new capsule is inserted only when none exists) |  |
| `keyboard` | ⌘R — same |  |
| `reduced` | inserted and removed instantly |  |

Shown: Stop, then record again · Timeline

### New series · parsed chips

As you type a sentence, each understood part lights up in its chip with a quick blur-in — you can see Telu understanding you.

- **Maps to:** <motion.b key={value} initial={{ opacity: 0.2, filter: 'blur(2px)' }} animate={{ opacity: 1, filter: 'blur(0px)' }} transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }} /> + a 90ms input debounce
- **Source:** `002 app-flows.js updateChips, wireNewSeries, newMarkup · app.css .a-pchip`
- **Tokens:** `--accent-soft`, `--accent-strong`, `--fill`
- **Motion:** changed values blur-in 180ms --ease-out; chip colour 180ms

| Prop | Values | Default |
|---|---|---|
| `trigger` | typing in the New series field (90ms debounce) → Kit.parseSeries → chip values |  |
| `element` | .a-pchip b (Title, Repeats, Day, Time, With) · chip background |  |
| `properties` | value: opacity 0.2 → 1, blur 2px → 0 (only chips whose value changed) · chip .is-empty (--fill) → --accent-soft |  |
| `enter` | value 180ms var(--ease-out) · chip colours 180ms ease |  |
| `interruptible` | restart per chip |  |
| `keyboard` | typing is the trigger — subtle by design (opacity from 0.2, 2px blur); Enter creates |  |
| `reduced` | no blur-in; colours still fade |  |

Shown: Weekly 1:1 with Priya, Thu 11am · Timeline

### Side peek · slide in & out

The peek slides in from the right edge on the drawer curve, keeping the agenda in view — it is a place beside the list, not a new page.

- **Maps to:** <AnimatePresence>{open && <motion.aside initial={{ x: 'calc(100% + 48px)' }} animate={{ x: 0, transition: { duration: 0.3, ease: [0.32, 0.72, 0, 1] } }} exit={{ x: 'calc(100% + 48px)', transition: { duration: 0.2, ease: [0.23, 1, 0.32, 1] } }} />}</AnimatePresence> — pass duration 0 when opened by Enter
- **Source:** `002 app-peek.js openPanel, closePanel, show, close · app.css .peek, .peek.open, .peek.instant, .main.peek-open`
- **Tokens:** `--ease-drawer`, `--ease-out`, `--peek-w`
- **Motion:** slides in 300ms --ease-drawer, out 200ms --ease-out

| Prop | Values | Default |
|---|---|---|
| `trigger` | click an agenda card (T.select → T.peek.show({ animate: true })); × or Esc closes |  |
| `element` | .peek (right panel, width max(440px, 44%)) · .main.peek-open (agenda right padding) |  |
| `properties` | transform translateX(calc(100% + 48px)) → none · visibility hidden → visible (on at the start of enter, off at the end of exit) · agenda padding-right changes instantly |  |
| `enter` | 300ms var(--ease-drawer) |  |
| `exit` | 200ms var(--ease-out); visibility hides after 200ms |  |
| `interruptible` | yes — CSS transition, reverses mid-slide |  |
| `keyboard` | Enter opens instantly (.instant, no transition); Esc closes with the 200ms exit; after Back the peek is restored instantly |  |
| `reduced` | .instant — no slide |  |

Shown: Agenda + side peek · Timeline

### Side peek · content swap

Clicking another card blur-crossfades the peek; arrowing through the list swaps it instantly so fast keyboard scanning never waits on motion.

- **Maps to:** <AnimatePresence mode="wait" initial={false}><motion.div key={selectionId} initial={{ opacity: 0, filter: 'blur(2px)' }} animate={{ opacity: 1, filter: 'blur(0px)', transition: { duration: 0.19, ease: [0.23, 1, 0.32, 1] } }} exit={{ opacity: 0, filter: 'blur(2px)', transition: { duration: 0.11 } }} /></AnimatePresence>; render without AnimatePresence when the change came from the keyboard
- **Source:** `002 app-peek.js render({ crossfade }) → T.fx.crossfade · app-agenda.js T.select, T.moveSelection`
- **Tokens:** `--ease-out`
- **Motion:** pointer: 110ms out / 190ms in with 2px blur · keyboard: instant

| Prop | Values | Default |
|---|---|---|
| `trigger` | click another card while the peek is open (show({ crossfade: true })) · ↑/↓ (T.moveSelection, animate: false) |  |
| `element` | #pkContent · the selection ring on the card |  |
| `properties` | crossfade: out opacity → 0 + blur 2px · swap + scroll to top · in opacity 0 → 1, blur → 0 · selection ring moves instantly |  |
| `enter` | 190ms var(--ease-out) |  |
| `exit` | 110ms ease-out |  |
| `interruptible` | restart — a keyboard swap cancels a running crossfade |  |
| `keyboard` | ↑/↓ swap the content and ring instantly (no crossfade), scroll resets |  |
| `reduced` | instant |  |

Shown: Click vs ↑/↓ · Timeline

### Open as page · swap & reveal

From the peek to the full doc: the peek gets out of the way instantly, the page blur-swaps in already scrolled to the meeting, and a soft flash marks where you are.

- **Maps to:** navigate → <motion.div key={docId} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }} />; after paint: scrollRef.current.scrollTop = target.offsetTop - 72, then animate(target, receiveKeyframes, { duration: 0.9 }) after 80ms
- **Source:** `002 app-peek.js peek-open-page · app-shell.js T.openDoc · doc-page.js D.paintPage, D.revealInPage, D.jumpToMeeting`
- **Tokens:** `--ease-out`, `--accent-soft`
- **Motion:** page blur-out 120ms → rise-in 180ms; target flash 900ms

| Prop | Values | Default |
|---|---|---|
| `trigger` | “Open as page” in the peek (or context menu); evidence “Jump to …” |  |
| `element` | peek (.instant close) · #view page · target section (#sec-next or #m-<id>) |  |
| `properties` | peek hides instantly · page out: opacity → 0 + blur 2px · paint doc · page in: opacity 0 → 1, translateY(4px) → 0 · target scrolled to the top instantly (scroll-margin-top toolbar + 20px) · target background flash (.receive) |  |
| `enter` | page in 180ms var(--ease-out) · receive 900ms var(--ease-out), 80ms after paint |  |
| `exit` | page out 120ms ease-out |  |
| `sequence` | Jump to (evidence): smooth scroll, then receive after 360ms |  |
| `interruptible` | restart — a swap token drops stale paints |  |
| `keyboard` | ⌘[ Back returns with the view fade and restores the peek instantly |  |
| `reduced` | no page swap; instant scroll; the receive flash stays (background only) |  |

Shown: Peek → Product Sync doc → Back · Timeline

### Collapsible · meetings & banner

Sections open in place: the body unfolds, the chevron turns and the one-line summary steps aside, so the list reads as the same list, just deeper.

- **Maps to:** Radix Collapsible + <motion.div initial={false} animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }} transition={{ height: { duration: 0.26, ease: [0.23, 1, 0.32, 1] }, opacity: { duration: 0.2 } }} style={{ overflow: 'hidden' }} />; chevron <motion.svg animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }} />
- **Source:** `kit/mac-kit.css .collapsible, .disclosure · 002 doc-page.js D.toggleMeeting, D.togglePeekTranscript · doc.css .mtg-line · app-agenda.js T.updateBanner`
- **Tokens:** `--ease-out`
- **Motion:** grid-rows unfold 260ms --ease-out with a 200ms fade; chevron turns 90° in 200ms

| Prop | Values | Default |
|---|---|---|
| `trigger` | click a past-meeting head (D.toggleMeeting); Hide the calendar banner / last proposal decided (T.updateBanner); peek “Open transcript”; New series linked row |  |
| `element` | .collapsible (grid) > child · .disclosure chevron · .mtg-line summary |  |
| `properties` | grid-template-rows 1fr ↔ 0fr + opacity · chevron rotate(0 → 90deg) · summary line opacity 1 → 0 while open |  |
| `enter` | rows 260ms var(--ease-out), opacity 200ms ease · chevron 200ms var(--ease-out) · summary line 180ms var(--ease-out) |  |
| `exit` | symmetric |  |
| `interruptible` | yes — CSS transitions retarget mid-way |  |
| `keyboard` | Open as page / Jump expand the target meeting as they scroll to it |  |
| `reduced` | rows and chevron snap; opacity still fades |  |

Shown: Past meetings · Calendar banner · Timeline

### Next block · repaint

When the brief changes state (ready, recording, preparing the summary) the block blurs out and rises back in with its new content.

- **Maps to:** <AnimatePresence mode="wait" initial={false}><motion.section key={state} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0, transition: { duration: 0.2, ease: [0.23, 1, 0.32, 1] } }} exit={{ opacity: 0, filter: 'blur(2px)', transition: { duration: 0.12, ease: 'easeOut' } }} /></AnimatePresence>
- **Source:** `002 doc-render.js D.paintNextBlock, D.nextParts · app-peek.js maybePrepare · app-record.js repaint`
- **Tokens:** `--ease-out`
- **Motion:** blur-out 120ms, rise-in 200ms --ease-out

| Prop | Values | Default |
|---|---|---|
| `trigger` | brief finishes preparing (2.6s after the peek shows it), recording starts / stops, summary filed (D.paintNextBlock) |  |
| `element` | .next section in the page and the peek |  |
| `properties` | out: opacity → 0 + blur 2px · swap class + content · in: opacity 0 → 1, translateY(4px) → 0 |  |
| `enter` | 200ms var(--ease-out) |  |
| `exit` | 120ms ease-out |  |
| `interruptible` | restart |  |
| `keyboard` | ⌘R — same |  |
| `reduced` | instant |  |

Shown: Brief → recording → preparing summary → brief · Timeline

### Live lines · append

Transcript lines and the one “Worth asking now” arrive at the bottom of the live block with a small rise, so new speech is noticeable but calm.

- **Maps to:** <AnimatePresence initial={false}>{lines.map((l) => <motion.div key={l.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }} />)}</AnimatePresence>
- **Source:** `002 app-record.js appendLine, LIVE_SCRIPT, T.scheduleLive · doc-render.js liveInner · kit .enter`
- **Tokens:** `--ease-out`, `--coral`
- **Motion:** each new line rises 6px and fades in, 280ms --ease-out

| Prop | Values | Default |
|---|---|---|
| `trigger` | a transcript line or the suggestion arrives while recording (scripted at 1.4s, 3.8s and 5.8s after start) |  |
| `element` | [data-live-lines] > .live-line / .ask (doc page and peek) |  |
| `properties` | opacity 0 → 1 · translateY(6px) → 0 (.enter) · the “Listening…” placeholder is removed instantly |  |
| `enter` | 280ms var(--ease-out) |  |
| `interruptible` | restart |  |
| `reduced` | lines appear at once |  |

Shown: Recording · Listening… → lines · Timeline

### Review · accept, correct, reject

Review decisions apply instantly — the row simply becomes its new state — and the motion happens where the item lands: Memory, counts and the list.

- **Maps to:** Render the row state directly (no AnimatePresence on it); play the receive keyframes on the Memory item when it mounts; Accept all: pending.forEach((c, i) => setTimeout(() => accept(c), i * 70))
- **Source:** `002 doc-review.js D.setCandState, acceptOne, D.acceptAll · doc-past.js D.candRow, D.reviewHead · app-actions.js T.pagesAfterReview`
- **Tokens:** `--amber`, `--accent-strong`
- **Motion:** no row animation; feedback is the Memory receive and the count bump

| Prop | Values | Default |
|---|---|---|
| `trigger` | Accept / Correct / Reject / Undo on a candidate; Accept all |  |
| `element` | .cand row (re-rendered) · .review-head · .mtg-counts · the Memory item · the scrubber Memory tick · sidebar Review count |  |
| `properties` | row swaps state at once (amber bar goes, “✓ In Memory”, strike-through when rejected, outlined field when correcting) · landed items receive (see Receive) · counts bump |  |
| `enter` | instant row swap · Memory receive 1500ms · tick receive 900ms · count bump 420ms |  |
| `sequence` | Accept all: 70ms per candidate so each one visibly lands; Review page: a meeting with nothing pending collapses after a 500ms beat (removeAnimated 220ms) |  |
| `interruptible` | n/a (instant); receive restarts |  |
| `keyboard` | Enter saves a correction, Esc cancels — instant |  |
| `reduced` | same (receive is background-only) |  |

Shown: Product Sync #37 candidates · Timeline

### List · remove & insert

Items leave and arrive by folding their height, so neighbours close the gap (or make room) smoothly instead of jumping.

- **Maps to:** <AnimatePresence initial={false}>{items.map((i) => <motion.div key={i.id} initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1, transition: { duration: 0.28, ease: [0.23, 1, 0.32, 1] } }} exit={{ height: 0, opacity: 0, marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0, transition: { duration: 0.22, ease: [0.23, 1, 0.32, 1] } }} style={{ overflow: 'hidden' }} />)}</AnimatePresence>
- **Source:** `kit/mac-kit.js Kit.removeAnimated, Kit.enterAnimated · 002 app-flows.js decideProposal · app-actions.js T.fileUnfiled · app-shell.js T.revealSeriesRow, T.dropSeriesRow · doc-edit.js D.addAgendaItem, D.askToAgenda · doc-organize.js restore`
- **Tokens:** `--ease-out`
- **Motion:** height folds away 220ms, unfolds 280ms, both --ease-out

| Prop | Values | Default |
|---|---|---|
| `trigger` | remove: decide a Found proposal, file an unfiled card, a fully reviewed meeting (Review page), move / unfile / split / delete a past meeting, stop tracking (sidebar row) · insert: new sidebar series row, new purpose agenda row (Enter), agenda item added (incl. from Worth asking), newest meeting filed, Undo of a moved meeting |  |
| `element` | any row or card (Kit.removeAnimated / Kit.enterAnimated) |  |
| `properties` | remove: height, margin-top/bottom, padding-top/bottom → 0 and opacity → 0 (overflow hidden), then removed · insert: height 0 → measured, opacity 0 → 1, then overflow restored |  |
| `enter` | insert 280ms var(--ease-out) (+ .receive when you should find it) |  |
| `exit` | remove 220ms var(--ease-out) |  |
| `interruptible` | no — each runs to completion |  |
| `keyboard` | Enter in the standing agenda inserts with the same expand (it creates content) |  |
| `reduced` | removed / inserted instantly |  |
| `notes` | Undo differs by place: Found proposals re-render instantly; moved meetings re-insert with the expand and a receive flash |  |

Shown: Found in Calendar · decide · Worth asking → agenda · Timeline

### Receive & bump · landing feedback

Whatever just arrived glows briefly, and any number that changed gives a small bump — the eye is pulled to exactly the thing that changed.

- **Maps to:** useAnimate(): animate(el, { backgroundColor: ['var(--accent-soft)', 'var(--accent-soft)', 'rgba(0,0,0,0)'] }, { duration: 0.9, times: [0, 0.3, 1], ease: [0.23, 1, 0.32, 1] }) · animate(el, { scale: [1, 1.18, 1] }, { duration: 0.42, times: [0, 0.4, 1], ease: [0.23, 1, 0.32, 1] })
- **Source:** `kit/mac-kit.css .receive, .bump, @keyframes kit-receive, kit-bump · 002 doc-page.js D.receive, D.paintPageMemory · app-shell.js T.updateCounts · doc.css .mem-item.receive · island.js patchBrief`
- **Tokens:** `--accent-soft`, `--ease-out`
- **Motion:** soft accent glow 900ms (Memory 1500ms); count bump to 1.18 in 420ms

| Prop | Values | Default |
|---|---|---|
| `trigger` | receive: accepted item in Memory, a flight landing (sidebar row, menu-bar item), Open as page target, Jump to meeting, agenda item from Worth asking, onboarding added row · bump: sidebar counts change, Island “N docs” chip, flight target icon |  |
| `element` | .receive (D.receive restarts it) · .bump |  |
| `properties` | receive: background-color --accent-soft, held for 30%, → transparent · bump: transform scale 1 → 1.18 (40%) → 1 |  |
| `enter` | receive 900ms var(--ease-out) (.mem-item 1500ms) · bump 420ms var(--ease-out) |  |
| `interruptible` | restart — remove the class, force a reflow, add it again |  |
| `reduced` | receive stays (background only); bump is turned off |  |

Shown: Accepted items land in Memory · Sidebar counts · Timeline

### Save state · saving, saved & version bump

Editing the purpose is saved silently: the toolbar says “Saving…” then “Saved”, the version ticks up once, and the “drafted” note steps aside.

- **Maps to:** Save label: plain text + transition-colors duration-150; version: <motion.span key={version} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.42, ease: [0.23, 1, 0.32, 1] }} />; chip exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.16 } }}; debounce 700ms
- **Source:** `002 doc-edit.js markEdited, scheduleSave, dropDraftedChip · app-shell.js T.setSaveState · doc.css .save-state, .ver-bump`
- **Tokens:** `--label-2`, `--label-3`, `--accent-strong`
- **Motion:** text swap + 150ms colour; one 420ms version bump on the first edit; drafted chip out 160ms

| Prop | Values | Default |
|---|---|---|
| `trigger` | typing in the purpose (D.onInput) or renaming the title |  |
| `element` | #saveState (toolbar) · #purposeMeta (.sec-meta) · #draftedChip |  |
| `properties` | save label text swaps instantly “Saving…” → “Saved” 700ms after the last keystroke; colour --label-3 → --label-2 while busy · version meta re-enters opacity 0 → 1, translateY(3px) → 0 and turns accent · drafted chip opacity → 0, scale(0.96), then removed |  |
| `enter` | label colour 150ms ease · version bump 420ms var(--ease-out) |  |
| `exit` | drafted chip 160ms ease-out |  |
| `interruptible` | the 700ms debounce resets on every keystroke |  |
| `keyboard` | typing is the trigger; the label text never animates |  |
| `reduced` | drafted chip removed at once; .ver-bump still plays (not covered by the kit’s reduced block — production should reduce it to opacity) |  |

Shown: Drafted purpose, first edit · Timeline

### Chips · attach, remove, include

Attached files pop into the Reference row one after another; removed ones shrink away; the include dot fills or empties in place.

- **Maps to:** <motion.button initial={{ opacity: 0, y: 3, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15, ease: 'easeOut' } }} transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1], delay: i * 0.04 }} /> inside <AnimatePresence>
- **Source:** `002 doc-edit.js animateNewChips, D.attachToPurpose, T.attachToMeeting · doc-popovers.js removeRef, setInclude · doc.css .chip-in, @keyframes chip-in, .inc-dot`
- **Tokens:** `--accent`, `--label-3`
- **Motion:** new chips rise 3px from 0.95 with a 40ms stagger; removed chips shrink to 0.95 in 150ms

| Prop | Values | Default |
|---|---|---|
| `trigger` | files dropped or picked into Reference / meeting docs; Remove from Reference; click the include dot |  |
| `element` | .ref-chip / .doc-chip (.chip-in) · .inc-dot |  |
| `properties` | in: opacity 0 → 1, translateY(3px) scale(0.95) → none · out: opacity → 0, scale(0.95), then removed · include dot: accent fill ↔ inset ring |  |
| `enter` | chip-in 280ms var(--ease-out), 40ms apart · include dot 150ms ease |  |
| `exit` | chip out 150ms ease-out |  |
| `interruptible` | chip-in restarts; removal runs to completion |  |
| `keyboard` | ⌘O (file picker) → the same chip-in |  |
| `reduced` | removal is instant; .chip-in still plays (not covered by the kit’s reduced block) |  |

Shown: Reference row · Timeline

### Drop targets · light up

While something is dragged, the places that accept it light up with a dashed wash and a hint, and a sidebar row grows slightly under the pointer.

- **Maps to:** Track drag state (onDragEnter / onDragLeave counters) → data-drop on the zone; CSS transitions as listed; sidebar row <motion.div animate={{ scale: over ? 1.03 : 1 }} transition={{ duration: 0.14, ease: [0.23, 1, 0.32, 1] }} /> — Tauri: onDragDropEvent on the window
- **Source:** `002 doc-edit.js setZone, wireZone · doc.css .purpose::after, .drop-hint · app.css .t-app .sb-item.drop-over, .sidebar.dnd · doc-organize.js onDragStart, setDropRow`
- **Tokens:** `--accent`, `--accent-soft`, `--accent-softer`
- **Motion:** dashed wash 150ms; hint rises 200ms --ease-out; target row grows to 1.03 in 140ms

| Prop | Values | Default |
|---|---|---|
| `trigger` | file drag over Purpose or “Docs for this meeting” (D.wireDrops) · meeting grip dragged over sidebar rows (D.wireMeetingDrag) |  |
| `element` | .purpose.drop-target::after + .drop-hint · .next-docs.drop-target (kit dashed outline) · .t-app .sb-item.drop-over · .mtg.dragging · .sidebar.dnd rows |  |
| `properties` | purpose wash opacity 0 → 1 · hint opacity + translateY(4px) scale(0.97) → none · sidebar row → --accent-soft + scale(1.03) · dragged meeting opacity 0.45 (instant) · dnd rows get an inset accent ring (instant) |  |
| `enter` | wash 150ms ease · hint opacity 150ms, transform 200ms var(--ease-out) · row scale 140ms var(--ease-out), background 120ms ease · next-docs outline instant |  |
| `exit` | same |  |
| `interruptible` | yes — CSS transitions |  |
| `reduced` | opacity and colour only |  |

Shown: Purpose accepts a file · a sidebar row accepts a meeting · Timeline

### Transcript drawer · slide & shift

The transcript drawer floats in from the right while the doc column slides left just enough to stay readable beside it.

- **Maps to:** <motion.aside initial={{ x: 'calc(100% + 24px)' }} animate={{ x: 0 }} exit={{ x: 'calc(100% + 24px)', transition: { duration: 0.2, ease: [0.32, 0.72, 0, 1] } }} transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }} /> + the doc column <motion.div animate={{ x: open ? -shift : 0 }} transition={{ duration: open ? 0.3 : 0.2, ease: [0.32, 0.72, 0, 1] }} />
- **Source:** `002 doc-page.js D.openDrawer, shiftCanvas, D.closeDrawer, D.openTranscript · doc.css .drawer, .canvas-inner, .main.drawer-open .scrubber`
- **Tokens:** `--ease-drawer`, `--glass-strong`, `--shadow-float`
- **Motion:** drawer + column move together on --ease-drawer: 300ms open, 200ms close

| Prop | Values | Default |
|---|---|---|
| `trigger` | Open transcript · evidence → transcript · Details (inspector) button |  |
| `element` | .drawer (glass, 340px, floats inside .main) · .canvas-inner (doc column) · .scrubber |  |
| `properties` | drawer translateX(calc(100% + 24px)) → none + visibility · doc column translateX(0 → --shift) · scrubber opacity → 0 · highlighted line background; the body scrolls to centre it instantly |  |
| `enter` | drawer 300ms var(--ease-drawer) · column 300ms var(--ease-drawer) · scrubber 200ms ease |  |
| `exit` | drawer 200ms var(--ease-drawer), visibility after 200ms · column 200ms |  |
| `interruptible` | yes — CSS transitions |  |
| `keyboard` | Esc closes with the 200ms exit |  |
| `reduced` | no slide or shift; the scrubber fade stays |  |

Shown: Transcript · Tue 22 Sep · Timeline

### Scrubber · active tick & labels

The right-edge scrubber is quiet ticks until hovered; the tick for the section you are reading grows and turns accent as you scroll.

- **Maps to:** useInView per section → activeId; <motion.span animate={{ scaleX: active ? 1 : 0.56 }} style={{ originX: 1 }} transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }} />; labels group-hover:opacity-100 group-hover:translate-x-0 duration-150
- **Source:** `002 doc-page.js D.refreshMarks, D.updateActiveMark, D.scrubTo · doc.css .scrubber, .scrub-tick, @keyframes tick-receive`
- **Tokens:** `--accent`, `--label-4`, `--glass-strong`
- **Motion:** active tick grows + tints 200ms; labels slide in 150ms on hover; receive pulse 900ms

| Prop | Values | Default |
|---|---|---|
| `trigger` | scrolling the doc (IntersectionObserver + rAF-throttled scroll) → active mark · hover → labels · accepted Memory → tick receive · click → smooth scroll to the section |  |
| `element` | .scrubber · .scrub-item.active .scrub-tick · .scrub-label |  |
| `properties` | tick scaleX(0.56) → 1 and --label-4 → --accent · labels opacity 0 → 1, translateX(4px) → 0 · glass background on hover · tick receive: scale(1.2, 2.4) + accent at 30% |  |
| `enter` | tick 200ms var(--ease-out) · labels 150ms var(--ease-out) · glass 200ms ease · receive 900ms var(--ease-out) · press 0.96 in 140ms |  |
| `interruptible` | yes (transitions); receive restarts |  |
| `keyboard` | click scrolls smoothly (instantly under reduced motion) |  |
| `reduced` | labels fade without sliding; the tick changes colour, width snaps |  |

Shown: Doc scrubber · Timeline

### Fly to sidebar · new series

Creating or tracking a series sends a small copy of it flying into the sidebar, where the row glows and its icon bumps — you see exactly where it went.

- **Maps to:** Portal flyer of two nested motion.divs: outer animate={{ x: dx }} transition={{ duration: 0.56, ease: [0.45, 0, 0.2, 1] }}, inner animate={{ y: dy, scale, opacity: 0.35 }} transition={{ duration: 0.56, ease: [0.6, 0, 0.9, 0.7] }}; onAnimationComplete → receive + bump the target
- **Source:** `kit/mac-kit.js Kit.flyTo · 002 app-flows.js createSeries · app-shell.js T.revealSeriesRow, T.flyMarkup · app.css .t-app .sb-item.landing`
- **Tokens:** `--glass-strong`, `--shadow-float`, `--accent-soft`
- **Motion:** 560ms arc (split x/y easing), shrinking toward the row; landing glow + icon bump

| Prop | Values | Default |
|---|---|---|
| `trigger` | Create in New series · Track as series (Found) · Track on a card or in the peek · Undo of stop-tracking |  |
| `element` | a floating chip (.fly-chip / T.flyMarkup) from the source (#newPreview, proposal card, event card) to the sidebar row |  |
| `properties` | flyer x: translateX(0 → dx) · flyer y: translateY(0 → dy) + scale(1 → max(0.4, target h / source h)) + opacity 1 → 0.35 · target row: .landing (opacity 0) until the flyer lands (Create) or height-expands in (Track) · on landing: row .receive + series icon .bump |  |
| `enter` | 560ms — x cubic-bezier(0.45, 0, 0.2, 1), y/scale/opacity cubic-bezier(0.6, 0, 0.9, 0.7): the split easing curves the path |  |
| `exit` | flyer removed on finish · receive 900ms · bump 420ms · landing row opacity 150ms |  |
| `interruptible` | no — one flight per action |  |
| `keyboard` | ⌥⌘N → Enter flies the same way (it confirms a creation) |  |
| `reduced` | no flight; the target receives immediately |  |

Shown: Create “Growth Review” · Timeline

### Move meeting · fold out & fly

Moving a meeting to another series folds it out of the list while a date chip flies to the destination row — the two motions tell one story.

- **Maps to:** Run the portal flyer (see Fly to sidebar) and the list exit (AnimatePresence, height → 0, 0.22s) together; Undo re-adds the item with the enter height animation and the receive keyframes
- **Source:** `002 doc-organize.js leaveList, D.moveMeetingFlow, D.unfileMeetingFlow, D.splitMeetingFlow, restore`
- **Tokens:** `--ease-out`, `--accent-soft`
- **Motion:** fold out 220ms + 560ms flight to the row; Undo unfolds 280ms with a glow

| Prop | Values | Default |
|---|---|---|
| `trigger` | meeting ⋯ menu → Move to another series / Remove from this doc / Split into new doc · dragging the grip onto a sidebar row |  |
| `element` | .mtg (past meeting) → sidebar series row, or the Review row |  |
| `properties` | flyer .fly-chip (calendar icon + date) from the meeting head to the row, while the meeting height-collapses · target row receives · drag-and-drop skips the flight (the row receives) · Undo re-inserts with the height expand + receive |  |
| `enter` | flight 560ms (split easing) · collapse 220ms var(--ease-out) · receive 900ms |  |
| `sequence` | flight and collapse run in parallel; unfile updates the counts after 560ms so the Review count bumps as the chip lands |  |
| `interruptible` | no |  |
| `keyboard` | menu selection (instant menu) → the same flight |  |
| `reduced` | no flight, no collapse; the row receives |  |

Shown: Tue 15 Sep → Acme · Timeline

### Recording · pulse, bars & timer

While Telu records, a pulsing coral dot, moving bars and a ticking timer say “live” everywhere at once — status, not decoration.

- **Maps to:** CSS keyframes (cheapest): @keyframes rec { 50% { opacity: .3 } } 1.4s ease-in-out infinite; bars scaleY keyframes 900ms with negative delays — production can drive scaleY from the real input level via a motion value; timer: useEffect interval 1000ms, font-variant-numeric: tabular-nums
- **Source:** `kit/mac-kit.css .rec-dot, @keyframes kit-rec, .wave, @keyframes kit-wave, Kit.timer · 002 app.css .a-card.is-starting .a-mini-dot · doc.css .countdown .mini-dot · island.css .island .rec-dot.paused, .island .wave.paused, tick → refit`
- **Tokens:** `--coral`, `--coral-soft`
- **Motion:** rec dot 1.4s pulse · waveform 900ms staggered bars · timer ticks without animation

| Prop | Values | Default |
|---|---|---|
| `trigger` | recording is on (and “Starting now” before it) |  |
| `element` | .rec-dot (capsule, card eyebrow, doc live strip, status item, Island) · .a-card.is-starting .a-mini-dot · .countdown .mini-dot · .wave (a-wave 11px, live-wave, il-wave 13px) · [data-rec-timer] / [data-il-elapsed] |  |
| `properties` | dot opacity 1 → 0.3 → 1 · bars scaleY(0.3) → 1 → 0.3 with negative delays 0, −200, −450, −650, −100ms (never in sync) · timer text every second; tabular-nums + min-width 30–36px keep it steady; the Island refits its width when 9:59 becomes 10:00 |  |
| `enter` | dot 1.4s ease-in-out infinite · bars 900ms ease-in-out infinite · timer setInterval 1000ms |  |
| `interruptible` | loops; Island pause freezes them (animation none, dot opacity 0.45, bars at 0.3) |  |
| `reduced` | dot slowed to 2.4s (kept — it carries status); bars stop at rest; timer unchanged |  |

Shown: Capsule · live strip · starting chip · Waveforms · card · doc · Island · Timeline

### Loading · shimmer & spinner

Work in progress is shown where the result will appear: a shimmer where text is coming, a small spinner where a job is running.

- **Maps to:** Tailwind bg-[length:200%_100%] animate-[shimmer_1.3s_linear_infinite] with @keyframes shimmer { from { background-position: 100% 0 } to { background-position: -100% 0 } }; spinner: lucide Loader2 / border spinner with animate-spin at 700ms
- **Source:** `kit/mac-kit.css .shimmer, @keyframes kit-shimmer, .spinner, @keyframes kit-spin · 002 app-agenda.js chipMarkup · doc-render.js preparingInner, provenance · island.js filingPill`
- **Tokens:** `--fill`, `--fill-3`, `--label-2`
- **Motion:** shimmer sweep 1.3s linear; spinner 700ms linear

| Prop | Values | Default |
|---|---|---|
| `trigger` | brief being prepared, summary being prepared, Island filing |  |
| `element` | .shimmer (chips “Preparing brief” / “Preparing summary…”, .prep-lines) · .spinner (14px, .tiny 10px, Island filing 13px) |  |
| `properties` | shimmer: background-position 100% → −100% across a 200%-wide --fill → --fill-3 → --fill gradient · spinner: rotate 0 → 360deg |  |
| `enter` | shimmer 1.3s linear infinite · spinner 700ms linear infinite |  |
| `interruptible` | loops — removed when the state ends |  |
| `reduced` | shimmer stops on a flat fill; the spinner keeps turning (status) |  |

Shown: Chips · preparing · Next block · preparing summary · Timeline

### Island · morph between modes

The Island is one shape that changes: its glass shell springs to each new size while the old content leaves first and the new content arrives just after — it never pops.

- **Maps to:** Separate transparent always-on-top NSPanel window. <motion.div animate={{ width, height, borderRadius }} transition={{ type: 'spring', duration: 0.4, bounce: 0.12 }}> (measured sizes, not layout scale, so text never stretches) + <AnimatePresence mode="popLayout"><motion.div key={variant} initial={{ opacity: 0, filter: 'blur(2px)', scale: 0.97 }} animate={{ opacity: 1, filter: 'blur(0px)', scale: 1, transition: { delay: shrinking ? 0.17 : 0.08, duration: 0.16, scale: { duration: 0.24, ease: [0.23, 1, 0.32, 1] } } }} exit={{ opacity: 0, filter: 'blur(2px)', transition: { duration: 0.09 } }} /></AnimatePresence>; the Tauri panel is sized to the largest variant up front
- **Source:** `002 island.js morph, resize, retire, fix, radiusFor · island.css .island, .il, .il.pre, .il.out`
- **Tokens:** `--spring`, `--spring-dur`, `--glass-strong`, `--ease-out`
- **Motion:** shell springs 490ms (--spring); content out 90ms, in +80ms (170ms when shrinking)

| Prop | Values | Default |
|---|---|---|
| `trigger` | Island.set(mode) from the app (scenario, recording, filing), expand / collapse and flashes |  |
| `element` | .island (glass shell, overflow hidden) + one .il content layer per variant |  |
| `properties` | shell width, height, border-radius (pill h/2 = 18px · cards 22px · drop target 20px) · new layer: opacity 0 → 1, blur 2px → 0, scale(0.97) → 1 (.pre removed next frame) · old layer: opacity → 0, blur 2px (.out), removed after 160ms |  |
| `enter` | shell var(--spring-dur) var(--spring) — 490ms, bounce 0.12 · layer in: opacity / blur 160ms, transform 240ms var(--ease-out), delayed 80ms after the shell starts when growing |  |
| `exit` | old layer 90ms ease-out at once; when the new area is smaller the shell waits --morph-delay 90ms so content leaves before it shrinks, and the new layer enters at 90 + 80 = 170ms |  |
| `interruptible` | yes — CSS transitions retarget from the current size; stacked layers retire in order |  |
| `keyboard` | coming back from hidden (or the first paint) is instant — no morph |  |
| `reduced` | size snaps (width / height / radius are not in the reduced list); layers still crossfade |  |
| `notes` | one Island exists per page (a singleton); these demos re-claim it into their own stage on every step, so the Island section’s playground may show a stale copy until it is used again |  |

Shown: Every mode · Timeline

### Island · hover intent & pin

Resting the pointer on the pill opens the card after a short intent delay; leaving closes it after a grace period, so passing over it never flickers.

- **Maps to:** onPointerEnter → setTimeout(expand, 150) unless the target is a button; onPointerLeave → setTimeout(collapse, 300) unless pinned; clear both timers on re-enter; click / Enter pins, Esc collapses
- **Source:** `002 island.js intend, onEnter, onLeave, pin, collapse, onDocDown, MS.hoverIn / hoverOut · island.css .island[data-shape="pill"]:active`
- **Tokens:** `--spring`
- **Motion:** 150ms intent, 300ms grace; the shell springs between pill and card

| Prop | Values | Default |
|---|---|---|
| `trigger` | hover the pill (before, starting, live, after — when there is a subject) · click / Enter / Space pins · Esc or a click outside collapses |  |
| `element` | .island (pill ↔ brief / live card / after card) |  |
| `properties` | expand 150ms after the pointer settles (not over a button) · collapse 300ms after it leaves unless pinned · pill press scale(0.97) |  |
| `enter` | intent 150ms → shell spring 490ms (see morph) |  |
| `exit` | 300ms grace → spring back |  |
| `interruptible` | yes — re-entering within 300ms cancels the collapse; hovering a button cancels the intent |  |
| `keyboard` | Enter / Space on the focused Island pins it open; Esc collapses — the morph still plays (it is the Island’s own state) |  |
| `reduced` | sizes snap; content crossfades |  |

Shown: Hover → brief → leave · pin → Esc · Timeline

### Island · attach & bouncy “Attached”

Dragging a file anywhere turns the Island into a drop target; dropping lands with a bouncier spring — the one place Telu allows a little play.

- **Maps to:** Window-level drag listeners → Island variant 'hint' | 'drop'; on drop variant 'attached' for 1200ms with transition={{ type: 'spring', duration: 0.5, bounce: 0.28 }}; Tauri: onDragDropEvent on the Island panel
- **Source:** `002 island.js accept, setDrag, attach, flash, VIEWS.attached { bounce: true }, MS.attached / dragIdle · island.css .island.bouncy, .il-drop`
- **Tokens:** `--spring-bounce`, `--spring-bounce-dur`, `--accent`
- **Motion:** drop target springs open; Attached lands on --spring-bounce (600ms) and returns after 1.2s

| Prop | Values | Default |
|---|---|---|
| `trigger` | a file drag anywhere while a meeting is attachable (before, starting, live) |  |
| `element` | .island → hint pill (“Drop on Telu to attach to …”) → .il-drop.drop-target (380 × 104, radius 20) → “Attached” pill |  |
| `properties` | the shell morphs at each stage; “Attached” switches the shell to .bouncy; flashes return to the mode after their dwell |  |
| `enter` | hint / drop target 490ms --spring · Attached 600ms --spring-bounce (bounce 0.28) |  |
| `sequence` | dwell: Attached 1200ms · Already 1400ms · Invalid 1600ms · Skipped 1700ms; no dragover for 1000ms ends the drag |  |
| `interruptible` | yes |  |
| `reduced` | sizes snap |  |

Shown: Drag Sprint 43 plan.pdf onto the Island · Timeline

### Island · mint dot & suggestion

When Telu has one thing worth asking, a mint dot fades into the live pill and gently pulses; opening the card shows the suggestion rising into place.

- **Maps to:** dot: <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="animate-[pulse_1.8s_ease-in-out_0.3s_infinite]" />; card: <motion.div initial={{ opacity: 0, y: 6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.32, delay: 0.14, ease: [0.23, 1, 0.32, 1] }} exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.15 } }} />
- **Source:** `002 island.js arriveSuggestion, patchLivePill, patchSuggestion, feedback, MS.suggest · island.css .il-mint-dot, .il-sugg.arrive, .il-sugg.leaving`
- **Tokens:** `--mint`, `--mint-soft`, `--mint-ink`
- **Motion:** mint dot fades in then pulses 1.8s; suggestion rises 6px in 320ms (+140ms)

| Prop | Values | Default |
|---|---|---|
| `trigger` | 1200ms after live begins, if there is a suggestion |  |
| `element` | .il-mint-dot in the live pill · .il-sugg card in the live card |  |
| `properties` | dot opacity 0 → 1, then opacity 1 ↔ 0.35 · card opacity 0, translateY(6px) scale(0.98) → none · Useful / Dismiss: card opacity → 0, scale(0.98), then removed and the shell refits |  |
| `enter` | dot fade 300ms var(--ease-out), pulse 1.8s ease-in-out infinite from 300ms · card 320ms var(--ease-out) after 140ms |  |
| `exit` | card 150ms var(--ease-out), then the shell springs smaller |  |
| `interruptible` | yes |  |
| `reduced` | no dot pulse and no card rise — both simply appear |  |

Shown: Live pill → mint dot · Timeline

### Island · transcript typing

Live lines type in word by word at speaking pace, so the card feels like it is listening rather than refreshing.

- **Maps to:** <motion.span initial="h" animate="v" variants={{ v: { transition: { staggerChildren: 0.08, delayChildren: 0.26 } } }}>{words.map((w) => <motion.span variants={{ h: { opacity: 0 }, v: { opacity: 1, transition: { duration: 0.16, ease: [0.23, 1, 0.32, 1] } } }}>{w} </motion.span>)}</motion.span>; keep a typedCount ref so re-renders do not replay
- **Source:** `002 island.js lineHtml, typeLines, markTyped, patchLines, MS.type · island.css .il-line .w, .w.h`
- **Tokens:** `--ease-out`
- **Motion:** words appear every 80ms, each fading 160ms

| Prop | Values | Default |
|---|---|---|
| `trigger` | the live card opens; new transcript lines arrive |  |
| `element` | .il-line.typing .w.h — one span per word; only the last two lines are shown |  |
| `properties` | each word opacity 0 → 1 (the .h class is removed one word at a time) |  |
| `enter` | one word every 80ms; each word fades 160ms var(--ease-out); starts 260ms after the card mounts, 120ms after new lines patch in |  |
| `interruptible` | stops if the layer retires; the typed count is remembered so re-expanding never retypes |  |
| `reduced` | all words appear at once |  |

Shown: Two lines, typed · Timeline

### Island · stop → filing → after

Stopping a recording hands off visibly: the pill becomes “Filing…”, then “Filed” with what is left to review — the Island narrates the after-meeting moment.

- **Maps to:** Island variant state machine live → filing → after; each variant a keyed layer inside the springing shell (see Island · morph)
- **Source:** `002 island.js stop, filingPill, afterPill, afterCard · app-record.js T.stopRecording (SUMMARY_BEAT 900)`
- **Tokens:** `--spring`, `--accent`, `--amber`
- **Motion:** live → filing → after, each a 490ms spring morph

| Prop | Values | Default |
|---|---|---|
| `trigger` | Stop (Island, toolbar, ⌘R) → filing; summary ready (900ms beat in the prototype) → after |  |
| `element` | .island pills: live → “Filing to Product Sync…” (spinner) → “✓ Filed to Product Sync · 5 to review”; hover → after card (counts, Review 5) |  |
| `properties` | shell morph between pills (spring) · spinner loop · the after card uses the same hover intent; clicking the after pill opens Review |  |
| `enter` | 490ms --spring per step |  |
| `interruptible` | yes |  |
| `keyboard` | ⌘R stop plays the same sequence |  |
| `reduced` | sizes snap |  |

Shown: Stop recording · Timeline

### Island · hide & show

The Island steps back while onboarding owns the screen, fading and shrinking slightly, and returns already showing the right content.

- **Maps to:** Tauri panel show/hide with a 220ms opacity + 0.95 scale on the root motion.div; while hidden, set the next variant without layout animation
- **Source:** `002 island.js reveal, applyMode (sync({ instant: wasHidden })) · island.css .island.gone, .island.instant`
- **Tokens:** `--ease-out`
- **Motion:** fade + 0.95 scale, 220 / 180ms --ease-out

| Prop | Values | Default |
|---|---|---|
| `trigger` | onboarding opens (hidden) / closes (setup); first-run scenario |  |
| `element` | .island.gone |  |
| `properties` | opacity 1 → 0 · scale(0.95) · pointer-events none; returning from hidden paints the new content instantly (no morph), then fades / scales in |  |
| `enter` | opacity 220ms, transform 180ms var(--ease-out) |  |
| `exit` | same |  |
| `interruptible` | yes — CSS transitions |  |
| `reduced` | opacity only |  |

Shown: Hide, then return · Timeline

### Onboarding · panel open & close

The first-run panel settles in from 96% like a sheet and leaves quickly if you choose “Not now”.

- **Maps to:** Separate NSPanel window; <motion.section initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.16 } }} transition={{ duration: 0.26, ease: [0.23, 1, 0.32, 1] }} />
- **Source:** `002 app-onboard.js open, close · app.js applyScenario (first run +420ms) · app.css .onboard`
- **Tokens:** `--ease-out`, `--glass-strong`, `--shadow-window`
- **Motion:** in from 0.96 in 260ms, out to 0.97 in 160ms, --ease-out

| Prop | Values | Default |
|---|---|---|
| `trigger` | first run (+420ms after the window hides) · Set up Telu (Island setup pill, empty state) · Not now / Esc closes |  |
| `element` | .onboard (glass panel, 420 × 530) |  |
| `properties` | open: opacity 0 → 1, scale(0.96) → 1 · close: opacity → 0, scale(0.97), then hidden |  |
| `enter` | 260ms var(--ease-out) |  |
| `exit` | 160ms var(--ease-out) |  |
| `interruptible` | restart |  |
| `keyboard` | Esc closes with the same exit |  |
| `reduced` | instant |  |
| `notes` | the panel is cropped to 400px and the welcome step drops its three “moments” rows to fit the tile |  |

Shown: Not now, then Set up Telu · Timeline

### Onboarding · step slide & dots

Steps slide 24px in the direction you are going and the dots fill behind you, so the three-step setup always feels short and reversible.

- **Maps to:** <AnimatePresence mode="popLayout" custom={dir} initial={false}><motion.div key={step} custom={dir} initial={{ opacity: 0, x: 24 * dir }} animate={{ opacity: 1, x: 0, transition: { duration: 0.22, delay: 0.04, ease: [0.23, 1, 0.32, 1] } }} exit={{ opacity: 0, x: -24 * dir, transition: { duration: 0.15, ease: [0.23, 1, 0.32, 1] } }} /></AnimatePresence>; dots transition-colors 200ms
- **Source:** `002 app-onboard.js go, leave, renderFoot · app.css .ob-step, .ob-dots`
- **Tokens:** `--ease-out`, `--accent`, `--fill-3`
- **Motion:** out 24px / 150ms, in 24px / 220ms (+40ms), --ease-out; dots 200ms

| Prop | Values | Default |
|---|---|---|
| `trigger` | Continue / Back / the calendar permission answer |  |
| `element` | .ob-steps > .ob-step (absolute, briefly stacked) · .ob-dots i |  |
| `properties` | old step opacity → 0, translateX(−24px × dir), then removed · new step opacity 0 → 1 from translateX(24px × dir) · dots --fill-3 → --accent (current) / accent 45% (done) |  |
| `enter` | 220ms var(--ease-out) after 40ms, fill backwards |  |
| `exit` | 150ms var(--ease-out), fill forwards |  |
| `sequence` | dir 0 (permission denied re-renders the same step) crossfades in place without sliding |  |
| `interruptible` | restart — steps already leaving are ignored by the next go() |  |
| `keyboard` | Enter in the manual field adds a row (receive), it does not change step |  |
| `reduced` | instant swap |  |

Shown: Welcome → remember → summon → back · Timeline

### Onboarding · finish flight

Finishing setup shrinks the panel away while the Telu icon flies up into the menu bar, where the status item glows and bumps — “this is where I live now”.

- **Maps to:** Two Tauri windows: animate the panel out (opacity / scale 0.92), then flash the tray title — tray.rs cannot animate, so update the title after the panel is gone; inside one webview use the flyTo portal (see Fly to sidebar) with duration 0.62
- **Source:** `002 app-onboard.js finish · kit/mac-kit.js Kit.flyTo · app.css .fly-icon · app-bridge.js T.renderStatus`
- **Tokens:** `--ease-out`, `--accent-soft`
- **Motion:** panel shrinks 280ms while the icon arcs 620ms into the menu bar; landing glow + bump

| Prop | Values | Default |
|---|---|---|
| `trigger` | Done on “Summon Telu anytime” |  |
| `element` | .onboard · app icon [data-fly] → #teluStatus (menu-bar status item) |  |
| `properties` | panel opacity → 0, scale(0.92) (fill forwards) · icon flight (Kit.flyTo, scale clamps to 0.4) · status item .receive + its image .bump · panel hidden · status text appears · the Island returns 160ms later |  |
| `enter` | panel 280ms var(--ease-out) · flight 620ms (split easing) |  |
| `exit` | receive 900ms · bump 420ms |  |
| `interruptible` | no (busy flag) |  |
| `reduced` | no shrink and no flight; the status item receives |  |

Shown: Done → menu bar · Timeline

### Reduced motion · fallbacks

With “Reduce motion” on, Telu keeps every state change visible but stops moving things: fades and colour changes stay, slides, springs and flights go.

- **Maps to:** <MotionConfig reducedMotion="user"> at the root (framer-motion drops transform and layout animations, keeps opacity); keep the CSS @media (prefers-reduced-motion) block; gate WAAPI and flyers with useReducedMotion()
- **Source:** `kit/mac-kit.css @media (prefers-reduced-motion) · Kit.reduceMotion() call sites across 002 · island.css reduced block`
- **Motion:** opacity and colour only; status loops keep running

| Prop | Values | Default |
|---|---|---|
| `trigger` | prefers-reduced-motion: reduce |  |
| `element` | everything |  |
| `properties` | CSS: transitions limited to opacity, background-color, color, box-shadow, border-color (transforms, sizes, grid rows and stroke draws snap) · .enter / .bump / .wave i / .shimmer keyframes off · .rec-dot slowed to 2.4s · Island .il-mint-dot and .il-sugg.arrive off |  |
| `sequence` | JS (Kit.reduceMotion()): Kit.flip / flyTo (target just receives) / removeAnimated / enterAnimated skip; crossfade, fadeIn, slideSwap, paintPage, paintNextBlock, capsule, onboarding panel and steps, chip removal → instant; peek .instant; Island typing shows all words; smooth scroll → auto |  |
| `reduced` | this entry is the reduced-motion behaviour |  |
| `notes` | still animating under reduced motion (gaps to close in production): .ver-bump, .chip-in, tick-receive, T.runProgress |  |

Shown: Default vs reduced (the kit rules, scoped to the right column)

## Primitives

Single-purpose controls from the shared kit. Every screen in the app is composed from these.

### Button

Capsule push button. Scales to 0.97 while pressed; hover only on fine pointers.

- **Maps to:** shadcn/ui Button with cva variants
- **Used in:** Toolbar, Side peek, Living doc, Sheets, Alerts, Island
- **Source:** `kit/mac-kit.css .btn`
- **States:** rest, hover, pressed, focus, disabled
- **Tokens:** `--accent`, `--accent-strong`, `--coral`, `--fill-2`, `--fill-3`, `--on-accent`
- **Motion:** Trigger: press (:active); hover on fine pointers · Animates: transform scale(1 → 0.97); background-color, box-shadow, color · Duration: press 140ms down and up; colors 150ms · Easing: transform --ease-out; colors ease · Runtime: CSS transition (interruptible — releasing mid-press reverses from the current scale) · Reduced motion: scale snaps (transform not transitioned); color changes still fade · framer-motion: whileTap={{ scale: 0.97 }} transition={{ duration: 0.14, ease: [0.23, 1, 0.32, 1] }}; colors stay in CSS
- **Accessibility:** Native <button>; focus-visible ring 3px accent at 45%; icon-only buttons need aria-label

| Prop | Values | Default |
|---|---|---|
| `variant` | default \| primary \| record \| tinted \| plain | default |
| `size` | sm \| md \| lg | md |
| `icon` | boolean (square icon-only button) | false |
| `kbd` | string shortcut shown after the label | — |
| `block` | boolean (full width) | false |
| `disabled` | boolean | false |

Shown: Variants × states · Sizes · Icon-only

### GlassGroup

Toolbar capsule that groups related buttons on glass. Buttons inside lose their fill and only show a fill on hover; a 0.5px separator splits sub-groups.

- **Maps to:** A <div role="group"> capsule wrapping shadcn Button variant="ghost" (size "icon" | "sm"); Radix Toolbar if roving focus is wanted
- **Used in:** Agenda toolbar, Doc toolbar
- **Source:** `002 app-shell.js agendaToolbar / docToolbar · kit .glass-group (.sep)`
- **States:** rest, item hover, item pressed, item disabled, item on (drawer toggle)
- **Tokens:** `--glass-strong`, `--glass-edge`, `--glass-rim`, `--fill-2`, `--hairline`
- **Motion:** Trigger: item hover / press · Animates: item background-color (transparent → --fill-2), item transform scale(0.97) · Duration: color 150ms; press 140ms · Easing: ease; --ease-out · Runtime: CSS transition (interruptible) · Reduced motion: press scale snaps; hover fill still fades · framer-motion: whileTap={{ scale: 0.97 }} on each item; capsule static
- **Accessibility:** role="group" with aria-label ("Day", "Document actions"). Icon-only items in 002 carry only data-tip — add aria-label. Tab order follows items; separators are aria-hidden.

| Prop | Values | Default |
|---|---|---|
| `children` | Button[] and separators | — |
| `aria-label` | string (group name) | — |

Shown: Day stepper · Day stepper · disabled · New + search · Doc actions · Doc actions · recording · Drawer toggle · Item states

### SegmentedControl

Capsule segmented control with a sliding white thumb placed by Kit.segmented. In 002 it picks a draft series cadence.

- **Maps to:** Radix ToggleGroup type="single" (shadcn ToggleGroup) + a motion.div thumb with layoutId
- **Used in:** Living doc · draft header (Repeats), Catalog theme switch
- **Source:** `002 doc-render.js repeatsMarkup #cadenceSeg · kit .seg .seg-thumb · Kit.segmented`
- **States:** rest, selected (each position), with badge
- **Tokens:** `--fill-2`, `--content-bg`, `--label`, `--label-2`, `--accent`
- **Motion:** Trigger: pointer selection (Kit.segmented select) · Animates: thumb transform translateX(offsetLeft) + width; label color · Duration: thumb 240ms; label color 160ms · Easing: thumb --ease-out; color ease · Runtime: CSS transition on inline style (interruptible); set(value, { animate: false }) places the thumb without transition — use for first paint and keyboard · Reduced motion: thumb jumps (transform/width not transitioned); color still fades · framer-motion: <motion.span layoutId="seg-thumb" transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }} />
- **Accessibility:** 002 marks buttons with aria-selected only. Use role="radiogroup" + role="radio" (or Radix ToggleGroup) with arrow-key navigation; keyboard changes must not animate the thumb.

| Prop | Values | Default |
|---|---|---|
| `options` | { value, label, badge? }[] (2–4) | — |
| `value` | string | first |
| `onValueChange` | (value) => void | — |
| `size` | one size, 28px (the kit has no small variant) | — |

Shown: Cadence · every position · Two and three segments · With badge · Live thumb

### TextField

Single-line field and textarea on the content background with a hairline inset; focus draws a soft accent ring.

- **Maps to:** shadcn Input / Textarea (h-7; lg h-9 text-[15px] rounded-[10px])
- **Used in:** New series popover (lg), Onboarding manual entry (lg), Sheets (textarea)
- **Source:** `kit .field (.lg, textarea.field) · 002 app-flows.js .a-new-field · app-onboard.js #obInput`
- **States:** placeholder, focus, filled, disabled
- **Tokens:** `--content-bg`, `--hairline`, `--accent`, `--label`, `--label-3`
- **Motion:** Trigger: focus / blur · Animates: box-shadow (inset 0.5px hairline → inset 0.5px accent + 0 0 0 3.5px accent 32%) · Duration: 150ms in and out · Easing: ease · Runtime: CSS transition (interruptible) · Reduced motion: unchanged (box-shadow is allowed) · framer-motion: none — keep in CSS (focus-visible:ring)
- **Accessibility:** Always pair with a visible label or aria-label (002 new-series field relies on the popover title). The kit has no disabled style — disabled fields look like rest; add opacity 0.45 like buttons.

| Prop | Values | Default |
|---|---|---|
| `size` | md 28 \| lg 36 | md |
| `multiline` | boolean (textarea, auto height, resize none) | false |
| `placeholder` | string | — |
| `disabled` | boolean | false |

Shown: Sizes × states

### SearchField

Pill search field with a leading glyph on a quiet fill; on focus the fill turns to content background with the accent ring.

- **Maps to:** cmdk Command.Input inside the search popover (shadcn Command)
- **Used in:** Search popover (⌘F), Catalog filter
- **Source:** `002 app-flows.js T.openSearch .a-search .search · kit .search`
- **States:** rest, focus, filled
- **Tokens:** `--fill`, `--content-bg`, `--accent`, `--label-3`
- **Motion:** Trigger: focus / blur · Animates: box-shadow ring 0 → 3.5px accent 32%; background fill → content-bg swaps instantly (only box-shadow is transitioned on .field) · Duration: ring 150ms in and out · Easing: ease · Runtime: CSS transition (interruptible) · Reduced motion: unchanged · framer-motion: none — CSS
- **Accessibility:** role="combobox" with aria-controls on the results list (cmdk provides it); Enter opens the first hit; Esc closes the popover.

| Prop | Values | Default |
|---|---|---|
| `value` | string | "" |
| `placeholder` | string | "Search series, people, decisions" |
| `height` | 28 \| 32 (search popover) | 28 |

Shown: States · In the search popover · 32px

### PopupButton

Compact macOS pop-up button (up/down chevron) that opens a menu of choices. Placeholder text shows until a value is picked.

- **Maps to:** Radix Select (shadcn Select) styled as a pop-up button, or DropdownMenu + RadioGroup
- **Used in:** Living doc · draft header (day, time)
- **Source:** `002 doc-render.js repeatsMarkup #pickDay #pickTime · doc-organize.js D.pickDay / D.pickTime · kit .btn.popup`
- **States:** rest, hover (no change), pressed, focus, disabled, open
- **Tokens:** `--content-bg`, `--hairline`, `--label-2`
- **Motion:** Trigger: press; opening the menu · Animates: transform scale(0.97); menu appears instantly · Duration: press 140ms; menu 0ms open, 120ms close · Easing: --ease-out · Runtime: CSS transition · Reduced motion: press scale snaps · framer-motion: whileTap={{ scale: 0.97 }}; no open animation (macOS menus are instant)
- **Accessibility:** Radix Select gives aria-haspopup="listbox", arrow keys, typeahead. Disabled when Repeats is None.

| Prop | Values | Default |
|---|---|---|
| `value` | string \| null | null → placeholder |
| `placeholder` | "Day" \| "Time" | — |
| `options` | string[] | — |
| `disabled` | boolean (cadence None) | false |

Shown: States · Open · Live

### Switch

On/off switch. Knob lands with the bouncy spring; track color fades.

- **Maps to:** Radix Switch (shadcn Switch) — knob via motion layout or CSS transition with the spring
- **Used in:** Onboarding · choose what to remember, Reference doc popover (Include in every brief)
- **Source:** `kit .switch[aria-checked] + global click toggle · 002 app.css .switch:disabled · app-onboard.js detectedRow · doc-popovers.js refPopover`
- **States:** off, on, focus, disabled off, disabled on
- **Tokens:** `--fill-3`, `--accent`, `--spring-bounce`, `--spring-bounce-dur`
- **Motion:** Trigger: click (kit toggles aria-checked) · Animates: knob ::after transform translateX(0 → 14px); track background-color · Duration: knob 600ms (--spring-bounce-dur) both ways; track 200ms · Easing: knob --spring-bounce (3.8% overshoot); track ease · Runtime: CSS transition (interruptible — re-toggling mid-flight reverses from the current point) · Reduced motion: knob jumps; track color still fades · framer-motion: knob: <motion.span layout transition={{ type: "spring", duration: 0.6, bounce: 0.28 }} />
- **Accessibility:** Needs role="switch" + aria-checked (Radix provides). The kit removes the focus outline on .switch — no visible focus in 002; add a ring. Disabled at 45% opacity.

| Prop | Values | Default |
|---|---|---|
| `checked` | boolean | false |
| `onCheckedChange` | (checked) => void (kit dispatches a "toggle" CustomEvent) | — |
| `disabled` | boolean | false |
| `aria-label` | string | — |

Shown: States · Interactive · In context · onboarding · In context · reference popover

### Checkbox

Round (agenda items) or square (calendars) check. The tick draws in with a stroke-dash animation after the fill lands.

- **Maps to:** Radix Checkbox (shadcn Checkbox) with a round variant; tick as motion.path pathLength
- **Used in:** Next meeting agenda (done), Sidebar calendars (watched)
- **Source:** `kit .check (.square) + Kit.checkSvg + global click toggle · 002 doc-render.js D.agendaItem · app-shell.js calendarRow (.a-cal-check)`
- **States:** unchecked, checked, pressed, focus, disabled
- **Tokens:** `--accent`, `--label-4`, `--cal (calendar color)`
- **Motion:** Trigger: click (kit toggles aria-checked) · Animates: background-color + ring box-shadow; tick stroke-dashoffset 14 → 0; press transform scale(0.88) · Duration: fill 160ms; tick 220ms after a 40ms delay; press 140ms · Easing: fill ease; tick and press --ease-out · Runtime: CSS transition (interruptible; unchecking undraws the tick) · Reduced motion: fill still fades (background-color is allowed); tick appears at once (stroke-dashoffset is not transitioned); press scale snaps · framer-motion: motion.path initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.22, delay: 0.04, ease: [0.23, 1, 0.32, 1] }}
- **Accessibility:** Round checks in agenda carry aria-label="Done". The sidebar calendar check is decorative (tabindex=-1, pointer-events none) — the whole row is the control and toggles watching. The kit has no disabled style.

| Prop | Values | Default |
|---|---|---|
| `checked` | boolean | false |
| `shape` | round \| square | round |
| `color` | CSS color (calendar color via --cal) | --accent |
| `size` | 17 \| 14 (calendar) | 17 |
| `disabled` | boolean | false |

Shown: Shapes × states · Interactive · In context · agenda item · In context · calendar rows

### Chip

Small capsule label. Seven kit tones; in 002 each tone has one meaning (accent = ready/tracked, amber = needs review, coral = starting, dashed = not tracked).

- **Maps to:** shadcn Badge with cva variants (neutral | accent | mint | coral | amber | outline | dashed)
- **Used in:** Agenda cards, Living doc, Past meetings, Island
- **Source:** `kit .chip · 002 app-agenda.js chipMarkup (T.agenda.chipMarkup) · doc-render.js countdown · doc-past.js D.countsChips`
- **States:** static, shimmer (preparing), live dot
- **Tokens:** `--fill-2`, `--accent-soft`, `--accent-strong`, `--mint-soft`, `--mint-ink`, `--coral-soft`, `--coral-ink`, `--amber-soft`, `--amber`, `--separator`, `--label-4`
- **Motion:** Trigger: none on the chip; decorations loop · Animates: shimmer background-position; mini-dot opacity 1 → 0.3 · Duration: shimmer 1.3s loop; dot 1.4s loop · Easing: shimmer linear; dot ease-in-out · Runtime: CSS keyframes (kit-shimmer, kit-rec) — chip swaps crossfade via T.fx.crossfade (110ms out, 190ms in, 2px blur) · Reduced motion: shimmer stops; the mini dot keeps pulsing at 1.4s (the kit rule only slows .rec-dot) · framer-motion: chip swap: AnimatePresence mode="popLayout" with opacity + filter blur(2px)
- **Accessibility:** Chips are text, not controls (002 uses <span>); never convey state by tone alone — the label always says it (“3 to review”).

| Prop | Values | Default |
|---|---|---|
| `tone` | neutral \| accent \| mint \| coral \| amber \| outline \| dashed | neutral |
| `icon` | IconName | — |
| `dot` | none \| mini (static) \| mini-live (pulsing) | none |
| `shimmer` | boolean (preparing) | false |
| `numeric` | boolean | false |

Shown: Tones · In the agenda · In the living doc · Long labels

### StatusBadge

Dot + label for a knowledge item’s lifecycle. Superseded items also strike their text through.

- **Maps to:** Small <StatusBadge status> component (dot span + text)
- **Used in:** Memory, Past meetings (k-row), Brief
- **Source:** `kit Kit.status(s) · .status[data-s] · .superseded-text · 002 doc-past.js kRow`
- **States:** current, completed, open, unresolved, disputed, superseded, cancelled
- **Tokens:** `--series-green`, `--accent`, `--amber`, `--label-4`, `--label-2`
- **Motion:** None.
- **Accessibility:** The label text carries the meaning; the dot is decorative.

| Prop | Values | Default |
|---|---|---|
| `status` | current \| completed \| open \| unresolved \| disputed \| superseded \| cancelled | — |

Shown: Every status · Superseded row

### KnowledgeType

Type marker for knowledge items: decision, commitment, open question, fact — icon + label, icon-only, or icon tile.

- **Maps to:** <KnowledgeType type variant="label | icon | tile"> with lucide icons (badge-check, corner-down-right, circle-help, book-open)
- **Used in:** Memory, Past meetings, Review candidates, Brief (Since last time), Search results, Island
- **Source:** `kit Kit.ktype(type) · .ktype[data-type] · 002 doc.css .k-ico · island.css .il-k · app-flows.js memoryHit`
- **Tokens:** `--accent`, `--series-orange`, `--amber`, `--series-teal`
- **Motion:** None.
- **Accessibility:** Icon-only variants need a label (Island adds data-tip; use aria-label).

| Prop | Values | Default |
|---|---|---|
| `type` | decision \| commitment \| question \| fact | — |
| `variant` | label \| icon \| tile | label |

Shown: Types × variants

### SourceChip

Evidence link on every claim: a quote glyph and where it came from (transcript time or document page). Opens the evidence popover.

- **Maps to:** shadcn Button variant="ghost" size="xs" as a Radix Popover.Trigger (EvidencePopover)
- **Used in:** Memory, Brief, Worth asking, Past meetings, Review candidates, Island
- **Source:** `kit Kit.source(label) .source · 002 doc.css .doc-surface .source:active · doc-past.js candSource`
- **States:** rest, hover, pressed, focus
- **Tokens:** `--fill`, `--accent-soft`, `--accent-strong`, `--label-2`
- **Motion:** Trigger: hover; press inside the doc/peek (.doc-surface) or Island · Animates: background-color + color (fill → accent-soft); transform scale(0.96) (0.95 in the Island) · Duration: color 150ms; press 140ms · Easing: ease; --ease-out · Runtime: CSS transition · Reduced motion: press snaps; colors fade · framer-motion: whileTap={{ scale: 0.96 }}
- **Accessibility:** Native <button>; label reads as “Source: Sep 22, 18:42”. Opens a dialog popover; Esc returns focus.

| Prop | Values | Default |
|---|---|---|
| `label` | "Sep 22 · 18:42" \| "Doc.docx · p.2" \| "06:12" | — |
| `kind` | speech \| document (derived from the label) | speech |
| `onOpen` | () => void | — |

Shown: Kinds × states

### Avatar

Initials on the person’s color with a content-colored ring so overlapping avatars stay separate. “You” is an empty accent disc.

- **Maps to:** shadcn Avatar (AvatarFallback with initials; no photos in 002)
- **Used in:** Agenda cards, Peek header, Living doc people chip, Memory owners, Review candidates, Evidence popover, Island
- **Source:** `kit Kit.avatar(name, cls) · Kit.initials · Kit.personColor (DATA.people) · .avatar (.lg)`
- **Tokens:** `--content-bg`, `--surface`, `DATA.people colors`
- **Motion:** None.
- **Accessibility:** title attribute carries the full name; decorative next to a visible name, otherwise aria-label on the stack.

| Prop | Values | Default |
|---|---|---|
| `name` | string (initials derived; "You" renders empty) | — |
| `size` | 16 (meta) \| 18 (agenda) \| 20 (default) \| 28 (lg) | 20 |
| `ring` | boolean (1.5px content-bg ring) | true |

Shown: Sizes · You · Every person

### AvatarStack

Overlapping avatars with a “+n” overflow count. Agenda cards cap at 3; proposal cards add the invite’s extra count.

- **Maps to:** <AvatarStack names max> built on shadcn Avatar
- **Used in:** Agenda cards, Peek header, Living doc people chip, Found in Calendar cards, Island brief
- **Source:** `kit Kit.avatars(names, max = 4) · .avatars .more · 002 app-agenda.js personLine (max 3) · app-pages.js proposalCard (.a-more)`
- **States:** 2, 4, overflow +n
- **Tokens:** `--label-2`, `--content-bg`
- **Motion:** None.
- **Accessibility:** Group label such as “5 people: Maria Chen, Jon Park, …”; the +n text is read.

| Prop | Values | Default |
|---|---|---|
| `names` | string[] | — |
| `max` | number | 4 |
| `extra` | number (known attendees beyond names) | 0 |

Shown: Counts · Proposal extra · In context

### FileBadge

Tiny document glyph with a folded corner and a three-letter type, colored per file kind.

- **Maps to:** <FileBadge name> (derives kind from the extension)
- **Used in:** Doc chips, Reference popover, Evidence popover (document), Brief docs
- **Source:** `kit Kit.fileBadge(name) · .ftype[data-kind] · 002 doc.css .ref-pop-head .ftype`
- **States:** pdf, docx, md, txt, xlsx, key, other
- **Tokens:** `fixed hex per kind (see SeriesColors)`, `--content-bg (corner)`
- **Motion:** None.
- **Accessibility:** Decorative — the file name is always next to it.

| Prop | Values | Default |
|---|---|---|
| `name` | string (extension → kind) | — |
| `size` | 16×20 \| 22×28 (popover head) | 16×20 |

Shown: Every kind · Popover size

### DocChip

A document as a compact chip: badge, name (truncates) and optional meta. As a button it opens the document; in briefs it sits on cards.

- **Maps to:** shadcn Button variant="secondary" size="sm" with FileBadge (or a Badge when static)
- **Used in:** Living doc Reference, Next meeting docs, Past meetings, Peek
- **Source:** `kit Kit.docChip(name, meta) · 002 doc-render.js D.docButton · refChip (.inc-dot) · doc.css button.doc-chip, .next-docs .doc-chip, .add-chip, .chip-in`
- **States:** rest, hover, pressed, included, excluded, entering (attached)
- **Tokens:** `--fill`, `--fill-2`, `--accent`, `--label-3`, `--shadow-card`, `--shadow-card-hover`
- **Motion:** Trigger: hover / press; a document is attached · Animates: background-color or box-shadow; transform scale(0.97); on attach opacity 0 → 1, translateY(3px) scale(0.95) → none · Duration: hover 150ms; press 140ms; attach 280ms · Easing: ease; --ease-out; --ease-out · Runtime: CSS transitions + .chip-in keyframes (one-shot, restarts per chip) · Reduced motion: press snaps; .chip-in still runs (not in the kit reduced list — gate it in React) · framer-motion: initial={{ opacity: 0, y: 3, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}; whileTap={{ scale: 0.97 }}
- **Accessibility:** Button chips announce the file name; the include dot is a separate control in 002 (data-act on a span) — make it a real toggle with aria-pressed.

| Prop | Values | Default |
|---|---|---|
| `name` | string | — |
| `meta` | string (version, size) | — |
| `as` | span \| button | span |
| `include` | boolean \| undefined (shows the include dot) | undefined |
| `elevated` | boolean (card chip in Next) | false |

Shown: Static · Button states · Include dot · Truncation · Attach

### SeriesIcon

A series’ identity: its glyph in white on its color, round. Sized per context.

- **Maps to:** <SeriesIcon series size> (lucide glyph on a colored circle)
- **Used in:** Sidebar, Doc title, Toolbar compact title, Menus, Search, Found in Calendar, Peek, Island, Fly-to chips
- **Source:** `kit Kit.seriesIcon(series, cls) · .series-icon (.lg) · 002 app.css .a-sb-row .series-icon, .series-icon.a-xs, .a-pcard-main .series-icon · island.css .il-head`
- **States:** rest, bump (receiving)
- **Tokens:** `--series-*`, `#fff glyph`
- **Motion:** Trigger: something lands in the series (Kit.flyTo receive) · Animates: transform scale(1 → 1.18 → 1) via .bump · Duration: 420ms (peak at 40%) · Easing: --ease-out · Runtime: CSS keyframes (kit-bump), restarted by toggling the class · Reduced motion: disabled (.bump is in the kit reduced list) · framer-motion: animate={{ scale: [1, 1.18, 1] }} transition={{ duration: 0.42, times: [0, 0.4, 1], ease: [0.23, 1, 0.32, 1] }}
- **Accessibility:** Decorative next to the series name.

| Prop | Values | Default |
|---|---|---|
| `series` | { color, icon } | — |
| `size` | 16 (xs) \| 18 (sidebar) \| 20 \| 28 (Island) \| 30 (cards) \| 36 (lg, doc title) | 20 |

Shown: Every series · 20 and lg 36 · Context sizes · Bump

### SeriesDot

8px color dot for a series where a full icon is too heavy: menu swatches, the Island’s next pill.

- **Maps to:** <SeriesDot color> (a span)
- **Used in:** Menus (Add to series, File to, Move to), Island next pill, Found in Calendar detected rows
- **Source:** `kit .series-dot · Kit.menu swatch items · island.js nextPill · 002 app.css .a-det-dot`
- **Tokens:** `--series-*`, `--label-4 (detected, not a series yet)`
- **Motion:** None.
- **Accessibility:** Decorative; the label is always adjacent.

| Prop | Values | Default |
|---|---|---|
| `color` | series color token | --series-gray |

Shown: Every series · As menu swatches

### Kbd

Inline keyboard shortcut text. Inherits the color of its button at 60%; in menus it right-aligns and turns white on the active row.

- **Maps to:** shadcn Kbd / DropdownMenuShortcut
- **Used in:** Buttons (Record ⌘R, New ⌥⌘N, Create ↩), Menus, Tooltips (Back · ⌘[), Island
- **Source:** `kit .kbd · .btn .kbd · .menu-item .kbd · 002 app.js Kit.keys map`
- **Tokens:** `--label-3`, `currentColor`
- **Motion:** None.
- **Accessibility:** Use aria-keyshortcuts on the control ("Meta+R"); the visible glyphs are aria-hidden duplicates.

| Prop | Values | Default |
|---|---|---|
| `keys` | string (glyphs: ⌘ ⌥ ⇧ ⌃ ↩ ⌫ esc) | — |

Shown: Contexts · Shortcut map

### Keycap

A physical key drawn on content background with a hairline and bottom edge. Onboarding scales it up to teach ⌥ Space.

- **Maps to:** <Keycap size> (styled kbd element)
- **Used in:** Onboarding · Summon Telu step
- **Source:** `kit .keycap · 002 app.css .ob-keys .keycap (.wide) · app-onboard.js summonStep`
- **Tokens:** `--content-bg`, `--hairline`
- **Motion:** None.
- **Accessibility:** Render as <kbd>; the pair reads “Option plus Space”.

| Prop | Values | Default |
|---|---|---|
| `label` | string | — |
| `size` | sm 22 \| lg 48 (onboarding) | sm |
| `wide` | boolean (Space) | false |

Shown: Default · Onboarding

### Spinner

Ring spinner for short, indeterminate local work (preparing, filing).

- **Maps to:** <Spinner size> (CSS) — lucide loader-circle is an alternative
- **Used in:** Next · preparing summary, Next · still preparing, Island · filing
- **Source:** `kit .spinner · 002 doc.css .spinner.tiny · island.css .il-filing .spinner · doc-render.js preparingInner, next-from`
- **Tokens:** `--fill-3`, `--label-2`
- **Motion:** Trigger: mounted while work is pending · Animates: transform rotate(0 → 360deg) · Duration: 700ms per turn, infinite · Easing: linear · Runtime: CSS keyframes (kit-spin) · Reduced motion: keeps spinning (kit-spin is not in the reduced list) — prefer a static glyph + text in React · framer-motion: animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.7, ease: "linear" }}
- **Accessibility:** Pair with visible text (“Preparing summary…”); role="status" on the container.

| Prop | Values | Default |
|---|---|---|
| `size` | 10 (tiny) \| 13 (Island) \| 14 | 14 |

Shown: Sizes · In context

### Skeleton

Shimmer fill for content Telu is still preparing: a chip label or placeholder lines.

- **Maps to:** shadcn Skeleton with the kit shimmer gradient
- **Used in:** Agenda card chip (Preparing brief / summary), Next · preparing
- **Source:** `kit .shimmer · 002 app-agenda.js chipMarkup (a-chip-prep) · doc.css .prep-lines`
- **Tokens:** `--fill`, `--fill-3`
- **Motion:** Trigger: mounted while preparing · Animates: background-position 100% → −100% (200% wide gradient) · Duration: 1.3s per sweep, infinite · Easing: linear · Runtime: CSS keyframes (kit-shimmer) · Reduced motion: stops (static fill) · framer-motion: animate={{ backgroundPositionX: ["100%", "-100%"] }} transition={{ repeat: Infinity, duration: 1.3, ease: "linear" }}
- **Accessibility:** aria-busy on the region; the chip text (“Preparing brief”) stays readable.

| Prop | Values | Default |
|---|---|---|
| `shape` | chip \| line \| line-short | line |

Shown: Chip · Lines

### RecDot

Coral recording dot. Pulses while live; static variants mark “will record” and the Record affordance; the Island dims it when paused.

- **Maps to:** <RecDot variant="live | static | glyph" paused>
- **Used in:** Menu bar status, Sidebar series row, Toolbar capsule and Record button, Agenda card eyebrow, Next · live, Island
- **Source:** `kit .rec-dot (kit-rec) · 002 app.css .a-mini-dot, .menubar .telu-status .rec-dot, .a-sb-row .rec-dot · doc.css .countdown .mini-dot, .tb-record .rec-glyph · island.css .island .rec-dot.paused`
- **States:** live, static, paused
- **Tokens:** `--coral`, `--coral-soft`
- **Motion:** Trigger: mounted while recording (or starting) · Animates: opacity 1 → 0.3 → 1 · Duration: 1.4s per cycle, infinite · Easing: ease-in-out · Runtime: CSS keyframes (kit-rec) · Reduced motion: .rec-dot slows to 2.4s; mini dots (.a-mini-dot, .countdown .mini-dot) keep 1.4s — gate both in React · framer-motion: animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
- **Accessibility:** Never the only signal: always next to “Recording” text or a timer.

| Prop | Values | Default |
|---|---|---|
| `variant` | live (8px, pulsing) \| mini (6px) \| glyph (9px with halo) | live |
| `pulsing` | boolean | true for live |
| `paused` | boolean (Island only in 002) | false |
| `size` | 6 \| 7 \| 8 | 8 |

Shown: Live · Sizes in context · Mini dots · Record glyph · Paused (Island)

### Waveform

Five bars that bounce while Telu is listening. Coral in recording contexts.

- **Maps to:** <Waveform paused> (5 motion.i bars)
- **Used in:** Agenda card (recording), Next · live, Peek one-off live strip, Island
- **Source:** `kit .wave (5 <i>) · 002 app.css .a-wave · doc.css .live-wave · island.css .il-wave (.paused)`
- **States:** listening, paused
- **Tokens:** `--coral`, `currentColor`
- **Motion:** Trigger: mounted while recording · Animates: each bar transform scaleY(0.3 → 1 → 0.3) · Duration: 900ms per cycle, infinite; bar delays 0, −200, −450, −650, −100ms · Easing: ease-in-out · Runtime: CSS keyframes (kit-wave) · Reduced motion: stops (bars rest at 0.3) · framer-motion: each bar animate={{ scaleY: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 0.9, delay, ease: "easeInOut" }}
- **Accessibility:** Decorative (aria-hidden); the adjacent “Recording” text and timer carry meaning.

| Prop | Values | Default |
|---|---|---|
| `size` | 11 (agenda) \| 13 (Island) \| 14 | 14 |
| `color` | currentColor \| coral | currentColor |
| `paused` | boolean (Island) | false |

Shown: Variants · Paused

### ProgressHairline

2px accent line along the toolbar’s bottom edge for short local work. Present in both toolbars; T.runProgress exists but nothing in 002 triggers it yet.

- **Maps to:** framer-motion motion.i with scaleX, or NProgress-style bar
- **Used in:** Agenda toolbar, Doc toolbar
- **Source:** `002 app-shell.js .a-progress + T.runProgress(duration = 900) · app.css .a-progress`
- **States:** idle (hidden), growing, fading out
- **Tokens:** `--accent`
- **Motion:** Trigger: T.runProgress(duration) · Animates: transform scaleX(0 → 1) from the left edge, then opacity 1 → 0 · Duration: grow = duration (default 900ms); fade 220ms · Easing: grow linear; fade ease-out · Runtime: WAAPI (Element.animate, fill forwards; previous runs are cancelled) · Reduced motion: not gated in 002 — gate it (show a static bar or nothing) · framer-motion: animate={{ scaleX: 1 }} transition={{ duration: 0.9, ease: "linear" }} then animate={{ opacity: 0 }} transition={{ duration: 0.22, ease: "easeOut" }}; style={{ originX: 0 }}
- **Accessibility:** role="progressbar" without a value (indeterminate) or pair with a status message.

| Prop | Values | Default |
|---|---|---|
| `duration` | ms (grow time) | 900 |
| `running` | boolean | false |

Shown: On a toolbar

### EmptyState

Centered empty state: glyph (bare or in an accent badge), title, one line of help, optional actions and a privacy footnote.

- **Maps to:** <EmptyState icon title description actions footnote badge>
- **Used in:** Agenda day, Upcoming, Review, Found in Calendar, Welcome (first run), Side peek (untracked event)
- **Source:** `kit .empty · 002 app-pages.js emptyPage / caughtUp / firstRunMarkup (T.pages.*) · app-agenda.js dayMarkup · app.css .a-first .a-empty-badge .a-empty-actions .a-local`
- **States:** bare, badge, with actions
- **Tokens:** `--accent-soft`, `--accent`, `--label`, `--label-2`, `--label-3`
- **Motion:** Trigger: the page it belongs to is shown (view switch, last item decided) · Animates: container opacity 0 → 1 with filter blur(2px) → 0 (T.fx.fadeIn); the empty state itself is static · Duration: 200ms (view switch) / 220ms (Found in Calendar emptied) · Easing: --ease-out · Runtime: WAAPI (Element.animate) · Reduced motion: no fade — appears instantly (fadeIn returns early) · framer-motion: initial={{ opacity: 0, filter: "blur(2px)" }} animate={{ opacity: 1, filter: "blur(0px)" }} transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
- **Accessibility:** Title is an h3; actions are real buttons; glyphs are decorative.

| Prop | Values | Default |
|---|---|---|
| `icon` | IconName \| "app" | — |
| `badge` | boolean (accent tile behind the glyph) | false |
| `title` | string | — |
| `description` | string | — |
| `actions` | Button[] | — |
| `footnote` | string (local-processing cue) | — |

Shown: Bare · Badge + help · All caught up · Caught up (inline) · Welcome with action

### Card

Surface with a hairline ring and soft shadow. Interactive cards lift on hover and press in slightly.

- **Maps to:** shadcn Card (with an interactive variant)
- **Used in:** Agenda event cards, Found in Calendar cards, Needs filing cards, Peek proposal card
- **Source:** `kit .card (.interactive)`
- **States:** static, rest, hover, pressed, selected (agenda: 2px accent ring)
- **Tokens:** `--surface`, `--r-card`, `--shadow-card`, `--shadow-card-hover`
- **Motion:** Trigger: hover (fine pointers) / press · Animates: box-shadow card → card-hover; transform scale(0.992) · Duration: shadow 200ms; press 160ms · Easing: ease; --ease-out · Runtime: CSS transition (interruptible) · Reduced motion: press snaps; shadow still fades · framer-motion: whileTap={{ scale: 0.992 }}; hover shadow in CSS
- **Accessibility:** Interactive cards are selectable items (role="option" in a listbox, or a button); arrow keys move selection without animation.

| Prop | Values | Default |
|---|---|---|
| `interactive` | boolean | false |
| `padding` | number | per use |

Shown: Variants

### ListRow

Compact list row for pickers and search results: leading glyph, truncating text, trailing meta. Selected rows invert to accent.

- **Maps to:** cmdk Command.Item (data-selected → accent)
- **Used in:** Search popover results
- **Source:** `kit .row (.hoverable .selected) · 002 app-flows.js seriesHit / memoryHit (.a-hit)`
- **States:** rest, hover, selected (kit; cmdk keyboard)
- **Tokens:** `--fill`, `--accent`, `--on-accent`, `--r-control`
- **Motion:** None — hover background changes instantly; keyboard selection must not animate.
- **Accessibility:** role="option" inside role="listbox" (cmdk); aria-selected mirrors the accent row.

| Prop | Values | Default |
|---|---|---|
| `leading` | SeriesIcon \| KnowledgeType | — |
| `text` | string | — |
| `meta` | string | — |
| `selected` | boolean | false |

Shown: Series and memory hits · Hover · Selected

### Collapsible

Height collapse with a rotating disclosure chevron. Rows collapse by animating grid rows to 0fr, so content never jumps.

- **Maps to:** Radix Collapsible (shadcn) + framer-motion height animation
- **Used in:** Past meetings, Banner hide, New series linked event, Peek transcript
- **Source:** `kit .collapsible (.collapsed) + .disclosure (.open) · 002 doc-page.js D.toggleMeeting · app-agenda.js bannerMarkup`
- **States:** open, collapsed
- **Tokens:** `--label-3`
- **Motion:** Trigger: click on the header (or programmatic toggle) · Animates: grid-template-rows 1fr ↔ 0fr + opacity 1 ↔ 0; chevron transform rotate(0 ↔ 90deg) · Duration: rows 260ms; opacity 200ms; chevron 200ms (same in and out) · Easing: rows --ease-out; opacity ease; chevron --ease-out · Runtime: CSS transition (interruptible) · Reduced motion: rows jump (grid-template-rows not in the reduced list); opacity still fades; chevron snaps · framer-motion: <motion.div animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }} transition={{ height: { duration: 0.26, ease: [0.23, 1, 0.32, 1] }, opacity: { duration: 0.2 } }} />
- **Accessibility:** Header is a button with aria-expanded and aria-controls (002 uses a div with data-act).

| Prop | Values | Default |
|---|---|---|
| `open` | boolean | false |
| `onOpenChange` | (open) => void | — |

Shown: Open and collapsed · Interactive

### DropTarget

Where files can land: a dashed accent outline inset from the edge over an accent-softer wash.

- **Maps to:** A useDropzone-style hook that toggles data-drop-active; the style is a Tailwind variant
- **Used in:** Next meeting docs, Purpose (Reference), Island drop pill
- **Source:** `kit .drop-target · 002 doc.css .next-docs.drop-target · doc-edit.js wireDrops`
- **States:** idle, drag over
- **Tokens:** `--accent (70%)`, `--accent-softer`
- **Motion:** None — the outline and wash switch instantly on dragenter/dragleave (the purpose drop hint fades in 150ms; see Living doc).
- **Accessibility:** Always offer a keyboard path (⌘O Attach files); announce “Attached …” in a status region.

| Prop | Values | Default |
|---|---|---|
| `active` | boolean (drag over) | false |
| `inset` | px (outline-offset) | -6 |
| `hint` | string | "Drop files to attach" |

Shown: Kit default · Next meeting docs

## Overlays

Layers above the window: popovers and menus on glass, window-modal sheets and alerts, toasts, notification banners, tooltips and the evidence popover. Static tiles show the open state; each live tile runs the real Kit function inside its own stage.

### Popover

Glass panel anchored to a trigger. It scales in from the trigger’s center (--origin), flips above when there is no room below and clamps inside its container. Content is built from a small set of .pop parts.

- **Maps to:** Radix Popover (shadcn Popover) — transform-origin from --radix-popover-content-transform-origin
- **Used in:** Doc header chips (rule, people), Purpose history, Doc history, Reference documents, Evidence, New series, Search
- **Source:** `kit Kit.popover(trigger, markup, { align, side, width, className, container, force }) · .popover (.open .closing) · 002 doc-popovers.js · doc.css .pop*`
- **States:** closed, opening, open, closing, flipped above
- **Tokens:** `--glass-strong`, `--shadow-float`, `--separator`, `--label-3`
- **Motion:** Trigger: click on the trigger (a second click on the same trigger closes) · Animates: opacity 0 → 1 and transform scale(0.96) → none from transform-origin var(--origin) = trigger center x, 0 (below) or popover height (above) · Duration: enter opacity 150ms / transform 190ms; exit 110ms / 110ms, element removed after 140ms · Easing: --ease-out · Runtime: CSS transition; .open is added on the next animation frame so the transition runs · Reduced motion: scale snaps (transform not transitioned); opacity still fades · framer-motion: initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.11 } }} transition={{ opacity: { duration: 0.15 }, scale: { duration: 0.19, ease: [0.23, 1, 0.32, 1] } }}
- **Accessibility:** role="dialog"; Esc closes (kit layer stack); pointerdown outside closes; focus should move into the popover and return to the trigger (not done in 002 — Radix handles it).

| Prop | Values | Default |
|---|---|---|
| `align` | start \| center \| end | start |
| `side` | bottom \| top (auto-flips) | bottom |
| `width` | px | min 220 |
| `container` | element (clamps inside it) | nearest .window / .desktop / .panel-host |
| `onClose` | () => void | — |

Shown: Rule · linked to Calendar · Rule · grouped by you · People · Purpose history · Reference document · Empty · Live · origin and flip

### Menu

macOS pull-down menu on glass. Opens instantly; the row under the pointer or arrow keys is accent-filled; choosing blinks the row once before the menu fades out.

- **Maps to:** Radix DropdownMenu (shadcn DropdownMenu) — Label, Item (with Shortcut), Separator; swatch items render a SeriesDot
- **Used in:** Menu bar menus, Doc toolbar ⋯, Past meeting ⋯, Add to series / File to, Follow a different event, Add reference, Day and time pop-ups
- **Source:** `kit Kit.menu(trigger, items, { align, minWidth, container }) · .menu .menu-item (.active .danger .disabled) .menu-sep .menu-title · 002 doc-popovers.js D.docMenu · doc-organize.js D.meetingMenu · app-actions.js T.addToSeriesMenu`
- **States:** open, row active (pointer or keys), row disabled, row danger, danger active, choosing (blink), closing
- **Tokens:** `--glass-strong`, `--shadow-float`, `--accent`, `--coral`, `--coral-ink`, `--label-2`, `--label-3`, `--separator`
- **Motion:** Trigger: click on the trigger; choose a row · Animates: open: none (appears instantly); choose: row .active off then on again after 60ms (macOS blink), then .closing → opacity 1 → 0 · Duration: blink 60ms; close fade 120ms starting at 130ms, element removed at 260ms; opening another menu removes the old one with no fade · Easing: ease (opacity) · Runtime: CSS transition for the fade + setTimeout sequence for the blink · Reduced motion: unchanged (only opacity) · framer-motion: no enter animation; exit={{ opacity: 0 }} transition={{ duration: 0.12 }}; blink via a 60ms data-highlighted toggle before onSelect
- **Accessibility:** role="menu" / "menuitem"; focus lands on the menu; ↑↓ skip disabled rows; ↩ chooses; Esc closes; pointerdown outside closes. Shortcut text should also be exposed via aria-keyshortcuts.

| Prop | Values | Default |
|---|---|---|
| `items` | ({ label, icon?, kbd?, swatch?, danger?, disabled?, onSelect } \| "-" \| { title })[] | — |
| `align` | start \| end | start |
| `minWidth` | px | 210 |

Shown: Row kinds × pointer · Doc menu · Past meeting menu · Add to series · Follow a different event · Recent on this Mac · Live

### ContextMenu

The same menu opened at the pointer by a right-click on an agenda card. Rows enable or disable from the event’s state.

- **Maps to:** Radix ContextMenu (shadcn ContextMenu)
- **Used in:** Agenda event cards
- **Source:** `kit Kit.contextMenu(event, items, { container }) · 002 app-actions.js T.cardMenu · app.js onContext`
- **States:** tracked event, untracked event, recording, row active
- **Tokens:** `--glass-strong`, `--accent`, `--coral`
- **Motion:** Trigger: right-click (contextmenu) on a card; choose a row · Animates: open: none — appears at the pointer (offset 2px, clamped 8px inside the window); choose: 60ms row blink, then opacity 1 → 0 · Duration: blink 60ms; fade 120ms from 130ms; removed at 260ms · Easing: ease (opacity) · Runtime: CSS transition + setTimeout (same code path as Menu) · Reduced motion: unchanged (opacity only) · framer-motion: no enter animation; exit={{ opacity: 0 }} transition={{ duration: 0.12 }}
- **Accessibility:** Also reachable with the keyboard (Shift+F10 / the Menu key in Radix); the card becomes selected before the menu opens.

| Prop | Values | Default |
|---|---|---|
| `items` | same as Menu | — |
| `point` | { x, y } from the contextmenu event (offset 2px) | — |

Shown: Tracked event · Untracked one-off · While recording · Live · right-click the card

### Sheet

Window-modal glass sheet centered over a scrim, with head, body and a right-aligned footer. A kit primitive — 002 never opens one (T.ui.sheet stays null); content here comes from sketch 001’s Paste text sheet.

- **Maps to:** Radix Dialog (shadcn Dialog) scoped to the window
- **Used in:** Kit only in 002 (001: paste text, detection, proposals)
- **Source:** `kit Kit.sheet(markup, { width, onClose, className, container, closeOnScrim }) · .sheet .sheet-head .sheet-body .sheet-foot .scrim · 001 a-today-inspector.js pasteSheet`
- **States:** closed, opening, open, closing
- **Tokens:** `--glass-strong`, `--shadow-window`, `--scrim`
- **Motion:** Trigger: Kit.sheet(); any [data-close] button, Esc or api.close() · Animates: scrim opacity 0 → 1; sheet opacity 0 → 1 and transform translate(-50%, -50%) scale(0.96) → scale(1) · Duration: scrim 220ms; sheet opacity 200ms / transform 260ms; exit 140ms / 160ms, removed after 200ms; first field focused 60ms after open · Easing: sheet --ease-out; scrim ease · Runtime: CSS transition (.open added on the next frame) · Reduced motion: scale snaps; opacity fades · framer-motion: overlay: initial={{ opacity: 0 }} animate={{ opacity: 1 }} (0.22s); content: initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.26, ease: [0.23, 1, 0.32, 1] }} exit duration 0.16
- **Accessibility:** role="dialog" aria-modal="true"; focus goes to the first field; Esc closes; focus should be trapped and returned (Radix Dialog).

| Prop | Values | Default |
|---|---|---|
| `width` | px (--sheet-w) | 520 |
| `closeOnScrim` | boolean | false |
| `onClose` | (result) => void — [data-close] buttons pass their value | — |

Shown: Open · Live

### Alert

Small centered confirmation with the app icon, a bold title, one line of consequences and two equal buttons. Destructive confirms turn the primary coral.

- **Maps to:** Radix AlertDialog (shadcn AlertDialog)
- **Used in:** Onboarding (calendar permission), Delete meeting, Stop tracking
- **Source:** `kit Kit.alert({ title, message, buttons, iconMarkup, container }) → Promise · 002 app-onboard.js askCalendar · doc-organize.js deleteMeetingFlow (.btn.primary.danger) · app-actions.js confirmStopTracking`
- **States:** permission, confirm, destructive confirm, opening, closing
- **Tokens:** `--glass-strong`, `--shadow-window`, `--accent`, `--coral`, `--coral-ink`
- **Motion:** Trigger: Kit.alert(); a button, ↩ (primary) or Esc (cancel) · Animates: opacity 0 → 1 and transform translate(-50%, -50%) scale(0.95) → scale(1) · Duration: enter opacity 180ms / transform 220ms; exit 120ms / 140ms, removed after 160ms · Easing: --ease-out · Runtime: CSS transition · Reduced motion: scale snaps; opacity fades · framer-motion: initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ opacity: { duration: 0.18 }, scale: { duration: 0.22, ease: [0.23, 1, 0.32, 1] } }} exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.14 } }}
- **Accessibility:** role="alertdialog"; ↩ activates the primary, Esc the cancel button; the destructive action should not be the default focus.

| Prop | Values | Default |
|---|---|---|
| `title` | string | — |
| `message` | string | — |
| `buttons` | { label, value, primary }[] (cancel first) | OK |
| `destructive` | boolean (primary uses coral) | false |

Shown: Calendar permission · Destructive confirm · Confirm · Live

### Toast

Glass capsule at the bottom center of the window confirming what just happened, often with Undo. Hover pauses the timer.

- **Maps to:** sonner (Toaster at bottom-center, custom capsule style, action button = Undo)
- **Used in:** Every undoable action, Exports, Filing, Attachments, Island feedback
- **Source:** `kit Kit.toast(text, { icon, action: { label, onClick }, container, duration }) · .toast-stack .toast (.show .hide) · 002 app-shell.js T.toast`
- **States:** plain, with icon, with action, stacked, entering, leaving, paused (hover)
- **Tokens:** `--glass-strong`, `--shadow-float`, `--accent`, `--accent-soft`
- **Motion:** Trigger: Kit.toast(); timer, action click · Animates: opacity 0 → 1 and transform translateY(14px) scale(0.98) → none; leave: opacity → 0, translateY(10px) scale(0.98) · Duration: enter opacity 220ms / transform 340ms; leave 160ms / 180ms, removed after 200ms; visible 4200ms, paused on hover, resumes with at least 1200ms · Easing: opacity ease; transform --ease-out · Runtime: CSS transition (.show on the next frame, .hide to leave); stack is flex column-reverse with 8px gap — the first toast stays at the bottom, newer ones stack above · Reduced motion: transform snaps; opacity fades · framer-motion: sonner, or motion.li initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.98 }} with layout for the stack
- **Accessibility:** role="status" (polite); Undo is a real button and should also be reachable by ⌘Z; do not auto-dismiss while focused.

| Prop | Values | Default |
|---|---|---|
| `text` | string (escaped) | — |
| `icon` | IconName (accent) | — |
| `action` | { label: "Undo", onClick } | — |
| `duration` | ms | 4200 |

Shown: Plain · With icon · With Undo · Stacked · Live

### NotificationBanner

macOS-style banner under the menu bar at the top right: app icon, title, one line, time and up to two actions. It slides in on a spring and slides out faster.

- **Maps to:** Native macOS notification in production (tauri-plugin-notification with action buttons); this custom component only exists for the prototype
- **Used in:** Meeting starting, Review ready
- **Source:** `kit Kit.notify({ title, body, time, actions, duration, onClick, container }) · .notif-stack .notif (.show .hide) · 002 app-record.js T.notifyStarting / T.notifyReview`
- **States:** with actions, single action, without actions, stacked, entering, leaving, paused (hover)
- **Tokens:** `--glass-strong`, `--shadow-float`, `--spring`, `--spring-dur`, `--ease-in-out`
- **Motion:** Trigger: Kit.notify(); timer, action or body click · Animates: transform translateX(calc(100% + 24px)) → none; leave back to translateX(calc(100% + 24px)) · Duration: enter 490ms (--spring-dur); leave 240ms, removed after 260ms; visible 7000ms, hover pauses, leaving the banner restarts a 2500ms timer · Easing: enter --spring (0.3% overshoot); leave --ease-in-out · Runtime: CSS transition (.show after two animation frames) · Reduced motion: transform not transitioned — appears and disappears in place · framer-motion: initial={{ x: "calc(100% + 24px)" }} animate={{ x: 0 }} transition={{ type: "spring", duration: 0.49, bounce: 0.12 }} exit={{ x: "calc(100% + 24px)", transition: { duration: 0.24, ease: [0.77, 0, 0.175, 1] } }}
- **Accessibility:** role="status"; actions are buttons; in production the OS handles focus and Notification Center.

| Prop | Values | Default |
|---|---|---|
| `title` | string | — |
| `body` | string | — |
| `time` | string | "now" |
| `actions` | { label, primary, onClick }[] (≤ 2) | [] |
| `duration` | ms | 7000 |
| `onClick` | () => void (click on the banner body) | — |

Shown: Meeting starting · Review ready · Without actions · Stacked · Live

### Tooltip

Small glass label below a control. The first one waits 650ms; moving to a neighbour within 600ms shows the next instantly.

- **Maps to:** Radix Tooltip with TooltipProvider delayDuration={650} skipDelayDuration={600}
- **Used in:** Toolbar icon buttons, Sidebar add, Peek close, Include dots, Private chip, Grip
- **Source:** `kit tooltips() — one .tooltip element driven by [data-tip] (pointerover / pointerout / pointerdown) · .tooltip (.show .instant)`
- **States:** hidden, delayed show, instant show (warm), hidden on press
- **Tokens:** `--glass-strong`, `--shadow-float`, `--label`
- **Motion:** Trigger: pointer rests on a [data-tip] element for 650ms; warm = shown or hidden < 600ms ago · Animates: opacity 0 → 1 and transform scale(0.97) → none (origin top center) · Duration: 125ms in and out; warm tooltips use .instant (0ms) · Easing: --ease-out · Runtime: CSS transition · Reduced motion: scale snaps; opacity fades · framer-motion: initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.125 }} — skip the animation when the provider is warm
- **Accessibility:** Tooltips repeat an accessible name — icon buttons still need aria-label. Hidden on pointerdown and never contain interactive content.

| Prop | Values | Default |
|---|---|---|
| `content` | string (data-tip) | — |
| `side` | bottom (fixed: 6px below, centered, clamped 8px from the left) | bottom |

Shown: Delayed · Instant · With shortcut · Live

### EvidencePopover

Where a claim came from: the exact words (speech) or the excerpt (document), who said it, and a way to open the full transcript or document.

- **Maps to:** Radix Popover with <EvidenceSpeech> / <EvidenceDocument> content; opened by SourceChip
- **Used in:** Memory, Brief (Since last time, Worth asking), Past meetings, Review candidates, Peek, Island
- **Source:** `kit Kit.evidence(trigger, { t, who, quote }, { where, onOpen }) · 002 doc-review.js D.openEvidence / docEvidence / candidateEvidence · doc.css .ev-pop · app-model.js T.evidenceFor`
- **States:** speech, speech · jump, speech · peek, speech · no meeting on file, candidate (today), document
- **Tokens:** `--glass-strong`, `--accent-soft`, `--label-2`, `--label-3`
- **Motion:** Trigger: click on a SourceChip; Open transcript · Animates: opacity 0 → 1 and scale(0.96) → none from the chip (--origin); Open transcript closes the popover first, then the details drawer slides in · Duration: enter opacity 150ms / scale 190ms; exit 110ms; drawer 300ms · Easing: popover --ease-out; drawer --ease-drawer · Runtime: CSS transition (Kit.popover) · Reduced motion: scale snaps; opacity fades · framer-motion: same presets as Popover
- **Accessibility:** Quote is a blockquote with cite; the open action is a button; Esc returns focus to the source chip.

| Prop | Values | Default |
|---|---|---|
| `kind` | speech \| document | speech |
| `where` | meeting date ("Sep 22") | — |
| `t` | timestamp or page | — |
| `who` | speaker | — |
| `quote` | string | — |
| `openLabel` | "Open transcript" \| "Jump to Sep 22" \| "Open Sep 22 in the doc" \| none | Open transcript |

Shown: Speech · inside a past meeting · Speech · elsewhere in the doc · Speech · in the side peek · Speech · no meeting on file · Review candidate · Document · Live

### FlyChip

A glass chip that flies from where something happened to where it lands (usually a sidebar series row), then the target flashes and its icon bumps.

- **Maps to:** Shared-element flight: framer-motion layoutId, or two nested motion.divs (x and y with different easings) in a portal
- **Used in:** Track a series, Join a proposal, File a recording, Move / split a meeting, Create a series, Onboarding (app icon to menu bar)
- **Source:** `kit Kit.flyTo(fromEl, toEl, { markup, duration = 560 }) · 002 app-shell.js T.flyMarkup (.a-fly) · app-actions.js / app-flows.js / doc-organize.js flyChip (.fly-chip)`
- **States:** series chip, glyph chip, drag ghost, in flight, landed (receive + bump)
- **Tokens:** `--glass-strong`, `--shadow-float`, `--accent-soft`
- **Motion:** Trigger: an item is filed, tracked, joined, moved or created · Animates: outer translateX(0 → dx); inner translateY(0 → dy) + scale(1 → clamp(0.4, to.height / from.height, 1)) + opacity 1 → 0.35 — the split axes make a curved path; on finish the target gets .receive (background accent-soft → transparent, 900ms) and its icon .bump (scale 1.18 at 40%, 420ms) · Duration: 560ms (onboarding icon 620ms) · Easing: x cubic-bezier(0.45, 0, 0.2, 1); y/scale/opacity cubic-bezier(0.6, 0, 0.9, 0.7); receive and bump --ease-out · Runtime: WAAPI (fixed-position clone on document.body, fill forwards) → CSS keyframes on the target · Reduced motion: no flight; the target still flashes (bump is disabled by the kit reduced rule) · framer-motion: portal chip with motion.div x (ease [0.45, 0, 0.2, 1]) wrapping motion.div y/scale/opacity (ease [0.6, 0, 0.9, 0.7]), duration 0.56; then target animate backgroundColor keyframes
- **Accessibility:** Decorative — announce the result in a status toast (002 always pairs a flight with a toast).

| Prop | Values | Default |
|---|---|---|
| `from` | element | — |
| `to` | element | — |
| `markup` | .a-fly (series) \| .fly-chip (glyph + label) | clone of from |
| `duration` | ms | 560 |

Shown: Series chip · Glyph chips · Drag ghost · Live flight

## Chrome

The macOS frame around everything: the menu bar and Telu’s status item, the window with its traffic lights, the two toolbars (agenda and living doc) and the translucent sidebar. Sidebar tiles are rendered by 002’s own T.renderSidebar against each scenario.

### MenuBar

The system menu bar while Telu is frontmost: Apple menu, bold app name, app menus, then status items and the clock on the right. Menus open instantly under their title, which stays highlighted while open.

- **Maps to:** Native macOS menu bar — Tauri Menu API (app menu + submenus with accelerators); not rendered by React
- **Used in:** Desktop (every scenario)
- **Source:** `kit Kit.menubar({ app, menus, extras }) · .menubar .mb-item (.app .active) .mb-right · 002 app.js MENUS / openMenubarMenu / wireMenubar`
- **States:** rest, menu open (title active), menu row active
- **Tokens:** `--menubar`, `--menubar-h`, `--separator`, `--fill-3`, `--template-filter`
- **Motion:** None on the bar. Menus open instantly (no enter animation), close with a 120ms opacity fade; the title highlight is added and removed with no transition.
- **Accessibility:** Native in production (VoiceOver and keyboard navigation come from macOS). Accelerators: ⌥⌘N New Series, ⌘E Edit Purpose, ⌘F Find, ⌘R Record, ⌥Space Telu, ⌘W Close Window.

| Prop | Values | Default |
|---|---|---|
| `app` | string | "Telu" |
| `menus` | string[] | File, Edit, View, Meeting, Window, Help |
| `extras` | status items (MenuBarStatusItem) | — |
| `clock` | string | "Tue 29 Sep  9:41" |

Shown: Rest · File menu open · View menu open · Meeting menu while recording · Live

### MenuBarStatusItem

Telu’s menu-bar item: the template glyph, plus one short phrase for the most important thing right now. It reads the same state as the Island and summons the window.

- **Maps to:** Tauri tray icon (tray.rs) with icon_as_template(true) and set_title() for the phrase; click → show window
- **Used in:** Menu bar (every scenario), Onboarding (flies into it)
- **Source:** `002 app-bridge.js statusMarkup / T.renderStatus · app.js extras #teluStatus · app.css .menubar .telu-status (.icon-only .ts-text .rec-dot)`
- **States:** icon only, next, starting, recording, filing, to review
- **Tokens:** `--template-filter`, `--coral`
- **Motion:** Trigger: app state changes (T.renderStatus) · Animates: none — the phrase swaps instantly; while recording the dot pulses and the timer ticks every second · Duration: rec dot 1.4s loop · Easing: ease-in-out (dot) · Runtime: innerHTML swap + CSS keyframes (kit-rec) + setInterval timer (Kit.timer) · Reduced motion: rec dot slows to 2.4s · framer-motion: none — native tray title
- **Accessibility:** aria-label="Telu"; role="button". Precedence: not onboarded → recording → filing → to review → starting / next → nothing (icon only). Keep the phrase under ~24 characters.

| Prop | Values | Default |
|---|---|---|
| `phase` | none \| next \| starting \| recording \| filing \| review | none |
| `text` | derived phrase (see stories) | — |
| `onClick` | () => summon() | — |

Shown: Every phase · Icon-only vs text

### WindowFrame

The app window: rounded, translucent sidebar material with a deep shadow, traffic lights at 20/20, sidebar on the left and the content column. Closing hides it — Telu keeps running in the menu bar and the Island.

- **Maps to:** Tauri window with titleBarStyle "Overlay", hiddenTitle, transparent + macOS vibrancy (sidebar material); traffic lights are native
- **Used in:** App
- **Source:** `kit .window .traffic (i × 3, :hover glyphs) · 002 index.html #win · app.css .window.t-app (.zoomed) · app-shell.js hideWindow / showWindow / toggleZoom`
- **States:** shown, hidden (closed), zoomed, traffic rest, traffic hover
- **Tokens:** `--sidebar`, `--shadow-window`, `--r-window`, `--content-bg`, `--hairline`
- **Motion:** None — hide/show and zoom swap instantly in 002 (hidden attribute; .zoomed changes inset). Traffic-light glyphs appear on hover of the whole group with no transition. In production the OS animates the window.
- **Accessibility:** Native window controls in production. The window root is focusable (tabindex −1) for keyboard shortcuts; ⌘W closes, ⌥Space / ⌘0 summon.

| Prop | Values | Default |
|---|---|---|
| `sidebarWidth` | px | 244 |
| `zoomed` | boolean | false |
| `hidden` | boolean (⌘W, red light) | false |

Shown: Traffic lights · Frame · Live traffic lights

### Toolbar

The 52px strip over the content column. Transparent at rest; when content scrolls under it, it turns into glass with a hairline. Carries a 2px progress hairline on its bottom edge.

- **Maps to:** A <Toolbar> header with data-scrolled from a scroll sentinel (IntersectionObserver or onScroll) — Tauri drag region (data-tauri-drag-region)
- **Used in:** Agenda (Today, Upcoming, Review, Found), Living doc
- **Source:** `kit .toolbar (.scrolled) .toolbar-title + Kit.scrollEdge(scroller, toolbar) · 002 app-shell.js T.renderToolbar · app.css .a-progress`
- **States:** rest (transparent), scrolled (glass), progress running
- **Tokens:** `--toolbar-h`, `--content-bg`, `--separator`
- **Motion:** Trigger: content scroll crosses 2px · Animates: background-color transparent → content-bg 76% and box-shadow 0.5px separator; backdrop-filter blur(18px) saturate(1.6) switches on without a transition · Duration: 200ms both ways · Easing: ease · Runtime: CSS transition (interruptible) · Reduced motion: unchanged (colors and shadows are allowed) · framer-motion: none — CSS with a data-scrolled attribute
- **Accessibility:** role="toolbar" with aria-label; buttons keep their own labels. The toolbar doubles as the window drag region.

| Prop | Values | Default |
|---|---|---|
| `mode` | agenda \| doc | agenda |
| `scrolled` | boolean (content scrollTop > 2) | false |
| `progress` | boolean | false |

Shown: Rest · Scrolled · Live scroll · Progress hairline

### AgendaToolbar

Toolbar for the agenda pages: page title and date, the recording capsule while recording, the day stepper, and New + Search.

- **Maps to:** Composition of Toolbar + GlassGroup + shadcn Button; recording capsule as <RecordingCapsule> with AnimatePresence
- **Used in:** Today / Yesterday / Tomorrow, Upcoming, Review, Found in Calendar
- **Source:** `002 app-shell.js agendaToolbar / titleFor / recCapsule / syncCapsule / updateAgendaToolbar · app.css .a-tb-title .a-rec-slot .a-rec-capsule .a-new-btn`
- **States:** day, first / last day (stepper end disabled), no calendar (stepper disabled), upcoming, review, found, recording, narrow (≤ 900px: shortcut hidden)
- **Tokens:** `--coral-soft`, `--coral-ink`, `--coral`, `--label-2`
- **Motion:** Trigger: recording starts or stops (pointer or ⌘R) · Animates: capsule in: opacity 0 → 1, scale(0.96) → none, blur(2px) → 0; out: opacity → 0, scale(0.96), then removed · Duration: in 240ms; out 150ms · Easing: in --ease-out; out ease-out · Runtime: WAAPI (Element.animate); no animation when the toolbar is rebuilt without animate · Reduced motion: capsule appears and disappears instantly · framer-motion: <AnimatePresence>{recording && <motion.div initial={{ opacity: 0, scale: 0.96, filter: "blur(2px)" }} animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }} exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }} transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }} />}</AnimatePresence>
- **Accessibility:** Stepper buttons need aria-label (“Previous day”, “Next day”); ← → step days with no animation; Stop in the capsule is labelled; the timer is aria-hidden with a status message on start/stop.

| Prop | Values | Default |
|---|---|---|
| `title` | string | — |
| `subtitle` | string | — |
| `canPrev / canNext` | boolean | true |
| `recording` | { label, startedAt } \| null | null |
| `onNew / onSearch / onStop` | () => void | — |

Shown: Today · Yesterday · first day · Tomorrow · last day · Review · Found in Calendar · Upcoming · No calendar · Recording · Recording a one-off · Narrow window

### DocToolbar

Toolbar for a series’ living doc: back to where you came from, a compact title that appears once the big title scrolls away, the save state, document actions with Record, and the details-drawer toggle.

- **Maps to:** Composition of Toolbar + GlassGroup + shadcn Button; compact title via IntersectionObserver on the doc title
- **Used in:** Living doc
- **Source:** `002 app-shell.js docToolbar / updateDocToolbar / T.paintRecordButton / T.setSaveState · doc.css .tb-title .save-state .tb-record #tbInspector.on · app.css .btn.tb-back · doc-page.js observeTitle`
- **States:** with back, without back, compact title hidden, compact title shown, saving, saved, recording, drawer open
- **Tokens:** `--accent`, `--coral`, `--coral-soft`, `--coral-ink`, `--label-2`, `--label-3`
- **Motion:** Trigger: doc title leaves / re-enters the area under the toolbar (IntersectionObserver); typing in the purpose · Animates: compact title opacity 0 → 1 and translateY(4px) → none; save-state color label-2 (Saving…) → label-3 (Saved) with a text swap 700ms after the last keystroke · Duration: title 180ms both ways; save color 150ms · Easing: title --ease-out; save ease · Runtime: CSS transition (class toggles .show / .busy) · Reduced motion: title fades without moving; save state unchanged · framer-motion: title: animate={{ opacity: shown ? 1 : 0, y: shown ? 0 : 4 }} transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
- **Accessibility:** Back reads “Back to Today” (⌘[); Record toggles aria-pressed and announces start/stop; the drawer toggle uses aria-expanded; save state is a polite live region.

| Prop | Values | Default |
|---|---|---|
| `back` | { label } \| null | null |
| `compactTitle` | boolean (doc title scrolled away) | false |
| `saveState` | "Saved" \| "Saving…" (002 never shows “Editing…”) | "Saved" |
| `recording` | boolean | false |
| `drawerOpen` | boolean | false |

Shown: From Today · Opened from the sidebar · Scrolled · compact title · Saving · Recording · Details drawer open · Back button · Record button

### Sidebar

Translucent source list: the four agenda destinations, the tracked series, the watched calendars and a local-processing footer. Rendered here by 002’s T.renderSidebar for each scenario.

- **Maps to:** shadcn Sidebar (SidebarGroup / SidebarMenu / SidebarMenuButton) over native vibrancy
- **Used in:** App window
- **Source:** `002 app-shell.js T.renderSidebar / navItem / seriesSection / calendarRow / T.updateCounts / T.syncSidebarSelection · app.css .t-app .sidebar · kit .sidebar .sb-title .sb-item .sb-foot`
- **States:** first run, before, doc selected, recording, after
- **Tokens:** `--sidebar`, `--sidebar-w (244)`, `--accent`, `--fill-2`, `--label-3`
- **Motion:** Trigger: selection change; a series is tracked or untracked; counts change · Animates: selected row background-color; new rows height 0 → auto + opacity 0 → 1 (Kit.enterAnimated); removed rows height/margins/paddings → 0 + opacity → 0 (Kit.removeAnimated); counts bump scale 1.18 · Duration: selection 120ms; enter 280ms; remove 220ms; bump 420ms · Easing: selection ease; the rest --ease-out · Runtime: CSS transition (selection) + WAAPI (enter/remove) + CSS keyframes (bump) · Reduced motion: rows appear and disappear instantly; bump disabled; selection still fades · framer-motion: AnimatePresence around rows: initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0, transition: { duration: 0.22 } }} transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
- **Accessibility:** nav landmark; rows are links/buttons with aria-current on the selected one; ↑↓ move within a list in Radix/shadcn. 002 has no hover highlight on rows by design (macOS source lists).

| Prop | Values | Default |
|---|---|---|
| `view` | day \| upcoming \| review \| found \| doc(seriesId) | day |
| `counts` | { today, review, found } | — |
| `series` | tracked series[] | [] |
| `calendars` | { id, name, account, color, watched }[] | [] |

Shown: Before · Today selected · Living doc selected · Recording · After · 10:46 · First run

### SidebarNavItem

Agenda destination row: accent glyph, label and a quiet tabular count. No hover highlight; selected rows get a neutral fill.

- **Maps to:** shadcn SidebarMenuButton + SidebarMenuBadge
- **Used in:** Sidebar
- **Source:** `002 app-shell.js navItem · kit .sb-item (.selected .count) · app.css .t-app .sb-item`
- **States:** rest, selected, pressed, drop over (Review), count bump
- **Tokens:** `--accent`, `--fill-2`, `--label-3`
- **Motion:** Trigger: press; selection; count change (T.updateCounts) · Animates: press transform scale(0.985); selection background-color; count .bump scale 1 → 1.18 → 1 · Duration: press 140ms; background 120ms; bump 420ms · Easing: press --ease-out; background ease; bump --ease-out · Runtime: CSS transition + CSS keyframes (kit-bump, restarted per change) · Reduced motion: press snaps; bump disabled; background still fades · framer-motion: whileTap={{ scale: 0.985 }}; count: key={count} animate={{ scale: [1, 1.18, 1] }} transition={{ duration: 0.42, times: [0, 0.4, 1] }}
- **Accessibility:** aria-current="page" when selected; the count is read as part of the label (“Review, 5 items”).

| Prop | Values | Default |
|---|---|---|
| `icon` | sun \| calendar \| tray \| sparkles | — |
| `label` | string | — |
| `count` | number (hidden when 0) | 0 |
| `selected` | boolean | false |

Shown: Rows × states · Drop target (Review) · Count bump

### SidebarSectionTitle

Small section heading. The Series title carries an add button that only appears on hover (or keyboard focus).

- **Maps to:** shadcn SidebarGroupLabel + SidebarGroupAction
- **Used in:** Sidebar (Series, Calendars)
- **Source:** `002 app-shell.js seriesSection (.a-sb-title .a-sb-add) · kit .sb-title · app.css .a-sb-add`
- **States:** rest, hover (add visible), add focus-visible
- **Tokens:** `--label-3`, `--label-2`
- **Motion:** Trigger: pointer enters the title row (fine pointers); keyboard focus · Animates: add button opacity 0 → 1 · Duration: 150ms · Easing: ease · Runtime: CSS transition · Reduced motion: unchanged (opacity) · framer-motion: none — CSS group-hover:opacity-100
- **Accessibility:** The add button needs aria-label="New series" (002 has only data-tip); it is always visible on touch (no hover).

| Prop | Values | Default |
|---|---|---|
| `label` | string | — |
| `action` | { icon, label, onClick } \| none | none |

Shown: Series title · Plain title

### SidebarSeriesRow

A tracked series: its icon, name and a hint for the next meeting (time today, weekday this week, date later) — or a pulsing rec dot while it records. Rows accept dropped meetings. Series rows carry no pending count in 002; pending review is counted on the Review row.

- **Maps to:** shadcn SidebarMenuButton with a trailing hint; dnd-kit (or native DnD) droppable
- **Used in:** Sidebar
- **Source:** `002 app-shell.js seriesRow / T.nextHint / T.revealSeriesRow / T.dropSeriesRow · app.css .a-sb-row .a-hint .sb-item.drop-over .sidebar.dnd .sb-item.landing · doc-organize.js setDropRow · doc-page.js D.receive`
- **States:** rest, selected, pressed, recording, draft (Untitled), drag in progress, drop over, receive flash, landing (hidden during fly-to), entering
- **Tokens:** `--series-*`, `--label-3`, `--fill-2`, `--accent-soft`
- **Motion:** Trigger: press; a meeting dragged over; something filed into the series; a new series created · Animates: press scale(0.985); drop-over background accent-soft + scale(1.03); receive background accent-soft → transparent; entering height 0 → auto + opacity 0 → 1 while a FlyChip lands on it · Duration: press/drop 140ms; receive 900ms (held for the first 30%); enter 280ms; fly 560ms · Easing: --ease-out throughout (fly uses its own curves) · Runtime: CSS transitions (press, drop-over) + CSS keyframes (kit-receive) + WAAPI (enterAnimated, flyTo) · Reduced motion: no scale; no height animation or flight; receive flash still runs (not gated in the kit) · framer-motion: whileTap={{ scale: 0.985 }}; drop: animate={{ scale: over ? 1.03 : 1 }}; enter: initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}; receive: animate={{ backgroundColor: [soft, soft, transparent] }} transition={{ duration: 0.9, times: [0, 0.3, 1] }}
- **Accessibility:** aria-current when selected; the rec dot needs a text alternative (“recording”); drag-and-drop must have a menu alternative (Move to… in the meeting menu).

| Prop | Values | Default |
|---|---|---|
| `series` | { id, name, color, icon } | — |
| `hint` | time \| weekday \| date \| recording | — |
| `selected` | boolean | false |
| `dropState` | none \| candidate \| over | none |

Shown: Next-meeting hints · States · Recording · Next meeting later · Draft · Dragging a meeting · Receive flash · New series lands

### SidebarCalendarRow

A calendar Telu reads, with a square check in the calendar’s color. Unwatched calendars dim their name and say so. The whole row toggles.

- **Maps to:** shadcn SidebarMenuButton containing a Radix Checkbox (colored)
- **Used in:** Sidebar · Calendars
- **Source:** `002 app-shell.js calendarRow + actions.cal · app.css .a-cal .a-cal-check .a-cal-cap`
- **States:** watched, not watched, pressed
- **Tokens:** `--cal (calendar color)`, `--label-2`, `--label-3`
- **Motion:** Trigger: click on the row · Animates: check background-color + ring; tick stroke-dashoffset; row press scale(0.985); caption “Not watched” toggles with no transition; agenda Personal rows crossfade (T.refreshPersonal) · Duration: fill 160ms; tick 220ms (+40ms delay); press 140ms; crossfade 110ms out / 190ms in · Easing: fill ease; tick, press and crossfade-in --ease-out · Runtime: CSS transition (check, press) + WAAPI (crossfade) · Reduced motion: fill fades; tick and press snap; no crossfade · framer-motion: check as in Checkbox; whileTap={{ scale: 0.985 }}
- **Accessibility:** The row is the control: role="menuitemcheckbox" / checkbox with aria-checked; the inner check is decorative (tabindex −1).

| Prop | Values | Default |
|---|---|---|
| `calendar` | { name, account, color } | — |
| `watched` | boolean | true |
| `onToggle` | (watched) => void — toasts “Watching … — read on this Mac only” | — |

Shown: Watched and not watched · Pressed

### AppShell

Window chrome in context: traffic lights, sidebar, toolbar and an empty content column, composed from 002’s real markup.

- **Maps to:** Root layout: Tauri window + SidebarProvider + <Sidebar> + <main> with <Toolbar> and a scroll area
- **Used in:** App
- **Source:** `002 index.html #win structure · app-shell.js T.renderSidebar / agendaToolbar / docToolbar`
- **States:** agenda (Before), living doc while recording (Live)
- **Tokens:** `--sidebar`, `--content-bg`, `--shadow-window`, `--toolbar-h`, `--sidebar-w`
- **Motion:** See Toolbar, Sidebar and the Animations section for view transitions (agenda day slide, view crossfade 200ms, peek and drawer 300ms --ease-drawer).
- **Accessibility:** Landmarks: nav (sidebar), main (content), toolbar; skip link to content; ⌘[ back.

Shown: Window chrome in context · agenda · Window chrome in context · living doc, recording

## Calendar

The agenda: a day timeline of event cards with a time column, the now line and free gaps, the toolbar’s day header, stepper and recording capsule, the proposals banner, and the flows that start from a card. Every tile calls 002’s own markup functions against a scenario state.

### DayHeader

The toolbar title of the agenda: the day’s relative name over its long date. The same two-line title names the Upcoming, Review and Found in Calendar pages with a live count.

- **Maps to:** Plain component in the toolbar (h1 + subtitle); text only
- **Used in:** Agenda toolbar · Today, Upcoming, Review, Found in Calendar
- **Source:** `002 app-shell.js agendaToolbar · titleFor · .toolbar-title.a-tb-title`
- **States:** day, page with count, page empty, truncated
- **Tokens:** `--label`, `--label-2`, `--font`
- **Motion:** None of its own: the text swaps instantly on day change while the timeline below slides (see DayStepper). Trigger → n/a · Reduced motion → n/a · framer-motion → none.
- **Accessibility:** Render the title as the page heading (h1) with the date as its description; announce day changes with an aria-live="polite" region on the title.

| Prop | Values | Default |
|---|---|---|
| `title` | string (Yesterday \| Today \| Tomorrow \| page name) | Today |
| `subtitle` | string (long date \| page count) | — |

Shown: Today · Yesterday · Tomorrow · Upcoming · Review · Review · empty · Found in Calendar · Found · empty · Truncation

### DayStepper

Glass capsule group: previous day, Today, next day. The chevrons disable at the ends of the loaded range and when no calendar is connected; Today is always enabled.

- **Maps to:** Toolbar button group (shadcn Button × 3 in a glass container) with Radix Tooltip on the chevrons
- **Used in:** Agenda toolbar
- **Source:** `002 app-shell.js agendaToolbar #stepper · T.stepDay · T.goToday · app-agenda.js slideSwap`
- **States:** rest, hover, pressed, focus, prev disabled, next disabled, both disabled
- **Tokens:** `--glass-strong`, `--glass-edge`, `--glass-rim`, `--fill-2`, `--label`
- **Motion:** Trigger: ‹ / › / Today click (the ←/→ keys step without animation) → the agenda view slides. Properties: opacity + translateX; exit 1→0 and 0→−16px·dir, enter 0→1 and +16px·dir→0 (dir = +1 forward, −1 back). Duration: exit 140ms (fill forwards), enter 220ms. Easing: --ease-out cubic-bezier(0.23, 1, 0.32, 1) for both. Mechanism: WAAPI Element.animate on the view host; interruptible — each step cancels running animations and a slide token drops a stale swap; scroll resets to top on swap. Buttons: scale(0.97) on press, 140ms --ease-out (CSS transition). Reduced motion: instant swap, no slide. framer-motion: <AnimatePresence mode="wait" custom={dir}> keyed by day, variants enter {opacity: 0, x: 16 * dir} → center {opacity: 1, x: 0, transition: {duration: 0.22, ease: [0.23, 1, 0.32, 1]}} → exit {opacity: 0, x: -16 * dir, transition: {duration: 0.14, ease: [0.23, 1, 0.32, 1]}}.
- **Accessibility:** role="group" aria-label="Day"; chevrons are icon buttons with aria-label "Previous day" / "Next day" (tooltips repeat them); disabled buttons use the disabled attribute; ←/→ step days when focus is not in a text field.

| Prop | Values | Default |
|---|---|---|
| `canPrev` | boolean | true |
| `canNext` | boolean | true |
| `onPrev / onToday / onNext` | () => void | — |

Shown: Range × states · Hover · chevron · In the toolbar · Live · slides between days

### ProposalsBanner

Accent-tinted banner at the top of Today when the calendar scan finds new recurring meetings. Review opens Found in Calendar; × hides it until something new appears.

- **Maps to:** Custom banner inside Radix Collapsible (shadcn Alert styling) · lucide Sparkles, X
- **Used in:** Today
- **Source:** `002 app-agenda.js bannerMarkup · bannerText · T.updateBanner · .a-banner`
- **States:** several found, one found, hover Review, hover hide, collapsed, narrow (subtitle hidden)
- **Tokens:** `--accent-softer`, `--accent-soft`, `--accent`, `--accent-strong`, `--label-2`
- **Motion:** Hide (× or the last proposal decided) → .collapsible.collapsed: grid-template-rows 1fr→0fr 260ms --ease-out + opacity 1→0 200ms ease (CSS transition, reversible mid-flight). Count change → text crossfade: out opacity 1→0 + blur 0→2px 110ms ease-out (fill forwards), swap, in opacity 0→1 + blur 2px→0 190ms --ease-out (WAAPI via T.fx.crossfade; cancels a running crossfade). Hide also shows a toast. Reduced motion: rows snap (only opacity transitions survive), text swaps instantly. framer-motion: <AnimatePresence initial={false}>{show && <motion.div initial={{height: 0, opacity: 0}} animate={{height: "auto", opacity: 1}} exit={{height: 0, opacity: 0}} transition={{height: {duration: 0.26, ease: [0.23, 1, 0.32, 1]}, opacity: {duration: 0.2}}}/>}; text: <AnimatePresence mode="wait"> keyed by count with opacity + filter blur(2px).
- **Accessibility:** role="status" so a new find is announced; Review is a button; × is an icon button aria-label="Hide" (tooltip "Hide"); the collapsed wrapper gets aria-hidden and inert.

| Prop | Values | Default |
|---|---|---|
| `proposals` | Proposal[] (kind "new") | — |
| `hidden` | boolean | false |
| `onReview` | () => void | — |
| `onHide` | () => void | — |

Shown: 2 found · 1 found · Hover · Review · Hover · Hide · Hide · collapse · Count change · crossfade · Narrow agenda

### NowLine

Coral hairline with the current time in the time column. Sits above the first event that hasn’t ended yet (or after the last one) on today only.

- **Maps to:** Plain component (grid row aligned to the time column)
- **Used in:** Today timeline
- **Source:** `002 app-agenda.js nowMarkup · timelineMarkup · .a-now`
- **States:** before a meeting, at start, during, after
- **Tokens:** `--coral`, `--a-time-w`
- **Motion:** None: re-renders in place when the clock or scenario changes (no transition). Reduced motion → n/a · framer-motion → none (optionally layout for position changes).
- **Accessibility:** Decorative for sighted users; expose the time as visually hidden text “Now, 9:41” so screen readers get the position in the list.

| Prop | Values | Default |
|---|---|---|
| `time` | string (H:MM) | now |

Shown: Before · 9:41 · Starting · 10:00 · Live · 10:12 · After · 10:46 · In context

### FreeGap

Dashed divider with the free time between two events. Only for gaps of 45 minutes or more, and never directly where the now line sits.

- **Maps to:** Plain component
- **Used in:** Today timeline, Yesterday, Tomorrow
- **Source:** `002 app-agenda.js gapMarkup · timelineMarkup · .a-gap`
- **States:** minutes, hours, hours + minutes
- **Tokens:** `--label-3`, `--separator`, `--a-time-w`
- **Motion:** None. Reduced motion → n/a · framer-motion → none.
- **Accessibility:** Plain text (“1 h 15 min free”); the dashed rule is decorative (aria-hidden).

| Prop | Values | Default |
|---|---|---|
| `minutes` | number (≥ 45) | — |

Shown: 45 min · 1 h · 1 h 15 min · In context

### EventCard

One calendar event on the timeline. Its kind (derived from the event, its series and the scenario) drives the chip, meta line, actions and the series colour bar; the next tracked meeting grows an eyebrow, a purpose excerpt and primary actions. Hover-only actions reveal on fine pointers or when selected.

- **Maps to:** Custom card (motion.article with layout) · shadcn Button inside · Radix ContextMenu on right-click · lucide Video, Repeat, Check, CheckCircle, Lock, Plus, Circle (record), Square (stop)
- **Used in:** Today, Yesterday, Tomorrow, Upcoming, Review
- **Source:** `002 app-agenda.js cardMarkup · chipMarkup · metaMarkup · actionsMarkup · extraMarkup · eyebrowMarkup · T.morphCard · .a-card`
- **States:** brief ready, preparing brief, brief tonight, tracking, next up, starting, next up · now, recording, preparing summary, ended · to review, filed, review, untracked recurring, one-off, records once, proposal, proposal added, kept separate, unfiled, unfiled filed, personal, past, selected, hover, pressed, narrow, truncated
- **Tokens:** `--surface`, `--card-bg`, `--shadow-card`, `--shadow-card-hover`, `--c (series colour)`, `--accent`, `--accent-strong`, `--accent-soft`, `--coral`, `--coral-ink`, `--amber`, `--amber-soft`, `--fill-2`, `--fill-3`, `--label-2`, `--label-4`, `--hairline`, `--surface-sunken`
- **Motion:** Hover: box-shadow → --shadow-card-hover 200ms ease (CSS transition, fine pointers only). Press: scale(0.992) 160ms --ease-out (CSS transition). Hover actions (.a-hover): opacity 0→1 150ms ease (CSS transition); always visible when selected or on touch. Selection ring (::after, 2px accent): opacity snaps (no transition). Series bar (::before): on tracking scaleY(0.2)→1 360ms --ease-out + opacity 0→1 200ms ease; colour → coral while recording 220ms ease (CSS transitions, interruptible). State change (track, record, stop, skip, add, keep separate, file) → morph: the card’s classes and --c swap at once, then every [data-part] whose markup changed crossfades — out opacity 1→0 + blur 0→2px 110ms ease-out (fill forwards), swap, in opacity 0→1 + blur 2px→0 190ms --ease-out (WAAPI, cancels a running crossfade on that part). Rows re-flow with FLIP translateY(dy)→0 320ms --ease-in-out cubic-bezier(0.77, 0, 0.175, 1) (WAAPI) when a card changes height (record / stop). Loops: the Starting dot (.a-mini-dot) and the recording dot pulse kit-rec 1.4s ease-in-out infinite (opacity 1→0.3→1); wave bars kit-wave 900ms ease-in-out infinite scaleY 0.3→1 with −200/−450/−650/−100ms offsets; preparing chips kit-shimmer 1.3s linear infinite (CSS keyframes); timer ticks every 1s. After the meeting ends the card fades in: opacity 0→1 + blur 2px→0 240ms --ease-out (T.fx.fadeIn). Reduced motion: parts swap instantly, no FLIP, no fade; the bar fades in without the scaleY grow; wave and shimmer stop; the recording dot slows to 2.4s (the Starting dot keeps 1.4s). framer-motion: <motion.article layout transition={{layout: {duration: 0.32, ease: [0.77, 0, 0.175, 1]}}} whileTap={{scale: 0.992}}>; each part <AnimatePresence mode="wait" initial={false}><motion.div key={partKey} initial={{opacity: 0, filter: "blur(2px)"}} animate={{opacity: 1, filter: "blur(0px)", transition: {duration: 0.19, ease: [0.23, 1, 0.32, 1]}}} exit={{opacity: 0, filter: "blur(2px)", transition: {duration: 0.11, ease: "easeOut"}}}/>; bar: motion.span animate={{scaleY: tracked ? 1 : 0.2, opacity: tracked ? 1 : 0}} transition={{duration: 0.36, ease: [0.23, 1, 0.32, 1]}}.
- **Accessibility:** In 002 the card is a clickable <article> (not focusable); ↑/↓ move the selection, Enter opens the side peek, ⌘R records the selection or next meeting, right-click opens the card menu. For React: timeline as role="listbox", cards role="option" with aria-selected and roving tabIndex; inner actions are real <button>s (Record announces aria-keyshortcuts="Meta+R"); hover-only actions must also appear on focus-within; the recording timer is aria-live="off" with an aria-label “Recording, 12 minutes”; the series colour bar is decorative.

| Prop | Values | Default |
|---|---|---|
| `event` | CalendarEvent (title, start, end, where, calendar, repeat, people, series, meeting, state, proposal, unfiled, filedTo) | — |
| `kind` | ready \| preparing \| tracking \| review \| summarizing \| filed \| recording \| recurring \| oneoff \| proposal \| unfiled | derived (T.kindOf) |
| `series` | Series \| null (tracked → colour bar --c) | null |
| `next` | boolean (eyebrow, purpose excerpt, Join / Record) | false |
| `starting` | boolean (Starting now · Skip / Record) | false |
| `selected` | boolean (accent ring, reveals hover actions) | false |
| `past` | boolean (row dims it) | false |
| `recordOnce` | boolean (chip “Records at HH:MM”) | false |
| `pending` | number (“N to review”) | 0 |
| `on…` | select, join, record, stop, skip, track, addToSeries, recordOnce, proposalAdd, proposalKeep, review, file, contextMenu | — |

Shown: Tracked · brief ready · Tracked · preparing brief · Tracked · brief tonight · Tracked · no brief yet · Tracking · just switched on · Next up · Starting now · Next up · now · Recording · Preparing summary · Ended · 5 to review · Ended · hover · Ended · filed · Review · 3 to review · Untracked recurring · Untracked recurring · hover · One-off · One-off · hover · One-off · records once · One-off · past · hover · Proposal · Proposal → added · Proposal → kept separate · Unfiled recording · Unfiled · no confident match · Unfiled → filed · Personal · busy · Personal · watched calendar · Past · Selected · Selected · untracked · Hover · Pressed · Long title · Narrow agenda (400px) · Chip slot · every kind · Morph · Track · Morph · Record · Morph · Skip · Morph · Record once · Morph · Proposal → added · Morph · Unfiled → filed

### EventRow

A timeline row: the time column (start bold, end faint, optional day label) and the event’s card — or, for events on a personal calendar, a hatched busy block. Past rows dim, except rows that still need review or filing.

- **Maps to:** Plain grid row (time column + EventCard | PersonalBusyBlock)
- **Used in:** Today, Yesterday, Tomorrow, Upcoming, Review
- **Source:** `002 app-agenda.js rowMarkup · timeMarkup · personalMarkup · .a-row · .a-time · .a-personal`
- **States:** upcoming, past (dimmed), past but needs review / filing (not dimmed), personal busy, personal watched, with day label
- **Tokens:** `--a-time-w`, `--label-3`, `--content-bg`, `--hairline`, `--fill`, `--separator`
- **Motion:** Rows re-flow with FLIP translateY(dy)→0 320ms --ease-in-out (WAAPI) when a card above changes height. The personal label crossfades (opacity + 2px blur, 110ms out / 190ms in, T.fx.crossfade) when the calendar is watched or unwatched. Review rows leave with Kit.removeAnimated (see ReviewMeetingRow). Kit.stagger (.enter: opacity 0 + translateY(6px) → none, 280ms --ease-out, 40ms per row, CSS keyframes) is wired in T.renderView({stagger}) but not triggered in 002 — see Timeline. Reduced motion: no FLIP, no crossfade. framer-motion: <motion.div layout> per row keyed by event id.
- **Accessibility:** The time column is text (“10:00 to 10:45”); the busy block reads “Personal, busy, 12:00 to 12:45” and is not interactive.

| Prop | Values | Default |
|---|---|---|
| `event` | CalendarEvent | — |
| `dayIndex` | number | today |
| `withDay` | boolean (day label above the time) | false |

Shown: Tracked · Next up · Past · dimmed · Past · still to review · Past · still to file · Personal · busy · Personal · watched · Personal · watch toggle · With day label · With day label · today · Hover

### Timeline

A whole day: rows in start order, the now line on today, free gaps of 45 minutes or more, and every card in the state the scenario puts it in. Tomorrow and yesterday have no now line; a day with no events shows “Nothing scheduled”.

- **Maps to:** Plain list (role="listbox") of EventRow · NowLine · FreeGap; framer-motion layout for re-flow
- **Used in:** Today, Yesterday, Tomorrow
- **Source:** `002 app-agenda.js timelineMarkup · dayMarkup · T.renderView · T.fx.flipRows · Kit.stagger`
- **States:** before, starting, live, after, yesterday, tomorrow, empty
- **Tokens:** `--a-time-w`, `--coral`, `--separator`
- **Motion:** Record / Stop → the affected cards morph (see EventCard) and all rows FLIP: translateY(dy)→0 320ms --ease-in-out cubic-bezier(0.77, 0, 0.175, 1) (WAAPI, measured before the class swap). Stop → “Preparing summary…” for a 900ms beat, then the After view re-renders in place and the ended card fades in: opacity 0→1 + blur 2px→0 + translateY 0, 240ms --ease-out (T.fx.fadeIn, WAAPI). Navigating to a page fades the whole view in the same way at 200ms. Stagger (Kit.stagger): rows get .enter → kit-enter keyframes opacity 0 + translateY(6px) → none, 280ms --ease-out, fill both, delay index × 40ms (CSS keyframes, restartable by re-adding the class) — wired as T.renderView({stagger: true}) but never triggered in 002. Reduced motion: no FLIP, fade or stagger (rows appear in place). framer-motion: <LayoutGroup> with <motion.div layout transition={{duration: 0.32, ease: [0.77, 0, 0.175, 1]}}> per row; enter stagger via variants {hidden: {opacity: 0, y: 6}, show: (i) => ({opacity: 1, y: 0, transition: {delay: i * 0.04, duration: 0.28, ease: [0.23, 1, 0.32, 1]}})}.
- **Accessibility:** role="listbox" aria-label="Tuesday, 29 September"; rows are options in time order; the now line is aria-hidden with a visually hidden “Now 9:41” marker; ↑/↓ move the selection and ←/→ change the day.

| Prop | Values | Default |
|---|---|---|
| `events` | CalendarEvent[] (sorted by start) | — |
| `dayIndex` | number | today |
| `now` | minutes since midnight (today only) | — |

Shown: Before · 9:41 · Starting · 10:00 · Live · 10:12 · After · 10:46 · Yesterday · Tomorrow · Empty day

### UpcomingDay

A day group on the Upcoming page: the day’s name with its long date, then its rows. Only days with events appear (tomorrow, then Thursday and Friday). The same group, titled “To review”, heads the Review page.

- **Maps to:** Plain section (h2 + span header, list of EventRow)
- **Used in:** Upcoming, Review (To review)
- **Source:** `002 app-pages.js daySection · upcomingMarkup · .a-day · .a-day-head`
- **States:** mixed kinds, tracked only, hidden when empty
- **Tokens:** `--a-time-w`, `--label-3`
- **Motion:** None of its own: the Upcoming view fades in on navigation — opacity 0→1 + blur 2px→0, 200ms --ease-out (T.fx.fadeIn, WAAPI); reduced motion: no fade. framer-motion: <motion.div initial={{opacity: 0, filter: "blur(2px)"}} animate={{opacity: 1, filter: "blur(0px)"}} transition={{duration: 0.2, ease: [0.23, 1, 0.32, 1]}}> on the page.
- **Accessibility:** section with an h2 (“Tomorrow”) and the long date as its description; rows follow the Timeline listbox pattern.

| Prop | Values | Default |
|---|---|---|
| `title` | string (Tomorrow \| weekday) | — |
| `subtitle` | string (long date) | — |
| `rows` | { event, dayIndex, withDay }[] | — |

Shown: Tomorrow · Thursday · Friday · Upcoming page · in context

### NewSeriesPopover

Create a series by describing it. As you type, Kit.parseSeries fills five chips (Title, Repeats, Day, Time, With); “or link a calendar event…” binds it to an untracked event instead. Create flies the new series into the sidebar and opens its living doc with the purpose focused.

- **Maps to:** Radix Popover (shadcn Popover) + shadcn Input + Radix DropdownMenu for the event picker · parser as a pure util · lucide Link, X, FileText, CornerDownLeft
- **Used in:** Toolbar New ⌥⌘N, Sidebar Series +, File menu › New Series…, Track on an unmatched event
- **Source:** `002 app-flows.js newMarkup · updateChips · previewFor · linkMenu · linkedMarkup · createSeries · wireNewSeries · .a-newpop`
- **States:** empty, typing · partial parse, typing · parsed, link menu open, linked, nothing to link, created
- **Tokens:** `--glass-strong`, `--shadow-float`, `--accent-soft`, `--accent-strong`, `--fill`, `--label-3`, `--separator`
- **Motion:** Open: opacity 0→1 150ms --ease-out + scale 0.96→1 190ms --ease-out from the trigger (transform-origin = --origin); close 110ms (CSS transitions via .open / .closing; interruptible). Typing: input debounced 90ms, then each chip whose value changed animates its value: opacity 0.2→1 + blur 2px→0, 180ms --ease-out (WAAPI). Link row: .collapsible grid-template-rows 0fr↔1fr 260ms --ease-out + opacity 200ms ease. Link menu: instant open, 120ms fade out. Create: the preview row flies to the new sidebar row (FlyChip in Overlays — Kit.flyTo 560ms — X on cubic-bezier(0.45, 0, 0.2, 1), Y + scale(≥0.4) + opacity→0.35 on cubic-bezier(0.6, 0, 0.9, 0.7); ghost = .fly-chip on glass), the row waits hidden (.landing, opacity 0) and lands with .receive (accent-soft wash 900ms --ease-out) + icon .bump (scale 1.18 at 40%, 420ms --ease-out) while .landing is removed (opacity 0→1, 150ms ease), then the living doc opens with the purpose focused. Reduced motion: no scale/blur/fly — the row just receives; chips swap instantly. framer-motion: PopoverContent as motion.div initial {opacity: 0, scale: 0.96} animate {opacity: 1, scale: 1} transition {opacity: {duration: 0.15}, scale: {duration: 0.19, ease: [0.23, 1, 0.32, 1]}} style {transformOrigin: "var(--radix-popover-content-transform-origin)"}; chip values <AnimatePresence mode="popLayout"> keyed by value; fly via a shared layoutId from the preview chip to the sidebar row.
- **Accessibility:** role="dialog" aria-label="New series"; the input autofocuses and Enter creates; chips are an aria-live="polite" summary (“Weekly, Thursday 11:00, with Priya”); Create is disabled until a title parses; Esc closes; the event picker is a menu (↑/↓, Enter).

| Prop | Values | Default |
|---|---|---|
| `text` | string (prefill, e.g. an event title) | "" |
| `link` | CalendarEvent \| null (prefilled link) | null |
| `onCreate` | (series) => void | — |

Shown: Empty · Typing · partial parse · Typing · parsed · Typing · replay · Link a calendar event… · Linked · Nothing to link · Created · Live · create a series

### SeriesPickerMenu

A titled menu of tracked series (colour swatch + name) used wherever something is assigned to a series: Add to series… on an event, Choose… on an unfiled item, and the new-series event picker (icons + shortcut-style hints).

- **Maps to:** Radix DropdownMenu (shadcn DropdownMenu) with DropdownMenuLabel + items; swatch = series dot
- **Used in:** EventCard · Add to series…, UnfiledCard · Choose…, NewSeriesPopover · link
- **Source:** `002 app-actions.js T.addToSeriesMenu · fileChoose · app-flows.js linkMenu · kit Kit.menu`
- **States:** rest, highlighted row, disabled row, with footer action
- **Tokens:** `--glass-strong`, `--shadow-float`, `--accent`, `--label-2`, `--label-3`, `--separator`
- **Motion:** Open: instant (no enter animation, like native macOS menus). Choose: the row blinks (highlight off, back on after 60ms), the menu closes at 130ms and fades out over 120ms ease (.closing, CSS transition). Picking a series morphs the card (see EventCard) and flies a .fly-chip to the series row (FlyChip in Overlays). Reduced motion: same (opacity only). framer-motion: none on open; DropdownMenuContent exit {opacity: 0, transition: {duration: 0.12}}.
- **Accessibility:** role="menu" with a menu-title label; items role="menuitem" (disabled ones aria-disabled); ↑/↓ move, Enter selects, Esc closes and returns focus to the trigger.

| Prop | Values | Default |
|---|---|---|
| `title` | string | — |
| `items` | { label, swatch \| icon, kbd?, disabled? }[] | — |
| `footer` | New series… item | optional |
| `minWidth` | number | 230 |

Shown: Add to series · File to · Link an event · Live · add a one-off to a series

### RecordingCapsule

Coral capsule in the agenda toolbar while anything records: pulsing dot, what is being recorded, the running timer and Stop. Appears next to the day title and disappears on Stop. It has no paused state in 002 — pausing lives in the Island, and the capsule keeps counting.

- **Maps to:** Custom toolbar capsule (motion.div) with shadcn Button (Stop) · lucide Square
- **Used in:** Agenda toolbar (Today, Upcoming, Review, Found)
- **Source:** `002 app-shell.js recCapsule · syncCapsule · .a-rec-capsule`
- **States:** live, hover Stop, pressed Stop, series recording, fallback label, truncated
- **Tokens:** `--coral-soft`, `--coral-ink`, `--coral`, `--font`
- **Motion:** Enter (recording starts): opacity 0→1 + scale 0.96→1 + blur 2px→0, 240ms --ease-out (WAAPI). Exit (Stop): opacity 1→0 + scale 1→0.96, 150ms ease-out, fill forwards, then removed (WAAPI; not interrupted — a new recording while exiting renders a fresh capsule). Dot: kit-rec 1.4s ease-in-out infinite (opacity 1→0.3→1). Timer ticks each second (tabular numerals, min-width 30px so the capsule never jitters). Stop hover: background coral→coral-ink 150ms ease. Reduced motion: appears and disappears instantly; dot pulses at 2.4s. framer-motion: <AnimatePresence>{recording && <motion.div initial={{opacity: 0, scale: 0.96, filter: "blur(2px)"}} animate={{opacity: 1, scale: 1, filter: "blur(0px)", transition: {duration: 0.24, ease: [0.23, 1, 0.32, 1]}}} exit={{opacity: 0, scale: 0.96, transition: {duration: 0.15, ease: "easeOut"}}}/>}.
- **Accessibility:** role="status" aria-label="Recording Product Sync, 12 minutes"; the timer text is aria-hidden (updated label every minute, not every second); Stop is a button (⌘R toggles too).

| Prop | Values | Default |
|---|---|---|
| `label` | event title \| series name \| "Recording" | Recording |
| `startedAt` | timestamp (timer) | — |
| `onStop` | () => void | — |

Shown: Live · Hover · Stop · Pressed · Stop · Series recording · Fallback label · Truncated · Enter / exit · In the full toolbar

### TodayView

In context: the agenda page as it ships — toolbar (DayHeader, RecordingCapsule, DayStepper, New, search), the proposals banner and the day’s timeline. The Before tile is live: step days, hide the banner, click cards to select.

- **Maps to:** Page composition (Next.js route) of the components above
- **Used in:** Main window · Today
- **Source:** `002 app-agenda.js dayMarkup · agendaMarkup · T.renderView · app-shell.js agendaToolbar`
- **States:** before, live, after
- **Tokens:** `--content-bg`, `--toolbar-h`
- **Motion:** Composes the motions above. Scrolling content under the toolbar toggles .scrolled (scrollTop > 2): background-color → color-mix(content-bg 76%) and the 0.5px hairline shadow fade in over 200ms ease (CSS transition); the blur(18px) backdrop switches on instantly. Reduced motion: unchanged (colour and shadow transitions are allowed). framer-motion: none — a CSS class toggled from a scroll listener (or useScroll + useMotionValueEvent).
- **Accessibility:** main landmark with the toolbar as a banner/toolbar role; the timeline is the primary listbox; the banner is a status region.

Shown: Before · 9:41 · live · Live · 10:12 · After · 10:46

## Pages

The sidebar’s other destinations: Review (meetings with items to accept, correct or reject, and recordings or files that need filing) and Found in Calendar (recurring patterns Telu noticed), plus search and the empty states. Rendered from 002’s T.pages functions.

### PageHeader

Large page title with one line of explanation, on pages that read like a document (Found in Calendar).

- **Maps to:** Plain component (h1.t-large + p)
- **Used in:** Found in Calendar
- **Source:** `002 app-pages.js pageHead · .pg-head`
- **States:** default, wrapped (narrow)
- **Tokens:** `--font-display`, `--label`, `--label-2`
- **Motion:** None of its own; the page fades in on navigation (opacity 0→1 + blur 2px→0, 200ms --ease-out, T.fx.fadeIn). Reduced motion: no fade. framer-motion: page-level motion.div fade.
- **Accessibility:** The page’s h1; the description is its aria-describedby.

| Prop | Values | Default |
|---|---|---|
| `title` | string | — |
| `description` | string | — |

Shown: Found in Calendar · Narrow

### DayGroupHeader

Inline section header aligned with the cards (past the time column): a bold title and a faint description that truncates. Heads each Upcoming day and the Review page’s two sections.

- **Maps to:** Plain component (h2 + span)
- **Used in:** Upcoming (days), Review (To review, Needs filing)
- **Source:** `002 app-pages.js daySection · reviewMarkup · .a-day-head`
- **States:** day, count, explanation, truncated
- **Tokens:** `--a-time-w`, `--label`, `--label-3`
- **Motion:** None. The To review count updates in place as items are decided (text swap, no animation). Reduced motion → n/a · framer-motion → none.
- **Accessibility:** h2 with the description as plain text; count changes announced through the Review toolbar status.

| Prop | Values | Default |
|---|---|---|
| `title` | string | — |
| `description` | string (count · explanation or long date) | — |

Shown: Upcoming day · To review · Needs filing · Truncated

### ReviewMeetingRow

A meeting with items still to review, as it appears on the Review page: an EventRow with the day label above the time and the amber “N to review” chip. Selecting it opens the side peek on the review; once everything is decided the row leaves the list.

- **Maps to:** EventRow (withDay) in a list; peek opens the review
- **Used in:** Review
- **Source:** `002 app-pages.js reviewItems · reviewMarkup · app-actions.js T.pagesAfterReview`
- **States:** pending, hover (Review revealed), selected, all reviewed (filed), leaving
- **Tokens:** `--amber`, `--amber-soft`, `--a-time-w`
- **Motion:** After the last pending item is accepted or rejected: a 500ms beat, then Kit.removeAnimated — height, padding and margin collapse to 0 with opacity 1→0, 220ms --ease-out (WAAPI, overflow hidden during the collapse); when no rows remain the page re-renders to “All caught up”. The “N to review” chip crossfades as the count drops (T.morphCard). Reduced motion: the row is removed instantly. framer-motion: <AnimatePresence> around rows with exit={{height: 0, opacity: 0, marginTop: 0, marginBottom: 0, transition: {duration: 0.22, ease: [0.23, 1, 0.32, 1], delay: 0.5}}}.
- **Accessibility:** Option in the Review listbox; the chip text (“3 to review”) is part of its accessible name; removal is announced by the toolbar count.

| Prop | Values | Default |
|---|---|---|
| `event` | CalendarEvent (kind review) | — |
| `pending` | number | — |
| `withDay` | true | true |

Shown: Pending · yesterday · Pending · today · Hover · Selected · All reviewed · Leaves the list · To review group

### UnfiledCard

A recording or file Telu couldn’t place with confidence. Shows what it is and when, Telu’s best guess (“Telu thinks this belongs in … — why”) with File there, and Choose… for any other series. Recordings can be played.

- **Maps to:** Custom card (shadcn Card) + Buttons · Choose… opens SeriesPickerMenu · lucide AudioWaveform, FileText, Play, ArrowDownToLine
- **Used in:** Review · Needs filing, Side peek (unfiled item)
- **Source:** `002 app-pages.js T.pages.unfiledCard · app-actions.js T.fileUnfiled · fileThere · fileChoose · .uf-card`
- **States:** recording + suggestion, document + suggestion, no confident match, hover, pressed, selected, hover File there, filed (leaving)
- **Tokens:** `--surface`, `--shadow-card`, `--shadow-card-hover`, `--accent-softer`, `--fill`, `--label-2`, `--accent`
- **Motion:** Hover: shadow → --shadow-card-hover 200ms ease; press scale(0.992) 160ms --ease-out (CSS). File there / Choose… → a .fly-chip (waveform or doc glyph + title) flies to the series row (FlyChip in Overlays: Kit.flyTo 560ms, the row then flashes and its icon bumps) while the card collapses: Kit.removeAnimated height/padding/margin → 0 + opacity → 0, 220ms --ease-out (WAAPI); the toast “Filed to …” offers Undo, which re-renders the list. When nothing is left to file the page re-renders. Reduced motion: removed instantly, no fly. framer-motion: <AnimatePresence> exit {height: 0, opacity: 0, transition: {duration: 0.22, ease: [0.23, 1, 0.32, 1]}} + FlyChip.
- **Accessibility:** article with the title as heading; the suggestion is text, not a tooltip; buttons “File there”, “Choose…” (opens a menu) and an icon button aria-label="Play"; selection ring mirrors aria-selected in the Review listbox.

| Prop | Values | Default |
|---|---|---|
| `item` | Unfiled { kind: recording \| doc, title, when, duration?, suggestion? { series, why } } | — |
| `selected` | boolean | false |
| `onFileThere / onChoose / onPlay` | () => void | — |

Shown: Recording · suggestion · Document · suggestion · No confident match · Hover · Pressed · Selected · Hover · File there · Filed · leaves the list · Needs filing group · File there · lands in the series

### ProposalCard

One pattern Telu noticed in the calendar, decided once: a new recurring meeting to track as a series, an event that looks like part of an existing series, or a quiet, less likely suggestion. Deciding removes the card for good.

- **Maps to:** Custom card (shadcn Card) + Buttons · lucide Sparkles, Link, Repeat · Avatar group
- **Used in:** Found in Calendar
- **Source:** `002 app-pages.js proposalCard · app-flows.js decideProposal · PROPOSAL_EFFECTS · .a-pcard`
- **States:** new series, join a series, quiet (less likely), hover primary, pressed primary, decided (leaving)
- **Tokens:** `--surface`, `--shadow-card`, `--accent-strong`, `--fill-2`, `--label-2`, `--label-3`, `--hairline`
- **Motion:** Decide (any button) → the card stops taking pointer events and collapses: Kit.removeAnimated height/padding/margin → 0 + opacity 1→0, 220ms --ease-out (WAAPI). Track as series also grows the new sidebar row (height 0→h + opacity 0→1, 280ms --ease-out, Kit.enterAnimated) and flies a .a-fly series pill into it; Add to … flies a link .fly-chip to the target series row (FlyChip in Overlays: 560ms, x on cubic-bezier(0.45, 0, 0.2, 1), y/scale/opacity on cubic-bezier(0.6, 0, 0.9, 0.7), then the row flashes .receive 900ms and its icon bumps 420ms). When the last card goes, “You’re all caught up” replaces the list and fades in (opacity 0→1 + blur 2px→0, 220ms --ease-out). Each decision shows a toast (Undo where reversible). Reduced motion: removed instantly, no fly, no fade. framer-motion: <AnimatePresence> with exit={{height: 0, opacity: 0, transition: {duration: 0.22, ease: [0.23, 1, 0.32, 1]}}}; empty state initial={{opacity: 0, filter: "blur(2px)"}} animate={{opacity: 1, filter: "blur(0px)"}}.
- **Accessibility:** article labelled by the title with the kind line as its description; primary action first in tab order; avatars have names as titles (use aria-label on the group, “+2 more”).

| Prop | Values | Default |
|---|---|---|
| `proposal` | Proposal { kind: new \| join, title, rule \| when, calendar, people, extra, reason, target?, quiet? } | — |
| `onTrack / onDismiss / onJoin / onSeparate` | () => void | — |

Shown: New recurring meeting · Part of a series · Quiet · less likely · Hover · Track as series · Pressed · Add to series · Decided · leaves the list · Decisions land in the sidebar

### CaughtUp

Inline empty state that replaces the proposal list once every suggestion is decided.

- **Maps to:** Empty state component (icon badge + title + text)
- **Used in:** Found in Calendar
- **Source:** `002 app-pages.js caughtUp · .a-caught`
- **States:** shown, fading in
- **Tokens:** `--accent-soft`, `--accent`, `--label`, `--label-2`
- **Motion:** Replaces the list after the last card collapses and fades in: opacity 0→1 + blur 2px→0, 220ms --ease-out (T.fx.fadeIn, WAAPI). Reduced motion: appears instantly. framer-motion: motion.div initial={{opacity: 0, filter: "blur(2px)"}} animate={{opacity: 1, filter: "blur(0px)"}} transition={{duration: 0.22, ease: [0.23, 1, 0.32, 1]}}.
- **Accessibility:** role="status" so reaching zero is announced; the badge icon is decorative.

| Prop | Values | Default |
|---|---|---|
| `title` | string | You’re all caught up |
| `text` | string | — |

Shown: Caught up · Fade in · In the page

### EmptyPage

Full-page empty states centred in the content area: a tinted icon badge, a title and one line of guidance, optionally with actions — Review with nothing left, Upcoming without a calendar, and the first-run welcome in the main window.

- **Maps to:** Empty state component (icon badge | app icon, h3, p, actions)
- **Used in:** Review, Upcoming, Today (first run)
- **Source:** `002 app-pages.js emptyPage · firstRunMarkup · .a-first · .a-empty-badge · .pg-welcome`
- **States:** all caught up, no calendar, welcome
- **Tokens:** `--accent-soft`, `--accent`, `--label`, `--label-2`, `--label-3`
- **Motion:** None of its own; arrives with the view fade (200ms). Reduced motion → no fade. framer-motion: page-level fade.
- **Accessibility:** Heading level 3 inside the page; the primary action (Set up Telu) receives focus when the window opens on first run.

| Prop | Values | Default |
|---|---|---|
| `icon` | lucide icon \| app icon | — |
| `title` | string | — |
| `text` | string | — |
| `actions` | Button[] | — |
| `note` | PrivacyNote | — |

Shown: Review · all caught up · Upcoming · no calendar · Welcome · first run · Welcome · hover Set up Telu · In context · first run

### PrivacyNote

The quiet “on this Mac” reassurance with a lock glyph, in three sizes: a centred page footnote, an inline caption under an action, and the onboarding panel’s footer line.

- **Maps to:** Small text component with lucide Lock
- **Used in:** Found in Calendar, Welcome, Onboarding welcome
- **Source:** `002 app-pages.js .pg-foot · .a-local · app-onboard.js .ob-privacy`
- **States:** default
- **Tokens:** `--label-3`
- **Motion:** None. Reduced motion → n/a · framer-motion → none.
- **Accessibility:** Plain text; the lock icon is aria-hidden.

| Prop | Values | Default |
|---|---|---|
| `variant` | footnote \| caption \| panel | footnote |
| `text` | string | — |

Shown: Footnote · Caption · Panel

### SearchPopover

Agenda search from the toolbar (⌘F): with no query it lists the first six series; typing matches series by name or person and memory items by text (five at most), grouped under Series and In memory. Enter or a click opens the series’ living doc.

- **Maps to:** cmdk (Command inside a Radix Popover) · CommandGroup “Series” / “In memory” · CommandEmpty · lucide Search
- **Used in:** Agenda toolbar search, Living doc toolbar, Edit › Find… ⌘F
- **Source:** `002 app-flows.js T.openSearch · searchResults · seriesHit · memoryHit · .a-search`
- **States:** hint (no query), series + memory hits, memory only, no matches, nothing to search, row hover, input focus
- **Tokens:** `--glass-strong`, `--shadow-float`, `--fill`, `--label-3`, `--accent (focus ring)`, `ktype colours`
- **Motion:** Open: opacity 0→1 150ms --ease-out + scale 0.96→1 190ms --ease-out from the trigger; close 110ms (CSS transitions). Results re-render on every keystroke with no animation; row hover background snaps (fine pointers). Reduced motion: opacity only. framer-motion: PopoverContent motion.div initial {opacity: 0, scale: 0.96} animate {opacity: 1, scale: 1}; cmdk list without item animation.
- **Accessibility:** cmdk gives role="combobox" + listbox semantics: ↑/↓ move, Enter opens, Esc closes; the input is labelled “Search series, people, decisions”; group headings are cmdk group labels; the empty text is CommandEmpty (announced).

| Prop | Values | Default |
|---|---|---|
| `query` | string | "" |
| `series` | Series[] (tracked) | — |
| `onOpen` | (seriesId) => void | — |

Shown: Hint · no query · Series + memory · Memory only · No matches · Nothing to search · Row hover · Live · search

### ReviewPage

In context: the Review destination — meetings with items to review (with their day), then Needs filing. The toolbar title counts everything that needs a look.

- **Maps to:** Page composition (Next.js route): DayGroupHeader + ReviewMeetingRow list + UnfiledCard list
- **Used in:** Sidebar · Review
- **Source:** `002 app-pages.js reviewMarkup · app-shell.js titleFor`
- **States:** before (5 items), after (10 items), all caught up
- **Tokens:** `--content-bg`
- **Motion:** Page fades in on navigation (200ms, T.fx.fadeIn); rows and cards leave with Kit.removeAnimated (220ms; rows after a 500ms beat); the page re-renders to All caught up when empty. Reduced motion: instant.
- **Accessibility:** main landmark; two sections with h2; the toolbar subtitle is a polite live region for the count.

Shown: Before · 9:41 · After · 10:46 · All caught up

### FoundPage

In context: Found in Calendar — the page header, loud proposals, a “Less likely” group and the privacy footnote. Live: decide any card to watch it collapse, then the caught-up state fade in; Replay restores the page.

- **Maps to:** Page composition (Next.js route): PageHeader + ProposalCard list + PrivacyNote
- **Used in:** Sidebar · Found in Calendar, ProposalsBanner · Review
- **Source:** `002 app-pages.js foundMarkup · app-flows.js decideProposal`
- **States:** 3 suggestions, deciding, caught up
- **Tokens:** `--content-bg`
- **Motion:** See ProposalCard and CaughtUp: collapse 220ms --ease-out, then caught-up fade 220ms; toolbar count text swaps instantly. Reduced motion: instant.
- **Accessibility:** main landmark with h1; “Less likely” is a group label (t-eyebrow) for the quiet suggestions.

Shown: Live · decide suggestions · Caught up

## Onboarding

The first-run panel that floats over the desktop while the main window stays hidden: welcome, calendar permission, choosing which recurring conversations to remember (or typing them when access is denied), the ⌥ Space summon hint — and the app icon flying into the menu bar at the end.

### OnboardingPanel

Glass panel (420 × 530) centred below the menu bar on first run. Three steps with a dot indicator and a footer of actions: Welcome → Connect Calendar (permission) → choose what to remember → Summon. If access is denied, step 1 becomes “type your recurring conversations” with a live natural-language parse.

- **Maps to:** Separate transparent always-on-top Tauri window (NSPanel) hosting a React stepper; framer-motion AnimatePresence for steps; Radix Switch rows; shadcn Input + Button; the permission prompt is the native EventKit dialog (Alert in Overlays shows the prototype version)
- **Used in:** First run (window hidden), Welcome · Set up Telu, ⌥ Space before setup
- **Source:** `002 app-onboard.js welcomeStep · deniedStep · detectedStep · manualStep · summonStep · actionsFor · go · leave · open · close · finish · .onboard`
- **States:** welcome, permission prompt, detected (switches), denied, manual · empty, manual · typing, manual · added, summon, opening, closing, finishing (fly to menu bar)
- **Tokens:** `--glass-strong`, `--shadow-window`, `--accent`, `--accent-soft`, `--accent-strong`, `--coral`, `--coral-soft`, `--amber`, `--fill-2`, `--fill-3`, `--menubar`, `--hairline`, `--label-2`, `--label-3`
- **Motion:** Open (first run or ⌥ Space before setup): opacity 0→1 + scale 0.96→1, 260ms --ease-out (WAAPI). Close (Not now / Esc): opacity 1→0 + scale 1→0.97, 160ms --ease-out, fill forwards, then hidden. Step change: both steps are stacked absolutely; the leaving step fades opacity 1→0 + translateX(0→−24px·dir) 150ms --ease-out (fill forwards, then removed); the entering step fades opacity 0→1 + translateX(+24px·dir→0) 220ms --ease-out with a 40ms delay (fill backwards). Denying access re-enters step 0 with dir 0 — no slide, just the 150ms fade-out over the 220ms fade-in. Dots: background-color 200ms ease (CSS). Switches: thumb translateX(14px) on --spring-bounce (600ms linear() spring, ~4% overshoot), track colour 200ms ease. Added row flashes .receive (accent-soft → transparent, 900ms --ease-out). Done: the panel shrinks opacity 1→0 + scale 1→0.92, 280ms --ease-out, while the app icon flies into the menu-bar item (FlyIcon, 620ms); the item then receives + bumps. All WAAPI except dots/switch/receive (CSS). Reduced motion: no scale or slide — steps swap instantly, the panel hides instantly, no fly (the item still receives). framer-motion: <AnimatePresence> panel initial={{opacity: 0, scale: 0.96}} animate={{opacity: 1, scale: 1, transition: {duration: 0.26, ease: [0.23, 1, 0.32, 1]}}} exit={{opacity: 0, scale: 0.97, transition: {duration: 0.16, ease: [0.23, 1, 0.32, 1]}}}; steps <AnimatePresence mode="popLayout" custom={dir}> variants enter {opacity: 0, x: 24 * dir} → center {opacity: 1, x: 0, transition: {duration: 0.22, delay: 0.04, ease: [0.23, 1, 0.32, 1]}} → exit {opacity: 0, x: -24 * dir, transition: {duration: 0.15, ease: [0.23, 1, 0.32, 1]}}; Radix Switch thumb transition={{type: "spring", duration: 0.6, bounce: 0.25}}.
- **Accessibility:** role="dialog" aria-label="Set up Telu", focus moved into the panel on open and trapped; Esc = Not now; steps announced via aria-live on the title; dots are decorative (expose “Step 2 of 3”); switches are role="switch" with aria-label “Remember <series>” (the ignored row is disabled); the manual input focuses on entry and Enter adds.

| Prop | Values | Default |
|---|---|---|
| `step` | 0 \| 1 \| 2 | 0 |
| `calendar` | unknown \| allowed \| denied | unknown |
| `picks` | boolean[] per detected series | detected defaults |
| `manual` | ParsedSeries[] | [] |
| `onComplete` | ({ picks, manual }) => void | — |
| `onLater` | () => void | — |

Shown: Welcome · Calendar permission · Detected · Denied · Manual · empty · Manual · typing · Manual · added · Summon · Step slide · Denied · crossfade in place · Live · the whole first run

### StepDots

Three 6px dots in the panel footer: the current step in accent, completed steps at 45% accent, the rest neutral.

- **Maps to:** Plain component (3 spans) — or a Radix-free progress indicator
- **Used in:** OnboardingPanel footer
- **Source:** `002 app-onboard.js renderFoot · .ob-dots`
- **States:** step 1, step 2 (1 done), step 3 (2 done)
- **Tokens:** `--accent`, `--fill-3`
- **Motion:** Trigger: step change → each dot’s background-color transitions 200ms ease (CSS transition on .on / .done). Reduced motion: same (colour transitions allowed). framer-motion: animate={{backgroundColor}} transition={{duration: 0.2, ease: "easeOut"}} — or plain CSS.
- **Accessibility:** aria-hidden; pair with visually hidden “Step 2 of 3”.

| Prop | Values | Default |
|---|---|---|
| `step` | 0 \| 1 \| 2 | 0 |
| `count` | number | 3 |

Shown: Step 1 · Step 2 · Step 3 · Advance

### OnboardingMoment

One row of the welcome step’s “before · during · after” promise: a tinted 32px icon tile and a two-line label. The During tile is coral (recording).

- **Maps to:** Plain component (icon tile + title + text) · lucide CalendarCheck, Circle, ArrowDownToLine
- **Used in:** OnboardingPanel · Welcome
- **Source:** `002 app-onboard.js MOMENTS · welcomeStep · .ob-moment`
- **States:** accent, coral
- **Tokens:** `--accent-soft`, `--accent-strong`, `--coral-soft`, `--coral`, `--label-2`
- **Motion:** None (arrives with the step slide). Reduced motion → n/a · framer-motion → none.
- **Accessibility:** List of three items (ul/li); icons decorative.

| Prop | Values | Default |
|---|---|---|
| `icon` | calendar-check \| record \| tray-down | — |
| `tone` | accent \| coral | accent |
| `title` | string | — |
| `text` | string | — |

Shown: Before · during · after · Before · During · After

### DetectedRow

One recurring event Telu found in the calendar: the series icon (or a grey repeat icon if it isn’t a series yet), name, rule and how many were found, with a switch to remember it. Personal-calendar events show as ignored with a disabled switch.

- **Maps to:** Row with Radix Switch (shadcn Switch) · series icon
- **Used in:** OnboardingPanel · Detected
- **Source:** `002 app-onboard.js detectedRow · onToggle · .ob-row`
- **States:** on, off, ignored (disabled), truncated
- **Tokens:** `--accent`, `--fill-3`, `--series-gray`, `--label-2`
- **Motion:** Switch: thumb translateX(0↔14px) on --spring-bounce (600ms linear() spring with ~4% overshoot), track background 200ms ease (CSS transitions, interruptible). The footer’s “Remember N” updates instantly. Reduced motion: thumb moves without the spring (transform transition removed), colour still fades. framer-motion: Radix Switch thumb as motion.span layout transition={{type: "spring", duration: 0.6, bounce: 0.25}}.
- **Accessibility:** role="switch" aria-checked with aria-label “Remember Product Sync”; the ignored row’s switch is disabled and its note explains why (“Personal calendar · ignored”).

| Prop | Values | Default |
|---|---|---|
| `detected` | { series? \| title + rule, found, note?, ignored? } | — |
| `checked` | boolean | detected.on |
| `onCheckedChange` | (on) => void | — |

Shown: On · Off · Ignored · List

### FlyIcon

At the end of onboarding the app icon lifts off the Summon step and flies into the Telu item in the menu bar, which then flashes and bumps — “this is where Telu lives now”.

- **Maps to:** In production the panel is its own window: animate the panel window out and bump the tray item (Tauri tray title change); a transparent overlay window can carry the ghost if the flight is kept
- **Used in:** OnboardingPanel · Done
- **Source:** `002 app-onboard.js finish · kit Kit.flyTo · .fly-icon · .menubar .telu-status`
- **States:** resting (in the panel), in flight, landed (item receives + bumps)
- **Tokens:** `--glass-strong`, `--shadow-float`, `--accent-soft`, `--menubar`
- **Motion:** Trigger: Done. Ghost = the 60px app icon on glass (radius 10px, --shadow-float), fixed-position. X: translateX(0→dx) 620ms cubic-bezier(0.45, 0, 0.2, 1); Y + scale + opacity on an inner layer: translateY(0→dy) scale(1→0.4 — clamped from the 22px item ÷ 60px icon) opacity 1→0.35, 620ms cubic-bezier(0.6, 0, 0.9, 0.7) — the two easings trace an arc up and right (WAAPI, fill forwards; ghost removed on finish). Concurrently the panel fades out opacity 1→0 + scale 1→0.92, 280ms --ease-out. On landing the status item gets .receive (background accent-soft → transparent, 900ms --ease-out) and its template image .bump (scale 1→1.18→1, 420ms --ease-out). Reduced motion: no ghost — the item receives (bump suppressed). framer-motion: portal motion.div animate={{x: dx}} transition={{duration: 0.62, ease: [0.45, 0, 0.2, 1]}} > motion.div animate={{y: dy, scale: 0.4, opacity: 0.35}} transition={{duration: 0.62, ease: [0.6, 0, 0.9, 0.7]}}.
- **Accessibility:** Decorative (aria-hidden); announce “Telu is in your menu bar — press Option Space anytime” when onboarding completes.

| Prop | Values | Default |
|---|---|---|
| `from` | the Summon step icon | — |
| `to` | menu-bar status item | — |
| `duration` | ms | 620 |

Shown: Ghost · Target · Live · fly into the menu bar

## Side peek

Clicking a meeting in the agenda opens a Notion-style side peek. It renders the meeting with the living doc’s own blocks (Next, Summary, Review), plus peek-only states for untracked, proposed and unfiled items. “Open as page” jumps into the full doc at that meeting.

### PeekPanel

The right-hand panel that slides over the agenda. 44% of the main area (min 440px), under the toolbar, with a rounded top-left corner, a hairline edge and a soft left shadow. The agenda column pads itself so no card hides behind it.

- **Maps to:** Custom panel (not modal) — framer-motion slide; content switches with AnimatePresence
- **Used in:** Today, Upcoming, Review, Found in Calendar
- **Source:** `002 app-peek.js T.peek (show / close / render) · app.css .peek, .peek.open, .peek.instant, .pk-scroll, .pk-content`
- **States:** closed, open, opening, closing, instant, content crossfade, scrolled
- **Tokens:** `--peek-w`, `--content-bg`, `--separator`, `--toolbar-h`, `--ease-drawer`, `--ease-out`
- **Motion:** Open (pointer): .peek transform translateX(calc(100% + 48px)) → none, 300ms var(--ease-drawer) cubic-bezier(0.32,0.72,0,1); visibility switches at 0ms. Close: → translateX(calc(100% + 48px)) 200ms var(--ease-out), visibility hidden after 200ms. CSS transition (interruptible mid-flight); .instant removes the transition for keyboard/programmatic opens. Content swap while open: T.fx.crossfade WAAPI — out 110ms ease-out (opacity 1→0, blur 0→2px, fill forwards), swap innerHTML, in 190ms var(--ease-out) (opacity 0→1, blur 2→0); scroll resets to top. Scrolled bar: background + hairline 200ms ease once scrollTop > 2. Agenda padding-right switches instantly. Reduced motion: slide and crossfade become instant swaps. framer-motion: <AnimatePresence><motion.aside initial={{ x: "calc(100% + 48px)" }} animate={{ x: 0, transition: { duration: 0.3, ease: [0.32, 0.72, 0, 1] } }} exit={{ x: "calc(100% + 48px)", transition: { duration: 0.2, ease: [0.23, 1, 0.32, 1] } }} /> and an inner <AnimatePresence mode="wait"> keyed by target with opacity/filter keyframes.
- **Accessibility:** <aside aria-label="Side peek"> (complementary, not modal — focus stays in the agenda). Esc closes it (after blurring any field); ↑/↓ keep moving the agenda selection while it is open and swap content without animation; Enter re-opens the selected card. Close button has a tooltip “Close · esc”.

| Prop | Values | Default |
|---|---|---|
| `open` | boolean | false |
| `target` | { kind: event \| meeting \| unfiled, id } | — |
| `instant` | boolean — skip the slide (keyboard, scenario restore) | false |
| `width` | max(440px, 44% of main) | — |
| `onClose` | () => void (✕, Esc) | — |
| `onOpenPage` | () => void (“Open as page”) | — |

Shown: Open over the agenda

### PeekHeader

Sticky bar with the series link, “Open as page” and close, then the meeting title, number, date · time · place and attendee avatars. Untracked items show their calendar; unfiled items show “Needs filing”.

- **Maps to:** Custom header · series link = Button (link variant) · close = Button icon + Radix Tooltip
- **Used in:** PeekPanel
- **Source:** `002 app-peek.js headerMarkup · app.css .pk-bar, .pk-series, .pk-open, .pk-head, .pk-title, .pk-n, .pk-meta`
- **States:** rest, series link hover, series link pressed, Open as page hover, close hover, scrolled (glass bar), untracked (calendar), needs filing, long title truncation
- **Tokens:** `--accent`, `--accent-softer`, `--label-2`, `--label-3`, `--content-bg`, `--separator`, `--font-display`
- **Motion:** Series link press: transform scale(0.97) 140ms var(--ease-out); hover background var(--accent-softer) 150ms ease (fine pointers only). Bar background (82% content-bg + blur 18px) and bottom hairline fade in 200ms ease when the body scrolls past 2px — CSS transition, interruptible. Reduced motion: unchanged (color-only). framer-motion: none needed; use a scroll listener toggling a data attribute.
- **Accessibility:** Title is an <h2>; series link is a <button> naming the series (opens the doc); “Open as page” and ✕ are buttons (✕ has aria-label via tooltip text “Close · esc”). Avatars carry title attributes with full names.

| Prop | Values | Default |
|---|---|---|
| `series` | Series \| null — tracked series link | — |
| `source` | series \| calendar \| needs-filing | series |
| `title` | string (meeting title → event title → series name) | — |
| `number` | number \| null (#37) | — |
| `meta` | [day, time, place] or [when, duration] | — |
| `people` | string[] (max 4 avatars, +N) | [] |
| `canOpenPage` | boolean (tracked and not unfiled) | true |
| `scrolled` | boolean | false |

Shown: Tracked meeting · Hover · Scrolled · Untracked · calendar source · Needs filing · Long title

### PeekBody

The peek’s body for every kind of meeting. Tracked meetings reuse the living doc blocks with surface="peek" (compact container layout ≤ 600px); untracked, proposed and unfiled items get peek-only cards with their next action.

- **Maps to:** Router component over NextBlock · PastSummary (MeetingBody surface="peek") · TrackingNote · UntrackedEmpty · ProposalMatchCard · FilingCard
- **Used in:** PeekPanel
- **Source:** `002 app-peek.js BODY (next → T.doc.nextMarkup(s, m, { surface: "peek" }), past → T.doc.peekPastMarkup, trackingBody, untrackedBody, proposalBody, unfiledBody) · doc-past.js peekPastMarkup · app-record.js T.oneOffLiveMarkup`
- **States:** upcoming · brief ready, upcoming · not prepared yet, preparing brief, starting now, live recording, preparing summary, needs review, past · filed, past · transcript open, cancelled, just tracked, untracked recurring, records once, untracked · already happened, one-off, one-off · recording, likely match (proposal), unfiled recording, unfiled file, filed
- **Tokens:** `--accent-softer`, `--coral`, `--amber`, `--mint`, `--surface-sunken`, `--shadow-card`, `--r-card`
- **Motion:** Inline transcript (past): .collapsible grid-template-rows 0fr ↔ 1fr 260ms var(--ease-out) + opacity 200ms ease (CSS transition, interruptible); the button label swaps “Open transcript” ↔ “Hide transcript”; opening on evidence highlights the line (.tl background 300ms ease) and smooth-scrolls it to the centre after 280ms. Next block repaint (preparing → ready, live → preparing summary): WAAPI out 120ms ease-out (opacity→0, blur 2px) then in 200ms var(--ease-out) (opacity 0→1, translateY 4px→0). Recording: .rec-dot opacity pulse 1.4s ease-in-out infinite, .wave bars scaleY 0.3↔1 900ms ease-in-out infinite (staggered delays), timer ticks each second. Shimmer 1.3s linear infinite, spinner 700ms linear. Reduced motion: shimmer and wave stop, rec-dot slows to 2.4s, collapsible and repaint swap instantly. framer-motion: Collapsible → motion.div animate={{ height: open ? "auto" : 0, opacity }}; repaint → AnimatePresence mode="wait" with y: 4.
- **Accessibility:** Everything is buttons: Record/Stop (⌘R), Skip, Join, Accept/Correct/Reject, Track this series, Record once / Don’t record, Add to series…, File there, Choose…, Play. Status text (“Starting now”, “Recording”, “Preparing summary…”) should be announced via aria-live="polite" on the block. Transcript lines are a list with <time> elements.

| Prop | Values | Default |
|---|---|---|
| `view` | next \| past \| tracking \| untracked \| proposal \| unfiled | — |
| `series / meeting` | Series, Meeting | — |
| `kind` | ready \| preparing \| recording \| summarizing \| review \| filed \| recurring \| oneoff \| proposal \| unfiled | — |
| `recordOnce` | boolean (untracked events) | false |
| `past` | boolean (event already ended → no Record once) | false |

Shown: Upcoming · brief ready · Starting now · Live recording · Preparing summary · Needs review · Past · filed · Past · transcript open on evidence · Cancelled · Not prepared yet · Preparing brief · Just tracked · Untracked recurring · Untracked · records once · Untracked · already happened · One-off · One-off · recording · Likely match (proposal) · Unfiled recording · Unfiled file · Filed

## Living doc

Every series has one Notion-style living document: header, Purpose, Memory, the Next meeting and every past meeting. The same blocks render in the side peek with surface="peek"; below 600px of container width they switch to a compact layout.

### DocHeader

Large editable title with the series icon, then meta chips: cadence link (opens the calendar-link popover), people (opens the attendee list), meeting count and a private lock. New docs show the Repeats control instead of chips.

- **Maps to:** Custom header · title = BlockNote heading or contentEditable · chips = Button (chip) + Radix Popover
- **Used in:** Living doc page
- **Source:** `002 doc-render.js D.headerMarkup / D.metaMarkup (ruleChip, peopleChip, countChip, privateChip) · doc-popovers.js D.rulePopover, D.peoplePopover, changeMenu · doc.css .doc-head, .doc-title, .doc-meta, .meta-chip, .tb-title`
- **States:** calendar series, private, grouped by you, just tracked (new), untitled draft, title focus, chip hover, chip pressed, calendar-link popover, people popover, follow a different event, title collapsed into toolbar
- **Tokens:** `--font-display`, `--accent-softer`, `--fill`, `--fill-2`, `--label-2`, `--series-*`
- **Motion:** Title focus: background-color 150ms ease → var(--accent-softer). Chips: background/color 150ms ease on hover (fine pointers), :active scale(0.97) 140ms var(--ease-out); CSS transitions. Popovers: Kit.popover scale 0.96→1 190ms var(--ease-out) + opacity 150ms from the trigger (transform-origin = trigger centre); menus appear instantly, fade out 120ms. Large-title collapse: when #docTitle scrolls under the 52px toolbar (IntersectionObserver, rootMargin −toolbar-h) the toolbar title .tb-title goes opacity 0→1 and translateY(4px)→0 in 180ms var(--ease-out); reverse on the way back; CSS transition, interruptible. Reduced motion: transforms dropped, opacity only. framer-motion: <motion.div animate={{ opacity: show ? 1 : 0, y: show ? 0 : 4 }} transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }} /> driven by useInView on the title.
- **Accessibility:** Title is an <h1> with contenteditable, spellcheck off, placeholder via data-placeholder (“Name this conversation”); Enter commits, Esc blurs. Chips are buttons that open popovers (aria-haspopup="dialog"); static chips are spans. Private chip carries a tooltip. Popovers are dialogs closed by Esc or outside click.

| Prop | Values | Default |
|---|---|---|
| `series` | Series | — |
| `source` | calendar \| manual | calendar |
| `private` | boolean — lock chip | false |
| `count / since` | number, string — or “New · first meeting …” | — |
| `draft` | boolean — Repeats control instead of chips | false |
| `onRename` | (name) => void (Enter commits; drafts parse cadence and people) | — |

Shown: Calendar series · Private 1:1 · Grouped by you · Just tracked · Untitled draft · Title editing · Chip hover · Chip pressed · Calendar link popover · Grouped-by-you popover · People popover · Follow a different event · Title collapsed into the toolbar

### PurposeBlock

The series’ purpose: Why we meet, What good looks like, Standing agenda (with minutes and total), Not for this meeting, then the Reference row. Every field is inline-editable; Telu builds every brief from it.

- **Maps to:** BlockNote custom blocks (purpose-why, outcomes list, agenda table, not-for) with autosave
- **Used in:** Living doc page
- **Source:** `002 doc-render.js D.purposeMarkup / purposeHead / D.purposeVersion / D.purposeAgendaRow · doc-edit.js markEdited, scheduleSave, purposeAgendaKey, dropDraftedChip · doc.css .purpose, .p-block, .editable, .ver-bump, .drafted, .drop-hint`
- **States:** read, field hover, editing (focus), version bump, saving… / saved, drafted by Telu, empty (placeholders), drop target
- **Tokens:** `--accent-softer`, `--accent`, `--fill`, `--label-2`, `--label-3`, `--separator`, `--shadow-float`
- **Motion:** Editable fields: background-color + box-shadow 150ms ease (hover fill, focus accent-softer + 1px inner ring). First keystroke: version meta text swaps to “v4 · just now” and plays .ver-bump — keyframes 420ms var(--ease-out) from opacity 0, translateY(3px) (one-shot; restart by re-adding the class); the drafted chip leaves via WAAPI opacity 1→0 + scale(0.96) in 160ms ease-out, then is removed. Save indicator: “Saving…” immediately (color label-2, 150ms ease), “Saved” 700ms after the last keystroke (debounced); the first save also toasts. Standing agenda: Enter inserts a row with Kit.enterAnimated (WAAPI height 0→auto + opacity, 280ms var(--ease-out)); Backspace on an empty row removes it instantly. File drag over the block: dashed accent outline (::after) opacity 150ms ease and the “Drop to add to Reference” pill opacity 150ms + translateY(4px) scale(0.97)→none 200ms var(--ease-out). Reduced motion: ver-bump and enter height skipped, drafted chip removed instantly. framer-motion: key the version label and use initial={{ opacity: 0, y: 3 }}; AnimatePresence for the drafted chip (exit scale 0.96); layout animation for agenda rows.
- **Accessibility:** Each field is contenteditable with a visible label (“Why we meet” …) — expose aria-label and aria-multiline where relevant; Enter blurs single-line fields, Esc blurs any field. History is a button (opens a dialog). Save state should be an aria-live="polite" region in the toolbar.

| Prop | Values | Default |
|---|---|---|
| `purpose` | { why, outcomes[], agenda[{ t, d }], notFor, version, edited, drafted, history[] } | — |
| `edited` | boolean — shows v(n+1) · just now | false |
| `dropTarget` | boolean — files dragged over the block | false |
| `onChange` | (purpose) => void — autosave after 700ms | — |

Shown: Read · Field hover · Editing · Version bump · Drafted by Telu · Empty · Drop target · Autosave state

### HistoryPopover

Two history popovers. Purpose history lists versions (current one tagged). Doc history (toolbar clock) lists recent activity: filed meetings and purpose edits.

- **Maps to:** Radix Popover (align end)
- **Used in:** PurposeBlock · History, Doc toolbar · History
- **Source:** `002 doc-popovers.js D.purposeHistoryPopover (histRow) · D.docHistoryPopover (activity) · doc.css .hist-row, .act-row, .pop-title, .pop-foot`
- **States:** versions, after an edit (v4 · Just now), activity, empty
- **Tokens:** `--glass-strong`, `--shadow-float`, `--accent-strong`, `--separator`, `--label-3`
- **Motion:** Kit.popover: opacity 0→1 150ms var(--ease-out) + scale 0.96→1 190ms var(--ease-out) from the trigger; close 110ms (both). CSS transitions on .popover.open / .closing. Reduced motion: opacity only. framer-motion: Radix Popover.Content with motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} style={{ transformOrigin: "var(--radix-popover-content-transform-origin)" }}.
- **Accessibility:** role="dialog" popover; Esc and outside click close; rows are static text (not focusable); the current version is marked with a “Current” chip (add aria-current).

| Prop | Values | Default |
|---|---|---|
| `kind` | purpose \| doc | purpose |
| `rows` | { v, date, note, current }[] \| { when, note, icon }[] | — |
| `width` | 310 (purpose) · 330 (doc) | — |

Shown: Purpose history · After an edit · Doc history · Doc history · empty

### ReferenceRow

Reference files of the series. Each chip has an include dot (accent = included in every brief, ring = left out). Clicking a chip opens its popover; + Add opens recent files.

- **Maps to:** Chip list · Radix Popover (file) with Switch · Radix DropdownMenu (Add)
- **Used in:** PurposeBlock
- **Source:** `002 doc-render.js D.referenceInner (refChip) · doc-popovers.js D.refPopover, D.addRefMenu, setInclude, removeRef · doc-edit.js D.attachToPurpose (chip-in) · doc.css .ref-row, .inc-dot, .add-chip, .chip-in`
- **States:** included, left out, chip hover, chip pressed, new chip (chip-in), empty, file popover · included, file popover · left out, add menu
- **Tokens:** `--accent`, `--fill`, `--fill-2`, `--label-3`, `--separator`
- **Motion:** Chips: :active scale(0.97) 140ms var(--ease-out); background 150ms ease on hover. Include dot: background-color + box-shadow 150ms ease (filled ↔ 1.3px ring). New chips: .chip-in keyframes 280ms var(--ease-out) both, from opacity 0 + translateY(3px) scale(0.95), staggered 40ms via animation-delay. Remove: WAAPI opacity→0 + scale(0.95) 150ms ease-out, then removed; Undo re-renders the row. Reduced motion: chip-in and remove are instant. framer-motion: AnimatePresence + motion.button initial={{ opacity: 0, y: 3, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} with staggerChildren 0.04.
- **Accessibility:** Chips are buttons (open a dialog); the include dot is a nested toggle — in React make it a separate button with aria-pressed and a tooltip (“Included in every brief”). The popover switch is a Radix Switch labelled “Include in every brief”.

| Prop | Values | Default |
|---|---|---|
| `docs` | { name, ver, size, added, include }[] | [] |
| `onToggleInclude` | (name, include) => void | — |
| `onAdd` | (files) => void | — |
| `onRemove` | (name) => void (Undo toast) | — |

Shown: Row · Chip hover · Chip pressed · New chip · Empty · File popover · included · File popover · left out · Add menu

### MemoryGrid

Memory holds only what you accepted: a two-column grid of Decisions, Open commitments, Open questions and Facts. It feeds every brief.

- **Maps to:** CSS grid of MemoryGroup
- **Used in:** Living doc page
- **Source:** `002 doc-render.js D.memoryMarkup / D.memoryBody · doc-page.js D.paintPageMemory · doc.css .mem-grid, .mem-none`
- **States:** filled, after review (new, resolved, replaced), empty
- **Tokens:** `--surface-sunken`, `--r-card`, `--label-2`, `--label-3`
- **Motion:** After Accept, the grid re-renders instantly and each new or resolved item flashes .receive for 1500ms (kit-receive: accent-soft held to 30%, then fades, var(--ease-out)); the Memory tick in the scrubber plays tick-receive. Reduced motion: flash kept (background only). framer-motion: animate={{ backgroundColor: [soft, soft, "transparent"] }} times [0, 0.3, 1].
- **Accessibility:** Section with an eyebrow heading “Memory”; groups are lists; the caption “Only items you accepted” explains provenance.

| Prop | Values | Default |
|---|---|---|
| `memory` | MemoryItem[] | [] |
| `fresh` | string[] — keys to flash after review | [] |

Shown: Filled · After review · Empty

### MemoryGroup

One knowledge type: colored icon, label and open count, then its items (done items sink to the bottom).

- **Maps to:** Card with list
- **Used in:** MemoryGrid
- **Source:** `002 doc-render.js memGroup · doc.css .mem-group[data-type], .mem-group-head, .mem-empty`
- **States:** decisions, open commitments, open questions, facts, empty
- **Tokens:** `--accent (decision)`, `--series-orange (commitment)`, `--amber (question)`, `--series-teal (fact)`, `--surface-sunken`
- **Motion:** None of its own; items flash on receive.
- **Accessibility:** Heading per group; count is decorative text (announce as “2 open”).

| Prop | Values | Default |
|---|---|---|
| `type` | decision \| commitment \| question \| fact | — |
| `items` | MemoryItem[] | [] |
| `count` | open items (hidden when 0) | — |

Shown: Decisions · Open commitments · Open questions · Facts · Empty group

### MemoryItem

One remembered item: text, status dot, owner, due date and the source chip that opens its evidence. Superseded decisions keep a struck-through “replaced ·” line.

- **Maps to:** List item
- **Used in:** MemoryGroup
- **Source:** `002 doc-render.js memItem / memStatus · kit Kit.status, Kit.source · doc.css .mem-item, .mem-meta, .mem-replaced, .mem-item.receive`
- **States:** current, with replaced line, open with owner and due, done, unresolved, resolved today, fact from a doc, received (flash)
- **Tokens:** `--series-green`, `--accent`, `--amber`, `--label-4`, `--label-2`, `--accent-soft`
- **Motion:** Trigger: the item lands in Memory after Accept (or Accept all) → .mem-item.receive plays kit-receive keyframes for 1500ms (longer than the 900ms default): background accent-soft held to 30%, then fades to transparent, var(--ease-out); one-shot, restarted by re-adding the class. Source chip: background/color 150ms ease on hover, :active scale(0.96) 140ms var(--ease-out) (CSS transitions). Reduced motion: unchanged (background only). framer-motion: animate={{ backgroundColor: [softAccent, softAccent, "rgba(0,0,0,0)"] }} transition={{ duration: 1.5, times: [0, 0.3, 1], ease: [0.23, 1, 0.32, 1] }}.
- **Accessibility:** Status is text next to a colored dot (never color alone). Source chip is a button: “Evidence, Sep 22 at 18:42”.

| Prop | Values | Default |
|---|---|---|
| `type` | decision \| commitment \| question \| fact | — |
| `status` | current \| open \| completed \| unresolved \| superseded | — |
| `owner / due` | string | — |
| `src` | string — “Sep 22 · 18:42” or “Doc.docx · p.2” | — |
| `replaced` | string — superseded text · date | — |
| `resolvedToday` | boolean | false |

Shown: Current decision · Replaced · Open · owner and due · Done · Unresolved question · Resolved today · Fact from a doc · Received

### NextBlock

The next meeting’s brief: header (Next · when · where, countdown, Skip / Join / Record ⌘R), provenance, Since last time, Worth asking, agenda and docs. The same block becomes the live recording strip, “Preparing summary…”, a “prepares tonight” preview or an idle Record prompt.

- **Maps to:** Card block composed of CarryRow, WorthAsking, AgendaChecklist, MeetingDocs, LiveStrip
- **Used in:** Living doc page, PeekBody
- **Source:** `002 doc-render.js D.nextMarkup / D.nextParts (nextHead, briefInner, pendingInner, idleInner, liveInner, preparingInner, provenance) · D.paintNextBlock · doc.css .next, .next.live, .next.preparing, .next.idle, .countdown`
- **States:** brief ready, starting now, live, live · listening, preparing summary, preparing brief, prepared just now, not prepared yet, later this week, idle (not scheduled), idle draft
- **Tokens:** `--accent-softer`, `--accent`, `--coral`, `--surface-sunken`, `--label-4`, `--mint`
- **Motion:** Trigger: the meeting changes state (brief prepared, starting, Record, Stop, filed) → the block repaints with WAAPI: out 120ms ease-out (opacity 1→0, blur 0→2px, fill forwards) → swap → in 200ms var(--ease-out) (opacity 0→1, translateY 4px→0). Countdown “Starting now” mini-dot: kit-rec 1.4s ease-in-out infinite (opacity 0.3 at 50%). Live: rec-dot pulse, wave bars scaleY(0.3→1) 900ms ease-in-out infinite with −200/−450/−650/−100ms delays, timer +1s; new transcript lines enter with .enter (kit-enter 280ms var(--ease-out) from opacity 0, translateY 6px). Preparing: spinner 700ms linear infinite, shimmer bars 1.3s linear infinite. Reduced motion: repaint is an instant swap; wave, shimmer and enter stop; rec-dot slows to 2.4s. framer-motion: AnimatePresence mode="wait" keyed by state with exit {opacity:0, filter:"blur(2px)"} 0.12s and initial {opacity:0, y:4}.
- **Accessibility:** Section landmark “Next”. Record has the ⌘R shortcut (aria-keyshortcuts="Meta+R"); status changes (“Starting now”, “Recording”, “Preparing summary…”) announced via aria-live="polite". Join opens the call app.

| Prop | Values | Default |
|---|---|---|
| `series / meeting` | Series, Meeting \| null | — |
| `surface` | page \| peek (peek hides when/where in the head) | page |
| `state` | brief \| pending \| idle \| starting \| live \| preparing | brief |
| `countdown` | string — “in 19 min”, “Tomorrow”, “in 3 days” | — |
| `onRecord / onSkip / onJoin / onStop` | () => void | — |

Shown: Brief ready · Starting now · Live · Live · listening · Preparing summary · Preparing brief · Prepared just now → repaint · Not prepared yet · Later this week · no carry · Idle · Idle · new doc

### CarryRow

A remembered item carried into the brief: type icon tile, text with owner, a note (Due today, Open for 2 meetings) and its source chip.

- **Maps to:** List item
- **Used in:** NextBlock · Since last time, NextBlock · Carry forward so far
- **Source:** `002 doc-render.js carryRow / carryForward · doc.css .carry-row, .k-ico[data-type], .carry-note`
- **States:** commitment with owner and note, question with note, fact from a doc, source hover, compact (peek)
- **Tokens:** `--series-orange`, `--amber`, `--series-teal`, `--accent`, `--separator`
- **Motion:** None; the source chip has the kit press/hover transitions.
- **Accessibility:** Icon tile is decorative (type is also spoken by the list heading); source chip is a button.

| Prop | Values | Default |
|---|---|---|
| `type` | commitment \| question \| fact \| decision | — |
| `text / owner` | string | — |
| `note` | string | — |
| `src` | string | — |

Shown: Since last time · Source hover · Carry forward so far · Compact

### WorthAsking

The one mint moment: questions Telu thinks are worth asking, each with its source and a + that adds it to the agenda. During recording it becomes “Worth asking now”.

- **Maps to:** Card with rows · add = Button icon + Tooltip
- **Used in:** NextBlock (brief), NextBlock (live), PeekBody
- **Source:** `002 doc-render.js askInner · doc-edit.js D.askToAgenda · app-record.js liveAsk · doc.css .ask, .ask-head, .ask-row, .ask-add`
- **States:** rest, row hover (+ appears), added (button disabled), live, compact
- **Tokens:** `--mint`, `--mint-ink`, `--content-bg`, `--shadow-card`, `--separator`
- **Motion:** Add button: opacity 0→1 150ms ease on row hover or focus-visible (always visible on touch), :active scale 0.97. Adding: the new agenda row enters with Kit.enterAnimated (280ms) and flashes .receive (900ms); the button disables (opacity 0.45). Live card arrives with the transcript lines (.enter 280ms). Reduced motion: no enter/flash. framer-motion: whileHover on the row reveals the button (opacity), layout animation for the inserted agenda item.
- **Accessibility:** Each + is a button with tooltip “Add to agenda” (give it aria-label with the question text). Mint is decorative; the heading “Worth asking” carries the meaning.

| Prop | Values | Default |
|---|---|---|
| `asks` | { text, src }[] | [] |
| `live` | boolean — “Worth asking now”, no add buttons | false |
| `onAddToAgenda` | (index) => void | — |

Shown: Rest · Row hover · Added · Live · Worth asking now · Compact

### AgendaChecklist

This meeting’s agenda: round checkboxes, minutes, chips for items Telu added (“Added by Telu”, “From Worth asking”) and an inline Add item field. Before the brief exists it previews the standing agenda as bullets.

- **Maps to:** Radix Checkbox list + input (BlockNote checklist block)
- **Used in:** NextBlock
- **Source:** `002 doc-render.js D.agendaItem / previewItem / agendaAdd · doc-edit.js D.addAgendaItem, toggleAgenda · doc.css .agenda-item, .added-by, .agenda-add, .agenda-input`
- **States:** unchecked, checked (done), added by Telu, from Worth asking, add field, preview, empty preview
- **Tokens:** `--accent`, `--label-3`, `--label-4`, `--accent-soft`, `--accent-strong`
- **Motion:** Checkbox: background/box-shadow 160ms ease, press scale(0.88) 140ms var(--ease-out), check stroke draws (stroke-dashoffset 14→0) 220ms var(--ease-out) after 40ms; item text color 150ms ease with an instant line-through. Add: Enter appends the row with Kit.enterAnimated (height 0→auto + opacity, 280ms var(--ease-out)). Reduced motion: stroke and height animations off. framer-motion: motion.path pathLength 0→1 (0.22s, delay 0.04); layout + initial={{ height: 0, opacity: 0 }} for new rows.
- **Accessibility:** Checkboxes are buttons with aria-checked and aria-label “Done”; the add field has aria-label “Add agenda item”; Enter adds, Esc clears and blurs.

| Prop | Values | Default |
|---|---|---|
| `items` | { t, d, done, added, fromAsk }[] | [] |
| `preview` | boolean — bullets, no checkboxes | false |
| `onToggle` | (i, done) => void | — |
| `onAdd` | (text) => void | — |

Shown: Brief agenda · Done and added · Standing agenda preview · Empty preview

### MeetingDocs

“Docs for this meeting”: files attached to this occurrence (reference docs marked Include plus anything dropped on it). Each chip’s dot includes or leaves it out of this brief.

- **Maps to:** Chip list with toggle + drop zone
- **Used in:** NextBlock, Island (drop on the Island attaches here)
- **Source:** `002 doc-render.js D.nextDocsInner / meetingDocChip / nextDocs · doc-edit.js D.toggleMeetingDoc, T.attachToMeeting · doc.css .next-docs, .next-doc-list, .drop-note`
- **States:** included, left out, without brief (plain chips), chip hover, drop target, new chip (chip-in)
- **Tokens:** `--content-bg`, `--shadow-card`, `--shadow-card-hover`, `--accent-softer`, `--accent`
- **Motion:** Dot toggle (click): background-color + box-shadow 150ms ease, CSS transition. File drag over the group: kit .drop-target (2px dashed accent outline at −6px + accent-softer fill); background-color 150ms ease, outline appears instantly. Attach (drop here or on the Island): new chips run .chip-in keyframes 280ms var(--ease-out) from opacity 0 + translateY(3px) scale(0.95), 40ms stagger. Chip hover: shadow-card → shadow-card-hover 150ms ease; press scale 0.97 140ms var(--ease-out). Reduced motion: chip-in skipped (kit), colors still fade. framer-motion: AnimatePresence list with initial {opacity:0, y:3, scale:0.95}, staggerChildren 0.04; drop state via a data attribute (no animation needed).
- **Accessibility:** Drop zone needs a keyboard alternative (Attach… button in the island/menu). Dots are toggles with tooltips “Included in this brief” / “Left out of this brief”.

| Prop | Values | Default |
|---|---|---|
| `docs` | string[] | [] |
| `off` | string[] — left out of this brief | [] |
| `dropTarget` | boolean | false |
| `onAttach` | (files) => void | — |

Shown: Included · One left out · Without a brief · Chip hover · Drop target · Attached

### LiveStrip

The recording row: coral dot, Recording (or Recording once), ticking timer, wave, “Transcribing on this Mac” and Stop ⌘R.

- **Maps to:** Status row inside NextBlock (live) and the one-off peek card
- **Used in:** NextBlock, PeekBody (one-off)
- **Source:** `002 doc-render.js liveInner · app-record.js T.oneOffLiveMarkup · doc.css .live-strip, .live-timer, .live-wave, .live-note, .next.live`
- **States:** recording, recording once, compact (note hidden)
- **Tokens:** `--coral`, `--coral-ink`, `--label-3`
- **Motion:** Trigger: recording starts (Record, ⌘R, Island) — the strip replaces the brief via the NextBlock repaint. rec-dot: kit-rec 1.4s ease-in-out infinite (opacity 1→0.3→1); wave: 5 bars scaleY(0.3↔1) 900ms ease-in-out infinite, delays 0/−200/−450/−650/−100ms; timer text +1s (tabular numbers, min-width 36px so it never shifts). Reduced motion: wave stops, dot slows to 2.4s. framer-motion: animate={{ opacity: [1, 0.3, 1] }} repeat Infinity; bars animate scaleY with repeatType "mirror".
- **Accessibility:** Timer should be aria-live="off" (announce start/stop only); Stop button has aria-keyshortcuts="Meta+R".

| Prop | Values | Default |
|---|---|---|
| `label` | Recording \| Recording once | Recording |
| `elapsed` | seconds | 0 |
| `onStop` | () => void | — |

Shown: Recording · Recording once · Compact

### PastMeetings

Every past meeting, newest first, filed by Telu. Rows expand into the summary, knowledge, docs and transcript; a button reveals older meetings.

- **Maps to:** List of MeetingRow (Radix Collapsible) + Button
- **Used in:** Living doc page
- **Source:** `002 doc-past.js pastMarkup / D.pastList / D.earlierButton · doc-page.js D.afterPastChange, D.insertNewest · doc.css .past-list, .past-empty, .show-earlier`
- **States:** filled (one expanded), with review at the top, empty, show earlier
- **Tokens:** `--separator`, `--surface-sunken`, `--label-2`, `--label-3`
- **Motion:** Newest meeting (after filing) is prepended with Kit.enterAnimated: WAAPI height 0→h + opacity 0→1, 280ms var(--ease-out), overflow hidden during the run. Removing (move / unfile / split / delete) uses Kit.removeAnimated: height, opacity, margins and paddings → 0 in 220ms var(--ease-out), then the node is dropped. Reduced motion: instant insert/remove. framer-motion: <AnimatePresence initial={false}> with motion.div layout, initial={{ height: 0, opacity: 0 }}, exit={{ height: 0, opacity: 0 }}.
- **Accessibility:** Section with eyebrow heading “Meetings”; rows are disclosure buttons (aria-expanded); “Show 31 earlier meetings” is a button.

| Prop | Values | Default |
|---|---|---|
| `meetings` | Meeting[] (not upcoming) | [] |
| `earlier` | number — older meetings not loaded | 0 |
| `expanded` | Record<meetingId, boolean> | {} |

Shown: Filled · After a meeting · Empty

### MeetingRow

One past meeting: date, number · duration (or “from …” after a move), a one-line summary that fades when open, count chips, a ⋯ menu and a drag grip on hover. Expanded it shows the summary, knowledge or review, docs and Open transcript.

- **Maps to:** Radix Collapsible (Trigger = row head) + Radix DropdownMenu (⋯) + native drag source
- **Used in:** PastMeetings
- **Source:** `002 doc-past.js meetingHead / D.meetingMarkup / D.meetingBody / cancelledRow · doc-page.js D.toggleMeeting, D.jumpToMeeting · doc-organize.js D.meetingMenu, moveMenu, D.deleteMeetingFlow, drag (onDragStart) · doc.css .mtg, .mtg-head, .grip, .mtg-line, .mtg-body, .drag-ghost, .fly-chip`
- **States:** collapsed, expanded, hover (grip + fill), pressed, needs review, reviewed, cancelled, interview title, moved from, filed from, dragging, received, ⋯ menu, move to, delete confirm, drag ghost, fly chip
- **Tokens:** `--fill`, `--fill-2`, `--label-2`, `--label-3`, `--separator`, `--glass-strong`, `--shadow-float`, `--coral`
- **Motion:** Toggle: .collapsible grid-template-rows 0fr↔1fr 260ms var(--ease-out) + opacity 200ms ease; disclosure chevron rotate(0→90deg) 200ms var(--ease-out); .mtg-line opacity 1→0 180ms var(--ease-out) when open (CSS transitions, interruptible). Head: background-color 150ms ease (hover fill, :active fill-2); grip opacity 0→1 150ms ease on hover. Jump from evidence/peek: smooth scroll, then .receive (kit-receive 900ms var(--ease-out), accent-soft → transparent) after 360ms. Drag: row opacity 0.45 while dragging; the ghost is a static glass chip; sidebar targets get an inset accent ring, the hovered row accent-soft + scale(1.03). Move/unfile via menu: Kit.flyTo — a glass chip flies to the sidebar row in 560ms (outer translateX cubic-bezier(0.45,0,0.2,1); inner translateY + scale ≥0.4 + opacity→0.35 cubic-bezier(0.6,0,0.9,0.7)), then the row flashes .receive and its icon .bump (kit-bump 420ms, scale 1.18 at 40%); the row itself leaves with Kit.removeAnimated (220ms). Reduced motion: no fly (receive only), instant toggle. framer-motion: Collapsible → motion.div height auto; fly → layoutId shared between chip and sidebar row or an absolutely positioned motion.div with x/y/scale keyframes.
- **Accessibility:** Row head is a button with aria-expanded and aria-controls; ⋯ has aria-label “More”; grip needs a keyboard alternative (“Move to another series…” in the menu). Cancelled rows are static text.

| Prop | Values | Default |
|---|---|---|
| `meeting` | Meeting | — |
| `open` | boolean | false |
| `sub` | #n · duration \| from <series> \| from Needs filing | — |
| `onMove / onSplit / onUnfile / onDelete` | (mid) => void | — |
| `draggable` | boolean (grip → sidebar row) | true |

Shown: Collapsed · Expanded · Hover · Pressed · Needs review · collapsed · Needs review · expanded · Reviewed · Cancelled · Moved from another series · Filed from Needs filing · Dragging · Received · ⋯ menu · Move to · Delete confirm · Move and insert · Drag ghost · fly chip

### KnowledgeRow

A filed meeting’s knowledge: type label, text, owner avatar, status and source. Superseded items are struck through.

- **Maps to:** Table-like list row (CSS grid 112px · 1fr · auto)
- **Used in:** MeetingRow (expanded), PeekBody (past)
- **Source:** `002 doc-past.js kRow / T.itemsOf · doc.css .k-list, .k-row, .k-side`
- **States:** decision current, commitment open with owner, commitment done, superseded, compact (type on its own line)
- **Tokens:** `--separator`, `--label-3`, `--label-4`, `--series-green`, `--accent`
- **Motion:** None of its own.
- **Accessibility:** Render as a list; status is text; avatar has a title with the owner’s name.

| Prop | Values | Default |
|---|---|---|
| `type` | decision \| commitment \| question \| fact | — |
| `status` | current \| open \| completed \| superseded \| unresolved | — |
| `owner` | string | — |
| `src` | string | — |

Shown: Filed meeting · Superseded · Compact

### CandidateRow

Something Telu found in the meeting, waiting for you: type, text, owner / due / “Resolves an open question”, the evidence chip and Accept · Correct · Reject. Only accepted items reach Memory.

- **Maps to:** List row with action buttons; Correct = inline contentEditable (BlockNote inline) · Undo via sonner toast
- **Used in:** MeetingRow (review), PeekBody (needs review)
- **Source:** `002 doc-past.js D.candRow (CAND_ACTIONS pending | editing | accepted | rejected) · doc-review.js D.setCandState, D.acceptCand, D.saveCorrection, D.acceptAll · doc.css .cand[data-state]`
- **States:** pending, pending · owner and due, pending · resolves a question, correcting, accepted, accepted · corrected, rejected, compact
- **Tokens:** `--amber`, `--surface-sunken`, `--accent`, `--accent-strong`, `--content-bg`, `--label-3`, `--label-4`, `--separator`
- **Motion:** State changes swap the row (outerHTML) instantly; .cand opacity transition 200ms ease covers fades. Correct: the text becomes editable with an accent ring and its text selected. Accept all accepts pending rows one by one every 70ms (setTimeout stagger), then one toast with Undo. Accepted items flash in Memory (.receive 1500ms) and the scrubber’s Memory tick bumps. Reduced motion: unchanged (no transforms). framer-motion: AnimatePresence mode="popLayout" keyed by state for the actions cell; stagger 0.07 for Accept all.
- **Accessibility:** Actions are buttons (Reject is icon-only: aria-label “Reject”); the editable text needs role="textbox" and aria-label “Correct the text”; Enter saves, Esc cancels. After Accept, move focus to the next pending row.

| Prop | Values | Default |
|---|---|---|
| `candidate` | { id, type, text, owner, due, resolves, ev: { t, who, quote } } | — |
| `state` | pending \| editing \| accepted \| rejected | pending |
| `corrected` | boolean | false |
| `onAccept / onCorrect / onReject / onUndo` | (id) => void | — |

Shown: Review · interactive · Pending · Pending · owner and due · Pending · resolves a question · Correcting · Accepted · Accepted · corrected · Rejected · Compact · Compact · correcting

### ReviewHead

Heads the review list: amber eye + “Review what Telu found — only what you accept reaches Memory.” with Accept all when more than one is pending; turns into “Reviewed — Memory is up to date.”

- **Maps to:** Header row + Button
- **Used in:** MeetingRow (review), PeekBody (needs review)
- **Source:** `002 doc-past.js D.reviewHead · doc.css .review-head, .review-note`
- **States:** several pending (Accept all), one pending, reviewed
- **Tokens:** `--amber`, `--accent`, `--label-2`
- **Motion:** Re-rendered in place when the pending count changes (instant).
- **Accessibility:** Use role="status" so “Reviewed — Memory is up to date.” is announced.

| Prop | Values | Default |
|---|---|---|
| `pending` | number | 0 |

Shown: Several pending · One pending · Reviewed

### CountsChips

Right side of a meeting row: “N to review” (amber) while candidates are pending, “Reviewed” after, otherwise decision / action / doc counts.

- **Maps to:** Badge group
- **Used in:** MeetingRow, PeekBody (Summary head)
- **Source:** `002 doc-past.js D.countsChips · kit .chip, .chip.amber`
- **States:** to review, reviewed, counts, counts without docs, none
- **Tokens:** `--amber`, `--amber-soft`, `--fill-2`, `--label-2`
- **Motion:** Re-rendered in place (instant) as candidates are handled.
- **Accessibility:** Plain text chips; “5 to review” should be part of the row’s accessible name.

| Prop | Values | Default |
|---|---|---|
| `meeting` | { candidates? \| counts?, docs? } | — |

Shown: To review · Reviewed · Counts · Counts without docs · None

### TranscriptDrawer

Right-hand glass drawer with a meeting’s transcript: title, series · # · duration, “Transcribed on this Mac · evidence highlighted” and timestamped lines; the evidence line is highlighted and centred.

- **Maps to:** Custom side panel (non-modal) — Radix Dialog without overlay or Sheet (side="right", modal={false})
- **Used in:** Living doc page
- **Source:** `002 doc-past.js D.drawerTranscript / D.transcriptLines · doc-page.js D.openDrawer, D.openTranscript, shiftCanvas · doc.css .drawer, .drawer.open, .tl, .tl.hl, .drawer-empty, .canvas-inner`
- **States:** open, evidence highlighted, no highlight, empty, opening / closing
- **Tokens:** `--glass-strong`, `--shadow-float`, `--accent-soft`, `--accent-strong`, `--ease-drawer`
- **Motion:** Open: .drawer transform translateX(calc(100% + 24px)) → none in 300ms var(--ease-drawer), visibility immediate; close 200ms var(--ease-drawer) with visibility hidden after 200ms. The page column shifts left at the same time (.canvas-inner translateX(var(--shift)) 300ms / 200ms var(--ease-drawer)) so the doc stays readable; the scrubber fades out (opacity 200ms). Highlighted line: background-color 300ms ease; scrolled to the centre instantly on open. CSS transitions (interruptible). Reduced motion: slide and shift become instant. framer-motion: motion.aside animate={{ x: open ? 0 : "calc(100% + 24px)" }} transition={{ duration: open ? 0.3 : 0.2, ease: [0.32, 0.72, 0, 1] }}; animate the column x in sync.
- **Accessibility:** role="complementary" aria-label “Transcript”; close button aria-label “Close”; Esc closes; lines are a list of <time> + speaker + text.

| Prop | Values | Default |
|---|---|---|
| `series / meeting` | Series, Meeting | — |
| `highlight` | string — timestamp to highlight | — |
| `open` | boolean | false |
| `onClose` | () => void | — |

Shown: Evidence highlighted · No highlight · Empty

### DrawerInfo

The same drawer showing living doc details (toolbar inspector): rhythm, calendar link, meetings, reference, memory, people and a privacy note.

- **Maps to:** Side panel content (definition list)
- **Used in:** Living doc page (toolbar · Details)
- **Source:** `002 doc-past.js D.drawerInfo · doc-page.js D.toggleInspector · doc.css .drawer-body.info, .info-row, .info-people`
- **States:** calendar series, grouped by you, new doc
- **Tokens:** `--glass-strong`, `--separator`, `--label-2`, `--label-3`
- **Motion:** Trigger: the toolbar Details (inspector) button toggles it; ✕ or Esc closes. Same drawer slide as TranscriptDrawer — translateX(calc(100% + 24px)) → none 300ms open / 200ms close, var(--ease-drawer), CSS transition with the page column shifting in sync; the inspector button color → accent (150ms). Reduced motion: instant. framer-motion: shared with TranscriptDrawer (one Drawer component, two contents).
- **Accessibility:** Render rows as <dl>; people list with names; close button labelled.

| Prop | Values | Default |
|---|---|---|
| `series` | Series | — |

Shown: Calendar series · Grouped by you · New doc

### Scrubber

Right-edge section index: ticks for Purpose, Memory, Next and each past meeting; the current one is long and accent. Hovering reveals labels on a glass pill; clicking scrolls there.

- **Maps to:** Custom nav (table of contents) — IntersectionObserver for the active item
- **Used in:** Living doc page
- **Source:** `002 doc-page.js D.refreshMarks / D.updateActiveMark / D.scrubTo · doc.css .scrubber, .scrub-item, .scrub-label, .scrub-tick, .scrub-gap, tick-receive`
- **States:** rest, hover (labels), item hover, active, tick received, hidden while the drawer is open
- **Tokens:** `--label-3`, `--label-4`, `--accent`, `--accent-strong`, `--glass-strong`, `--shadow-float`
- **Motion:** Container: background + box-shadow + opacity 200ms ease (glass appears on hover; opacity 0 while the drawer is open). Labels: opacity 0→1 and translateX(4px)→0 in 150ms var(--ease-out) on hover. Tick: transform scaleX(0.56→1) + background (label-4 → accent) 200ms var(--ease-out) when active. Item: color 150ms ease, :active scale(0.96) 140ms. Receive (after accepting into Memory): tick-receive 900ms var(--ease-out) — scale(1.2, 2.4) and accent at 30%. Click scrolls smoothly (instant with reduced motion). Reduced motion: kit keeps only opacity/color transitions (ticks and labels jump), tick-receive still plays. framer-motion: whileHover on the nav for the glass; motion.span for ticks with animate={{ scaleX: active ? 1 : 0.56 }}.
- **Accessibility:** <nav aria-label="Sections"> with buttons named by their label (aria-label) and aria-current on the active one.

| Prop | Values | Default |
|---|---|---|
| `marks` | { id, label }[] (a gap after Next) | [] |
| `active` | string | — |

Shown: Rest · Hover · Item hover · Received

### RepeatsControl

Replaces the header chips on a new doc: Repeats (None · Weekly · Every 2 weeks · Monthly), Day and Time pop-up buttons (disabled for None), then “Link to a calendar event…” and the people chip.

- **Maps to:** Radix ToggleGroup (single) + two Radix DropdownMenu pop-up buttons + link Button
- **Used in:** DocHeader (new doc)
- **Source:** `002 doc-render.js repeatsMarkup / D.repeatsSub · doc-organize.js D.mountDraft, D.setDraft, D.pickDay, D.pickTime, D.linkEventMenu, D.linkEvent · app-data.js T.syncDraft`
- **States:** none (day/time disabled), weekly, linked to an event, day menu, time menu, link menu
- **Tokens:** `--fill-2`, `--content-bg`, `--hairline`, `--accent`, `--label-2`
- **Motion:** Segmented thumb: transform translateX + width 240ms var(--ease-out) (Kit.segmented; placed without animation on mount). Pop-up buttons enable instantly (opacity 0.45 when disabled). Menus appear instantly and fade out 120ms. Picking a value repaints the buttons, the sidebar row and the Next block (NextBlock repaint). Reduced motion: the thumb jumps. framer-motion: layoutId thumb inside the ToggleGroup (spring or duration 0.24, ease [0.23,1,0.32,1]).
- **Accessibility:** ToggleGroup with aria-label “Repeats”; pop-up buttons use aria-haspopup="menu" and are disabled (not hidden) when cadence is None; link button names the linked event.

| Prop | Values | Default |
|---|---|---|
| `cadence` | None \| Weekly \| Every 2 weeks \| Monthly | None |
| `day` | Mon…Fri \| Weekdays | — |
| `time` | HH:MM | — |
| `linked` | string — “Linked to …” | — |
| `people` | string[] | [] |

Shown: Interactive · Weekly · Linked to an event · Day menu · Time menu · Link menu

### DocMenu

The doc toolbar’s ⋯ menu: Rename, Edit purpose ⌘E, Export as Markdown ⇧⌘E and Stop tracking… (with its confirm).

- **Maps to:** Radix DropdownMenu + Radix AlertDialog
- **Used in:** Living doc toolbar
- **Source:** `002 doc-popovers.js D.docMenu · app-actions.js T.confirmStopTracking`
- **States:** menu, row active, stop tracking confirm
- **Tokens:** `--glass-strong`, `--accent`, `--coral-ink`
- **Motion:** Trigger: click ⋯. Menu appears instantly (no scale), rows highlight instantly on hover/arrows, choosing blinks the row (active off 60ms, on again) and closes after 130ms; the menu fades out 120ms (CSS transition). Alert: opacity 180ms + scale 0.95→1 220ms var(--ease-out), close 120/140ms. Reduced motion: opacity only. framer-motion: DropdownMenu.Content without enter animation (exit opacity 0.12s); AlertDialog.Content initial {opacity:0, scale:0.95}.
- **Accessibility:** role="menu" with arrow-key navigation and ⌘ shortcuts shown; destructive row in coral; the alert is role="alertdialog" with Cancel as the default for Esc.

| Prop | Values | Default |
|---|---|---|
| `series` | Series | — |

Shown: Menu · Stop tracking confirm

### LivingDocPage

The whole series page in context: doc toolbar, header, Purpose, Memory, Next, Meetings, the scrubber and the drawer. Scroll it, switch the scenario, open the inspector or a transcript, click chips and source chips.

- **Maps to:** Page composition (Next.js route /series/[id]) — BlockNote document with custom blocks
- **Used in:** Sidebar series rows, Side peek · Open as page
- **Source:** `002 doc-past.js D.docMarkup · doc-page.js (paintPage, observeTitle, refreshMarks, openDrawer) · app-shell.js docToolbar`
- **States:** before (brief), live, after (review), scrolled (toolbar glass + title in toolbar), drawer open
- **Tokens:** `--content-bg`, `--toolbar-h`, `--ease-drawer`, `--ease-out`
- **Motion:** Opening a series (sidebar, peek “Open as page”, island): WAAPI out 120ms ease-out (opacity 1→0, blur 2px, fill forwards) → swap → in 180ms var(--ease-out) (opacity 0→1, translateY 4px→0); then optional reveal (scroll to Next or a meeting + .receive). Scroll: toolbar glass + hairline (200ms ease) and large title into the toolbar (180ms). Details / transcript: drawer + column shift (300ms open / 200ms close, var(--ease-drawer)). Scenario switch in this tile re-renders instantly. Reduced motion: page swap and drawer are instant. framer-motion: AnimatePresence mode="wait" around the route with exit {opacity:0, filter:"blur(2px)"} 0.12s and initial {opacity:0, y:4}.
- **Accessibility:** Main landmark with the doc; toolbar buttons have tooltips and shortcuts (⌘[ back, ⌘R record, ⌘E edit purpose, ⇧⌘E export); scrubber nav; drawer complementary region.

| Prop | Values | Default |
|---|---|---|
| `series` | Series | — |
| `reveal` | { next } \| { mid } — scroll target on open | — |

Shown: Living doc · in context

## Island

The Island floats under the menu bar above every app and keeps working when the window is closed. It morphs between modes — setup, before, starting, live, filing, after, hidden — expands into cards on hover or click, and accepts files dropped on it. Static tiles below are captured from the real Island (island.js) at load; the playground runs it live.

### Island

The ambient shell: a glass capsule that morphs between modes and flashes, expands into cards (see the card components below) and never takes focus from what you are doing.

- **Maps to:** Separate transparent always-on-top Tauri window (macOS NSPanel, non-activating) + framer-motion layout animation; talks to the app over TeluBridge (next / live / after / evidence) and island:* events
- **Used in:** Desktop (always), Menu bar status item, Window closed
- **Source:** `002 island.js (Island.mount / set / refresh, VIEWS, morph, sync, flash) · island.css .island, .il, .il-pill, .il-card · app-bridge.js TeluBridge, T.islandForScenario, island:* handlers`
- **States:** setup, before, before · nothing next, starting, skipped (flash), live, live · found something (mint dot), live · paused, filing, after, after · all reviewed, hidden, pressed, expanded (see cards), drag hint / drop target (see IslandAttach)
- **Tokens:** `--glass-strong`, `--glass-rim`, `--shadow-float`, `--spring`, `--spring-dur`, `--spring-bounce`, `--spring-bounce-dur`, `--ease-out`, `--menubar-h`, `--coral`, `--mint`, `--accent`, `--amber`
- **Motion:** Shell morph: width, height and border-radius transition over var(--spring-dur) 490ms with var(--spring) (linear() spring, ≈0.3% overshoot), delayed by --morph-delay — 90ms when the next view is smaller (content leaves first), 0ms when it grows. The attached flash adds .bouncy: var(--spring-bounce) over var(--spring-bounce-dur) 600ms (≈3.8% overshoot). Radius: pill h/2 (18px), card 22px, drop target 20px. Content layers: every view is a new absolutely positioned layer (transform-origin 50% 0) that enters from .pre (opacity 0, blur 2px, scale 0.97) with opacity + filter 160ms var(--ease-out) and transform 240ms var(--ease-out), delayed by --in-delay (morph delay + 80ms; 0 on first paint); the old layer gets .out (opacity 0, blur 2px, 90ms ease-out) and is removed after 160ms. Same-view updates patch in place and refit the shell (no delay). Visibility: .gone → opacity 0 (220ms var(--ease-out)) + scale 0.95 (180ms var(--ease-out)); .instant suppresses the transition on the first paint after hiding. Pill press: scale 0.97. Hover intent: expands after 150ms over the shell (not over buttons), collapses 300ms after leaving unless pinned by a click; Esc or an outside click collapses. Reduced motion: kit limits transitions to opacity/colors (the shell jumps), typing and dot/arrive animations are off. framer-motion: <motion.div layout transition={{ type: "spring", duration: 0.49, bounce: 0.1 }} style={{ borderRadius }}> + <AnimatePresence mode="popLayout"> layers with initial {opacity:0, filter:"blur(2px)", scale:0.97}, animate {opacity:1, filter:"blur(0px)", scale:1, transition:{ delay }}, exit {opacity:0, filter:"blur(2px)", transition:{ duration: 0.09 }}; attached flash spring bounce ≈0.3, duration 0.6.
- **Accessibility:** role="region" aria-label="Telu", tabindex 0: Enter/Space activates (expand, or Review in after, or setup), Esc collapses. The mint dot has role="img" and an aria-label. Buttons inside cards are real buttons with ⌘R hints. As a non-activating panel it must not steal focus; expose live status (Recording, Filing…, N to review) through the menu bar item as well.

| Prop | Values | Default |
|---|---|---|
| `mode` | setup \| before \| starting \| live \| filing \| after \| hidden | before |
| `bridge` | { next(), live(), after(), evidence(sid, src) } | TeluBridge |
| `expanded` | boolean (hover intent or click to pin) | false |
| `flash` | attached \| already \| invalid \| skipped (timed) | — |
| `on*` | island:record · skip · stop · review · open · attach · feedback · setup (CustomEvents on the desk) | — |

Shown: Live playground · Setup · Before · Before · nothing next · Starting · Skipped · Live · Live · found something · Live · paused · Filing · After · After · all reviewed · Hidden · Pill · pressed

### IslandBriefCard

Before and Starting expand into the brief: series icon, name #n, start · place · countdown, attendees, the purpose (2 lines), Since last time (2 rows with sources), the Worth asking question on mint, then docs chip · Open brief · (Skip) · Record ⌘R.

- **Maps to:** Island card view (framer-motion layout child)
- **Used in:** Island (before, starting)
- **Source:** `002 island.js briefCard / carryRow / askSection / briefFoot · island.css .il-card, .il-head, .il-why, .il-sec, .il-row, .il-ask, .il-foot, .il-docs`
- **States:** before, starting (Skip), no purpose yet, docs count bump
- **Tokens:** `--glass-strong`, `--mint-soft`, `--mint-ink`, `--label-2`, `--fill-3`
- **Motion:** Trigger: hover intent (150ms) or click on the Before/Starting pill → Island morph to the card (spring 490ms, radius 22px) with the card layer fading in (see Island). Dropping a file while it is open patches the docs chip text and plays .bump (kit-bump keyframes 420ms var(--ease-out), scale 1.18 at 40%). Chip press scale 0.97 (140ms var(--ease-out)); hover fill-3 150ms ease (fine pointers). Source chips press scale 0.95. Reduced motion: bump off (kit), morph jumps. framer-motion: animate={{ scale: [1, 1.18, 1] }} times [0, 0.4, 1] duration 0.42 on count change.
- **Accessibility:** Card is part of the Island region; source chips open the evidence popover (dialog); Record has aria-keyshortcuts="Meta+R".

| Prop | Values | Default |
|---|---|---|
| `next` | { series, meeting (brief), countdown } | — |
| `starting` | boolean — adds Skip | false |
| `docs` | number of included docs | — |

Shown: Before · Starting · No purpose yet · Docs chip bump

### IslandLiveCard

Live expands into the recording card: dot, series #n, timer, wave; the last two transcript lines (typing in word by word); the suggestion slot; Pause / Stop ⌘R and “On this Mac”.

- **Maps to:** Island card view with a streaming list
- **Used in:** Island (live)
- **Source:** `002 island.js liveCard / linesHtml / lineHtml / typeLines / patchLiveCard / togglePause · island.css .il-live-card, .il-lines, .il-line, .il-who, .w.h, .il-stop`
- **States:** recording with suggestion, listening (no lines yet), paused, typing
- **Tokens:** `--coral`, `--label-2`, `--mint-soft`, `--mint`
- **Motion:** Typing: new lines render with every word hidden (.w.h, opacity 0); 260ms after the card mounts (120ms after new lines arrive) a 80ms interval reveals one word at a time, each fading in over 160ms var(--ease-out); the last typed count is remembered so older lines never re-type. Only the last two lines are shown. Pause: dot animation stops (opacity 0.45), wave bars freeze at scaleY(0.3), timer freezes; Resume continues from the frozen time. Stop hands off to Filing. Reduced motion: words appear at once. framer-motion: staggerChildren 0.08 over word spans with opacity 0→1 (0.16s).
- **Accessibility:** Transcript lines in an aria-live="polite" list; Pause toggles aria-pressed; Stop has ⌘R.

| Prop | Values | Default |
|---|---|---|
| `live` | { series, meeting, elapsed, transcript[{ who, text }], suggestion } | — |
| `paused` | boolean | false |

Shown: Recording · Listening · Paused

### IslandFiledCard

After expands into the filed card: check, “Filed to Product Sync #37”, duration · ended · transcribed on this Mac, a 3-line summary, what Telu found as count chips, then Open meeting and “About 30 seconds · Review 5”.

- **Maps to:** Island card view
- **Used in:** Island (after)
- **Source:** `002 island.js afterCard / countChips / afterFacts · island.css .il-filed-card, .il-summary, .il-counts, .il-count`
- **States:** to review, all reviewed
- **Tokens:** `--accent`, `--fill`, `--label-2`
- **Motion:** Trigger: hover intent only (150ms; a click on the After pill opens Review) → Island morph to the card (spring 490ms, radius 22px); leaves 300ms after the pointer exits. Count chips and summary are static. Reduced motion: shell jumps, card fades. framer-motion: same layout spring as Island.
- **Accessibility:** Review button is primary and named with the count (“Review 5”).

| Prop | Values | Default |
|---|---|---|
| `after` | { series, meeting (summary, candidates), pending } | — |

Shown: To review · All reviewed

### IslandAttach

Files dragged anywhere turn the Island into a hint; over it, a drop target; on drop, a short confirmation. Files go into the brief before a meeting, or with the meeting while recording.

- **Maps to:** Island views driven by document drag events (Tauri: file drop on the panel window)
- **Used in:** Island (before, starting, live)
- **Source:** `002 island.js hintPill / dropTarget / attachedPill / alreadyPill / invalidPill / accept / onDrop / attach · island.css .il-hint, .il-drop, .il-clip, .il-ok`
- **States:** hint, drop target (brief), drop target (live), attached, attached · several, attached · live, already there, not a document
- **Tokens:** `--accent`, `--accent-softer`, `--label-2`
- **Motion:** Trigger: any file drag entering the page (dragenter/dragover) → Island morphs to the hint pill; pointer within ±10px of the Island → drop target (radius 20px, 380×104, kit .drop-target dashed outline at −7px); leaving/idle 1s → back to the mode. Drop → flash: attached uses .bouncy (width/height/radius over 600ms var(--spring-bounce), ≈3.8% overshoot) for 1.2s; already 1.4s; invalid 1.6s; then morphs back (490ms var(--spring)). Content layers cross-fade as in Island. Reduced motion: shell jumps, layers fade (opacity only). framer-motion: layout spring bounce ≈0.3 duration 0.6 for the attached flash; AnimatePresence for the label.
- **Accessibility:** Needs a non-drag path (Attach… in the brief card / docs chip). Confirmation text should be announced (aria-live).

| Prop | Values | Default |
|---|---|---|
| `target` | { series, meeting, live } | — |
| `files` | File[] (names must look like documents) | [] |

Shown: Hint · Drop target · brief · Drop target · live · Attached · Attached · several · Attached · live · Already there · Not a document

### IslandSuggestionCard

“Worth asking now” during a recording: mint card with the question, its sources and Useful / Dismiss.

- **Maps to:** Card inside IslandLiveCard
- **Used in:** IslandLiveCard
- **Source:** `002 island.js suggestionCard / patchSuggestion / feedback · island.css .il-sugg, .il-sugg.arrive, .il-sugg.leaving`
- **States:** arriving, shown, leaving
- **Tokens:** `--mint`, `--mint-soft`, `--mint-ink`
- **Motion:** Arrives with il-arrive: 320ms var(--ease-out), 140ms delay, from opacity 0, translateY(6px), scale(0.98) (keyframes, one-shot) — only when it appears in an already open card; the pill shows the mint dot instead. Useful / Dismiss add .leaving (opacity 0 + scale 0.98, 150ms transition) and the card is dropped after 150ms. Reduced motion: no arrive animation. framer-motion: initial {opacity:0, y:6, scale:0.98} with delay 0.14; exit {opacity:0, scale:0.98} 0.15s.
- **Accessibility:** Announce arrival politely; Dismiss is icon-only with aria-label “Dismiss”.

| Prop | Values | Default |
|---|---|---|
| `suggestion` | { text, sources[] } | — |
| `onUseful / onDismiss` | () => void | — |

Shown: Arrive · Button hover

### IslandEvidencePopover

Source chips inside the Island open a popover pinned to the Island: spoken evidence (series #n · time, quote, speaker, Open meeting) or document evidence (FROM THE DOC · page, passage, file, On this Mac).

- **Maps to:** Radix Popover rendered inside the Island panel window (z-index above the Island)
- **Used in:** IslandBriefCard, IslandLiveCard, IslandSuggestionCard
- **Source:** `002 island.js openEvidence / speechEvidence / docEvidence · island.css .popover.il-pop, .il-evd, .il-evd-quote`
- **States:** speech, document
- **Tokens:** `--glass-strong`, `--accent-soft`, `--shadow-float`
- **Motion:** Trigger: click a source chip in an expanded card (chip press scale 0.95). Opening pins the Island expanded; Kit.popover CSS transition from the chip — opacity 0→1 150ms + scale 0.96→1 190ms var(--ease-out), close 110ms; closing the popover never collapses the Island. Reduced motion: opacity only. framer-motion: Radix Popover inside the panel window with initial {opacity:0, scale:0.96}.
- **Accessibility:** Dialog; Esc closes; Open meeting is a button.

| Prop | Values | Default |
|---|---|---|
| `kind` | speech \| doc | — |
| `series / meeting` | resolved from the label | — |

Shown: Speech · Document

### DesktopFileIcon

Prototype-only Finder file on the desktop (“Sprint 43 plan.pdf”) used to demo dragging onto the Island; double-click shows the hint.

- **Maps to:** Prototype affordance only (in production the user drags real Finder files)
- **Used in:** Island playground, 002 desktop
- **Source:** `002 island.js FILE_HTML / mountFile · island.css .il-file, .il-file-badge, .il-file-name`
- **States:** rest, selected
- **Tokens:** `--accent`, `--fill-3`, `--window-bg`
- **Motion:** Pointer-down selects (badge backdrop fill-3 background-color 120ms ease; name gets an accent capsule instantly); dragging it switches the Island to the hint; double-click flashes the hint. Native drag image. Reduced motion: unchanged. framer-motion: not needed (prototype-only).
- **Accessibility:** Not needed in production.

| Prop | Values | Default |
|---|---|---|
| `name` | string | Sprint 43 plan.pdf |
| `selected` | boolean | false |

Shown: Rest · Selected
