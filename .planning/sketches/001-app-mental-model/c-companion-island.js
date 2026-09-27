CC.island = (() => {
  const { $, esc } = Kit;
  const HOVER_IN = 150;
  const HOVER_OUT = 300;
  const PILL_H = 36;
  const TYPE_MS = 80;
  const FILE_NAME = 'Sprint 43 plan.pdf';
  const EXPANDABLE = { next: 'next-card', starting: 'next-card', live: 'live-card', filed: 'filed-card' };
  const PHASE_MODE = { upcoming: 'next', skipped: 'next', done: 'next', starting: 'starting', live: 'live', filing: 'filing', filed: 'filed' };
  const PLURAL = { decision: ['decision', 'decisions'], commitment: ['commitment', 'commitments'], question: ['open question', 'open questions'], fact: ['fact', 'facts'] };
  const MINT_DOT = '<span class="il-mint-dot" role="img" aria-label="Telu found something worth asking"></span>';
  const ui = { el: null, variant: null, key: null, sig: null, w: 0, h: 0, expanded: false, pinned: false, suppress: false, drag: null, transient: null, hidden: false, typing: null, timers: {} };

  const pill = (inner, cls = '') => `<div class="il-pill ${cls}">${inner}</div>`;
  const wave = (paused) => `<span class="wave il-wave${paused ? ' paused' : ''}"><i></i><i></i><i></i><i></i><i></i></span>`;
  const okMark = `<span class="il-ok">${icon('check')}</span>`;
  const focus = () => CC.focusMeeting();
  const focusKey = () => {
    const f = focus();
    return f ? f.meeting.id : 'none';
  };
  const focusName = () => {
    const f = focus();
    return f ? esc(f.series.name) : 'Telu';
  };
  const clear = (...names) => names.forEach((name) => clearTimeout(ui.timers[name]));

  function setupPill() {
    return pill(`<img class="template-img il-mark" src="../kit/telu-menubar.png" alt=""><b>Set up Telu</b><span class="faint il-chev">${icon('chevron-right')}</span>`, 'il-setup');
  }
  function nextPill() {
    const f = focus();
    if (!f) return pill(`${icon('calendar-check')}<span class="muted">Nothing else on your calendar today</span>`);
    const { series: s, meeting: m } = f;
    return pill(`<span class="series-dot" style="--c:${s.color}"></span><b class="il-name truncate">${esc(s.name)}</b><span class="faint num">${CC.startOf(m)}</span><span class="spacer"></span><span class="num il-until">${CC.untilLabel(m)}</span>`, 'il-next');
  }
  function carryRow(c, s) {
    const meta = [c.owner, c.note].filter(Boolean).map(esc).join(' · ');
    return `<div class="ic-row">${CC.kIcon(c.type)}<div class="ic-main"><div class="ic-text">${esc(c.text)}</div><div class="ic-meta"><span class="truncate">${meta}</span>${CC.src(c.src, { type: c.type, text: c.text, owner: c.owner, seriesId: s.id })}</div></div></div>`;
  }
  function askRow(a, s) {
    return `<div class="ic-text ic-ask-text">${esc(a.text)} ${CC.src(a.src, { type: 'question', text: a.text, seriesId: s.id })}</div>`;
  }
  const docCount = (m) => m.brief.docs.filter((d) => d.include).length;
  const docLabel = (m) => `${docCount(m)} doc${docCount(m) === 1 ? '' : 's'}`;
  function briefCard() {
    const f = focus();
    if (!f || !f.meeting.brief) return nextPill();
    const { series: s, meeting: m } = f;
    const b = m.brief;
    const why = s.purpose.why || 'No purpose yet — press ⌘E in Telu to write one.';
    const record = CC.canRecord() && m.id === 'ps-37' ? `<button class="btn sm record" data-act="record">${icon('record')}Record<span class="kbd">⌥⌘R</span></button>` : '';
    return `<div class="il-card il-brief">
      <div class="ic-head">${Kit.seriesIcon(s)}<div class="ic-title"><b class="truncate">${esc(s.name)} <span class="faint">#${m.n}</span></b><span class="muted num truncate">${CC.startOf(m)} · ${esc(m.where || '')} · ${CC.untilLabel(m)}</span></div>${Kit.avatars(s.people, 4)}</div>
      <p class="ic-why">${esc(why)}</p>
      <div class="ic-sec"><div class="t-eyebrow">Since last time</div>${b.carry.slice(0, 2).map((c) => carryRow(c, s)).join('')}</div>
      ${b.ask.length ? `<div class="ic-sec ic-ask"><div class="t-eyebrow ic-mint">${icon('sparkle')}Worth asking</div>${askRow(b.ask[0], s)}</div>` : ''}
      <div class="ic-foot"><button class="chip ic-docs" data-act="docs">${icon('paperclip')}<span data-docs>${docLabel(m)}</span></button><span class="spacer"></span><button class="btn sm" data-act="open-brief">Open brief</button>${record}</div>
    </div>`;
  }
  const briefSig = () => {
    const f = focus();
    return f && f.meeting.brief ? `${docCount(f.meeting)}|${CC.canRecord()}` : '';
  };
  function patchBrief(layer) {
    const f = focus();
    const count = layer.querySelector('[data-docs]');
    if (!count || !f || !f.meeting.brief) return;
    count.textContent = docLabel(f.meeting);
    const chip = count.closest('.chip');
    chip.classList.remove('bump');
    void chip.offsetWidth;
    chip.classList.add('bump');
  }
  function startingPill() {
    return pill(`<span class="il-coral"></span><b>Starting now</b><span class="muted">· Record?</span><span class="spacer"></span><button class="btn sm record" data-act="record">Record</button><button class="btn sm plain" data-act="skip">Skip</button>`, 'il-starting');
  }

  const togglePaused = (layer, paused) => layer.querySelectorAll('.rec-dot, .il-wave').forEach((el) => el.classList.toggle('paused', paused));
  const timer = () => `<span class="num il-timer" data-elapsed>${CC.formatElapsed(CC.elapsed())}</span>`;
  function livePill(st) {
    const lv = st.live;
    return pill(`<span class="rec-dot${lv.paused ? ' paused' : ''}"></span><b class="il-name">${focusName()}</b>${timer()}${wave(lv.paused)}${lv.suggestion === 'shown' ? MINT_DOT : ''}`, 'il-live');
  }
  const liveSig = (st) => (st.live ? `${st.live.paused}|${st.live.suggestion}` : '');
  function patchLivePill(layer, st) {
    if (!st.live) return;
    togglePaused(layer, st.live.paused);
    const row = layer.querySelector('.il-pill');
    const dot = row.querySelector('.il-mint-dot');
    if (st.live.suggestion === 'shown' && !dot) row.insertAdjacentHTML('beforeend', MINT_DOT);
    if (st.live.suggestion !== 'shown' && dot) dot.remove();
  }
  const lineHtml = (l, typing) => `<div class="il-line${typing ? ' typing' : ''}"><span class="il-who">${esc(l.who)}</span><span class="il-said">${l.text.split(' ').map((w) => `<span class="w${typing ? ' h' : ''}">${esc(w)} </span>`).join('')}</span></div>`;
  function linesHtml(lines) {
    if (!lines.length) return '<div class="il-line il-listening"><span class="il-who">Listening</span><span class="il-said faint">Transcribing on this Mac — lines appear as people speak.</span></div>';
    return lines.slice(-2).map((l) => lineHtml(l, !l.seen)).join('');
  }
  function suggestionCard() {
    const sg = DATA.live.suggestion;
    const sources = sg.sources.map((label) => CC.src(label, { type: 'question', text: sg.text, seriesId: 'product-sync' })).join('');
    return `<div class="il-sugg"><div class="il-sugg-head">${icon('sparkle')}<span>Worth asking now</span></div><p>${esc(sg.text)}</p><div class="il-sugg-foot">${sources}<span class="spacer"></span><button class="btn sm plain" data-act="useful">${icon('thumbs-up')}Useful</button><button class="btn sm plain icon" data-act="dismiss" data-tip="Dismiss" aria-label="Dismiss">${icon('x')}</button></div></div>`;
  }
  const pauseLabel = (paused) => (paused ? `${icon('play')}Resume` : `${icon('pause')}Pause`);
  function liveCard(st) {
    const lv = st.live;
    return `<div class="il-card il-live-card">
      <div class="ic-head il-live-head"><span class="rec-dot${lv.paused ? ' paused' : ''}"></span><b>${focusName()}</b><span class="faint">#37</span><span class="spacer"></span>${timer()}${wave(lv.paused)}</div>
      <div class="il-lines" data-lines="${lv.lines.length}">${linesHtml(lv.lines)}</div>
      <div class="il-slot">${lv.suggestion === 'shown' ? suggestionCard() : ''}</div>
      <div class="ic-foot"><button class="btn sm" data-act="pause">${pauseLabel(lv.paused)}</button><button class="btn sm" data-act="stop"><span class="il-stop"></span>Stop<span class="kbd">⌥⌘R</span></button><span class="spacer"></span><span class="t-caption il-local">${icon('lock')}On this Mac</span></div>
    </div>`;
  }
  const liveCardSig = (st) => (st.live ? `${st.live.paused}|${st.live.suggestion}|${st.live.lines.length}` : '');
  function patchLiveCard(layer, st) {
    const lv = st.live;
    if (!lv) return;
    togglePaused(layer, lv.paused);
    layer.querySelector('[data-act="pause"]').innerHTML = pauseLabel(lv.paused);
    const box = layer.querySelector('.il-lines');
    if (Number(box.dataset.lines) !== lv.lines.length) {
      box.dataset.lines = String(lv.lines.length);
      box.innerHTML = linesHtml(lv.lines);
      setTimeout(() => typeLines(layer), 120);
    }
    const slot = layer.querySelector('.il-slot');
    const card = slot.querySelector('.il-sugg');
    if (lv.suggestion === 'shown' && !card) {
      slot.innerHTML = suggestionCard();
      slot.firstElementChild.classList.add('arrive');
    }
    if (lv.suggestion !== 'shown' && card) card.remove();
  }
  function typeLines(layer) {
    clearInterval(ui.typing);
    const words = [...layer.querySelectorAll('.il-line.typing .w.h')];
    if (!words.length) return;
    if (Kit.reduceMotion()) {
      words.forEach((w) => w.classList.remove('h'));
      CC.markLinesSeen();
      return;
    }
    let i = 0;
    ui.typing = setInterval(() => {
      if (!layer.isConnected || layer.classList.contains('out')) return clearInterval(ui.typing);
      words[i].classList.remove('h');
      i += 1;
      if (i >= words.length) {
        clearInterval(ui.typing);
        CC.markLinesSeen();
      }
    }, TYPE_MS);
  }
  function feedback(kind, btn) {
    const card = btn.closest('.il-sugg');
    if (!card || card.classList.contains('leaving')) return;
    card.classList.add('leaving');
    setTimeout(() => CC.suggestionFeedback(kind), Kit.reduceMotion() ? 0 : 150);
  }

  const filingPill = () => pill(`<span class="spinner"></span><span>Filing to <b>${focusName()}</b>…</span>`, 'il-filing');
  function filedPill() {
    const n = CC.pending();
    return pill(`${okMark}<span>Filed to <b>${focusName()}</b></span>${n ? `<span class="il-review num">· ${n} to review</span>` : '<span class="muted">· all reviewed</span>'}`, 'il-filed');
  }
  function countChips(items) {
    return Object.keys(PLURAL).map((type) => {
      const n = items.filter((k) => k.type === type).length;
      return n ? `<span class="ic-count">${CC.kIcon(type)}${n} ${PLURAL[type][n === 1 ? 0 : 1]}</span>` : '';
    }).join('');
  }
  function filedCard(st) {
    const am = DATA.afterMeeting;
    const n = CC.pending();
    return `<div class="il-card il-filed-card">
      <div class="ic-head">${okMark}<div class="ic-title"><b>Filed to ${focusName()} <span class="faint">#37</span></b><span class="muted num">${am.duration} · ended ${am.ended} · transcribed on this Mac</span></div></div>
      <p class="ic-why ic-summary">${esc(am.summary)}</p>
      <div class="ic-counts">${countChips(st.review.items)}</div>
      <div class="ic-foot"><button class="btn sm" data-act="open-meeting">Open meeting</button><span class="spacer"></span>${n ? `<span class="t-caption">About 30 seconds</span><button class="btn sm primary" data-act="review">Review ${n}</button>` : '<span class="t-caption">All reviewed</span>'}</div>
    </div>`;
  }
  const hintPill = () => pill(`<span class="il-clip">${icon('paperclip')}</span><span>Drop on Telu to attach to <b>${focusName()}</b></span>`, 'il-hint');
  function dropTarget() {
    const f = focus();
    const when = f ? CC.startOf(f.meeting) : '';
    const done = f && f.meeting.status === 'done';
    return `<div class="il-drop drop-target"><span class="il-clip lg">${icon('paperclip')}</span><b>Attach to ${focusName()} · ${when}</b><span class="t-caption">${done ? 'Filed with the meeting' : 'Goes into the brief'} · stays on this Mac</span></div>`;
  }
  function attachedPill() {
    const f = focus();
    const where = f && f.meeting.status === 'done' ? 'filed with the meeting' : 'in the brief';
    return pill(`${okMark}<b>Attached</b><span class="muted">· ${where}</span>`, 'il-attached');
  }
  const alreadyPill = () => pill(`<span class="il-clip">${icon('info')}</span><span>Already in the brief</span>`);
  const skippedPill = () => pill(`<span class="il-clip">${icon('x-circle')}</span><span>Not recording <b>Product Sync</b></span>`);
  const updatedPill = () => pill(`${okMark}<span><b>Product Sync</b> memory updated</span>`, 'il-updated');

  const V = {
    setup: { render: setupPill },
    next: { key: focusKey, render: nextPill, sig: () => (focus() ? CC.untilLabel(focus().meeting) : '') },
    'next-card': { key: focusKey, render: briefCard, sig: briefSig, patch: patchBrief, radius: 22 },
    starting: { render: startingPill },
    live: { render: livePill, sig: liveSig, patch: patchLivePill },
    'live-card': { render: liveCard, sig: liveCardSig, patch: patchLiveCard, mounted: (layer) => setTimeout(() => typeLines(layer), 260), radius: 22 },
    filing: { render: filingPill },
    filed: { render: filedPill, sig: () => String(CC.pending()) },
    'filed-card': { render: filedCard, sig: () => String(CC.pending()), radius: 22 },
    'drag-hint': { render: hintPill },
    attach: { render: dropTarget, radius: 20 },
    attached: { render: attachedPill, bounce: true },
    already: { render: alreadyPill },
    skipped: { render: skippedPill },
    updated: { render: updatedPill, bounce: true }
  };

  const baseMode = (st) => (st.onboarded ? PHASE_MODE[st.phase] || 'next' : 'setup');
  function variantFor(st) {
    if (ui.drag && st.onboarded) return ui.drag === 'over' ? 'attach' : 'drag-hint';
    if (ui.transient) return ui.transient;
    const base = baseMode(st);
    return ui.expanded && EXPANDABLE[base] ? EXPANDABLE[base] : base;
  }
  const current = () => [...ui.el.children].filter((layer) => !layer.classList.contains('out')).pop() || null;
  const radiusFor = (def, h) => def.radius || (h > PILL_H + 4 ? 22 : h / 2);
  function fix(layer, w) {
    layer.style.width = `${w}px`;
    layer.style.marginLeft = `${-w / 2}px`;
  }
  function resize(w, h, r, instant) {
    Object.assign(ui, { w, h });
    const el = ui.el;
    if (instant) el.classList.add('instant');
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;
    el.style.borderRadius = `${r}px`;
    el.dataset.shape = h > PILL_H + 4 ? 'card' : 'pill';
    if (instant) {
      void el.offsetWidth;
      el.classList.remove('instant');
    }
  }
  function retire(keep) {
    [...ui.el.children].forEach((layer) => {
      if (layer === keep || layer.classList.contains('out')) return;
      if (layer.classList.contains('pre')) return layer.remove();
      layer.classList.add('out');
      setTimeout(() => layer.remove(), 160);
    });
  }
  function morph(variant, key, st) {
    const def = V[variant];
    const first = !current();
    const layer = Kit.html(`<div class="il pre" data-variant="${variant}">${def.render(st)}</div>`);
    ui.el.appendChild(layer);
    const w = layer.offsetWidth;
    const h = layer.offsetHeight;
    fix(layer, w);
    const instant = first || ui.hidden;
    const delay = !instant && w * h < ui.w * ui.h ? 90 : 0;
    ui.el.style.setProperty('--morph-delay', `${delay}ms`);
    layer.style.setProperty('--in-delay', `${instant ? 0 : delay + 80}ms`);
    ui.el.classList.toggle('bouncy', Boolean(def.bounce));
    retire(layer);
    resize(w, h, radiusFor(def, h), instant);
    Object.assign(ui, { variant, key, sig: def.sig ? def.sig(st) : '' });
    requestAnimationFrame(() => layer.classList.remove('pre'));
    if (def.mounted) def.mounted(layer, st);
  }
  function refit() {
    const layer = current();
    if (!layer) return;
    layer.style.width = '';
    layer.style.marginLeft = '';
    const w = layer.offsetWidth;
    const h = layer.offsetHeight;
    fix(layer, w);
    ui.el.style.setProperty('--morph-delay', '0ms');
    ui.el.classList.remove('bouncy');
    resize(w, h, radiusFor(V[ui.variant], h), ui.hidden);
  }
  function sync(st) {
    const variant = variantFor(st);
    const def = V[variant];
    const key = `${variant}|${def.key ? def.key(st) : ''}`;
    if (key !== ui.key) return morph(variant, key, st);
    const sig = def.sig ? def.sig(st) : '';
    if (sig === ui.sig) return;
    ui.sig = sig;
    const layer = current();
    if (def.patch) def.patch(layer, st);
    else layer.innerHTML = def.render(st);
    refit();
  }

  function canExpand() {
    return !ui.drag && !ui.transient && !ui.hidden && Boolean(EXPANDABLE[baseMode(CC.get())]) && Boolean(focus());
  }
  function setExpanded(value) {
    clear('in', 'out');
    ui.expanded = Boolean(value) && canExpand();
    if (!ui.expanded) ui.pinned = false;
    sync(CC.get());
  }
  function pin() {
    if (!canExpand()) return;
    ui.pinned = true;
    setExpanded(true);
  }
  function collapse() {
    clear('in', 'out');
    ui.pinned = false;
    if (ui.expanded) setExpanded(false);
  }
  function handOff() {
    ui.suppress = ui.el.matches(':hover');
    collapse();
  }
  function openPalette(kind, opts) {
    const f = focus();
    handOff();
    if (f) CC.palette.openAt(kind, f.meeting.id, opts);
  }
  function openReview() {
    handOff();
    CC.palette.openAt('review');
  }
  const ACTIONS = {
    'open-brief': () => openPalette('meeting'),
    'open-meeting': () => openPalette('meeting'),
    docs: () => openPalette('meeting', { section: 'docs' }),
    record: () => CC.startRecording(),
    skip: () => {
      handOff();
      CC.skipMeeting();
    },
    pause: () => CC.togglePause(),
    stop: () => {
      handOff();
      CC.stopRecording();
    },
    useful: (btn) => feedback('useful', btn),
    dismiss: (btn) => feedback('dismissed', btn),
    review: () => openReview()
  };
  function onClick(event) {
    const act = event.target.closest('[data-act]');
    if (act) return ACTIONS[act.dataset.act] && ACTIONS[act.dataset.act](act);
    if (event.target.closest('.ev')) return pin();
    if (ui.transient || ui.drag) return;
    const base = baseMode(CC.get());
    if (base === 'setup') return CC.onboarding.open();
    if (base === 'filed') return openReview();
    return pin();
  }
  function onEnter() {
    clear('out');
    if (!ui.expanded && !ui.suppress && !CC.palette.isOpen() && canExpand()) ui.timers.in = setTimeout(() => setExpanded(true), HOVER_IN);
  }
  function onLeave() {
    clear('in');
    ui.suppress = false;
    if (ui.expanded && !ui.pinned) ui.timers.out = setTimeout(() => setExpanded(false), HOVER_OUT);
  }
  function flash(variant, ms) {
    clear('flash');
    Object.assign(ui, { transient: variant, expanded: false, pinned: false });
    sync(CC.get());
    ui.timers.flash = setTimeout(() => {
      ui.transient = null;
      sync(CC.get());
    }, ms);
  }

  const canAttach = () => {
    const st = CC.get();
    return st.onboarded && !ui.hidden && st.phase !== 'filing' && Boolean(focus());
  };
  const FILE_TYPE = 'application/x-telu-file';
  const isFileDrag = (event) => [...event.dataTransfer.types].some((t) => t === 'Files' || t === FILE_TYPE);
  const inEditable = (event) => Boolean(event.target.closest && event.target.closest('input, textarea, [contenteditable="true"]'));
  function inside(x, y) {
    const r = ui.el.getBoundingClientRect();
    return x >= r.left - 10 && x <= r.right + 10 && y >= r.top - 10 && y <= r.bottom + 12;
  }
  function droppedName(dt) {
    const file = dt.files && dt.files[0];
    return CC.safeFileName(file ? file.name : dt.getData(FILE_TYPE));
  }
  function setDrag(value) {
    if (ui.drag === value || !canAttach()) return;
    Object.assign(ui, { drag: value, expanded: false, pinned: false });
    sync(CC.get());
  }
  function endDrag() {
    clear('drag');
    if (!ui.drag) return;
    ui.drag = null;
    sync(CC.get());
  }
  function onDragOver(event) {
    if (inEditable(event) || (!ui.drag && !isFileDrag(event))) return;
    event.preventDefault();
    const allowed = canAttach();
    const over = allowed && inside(event.clientX, event.clientY);
    event.dataTransfer.dropEffect = over ? 'copy' : 'none';
    if (allowed) setDrag(over ? 'over' : 'hint');
    clear('drag');
    ui.timers.drag = setTimeout(endDrag, 500);
  }
  function onDrop(event) {
    if (inEditable(event) || (!ui.drag && !isFileDrag(event))) return;
    event.preventDefault();
    const over = ui.drag === 'over' || (canAttach() && inside(event.clientX, event.clientY));
    const name = droppedName(event.dataTransfer);
    endDrag();
    if (!over) return;
    if (!name) return CC.toast('Telu can attach documents with a file name like “Plan.pdf”', { icon: 'info' });
    flash(CC.attachDoc(name) ? 'attached' : 'already', 1300);
  }
  function bindDeskFile() {
    const file = $('#deskFile');
    file.addEventListener('dragstart', (event) => {
      event.dataTransfer.setData(FILE_TYPE, FILE_NAME);
      event.dataTransfer.setData('text/plain', FILE_NAME);
      event.dataTransfer.effectAllowed = 'copy';
      file.classList.add('selected');
      setDrag('hint');
    });
    file.addEventListener('dragend', endDrag);
    file.addEventListener('dblclick', () => CC.toast(`Drag ${FILE_NAME} onto Telu to attach it`, { icon: 'paperclip' }));
    document.addEventListener('pointerdown', (event) => file.classList.toggle('selected', file.contains(event.target)));
  }
  function bindDrag() {
    bindDeskFile();
    document.addEventListener('dragenter', (event) => {
      if (isFileDrag(event) && !inEditable(event)) setDrag(ui.drag || 'hint');
    });
    document.addEventListener('dragover', onDragOver);
    document.addEventListener('drop', onDrop);
  }

  function reset() {
    Object.values(ui.timers).forEach(clearTimeout);
    clearInterval(ui.typing);
    Object.assign(ui, { expanded: false, pinned: false, drag: null, transient: null });
    setHidden(false);
  }
  function setHidden(value) {
    ui.hidden = Boolean(value);
    ui.el.classList.toggle('gone', ui.hidden);
    if (ui.hidden) collapse();
  }
  function escape() {
    if (!ui.expanded) return false;
    collapse();
    return true;
  }
  function outside(target) {
    if (ui.expanded && !ui.el.contains(target)) collapse();
  }
  function mount() {
    ui.el = $('#island');
    ui.el.addEventListener('pointerenter', onEnter);
    ui.el.addEventListener('pointerleave', onLeave);
    ui.el.addEventListener('click', onClick);
    bindDrag();
    CC.onSync(sync);
  }

  return { mount, reset, flash, collapse, escape, outside, setHidden, isHidden: () => ui.hidden };
})();
