# Foundations & Motion

The tokens every Telu component is built from (color in both themes, type, radii, elevation, materials, focus, icons, app icon) and the complete motion system. Build these first: the token block in `frontend/src/app/globals.css`, the Tailwind theme extension, and one shared `motion.ts`. Per-token and per-animation specs live in component-inventory.md (sections Foundations and Animations); exact source values are in `sources/themes/*.css` and `sources/kit/mac-kit.css`.

## Design Decisions

1. **Color is rationed by meaning.** The base is Ink + warm off-white + Telu Indigo (docs/telu/color-palette.md). `--accent` (#6366E8 light, #7C7FF2 dark) is the only saturated color at rest: primary buttons, selection, links, sidebar icons, active menu rows, focus ring (at 45%). `--accent-strong` is hover/pressed primary and accent text on soft fills; `--accent-soft` fills tinted buttons, accent chips, drop-over rows and the receive flash; `--accent-softer` is the quiet highlight (banner, Next card, focused editable, drop targets). This beat the generic "AI" look: the palette doc asks for calm, precise, warm and native, not a neon or gradient-heavy aesthetic.
2. **Mint only means "Telu found something worth asking or remembering".** At most 1–2 places on screen: the Worth asking card (3px `--mint` left bar, heading in `--mint-ink`), the Island live mint dot and suggestion card (`--mint-soft`). Mint never carries body text and is never decoration. The kit has `.chip.mint`, but 002 never uses it.
3. **Coral only for recording and genuine attention.** `--coral` #FF6B62: Record button, rec dots, the now line, "Starting now", the live card ring, the destructive alert primary. `--coral-ink` (#E0463D / #FF8A83) for coral text, record hover and danger menu rows; `--coral-soft` for the recording capsule and the Record glyph halo. It must not compete with indigo as a general accent.
4. **Amber means "needs review".** `--amber` (#E8930C / #FFB340): the pending-candidate bar, "N to review" and "Unfiled" chips, the open-question type, unresolved/disputed status, the Island "N to review". There is no amber-ink; amber text uses `--amber`.
5. **Four label levels.** `--label` primary, `--label-2` secondary and meta lines, `--label-3` captions, placeholders, counts and eyebrows (non-essential text only), `--label-4` dot separators, unchecked rings and strikethrough color.
6. **Surfaces and fills, with hairlines instead of borders.** `--window-bg` (backdrop behind the content column) → `--content-bg` (main column, fields, side peek, popup buttons) → `--surface` (cards) → `--surface-sunken` (wells: memory groups, candidates, preparing blocks). Controls sit on `--fill` / `--fill-2` / `--fill-3` (ink at 4.5% / 7.5% / 11% in light). Structure comes from 0.5px `--separator` or `--hairline` box-shadows. `--border` (#E6E6E2) is defined but unused in 002.
7. **One glass color, several blur strengths.** Every floating layer is `--glass-strong` + `backdrop-filter: blur(n) saturate(s)` + a shadow (recipes in CSS Patterns). `--glass` (lighter) is defined but unused in 002. The window material is `--sidebar` at blur(40px) saturate(1.7); in production the sidebar gets real vibrancy (`window-vibrancy`, 001 implementation notes).
8. **Series colors are identity and are stored as token names.** Seven tokens: `--series-blue, -orange, -green, -purple, -teal, -pink, -gray`. A series stores `var(--series-blue)`, never a hex. Color is never the only identifier: glyph and name always accompany it. Knowledge types reuse the palette: decision = `--accent`, commitment = `--series-orange`, question = `--amber`, fact = `--series-teal`. Gray is for drafts, Daily Standup and one-off recordings.
9. **Fixed hex that never themes.** File badges PDF #E5484D, DOCX #2F6BD8, XLSX #1F9A55, KEY #2E8FF0, TXT/MD #8E8E93; traffic lights #FF5F57 / #FEBC2E / #28C840; app-icon gradient `linear-gradient(180deg, #7C7FF3 0%, #5053D8 100%)`; person colors from `kit/data.js` (You #6366E8, Maria Chen #FF9F0A, Jon Park #0A84FF, Aisha Bello #AF52DE, Leo Duarte #30B955, Priya Nair #FF375F, Dana Whitfield #2FA8C0, Alex Kim #A2845E, others #8E8E93).
10. **SF system type, 13px body.** `--font` (SF Pro Text stack) for UI and body; `--font-display` (SF Pro Display) for titles ≥ 17px; `--font-mono` for code only (the app uses tabular system numerals, not mono); `--font-rounded` is defined but unused. This replaces the app's current Source Sans 3 (001 implementation notes: "system font stack instead of Source Sans 3"). Body is `13px/1.38`; nothing goes below 10.5px.
11. **Type scale** (measured in 003): `t-large` 700 26px/1.15 −0.022em (doc title, page titles) · `t-title1` 700 22px/1.2 −0.02em (peek title) · `t-title2` 600 17px/1.25 −0.012em (empty-state h3; the sheet h2 is the same size at 700) · `t-title3` 600 15px/1.3 −0.008em (unfiled card title; the toolbar title and the Next card title are also 600 15px) · `t-headline` weight 600 · body 13px · `t-callout` 12px · `t-caption` 11px `--label-2` · `t-eyebrow` 600 11px `--label-3` +0.01em (EVIDENCE eyebrows, Island) · `sec-eyebrow` 600 11px uppercase +0.07em `--label-3` (doc section eyebrows) · `.num` tabular numerals for every time, timer and count.
12. **Radii.** Tokens `--r-window` 16px, `--r-card` 12px, `--r-control` 8px, plus capsule 999px (buttons, chips, segmented, glass groups, search, toasts). Fixed: 22px onboarding panel · 20px sheets, alerts, notification banners, Island drop target · 18px Island pill (h/2), details drawer · 14px popovers, side-peek corner · 12px menus, Worth asking, candidates · 10px text field lg · 9px doc chips · 7px popup button, editable blocks · 6px menu items, keycaps, tooltips · 5px source chips, menu-bar items · 3px file badges.
13. **Four shadows; hairline rings do the border work.** `--shadow-card` (cards at rest), `--shadow-card-hover` (interactive hover, Next card), `--shadow-float` (popovers, menus, toasts, notifications, drawer, tooltips), `--shadow-window` (window, sheets, alerts, onboarding). Each starts with a 0.5px ring; dark float and window shadows add an inset 0.5px top highlight.
14. **Focus is an outline, fields get a ring.** `:focus-visible` → `outline: 3px solid color-mix(in srgb, var(--accent) 45%, transparent); outline-offset: 1px`. Fields: `inset 0 0 0 0.5px var(--accent)` + `0 0 0 3.5px` accent at 32%. Focus is never shown by shadow alone on non-fields.
15. **Icons are SF-Symbols-style line glyphs.** 74 icons on a 24×24 grid, round caps and joins, `currentColor` stroke 1.6 (xl 1.4); sizes sm 13, md 16, lg 20, xl 28. Build them with lucide-react (mapping below).
16. **Motion follows Emil Kowalski's rules** (sketch MANIFEST): fast ease-out for UI under 300ms, exits faster than enters, springs only for morphs and landings, never from scale(0), keyboard navigation instant, reduced motion keeps meaning and drops movement. 003's "Do vs don't" demo is the reference: 0.96 → 1 in 190ms `--ease-out` from the trigger corner beats scale(0) → 1 in 400ms ease-in from the centre.

**Layout metrics:** menu bar 26px (`--menubar-h`) · toolbar 52px (`--toolbar-h`, also the sidebar's top inset) · sidebar 236px in the kit, 244px in 002 (`.t-app`) · side peek `max(440px, 44%)` (`--peek-w`) · doc column `min(720px, 100% − 112px)` · details drawer 340px · onboarding panel 420 × 530px · Island pill 300 × 36px, cards 440px · alert 280px · notification stack 348px · sheet 520px (`--sheet-w`).

**Control heights:** glass group 34 · btn lg 34 · doc chip 30 · btn 28 · field 28 (lg 36) · segmented 28 · btn sm 24 · popup 24 · keycap 22 · chip 20 · avatar 20 · source 18 · switch 18 · check 17. Smallest hit target is the 17px check inside a ≥ 24px row; icon buttons are 24–28px.

**Spacing in use (px; the kit has no spacing tokens):** 2 segmented inset (glass group 3) · 4 chip and icon gaps (menu inset 5) · 6 button gap, popover inset · 8 toolbar gap, row padding, toast gap · 10 sidebar inset, list-row gap · 12 card grid gap, toolbar right inset · 14 card side padding, time-column gap · 18 toolbar left inset, alert padding · 22 sheet padding · 24 peek gutters, doc blocks · 28 agenda side padding · 44 doc section rhythm.

## Components

| Component | Role | Key variants/states | Maps to |
|---|---|---|---|
| ColorTokens | Semantic color, both themes | light, dark | CSS variables in `globals.css` → Tailwind colors (`var(--accent)` …) |
| SeriesColors | Series identity + fixed hex | blue, orange, green, purple, teal, pink, gray | Tailwind `colors.series.*`; data stores the token name |
| Typography | Type scale and text utilities | large … caption, eyebrow, section-eyebrow, num, muted, faint, truncate | Tailwind `fontSize`/`fontFamily` + a `<Text variant>` helper |
| RadiiAndSpacing | Radii, layout metrics, heights | window, card, control, capsule + fixed ladder | Tailwind `borderRadius`; layout constants |
| Elevation | Four shadows | card, card-hover, float, window | Tailwind `boxShadow` |
| Materials | Glass recipes | 7 recipes | Tailwind arbitrary utilities; Tauri vibrancy for the sidebar |
| FocusRing | Keyboard focus | outline (buttons, checks), ring (fields, search) | `focus-visible:` utilities; Radix exposes focus-visible |
| MotionTokens | Curves and durations | 5 easings, 6 named durations | `motion.ts` presets + Tailwind `transitionTimingFunction` |
| Iconography | 74 glyphs | sm 13, md 16, lg 20, xl 28 | lucide-react (`strokeWidth` 1.6) + a local `Icon` wrapper |
| AppIcon | Mark and template glyph | 20 (sm), 32 (md), 56, 60 (onboarding); template | Static asset component; Tauri tray icon with `icon_as_template(true)` |
| Motion principles | The 12 rules | — | `<MotionConfig reducedMotion="user">` at the root |
| Timing map | All 148 timed phases | — | Exported constants in `motion.ts` |
| Reduced motion · fallbacks | Reduced-motion policy | — | MotionConfig + CSS media block + `useReducedMotion()` gates |

Full props, states and a11y per entry: component-inventory.md › ColorTokens, SeriesColors, Typography, RadiiAndSpacing, Elevation, Materials, FocusRing, MotionTokens, Iconography, AppIcon, Motion principles, Timing map, Reduced motion · fallbacks.

- **ColorTokens.** The current `globals.css` holds shadcn HSL-channel variables (`--accent: 239 74.3% 96%`, `--border: 60 7.1% 89.4%`) read as `hsl(var(--x))`. Telu's `--accent` and `--border` have the same names with hex/rgba values, so they must replace the shadcn blocks in the same change that repoints `tailwind.config.js` (see "Integrating with the existing shadcn setup"). Pasting both breaks `bg-accent` and `border-border` silently (`hsl(#6366E8)` is invalid).
- **MotionTokens.** CSS keeps the `linear()` springs; React uses the framer presets in `motion.ts`. Components import named transitions and never inline numbers (003 Timing map: "motion.ts: DURATION.popoverOpen = 0.19").
- **Iconography.** A local `Icon` wrapper renders lucide at `size` 13/16/20/28 and `strokeWidth` 1.6 (1.4 at 28), `aria-hidden`. Keep custom SVGs for the glyphs lucide lacks: `apple` and `control` (menu-bar only, not needed in the real app), `decision` (kit: hexagon + check; lucide `badge-check` is the closest), filled `record` (circle) and `stop` (square).
- **AppIcon.** 56px squircle, radius 22.5%, gradient #7C7FF3 → #5053D8, `inset 0 0.5px 0 rgba(255,255,255,0.35), 0 1px 3px rgba(23,25,31,0.18)`; the mark is `telu-icon.png` inverted to white at 64%. Notification banners use 32px with radius 8px. The menu-bar glyph is `telu-menubar.png` with `filter: var(--template-filter)` (none in light, `invert(1)` in dark); in production it is the tray icon with `icon_as_template(true)`, so the OS tints it.

Icon names (kit → lucide-react): calendar → calendar · calendar-plus → calendar-plus · calendar-check → calendar-check · clock → clock · sun → sun · tray → inbox · tray-down → import · sparkle → sparkle · sparkles → sparkles · doc → file-text · doc-plus → file-plus · notes → notepad-text · folder → folder · paperclip → paperclip · link → link · repeat → refresh-cw · check → check · check-circle → circle-check · x → x · x-circle → circle-x · plus → plus · minus → minus · chevron-right/left/down → chevron-right/left/down · chevron-updown → chevrons-up-down · ellipsis → ellipsis · search → search · sidebar → panel-left · inspector → panel-right · compose → square-pen · pencil → pencil · trash → trash-2 · archive → archive · person → user · people → users · lock → lock · cloud → cloud · mic → mic · record → circle (filled) · stop → square (filled) · pause → pause · play → play · waveform → audio-lines · video → video · bell → bell · arrow-up-right → arrow-up-right · arrow-right → arrow-right · return → corner-down-left · undo → undo-2 · command → command · sliders → sliders-horizontal · pin → pin · flag → flag · target → target · list → list · quote → message-circle · question → circle-help · info → info · decision → badge-check · commitment → corner-down-right · fact → book-open · history → history · bolt → zap · grip → grip-vertical · eye → eye · lightbulb → lightbulb · share → share · thumbs-up → thumbs-up · hand → hand · wifi → wifi · battery → battery-full · apple, control → system glyphs (prototype menu bar only).

Context overrides: chip icon 12px stroke 1.8 · source 10px stroke 2 · knowledge type 13px stroke 1.9 · menu item 14px `--label-2` · series icon glyph 12px stroke 2 in white · sidebar row 16px `--accent` · menu bar 15px · empty state xl in `--label-3`.

## Motion

### Tokens

| Token | CSS value | Used for | framer-motion |
|---|---|---|---|
| `--ease-out` | `cubic-bezier(0.23, 1, 0.32, 1)` | Every UI enter/exit, press, fade (150–260ms) | `ease: [0.23, 1, 0.32, 1]` |
| `--ease-in-out` | `cubic-bezier(0.77, 0, 0.175, 1)` | Movement on screen: agenda FLIP (320ms), notification exit (240ms) | `ease: [0.77, 0, 0.175, 1]` |
| `--ease-drawer` | `cubic-bezier(0.32, 0.72, 0, 1)` | Side peek and details drawer (open 300ms, close 200ms) | `ease: [0.32, 0.72, 0, 1]` |
| `--spring` / `--spring-dur` | `linear(…)` 37 points / 490ms | Island size morph, notification slide-in | 003 preset `{ type: 'spring', duration: 0.4, bounce: 0.12 }` |
| `--spring-bounce` / `--spring-bounce-dur` | `linear(…)` 37 points / 600ms | Switch knob, Island "Attached" | 003 preset `{ type: 'spring', duration: 0.5, bounce: 0.28 }` |

Named durations (003 MotionTokens): press 140 · fast 160 (colors and hover 120–160, menu close 120, tooltip 125) · base 220 (popover 150/190, alert 180/220, sheet 200/260, toast 220/340, rec capsule 240) · drawer 300 (close 200) · spring 490 · spring-bounce 600. Flights use split curves: x `cubic-bezier(0.45, 0, 0.2, 1)`, y/scale/opacity `cubic-bezier(0.6, 0, 0.9, 0.7)`.

**Spring equivalence (verified by fitting the `linear()` points).** Both curves are ideal damped springs cut off at their CSS runtime (RMS error 0.0001). The bounce values in 003 are exact; the framer durations are not.

| CSS token | Fitted spring | Peak at | 003 Animations preset | 003 MotionTokens quote | Exact framer match |
|---|---|---|---|---|---|
| `--spring` 490ms | bounce 0.12 (ζ 0.88), ω 15.8 rad/s, 0.3% overshoot | ~419ms | `duration: 0.4` → peak ~309ms | `duration: 0.49` → ~378ms | `{ type: 'spring', bounce: 0.12, visualDuration: 0.33 }` |
| `--spring-bounce` 600ms | bounce 0.28 (ζ 0.72), ω 12.5 rad/s, 3.8% overshoot | ~363ms | `duration: 0.5` → peak ~235ms | `duration: 0.6` → ~282ms | `{ type: 'spring', bounce: 0.28, visualDuration: 0.42 }` |

framer's `duration` on a spring is a settle time (envelope down to 0.1%), so 003's presets arrive 25–35% sooner than the approved CSS. `visualDuration` (available in the installed framer-motion 11.18.2) sets ω = 2π / (1.2 × visualDuration) and reproduces the CSS curves; the equivalent plain `duration` values are ≈ 0.54 and ≈ 0.77. `motion.ts` below uses the exact match; 003's entries that write `duration: 0.4 / 0.5` (Island morph, notification, switch knob, "Attached") should read `SPRING` / `SPRING_BOUNCE` instead.

### Motion principles (003, twelve rules)

1. **Keyboard navigation is instant.** ↑/↓ moves the selection ring and swaps the peek, ←/→ steps days, Enter opens the peek (`.instant`), ⌘W / ⌥Space hide and show the window: none of it animates. Keyboard commands that change state (⌘R, Enter to create, Space on a switch) animate that change like a click; Esc dismissals play the normal exit. Avoid sliding the peek or the day on every arrow press.
2. **Enter with ease-out, 150–260ms.** Popover 190, alert 220, capsule 240, sheet 260, onboarding 260 on `--ease-out`; panels 300 on `--ease-drawer`; list inserts 280. No ease-in or linear entrances, no 400ms+ for UI the user just asked for.
3. **Exit faster than you enter.** Popover 190→110 · alert 220→140 · sheet 260→160 · toast 340→180 · peek 300→200 · onboarding 260→160 · capsule 240→150 · Island content 90.
4. **Springs only for morphs, landings and drag.** Island shell, notification arrival, switch knob, "Attached". Never spring menus, toasts, page swaps or anything that only fades.
5. **Never from scale(0).** Start at 0.92–0.98 with opacity 0: popover and sheet 0.96, alert 0.95, toast 0.98, Island layer 0.97, onboarding 0.96; flights shrink no further than 0.4.
6. **Origin-aware popovers, instant menus.** Popovers scale from the trigger's centre on the edge facing it; menus appear at full opacity and only fade out after a 60ms selection blink.
7. **Transform and opacity.** Plus ≤ 2px blur to mask crossfades, `grid-template-rows` for collapsibles and height only in list insert/remove. The Island's width/height spring is the one deliberate layout animation. Never animate top/left, margins, shadow spread or font size; never `transition: all`.
8. **Interruptible by default.** State toggles are CSS transitions that retarget mid-flight (peek, drawer, popover, Island, collapsible). One-shots cancel the running animation, and a token drops stale swaps (day slide, page paint). No queued animations that must finish before the next click counts.
9. **Stagger 30–50ms, never block.** Agenda rows 40ms, morphAll 40ms, chip-in 40ms; Accept all uses 70ms so each item visibly lands in Memory. Input stays live throughout.
10. **Press feedback on everything pressable.** The scale tightens as the target grows: check 0.88 · source chip 0.96 (Island 0.95) · buttons, chips, Island pill 0.97 · sidebar rows 0.985 · cards 0.992. Hover styles only under `(hover: hover) and (pointer: fine)`.
11. **Loops mean status.** Rec dot, waveform, shimmer and spinner loop only while their state is true; a paused recording freezes them in place.
12. **Reduced motion keeps meaning, drops movement.** Opacity and color stay; slides, springs and flights go; status loops keep running and receive highlights stay.

### Enter vs exit

| Surface | Enter | Exit |
|---|---|---|
| Popover | 190ms transform · 150ms opacity | 110 · 110 |
| Alert | 220 · 180 | 140 · 120 |
| Sheet + scrim | 260 · 200 (scrim 220) | 160 · 140 |
| Toast | 340 transform · 220 opacity | 180 · 160 |
| Notification | 490 `--spring` | 240 `--ease-in-out` |
| Menu | instant | 120 opacity |
| Side peek / drawer | 300 `--ease-drawer` | 200 (`--ease-out` for the peek, `--ease-drawer` for the drawer) |
| Recording capsule | 240 `--ease-out` | 150 `ease-out` |
| List row insert / remove | 280 | 220 |

### Timing map (003's 148 phases, condensed per animation; from sec-motion.js and sec-motion-2.js)

Format: phase ms (+delay) easing, interrupt. Interrupt: **yes** = CSS transition retargets · **restart** = WAAPI/keyframes cancel and replay · **no** = runs to completion · **cancels/resets** = timers. `--ease-out` is the token; `ease-out` is the CSS keyword (framer `'easeOut'`). Names are component-inventory.md headings.

| Animation | Phases |
|---|---|
| Button · press | press 140 `--ease-out` yes · hover background 150 ease yes |
| Cards, rows & chips · press | card 160 `--ease-out` yes · row / chip / check 140 `--ease-out` yes · Island pill 180 `--ease-out` yes · card hover shadow 200 ease yes |
| Hover · reveal actions | reveal 150 ease yes |
| Segmented control · thumb | thumb 240 `--ease-out` yes · label color 160 ease yes |
| Switch · knob spring | knob 600 `--spring-bounce` yes · track 200 ease yes |
| Checkbox · stroke draw | fill 160 ease yes · stroke draw 220 (+40) `--ease-out` yes · press 140 `--ease-out` yes |
| Tooltip · delay, then instant | cold delay 650 cancels · show/hide 125 (+650) `--ease-out` yes · warm window 600 · warm show 0 instant |
| Popover · origin-aware scale | open 190 `--ease-out` yes · close 110 `--ease-out` yes |
| Menu · instant open, blink, fade | open 0 instant · select blink 60 step no · close fade 120 (+130) ease no |
| Sheet · scale in over a scrim | open 260 `--ease-out` yes · scrim 220 ease yes · close 160 `--ease-out` yes |
| Alert · appear & dismiss | open 220 `--ease-out` yes · close 140 `--ease-out` yes |
| Toast · enter, stack, exit | enter 340 `--ease-out` yes · exit 180 `--ease-out` yes · lifetime 4200 hover pauses · resume minimum 1200 |
| Notification banner · slide in & out | slide in 490 `--spring` yes · slide out 240 `--ease-in-out` yes · lifetime 7000 hover pauses · after hover 2500 |
| Window · hide & show | hide/show 0 instant |
| Toolbar · scroll-edge glass | glass on/off 200 ease yes |
| Toolbar · large-title hand-off | compact title 180 `--ease-out` yes |
| View switch · fade | fade in 200 `--ease-out` restart |
| Day stepper · directional slide | day out 140 `--ease-out` restart · day in 220 (+140) `--ease-out` restart |
| Agenda · stagger in | each row 280 `--ease-out` restart · stagger step 40 |
| Progress hairline · grow & fade | grow 900 linear restart · fade 220 (+900) ease-out restart |
| Event card · state morph | part out 110 ease-out restart · part in 190 (+110) `--ease-out` restart · accent bar 360 `--ease-out` yes · after-state fade 240 `--ease-out` restart · morphAll step 40 |
| Agenda rows · FLIP reflow | rows move 320 `--ease-in-out` restart |
| Now line · static by design | reposition 0 instant |
| Recording capsule · in & out | out 150 ease-out no · in 240 `--ease-out` restart (the +700 in 003 is the demo gap) |
| New series · parsed chips | debounce 90 resets · value in 180 (+90) `--ease-out` restart · chip color 180 (+90) ease yes |
| Side peek · slide in & out | open 300 `--ease-drawer` yes · close 200 `--ease-out` yes |
| Side peek · content swap | content out 110 ease-out restart · content in 190 (+110) `--ease-out` restart · keyboard swap 0 instant |
| Open as page · swap & reveal | page out 120 ease-out restart · page in 180 (+120) `--ease-out` restart · reveal flash 900 (+200) `--ease-out` restart · jump-to flash delay 360 |
| Collapsible · meetings & banner | rows 260 `--ease-out` yes · fade 200 ease yes · chevron 200 `--ease-out` yes · summary line 180 `--ease-out` yes |
| Next block · repaint | block out 120 ease-out restart · block in 200 (+120) `--ease-out` restart · brief prepared after 2600 |
| Live lines · append | each line 280 `--ease-out` restart (002 script: +1400, +3800, +5800) |
| Review · accept, correct, reject | row swap 0 instant · accept all step 70 · collapse beat 500 |
| List · remove & insert | remove 220 `--ease-out` no · insert 280 `--ease-out` no |
| Receive & bump · landing feedback | bump 420 `--ease-out` restart · receive 900 `--ease-out` restart · Memory item receive 1500 `--ease-out` restart |
| Save state · saving, saved & version bump | label color 150 ease yes · drafted chip out 160 ease-out no · version bump 420 `--ease-out` restart · save debounce 700 resets |
| Chips · attach, remove, include | chip in 280 `--ease-out` restart (+40 per chip) · include dot 150 ease yes · chip out 150 ease-out no |
| Drop targets · light up | sidebar drop-over 140 `--ease-out` yes · purpose wash 150 ease yes · drop hint 200 `--ease-out` yes |
| Transcript drawer · slide & shift | open 300 `--ease-drawer` yes · close 200 `--ease-drawer` yes · scrubber fade 200 ease yes · highlight line 300 ease yes |
| Scrubber · active tick & labels | labels 150 `--ease-out` yes · tick 200 `--ease-out` yes · tick receive 900 `--ease-out` restart |
| Fly to sidebar · new series | flight 560 split cubic-bezier no · landing row fade 150 (+560) ease yes · icon bump 420 (+560) `--ease-out` restart · row receive 900 (+560) `--ease-out` restart |
| Move meeting · fold out & fly | flight 560 + collapse 220 in parallel · count update delay 560 |
| Recording · pulse, bars & timer | rec dot 1400 ease-in-out loop · waveform bars 900 ease-in-out loop · timer tick 1000 step |
| Loading · shimmer & spinner | spinner 700 linear loop · shimmer 1300 linear loop |
| Island · morph between modes | old layer out 90 ease-out yes · shell spring (grow) 490 `--spring` yes · new layer in (grow) 240 (+80) `--ease-out` yes · shell spring (shrink) 490 (+90) `--spring` yes · new layer in (shrink) 240 (+170) `--ease-out` yes |
| Island · hover intent & pin | hover intent 150 cancels · leave grace 300 cancels · pill press 180 `--ease-out` yes |
| Island · attach & bouncy “Attached” | Attached 600 `--spring-bounce` yes · Attached dwell 1200 · drag idle timeout 1000 |
| Island · mint dot & suggestion | arrives after 1200 · dot in 300 (+1200) `--ease-out` no · card arrive 320 (+1340) `--ease-out` no · card leave 150 `--ease-out` no · dot pulse 1800 ease-in-out loop |
| Island · transcript typing | start delay 260 · word fade 160 `--ease-out` no · word step 80 |
| Island · stop → filing → after | each step 490 `--spring` · summary beat 900 |
| Island · hide & show | transform 180 `--ease-out` yes · opacity 220 `--ease-out` yes |
| Onboarding · panel open & close | open 260 `--ease-out` restart · close 160 `--ease-out` restart · first-run delay 420 |
| Onboarding · step slide & dots | step out 150 `--ease-out` restart · step in 220 (+40) `--ease-out` restart · dots 200 ease yes |
| Onboarding · finish flight | panel shrink 280 `--ease-out` no · icon flight 620 split cubic-bezier no · status bump 420 (+620) · status receive 900 (+620) · Island returns after 160 |

The Island, onboarding and area-specific entries are specified in their own reference files; this table is the single timing source.

### framer-motion setup

One module holds every curve and preset (`frontend/src/lib/motion.ts`):

```tsx
import type { Transition } from 'framer-motion'

export const EASE = {
  out: [0.23, 1, 0.32, 1],
  inOut: [0.77, 0, 0.175, 1],
  drawer: [0.32, 0.72, 0, 1],
  flightX: [0.45, 0, 0.2, 1],
  flightY: [0.6, 0, 0.9, 0.7],
} as const

export const SPRING: Transition = { type: 'spring', bounce: 0.12, visualDuration: 0.33 }
export const SPRING_BOUNCE: Transition = { type: 'spring', bounce: 0.28, visualDuration: 0.42 }
export const INSTANT: Transition = { duration: 0 }

export const DURATION = {
  press: 0.14,
  cardPress: 0.16,
  tooltip: 0.125,
  popoverOpen: 0.19,
  popoverClose: 0.11,
  menuClose: 0.12,
  alertOpen: 0.22,
  alertClose: 0.14,
  sheetOpen: 0.26,
  sheetClose: 0.16,
  scrim: 0.22,
  toastEnter: 0.34,
  toastExit: 0.18,
  crossfadeOut: 0.11,
  crossfadeIn: 0.19,
  viewFade: 0.2,
  listInsert: 0.28,
  listRemove: 0.22,
  flip: 0.32,
  drawerOpen: 0.3,
  drawerClose: 0.2,
  bump: 0.42,
  receive: 0.9,
  flight: 0.56,
} as const

export const PRESET = {
  press: { duration: DURATION.press, ease: EASE.out },
  popoverIn: { duration: DURATION.popoverOpen, ease: EASE.out, opacity: { duration: 0.15 } },
  popoverOut: { duration: DURATION.popoverClose, ease: EASE.out },
  crossfadeIn: { duration: DURATION.crossfadeIn, ease: EASE.out },
  crossfadeOut: { duration: DURATION.crossfadeOut, ease: 'easeOut' },
  listIn: { duration: DURATION.listInsert, ease: EASE.out },
  listOut: { duration: DURATION.listRemove, ease: EASE.out },
  flip: { duration: DURATION.flip, ease: EASE.inOut },
  drawerIn: { duration: DURATION.drawerOpen, ease: EASE.drawer },
  drawerOut: { duration: DURATION.drawerClose, ease: EASE.drawer },
} satisfies Record<string, Transition>
```

Root: reduced motion follows the OS, and the default transition is the popover enter (003 Motion principles mapping).

```tsx
<MotionConfig reducedMotion="user" transition={{ duration: 0.19, ease: [0.23, 1, 0.32, 1] }}>
  {children}
</MotionConfig>
```

Patterns used across the app:

```tsx
<AnimatePresence initial={false} mode="popLayout">
  <motion.div
    key={viewKey}
    initial={{ opacity: 0, filter: 'blur(2px)' }}
    animate={{ opacity: 1, filter: 'blur(0px)' }}
    transition={{ duration: DURATION.viewFade, ease: EASE.out }}
  />
</AnimatePresence>

<AnimatePresence mode="wait" initial={false}>
  <motion.div
    key={partKey}
    initial={{ opacity: 0, filter: 'blur(2px)' }}
    animate={{ opacity: 1, filter: 'blur(0px)', transition: PRESET.crossfadeIn }}
    exit={{ opacity: 0, filter: 'blur(2px)', transition: PRESET.crossfadeOut }}
  />
</AnimatePresence>

<motion.div layout="position" transition={PRESET.flip} />

<motion.div transition={selection.via === 'keyboard' ? INSTANT : PRESET.crossfadeIn} />
```

- **Asymmetric enter/exit:** put the enter transition inside `animate` and the exit transition inside `exit` (exits are always shorter).
- **`initial={false}`** wherever first paint must not animate (view host, lists, the Island's first paint and its return from hidden).
- **`mode="wait"`** for swaps where old and new must not overlap (card parts, day slide, Next block); **`mode="popLayout"`** where the new content arrives while the old is removed instantly (view switch, Island layers, onboarding steps).
- **Keyboard path:** keyboard handlers record the modality with the state change (`{ via: 'keyboard' }`), and the component uses `INSTANT` or renders without `AnimatePresence`. Never let a keyboard selection reach a transition.
- **Imperative motion** (flights, receive, bump, height fold) goes through `useAnimate()` and checks `useReducedMotion()` first, the way Kit JS checks `Kit.reduceMotion()`.
- **Stagger:** `variants={{ show: { transition: { staggerChildren: 0.04 } } }}`, children `{ opacity: 0, y: 6 } → { opacity: 1, y: 0 }` in 0.28s `EASE.out`; never disable input while it runs.

Landing feedback shared by many components (Receive & bump · landing feedback):

```tsx
const [scope, animate] = useAnimate()

animate(scope.current, { backgroundColor: ['var(--accent-soft)', 'var(--accent-soft)', 'rgba(0,0,0,0)'] }, { duration: 0.9, times: [0, 0.3, 1], ease: EASE.out })
animate(iconEl, { scale: [1, 1.18, 1] }, { duration: 0.42, times: [0, 0.4, 1], ease: EASE.out })
```

Memory items use 1.5s for the receive. Restart on every landing (cancel, then play again).

### Reduced-motion policy

- **CSS (kit):** under `prefers-reduced-motion: reduce`, `transition-property` is limited to opacity, background-color, color, box-shadow and border-color (`!important`) on every element, so transforms, sizes, grid rows and stroke draws snap; `.enter`, `.bump`, `.wave i` and `.shimmer` keyframes are off; `.rec-dot` slows to 2.4s; smooth scroll becomes auto. The Island block also stops `.il-mint-dot` and `.il-sugg.arrive`.
- **JS (kit and 002):** `Kit.flip`, `flyTo` (the target just receives), `removeAnimated`, `enterAnimated` return early; crossfade, fadeIn, day slide, page paint, Next repaint, recording capsule, onboarding panel and steps, and chip removal become instant; the peek opens with `.instant`; Island typing shows all words at once.
- **framer:** `reducedMotion="user"` makes width, height, top/left/right/bottom and every transform animate instantly and skips layout animations, while opacity, filter and colors still animate (verified in framer-motion 11.18.2 `positionalKeys`). That matches the policy; add explicit `useReducedMotion()` gates for `useAnimate` flights and CSS keyframe loops.
- **What stays:** the rec dot (slowed) and the spinner, the receive background flash, color and opacity fades. The waveform and the shimmer stop at rest.

Known reduced-motion gaps to close when building (003 README and the Reduced motion entry): the receive flash is not gated (keep it, it is background-only, but make that explicit); `.chip-in`, `.ver-bump` and `tick-receive` still move; the spinner keeps turning; mini dots (`.a-mini-dot`, `.countdown .mini-dot`) keep pulsing at 1.4s; the progress hairline (`T.runProgress`) is not gated. sonner removes every toast transition under reduced motion (its own CSS), while the kit keeps the opacity fade; accept that or override it.

## CSS Patterns

### Tokens (ready to paste)

Replace both shadcn blocks in `frontend/src/app/globals.css` (`@layer base { :root … .dark … }`) with this, in the same change as the Tailwind config below. `--wallpaper` (the prototype's fake desktop) is intentionally omitted.

```css
@layer base {
  :root {
    color-scheme: light;
    --accent: #6366E8;
    --accent-strong: #4F52D9;
    --accent-soft: rgba(99, 102, 232, 0.13);
    --accent-softer: rgba(99, 102, 232, 0.06);
    --on-accent: #FFFFFF;
    --mint: #67E8C5;
    --mint-ink: #0B9A77;
    --mint-soft: rgba(103, 232, 197, 0.24);
    --coral: #FF6B62;
    --coral-ink: #E0463D;
    --coral-soft: rgba(255, 107, 98, 0.14);
    --amber: #E8930C;
    --amber-soft: rgba(245, 165, 36, 0.16);
    --label: #17191F;
    --label-2: #727783;
    --label-3: rgba(23, 25, 31, 0.38);
    --label-4: rgba(23, 25, 31, 0.2);
    --window-bg: #F7F7F4;
    --content-bg: #FFFFFF;
    --surface: #FFFFFF;
    --surface-sunken: #F4F4F0;
    --fill: rgba(23, 25, 31, 0.045);
    --fill-2: rgba(23, 25, 31, 0.075);
    --fill-3: rgba(23, 25, 31, 0.11);
    --separator: rgba(23, 25, 31, 0.08);
    --hairline: rgba(23, 25, 31, 0.12);
    --border: #E6E6E2;
    --glass: rgba(246, 246, 243, 0.66);
    --glass-strong: rgba(251, 251, 249, 0.84);
    --glass-rim: rgba(255, 255, 255, 0.75);
    --glass-edge: rgba(23, 25, 31, 0.1);
    --sidebar: rgba(234, 234, 230, 0.6);
    --menubar: rgba(247, 247, 244, 0.62);
    --scrim: rgba(23, 25, 31, 0.16);
    --shadow-window: 0 0 0 0.5px rgba(0, 0, 0, 0.16), 0 24px 72px rgba(23, 25, 31, 0.26), 0 8px 22px rgba(23, 25, 31, 0.1);
    --shadow-float: 0 0 0 0.5px rgba(23, 25, 31, 0.12), 0 14px 36px rgba(23, 25, 31, 0.16), 0 2px 6px rgba(23, 25, 31, 0.07);
    --shadow-card: 0 0 0 0.5px rgba(23, 25, 31, 0.07), 0 1px 2px rgba(23, 25, 31, 0.05);
    --shadow-card-hover: 0 0 0 0.5px rgba(23, 25, 31, 0.09), 0 6px 18px rgba(23, 25, 31, 0.08);
    --series-blue: #0A84FF;
    --series-orange: #FF9F0A;
    --series-green: #30B955;
    --series-purple: #AF52DE;
    --series-teal: #2FA8C0;
    --series-pink: #FF375F;
    --series-gray: #8E8E93;
    --template-filter: none;

    --font: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", system-ui, sans-serif;
    --font-display: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", system-ui, sans-serif;
    --font-rounded: ui-rounded, "SF Pro Rounded", -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
    --font-mono: ui-monospace, "SF Mono", Menlo, monospace;
    --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
    --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
    --ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
    --spring: linear(0, 0.0203, 0.0717, 0.1424, 0.2237, 0.309, 0.3939, 0.4753, 0.5511, 0.6203, 0.6822, 0.7367, 0.7842, 0.825, 0.8596, 0.8887, 0.9129, 0.9329, 0.9491, 0.9621, 0.9725, 0.9807, 0.9871, 0.9919, 0.9955, 0.9982, 1.0001, 1.0014, 1.0022, 1.0027, 1.0029, 1.003, 1.0029, 1.0027, 1.0025, 1.0023, 1);
    --spring-dur: 490ms;
    --spring-bounce: linear(0, 0.0196, 0.0706, 0.1431, 0.2287, 0.3209, 0.4146, 0.5058, 0.5918, 0.6708, 0.7416, 0.8037, 0.857, 0.9019, 0.9388, 0.9684, 0.9915, 1.009, 1.0216, 1.0301, 1.0354, 1.0379, 1.0384, 1.0373, 1.0351, 1.0322, 1.0288, 1.0252, 1.0216, 1.0182, 1.0149, 1.012, 1.0093, 1.007, 1.005, 1.0034, 1);
    --spring-bounce-dur: 600ms;
    --menubar-h: 26px;
    --toolbar-h: 52px;
    --sidebar-w: 244px;
    --peek-w: max(440px, 44%);
    --r-window: 16px;
    --r-card: 12px;
    --r-control: 8px;
  }

  .dark {
    color-scheme: dark;
    --accent: #7C7FF2;
    --accent-strong: #9092F6;
    --accent-soft: rgba(124, 127, 242, 0.22);
    --accent-softer: rgba(124, 127, 242, 0.1);
    --on-accent: #FFFFFF;
    --mint: #67E8C5;
    --mint-ink: #67E8C5;
    --mint-soft: rgba(103, 232, 197, 0.16);
    --coral: #FF6B62;
    --coral-ink: #FF8A83;
    --coral-soft: rgba(255, 107, 98, 0.18);
    --amber: #FFB340;
    --amber-soft: rgba(255, 179, 64, 0.16);
    --label: #F2F2EF;
    --label-2: #9DA1AC;
    --label-3: rgba(242, 242, 239, 0.4);
    --label-4: rgba(242, 242, 239, 0.22);
    --window-bg: #1B1C21;
    --content-bg: #1F2026;
    --surface: #26272E;
    --surface-sunken: #1A1B20;
    --fill: rgba(255, 255, 255, 0.05);
    --fill-2: rgba(255, 255, 255, 0.085);
    --fill-3: rgba(255, 255, 255, 0.13);
    --separator: rgba(255, 255, 255, 0.08);
    --hairline: rgba(255, 255, 255, 0.12);
    --border: rgba(255, 255, 255, 0.1);
    --glass: rgba(38, 39, 46, 0.62);
    --glass-strong: rgba(44, 45, 53, 0.82);
    --glass-rim: rgba(255, 255, 255, 0.1);
    --glass-edge: rgba(0, 0, 0, 0.5);
    --sidebar: rgba(34, 35, 42, 0.62);
    --menubar: rgba(22, 22, 27, 0.55);
    --scrim: rgba(0, 0, 0, 0.36);
    --shadow-window: 0 0 0 0.5px rgba(0, 0, 0, 0.7), inset 0 0.5px 0 rgba(255, 255, 255, 0.1), 0 24px 72px rgba(0, 0, 0, 0.55), 0 8px 22px rgba(0, 0, 0, 0.3);
    --shadow-float: 0 0 0 0.5px rgba(0, 0, 0, 0.6), inset 0 0.5px 0 rgba(255, 255, 255, 0.08), 0 14px 36px rgba(0, 0, 0, 0.45), 0 2px 6px rgba(0, 0, 0, 0.25);
    --shadow-card: 0 0 0 0.5px rgba(255, 255, 255, 0.07), 0 1px 2px rgba(0, 0, 0, 0.3);
    --shadow-card-hover: 0 0 0 0.5px rgba(255, 255, 255, 0.1), 0 6px 18px rgba(0, 0, 0, 0.35);
    --series-blue: #0A84FF;
    --series-orange: #FF9F0A;
    --series-green: #32D74B;
    --series-purple: #BF5AF2;
    --series-teal: #40C8E0;
    --series-pink: #FF375F;
    --series-gray: #98989D;
    --template-filter: invert(1);
  }
}
```

### Base, focus, scrollbars, reduced motion

```css
body {
  font: 13px/1.38 var(--font);
  color: var(--label);
  background: var(--window-bg);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  cursor: default;
  user-select: none;
  -webkit-user-select: none;
}
button { font: inherit; color: inherit; cursor: default; }
input, textarea, [contenteditable="true"] { cursor: text; user-select: text; -webkit-user-select: text; }
.selectable { user-select: text; -webkit-user-select: text; }

:focus-visible { outline: 3px solid color-mix(in srgb, var(--accent) 45%, transparent); outline-offset: 1px; }

*::-webkit-scrollbar { width: 11px; height: 11px; }
*::-webkit-scrollbar-track { background: transparent; }
*::-webkit-scrollbar-thumb { background: var(--fill-3); border-radius: 999px; border: 3px solid transparent; background-clip: content-box; }
*::-webkit-scrollbar-thumb:hover { background-color: var(--label-4); }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { transition-property: opacity, background-color, color, box-shadow, border-color !important; scroll-behavior: auto !important; }
  .enter, .bump, .wave i, .shimmer { animation: none !important; }
  .rec-dot { animation-duration: 2.4s !important; }
}
```

The kit paints `body` with `--wallpaper` (the prototype desktop); the app uses `--window-bg`. The kit also removes the outline on `.field`, `.switch`, `.menu` and `.sheet` (fields draw their own ring). Do not copy the `.switch` removal: give the switch a ring (known gap).

### Type and text utilities

```css
.t-large { font: 700 26px/1.15 var(--font-display); letter-spacing: -0.022em; }
.t-title1 { font: 700 22px/1.2 var(--font-display); letter-spacing: -0.02em; }
.t-title2 { font: 600 17px/1.25 var(--font-display); letter-spacing: -0.012em; }
.t-title3 { font: 600 15px/1.3 var(--font); letter-spacing: -0.008em; }
.t-headline { font-weight: 600; }
.t-callout { font-size: 12px; }
.t-caption { font-size: 11px; color: var(--label-2); }
.t-eyebrow { font-size: 11px; font-weight: 600; color: var(--label-3); letter-spacing: 0.01em; }
.sec-eyebrow { font-size: 11px; font-weight: 600; letter-spacing: 0.07em; text-transform: uppercase; color: var(--label-3); }
.muted { color: var(--label-2); }
.faint { color: var(--label-3); }
.num { font-variant-numeric: tabular-nums; }
.truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.superseded-text { text-decoration: line-through; text-decoration-color: var(--label-4); color: var(--label-3); }
```

### Materials

| Surface | Recipe |
|---|---|
| Window (sidebar material) | `background: var(--sidebar); backdrop-filter: blur(40px) saturate(1.7)`; `--shadow-window`; radius 16 |
| Menu bar (prototype) | `var(--menubar)`; blur(30px) saturate(1.8); `box-shadow: 0 0.5px 0 var(--separator)` |
| Toolbar, scrolled | `color-mix(in srgb, var(--content-bg) 76%, transparent)`; blur(18px) saturate(1.6); `0 0.5px 0 var(--separator)` (peek bar: 82%) |
| Glass group | `var(--glass-strong)`; blur(16px) saturate(1.6); `0 0 0 0.5px var(--glass-edge), inset 0 0.5px 0 var(--glass-rim), 0 2px 10px rgba(23,25,31,0.06)` |
| Tooltip | `var(--glass-strong)`; blur(20px); `--shadow-float` |
| Toast | `var(--glass-strong)`; blur(24px) saturate(1.8); `--shadow-float` |
| Popover, menu | `var(--glass-strong)`; blur(26px) saturate(1.8); `--shadow-float` |
| Island, details drawer | `var(--glass-strong)`; blur(30px) saturate(1.8); `--shadow-float` (Island adds `inset 0 0.5px 0 var(--glass-rim)`) |
| Sheet, alert, onboarding | `var(--glass-strong)`; blur(34px) saturate(1.8); `--shadow-window` |
| Notification banner | `var(--glass-strong)`; blur(34px) saturate(1.8); `--shadow-float` |
| Scrubber on hover | `var(--glass-strong)`; blur(20px) saturate(1.6); `--shadow-float` |
| Scrim | `var(--scrim)` behind sheets |

Always write both `backdrop-filter` and `-webkit-backdrop-filter` (WKWebView). Text on glass uses label tokens only.

### Landing keyframes

```css
.enter { animation: kit-enter 280ms var(--ease-out) both; animation-delay: calc(var(--i, 0) * 40ms); }
@keyframes kit-enter { from { opacity: 0; transform: translateY(6px); } }
.receive { animation: kit-receive 900ms var(--ease-out); }
@keyframes kit-receive { 0%, 30% { background-color: var(--accent-soft); } 100% { background-color: transparent; } }
.bump { animation: kit-bump 420ms var(--ease-out); }
@keyframes kit-bump { 40% { transform: scale(1.18); } }
```

Restart a one-shot by removing the class, forcing a reflow, adding it back. Status loops (rec dot, waveform, shimmer, spinner) are in primitives-and-overlays.md.

### Tailwind theme extension

`tailwind.config.js` sketch. Colors point straight at the variables (no `hsl()` wrapper). Opacity modifiers such as `bg-accent/50` do not work with hex variables in Tailwind 3; use the `-soft` / `-softer` tokens or `color-mix()` instead.

```js
module.exports = {
  darkMode: ['class'],
  future: { hoverOnlyWhenSupported: true },
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"Helvetica Neue"', 'system-ui', 'sans-serif'],
        display: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', '"Helvetica Neue"', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', '"SF Mono"', 'Menlo', 'monospace'],
      },
      fontSize: {
        large: ['26px', { lineHeight: '1.15', letterSpacing: '-0.022em', fontWeight: '700' }],
        title1: ['22px', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '700' }],
        title2: ['17px', { lineHeight: '1.25', letterSpacing: '-0.012em', fontWeight: '600' }],
        title3: ['15px', { lineHeight: '1.3', letterSpacing: '-0.008em', fontWeight: '600' }],
        body: ['13px', { lineHeight: '1.38' }],
        callout: '12px',
        caption: '11px',
        eyebrow: ['11px', { letterSpacing: '0.01em', fontWeight: '600' }],
      },
      colors: {
        accent: { DEFAULT: 'var(--accent)', strong: 'var(--accent-strong)', soft: 'var(--accent-soft)', softer: 'var(--accent-softer)', foreground: 'var(--on-accent)' },
        mint: { DEFAULT: 'var(--mint)', ink: 'var(--mint-ink)', soft: 'var(--mint-soft)' },
        coral: { DEFAULT: 'var(--coral)', ink: 'var(--coral-ink)', soft: 'var(--coral-soft)' },
        amber: { DEFAULT: 'var(--amber)', soft: 'var(--amber-soft)' },
        label: { DEFAULT: 'var(--label)', 2: 'var(--label-2)', 3: 'var(--label-3)', 4: 'var(--label-4)' },
        window: 'var(--window-bg)',
        content: 'var(--content-bg)',
        surface: { DEFAULT: 'var(--surface)', sunken: 'var(--surface-sunken)' },
        fill: { DEFAULT: 'var(--fill)', 2: 'var(--fill-2)', 3: 'var(--fill-3)' },
        separator: 'var(--separator)',
        hairline: 'var(--hairline)',
        glass: { DEFAULT: 'var(--glass)', strong: 'var(--glass-strong)', rim: 'var(--glass-rim)', edge: 'var(--glass-edge)' },
        scrim: 'var(--scrim)',
        series: { blue: 'var(--series-blue)', orange: 'var(--series-orange)', green: 'var(--series-green)', purple: 'var(--series-purple)', teal: 'var(--series-teal)', pink: 'var(--series-pink)', gray: 'var(--series-gray)' },
        background: 'var(--content-bg)',
        foreground: 'var(--label)',
        primary: { DEFAULT: 'var(--accent)', foreground: 'var(--on-accent)' },
        secondary: { DEFAULT: 'var(--fill-2)', foreground: 'var(--label)' },
        muted: { DEFAULT: 'var(--fill)', foreground: 'var(--label-2)' },
        destructive: { DEFAULT: 'var(--coral)', foreground: '#FFFFFF' },
        popover: { DEFAULT: 'var(--glass-strong)', foreground: 'var(--label)' },
        card: { DEFAULT: 'var(--surface)', foreground: 'var(--label)' },
        border: 'var(--hairline)',
        input: 'var(--hairline)',
        ring: 'var(--accent)',
      },
      borderRadius: { window: 'var(--r-window)', card: 'var(--r-card)', control: 'var(--r-control)' },
      boxShadow: { card: 'var(--shadow-card)', 'card-hover': 'var(--shadow-card-hover)', float: 'var(--shadow-float)', window: 'var(--shadow-window)' },
      transitionTimingFunction: { out: 'var(--ease-out)', 'in-out': 'var(--ease-in-out)', drawer: 'var(--ease-drawer)', spring: 'var(--spring)', 'spring-bounce': 'var(--spring-bounce)' },
      transitionDuration: { press: '140ms', fast: '160ms', base: '220ms', drawer: '300ms', spring: '490ms', 'spring-bounce': '600ms' },
      keyframes: {
        'kit-enter': { from: { opacity: '0', transform: 'translateY(6px)' } },
        'kit-receive': { '0%, 30%': { backgroundColor: 'var(--accent-soft)' }, '100%': { backgroundColor: 'transparent' } },
        'kit-bump': { '40%': { transform: 'scale(1.18)' } },
      },
      animation: {
        enter: 'kit-enter 280ms var(--ease-out) both',
        receive: 'kit-receive 900ms var(--ease-out)',
        bump: 'kit-bump 420ms var(--ease-out)',
      },
    },
  },
}
```

`ease-out` and `ease-in-out` intentionally override Tailwind's defaults with the Telu curves. Keep the existing plugins (`tailwindcss-animate`, typography, container-queries), and never name a keyframe `enter` or `exit`: tailwindcss-animate reads `theme.keyframes.enter/exit` for shadcn's `animate-in` / `animate-out`. Use the type sizes with `font-display` for large, title1 and title2.

### Integrating with the existing shadcn setup

| shadcn class family | Its meaning | Point it at |
|---|---|---|
| `background` / `foreground` | page background / text | `--content-bg` / `--label` |
| `primary` | primary action | `--accent` / `--on-accent` |
| `secondary` | secondary button | `--fill-2` / `--label` |
| `muted` | quiet fill / secondary text | `--fill` / `--label-2` |
| `accent` | highlighted item (DropdownMenu focus, cmdk selected) | `--accent` / `--on-accent`: matches Telu's accent-filled menu row and selected list row |
| `popover`, `card` | floating / card surface | `--glass-strong`, `--surface` |
| `border`, `input` | outlines | `--hairline` |
| `ring` | focus | `--accent` |
| `destructive` | danger | `--coral` / white |

Because `accent` now means Telu Indigo, shadcn's ghost and outline buttons (`hover:bg-accent`) would turn fully indigo on hover; Telu's own Button variants replace them (primitives-and-overlays.md). The overlay components also need their default animations, radii and materials replaced (`bg-popover` alone is translucent without the backdrop blur; same file).

## HTML Structures

```html
<svg class="i" aria-hidden="true"><use href="#i-calendar"/></svg>
<svg class="i sm" aria-hidden="true"><use href="#i-lock"/></svg>

<div class="app-icon"><img src="telu-icon.png" alt=""></div>
<div class="app-icon sm"><img src="telu-icon.png" alt=""></div>
<img src="telu-menubar.png" class="template-img" alt="">

<h1 class="doc-title t-large">Product Sync</h1>
<span class="sec-eyebrow">Purpose</span>
<span class="t-eyebrow">EVIDENCE · SEP 22 · 18:42</span>
<span class="num">10:00–10:45</span>
<span class="series-dot" style="--c: var(--series-teal)"></span>
```

JSX equivalents: `<Calendar size={16} strokeWidth={1.6} aria-hidden />`, `<AppIcon size={56} />`, `<Text variant="large" as="h1">`. Headings keep semantic h1–h3 whatever their visual variant.

## Behavior & State

- **Theme.** Light tokens on `:root`, dark on `.dark` (the app's Tailwind uses `darkMode: ['class']`); toggle `.dark` on `<html>` from the system appearance. The switch is instant: no transition on `:root`; components keep their own 150–200ms color transitions. `color-scheme` switches native scrollbars and form controls.
- **Hover** exists only on fine pointers (`@media (hover: hover) and (pointer: fine)`, Tailwind `hoverOnlyWhenSupported`); touch shows hover-revealed actions permanently.
- **Interruptibility.** Toggles are CSS transitions or framer `animate` targets that retarget from the current value. One-shot swaps cancel what is running and keep a token so a stale swap never paints over a newer one (002 `swap()` pattern). Never lock input while something animates.
- **Accessibility.** `--label-3` and `--label-4` only for non-essential text; mint text uses `--mint-ink`; coral text uses `--coral-ink`. Every state that uses color also changes shape or text (dot, chip label, strikethrough). Body 13px, nothing below 10.5px. Icons are `aria-hidden`; the control carries the label. Shadows are decorative; focus is never shown by shadow alone.
- **Reduce transparency** should fall back to opaque `--content-bg` on glass; 002 does not implement it.

Known gaps (003 README and this synthesis):

- Switch has no visible focus ring (the kit removes its outline); text fields and checkboxes have no disabled style.
- Icon-only buttons are missing `aria-label`s in places (002 uses `data-tip` only).
- Reduced-motion gaps listed above (receive, chip-in, ver-bump, tick-receive, spinner, mini dots, progress hairline).
- Spring presets disagree inside 003 (Animations 0.4/0.5, MotionTokens 0.49/0.6); use the verified `visualDuration` presets.
- Keyboard-summoned popovers (⌥⌘N, ⌘F) animate like clicks in 002; production may open them instantly.

## What to Avoid

- **`transition: all`** or animating top/left, margins, shadow spread or font size (rule 7). List the properties.
- **scale(0) entrances, ease-in or linear entrances, 400ms+ UI** (rules 2 and 5). The 003 "Don't" demo is exactly this.
- **Animating keyboard navigation** (arrow selection, day stepping, Enter to open the peek, window hide/show). It makes fast scanning wait on motion.
- **Springs on menus, toasts, page swaps or fades.** Springs are for morphs and landings only.
- **Symmetric exits.** Dismissing must feel faster than arriving.
- **Decorative loops.** Loops are status and stop when the status ends.
- **Mint as decoration** (it loses its meaning), **coral as a general accent**, **indigo competing with state colors**, **neon or gradient-heavy "AI" styling** (palette doc direction; its logo section also rules out multicolor gradients and glowing purple).
- **Hex colors in series data.** Store the token name so dark mode and future palettes follow.
- **`linear()` in framer-motion.** It is CSS-only; use the `SPRING` presets.
- **Faking native motion in the webview.** Window hide/show, the menu bar and notifications are animated by macOS; `--wallpaper` and the fake menu bar exist only for the prototype, like 001's fake Keynote backdrop (not adopted).
- **Pasting the tokens next to shadcn's HSL variables** (`--accent`, `--border` collide).
- **Source Sans 3 or any web font for UI text.** The design is SF system type.

## Origin

Synthesized from sketches: 002, 003 (001 for the rejected alternatives).

Source files available in:
- `sources/themes/default.css`, `sources/themes/dark.css`
- `sources/kit/mac-kit.css`, `sources/kit/mac-kit.js`, `sources/kit/icons.js`, `sources/kit/data.js`, `sources/kit/telu-icon.png`, `sources/kit/telu-menubar.png`
- `sources/003-component-catalog/sec-foundations.js`, `sources/003-component-catalog/sec-motion.js`, `sources/003-component-catalog/sec-motion-2.js`, `sources/003-component-catalog/COMPONENTS.md`, `sources/003-component-catalog/README.md`
- `sources/002-final-app/app.css`, `sources/002-final-app/doc.css`, `sources/002-final-app/island.css`, `sources/002-final-app/app-agenda.js` (`T.fx` crossfade, fadeIn, flipRows)
- `sources/001-app-mental-model/README.md`
- Brand palette: `docs/telu/color-palette.md` (repo root, not copied)
