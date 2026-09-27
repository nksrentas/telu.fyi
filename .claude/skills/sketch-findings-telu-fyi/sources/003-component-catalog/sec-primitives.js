(() => {
  const VARIANTS = [
    { label: 'Default', cls: '', text: 'Not now' },
    { label: 'Primary', cls: 'primary', text: 'Track 5 series' },
    { label: 'Record', cls: 'record', text: `${icon('record')}Record <span class="kbd">⌘R</span>` },
    { label: 'Tinted', cls: 'tinted', text: 'Review' },
    { label: 'Plain', cls: 'plain', text: `${icon('plus')}Add item` }
  ];
  const STATES = [
    { label: 'Rest' },
    { label: 'Hover', force: 'hover' },
    { label: 'Pressed', force: 'active' },
    { label: 'Focus', force: 'focus' },
    { label: 'Disabled', disabled: true }
  ];

  const e = Catalog.esc;
  const motion = ({ trigger, props, duration, easing, runtime, reduced, framer }) => [
    `Trigger: ${trigger}`, `Animates: ${props}`, `Duration: ${duration}`, `Easing: ${easing}`, `Runtime: ${runtime}`, `Reduced motion: ${reduced}`, `framer-motion: ${framer}`
  ].join(' · ');
  const replayButton = (label = 'Replay') => `<button class="btn sm pm-replay" data-replay>${icon('play')}${label}</button>`;
  const onReplay = (fn) => (canvas) => {
    fn(canvas, true);
    canvas.querySelector('[data-replay]').addEventListener('click', () => fn(canvas, false));
  };
  const mountSegs = (canvas) => canvas.querySelectorAll('.seg').forEach((seg) => Kit.segmented(seg));

  const stepper = (disabled = false) => `<div class="glass-group"><button class="btn icon" data-tip="Previous day"${disabled ? ' disabled' : ''}>${icon('chevron-left')}</button><button class="btn">Today</button><button class="btn icon" data-tip="Next day"${disabled ? ' disabled' : ''}>${icon('chevron-right')}</button></div>`;
  const newGroup = () => `<div class="glass-group"><button class="btn a-new-btn">${icon('plus')}New<span class="kbd">⌥⌘N</span></button><span class="sep"></span><button class="btn icon" data-tip="Search">${icon('search')}</button></div>`;
  const recordInner = (live) => (live ? '<span class="rec-dot"></span><span class="num tb-timer" data-timer="724">12:04</span><span>Stop</span>' : '<span class="rec-glyph"></span>Record<span class="kbd">⌘R</span>');
  const docGroup = (live = false) => `<div class="glass-group"><button class="btn icon" data-tip="History">${icon('history')}</button><button class="btn icon" data-tip="Export as Markdown">${icon('share')}</button><span class="sep"></span><button class="btn tb-record${live ? ' live' : ''}">${recordInner(live)}</button><button class="btn icon" data-tip="More">${icon('ellipsis')}</button></div>`;
  const inspectorGroup = () => `<div class="glass-group"><button class="btn icon" data-tip="Details">${icon('inspector')}</button></div>`;
  const GROUP_ITEMS = [
    { label: 'Icon', html: `<button class="btn icon" data-force>${icon('chevron-left')}</button>` },
    { label: 'Text', html: '<button class="btn" data-force>Today</button>' },
    { label: 'Text + shortcut', html: `<button class="btn a-new-btn" data-force>${icon('plus')}New<span class="kbd">⌥⌘N</span></button>` },
    { label: 'Record', html: `<button class="btn tb-record" data-force>${recordInner(false)}</button>` }
  ];
  const runTimers = (canvas) => canvas.querySelectorAll('[data-timer]').forEach((el) => Kit.timer(el, Number(el.dataset.timer)));

  const CADENCES = ['None', 'Weekly', 'Every 2 weeks', 'Monthly'];
  const seg = (values, selected, attrs = '') => `<div class="seg"${attrs}>${values.map((v) => `<button data-value="${e(v)}" aria-selected="${v === selected}">${e(v)}</button>`).join('')}</div>`;
  const cycleSeg = (canvas) => {
    const root = canvas.querySelector('.seg');
    const out = canvas.querySelector('[data-out]');
    const api = root.segApi || (root.segApi = Kit.segmented(root, (value) => { out.textContent = value; }));
    return api;
  };
  const replaySeg = (canvas, first) => {
    const api = cycleSeg(canvas);
    if (first) return;
    CADENCES.forEach((v, i) => setTimeout(() => api.set(v), 520 * i));
    setTimeout(() => api.set('Weekly'), 520 * CADENCES.length);
  };

  const fieldAttrs = (c) => `${c.force ? ' data-force' : ''}${c.disabled ? ' disabled' : ''}`;
  const FIELD_ROWS = [
    { label: 'Default · 28', tag: (c) => `<input class="field" style="width:100%" placeholder="Weekly 1:1 with Priya, Thu 11am"${c.filled ? ' value="Weekly 1:1 with Priya, Thu 11am"' : ''}${fieldAttrs(c)}>` },
    { label: 'Large · 36', tag: (c) => `<input class="field lg" style="width:100%" placeholder="Describe it — e.g. Weekly 1:1 with Priya, Thu 11am"${c.filled ? ' value="Weekly 1:1 with Priya, Thu 11am"' : ''}${fieldAttrs(c)}>` },
    { label: 'Textarea', tag: (c) => `<textarea class="field" rows="3" style="width:100%" placeholder="Paste or type here…"${fieldAttrs(c)}>${c.filled ? 'Dana says the SSO metadata is almost ready.' : ''}</textarea>` }
  ];
  const FIELD_COLS = [
    { label: 'Placeholder' },
    { label: 'Focus', force: 'focus' },
    { label: 'Filled', filled: true },
    { label: 'Disabled', filled: true, disabled: true }
  ];
  const search = (attrs = '', placeholder = 'Search series, people, decisions') => `<label class="search" style="width:100%">${icon('search')}<input class="field" placeholder="${placeholder}" spellcheck="false"${attrs}></label>`;

  const popup = (label, attrs = '') => `<button class="btn popup"${attrs}>${e(label)}${icon('chevron-updown')}</button>`;
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Weekdays'];
  const TIMES = ['08:30', '09:00', '09:30', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
  const dayItem = (d) => (d === 'Weekdays' ? 'Every weekday' : T.doc.dayLabel(d));
  const menuItem = (item) => (item === '-' ? '<div class="menu-sep"></div>'
    : `<div class="menu-item${item.active ? ' active' : ''}" role="menuitem"><span class="truncate">${e(item.label)}</span></div>`);
  const staticMenu = (labels, minWidth, active) => `<div class="cat-static"><div class="menu" role="menu" style="min-width:${minWidth}px">${labels.map((label) => menuItem({ label, active: label === active })).join('')}</div></div>`;
  const wirePopups = (canvas) => canvas.querySelectorAll('[data-pick]').forEach((btn) => btn.addEventListener('click', () => {
    const list = btn.dataset.pick === 'day' ? DAYS : TIMES;
    Kit.menu(btn, list.map((v) => ({ label: btn.dataset.pick === 'day' ? dayItem(v) : v, onSelect: () => { btn.innerHTML = `${e(btn.dataset.pick === 'day' ? T.doc.dayLabel(v) : v)}${icon('chevron-updown')}`; } })), { minWidth: btn.dataset.pick === 'day' ? 170 : 120 });
  }));

  const sw = (on, attrs = '') => `<button class="switch" aria-checked="${on}"${attrs}></button>`;
  const obRow = (lead, title, sub, on, ignored = false) => `<div class="ob-row${ignored ? ' ignored' : ''}">${lead}<div class="ob-row-main"><b class="truncate">${e(title)}</b><span class="truncate">${e(sub)}</span></div>${sw(on && !ignored, `${ignored ? ' disabled' : ''} aria-label="Remember ${e(title)}"`)}</div>`;
  const grayRepeat = () => `<span class="series-icon" style="--c:var(--series-gray)">${icon('repeat')}</span>`;
  const flipAll = (selector) => (canvas, first) => {
    if (first) return;
    canvas.querySelectorAll(selector).forEach((el, i) => setTimeout(() => el.click(), i * 90));
  };

  const check = (on, attrs = '', square = false) => `<button class="check${square ? ' square' : ''}" aria-checked="${on}"${attrs}>${Kit.checkSvg}</button>`;
  const CHECK_COLS = [
    { label: 'Unchecked', on: false }, { label: 'Checked', on: true }, { label: 'Pressed', on: false, force: 'active' },
    { label: 'Focus', on: true, force: 'focus' }, { label: 'Disabled', on: true, disabled: true }
  ];
  const calRow = (c) => `<div class="sb-item a-cal${c.watched ? '' : ' is-off'}" data-cal="${c.id}"><button class="check square a-cal-check" data-manual aria-checked="${c.watched}" style="--cal:${c.color}" tabindex="-1">${Kit.checkSvg}</button><span class="a-cal-text"><span class="truncate">${e(c.name)} · ${e(c.account)}</span><small class="a-cal-cap">Not watched</small></span></div>`;
  const wireCalRows = (canvas) => canvas.querySelectorAll('.a-cal').forEach((row) => row.addEventListener('click', () => {
    const box = row.querySelector('.check');
    const on = box.getAttribute('aria-checked') !== 'true';
    box.setAttribute('aria-checked', String(on));
    row.classList.toggle('is-off', !on);
  }));
  const agendaItems = () => Catalog.withScenario('before', () => [
    T.doc.agendaItem({ t: 'Metrics pulse', d: '5m' }, 0),
    T.doc.agendaItem({ t: 'Rate-limit plan — decide', d: '15m', added: true }, 1),
    T.doc.agendaItem({ t: 'Priorities & scope', d: '15m', done: true }, 2)
  ].join(''));

  const KIT_CHIPS = [
    ['Neutral', '', 'Brief tonight'], ['Accent', 'accent', 'Brief ready'], ['Mint', 'mint', 'Worth asking'], ['Coral', 'coral', 'Starting now'],
    ['Amber', 'amber', '3 to review'], ['Outline', 'outline', 'Personal'], ['Dashed', 'dashed', 'One-off']
  ];
  const kitChip = ([label, cls, text]) => `<div class="pm-cell"><span class="chip ${cls}">${e(text)}</span><small>${e(label)}${cls === 'mint' || cls === 'outline' ? ' · kit only' : ''}</small></div>`;
  const AGENDA_CHIPS = [
    ['ready', 't2', 'Brief ready'], ['ready', 'w3', 'Brief tonight'], ['tracking', 't2', 'Tracking'], ['preparing', 't5', 'Preparing brief'], ['review', 'm2', 'To review'],
    ['summarizing', 't2', 'Summarizing'], ['filed', 't2', 'Filed'], ['recurring', 't1', 'Recurring, not tracked'], ['oneoff', 't6', 'One-off'],
    ['proposal', 'w2', 'Proposal'], ['unfiled', 'm3', 'Unfiled'], ['once', 't6', 'Record once']
  ];
  const agendaChip = ([kind, id, label]) => Catalog.withScenario('before', () => {
    if (kind === 'once') T.state = { ...T.state, recordOnce: { [id]: true } };
    const ev = T.eventById(id);
    const markup = kind === 'tracking' ? `<span class="chip accent">${icon('check')}Tracking</span>` : T.agenda.chipMarkup(ev, kind === 'once' ? 'oneoff' : kind);
    return `<div class="pm-cell">${markup}<small>${e(label)}</small></div>`;
  });
  const DOC_CHIPS = [
    [`<span class="chip coral countdown"><span class="mini-dot"></span>Starting now</span>`, 'Next · starting (pulsing dot)'],
    ['<span class="chip accent num countdown">in 19 min</span>', 'Next · countdown'],
    ['<span class="chip amber num">5 to review</span>', 'Past meeting · pending'],
    [`<span class="chip">${icon('check')}Reviewed</span>`, 'Past meeting · reviewed'],
    [`<span class="chip accent drafted">${icon('pencil')}Drafted from the calendar invite — make it yours</span>`, 'Purpose · drafted']
  ];

  const STATUSES = ['current', 'completed', 'open', 'unresolved', 'disputed', 'superseded', 'cancelled'];
  const KTYPES = ['decision', 'commitment', 'question', 'fact'];
  const SOURCES = [
    { label: 'Speech', html: (a) => `<button class="source" data-src="Sep 22 · 18:42"${a}>${icon('quote')}Sep 22 · 18:42</button>` },
    { label: 'Document', html: (a) => `<button class="source" data-src="North-star metrics.docx · p.2"${a}>${icon('quote')}North-star metrics.docx · p.2</button>` },
    { label: 'Timestamp', html: (a) => `<button class="source" data-cand="c1"${a}>${icon('quote')}06:12</button>` }
  ];
  const SOURCE_COLS = [{ label: 'Rest' }, { label: 'Hover', force: 'hover' }, { label: 'Pressed (doc surface)', force: 'active' }, { label: 'Focus', force: 'focus' }];

  Catalog.section({
    id: 'primitives',
    eyebrow: 'Layer 2',
    title: 'Primitives',
    intro: 'Single-purpose controls from the shared kit. Every screen in the app is composed from these.',
    css: `
.pm-replay { position: absolute; top: 10px; right: 10px; z-index: 5; }
.pm-stack { display: flex; flex-direction: column; align-items: flex-start; gap: 12px; }
.pm-row { display: flex; flex-wrap: wrap; align-items: center; gap: 14px 18px; }
.pm-cell { display: inline-flex; flex-direction: column; align-items: center; gap: 6px; }
.pm-cell > small, .pm-label { font-size: 11px; color: var(--label-3); white-space: nowrap; }
.pm-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 16px 12px; width: 100%; justify-items: center; }
.pm-out { font-size: 12px; color: var(--label-2); }
.pm-out b { color: var(--label); font-weight: 600; }
.pm-panel { width: 100%; max-width: 380px; padding: 6px 10px; border-radius: 14px; background: var(--glass-strong); box-shadow: var(--shadow-float); }
.pm-sb { width: var(--sidebar-w); padding: 6px 10px; }
.pm-doc { width: 100%; max-width: 420px; }
.pm-kpair { display: grid; grid-template-columns: 130px 36px 120px; align-items: center; gap: 10px 14px; }
.pm-kpair small { font: 11px var(--font-mono); color: var(--label-3); }
.pm-center { width: 100%; display: flex; justify-content: center; }
`,
    components: [
      {
        id: 'button',
        name: 'Button',
        summary: 'Capsule push button. Scales to 0.97 while pressed; hover only on fine pointers.',
        mapsTo: 'shadcn/ui Button with cva variants',
        usedIn: ['Toolbar', 'Side peek', 'Living doc', 'Sheets', 'Alerts', 'Island'],
        source: 'kit/mac-kit.css .btn',
        props: [
          ['variant', 'default | primary | record | tinted | plain', 'default'],
          ['size', 'sm | md | lg', 'md'],
          ['icon', 'boolean (square icon-only button)', 'false'],
          ['kbd', 'string shortcut shown after the label', '—'],
          ['block', 'boolean (full width)', 'false'],
          ['disabled', 'boolean', 'false']
        ],
        states: STATES.map((s) => s.label.toLowerCase()),
        tokens: ['--accent', '--accent-strong', '--coral', '--fill-2', '--fill-3', '--on-accent'],
        motion: motion({ trigger: 'press (:active); hover on fine pointers', props: 'transform scale(1 → 0.97); background-color, box-shadow, color', duration: 'press 140ms down and up; colors 150ms', easing: 'transform --ease-out; colors ease', runtime: 'CSS transition (interruptible — releasing mid-press reverses from the current scale)', reduced: 'scale snaps (transform not transitioned); color changes still fade', framer: 'whileTap={{ scale: 0.97 }} transition={{ duration: 0.14, ease: [0.23, 1, 0.32, 1] }}; colors stay in CSS' }),
        a11y: 'Native <button>; focus-visible ring 3px accent at 45%; icon-only buttons need aria-label',
        stories: [
          Catalog.table({
            label: 'Variants × states',
            note: 'Hover, pressed and focus are forced with state classes',
            rows: VARIANTS,
            cols: STATES,
            render: (v, s) => `<button class="btn ${v.cls}"${s.disabled ? ' disabled' : ''}>${v.text}</button>`
          }),
          { label: 'Sizes', note: 'sm · md · lg', html: '<div class="row-flex"><button class="btn sm">Small</button><button class="btn">Medium</button><button class="btn lg">Large</button></div>' },
          { label: 'Icon-only', note: 'sm · md', html: `<div class="row-flex"><button class="btn sm icon" aria-label="More">${icon('ellipsis')}</button><button class="btn icon" aria-label="Search">${icon('search')}</button></div>` }
        ]
      },
      {
        id: 'glass-group',
        name: 'GlassGroup',
        summary: 'Toolbar capsule that groups related buttons on glass. Buttons inside lose their fill and only show a fill on hover; a 0.5px separator splits sub-groups.',
        mapsTo: 'A <div role="group"> capsule wrapping shadcn Button variant="ghost" (size "icon" | "sm"); Radix Toolbar if roving focus is wanted',
        usedIn: ['Agenda toolbar', 'Doc toolbar'],
        source: '002 app-shell.js agendaToolbar / docToolbar · kit .glass-group (.sep)',
        props: [['children', 'Button[] and separators', '—'], ['aria-label', 'string (group name)', '—']],
        states: ['rest', 'item hover', 'item pressed', 'item disabled', 'item on (drawer toggle)'],
        tokens: ['--glass-strong', '--glass-edge', '--glass-rim', '--fill-2', '--hairline'],
        motion: motion({ trigger: 'item hover / press', props: 'item background-color (transparent → --fill-2), item transform scale(0.97)', duration: 'color 150ms; press 140ms', easing: 'ease; --ease-out', runtime: 'CSS transition (interruptible)', reduced: 'press scale snaps; hover fill still fades', framer: 'whileTap={{ scale: 0.97 }} on each item; capsule static' }),
        a11y: 'role="group" with aria-label ("Day", "Document actions"). Icon-only items in 002 carry only data-tip — add aria-label. Tab order follows items; separators are aria-hidden.',
        stories: [
          { label: 'Day stepper', note: 'Agenda toolbar · ‹ Today ›', bg: 'wallpaper', html: stepper() },
          { label: 'Day stepper · disabled', note: 'No calendar yet, or first/last day', bg: 'wallpaper', html: stepper(true) },
          { label: 'New + search', note: 'Text with shortcut, separator, icon', bg: 'wallpaper', html: newGroup() },
          { label: 'Doc actions', note: 'History, Export, separator, Record, More', bg: 'wallpaper', span: 2, html: docGroup() },
          { label: 'Doc actions · recording', note: 'Record becomes rec dot + live timer + Stop', bg: 'wallpaper', span: 2, html: docGroup(true), mount: runTimers },
          { label: 'Drawer toggle', note: 'Single-item group (accent when the drawer is open — see DocToolbar)', bg: 'wallpaper', html: inspectorGroup() },
          Catalog.table({ label: 'Item states', note: 'Forced on the item inside the capsule', bg: 'wallpaper', rows: GROUP_ITEMS, cols: STATES, render: (r, c) => `<div class="glass-group">${c.disabled ? r.html.replace('<button', '<button disabled') : r.html}</div>` })
        ]
      },
      {
        id: 'segmented-control',
        name: 'SegmentedControl',
        summary: 'Capsule segmented control with a sliding white thumb placed by Kit.segmented. In 002 it picks a draft series cadence.',
        mapsTo: 'Radix ToggleGroup type="single" (shadcn ToggleGroup) + a motion.div thumb with layoutId',
        usedIn: ['Living doc · draft header (Repeats)', 'Catalog theme switch'],
        source: '002 doc-render.js repeatsMarkup #cadenceSeg · kit .seg .seg-thumb · Kit.segmented',
        props: [['options', '{ value, label, badge? }[] (2–4)', '—'], ['value', 'string', 'first'], ['onValueChange', '(value) => void', '—'], ['size', 'one size, 28px (the kit has no small variant)', '—']],
        states: ['rest', 'selected (each position)', 'with badge'],
        tokens: ['--fill-2', '--content-bg', '--label', '--label-2', '--accent'],
        motion: motion({ trigger: 'pointer selection (Kit.segmented select)', props: 'thumb transform translateX(offsetLeft) + width; label color', duration: 'thumb 240ms; label color 160ms', easing: 'thumb --ease-out; color ease', runtime: 'CSS transition on inline style (interruptible); set(value, { animate: false }) places the thumb without transition — use for first paint and keyboard', reduced: 'thumb jumps (transform/width not transitioned); color still fades', framer: '<motion.span layoutId="seg-thumb" transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }} />' }),
        a11y: '002 marks buttons with aria-selected only. Use role="radiogroup" + role="radio" (or Radix ToggleGroup) with arrow-key navigation; keyboard changes must not animate the thumb.',
        stories: [
          { label: 'Cadence · every position', note: 'None · Weekly · Every 2 weeks · Monthly', span: 2, html: `<div class="pm-stack">${CADENCES.map((c) => seg(CADENCES, c)).join('')}</div>`, mount: mountSegs },
          { label: 'Two and three segments', span: 2, html: `<div class="pm-stack">${seg(['Light', 'Dark'], 'Light')}${seg(['Weekly', 'Every 2 weeks', 'Monthly'], 'Every 2 weeks')}</div>`, mount: mountSegs },
          { label: 'With badge', note: 'Kit variant (unused in 002)', html: '<div class="seg"><button data-value="all" aria-selected="false">All</button><button data-value="review" aria-selected="true">To review<span class="badge">5</span></button></div>', mount: mountSegs },
          { label: 'Live thumb', note: 'Click a segment · Replay walks every position', span: 2, height: 150, html: `${replayButton()}<div class="pm-stack" style="align-items:center">${seg(CADENCES, 'Weekly')}<span class="pm-out">Repeats: <b data-out>Weekly</b></span></div>`, mount: onReplay(replaySeg) }
        ]
      },
      {
        id: 'text-field',
        name: 'TextField',
        summary: 'Single-line field and textarea on the content background with a hairline inset; focus draws a soft accent ring.',
        mapsTo: 'shadcn Input / Textarea (h-7; lg h-9 text-[15px] rounded-[10px])',
        usedIn: ['New series popover (lg)', 'Onboarding manual entry (lg)', 'Sheets (textarea)'],
        source: 'kit .field (.lg, textarea.field) · 002 app-flows.js .a-new-field · app-onboard.js #obInput',
        props: [['size', 'md 28 | lg 36', 'md'], ['multiline', 'boolean (textarea, auto height, resize none)', 'false'], ['placeholder', 'string', '—'], ['disabled', 'boolean', 'false']],
        states: ['placeholder', 'focus', 'filled', 'disabled'],
        tokens: ['--content-bg', '--hairline', '--accent', '--label', '--label-3'],
        motion: motion({ trigger: 'focus / blur', props: 'box-shadow (inset 0.5px hairline → inset 0.5px accent + 0 0 0 3.5px accent 32%)', duration: '150ms in and out', easing: 'ease', runtime: 'CSS transition (interruptible)', reduced: 'unchanged (box-shadow is allowed)', framer: 'none — keep in CSS (focus-visible:ring)' }),
        a11y: 'Always pair with a visible label or aria-label (002 new-series field relies on the popover title). The kit has no disabled style — disabled fields look like rest; add opacity 0.45 like buttons.',
        stories: [Catalog.table({ label: 'Sizes × states', note: 'Focus forced with a state class', rows: FIELD_ROWS, cols: FIELD_COLS, render: (r, c) => r.tag(c) })]
      },
      {
        id: 'search-field',
        name: 'SearchField',
        summary: 'Pill search field with a leading glyph on a quiet fill; on focus the fill turns to content background with the accent ring.',
        mapsTo: 'cmdk Command.Input inside the search popover (shadcn Command)',
        usedIn: ['Search popover (⌘F)', 'Catalog filter'],
        source: '002 app-flows.js T.openSearch .a-search .search · kit .search',
        props: [['value', 'string', '""'], ['placeholder', 'string', '"Search series, people, decisions"'], ['height', '28 | 32 (search popover)', '28']],
        states: ['rest', 'focus', 'filled'],
        tokens: ['--fill', '--content-bg', '--accent', '--label-3'],
        motion: motion({ trigger: 'focus / blur', props: 'box-shadow ring 0 → 3.5px accent 32%; background fill → content-bg swaps instantly (only box-shadow is transitioned on .field)', duration: 'ring 150ms in and out', easing: 'ease', runtime: 'CSS transition (interruptible)', reduced: 'unchanged', framer: 'none — CSS' }),
        a11y: 'role="combobox" with aria-controls on the results list (cmdk provides it); Enter opens the first hit; Esc closes the popover.',
        stories: [
          Catalog.table({ label: 'States', rows: [{ label: '28px' }], cols: [{ label: 'Rest', attrs: '' }, { label: 'Focus', attrs: ' data-force', force: 'focus' }, { label: 'Filled', attrs: ' value="rate-limit"' }], render: (r, c) => search(c.attrs) }),
          { label: 'In the search popover · 32px', note: '.a-search raises the field to 32px', span: 2, html: `<div class="a-search" style="width:100%;max-width:400px">${search(' value="Acme"')}</div>` }
        ]
      },
      {
        id: 'popup-button',
        name: 'PopupButton',
        summary: 'Compact macOS pop-up button (up/down chevron) that opens a menu of choices. Placeholder text shows until a value is picked.',
        mapsTo: 'Radix Select (shadcn Select) styled as a pop-up button, or DropdownMenu + RadioGroup',
        usedIn: ['Living doc · draft header (day, time)'],
        source: '002 doc-render.js repeatsMarkup #pickDay #pickTime · doc-organize.js D.pickDay / D.pickTime · kit .btn.popup',
        props: [['value', 'string | null', 'null → placeholder'], ['placeholder', '"Day" | "Time"', '—'], ['options', 'string[]', '—'], ['disabled', 'boolean (cadence None)', 'false']],
        states: ['rest', 'hover (no change)', 'pressed', 'focus', 'disabled', 'open'],
        tokens: ['--content-bg', '--hairline', '--label-2'],
        motion: motion({ trigger: 'press; opening the menu', props: 'transform scale(0.97); menu appears instantly', duration: 'press 140ms; menu 0ms open, 120ms close', easing: '--ease-out', runtime: 'CSS transition', reduced: 'press scale snaps', framer: 'whileTap={{ scale: 0.97 }}; no open animation (macOS menus are instant)' }),
        a11y: 'Radix Select gives aria-haspopup="listbox", arrow keys, typeahead. Disabled when Repeats is None.',
        stories: [
          Catalog.table({ label: 'States', rows: [{ label: 'Day', v: 'Tuesday' }, { label: 'Time', v: '10:00' }, { label: 'Placeholder', v: 'Day' }], cols: STATES, render: (r, c) => popup(r.v, `${c.force ? ' data-force' : ''}${c.disabled ? ' disabled' : ''}`) }),
          { label: 'Open', note: 'Day menu (min-width 170) with the pointer on the current row', height: 250, bg: 'window', html: `<div class="pm-stack">${popup('Tuesday')}${staticMenu(DAYS.map(dayItem), 170, 'Tuesday')}</div>` },
          { label: 'Live', note: 'Click to pick a day or time — real Kit.menu', span: 2, flush: true, html: `<div class="desktop cat-desk panel-host" style="height:300px;background:var(--content-bg)"><div class="repeats" style="padding:24px"><span class="repeats-label">Repeats</span>${popup('Tuesday', ' data-pick="day"')}${popup('10:00', ' data-pick="time"')}</div></div>`, mount: wirePopups }
        ]
      },
      {
        id: 'switch',
        name: 'Switch',
        summary: 'On/off switch. Knob lands with the bouncy spring; track color fades.',
        mapsTo: 'Radix Switch (shadcn Switch) — knob via motion layout or CSS transition with the spring',
        usedIn: ['Onboarding · choose what to remember', 'Reference doc popover (Include in every brief)'],
        source: 'kit .switch[aria-checked] + global click toggle · 002 app.css .switch:disabled · app-onboard.js detectedRow · doc-popovers.js refPopover',
        props: [['checked', 'boolean', 'false'], ['onCheckedChange', '(checked) => void (kit dispatches a "toggle" CustomEvent)', '—'], ['disabled', 'boolean', 'false'], ['aria-label', 'string', '—']],
        states: ['off', 'on', 'focus', 'disabled off', 'disabled on'],
        tokens: ['--fill-3', '--accent', '--spring-bounce', '--spring-bounce-dur'],
        motion: motion({ trigger: 'click (kit toggles aria-checked)', props: 'knob ::after transform translateX(0 → 14px); track background-color', duration: 'knob 600ms (--spring-bounce-dur) both ways; track 200ms', easing: 'knob --spring-bounce (3.8% overshoot); track ease', runtime: 'CSS transition (interruptible — re-toggling mid-flight reverses from the current point)', reduced: 'knob jumps; track color still fades', framer: 'knob: <motion.span layout transition={{ type: "spring", duration: 0.6, bounce: 0.28 }} />' }),
        a11y: 'Needs role="switch" + aria-checked (Radix provides). The kit removes the focus outline on .switch — no visible focus in 002; add a ring. Disabled at 45% opacity.',
        stories: [
          Catalog.table({ label: 'States', note: 'Focus is forced — note there is no visible ring', rows: [{ label: 'Off', on: false }, { label: 'On', on: true }], cols: [{ label: 'Rest' }, { label: 'Focus', force: 'focus' }, { label: 'Disabled', disabled: true }], render: (r, c) => sw(r.on, ` data-manual${c.force ? ' data-force' : ''}${c.disabled ? ' disabled' : ''}`) }),
          { label: 'Interactive', note: 'Click to toggle · Replay flips each switch', height: 130, html: `${replayButton()}<div class="row-flex" style="gap:18px">${sw(false)}${sw(true)}${sw(false)}</div>`, mount: onReplay(flipAll('.switch')) },
          { label: 'In context · onboarding', note: 'Remember a detected series; ignored rows are disabled', span: 2, bg: 'wallpaper', html: `<div class="pm-panel">${obRow(Kit.seriesIcon(DATA.series[0]), 'Product Sync', 'Every Tue · 10:00–10:45 · 36 found', true)}${obRow(grayRepeat(), 'Daily Standup', 'Every weekday · 09:00 · 142 found · Short daily check-in', false)}${obRow(grayRepeat(), 'Lunch', 'Every weekday · 12:00 · Personal calendar · ignored', false, true)}</div>` },
          { label: 'In context · reference popover', note: 'Include a document in every brief', bg: 'wallpaper', span: 2, html: `<div class="cat-static"><div class="popover" style="width:300px"><div class="pop"><div class="pop-switch" style="margin-top:0"><span>Include in every brief</span>${sw(true, ' aria-label="Include in every brief"')}</div></div></div></div>` }
        ]
      },
      {
        id: 'checkbox',
        name: 'Checkbox',
        summary: 'Round (agenda items) or square (calendars) check. The tick draws in with a stroke-dash animation after the fill lands.',
        mapsTo: 'Radix Checkbox (shadcn Checkbox) with a round variant; tick as motion.path pathLength',
        usedIn: ['Next meeting agenda (done)', 'Sidebar calendars (watched)'],
        source: 'kit .check (.square) + Kit.checkSvg + global click toggle · 002 doc-render.js D.agendaItem · app-shell.js calendarRow (.a-cal-check)',
        props: [['checked', 'boolean', 'false'], ['shape', 'round | square', 'round'], ['color', 'CSS color (calendar color via --cal)', '--accent'], ['size', '17 | 14 (calendar)', '17'], ['disabled', 'boolean', 'false']],
        states: ['unchecked', 'checked', 'pressed', 'focus', 'disabled'],
        tokens: ['--accent', '--label-4', '--cal (calendar color)'],
        motion: motion({ trigger: 'click (kit toggles aria-checked)', props: 'background-color + ring box-shadow; tick stroke-dashoffset 14 → 0; press transform scale(0.88)', duration: 'fill 160ms; tick 220ms after a 40ms delay; press 140ms', easing: 'fill ease; tick and press --ease-out', runtime: 'CSS transition (interruptible; unchecking undraws the tick)', reduced: 'fill still fades (background-color is allowed); tick appears at once (stroke-dashoffset is not transitioned); press scale snaps', framer: 'motion.path initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.22, delay: 0.04, ease: [0.23, 1, 0.32, 1] }}' }),
        a11y: 'Round checks in agenda carry aria-label="Done". The sidebar calendar check is decorative (tabindex=-1, pointer-events none) — the whole row is the control and toggles watching. The kit has no disabled style.',
        stories: [
          Catalog.table({ label: 'Shapes × states', note: 'Pressed and focus forced', rows: [{ label: 'Round', square: false }, { label: 'Square', square: true }], cols: CHECK_COLS, render: (r, c) => check(c.on, ` data-manual${c.force ? ' data-force' : ''}${c.disabled ? ' disabled' : ''}`, r.square) }),
          { label: 'Interactive', note: 'Click to toggle · Replay draws each tick', height: 130, html: `${replayButton()}<div class="row-flex" style="gap:18px">${check(false)}${check(true)}${check(false, '', true)}${check(true, '', true)}</div>`, mount: onReplay(flipAll('.check')) },
          { label: 'In context · agenda item', note: 'T.doc.agendaItem — rest, added by Telu, done', span: 2, html: `<div class="pm-doc">${agendaItems()}</div>` },
          { label: 'In context · calendar rows', note: 'Square, calendar-colored, 14px — click a row', bg: 'sidebar', html: `<div class="t-app"><div class="pm-sb">${DATA.calendars.map(calRow).join('')}</div></div>`, mount: wireCalRows }
        ]
      },
      {
        id: 'chip',
        name: 'Chip',
        summary: 'Small capsule label. Seven kit tones; in 002 each tone has one meaning (accent = ready/tracked, amber = needs review, coral = starting, dashed = not tracked).',
        mapsTo: 'shadcn Badge with cva variants (neutral | accent | mint | coral | amber | outline | dashed)',
        usedIn: ['Agenda cards', 'Living doc', 'Past meetings', 'Island'],
        source: 'kit .chip · 002 app-agenda.js chipMarkup (T.agenda.chipMarkup) · doc-render.js countdown · doc-past.js D.countsChips',
        props: [['tone', 'neutral | accent | mint | coral | amber | outline | dashed', 'neutral'], ['icon', 'IconName', '—'], ['dot', 'none | mini (static) | mini-live (pulsing)', 'none'], ['shimmer', 'boolean (preparing)', 'false'], ['numeric', 'boolean', 'false']],
        states: ['static', 'shimmer (preparing)', 'live dot'],
        tokens: ['--fill-2', '--accent-soft', '--accent-strong', '--mint-soft', '--mint-ink', '--coral-soft', '--coral-ink', '--amber-soft', '--amber', '--separator', '--label-4'],
        motion: motion({ trigger: 'none on the chip; decorations loop', props: 'shimmer background-position; mini-dot opacity 1 → 0.3', duration: 'shimmer 1.3s loop; dot 1.4s loop', easing: 'shimmer linear; dot ease-in-out', runtime: 'CSS keyframes (kit-shimmer, kit-rec) — chip swaps crossfade via T.fx.crossfade (110ms out, 190ms in, 2px blur)', reduced: 'shimmer stops; the mini dot keeps pulsing at 1.4s (the kit rule only slows .rec-dot)', framer: 'chip swap: AnimatePresence mode="popLayout" with opacity + filter blur(2px)' }),
        a11y: 'Chips are text, not controls (002 uses <span>); never convey state by tone alone — the label always says it (“3 to review”).',
        stories: [
          { label: 'Tones', note: 'Mint and outline exist in the kit but are unused in 002', span: 'full', html: `<div class="pm-row">${KIT_CHIPS.map(kitChip).join('')}</div>` },
          { label: 'In the agenda', note: 'T.agenda.chipMarkup for every event kind', span: 'full', html: `<div class="pm-grid">${AGENDA_CHIPS.map(agendaChip).join('')}</div>` },
          { label: 'In the living doc', note: 'Countdown (coral with pulsing dot, accent), review counts, drafted', span: 'full', html: `<div class="pm-row">${DOC_CHIPS.map(([m, l]) => `<div class="pm-cell">${m}<small>${e(l)}</small></div>`).join('')}</div>` },
          { label: 'Long labels', note: 'Chips never truncate — the neighbouring title does (.a-card-top)', span: 2, html: `<div class="a-card-top" style="width:300px">${Catalog.withScenario('before', () => `<span class="a-title truncate">${e(T.eventById('w2').title)}</span><span class="a-chip-slot">${T.agenda.chipMarkup(T.eventById('w2'), 'proposal')}</span>`)}</div>` }
        ]
      },
      {
        id: 'status-badge',
        name: 'StatusBadge',
        summary: 'Dot + label for a knowledge item’s lifecycle. Superseded items also strike their text through.',
        mapsTo: 'Small <StatusBadge status> component (dot span + text)',
        usedIn: ['Memory', 'Past meetings (k-row)', 'Brief'],
        source: 'kit Kit.status(s) · .status[data-s] · .superseded-text · 002 doc-past.js kRow',
        props: [['status', 'current | completed | open | unresolved | disputed | superseded | cancelled', '—']],
        states: STATUSES,
        tokens: ['--series-green', '--accent', '--amber', '--label-4', '--label-2'],
        motion: 'None.',
        a11y: 'The label text carries the meaning; the dot is decorative.',
        stories: [
          { label: 'Every status', note: 'Kit.status — completed renders as “Done”', span: 'full', html: `<div class="pm-row">${STATUSES.map((s) => `<div class="pm-cell">${Kit.status(s)}<small>${s}</small></div>`).join('')}</div>` },
          { label: 'Superseded row', note: 'Past meeting item replaced by a later decision', span: 3, html: `<div class="k-list" style="width:100%"><div class="k-row">${Kit.ktype('decision')}<span class="k-text superseded-text">Pricing experiment runs until Oct 1</span><span class="k-side">${Kit.status('superseded')}${Kit.source('Sep 8 · 16:20')}</span></div><div class="k-row">${Kit.ktype('commitment')}<span class="k-text">Share the API rate-limit plan</span><span class="k-side">${Kit.avatar('Jon Park')}${Kit.status('open')}${Kit.source('Sep 22 · 18:42')}</span></div></div>` }
        ]
      },
      {
        id: 'knowledge-type',
        name: 'KnowledgeType',
        summary: 'Type marker for knowledge items: decision, commitment, open question, fact — icon + label, icon-only, or icon tile.',
        mapsTo: '<KnowledgeType type variant="label | icon | tile"> with lucide icons (badge-check, corner-down-right, circle-help, book-open)',
        usedIn: ['Memory', 'Past meetings', 'Review candidates', 'Brief (Since last time)', 'Search results', 'Island'],
        source: 'kit Kit.ktype(type) · .ktype[data-type] · 002 doc.css .k-ico · island.css .il-k · app-flows.js memoryHit',
        props: [['type', 'decision | commitment | question | fact', '—'], ['variant', 'label | icon | tile', 'label']],
        tokens: ['--accent', '--series-orange', '--amber', '--series-teal'],
        motion: 'None.',
        a11y: 'Icon-only variants need a label (Island adds data-tip; use aria-label).',
        stories: [{
          label: 'Types × variants', span: 'full',
          html: `<div class="pm-kpair"><small>label</small><small>icon</small><small>tile · 22 / 20</small>${KTYPES.map((t) => `${Kit.ktype(t)}<span class="ktype" data-type="${t}">${icon(t)}</span><span class="row-flex"><span class="k-ico" data-type="${t}">${icon(t)}</span><span class="ktype il-k" data-type="${t}">${icon(t)}</span></span>`).join('')}</div>`
        }]
      },
      {
        id: 'source-chip',
        name: 'SourceChip',
        summary: 'Evidence link on every claim: a quote glyph and where it came from (transcript time or document page). Opens the evidence popover.',
        mapsTo: 'shadcn Button variant="ghost" size="xs" as a Radix Popover.Trigger (EvidencePopover)',
        usedIn: ['Memory', 'Brief', 'Worth asking', 'Past meetings', 'Review candidates', 'Island'],
        source: 'kit Kit.source(label) .source · 002 doc.css .doc-surface .source:active · doc-past.js candSource',
        props: [['label', '"Sep 22 · 18:42" | "Doc.docx · p.2" | "06:12"', '—'], ['kind', 'speech | document (derived from the label)', 'speech'], ['onOpen', '() => void', '—']],
        states: ['rest', 'hover', 'pressed', 'focus'],
        tokens: ['--fill', '--accent-soft', '--accent-strong', '--label-2'],
        motion: motion({ trigger: 'hover; press inside the doc/peek (.doc-surface) or Island', props: 'background-color + color (fill → accent-soft); transform scale(0.96) (0.95 in the Island)', duration: 'color 150ms; press 140ms', easing: 'ease; --ease-out', runtime: 'CSS transition', reduced: 'press snaps; colors fade', framer: 'whileTap={{ scale: 0.96 }}' }),
        a11y: 'Native <button>; label reads as “Source: Sep 22, 18:42”. Opens a dialog popover; Esc returns focus.',
        stories: [Catalog.table({ label: 'Kinds × states', note: 'Pressed uses the living-doc surface rule', rows: SOURCES, cols: SOURCE_COLS, render: (r, c) => `<div class="doc-surface pm-center">${r.html(c.force ? ' data-force' : '')}</div>` })]
      }
    ]
  });
})();
