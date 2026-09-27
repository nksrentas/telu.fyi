(() => {
  const esc = Catalog.esc;
  const D = T.doc;
  const {
    EO, ED, SPR, SPRB, STATUS, FLY_ICON, CAPSULE, BLUR_OUT, RISE_IN, q, qa, node, sc, reduced, memo, tokens, state, guard, safe, seq, clock, restart, force,
    PS, SERIES, SUM, dayM, agendaM, navM, sRow, sideM, agTb, docTb, winM, swap, newPop, demo, E, add
  } = window.TeluMotion;

  const pkM = (id) => sc('before', () => {
    const ev = T.eventById(id);
    const { series: s, meeting: m } = T.findMeeting(ev.meeting);
    const when = [T.dayLabel(1), `${ev.start}–${ev.end}`, ev.where].filter(Boolean).map(esc).join('<span class="a-sep">·</span>');
    return `<div class="pk-bar"><button class="pk-series">${Kit.seriesIcon(s, 'a-xs')}<span class="truncate">${esc(s.name)}</span>${icon('chevron-right')}</button><span class="spacer"></span><button class="btn sm plain pk-open">${icon('arrow-up-right')}Open as page</button><button class="btn sm plain icon pk-x" data-tip="Close · esc">${icon('x')}</button></div>`
      + `<header class="pk-head"><h2 class="pk-title"><span>${esc(T.meetingTitle(s, m, ev))}</span><span class="pk-n num">#${m.n}</span></h2><div class="pk-meta"><span class="pk-when">${when}</span>${Kit.avatars(ev.people || s.people, 4)}</div></header>`
      + `<div class="pk-body doc-surface" data-surface="peek">${D.nextMarkup(s, m, { surface: 'peek' })}</div>`;
  });
  const PK = memo(() => ({ t2: pkM('t2'), t4: pkM('t4') }));
  const peekWin = () => winM({ h: 380, side: sideM(), tb: agTb(), view: agendaM(1, 5), main: 'peek-open', extra: `<aside class="peek open"><div class="pk-scroll"><div class="pk-content">${PK().t2}</div></div></aside>` });
  const peekOpen = (c, animate = true) => {
    const el = q(c, '.peek');
    if (!animate || reduced()) {
      el.classList.add('instant', 'open');
      void el.offsetWidth;
      requestAnimationFrame(() => el.classList.remove('instant'));
    } else {
      el.classList.remove('instant');
      el.classList.add('open');
    }
    q(c, '.main').classList.add('peek-open');
  };
  const peekClose = (c, animate = true) => {
    const el = q(c, '.peek');
    el.classList.toggle('instant', !animate || reduced());
    el.classList.remove('open');
    q(c, '.main').classList.remove('peek-open');
    if (!animate) requestAnimationFrame(() => el.classList.remove('instant'));
  };
  const selectCard = (c, id) => {
    qa(c, '.a-card.is-selected').forEach((el) => el.classList.remove('is-selected'));
    const card = q(c, `.a-card[data-id="${id}"]`);
    if (card) card.classList.add('is-selected');
  };
  const peekSet = (c, id, animate) => {
    const [el, top] = [q(c, '.pk-content'), () => { q(c, '.pk-scroll').scrollTop = 0; }];
    selectCard(c, id);
    if (animate) return T.fx.crossfade(el, PK()[id], top);
    el.getAnimations().forEach((a) => a.cancel());
    el.innerHTML = PK()[id];
    return top();
  };
  const DOC = memo(() => sc('before', () => D.docMarkup(PS().s)));
  const openPage = (c) => {
    const [view, content] = [q(c, '.mo-view'), q(c, '.content')];
    const reveal = () => {
      const el = q(view, '#sec-next');
      content.scrollTop += el.getBoundingClientRect().top - content.getBoundingClientRect().top - 72;
      q(c, '.tb-title').classList.add('show');
      setTimeout(() => D.receive(el), 80);
    };
    peekClose(c, false);
    q(c, '.toolbar').innerHTML = docTb(PS().s, 'Today');
    swap(view, () => { view.className = 'canvas-inner mo-view'; view.innerHTML = DOC(); content.scrollTop = 0; reveal(); }, [BLUR_OUT, 120, 'ease-out'], [RISE_IN, 180]);
  };
  const pageBack = (c) => {
    const view = q(c, '.mo-view');
    q(c, '.toolbar').innerHTML = agTb();
    view.getAnimations().forEach((a) => a.cancel());
    view.className = 'agenda-inner mo-view';
    view.innerHTML = `<div class="a-timeline">${dayM(1, 5)}</div>`;
    q(c, '.content').scrollTop = 0;
    T.fx.fadeIn(view, { duration: 200 });
    selectCard(c, 't2');
    peekOpen(c, false);
  };
  const toggleMtg = (mtg, open = !mtg.classList.contains('open')) => {
    mtg.classList.toggle('open', open);
    q(mtg, '.disclosure').classList.toggle('open', open);
    q(mtg, '.collapsible').classList.toggle('collapsed', !open);
  };
  const BANNER = `<div class="a-banner-wrap collapsible"><div><div class="a-banner"><span class="a-banner-icon">${icon('sparkles')}</span><div class="a-banner-text"><b>Telu found 2 new recurring meetings in your calendar</b><span class="truncate">Growth Review · Daily Standup</span></div><button class="btn sm tinted">Review</button><button class="btn sm plain icon mo-hide" data-tip="Hide">${icon('x')}</button></div></div></div>`;
  const NEXTS = memo(() => {
    const m = (id, patch) => sc(id, () => { if (patch) patch(); return D.nextMarkup(PS().s, PS().next, { surface: 'peek' }); });
    return [['Brief ready', m('before')], ['Recording', m('live')], ['Preparing summary', m('live', SUM)], ['Brief ready', m('before')]];
  });
  const repaintNext = (c, [label, markup], animate) => {
    const [block, fresh] = [q(c, '.next'), q(node(`<div>${markup}</div>`), '.next')];
    const apply = () => { block.className = fresh.className; block.innerHTML = fresh.innerHTML; clock(c, q(block, '[data-rec-timer]'), 724); };
    q(c, '.mo-state').textContent = label;
    if (animate) swap(block, apply, [BLUR_OUT, 120, 'ease-out'], [RISE_IN, 200]);
    else apply();
  };
  const LIVE0 = memo(() => sc('live', () => { T.set({ recording: { ...T.state.recording, startedAt: Date.now() } }); return D.nextMarkup(PS().s, PS().next, { surface: 'peek' }); }));
  const lineM = (i) => `<div class="live-line"><b>${esc(DATA.live.transcript[i].who)}</b><span>${esc(DATA.live.transcript[i].text)}</span></div>`;
  const askM = () => `<div class="ask live-ask"><div class="ask-head">${icon('sparkle')}Worth asking now</div><div class="ask-row"><span class="ask-text">${esc(DATA.live.suggestion.text)}</span><span class="ask-side">${DATA.live.suggestion.sources.map((s) => Kit.source(esc(s))).join('')}</span></div></div>`;
  const liveAdd = (box, markup) => () => { const l = q(box, '.listening'); if (l) l.remove(); box.insertAdjacentHTML('beforeend', markup.replace('class="', 'class="enter ')); };
  const CANDS = memo(() => PS().done.candidates.slice(0, 3));
  const reviewM = (list) => `${D.reviewHead({ candidates: list })}<div class="cand-list">${list.map(D.candRow).join('')}</div>`;
  const candSet = (c, id, to) => {
    const list = (state.get(c) || CANDS()).map((x) => (x.id === id ? { ...x, state: to } : x));
    const row = q(c, `.cand[data-cid="${id}"]`);
    state.set(c, list);
    if (row) row.outerHTML = D.candRow(list.find((x) => x.id === id));
    q(c, '.review-head').outerHTML = D.reviewHead({ candidates: list });
  };
  const candReset = (c) => { state.delete(c); q(c, '.review').innerHTML = reviewM(CANDS()); };
  const CAND_ACTS = { accept: 'accepted', reject: 'rejected', correct: 'editing', 'undo-reject': 'pending', 'cancel-correct': 'pending', 'save-correct': 'accepted' };
  const acceptAll = (c) => (state.get(c) || CANDS()).filter((x) => x.state === 'pending').forEach((x, i) => setTimeout(guard(c, () => candSet(c, x.id, 'accepted')), i * 70));
  const FOUND = memo(() => q(node(`<div>${sc('before', () => T.pages.foundMarkup())}</div>`), '.a-pcards').outerHTML);
  const MEM = memo(() => {
    const el = node(`<div>${sc('before', () => D.memoryBody(PS().s))}</div>`);
    qa(el, '.mem-group').slice(2).forEach((g) => g.remove());
    return el.innerHTML;
  });
  const saveM = () => `<section class="doc-sec purpose"><div class="sec-head"><span class="sec-eyebrow">Purpose</span><span class="sec-meta">v1 · drafted just now</span><span class="chip accent drafted">${icon('pencil')}Drafted from the calendar invite — make it yours</span><span class="spacer"></span><button class="btn sm plain">${icon('history')}History</button></div>`
    + `<div class="p-block"><div class="p-label">Why we meet</div><p class="p-why editable" contenteditable="true" spellcheck="false">${esc(PS().s.purpose.why)}</p></div></section>`;
  const onEdit = (c) => {
    const [meta, save, chip] = [q(c, '.sec-meta'), q(c, '.save-state'), q(c, '.drafted')];
    if (!state.get(c)) {
      state.set(c, true);
      meta.textContent = 'v2 · just now';
      restart(meta, 'ver-bump');
      if (chip && reduced()) chip.remove();
      else if (chip) chip.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(0.96)' }], { duration: 160, easing: 'ease-out' }).finished.then(() => chip.remove());
    }
    save.textContent = 'Saving…';
    save.classList.add('busy');
    clearTimeout(tokens.get(save));
    tokens.set(save, setTimeout(() => { save.textContent = 'Saved'; save.classList.remove('busy'); }, 700));
  };
  const saveReset = (c) => { state.delete(c); q(c, '.doc').innerHTML = saveM(); q(c, '.save-state').textContent = 'Saved'; };
  const SCRUB = (active = 0) => `<nav class="scrubber">${['Purpose', 'Memory', 'Next', 'Sep 22', 'Sep 15', 'Sep 8'].map((l, i) => `${i === 3 ? '<span class="scrub-gap"></span>' : ''}<button class="scrub-item${i === active ? ' active' : ''}" aria-label="${l}"><span class="scrub-label">${l}</span><span class="scrub-tick"></span></button>`).join('')}</nav>`;
  const drawer = (c, open) => {
    const [main, body] = [q(c, '.main'), q(c, '.drawer-body')];
    const [mw, w] = [main.getBoundingClientRect().width, q(c, '.doc').getBoundingClientRect().width];
    const left = (mw - w) / 2;
    const shift = open ? Math.max(0, Math.min(left + w + 24 - (mw - 366), left - 24)) : 0;
    q(c, '.drawer').classList.toggle('open', open);
    q(c, '.canvas-inner').style.setProperty('--shift', `${-shift}px`);
    main.classList.toggle('drawer-open', open);
    const hl = open && q(body, '.tl.hl');
    if (hl) body.scrollTop = Math.max(0, hl.offsetTop - body.clientHeight / 2 + hl.offsetHeight / 2);
  };
  const REF = memo(() => {
    const s = PS().s;
    const extra = [{ name: 'Rate-limit plan v1.docx', ver: 'v1', include: true }, { name: 'Pricing experiment.xlsx', ver: 'v1', include: true }];
    return { base: D.referenceInner(s), fresh: qa(node(`<div>${D.referenceInner({ ...s, docs: [...s.docs, ...extra] })}</div>`), '.ref-chip').slice(-2).map((x) => x.outerHTML) };
  });
  const chipsRun = (c) => {
    const row = q(c, '.ref-row');
    row.innerHTML = REF().base;
    const add = q(row, '.add-chip');
    const attach = () => REF().fresh.forEach((m, i) => { const el = node(m); el.style.animationDelay = `${i * 40}ms`; el.classList.add('chip-in'); row.insertBefore(el, add); });
    const removeLast = () => { const chip = qa(row, '.ref-chip').pop(); chip.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(0.95)' }], { duration: 150, easing: 'ease-out' }).finished.then(() => chip.remove()); };
    const dot = () => q(row, '.ref-chip .inc-dot').classList.toggle('off');
    seq(c, [[300, attach], [1300, dot], [2100, removeLast], [2700, dot]]);
  };
  const GROWTH = { id: 'growth', name: 'Growth Review', color: 'var(--series-teal)', icon: 'target' };
  const flyNew = (c, expand) => {
    const row = node(sRow(GROWTH, false, 'Thu'));
    const land = () => row.classList.remove('landing');
    qa(c, '.mo-added').forEach((el) => el.remove());
    row.classList.add('mo-added', ...(expand ? [] : ['landing']));
    q(c, '.mo-series').appendChild(row);
    if (expand) Kit.enterAnimated(row);
    Kit.flyTo(q(c, '.a-new-preview'), row, { markup: expand ? T.flyMarkup(GROWTH) : `<div class="fly-chip">${Kit.seriesIcon(GROWTH)}<span>${esc(GROWTH.name)}</span></div>` }).then(land, land);
  };
  const PAST = memo(() => sc('before', () => { T.set({ expanded: {} }); return [PS().m36, PS().m35, PS().m34].map((m) => D.meetingMarkup(PS().s, m)).join(''); }));
  const moveMtg = (c, how) => {
    if (!q(c, '.mtg[data-mid="ps-35"]')) q(c, '.past-list').innerHTML = PAST();
    const mtg = q(c, '.mtg[data-mid="ps-35"]');
    const [target, html] = [how === 'review' ? q(c, '.a-nav[data-nav="Review"]') : q(c, '.a-sb-row[data-series="acme"]'), mtg.outerHTML];
    if (how === 'drag') D.receive(target);
    else Kit.flyTo(q(mtg, '.mtg-head'), target, { markup: `<div class="fly-chip">${icon('calendar')}<span>${esc(PS().m35.date)}</span></div>` });
    Kit.removeAnimated(mtg);
    seq(c, [[1900, () => { const [list, el] = [q(c, '.past-list'), node(html)]; list.insertBefore(el, list.children[1] || null); Kit.enterAnimated(el); D.receive(el); }]]);
  };

  const ISL = { lines: 2, sug: true };
  let islOpts = ISL;
  const bridge = {
    next: () => ({ series: PS().s, meeting: PS().next, countdown: 'in 19m' }),
    live: () => ({ series: PS().s, meeting: PS().next, elapsed: 724, transcript: DATA.live.transcript.slice(0, islOpts.lines).map(({ who, text }) => ({ who, text })), suggestion: islOpts.sug ? { text: DATA.live.suggestion.text, sources: [...DATA.live.suggestion.sources] } : null }),
    after: () => ({ series: PS().sA, meeting: PS().done, pending: T.pendingOf(PS().done) }),
    evidence: () => null
  };
  const islDesk = (attach = false, h = 380) => `<div class="desktop cat-desk mo-desk mo-isl${attach ? ' mo-attach' : ''}" style="height:${h}px">${Kit.menubar({ menus: ['File', 'Edit', 'View'], extras: STATUS })}<p class="mo-hint">Replay mounts the page’s one live Island here</p></div>`;
  const islOwn = (c) => { Island.mount(q(c, '.mo-isl'), bridge); return q(c, '.mo-isl .island'); };
  const islMount = (c, mode = 'before', opts = ISL) => {
    const desk = q(c, '.mo-isl');
    islOpts = opts;
    qa(document, '.mo-isl').filter((d) => d !== desk).forEach((d) => { d.classList.remove('is-live'); qa(d, '.island').forEach((el) => el.remove()); });
    desk.classList.add('is-live');
    islOwn(c);
    Island.set('hidden');
    Island.set(mode);
  };
  const islEnsure = (c) => {
    if (q(c, '.mo-isl.is-live')) islOpts = ISL;
    else islMount(c);
    return islOwn(c);
  };
  const iset = (c, mode) => () => { islOwn(c); Island.set(mode); };
  const ifire = (c, type) => () => islOwn(c).dispatchEvent(new PointerEvent(type));
  const iclick = (c, sel) => () => { const el = sel ? q(c, sel) : islOwn(c); if (el) el.click(); };
  const iesc = (c) => () => islOwn(c).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  const fileDrag = (c, type, over) => () => {
    const r = islOwn(c).getBoundingClientRect();
    const dt = new DataTransfer();
    dt.setData('application/x-telu-file', 'Sprint 43 plan.pdf');
    document.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt, clientX: over ? r.left + r.width / 2 : r.left - 70, clientY: over ? r.top + r.height / 2 : r.bottom + 80 }));
  };

  const detected = () => DATA.detected.slice(0, 4).map((d) => {
    const s = d.series ? Kit.series(d.series) : null;
    const lead = s ? Kit.seriesIcon(s) : `<span class="series-icon" style="--c:var(--series-gray)">${icon('repeat')}</span>`;
    return `<div class="ob-row${d.ignored ? ' ignored' : ''}">${lead}<div class="ob-row-main"><b class="truncate">${esc(s ? s.name : d.title)}</b><span class="truncate">${esc(s ? s.rule : d.rule)} · ${esc(d.ignored ? d.note : `${d.found} found`)}</span></div><button class="switch" aria-checked="${Boolean(d.on) && !d.ignored}" aria-label="Remember"${d.ignored ? ' disabled' : ''}></button></div>`;
  }).join('');
  const OB = memo(() => [
    `<div class="app-icon ob-icon"><img src="../kit/telu-icon.png" alt=""></div><h2 class="ob-title">Telu gets you ready for recurring meetings</h2><p class="ob-text">It reads your calendar on this Mac, prepares a brief before each recurring meeting and files everything after. Nothing leaves your Mac.</p><div class="ob-privacy">${icon('lock')}Processed on this Mac · nothing is uploaded</div>`,
    `<h2 class="ob-title">Which conversations should Telu remember?</h2><p class="ob-text">Telu found ${DATA.detected.length} recurring events on your Work calendar. Each one you keep becomes a series with its own purpose, memory and briefs.</p><div class="ob-list">${detected()}</div>`,
    `<div class="app-icon ob-icon" data-fly><img src="../kit/telu-icon.png" alt=""></div><h2 class="ob-title">Summon Telu anytime</h2><div class="ob-keys"><span class="keycap">⌥</span><span class="ob-plus">+</span><span class="keycap wide">Space</span></div><p class="ob-text">Telu lives in your menu bar and comes to you before each meeting. Series, purpose docs and history are one keystroke away.</p>`
  ]);
  const OB_ACT = memo(() => [
    '<button class="btn plain" data-ob="close">Not now</button><button class="btn primary" data-ob="next">Connect Calendar</button>',
    `<button class="btn plain" data-ob="back">Back</button><button class="btn primary" data-ob="next">Remember ${DATA.detected.filter((d) => d.on && !d.ignored).length}</button>`,
    '<button class="btn plain" data-ob="back">Back</button><button class="btn primary" data-ob="done">Done</button>'
  ]);
  const obDesk = (step) => `<div class="desktop cat-desk mo-desk mo-ob" style="height:470px">${Kit.menubar({ app: 'Telu', menus: ['File', 'Edit', 'View', 'Meeting', 'Window', 'Help'], extras: STATUS })}<section class="onboard" role="dialog" aria-label="Set up Telu"><div class="ob-steps"><div class="ob-step">${OB()[step]}</div></div>`
    + `<footer class="ob-foot"><div class="ob-dots">${[0, 1, 2].map((i) => `<i class="${i === step ? 'on' : i < step ? 'done' : ''}"></i>`).join('')}</div><span class="spacer"></span><div class="ob-actions">${OB_ACT()[step]}</div></footer></section></div>`;
  const obFoot = (c, step) => {
    state.set(c, step);
    qa(c, '.ob-dots i').forEach((d, i) => { d.classList.toggle('on', i === step); d.classList.toggle('done', i < step); });
    q(c, '.ob-actions').innerHTML = OB_ACT()[step];
  };
  const obGo = (c, step, dir) => {
    if (step < 0 || step > 2) return;
    const [box, next] = [q(c, '.ob-steps'), node(`<div class="ob-step">${OB()[step]}</div>`)];
    const old = q(box, '.ob-step:not(.leaving)');
    box.appendChild(next);
    obFoot(c, step);
    if (!old) return;
    old.classList.add('leaving');
    if (reduced()) { old.remove(); return; }
    old.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${-24 * dir}px)` }], { duration: 150, easing: Kit.EASE_OUT, fill: 'forwards' }).finished.then(() => old.remove(), () => {});
    next.animate([{ opacity: 0, transform: `translateX(${24 * dir}px)` }, { opacity: 1, transform: 'none' }], { duration: 220, easing: Kit.EASE_OUT, delay: 40, fill: 'backwards' });
  };
  const obReset = (c, step) => {
    const [panel, status] = [q(c, '.onboard'), q(c, '.telu-status')];
    panel.getAnimations().forEach((a) => a.cancel());
    panel.hidden = false;
    q(c, '.ob-steps').innerHTML = `<div class="ob-step">${OB()[step]}</div>`;
    obFoot(c, step);
    status.classList.add('icon-only');
    q(status, '.ts-text').innerHTML = '';
  };
  const obOpen = (c) => {
    const panel = q(c, '.onboard');
    panel.getAnimations().forEach((a) => a.cancel());
    panel.hidden = false;
    if (!reduced()) panel.animate([{ opacity: 0, transform: 'scale(0.96)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: Kit.EASE_OUT });
  };
  const obClose = (c) => {
    const panel = q(c, '.onboard');
    if (reduced()) { panel.hidden = true; return; }
    const anim = panel.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(0.97)' }], { duration: 160, easing: Kit.EASE_OUT, fill: 'forwards' });
    anim.finished.then(() => { panel.hidden = true; anim.cancel(); }, () => {});
  };
  const obFinish = (c) => {
    const [panel, to] = [q(c, '.onboard'), q(c, '.telu-status')];
    const shrink = reduced() ? null : panel.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(0.92)' }], { duration: 280, easing: Kit.EASE_OUT, fill: 'forwards' });
    Kit.flyTo(q(c, '.ob-step:not(.leaving) [data-fly]'), to, { markup: FLY_ICON, duration: 620 }).then(() => {
      panel.hidden = true;
      if (shrink) shrink.cancel();
      to.classList.remove('icon-only');
      q(to, '.ts-text').innerHTML = '<span class="num">Product Sync · 19m</span>';
    });
  };
  const OB_ACTIONS = { next: (c, at) => obGo(c, at + 1, 1), back: (c, at) => obGo(c, at - 1, -1), close: (c) => obClose(c), done: (c) => obFinish(c) };
  const obWire = (c) => c.addEventListener('click', guard(c, (e) => { const b = e.target.closest('[data-ob]'); if (b) OB_ACTIONS[b.dataset.ob](c, state.has(c) ? state.get(c) : 0); }));
  const RM_SET = `<div class="row-flex mo-rm-row"><button class="switch" aria-checked="false" aria-label="Demo"></button><button class="check" aria-checked="false" aria-label="Demo">${Kit.checkSvg}</button><span class="wave live-wave"><i></i><i></i><i></i><i></i><i></i></span><span class="rec-dot"></span></div>`
    + `<div class="seg">${['Weekly', 'Every 2 weeks', 'Monthly'].map((v, i) => `<button data-value="${v}" aria-selected="${!i}">${v}</button>`).join('')}</div><div class="collapsible mo-rm-c"><div><p class="mo-rm-p">A collapsible section — grid rows snap, opacity still fades.</p></div></div>`;

  add([
    E({ id: 'peek-slide', name: 'Side peek · slide in & out', summary: 'The peek slides in from the right edge on the drawer curve, keeping the agenda in view — it is a place beside the list, not a new page.',
      trigger: 'click an agenda card (T.select → T.peek.show({ animate: true })); × or Esc closes', element: '.peek (right panel, width max(440px, 44%)) · .main.peek-open (agenda right padding)', properties: 'transform translateX(calc(100% + 48px)) → none · visibility hidden → visible (on at the start of enter, off at the end of exit) · agenda padding-right changes instantly',
      enter: '300ms var(--ease-drawer)', exit: '200ms var(--ease-out); visibility hides after 200ms', interruptible: 'yes — CSS transition, reverses mid-slide', keyboard: 'Enter opens instantly (.instant, no transition); Esc closes with the 200ms exit; after Back the peek is restored instantly', reduced: '.instant — no slide',
      motion: 'slides in 300ms --ease-drawer, out 200ms --ease-out', mapsTo: `<AnimatePresence>{open && <motion.aside initial={{ x: 'calc(100% + 48px)' }} animate={{ x: 0, transition: { duration: 0.3, ease: ${ED} } }} exit={{ x: 'calc(100% + 48px)', transition: { duration: 0.2, ease: ${EO} } }} />}</AnimatePresence> — pass duration 0 when opened by Enter`,
      source: '002 app-peek.js openPanel, closePanel, show, close · app.css .peek, .peek.open, .peek.instant, .main.peek-open', tokens: ['--ease-drawer', '--ease-out', '--peek-w'], timing: [['open', 300, '--ease-drawer', 'yes'], ['close', 200, '--ease-out', 'yes']],
      stories: [demo({ label: 'Agenda + side peek', note: 'Click a card, ×, Enter (instant) or Replay', span: 'full', flush: true, ctrls: [['Enter · instant', (c) => { peekClose(c, false); requestAnimationFrame(() => peekOpen(c, false)); }], ['Esc', (c) => peekClose(c)]], html: peekWin,
        init: (c) => { selectCard(c, 't2'); c.addEventListener('click', (e) => { if (e.target.closest('.pk-x')) peekClose(c); const card = e.target.closest('.a-card'); if (card && !q(c, '.peek.open')) { selectCard(c, card.dataset.id); peekOpen(c); } }); },
        run: (c) => seq(c, [[0, () => peekClose(c)], [650, () => { selectCard(c, 't2'); peekOpen(c); }]]) })] }),
    E({ id: 'peek-swap', name: 'Side peek · content swap', summary: 'Clicking another card blur-crossfades the peek; arrowing through the list swaps it instantly so fast keyboard scanning never waits on motion.',
      trigger: 'click another card while the peek is open (show({ crossfade: true })) · ↑/↓ (T.moveSelection, animate: false)', element: '#pkContent · the selection ring on the card', properties: 'crossfade: out opacity → 0 + blur 2px · swap + scroll to top · in opacity 0 → 1, blur → 0 · selection ring moves instantly',
      enter: '190ms var(--ease-out)', exit: '110ms ease-out', interruptible: 'restart — a keyboard swap cancels a running crossfade', keyboard: '↑/↓ swap the content and ring instantly (no crossfade), scroll resets', reduced: 'instant',
      motion: 'pointer: 110ms out / 190ms in with 2px blur · keyboard: instant', mapsTo: `<AnimatePresence mode="wait" initial={false}><motion.div key={selectionId} initial={{ opacity: 0, filter: 'blur(2px)' }} animate={{ opacity: 1, filter: 'blur(0px)', transition: { duration: 0.19, ease: ${EO} } }} exit={{ opacity: 0, filter: 'blur(2px)', transition: { duration: 0.11 } }} /></AnimatePresence>; render without AnimatePresence when the change came from the keyboard`,
      source: '002 app-peek.js render({ crossfade }) → T.fx.crossfade · app-agenda.js T.select, T.moveSelection', tokens: ['--ease-out'], timing: [['content out', 110, 'ease-out', 'restart'], ['content in', 190, '--ease-out', 'restart', 110], ['keyboard swap', 0, 'instant', '—']],
      stories: [demo({ label: 'Click vs ↑/↓', note: 'Click Maria’s card (crossfade) or use the key buttons (instant)', span: 'full', flush: true, ctrls: [['↓ key · instant', (c) => peekSet(c, 't4', false)], ['↑ key · instant', (c) => peekSet(c, 't2', false)]], html: peekWin,
        init: (c) => { selectCard(c, 't2'); c.addEventListener('click', guard(c, (e) => { const card = e.target.closest('.a-card'); if (card && PK()[card.dataset.id] && !card.classList.contains('is-selected')) peekSet(c, card.dataset.id, true); })); },
        run: (c) => seq(c, [[0, () => peekSet(c, 't4', true)], [1600, () => peekSet(c, 't2', false)]]) })] }),
    E({ id: 'open-page', name: 'Open as page · swap & reveal', summary: 'From the peek to the full doc: the peek gets out of the way instantly, the page blur-swaps in already scrolled to the meeting, and a soft flash marks where you are.',
      trigger: '“Open as page” in the peek (or context menu); evidence “Jump to …”', element: 'peek (.instant close) · #view page · target section (#sec-next or #m-<id>)', properties: 'peek hides instantly · page out: opacity → 0 + blur 2px · paint doc · page in: opacity 0 → 1, translateY(4px) → 0 · target scrolled to the top instantly (scroll-margin-top toolbar + 20px) · target background flash (.receive)',
      enter: 'page in 180ms var(--ease-out) · receive 900ms var(--ease-out), 80ms after paint', exit: 'page out 120ms ease-out', sequence: 'Jump to (evidence): smooth scroll, then receive after 360ms', interruptible: 'restart — a swap token drops stale paints', keyboard: '⌘[ Back returns with the view fade and restores the peek instantly', reduced: 'no page swap; instant scroll; the receive flash stays (background only)',
      motion: 'page blur-out 120ms → rise-in 180ms; target flash 900ms', mapsTo: `navigate → <motion.div key={docId} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18, ease: ${EO} }} />; after paint: scrollRef.current.scrollTop = target.offsetTop - 72, then animate(target, receiveKeyframes, { duration: 0.9 }) after 80ms`,
      source: '002 app-peek.js peek-open-page · app-shell.js T.openDoc · doc-page.js D.paintPage, D.revealInPage, D.jumpToMeeting', tokens: ['--ease-out', '--accent-soft'], timing: [['page out', 120, 'ease-out', 'restart'], ['page in', 180, '--ease-out', 'restart', 120], ['reveal flash', 900, '--ease-out', 'restart', 200], ['jump-to flash delay', 360, '—', '—']],
      stories: [demo({ label: 'Peek → Product Sync doc → Back', note: 'Click “Open as page” / Back, or Replay', span: 'full', flush: true, html: peekWin,
        init: (c) => { selectCard(c, 't2'); c.addEventListener('click', guard(c, (e) => { if (e.target.closest('.pk-open')) openPage(c); if (e.target.closest('.tb-back')) pageBack(c); })); },
        run: (c) => seq(c, [[0, () => openPage(c)], [2800, () => pageBack(c)]]) })] }),
    E({ id: 'collapsible', name: 'Collapsible · meetings & banner', summary: 'Sections open in place: the body unfolds, the chevron turns and the one-line summary steps aside, so the list reads as the same list, just deeper.',
      trigger: 'click a past-meeting head (D.toggleMeeting); Hide the calendar banner / last proposal decided (T.updateBanner); peek “Open transcript”; New series linked row', element: '.collapsible (grid) > child · .disclosure chevron · .mtg-line summary', properties: 'grid-template-rows 1fr ↔ 0fr + opacity · chevron rotate(0 → 90deg) · summary line opacity 1 → 0 while open',
      enter: 'rows 260ms var(--ease-out), opacity 200ms ease · chevron 200ms var(--ease-out) · summary line 180ms var(--ease-out)', exit: 'symmetric', interruptible: 'yes — CSS transitions retarget mid-way', keyboard: 'Open as page / Jump expand the target meeting as they scroll to it', reduced: 'rows and chevron snap; opacity still fades',
      motion: 'grid-rows unfold 260ms --ease-out with a 200ms fade; chevron turns 90° in 200ms', mapsTo: `Radix Collapsible + <motion.div initial={false} animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }} transition={{ height: { duration: 0.26, ease: ${EO} }, opacity: { duration: 0.2 } }} style={{ overflow: 'hidden' }} />; chevron <motion.svg animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.2, ease: ${EO} }} />`,
      source: 'kit/mac-kit.css .collapsible, .disclosure · 002 doc-page.js D.toggleMeeting, D.togglePeekTranscript · doc.css .mtg-line · app-agenda.js T.updateBanner', tokens: ['--ease-out'], timing: [['rows', 260, '--ease-out', 'yes'], ['fade', 200, 'ease', 'yes'], ['chevron', 200, '--ease-out', 'yes'], ['summary line', 180, '--ease-out', 'yes']],
      stories: [demo({ label: 'Past meetings', note: 'Click a head or Replay', flush: true, html: () => `<div class="mo-clip mo-fade" style="--h:360px"><div class="doc-surface mo-doc"><div class="past-list">${sc('before', () => [PS().m36, PS().m35, PS().m34].map((m) => D.meetingMarkup(PS().s, m)).join(''))}</div></div></div>`,
        init: (c) => c.addEventListener('click', (e) => { const head = e.target.closest('.mtg-head'); if (head && !e.target.closest('.mtg-more')) toggleMtg(head.closest('.mtg')); }),
        run: (c) => { const [a, b] = qa(c, '.mtg'); seq(c, [[0, () => toggleMtg(a, false)], [700, () => toggleMtg(b, true)], [2100, () => toggleMtg(b, false)], [2800, () => toggleMtg(a, true)]]); } }),
        demo({ label: 'Calendar banner', note: '× hides it · Replay hides and restores', flush: true, html: () => `<div class="mo-clip mo-fade" style="--h:230px"><div class="agenda-inner">${BANNER}<div class="a-timeline">${dayM(1, 2)}</div></div></div>`,
          init: (c) => q(c, '.mo-hide').addEventListener('click', () => q(c, '.a-banner-wrap').classList.add('collapsed')),
          run: (c) => { const b = q(c, '.a-banner-wrap'); seq(c, [[0, () => b.classList.add('collapsed')], [1300, () => b.classList.remove('collapsed')]]); } })] }),
    E({ id: 'next-repaint', name: 'Next block · repaint', summary: 'When the brief changes state (ready, recording, preparing the summary) the block blurs out and rises back in with its new content.',
      trigger: 'brief finishes preparing (2.6s after the peek shows it), recording starts / stops, summary filed (D.paintNextBlock)', element: '.next section in the page and the peek', properties: 'out: opacity → 0 + blur 2px · swap class + content · in: opacity 0 → 1, translateY(4px) → 0',
      enter: '200ms var(--ease-out)', exit: '120ms ease-out', interruptible: 'restart', keyboard: '⌘R — same', reduced: 'instant',
      motion: 'blur-out 120ms, rise-in 200ms --ease-out', mapsTo: `<AnimatePresence mode="wait" initial={false}><motion.section key={state} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0, transition: { duration: 0.2, ease: ${EO} } }} exit={{ opacity: 0, filter: 'blur(2px)', transition: { duration: 0.12, ease: 'easeOut' } }} /></AnimatePresence>`,
      source: '002 doc-render.js D.paintNextBlock, D.nextParts · app-peek.js maybePrepare · app-record.js repaint', tokens: ['--ease-out'], timing: [['block out', 120, 'ease-out', 'restart'], ['block in', 200, '--ease-out', 'restart', 120], ['brief prepared after', 2600, '—', '—']],
      stories: [demo({ label: 'Brief → recording → preparing summary → brief', note: 'Replay walks the states', flush: true, html: () => `<span class="mo-state">Brief ready</span><div class="mo-clip mo-fade" style="--h:400px"><div class="doc-surface mo-doc mo-pad">${NEXTS()[0][1]}</div></div>`,
        run: (c) => seq(c, NEXTS().map((step, i) => [i * 1500, () => repaintNext(c, step, i > 0)])) })] }),
    E({ id: 'live-lines', name: 'Live lines · append', summary: 'Transcript lines and the one “Worth asking now” arrive at the bottom of the live block with a small rise, so new speech is noticeable but calm.',
      trigger: 'a transcript line or the suggestion arrives while recording (scripted at 1.4s, 3.8s and 5.8s after start)', element: '[data-live-lines] > .live-line / .ask (doc page and peek)', properties: 'opacity 0 → 1 · translateY(6px) → 0 (.enter) · the “Listening…” placeholder is removed instantly',
      enter: '280ms var(--ease-out)', interruptible: 'restart', reduced: 'lines appear at once',
      motion: 'each new line rises 6px and fades in, 280ms --ease-out', mapsTo: `<AnimatePresence initial={false}>{lines.map((l) => <motion.div key={l.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: ${EO} }} />)}</AnimatePresence>`,
      source: '002 app-record.js appendLine, LIVE_SCRIPT, T.scheduleLive · doc-render.js liveInner · kit .enter', tokens: ['--ease-out', '--coral'], timing: [['first line', 280, '--ease-out', 'restart', 1400], ['second line', 280, '--ease-out', 'restart', 3800], ['Worth asking now', 280, '--ease-out', 'restart', 5800]],
      stories: [demo({ label: 'Recording · Listening… → lines', note: 'Replay restarts the live script', flush: true, html: () => `<div class="mo-clip" style="--h:360px"><div class="doc-surface mo-doc mo-pad">${LIVE0()}</div></div>`, init: (c) => clock(c, q(c, '[data-rec-timer]'), 0),
        run: (c) => { const box = q(c, '[data-live-lines]'); box.innerHTML = '<div class="live-line listening">Listening…</div>'; clock(c, q(c, '[data-rec-timer]'), 0); seq(c, [[1400, liveAdd(box, lineM(0))], [3800, liveAdd(box, lineM(1))], [5800, liveAdd(box, askM())]]); } })] }),
    E({ id: 'review', name: 'Review · accept, correct, reject', summary: 'Review decisions apply instantly — the row simply becomes its new state — and the motion happens where the item lands: Memory, counts and the list.',
      trigger: 'Accept / Correct / Reject / Undo on a candidate; Accept all', element: '.cand row (re-rendered) · .review-head · .mtg-counts · the Memory item · the scrubber Memory tick · sidebar Review count', properties: 'row swaps state at once (amber bar goes, “✓ In Memory”, strike-through when rejected, outlined field when correcting) · landed items receive (see Receive) · counts bump',
      enter: 'instant row swap · Memory receive 1500ms · tick receive 900ms · count bump 420ms', sequence: 'Accept all: 70ms per candidate so each one visibly lands; Review page: a meeting with nothing pending collapses after a 500ms beat (removeAnimated 220ms)', interruptible: 'n/a (instant); receive restarts', keyboard: 'Enter saves a correction, Esc cancels — instant', reduced: 'same (receive is background-only)',
      motion: 'no row animation; feedback is the Memory receive and the count bump', mapsTo: 'Render the row state directly (no AnimatePresence on it); play the receive keyframes on the Memory item when it mounts; Accept all: pending.forEach((c, i) => setTimeout(() => accept(c), i * 70))',
      source: '002 doc-review.js D.setCandState, acceptOne, D.acceptAll · doc-past.js D.candRow, D.reviewHead · app-actions.js T.pagesAfterReview', tokens: ['--amber', '--accent-strong'], timing: [['row swap', 0, 'instant', '—'], ['accept all step', 70, '—', '—'], ['collapse beat', 500, '—', '—']],
      stories: [demo({ label: 'Product Sync #37 candidates', note: 'Use the row buttons, Accept all, or Replay', span: 'full', flush: true, ctrls: [['Accept all', (c) => acceptAll(c)], ['Reset', (c) => candReset(c)]], html: () => `<div class="mo-clip" style="--h:280px"><div class="doc-surface mo-doc mo-pad"><div class="review">${reviewM(CANDS())}</div></div></div>`,
        init: (c) => c.addEventListener('click', guard(c, (e) => { const b = e.target.closest('[data-act]'); const row = b && b.closest('.cand'); if (b && b.dataset.act === 'accept-all') acceptAll(c); else if (row && CAND_ACTS[b.dataset.act]) candSet(c, row.dataset.cid, CAND_ACTS[b.dataset.act]); })),
        run: (c) => { candReset(c); const [a, b, d] = CANDS().map((x) => x.id); seq(c, [[500, () => candSet(c, a, 'accepted')], [1200, () => candSet(c, b, 'rejected')], [1900, () => candSet(c, d, 'editing')], [3400, () => candReset(c)]]); } })] }),
    E({ id: 'list-height', name: 'List · remove & insert', summary: 'Items leave and arrive by folding their height, so neighbours close the gap (or make room) smoothly instead of jumping.',
      trigger: 'remove: decide a Found proposal, file an unfiled card, a fully reviewed meeting (Review page), move / unfile / split / delete a past meeting, stop tracking (sidebar row) · insert: new sidebar series row, new purpose agenda row (Enter), agenda item added (incl. from Worth asking), newest meeting filed, Undo of a moved meeting', element: 'any row or card (Kit.removeAnimated / Kit.enterAnimated)', properties: 'remove: height, margin-top/bottom, padding-top/bottom → 0 and opacity → 0 (overflow hidden), then removed · insert: height 0 → measured, opacity 0 → 1, then overflow restored',
      enter: 'insert 280ms var(--ease-out) (+ .receive when you should find it)', exit: 'remove 220ms var(--ease-out)', interruptible: 'no — each runs to completion', keyboard: 'Enter in the standing agenda inserts with the same expand (it creates content)', reduced: 'removed / inserted instantly', notes: 'Undo differs by place: Found proposals re-render instantly; moved meetings re-insert with the expand and a receive flash',
      motion: 'height folds away 220ms, unfolds 280ms, both --ease-out', mapsTo: `<AnimatePresence initial={false}>{items.map((i) => <motion.div key={i.id} initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1, transition: { duration: 0.28, ease: ${EO} } }} exit={{ height: 0, opacity: 0, marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0, transition: { duration: 0.22, ease: ${EO} } }} style={{ overflow: 'hidden' }} />)}</AnimatePresence>`,
      source: 'kit/mac-kit.js Kit.removeAnimated, Kit.enterAnimated · 002 app-flows.js decideProposal · app-actions.js T.fileUnfiled · app-shell.js T.revealSeriesRow, T.dropSeriesRow · doc-edit.js D.addAgendaItem, D.askToAgenda · doc-organize.js restore', tokens: ['--ease-out'], timing: [['remove', 220, '--ease-out', 'no'], ['insert', 280, '--ease-out', 'no']],
      stories: [demo({ label: 'Found in Calendar · decide', note: 'Click Track / Not a series, or Replay (Undo re-renders instantly)', flush: true, html: () => `<div class="mo-clip mo-fade" style="--h:380px"><div class="pg mo-pg">${FOUND()}</div></div>`,
        init: (c) => c.addEventListener('click', (e) => { const b = e.target.closest('[data-act^="prop-"]'); const card = b && b.closest('.a-pcard'); if (card) { card.style.pointerEvents = 'none'; Kit.removeAnimated(card); } }),
        run: (c) => { q(c, '.mo-pg').innerHTML = FOUND(); const card = q(c, '.a-pcard'); card.style.pointerEvents = 'none'; Kit.removeAnimated(card); seq(c, [[1500, () => { q(c, '.mo-pg').innerHTML = FOUND(); }]]); } }),
        demo({ label: 'Worth asking → agenda', note: 'Replay inserts the item with a receive flash', height: 250, low: true, html: () => `<div class="doc-surface mo-doc"><div class="nb-label">Agenda</div><div class="agenda">${PS().next.brief.agenda.map(D.agendaItem).join('')}</div></div>`,
          run: (c) => { const list = q(c, '.agenda'); qa(list, '.mo-added').forEach((el) => el.remove()); const el = node(D.agendaItem({ t: PS().next.brief.ask[0].text, d: '5m', added: true, fromAsk: true }, 9)); el.classList.add('mo-added'); list.appendChild(el); Kit.enterAnimated(el); D.receive(el); } })] }),
    E({ id: 'receive-bump', name: 'Receive & bump · landing feedback', summary: 'Whatever just arrived glows briefly, and any number that changed gives a small bump — the eye is pulled to exactly the thing that changed.',
      trigger: 'receive: accepted item in Memory, a flight landing (sidebar row, menu-bar item), Open as page target, Jump to meeting, agenda item from Worth asking, onboarding added row · bump: sidebar counts change, Island “N docs” chip, flight target icon', element: '.receive (D.receive restarts it) · .bump', properties: 'receive: background-color --accent-soft, held for 30%, → transparent · bump: transform scale 1 → 1.18 (40%) → 1',
      enter: 'receive 900ms var(--ease-out) (.mem-item 1500ms) · bump 420ms var(--ease-out)', interruptible: 'restart — remove the class, force a reflow, add it again', reduced: 'receive stays (background only); bump is turned off',
      motion: 'soft accent glow 900ms (Memory 1500ms); count bump to 1.18 in 420ms', mapsTo: `useAnimate(): animate(el, { backgroundColor: ['var(--accent-soft)', 'var(--accent-soft)', 'rgba(0,0,0,0)'] }, { duration: 0.9, times: [0, 0.3, 1], ease: ${EO} }) · animate(el, { scale: [1, 1.18, 1] }, { duration: 0.42, times: [0, 0.4, 1], ease: ${EO} })`,
      source: 'kit/mac-kit.css .receive, .bump, @keyframes kit-receive, kit-bump · 002 doc-page.js D.receive, D.paintPageMemory · app-shell.js T.updateCounts · doc.css .mem-item.receive · island.js patchBrief', tokens: ['--accent-soft', '--ease-out'], timing: [['bump', 420, '--ease-out', 'restart'], ['receive', 900, '--ease-out', 'restart'], ['Memory item receive', 1500, '--ease-out', 'restart']],
      stories: [demo({ label: 'Accepted items land in Memory', note: 'Replay receives two items', flush: true, html: () => `<div class="doc-surface mo-doc mo-pad">${MEM()}</div>`,
        run: (c) => { const [a, b] = qa(c, '.mem-group'); seq(c, [[0, () => D.receive(q(a, '.mem-item'))], [300, () => D.receive(q(b, '.mem-item'))]]); } }),
        demo({ label: 'Sidebar counts', note: 'Replay changes Review and Found', bg: 'sidebar', height: 200, html: () => `<div class="t-app mo-nav">${navM()}</div>`,
          run: (c) => { const n = (label) => q(c, `[data-nav="${label}"] .count`); const set = (label, v) => () => { n(label).textContent = v; restart(n(label), 'bump'); }; seq(c, [[0, set('Review', '4')], [400, set('Found in Calendar', '2')], [2000, set('Review', '5')], [2400, set('Found in Calendar', '3')]]); } })] }),
    E({ id: 'save-state', name: 'Save state · saving, saved & version bump', summary: 'Editing the purpose is saved silently: the toolbar says “Saving…” then “Saved”, the version ticks up once, and the “drafted” note steps aside.',
      trigger: 'typing in the purpose (D.onInput) or renaming the title', element: '#saveState (toolbar) · #purposeMeta (.sec-meta) · #draftedChip', properties: 'save label text swaps instantly “Saving…” → “Saved” 700ms after the last keystroke; colour --label-3 → --label-2 while busy · version meta re-enters opacity 0 → 1, translateY(3px) → 0 and turns accent · drafted chip opacity → 0, scale(0.96), then removed',
      enter: 'label colour 150ms ease · version bump 420ms var(--ease-out)', exit: 'drafted chip 160ms ease-out', interruptible: 'the 700ms debounce resets on every keystroke', keyboard: 'typing is the trigger; the label text never animates', reduced: 'drafted chip removed at once; .ver-bump still plays (not covered by the kit’s reduced block — production should reduce it to opacity)',
      motion: 'text swap + 150ms colour; one 420ms version bump on the first edit; drafted chip out 160ms', mapsTo: `Save label: plain text + transition-colors duration-150; version: <motion.span key={version} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.42, ease: ${EO} }} />; chip exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.16 } }}; debounce 700ms`,
      source: '002 doc-edit.js markEdited, scheduleSave, dropDraftedChip · app-shell.js T.setSaveState · doc.css .save-state, .ver-bump', tokens: ['--label-2', '--label-3', '--accent-strong'], timing: [['label colour', 150, 'ease', 'yes'], ['drafted chip out', 160, 'ease-out', 'no'], ['version bump', 420, '--ease-out', 'restart'], ['save debounce', 700, '—', 'resets']],
      stories: [demo({ label: 'Drafted purpose, first edit', note: 'Type in “Why we meet” or Replay', span: 'full', flush: true, ctrls: [['Reset', (c) => saveReset(c)]], html: () => winM({ h: 260, tb: docTb(PS().s, '', true), view: `<div class="canvas-inner"><article class="doc doc-surface">${saveM()}</article></div>` }),
        init: (c) => c.addEventListener('input', (e) => { if (e.target.closest('.p-why')) onEdit(c); }),
        run: (c) => { saveReset(c); const why = q(c, '.p-why'); const base = why.textContent; seq(c, [...' Weekly.'].map((ch, i) => [300 + i * 110, () => { why.textContent = base + ' Weekly.'.slice(0, i + 1); onEdit(c); }])); } })] }),
    E({ id: 'chips', name: 'Chips · attach, remove, include', summary: 'Attached files pop into the Reference row one after another; removed ones shrink away; the include dot fills or empties in place.',
      trigger: 'files dropped or picked into Reference / meeting docs; Remove from Reference; click the include dot', element: '.ref-chip / .doc-chip (.chip-in) · .inc-dot', properties: 'in: opacity 0 → 1, translateY(3px) scale(0.95) → none · out: opacity → 0, scale(0.95), then removed · include dot: accent fill ↔ inset ring',
      enter: 'chip-in 280ms var(--ease-out), 40ms apart · include dot 150ms ease', exit: 'chip out 150ms ease-out', interruptible: 'chip-in restarts; removal runs to completion', keyboard: '⌘O (file picker) → the same chip-in', reduced: 'removal is instant; .chip-in still plays (not covered by the kit’s reduced block)',
      motion: 'new chips rise 3px from 0.95 with a 40ms stagger; removed chips shrink to 0.95 in 150ms', mapsTo: `<motion.button initial={{ opacity: 0, y: 3, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15, ease: 'easeOut' } }} transition={{ duration: 0.28, ease: ${EO}, delay: i * 0.04 }} /> inside <AnimatePresence>`,
      source: '002 doc-edit.js animateNewChips, D.attachToPurpose, T.attachToMeeting · doc-popovers.js removeRef, setInclude · doc.css .chip-in, @keyframes chip-in, .inc-dot', tokens: ['--accent', '--label-3'], timing: [['chip in', 280, '--ease-out', 'restart'], ['second chip', 280, '--ease-out', 'restart', 40], ['include dot', 150, 'ease', 'yes'], ['chip out', 150, 'ease-out', 'no']],
      stories: [demo({ label: 'Reference row', note: 'Replay attaches two files, toggles a dot, removes one', height: 150, html: () => `<div class="doc-surface mo-doc"><div class="ref-row">${REF().base}</div></div>`, run: chipsRun })] }),
    E({ id: 'drop-targets', name: 'Drop targets · light up', summary: 'While something is dragged, the places that accept it light up with a dashed wash and a hint, and a sidebar row grows slightly under the pointer.',
      trigger: 'file drag over Purpose or “Docs for this meeting” (D.wireDrops) · meeting grip dragged over sidebar rows (D.wireMeetingDrag)', element: '.purpose.drop-target::after + .drop-hint · .next-docs.drop-target (kit dashed outline) · .t-app .sb-item.drop-over · .mtg.dragging · .sidebar.dnd rows', properties: 'purpose wash opacity 0 → 1 · hint opacity + translateY(4px) scale(0.97) → none · sidebar row → --accent-soft + scale(1.03) · dragged meeting opacity 0.45 (instant) · dnd rows get an inset accent ring (instant)',
      enter: 'wash 150ms ease · hint opacity 150ms, transform 200ms var(--ease-out) · row scale 140ms var(--ease-out), background 120ms ease · next-docs outline instant', exit: 'same', interruptible: 'yes — CSS transitions', reduced: 'opacity and colour only',
      motion: 'dashed wash 150ms; hint rises 200ms --ease-out; target row grows to 1.03 in 140ms', mapsTo: `Track drag state (onDragEnter / onDragLeave counters) → data-drop on the zone; CSS transitions as listed; sidebar row <motion.div animate={{ scale: over ? 1.03 : 1 }} transition={{ duration: 0.14, ease: ${EO} }} /> — Tauri: onDragDropEvent on the window`,
      source: '002 doc-edit.js setZone, wireZone · doc.css .purpose::after, .drop-hint · app.css .t-app .sb-item.drop-over, .sidebar.dnd · doc-organize.js onDragStart, setDropRow', tokens: ['--accent', '--accent-soft', '--accent-softer'], timing: [['sidebar drop-over', 140, '--ease-out', 'yes'], ['purpose wash', 150, 'ease', 'yes'], ['drop hint', 200, '--ease-out', 'yes']],
      stories: [demo({ label: 'Purpose accepts a file · a sidebar row accepts a meeting', note: 'Replay lights each target in turn', span: 'full', height: 260,
        html: () => `<div class="mo-drop"><div class="doc-surface mo-doc"><section class="doc-sec purpose"><div class="p-block"><div class="p-label">Why we meet</div><p class="p-why">${esc(PS().s.purpose.why)}</p></div><div class="ref-row">${D.referenceInner(PS().s)}</div><div class="drop-hint">${icon('tray-down')}Drop to add to Reference</div></section></div><div class="t-app mo-sb">${SERIES().slice(0, 3).map((s) => sRow(s)).join('')}</div></div>`,
        run: (c) => { const [p, row] = [q(c, '.purpose'), qa(c, '.a-sb-row')[1]]; seq(c, [[0, () => p.classList.add('drop-target')], [1400, () => p.classList.remove('drop-target')], [1700, () => row.classList.add('drop-over')], [2900, () => row.classList.remove('drop-over')]]); } })] }),
    E({ id: 'drawer', name: 'Transcript drawer · slide & shift', summary: 'The transcript drawer floats in from the right while the doc column slides left just enough to stay readable beside it.',
      trigger: 'Open transcript · evidence → transcript · Details (inspector) button', element: '.drawer (glass, 340px, floats inside .main) · .canvas-inner (doc column) · .scrubber', properties: 'drawer translateX(calc(100% + 24px)) → none + visibility · doc column translateX(0 → --shift) · scrubber opacity → 0 · highlighted line background; the body scrolls to centre it instantly',
      enter: 'drawer 300ms var(--ease-drawer) · column 300ms var(--ease-drawer) · scrubber 200ms ease', exit: 'drawer 200ms var(--ease-drawer), visibility after 200ms · column 200ms', interruptible: 'yes — CSS transitions', keyboard: 'Esc closes with the 200ms exit', reduced: 'no slide or shift; the scrubber fade stays',
      motion: 'drawer + column move together on --ease-drawer: 300ms open, 200ms close', mapsTo: `<motion.aside initial={{ x: 'calc(100% + 24px)' }} animate={{ x: 0 }} exit={{ x: 'calc(100% + 24px)', transition: { duration: 0.2, ease: ${ED} } }} transition={{ duration: 0.3, ease: ${ED} }} /> + the doc column <motion.div animate={{ x: open ? -shift : 0 }} transition={{ duration: open ? 0.3 : 0.2, ease: ${ED} }} />`,
      source: '002 doc-page.js D.openDrawer, shiftCanvas, D.closeDrawer, D.openTranscript · doc.css .drawer, .canvas-inner, .main.drawer-open .scrubber', tokens: ['--ease-drawer', '--glass-strong', '--shadow-float'], timing: [['open', 300, '--ease-drawer', 'yes'], ['close', 200, '--ease-drawer', 'yes'], ['scrubber fade', 200, 'ease', 'yes'], ['highlight line', 300, 'ease', 'yes']],
      stories: [demo({ label: 'Transcript · Tue 22 Sep', note: 'Replay opens and closes it', span: 'full', flush: true, ctrls: [['Open', (c) => drawer(c, true)], ['Close', (c) => drawer(c, false)]],
        html: () => winM({ h: 400, tb: docTb(PS().s, '', true), view: `<div class="canvas-inner"><article class="doc doc-surface">${sc('before', () => D.headerMarkup(PS().s) + D.memoryMarkup(PS().s))}</article></div>`, extra: `${SCRUB(1)}<aside class="drawer">${sc('before', () => D.drawerTranscript(PS().s, PS().m36, '18:42'))}</aside>` }),
        init: (c) => c.addEventListener('click', (e) => { if (e.target.closest('[data-act="close-drawer"]')) drawer(c, false); }), run: (c) => seq(c, [[0, () => drawer(c, true)], [2300, () => drawer(c, false)]]) })] }),
    E({ id: 'scrubber', name: 'Scrubber · active tick & labels', summary: 'The right-edge scrubber is quiet ticks until hovered; the tick for the section you are reading grows and turns accent as you scroll.',
      trigger: 'scrolling the doc (IntersectionObserver + rAF-throttled scroll) → active mark · hover → labels · accepted Memory → tick receive · click → smooth scroll to the section', element: '.scrubber · .scrub-item.active .scrub-tick · .scrub-label', properties: 'tick scaleX(0.56) → 1 and --label-4 → --accent · labels opacity 0 → 1, translateX(4px) → 0 · glass background on hover · tick receive: scale(1.2, 2.4) + accent at 30%',
      enter: 'tick 200ms var(--ease-out) · labels 150ms var(--ease-out) · glass 200ms ease · receive 900ms var(--ease-out) · press 0.96 in 140ms', interruptible: 'yes (transitions); receive restarts', keyboard: 'click scrolls smoothly (instantly under reduced motion)', reduced: 'labels fade without sliding; the tick changes colour, width snaps',
      motion: 'active tick grows + tints 200ms; labels slide in 150ms on hover; receive pulse 900ms', mapsTo: `useInView per section → activeId; <motion.span animate={{ scaleX: active ? 1 : 0.56 }} style={{ originX: 1 }} transition={{ duration: 0.2, ease: ${EO} }} />; labels group-hover:opacity-100 group-hover:translate-x-0 duration-150`,
      source: '002 doc-page.js D.refreshMarks, D.updateActiveMark, D.scrubTo · doc.css .scrubber, .scrub-tick, @keyframes tick-receive', tokens: ['--accent', '--label-4', '--glass-strong'], timing: [['labels', 150, '--ease-out', 'yes'], ['tick', 200, '--ease-out', 'yes'], ['tick receive', 900, '--ease-out', 'restart']],
      stories: [demo({ label: 'Doc scrubber', note: 'Hover it or Replay', flush: true, html: () => winM({ h: 320, tb: docTb(PS().s, '', true), view: `<div class="canvas-inner"><article class="doc doc-surface">${sc('before', () => D.purposeMarkup(PS().s))}</article></div>`, extra: SCRUB(0) }),
        run: (c) => { const [bar, items] = [q(c, '.scrubber'), qa(c, '.scrub-item')]; const at = (i) => () => items.forEach((b, j) => b.classList.toggle('active', i === j)); seq(c, [[0, () => force(bar, 'hover', true)], ...[2, 3, 4, 5, 1].map((i, n) => [400 + n * 380, at(i)]), [2500, () => restart(q(items[1], '.scrub-tick'), 'receive')], [3600, () => force(bar, 'hover', false)], [3700, at(0)]]); } })] }),
    E({ id: 'fly-new', name: 'Fly to sidebar · new series', summary: 'Creating or tracking a series sends a small copy of it flying into the sidebar, where the row glows and its icon bumps — you see exactly where it went.',
      trigger: 'Create in New series · Track as series (Found) · Track on a card or in the peek · Undo of stop-tracking', element: 'a floating chip (.fly-chip / T.flyMarkup) from the source (#newPreview, proposal card, event card) to the sidebar row', properties: 'flyer x: translateX(0 → dx) · flyer y: translateY(0 → dy) + scale(1 → max(0.4, target h / source h)) + opacity 1 → 0.35 · target row: .landing (opacity 0) until the flyer lands (Create) or height-expands in (Track) · on landing: row .receive + series icon .bump',
      enter: '560ms — x cubic-bezier(0.45, 0, 0.2, 1), y/scale/opacity cubic-bezier(0.6, 0, 0.9, 0.7): the split easing curves the path', exit: 'flyer removed on finish · receive 900ms · bump 420ms · landing row opacity 150ms', interruptible: 'no — one flight per action', keyboard: '⌥⌘N → Enter flies the same way (it confirms a creation)', reduced: 'no flight; the target receives immediately',
      motion: '560ms arc (split x/y easing), shrinking toward the row; landing glow + icon bump', mapsTo: 'Portal flyer of two nested motion.divs: outer animate={{ x: dx }} transition={{ duration: 0.56, ease: [0.45, 0, 0.2, 1] }}, inner animate={{ y: dy, scale, opacity: 0.35 }} transition={{ duration: 0.56, ease: [0.6, 0, 0.9, 0.7] }}; onAnimationComplete → receive + bump the target',
      source: 'kit/mac-kit.js Kit.flyTo · 002 app-flows.js createSeries · app-shell.js T.revealSeriesRow, T.flyMarkup · app.css .t-app .sb-item.landing', tokens: ['--glass-strong', '--shadow-float', '--accent-soft'], timing: [['landing row fade', 150, 'ease', 'yes', 560], ['flight', 560, 'split cubic-bezier', 'no'], ['icon bump', 420, '--ease-out', 'restart', 560], ['row receive', 900, '--ease-out', 'restart', 560]],
      stories: [demo({ label: 'Create “Growth Review”', note: 'Replay = Create (row waits for the flyer) · Track = row expands first', span: 'full', flush: true, ctrls: [['Track · row expands', (c) => flyNew(c, true)]],
        html: () => winM({ h: 380, side: sideM('', 4), tb: agTb(), view: `<div class="mo-flysrc">${newPop('Weekly Growth Review with Priya, Thu 11am')}</div>` }), run: (c) => flyNew(c, false) })] }),
    E({ id: 'move-meeting', name: 'Move meeting · fold out & fly', summary: 'Moving a meeting to another series folds it out of the list while a date chip flies to the destination row — the two motions tell one story.',
      trigger: 'meeting ⋯ menu → Move to another series / Remove from this doc / Split into new doc · dragging the grip onto a sidebar row', element: '.mtg (past meeting) → sidebar series row, or the Review row', properties: 'flyer .fly-chip (calendar icon + date) from the meeting head to the row, while the meeting height-collapses · target row receives · drag-and-drop skips the flight (the row receives) · Undo re-inserts with the height expand + receive',
      enter: 'flight 560ms (split easing) · collapse 220ms var(--ease-out) · receive 900ms', sequence: 'flight and collapse run in parallel; unfile updates the counts after 560ms so the Review count bumps as the chip lands', interruptible: 'no', keyboard: 'menu selection (instant menu) → the same flight', reduced: 'no flight, no collapse; the row receives',
      motion: 'fold out 220ms + 560ms flight to the row; Undo unfolds 280ms with a glow', mapsTo: 'Run the portal flyer (see Fly to sidebar) and the list exit (AnimatePresence, height → 0, 0.22s) together; Undo re-adds the item with the enter height animation and the receive keyframes',
      source: '002 doc-organize.js leaveList, D.moveMeetingFlow, D.unfileMeetingFlow, D.splitMeetingFlow, restore', tokens: ['--ease-out', '--accent-soft'], timing: [['count update delay', 560, '—', '—']],
      stories: [demo({ label: 'Tue 15 Sep → Acme', note: 'Replay moves it, then Undo brings it back', span: 'full', flush: true, ctrls: [['Remove from this doc', (c) => moveMtg(c, 'review')], ['Drag onto a row', (c) => moveMtg(c, 'drag')]],
        html: () => winM({ h: 400, side: sideM('product-sync', 5), tb: docTb(PS().s, '', true), view: `<div class="canvas-inner"><article class="doc doc-surface"><section class="doc-sec past"><div class="sec-head"><span class="sec-eyebrow">Meetings</span><span class="sec-caption">Newest first · filed by Telu</span></div><div class="past-list">${PAST()}</div></section></article></div>` }), run: (c) => moveMtg(c, 'fly') })] }),
    E({ id: 'recording', name: 'Recording · pulse, bars & timer', summary: 'While Telu records, a pulsing coral dot, moving bars and a ticking timer say “live” everywhere at once — status, not decoration.',
      trigger: 'recording is on (and “Starting now” before it)', element: '.rec-dot (capsule, card eyebrow, doc live strip, status item, Island) · .a-card.is-starting .a-mini-dot · .countdown .mini-dot · .wave (a-wave 11px, live-wave, il-wave 13px) · [data-rec-timer] / [data-il-elapsed]', properties: 'dot opacity 1 → 0.3 → 1 · bars scaleY(0.3) → 1 → 0.3 with negative delays 0, −200, −450, −650, −100ms (never in sync) · timer text every second; tabular-nums + min-width 30–36px keep it steady; the Island refits its width when 9:59 becomes 10:00',
      enter: 'dot 1.4s ease-in-out infinite · bars 900ms ease-in-out infinite · timer setInterval 1000ms', interruptible: 'loops; Island pause freezes them (animation none, dot opacity 0.45, bars at 0.3)', reduced: 'dot slowed to 2.4s (kept — it carries status); bars stop at rest; timer unchanged',
      motion: 'rec dot 1.4s pulse · waveform 900ms staggered bars · timer ticks without animation', mapsTo: 'CSS keyframes (cheapest): @keyframes rec { 50% { opacity: .3 } } 1.4s ease-in-out infinite; bars scaleY keyframes 900ms with negative delays — production can drive scaleY from the real input level via a motion value; timer: useEffect interval 1000ms, font-variant-numeric: tabular-nums',
      source: 'kit/mac-kit.css .rec-dot, @keyframes kit-rec, .wave, @keyframes kit-wave, Kit.timer · 002 app.css .a-card.is-starting .a-mini-dot · doc.css .countdown .mini-dot · island.css .island .rec-dot.paused, .island .wave.paused, tick → refit', tokens: ['--coral', '--coral-soft'], timing: [['timer tick', 1000, 'step', 'loop'], ['waveform bars', 900, 'ease-in-out', 'loop'], ['rec dot', 1400, 'ease-in-out', 'loop']],
      stories: [demo({ label: 'Capsule · live strip · starting chip', note: 'The capsule timer starts at 9:57 to show 10:00 holding its width', height: 200,
        html: () => `<div class="mo-col">${CAPSULE}<div class="doc-surface"><div class="live-strip"><span class="rec-dot"></span><b>Recording</b><span class="live-timer num" data-rec-timer>12:04</span><span class="wave live-wave"><i></i><i></i><i></i><i></i><i></i></span><span class="live-note">${icon('lock', 'sm')}Transcribing on this Mac</span></div></div><span class="chip coral countdown"><span class="mini-dot"></span>Starting now</span></div>`,
        init: (c) => { const [a, b] = qa(c, '[data-rec-timer]'); Kit.timer(a, 597); Kit.timer(b, 724); } }),
        { label: 'Waveforms · card · doc · Island', note: '11px · 14px · 13px', height: 200, html: '<div class="row-flex mo-waves"><span class="wave a-wave"><i></i><i></i><i></i><i></i><i></i></span><span class="wave live-wave"><i></i><i></i><i></i><i></i><i></i></span><span class="wave il-wave"><i></i><i></i><i></i><i></i><i></i></span></div>' }] }),
    E({ id: 'loading', name: 'Loading · shimmer & spinner', summary: 'Work in progress is shown where the result will appear: a shimmer where text is coming, a small spinner where a job is running.',
      trigger: 'brief being prepared, summary being prepared, Island filing', element: '.shimmer (chips “Preparing brief” / “Preparing summary…”, .prep-lines) · .spinner (14px, .tiny 10px, Island filing 13px)', properties: 'shimmer: background-position 100% → −100% across a 200%-wide --fill → --fill-3 → --fill gradient · spinner: rotate 0 → 360deg',
      enter: 'shimmer 1.3s linear infinite · spinner 700ms linear infinite', interruptible: 'loops — removed when the state ends', reduced: 'shimmer stops on a flat fill; the spinner keeps turning (status)',
      motion: 'shimmer sweep 1.3s linear; spinner 700ms linear', mapsTo: 'Tailwind bg-[length:200%_100%] animate-[shimmer_1.3s_linear_infinite] with @keyframes shimmer { from { background-position: 100% 0 } to { background-position: -100% 0 } }; spinner: lucide Loader2 / border spinner with animate-spin at 700ms',
      source: 'kit/mac-kit.css .shimmer, @keyframes kit-shimmer, .spinner, @keyframes kit-spin · 002 app-agenda.js chipMarkup · doc-render.js preparingInner, provenance · island.js filingPill', tokens: ['--fill', '--fill-3', '--label-2'], timing: [['spinner', 700, 'linear', 'loop'], ['shimmer', 1300, 'linear', 'loop']],
      stories: [{ label: 'Chips · preparing', note: 'Agenda card chips and spinners', height: 180, html: '<div class="mo-col"><span class="chip shimmer a-chip-prep">Preparing brief</span><span class="chip shimmer a-chip-prep">Preparing summary…</span><div class="row-flex"><span class="spinner"></span><span class="spinner tiny"></span></div></div>' },
        { label: 'Next block · preparing summary', note: 'Spinner title + shimmer lines', span: 2, height: 180, align: 'stretch', html: () => safe(() => `<div class="doc-surface mo-doc">${NEXTS()[2][1]}</div>`) }] }),
    E({ id: 'island-morph', name: 'Island · morph between modes', summary: 'The Island is one shape that changes: its glass shell springs to each new size while the old content leaves first and the new content arrives just after — it never pops.',
      trigger: 'Island.set(mode) from the app (scenario, recording, filing), expand / collapse and flashes', element: '.island (glass shell, overflow hidden) + one .il content layer per variant', properties: 'shell width, height, border-radius (pill h/2 = 18px · cards 22px · drop target 20px) · new layer: opacity 0 → 1, blur 2px → 0, scale(0.97) → 1 (.pre removed next frame) · old layer: opacity → 0, blur 2px (.out), removed after 160ms',
      enter: 'shell var(--spring-dur) var(--spring) — 490ms, bounce 0.12 · layer in: opacity / blur 160ms, transform 240ms var(--ease-out), delayed 80ms after the shell starts when growing', exit: 'old layer 90ms ease-out at once; when the new area is smaller the shell waits --morph-delay 90ms so content leaves before it shrinks, and the new layer enters at 90 + 80 = 170ms', interruptible: 'yes — CSS transitions retarget from the current size; stacked layers retire in order', keyboard: 'coming back from hidden (or the first paint) is instant — no morph', reduced: 'size snaps (width / height / radius are not in the reduced list); layers still crossfade',
      notes: 'one Island exists per page (a singleton); these demos re-claim it into their own stage on every step, so the Island section’s playground may show a stale copy until it is used again',
      motion: 'shell springs 490ms (--spring); content out 90ms, in +80ms (170ms when shrinking)', mapsTo: `Separate transparent always-on-top NSPanel window. <motion.div animate={{ width, height, borderRadius }} transition={${SPR}}> (measured sizes, not layout scale, so text never stretches) + <AnimatePresence mode="popLayout"><motion.div key={variant} initial={{ opacity: 0, filter: 'blur(2px)', scale: 0.97 }} animate={{ opacity: 1, filter: 'blur(0px)', scale: 1, transition: { delay: shrinking ? 0.17 : 0.08, duration: 0.16, scale: { duration: 0.24, ease: ${EO} } } }} exit={{ opacity: 0, filter: 'blur(2px)', transition: { duration: 0.09 } }} /></AnimatePresence>; the Tauri panel is sized to the largest variant up front`,
      source: '002 island.js morph, resize, retire, fix, radiusFor · island.css .island, .il, .il.pre, .il.out', tokens: ['--spring', '--spring-dur', '--glass-strong', '--ease-out'], timing: [['old layer out', 90, 'ease-out', 'yes'], ['shell spring (grow)', 490, '--spring', 'yes'], ['new layer in (grow)', 240, '--ease-out', 'yes', 80], ['shell spring (shrink)', 490, '--spring', 'yes', 90], ['new layer in (shrink)', 240, '--ease-out', 'yes', 170]],
      stories: [demo({ label: 'Every mode', span: 'full', note: 'Pick a mode or Replay the day: before → starting → live → filing → after → setup', flush: true, ctrls: ['before', 'starting', 'live', 'filing', 'after', 'setup'].map((mode) => [mode, (c) => { islEnsure(c); Island.set(mode); }]), html: () => islDesk(),
        run: (c) => { islMount(c, 'before'); seq(c, [[900, 'starting'], [2200, 'live'], [3800, 'filing'], [4700, 'after'], [6100, 'setup'], [7300, 'before']].map(([ms, mode]) => [ms, iset(c, mode)])); } })] }),
    E({ id: 'island-hover', name: 'Island · hover intent & pin', summary: 'Resting the pointer on the pill opens the card after a short intent delay; leaving closes it after a grace period, so passing over it never flickers.',
      trigger: 'hover the pill (before, starting, live, after — when there is a subject) · click / Enter / Space pins · Esc or a click outside collapses', element: '.island (pill ↔ brief / live card / after card)', properties: 'expand 150ms after the pointer settles (not over a button) · collapse 300ms after it leaves unless pinned · pill press scale(0.97)',
      enter: 'intent 150ms → shell spring 490ms (see morph)', exit: '300ms grace → spring back', interruptible: 'yes — re-entering within 300ms cancels the collapse; hovering a button cancels the intent', keyboard: 'Enter / Space on the focused Island pins it open; Esc collapses — the morph still plays (it is the Island’s own state)', reduced: 'sizes snap; content crossfades',
      motion: '150ms intent, 300ms grace; the shell springs between pill and card', mapsTo: 'onPointerEnter → setTimeout(expand, 150) unless the target is a button; onPointerLeave → setTimeout(collapse, 300) unless pinned; clear both timers on re-enter; click / Enter pins, Esc collapses',
      source: '002 island.js intend, onEnter, onLeave, pin, collapse, onDocDown, MS.hoverIn / hoverOut · island.css .island[data-shape="pill"]:active', tokens: ['--spring'], timing: [['hover intent', 150, '—', 'cancels'], ['leave grace', 300, '—', 'cancels'], ['pill press', 180, '--ease-out', 'yes']],
      stories: [demo({ label: 'Hover → brief → leave · pin → Esc', span: 'full', note: 'Hover the Island yourself, or Replay', flush: true, ctrls: [['Hover', (c) => islEnsure(c).dispatchEvent(new PointerEvent('pointerenter'))], ['Click · pin', (c) => islEnsure(c).click()]], html: () => islDesk(),
        run: (c) => { islMount(c, 'before'); seq(c, [[500, ifire(c, 'pointerenter')], [2500, ifire(c, 'pointerleave')], [3700, iclick(c)], [5600, iesc(c)]]); } })] }),
    E({ id: 'island-attach', name: 'Island · attach & bouncy “Attached”', summary: 'Dragging a file anywhere turns the Island into a drop target; dropping lands with a bouncier spring — the one place Telu allows a little play.',
      trigger: 'a file drag anywhere while a meeting is attachable (before, starting, live)', element: '.island → hint pill (“Drop on Telu to attach to …”) → .il-drop.drop-target (380 × 104, radius 20) → “Attached” pill', properties: 'the shell morphs at each stage; “Attached” switches the shell to .bouncy; flashes return to the mode after their dwell',
      enter: 'hint / drop target 490ms --spring · Attached 600ms --spring-bounce (bounce 0.28)', sequence: 'dwell: Attached 1200ms · Already 1400ms · Invalid 1600ms · Skipped 1700ms; no dragover for 1000ms ends the drag', interruptible: 'yes', reduced: 'sizes snap',
      motion: 'drop target springs open; Attached lands on --spring-bounce (600ms) and returns after 1.2s', mapsTo: `Window-level drag listeners → Island variant 'hint' | 'drop'; on drop variant 'attached' for 1200ms with transition={${SPRB}}; Tauri: onDragDropEvent on the Island panel`,
      source: '002 island.js accept, setDrag, attach, flash, VIEWS.attached { bounce: true }, MS.attached / dragIdle · island.css .island.bouncy, .il-drop', tokens: ['--spring-bounce', '--spring-bounce-dur', '--accent'], timing: [['Attached (bouncy)', 600, '--spring-bounce', 'yes'], ['Attached dwell', 1200, '—', '—'], ['drag idle timeout', 1000, '—', '—']],
      stories: [demo({ label: 'Drag Sprint 43 plan.pdf onto the Island', span: 'full', note: 'After Replay mounts the Island, drag the desktop file yourself', flush: true, html: () => islDesk(true),
        run: (c) => { islMount(c, 'before'); seq(c, [[400, fileDrag(c, 'dragenter', false)], [900, fileDrag(c, 'dragover', false)], [1500, fileDrag(c, 'dragover', true)], [2000, fileDrag(c, 'dragover', true)], [2400, fileDrag(c, 'drop', true)]]); } })] }),
    E({ id: 'island-suggest', name: 'Island · mint dot & suggestion', summary: 'When Telu has one thing worth asking, a mint dot fades into the live pill and gently pulses; opening the card shows the suggestion rising into place.',
      trigger: '1200ms after live begins, if there is a suggestion', element: '.il-mint-dot in the live pill · .il-sugg card in the live card', properties: 'dot opacity 0 → 1, then opacity 1 ↔ 0.35 · card opacity 0, translateY(6px) scale(0.98) → none · Useful / Dismiss: card opacity → 0, scale(0.98), then removed and the shell refits',
      enter: 'dot fade 300ms var(--ease-out), pulse 1.8s ease-in-out infinite from 300ms · card 320ms var(--ease-out) after 140ms', exit: 'card 150ms var(--ease-out), then the shell springs smaller', interruptible: 'yes', reduced: 'no dot pulse and no card rise — both simply appear',
      motion: 'mint dot fades in then pulses 1.8s; suggestion rises 6px in 320ms (+140ms)', mapsTo: `dot: <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="animate-[pulse_1.8s_ease-in-out_0.3s_infinite]" />; card: <motion.div initial={{ opacity: 0, y: 6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.32, delay: 0.14, ease: ${EO} }} exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.15 } }} />`,
      source: '002 island.js arriveSuggestion, patchLivePill, patchSuggestion, feedback, MS.suggest · island.css .il-mint-dot, .il-sugg.arrive, .il-sugg.leaving', tokens: ['--mint', '--mint-soft', '--mint-ink'], timing: [['arrives after', 1200, '—', '—'], ['dot in', 300, '--ease-out', 'no', 1200], ['card arrive', 320, '--ease-out', 'no', 1340], ['card leave', 150, '--ease-out', 'no'], ['dot pulse', 1800, 'ease-in-out', 'loop']],
      stories: [demo({ label: 'Live pill → mint dot', span: 'full', note: 'Replay = pill · “Card” shows the suggestion arriving, then Dismiss', flush: true, ctrls: [['Card · suggestion arrives', (c) => { islMount(c, 'before'); seq(c, [[300, iset(c, 'live')], [450, iclick(c)], [3800, iclick(c, '.il-sugg [data-act="dismiss"]')]]); }]], html: () => islDesk(false, 440),
        run: (c) => { islMount(c, 'before'); seq(c, [[300, iset(c, 'live')]]); } })] }),
    E({ id: 'island-typing', name: 'Island · transcript typing', summary: 'Live lines type in word by word at speaking pace, so the card feels like it is listening rather than refreshing.',
      trigger: 'the live card opens; new transcript lines arrive', element: '.il-line.typing .w.h — one span per word; only the last two lines are shown', properties: 'each word opacity 0 → 1 (the .h class is removed one word at a time)',
      enter: 'one word every 80ms; each word fades 160ms var(--ease-out); starts 260ms after the card mounts, 120ms after new lines patch in', interruptible: 'stops if the layer retires; the typed count is remembered so re-expanding never retypes', reduced: 'all words appear at once',
      motion: 'words appear every 80ms, each fading 160ms', mapsTo: `<motion.span initial="h" animate="v" variants={{ v: { transition: { staggerChildren: 0.08, delayChildren: 0.26 } } }}>{words.map((w) => <motion.span variants={{ h: { opacity: 0 }, v: { opacity: 1, transition: { duration: 0.16, ease: ${EO} } } }}>{w} </motion.span>)}</motion.span>; keep a typedCount ref so re-renders do not replay`,
      source: '002 island.js lineHtml, typeLines, markTyped, patchLines, MS.type · island.css .il-line .w, .w.h', tokens: ['--ease-out'], timing: [['start delay', 260, '—', '—'], ['word fade', 160, '--ease-out', 'no', 260], ['next word', 160, '--ease-out', 'no', 340], ['word step', 80, 'step', 'no']],
      stories: [demo({ label: 'Two lines, typed', span: 'full', note: 'Replay opens the live card; a second line arrives at 3.4s', flush: true, html: () => islDesk(),
        run: (c) => { islMount(c, 'before', { lines: 1, sug: false }); seq(c, [[300, iset(c, 'live')], [420, iclick(c)], [3400, () => { islOpts = { lines: 2, sug: false }; islOwn(c); Island.refresh(); }]]); } })] }),
    E({ id: 'island-filing', name: 'Island · stop → filing → after', summary: 'Stopping a recording hands off visibly: the pill becomes “Filing…”, then “Filed” with what is left to review — the Island narrates the after-meeting moment.',
      trigger: 'Stop (Island, toolbar, ⌘R) → filing; summary ready (900ms beat in the prototype) → after', element: '.island pills: live → “Filing to Product Sync…” (spinner) → “✓ Filed to Product Sync · 5 to review”; hover → after card (counts, Review 5)', properties: 'shell morph between pills (spring) · spinner loop · the after card uses the same hover intent; clicking the after pill opens Review',
      enter: '490ms --spring per step', interruptible: 'yes', keyboard: '⌘R stop plays the same sequence', reduced: 'sizes snap',
      motion: 'live → filing → after, each a 490ms spring morph', mapsTo: 'Island variant state machine live → filing → after; each variant a keyed layer inside the springing shell (see Island · morph)',
      source: '002 island.js stop, filingPill, afterPill, afterCard · app-record.js T.stopRecording (SUMMARY_BEAT 900)', tokens: ['--spring', '--accent', '--amber'], timing: [['summary beat', 900, '—', '—']],
      stories: [demo({ label: 'Stop recording', span: 'full', note: 'Replay: live → filing → after → hover the after card', flush: true, html: () => islDesk(),
        run: (c) => { islMount(c, 'live', { lines: 2, sug: false }); seq(c, [[1300, iset(c, 'filing')], [2200, iset(c, 'after')], [3400, ifire(c, 'pointerenter')], [5600, ifire(c, 'pointerleave')]]); } })] }),
    E({ id: 'island-hide', name: 'Island · hide & show', summary: 'The Island steps back while onboarding owns the screen, fading and shrinking slightly, and returns already showing the right content.',
      trigger: 'onboarding opens (hidden) / closes (setup); first-run scenario', element: '.island.gone', properties: 'opacity 1 → 0 · scale(0.95) · pointer-events none; returning from hidden paints the new content instantly (no morph), then fades / scales in',
      enter: 'opacity 220ms, transform 180ms var(--ease-out)', exit: 'same', interruptible: 'yes — CSS transitions', reduced: 'opacity only',
      motion: 'fade + 0.95 scale, 220 / 180ms --ease-out', mapsTo: 'Tauri panel show/hide with a 220ms opacity + 0.95 scale on the root motion.div; while hidden, set the next variant without layout animation',
      source: '002 island.js reveal, applyMode (sync({ instant: wasHidden })) · island.css .island.gone, .island.instant', tokens: ['--ease-out'], timing: [['hide / show transform', 180, '--ease-out', 'yes'], ['hide / show opacity', 220, '--ease-out', 'yes']],
      stories: [demo({ label: 'Hide, then return', span: 'full', note: 'Replay', flush: true, html: () => islDesk(), run: (c) => { islMount(c, 'before'); seq(c, [[700, iset(c, 'hidden')], [1800, iset(c, 'before')]]); } })] }),
    E({ id: 'onboard-panel', name: 'Onboarding · panel open & close', summary: 'The first-run panel settles in from 96% like a sheet and leaves quickly if you choose “Not now”.',
      trigger: 'first run (+420ms after the window hides) · Set up Telu (Island setup pill, empty state) · Not now / Esc closes', element: '.onboard (glass panel, 420 × 530)', properties: 'open: opacity 0 → 1, scale(0.96) → 1 · close: opacity → 0, scale(0.97), then hidden',
      enter: '260ms var(--ease-out)', exit: '160ms var(--ease-out)', interruptible: 'restart', keyboard: 'Esc closes with the same exit', reduced: 'instant', notes: 'the panel is cropped to 400px and the welcome step drops its three “moments” rows to fit the tile',
      motion: 'in from 0.96 in 260ms, out to 0.97 in 160ms, --ease-out', mapsTo: `Separate NSPanel window; <motion.section initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.16 } }} transition={{ duration: 0.26, ease: ${EO} }} />`,
      source: '002 app-onboard.js open, close · app.js applyScenario (first run +420ms) · app.css .onboard', tokens: ['--ease-out', '--glass-strong', '--shadow-window'], timing: [['close', 160, '--ease-out', 'restart'], ['open', 260, '--ease-out', 'restart', 700], ['first-run delay', 420, '—', '—']],
      stories: [demo({ label: 'Not now, then Set up Telu', note: 'Replay closes and reopens it', span: 'full', flush: true, html: () => obDesk(0), init: (c) => obWire(c), run: (c) => seq(c, [[0, () => obClose(c)], [700, () => obOpen(c)]]) })] }),
    E({ id: 'onboard-steps', name: 'Onboarding · step slide & dots', summary: 'Steps slide 24px in the direction you are going and the dots fill behind you, so the three-step setup always feels short and reversible.',
      trigger: 'Continue / Back / the calendar permission answer', element: '.ob-steps > .ob-step (absolute, briefly stacked) · .ob-dots i', properties: 'old step opacity → 0, translateX(−24px × dir), then removed · new step opacity 0 → 1 from translateX(24px × dir) · dots --fill-3 → --accent (current) / accent 45% (done)',
      enter: '220ms var(--ease-out) after 40ms, fill backwards', exit: '150ms var(--ease-out), fill forwards', sequence: 'dir 0 (permission denied re-renders the same step) crossfades in place without sliding', interruptible: 'restart — steps already leaving are ignored by the next go()', keyboard: 'Enter in the manual field adds a row (receive), it does not change step', reduced: 'instant swap',
      motion: 'out 24px / 150ms, in 24px / 220ms (+40ms), --ease-out; dots 200ms', mapsTo: `<AnimatePresence mode="popLayout" custom={dir} initial={false}><motion.div key={step} custom={dir} initial={{ opacity: 0, x: 24 * dir }} animate={{ opacity: 1, x: 0, transition: { duration: 0.22, delay: 0.04, ease: ${EO} } }} exit={{ opacity: 0, x: -24 * dir, transition: { duration: 0.15, ease: ${EO} } }} /></AnimatePresence>; dots transition-colors 200ms`,
      source: '002 app-onboard.js go, leave, renderFoot · app.css .ob-step, .ob-dots', tokens: ['--ease-out', '--accent', '--fill-3'], timing: [['step out', 150, '--ease-out', 'restart'], ['step in', 220, '--ease-out', 'restart', 40], ['dots', 200, 'ease', 'yes']],
      stories: [demo({ label: 'Welcome → remember → summon → back', note: 'Use Continue / Back or Replay', span: 'full', flush: true, html: () => obDesk(0), init: (c) => obWire(c),
        run: (c) => { obReset(c, 0); seq(c, [[400, () => obGo(c, 1, 1)], [1700, () => obGo(c, 2, 1)], [3000, () => obGo(c, 1, -1)], [4300, () => obGo(c, 0, -1)]]); } })] }),
    E({ id: 'onboard-finish', name: 'Onboarding · finish flight', summary: 'Finishing setup shrinks the panel away while the Telu icon flies up into the menu bar, where the status item glows and bumps — “this is where I live now”.',
      trigger: 'Done on “Summon Telu anytime”', element: '.onboard · app icon [data-fly] → #teluStatus (menu-bar status item)', properties: 'panel opacity → 0, scale(0.92) (fill forwards) · icon flight (Kit.flyTo, scale clamps to 0.4) · status item .receive + its image .bump · panel hidden · status text appears · the Island returns 160ms later',
      enter: 'panel 280ms var(--ease-out) · flight 620ms (split easing)', exit: 'receive 900ms · bump 420ms', interruptible: 'no (busy flag)', reduced: 'no shrink and no flight; the status item receives',
      motion: 'panel shrinks 280ms while the icon arcs 620ms into the menu bar; landing glow + bump', mapsTo: 'Two Tauri windows: animate the panel out (opacity / scale 0.92), then flash the tray title — tray.rs cannot animate, so update the title after the panel is gone; inside one webview use the flyTo portal (see Fly to sidebar) with duration 0.62',
      source: '002 app-onboard.js finish · kit/mac-kit.js Kit.flyTo · app.css .fly-icon · app-bridge.js T.renderStatus', tokens: ['--ease-out', '--accent-soft'], timing: [['panel shrink', 280, '--ease-out', 'no'], ['icon flight', 620, 'split cubic-bezier', 'no'], ['status bump', 420, '--ease-out', 'restart', 620], ['status receive', 900, '--ease-out', 'restart', 620], ['Island returns after', 160, '—', '—']],
      stories: [demo({ label: 'Done → menu bar', note: 'Click Done or Replay', span: 'full', flush: true, html: () => obDesk(2), init: (c) => { state.set(c, 2); obWire(c); },
        run: (c) => { obReset(c, 2); seq(c, [[500, () => obFinish(c)], [3000, () => obReset(c, 2)]]); } })] }),
    E({ id: 'reduced-motion', name: 'Reduced motion · fallbacks', summary: 'With “Reduce motion” on, Telu keeps every state change visible but stops moving things: fades and colour changes stay, slides, springs and flights go.',
      trigger: 'prefers-reduced-motion: reduce', element: 'everything', properties: 'CSS: transitions limited to opacity, background-color, color, box-shadow, border-color (transforms, sizes, grid rows and stroke draws snap) · .enter / .bump / .wave i / .shimmer keyframes off · .rec-dot slowed to 2.4s · Island .il-mint-dot and .il-sugg.arrive off',
      sequence: 'JS (Kit.reduceMotion()): Kit.flip / flyTo (target just receives) / removeAnimated / enterAnimated skip; crossfade, fadeIn, slideSwap, paintPage, paintNextBlock, capsule, onboarding panel and steps, chip removal → instant; peek .instant; Island typing shows all words; smooth scroll → auto', reduced: 'this entry is the reduced-motion behaviour', notes: 'still animating under reduced motion (gaps to close in production): .ver-bump, .chip-in, tick-receive, T.runProgress',
      motion: 'opacity and colour only; status loops keep running', mapsTo: '<MotionConfig reducedMotion="user"> at the root (framer-motion drops transform and layout animations, keeps opacity); keep the CSS @media (prefers-reduced-motion) block; gate WAAPI and flyers with useReducedMotion()',
      source: 'kit/mac-kit.css @media (prefers-reduced-motion) · Kit.reduceMotion() call sites across 002 · island.css reduced block',
      stories: [demo({ label: 'Default vs reduced (the kit rules, scoped to the right column)', note: 'Replay toggles both columns together', span: 'full', height: 250,
        html: `<div class="mo-rm"><div class="mo-rm-col"><span class="t-eyebrow">DEFAULT</span>${RM_SET}</div><div class="mo-rm-col mo-reduced"><span class="t-eyebrow">PREFERS-REDUCED-MOTION</span>${RM_SET}</div></div>`, init: (c) => qa(c, '.seg').forEach((s) => Kit.segmented(s)),
        run: (c) => seq(c, [[0, () => qa(c, '.switch, .check').forEach((b) => b.click())], [400, () => qa(c, '.seg').forEach((s) => qa(s, 'button')[2].click())], [900, () => qa(c, '.mo-rm-c').forEach((el) => el.classList.toggle('collapsed'))], [1700, () => qa(c, '.seg').forEach((s) => qa(s, 'button')[0].click())]]) })] })
  ]);
})();
