(() => {
  const { esc } = Catalog;
  const { scene, forceOn, replayBtn, onReplay, later } = window.CatCal;

  const MOMENTS = [
    ['calendar-check', 'Before', 'A brief with what carried over and what’s worth asking'],
    ['record', 'During', 'Capture, plus at most one well-timed suggestion'],
    ['tray-down', 'After', 'Filed to the right series — reviewed in 30 seconds']
  ];
  const ALERT = {
    title: '“Telu” Would Like to Access Your Calendars',
    message: 'Telu reads events on this Mac to prepare briefs for your recurring meetings. Nothing is uploaded.',
    buttons: [{ label: 'Don’t Allow', value: 'deny' }, { label: 'Allow Full Access', value: 'allow', primary: true }]
  };
  const FLY_MARKUP = '<div class="app-icon fly-icon"><img src="../kit/telu-icon.png" alt=""></div>';
  const PICKS = DATA.detected.map((d) => d.on);
  const onCount = (picks) => picks.filter((on, i) => on && !DATA.detected[i].ignored).length;

  const matchPerson = (name) => Object.keys(DATA.people).find((p) => p.toLowerCase() === name.toLowerCase() || p.toLowerCase().startsWith(`${name.toLowerCase()} `)) || name;
  const parsedChips = (p) => {
    const when = [p.day, p.time].filter(Boolean).join(' ');
    const parts = [p.cadence === 'One-off' ? 'No fixed rhythm' : p.cadence, when, p.people.length ? `with ${p.people.join(', ')}` : ''];
    return parts.filter(Boolean).map((t) => `<span class="chip">${esc(t)}</span>`).join('');
  };
  const parsedPreview = (p) => `<div class="pp">${icon('sparkles')}<b class="truncate">${esc(p.title)}</b>${parsedChips({ ...p, people: p.people.map(matchPerson) })}</div>`;
  const parsedFor = (text) => {
    const p = Kit.parseSeries(text);
    return text.trim() && p.title ? parsedPreview(p) : '';
  };

  const moment = ([ico, title, text]) => `<div class="ob-moment"><span class="ob-m-icon ${ico === 'record' ? 'coral' : ''}">${icon(ico)}</span><div><b>${title}</b><span>${text}</span></div></div>`;
  const welcomeStep = () => `<div class="app-icon ob-icon"><img src="../kit/telu-icon.png" alt=""></div>
      <h2 class="ob-title">Telu gets you ready for recurring meetings</h2>
      <p class="ob-text">It reads your calendar on this Mac, prepares a brief before each recurring meeting and files everything after. Nothing leaves your Mac.</p>
      <div class="ob-moments">${MOMENTS.map(moment).join('')}</div>
      <div class="ob-privacy">${icon('lock')}Processed on this Mac · nothing is uploaded</div>`;
  const deniedStep = () => `<div class="ob-badge">${icon('calendar')}<span class="ob-badge-lock">${icon('lock')}</span></div>
      <h2 class="ob-title">Calendar access is off</h2>
      <p class="ob-text">Telu can’t see your meetings yet, so it can’t prepare briefs on its own. You can turn access on anytime in System Settings › Privacy &amp; Security › Calendars.</p>
      <div class="ob-inline"><button class="btn" data-act="settings">${icon('sliders')}Open System Settings</button></div>
      <p class="ob-note">Until then, tell Telu about your recurring conversations by typing them — one line each.</p>`;
  const detectedRow = (d, i, picks = PICKS) => scene('first', () => {
    const s = d.series ? T.seriesById(d.series) || Kit.series(d.series) : null;
    const lead = s ? Kit.seriesIcon(s) : `<span class="series-icon" style="--c:var(--series-gray)">${icon('repeat')}</span>`;
    const rule = s ? s.rule : d.rule;
    const note = d.ignored ? d.note : `${d.found} found${d.note ? ` · ${d.note}` : ''}`;
    const title = s ? s.name : d.title;
    return `<div class="ob-row${d.ignored ? ' ignored' : ''}">${lead}<div class="ob-row-main"><b class="truncate">${esc(title)}</b><span class="truncate">${esc(rule)} · ${esc(note)}</span></div><button class="switch" data-i="${i}" aria-checked="${Boolean(picks[i]) && !d.ignored}" aria-label="Remember ${esc(title)}"${d.ignored ? ' disabled' : ''}></button></div>`;
  });
  const detectedStep = (picks) => `<h2 class="ob-title">Which conversations should Telu remember?</h2>
      <p class="ob-text">Telu found ${DATA.detected.length} recurring events on your Work calendar. Each one you keep becomes a series with its own purpose, memory and briefs.</p>
      <div class="ob-list">${DATA.detected.map((d, i) => detectedRow(d, i, picks)).join('')}</div>`;
  const addedList = (manual) => manual.map((p) => `<div class="ob-added-row">${icon('check', 'sm')}<b class="truncate">${esc(p.title)}</b><span class="faint truncate">${esc(p.cadence)}${p.day ? ` · ${esc(p.day)}` : ''}${p.time ? ` ${esc(p.time)}` : ''}</span></div>`).join('');
  const manualStep = (manual = [], text = '') => `<h2 class="ob-title">Tell Telu about a recurring conversation</h2>
      <p class="ob-text">Type it the way you’d say it. Telu works out the rhythm and the people.</p>
      <div class="ob-input"><input class="field lg${text ? ' is-focus' : ''}" maxlength="120" placeholder="Weekly 1:1 with Priya, Thu 11am" autocomplete="off" spellcheck="false" value="${esc(text)}"><button class="btn tinted" data-act="manual-add">Add</button></div>
      <div class="ob-parsed">${parsedFor(text)}</div>
      <div class="ob-added">${addedList(manual)}</div>`;
  const summonStep = () => `<div class="app-icon ob-icon" data-fly><img src="../kit/telu-icon.png" alt=""></div>
      <h2 class="ob-title">Summon Telu anytime</h2>
      <div class="ob-keys"><span class="keycap">⌥</span><span class="ob-plus">+</span><span class="keycap wide">Space</span></div>
      <p class="ob-text">Telu lives in your menu bar and comes to you before each meeting. Series, purpose docs and history are one keystroke away.</p>
      <div class="ob-bar"><span class="ob-bar-glyphs"><i></i><i></i><i></i></span><span class="ob-bar-telu"><img class="template-img" src="../kit/telu-menubar.png" alt="">Product Sync · 19m</span><span class="ob-bar-glyphs"><i></i><i></i></span><span class="ob-bar-clock num">9:41</span></div>`;
  const actionsFor = (step, calendar, picks = PICKS, manual = []) => {
    if (step === 0 && calendar === 'denied') return '<button class="btn primary" data-act="next">Continue without calendar</button>';
    if (step === 0) return '<button class="btn plain" data-act="later">Not now</button><button class="btn primary" data-act="connect">Connect Calendar</button>';
    if (step === 1 && calendar === 'denied') return `<button class="btn plain" data-act="back">Back</button><button class="btn primary" data-act="next">${manual.length ? 'Continue' : 'Skip for now'}</button>`;
    if (step === 1) return `<button class="btn plain" data-act="back">Back</button><button class="btn primary" data-act="next" data-remember>Remember ${onCount(picks)}</button>`;
    return '<button class="btn plain" data-act="back">Back</button><button class="btn primary" data-act="done">Done</button>';
  };
  const stepBody = (ob) => {
    if (ob.step === 0) return ob.calendar === 'denied' ? deniedStep() : welcomeStep();
    if (ob.step === 1) return ob.calendar === 'denied' ? manualStep(ob.manual) : detectedStep(ob.picks);
    return summonStep();
  };
  const dotsMarkup = (step) => `<div class="ob-dots">${[0, 1, 2].map((i) => { const cls = i === step ? 'on' : i < step ? 'done' : ''; return `<i${cls ? ` class="${cls}"` : ''}></i>`; }).join('')}</div>`;
  const panel = (step, body, actions) => `<section class="onboard" role="dialog" aria-label="Set up Telu"><div class="ob-steps"><div class="ob-step" data-step="${step}">${body}</div></div>`
    + `<footer class="ob-foot">${dotsMarkup(step)}<span class="spacer"></span><div class="ob-actions">${actions}</div></footer></section>`;
  const staticPanel = (ob, body = stepBody(ob)) => `<div class="cat-static">${panel(ob.step, body, actionsFor(ob.step, ob.calendar, ob.picks, ob.manual))}</div>`;
  const alertMarkup = () => `<div class="alert open" role="alertdialog"><div class="app-icon"><img src="../kit/telu-icon.png" alt=""></div><h3>${ALERT.title}</h3><p>${ALERT.message}</p>`
    + `<div class="alert-actions">${ALERT.buttons.map((b, i) => `<button class="btn ${b.primary ? 'primary' : ''}" data-i="${i}">${b.label}</button>`).join('')}</div></div>`;
  const glass = (inner, cls = '') => `<div class="ob-ctx${cls ? ` ${cls}` : ''}">${inner}</div>`;
  const statusItem = '<span class="mb-item telu-status icon-only" role="button" aria-label="Telu"><img src="../kit/telu-menubar.png" class="template-img" alt=""><span class="ts-text"></span></span>';
  const menubar = () => Kit.menubar({ app: 'Telu', menus: ['File', 'Edit', 'View', 'Meeting', 'Window', 'Help'], extras: statusItem });

  const wirePanel = (root, ob, onAct = {}) => {
    const renderFoot = () => {
      Kit.$('.ob-actions', root).innerHTML = actionsFor(ob.step, ob.calendar, ob.picks, ob.manual);
      [...Kit.$('.ob-dots', root).children].forEach((dot, i) => {
        dot.classList.toggle('on', i === ob.step);
        dot.classList.toggle('done', i < ob.step);
      });
    };
    const addManual = () => {
      const input = Kit.$('.ob-step:not(.leaving) .ob-input input', root);
      const p = input ? Kit.parseSeries(input.value) : null;
      if (!p || !p.title) return Kit.toast('Try something like “Weekly 1:1 with Priya, Thu 11am”', { icon: 'info', container: onAct.host || root.parentElement });
      ob.manual = [...ob.manual, p];
      input.value = '';
      Kit.$('.ob-step:not(.leaving) .ob-parsed', root).innerHTML = '';
      const added = Kit.$('.ob-step:not(.leaving) .ob-added', root);
      added.innerHTML = addedList(ob.manual);
      added.lastElementChild.classList.add('receive');
      renderFoot();
      return true;
    };
    root.addEventListener('toggle', (event) => {
      const i = Number(event.target.dataset.i);
      if (Number.isNaN(i)) return;
      ob.picks = ob.picks.map((on, j) => (j === i ? event.detail.checked : on));
      const btn = Kit.$('[data-remember]', root);
      if (btn) btn.textContent = `Remember ${onCount(ob.picks)}`;
    });
    root.addEventListener('input', (event) => {
      if (!event.target.closest('.ob-input')) return;
      event.target.classList.remove('is-focus');
      Kit.$('.ob-step:not(.leaving) .ob-parsed', root).innerHTML = parsedFor(event.target.value);
    });
    root.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' || !event.target.closest('.ob-input')) return;
      event.preventDefault();
      addManual();
    });
    root.addEventListener('click', (event) => {
      const el = event.target.closest('[data-act]');
      if (!el) return;
      if (el.dataset.act === 'manual-add') addManual();
      else if (el.dataset.act === 'settings') Kit.toast('Opens System Settings › Privacy & Security › Calendars', { icon: 'lock', container: onAct.host || root.parentElement });
      else if (onAct[el.dataset.act]) onAct[el.dataset.act](el);
    });
    return { renderFoot };
  };

  const makeFlow = (el, host, statusEl, initial = {}) => {
    const box = Kit.$('.ob-steps', el);
    const ob = { step: 0, calendar: 'unknown', picks: [...PICKS], manual: [], open: true, busy: false, ...initial };
    const holder = {};
    const leave = (old, dir) => {
      old.classList.add('leaving');
      if (Kit.reduceMotion()) return old.remove();
      return old.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${-24 * dir}px)` }], { duration: 150, easing: Kit.EASE_OUT, fill: 'forwards' }).finished.then(() => old.remove());
    };
    const go = (step, dir) => {
      const old = box.querySelector('.ob-step:not(.leaving)');
      ob.step = step;
      const next = Kit.html(`<div class="ob-step" data-step="${step}">${stepBody(ob)}</div>`);
      box.appendChild(next);
      if (old) leave(old, dir);
      if (old && !Kit.reduceMotion()) next.animate([{ opacity: 0, transform: `translateX(${24 * dir}px)` }, { opacity: 1, transform: 'none' }], { duration: 220, easing: Kit.EASE_OUT, delay: 40, fill: 'backwards' });
      holder.foot.renderFoot();
      const input = Kit.$('.ob-input input', next);
      if (input && ob.open) setTimeout(() => input.focus({ preventScroll: true }), 80);
    };
    const open = () => {
      Object.assign(ob, { step: 0, calendar: 'unknown', picks: [...PICKS], manual: [], open: true, busy: false });
      el.hidden = false;
      box.innerHTML = '';
      go(0, 0);
      if (!Kit.reduceMotion()) el.animate([{ opacity: 0, transform: 'scale(0.96)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: Kit.EASE_OUT });
    };
    const close = () => {
      if (!ob.open) return;
      ob.open = false;
      if (Kit.reduceMotion()) { el.hidden = true; return; }
      const anim = el.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(0.97)' }], { duration: 160, easing: Kit.EASE_OUT, fill: 'forwards' });
      anim.finished.then(() => { if (!ob.open) el.hidden = true; anim.cancel(); });
    };
    const finish = async () => {
      if (ob.busy || !statusEl) return;
      ob.busy = true;
      ob.open = false;
      const from = el.querySelector('.ob-step:not(.leaving) [data-fly]');
      const shrink = Kit.reduceMotion() ? null : el.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(0.92)' }], { duration: 280, easing: Kit.EASE_OUT, fill: 'forwards' });
      await Kit.flyTo(from, statusEl, { markup: FLY_MARKUP, duration: 620 });
      el.hidden = true;
      if (shrink) shrink.cancel();
      ob.busy = false;
    };
    const askCalendar = async () => {
      const answer = await Kit.alert({ ...ALERT, container: host });
      if (!ob.open) return;
      ob.calendar = answer === 'allow' ? 'allowed' : 'denied';
      go(answer === 'allow' ? 1 : 0, answer === 'allow' ? 1 : 0);
    };
    holder.foot = wirePanel(el, ob, {
      host,
      later: close,
      connect: askCalendar,
      next: () => go(ob.step + 1, 1),
      back: () => go(ob.step - 1, -1),
      done: finish
    });
    return { ob, go, open, close, finish };
  };
  const onboardingFlow = (canvas) => {
    const stage = Kit.$('.desktop', canvas);
    const flow = makeFlow(Kit.$('.onboard', stage), stage, Kit.$('.telu-status', stage));
    onReplay(canvas, flow.open);
    flow.open();
  };
  const slideDemo = (canvas, script) => {
    const el = Kit.$('.onboard', canvas);
    const flow = makeFlow(el, canvas, null, { open: false, calendar: 'allowed' });
    onReplay(canvas, async () => {
      Kit.$('.ob-steps', el).innerHTML = '';
      Object.assign(flow.ob, { calendar: 'allowed', manual: [] });
      flow.go(0, 0);
      for (const [wait, step, dir, calendar] of script) {
        await later(wait);
        if (calendar) flow.ob.calendar = calendar;
        flow.go(step, dir);
      }
    });
  };
  const wireStatic = (canvas, ob) => wirePanel(Kit.$('.onboard', canvas), { ...ob, picks: [...ob.picks], manual: [...ob.manual] }, { host: canvas });

  const OB = {
    welcome: { step: 0, calendar: 'unknown', picks: PICKS, manual: [] },
    detected: { step: 1, calendar: 'allowed', picks: PICKS, manual: [] },
    denied: { step: 0, calendar: 'denied', picks: PICKS, manual: [] },
    manual: { step: 1, calendar: 'denied', picks: PICKS, manual: [] },
    added: { step: 1, calendar: 'denied', picks: PICKS, manual: [Kit.parseSeries('Weekly 1:1 with Priya, Thu 11am')] },
    summon: { step: 2, calendar: 'allowed', picks: PICKS, manual: [] }
  };
  const panelStory = (label, note, ob, body, extra = {}) => ({ label, note, bg: 'wallpaper', span: 2, html: () => staticPanel(ob, body ? body() : undefined), mount: (canvas) => wireStatic(canvas, ob), ...extra });

  Catalog.section({
    id: 'onboarding',
    eyebrow: 'First run',
    title: 'Onboarding',
    intro: 'The first-run panel that floats over the desktop while the main window stays hidden: welcome, calendar permission, choosing which recurring conversations to remember (or typing them when access is denied), the ⌥ Space summon hint — and the app icon flying into the menu bar at the end.',
    css: `
      .ob-ctx { width: 420px; max-width: 100%; padding: 22px 28px; border-radius: 22px; background: var(--glass-strong); backdrop-filter: blur(34px) saturate(1.8); -webkit-backdrop-filter: blur(34px) saturate(1.8); box-shadow: var(--shadow-window); }
      .ob-ctx.foot { width: auto; padding: 0; }
      .ob-ctx > .ob-list { margin-top: 0; }
      .ob-overlay { position: absolute; left: 70px; top: 150px; z-index: 450; }
      .ob-center { position: absolute; inset: 26px 0 0; display: grid; place-items: center; }
    `,
    components: [
      {
        id: 'onboarding-panel',
        name: 'OnboardingPanel',
        summary: 'Glass panel (420 × 530) centred below the menu bar on first run. Three steps with a dot indicator and a footer of actions: Welcome → Connect Calendar (permission) → choose what to remember → Summon. If access is denied, step 1 becomes “type your recurring conversations” with a live natural-language parse.',
        mapsTo: 'Separate transparent always-on-top Tauri window (NSPanel) hosting a React stepper; framer-motion AnimatePresence for steps; Radix Switch rows; shadcn Input + Button; the permission prompt is the native EventKit dialog (Alert in Overlays shows the prototype version)',
        usedIn: ['First run (window hidden)', 'Welcome · Set up Telu', '⌥ Space before setup'],
        source: '002 app-onboard.js welcomeStep · deniedStep · detectedStep · manualStep · summonStep · actionsFor · go · leave · open · close · finish · .onboard',
        props: [['step', '0 | 1 | 2', '0'], ['calendar', 'unknown | allowed | denied', 'unknown'], ['picks', 'boolean[] per detected series', 'detected defaults'], ['manual', 'ParsedSeries[]', '[]'], ['onComplete', '({ picks, manual }) => void', '—'], ['onLater', '() => void', '—']],
        states: ['welcome', 'permission prompt', 'detected (switches)', 'denied', 'manual · empty', 'manual · typing', 'manual · added', 'summon', 'opening', 'closing', 'finishing (fly to menu bar)'],
        tokens: ['--glass-strong', '--shadow-window', '--accent', '--accent-soft', '--accent-strong', '--coral', '--coral-soft', '--amber', '--fill-2', '--fill-3', '--menubar', '--hairline', '--label-2', '--label-3'],
        motion: 'Open (first run or ⌥ Space before setup): opacity 0→1 + scale 0.96→1, 260ms --ease-out (WAAPI). Close (Not now / Esc): opacity 1→0 + scale 1→0.97, 160ms --ease-out, fill forwards, then hidden. Step change: both steps are stacked absolutely; the leaving step fades opacity 1→0 + translateX(0→−24px·dir) 150ms --ease-out (fill forwards, then removed); the entering step fades opacity 0→1 + translateX(+24px·dir→0) 220ms --ease-out with a 40ms delay (fill backwards). Denying access re-enters step 0 with dir 0 — no slide, just the 150ms fade-out over the 220ms fade-in. Dots: background-color 200ms ease (CSS). Switches: thumb translateX(14px) on --spring-bounce (600ms linear() spring, ~4% overshoot), track colour 200ms ease. Added row flashes .receive (accent-soft → transparent, 900ms --ease-out). Done: the panel shrinks opacity 1→0 + scale 1→0.92, 280ms --ease-out, while the app icon flies into the menu-bar item (FlyIcon, 620ms); the item then receives + bumps. All WAAPI except dots/switch/receive (CSS). Reduced motion: no scale or slide — steps swap instantly, the panel hides instantly, no fly (the item still receives). framer-motion: <AnimatePresence> panel initial={{opacity: 0, scale: 0.96}} animate={{opacity: 1, scale: 1, transition: {duration: 0.26, ease: [0.23, 1, 0.32, 1]}}} exit={{opacity: 0, scale: 0.97, transition: {duration: 0.16, ease: [0.23, 1, 0.32, 1]}}}; steps <AnimatePresence mode="popLayout" custom={dir}> variants enter {opacity: 0, x: 24 * dir} → center {opacity: 1, x: 0, transition: {duration: 0.22, delay: 0.04, ease: [0.23, 1, 0.32, 1]}} → exit {opacity: 0, x: -24 * dir, transition: {duration: 0.15, ease: [0.23, 1, 0.32, 1]}}; Radix Switch thumb transition={{type: "spring", duration: 0.6, bounce: 0.25}}.',
        a11y: 'role="dialog" aria-label="Set up Telu", focus moved into the panel on open and trapped; Esc = Not now; steps announced via aria-live on the title; dots are decorative (expose “Step 2 of 3”); switches are role="switch" with aria-label “Remember <series>” (the ignored row is disabled); the manual input focuses on entry and Enter adds.',
        stories: [
          panelStory('Welcome', 'Step 1 · Not now · Connect Calendar', OB.welcome),
          {
            label: 'Calendar permission', note: 'Connect Calendar asks macOS for access', bg: 'wallpaper', span: 2,
            html: () => `<div class="cat-static cal-stack">${panel(0, welcomeStep(), actionsFor(0, 'unknown'))}<div class="ob-overlay">${alertMarkup()}</div></div>`
          },
          panelStory('Detected', 'Step 2 · switches on/off, Lunch ignored · Remember N updates live', OB.detected),
          panelStory('Denied', '“Calendar access is off” · Continue without calendar', OB.denied),
          panelStory('Manual · empty', 'Step 2 without a calendar · Skip for now', OB.manual),
          panelStory('Manual · typing', 'Live parse preview under the field · type to try it', OB.manual, () => manualStep([], 'Weekly 1:1 with Priya, Thu 11am')),
          panelStory('Manual · added', 'Added list · Continue · press ↩ to add another', OB.added, () => manualStep(OB.added.manual, 'Monthly board prep with Priya and Maria')),
          panelStory('Summon', 'Step 3 · ⌥ + Space · mini menu bar · Done', OB.summon),
          { label: 'Step slide', note: 'Replay: 1 → 2 → 3 → 2 → 1 (leave 150ms, enter 220ms after 40ms, ±24px)', bg: 'wallpaper', span: 2, html: () => staticPanel(OB.welcome) + replayBtn(), mount: (canvas) => slideDemo(canvas, [[900, 1, 1], [1300, 2, 1], [1300, 1, -1], [1300, 0, -1]]) },
          { label: 'Denied · crossfade in place', note: 'Replay: Don’t Allow re-enters step 1 with dir 0 — fade only', bg: 'wallpaper', span: 2, html: () => staticPanel(OB.welcome) + replayBtn(), mount: (canvas) => slideDemo(canvas, [[900, 0, 0, 'denied']]) },
          {
            label: 'Live · the whole first run', note: 'Click through (Allow or Don’t Allow) · Done flies the icon into the menu bar · Replay reopens', span: 'full', flush: true,
            html: () => `<div class="desktop cat-desk" style="height: 690px;">${menubar()}${panel(0, '', '')}</div>${replayBtn('Replay open')}`,
            mount: onboardingFlow
          }
        ]
      },
      {
        id: 'step-dots',
        name: 'StepDots',
        summary: 'Three 6px dots in the panel footer: the current step in accent, completed steps at 45% accent, the rest neutral.',
        mapsTo: 'Plain component (3 spans) — or a Radix-free progress indicator',
        usedIn: ['OnboardingPanel footer'],
        source: '002 app-onboard.js renderFoot · .ob-dots',
        props: [['step', '0 | 1 | 2', '0'], ['count', 'number', '3']],
        states: ['step 1', 'step 2 (1 done)', 'step 3 (2 done)'],
        tokens: ['--accent', '--fill-3'],
        motion: 'Trigger: step change → each dot’s background-color transitions 200ms ease (CSS transition on .on / .done). Reduced motion: same (colour transitions allowed). framer-motion: animate={{backgroundColor}} transition={{duration: 0.2, ease: "easeOut"}} — or plain CSS.',
        a11y: 'aria-hidden; pair with visually hidden “Step 2 of 3”.',
        stories: [
          ...[0, 1, 2].map((step) => ({ label: `Step ${step + 1}`, note: step ? `${step} done` : 'First step', bg: 'wallpaper', html: glass(`<footer class="ob-foot">${dotsMarkup(step)}</footer>`, 'foot') })),
          {
            label: 'Advance', note: 'Replay steps 1 → 2 → 3 (200ms colour transition)', bg: 'wallpaper',
            html: glass(`<footer class="ob-foot">${dotsMarkup(0)}</footer>`, 'foot') + replayBtn(),
            mount: (canvas) => onReplay(canvas, async () => {
              const dots = [...Kit.$('.ob-dots', canvas).children];
              for (const step of [0, 1, 2]) {
                dots.forEach((dot, i) => { dot.classList.toggle('on', i === step); dot.classList.toggle('done', i < step); });
                await later(600);
              }
            })
          }
        ]
      },
      {
        id: 'onboarding-moment',
        name: 'OnboardingMoment',
        summary: 'One row of the welcome step’s “before · during · after” promise: a tinted 32px icon tile and a two-line label. The During tile is coral (recording).',
        mapsTo: 'Plain component (icon tile + title + text) · lucide CalendarCheck, Circle, ArrowDownToLine',
        usedIn: ['OnboardingPanel · Welcome'],
        source: '002 app-onboard.js MOMENTS · welcomeStep · .ob-moment',
        props: [['icon', 'calendar-check | record | tray-down', '—'], ['tone', 'accent | coral', 'accent'], ['title', 'string', '—'], ['text', 'string', '—']],
        states: ['accent', 'coral'],
        tokens: ['--accent-soft', '--accent-strong', '--coral-soft', '--coral', '--label-2'],
        motion: 'None (arrives with the step slide). Reduced motion → n/a · framer-motion → none.',
        a11y: 'List of three items (ul/li); icons decorative.',
        stories: [
          { label: 'Before · during · after', note: 'As on the welcome step', bg: 'wallpaper', span: 2, html: glass(`<div class="ob-moments">${MOMENTS.map(moment).join('')}</div>`) },
          ...MOMENTS.map((m) => ({ label: m[1], note: m[0] === 'record' ? 'Coral tile' : 'Accent tile', bg: 'wallpaper', span: 2, html: glass(moment(m)) }))
        ]
      },
      {
        id: 'detected-row',
        name: 'DetectedRow',
        summary: 'One recurring event Telu found in the calendar: the series icon (or a grey repeat icon if it isn’t a series yet), name, rule and how many were found, with a switch to remember it. Personal-calendar events show as ignored with a disabled switch.',
        mapsTo: 'Row with Radix Switch (shadcn Switch) · series icon',
        usedIn: ['OnboardingPanel · Detected'],
        source: '002 app-onboard.js detectedRow · onToggle · .ob-row',
        props: [['detected', '{ series? | title + rule, found, note?, ignored? }', '—'], ['checked', 'boolean', 'detected.on'], ['onCheckedChange', '(on) => void', '—']],
        states: ['on', 'off', 'ignored (disabled)', 'truncated'],
        tokens: ['--accent', '--fill-3', '--series-gray', '--label-2'],
        motion: 'Switch: thumb translateX(0↔14px) on --spring-bounce (600ms linear() spring with ~4% overshoot), track background 200ms ease (CSS transitions, interruptible). The footer’s “Remember N” updates instantly. Reduced motion: thumb moves without the spring (transform transition removed), colour still fades. framer-motion: Radix Switch thumb as motion.span layout transition={{type: "spring", duration: 0.6, bounce: 0.25}}.',
        a11y: 'role="switch" aria-checked with aria-label “Remember Product Sync”; the ignored row’s switch is disabled and its note explains why (“Personal calendar · ignored”).',
        stories: [
          { label: 'On', note: 'Tracked series · click to toggle', bg: 'wallpaper', span: 2, html: () => glass(`<div class="ob-list">${detectedRow(DATA.detected[0], 0)}</div>`) },
          { label: 'Off', note: 'Not a series yet · grey repeat icon · note truncates', bg: 'wallpaper', span: 2, html: () => glass(`<div class="ob-list">${detectedRow(DATA.detected[5], 5)}</div>`) },
          { label: 'Ignored', note: 'Personal calendar · disabled switch', bg: 'wallpaper', span: 2, html: () => glass(`<div class="ob-list">${detectedRow(DATA.detected[6], 6)}</div>`) },
          { label: 'List', note: 'All seven, as in the panel', bg: 'wallpaper', span: 2, html: () => glass(`<div class="ob-list">${DATA.detected.map((d, i) => detectedRow(d, i)).join('')}</div>`) }
        ]
      },
      {
        id: 'fly-icon',
        name: 'FlyIcon',
        summary: 'At the end of onboarding the app icon lifts off the Summon step and flies into the Telu item in the menu bar, which then flashes and bumps — “this is where Telu lives now”.',
        mapsTo: 'In production the panel is its own window: animate the panel window out and bump the tray item (Tauri tray title change); a transparent overlay window can carry the ghost if the flight is kept',
        usedIn: ['OnboardingPanel · Done'],
        source: '002 app-onboard.js finish · kit Kit.flyTo · .fly-icon · .menubar .telu-status',
        props: [['from', 'the Summon step icon', '—'], ['to', 'menu-bar status item', '—'], ['duration', 'ms', '620']],
        states: ['resting (in the panel)', 'in flight', 'landed (item receives + bumps)'],
        tokens: ['--glass-strong', '--shadow-float', '--accent-soft', '--menubar'],
        motion: 'Trigger: Done. Ghost = the 60px app icon on glass (radius 10px, --shadow-float), fixed-position. X: translateX(0→dx) 620ms cubic-bezier(0.45, 0, 0.2, 1); Y + scale + opacity on an inner layer: translateY(0→dy) scale(1→0.4 — clamped from the 22px item ÷ 60px icon) opacity 1→0.35, 620ms cubic-bezier(0.6, 0, 0.9, 0.7) — the two easings trace an arc up and right (WAAPI, fill forwards; ghost removed on finish). Concurrently the panel fades out opacity 1→0 + scale 1→0.92, 280ms --ease-out. On landing the status item gets .receive (background accent-soft → transparent, 900ms --ease-out) and its template image .bump (scale 1→1.18→1, 420ms --ease-out). Reduced motion: no ghost — the item receives (bump suppressed). framer-motion: portal motion.div animate={{x: dx}} transition={{duration: 0.62, ease: [0.45, 0, 0.2, 1]}} > motion.div animate={{y: dy, scale: 0.4, opacity: 0.35}} transition={{duration: 0.62, ease: [0.6, 0, 0.9, 0.7]}}.',
        a11y: 'Decorative (aria-hidden); announce “Telu is in your menu bar — press Option Space anytime” when onboarding completes.',
        stories: [
          { label: 'Ghost', note: 'What flies (app icon on glass)', bg: 'wallpaper', html: `<div class="cal-ghost">${FLY_MARKUP}</div>` },
          { label: 'Target', note: 'Menu-bar status item (icon only before setup)', bg: 'wallpaper', span: 3, flush: true, height: 112, html: () => `<div class="desktop cat-desk" style="height: 112px;">${menubar()}</div>` },
          {
            label: 'Live · fly into the menu bar', note: 'Replay: the Summon icon flies to the Telu item (620ms), which receives and bumps', bg: 'wallpaper', span: 'full', flush: true,
            html: () => `<div class="desktop cat-desk" style="height: 300px;">${menubar()}<div class="ob-center"><div class="app-icon ob-icon" data-fly><img src="../kit/telu-icon.png" alt=""></div></div></div>${replayBtn()}`,
            mount: (canvas) => onReplay(canvas, () => Kit.flyTo(Kit.$('[data-fly]', canvas), Kit.$('.telu-status', canvas), { markup: FLY_MARKUP, duration: 620 }))
          }
        ]
      }
    ]
  });
})();
