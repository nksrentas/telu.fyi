(() => {
  const e = Catalog.esc;
  const U = T.util;
  const motion = ({ trigger, props, duration, easing, runtime, reduced, framer }) => [
    `Trigger: ${trigger}`, `Animates: ${props}`, `Duration: ${duration}`, `Easing: ${easing}`, `Runtime: ${runtime}`, `Reduced motion: ${reduced}`, `framer-motion: ${framer}`
  ].join(' · ');
  const replayButton = (label = 'Replay', low = false) => `<button class="btn sm ch-replay${low ? ' low' : ''}" data-replay>${icon('play')}${label}</button>`;
  const onReplay = (fn) => (canvas) => {
    fn(canvas, true);
    canvas.querySelector('[data-replay]').addEventListener('click', () => fn(canvas, false));
  };
  const restart = (el, cls) => {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  };
  const timers = (html) => html.replace(/data-rec-timer/g, 'data-ch-timer').replace(/ id="[^"]*"/g, '');
  const runTimers = (canvas, from = DATA.live.elapsed) => canvas.querySelectorAll('[data-ch-timer]').forEach((el) => {
    if (!el.dataset.running) {
      el.dataset.running = '1';
      Kit.timer(el, from);
    }
  });
  const CLOCKS = { first: DATA.now.time, before: DATA.now.time, starting: '10:00', live: '10:12', after: '10:46' };

  const withState = (scenario, patch, fn) => Catalog.withScenario(scenario, () => {
    if (patch) T.state = patch(T.state);
    return fn();
  });
  const docView = (sid, from = { kind: 'day', dayIndex: T.TODAY, label: 'Today' }) => (st) => ({ ...st, view: { kind: 'doc', seriesId: sid, from }, peekOpen: false });
  const sidebarHTML = (scenario, patch) => withState(scenario, patch, () => {
    const host = document.createElement('aside');
    const saved = T.el;
    T.el = { ...(saved || {}), sidebar: host };
    try { T.renderSidebar(); } finally { T.el = saved; }
    return timers(host.innerHTML);
  });
  const sidebarNode = (scenario, patch, selector) => {
    const tpl = document.createElement('template');
    tpl.innerHTML = sidebarHTML(scenario, patch);
    const node = tpl.content.querySelector(selector);
    return node ? node.outerHTML : '';
  };
  const force = (html) => html.replace(/^<(\w+) class="/, '<$1 data-force class="');
  const rowBox = (inner, cls = '') => `<div class="t-app"><div class="sidebar ch-rows ${cls}">${inner}</div></div>`;
  const traffic = '<div class="traffic"><i aria-label="Close window"></i><i aria-label="Minimize"></i><i aria-label="Zoom"></i></div>';

  const titleFor = () => {
    const kind = T.state.view.kind;
    if (kind === 'review') {
      const n = T.reviewCount();
      return ['Review', n ? `${n} ${n === 1 ? 'item needs' : 'items need'} a look` : 'All caught up'];
    }
    if (kind === 'found') {
      const n = T.foundCount();
      return ['Found in Calendar', n ? `${n} ${n === 1 ? 'suggestion' : 'suggestions'} · decide once` : 'Nothing new'];
    }
    if (kind === 'upcoming') return ['Upcoming', 'Next few days'];
    const day = T.state.days[T.state.view.dayIndex];
    return [day.label, day.long];
  };
  const recCapsule = () => {
    const rec = T.state.recording;
    const ev = rec.eventId ? T.eventById(rec.eventId) : null;
    const s = rec.seriesId ? T.seriesById(rec.seriesId) : null;
    const label = ev ? ev.title : s ? s.name : 'Recording';
    return `<div class="a-rec-capsule"><span class="rec-dot"></span><b class="truncate">${e(label)}</b>`
      + `<span class="num a-rec-time" data-ch-timer>0:00</span><button class="btn sm a-rec-stop" data-act="stop">${icon('stop')}Stop</button></div>`;
  };
  const agendaToolbar = () => {
    const [title, sub] = titleFor();
    const st = T.state;
    const dayView = st.view.kind === 'day' && st.calendar === 'connected';
    const prevOff = st.calendar !== 'connected' || (dayView && st.view.dayIndex === 0);
    const nextOff = st.calendar !== 'connected' || (dayView && st.view.dayIndex === st.days.length - 1);
    return `<div class="toolbar-title a-tb-title"><b>${e(title)}</b><span>${e(sub)}</span></div>`
      + `<div class="a-rec-slot">${st.recording ? recCapsule() : ''}</div><span class="spacer"></span>`
      + '<div class="glass-group">'
      + `<button class="btn icon" data-act="day-prev" data-tip="Previous day"${prevOff ? ' disabled' : ''}>${icon('chevron-left')}</button>`
      + '<button class="btn" data-act="day-today">Today</button>'
      + `<button class="btn icon" data-act="day-next" data-tip="Next day"${nextOff ? ' disabled' : ''}>${icon('chevron-right')}</button></div>`
      + '<div class="glass-group">'
      + `<button class="btn a-new-btn" data-act="new-series">${icon('plus')}New<span class="kbd">⌥⌘N</span></button>`
      + `<span class="sep"></span><button class="btn icon" data-act="search" data-tip="Search">${icon('search')}</button></div>`
      + '<i class="a-progress"></i>';
  };
  const recordButton = (live) => (live
    ? '<button class="btn tb-record live" data-act="tb-record"><span class="rec-dot"></span><span class="num tb-timer" data-ch-timer>0:00</span><span>Stop</span></button>'
    : '<button class="btn tb-record" data-act="tb-record"><span class="rec-glyph"></span>Record<span class="kbd">⌘R</span></button>');
  const docToolbar = ({ back = 'Today', compact = false, save = 'Saved', busy = false, live = false, drawer = false, sid = 'product-sync' } = {}) => {
    const s = DATA.series.find((x) => x.id === sid);
    return `<button class="btn sm plain tb-back" data-act="back" data-tip="Back · ⌘["${back ? '' : ' hidden'}>${icon('chevron-left')}<span>${e(back || '')}</span></button>`
      + `<div class="tb-title${compact ? ' show' : ''}">${Kit.seriesIcon(s)}<b>${e(s.name)}</b></div><span class="spacer"></span><span class="save-state${busy ? ' busy' : ''}">${e(save)}</span>`
      + '<div class="glass-group">'
      + `<button class="btn icon" data-act="history" data-tip="History">${icon('history')}</button>`
      + `<button class="btn icon" data-act="share" data-tip="Export as Markdown">${icon('share')}</button><span class="sep"></span>`
      + `${recordButton(live)}<button class="btn icon" data-act="tb-more" data-tip="More">${icon('ellipsis')}</button></div>`
      + `<div class="glass-group"><button class="btn icon${drawer ? ' on' : ''}" data-act="inspector"${drawer ? ' id="tbInspector"' : ''} data-tip="Details">${icon('inspector')}</button></div>`
      + '<i class="a-progress"></i>';
  };
  const mainBox = (toolbar, { mode = 'agenda', scrolled = false, height = 52, width = '', content = '' } = {}) => `<div class="t-app ch-app"${width ? ` style="width:${width}px"` : ''}><section class="main ch-main" style="height:${height}px">`
    + `<div class="toolbar${scrolled ? ' scrolled' : ''}" data-mode="${mode}">${toolbar}</div><div class="content">${content}</div></section></div>`;
  const agendaTb = (scenario, patch, opts) => withState(scenario, patch, () => mainBox(agendaToolbar(), opts));
  const timeline = (scenario) => withState(scenario, null, () => timers(`<div class="agenda-inner"><div class="a-timeline">${T.agenda.timelineMarkup(T.state.days[T.TODAY].events, T.TODAY)}</div></div>`));
  const docUnder = () => withState('before', null, () => timers(`<div class="doc ch-doc">${T.doc.headerMarkup(T.seriesById('product-sync'))}${T.doc.purposeMarkup(T.seriesById('product-sync'))}</div>`));
  const view = (kind, dayIndex = T.TODAY) => (st) => ({ ...st, view: { kind, dayIndex } });

  const capsuleIn = (el) => {
    if (!Kit.reduceMotion()) el.animate([{ opacity: 0, transform: 'scale(0.96)', filter: 'blur(2px)' }, { opacity: 1, transform: 'none', filter: 'blur(0px)' }], { duration: 240, easing: Kit.EASE_OUT });
  };
  const replayCapsule = (canvas, first) => {
    const slot = canvas.querySelector('.a-rec-slot');
    runTimers(canvas);
    if (first) return;
    const cap = slot.querySelector('.a-rec-capsule');
    if (!cap) {
      slot.innerHTML = withState('live', null, recCapsule);
      runTimers(canvas);
      return capsuleIn(slot.firstElementChild);
    }
    if (Kit.reduceMotion()) return cap.remove();
    return cap.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(0.96)' }], { duration: 150, easing: 'ease-out', fill: 'forwards' }).finished.then(() => cap.remove());
  };
  const runProgress = (bar, duration = 900) => {
    bar.getAnimations().forEach((a) => a.cancel());
    return bar.animate([{ transform: 'scaleX(0)', opacity: 1 }, { transform: 'scaleX(1)', opacity: 1 }], { duration, easing: 'linear', fill: 'forwards' })
      .finished.then(() => bar.animate([{ opacity: 1, transform: 'scaleX(1)' }, { opacity: 0, transform: 'scaleX(1)' }], { duration: 220, easing: 'ease-out', fill: 'forwards' }).finished).catch(() => {});
  };
  const replayTitle = (canvas, first) => {
    if (!first) canvas.querySelector('.tb-title').classList.toggle('show');
  };
  const replaySave = (canvas, first) => {
    if (first) return;
    const el = canvas.querySelector('.save-state');
    el.textContent = 'Saving…';
    el.classList.add('busy');
    setTimeout(() => { el.textContent = 'Saved'; el.classList.remove('busy'); }, 700);
  };
  const wireScroll = (canvas) => {
    const content = canvas.querySelector('.content');
    Kit.scrollEdge(content, canvas.querySelector('.toolbar'));
    runTimers(canvas);
  };

  const shortName = (s) => (s.name.startsWith('1:1 · ') ? s.name.slice(6) : s.name);
  const until = (m) => {
    const diff = U.toMin(U.startTime(m)) - T.state.nowMin;
    if (diff <= 0) return 'now';
    const h = Math.floor(diff / 60);
    const r = diff % 60;
    return h ? `${h}h${r ? ` ${r}m` : ''}` : `${r}m`;
  };
  const STATUS = [
    { label: 'Not onboarded', note: 'Icon only (first run, and whenever there is nothing to say)', scenario: 'first', text: '' },
    { label: 'Next meeting', note: 'Short name · time until', scenario: 'before', text: () => { const m = T.findMeeting('ps-37'); return `<span class="num">${e(shortName(m.series))} · ${until(m.meeting)}</span>`; } },
    { label: 'Next · 1:1, hours away', note: '“1:1 · ” is dropped; hours and minutes', scenario: 'before', text: () => { const m = T.findMeeting('mc-32'); return `<span class="num">${e(shortName(m.series))} · ${until(m.meeting)}</span>`; } },
    { label: 'Starting', note: 'At start time, until you record or skip', scenario: 'starting', text: '<span>Product Sync · now</span>' },
    { label: 'Recording', note: 'Pulsing dot + live timer', scenario: 'live', text: '<span class="rec-dot"></span><span class="num">Recording <span data-ch-timer>0:00</span></span>' },
    { label: 'While the Island is paused', note: 'Not represented in 002 — the status item keeps counting', scenario: 'live', text: '<span class="rec-dot"></span><span class="num">Recording <span data-ch-timer>0:00</span></span>' },
    { label: 'Filing', note: 'Between Stop and the summary (~0.9s)', scenario: 'live', text: '<span>Filing…</span>' },
    { label: 'To review', note: 'After the meeting, until reviewed', scenario: 'after', text: '<span class="num">5 to review</span>' }
  ];
  const statusItem = (text) => `<span class="mb-item telu-status${text ? '' : ' icon-only'}" role="button" aria-label="Telu"><img src="../kit/telu-menubar.png" class="template-img" alt=""><span class="ts-text">${text}</span></span>`;
  const MENUS_ORDER = ['File', 'Edit', 'View', 'Meeting', 'Window', 'Help'];
  const menubar = (text, clock = DATA.now.time) => Kit.menubar({ app: 'Telu', menus: MENUS_ORDER, extras: statusItem(text) }).replace(DATA.now.menubar, `${DATA.now.day}  ${clock}`);
  const statusRow = (p) => {
    const text = typeof p.text === 'function' ? withState(p.scenario, null, p.text) : p.text;
    return `<div class="ch-st-label"><b>${e(p.label)}</b><span>${e(p.note)}</span></div><div class="ch-mb">${menubar(text, CLOCKS[p.scenario])}</div>`;
  };
  const MENUS = (st) => ({
    Telu: [{ label: 'About Telu' }, '-', { label: 'Hide Telu', kbd: '⌘W' }],
    File: [{ label: 'New Series…', icon: 'plus', kbd: '⌥⌘N' }, '-', { label: 'Close Window', kbd: '⌘W' }],
    Edit: [{ label: 'Edit Purpose', icon: 'pencil', kbd: '⌘E' }, { label: 'Find…', icon: 'search', kbd: '⌘F' }],
    View: [{ label: 'Today', icon: 'sun' }, { label: 'Upcoming', icon: 'calendar' }, { label: 'Review', icon: 'tray' }, { label: 'Found in Calendar', icon: 'sparkles', disabled: st.calendar !== 'connected' }],
    Meeting: [{ label: st.recording ? 'Stop Recording' : 'Record', icon: st.recording ? 'stop' : 'record', kbd: '⌘R' }, { label: 'Open Next Meeting', icon: 'calendar-check' }],
    Window: [{ label: 'Telu', icon: 'check', kbd: '⌥Space' }, { label: 'Close Window', kbd: '⌘W' }],
    Help: [{ label: 'Telu Help', icon: 'question' }]
  });
  const menuRow = (item, active) => (item === '-' ? '<div class="menu-sep"></div>'
    : `<div class="menu-item${item.disabled ? ' disabled' : ''}${active ? ' active' : ''}" role="menuitem">${item.icon ? icon(item.icon) : ''}<span class="truncate">${item.label}</span>${item.kbd ? `<span class="kbd">${item.kbd}</span>` : ''}</div>`);
  const STATUS_FOR = { first: 0, before: 1, live: 4, after: 7 };
  const statusText = (scenario) => {
    const p = STATUS[STATUS_FOR[scenario]];
    return typeof p.text === 'function' ? withState(scenario, null, p.text) : p.text;
  };
  const openMenuTile = (name, activeLabel, scenario = 'before') => {
    const items = withState(scenario, null, () => MENUS(T.state)[name]);
    const bar = menubar(statusText(scenario), CLOCKS[scenario]).replace(`<span class="mb-item">${name}</span>`, `<span class="mb-item active">${name}</span>`);
    return `<div class="ch-mb">${bar}</div><div class="ch-mb-menu" data-under="${name}"><div class="cat-static"><div class="menu" role="menu" style="min-width:220px">${items.map((it) => menuRow(it, it.label === activeLabel)).join('')}</div></div></div>`;
  };
  const placeMenu = (canvas) => {
    runTimers(canvas);
    canvas.querySelectorAll('[data-under]').forEach((box) => {
      const item = [...canvas.querySelectorAll('.menubar .mb-item')].find((x) => x.textContent.trim() === box.dataset.under);
      if (!item) return;
      const a = item.getBoundingClientRect();
      const b = box.offsetParent.getBoundingClientRect();
      box.style.left = `${a.left - b.left}px`;
      box.style.top = `${a.bottom - b.top + 4}px`;
    });
  };
  const wireMenubar = (canvas) => {
    const stage = canvas.querySelector('.cat-desk');
    runTimers(stage);
    stage.querySelector('.menubar').addEventListener('click', (ev) => {
      const item = ev.target.closest('.mb-item');
      if (!item || item.closest('.mb-right')) {
        if (item && item.classList.contains('telu-status')) Kit.toast('Summons the Telu window (⌥Space)', { icon: 'bolt', container: stage, duration: 2200 });
        return;
      }
      const items = withState('before', null, () => MENUS(T.state)[item.textContent.trim()]);
      if (!items) return;
      const api = Kit.menu(item, items.map((it) => (it === '-' ? it : { ...it, onSelect: () => Kit.toast(e(it.label), { icon: it.icon || 'check', container: stage, duration: 2200 }) })), { minWidth: 220, container: stage });
      if (!api) return;
      item.classList.add('active');
      const close = api.close;
      api.close = (instant) => { item.classList.remove('active'); close(instant); };
    });
  };

  const miniWindow = (inner, height, width = '') => `<div class="window t-app cat-window ch-win" style="height:${height}px${width ? `;width:${width}px` : ''}">${traffic}${inner}</div>`;
  const shell = ({ scenario, patch, toolbar, content = '', mode = 'agenda' }) => withState(scenario, patch, () => miniWindow(
    `<aside class="sidebar">${sidebarHTML(scenario, patch)}</aside><section class="main"><div class="toolbar" data-mode="${mode}">${toolbar()}</div><div class="content"><div class="ch-view">${content}</div></div></section>`, 580));

  const NAV_ROWS = [
    { label: 'Today', view: 'day' }, { label: 'Upcoming', view: 'upcoming' }, { label: 'Review', view: 'review' }, { label: 'Found in Calendar', view: 'found' }
  ];
  const navRow = (viewKind, selected, scenario = 'before') => sidebarNode(scenario, selected ? view(viewKind) : view('doc-none'), `.a-nav[data-view="${viewKind}"]`);
  const NAV_COLS = [{ label: 'Rest' }, { label: 'Selected', selected: true }, { label: 'Pressed', force: 'active' }, { label: 'First run', first: true }];
  const seriesRow = (scenario, sid, patch) => sidebarNode(scenario, patch, `.a-sb-row[data-series="${sid}"]`);
  const SERIES_HINTS = ['product-sync', 'maria', 'acme', 'design-review', 'board', 'hiring'];
  const draftRow = () => withState('before', (st) => ({ ...st, series: [...st.series, T.draftSeries(1)] }), () => {
    const host = document.createElement('aside');
    const saved = T.el;
    T.el = { ...(saved || {}), sidebar: host };
    try { T.renderSidebar(); } finally { T.el = saved; }
    return host.querySelector('.a-sb-row[data-series="new-1"]').outerHTML;
  });
  const calRows = (scenario = 'before') => sidebarNode(scenario, null, '.a-cal[data-cal="work"]') + sidebarNode(scenario, null, '.a-cal[data-cal="personal"]');
  const wireCals = (canvas) => canvas.querySelectorAll('.a-cal').forEach((row) => row.addEventListener('click', () => {
    const box = row.querySelector('.check');
    const on = box.getAttribute('aria-checked') !== 'true';
    box.setAttribute('aria-checked', String(on));
    row.classList.toggle('is-off', !on);
  }));
  const seriesTitle = () => sidebarNode('before', null, '.a-sb-title');
  const replayReceive = (canvas, first) => {
    if (!first) restart(canvas.querySelector('.a-sb-row'), 'receive');
  };
  const replayBump = (canvas, first) => {
    if (!first) canvas.querySelectorAll('.count').forEach((c, i) => setTimeout(() => restart(c, 'bump'), i * 90));
  };
  const flyChip = (glyph, label) => `<div class="fly-chip">${glyph}<span>${e(label)}</span></div>`;
  const replayInsert = (canvas, first) => {
    const list = canvas.querySelector('.ch-insert');
    list.querySelectorAll('.ch-new').forEach((r) => r.remove());
    if (first) return;
    const tpl = document.createElement('template');
    tpl.innerHTML = withState('before', (st) => ({ ...st, series: [...st.series, T.seriesFromProposal(DATA.proposals[0])] }), () => {
      const host = document.createElement('aside');
      const saved = T.el;
      T.el = { ...(saved || {}), sidebar: host };
      try { T.renderSidebar(); } finally { T.el = saved; }
      return host.querySelector('.a-sb-row[data-series="growth"]').outerHTML;
    });
    const row = tpl.content.firstElementChild;
    row.classList.add('ch-new');
    list.appendChild(row);
    Kit.enterAnimated(row);
    Kit.flyTo(canvas.querySelector('[data-fly-from]'), row, { markup: T.flyMarkup({ name: 'Growth Review', color: 'var(--series-teal)', icon: 'target' }) });
  };

  Catalog.section({
    id: 'chrome',
    eyebrow: 'Layer 3',
    title: 'Chrome',
    intro: 'The macOS frame around everything: the menu bar and Telu’s status item, the window with its traffic lights, the two toolbars (agenda and living doc) and the translucent sidebar. Sidebar tiles are rendered by 002’s own T.renderSidebar against each scenario.',
    css: `
.ch-replay { position: absolute; top: 10px; right: 10px; z-index: 50; }
.ch-replay.low { top: auto; bottom: 10px; }
.ch-app { width: 100%; }
.ch-main { width: 100%; overflow: hidden; }
.ch-doc { width: min(640px, calc(100% - 80px)); padding-top: 12px; }
.ch-mb { position: relative; width: 100%; height: 26px; }
.ch-mb-menu { position: absolute; top: 52px; left: 22px; z-index: 5; }
.ch-status { display: grid; grid-template-columns: 200px minmax(0, 1fr); gap: 10px 16px; align-items: center; width: 100%; }
.ch-st-label { display: flex; flex-direction: column; line-height: 1.3; }
.ch-st-label b { font-size: 12px; font-weight: 600; }
.ch-st-label span { font-size: 11px; color: var(--label-3); }
.ch-rows.sidebar { width: var(--sidebar-w); padding: 6px 10px; overflow: visible; --sidebar-w: 244px; }
.ch-rowcell { width: 100%; max-width: 244px; }
.ch-rowcell .sidebar.ch-rows { width: 100%; }
.menubar.ch-inline { position: relative; inset: auto; display: inline-flex; width: auto; padding: 0 4px; border-radius: 6px; }
.ch-win { flex: none; }
.ch-view { min-height: 100%; }
.ch-insert-src { position: absolute; left: 28px; top: 50%; transform: translateY(-50%); display: inline-flex; border-radius: 10px; background: var(--glass-strong); box-shadow: var(--shadow-float); }
.ch-traffic { position: relative; width: 100%; height: 100%; }
`,
    components: [
      {
        id: 'menu-bar',
        name: 'MenuBar',
        summary: 'The system menu bar while Telu is frontmost: Apple menu, bold app name, app menus, then status items and the clock on the right. Menus open instantly under their title, which stays highlighted while open.',
        mapsTo: 'Native macOS menu bar — Tauri Menu API (app menu + submenus with accelerators); not rendered by React',
        usedIn: ['Desktop (every scenario)'],
        source: 'kit Kit.menubar({ app, menus, extras }) · .menubar .mb-item (.app .active) .mb-right · 002 app.js MENUS / openMenubarMenu / wireMenubar',
        props: [['app', 'string', '"Telu"'], ['menus', 'string[]', 'File, Edit, View, Meeting, Window, Help'], ['extras', 'status items (MenuBarStatusItem)', '—'], ['clock', 'string', '"Tue 29 Sep  9:41"']],
        states: ['rest', 'menu open (title active)', 'menu row active'],
        tokens: ['--menubar', '--menubar-h', '--separator', '--fill-3', '--template-filter'],
        motion: 'None on the bar. Menus open instantly (no enter animation), close with a 120ms opacity fade; the title highlight is added and removed with no transition.',
        a11y: 'Native in production (VoiceOver and keyboard navigation come from macOS). Accelerators: ⌥⌘N New Series, ⌘E Edit Purpose, ⌘F Find, ⌘R Record, ⌥Space Telu, ⌘W Close Window.',
        stories: [
          { label: 'Rest', note: 'Before · 9:41', bg: 'wallpaper', span: 'full', height: 70, html: `<div class="ch-mb">${menubar(statusText('before'))}</div>` },
          { label: 'File menu open', span: 'full', note: 'Title highlighted (.mb-item.active) · pointer on New Series…', bg: 'wallpaper', height: 170, align: 'start', html: openMenuTile('File', 'New Series…'), mount: placeMenu },
          { label: 'View menu open', span: 'full', note: 'Found in Calendar disabled until a calendar is connected (first run)', bg: 'wallpaper', height: 200, align: 'start', html: openMenuTile('View', 'Today', 'first'), mount: placeMenu },
          { label: 'Meeting menu while recording', span: 'full', note: 'Record becomes Stop Recording', bg: 'wallpaper', height: 150, align: 'start', html: openMenuTile('Meeting', 'Stop Recording', 'live'), mount: placeMenu },
          { label: 'Live', note: 'Click a menu title (real Kit.menu) · click the Telu item', span: 'full', flush: true, html: `<div class="desktop cat-desk panel-host" style="height:230px">${menubar(statusText('before'))}</div>`, mount: wireMenubar }
        ]
      },
      {
        id: 'menu-bar-status-item',
        name: 'MenuBarStatusItem',
        summary: 'Telu’s menu-bar item: the template glyph, plus one short phrase for the most important thing right now. It reads the same state as the Island and summons the window.',
        mapsTo: 'Tauri tray icon (tray.rs) with icon_as_template(true) and set_title() for the phrase; click → show window',
        usedIn: ['Menu bar (every scenario)', 'Onboarding (flies into it)'],
        source: '002 app-bridge.js statusMarkup / T.renderStatus · app.js extras #teluStatus · app.css .menubar .telu-status (.icon-only .ts-text .rec-dot)',
        props: [['phase', 'none | next | starting | recording | filing | review', 'none'], ['text', 'derived phrase (see stories)', '—'], ['onClick', '() => summon()', '—']],
        states: ['icon only', 'next', 'starting', 'recording', 'filing', 'to review'],
        tokens: ['--template-filter', '--coral'],
        motion: motion({ trigger: 'app state changes (T.renderStatus)', props: 'none — the phrase swaps instantly; while recording the dot pulses and the timer ticks every second', duration: 'rec dot 1.4s loop', easing: 'ease-in-out (dot)', runtime: 'innerHTML swap + CSS keyframes (kit-rec) + setInterval timer (Kit.timer)', reduced: 'rec dot slows to 2.4s', framer: 'none — native tray title' }),
        a11y: 'aria-label="Telu"; role="button". Precedence: not onboarded → recording → filing → to review → starting / next → nothing (icon only). Keep the phrase under ~24 characters.',
        stories: [
          { label: 'Every phase', note: 'Rendered with each scenario’s clock', bg: 'wallpaper', span: 'full', align: 'stretch', html: `<div class="ch-status">${STATUS.map(statusRow).join('')}</div>`, mount: (canvas) => runTimers(canvas) },
          { label: 'Icon-only vs text', note: '.icon-only tightens padding to 7px and hides the text', bg: 'wallpaper', span: 2, html: `<div class="row-flex" style="gap:18px"><span class="menubar ch-inline">${statusItem('')}</span><span class="menubar ch-inline">${statusItem('<span class="num">Product Sync · 19m</span>')}</span></div>` }
        ]
      },
      {
        id: 'window-frame',
        name: 'WindowFrame',
        summary: 'The app window: rounded, translucent sidebar material with a deep shadow, traffic lights at 20/20, sidebar on the left and the content column. Closing hides it — Telu keeps running in the menu bar and the Island.',
        mapsTo: 'Tauri window with titleBarStyle "Overlay", hiddenTitle, transparent + macOS vibrancy (sidebar material); traffic lights are native',
        usedIn: ['App'],
        source: 'kit .window .traffic (i × 3, :hover glyphs) · 002 index.html #win · app.css .window.t-app (.zoomed) · app-shell.js hideWindow / showWindow / toggleZoom',
        props: [['sidebarWidth', 'px', '244'], ['zoomed', 'boolean', 'false'], ['hidden', 'boolean (⌘W, red light)', 'false']],
        states: ['shown', 'hidden (closed)', 'zoomed', 'traffic rest', 'traffic hover'],
        tokens: ['--sidebar', '--shadow-window', '--r-window', '--content-bg', '--hairline'],
        motion: 'None — hide/show and zoom swap instantly in 002 (hidden attribute; .zoomed changes inset). Traffic-light glyphs appear on hover of the whole group with no transition. In production the OS animates the window.',
        a11y: 'Native window controls in production. The window root is focusable (tabindex −1) for keyboard shortcuts; ⌘W closes, ⌥Space / ⌘0 summon.',
        stories: [
          Catalog.table({ label: 'Traffic lights', note: 'Hovering the group shows all three glyphs', bg: 'wallpaper', rows: [{ label: 'Close · minimize · zoom' }], cols: [{ label: 'Rest' }, { label: 'Hover', force: 'hover' }], render: () => `<div class="ch-traffic-cell">${miniWindow('', 60, 160).replace('<div class="traffic"', '<div class="traffic" data-force')}</div>` }),
          { label: 'Frame', note: 'Material, radius 16, window shadow, sidebar + content column', bg: 'wallpaper', span: 2, flush: true, height: 280, html: `<div style="padding:28px;width:100%;height:100%">${miniWindow('<aside class="sidebar"></aside><section class="main"><div class="toolbar"></div><div class="content"></div></section>', 220)}</div>` },
          { label: 'Live traffic lights', note: 'Hover the lights', bg: 'wallpaper', html: miniWindow('', 60, 160) }
        ]
      },
      {
        id: 'toolbar',
        name: 'Toolbar',
        summary: 'The 52px strip over the content column. Transparent at rest; when content scrolls under it, it turns into glass with a hairline. Carries a 2px progress hairline on its bottom edge.',
        mapsTo: 'A <Toolbar> header with data-scrolled from a scroll sentinel (IntersectionObserver or onScroll) — Tauri drag region (data-tauri-drag-region)',
        usedIn: ['Agenda (Today, Upcoming, Review, Found)', 'Living doc'],
        source: 'kit .toolbar (.scrolled) .toolbar-title + Kit.scrollEdge(scroller, toolbar) · 002 app-shell.js T.renderToolbar · app.css .a-progress',
        props: [['mode', 'agenda | doc', 'agenda'], ['scrolled', 'boolean (content scrollTop > 2)', 'false'], ['progress', 'boolean', 'false']],
        states: ['rest (transparent)', 'scrolled (glass)', 'progress running'],
        tokens: ['--toolbar-h', '--content-bg', '--separator'],
        motion: motion({ trigger: 'content scroll crosses 2px', props: 'background-color transparent → content-bg 76% and box-shadow 0.5px separator; backdrop-filter blur(18px) saturate(1.6) switches on without a transition', duration: '200ms both ways', easing: 'ease', runtime: 'CSS transition (interruptible)', reduced: 'unchanged (colors and shadows are allowed)', framer: 'none — CSS with a data-scrolled attribute' }),
        a11y: 'role="toolbar" with aria-label; buttons keep their own labels. The toolbar doubles as the window drag region.',
        stories: [
          { label: 'Rest', note: 'Transparent over the top of the content', span: 'full', flush: true, align: 'stretch', html: agendaTb('before', null, { height: 150, content: timeline('before') }) },
          { label: 'Scrolled', note: 'Content scrolled under the toolbar: glass + hairline', span: 'full', flush: true, align: 'stretch', html: agendaTb('before', null, { height: 150, scrolled: true, content: `<div style="margin-top:-86px">${timeline('before')}</div>` }) },
          { label: 'Live scroll', note: 'Scroll the agenda — Kit.scrollEdge toggles .scrolled at 2px', span: 'full', flush: true, align: 'stretch', html: withState('before', null, () => mainBox(agendaToolbar(), { height: 300, content: timeline('before') })), mount: wireScroll },
          { label: 'Progress hairline', note: 'T.runProgress timing: 900ms linear grow, 220ms fade', span: 'full', flush: true, align: 'stretch', height: 100, html: `${replayButton('Replay', true)}${agendaTb('before', null, { height: 52 })}`, mount: onReplay((c, first) => { if (!first) runProgress(c.querySelector('.a-progress')); }) }
        ]
      },
      {
        id: 'agenda-toolbar',
        name: 'AgendaToolbar',
        summary: 'Toolbar for the agenda pages: page title and date, the recording capsule while recording, the day stepper, and New + Search.',
        mapsTo: 'Composition of Toolbar + GlassGroup + shadcn Button; recording capsule as <RecordingCapsule> with AnimatePresence',
        usedIn: ['Today / Yesterday / Tomorrow', 'Upcoming', 'Review', 'Found in Calendar'],
        source: '002 app-shell.js agendaToolbar / titleFor / recCapsule / syncCapsule / updateAgendaToolbar · app.css .a-tb-title .a-rec-slot .a-rec-capsule .a-new-btn',
        props: [['title', 'string', '—'], ['subtitle', 'string', '—'], ['canPrev / canNext', 'boolean', 'true'], ['recording', '{ label, startedAt } | null', 'null'], ['onNew / onSearch / onStop', '() => void', '—']],
        states: ['day', 'first / last day (stepper end disabled)', 'no calendar (stepper disabled)', 'upcoming', 'review', 'found', 'recording', 'narrow (≤ 900px: shortcut hidden)'],
        tokens: ['--coral-soft', '--coral-ink', '--coral', '--label-2'],
        motion: motion({ trigger: 'recording starts or stops (pointer or ⌘R)', props: 'capsule in: opacity 0 → 1, scale(0.96) → none, blur(2px) → 0; out: opacity → 0, scale(0.96), then removed', duration: 'in 240ms; out 150ms', easing: 'in --ease-out; out ease-out', runtime: 'WAAPI (Element.animate); no animation when the toolbar is rebuilt without animate', reduced: 'capsule appears and disappears instantly', framer: '<AnimatePresence>{recording && <motion.div initial={{ opacity: 0, scale: 0.96, filter: "blur(2px)" }} animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }} exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }} transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }} />}</AnimatePresence>' }),
        a11y: 'Stepper buttons need aria-label (“Previous day”, “Next day”); ← → step days with no animation; Stop in the capsule is labelled; the timer is aria-hidden with a status message on start/stop.',
        stories: [
          { label: 'Today', note: 'Before · 9:41', height: 52, span: 'full', flush: true, align: 'stretch', html: agendaTb('before', null, { height: 52 }) },
          { label: 'Yesterday · first day', note: 'Previous-day button disabled', height: 52, span: 'full', flush: true, align: 'stretch', html: agendaTb('before', view('day', 0), { height: 52 }) },
          { label: 'Tomorrow · last day', note: 'Next-day button disabled', height: 52, span: 'full', flush: true, align: 'stretch', html: agendaTb('before', view('day', 2), { height: 52 }) },
          { label: 'Review', note: 'Subtitle counts what needs a look', height: 52, span: 'full', flush: true, align: 'stretch', html: agendaTb('after', view('review'), { height: 52 }) },
          { label: 'Found in Calendar', height: 52, span: 'full', flush: true, align: 'stretch', html: agendaTb('before', view('found'), { height: 52 }) },
          { label: 'Upcoming', height: 52, span: 'full', flush: true, align: 'stretch', html: agendaTb('before', view('upcoming'), { height: 52 }) },
          { label: 'No calendar', note: 'First run — both stepper arrows disabled', height: 52, span: 'full', flush: true, align: 'stretch', html: agendaTb('first', null, { height: 52 }) },
          { label: 'Recording', note: 'Live · 10:12 — capsule with live timer and Stop · Replay removes / brings back the capsule', span: 'full', flush: true, align: 'stretch', height: 100, html: `${replayButton('Replay', true)}${agendaTb('live', null, { height: 52 })}`, mount: onReplay(replayCapsule) },
          { label: 'Recording a one-off', note: 'Capsule takes the event title', span: 'full', flush: true, align: 'stretch', height: 52, html: agendaTb('before', (st) => ({ ...st, recording: { eventId: 't6', meetingId: null, seriesId: null, startedAt: Date.now() } }), { height: 52 }), mount: (c) => runTimers(c, 95) },
          { label: 'Narrow window', note: 'Main column ≤ 900px hides the ⌥⌘N hint', span: 'full', height: 52, html: agendaTb('before', null, { height: 52, width: 760 }) }
        ]
      },
      {
        id: 'doc-toolbar',
        name: 'DocToolbar',
        summary: 'Toolbar for a series’ living doc: back to where you came from, a compact title that appears once the big title scrolls away, the save state, document actions with Record, and the details-drawer toggle.',
        mapsTo: 'Composition of Toolbar + GlassGroup + shadcn Button; compact title via IntersectionObserver on the doc title',
        usedIn: ['Living doc'],
        source: '002 app-shell.js docToolbar / updateDocToolbar / T.paintRecordButton / T.setSaveState · doc.css .tb-title .save-state .tb-record #tbInspector.on · app.css .btn.tb-back · doc-page.js observeTitle',
        props: [['back', '{ label } | null', 'null'], ['compactTitle', 'boolean (doc title scrolled away)', 'false'], ['saveState', '"Saved" | "Saving…" (002 never shows “Editing…”)', '"Saved"'], ['recording', 'boolean', 'false'], ['drawerOpen', 'boolean', 'false']],
        states: ['with back', 'without back', 'compact title hidden', 'compact title shown', 'saving', 'saved', 'recording', 'drawer open'],
        tokens: ['--accent', '--coral', '--coral-soft', '--coral-ink', '--label-2', '--label-3'],
        motion: motion({ trigger: 'doc title leaves / re-enters the area under the toolbar (IntersectionObserver); typing in the purpose', props: 'compact title opacity 0 → 1 and translateY(4px) → none; save-state color label-2 (Saving…) → label-3 (Saved) with a text swap 700ms after the last keystroke', duration: 'title 180ms both ways; save color 150ms', easing: 'title --ease-out; save ease', runtime: 'CSS transition (class toggles .show / .busy)', reduced: 'title fades without moving; save state unchanged', framer: 'title: animate={{ opacity: shown ? 1 : 0, y: shown ? 0 : 4 }} transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}' }),
        a11y: 'Back reads “Back to Today” (⌘[); Record toggles aria-pressed and announces start/stop; the drawer toggle uses aria-expanded; save state is a polite live region.',
        stories: [
          { label: 'From Today', note: 'Back button, compact title hidden, Saved', span: 'full', flush: true, align: 'stretch', height: 52, html: mainBox(docToolbar(), { mode: 'doc', height: 52 }) },
          { label: 'Opened from the sidebar', note: 'No back button', span: 'full', flush: true, align: 'stretch', height: 52, html: mainBox(docToolbar({ back: null }), { mode: 'doc', height: 52 }) },
          { label: 'Scrolled · compact title', note: 'Glass toolbar over the doc; title shown · Replay toggles it', span: 'full', flush: true, align: 'stretch', html: `${replayButton('Replay', true)}${mainBox(docToolbar({ compact: true }), { mode: 'doc', scrolled: true, height: 170, content: `<div style="margin-top:-40px">${docUnder()}</div>` })}`, mount: onReplay(replayTitle) },
          { label: 'Saving', note: 'Typing in the purpose · Replay runs Saving… → Saved (700ms)', span: 'full', flush: true, align: 'stretch', height: 100, html: `${replayButton('Replay', true)}${mainBox(docToolbar({ save: 'Saving…', busy: true }), { mode: 'doc', height: 52 })}`, mount: onReplay(replaySave) },
          { label: 'Recording', note: 'Record becomes rec dot + timer + Stop, in coral', span: 'full', flush: true, align: 'stretch', height: 52, html: mainBox(docToolbar({ live: true }), { mode: 'doc', height: 52 }), mount: (c) => runTimers(c) },
          { label: 'Details drawer open', note: 'Drawer toggle turns accent (#tbInspector.on)', span: 'full', flush: true, align: 'stretch', height: 52, html: mainBox(docToolbar({ drawer: true }), { mode: 'doc', height: 52 }) },
          Catalog.table({ label: 'Back button', note: 'Plain accent text button; hover darkens', rows: [{ label: '‹ Today' }], cols: [{ label: 'Rest' }, { label: 'Hover', force: 'hover' }, { label: 'Pressed', force: 'active' }], render: () => `<button class="btn sm plain tb-back" data-force>${icon('chevron-left')}<span>Today</span></button>` }),
          Catalog.table({ label: 'Record button', note: 'Inside the doc glass group', bg: 'wallpaper', rows: [{ label: 'Idle', live: false }, { label: 'Recording', live: true }], cols: [{ label: 'Rest' }, { label: 'Hover', force: 'hover' }, { label: 'Pressed', force: 'active' }], render: (r) => `<div class="glass-group">${recordButton(r.live).replace('<button class="', '<button data-force class="').replace('data-ch-timer>0:00', 'data-ch-timer>12:04')}</div>` })
        ]
      },
      {
        id: 'sidebar',
        name: 'Sidebar',
        summary: 'Translucent source list: the four agenda destinations, the tracked series, the watched calendars and a local-processing footer. Rendered here by 002’s T.renderSidebar for each scenario.',
        mapsTo: 'shadcn Sidebar (SidebarGroup / SidebarMenu / SidebarMenuButton) over native vibrancy',
        usedIn: ['App window'],
        source: '002 app-shell.js T.renderSidebar / navItem / seriesSection / calendarRow / T.updateCounts / T.syncSidebarSelection · app.css .t-app .sidebar · kit .sidebar .sb-title .sb-item .sb-foot',
        props: [['view', 'day | upcoming | review | found | doc(seriesId)', 'day'], ['counts', '{ today, review, found }', '—'], ['series', 'tracked series[]', '[]'], ['calendars', '{ id, name, account, color, watched }[]', '[]']],
        states: ['first run', 'before', 'doc selected', 'recording', 'after'],
        tokens: ['--sidebar', '--sidebar-w (244)', '--accent', '--fill-2', '--label-3'],
        motion: motion({ trigger: 'selection change; a series is tracked or untracked; counts change', props: 'selected row background-color; new rows height 0 → auto + opacity 0 → 1 (Kit.enterAnimated); removed rows height/margins/paddings → 0 + opacity → 0 (Kit.removeAnimated); counts bump scale 1.18', duration: 'selection 120ms; enter 280ms; remove 220ms; bump 420ms', easing: 'selection ease; the rest --ease-out', runtime: 'CSS transition (selection) + WAAPI (enter/remove) + CSS keyframes (bump)', reduced: 'rows appear and disappear instantly; bump disabled; selection still fades', framer: 'AnimatePresence around rows: initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0, transition: { duration: 0.22 } }} transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}' }),
        a11y: 'nav landmark; rows are links/buttons with aria-current on the selected one; ↑↓ move within a list in Radix/shadcn. 002 has no hover highlight on rows by design (macOS source lists).',
        stories: [
          { label: 'Before · Today selected', note: 'Counts: Today 3 · Review 5 · Found 3', bg: 'wallpaper', flush: true, align: 'center', height: 600, html: miniWindow(`<aside class="sidebar">${sidebarHTML('before')}</aside>`, 560, 244) },
          { label: 'Living doc selected', note: 'Product Sync highlighted', bg: 'wallpaper', flush: true, align: 'center', height: 600, html: miniWindow(`<aside class="sidebar">${sidebarHTML('before', docView('product-sync'))}</aside>`, 560, 244) },
          { label: 'Recording', note: 'Rec dot replaces Product Sync’s time', bg: 'wallpaper', flush: true, align: 'center', height: 600, html: miniWindow(`<aside class="sidebar">${sidebarHTML('live')}</aside>`, 560, 244) },
          { label: 'After · 10:46', note: 'Review 10 · next Product Sync on 6 Oct', bg: 'wallpaper', flush: true, align: 'center', height: 600, html: miniWindow(`<aside class="sidebar">${sidebarHTML('after')}</aside>`, 560, 244) },
          { label: 'First run', note: 'No calendar: no Found, no Series, no Calendars', bg: 'wallpaper', flush: true, align: 'center', height: 600, html: miniWindow(`<aside class="sidebar">${sidebarHTML('first')}</aside>`, 560, 244) }
        ]
      },
      {
        id: 'sidebar-nav-item',
        name: 'SidebarNavItem',
        summary: 'Agenda destination row: accent glyph, label and a quiet tabular count. No hover highlight; selected rows get a neutral fill.',
        mapsTo: 'shadcn SidebarMenuButton + SidebarMenuBadge',
        usedIn: ['Sidebar'],
        source: '002 app-shell.js navItem · kit .sb-item (.selected .count) · app.css .t-app .sb-item',
        props: [['icon', 'sun | calendar | tray | sparkles', '—'], ['label', 'string', '—'], ['count', 'number (hidden when 0)', '0'], ['selected', 'boolean', 'false']],
        states: ['rest', 'selected', 'pressed', 'drop over (Review)', 'count bump'],
        tokens: ['--accent', '--fill-2', '--label-3'],
        motion: motion({ trigger: 'press; selection; count change (T.updateCounts)', props: 'press transform scale(0.985); selection background-color; count .bump scale 1 → 1.18 → 1', duration: 'press 140ms; background 120ms; bump 420ms', easing: 'press --ease-out; background ease; bump --ease-out', runtime: 'CSS transition + CSS keyframes (kit-bump, restarted per change)', reduced: 'press snaps; bump disabled; background still fades', framer: 'whileTap={{ scale: 0.985 }}; count: key={count} animate={{ scale: [1, 1.18, 1] }} transition={{ duration: 0.42, times: [0, 0.4, 1] }}' }),
        a11y: 'aria-current="page" when selected; the count is read as part of the label (“Review, 5 items”).',
        stories: [
          Catalog.table({ label: 'Rows × states', note: 'Before scenario counts; first run has no calendar', bg: 'sidebar', rows: NAV_ROWS, cols: NAV_COLS, render: (r, c) => {
            if (c.first) return `<div class="ch-rowcell">${rowBox(navRow(r.view, false, 'first') || '<span class="t-caption">not shown</span>')}</div>`;
            const html = navRow(r.view, c.selected);
            return `<div class="ch-rowcell">${rowBox(c.force ? force(html) : html)}</div>`;
          } }),
          { label: 'Drop target (Review)', note: 'Dropping a dragged meeting on Review removes it from the doc (Needs filing)', bg: 'sidebar', html: `<div class="ch-rowcell">${rowBox(navRow('review', false).replace('class="sb-item a-nav', 'class="sb-item a-nav drop-over'), 'dnd')}</div>` },
          { label: 'Count bump', note: 'Replay bumps each count as T.updateCounts does', bg: 'sidebar', span: 2, height: 190, html: `${replayButton()}<div class="ch-rowcell">${rowBox(NAV_ROWS.map((r) => navRow(r.view, r.view === 'day')).join(''))}</div>`, mount: onReplay(replayBump) }
        ]
      },
      {
        id: 'sidebar-section-title',
        name: 'SidebarSectionTitle',
        summary: 'Small section heading. The Series title carries an add button that only appears on hover (or keyboard focus).',
        mapsTo: 'shadcn SidebarGroupLabel + SidebarGroupAction',
        usedIn: ['Sidebar (Series, Calendars)'],
        source: '002 app-shell.js seriesSection (.a-sb-title .a-sb-add) · kit .sb-title · app.css .a-sb-add',
        props: [['label', 'string', '—'], ['action', '{ icon, label, onClick } | none', 'none']],
        states: ['rest', 'hover (add visible)', 'add focus-visible'],
        tokens: ['--label-3', '--label-2'],
        motion: motion({ trigger: 'pointer enters the title row (fine pointers); keyboard focus', props: 'add button opacity 0 → 1', duration: '150ms', easing: 'ease', runtime: 'CSS transition', reduced: 'unchanged (opacity)', framer: 'none — CSS group-hover:opacity-100' }),
        a11y: 'The add button needs aria-label="New series" (002 has only data-tip); it is always visible on touch (no hover).',
        stories: [
          Catalog.table({ label: 'Series title', bg: 'sidebar', rows: [{ label: 'Series' }], cols: [{ label: 'Rest' }, { label: 'Hover', force: 'hover' }], render: () => `<div class="ch-rowcell">${rowBox(force(seriesTitle()))}</div>` }),
          { label: 'Plain title', note: 'Calendars', bg: 'sidebar', html: `<div class="ch-rowcell">${rowBox('<div class="sb-title">Calendars</div>')}</div>` }
        ]
      },
      {
        id: 'sidebar-series-row',
        name: 'SidebarSeriesRow',
        summary: 'A tracked series: its icon, name and a hint for the next meeting (time today, weekday this week, date later) — or a pulsing rec dot while it records. Rows accept dropped meetings. Series rows carry no pending count in 002; pending review is counted on the Review row.',
        mapsTo: 'shadcn SidebarMenuButton with a trailing hint; dnd-kit (or native DnD) droppable',
        usedIn: ['Sidebar'],
        source: '002 app-shell.js seriesRow / T.nextHint / T.revealSeriesRow / T.dropSeriesRow · app.css .a-sb-row .a-hint .sb-item.drop-over .sidebar.dnd .sb-item.landing · doc-organize.js setDropRow · doc-page.js D.receive',
        props: [['series', '{ id, name, color, icon }', '—'], ['hint', 'time | weekday | date | recording', '—'], ['selected', 'boolean', 'false'], ['dropState', 'none | candidate | over', 'none']],
        states: ['rest', 'selected', 'pressed', 'recording', 'draft (Untitled)', 'drag in progress', 'drop over', 'receive flash', 'landing (hidden during fly-to)', 'entering'],
        tokens: ['--series-*', '--label-3', '--fill-2', '--accent-soft'],
        motion: motion({ trigger: 'press; a meeting dragged over; something filed into the series; a new series created', props: 'press scale(0.985); drop-over background accent-soft + scale(1.03); receive background accent-soft → transparent; entering height 0 → auto + opacity 0 → 1 while a FlyChip lands on it', duration: 'press/drop 140ms; receive 900ms (held for the first 30%); enter 280ms; fly 560ms', easing: '--ease-out throughout (fly uses its own curves)', runtime: 'CSS transitions (press, drop-over) + CSS keyframes (kit-receive) + WAAPI (enterAnimated, flyTo)', reduced: 'no scale; no height animation or flight; receive flash still runs (not gated in the kit)', framer: 'whileTap={{ scale: 0.985 }}; drop: animate={{ scale: over ? 1.03 : 1 }}; enter: initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}; receive: animate={{ backgroundColor: [soft, soft, transparent] }} transition={{ duration: 0.9, times: [0, 0.3, 1] }}' }),
        a11y: 'aria-current when selected; the rec dot needs a text alternative (“recording”); drag-and-drop must have a menu alternative (Move to… in the meeting menu).',
        stories: [
          { label: 'Next-meeting hints', note: 'Time today · weekday this week', bg: 'sidebar', span: 2, html: `<div class="ch-rowcell">${rowBox(SERIES_HINTS.map((sid) => seriesRow('before', sid)).join(''))}</div>` },
          Catalog.table({ label: 'States', bg: 'sidebar', rows: [{ label: 'Product Sync' }], cols: [{ label: 'Rest' }, { label: 'Selected', selected: true }, { label: 'Pressed', force: 'active' }], render: (r, c) => {
            const html = seriesRow('before', 'product-sync', c.selected ? docView('product-sync') : null);
            return `<div class="ch-rowcell">${rowBox(c.force ? force(html) : html)}</div>`;
          } }),
          { label: 'Recording', note: 'Live · the hint becomes a pulsing 7px rec dot', bg: 'sidebar', html: `<div class="ch-rowcell">${rowBox(seriesRow('live', 'product-sync'))}</div>` },
          { label: 'Next meeting later', note: 'After · beyond a week the hint is a date', bg: 'sidebar', html: `<div class="ch-rowcell">${rowBox(seriesRow('after', 'product-sync'))}</div>` },
          { label: 'Draft', note: 'New series before it has a name', bg: 'sidebar', html: `<div class="ch-rowcell">${rowBox(draftRow())}</div>` },
          { label: 'Dragging a meeting', note: 'Every row rings (.sidebar.dnd); the row under the pointer is .drop-over', bg: 'sidebar', span: 2, html: `<div class="ch-rowcell">${rowBox(['product-sync', 'maria', 'acme'].map((sid) => (sid === 'maria' ? seriesRow('before', sid).replace('class="sb-item a-sb-row', 'class="sb-item a-sb-row drop-over') : seriesRow('before', sid, sid === 'product-sync' ? docView('product-sync') : null))).join(''), 'dnd')}</div>` },
          { label: 'Receive flash', note: 'After a meeting is filed or moved here · Replay', bg: 'sidebar', height: 130, html: `${replayButton()}<div class="ch-rowcell">${rowBox(seriesRow('before', 'acme'))}</div>`, mount: onReplay(replayReceive) },
          { label: 'New series lands', note: 'Row enters (enterAnimated) while a FlyChip flies into it · Replay', bg: 'sidebar', span: 'full', flush: true, height: 230, html: `${replayButton()}<div class="ch-insert-src" data-fly-from>${T.flyMarkup({ name: 'Growth Review', color: 'var(--series-teal)', icon: 'target' })}</div><div style="position:absolute;right:40px;top:44px">${rowBox(SERIES_HINTS.slice(0, 3).map((sid) => seriesRow('before', sid)).join(''), 'ch-insert')}</div>`, mount: onReplay(replayInsert) }
        ]
      },
      {
        id: 'sidebar-calendar-row',
        name: 'SidebarCalendarRow',
        summary: 'A calendar Telu reads, with a square check in the calendar’s color. Unwatched calendars dim their name and say so. The whole row toggles.',
        mapsTo: 'shadcn SidebarMenuButton containing a Radix Checkbox (colored)',
        usedIn: ['Sidebar · Calendars'],
        source: '002 app-shell.js calendarRow + actions.cal · app.css .a-cal .a-cal-check .a-cal-cap',
        props: [['calendar', '{ name, account, color }', '—'], ['watched', 'boolean', 'true'], ['onToggle', '(watched) => void — toasts “Watching … — read on this Mac only”', '—']],
        states: ['watched', 'not watched', 'pressed'],
        tokens: ['--cal (calendar color)', '--label-2', '--label-3'],
        motion: motion({ trigger: 'click on the row', props: 'check background-color + ring; tick stroke-dashoffset; row press scale(0.985); caption “Not watched” toggles with no transition; agenda Personal rows crossfade (T.refreshPersonal)', duration: 'fill 160ms; tick 220ms (+40ms delay); press 140ms; crossfade 110ms out / 190ms in', easing: 'fill ease; tick, press and crossfade-in --ease-out', runtime: 'CSS transition (check, press) + WAAPI (crossfade)', reduced: 'fill fades; tick and press snap; no crossfade', framer: 'check as in Checkbox; whileTap={{ scale: 0.985 }}' }),
        a11y: 'The row is the control: role="menuitemcheckbox" / checkbox with aria-checked; the inner check is decorative (tabindex −1).',
        stories: [
          { label: 'Watched and not watched', note: 'Click a row to toggle', bg: 'sidebar', span: 2, html: `<div class="ch-rowcell">${rowBox(`<div class="sb-title">Calendars</div>${calRows()}`)}</div>`, mount: wireCals },
          Catalog.table({ label: 'Pressed', bg: 'sidebar', rows: [{ label: 'Work · Google' }], cols: [{ label: 'Rest' }, { label: 'Pressed', force: 'active' }], render: (r, c) => `<div class="ch-rowcell">${rowBox(c.force ? force(sidebarNode('before', null, '.a-cal[data-cal="work"]')) : sidebarNode('before', null, '.a-cal[data-cal="work"]'))}</div>` })
        ]
      },
      {
        id: 'app-shell',
        name: 'AppShell',
        summary: 'Window chrome in context: traffic lights, sidebar, toolbar and an empty content column, composed from 002’s real markup.',
        mapsTo: 'Root layout: Tauri window + SidebarProvider + <Sidebar> + <main> with <Toolbar> and a scroll area',
        usedIn: ['App'],
        source: '002 index.html #win structure · app-shell.js T.renderSidebar / agendaToolbar / docToolbar',
        states: ['agenda (Before)', 'living doc while recording (Live)'],
        tokens: ['--sidebar', '--content-bg', '--shadow-window', '--toolbar-h', '--sidebar-w'],
        motion: 'See Toolbar, Sidebar and the Animations section for view transitions (agenda day slide, view crossfade 200ms, peek and drawer 300ms --ease-drawer).',
        a11y: 'Landmarks: nav (sidebar), main (content), toolbar; skip link to content; ⌘[ back.',
        stories: [
          { label: 'Window chrome in context · agenda', note: 'Before · 9:41 · Today selected', bg: 'wallpaper', span: 'full', flush: true, height: 620, html: `<div style="padding:20px;width:100%;height:100%">${shell({ scenario: 'before', toolbar: agendaToolbar })}</div>` },
          { label: 'Window chrome in context · living doc, recording', note: 'Live · 10:12 · Product Sync selected, toolbar in doc mode', bg: 'wallpaper', span: 'full', flush: true, height: 620, html: `<div style="padding:20px;width:100%;height:100%">${shell({ scenario: 'live', patch: docView('product-sync'), mode: 'doc', toolbar: () => docToolbar({ live: true }) })}</div>`, mount: (c) => runTimers(c) }
        ]
      }
    ]
  });
})();
