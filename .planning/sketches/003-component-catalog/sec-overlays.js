(() => {
  const e = Catalog.esc;
  const motion = ({ trigger, props, duration, easing, runtime, reduced, framer }) => [
    `Trigger: ${trigger}`, `Animates: ${props}`, `Duration: ${duration}`, `Easing: ${easing}`, `Runtime: ${runtime}`, `Reduced motion: ${reduced}`, `framer-motion: ${framer}`
  ].join(' · ');
  const replayButton = (label = 'Replay') => `<button class="btn sm ov-replay" data-replay>${icon('play')}${label}</button>`;
  const stage = (height, inner = '', cls = '') => `<div class="desktop cat-desk panel-host ${cls}" style="height:${height}px">${inner}</div>`;
  const stat = (inner) => `<div class="cat-static">${inner}</div>`;
  const stageOf = (canvas) => canvas.querySelector('.cat-desk');
  const on = (canvas, selector, fn) => canvas.querySelectorAll(selector).forEach((el) => el.addEventListener('click', (ev) => fn(el, ev)));
  const note = (canvas, text, iconName = 'check') => Kit.toast(e(text), { icon: iconName, container: stageOf(canvas), duration: 2600 });

  const ps = DATA.series.find((s) => s.id === 'product-sync');
  const acme = DATA.series.find((s) => s.id === 'acme');
  const tracked = DATA.series;

  const menuRow = (item) => {
    if (item === '-') return '<div class="menu-sep"></div>';
    if (item.title) return `<div class="menu-title">${item.title}</div>`;
    const lead = item.icon ? icon(item.icon) : item.swatch ? `<span class="series-dot" style="--c:${item.swatch}"></span>` : '';
    return `<div class="menu-item ${item.danger ? 'danger' : ''} ${item.disabled ? 'disabled' : ''}${item.active ? ' active' : ''}" role="menuitem">${lead}<span class="truncate">${item.label}</span>${item.kbd ? `<span class="kbd">${item.kbd}</span>` : ''}</div>`;
  };
  const menuMarkup = (items, minWidth = 210) => stat(`<div class="menu" role="menu" style="min-width:${minWidth}px">${items.map(menuRow).join('')}</div>`);
  const activeAt = (items, label) => items.map((item) => (item.label === label ? { ...item, active: true } : item));

  const docMenu = (s) => [
    { title: e(s.name) }, { label: 'Rename', icon: 'pencil' }, { label: 'Edit purpose', icon: 'target', kbd: '⌘E' }, { label: 'Export as Markdown', icon: 'share', kbd: '⇧⌘E' }, '-',
    { label: 'Stop tracking…', icon: 'x-circle', danger: true }
  ];
  const meetingMenu = () => [
    { title: 'Tue 22 Sep · #36' }, { label: 'Move to another series…', icon: 'folder' }, { label: 'Split into new doc', icon: 'doc-plus' }, { label: 'Open transcript', icon: 'quote' }, '-',
    { label: 'Remove from this doc', icon: 'tray' }, { label: 'Delete meeting…', icon: 'trash', danger: true }
  ];
  const addToSeries = () => [{ title: 'Add to series' }, ...tracked.map((s) => ({ label: e(s.name), swatch: s.color })), '-', { label: 'New series…', icon: 'plus' }];
  const followMenu = () => [
    { title: 'Follow a different event' }, { label: e(ps.name), icon: 'check', kbd: 'Current', disabled: true },
    ...T.LINKABLE.map((ev) => ({ label: e(ev.title), icon: 'calendar', kbd: e(ev.label) }))
  ];
  const recentMenu = () => [{ title: 'Recent on this Mac' }, ...['Rate-limit plan v1.docx', 'Pricing experiment.xlsx', 'Offsite notes.md'].map((n) => ({ label: e(n), icon: 'doc' })), '-', { label: 'Choose File…', icon: 'folder', kbd: '⌘O' }];
  const ROW_KINDS = [
    { label: 'Text', item: { label: 'Tuesday' } }, { label: 'Icon + shortcut', item: { label: 'Edit purpose…', icon: 'pencil', kbd: '⌘E' } },
    { label: 'Swatch', item: { label: 'Acme · Implementation', swatch: 'var(--series-green)' } }, { label: 'Detail text', item: { label: 'Daily Standup', icon: 'calendar', kbd: 'Weekdays 09:00' } },
    { label: 'Disabled', item: { label: 'Add to series…', icon: 'folder', disabled: true } }, { label: 'Danger', item: { label: 'Stop tracking…', icon: 'x-circle', danger: true } }
  ];

  const cardMenuItems = (scenario, id) => Catalog.withScenario(scenario, () => {
    const ev = T.eventById(id);
    const kind = T.kindOf(ev);
    const s = T.trackedSeriesOf(ev);
    const live = kind === 'recording';
    const recordable = live || (T.dayOf(id) === T.TODAY && !T.isPast(ev, T.TODAY) && !T.state.recording && ['ready', 'preparing', 'tracking', 'recurring', 'oneoff'].includes(kind));
    return [
      { label: 'Open in side peek', icon: 'sidebar', kbd: '↩' }, { label: 'Open as page', icon: 'arrow-up-right', disabled: !s },
      { label: live ? 'Stop recording' : 'Record', icon: live ? 'stop' : 'record', kbd: '⌘R', disabled: !recordable },
      { label: 'Edit purpose…', icon: 'pencil', kbd: '⌘E', disabled: !s }, { label: 'Add to series…', icon: 'folder', disabled: !!s || ev.state === 'unfiled' }, '-',
      { label: 'Stop tracking…', icon: 'x-circle', danger: true, disabled: !s || ev.state === 'unfiled' }
    ];
  });
  const cardMarkup = (scenario, id) => Catalog.withScenario(scenario, () => T.agenda.cardMarkup(T.eventById(id), T.TODAY));
  const withToasts = (canvas, items) => items.map((item) => (typeof item === 'object' && item.label ? { ...item, onSelect: () => note(canvas, item.label) } : item));

  const pop = (inner, width, extra = '') => stat(`<div class="popover" role="dialog" style="width:${width}px"${extra}>${inner}</div>`);
  const RULE_POP = `<div class="pop"><div class="pop-row">${icon('calendar-check')}<div><b>Linked to Calendar</b><div class="muted">Work · “Product Sync”</div></div></div><div class="pop-sub num">Every Tue · 10:00–10:45</div><div class="pop-actions"><button class="btn sm">Change…</button><button class="btn sm plain">Unlink</button></div></div>`;
  const MANUAL_POP = `<div class="pop"><div class="pop-row">${icon('folder')}<div><b>Grouped by you</b><div class="muted">Not tied to a calendar event. Meetings you record or file here stay together.</div></div></div></div>`;
  const PEOPLE_POP = `<div class="pop"><div class="pop-title">${ps.people.length} people</div>${ps.people.map((n) => `<div class="pop-person">${Kit.avatar(n)}<span>${e(n)}</span></div>`).join('')}<div class="pop-foot">${icon('calendar', 'sm')}From the calendar invite</div></div>`;
  const histRow = (h, current) => `<div class="hist-row ${current ? 'current' : ''}"><span class="hist-v num">v${h.v}</span><div class="hist-main"><span>${e(h.note)}</span><span class="faint">${e(h.date)}</span></div>${current ? '<span class="chip accent">Current</span>' : ''}</div>`;
  const HISTORY_POP = `<div class="pop"><div class="pop-title">Purpose history</div>${ps.purpose.history.map((h, i) => histRow(h, i === 0)).join('')}<div class="pop-foot">${icon('lock', 'sm')}Every version stays on this Mac</div></div>`;
  const REF_POP = `<div class="pop"><div class="ref-pop-head">${Kit.fileBadge('Q4 Roadmap.pdf')}<div class="ref-pop-name"><b>Q4 Roadmap.pdf</b><span class="muted num">v2 · 2.4 MB · added Sep 14</span></div></div><div class="pop-switch"><span>Include in every brief</span><button class="switch" aria-checked="true" aria-label="Include in every brief"></button></div><div class="pop-actions"><button class="btn sm">Open</button><span class="spacer"></span><button class="btn sm plain danger-text">Remove</button></div></div>`;
  const EMPTY_POP = `<div class="pop"><div class="pop-title">History · Untitled</div><div class="pop-empty">Nothing yet — history starts with the first edit or meeting.</div><div class="pop-foot">${icon('lock', 'sm')}Kept on this Mac</div></div>`;
  const ORIGINS = [['start', 'bottom'], ['center', 'bottom'], ['end', 'bottom'], ['start', 'top'], ['center', 'top'], ['end', 'top']];
  const originPop = (align, side) => `<div class="pop"><div class="pop-title">align ${align} · side ${side}</div><div class="muted" style="font-size:12px">Scales from --origin <b class="num" data-origin></b></div></div>`;
  const openOrigin = (btn, force = false) => {
    const { align, side } = btn.dataset;
    const api = Kit.popover(btn, originPop(align, side), { align, side, width: 250, force });
    if (api) api.el.querySelector('[data-origin]').textContent = api.el.style.getPropertyValue('--origin');
  };

  const speechEv = (s, src) => Catalog.withScenario('before', () => T.evidenceFor(T.seriesById(s.id), src));
  const evidenceSpeech = (ev, open) => stat(`<div class="popover" role="dialog" style="width:320px"><div style="padding:8px 10px 10px;max-width:320px">
      <div class="t-eyebrow" style="margin-bottom:8px">EVIDENCE${ev.where ? ` · ${e(ev.where)}` : ''} · ${e(ev.t)}</div>
      <div style="font-size:14px;line-height:1.45;padding-left:10px;box-shadow:inset 2px 0 0 var(--accent-soft)">“${e(ev.quote)}”</div>
      <div class="row-flex" style="margin-top:10px">${Kit.avatar(ev.who)}<span class="muted">${e(ev.who)}</span><span class="spacer"></span>${open ? `<button class="btn sm plain" data-open>${e(open)}</button>` : ''}</div>
    </div></div>`);
  const docEvidenceInner = (ev) => `<div class="ev-pop"><div class="t-eyebrow">EVIDENCE · ${e(ev.doc)} · ${e(ev.loc || '')}</div><div class="ev-quote">“${e(ev.quote)}”</div><div class="row-flex ev-foot">${T.doc.badge(ev.doc)}<span class="muted truncate">${e(ev.doc)}</span><span class="spacer"></span><span class="a-local">${icon('lock', 'sm')}Read on this Mac</span><button class="btn sm plain" data-pop="open">Open</button></div></div>`;
  const EV_SOURCES = [
    { sid: 'product-sync', src: 'Sep 22 · 18:42', text: 'Share the API rate-limit plan', open: 'Open transcript' },
    { sid: 'product-sync', src: 'North-star metrics.docx · p.2', text: 'Activation is 41% against a 45% target' },
    { sid: 'acme', src: 'Sep 1 · 04:50', text: 'Go-live date is Nov 3' }
  ];
  const evRow = (x) => `<div class="carry-row ov-ev-row"><span class="carry-text">${e(x.text)}</span><span class="carry-side">${Kit.source(x.src).replace('<button class="source"', `<button class="source" data-sid="${x.sid}"`)}</span></div>`;
  const openEvidence = (canvas, btn) => {
    const s = DATA.series.find((x) => x.id === btn.dataset.sid);
    const ev = speechEv(s, btn.dataset.src);
    if (ev.kind === 'doc') {
      const api = Kit.popover(btn, docEvidenceInner(ev), { width: 330 });
      const open = api && api.el.querySelector('[data-pop="open"]');
      if (open) open.addEventListener('click', () => { api.close(); note(canvas, `Opening ${ev.doc} in Preview…`, 'doc'); });
      return;
    }
    const onOpen = ev.mid ? () => note(canvas, `Opens the ${ev.where} transcript at ${ev.t}`, 'quote') : null;
    Kit.evidence(btn, { t: e(ev.t), who: ev.who, quote: e(ev.quote) }, { where: e(ev.where), onOpen });
  };

  const alertMarkup = ({ title, message, buttons, danger }) => stat(`<div class="alert" role="alertdialog"><div class="app-icon"><img src="../kit/telu-icon.png" alt=""></div><h3>${title}</h3>${message ? `<p>${message}</p>` : ''}<div class="alert-actions">${buttons.map((b, i) => `<button class="btn ${b.primary ? 'primary' : ''}${b.primary && danger ? ' danger' : ''}" data-i="${i}">${b.label}</button>`).join('')}</div></div>`);
  const ALERTS = {
    calendar: { title: '“Telu” Would Like to Access Your Calendars', message: 'Telu reads events on this Mac to prepare briefs for your recurring meetings. Nothing is uploaded.', buttons: [{ label: 'Don’t Allow', value: 'deny' }, { label: 'Allow Full Access', value: 'allow', primary: true }] },
    delete: { title: 'Delete Tue 22 Sep?', message: 'The recording, transcript and summary are removed from this Mac. Items already in Memory stay.', buttons: [{ label: 'Cancel', value: 'cancel' }, { label: 'Delete', value: 'delete', primary: true }], danger: true },
    stop: { title: 'Stop tracking Product Sync?', message: 'Telu keeps its memory and past meetings, but won’t prepare briefs for new ones.', buttons: [{ label: 'Cancel', value: 'cancel' }, { label: 'Stop Tracking', value: 'stop', primary: true }] }
  };
  const runAlert = async (canvas, key) => {
    const def = ALERTS[key];
    const answer = Kit.alert({ ...def, container: stageOf(canvas) });
    if (def.danger) {
      const el = [...stageOf(canvas).querySelectorAll('.alert')].pop();
      if (el) el.querySelector('.btn.primary').classList.add('danger');
    }
    note(canvas, `Answer: ${await answer}`, 'info');
  };

  const toastMarkup = (text, opts = {}) => `<div class="toast" role="status">${opts.icon ? icon(opts.icon) : ''}<span>${text}</span>${opts.action ? `<button class="btn sm tinted">${opts.action}</button>` : ''}</div>`;
  const toastStack = (list) => stat(`<div class="toast-stack">${list.join('')}</div>`);
  const TOASTS = {
    plain: ['Telu · a local-first companion for recurring conversations', {}],
    icon: ['Exported Product Sync.md to Downloads', { icon: 'check-circle' }],
    undo: ['Added Coffee with Alex Kim to Product Sync', { icon: 'check-circle', action: 'Undo' }]
  };
  const fireToast = (canvas, key) => {
    const [text, opts] = TOASTS[key];
    Kit.toast(e(text), { ...opts, action: opts.action ? { label: opts.action, onClick: () => note(canvas, 'Undone', 'undo') } : undefined, container: stageOf(canvas) });
  };

  const notifMarkup = ({ title, body, time = 'now', actions = [] }) => `<div class="notif" role="status"><div class="app-icon"><img src="../kit/telu-icon.png" alt=""></div><div><b>${title}</b>${body ? `<p>${body}</p>` : ''}</div><time>${time}</time>${actions.length ? `<div class="notif-actions">${actions.map((a, i) => `<button class="btn sm ${a.primary ? 'primary' : ''}" data-i="${i}">${a.label}</button>`).join('')}</div>` : ''}</div>`;
  const notifStack = (list) => stat(`<div class="notif-stack" style="width:348px">${list.join('')}</div>`);
  const NOTIFS = {
    starting: { title: 'Product Sync is starting', body: 'Google Meet · 10:00–10:45 · your brief is ready', actions: [{ label: 'Record', primary: true }, { label: 'Not this time' }] },
    review: { title: 'Product Sync — 5 items to review', body: 'Today · 44 min · summary ready on this Mac', actions: [{ label: 'Review', primary: true }] }
  };
  const fireNotif = (canvas, key) => {
    const def = NOTIFS[key];
    Kit.notify({ ...def, container: stageOf(canvas), actions: def.actions.map((a) => ({ ...a, onClick: () => note(canvas, a.label) })), onClick: () => note(canvas, 'Opens the meeting', 'calendar-check') });
  };
  const statusItem = '<span class="mb-item telu-status"><img src="../kit/telu-menubar.png" class="template-img" alt=""><span class="ts-text"><span class="num">Product Sync · 19m</span></span></span>';
  const menubar = () => Kit.menubar({ app: 'Telu', menus: ['File', 'Edit', 'View', 'Meeting', 'Window', 'Help'], extras: statusItem });

  const sheetMarkup = '<div class="sheet-head"><h2>Paste text</h2><p>Attach notes, an email or an excerpt. It stays on this Mac.</p></div>'
    + '<div class="sheet-body"><textarea class="field" rows="6" style="width:100%" placeholder="Paste or type here…"></textarea></div>'
    + '<div class="sheet-foot"><button class="btn" data-close>Cancel</button><button class="btn primary" data-paste disabled>Attach</button></div>';
  const openSheet = (canvas) => {
    const api = Kit.sheet(sheetMarkup, { width: 520, container: stageOf(canvas) });
    const area = api.el.querySelector('textarea');
    const attach = api.el.querySelector('[data-paste]');
    area.addEventListener('input', () => { attach.disabled = !area.value.trim(); });
    attach.addEventListener('click', () => { api.close(); note(canvas, 'Attached Pasted note.txt to Product Sync · 10:00', 'paperclip'); });
  };

  const flyTarget = () => `<div class="t-app ov-fly-sb"><div class="sb-title">Series</div>${DATA.series.slice(0, 3).map((s) => `<div class="sb-item a-sb-row" data-series="${s.id}">${Kit.seriesIcon(s)}<span class="truncate a-sb-name">${e(s.name)}</span><span class="a-hint num">${e(T.util.startTime(s.meetings.find(T.util.isUpcoming) || s.meetings[0]))}</span></div>`).join('')}</div>`;
  const flyChip = (glyph, label) => `<div class="fly-chip">${glyph}<span>${e(label)}</span></div>`;
  const flyShell = (inner) => `<div class="ov-fly-shell">${inner}</div>`;
  const replayFly = (canvas, first) => {
    if (first) return;
    const from = canvas.querySelector('[data-fly-from]');
    const row = canvas.querySelector('.a-sb-row[data-series="acme"]');
    Kit.flyTo(from, row, { markup: flyChip(icon('link'), 'Acme · SSO deep-dive') });
  };

  const tipGroup = `<div class="glass-group"><button class="btn icon" data-tip="Previous day">${icon('chevron-left')}</button><button class="btn">Today</button><button class="btn icon" data-tip="Next day">${icon('chevron-right')}</button></div><div class="glass-group"><button class="btn icon" data-tip="History">${icon('history')}</button><button class="btn icon" data-tip="Export as Markdown">${icon('share')}</button><button class="btn icon" data-tip="More">${icon('ellipsis')}</button></div>`;

  const liveBar = (buttons) => `<div class="ov-bar">${buttons}</div>`;

  Catalog.section({
    id: 'overlays',
    eyebrow: 'Layer 3',
    title: 'Overlays',
    intro: 'Layers above the window: popovers and menus on glass, window-modal sheets and alerts, toasts, notification banners, tooltips and the evidence popover. Static tiles show the open state; each live tile runs the real Kit function inside its own stage.',
    css: `
.ov-replay { position: absolute; top: 10px; right: 10px; z-index: 5; }
.ov-row { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: center; gap: 22px; }
.ov-bar { position: absolute; left: 16px; bottom: 14px; z-index: 5; display: flex; flex-wrap: wrap; gap: 8px; }
.ov-mid { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 10px; flex-wrap: wrap; padding: 0 24px; }
.ov-origins { position: absolute; inset: 52px 24px 20px; display: grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: auto 1fr auto; }
.ov-origins > :nth-child(-n+3) { grid-row: 1; }
.ov-origins > :nth-child(n+4) { grid-row: 3; }
.ov-origins > :nth-child(3n+1) { justify-self: start; }
.ov-origins > :nth-child(3n+2) { justify-self: center; }
.ov-origins > :nth-child(3n) { justify-self: end; }
.ov-card { position: absolute; left: 50%; top: 40px; width: 460px; transform: translateX(-50%); }
.ov-ev { position: absolute; left: 50%; top: 22px; width: 520px; transform: translateX(-50%); padding: 6px 18px; border-radius: 14px; background: var(--content-bg); box-shadow: var(--shadow-card); }
.ov-ev-row .carry-text { font-size: 13px; }
.ov-fly-sb { position: absolute; right: 18px; top: 50px; bottom: 16px; width: 244px; padding: 4px 10px; border-radius: 14px; background: var(--sidebar); backdrop-filter: blur(40px) saturate(1.7); -webkit-backdrop-filter: blur(40px) saturate(1.7); box-shadow: var(--shadow-window); }
.ov-fly-src { position: absolute; left: 28px; top: 50%; transform: translateY(-50%); }
.ov-fly-shell { display: inline-flex; border-radius: 10px; background: var(--glass-strong); box-shadow: var(--shadow-float); }
.ov-tips { display: flex; gap: 14px; align-items: center; }
.ov-ghost .drag-ghost { position: relative; top: auto; left: auto; }
.ov-menubar { position: relative; height: 26px; }
`,
    components: [
      {
        id: 'popover',
        name: 'Popover',
        summary: 'Glass panel anchored to a trigger. It scales in from the trigger’s center (--origin), flips above when there is no room below and clamps inside its container. Content is built from a small set of .pop parts.',
        mapsTo: 'Radix Popover (shadcn Popover) — transform-origin from --radix-popover-content-transform-origin',
        usedIn: ['Doc header chips (rule, people)', 'Purpose history', 'Doc history', 'Reference documents', 'Evidence', 'New series', 'Search'],
        source: 'kit Kit.popover(trigger, markup, { align, side, width, className, container, force }) · .popover (.open .closing) · 002 doc-popovers.js · doc.css .pop*',
        props: [['align', 'start | center | end', 'start'], ['side', 'bottom | top (auto-flips)', 'bottom'], ['width', 'px', 'min 220'], ['container', 'element (clamps inside it)', 'nearest .window / .desktop / .panel-host'], ['onClose', '() => void', '—']],
        states: ['closed', 'opening', 'open', 'closing', 'flipped above'],
        tokens: ['--glass-strong', '--shadow-float', '--separator', '--label-3'],
        motion: motion({ trigger: 'click on the trigger (a second click on the same trigger closes)', props: 'opacity 0 → 1 and transform scale(0.96) → none from transform-origin var(--origin) = trigger center x, 0 (below) or popover height (above)', duration: 'enter opacity 150ms / transform 190ms; exit 110ms / 110ms, element removed after 140ms', easing: '--ease-out', runtime: 'CSS transition; .open is added on the next animation frame so the transition runs', reduced: 'scale snaps (transform not transitioned); opacity still fades', framer: 'initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.11 } }} transition={{ opacity: { duration: 0.15 }, scale: { duration: 0.19, ease: [0.23, 1, 0.32, 1] } }}' }),
        a11y: 'role="dialog"; Esc closes (kit layer stack); pointerdown outside closes; focus should move into the popover and return to the trigger (not done in 002 — Radix handles it).',
        stories: [
          { label: 'Rule · linked to Calendar', note: 'Row with icon, sub line, actions', bg: 'wallpaper', span: 2, html: pop(RULE_POP, 300) },
          { label: 'Rule · grouped by you', bg: 'wallpaper', span: 2, html: pop(MANUAL_POP, 300) },
          { label: 'People', note: 'Title, person rows, footer', bg: 'wallpaper', span: 2, html: pop(PEOPLE_POP, 250) },
          { label: 'Purpose history', note: 'Version rows; current version chip', bg: 'wallpaper', span: 2, html: pop(HISTORY_POP, 310) },
          { label: 'Reference document', note: 'File head, switch row, actions with a destructive text button', bg: 'wallpaper', span: 2, html: pop(REF_POP, 300) },
          { label: 'Empty', bg: 'wallpaper', span: 2, html: pop(EMPTY_POP, 330) },
          { label: 'Live · origin and flip', note: 'Top row opens below, bottom row above; the readout shows the computed --origin · Replay re-opens the center one', span: 'full', flush: true, html: `${replayButton()}${stage(300, `<div class="ov-origins">${ORIGINS.map(([align, side]) => `<button class="btn" data-align="${align}" data-side="${side}">${align} · ${side}</button>`).join('')}</div>`)}`, mount: (canvas) => {
            on(canvas, '[data-align]', (btn) => openOrigin(btn));
            canvas.querySelector('[data-replay]').addEventListener('click', () => openOrigin(canvas.querySelector('[data-align="center"][data-side="bottom"]'), true));
          } }
        ]
      },
      {
        id: 'menu',
        name: 'Menu',
        summary: 'macOS pull-down menu on glass. Opens instantly; the row under the pointer or arrow keys is accent-filled; choosing blinks the row once before the menu fades out.',
        mapsTo: 'Radix DropdownMenu (shadcn DropdownMenu) — Label, Item (with Shortcut), Separator; swatch items render a SeriesDot',
        usedIn: ['Menu bar menus', 'Doc toolbar ⋯', 'Past meeting ⋯', 'Add to series / File to', 'Follow a different event', 'Add reference', 'Day and time pop-ups'],
        source: 'kit Kit.menu(trigger, items, { align, minWidth, container }) · .menu .menu-item (.active .danger .disabled) .menu-sep .menu-title · 002 doc-popovers.js D.docMenu · doc-organize.js D.meetingMenu · app-actions.js T.addToSeriesMenu',
        props: [['items', '({ label, icon?, kbd?, swatch?, danger?, disabled?, onSelect } | "-" | { title })[]', '—'], ['align', 'start | end', 'start'], ['minWidth', 'px', '210']],
        states: ['open', 'row active (pointer or keys)', 'row disabled', 'row danger', 'danger active', 'choosing (blink)', 'closing'],
        tokens: ['--glass-strong', '--shadow-float', '--accent', '--coral', '--coral-ink', '--label-2', '--label-3', '--separator'],
        motion: motion({ trigger: 'click on the trigger; choose a row', props: 'open: none (appears instantly); choose: row .active off then on again after 60ms (macOS blink), then .closing → opacity 1 → 0', duration: 'blink 60ms; close fade 120ms starting at 130ms, element removed at 260ms; opening another menu removes the old one with no fade', easing: 'ease (opacity)', runtime: 'CSS transition for the fade + setTimeout sequence for the blink', reduced: 'unchanged (only opacity)', framer: 'no enter animation; exit={{ opacity: 0 }} transition={{ duration: 0.12 }}; blink via a 60ms data-highlighted toggle before onSelect' }),
        a11y: 'role="menu" / "menuitem"; focus lands on the menu; ↑↓ skip disabled rows; ↩ chooses; Esc closes; pointerdown outside closes. Shortcut text should also be exposed via aria-keyshortcuts.',
        stories: [
          Catalog.table({ label: 'Row kinds × pointer', note: 'Each kind at rest and under the pointer', bg: 'wallpaper', rows: ROW_KINDS, cols: [{ label: 'Rest' }, { label: 'Active' }], render: (r, c) => menuMarkup([{ ...r.item, active: c.label === 'Active' && !r.item.disabled }], 230) }),
          { label: 'Doc menu', note: 'Title, icons, shortcuts, separator, danger · pointer on Export', bg: 'wallpaper', html: menuMarkup(activeAt(docMenu(ps), 'Export as Markdown'), 230), height: 230 },
          { label: 'Past meeting menu', note: 'Danger row under the pointer', bg: 'wallpaper', html: menuMarkup(activeAt(meetingMenu(), 'Delete meeting…'), 230), height: 230 },
          { label: 'Add to series', note: 'Swatch rows + “New series…”', bg: 'wallpaper', html: menuMarkup(addToSeries(), 230), height: 260 },
          { label: 'Follow a different event', note: 'Detail text in the shortcut slot; current row disabled', bg: 'wallpaper', span: 2, html: menuMarkup(followMenu(), 280) },
          { label: 'Recent on this Mac', note: 'Add reference menu', bg: 'wallpaper', span: 2, html: menuMarkup(recentMenu(), 250) },
          { label: 'Live', note: 'Click ⋯ · hover or use ↑↓ ↩ · choosing blinks the row, then the menu fades', span: 'full', flush: true, html: stage(260, `<div class="ov-mid"><button class="btn icon" data-menu aria-label="More">${icon('ellipsis')}</button><button class="btn" data-menu-series>Add to series…</button></div>`), mount: (canvas) => {
            on(canvas, '[data-menu]', (btn) => Kit.menu(btn, withToasts(canvas, docMenu(ps)), { align: 'end', minWidth: 230 }));
            on(canvas, '[data-menu-series]', (btn) => Kit.menu(btn, withToasts(canvas, addToSeries()), { minWidth: 230 }));
          } }
        ]
      },
      {
        id: 'context-menu',
        name: 'ContextMenu',
        summary: 'The same menu opened at the pointer by a right-click on an agenda card. Rows enable or disable from the event’s state.',
        mapsTo: 'Radix ContextMenu (shadcn ContextMenu)',
        usedIn: ['Agenda event cards'],
        source: 'kit Kit.contextMenu(event, items, { container }) · 002 app-actions.js T.cardMenu · app.js onContext',
        props: [['items', 'same as Menu', '—'], ['point', '{ x, y } from the contextmenu event (offset 2px)', '—']],
        states: ['tracked event', 'untracked event', 'recording', 'row active'],
        tokens: ['--glass-strong', '--accent', '--coral'],
        motion: motion({ trigger: 'right-click (contextmenu) on a card; choose a row', props: 'open: none — appears at the pointer (offset 2px, clamped 8px inside the window); choose: 60ms row blink, then opacity 1 → 0', duration: 'blink 60ms; fade 120ms from 130ms; removed at 260ms', easing: 'ease (opacity)', runtime: 'CSS transition + setTimeout (same code path as Menu)', reduced: 'unchanged (opacity only)', framer: 'no enter animation; exit={{ opacity: 0 }} transition={{ duration: 0.12 }}' }),
        a11y: 'Also reachable with the keyboard (Shift+F10 / the Menu key in Radix); the card becomes selected before the menu opens.',
        stories: [
          { label: 'Tracked event', note: '1:1 · Maria Chen — pointer on Record', bg: 'wallpaper', html: menuMarkup(activeAt(cardMenuItems('before', 't4'), 'Record'), 220), height: 250 },
          { label: 'Untracked one-off', note: 'Coffee with Alex Kim — page, purpose and stop tracking disabled', bg: 'wallpaper', html: menuMarkup(cardMenuItems('before', 't6'), 220), height: 250 },
          { label: 'While recording', note: 'Product Sync live — Stop recording', bg: 'wallpaper', html: menuMarkup(cardMenuItems('live', 't2'), 220), height: 250 },
          { label: 'Live · right-click the card', note: 'Real agenda card (T.agenda.cardMarkup) · choose a row', span: 'full', flush: true, html: stage(300, `<div class="ov-card">${cardMarkup('before', 't4')}</div>`), mount: (canvas) => {
            const card = canvas.querySelector('.a-card');
            const items = withToasts(canvas, cardMenuItems('before', 't4'));
            card.addEventListener('contextmenu', (ev) => {
              card.classList.add('is-selected');
              Kit.contextMenu(ev, items, { container: stageOf(canvas) });
            });
          } }
        ]
      },
      {
        id: 'sheet',
        name: 'Sheet',
        summary: 'Window-modal glass sheet centered over a scrim, with head, body and a right-aligned footer. A kit primitive — 002 never opens one (T.ui.sheet stays null); content here comes from sketch 001’s Paste text sheet.',
        mapsTo: 'Radix Dialog (shadcn Dialog) scoped to the window',
        usedIn: ['Kit only in 002 (001: paste text, detection, proposals)'],
        source: 'kit Kit.sheet(markup, { width, onClose, className, container, closeOnScrim }) · .sheet .sheet-head .sheet-body .sheet-foot .scrim · 001 a-today-inspector.js pasteSheet',
        props: [['width', 'px (--sheet-w)', '520'], ['closeOnScrim', 'boolean', 'false'], ['onClose', '(result) => void — [data-close] buttons pass their value', '—']],
        states: ['closed', 'opening', 'open', 'closing'],
        tokens: ['--glass-strong', '--shadow-window', '--scrim'],
        motion: motion({ trigger: 'Kit.sheet(); any [data-close] button, Esc or api.close()', props: 'scrim opacity 0 → 1; sheet opacity 0 → 1 and transform translate(-50%, -50%) scale(0.96) → scale(1)', duration: 'scrim 220ms; sheet opacity 200ms / transform 260ms; exit 140ms / 160ms, removed after 200ms; first field focused 60ms after open', easing: 'sheet --ease-out; scrim ease', runtime: 'CSS transition (.open added on the next frame)', reduced: 'scale snaps; opacity fades', framer: 'overlay: initial={{ opacity: 0 }} animate={{ opacity: 1 }} (0.22s); content: initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.26, ease: [0.23, 1, 0.32, 1] }} exit duration 0.16' }),
        a11y: 'role="dialog" aria-modal="true"; focus goes to the first field; Esc closes; focus should be trapped and returned (Radix Dialog).',
        stories: [
          { label: 'Open', note: 'Head · body · footer', bg: 'wallpaper', span: 2, html: stat(`<div class="sheet" role="dialog" style="--sheet-w:520px">${sheetMarkup}</div>`) },
          { label: 'Live', note: 'Opens over a scrim inside the stage · type to enable Attach · Esc or Cancel closes', span: 2, flush: true, html: stage(380, `<div class="ov-mid"><button class="btn" data-sheet>${icon('paperclip')}Paste text…</button></div>`), mount: (canvas) => on(canvas, '[data-sheet]', () => openSheet(canvas)) }
        ]
      },
      {
        id: 'alert',
        name: 'Alert',
        summary: 'Small centered confirmation with the app icon, a bold title, one line of consequences and two equal buttons. Destructive confirms turn the primary coral.',
        mapsTo: 'Radix AlertDialog (shadcn AlertDialog)',
        usedIn: ['Onboarding (calendar permission)', 'Delete meeting', 'Stop tracking'],
        source: 'kit Kit.alert({ title, message, buttons, iconMarkup, container }) → Promise · 002 app-onboard.js askCalendar · doc-organize.js deleteMeetingFlow (.btn.primary.danger) · app-actions.js confirmStopTracking',
        props: [['title', 'string', '—'], ['message', 'string', '—'], ['buttons', '{ label, value, primary }[] (cancel first)', 'OK'], ['destructive', 'boolean (primary uses coral)', 'false']],
        states: ['permission', 'confirm', 'destructive confirm', 'opening', 'closing'],
        tokens: ['--glass-strong', '--shadow-window', '--accent', '--coral', '--coral-ink'],
        motion: motion({ trigger: 'Kit.alert(); a button, ↩ (primary) or Esc (cancel)', props: 'opacity 0 → 1 and transform translate(-50%, -50%) scale(0.95) → scale(1)', duration: 'enter opacity 180ms / transform 220ms; exit 120ms / 140ms, removed after 160ms', easing: '--ease-out', runtime: 'CSS transition', reduced: 'scale snaps; opacity fades', framer: 'initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ opacity: { duration: 0.18 }, scale: { duration: 0.22, ease: [0.23, 1, 0.32, 1] } }} exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.14 } }}' }),
        a11y: 'role="alertdialog"; ↩ activates the primary, Esc the cancel button; the destructive action should not be the default focus.',
        stories: [
          { label: 'Calendar permission', note: 'Onboarding step 1', bg: 'wallpaper', span: 2, html: alertMarkup(ALERTS.calendar), height: 250 },
          { label: 'Destructive confirm', note: 'Delete meeting — primary turns coral', bg: 'wallpaper', span: 2, html: alertMarkup(ALERTS.delete), height: 250 },
          { label: 'Confirm', note: 'Stop tracking', bg: 'wallpaper', span: 2, html: alertMarkup(ALERTS.stop), height: 250 },
          { label: 'Live', note: 'Opens centered in the stage; the answer comes back as a toast', span: 'full', flush: true, html: stage(330, liveBar('<button class="btn sm" data-alert="calendar">Calendar access</button><button class="btn sm" data-alert="delete">Delete meeting…</button><button class="btn sm" data-alert="stop">Stop tracking…</button>')), mount: (canvas) => on(canvas, '[data-alert]', (btn) => runAlert(canvas, btn.dataset.alert)) }
        ]
      },
      {
        id: 'toast',
        name: 'Toast',
        summary: 'Glass capsule at the bottom center of the window confirming what just happened, often with Undo. Hover pauses the timer.',
        mapsTo: 'sonner (Toaster at bottom-center, custom capsule style, action button = Undo)',
        usedIn: ['Every undoable action', 'Exports', 'Filing', 'Attachments', 'Island feedback'],
        source: 'kit Kit.toast(text, { icon, action: { label, onClick }, container, duration }) · .toast-stack .toast (.show .hide) · 002 app-shell.js T.toast',
        props: [['text', 'string (escaped)', '—'], ['icon', 'IconName (accent)', '—'], ['action', '{ label: "Undo", onClick }', '—'], ['duration', 'ms', '4200']],
        states: ['plain', 'with icon', 'with action', 'stacked', 'entering', 'leaving', 'paused (hover)'],
        tokens: ['--glass-strong', '--shadow-float', '--accent', '--accent-soft'],
        motion: motion({ trigger: 'Kit.toast(); timer, action click', props: 'opacity 0 → 1 and transform translateY(14px) scale(0.98) → none; leave: opacity → 0, translateY(10px) scale(0.98)', duration: 'enter opacity 220ms / transform 340ms; leave 160ms / 180ms, removed after 200ms; visible 4200ms, paused on hover, resumes with at least 1200ms', easing: 'opacity ease; transform --ease-out', runtime: 'CSS transition (.show on the next frame, .hide to leave); stack is flex column-reverse with 8px gap — the first toast stays at the bottom, newer ones stack above', reduced: 'transform snaps; opacity fades', framer: 'sonner, or motion.li initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.98 }} with layout for the stack' }),
        a11y: 'role="status" (polite); Undo is a real button and should also be reachable by ⌘Z; do not auto-dismiss while focused.',
        stories: [
          { label: 'Plain', note: 'Kit variant — 002 always passes an icon', bg: 'wallpaper', span: 2, html: toastStack([toastMarkup('Telu · a local-first companion for recurring conversations')]) },
          { label: 'With icon', bg: 'wallpaper', span: 2, html: toastStack([toastMarkup('Exported Product Sync.md to Downloads', { icon: 'check-circle' })]) },
          { label: 'With Undo', bg: 'wallpaper', span: 2, html: toastStack([toastMarkup('Added Coffee with Alex Kim to Product Sync', { icon: 'check-circle', action: 'Undo' })]) },
          { label: 'Stacked', note: 'Newer toasts stack above the first', bg: 'wallpaper', span: 2, html: toastStack([toastMarkup('Filed to Acme · Implementation', { icon: 'folder', action: 'Undo' }), toastMarkup('Purpose v4 saved — Telu builds every brief from it', { icon: 'check-circle' })]) },
          { label: 'Live', note: 'Fire toasts into the stage · hover one to pause it', span: 'full', flush: true, html: stage(240, liveBar('<button class="btn sm" data-toast="plain">Plain</button><button class="btn sm" data-toast="icon">With icon</button><button class="btn sm" data-toast="undo">With Undo</button>')), mount: (canvas) => on(canvas, '[data-toast]', (btn) => fireToast(canvas, btn.dataset.toast)) }
        ]
      },
      {
        id: 'notification-banner',
        name: 'NotificationBanner',
        summary: 'macOS-style banner under the menu bar at the top right: app icon, title, one line, time and up to two actions. It slides in on a spring and slides out faster.',
        mapsTo: 'Native macOS notification in production (tauri-plugin-notification with action buttons); this custom component only exists for the prototype',
        usedIn: ['Meeting starting', 'Review ready'],
        source: 'kit Kit.notify({ title, body, time, actions, duration, onClick, container }) · .notif-stack .notif (.show .hide) · 002 app-record.js T.notifyStarting / T.notifyReview',
        props: [['title', 'string', '—'], ['body', 'string', '—'], ['time', 'string', '"now"'], ['actions', '{ label, primary, onClick }[] (≤ 2)', '[]'], ['duration', 'ms', '7000'], ['onClick', '() => void (click on the banner body)', '—']],
        states: ['with actions', 'single action', 'without actions', 'stacked', 'entering', 'leaving', 'paused (hover)'],
        tokens: ['--glass-strong', '--shadow-float', '--spring', '--spring-dur', '--ease-in-out'],
        motion: motion({ trigger: 'Kit.notify(); timer, action or body click', props: 'transform translateX(calc(100% + 24px)) → none; leave back to translateX(calc(100% + 24px))', duration: 'enter 490ms (--spring-dur); leave 240ms, removed after 260ms; visible 7000ms, hover pauses, leaving the banner restarts a 2500ms timer', easing: 'enter --spring (0.3% overshoot); leave --ease-in-out', runtime: 'CSS transition (.show after two animation frames)', reduced: 'transform not transitioned — appears and disappears in place', framer: 'initial={{ x: "calc(100% + 24px)" }} animate={{ x: 0 }} transition={{ type: "spring", duration: 0.49, bounce: 0.12 }} exit={{ x: "calc(100% + 24px)", transition: { duration: 0.24, ease: [0.77, 0, 0.175, 1] } }}' }),
        a11y: 'role="status"; actions are buttons; in production the OS handles focus and Notification Center.',
        stories: [
          { label: 'Meeting starting', note: 'Primary + secondary action', bg: 'wallpaper', span: 2, html: notifStack([notifMarkup(NOTIFS.starting)]) },
          { label: 'Review ready', note: 'Single action', bg: 'wallpaper', span: 2, html: notifStack([notifMarkup(NOTIFS.review)]) },
          { label: 'Without actions', note: 'Kit variant — every 002 banner has actions', bg: 'wallpaper', span: 2, html: notifStack([notifMarkup({ ...NOTIFS.review, actions: [] })]) },
          { label: 'Stacked', note: 'New banners append below', bg: 'wallpaper', span: 2, html: notifStack([notifMarkup(NOTIFS.starting), notifMarkup({ ...NOTIFS.review, time: '9:58' })]) },
          { label: 'Live', note: 'Banners slide in under the stage’s menu bar · hover to hold · click an action to dismiss', span: 'full', flush: true, html: stage(300, `${menubar()}${liveBar('<button class="btn sm" data-notif="starting">Meeting starting</button><button class="btn sm" data-notif="review">Review ready</button>')}`), mount: (canvas) => on(canvas, '[data-notif]', (btn) => fireNotif(canvas, btn.dataset.notif)) }
        ]
      },
      {
        id: 'tooltip',
        name: 'Tooltip',
        summary: 'Small glass label below a control. The first one waits 650ms; moving to a neighbour within 600ms shows the next instantly.',
        mapsTo: 'Radix Tooltip with TooltipProvider delayDuration={650} skipDelayDuration={600}',
        usedIn: ['Toolbar icon buttons', 'Sidebar add', 'Peek close', 'Include dots', 'Private chip', 'Grip'],
        source: 'kit tooltips() — one .tooltip element driven by [data-tip] (pointerover / pointerout / pointerdown) · .tooltip (.show .instant)',
        props: [['content', 'string (data-tip)', '—'], ['side', 'bottom (fixed: 6px below, centered, clamped 8px from the left)', 'bottom']],
        states: ['hidden', 'delayed show', 'instant show (warm)', 'hidden on press'],
        tokens: ['--glass-strong', '--shadow-float', '--label'],
        motion: motion({ trigger: 'pointer rests on a [data-tip] element for 650ms; warm = shown or hidden < 600ms ago', props: 'opacity 0 → 1 and transform scale(0.97) → none (origin top center)', duration: '125ms in and out; warm tooltips use .instant (0ms)', easing: '--ease-out', runtime: 'CSS transition', reduced: 'scale snaps; opacity fades', framer: 'initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.125 }} — skip the animation when the provider is warm' }),
        a11y: 'Tooltips repeat an accessible name — icon buttons still need aria-label. Hidden on pointerdown and never contain interactive content.',
        stories: [
          { label: 'Delayed', note: 'First hover · after 650ms', bg: 'wallpaper', html: stat('<div class="tooltip show">Previous day</div>') },
          { label: 'Instant', note: 'Neighbour within 600ms · .instant (0ms)', bg: 'wallpaper', html: stat('<div class="tooltip show instant">Next day</div>') },
          { label: 'With shortcut', note: 'Toolbar back button', bg: 'wallpaper', html: stat('<div class="tooltip show">Back · ⌘[</div>') },
          { label: 'Live', note: 'Hover a button, wait, then slide to its neighbours', span: 2, bg: 'wallpaper', html: `<div class="ov-tips">${tipGroup}</div>` }
        ]
      },
      {
        id: 'evidence-popover',
        name: 'EvidencePopover',
        summary: 'Where a claim came from: the exact words (speech) or the excerpt (document), who said it, and a way to open the full transcript or document.',
        mapsTo: 'Radix Popover with <EvidenceSpeech> / <EvidenceDocument> content; opened by SourceChip',
        usedIn: ['Memory', 'Brief (Since last time, Worth asking)', 'Past meetings', 'Review candidates', 'Peek', 'Island'],
        source: 'kit Kit.evidence(trigger, { t, who, quote }, { where, onOpen }) · 002 doc-review.js D.openEvidence / docEvidence / candidateEvidence · doc.css .ev-pop · app-model.js T.evidenceFor',
        props: [['kind', 'speech | document', 'speech'], ['where', 'meeting date ("Sep 22")', '—'], ['t', 'timestamp or page', '—'], ['who', 'speaker', '—'], ['quote', 'string', '—'], ['openLabel', '"Open transcript" | "Jump to Sep 22" | "Open Sep 22 in the doc" | none', 'Open transcript']],
        states: ['speech', 'speech · jump', 'speech · peek', 'speech · no meeting on file', 'candidate (today)', 'document'],
        tokens: ['--glass-strong', '--accent-soft', '--label-2', '--label-3'],
        motion: motion({ trigger: 'click on a SourceChip; Open transcript', props: 'opacity 0 → 1 and scale(0.96) → none from the chip (--origin); Open transcript closes the popover first, then the details drawer slides in', duration: 'enter opacity 150ms / scale 190ms; exit 110ms; drawer 300ms', easing: 'popover --ease-out; drawer --ease-drawer', runtime: 'CSS transition (Kit.popover)', reduced: 'scale snaps; opacity fades', framer: 'same presets as Popover' }),
        a11y: 'Quote is a blockquote with cite; the open action is a button; Esc returns focus to the source chip.',
        stories: [
          { label: 'Speech · inside a past meeting', note: 'Open transcript', bg: 'wallpaper', span: 2, html: evidenceSpeech(speechEv(ps, 'Sep 22 · 18:42'), 'Open transcript') },
          { label: 'Speech · elsewhere in the doc', note: 'Jump to the meeting', bg: 'wallpaper', span: 2, html: evidenceSpeech(speechEv(ps, 'Sep 22 · 24:10'), 'Jump to Sep 22') },
          { label: 'Speech · in the side peek', bg: 'wallpaper', span: 2, html: evidenceSpeech(speechEv(ps, 'Sep 15 · 31:10'), 'Open Sep 15 in the doc') },
          { label: 'Speech · no meeting on file', note: 'No open action', bg: 'wallpaper', span: 2, html: evidenceSpeech(speechEv(acme, 'Sep 1 · 04:50')) },
          { label: 'Review candidate', note: 'Today’s meeting, transcript time only', bg: 'wallpaper', span: 2, html: evidenceSpeech({ where: 'Today', ...DATA.afterMeeting.candidates[0].ev }, 'Open transcript') },
          { label: 'Document', note: 'Excerpt, file badge, local note, Open', bg: 'wallpaper', span: 2, html: pop(docEvidenceInner(speechEv(ps, 'North-star metrics.docx · p.2')), 330) },
          { label: 'Live', note: 'Click a source chip — speech, document, no meeting on file', span: 'full', flush: true, html: stage(330, `<div class="ov-ev">${EV_SOURCES.map(evRow).join('')}</div>`), mount: (canvas) => on(canvas, '.source[data-sid]', (btn) => openEvidence(canvas, btn)) }
        ]
      },
      {
        id: 'fly-chip',
        name: 'FlyChip',
        summary: 'A glass chip that flies from where something happened to where it lands (usually a sidebar series row), then the target flashes and its icon bumps.',
        mapsTo: 'Shared-element flight: framer-motion layoutId, or two nested motion.divs (x and y with different easings) in a portal',
        usedIn: ['Track a series', 'Join a proposal', 'File a recording', 'Move / split a meeting', 'Create a series', 'Onboarding (app icon to menu bar)'],
        source: 'kit Kit.flyTo(fromEl, toEl, { markup, duration = 560 }) · 002 app-shell.js T.flyMarkup (.a-fly) · app-actions.js / app-flows.js / doc-organize.js flyChip (.fly-chip)',
        props: [['from', 'element', '—'], ['to', 'element', '—'], ['markup', '.a-fly (series) | .fly-chip (glyph + label)', 'clone of from'], ['duration', 'ms', '560']],
        states: ['series chip', 'glyph chip', 'drag ghost', 'in flight', 'landed (receive + bump)'],
        tokens: ['--glass-strong', '--shadow-float', '--accent-soft'],
        motion: motion({ trigger: 'an item is filed, tracked, joined, moved or created', props: 'outer translateX(0 → dx); inner translateY(0 → dy) + scale(1 → clamp(0.4, to.height / from.height, 1)) + opacity 1 → 0.35 — the split axes make a curved path; on finish the target gets .receive (background accent-soft → transparent, 900ms) and its icon .bump (scale 1.18 at 40%, 420ms)', duration: '560ms (onboarding icon 620ms)', easing: 'x cubic-bezier(0.45, 0, 0.2, 1); y/scale/opacity cubic-bezier(0.6, 0, 0.9, 0.7); receive and bump --ease-out', runtime: 'WAAPI (fixed-position clone on document.body, fill forwards) → CSS keyframes on the target', reduced: 'no flight; the target still flashes (bump is disabled by the kit reduced rule)', framer: 'portal chip with motion.div x (ease [0.45, 0, 0.2, 1]) wrapping motion.div y/scale/opacity (ease [0.6, 0, 0.9, 0.7]), duration 0.56; then target animate backgroundColor keyframes' }),
        a11y: 'Decorative — announce the result in a status toast (002 always pairs a flight with a toast).',
        stories: [
          { label: 'Series chip', note: 'T.flyMarkup — new or retracked series', bg: 'wallpaper', html: flyShell(Catalog.withScenario('before', () => T.flyMarkup(T.seriesById('design-review')))) },
          { label: 'Glyph chips', note: 'Joined proposal · filed recording · moved meeting', bg: 'wallpaper', span: 2, html: `<div class="ov-row">${flyShell(flyChip(icon('link'), 'Acme · SSO deep-dive'))}${flyShell(flyChip(icon('waveform'), 'Untitled recording'))}${flyShell(flyChip(icon('calendar'), 'Tue 22 Sep'))}</div>` },
          { label: 'Drag ghost', note: 'Drag image while a past meeting is dragged by its grip (.drag-ghost via setDragImage)', bg: 'wallpaper', html: '<div class="ov-ghost"><div class="drag-ghost">' + icon('calendar') + 'Tue 22 Sep</div></div>' },
          { label: 'Live flight', note: 'Replay flies the chip into Acme · Implementation, which flashes and bumps', span: 'full', flush: true, html: `${replayButton()}${stage(230, `<div class="ov-fly-src" data-fly-from>${flyShell(flyChip(icon('link'), 'Acme · SSO deep-dive'))}</div>${flyTarget()}`)}`, mount: (canvas) => {
            replayFly(canvas, true);
            canvas.querySelector('[data-replay]').addEventListener('click', () => replayFly(canvas, false));
          } }
        ]
      }
    ]
  });
})();
