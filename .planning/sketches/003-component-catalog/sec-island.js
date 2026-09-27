(() => {
  const e = Catalog.esc;
  const FILE_TYPE = 'application/x-telu-file';
  const SCRIPT = { lines: [1400, 3800], ask: 5800, summary: 900 };
  const inScenario = (scenario, fn) => Catalog.withScenario(scenario, fn);
  const SUBJECT = {
    next: inScenario('before', () => TeluBridge.next()),
    starting: inScenario('starting', () => TeluBridge.next()),
    live: inScenario('live', () => TeluBridge.live()),
    after: inScenario('after', () => TeluBridge.after())
  };
  const REVIEWED = { ...SUBJECT.after, pending: 0, meeting: { ...SUBJECT.after.meeting, candidates: SUBJECT.after.meeting.candidates.map((c) => ({ ...c, state: 'accepted' })) } };
  const EMPTY_ASK = { text: '', sources: [] };

  function makeBridge(scripted) {
    const st = { mode: 'before', liveAt: Date.now(), variant: {}, docs: [] };
    const withDocs = (hit) => (st.docs.length ? { ...hit, meeting: { ...hit.meeting, brief: { ...hit.meeting.brief, docs: [...hit.meeting.brief.docs, ...st.docs] } } } : hit);
    const withoutPurpose = (hit) => ({ ...hit, series: { ...hit.series, purpose: { ...hit.series.purpose, why: '' } } });
    const live = () => {
      const lv = SUBJECT.live;
      if (st.variant.listening) return { ...lv, transcript: [], suggestion: EMPTY_ASK };
      if (!scripted) return lv;
      const t = Date.now() - st.liveAt;
      return { ...lv, elapsed: Math.round(t / 1000), transcript: lv.transcript.slice(0, SCRIPT.lines.filter((at) => at <= t).length), suggestion: t >= SCRIPT.ask ? lv.suggestion : EMPTY_ASK };
    };
    const next = () => {
      if (st.variant.noNext) return null;
      const base = withDocs(st.mode === 'starting' ? SUBJECT.starting : SUBJECT.next);
      return st.variant.noPurpose ? withoutPurpose(base) : base;
    };
    return { st, next, live, after: () => (st.variant.reviewed ? REVIEWED : SUBJECT.after), evidence: (sid, src) => inScenario('before', () => TeluBridge.evidence(sid, src)) };
  }

  function cleanIsland(el, { keepGone = false } = {}) {
    const clone = el.cloneNode(true);
    ['id', 'data-bound', 'aria-hidden'].forEach((attr) => clone.removeAttribute(attr));
    clone.classList.remove('instant', 'bouncy');
    if (!keepGone) clone.classList.remove('gone');
    clone.style.removeProperty('--morph-delay');
    clone.querySelectorAll('.il.out').forEach((n) => n.remove());
    clone.querySelectorAll('.il').forEach((n) => { n.classList.remove('pre'); n.style.removeProperty('--in-delay'); });
    clone.querySelectorAll('.w.h').forEach((n) => n.classList.remove('h'));
    clone.querySelectorAll('.il-line.typing').forEach((n) => n.classList.remove('typing'));
    clone.querySelectorAll('.il-sugg.arrive, .bump').forEach((n) => n.classList.remove('arrive', 'bump'));
    return clone.outerHTML;
  }
  function cleanPopover(el) {
    const clone = el.cloneNode(true);
    ['left', 'top', '--origin'].forEach((prop) => clone.style.removeProperty(prop));
    clone.classList.remove('closing');
    clone.classList.add('open');
    return clone.outerHTML;
  }

  const shots = {};
  const slots = new Map();
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const escape = (target) => target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  function fileDrag(type, target, point, { own, files = [] } = {}) {
    const dt = new DataTransfer();
    if (own) dt.setData(FILE_TYPE, own);
    files.forEach((name) => dt.items.add(new File(['x'], name)));
    target.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt, clientX: point.x, clientY: point.y }));
  }

  async function capture() {
    const stage = document.body.appendChild(Kit.html('<div class="ci-scratch" aria-hidden="true"></div>'));
    const bridge = makeBridge(false);
    const el = () => stage.querySelector('#island');
    const own = () => {
      Island.mount(stage, bridge);
      return el();
    };
    const snap = (key, opts) => { shots[key] = cleanIsland(own(), opts); };
    const mode = (m) => {
      bridge.st.mode = m;
      own();
      Island.set(m);
    };
    const refresh = (variant) => {
      bridge.st.variant = variant;
      own();
      Island.refresh();
    };
    const center = () => {
      const r = el().getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    };
    const evidence = (key, selector) => {
      const chip = el().querySelector(selector);
      if (!chip) return;
      chip.click();
      const pop = stage.querySelector('.popover.il-pop');
      if (pop) shots[key] = cleanPopover(pop);
      escape(document);
    };
    const expanded = () => Boolean(el().querySelector('.il:not(.out) .il-card'));
    const hoverOpen = async (m) => {
      for (let i = 0; i < 3 && !expanded(); i += 1) {
        mode(m);
        own().dispatchEvent(new PointerEvent('pointerenter'));
        await wait(230);
      }
    };

    mode('setup');
    snap('setup');
    mode('before');
    snap('before');
    refresh({ noNext: true });
    snap('before-none');
    refresh({});
    own().click();
    snap('brief');
    evidence('evidence-speech', '.il-row .il-ev .source');
    escape(el());
    refresh({ noPurpose: true });
    own().click();
    snap('brief-nopurpose');
    escape(el());
    refresh({});
    fileDrag('dragover', document, { x: -1, y: -1 }, { own: 'Sprint 43 plan.pdf' });
    snap('hint');
    fileDrag('dragover', document, center(), { own: 'Sprint 43 plan.pdf' });
    snap('drop');
    fileDrag('drop', el(), center(), { files: ['Sprint 43 plan.pdf', 'Launch checklist.md'] });
    snap('attached-2');
    fileDrag('drop', el(), center(), { own: 'Q4 Roadmap.pdf' });
    snap('already');
    fileDrag('drop', el(), center(), { own: 'Sprint 43 plan.pdf' });
    snap('attached');
    fileDrag('drop', el(), center(), { own: 'Meeting notes' });
    snap('invalid');
    mode('starting');
    snap('starting');
    own().click();
    snap('starting-brief');
    escape(el());
    const skip = el().querySelector('.il:not(.out) [data-act="skip"]');
    if (skip) skip.click();
    snap('skipped');
    mode('live');
    snap('live');
    fileDrag('dragover', document, center(), { own: 'Sprint 43 plan.pdf' });
    snap('drop-live');
    fileDrag('drop', el(), center(), { own: 'Sprint 43 plan.pdf' });
    snap('attached-live');
    await wait(1350);
    mode('live');
    for (let i = 0; i < 4 && !el().querySelector('.il:not(.out) .il-mint-dot'); i += 1) {
      await wait(1300);
      mode('live');
    }
    snap('live-dot');
    own().click();
    snap('live-card');
    evidence('evidence-doc', '.il-sugg .il-ev .source[data-src^="Q4"]');
    refresh({ listening: true });
    snap('live-card-listening');
    refresh({});
    const pause = el().querySelector('.il:not(.out) [data-act="pause"]');
    if (pause) pause.click();
    snap('live-card-paused');
    escape(el());
    snap('live-paused');
    mode('filing');
    snap('filing');
    mode('after');
    snap('after');
    await hoverOpen('after');
    snap('after-card');
    escape(el());
    refresh({ reviewed: true });
    snap('after-reviewed');
    await hoverOpen('after');
    snap('after-card-reviewed');
    escape(el());
    refresh({});
    const file = stage.querySelector('#islandFile');
    if (file) {
      const clone = file.cloneNode(true);
      ['id', 'data-bound'].forEach((attr) => clone.removeAttribute(attr));
      clone.classList.remove('selected');
      shots.file = clone.outerHTML;
      clone.classList.add('selected');
      shots['file-selected'] = clone.outerHTML;
    }
    mode('hidden');
    snap('hidden', { keepGone: true });
    stage.remove();
  }

  let ready = null;
  const captured = () => {
    if (!ready) ready = wait(0).then(capture).catch(() => {});
    return ready;
  };
  function fill(canvas) {
    captured().then(() => canvas.querySelectorAll('[data-shot]').forEach((slot) => {
      slot.innerHTML = shots[slot.dataset.shot] || '<span class="faint">Not captured</span>';
      slot.querySelectorAll('[data-il-elapsed]').forEach((cell) => Kit.timer(cell, SUBJECT.live.elapsed));
    }));
  }
  const shot = (key, cls = 'cat-static') => `<div class="${cls} ci-slot" data-shot="${key}"></div>`;
  const tile = (label, note, key, extra = {}) => ({ label, note, html: shot(key, extra.cls), bg: 'wallpaper', span: 2, height: 150, mount: fill, ...extra });
  const replayBar = (label = 'Replay') => `<div class="ci-replay"><button class="btn sm">${icon('play')}${e(label)}</button></div>`;
  const withReplay = (fn) => (canvas) => {
    fill(canvas);
    canvas.querySelector('.ci-replay button').addEventListener('click', () => fn(canvas));
  };
  const restart = (el, cls) => {
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  };
  function replayTyping(canvas) {
    const words = [...canvas.querySelectorAll('.il-line:last-child .w')];
    if (Kit.reduceMotion()) return;
    words.forEach((w) => w.classList.add('h'));
    words.forEach((w, i) => setTimeout(() => w.classList.remove('h'), 260 + i * 80));
  }
  function replayDot(canvas) {
    const dot = canvas.querySelector('.il-mint-dot');
    if (dot) dot.replaceWith(dot.cloneNode(true));
  }
  function replayGone(canvas) {
    const island = canvas.querySelector('.island');
    island.classList.remove('gone');
    setTimeout(() => island.classList.add('gone'), 900);
  }

  const STATUS = {
    setup: '', hidden: '',
    before: '<span class="num">Product Sync · 19m</span>',
    starting: '<span>Product Sync · now</span>',
    live: '<span class="rec-dot"></span><span class="num">Recording <span data-rec-timer>0:00</span></span>',
    filing: '<span>Filing…</span>',
    after: '<span class="num">5 to review</span>'
  };
  const MODES = [['setup', 'Setup'], ['before', 'Before'], ['starting', 'Starting'], ['live', 'Live'], ['filing', 'Filing'], ['after', 'After'], ['hidden', 'Hidden']];
  const statusItem = '<span class="mb-item telu-status icon-only" role="button" aria-label="Telu"><img src="../kit/telu-menubar.png" class="template-img" alt=""><span class="ts-text"></span></span>';
  const playground = () => `<div class="desktop cat-desk panel-host ci-stage" style="height:440px">${Kit.menubar({ app: 'Telu', menus: ['File', 'Edit', 'View', 'Meeting', 'Window', 'Help'], extras: statusItem })}
      <div class="ci-modes"><div class="seg">${MODES.map(([id, label]) => `<button data-value="${id}" aria-selected="${id === 'before'}">${label}</button>`).join('')}</div><span class="ci-hint">Hover or click the Island · drag the PDF onto it</span></div>
      <div class="ci-toasts"></div>
    </div>`;

  function mountPlayground(canvas) {
    const stage = canvas.querySelector('.ci-stage');
    const bridge = makeBridge(true);
    const timers = [];
    const status = stage.querySelector('.telu-status');
    const toast = (text, iconName) => Kit.toast(e(text), { icon: iconName, container: stage.querySelector('.ci-toasts') });
    const paintStatus = (m) => {
      status.querySelector('.ts-text').innerHTML = STATUS[m];
      status.classList.toggle('icon-only', !STATUS[m]);
      status.querySelectorAll('[data-rec-timer]').forEach((el) => Kit.timer(el, 0));
    };
    let seg = null;
    const go = (m) => {
      timers.splice(0).forEach(clearTimeout);
      bridge.st.mode = m;
      if (m === 'live') bridge.st.liveAt = Date.now();
      Island.mount(stage, bridge);
      Island.set(m);
      paintStatus(m);
      if (seg) seg.set(m, { silent: true });
      if (m === 'live') [...SCRIPT.lines, SCRIPT.ask].forEach((at) => timers.push(setTimeout(() => { Island.mount(stage, bridge); Island.refresh(); }, at + 20)));
    };
    const HANDLERS = {
      'island:record': () => go('live'),
      'island:stop': () => { paintStatus('filing'); if (seg) seg.set('filing', { silent: true }); timers.push(setTimeout(() => go('after'), SCRIPT.summary)); },
      'island:skip': () => { bridge.st.mode = 'before'; Island.set('before'); paintStatus('before'); if (seg) seg.set('before', { silent: true }); },
      'island:review': () => toast('Opens Review in Telu · 5 items', 'tray'),
      'island:open': () => toast('Opens Product Sync at #37', 'doc'),
      'island:setup': () => toast('Opens the setup panel', 'sparkles'),
      'island:attach': ({ files }) => {
        bridge.st.docs = [...bridge.st.docs, ...files.map((f) => f.name)];
        toast(`Attached ${files.length === 1 ? files[0].name : `${files.length} files`} to Product Sync #37`, 'paperclip');
        Island.mount(stage, bridge);
        Island.refresh();
      },
      'island:feedback': ({ kind }) => toast(kind === 'useful' ? 'Thanks — Telu will surface more like this' : 'Dismissed — Telu will ask less like this', kind === 'useful' ? 'thumbs-up' : 'x')
    };
    Object.entries(HANDLERS).forEach(([name, fn]) => stage.addEventListener(name, (event) => fn(event.detail || {})));
    captured().then(() => {
      seg = Kit.segmented(stage.querySelector('.ci-modes .seg'), (m) => go(m));
      go('before');
    });
  }

  const CSS = `
    .ci-scratch { position: fixed; left: -4000px; top: 0; width: 1200px; height: 600px; visibility: hidden; pointer-events: none; contain: layout paint; }
    .ci-slot { display: grid; place-items: center; }
    .ci-hidden .island { position: relative; inset: auto; margin: 0; }
    .ci-file .il-file { position: relative; top: auto; right: auto; }
    .ci-modes { position: absolute; left: 14px; bottom: 14px; z-index: 5; display: flex; align-items: center; gap: 12px; padding: 5px 12px 5px 5px; border-radius: 999px; background: var(--glass-strong); box-shadow: var(--shadow-float); -webkit-backdrop-filter: blur(20px) saturate(1.6); backdrop-filter: blur(20px) saturate(1.6); white-space: nowrap; }
    .ci-hint { font-size: 11.5px; color: var(--label-2); }
    .ci-toasts { position: absolute; right: 0; bottom: 0; width: 460px; height: 100%; pointer-events: none; }
    .ci-replay { position: absolute; top: 10px; right: 10px; z-index: 5; }
    .ci-replay .btn .i { width: 11px; height: 11px; }
    .ci-sugg { width: 440px; padding: 14px 16px; border-radius: 22px; background: var(--glass-strong); box-shadow: var(--shadow-float), inset 0 0.5px 0 var(--glass-rim); -webkit-backdrop-filter: blur(30px) saturate(1.8); backdrop-filter: blur(30px) saturate(1.8); }
  `;

  const suggestionFrom = (canvas) => {
    captured().then(() => {
      const root = document.createElement('div');
      root.innerHTML = shots['live-card'] || '';
      const card = root.querySelector('.il-sugg');
      canvas.querySelector('.ci-sugg').innerHTML = card ? card.outerHTML : '';
    });
  };

  const MOTION = 'Shell morph: width, height and border-radius transition over var(--spring-dur) 490ms with var(--spring) (linear() spring, ≈0.3% overshoot), delayed by --morph-delay — 90ms when the next view is smaller (content leaves first), 0ms when it grows. The attached flash adds .bouncy: var(--spring-bounce) over var(--spring-bounce-dur) 600ms (≈3.8% overshoot). Radius: pill h/2 (18px), card 22px, drop target 20px. Content layers: every view is a new absolutely positioned layer (transform-origin 50% 0) that enters from .pre (opacity 0, blur 2px, scale 0.97) with opacity + filter 160ms var(--ease-out) and transform 240ms var(--ease-out), delayed by --in-delay (morph delay + 80ms; 0 on first paint); the old layer gets .out (opacity 0, blur 2px, 90ms ease-out) and is removed after 160ms. Same-view updates patch in place and refit the shell (no delay). Visibility: .gone → opacity 0 (220ms var(--ease-out)) + scale 0.95 (180ms var(--ease-out)); .instant suppresses the transition on the first paint after hiding. Pill press: scale 0.97. Hover intent: expands after 150ms over the shell (not over buttons), collapses 300ms after leaving unless pinned by a click; Esc or an outside click collapses. Reduced motion: kit limits transitions to opacity/colors (the shell jumps), typing and dot/arrive animations are off. framer-motion: <motion.div layout transition={{ type: "spring", duration: 0.49, bounce: 0.1 }} style={{ borderRadius }}> + <AnimatePresence mode="popLayout"> layers with initial {opacity:0, filter:"blur(2px)", scale:0.97}, animate {opacity:1, filter:"blur(0px)", scale:1, transition:{ delay }}, exit {opacity:0, filter:"blur(2px)", transition:{ duration: 0.09 }}; attached flash spring bounce ≈0.3, duration 0.6.';

  Catalog.section({
    id: 'island',
    eyebrow: 'Layer 5 · Ambient',
    title: 'Island',
    intro: 'The Island floats under the menu bar above every app and keeps working when the window is closed. It morphs between modes — setup, before, starting, live, filing, after, hidden — expands into cards on hover or click, and accepts files dropped on it. Static tiles below are captured from the real Island (island.js) at load; the playground runs it live.',
    css: CSS,
    components: [
      {
        id: 'island',
        name: 'Island',
        summary: 'The ambient shell: a glass capsule that morphs between modes and flashes, expands into cards (see the card components below) and never takes focus from what you are doing.',
        mapsTo: 'Separate transparent always-on-top Tauri window (macOS NSPanel, non-activating) + framer-motion layout animation; talks to the app over TeluBridge (next / live / after / evidence) and island:* events',
        usedIn: ['Desktop (always)', 'Menu bar status item', 'Window closed'],
        source: '002 island.js (Island.mount / set / refresh, VIEWS, morph, sync, flash) · island.css .island, .il, .il-pill, .il-card · app-bridge.js TeluBridge, T.islandForScenario, island:* handlers',
        props: [
          ['mode', 'setup | before | starting | live | filing | after | hidden', 'before'],
          ['bridge', '{ next(), live(), after(), evidence(sid, src) }', 'TeluBridge'],
          ['expanded', 'boolean (hover intent or click to pin)', 'false'],
          ['flash', 'attached | already | invalid | skipped (timed)', '—'],
          ['on*', 'island:record · skip · stop · review · open · attach · feedback · setup (CustomEvents on the desk)', '—']
        ],
        states: ['setup', 'before', 'before · nothing next', 'starting', 'skipped (flash)', 'live', 'live · found something (mint dot)', 'live · paused', 'filing', 'after', 'after · all reviewed', 'hidden', 'pressed', 'expanded (see cards)', 'drag hint / drop target (see IslandAttach)'],
        tokens: ['--glass-strong', '--glass-rim', '--shadow-float', '--spring', '--spring-dur', '--spring-bounce', '--spring-bounce-dur', '--ease-out', '--menubar-h', '--coral', '--mint', '--accent', '--amber'],
        motion: MOTION,
        a11y: 'role="region" aria-label="Telu", tabindex 0: Enter/Space activates (expand, or Review in after, or setup), Esc collapses. The mint dot has role="img" and an aria-label. Buttons inside cards are real buttons with ⌘R hints. As a non-activating panel it must not steal focus; expose live status (Recording, Filing…, N to review) through the menu bar item as well.',
        stories: [
          { label: 'Live playground', note: 'The real Island (island.js) on a desk with a fake bridge from DATA. Mode buttons morph it; hover or click expands; Record / Skip / Pause / Stop / Review work; drag the PDF onto it to attach; the transcript types and “found something” arrives at 5.8s in Live.', html: playground, span: 'full', flush: true, height: 440, bg: 'wallpaper', mount: mountPlayground },
          tile('Setup', 'First run, before onboarding: template icon + “Set up Telu” →', 'setup'),
          tile('Before', 'Next meeting: series dot, name, start, countdown', 'before'),
          tile('Before · nothing next', 'No more tracked meetings today', 'before-none'),
          tile('Starting', 'Coral dot, “Starting now · Record?”, Record + Skip', 'starting'),
          tile('Skipped', '1.7s flash after Skip, then back to Before', 'skipped'),
          tile('Live', 'Coral dot, series, ticking timer, wave', 'live'),
          { ...tile('Live · found something', 'The mint dot (the one mint moment) — fades in 300ms, then pulses every 1.8s. Replay re-inserts it.', 'live-dot'), html: `${shot('live-dot')}${replayBar()}`, mount: withReplay(replayDot) },
          tile('Live · paused', 'Dot dimmed, wave flat, timer frozen', 'live-paused'),
          tile('Filing', 'Spinner + “Filing to Product Sync…” (≈0.9s after Stop)', 'filing'),
          tile('After', 'Check + “Filed to Product Sync · 5 to review” (amber)', 'after'),
          tile('After · all reviewed', 'Muted tail once nothing is pending', 'after-reviewed'),
          { ...tile('Hidden', 'Faded out and scaled to 0.95 (onboarding). Replay shows it and hides it again.', 'hidden', { cls: 'ci-hidden' }), html: `${shot('hidden', 'ci-hidden')}${replayBar()}`, mount: withReplay(replayGone) },
          { label: 'Pill · pressed', note: ':active scale 0.97', html: shot('before'), bg: 'wallpaper', span: 2, height: 150, force: 'active', mount: (c) => { fill(c); captured().then(() => { const island = c.querySelector('.island'); if (island) island.classList.add('is-active'); }); } }
        ]
      },
      {
        id: 'island-brief-card',
        name: 'IslandBriefCard',
        summary: 'Before and Starting expand into the brief: series icon, name #n, start · place · countdown, attendees, the purpose (2 lines), Since last time (2 rows with sources), the Worth asking question on mint, then docs chip · Open brief · (Skip) · Record ⌘R.',
        mapsTo: 'Island card view (framer-motion layout child)',
        usedIn: ['Island (before, starting)'],
        source: '002 island.js briefCard / carryRow / askSection / briefFoot · island.css .il-card, .il-head, .il-why, .il-sec, .il-row, .il-ask, .il-foot, .il-docs',
        props: [['next', '{ series, meeting (brief), countdown }', '—'], ['starting', 'boolean — adds Skip', 'false'], ['docs', 'number of included docs', '—']],
        states: ['before', 'starting (Skip)', 'no purpose yet', 'docs count bump'],
        tokens: ['--glass-strong', '--mint-soft', '--mint-ink', '--label-2', '--fill-3'],
        motion: 'Trigger: hover intent (150ms) or click on the Before/Starting pill → Island morph to the card (spring 490ms, radius 22px) with the card layer fading in (see Island). Dropping a file while it is open patches the docs chip text and plays .bump (kit-bump keyframes 420ms var(--ease-out), scale 1.18 at 40%). Chip press scale 0.97 (140ms var(--ease-out)); hover fill-3 150ms ease (fine pointers). Source chips press scale 0.95. Reduced motion: bump off (kit), morph jumps. framer-motion: animate={{ scale: [1, 1.18, 1] }} times [0, 0.4, 1] duration 0.42 on count change.',
        a11y: 'Card is part of the Island region; source chips open the evidence popover (dialog); Record has aria-keyshortcuts="Meta+R".',
        stories: [
          tile('Before', 'Product Sync #37 · 10:00 · Google Meet · in 19m', 'brief', { height: 380 }),
          tile('Starting', 'Same card with Skip before Record', 'starting-brief', { height: 380 }),
          tile('No purpose yet', 'Fallback line invites writing one', 'brief-nopurpose', { height: 380 }),
          { ...tile('Docs chip bump', 'After a file lands in the brief the count bumps. Replay re-runs it.', 'brief', { height: 440 }), html: `${shot('brief')}${replayBar()}`, mount: withReplay((c) => restart(c.querySelector('.il-docs'), 'bump')) }
        ]
      },
      {
        id: 'island-live-card',
        name: 'IslandLiveCard',
        summary: 'Live expands into the recording card: dot, series #n, timer, wave; the last two transcript lines (typing in word by word); the suggestion slot; Pause / Stop ⌘R and “On this Mac”.',
        mapsTo: 'Island card view with a streaming list',
        usedIn: ['Island (live)'],
        source: '002 island.js liveCard / linesHtml / lineHtml / typeLines / patchLiveCard / togglePause · island.css .il-live-card, .il-lines, .il-line, .il-who, .w.h, .il-stop',
        props: [['live', '{ series, meeting, elapsed, transcript[{ who, text }], suggestion }', '—'], ['paused', 'boolean', 'false']],
        states: ['recording with suggestion', 'listening (no lines yet)', 'paused', 'typing'],
        tokens: ['--coral', '--label-2', '--mint-soft', '--mint'],
        motion: 'Typing: new lines render with every word hidden (.w.h, opacity 0); 260ms after the card mounts (120ms after new lines arrive) a 80ms interval reveals one word at a time, each fading in over 160ms var(--ease-out); the last typed count is remembered so older lines never re-type. Only the last two lines are shown. Pause: dot animation stops (opacity 0.45), wave bars freeze at scaleY(0.3), timer freezes; Resume continues from the frozen time. Stop hands off to Filing. Reduced motion: words appear at once. framer-motion: staggerChildren 0.08 over word spans with opacity 0→1 (0.16s).',
        a11y: 'Transcript lines in an aria-live="polite" list; Pause toggles aria-pressed; Stop has ⌘R.',
        stories: [
          { ...tile('Recording', 'Two lines and the Worth asking now card. Replay types the last line again (80ms per word).', 'live-card', { height: 380 }), html: `${shot('live-card')}${replayBar('Replay typing')}`, mount: withReplay(replayTyping) },
          tile('Listening', 'Nothing transcribed yet', 'live-card-listening', { height: 240 }),
          tile('Paused', 'Resume replaces Pause; dot and wave freeze', 'live-card-paused', { height: 380 })
        ]
      },
      {
        id: 'island-filed-card',
        name: 'IslandFiledCard',
        summary: 'After expands into the filed card: check, “Filed to Product Sync #37”, duration · ended · transcribed on this Mac, a 3-line summary, what Telu found as count chips, then Open meeting and “About 30 seconds · Review 5”.',
        mapsTo: 'Island card view',
        usedIn: ['Island (after)'],
        source: '002 island.js afterCard / countChips / afterFacts · island.css .il-filed-card, .il-summary, .il-counts, .il-count',
        props: [['after', '{ series, meeting (summary, candidates), pending }', '—']],
        states: ['to review', 'all reviewed'],
        tokens: ['--accent', '--fill', '--label-2'],
        motion: 'Trigger: hover intent only (150ms; a click on the After pill opens Review) → Island morph to the card (spring 490ms, radius 22px); leaves 300ms after the pointer exits. Count chips and summary are static. Reduced motion: shell jumps, card fades. framer-motion: same layout spring as Island.',
        a11y: 'Review button is primary and named with the count (“Review 5”).',
        stories: [
          tile('To review', '2 decisions · 2 commitments · 1 fact', 'after-card', { height: 330 }),
          tile('All reviewed', 'Review button replaced by “All reviewed”', 'after-card-reviewed', { height: 330 })
        ]
      },
      {
        id: 'island-attach',
        name: 'IslandAttach',
        summary: 'Files dragged anywhere turn the Island into a hint; over it, a drop target; on drop, a short confirmation. Files go into the brief before a meeting, or with the meeting while recording.',
        mapsTo: 'Island views driven by document drag events (Tauri: file drop on the panel window)',
        usedIn: ['Island (before, starting, live)'],
        source: '002 island.js hintPill / dropTarget / attachedPill / alreadyPill / invalidPill / accept / onDrop / attach · island.css .il-hint, .il-drop, .il-clip, .il-ok',
        props: [['target', '{ series, meeting, live }', '—'], ['files', 'File[] (names must look like documents)', '[]']],
        states: ['hint', 'drop target (brief)', 'drop target (live)', 'attached', 'attached · several', 'attached · live', 'already there', 'not a document'],
        tokens: ['--accent', '--accent-softer', '--label-2'],
        motion: 'Trigger: any file drag entering the page (dragenter/dragover) → Island morphs to the hint pill; pointer within ±10px of the Island → drop target (radius 20px, 380×104, kit .drop-target dashed outline at −7px); leaving/idle 1s → back to the mode. Drop → flash: attached uses .bouncy (width/height/radius over 600ms var(--spring-bounce), ≈3.8% overshoot) for 1.2s; already 1.4s; invalid 1.6s; then morphs back (490ms var(--spring)). Content layers cross-fade as in Island. Reduced motion: shell jumps, layers fade (opacity only). framer-motion: layout spring bounce ≈0.3 duration 0.6 for the attached flash; AnimatePresence for the label.',
        a11y: 'Needs a non-drag path (Attach… in the brief card / docs chip). Confirmation text should be announced (aria-live).',
        stories: [
          tile('Hint', 'A file is being dragged somewhere on screen', 'hint'),
          tile('Drop target · brief', 'Pointer over the Island', 'drop', { height: 190 }),
          tile('Drop target · live', '“Goes with this meeting”', 'drop-live', { height: 190 }),
          tile('Attached', 'Bouncy flash, 1.2s', 'attached'),
          tile('Attached · several', 'Count in the label', 'attached-2'),
          tile('Attached · live', '“with this meeting”', 'attached-live'),
          tile('Already there', 'Same name already in the brief', 'already'),
          tile('Not a document', 'Names without an extension are refused', 'invalid')
        ]
      },
      {
        id: 'island-suggestion-card',
        name: 'IslandSuggestionCard',
        summary: '“Worth asking now” during a recording: mint card with the question, its sources and Useful / Dismiss.',
        mapsTo: 'Card inside IslandLiveCard',
        usedIn: ['IslandLiveCard'],
        source: '002 island.js suggestionCard / patchSuggestion / feedback · island.css .il-sugg, .il-sugg.arrive, .il-sugg.leaving',
        props: [['suggestion', '{ text, sources[] }', '—'], ['onUseful / onDismiss', '() => void', '—']],
        states: ['arriving', 'shown', 'leaving'],
        tokens: ['--mint', '--mint-soft', '--mint-ink'],
        motion: 'Arrives with il-arrive: 320ms var(--ease-out), 140ms delay, from opacity 0, translateY(6px), scale(0.98) (keyframes, one-shot) — only when it appears in an already open card; the pill shows the mint dot instead. Useful / Dismiss add .leaving (opacity 0 + scale 0.98, 150ms transition) and the card is dropped after 150ms. Reduced motion: no arrive animation. framer-motion: initial {opacity:0, y:6, scale:0.98} with delay 0.14; exit {opacity:0, scale:0.98} 0.15s.',
        a11y: 'Announce arrival politely; Dismiss is icon-only with aria-label “Dismiss”.',
        stories: [
          { label: 'Arrive', note: 'In its live-card context. Replay re-runs the arrival.', html: `<div class="ci-sugg"></div>${replayBar()}`, bg: 'wallpaper', span: 2, height: 200, mount: (c) => { suggestionFrom(c); c.querySelector('.ci-replay button').addEventListener('click', () => restart(c.querySelector('.il-sugg'), 'arrive')); } },
          { label: 'Button hover', note: 'Useful and Dismiss are plain small buttons', html: '<div class="ci-sugg"></div>', bg: 'wallpaper', span: 2, height: 200, mount: (c) => { suggestionFrom(c); captured().then(() => c.querySelectorAll('.il-sugg .btn').forEach((b) => b.classList.add('is-hover'))); } }
        ]
      },
      {
        id: 'island-evidence',
        name: 'IslandEvidencePopover',
        summary: 'Source chips inside the Island open a popover pinned to the Island: spoken evidence (series #n · time, quote, speaker, Open meeting) or document evidence (FROM THE DOC · page, passage, file, On this Mac).',
        mapsTo: 'Radix Popover rendered inside the Island panel window (z-index above the Island)',
        usedIn: ['IslandBriefCard', 'IslandLiveCard', 'IslandSuggestionCard'],
        source: '002 island.js openEvidence / speechEvidence / docEvidence · island.css .popover.il-pop, .il-evd, .il-evd-quote',
        props: [['kind', 'speech | doc', '—'], ['series / meeting', 'resolved from the label', '—']],
        states: ['speech', 'document'],
        tokens: ['--glass-strong', '--accent-soft', '--shadow-float'],
        motion: 'Trigger: click a source chip in an expanded card (chip press scale 0.95). Opening pins the Island expanded; Kit.popover CSS transition from the chip — opacity 0→1 150ms + scale 0.96→1 190ms var(--ease-out), close 110ms; closing the popover never collapses the Island. Reduced motion: opacity only. framer-motion: Radix Popover inside the panel window with initial {opacity:0, scale:0.96}.',
        a11y: 'Dialog; Esc closes; Open meeting is a button.',
        stories: [
          tile('Speech', 'From a Since last time row', 'evidence-speech', { height: 200 }),
          tile('Document', 'From a live suggestion source', 'evidence-doc', { height: 200 })
        ]
      },
      {
        id: 'desktop-file-icon',
        name: 'DesktopFileIcon',
        summary: 'Prototype-only Finder file on the desktop (“Sprint 43 plan.pdf”) used to demo dragging onto the Island; double-click shows the hint.',
        mapsTo: 'Prototype affordance only (in production the user drags real Finder files)',
        usedIn: ['Island playground', '002 desktop'],
        source: '002 island.js FILE_HTML / mountFile · island.css .il-file, .il-file-badge, .il-file-name',
        props: [['name', 'string', 'Sprint 43 plan.pdf'], ['selected', 'boolean', 'false']],
        states: ['rest', 'selected'],
        tokens: ['--accent', '--fill-3', '--window-bg'],
        motion: 'Pointer-down selects (badge backdrop fill-3 background-color 120ms ease; name gets an accent capsule instantly); dragging it switches the Island to the hint; double-click flashes the hint. Native drag image. Reduced motion: unchanged. framer-motion: not needed (prototype-only).',
        a11y: 'Not needed in production.',
        stories: [
          tile('Rest', '', 'file', { cls: 'ci-file', span: 1, height: 160 }),
          tile('Selected', 'After pointer-down or while dragging', 'file-selected', { cls: 'ci-file', span: 1, height: 160 })
        ]
      }
    ]
  });
})();
