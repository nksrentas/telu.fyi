CC.panel = (() => {
  const { $, esc } = Kit;
  const pn = { el: null, open: false, timer: null };
  const statusItem = () => $('#teluStatus');
  const TODAY = DATA.days.find((d) => d.label === 'Today').events;

  function nowCard(st) {
    const f = CC.focusMeeting();
    if (st.phase === 'filing') return `<div class="pn-card"><div class="pn-card-top"><span class="spinner"></span><div class="pn-card-main"><b>Filing ${esc(f.series.name)}…</b><span class="muted">Summary, decisions and commitments</span></div></div></div>`;
    const lv = st.live;
    return `<div class="pn-card"><div class="pn-card-top"><span class="rec-dot${lv.paused ? ' paused' : ''}"></span><div class="pn-card-main"><b>${lv.paused ? 'Paused' : 'Recording'} · ${esc(f.series.name)}</b><span class="muted num">Started 10:00 · <span data-elapsed>${CC.formatElapsed(CC.elapsed())}</span></span></div></div>
      <div class="pn-card-foot"><span class="t-caption">${icon('lock', 'sm')} Transcribing on this Mac</span><span class="spacer"></span><button class="btn sm" data-act="pause">${lv.paused ? 'Resume' : 'Pause'}</button><button class="btn sm record" data-act="stop">Stop</button></div></div>`;
  }
  function nextCard(st) {
    const hit = CC.upcoming();
    if (!hit) return '<div class="pn-card"><div class="pn-card-main"><b>Nothing else today</b><span class="muted">Telu will brief you before tomorrow’s first meeting.</span></div></div>';
    const { series: s, meeting: m } = hit;
    const carried = m.brief ? m.brief.carry.length : 0;
    const docs = m.brief ? m.brief.docs.filter((d) => d.include).length : 0;
    const starting = st.phase === 'starting' && m.id === 'ps-37';
    const actions = starting ? '<button class="btn sm record" data-act="record">Record</button>' : '';
    return `<div class="pn-card"><div class="pn-card-top">${Kit.seriesIcon(s)}<div class="pn-card-main"><b class="truncate">${esc(s.name)}</b><span class="muted num">${CC.startOf(m)} · ${esc(m.where || '')}</span></div><span class="pn-until num">${CC.untilLabel(m)}</span></div>
      <div class="pn-card-foot"><span class="chip accent">Brief ready</span><span class="t-caption truncate">${carried} carried · ${docs} docs</span><span class="spacer"></span>${actions}<button class="btn sm ${starting ? '' : 'primary'}" data-act="meeting" data-id="${m.id}">Open brief</button></div></div>`;
  }
  function todayRow(e, st) {
    const hit = e.meeting ? CC.findMeeting(e.meeting) : null;
    const dot = `<span class="series-dot" style="--c:${hit ? hit.series.color : 'var(--label-4)'}"></span>`;
    const open = hit ? `data-act="meeting" data-id="${e.meeting}"` : '';
    return `<div class="pn-row ${hit ? 'link' : ''}" ${open}><span class="pn-time num">${e.start}</span>${dot}<span class="truncate pn-name">${esc(e.title)}</span>${rowState(e, st)}</div>`;
  }
  function rowState(e, st) {
    if (e.meeting === 'ps-37') {
      if (st.phase === 'skipped') return '<span class="pn-state faint">Not recorded</span>';
      return CC.pending() && st.review.key === 'ps37' ? `<span class="pn-state amber">${CC.pending()} to review</span>` : `<span class="pn-state">${icon('check', 'sm')}Filed</span>`;
    }
    if (e.state === 'preparing') return '<span class="pn-state"><span class="pn-shim shimmer"></span>Preparing brief</span>';
    if (e.state === 'ready') return '<span class="pn-state">Brief ready</span>';
    if (st.tracked) return `<span class="pn-state">${icon('check', 'sm')}Tracked</span>`;
    return '<span class="pn-state faint">Not tracked</span><button class="btn sm tinted pn-track" data-act="track">Track</button>';
  }
  function todaySection(st) {
    const next = CC.upcoming();
    const rows = TODAY.filter((e) => !e.past && e.state !== 'personal' && e.start > '09:30' && !(next && e.meeting === next.meeting.id) && !(e.meeting === 'ps-37' && ['upcoming', 'starting', 'live', 'filing'].includes(st.phase)));
    return `<div class="pn-title">Today</div><div class="pn-rows">${rows.map((e) => todayRow(e, st)).join('')}</div>`;
  }
  function needsSection(st) {
    const rows = [];
    const proposals = st.data.proposals.length;
    if (proposals) rows.push(`<div class="pn-row link" data-act="suggestions">${CC.glyph('calendar-plus', 'accent')}<span class="pn-name">${proposals} suggestion${proposals === 1 ? '' : 's'} from your calendar</span>${icon('chevron-right', 'sm pn-chev')}</div>`);
    if (CC.pending()) rows.push(`<div class="pn-row link" data-act="review">${CC.glyph('tray', 'amber')}<span class="pn-name">${CC.pending()} to review</span><span class="faint truncate pn-sub">${esc(st.review.title)}</span>${icon('chevron-right', 'sm pn-chev')}</div>`);
    if (!rows.length) return `<div class="pn-title">Needs you</div><div class="pn-empty">${icon('check-circle', 'sm')}Nothing waiting on you</div>`;
    return `<div class="pn-title">Needs you</div><div class="pn-rows">${rows.join('')}</div>`;
  }
  const FOOT = `<div class="pn-sep"></div><div class="pn-menu">
    <div class="menu-item" data-act="open">Open Telu<span class="kbd">⌥Space</span></div>
    <div class="menu-item" data-act="settings">Settings…<span class="kbd">⌘,</span></div>
    <div class="menu-item" data-act="quit">Quit Telu<span class="kbd">⌘Q</span></div></div>`;
  const WELCOME = `<div class="pn-welcome"><div class="app-icon md"><img src="../kit/telu-icon.png" alt=""></div><div><b>Welcome to Telu</b><p>Connect your calendar and Telu prepares a brief before each recurring meeting — on this Mac.</p></div></div><div class="pn-pad"><button class="btn primary block" data-act="setup">Set up Telu</button></div>`;
  function render() {
    const st = CC.get();
    if (!st.onboarded) {
      pn.el.innerHTML = WELCOME + FOOT;
      return;
    }
    const live = ['live', 'filing'].includes(st.phase);
    const head = `<div class="pn-title">${live ? 'Now' : 'Up next'}</div>${live ? nowCard(st) : nextCard(st)}`;
    pn.el.innerHTML = `${head}${todaySection(st)}${needsSection(st)}${FOOT}`;
  }
  function place() {
    const r = statusItem().getBoundingClientRect();
    const w = pn.el.offsetWidth;
    pn.el.style.left = `${Math.max(8, Math.min(r.left - 6, innerWidth - w - 8))}px`;
  }
  function open() {
    clearTimeout(pn.timer);
    CC.island.collapse();
    pn.open = true;
    render();
    pn.el.hidden = false;
    pn.el.classList.remove('closing');
    place();
    statusItem().classList.add('active');
  }
  function close(instant) {
    if (!pn.open) return;
    pn.open = false;
    statusItem().classList.remove('active');
    if (instant) {
      pn.el.hidden = true;
      return;
    }
    pn.el.classList.add('closing');
    pn.timer = setTimeout(() => { pn.el.hidden = true; }, 120);
  }
  const toggle = () => (pn.open ? close() : open());
  const openIn = (fn) => {
    close(true);
    fn();
  };
  const ACTIONS = {
    meeting: (el) => openIn(() => CC.palette.openAt('meeting', el.dataset.id)),
    record: () => openIn(() => CC.startRecording()),
    pause: () => CC.togglePause(),
    stop: () => openIn(() => CC.stopRecording()),
    review: () => openIn(() => CC.palette.openAt('review')),
    suggestions: () => openIn(() => CC.palette.openAt('suggestions')),
    track: () => CC.track(),
    open: () => openIn(() => CC.palette.open()),
    setup: () => openIn(() => CC.onboarding.open()),
    settings: () => {
      close();
      CC.toast('Settings aren’t part of this sketch', { icon: 'sliders' });
    },
    quit: () => {
      close();
      CC.toast('Telu stays in your menu bar in this prototype', { icon: 'info' });
    }
  };
  function onClick(event) {
    const el = event.target.closest('[data-act]');
    if (el && ACTIONS[el.dataset.act]) ACTIONS[el.dataset.act](el);
  }
  function escape() {
    if (!pn.open) return false;
    close();
    return true;
  }
  function outside(target) {
    if (pn.open && !pn.el.contains(target) && !statusItem().contains(target)) close();
  }
  function mount() {
    pn.el = $('#mbPanel');
    statusItem().addEventListener('click', toggle);
    pn.el.addEventListener('click', onClick);
    CC.onSync(() => pn.open && render());
  }
  return { mount, open, close, toggle, escape, outside, isOpen: () => pn.open };
})();

CC.onboarding = (() => {
  const { $, esc } = Kit;
  const ob = { el: null, open: false, busy: false, step: 0, calendar: 'unknown', picks: [], manual: [] };
  const MOMENTS = [
    ['calendar-check', 'Before', 'A brief with what carried over and what’s worth asking'],
    ['record', 'During', 'Capture, plus at most one well-timed suggestion'],
    ['tray-down', 'After', 'Filed to the right series — reviewed in 30 seconds']
  ];
  const onCount = () => ob.picks.filter((on, i) => on && !DATA.detected[i].ignored).length;

  function welcomeStep() {
    const moments = MOMENTS.map(([ico, title, text]) => `<div class="ob-moment"><span class="ob-m-icon ${ico === 'record' ? 'coral' : ''}">${icon(ico)}</span><div><b>${title}</b><span>${text}</span></div></div>`).join('');
    return `<div class="app-icon ob-icon"><img src="../kit/telu-icon.png" alt=""></div>
      <h2 class="ob-title">Telu gets you ready for recurring meetings</h2>
      <p class="ob-text">It reads your calendar on this Mac, prepares a brief before each recurring meeting and files everything after. Nothing leaves your Mac.</p>
      <div class="ob-moments">${moments}</div>
      <div class="ob-privacy">${icon('lock')}Processed on this Mac · nothing is uploaded</div>`;
  }
  function deniedStep() {
    return `<div class="ob-badge">${icon('calendar')}<span class="ob-badge-lock">${icon('lock')}</span></div>
      <h2 class="ob-title">Calendar access is off</h2>
      <p class="ob-text">Telu can’t see your meetings yet, so it can’t prepare briefs on its own. You can turn access on anytime in System Settings › Privacy &amp; Security › Calendars.</p>
      <div class="ob-inline"><button class="btn" data-act="settings">${icon('sliders')}Open System Settings</button></div>
      <p class="ob-note">Until then, tell Telu about your recurring conversations by typing them — one line each.</p>`;
  }
  function detectedRow(d, i) {
    const s = d.series ? CC.seriesById(d.series) || Kit.series(d.series) : null;
    const lead = s ? Kit.seriesIcon(s) : `<span class="series-icon" style="--c:var(--series-gray)">${icon('repeat')}</span>`;
    const rule = s ? s.rule : d.rule;
    const note = d.ignored ? d.note : `${d.found} found${d.note ? ` · ${d.note}` : ''}`;
    const title = s ? s.name : d.title;
    return `<div class="ob-row${d.ignored ? ' ignored' : ''}">${lead}<div class="ob-row-main"><b class="truncate">${esc(title)}</b><span class="truncate">${esc(rule)} · ${esc(note)}</span></div><button class="switch" data-i="${i}" aria-checked="${Boolean(ob.picks[i]) && !d.ignored}" aria-label="Remember ${esc(title)}"${d.ignored ? ' disabled' : ''}></button></div>`;
  }
  function detectedStep() {
    return `<h2 class="ob-title">Which conversations should Telu remember?</h2>
      <p class="ob-text">Telu found ${DATA.detected.length} recurring events on your Work calendar. Each one you keep becomes a series with its own purpose, memory and briefs.</p>
      <div class="ob-list">${DATA.detected.map(detectedRow).join('')}</div>`;
  }
  function manualStep() {
    return `<h2 class="ob-title">Tell Telu about a recurring conversation</h2>
      <p class="ob-text">Type it the way you’d say it. Telu works out the rhythm and the people.</p>
      <div class="ob-input"><input class="field lg" id="obInput" maxlength="120" placeholder="Weekly 1:1 with Priya, Thu 11am" autocomplete="off" spellcheck="false"><button class="btn tinted" data-act="manual-add">Add</button></div>
      <div class="ob-parsed" id="obParsed"></div>
      <div class="ob-added" id="obAdded">${addedList()}</div>`;
  }
  function summonStep() {
    return `<div class="app-icon ob-icon" data-fly><img src="../kit/telu-icon.png" alt=""></div>
      <h2 class="ob-title">Summon Telu anytime</h2>
      <div class="ob-keys"><span class="keycap">⌥</span><span class="ob-plus">+</span><span class="keycap wide">Space</span></div>
      <p class="ob-text">Telu lives in your menu bar and comes to you before each meeting. Series, purpose docs and history are one keystroke away.</p>
      <div class="ob-bar"><span class="ob-bar-glyphs"><i></i><i></i><i></i></span><span class="ob-bar-telu"><img class="template-img" src="../kit/telu-menubar.png" alt="">Product Sync · 19m</span><span class="ob-bar-glyphs"><i></i><i></i></span><span class="ob-bar-clock num">9:41</span></div>`;
  }
  function stepBody(step) {
    if (step === 0) return ob.calendar === 'denied' ? deniedStep() : welcomeStep();
    if (step === 1) return ob.calendar === 'denied' ? manualStep() : detectedStep();
    return summonStep();
  }
  function actionsFor(step) {
    if (step === 0 && ob.calendar === 'denied') return '<button class="btn primary" data-act="next">Continue without calendar</button>';
    if (step === 0) return '<button class="btn plain" data-act="later">Not now</button><button class="btn primary" data-act="connect">Connect Calendar</button>';
    if (step === 1 && ob.calendar === 'denied') return `<button class="btn plain" data-act="back">Back</button><button class="btn primary" data-act="next">${ob.manual.length ? 'Continue' : 'Skip for now'}</button>`;
    if (step === 1) return `<button class="btn plain" data-act="back">Back</button><button class="btn primary" data-act="next" data-remember>Remember ${onCount()}</button>`;
    return '<button class="btn plain" data-act="back">Back</button><button class="btn primary" data-act="done">Done</button>';
  }
  function renderFoot() {
    $('#obActions').innerHTML = actionsFor(ob.step);
    [...$('#obDots').children].forEach((dot, i) => {
      dot.classList.toggle('on', i === ob.step);
      dot.classList.toggle('done', i < ob.step);
    });
  }
  function leave(old, dir) {
    old.classList.add('leaving');
    if (Kit.reduceMotion()) return old.remove();
    return old.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${-24 * dir}px)` }], { duration: 150, easing: Kit.EASE_OUT, fill: 'forwards' }).finished.then(() => old.remove());
  }
  function go(step, dir) {
    const box = $('#obSteps');
    const old = box.querySelector('.ob-step:not(.leaving)');
    const next = Kit.html(`<div class="ob-step" data-step="${step}">${stepBody(step)}</div>`);
    ob.step = step;
    box.appendChild(next);
    if (old) leave(old, dir);
    if (old && !Kit.reduceMotion()) next.animate([{ opacity: 0, transform: `translateX(${24 * dir}px)` }, { opacity: 1, transform: 'none' }], { duration: 220, easing: Kit.EASE_OUT, delay: 40, fill: 'backwards' });
    renderFoot();
    const input = $('#obInput', next);
    if (input) setTimeout(() => input.focus({ preventScroll: true }), 80);
  }

  async function askCalendar() {
    const answer = await Kit.alert({
      title: '“Telu” Would Like to Access Your Calendars',
      message: 'Telu reads events on this Mac to prepare briefs for your recurring meetings. Nothing is uploaded.',
      buttons: [{ label: 'Don’t Allow', value: 'deny' }, { label: 'Allow Full Access', value: 'allow', primary: true }]
    });
    if (!ob.open) return;
    ob.calendar = answer === 'allow' ? 'allowed' : 'denied';
    go(answer === 'allow' ? 1 : 0, answer === 'allow' ? 1 : 0);
  }
  function renderParsed() {
    const input = $('#obInput');
    const box = $('#obParsed');
    if (!input || !box) return;
    const p = Kit.parseSeries(input.value);
    box.innerHTML = input.value.trim() && p.title ? CC.views.parsedPreview(p) : '';
  }
  function addedList() {
    return ob.manual.map((p) => `<div class="ob-added-row">${icon('check', 'sm')}<b class="truncate">${esc(p.title)}</b><span class="faint truncate">${esc(p.cadence)}${p.day ? ` · ${esc(p.day)}` : ''}${p.time ? ` ${esc(p.time)}` : ''}</span></div>`).join('');
  }
  function addManual() {
    const input = $('#obInput');
    const p = input ? Kit.parseSeries(input.value) : null;
    if (!p || !p.title) return CC.toast('Try something like “Weekly 1:1 with Priya, Thu 11am”', { icon: 'info' });
    ob.manual = [...ob.manual, p];
    input.value = '';
    renderParsed();
    $('#obAdded').innerHTML = addedList();
    $('#obAdded').lastElementChild.classList.add('receive');
    renderFoot();
    return true;
  }
  async function finish() {
    if (ob.busy) return;
    ob.busy = true;
    const from = ob.el.querySelector('.ob-step:not(.leaving) [data-fly]');
    const { picks, manual } = ob;
    ob.open = false;
    const shrink = Kit.reduceMotion() ? null : ob.el.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(0.92)' }], { duration: 280, easing: Kit.EASE_OUT, fill: 'forwards' });
    await Kit.flyTo(from, $('#teluStatus'), { markup: '<div class="app-icon fly-icon"><img src="../kit/telu-icon.png" alt=""></div>', duration: 620 });
    ob.el.hidden = true;
    if (shrink) shrink.cancel();
    ob.busy = false;
    if (CC.get().scene !== 'first') return;
    CC.completeOnboarding({ picks, manual });
    CC.later(() => CC.island.setHidden(false), 160);
  }
  const ACTIONS = {
    later: () => close(),
    connect: () => askCalendar(),
    settings: () => CC.toast('Opens System Settings › Privacy & Security › Calendars', { icon: 'lock' }),
    next: () => go(ob.step + 1, 1),
    back: () => go(ob.step - 1, -1),
    done: () => finish(),
    'manual-add': () => addManual()
  };
  function onClick(event) {
    const el = event.target.closest('[data-act]');
    if (el && ACTIONS[el.dataset.act]) ACTIONS[el.dataset.act](el);
  }
  function onToggle(event) {
    const i = Number(event.target.dataset.i);
    if (Number.isNaN(i)) return;
    ob.picks = ob.picks.map((on, j) => (j === i ? event.detail.checked : on));
    const btn = $('[data-remember]', ob.el);
    if (btn) btn.textContent = `Remember ${onCount()}`;
  }
  function onKey(event) {
    if (event.target.id !== 'obInput') return;
    if (event.key === 'Enter') {
      event.preventDefault();
      addManual();
    }
  }
  function open() {
    if (ob.open) return;
    CC.panel.close(true);
    CC.palette.close();
    Object.assign(ob, { open: true, busy: false, step: 0, calendar: 'unknown', picks: DATA.detected.map((d) => d.on), manual: [] });
    ob.el.hidden = false;
    $('#obSteps').innerHTML = '';
    go(0, 0);
    CC.island.setHidden(true);
    if (!Kit.reduceMotion()) ob.el.animate([{ opacity: 0, transform: 'scale(0.96)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: Kit.EASE_OUT });
  }
  function close(instant) {
    if (!ob.open) return;
    ob.open = false;
    CC.island.setHidden(false);
    if (instant || Kit.reduceMotion()) {
      ob.el.hidden = true;
      return;
    }
    const anim = ob.el.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(0.97)' }], { duration: 160, easing: Kit.EASE_OUT, fill: 'forwards' });
    anim.finished.then(() => {
      if (!ob.open) ob.el.hidden = true;
      anim.cancel();
    });
  }
  function escape() {
    if (!ob.open || ob.busy) return false;
    close();
    return true;
  }
  function mount() {
    ob.el = $('#onboard');
    ob.el.addEventListener('click', onClick);
    ob.el.addEventListener('toggle', onToggle);
    ob.el.addEventListener('input', renderParsed);
    ob.el.addEventListener('keydown', onKey);
  }
  return { mount, open, close, escape, isOpen: () => ob.open };
})();
