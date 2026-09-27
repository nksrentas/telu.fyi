(() => {
  const AT = window.AT;
  const { esc } = Kit;

  const SCENARIOS = [{ id: 'first', label: 'First run' }, { id: 'everyday', label: 'Everyday' }, { id: 'after', label: 'After meeting' }];

  const docEvidence = (ev) => `<div class="a-docev"><div class="t-eyebrow">EVIDENCE · ${esc(ev.loc)}</div>`
    + `<div class="a-docev-file">${AT.inspectorParts.safeBadge(ev.name)}<b class="truncate">${esc(ev.name)}</b></div>`
    + `<blockquote>“${esc(ev.quote)}”</blockquote><div class="row-flex"><span class="a-local">${icon('lock', 'sm')}Read on this Mac</span>`
    + `<span class="spacer"></span><button class="btn sm plain" data-act="open-doc" data-name="${esc(ev.name)}">Open</button></div></div>`;

  AT.openTranscript = (meetingId, t) => {
    const target = AT.inspTarget();
    const sameMeeting = target.meeting && target.meeting.id === meetingId;
    const label = target.meeting ? `${target.meeting.title || target.series.name}${target.meeting.n ? ` #${target.meeting.n}` : ''}` : 'Back';
    const back = sameMeeting ? AT.state.back : { inspect: AT.state.inspect, tab: AT.state.tab, label };
    AT.selectMeeting(meetingId, { animate: true, tab: 'transcript', highlight: t, back });
  };

  AT.openEvidence = (btn) => {
    const holder = btn.closest('[data-ev-series]');
    const ctx = holder ? { seriesId: holder.dataset.evSeries, who: holder.dataset.evWho, text: holder.dataset.evText } : {};
    const ev = AT.evidenceFor(btn.dataset.src, ctx);
    if (ev.kind === 'doc') return Kit.popover(btn, docEvidence(ev), { width: 320 });
    const onOpen = ev.meetingId ? () => AT.openTranscript(ev.meetingId, ev.t) : undefined;
    return Kit.evidence(btn, { t: ev.t, who: ev.who, quote: esc(ev.quote) }, { where: ev.where, onOpen });
  };

  const renderAll = () => {
    AT.setClock(AT.state.clock);
    AT.renderSidebar();
    AT.updateToolbar();
    AT.renderMain();
    AT.renderInspector();
  };

  const resetTransient = () => {
    AT.ui.pending.forEach(clearTimeout);
    AT.ui.pending = [];
    if (AT.ui.sheet) AT.ui.sheet.close();
    AT.ui.timers.forEach((stop) => stop());
    AT.ui.timers.clear();
    AT.el.insp.classList.remove('drop-target');
  };

  const applyScenario = (id) => {
    resetTransient();
    AT.state = AT.scenarioState(id);
    AT.ui.inspKey = null;
    renderAll();
    Kit.$$('.toast, .notif').forEach((el) => el.remove());
    AT.fx.fadeIn(AT.el.agendaInner, { duration: 200 });
    AT.fx.fadeIn(AT.el.inspBody, { duration: 200 });
    if (id === 'after') AT.ui.pending.push(setTimeout(() => AT.notifyReview('t2'), 700));
  };

  const onClick = (event) => {
    const source = event.target.closest('.source');
    if (source && AT.el.win.contains(source)) return AT.openEvidence(source);
    const el = event.target.closest('[data-act]');
    if (!el || el.disabled || !AT.el.win.contains(el)) return;
    const handler = AT.actions[el.dataset.act];
    if (handler) handler(el, event);
  };

  const onContext = (event) => {
    const card = event.target.closest('#agenda .a-card[data-id]');
    if (card) AT.cardMenu(event, card.dataset.id);
  };

  const onToggle = (event) => {
    const el = event.target;
    if (el.dataset && el.dataset.docSwitch) AT.onDocToggle(el, event.detail.checked);
  };

  const wireDrop = () => {
    const zone = AT.el.insp;
    let depth = 0;
    const hasFiles = (e) => Array.from((e.dataTransfer && e.dataTransfer.types) || []).includes('Files');
    const reset = () => {
      depth = 0;
      zone.classList.remove('drop-target');
    };
    zone.addEventListener('dragenter', (e) => {
      if (!hasFiles(e) || !AT.canAttach()) return;
      e.preventDefault();
      depth += 1;
      zone.classList.add('drop-target');
    });
    zone.addEventListener('dragover', (e) => {
      if (!hasFiles(e) || !AT.canAttach()) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });
    zone.addEventListener('dragleave', () => {
      depth = Math.max(0, depth - 1);
      if (!depth) zone.classList.remove('drop-target');
    });
    zone.addEventListener('drop', (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      reset();
      AT.attachFiles(Array.from(e.dataTransfer.files));
    });
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => {
      e.preventDefault();
      reset();
    });
  };

  const onEscape = () => {
    if (AT.state.back) return AT.actions['insp-back']();
    if (AT.state.inspect) AT.select(null, { animate: false });
  };

  const dayKey = (delta) => () => {
    if (AT.state.view === 'day') AT.stepDay(delta, { animate: false });
  };

  const wireKeys = () => Kit.keys({
    up: () => AT.moveSelection(-1),
    down: () => AT.moveSelection(1),
    left: dayKey(-1),
    right: dayKey(1),
    'mod+r': () => AT.toggleRecord(),
    'mod+alt+n': () => AT.openNewSeries(Kit.$('#newBtn')),
    'mod+e': () => AT.editPurposeShortcut(),
    'mod+f': () => AT.actions.search(Kit.$('#searchBtn')),
    escape: onEscape
  });

  const boot = () => {
    Kit.$('#desk').insertAdjacentHTML('afterbegin', Kit.menubar({ app: 'Telu', menus: ['File', 'Edit', 'View', 'Meeting', 'Window', 'Help'] }));
    AT.el = {
      win: Kit.$('#win'), sidebar: Kit.$('#sidebar'), toolbar: Kit.$('#toolbar'),
      agenda: Kit.$('#agenda'), agendaInner: Kit.$('#agendaInner'),
      insp: Kit.$('#insp'), inspScroll: Kit.$('#inspScroll'), inspBody: Kit.$('#inspBody')
    };
    AT.ui.scroller = AT.el.agenda;
    AT.state = AT.scenarioState('everyday');
    AT.renderToolbar();
    renderAll();
    AT.el.win.addEventListener('click', onClick);
    AT.el.win.addEventListener('contextmenu', onContext);
    AT.el.win.addEventListener('toggle', onToggle);
    AT.el.inspScroll.addEventListener('scroll', () => AT.el.toolbar.classList.toggle('a-insp-scrolled', AT.el.inspScroll.scrollTop > 2), { passive: true });
    Kit.scrollEdge(AT.el.agenda, AT.el.toolbar);
    wireDrop();
    wireKeys();
    AT.ui.scenarios = Kit.scenarios(SCENARIOS, applyScenario, 'everyday');
  };

  boot();
})();
