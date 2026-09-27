(() => {
  const T = window.T;
  const { $, esc } = Kit;
  const ob = { el: null, open: false, busy: false, step: 0, calendar: 'unknown', picks: [], manual: [] };
  const MOMENTS = [
    ['calendar-check', 'Before', 'A brief with what carried over and what’s worth asking'],
    ['record', 'During', 'Capture, plus at most one well-timed suggestion'],
    ['tray-down', 'After', 'Filed to the right series — reviewed in 30 seconds']
  ];
  const onCount = () => ob.picks.filter((on, i) => on && !DATA.detected[i].ignored).length;

  const matchPerson = (name) => Object.keys(DATA.people).find((p) => p.toLowerCase() === name.toLowerCase() || p.toLowerCase().startsWith(`${name.toLowerCase()} `)) || name;
  const parsedChips = (p) => {
    const when = [p.day, p.time].filter(Boolean).join(' ');
    const parts = [p.cadence === 'One-off' ? 'No fixed rhythm' : p.cadence, when, p.people.length ? `with ${p.people.join(', ')}` : ''];
    return parts.filter(Boolean).map((t) => `<span class="chip">${esc(t)}</span>`).join('');
  };
  const parsedPreview = (p) => `<div class="pp">${icon('sparkles')}<b class="truncate">${esc(p.title)}</b>${parsedChips({ ...p, people: p.people.map(matchPerson) })}</div>`;

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
    const s = d.series ? T.seriesById(d.series) || Kit.series(d.series) : null;
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
  function addedList() {
    return ob.manual.map((p) => `<div class="ob-added-row">${icon('check', 'sm')}<b class="truncate">${esc(p.title)}</b><span class="faint truncate">${esc(p.cadence)}${p.day ? ` · ${esc(p.day)}` : ''}${p.time ? ` ${esc(p.time)}` : ''}</span></div>`).join('');
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
    box.innerHTML = input.value.trim() && p.title ? parsedPreview(p) : '';
  }
  function addManual() {
    const input = $('#obInput');
    const p = input ? Kit.parseSeries(input.value) : null;
    if (!p || !p.title) return T.toast('Try something like “Weekly 1:1 with Priya, Thu 11am”', { icon: 'info' });
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
    if (T.state.scenario !== 'first') return;
    T.completeOnboarding({ picks, manual });
    T.later(() => T.islandForScenario(), 160);
  }
  const ACTIONS = {
    later: () => close(),
    connect: () => askCalendar(),
    settings: () => T.toast('Opens System Settings › Privacy & Security › Calendars', { icon: 'lock' }),
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
    if (ob.open || T.state.onboarded) return;
    Object.assign(ob, { open: true, busy: false, step: 0, calendar: 'unknown', picks: DATA.detected.map((d) => d.on), manual: [] });
    ob.el.hidden = false;
    $('#obSteps').innerHTML = '';
    go(0, 0);
    T.island('set', 'hidden');
    if (!Kit.reduceMotion()) ob.el.animate([{ opacity: 0, transform: 'scale(0.96)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: Kit.EASE_OUT });
  }
  function close(instant) {
    if (!ob.open) return;
    ob.open = false;
    T.island('set', 'setup');
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
  T.onboarding = { mount, open, close, escape, isOpen: () => ob.open || ob.busy };

  const blankPurpose = (note) => ({ version: 1, edited: 'just now', by: 'You', why: '', outcomes: [], agenda: [], notFor: '', history: [{ v: 1, date: 'Today', note }] });
  const cadenceRule = ({ cadence, day, time }) => {
    const when = [day, time].filter(Boolean).join(' · ');
    if (cadence === 'Every 2 weeks') return `Every other ${when}`;
    if (cadence === 'Monthly') return `Monthly${when ? ` · ${when}` : ''}`;
    if (cadence === 'Daily') return `Every day${time ? ` · ${time}` : ''}`;
    if (cadence === 'Weekly') return day ? `Every ${when}` : `Weekly${time ? ` · ${time}` : ''}`;
    return 'Grouped by you · no fixed time';
  };
  const manualSeries = (p, seq) => {
    const base = T.applyParsed(T.draftSeries(seq), { ...p, people: p.people.map(matchPerson) });
    return {
      ...base, draft: false, source: 'manual', since: 'Sep 2026', rule: base.rule || cadenceRule(p),
      cadence: p.cadence === 'One-off' ? 'Manual' : base.cadence, purpose: blankPurpose('Created during setup')
    };
  };
  const detectedIds = (picks, on) => DATA.detected.filter((d, i) => d.series && Boolean(picks[i]) === on).map((d) => d.series);
  T.completeOnboarding = ({ picks, manual }) => {
    const base = T.scenarioState('before');
    const kept = detectedIds(picks, true);
    const dropped = detectedIds(picks, false);
    const draft = (s) => (kept.includes(s.id) ? { ...s, purpose: T.draftedPurpose(s.purpose) } : s);
    const series = base.series.map((s) => (dropped.includes(s.id) ? { ...s, tracked: false } : draft(s)));
    const proposals = base.proposals.filter((p) => p.kind !== 'join' || !dropped.includes(p.target));
    T.state = { ...base, series, proposals, selection: null, peekOpen: false };
    if (picks[DATA.detected.findIndex((d) => d.title === 'Daily Standup')]) T.addStandupSeries();
    manual.forEach((p) => T.set({ series: [...T.state.series, manualSeries(p, T.nextSeq())] }));
    const next = T.nextUpId();
    T.set({ selection: next ? { kind: 'event', id: next } : null, peekOpen: !!next });
    if (T.ui.scenarios) T.ui.scenarios.set('before', false);
    T.renderAll();
  };

  T.summon = () => {
    if (T.onboarding.isOpen()) return;
    if (!T.state.onboarded) {
      T.onboarding.open();
      return;
    }
    T.showWindow();
    T.el.win.focus({ preventScroll: true });
  };

  T.actions.setup = () => T.onboarding.open();
})();
