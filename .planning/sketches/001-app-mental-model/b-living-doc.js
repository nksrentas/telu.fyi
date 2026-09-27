(() => {
  const { $, $$ } = Kit;
  const e = Kit.esc;
  const TITLES = { upnext: 'Up Next', suggestions: 'Suggestions', unfiled: 'Unfiled', detect: 'Calendar', welcome: '' };
  const pending = new Set();

  LD.later = (fn, ms) => {
    const id = setTimeout(() => {
      pending.delete(id);
      fn();
    }, ms);
    pending.add(id);
    return id;
  };
  const clearLater = () => {
    pending.forEach(clearTimeout);
    pending.clear();
  };

  const toolbarMarkup = () => `<div class="toolbar" id="toolbar">
      <div class="tb-title" id="tbTitle"></div>
      <span class="spacer"></span>
      <span class="save-state" id="saveState"></span>
      <div class="glass-group">
        <button class="btn icon" data-act="history" data-tip="History">${icon('history')}</button>
        <button class="btn icon" data-act="share" data-tip="Export as Markdown">${icon('share')}</button>
        <span class="sep"></span>
        <button class="btn tb-record" data-act="tb-record" id="tbRecord"></button>
        <button class="btn icon" data-act="tb-more" data-tip="More">${icon('ellipsis')}</button>
      </div>
      <div class="glass-group"><button class="btn icon" data-act="inspector" id="tbInspector" data-tip="Inspector">${icon('inspector')}</button></div>
    </div>`;
  const shellMarkup = () => `${Kit.menubar({ app: 'Telu', menus: ['File', 'Edit', 'View', 'Go', 'Window', 'Help'] })}
    <div class="window" id="win">
      <div class="traffic"><i></i><i></i><i></i></div>
      <aside class="sidebar" id="sidebar">
        <label class="search sb-search">${icon('search')}<input class="field" id="sbSearch" placeholder="Search docs" autocomplete="off" spellcheck="false"></label>
        <nav class="sb-nav" id="sbNav"></nav>
        <div class="sb-foot">
          <button class="btn plain new-doc" data-act="new-doc">${icon('plus')}New Living Doc<span class="kbd">⌥⌘N</span></button>
          <div class="sb-local">${icon('lock', 'sm')}On this Mac</div>
        </div>
      </aside>
      <section class="main" id="main">
        ${toolbarMarkup()}
        <div class="content" id="canvas"><div class="canvas-inner" id="canvasInner"></div></div>
        <nav class="scrubber" id="scrubber" aria-label="Sections"></nav>
        <aside class="drawer" id="drawer" aria-label="Inspector"></aside>
      </section>
    </div>`;

  const applySearch = () => {
    const raw = $('#sbSearch').value.trim();
    const q = raw.toLowerCase();
    const rows = $$('#sbNav .doc-row');
    rows.forEach((row) => { row.hidden = !!q && !row.querySelector('.name').textContent.toLowerCase().includes(q); });
    $$('#sbNav .sb-group').forEach((g) => { g.hidden = !g.querySelector('.doc-row:not([hidden])'); });
    const none = $('#sbNav .sb-nomatch');
    const empty = !!q && !rows.some((r) => !r.hidden);
    none.hidden = !empty;
    none.textContent = empty ? `No docs match “${raw}”` : '';
  };
  LD.paintSidebar = () => {
    $('#sbNav').innerHTML = LD.sidebarNav();
    applySearch();
  };
  const sidebarKey = (el) => el.dataset.doc || el.dataset.view || (el.classList.contains('sb-title') ? `title:${el.textContent}` : '');
  LD.flipSidebar = (mutate, { animate = true } = {}) => {
    const selector = '#sbNav .sb-item, #sbNav .sb-title';
    const before = new Map($$(selector).map((el) => [sidebarKey(el), el.getBoundingClientRect()]));
    mutate();
    const fresh = [];
    $$(selector).forEach((el) => {
      const a = before.get(sidebarKey(el));
      if (!a) return fresh.push(el);
      const dy = a.top - el.getBoundingClientRect().top;
      if (animate && Math.abs(dy) > 0.5 && !Kit.reduceMotion()) el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 380, easing: Kit.EASE_IN_OUT });
    });
    return fresh;
  };

  const viewMarkup = () => {
    const v = LD.state.view;
    if (v.kind === 'doc') {
      const s = LD.series(v.id);
      return s ? LD.docMarkup(s) : LD.upNextMarkup();
    }
    if (v.kind === 'welcome') return LD.welcomeMarkup(v.denied);
    return { upnext: LD.upNextMarkup, suggestions: LD.suggestionsMarkup, unfiled: LD.unfiledMarkup, detect: LD.detectMarkup }[v.kind]();
  };
  LD.setSaveState = (text, busy = false) => {
    const el = $('#saveState');
    el.textContent = text;
    el.classList.toggle('busy', busy);
  };
  LD.paintToolbar = () => {
    const s = LD.current();
    $('#tbTitle').innerHTML = s ? `${Kit.seriesIcon(s)}<b>${e(s.name || 'Untitled')}</b>` : `<b>${TITLES[LD.state.view.kind] || ''}</b>`;
    ['history', 'share', 'tb-more', 'inspector'].forEach((act) => { $(`#toolbar [data-act="${act}"]`).disabled = !s; });
    LD.setSaveState(s ? 'Saved' : '');
    LD.paintRecordButton();
  };

  let titleObserver = null;
  const observeTitle = () => {
    if (titleObserver) titleObserver.disconnect();
    const tb = $('#tbTitle');
    tb.classList.remove('show');
    const target = $('#docTitle') || $('#viewTitle');
    if (!target) return;
    const offset = parseInt(Kit.cssVar('--toolbar-h'), 10) || 52;
    titleObserver = new IntersectionObserver(([entry]) => {
      const top = entry.rootBounds ? entry.rootBounds.top : 0;
      tb.classList.toggle('show', !entry.isIntersecting && entry.boundingClientRect.top < top);
    }, { root: $('#canvas'), rootMargin: `-${offset}px 0px 0px 0px`, threshold: 0 });
    titleObserver.observe(target);
  };

  let markObserver = null;
  const visibleMarks = new Set();
  const marks = () => $$('#canvasInner [data-mark]');
  const pickActive = () => {
    const list = marks();
    const canvas = $('#canvas');
    if (!list.length) return null;
    if (canvas.scrollTop + canvas.clientHeight >= canvas.scrollHeight - 4 && canvas.scrollTop > 0) {
      const bottom = canvas.getBoundingClientRect().bottom - 40;
      return list.filter((el) => el.getBoundingClientRect().top < bottom).pop() || list[list.length - 1];
    }
    return list.find((el) => visibleMarks.has(el)) || null;
  };
  LD.updateActiveMark = () => {
    const active = pickActive();
    if (!active) return;
    $$('#scrubber .scrub-item').forEach((b) => b.classList.toggle('active', b.dataset.target === active.id));
  };
  LD.refreshMarks = () => {
    if (markObserver) markObserver.disconnect();
    visibleMarks.clear();
    const list = marks();
    $('#scrubber').innerHTML = list.map((el, i) => `${i === 3 ? '<span class="scrub-gap"></span>' : ''}<button class="scrub-item" data-act="scrub" data-target="${e(el.id)}" aria-label="${e(el.dataset.mark)}"><span class="scrub-label">${e(el.dataset.mark)}</span><span class="scrub-tick"></span></button>`).join('');
    if (!list.length) return;
    markObserver = new IntersectionObserver((entries) => {
      entries.forEach((en) => (en.isIntersecting ? visibleMarks.add(en.target) : visibleMarks.delete(en.target)));
      LD.updateActiveMark();
    }, { root: $('#canvas'), rootMargin: '-64px 0px -50% 0px', threshold: 0 });
    list.forEach((el) => markObserver.observe(el));
  };
  LD.scrubTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: Kit.reduceMotion() ? 'auto' : 'smooth', block: 'start' });
  };
  let scrollFrame = 0;
  const onCanvasScroll = () => {
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = 0;
      LD.updateActiveMark();
    });
  };

  const mountView = () => {
    LD.paintToolbar();
    observeTitle();
    LD.refreshMarks();
    const s = LD.current();
    if (s && s.draft) LD.mountDraft();
    if (s && LD.state.recording && LD.state.recording.sid === s.id) LD.resumeLive();
  };
  LD.paintCanvas = () => {
    LD.flushSave();
    $('#canvasInner').innerHTML = viewMarkup();
    $('#canvas').scrollTop = 0;
    mountView();
    const cards = $('#cardList');
    if (cards) Kit.stagger(cards, ':scope > .card');
  };
  let swapToken = 0;
  LD.swapCanvas = async ({ animate = false } = {}) => {
    const token = ++swapToken;
    const inner = $('#canvasInner');
    inner.getAnimations().forEach((a) => a.cancel());
    if (!animate || Kit.reduceMotion()) {
      LD.paintCanvas();
      return true;
    }
    const out = inner.animate([{ opacity: 1, filter: 'blur(0px)' }, { opacity: 0, filter: 'blur(2px)' }], { duration: 120, easing: 'ease-out', fill: 'forwards' });
    const finished = await out.finished.then(() => true, () => false);
    if (!finished || token !== swapToken) return false;
    LD.paintCanvas();
    out.cancel();
    inner.animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 180, easing: Kit.EASE_OUT });
    return true;
  };

  const DRAWER_SPACE = 366;
  const shiftCanvas = (open) => {
    const main = $('#main').getBoundingClientRect();
    const column = $('#canvasInner .doc, #canvasInner .view, #canvasInner .detect');
    const width = column ? column.getBoundingClientRect().width : 0;
    const left = (main.width - width) / 2;
    const shift = open && column ? Math.max(0, Math.min(left + width + 24 - (main.width - DRAWER_SPACE), left - 24)) : 0;
    $('#canvasInner').style.setProperty('--shift', `${-shift}px`);
  };
  LD.drawerOpen = () => $('#drawer').classList.contains('open');
  LD.openDrawer = (markup) => {
    const d = $('#drawer');
    d.innerHTML = markup;
    d.classList.add('open');
    shiftCanvas(true);
    $('#main').classList.add('drawer-open');
    $('#tbInspector').classList.add('on');
  };
  LD.closeDrawer = () => {
    const d = $('#drawer');
    if (!d) return;
    d.classList.remove('open');
    shiftCanvas(false);
    $('#main').classList.remove('drawer-open');
    $('#tbInspector').classList.remove('on');
  };
  LD.openTranscript = (sid, mid, t) => {
    const s = LD.series(sid);
    const m = s && s.meetings.find((x) => x.id === mid);
    if (!m) return;
    LD.openDrawer(LD.drawerTranscript(s, m, t));
    const body = $('#drawerBody');
    const hl = body && body.querySelector('.tl.hl');
    if (hl) body.scrollTop = Math.max(0, hl.offsetTop - body.clientHeight / 2 + hl.offsetHeight / 2);
  };
  LD.toggleInspector = () => {
    if (LD.drawerOpen()) return LD.closeDrawer();
    const s = LD.current();
    if (s) LD.openDrawer(LD.drawerInfo(s));
  };

  const candId = (el) => el.closest('.cand').dataset.cid;
  const cardTitle = (el) => el.closest('.card').querySelector('.t-title3').textContent;
  const ACTIONS = {
    view: (el) => LD.openView(el.dataset.view, { animate: true }),
    'open-doc': (el) => LD.openDoc(el.dataset.doc, { animate: true }),
    'new-doc': () => LD.newDoc({ animate: true }),
    rule: (el) => LD.rulePopover(el),
    people: (el) => LD.peoplePopover(el),
    'purpose-history': (el) => LD.purposeHistoryPopover(el),
    history: (el) => LD.docHistoryPopover(el),
    share: () => LD.share(),
    'tb-record': () => LD.toggleRecording(),
    'tb-more': (el) => LD.docMenu(el),
    inspector: () => LD.toggleInspector(),
    'close-drawer': () => LD.closeDrawer(),
    scrub: (el) => LD.scrubTo(el.dataset.target),
    'ref-doc': (el) => LD.refPopover(el),
    'toggle-include': (el) => LD.toggleInclude(el.closest('.ref-chip').dataset.name),
    'add-ref': (el) => LD.addRefMenu(el),
    doc: (el) => Kit.toast(`Opening ${e(el.dataset.name)}…`, { icon: 'doc' }),
    record: () => LD.toggleRecording(),
    stop: () => LD.toggleRecording(),
    join: (el) => Kit.toast(`Opening ${e(el.dataset.where)}…`, { icon: 'video' }),
    'ask-to-agenda': (el) => LD.askToAgenda(Number(el.dataset.i), el),
    'toggle-meeting': (el, ev) => { if (!ev.target.closest('.grip')) LD.toggleMeeting(el.closest('.mtg')); },
    'meeting-menu': (el) => LD.meetingMenu(el),
    transcript: (el) => LD.openTranscript(LD.state.view.id, el.closest('.mtg').dataset.mid),
    earlier: (el) => LD.showEarlier(el),
    accept: (el) => LD.acceptCand(candId(el)),
    'accept-all': (el) => LD.acceptAll(el.closest('.mtg').dataset.mid),
    correct: (el) => LD.setCandState(candId(el), 'editing'),
    'cancel-correct': (el) => LD.setCandState(candId(el), 'pending'),
    'save-correct': (el) => LD.saveCorrection(candId(el)),
    reject: (el) => LD.setCandState(candId(el), 'rejected'),
    'undo-reject': (el) => LD.setCandState(candId(el), 'pending'),
    'goto-next': (el) => LD.gotoNext(el.dataset.doc),
    'track-event': (el) => LD.trackEvent(el.dataset.event),
    'create-proposal': (el) => LD.createProposalFlow(el.closest('.sug-card')),
    'join-proposal': (el) => LD.joinProposalFlow(el.closest('.sug-card')),
    'dismiss-proposal': (el) => LD.dismissCard(el.closest('.sug-card'), el.dataset.msg),
    'file-there': (el) => LD.fileThere(el.closest('.uf-card')),
    'file-choose': (el) => LD.fileChoose(el),
    play: (el) => Kit.toast(`Playing ${e(cardTitle(el))}`, { icon: 'play' }),
    connect: () => LD.connectFlow(),
    scratch: () => LD.newDoc({ animate: true }),
    'open-settings': () => Kit.toast('Opening System Settings › Privacy & Security › Calendars', { icon: 'sliders' }),
    'create-detected': () => LD.createDetectedFlow(),
    'pick-day': (el) => LD.pickDay(el),
    'pick-time': (el) => LD.pickTime(el),
    'link-event': (el) => LD.linkEventMenu(el)
  };
  const onClick = (ev) => {
    const src = ev.target.closest('.source');
    if (src && src.closest('#canvasInner')) return LD.openEvidence(src);
    const el = ev.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const fn = ACTIONS[el.dataset.act];
    if (fn) fn(el, ev);
  };
  const onEscape = () => {
    const active = document.activeElement;
    if (active && active.id === 'sbSearch') {
      active.value = '';
      applySearch();
      return active.blur();
    }
    if (LD.drawerOpen()) return LD.closeDrawer();
    if (active && active.isContentEditable) active.blur();
  };
  const wire = () => {
    $('#win').addEventListener('click', onClick);
    $('#sbSearch').addEventListener('input', applySearch);
    const inner = $('#canvasInner');
    inner.addEventListener('input', (ev) => LD.onCanvasInput(ev));
    inner.addEventListener('keydown', (ev) => LD.onCanvasKeydown(ev));
    inner.addEventListener('toggle', (ev) => LD.onToggle(ev));
    $('#canvas').addEventListener('scroll', onCanvasScroll, { passive: true });
    LD.wireDrops();
    LD.wireMeetingDrag();
    Kit.keys({
      'mod+r': () => LD.toggleRecording(),
      'mod+alt+n': () => LD.newDoc({ animate: false }),
      'mod+f': () => { $('#sbSearch').focus(); $('#sbSearch').select(); },
      'mod+[': () => LD.jumpMeeting(-1),
      'mod+]': () => LD.jumpMeeting(1),
      'mod+shift+e': () => LD.share(),
      'mod+o': () => { if (LD.current()) LD.pickFiles(); },
      escape: onEscape
    });
  };

  const reset = (state) => {
    clearLater();
    LD.stopLive();
    LD.closeDrawer();
    LD.state = state;
    $('#sbSearch').value = '';
    LD.paintSidebar();
    LD.paintCanvas();
  };
  const SCENARIOS = {
    first: () => reset(LD.firstRun()),
    everyday: () => reset(LD.initial()),
    after: () => {
      reset(LD.initial());
      LD.later(() => LD.rollForwardFlow({ scroll: true }), 450);
    }
  };
  const init = () => {
    $('#desk').innerHTML = shellMarkup();
    Kit.scrollEdge($('#canvas'), $('#toolbar'));
    wire();
    LD.paintSidebar();
    LD.paintCanvas();
    Kit.scenarios([{ id: 'first', label: 'First run' }, { id: 'everyday', label: 'Everyday' }, { id: 'after', label: 'After meeting' }], (id) => SCENARIOS[id](), 'everyday');
  };
  init();
})();
