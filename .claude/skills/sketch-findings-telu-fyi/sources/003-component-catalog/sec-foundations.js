(() => {
  const e = Catalog.esc;
  const motion = ({ trigger, props, duration, easing, runtime, reduced, framer }) => [
    `Trigger: ${trigger}`, `Animates: ${props}`, `Duration: ${duration}`, `Easing: ${easing}`, `Runtime: ${runtime}`, `Reduced motion: ${reduced}`, `framer-motion: ${framer}`
  ].join(' · ');

  const onTheme = (fn) => {
    const link = document.getElementById('theme');
    if (link) link.addEventListener('load', () => fn());
    new MutationObserver(() => setTimeout(fn, 80)).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  };
  const live = (fn) => (canvas) => {
    fn(canvas);
    onTheme(() => fn(canvas));
  };
  const clip = (value, max = 64) => (value.length > max ? `${value.slice(0, max - 1)}…` : value);
  const fillVars = (canvas) => canvas.querySelectorAll('[data-var]').forEach((el) => {
    const value = Kit.cssVar(el.dataset.var) || '—';
    el.textContent = el.hasAttribute('data-full') ? value : clip(value);
    el.title = value;
  });

  const BRAND = [
    ['Accent · Telu Indigo', 'Primary actions, selection, links, focus. The only saturated color at rest.', [
      ['--accent', 'Primary buttons, selection, links, sidebar icons, focus ring (45%)'],
      ['--accent-strong', 'Hover and pressed primary; accent text on soft fills (chips, eyebrows)'],
      ['--accent-soft', 'Tinted buttons, accent chips, drop-over rows, receive flash'],
      ['--accent-softer', 'Quiet highlight: banner, Next card, editable focus, drop targets'],
      ['--on-accent', 'Text and icons on accent fills']
    ]],
    ['Mint · “Telu found something”', 'Only when Telu found something worth asking or remembering — at most 1–2 places on screen.', [
      ['--mint', 'Worth asking bar, Island suggestion dot'],
      ['--mint-ink', 'Worth asking heading and icon; never body text'],
      ['--mint-soft', 'Island suggestion card, mint chip (kit)']
    ]],
    ['Coral · recording and attention', 'Only for recording or genuine attention. Never decorative.', [
      ['--coral', 'Record button, rec dot, now line, Starting now'],
      ['--coral-ink', 'Coral text, record hover, danger menu items and buttons'],
      ['--coral-soft', 'Recording capsule, rec glyph halo, coral chip']
    ]],
    ['Amber · needs review', 'Pending review and unresolved questions.', [
      ['--amber', 'Pending candidate bar, “to review” chips, open-question type'],
      ['--amber-soft', 'Amber chip fill']
    ]]
  ];
  const LABELS = [
    ['--label', 'Primary text'],
    ['--label-2', 'Secondary text and meta lines'],
    ['--label-3', 'Tertiary: captions, placeholders, counts, eyebrows — non-essential text only'],
    ['--label-4', 'Quaternary: dot separators, unchecked rings, strikethrough color']
  ];
  const SURFACES = [
    ['--window-bg', 'Page and window backdrop behind the content column'],
    ['--content-bg', 'Main content column, fields, side peek, popup buttons'],
    ['--surface', 'Cards (agenda cards, proposal cards)'],
    ['--surface-sunken', 'Wells: memory groups, candidates, preparing blocks']
  ];
  const FILLS = [
    ['--fill', 'Quiet fills: search field, doc and source chips, hover on plain buttons'],
    ['--fill-2', 'Default button, selected sidebar row, segmented track, chip'],
    ['--fill-3', 'Button hover, switch off, menu bar item open, spinner track'],
    ['--separator', 'Hairlines between rows (0.5px)'],
    ['--hairline', 'Control outlines, field inset, tile edges'],
    ['--border', 'Solid border (defined; unused in 002)']
  ];
  const GLASS = [
    ['--glass-strong', 'Popovers, menus, sheets, alerts, toasts, notifications, glass groups, Island'],
    ['--glass', 'Lighter glass (defined; unused in 002)'],
    ['--glass-rim', 'Inner top highlight on glass groups and the Island'],
    ['--glass-edge', 'Outer 0.5px edge on glass groups'],
    ['--sidebar', 'Window material (window background behind the sidebar)'],
    ['--menubar', 'Menu bar material'],
    ['--scrim', 'Dim layer behind sheets'],
    ['--wallpaper', 'Desktop wallpaper (4-layer gradient) — context only']
  ];

  const swatch = ([name, meaning]) => `<div class="fd-sw"><span class="fd-chip"><i style="background:var(${name})"></i></span>`
    + `<div><code>${name}</code><span class="fd-val" data-var="${name}"></span><p>${e(meaning)}</p></div></div>`;
  const group = (title, note, tokens) => `<div class="fd-group">${title ? `<div class="fd-group-head"><b>${e(title)}</b><span>${e(note)}</span></div>` : ''}`
    + `<div class="fd-swatches">${tokens.map(swatch).join('')}</div></div>`;
  const tokenTile = (label, note, markup, bg = 'content') => ({ label, note, bg, span: 'full', align: 'stretch', html: `<div class="fd-wide">${markup}</div>`, mount: live(fillVars) });

  const SERIES = ['blue', 'orange', 'green', 'purple', 'teal', 'pink', 'gray'];
  const EXTRA_SERIES = { teal: ['Growth Review (from Found in Calendar)'], gray: ['Drafts (Untitled)', 'Daily Standup', 'One-off recordings'] };
  const seriesUsers = (color) => DATA.series.filter((s) => s.color === `var(--series-${color})`)
    .map((s) => `<span class="fd-user">${Kit.seriesIcon(s)}${e(s.name)}</span>`)
    .concat((EXTRA_SERIES[color] || []).map((n) => `<span class="fd-user"><span class="series-dot" style="--c:var(--series-${color})"></span>${e(n)}</span>`)).join('');
  const seriesRow = (color) => `<div class="fd-srow"><span class="fd-chip"><i style="background:var(--series-${color})"></i></span>`
    + `<div><code>--series-${color}</code><span class="fd-val" data-var="--series-${color}"></span></div><div class="fd-users">${seriesUsers(color)}</div></div>`;
  const KTYPE_MAP = [['decision', '--accent'], ['commitment', '--series-orange'], ['question', '--amber'], ['fact', '--series-teal']];
  const FIXED = [
    ['#E5484D', 'PDF badge, Island file badge'], ['#2F6BD8', 'DOCX badge'], ['#1F9A55', 'XLSX badge'], ['#2E8FF0', 'KEY badge'], ['#8E8E93', 'TXT/MD badge, default avatar'],
    ['#FF5F57', 'Traffic light · close'], ['#FEBC2E', 'Traffic light · minimize'], ['#28C840', 'Traffic light · zoom'],
    ['linear-gradient(180deg, #7C7FF3 0%, #5053D8 100%)', 'App icon gradient (both themes)']
  ];
  const fixedSwatch = ([value, use]) => `<div class="fd-sw"><span class="fd-chip"><i style="background:${value}"></i></span><div><code>${e(clip(value, 30))}</code><p>${e(use)}</p></div></div>`;
  const personSwatch = ([name, hex]) => `<div class="fd-person">${Kit.avatar(name, 'lg')}<div><b>${e(name)}</b><code>${e(hex)}</code></div></div>`;

  const TYPE = [
    ['t-large', 'Product Sync', 'Doc title, page titles (Found in Calendar)'],
    ['t-title1', 'Tuesday, 29 September', 'Kit title 1 — peek title (.pk-title) uses the same 700 22px display'],
    ['t-title2', 'Nothing upcoming yet', 'Kit title 2 — .empty h3 and .sheet-head h2 use the same values'],
    ['t-title3', 'Untitled recording', 'Unfiled card title; toolbar title (.toolbar-title b) is 600 15px'],
    ['t-headline', 'Share the API rate-limit plan', 'Emphasis inside body text'],
    ['', 'Keep product, design and engineering pointed at the same three priorities.', 'Body — every surface (body font)'],
    ['t-callout', 'Google Meet · 10:00–10:45', 'Callout (12px)'],
    ['t-caption', 'About 30 seconds', 'Captions in the Island'],
    ['t-eyebrow', 'EVIDENCE · SEP 22 · 18:42', 'Evidence and Island section eyebrows, “Less likely”'],
    ['sec-eyebrow', 'Purpose', '002 doc section eyebrow (uppercase, 0.07em)'],
    ['num', '10:00 · 12:04 · #37 · 19m', 'Tabular numerals: times, timers, counts'],
    ['fd-mono', 'Sep 22 · 18:42', '--font-mono (code only; the app uses tabular system numerals)']
  ];
  const typeRow = ([cls, sample, use]) => `<div class="fd-spec"><span class="${cls} truncate" data-measure>${e(sample)}</span></div>`
    + `<div><code>${cls ? `.${cls}` : 'body'}</code><span class="fd-metric" data-metric></span></div><div class="fd-use">${e(use)}</div>`;
  const measure = (canvas) => canvas.querySelectorAll('[data-measure]').forEach((el) => {
    const cs = getComputedStyle(el);
    const size = parseFloat(cs.fontSize);
    const ls = cs.letterSpacing === 'normal' ? 0 : parseFloat(cs.letterSpacing);
    const lh = cs.lineHeight === 'normal' ? 'normal' : `${Math.round(parseFloat(cs.lineHeight) * 10) / 10}px`;
    const track = ls ? ` · ${(ls / size).toFixed(3)}em` : '';
    const slot = el.closest('.fd-spec').nextElementSibling.querySelector('[data-metric]');
    slot.textContent = `${size}px / ${lh} · ${cs.fontWeight}${track}`;
  });
  const FONTS = [['--font', 'SF Pro Text — UI and body'], ['--font-display', 'SF Pro Display — ≥ 17px titles'], ['--font-rounded', 'SF Pro Rounded — defined, unused in 002'], ['--font-mono', 'SF Mono — code only']];

  const RADII = [
    ['--r-window', 'var(--r-window)', 'App window'], ['--r-card', 'var(--r-card)', 'Cards, wells, memory groups'], ['--r-control', 'var(--r-control)', 'Fields, sidebar rows, list rows'],
    ['capsule', '999px', 'Buttons, chips, segmented, glass groups, search, toasts'], ['20px', '20px', 'Sheets, alerts, notification banners'], ['18px', '18px', 'Details drawer; Island pill'],
    ['14px', '14px', 'Popovers, side-peek corner'], ['12px', '12px', 'Menus, Worth asking, candidates'], ['9px', '9px', 'Doc chips'],
    ['7px', '7px', 'Popup button, editable blocks'], ['6px', '6px', 'Menu items, keycaps, tooltips'], ['5px', '5px', 'Source chips, menu bar items'], ['3px', '3px', 'File badges']
  ];
  const radius = ([name, value, use]) => `<div class="fd-radius"><i style="border-radius:${value}"></i><code>${e(name)}</code><span data-rad="${e(value)}"></span><p>${e(use)}</p></div>`;
  const measureRadii = (canvas) => canvas.querySelectorAll('.fd-radius').forEach((box) => {
    box.querySelector('[data-rad]').textContent = getComputedStyle(box.querySelector('i')).borderTopLeftRadius;
  });
  const METRICS = [
    ['--menubar-h', 'Menu bar height'], ['--toolbar-h', 'Toolbar height; sidebar top inset'], ['--sidebar-w', 'Kit sidebar width (002 .t-app overrides to 244px)'],
    ['max(440px, 44%)', 'Side peek width (--peek-w)'], ['min(720px, 100% − 112px)', 'Living doc column'], ['340px', 'Details drawer'], ['420 × 530px', 'Onboarding panel'],
    ['300 × 36px', 'Island pill (440px cards)'], ['280px', 'Alert'], ['348px', 'Notification stack'], ['520px', 'Sheet default (--sheet-w)']
  ];
  const metricRow = ([name, use]) => `<div class="fd-kv"><code>${e(name)}</code><span${name.startsWith('--') ? ` data-var="${name}"` : ''}></span><em>${e(use)}</em></div>`;
  const HEIGHTS = [
    ['34', '<div class="glass-group"><button class="btn">Today</button></div>', 'glass group'], ['34', '<button class="btn lg">Large</button>', 'btn lg'],
    ['30', `<span class="doc-chip">${Kit.fileBadge('Q4 Roadmap.pdf')}<span>Q4 Roadmap.pdf</span></span>`, 'doc chip'], ['28', '<button class="btn">Button</button>', 'btn'],
    ['28', '<input class="field" placeholder="Field" style="width:96px">', 'field'], ['28', '<div class="seg"><button aria-selected="true">Weekly</button><button>Monthly</button></div>', 'segmented'],
    ['24', '<button class="btn sm">Small</button>', 'btn sm'], ['24', `<button class="btn popup">Tuesday${icon('chevron-updown')}</button>`, 'popup'],
    ['22', '<span class="keycap">⌥</span>', 'keycap'], ['20', '<span class="chip accent">Brief ready</span>', 'chip'], ['20', Kit.avatar('Maria Chen'), 'avatar'],
    ['18', Kit.source('Sep 22 · 18:42'), 'source'], ['18', '<button class="switch" aria-checked="true" data-manual></button>', 'switch'], ['17', `<button class="check" aria-checked="true" data-manual>${Kit.checkSvg}</button>`, 'check']
  ];
  const heightCell = ([h, markup, name]) => `<div class="fd-h"><div class="fd-h-demo">${markup}</div><b>${h}</b><span>${e(name)}</span></div>`;
  const SPACING = [[2, 'Segmented inset, glass-group inset 3'], [4, 'Chip and icon gaps, menu inset 5'], [6, 'Button gap, popover inset, stacked chips'], [8, 'Toolbar gap, row padding, toast stack gap'],
    [10, 'Sidebar inset, list-row gap, sidebar-row gap 8'], [12, 'Card grid gap, toolbar right inset'], [14, 'Card side padding, time-column gap'], [18, 'Toolbar left inset, alert padding'],
    [22, 'Sheet padding, canvas padding'], [24, 'Peek gutters, doc blocks'], [28, 'Agenda side padding'], [44, 'Doc section rhythm']];
  const spaceRow = ([n, use]) => `<div class="fd-space"><code>${n}px</code><i style="width:${n * 3}px"></i><span>${e(use)}</span></div>`;

  const SHADOWS = [['--shadow-card', 'Cards at rest'], ['--shadow-card-hover', 'Interactive card hover, Next card'], ['--shadow-float', 'Popovers, menus, toasts, notifications, drawer, tooltips'], ['--shadow-window', 'Window, sheets, alerts, onboarding']];
  const shadowTile = ([name, use]) => `<div class="fd-elev"><div class="fd-elev-card" style="box-shadow:var(${name})"><code>${name}</code></div><p>${e(use)}</p><span class="fd-val" data-var="${name}" data-full></span></div>`;

  const MATERIALS = [
    ['Glass strong · popover, menu', 'background: var(--glass-strong); backdrop-filter: blur(26px) saturate(1.8)', 'background:var(--glass-strong);backdrop-filter:blur(26px) saturate(1.8);-webkit-backdrop-filter:blur(26px) saturate(1.8);box-shadow:var(--shadow-float)'],
    ['Glass strong · sheet, alert, notification', 'blur(34px) saturate(1.8) + --shadow-window / --shadow-float', 'background:var(--glass-strong);backdrop-filter:blur(34px) saturate(1.8);-webkit-backdrop-filter:blur(34px) saturate(1.8);box-shadow:var(--shadow-window)'],
    ['Glass group · toolbar capsule', 'blur(16px) saturate(1.6) + 0.5px --glass-edge + inset --glass-rim', 'background:var(--glass-strong);backdrop-filter:blur(16px) saturate(1.6);-webkit-backdrop-filter:blur(16px) saturate(1.6);box-shadow:0 0 0 0.5px var(--glass-edge), inset 0 0.5px 0 var(--glass-rim), 0 2px 10px rgba(23, 25, 31, 0.06)'],
    ['Sidebar · window material', 'background: var(--sidebar); blur(40px) saturate(1.7)', 'background:var(--sidebar);backdrop-filter:blur(40px) saturate(1.7);-webkit-backdrop-filter:blur(40px) saturate(1.7)'],
    ['Menu bar', 'background: var(--menubar); blur(30px) saturate(1.8)', 'background:var(--menubar);backdrop-filter:blur(30px) saturate(1.8);-webkit-backdrop-filter:blur(30px) saturate(1.8)'],
    ['Toolbar · scrolled', 'content-bg 76% + blur(18px) saturate(1.6); peek bar uses 82%', 'background:color-mix(in srgb, var(--content-bg) 76%, transparent);backdrop-filter:blur(18px) saturate(1.6);-webkit-backdrop-filter:blur(18px) saturate(1.6)'],
    ['Scrim', 'background: var(--scrim) behind sheets', 'background:var(--scrim)']
  ];
  const matBg = () => '<div class="fd-mat-bg"><i style="--c:var(--series-blue);left:8%;top:18%"></i><i style="--c:var(--series-orange);left:62%;top:6%"></i><i style="--c:var(--series-green);left:40%;top:54%"></i><b>Product Sync · 10:00</b><b>Acme · Implementation</b></div>';
  const matTile = ([label, recipe, style]) => ({ label, note: recipe, bg: 'wallpaper', span: 2, flush: true, height: 170, html: `<div class="fd-mat">${matBg()}<div class="fd-mat-panel" style="${style}">${e(label.split(' · ')[0])}</div></div>` });

  const EASINGS = [
    ['--ease-out', 220, 'Enter/exit of UI: popovers, sheets, toasts, press, fades (150–260ms)'],
    ['--ease-in-out', 320, 'On-screen movement: agenda FLIP reorder, notification exit'],
    ['--ease-drawer', 300, 'Side peek and details drawer (open 300ms, close 200ms)'],
    ['--spring', 'var', 'Morphs and landings: Island size morph, notification slide-in'],
    ['--spring-bounce', 'var', 'Playful landings: switch knob, Island bouncy morph']
  ];
  const parseEasing = (value) => {
    const bez = value.match(/cubic-bezier\(([^)]+)\)/);
    if (bez) return { kind: 'bezier', p: bez[1].split(',').map(Number) };
    const lin = value.match(/linear\(([^)]+)\)/);
    return lin ? { kind: 'linear', p: lin[1].split(',').map((v) => parseFloat(v)) } : { kind: 'linear', p: [0, 1] };
  };
  const bezierPoints = ([x1, y1, x2, y2]) => Array.from({ length: 49 }, (_, i) => {
    const t = i / 48;
    const u = 1 - t;
    return [3 * u * u * t * x1 + 3 * u * t * t * x2 + t ** 3, 3 * u * u * t * y1 + 3 * u * t * t * y2 + t ** 3];
  });
  const pointsOf = (ease) => (ease.kind === 'bezier' ? bezierPoints(ease.p) : ease.p.map((y, i) => [i / (ease.p.length - 1), y]));
  const px = (x) => (10 + x * 180).toFixed(1);
  const py = (y) => (10 + ((1.2 - y) / 1.4) * 100).toFixed(1);
  const plot = (points) => `<svg class="fd-plot" viewBox="0 0 200 120" aria-hidden="true"><path class="fd-grid" d="M10 ${py(0)}H190M10 ${py(1)}H190M10 10V110"/>`
    + `<path class="fd-lin" d="M${px(0)} ${py(0)}L${px(1)} ${py(1)}"/><path class="fd-curve" d="${points.map(([x, y], i) => `${i ? 'L' : 'M'}${px(x)} ${py(y)}`).join(' ')}"/></svg>`;
  const springFacts = (ease) => {
    const peak = Math.max(...ease.p);
    if (peak <= 1) return 'no overshoot';
    const k = -Math.log(peak - 1) / Math.PI;
    const zeta = k / Math.sqrt(1 + k * k);
    return `peak ${peak.toFixed(4)} (${((peak - 1) * 100).toFixed(1)}% overshoot) → framer-motion spring bounce ≈ ${(1 - zeta).toFixed(2)}`;
  };
  const durationOf = (tile) => (tile.dataset.dur === 'var' ? parseFloat(Kit.cssVar(`${tile.dataset.ease}-dur`)) : Number(tile.dataset.dur));
  const drawEase = (canvas) => {
    const tile = canvas.querySelector('.fd-ease');
    const value = Kit.cssVar(tile.dataset.ease);
    const ease = parseEasing(value);
    tile.querySelector('.fd-plot-slot').innerHTML = plot(pointsOf(ease));
    tile.querySelector('[data-value]').textContent = clip(value, 90);
    tile.querySelector('[data-dur]').textContent = `${durationOf(tile)}ms`;
    tile.querySelector('[data-facts]').textContent = ease.kind === 'linear' ? springFacts(ease) : `framer-motion ease: [${ease.p.join(', ')}]`;
  };
  const playEase = (tile, slow) => {
    const easing = Kit.cssVar(tile.dataset.ease);
    const duration = durationOf(tile) * slow;
    tile.querySelectorAll('.fd-dot').forEach((dot) => {
      const dist = dot.parentElement.clientWidth - dot.offsetWidth;
      dot.getAnimations().forEach((a) => a.cancel());
      const frames = [{ transform: 'translateX(0)' }, { transform: `translateX(${dist}px)` }];
      if (Kit.reduceMotion()) dot.animate(frames.slice(1), { duration: 0, fill: 'forwards' });
      else dot.animate(frames, { duration, easing: dot.hasAttribute('data-linear') ? 'linear' : easing, fill: 'forwards' });
    });
  };
  const easeTile = ([token, dur, use]) => ({
    label: token, note: use, span: token.startsWith('--spring') ? 3 : 2, height: 250, align: 'stretch',
    html: `<div class="fd-ease" data-ease="${token}" data-dur="${dur}"><div class="fd-plot-slot"></div>`
      + '<div class="fd-tracks"><div class="fd-track"><i class="fd-dot"></i></div><div class="fd-track lin"><i class="fd-dot" data-linear></i></div></div>'
      + `<div class="fd-ease-meta"><code data-value></code><span><b data-dur></b> · <span data-facts></span></span></div>`
      + `<div class="row-flex"><button class="btn sm" data-play="1">${icon('play')}Replay</button><button class="btn sm plain" data-play="4">0.25× speed</button><span class="spacer"></span><span class="t-caption">top: token · bottom: linear</span></div></div>`,
    mount: live((canvas) => {
      drawEase(canvas);
      const tile = canvas.querySelector('.fd-ease');
      if (tile.dataset.wired) return;
      tile.dataset.wired = '1';
      tile.addEventListener('click', (ev) => {
        const btn = ev.target.closest('[data-play]');
        if (btn) playEase(tile, Number(btn.dataset.play));
      });
    })
  });
  const DURATIONS = [
    ['press', '140ms', '--ease-out', 'Press scale: .btn 0.97, .check 0.88, sidebar row 0.985, card 0.992'],
    ['fast', '160ms', 'ease / --ease-out', 'Color and hover changes (120–160ms), menu close 120ms, tooltip 125ms'],
    ['base', '220ms', '--ease-out', 'Enter/exit: popover 150/190, alert 180/220, sheet 200/260, toast 220/340, rec capsule 240'],
    ['drawer', '300ms', '--ease-drawer', 'Side peek and drawer open (close 200ms)'],
    ['spring', '490ms', '--spring', 'Notification slide-in, Island morph (--spring-dur)'],
    ['spring-bounce', '600ms', '--spring-bounce', 'Switch knob, Island bouncy morph (--spring-bounce-dur)']
  ];
  const EXITS = [
    ['Popover', '190ms transform · 150ms opacity', '110ms · 110ms'], ['Alert', '220 · 180', '140 · 120'], ['Sheet + scrim', '260 · 200 (scrim 220)', '160 · 140'],
    ['Toast', '340 transform · 220 opacity', '180 · 160'], ['Notification', '490 --spring', '240 --ease-in-out'], ['Menu', 'instant', '120 opacity'],
    ['Side peek / drawer', '300 --ease-drawer', '200 --ease-drawer'], ['Recording capsule', '240 --ease-out (WAAPI)', '150 ease-out'], ['List row insert / remove', '280 (enterAnimated)', '220 (removeAnimated)']
  ];
  const RULES = [
    ['Only transform and opacity', 'Plus clip-path, filter blur ≤ 3px to mask crossfades, and grid-template-rows for collapse. Never transition: all.'],
    ['Enter and exit with --ease-out, 150–260ms', 'Exits are faster than enters (popover 190 → 110ms).'],
    ['Movement on screen uses --ease-in-out', 'FLIP reorders (320ms) and slide-outs.'],
    ['Springs only for morphs, landings and drag', 'Island, notification banner, switch knob, fly-to landings.'],
    ['Never from scale(0)', 'Start at ≥ 0.95 with opacity 0; popovers scale from their trigger (--origin).'],
    ['No animation on keyboard actions', 'Arrow-key selection, ⌘-shortcuts and day stepping by key swap instantly.'],
    ['Pointer swaps may crossfade', '≤ 200ms, optional 2px blur (T.fx.crossfade: out 110ms, in 190ms).'],
    ['Every pressable element has press feedback', 'Scale 0.97–0.99 on :active, 140ms --ease-out.'],
    ['Hover only on fine pointers', 'All hover rules live in @media (hover: hover) and (pointer: fine).'],
    ['Transitions for state, keyframes for loops', 'CSS transitions are interruptible; keyframes only for one-shot or looping decoration; WAAPI for measured motion (FLIP, fly-to, height).'],
    ['Stagger 30–50ms', 'Kit .enter uses 40ms × --i; never block input during a stagger.'],
    ['Respect reduced motion', 'Kit CSS limits transitions to opacity/colors/shadows, disables .enter/.bump/.wave/.shimmer, slows the rec dot to 2.4s; Kit JS skips flip, flyTo, removeAnimated, enterAnimated.']
  ];
  const tableMarkup = (head, rows) => `<table class="fd-table"><tr>${head.map((h) => `<th>${e(h)}</th>`).join('')}</tr>${rows.map((r) => `<tr>${r.map((c, i) => `<td>${i === 0 ? `<b>${e(c)}</b>` : c.startsWith('--') ? `<code>${e(c)}</code>` : e(c)}</td>`).join('')}</tr>`).join('')}</table>`;

  const LUCIDE = {
    apple: '— (system glyph)', wifi: 'wifi', battery: 'battery-full', control: '— (Control Center glyph)', calendar: 'calendar', 'calendar-plus': 'calendar-plus', 'calendar-check': 'calendar-check',
    clock: 'clock', sun: 'sun', tray: 'inbox', 'tray-down': 'import', sparkle: 'sparkle', sparkles: 'sparkles', doc: 'file-text', 'doc-plus': 'file-plus', notes: 'notepad-text', folder: 'folder',
    paperclip: 'paperclip', link: 'link', repeat: 'refresh-cw', check: 'check', 'check-circle': 'circle-check', x: 'x', 'x-circle': 'circle-x', plus: 'plus', minus: 'minus',
    'chevron-right': 'chevron-right', 'chevron-left': 'chevron-left', 'chevron-down': 'chevron-down', 'chevron-updown': 'chevrons-up-down', ellipsis: 'ellipsis', search: 'search',
    sidebar: 'panel-left', inspector: 'panel-right', compose: 'square-pen', pencil: 'pencil', trash: 'trash-2', archive: 'archive', person: 'user', people: 'users', lock: 'lock', cloud: 'cloud',
    mic: 'mic', record: 'circle (filled)', stop: 'square (filled)', pause: 'pause', play: 'play', waveform: 'audio-lines', video: 'video', bell: 'bell', 'arrow-up-right': 'arrow-up-right',
    'arrow-right': 'arrow-right', return: 'corner-down-left', undo: 'undo-2', command: 'command', sliders: 'sliders-horizontal', pin: 'pin', flag: 'flag', target: 'target', list: 'list',
    quote: 'message-circle', question: 'circle-help', info: 'info', decision: 'badge-check (kit: hexagon + check)', commitment: 'corner-down-right', fact: 'book-open', history: 'history',
    bolt: 'zap', grip: 'grip-vertical', eye: 'eye', lightbulb: 'lightbulb', share: 'share', 'thumbs-up': 'thumbs-up', hand: 'hand'
  };
  const iconCell = (name) => `<div class="fd-icon">${icon(name, 'lg')}<b>${e(name)}</b><span>${e(LUCIDE[name] || '—')}</span></div>`;
  const SIZES = [['sm', '13px · stroke 1.6'], ['', '16px · stroke 1.6 (md)'], ['lg', '20px · stroke 1.6'], ['xl', '28px · stroke 1.4']];
  const CONTEXTS = [
    ['Chip', '<span class="chip accent">' + icon('check') + 'Tracking</span>', '12px · 1.8'], ['Source', Kit.source('Sep 22 · 18:42'), '10px · 2'], ['Knowledge type', Kit.ktype('decision'), '13px · 1.9'],
    ['Menu item', `<div class="menu-item" style="padding:0">${icon('pencil')}Edit purpose…</div>`, '14px · label-2'], ['Series icon', Kit.seriesIcon(DATA.series[0]), '12px · 2 on color'],
    ['Sidebar row', `<div class="sb-item" style="padding:0">${icon('sun')}Today</div>`, '16px · accent'], ['Menu bar', `<span style="display:inline-flex">${icon('wifi')}</span>`, '15px']
  ];

  const appIconSize = ([cls, label]) => `<div class="fd-appicon"><div class="app-icon ${cls}"><img src="../kit/telu-icon.png" alt=""></div><b>${e(label)}</b></div>`;

  Catalog.section({
    id: 'foundations',
    eyebrow: 'Layer 1',
    title: 'Foundations',
    intro: 'Tokens and rules every component is built from: color in both themes, type, radii and sizes, elevation, materials, motion curves, icons and the app icon. Values are read live from the running theme, so switching Light / Dark updates every number.',
    css: `
.fd-wide { width: 100%; }
.fd-group + .fd-group { margin-top: 22px; padding-top: 18px; box-shadow: inset 0 0.5px 0 var(--separator); }
.fd-group-head { display: flex; align-items: baseline; gap: 10px; margin-bottom: 12px; }
.fd-group-head b { font-weight: 600; }
.fd-group-head span { font-size: 12px; color: var(--label-2); }
.fd-swatches { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 16px 22px; }
.fd-sw { display: grid; grid-template-columns: 44px minmax(0, 1fr); gap: 12px; align-items: start; min-width: 0; }
.fd-chip { position: relative; width: 44px; height: 44px; border-radius: 12px; overflow: hidden; background: repeating-conic-gradient(var(--fill-2) 0 25%, transparent 0 50%) 0 0 / 12px 12px; box-shadow: inset 0 0 0 0.5px var(--hairline); }
.fd-chip > i { position: absolute; inset: 0; }
.fd-chip::after { content: ""; position: absolute; inset: 0; border-radius: inherit; box-shadow: inset 0 0 0 0.5px var(--hairline); pointer-events: none; }
.fd-sw code, .fd-srow code, .fd-person code { font: 600 12px/1.3 var(--font-mono); color: var(--label); }
.fd-val { display: block; margin-top: 2px; font: 11px/1.4 var(--font-mono); color: var(--label-2); overflow-wrap: anywhere; user-select: text; -webkit-user-select: text; }
.fd-sw p { margin: 4px 0 0; font-size: 12px; line-height: 1.4; color: var(--label-2); }
.fd-srow { display: grid; grid-template-columns: 44px 190px minmax(0, 1fr); gap: 14px; align-items: center; padding: 8px 0; box-shadow: inset 0 -0.5px 0 var(--separator); }
.fd-users { display: flex; flex-wrap: wrap; gap: 6px 14px; }
.fd-user { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; }
.fd-people { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 12px; }
.fd-person { display: flex; align-items: center; gap: 10px; }
.fd-person b { display: block; font-weight: 500; }
.fd-type { display: grid; grid-template-columns: minmax(0, 1.25fr) 190px minmax(0, 1fr); column-gap: 20px; align-items: center; }
.fd-type > * { min-width: 0; padding: 9px 0; box-shadow: inset 0 -0.5px 0 var(--separator); }
.fd-spec { display: flex; min-width: 0; }
.fd-type code { display: block; font: 600 11.5px/1.3 var(--font-mono); }
.fd-metric { font: 11px/1.4 var(--font-mono); color: var(--label-2); }
.fd-use { font-size: 12px; color: var(--label-2); line-height: 1.4; }
.fd-mono { font-family: var(--font-mono); }
.fd-fonts { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; }
.fd-font b { display: block; font-size: 20px; font-weight: 600; margin-bottom: 4px; }
.fd-font code { font: 11.5px var(--font-mono); }
.fd-font p { margin: 2px 0 0; font-size: 12px; color: var(--label-2); }
.fd-utils { display: grid; grid-template-columns: 150px minmax(0, 1fr); gap: 10px 18px; align-items: center; }
.fd-utils code { font: 11.5px var(--font-mono); }
.fd-radii { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 18px; }
.fd-radius i { display: block; height: 58px; margin-bottom: 8px; background: var(--accent-softer); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 45%, transparent); }
.fd-radius code { font: 600 11.5px var(--font-mono); }
.fd-radius > span { margin-left: 6px; font: 11px var(--font-mono); color: var(--label-2); }
.fd-radius p, .fd-elev p { margin: 3px 0 0; font-size: 12px; color: var(--label-2); line-height: 1.35; }
.fd-kvs { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 28px; }
.fd-kv { display: grid; grid-template-columns: 196px 52px minmax(0, 1fr); gap: 10px; align-items: baseline; padding: 7px 0; box-shadow: inset 0 -0.5px 0 var(--separator); }
.fd-kv code { font: 600 11.5px var(--font-mono); }
.fd-kv > span { font: 11.5px var(--font-mono); color: var(--label-2); }
.fd-kv em { font-style: normal; font-size: 12px; color: var(--label-2); }
.fd-heights { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 22px 26px; }
.fd-h { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.fd-h-demo { display: flex; align-items: flex-end; min-height: 36px; padding-bottom: 6px; box-shadow: 0 1px 0 color-mix(in srgb, var(--accent) 50%, transparent); }
.fd-h > b { font: 600 12px var(--font-mono); }
.fd-h > span { font-size: 11px; color: var(--label-3); }
.fd-space { display: grid; grid-template-columns: 52px 150px minmax(0, 1fr); gap: 12px; align-items: center; padding: 4px 0; }
.fd-space code { font: 600 11.5px var(--font-mono); }
.fd-space i { display: block; height: 10px; border-radius: 2px; background: var(--accent-soft); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 40%, transparent); }
.fd-space > span { font-size: 12px; color: var(--label-2); }
.fd-elevs { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 26px; }
.fd-elev-card { height: 96px; border-radius: var(--r-card); background: var(--surface); display: grid; place-items: center; margin-bottom: 12px; }
.fd-elev-card code { font: 600 12px var(--font-mono); }
.fd-elev .fd-val { margin-top: 6px; }
.fd-mat { position: relative; width: 100%; height: 100%; min-height: 170px; overflow: hidden; }
.fd-mat-bg i { position: absolute; width: 64px; height: 64px; border-radius: 50%; background: var(--c); }
.fd-mat-bg b { position: absolute; left: 16px; font: 700 22px/1 var(--font-display); color: var(--label); }
.fd-mat-bg b:nth-of-type(1) { top: 70px; }
.fd-mat-bg b:nth-of-type(2) { top: 104px; left: 120px; color: var(--accent); }
.fd-mat-panel { position: absolute; inset: 40px 24px 24px 28%; border-radius: 14px; display: grid; place-items: center; font-weight: 600; }
.fd-ease { width: 100%; display: flex; flex-direction: column; gap: 10px; }
.fd-plot-slot { height: 120px; }
.fd-plot { width: 200px; height: 120px; display: block; }
.fd-grid { stroke: var(--separator); stroke-width: 1; fill: none; }
.fd-lin { stroke: var(--label-4); stroke-width: 1; stroke-dasharray: 3 3; fill: none; }
.fd-curve { stroke: var(--accent); stroke-width: 2; fill: none; stroke-linejoin: round; }
.fd-tracks { display: flex; flex-direction: column; gap: 6px; }
.fd-track { position: relative; height: 14px; border-radius: 999px; background: var(--fill); }
.fd-dot { position: absolute; left: 0; top: 0; width: 14px; height: 14px; border-radius: 50%; background: var(--accent); box-shadow: 0 1px 3px rgba(23, 25, 31, 0.2); }
.fd-track.lin .fd-dot { background: var(--label-3); }
.fd-ease-meta { display: flex; flex-direction: column; gap: 2px; font-size: 11.5px; color: var(--label-2); }
.fd-ease-meta code { font: 11px/1.35 var(--font-mono); color: var(--label); overflow-wrap: anywhere; }
.fd-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.fd-table th { text-align: left; font-size: 11px; font-weight: 600; color: var(--label-3); padding: 0 12px 8px 0; }
.fd-table td { padding: 7px 12px 7px 0; box-shadow: inset 0 0.5px 0 var(--separator); vertical-align: top; color: var(--label-2); }
.fd-table td b { color: var(--label); font-weight: 600; }
.fd-table code { font: 11.5px var(--font-mono); color: var(--label); }
.fd-rules { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 12px 26px; counter-reset: rule; }
.fd-rule { position: relative; padding-left: 28px; font-size: 12.5px; line-height: 1.45; color: var(--label-2); }
.fd-rule::before { counter-increment: rule; content: counter(rule); position: absolute; left: 0; top: 1px; width: 18px; height: 18px; border-radius: 50%; display: grid; place-items: center; font-size: 10.5px; font-weight: 600; background: var(--accent-soft); color: var(--accent-strong); }
.fd-rule b { display: block; color: var(--label); font-weight: 600; }
.fd-icons { display: grid; grid-template-columns: repeat(auto-fill, minmax(118px, 1fr)); gap: 2px; }
.fd-icon { display: flex; flex-direction: column; align-items: center; gap: 5px; padding: 12px 6px 10px; border-radius: 10px; text-align: center; }
.fd-icon b { font: 500 11px/1.2 var(--font-mono); }
.fd-icon span { font-size: 10.5px; line-height: 1.25; color: var(--label-3); }
.fd-sizes { display: flex; flex-wrap: wrap; gap: 26px; align-items: flex-end; }
.fd-size { display: flex; flex-direction: column; align-items: center; gap: 8px; font-size: 11px; color: var(--label-2); }
.fd-size > div { display: flex; gap: 10px; align-items: center; }
.fd-ctx { display: grid; grid-template-columns: 120px minmax(0, 1fr) 150px; gap: 10px 16px; align-items: center; font-size: 12px; }
.fd-ctx > span:nth-child(3n) { font: 11px var(--font-mono); color: var(--label-2); }
.fd-appicons { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 28px; }
.fd-appicon { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.fd-appicon b { font-size: 11px; font-weight: 500; color: var(--label-2); text-align: center; }
.fd-template { display: flex; gap: 28px; align-items: center; }
.fd-template-cell { display: flex; flex-direction: column; align-items: center; gap: 8px; font-size: 11px; color: var(--label-2); }
.fd-template-cell img { width: 16px; height: 16px; }
.fd-menubar-host { position: relative; width: 100%; height: 26px; border-radius: 8px; overflow: hidden; }
.fd-menubar-host .menubar { position: absolute; }
`,
    components: [
      {
        id: 'color-tokens',
        name: 'ColorTokens',
        summary: 'Semantic color tokens for both themes. Swatches show the live value from the active theme and what the color means — brand colors are rationed by meaning, not decoration.',
        mapsTo: 'CSS variables consumed by Tailwind theme colors (colors.accent = "var(--accent)" …); light/dark swap by theme stylesheet or [data-theme]',
        usedIn: ['Every component'],
        source: 'themes/default.css · themes/dark.css (:root)',
        props: [['theme', 'light (default.css) | dark (dark.css)', 'system via prefers-color-scheme']],
        states: ['light', 'dark'],
        tokens: ['--accent', '--mint', '--coral', '--amber', '--label…-4', '--window-bg', '--content-bg', '--surface', '--surface-sunken', '--fill…-3', '--separator', '--hairline', '--glass-strong', '--sidebar', '--menubar', '--scrim'],
        motion: 'None. Theme switch swaps the stylesheet instantly (no color transition on :root); components keep their own 150–200ms color transitions.',
        a11y: 'label-3 and label-4 are for non-essential text only. Mint never carries body text — use mint-ink for its heading. Coral text uses coral-ink. Every state that uses color also changes shape or text (dot, chip label, strikethrough).',
        stories: [
          tokenTile('Brand', 'Accent, mint, coral and amber families — values read from the active theme', BRAND.map(([t, n, list]) => group(t, n, list)).join('')),
          tokenTile('Labels 1–4', 'Text hierarchy', group('', '', LABELS)),
          tokenTile('Surfaces', 'Window, content, card and well backgrounds', group('', '', SURFACES)),
          tokenTile('Fills and separators', 'Quiet fills for controls; 0.5px hairlines instead of borders', group('', '', FILLS)),
          tokenTile('Glass and materials', 'Translucent tokens shown over the wallpaper, as they are used', group('', '', GLASS), 'wallpaper')
        ]
      },
      {
        id: 'series-colors',
        name: 'SeriesColors',
        summary: 'Identity palette for series (and knowledge types), plus the fixed hex colors that do not change with the theme.',
        mapsTo: 'Tailwind colors.series.{blue…gray} = var(--series-*); stored per series as a token name, never a hex',
        usedIn: ['Sidebar', 'Agenda cards', 'Living doc', 'Menus (swatches)', 'Island', 'Avatars'],
        source: 'themes/*.css --series-* · kit/data.js series[].color · DATA.people',
        props: [['color', 'blue | orange | green | purple | teal | pink | gray', 'gray (drafts)']],
        tokens: ['--series-blue', '--series-orange', '--series-green', '--series-purple', '--series-teal', '--series-pink', '--series-gray'],
        motion: 'None.',
        a11y: 'Series color is never the only identifier — the series icon glyph and name always accompany it.',
        stories: [
          { label: 'Series palette', note: 'Token, live value and the series that use it. Knowledge types reuse it: decision = accent, commitment = orange, question = amber, fact = teal', span: 'full', align: 'stretch', html: `<div class="fd-wide">${SERIES.map(seriesRow).join('')}<div class="fd-users" style="margin-top:14px">${KTYPE_MAP.map(([t, token]) => `<span class="fd-user">${Kit.ktype(t)}<code style="font:11px var(--font-mono);color:var(--label-2)">${token}</code></span>`).join('')}</div></div>`, mount: live(fillVars) },
          { label: 'People colors', note: 'Avatar fill per person (DATA.people) — fixed hex, same in both themes', span: 'full', align: 'stretch', html: `<div class="fd-wide fd-people">${Object.entries(DATA.people).map(personSwatch).join('')}</div>` },
          { label: 'Fixed hex colors', note: 'Not themed: file-type badges, traffic lights, app icon', span: 'full', align: 'stretch', html: `<div class="fd-wide fd-swatches">${FIXED.map(fixedSwatch).join('')}</div>` }
        ]
      },
      {
        id: 'typography',
        name: 'Typography',
        summary: 'System type scale (SF Pro Text / Display). Metrics are measured from the rendered specimen.',
        mapsTo: 'Tailwind fontSize/fontFamily extension + a <Text variant> helper; tabular numerals via font-variant-numeric',
        usedIn: ['Every surface'],
        source: 'kit/mac-kit.css .t-* · 002 doc.css .sec-eyebrow',
        props: [['variant', 'large | title1 | title2 | title3 | headline | body | callout | caption | eyebrow | section-eyebrow', 'body'], ['numeric', 'boolean (tabular-nums)', 'false'], ['tone', 'default | muted | faint', 'default'], ['truncate', 'boolean', 'false']],
        tokens: ['--font', '--font-display', '--font-rounded', '--font-mono', '--label', '--label-2', '--label-3'],
        motion: 'None.',
        a11y: 'Body is 13px (macOS default); never go below 10.5px. Headings use semantic h1–h3 regardless of visual variant.',
        stories: [
          { label: 'Type scale', note: 'size / line-height · weight · tracking — measured live', span: 'full', align: 'stretch', html: `<div class="fd-wide fd-type">${TYPE.map(typeRow).join('')}</div>`, mount: live(measure) },
          { label: 'Font stacks', span: 'full', align: 'stretch', html: `<div class="fd-wide fd-fonts">${FONTS.map(([v, use]) => `<div class="fd-font"><b style="font-family:var(${v})">Product Sync 10:00</b><code>${v}</code><p>${e(use)}</p></div>`).join('')}</div>` },
          { label: 'Text utilities', note: 'Tone, numerals, truncation and superseded text', span: 'full', align: 'stretch', html: `<div class="fd-wide fd-utils"><code>.muted</code><span class="muted">Google Meet · 10:00–10:45</span><code>.faint</code><span class="faint">Not watched</span><code>.num</code><span><span class="num">10:00 · 11:11 · 12:04</span> <span class="faint">vs</span> 10:00 · 11:11 · 12:04</span><code>.truncate</code><span class="truncate" style="max-width:260px">Keep product, design and engineering pointed at the same three priorities</span><code>.superseded-text</code><span class="superseded-text">Pricing experiment runs until Oct 1</span></div>` }
        ]
      },
      {
        id: 'radii-spacing',
        name: 'RadiiAndSpacing',
        summary: 'Corner radii, layout metrics, control heights and the spacing values the app actually uses.',
        mapsTo: 'Tailwind borderRadius (window/card/control/full) + spacing scale; layout constants in a shared tokens file',
        usedIn: ['Every surface'],
        source: 'kit/mac-kit.css :root (--r-*, --menubar-h, --toolbar-h, --sidebar-w) · 002 app.css .t-app',
        tokens: ['--r-window', '--r-card', '--r-control', '--menubar-h', '--toolbar-h', '--sidebar-w'],
        motion: 'None.',
        a11y: 'Smallest hit target is 17px (check) inside ≥ 24px rows; icon buttons are 24–28px.',
        stories: [
          { label: 'Radii', note: 'Tokens first, then fixed radii used by specific components', span: 'full', align: 'stretch', html: `<div class="fd-wide fd-radii">${RADII.map(radius).join('')}</div>`, mount: live(measureRadii) },
          { label: 'Layout metrics', span: 'full', align: 'stretch', html: `<div class="fd-wide fd-kvs">${METRICS.map(metricRow).join('')}</div>`, mount: live(fillVars) },
          { label: 'Control heights', note: 'Real controls on a shared baseline', span: 'full', html: `<div class="fd-wide fd-heights">${HEIGHTS.map(heightCell).join('')}</div>`, mount: (canvas) => canvas.querySelectorAll('.seg').forEach((seg) => Kit.segmented(seg)) },
          { label: 'Spacing in use', note: 'No spacing tokens in the kit — these are the values 002 uses (px)', span: 'full', align: 'stretch', html: `<div class="fd-wide">${SPACING.map(spaceRow).join('')}</div>` }
        ]
      },
      {
        id: 'elevation',
        name: 'Elevation',
        summary: 'Four shadows. Hairline rings (0.5px) do the work of borders; depth stays soft.',
        mapsTo: 'Tailwind boxShadow { card, card-hover, float, window } = var(--shadow-*)',
        usedIn: ['Cards', 'Popovers', 'Menus', 'Toasts', 'Notifications', 'Window', 'Sheets', 'Alerts'],
        source: 'themes/*.css --shadow-*',
        tokens: ['--shadow-card', '--shadow-card-hover', '--shadow-float', '--shadow-window'],
        motion: motion({ trigger: 'hover on an interactive card (fine pointers)', props: 'box-shadow --shadow-card → --shadow-card-hover', duration: '200ms in and out', easing: 'ease', runtime: 'CSS transition (interruptible)', reduced: 'unchanged (box-shadow is allowed)', framer: 'none — CSS hover:shadow-card-hover' }),
        a11y: 'Shadows are decorative; focus is never shown by shadow alone.',
        stories: [{ label: 'Shadows', note: 'Live values; dark theme adds an inner top highlight', bg: 'window', span: 'full', align: 'stretch', html: `<div class="fd-wide fd-elevs">${SHADOWS.map(shadowTile).join('')}</div>`, mount: live(fillVars) }]
      },
      {
        id: 'materials',
        name: 'Materials',
        summary: 'Translucent materials over the wallpaper: fill token + backdrop blur + saturation, with the exact recipe per surface.',
        mapsTo: 'Tailwind utilities (bg-glass-strong backdrop-blur-[26px] backdrop-saturate-[1.8]); Tauri window vibrancy (NSVisualEffectView) for the real sidebar',
        usedIn: ['Window', 'Menu bar', 'Toolbar', 'Popovers', 'Menus', 'Sheets', 'Alerts', 'Toasts', 'Notifications', 'Island'],
        source: 'kit/mac-kit.css .window .menubar .toolbar.scrolled .glass-group .popover .menu .sheet .alert .toast .notif · 002 island.css',
        tokens: ['--glass-strong', '--glass-rim', '--glass-edge', '--sidebar', '--menubar', '--scrim', '--content-bg'],
        motion: motion({ trigger: 'content scrolls under the toolbar (scrollTop > 2)', props: 'background-color transparent → content-bg 76% and box-shadow hairline; the backdrop blur switches on without a transition', duration: '200ms both ways', easing: 'ease', runtime: 'CSS transition (interruptible)', reduced: 'unchanged', framer: 'none — CSS on data-scrolled' }),
        a11y: 'Text on glass always uses label tokens; reduce-transparency should fall back to opaque --content-bg (not implemented in 002).',
        stories: MATERIALS.map(matTile)
      },
      {
        id: 'focus-ring',
        name: 'FocusRing',
        summary: 'Keyboard focus treatments. Buttons and checks get an outline; fields and search draw a soft 3.5px ring instead.',
        mapsTo: 'Tailwind focus-visible:outline + ring utilities; Radix primitives expose focus-visible natively',
        usedIn: ['Buttons', 'Fields', 'Search', 'Checks', 'Menus'],
        source: 'kit/mac-kit.css :focus-visible · .field:focus · .search .field:focus',
        tokens: ['--accent'],
        motion: motion({ trigger: 'focus (fields) / focus-visible (buttons, checks)', props: 'fields: box-shadow ring; buttons: outline (not transitioned)', duration: 'field ring 150ms in and out; outline instant', easing: 'ease', runtime: 'CSS transition', reduced: 'unchanged', framer: 'none — CSS focus-visible utilities' }),
        a11y: ':focus-visible → 3px outline, accent 45%, offset 1px. Fields: inset 0.5px accent + 3.5px accent 32% ring. The kit removes the outline on .switch, .menu and .sheet — switches have no visible focus (gap to fix in React).',
        stories: [{
          label: 'Focus treatments', note: 'Forced with state classes', force: 'focus', span: 'full',
          html: `<div class="row-flex" style="gap:22px;flex-wrap:wrap"><button class="btn" data-force>Not now</button><button class="btn primary" data-force>Track 5 series</button><input class="field" data-force placeholder="Describe it" style="width:170px"><label class="search" style="width:200px">${icon('search')}<input class="field" data-force placeholder="Search"></label><button class="check" aria-checked="true" data-manual data-force>${Kit.checkSvg}</button><button class="switch" aria-checked="true" data-manual data-force></button><span class="t-caption">switch: no ring</span></div>`
        }]
      },
      {
        id: 'motion-tokens',
        name: 'MotionTokens',
        summary: 'Five easing curves and the duration scale. Plots are drawn from the live token values; Replay runs the real curve (top dot) against linear (bottom dot). Every animation instance is cataloged in the Animations section.',
        mapsTo: 'framer-motion transition presets (ease arrays and spring presets) + Tailwind transitionTimingFunction/duration',
        usedIn: ['Every animated component'],
        source: 'kit/mac-kit.css :root --ease-* --spring* · @media (prefers-reduced-motion)',
        props: [['ease', 'out | in-out | drawer | spring | spring-bounce', 'out'], ['duration', 'press 140 | fast 160 | base 220 | drawer 300 | spring 490 | spring-bounce 600', 'base']],
        tokens: ['--ease-out', '--ease-in-out', '--ease-drawer', '--spring', '--spring-dur', '--spring-bounce', '--spring-bounce-dur'],
        motion: 'Easings: --ease-out cubic-bezier(0.23, 1, 0.32, 1) → framer ease [0.23, 1, 0.32, 1]; --ease-in-out cubic-bezier(0.77, 0, 0.175, 1) → [0.77, 0, 0.175, 1]; --ease-drawer cubic-bezier(0.32, 0.72, 0, 1) → [0.32, 0.72, 0, 1]; --spring linear() 490ms (0.3% overshoot) → { type: "spring", duration: 0.49, bounce ≈ 0.12 }; --spring-bounce linear() 600ms (3.8% overshoot) → { type: "spring", duration: 0.6, bounce ≈ 0.28 }. Use the spring tokens only through transitions of transform/size; linear() is CSS-only, so in React prefer the framer spring equivalents.',
        a11y: 'prefers-reduced-motion: kit CSS restricts transition-property to opacity, background-color, color, box-shadow, border-color (!important), disables .enter .bump .wave .shimmer keyframes and slows .rec-dot to 2.4s; Kit JS helpers return early. In React use useReducedMotion() and MotionConfig reducedMotion="user".',
        stories: [
          ...EASINGS.map(easeTile),
          { label: 'Duration scale', note: 'Named durations for the React tokens', span: 'full', align: 'stretch', html: `<div class="fd-wide">${tableMarkup(['Name', 'Duration', 'Easing', 'Used for'], DURATIONS)}</div>` },
          { label: 'Enter vs exit', note: 'Exits are always faster than enters', span: 'full', align: 'stretch', html: `<div class="fd-wide">${tableMarkup(['Surface', 'Enter', 'Exit'], EXITS)}</div>` },
          { label: 'Motion rules', note: 'Non-negotiable — from the design direction (Emil Kowalski)', span: 'full', align: 'stretch', html: `<div class="fd-wide fd-rules">${RULES.map(([t, d]) => `<div class="fd-rule"><b>${e(t)}</b>${e(d)}</div>`).join('')}</div>` }
        ]
      },
      {
        id: 'iconography',
        name: 'Iconography',
        summary: `All ${Object.keys(window.ICONS).length} kit icons — 24×24 grid, round caps and joins, currentColor stroke — with the closest lucide-react name.`,
        mapsTo: 'lucide-react (strokeWidth 1.6, size 16) — names below; keep a local Icon wrapper for the four custom glyphs (apple, control, decision, record/stop fills)',
        usedIn: ['Every surface'],
        source: 'kit/icons.js window.ICONS · icon(name, cls) · kit/mac-kit.css .i',
        props: [['name', 'keyof ICONS', '—'], ['size', 'sm 13 | md 16 | lg 20 | xl 28', 'md'], ['strokeWidth', '1.6 (xl 1.4); contexts override', '1.6']],
        tokens: ['currentColor', '--accent (sidebar)', '--label-2 (menus)', '--label-3 (empty states)'],
        motion: 'None on the glyph itself. Containers animate (disclosure chevron rotates 90° in 200ms --ease-out).',
        a11y: 'Icons are aria-hidden SVGs; the control carries the label (aria-label on icon-only buttons).',
        stories: [
          { label: 'All icons', note: 'kit name · lucide name', span: 'full', align: 'stretch', html: `<div class="fd-wide fd-icons">${Object.keys(window.ICONS).map(iconCell).join('')}</div>` },
          { label: 'Sizes', note: 'sm · md · lg · xl', span: 2, html: `<div class="fd-sizes">${SIZES.map(([cls, label]) => `<div class="fd-size"><div>${['calendar', 'record', 'sparkles', 'lock'].map((n) => icon(n, cls)).join('')}</div>${e(label)}</div>`).join('')}</div>` },
          { label: 'Context overrides', note: 'Components resize and re-stroke icons', span: 'full', align: 'stretch', html: `<div class="fd-wide fd-ctx">${CONTEXTS.map(([n, m, v]) => `<span>${e(n)}</span><span>${m}</span><span>${e(v)}</span>`).join('')}</div>` }
        ]
      },
      {
        id: 'app-icon',
        name: 'AppIcon',
        summary: 'The Telu mark on the indigo squircle, plus the monochrome template glyph used in the menu bar.',
        mapsTo: 'Static asset component <AppIcon size>; menu-bar glyph = Tauri tray icon with icon_as_template(true)',
        usedIn: ['Alerts', 'Notification banners', 'Welcome page', 'Onboarding', 'Menu bar status item', 'Island setup pill'],
        source: 'kit/mac-kit.css .app-icon (.sm .md) · .template-img · kit/telu-icon.png · kit/telu-menubar.png',
        props: [['size', '20 (sm) | 32 (md) | 56 (default) | 60 (onboarding)', '56'], ['template', 'boolean — monochrome menu-bar glyph', 'false']],
        tokens: ['--template-filter'],
        motion: 'Onboarding flies a 60px icon into the menu bar (Kit.flyTo, 620ms) — see Animations. The icon itself is static.',
        a11y: 'Decorative (alt="") next to a visible app name; the status item has aria-label="Telu".',
        stories: [
          { label: 'Sizes', note: 'sm 20 · md 32 · 56 (alerts, welcome) · 60 (onboarding .ob-icon); notification banners use 32 with 8px radius', span: 2, html: `<div class="fd-appicons">${[['sm', '20 · sm'], ['md', '32 · md'], ['', '56 · default'], ['ob-icon', '60 · onboarding']].map(appIconSize).join('')}</div>` },
          { label: 'Menu-bar template glyph', note: 'Raw PNG vs .template-img — filter: var(--template-filter) is none in light and invert(1) in dark', span: 2, html: `<div class="fd-template"><div class="fd-template-cell"><img src="../kit/telu-menubar.png" alt="">Raw asset</div><div class="fd-template-cell"><img src="../kit/telu-menubar.png" class="template-img" alt="">Template (current theme)</div></div>` },
          { label: 'In the menu bar', note: 'Status item, icon only (before onboarding)', span: 'full', flush: true, height: 60, html: `<div style="padding:17px 22px;width:100%"><div class="fd-menubar-host">${Kit.menubar({ app: 'Telu', menus: ['File', 'Edit', 'View', 'Meeting', 'Window', 'Help'], extras: '<span class="mb-item telu-status icon-only" role="button" aria-label="Telu"><img src="../kit/telu-menubar.png" class="template-img" alt=""><span class="ts-text"></span></span>' })}</div></div>`, bg: 'wallpaper' }
        ]
      }
    ]
  });
})();
