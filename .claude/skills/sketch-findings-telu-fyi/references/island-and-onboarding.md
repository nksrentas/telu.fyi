# Island & Onboarding

The Island is required, not optional (the user's decision for 001 C, built in 002). It is a glass capsule under the menu bar that floats above every app, morphs through the before, during and after of each meeting, and keeps working when the Telu window is closed. First-run onboarding is C's floating panel exactly as built: the window stays hidden, and the Telu icon flies into the menu-bar status item at the end. Rebuild target: a second Tauri window (label `island`), an onboarding panel window, `frontend/src/components/island/*` and `frontend/src/components/onboarding/*` (kebab-case files), plus the tray item in `frontend/src-tauri/src/tray.rs`.

## Design Decisions

1. **One ambient surface for the meeting moment.** The Island carries "your next meeting", "recording" and "filed, N to review" everywhere. It beat C's ⌘K command window and C's menu-bar dropdown panel, which were not adopted. It never replaces the app: every card has an "Open brief", "Open meeting" or "Review N" door back into the window. Closing the window (red light or ⌘W) only hides it. The Island and the status item keep running.
2. **Placement and material.**
   - Position: `position: fixed; top: calc(var(--menubar-h) + 10px)` (36px in the sketch), centred with `left: 0; right: 0; margin: 0 auto`, `transform-origin: 50% 0`, so it grows downward from its top edge.
   - Glass: `--glass-strong` with `backdrop-filter: blur(30px) saturate(1.8)`, `--shadow-float` plus `inset 0 0.5px 0 var(--glass-rim)`, and `overflow: hidden` so content never spills during a morph.
3. **Z-order:** app window (no z-index, `isolation: isolate`) < toasts 200 < **Island 260** < Island popovers 270 < menu bar 300 < notifications 350 < alerts 400. The expanded card may overlap the window. In 002 the window sits at `inset: calc(var(--menubar-h) + 56px) 132px 60px 24px`, so the compact pill floats in the 56px gap above it and the right 132px column holds the demo desktop file.
4. **Modes are set by the app; the Island owns only transient states.**
   - App modes: `setup | before | starting | live | filing | after | hidden`.
   - Island-owned: expanded or pinned cards, drag hint and drop target, timed flashes (`attached` 1.2s, `already` 1.4s, `invalid` 1.6s, `skipped` 1.7s), pause, and `filing` from the moment Stop is clicked until the app sets `after`.
5. **Sizes and radii.** Measured in 002 with its sample data. Widths are content-driven except the stated minimums. The pill is 36px high with radius `h/2 = 18`; cards have radius 22; the drop target has radius 20.

   | Variant | Size (w × h) | Content |
   |---|---|---|
   | setup | 138 × 36 | 16px template glyph · **Set up Telu** · › |
   | before | 300 × 36 (min 300) | series dot · **Product Sync** (max 190) · 10:00 · spacer · in 19m |
   | before · nothing next | 272 × 36 | calendar-check · "Nothing else on your calendar today" |
   | brief card (before / starting, expanded) | 440 × 344 | see IslandBriefCard |
   | starting | 356 × 36 (min 356) | coral dot · **Starting now** · "· Record?" · Record · Skip |
   | skipped (flash) | 226 × 36 | ⊗ "Not recording **Product Sync**" |
   | live | 208 × 36 → 224 × 36 with mint dot | rec dot · name (max 180) · 12:04 · wave (· mint dot) |
   | live card | 440 × 153 → 440 × 270 once the suggestion arrives | see IslandLiveCard |
   | live · paused | same sizes | dot and wave frozen, Pause → Resume |
   | filing | 198 × 36 | spinner 13px · "Filing to **Product Sync**…" |
   | after | 275 × 36 | ✓ · "Filed to **Product Sync**" · "· 5 to review" (amber) or "· all reviewed" |
   | after card (expanded) | 440 × 197 | see IslandFiledCard |
   | hint (file dragged anywhere) | 293 × 36 | paperclip · "Drop on Telu to attach to **Product Sync**" |
   | drop target (pointer within 10px) | 380 × 104 (fixed) | large paperclip · **Attach to Product Sync · 10:00** · "Goes into the brief · stays on this Mac" (live: "Goes with this meeting") |
   | attached (flash, bouncy) | 194 × 36 · 236 × 36 for 2 files | ✓ **Attached** / **Attached 2 files** · "in the brief" / "with this meeting" |
   | already / invalid (flash) | 169 × 36 / 296 × 36 | "Already in the brief" / "Telu attaches documents like “Plan.pdf”" |
   | hidden | size kept | `.gone`: opacity 0, `scale(0.95)`, no pointer events, `aria-hidden` |

6. **Pill anatomy:** 36px high, `padding: 0 16px 0 14px`, gap 8, 13px text, names in 600 weight. **Card anatomy:** 440px wide, `padding: 14px 16px 12px`, gap 11. The head has a 28px series icon, a title at 14px/600 and a sub line at 11.5px; body text is 13px/1.38; eyebrows use `.t-eyebrow` (11px/600 `--label-3`).
7. **Colour semantics are strict.**
   - Coral means recording: rec dot, wave, the starting dot with a 3px `--coral-soft` ring, the Stop square (9px, radius 2.5), Record.
   - Mint means "Telu found something worth asking", and only that: the 7px mint dot on the live pill, the "Worth asking" row of the brief card on `--mint-soft` at 60%, and the "Worth asking now" card with its 3px mint bar.
   - Accent means done or attach: the 18px ✓ circle and the paperclip.
   - Amber means "N to review".
8. **Morph choreography: the shell never pops.**
   - Every variant is a new absolutely positioned content layer inside one shell. The shell springs width, height and radius over `--spring-dur` 490ms on `--spring` (a `linear()` spring with about 0.3% overshoot).
   - The old layer fades out in 90ms at once. When the new area is **smaller**, the shell waits `--morph-delay: 90ms`, so content leaves before the glass shrinks, and the new layer enters at 170ms. When it **grows**, the shell starts immediately and the new layer enters 80ms later.
   - The new layer comes in from `opacity 0, blur 2px, scale 0.97` (opacity and filter 160ms, transform 240ms `--ease-out`).
   - Only "Attached" uses `--spring-bounce` (600ms, about 3.8% overshoot), the one playful moment.
   - The first paint after being hidden is instant, with no morph.
9. **Expansion is intent-based.** Resting the pointer on the shell for **150ms** expands it; the timer never starts while the pointer is over a button. Leaving collapses after a **300ms** grace unless the card is pinned. A click (not on a button), Enter or Space pins it. Esc or a click outside collapses it. Clicking the setup pill starts setup, and clicking the after pill opens Review. The after card opens only on hover. Cards exist only when there is a subject: before and starting need a brief, live needs a recording, after needs a filed meeting.
10. **Live shows at most one suggestion.** The last two transcript lines type in word by word at 80ms per word. The suggestion never appears the instant recording starts: it arrives 1.2s after live begins, if the bridge has one. The brief card shows only the first "Worth asking" question. Pause and Resume freeze the dot, wave and timer. Stop ⌘R hands off to "Filing…".
11. **Attach by dragging a document onto it.** It works while before, starting or live: a Finder file, or the demo desktop "Sprint 43 plan.pdf". Before the meeting, files go into the brief; while recording, they go with the meeting. Everything stays on this Mac.
12. **The Island reads, never writes.** It reads data only through the bridge at render time and reports intent through events. It binds no global shortcuts (the app owns ⌘R and ⌥Space) and never takes focus away from the app the user is in.
13. **The menu-bar status item mirrors the same state in one short phrase** (≤ ~24 characters), with the template glyph, and summons the window. It is not a menu or a panel.
14. **Onboarding is C's panel, unchanged.**
    - Panel: a glass panel of 420 × 530, radius 22, `--glass-strong` with `blur(34px) saturate(1.8)`, `--shadow-window`, centred at `top: 92px`.
    - Structure: three steps with three 6px dots and a 62px footer of actions.
    - During first run the main window is hidden and the Island is `hidden`. "Not now" leaves the Island showing "Set up Telu".
15. **Steps.**
    - Welcome, with the Before / During / After moments. Actions: "Not now" and "Connect Calendar".
    - The macOS permission alert.
    - "Which conversations should Telu remember?" with one switch per detected series. Action: "Remember N".
    - "Summon Telu anytime" with ⌥ + Space. Action: "Done".

    Denying access swaps step 1 in place for "Calendar access is off" and "Continue without calendar", then natural-language entry of series, then the same Summon step.
16. **Finish lands in the menu bar.** The panel shrinks away (opacity → 0, `scale(0.92)`, 280ms) while the 60px app icon arcs 620ms into the status item, which glows and bumps. The Island returns 160ms later showing the next meeting. The window stays hidden until summoned (⌥Space, the status item, or an Island action).

## Components

| Component | Role | Key variants / states | Maps to |
|---|---|---|---|
| Island | The morphing shell, modes and flashes | setup, before, before · nothing next, starting, skipped, live, live · found something, live · paused, filing, after, after · all reviewed, hidden, pressed | separate transparent always-on-top non-activating Tauri window (NSPanel) + framer-motion |
| IslandBriefCard | Before / starting expanded | before, starting (Skip), no purpose yet, docs-count bump | card layer |
| IslandLiveCard | Live expanded | recording with suggestion, listening, paused, typing | card layer with a streaming list |
| IslandSuggestionCard | "Worth asking now" | arriving, shown, leaving | card inside IslandLiveCard |
| IslandFiledCard | After expanded | to review, all reviewed | card layer |
| IslandAttach | Hint, drop target, confirmations | hint, drop (brief / live), attached, attached · several, attached · live, already there, not a document | drag-driven variants |
| IslandEvidencePopover | Source chips in cards | speech, document | Radix Popover inside the Island window (z 270) |
| DesktopFileIcon | Prototype-only draggable PDF | rest, selected | not shipped (real Finder files) |
| MenuBarStatusItem | Glyph + phrase, summons | icon only, next, starting, recording, filing, to review | Tauri tray icon, `icon_as_template(true)` + title |
| OnboardingPanel | First-run stepper | welcome, permission, detected, denied, manual (empty / typing / added), summon, opening, closing, finishing | its own always-on-top panel window with a React stepper |
| StepDots | 3 dots in the footer | step 1–3 | three spans + visually hidden "Step 2 of 3" |
| OnboardingMoment | Before / During / After rows | accent, coral | icon tile + two lines |
| DetectedRow | Found series + switch | on, off, ignored (disabled), truncated | row + Radix Switch |
| FlyIcon | Icon flight to the status item | resting, in flight, landed | portal flyer, or panel exit + tray title update |
| Alert | Calendar permission (prototype) | permission | native EventKit prompt in production |
| Switch, Keycap, TextField, SourceChip, RecDot, Waveform, Spinner | Primitives used here | see inventory | shadcn Switch, Input; custom |

Full specs are in component-inventory.md › Island, IslandBriefCard, IslandLiveCard, IslandSuggestionCard, IslandFiledCard, IslandAttach, IslandEvidencePopover, DesktopFileIcon, MenuBarStatusItem, OnboardingPanel, StepDots, OnboardingMoment, DetectedRow, FlyIcon, Alert, Switch, Keycap, TextField, SourceChip, RecDot, Waveform, Spinner. The animation entries are component-inventory.md › "Island · morph between modes", "Island · hover intent & pin", "Island · attach & bouncy “Attached”", "Island · mint dot & suggestion", "Island · transcript typing", "Island · stop → filing → after", "Island · hide & show", "Onboarding · panel open & close", "Onboarding · step slide & dots" and "Onboarding · finish flight".

Build notes:
- **Island**: key each content layer by `variant + subject id` (for example `before|ps-37`). A new next meeting therefore morphs even when the variant is unchanged. Updates to the same key are patched in place and the shell refits with no morph delay: timer width 9:59 → 10:00, mint dot, new transcript line, suggestion arriving, pause label, docs count.
- **IslandBriefCard.** The docs chip "3 docs" bumps (scale 1 → 1.18 → 1, 420ms) when an attach changes the count while the card is open. The fallback purpose line is "No purpose yet — open the brief to write one."
- **MenuBarStatusItem**: `tray.rs` already builds `main-tray` with a template icon and a native menu (record, pause, stop). 002's item has no dropdown. Its phrase goes in the tray title, and a click summons the window (or onboarding before setup).
- **OnboardingPanel**: key each step by `step + calendar` so the denied re-render at step 0 swaps content (direction 0 crossfades in place).

## Motion

The Island's own Enter, Space and Esc still morph, because that is the Island's state. App keyboard navigation never animates. `--spring` = framer `{ type: 'spring', bounce: 0.12, visualDuration: 0.33 }` and `--spring-bounce` = `{ type: 'spring', bounce: 0.28, visualDuration: 0.42 }`. These are the exact matches of the CSS curves, which settle at 490ms and 600ms (see foundations-and-motion.md › motion.ts). 003's entries that write `duration: 0.4–0.49` / `0.5–0.6` are approximations that arrive early; use `SPRING` / `SPRING_BOUNCE`.

| Animation | Trigger → properties | Enter / exit | Interruptible | Reduced motion |
|---|---|---|---|---|
| Shell morph | `set(mode)`, expand, collapse, flash, drag → width, height, border-radius | 490ms `--spring`; waits 90ms first when shrinking | yes (CSS retargets from the current size) | sizes snap |
| Layer crossfade | new variant → new layer from `.pre` (opacity 0, blur 2px, scale 0.97); old layer `.out` (opacity 0, blur 2px), removed after 160ms | in: opacity and filter 160ms, transform 240ms `--ease-out`, delayed 80ms (170ms when shrinking, 0 on first paint) · out 90ms ease-out | yes; stacked layers retire in order | crossfade stays |
| Refit | same variant, content changed → shell re-measures | 490ms `--spring`, no delay | yes | snaps |
| Attached | drop accepted → shell `.bouncy` | 600ms `--spring-bounce`, dwell 1200ms, then back to the mode | yes | snaps |
| Hover intent / pin | rest 150ms (not over a button) → expand; leave → 300ms → collapse | uses the morph | re-entering within 300ms cancels | snaps |
| Pill press | `:active` on the pill shell → scale(0.97) | 180ms `--ease-out` | — | — |
| Hide / show | `hidden` ↔ other → `.gone` opacity 0 + scale(0.95) | opacity 220ms, transform 180ms `--ease-out` | yes | opacity only |
| Mint dot | suggestion shown → opacity 0→1, then opacity 1 ↔ 0.35 | 300ms `--ease-out`; pulse 1.8s ease-in-out ∞ from 300ms | — | no fade, no pulse |
| Suggestion card | appears in an open card → opacity 0, translateY(6px) scale(0.98) → none · Useful / Dismiss → opacity 0 + scale(0.98), removed, shell refits | 320ms `--ease-out` after 140ms · out 150ms | yes | appears and disappears |
| Transcript typing | card opens / lines arrive → one `.w` span per word, opacity 0→1 | one word every 80ms, each 160ms `--ease-out`; starts 260ms after mount, 120ms after new lines | stops if the layer retires; typed count remembered | all words at once |
| Live loops | recording → rec dot opacity 0.3 at 50% (1.4s ∞); wave scaleY 0.3↔1 (900ms, delays 0/−200/−450/−650/−100ms); timer +1s | loops | paused → dot 0.45, bars at 0.3, timer frozen | dot 2.4s, wave stops |
| Filing spinner | filing → rotate 360° | 700ms linear ∞ | — | keeps turning (status) |
| Docs chip bump | attach while the brief card is open → scale 1 → 1.18 → 1 | 420ms `--ease-out` | restart | off |
| Island evidence popover | source chip → opacity 150ms + scale(0.96)→1 190ms from the chip; pins the Island | close 110ms | yes | opacity only |
| Onboarding panel | open (first run +420ms, Set up Telu, ⌥Space before setup) → opacity 0→1, scale(0.96)→1 · Not now / Esc → opacity→0, scale(0.97), hidden | 260ms / 160ms `--ease-out` | restart | instant |
| Step slide | Continue / Back / permission answer → old: opacity→0 + translateX(−24px × dir), removed · new: opacity 0→1 from translateX(24px × dir) | new 220ms `--ease-out` +40ms (fill backwards) · old 150ms (fill forwards) | restart | instant swap |
| Step dots | step change → `--fill-3` / accent 45% (done) / `--accent` (current) | 200ms ease | — | same |
| Switch knob | toggle → knob translateX(14px); track colour | knob 600ms `--spring-bounce` · track 200ms ease | yes | colour only |
| Added row | manual Add (Enter or button) → `.receive` | 900ms `--ease-out` | restart | stays |
| Permission alert | Connect Calendar → opacity 180ms, scale(0.95)→1 220ms; close 120 / 140ms | — | — | opacity |
| Finish flight | Done → panel opacity→0 + scale(0.92) 280ms (fill forwards) ‖ icon flight 620ms: outer x on cubic-bezier(0.45, 0, 0.2, 1); inner y + scale (clamped ≥ 0.4) + opacity→0.35 on cubic-bezier(0.6, 0, 0.9, 0.7) → status item `.receive` 900ms + image `.bump` 420ms → panel hidden → Island back after 160ms | — | no (busy flag) | no shrink, no flight; the item still receives |
| Status item | state change → phrase swaps instantly; rec dot pulses; timer ticks | — | — | dot 2.4s |

```tsx
export const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const SPRING = { type: 'spring', bounce: 0.12, visualDuration: 0.33 } as const;
const SPRING_BOUNCE = { type: 'spring', bounce: 0.28, visualDuration: 0.42 } as const;
const PILL_H = 36;

const radiusFor = (variant: IslandVariant, h: number) => (variant === 'drop' ? 20 : h > PILL_H + 4 ? 22 : h / 2);

type IslandSize = { key: string; variant: IslandVariant; w: number; h: number; shrinking: boolean };

export function useIslandSize(probe: React.RefObject<HTMLDivElement>, key: string, variant: IslandVariant) {
  const [size, setSize] = useState<IslandSize>({ key, variant, w: 300, h: PILL_H, shrinking: false });
  useLayoutEffect(() => {
    const el = probe.current;
    if (!el) return;
    const commit = () =>
      setSize((prev) => {
        const w = el.offsetWidth;
        const h = el.offsetHeight;
        if (prev.key === key && prev.w === w && prev.h === h) return prev;
        return { key, variant, w, h, shrinking: prev.key !== key && w * h < prev.w * prev.h };
      });
    commit();
    const observer = new ResizeObserver(commit);
    observer.observe(el);
    return () => observer.disconnect();
  }, [probe, key, variant]);
  return size;
}

export function IslandShell({ view, instant, render }: IslandShellProps) {
  const probe = useRef<HTMLDivElement>(null);
  const key = `${view.variant}|${view.subjectId}`;
  const size = useIslandSize(probe, key, view.variant);
  const settled = useRef(view);
  useLayoutEffect(() => {
    if (size.key === key) settled.current = view;
  });
  const shown = size.key === key ? view : settled.current;
  const morphDelay = instant ? 0 : size.shrinking ? 0.09 : 0;
  const inDelay = instant ? 0 : morphDelay + 0.08;
  const fade = { duration: 0.16, ease: EASE_OUT, delay: inDelay };
  return (
    <motion.div
      className="island"
      role="region"
      aria-label="Telu"
      tabIndex={0}
      animate={{ width: size.w, height: size.h, borderRadius: radiusFor(size.variant, size.h) }}
      transition={instant ? { duration: 0 } : { ...(size.variant === 'attached' ? SPRING_BOUNCE : SPRING), delay: morphDelay }}
    >
      <div ref={probe} className="il il-probe" aria-hidden>{render(view)}</div>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={size.key}
          className="il"
          style={{ x: '-50%' }}
          initial={{ opacity: 0, filter: 'blur(2px)', scale: 0.97 }}
          animate={{ opacity: 1, filter: 'blur(0px)', scale: 1, transition: { opacity: fade, filter: fade, scale: { duration: 0.24, ease: EASE_OUT, delay: inDelay } } }}
          exit={{ opacity: 0, filter: 'blur(2px)', transition: { duration: 0.09, ease: 'easeOut' } }}
        >
          {render(shown)}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}

export const TypedLine = ({ words, typed }: { words: string[]; typed: boolean }) => (
  <motion.span initial={typed ? false : 'h'} animate="v" variants={{ v: { transition: { staggerChildren: 0.08, delayChildren: 0.26 } } }}>
    {words.map((w, i) => (
      <motion.span key={i} variants={{ h: { opacity: 0 }, v: { opacity: 1, transition: { duration: 0.16, ease: EASE_OUT } } }}>{`${w} `}</motion.span>
    ))}
  </motion.span>
);

export const SuggestionPresence = ({ suggestion, children }: { suggestion: Suggestion | null; children: React.ReactNode }) => (
  <AnimatePresence>
    {suggestion && (
      <motion.div
        key={suggestion.text}
        className="il-sugg"
        initial={{ opacity: 0, y: 6, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.32, delay: 0.14, ease: EASE_OUT } }}
        exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.15, ease: EASE_OUT } }}
      >
        {children}
      </motion.div>
    )}
  </AnimatePresence>
);

const stepVariants = {
  enter: (dir: number) => ({ opacity: 0, x: 24 * dir }),
  center: { opacity: 1, x: 0, transition: { duration: 0.22, delay: 0.04, ease: EASE_OUT } },
  exit: (dir: number) => ({ opacity: 0, x: -24 * dir, transition: { duration: 0.15, ease: EASE_OUT } }),
};

export const OnboardingSteps = ({ stepKey, dir, children }: { stepKey: string; dir: -1 | 0 | 1; children: React.ReactNode }) => (
  <AnimatePresence mode="popLayout" custom={dir} initial={false}>
    <motion.div key={stepKey} className="ob-step" custom={dir} variants={stepVariants} initial="enter" animate="center" exit="exit">
      {children}
    </motion.div>
  </AnimatePresence>
);

export const panelMotion = (finishing: boolean) => ({
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1, transition: { duration: 0.26, ease: EASE_OUT } },
  exit: finishing
    ? { opacity: 0, scale: 0.92, transition: { duration: 0.28, ease: EASE_OUT } }
    : { opacity: 0, scale: 0.97, transition: { duration: 0.16, ease: EASE_OUT } },
});
```

How the shell code works:
- The probe renders the incoming content invisibly (`.il-probe { visibility: hidden; pointer-events: none; }`). That lets the shell size, the shrink delay and the layer's delay be known before the visible layer mounts. 002 does the same by appending the layer as `.pre` and reading `offsetWidth` and `offsetHeight`.
- Until the new size is committed, the visible layer keeps rendering the last settled view, so the fading-out layer shows old content, never new.
- Animate measured width and height, never `layout` scale, so text never stretches.

FlyIcon inside one webview: an outer fixed `motion.div` animates `{ x: dx }` over 0.62s with ease [0.45, 0, 0.2, 1]. An inner `motion.div` (`originX: 0`) animates `{ y: dy, scale: max(0.4, min(1, to.h / from.h)), opacity: 0.35 }` over 0.62s with ease [0.6, 0, 0.9, 0.7]. Here `dx = to.left − from.left` and `dy = (to.top + to.h/2) − (from.top + from.h/2)`. On complete, restart `.receive` on the item and `.bump` on its image.

## CSS Patterns

Tokens: `--glass-strong`, `--glass-rim`, `--shadow-float`, `--shadow-window`, `--spring`, `--spring-dur` (490ms), `--spring-bounce`, `--spring-bounce-dur` (600ms), `--ease-out`, `--menubar-h`, `--coral`, `--coral-soft`, `--mint`, `--mint-soft`, `--mint-ink`, `--accent`, `--accent-soft`, `--amber`, `--label-2`, `--label-3`, `--fill`, `--fill-2`, `--fill-3`, `--menubar`, `--hairline`, `--template-filter`. Values for both themes are in `sources/themes/`; the springs are in `sources/kit/mac-kit.css`.

Shell and layers (`island.css`):

```css
.island { position: fixed; top: calc(var(--menubar-h) + 10px); left: 0; right: 0; margin: 0 auto; z-index: 260; width: 300px; height: 36px; border-radius: 18px; overflow: hidden; background: var(--glass-strong); backdrop-filter: blur(30px) saturate(1.8); box-shadow: var(--shadow-float), inset 0 0.5px 0 var(--glass-rim); transform-origin: 50% 0; transition: width var(--spring-dur) var(--spring) var(--morph-delay, 0ms), height var(--spring-dur) var(--spring) var(--morph-delay, 0ms), border-radius var(--spring-dur) var(--spring) var(--morph-delay, 0ms), opacity 220ms var(--ease-out), transform 180ms var(--ease-out); }
.island.bouncy { transition-duration: var(--spring-bounce-dur), var(--spring-bounce-dur), var(--spring-bounce-dur), 220ms, 180ms; transition-timing-function: var(--spring-bounce), var(--spring-bounce), var(--spring-bounce), var(--ease-out), var(--ease-out); }
.island.instant { transition: none; }
.island.gone { opacity: 0; transform: scale(0.95); pointer-events: none; }
.island[data-shape="pill"]:active { transform: scale(0.97); }
.il { position: absolute; top: 0; left: 50%; width: max-content; transform-origin: 50% 0; transition: opacity 160ms var(--ease-out) var(--in-delay, 80ms), filter 160ms var(--ease-out) var(--in-delay, 80ms), transform 240ms var(--ease-out) var(--in-delay, 80ms); }
.il.pre { opacity: 0; filter: blur(2px); transform: scale(0.97); pointer-events: none; }
.il.out { opacity: 0; filter: blur(2px); pointer-events: none; transition: opacity 90ms ease-out, filter 90ms ease-out; }
```

In the framer-motion port, keep `.il`'s positioning (absolute, top 0, left 50%, max-content, origin 50% 0). Drop its transitions and the `.pre` / `.out` / `.island` size transitions, because framer owns those values; they would fight it.

Pills:

```css
.il-pill { height: 36px; display: flex; align-items: center; gap: 8px; padding: 0 16px 0 14px; white-space: nowrap; font-size: 13px; }
.il-pill b { font-weight: 600; }
.il-next { min-width: 300px; }
.il-next .il-name { max-width: 190px; }
.il-live .il-name { max-width: 180px; }
.il-until { color: var(--label-2); font-weight: 500; }
.il-setup { gap: 7px; padding-right: 12px; }
.il-starting { min-width: 356px; padding-right: 6px; gap: 7px; }
.il-coral { width: 8px; height: 8px; border-radius: 50%; background: var(--coral); box-shadow: 0 0 0 3px var(--coral-soft); }
.il-live { gap: 9px; }
.il-timer { font-weight: 500; color: var(--label-2); min-width: 34px; }
.il-wave { color: var(--coral); height: 13px; }
.il-mint-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--mint); box-shadow: 0 0 0 1px color-mix(in srgb, var(--mint-ink) 40%, transparent); animation: il-dot-in 300ms var(--ease-out) both, il-pulse 1.8s ease-in-out 300ms infinite; }
@keyframes il-dot-in { from { opacity: 0; } }
@keyframes il-pulse { 50% { opacity: 0.35; } }
.il-ok { width: 18px; height: 18px; border-radius: 50%; display: grid; place-items: center; background: var(--accent); color: #fff; }
.il-review { color: var(--amber); font-weight: 600; }
.il-clip { display: inline-grid; place-items: center; color: var(--accent); }
.il-drop { width: 380px; height: 104px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; border-radius: 20px; outline-offset: -7px; }
.island .rec-dot.paused { animation: none; opacity: 0.45; }
.island .wave.paused i { animation: none; transform: scaleY(0.3); }
```

Cards:

```css
.il-card { width: 440px; padding: 14px 16px 12px; display: flex; flex-direction: column; gap: 11px; }
.il-head { display: flex; align-items: center; gap: 10px; min-width: 0; }
.il-head > .series-icon { width: 28px; height: 28px; }
.il-title { flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 1.3; }
.il-title b { font-size: 14px; font-weight: 600; }
.il-title > span { font-size: 11.5px; }
.il-why { margin: 0; color: var(--label-2); font-size: 12.5px; line-height: 1.45; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.il-summary { -webkit-line-clamp: 3; color: var(--label); }
.il-row { display: flex; gap: 9px; align-items: flex-start; }
.il-text { font-size: 13px; line-height: 1.38; }
.il-meta { display: flex; align-items: center; gap: 6px; margin-top: 3px; font-size: 11.5px; color: var(--label-2); }
.il-ask { margin: 0 -6px; padding: 8px 10px 9px; border-radius: 12px; background: color-mix(in srgb, var(--mint-soft) 60%, transparent); }
.il-mint { display: inline-flex; align-items: center; gap: 4px; color: var(--mint-ink); }
.il-count { display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 10px 0 4px; border-radius: 999px; background: var(--fill); font-size: 12px; }
.il-line { display: grid; grid-template-columns: 76px 1fr; gap: 10px; font-size: 13px; line-height: 1.42; }
.il-who { font-size: 11.5px; font-weight: 600; color: var(--label-2); padding-top: 1px; }
.il-line .w { transition: opacity 160ms var(--ease-out); }
.il-line .w.h { opacity: 0; }
.il-sugg { padding: 10px 10px 8px 14px; border-radius: 12px; background: var(--mint-soft); box-shadow: inset 3px 0 0 var(--mint); transition: opacity 150ms var(--ease-out), transform 150ms var(--ease-out); }
.il-sugg-head { display: flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 600; color: var(--mint-ink); }
.il-sugg.arrive { animation: il-arrive 320ms var(--ease-out) 140ms both; }
.il-sugg.leaving { opacity: 0; transform: scale(0.98); }
@keyframes il-arrive { from { opacity: 0; transform: translateY(6px) scale(0.98); } }
.il-stop { width: 9px; height: 9px; border-radius: 2.5px; background: var(--coral); }
.popover.il-pop { z-index: 270; }
@media (prefers-reduced-motion: reduce) { .il-mint-dot, .il-sugg.arrive { animation: none !important; } }
```

Onboarding panel (`app.css`) and the status item:

```css
.onboard { position: absolute; top: 92px; left: 0; right: 0; margin: 0 auto; z-index: 40; width: 420px; height: 530px; display: flex; flex-direction: column; border-radius: 22px; overflow: hidden; background: var(--glass-strong); backdrop-filter: blur(34px) saturate(1.8); box-shadow: var(--shadow-window); }
.ob-steps { position: relative; flex: 1; min-height: 0; }
.ob-step { position: absolute; inset: 0; padding: 28px 28px 6px; display: flex; flex-direction: column; }
.ob-icon { width: 60px; height: 60px; margin-bottom: 16px; }
.ob-title { margin: 0; font: 700 21px/1.24 var(--font-display); letter-spacing: -0.02em; }
.ob-text { margin: 8px 0 0; color: var(--label-2); line-height: 1.5; }
.ob-moments { margin-top: 20px; display: flex; flex-direction: column; gap: 12px; }
.ob-m-icon { width: 32px; height: 32px; border-radius: 10px; display: grid; place-items: center; background: var(--accent-soft); color: var(--accent-strong); }
.ob-m-icon.coral { background: var(--coral-soft); color: var(--coral); }
.ob-privacy { margin-top: auto; display: flex; align-items: center; gap: 6px; padding-bottom: 6px; font-size: 12px; color: var(--label-3); }
.ob-foot { height: 62px; flex: none; display: flex; align-items: center; gap: 8px; padding: 0 20px 0 28px; }
.ob-dots { display: flex; gap: 6px; }
.ob-dots i { width: 6px; height: 6px; border-radius: 50%; background: var(--fill-3); transition: background-color 200ms ease; }
.ob-dots i.done { background: color-mix(in srgb, var(--accent) 45%, transparent); }
.ob-dots i.on { background: var(--accent); }
.ob-list { margin: 12px -10px 0; flex: 1; min-height: 0; overflow-y: auto; }
.ob-row { display: flex; align-items: center; gap: 10px; height: 40px; padding: 0 10px; border-radius: 10px; }
.ob-row-main span { font-size: 11.5px; color: var(--label-2); }
.ob-row.ignored .ob-row-main, .ob-row.ignored .series-icon { opacity: 0.5; }
.ob-badge { position: relative; width: 60px; height: 60px; border-radius: 16px; display: grid; place-items: center; margin-bottom: 16px; background: var(--fill-2); color: var(--label-2); }
.ob-badge-lock { position: absolute; right: -5px; bottom: -5px; width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; background: var(--amber); color: #fff; }
.ob-input { margin-top: 18px; display: flex; gap: 8px; }
.ob-parsed { min-height: 30px; margin-top: 10px; }
.ob-added-row { display: flex; align-items: center; gap: 8px; height: 30px; padding: 0 8px; border-radius: 8px; font-size: 13px; }
.ob-keys { display: flex; align-items: center; gap: 10px; margin: 22px 0 4px; }
.ob-keys .keycap { min-width: 54px; height: 48px; border-radius: 10px; font-size: 20px; }
.ob-keys .keycap.wide { min-width: 150px; font-size: 15px; }
.ob-bar { margin-top: auto; margin-bottom: 8px; display: flex; align-items: center; gap: 12px; height: 30px; padding: 0 12px; border-radius: 9px; background: var(--menubar); box-shadow: inset 0 0 0 0.5px var(--hairline); font-size: 12px; }
.ob-bar-telu { margin-left: auto; display: inline-flex; align-items: center; gap: 5px; height: 22px; padding: 0 8px; border-radius: 6px; font-weight: 500; background: var(--accent-soft); box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 35%, transparent); }
.switch { width: 32px; height: 18px; border-radius: 999px; background: var(--fill-3); transition: background-color 200ms ease; }
.switch::after { content: ""; position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: #fff; transition: transform var(--spring-bounce-dur) var(--spring-bounce); }
.switch[aria-checked="true"] { background: var(--accent); }
.switch[aria-checked="true"]::after { transform: translateX(14px); }
.menubar .telu-status { gap: 6px; padding: 0 8px; }
.menubar .telu-status img { width: 16px; height: 16px; }
.menubar .telu-status.icon-only { padding: 0 7px; }
.menubar .telu-status.icon-only .ts-text { display: none; }
.menubar .telu-status .rec-dot { width: 7px; height: 7px; }
```

## HTML Structures

Island shell with a live pill layer (002 `island.js`):

```html
<div class="island" id="island" role="region" aria-label="Telu" tabindex="0" data-shape="pill" style="width:224px;height:36px;border-radius:18px">
  <div class="il" data-variant="live" style="width:224px;margin-left:-112px">
    <div class="il-pill il-live"><span class="rec-dot"></span><b class="il-name truncate">Product Sync</b><span class="num il-timer" data-il-elapsed>12:04</span><span class="wave il-wave"><i></i><i></i><i></i><i></i><i></i></span><span class="il-mint-dot" role="img" aria-label="Telu found something worth asking"></span></div>
  </div>
</div>
```

Other pills:

```html
<div class="il-pill il-setup"><img class="template-img il-mark" src="telu-menubar.png" alt=""><b>Set up Telu</b><span class="faint il-chev"></span></div>
<div class="il-pill il-next"><span class="series-dot" style="--c:var(--series-blue)"></span><b class="il-name truncate">Product Sync</b><span class="faint num">10:00</span><span class="spacer"></span><span class="num il-until">in 19m</span></div>
<div class="il-pill il-starting"><span class="il-coral"></span><b>Starting now</b><span class="muted">· Record?</span><span class="spacer"></span><button class="btn sm record" data-act="record">Record</button><button class="btn sm plain" data-act="skip">Skip</button></div>
<div class="il-pill il-filing"><span class="spinner"></span><span>Filing to <b>Product Sync</b>…</span></div>
<div class="il-pill il-filed"><span class="il-ok"></span><span>Filed to <b>Product Sync</b></span><span class="il-review num">· 5 to review</span></div>
<div class="il-drop drop-target"><span class="il-clip lg"></span><b>Attach to Product Sync · 10:00</b><span class="t-caption">Goes into the brief · stays on this Mac</span></div>
```

Brief card (before and starting; starting adds Skip before Record):

```html
<div class="il-card il-brief">
  <div class="il-head"><span class="series-icon" style="--c:var(--series-blue)"></span><div class="il-title"><b class="truncate">Product Sync <span class="faint">#37</span></b><span class="muted num truncate">10:00 · Google Meet · in 19m</span></div><span class="avatars"></span></div>
  <p class="il-why">Keep product, design and engineering pointed at the same three priorities…</p>
  <div class="il-sec"><div class="t-eyebrow">Since last time</div>
    <div class="il-row"><span class="ktype il-k" data-type="commitment"></span><div class="il-main"><div class="il-text">Share the API rate-limit plan</div><div class="il-meta"><span class="truncate">Jon Park · Due today</span><span class="il-ev" data-src="Sep 22 · 18:42" data-sid="product-sync"><button class="source">Sep 22 · 18:42</button></span></div></div></div>
  </div>
  <div class="il-sec il-ask"><div class="t-eyebrow il-mint">Worth asking</div><div class="il-text il-ask-text">Is Jon’s rate-limit plan ready to decide on today, or does it slip to Thursday? <span class="il-ev"></span></div></div>
  <div class="il-foot"><button class="chip il-docs" data-act="docs"><span data-docs>3 docs</span></button><span class="spacer"></span><button class="btn sm" data-act="open-brief">Open brief</button><button class="btn sm record" data-act="record">Record<span class="kbd">⌘R</span></button></div>
</div>
```

Live card and after card:

```html
<div class="il-card il-live-card">
  <div class="il-head"><span class="rec-dot"></span><b class="truncate">Product Sync</b> <span class="faint">#37</span><span class="spacer"></span><span class="num il-timer" data-il-elapsed>12:11</span><span class="wave il-wave"></span></div>
  <div class="il-lines" data-lines="2">
    <div class="il-line"><span class="il-who truncate">Jon Park</span><span class="il-said"><span class="w">So </span><span class="w">the </span><span class="w">plan… </span></span></div>
    <div class="il-line typing"><span class="il-who truncate">Maria Chen</span><span class="il-said"><span class="w h">Does </span><span class="w h">this… </span></span></div>
  </div>
  <div class="il-slot"><div class="il-sugg"><div class="il-sugg-head"><span>Worth asking now</span></div><p>Acme goes live Nov 3 and the SOC 2 question is still open — worth deciding now?</p><div class="il-sugg-foot"><span class="il-ev"></span><span class="spacer"></span><button class="btn sm plain" data-act="useful">Useful</button><button class="btn sm plain icon" data-act="dismiss" aria-label="Dismiss"></button></div></div></div>
  <div class="il-foot"><button class="btn sm" data-act="pause">Pause</button><button class="btn sm" data-act="stop"><span class="il-stop"></span>Stop<span class="kbd">⌘R</span></button><span class="spacer"></span><span class="t-caption il-local">On this Mac</span></div>
</div>
<div class="il-card il-filed-card">
  <div class="il-head"><span class="il-ok"></span><div class="il-title"><b class="truncate">Filed to Product Sync <span class="faint">#37</span></b><span class="muted num truncate">44 min · ended 10:44 · transcribed on this Mac</span></div></div>
  <p class="il-why il-summary">Rate-limit plan approved with per-workspace limits…</p>
  <div class="il-counts"><span class="il-count"><span class="ktype il-k" data-type="decision"></span>2 decisions</span><span class="il-count"><span class="ktype il-k" data-type="commitment"></span>2 commitments</span><span class="il-count"><span class="ktype il-k" data-type="fact"></span>1 fact</span></div>
  <div class="il-foot"><button class="btn sm" data-act="open-meeting">Open meeting</button><span class="spacer"></span><span class="t-caption">About 30 seconds</span><button class="btn sm primary" data-act="review">Review 5</button></div>
</div>
```

Onboarding panel and steps (002 `index.html`, `app-onboard.js`):

```html
<section class="onboard" role="dialog" aria-label="Set up Telu">
  <div class="ob-steps"><div class="ob-step" data-step="0">
    <div class="app-icon ob-icon"><img src="telu-icon.png" alt=""></div>
    <h2 class="ob-title">Telu gets you ready for recurring meetings</h2>
    <p class="ob-text">It reads your calendar on this Mac, prepares a brief before each recurring meeting and files everything after. Nothing leaves your Mac.</p>
    <div class="ob-moments"><div class="ob-moment"><span class="ob-m-icon"></span><div><b>Before</b><span>A brief with what carried over and what’s worth asking</span></div></div></div>
    <div class="ob-privacy">Processed on this Mac · nothing is uploaded</div>
  </div></div>
  <footer class="ob-foot"><div class="ob-dots"><i class="on"></i><i></i><i></i></div><span class="spacer"></span><div class="ob-actions"><button class="btn plain" data-act="later">Not now</button><button class="btn primary" data-act="connect">Connect Calendar</button></div></footer>
</section>
<div class="ob-row"><span class="series-icon" style="--c:var(--series-blue)"></span><div class="ob-row-main"><b class="truncate">Product Sync</b><span class="truncate">Every Tue · 10:00–10:45 · 36 found</span></div><button class="switch" aria-checked="true" aria-label="Remember Product Sync"></button></div>
<div class="ob-input"><input class="field lg" maxlength="120" placeholder="Weekly 1:1 with Priya, Thu 11am"><button class="btn tinted" data-act="manual-add">Add</button></div>
<div class="ob-keys"><span class="keycap">⌥</span><span class="ob-plus">+</span><span class="keycap wide">Space</span></div>
<span class="mb-item telu-status icon-only" id="teluStatus" role="button" aria-label="Telu"><img src="telu-menubar.png" class="template-img" alt=""><span class="ts-text"></span></span>
```

## Behavior & State

**The Island ⇄ App contract, verbatim from the 002 build contract.**

```ts
Island.mount(desk, bridge)
Island.set(mode: 'setup' | 'before' | 'starting' | 'live' | 'filing' | 'after' | 'hidden')
Island.refresh()

TeluBridge.next():  { series, meeting, countdown: 'in 19m' | 'Now' } | null
TeluBridge.live():  { series, meeting, elapsed: number, transcript: { who, text }[], suggestion: { text, sources: string[] } } | null
TeluBridge.after(): { series, meeting, pending: number } | null
TeluBridge.evidence(seriesId, src): { kind: 'speech', t, who, quote } | { kind: 'doc', doc, loc, quote }
```

- `mount(desk, bridge)` creates the Island (and the demo desktop file icon). It is idempotent.
- `refresh()` re-reads the bridge and repaints the current mode.
- `series` and `meeting` are the app's current objects, with `meeting.brief = { carry, ask, agenda, docs }`.
- Every bridge call is try/caught; a failure logs once and renders as "no subject".

| Event (Island → app, `CustomEvent` on the desk) | detail | What 002's app does (`app-bridge.js`) |
|---|---|---|
| `island:setup` | `{}` | not onboarded → opens the onboarding panel (the Island goes `hidden`); otherwise re-syncs the Island mode |
| `island:open` | `{ seriesId, meetingId }` | shows the window, goes to the day (or Upcoming) with that meeting, selects it so the side peek opens, scrolls the card into view; unknown meeting → opens the series doc |
| `island:record` | `{ meetingId }` | if not already recording: starts recording (same path as ⌘R): agenda cards morph, toolbar capsule appears, Next block goes live, `set('live')` |
| `island:skip` | `{ meetingId }` | while starting: dismisses the "is starting" notification, `set('before')`, toast "Won’t record Product Sync this time" with Undo (back to `starting`); otherwise `set('before')` |
| `island:stop` | `{ meetingId }` | stops recording, `set('filing')`; tracked meeting → 900ms "Preparing summary" beat → files it → `set('after')` (the scripted Product Sync meeting also raises the "N items to review" notification; other tracked meetings toast "Filed today’s recording to …"); one-off → toast "Saved a one-off recording…", `set('before')` after 900ms |
| `island:review` | `{ meetingId }` | shows the window, opens the Review tab and selects that meeting; the peek shows its review. The contract allowed "peek or Review tab" |
| `island:attach` | `{ meetingId, files: [{ name, size }] }` | adds the files to that meeting's brief docs (or meeting docs), chips animate in wherever the Next block is visible, toast "Attached … to Product Sync #37", `Island.refresh()` |
| `island:feedback` | `{ kind: 'useful' \| 'dismiss' }` | toast "Thanks — Telu will surface more like this" / "Dismissed — Telu will ask less like this" |

**App → Island.**
- Scenario sync (`T.islandForScenario`): not onboarded gives `hidden` while the panel is open, else `setup`. Recording gives `live`, starting gives `starting`, otherwise `before` or `after`.
- Direct calls:
  - Recording: Record → `live`; Stop → `filing`; filed → `after`; one-off stop → `before`.
  - Starting: Skip → `before`; Undo → `starting`.
  - Onboarding: open → `hidden`; close → `setup`; complete → scenario sync after 160ms.
- `refresh()` follows every change the Island shows: purpose save, agenda add, include toggles, attachments, review decisions, brief prepared.
- Every call goes through a guard (`T.island`): if `window.Island` is missing it is a no-op, and errors are rethrown asynchronously so the app keeps running. Every call also re-renders the status item.

**Variant precedence** (`variantFor`): drag (`hint`, or `drop` when over the Island) > flash > expanded card (only if the mode has one and a subject exists) > mode. Mode changes close any evidence popover and clear flashes. A card stays expanded across a mode change only if the new mode has a card and the pointer is still over it. After any action (Record, Skip, Stop, Review, Open), the Island collapses and does not re-expand while the pointer is still over it (`suppress` until pointer leave). A pointer-down outside collapses an expanded card, except inside popovers, menus, alerts, toasts or notifications.

**Timers** (`MS`): hoverIn 150 · hoverOut 300 · type 80 per word · suggest 1200 · attached 1200 · dragIdle 1000. Flash dwell: skipped 1700, invalid 1600, already 1400. A retired layer is removed after 160ms. Typing starts 260ms after the card mounts and 120ms after new lines. A suggestion takes 150ms to leave.

**Suggestion rules.** These are LIVE-06 and LIVE-07 in REQUIREMENTS: at most one primary suggestion, evidence-inspectable, with dismiss and feedback.
- The bridge returns one `suggestion` or an empty one. The Island shows it 1200ms after live begins (`waiting` → `shown`).
- While shown, the pill carries the mint dot, and the card shows "Worth asking now" with its source chips and Useful / Dismiss.
- Feedback removes it (`sug = 'useful' | 'dismiss'`) and emits `island:feedback`. It stays gone until the bridge returns a different text, which then arrives again as the one suggestion.
- The brief card shows only the first "Worth asking" question.
- Silence is a valid outcome (LIVE-08): no suggestion means no dot.

**Transcript.** Only the last two lines show. When the card first opens, the newest line types in and older ones appear typed. A remembered typed count means re-expanding never retypes. With no lines yet, the card reads "Listening · Transcribing on this Mac — lines appear as people speak."

**Attach rules.**
- Accepts OS file drags (`Files`) and the demo icon's `application/x-telu-file`. Drags over inputs, textareas and contenteditable are ignored.
- Hint while a drag is anywhere on the page. Drop target when the pointer is within 10px of the shell (12px below). The drag ends after 1000ms without `dragover`, or when the enter/leave depth returns to 0.
- A name must look like a document (`/^[^\n\r\t<>]{1,120}\.[a-z0-9]{1,6}$/i`); otherwise the Island shows the invalid flash. Names are de-duplicated case-insensitively against the brief's docs (already flash).
- Attachable only in `before`, `starting` and `live`. Double-clicking the demo file flashes the hint, or toasts "Telu attaches files before or during a meeting" when nothing is attachable.

**Evidence inside the Island.** Clicking a source chip pins the Island open and opens a 320px popover on the desk at z-index 270.
- Speech: "EVIDENCE · Product Sync #36 · 18:42", the quote, the speaker's avatar and name, then "Open meeting" (→ `island:open`) or "On this Mac".
- Document: "FROM THE DOC · p.7", the passage or "No excerpt saved for this source.", the file badge and name, "On this Mac".

Closing the popover never collapses the Island.

**Production mapping (Tauri 2).** The config keys and commands named here exist today. `tauri-nspanel` is not yet a dependency.
- **Window**: a second webview window with label `island`, created at launch and independent of the main window. Set `transparent: true`, `decorations: false`, `alwaysOnTop: true`, `skipTaskbar: true`, `focus: false`, `resizable: false`, `shadow: false` (the shell draws its own), `visibleOnAllWorkspaces: true` and `acceptFirstMouse: true`. Make it a non-activating NSPanel so clicks never pull focus from the user's current app. `macOSPrivateApi` is already `true` and Cargo already enables `macos-private-api`. A plugin such as `tauri-nspanel` does the NSPanel conversion. Grant the `island` window its own capability for events and commands.
- **Size and hit-testing**: size the panel to the largest variant (440px wide; the brief card measured 344px high, so leave room for longer content) and animate the shell inside it. Transparent areas must pass clicks through: toggle `setIgnoreCursorEvents` from the cursor position. An ignoring window gets no pointer events, so track the cursor from Rust.
- **Position**: centred horizontally on the screen that owns the menu bar, with the top at the menu bar's bottom edge + 10px. On notched Macs this sits under the notch. Re-place it on display changes.
- **Motion**: framer-motion as in the Motion snippet, `MotionConfig reducedMotion="user"`.
- **IPC instead of DOM events:**

| 002 (DOM) | Production |
|---|---|
| `Island.set(mode)` / `refresh()` | Rust owns recording and meeting state and emits to the island window (`emit_to("island", "island:state", { mode, next, live, after })`) on every change; the Island renders from that snapshot |
| `TeluBridge.next / live / after` | the snapshot above (or a new `island_snapshot` command) |
| `TeluBridge.evidence(sid, src)` | a new `evidence_for` command taking a structured evidence reference |
| `island:record` / `island:stop` | existing `start_recording` / `stop_recording` commands; the Island shows `filing` immediately, Rust sends `after` when the summary is ready |
| Pause / Resume (Island-internal in 002) | existing `pause_recording` / `resume_recording` (`audio/recording_commands.rs`, emits `recording-paused`) so the app, status item and Island agree |
| `island:skip` | a new command; 002 only toasts with Undo |
| `island:open` / `island:review` | a command that shows and focuses the main window and emits a navigation event to it |
| `island:attach` | `onDragDropEvent` on the island window → file paths → import command (bounded formats, DOC-01) |
| `island:feedback` | a command that records feedback (measurement for LIVE-08 / LIVE-09) |
| `island:setup` | show the onboarding panel window |

Tauri reports drags only over its own windows, so the hint shows when a drag enters the panel's area, not anywhere on the desktop.

**Onboarding flow** (`app-onboard.js`).

| Step (dot) | calendar | Body | Actions |
|---|---|---|---|
| 0 | unknown | app icon 60px · "Telu gets you ready for recurring meetings" · "It reads your calendar on this Mac, prepares a brief before each recurring meeting and files everything after. Nothing leaves your Mac." · moments: **Before** "A brief with what carried over and what’s worth asking" (calendar-check) · **During** "Capture, plus at most one well-timed suggestion" (record, coral tile) · **After** "Filed to the right series — reviewed in 30 seconds" (tray-down) · lock "Processed on this Mac · nothing is uploaded" | Not now · **Connect Calendar** |
| alert | — | "“Telu” Would Like to Access Your Calendars" · "Telu reads events on this Mac to prepare briefs for your recurring meetings. Nothing is uploaded." | Don’t Allow (Esc) · **Allow Full Access** (↩) |
| 1 | allowed | "Which conversations should Telu remember?" · "Telu found 7 recurring events on your Work calendar. Each one you keep becomes a series with its own purpose, memory and briefs." · DetectedRows: 5 series on by default ("Every Tue · 10:00–10:45 · 36 found"), Daily Standup off ("142 found · Short daily check-in"), Lunch disabled ("Personal calendar · ignored") | Back · **Remember N** (live count; 5 by default) |
| 0 | denied | badge (calendar + amber lock) · "Calendar access is off" · "Telu can’t see your meetings yet… System Settings › Privacy & Security › Calendars." · "Open System Settings" · "Until then, tell Telu about your recurring conversations by typing them — one line each." | **Continue without calendar** |
| 1 | denied | "Tell Telu about a recurring conversation" · "Type it the way you’d say it. Telu works out the rhythm and the people." · input (placeholder "Weekly 1:1 with Priya, Thu 11am", 120 chars, focused 80ms after entry) + Add · live parse: ✦ **1:1 · Priya** [Weekly] [Thu 11:00] [with Priya Nair] · added rows (✓ title + cadence · day time, receive flash) · bad input → toast "Try something like “Weekly 1:1 with Priya, Thu 11am”" | Back · **Skip for now** / **Continue** |
| 2 | any | app icon (flies) · "Summon Telu anytime" · ⌥ + Space keycaps · "Telu lives in your menu bar and comes to you before each meeting. Series, purpose docs and history are one keystroke away." · mini menu bar with the highlighted item "Product Sync · 19m" and clock 9:41 | Back · **Done** |

- **Opening.** First run hides the window, sets the Island `hidden` and opens the panel 420ms later. "Set up Telu" (Island pill, or the welcome page in the window) and ⌥Space before setup also open it. It opens at step 0 with the default picks.
- **Directions.** Continue moves forward (+1) and Back moves back (−1). The permission answer goes to step 1 when allowed (+1) and re-renders step 0 in place when denied (0).
- **Leaving.** "Not now" or Esc closes the panel (the Island shows `setup`). Esc is ignored while finishing.
- **Done.** Kept detected series become tracked with purposes drafted by Telu ("Drafted from the calendar invite"). Unpicked ones stay untracked. A switched-on Standup becomes a series. Typed entries become manual series with a blank purpose. The next meeting is pre-selected with the peek open for when the window is summoned. The window stays hidden. The Island returns in `before` 160ms after the flight lands.
- **Production.** The panel is its own always-on-top window. The permission prompt is the native EventKit dialog (`NSCalendarsFullAccessUsageDescription`). The tray cannot animate, so fade the panel window out and then set the tray title. A transparent overlay window can carry the flying icon if the flight is kept.

**Menu-bar status item phases** (`statusMarkup`), in precedence order:
1. not onboarded → icon only
2. recording → ● "Recording 12:04" (7px rec dot, ticking)
3. filing → "Filing…"
4. last meeting has pending items → "5 to review"
5. starting → "Product Sync · now"
6. next meeting today → "Product Sync · 19m" (hours as "4h 19m"; the "1:1 · " prefix is dropped: "Maria Chen · 4h 19m")
7. nothing → icon only

Icon-only tightens padding to 7px. A click summons: onboarding if not set up, otherwise the window, focused.

**Accessibility.**
- Island: `role="region"`, `aria-label="Telu"`, `tabindex="0"`; Enter or Space activates, Esc collapses. The mint dot has `role="img"` with an aria-label. Pause should expose `aria-pressed`. Transcript lines should be an `aria-live="polite"` list. Attach confirmations should be announced. Since a non-activating panel never takes focus, keyboard users reach the same actions through the app (⌘R, menus), and live status is mirrored in the status item.
- Onboarding: `role="dialog"`, focus trapped, Esc = Not now, `aria-live` on the step title, dots `aria-hidden` plus visually hidden "Step 2 of 3". Switches are `role="switch"` labelled "Remember <series>"; the ignored row is disabled with its reason shown.

**Known gaps to fix.**
- 003 README:
  - Pause exists only in the Island; the toolbar capsule and status item have no paused state, and 002 emits no pause event.
  - Switches have no visible focus ring.
  - Text fields have no disabled style.
  - The receive flash, spinner and mini dots ignore reduced motion.
- 002 vs the contract: the contract's window bottom inset was 24px, but 002 uses 60px. `island:review` always goes to the Review tab.
- Clicking the after pill with nothing pending still opens the Review tab, even when that meeting has nothing left to review.
- If the app never sends `after`, the Island stays in `filing`; production must drive it from state events.

## What to Avoid

- **C's ⌘K command window** (Spotlight-style palette: search meetings, people and docs; series and purpose docs; in-place purpose editing; review). Not adopted. ⌥Space summons the main window, or onboarding before setup. ⌘F is a search popover. Purpose is edited only in the living doc.
- **C's menu-bar dropdown panel**: a 360px glass panel with Up next / Now (Pause, Stop), Today, Needs you, "Open Telu ⌥Space", Settings…, Quit. Not adopted. The status item is one phrase plus summon, and the Island carries the moment.
- **C's fake Keynote backdrop** (a stand-in foreground app). It was prototype staging only; never ship fake app chrome. 002 keeps only the demo desktop PDF and the Scenario bar, and neither ships.
- **Island anti-patterns:**
  - Taking focus or activating Telu.
  - Binding global keys in the Island.
  - Mutating app state instead of emitting intent.
  - More than one suggestion, or a suggestion the instant recording starts.
  - Mint for anything but "found something".
  - Coral for anything but recording.
  - `layout` scale morphs that stretch text.
  - Springs on fades or menus (springs are for the shell and the Attached landing only).
  - `scale(0)`, or `transition: all`.
  - Content arriving before the shell grows, or the shell shrinking before content leaves.
  - Morphing in on the first paint after being hidden.
- **Onboarding anti-patterns:**
  - Showing the main window during first run.
  - Tracking every detected event automatically. Recurrence rules become proposals the user switches on, never automatic membership (001 README). Lunch-type personal events stay disabled.
  - Sliding the denied re-render (it crossfades in place).
  - Growing past the three-step shape: the denied path reuses the same three dots.

## Origin

Synthesized from sketches: 001 (C companion: onboarding source and rejected parts), 002, 003.

Source files available in:
- `sources/002-final-app/`: island.js, island.css, app-bridge.js, app-onboard.js, app-record.js, app-shell.js, app.js, app.css, index.html, README.md
- `sources/003-component-catalog/`: sec-island.js, sec-onboarding.js, sec-chrome.js (MenuBar, MenuBarStatusItem), sec-motion.js, sec-motion-2.js, COMPONENTS.md, README.md
- `sources/kit/`: mac-kit.css, mac-kit.js, data.js, telu-icon.png, telu-menubar.png
- `sources/themes/`: default.css, dark.css
- `sources/001-app-mental-model/`: README.md

Not copied into sources:
- `.planning/sketches/001-app-mental-model/`: c-companion.html, c-companion.js, c-companion-island.js, c-companion-surfaces.js (C onboarding and menu-bar panel), c-companion-palette.js (⌘K window), c-companion.css
- `.planning/REQUIREMENTS.md` (LIVE-*, DOC-01)
- The sketch-002 build contract (`contract-island.md`, a session scratch file). Its content is reproduced in Behavior & State.
