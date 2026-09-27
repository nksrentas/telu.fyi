(() => {
  const T = window.T;
  const D = T.doc;
  const SCENARIOS = [
    { id: 'first', label: 'First run' },
    { id: 'before', label: 'Before · 9:41' },
    { id: 'starting', label: 'Starting · 10:00' },
    { id: 'live', label: 'Live · 10:12' },
    { id: 'after', label: 'After · 10:46' }
  ];

  const hasLayer = () => !!Kit.$('.popover.open, .menu:not(.closing), .sheet.open, .alert.open');

  T.renderAll = () => {
    T.setClock(T.state.clock);
    T.renderSidebar();
    T.ui.toolbarMode = null;
    T.renderToolbar();
    T.renderView();
    if (T.state.peekOpen && T.state.view.kind !== 'doc') T.peek.show({ animate: false });
    else T.peek.close({ animate: false });
    T.syncTimers();
  };

  const resetTransient = () => {
    T.clearLater();
    T.stopLive();
    T.onboarding.close(true);
    if (T.ui.sheet) T.ui.sheet.close();
    T.ui.timers.forEach((stop) => stop());
    T.ui.timers.clear();
    D.leavePage();
    T.ui.startNotif = null;
    Kit.$$('.toast, .notif').forEach((el) => el.remove());
  };
  const applyScenario = (id) => {
    resetTransient();
    T.state = T.scenarioState(id);
    T.renderAll();
    T.fx.fadeIn(T.el.view, { duration: 200 });
    if (id === 'first') {
      T.hideWindow();
      T.island('set', 'hidden');
      T.later(() => T.onboarding.open(), 420);
      return;
    }
    T.showWindow();
    T.islandForScenario();
    if (id === 'starting') T.later(T.notifyStarting, 600);
    if (id === 'after') T.later(T.notifyReview, 700);
    if (id === 'live') T.scheduleLive();
  };

  const onClick = (event) => {
    const source = event.target.closest('.source');
    if (source && T.el.win.contains(source)) return D.openEvidence(source);
    const el = event.target.closest('[data-act]');
    if (!el || el.disabled || !T.el.win.contains(el)) return undefined;
    const handler = T.actions[el.dataset.act];
    if (handler) handler(el, event);
    return undefined;
  };
  const onContext = (event) => {
    const card = event.target.closest('#view .a-card[data-id]');
    if (card) T.cardMenu(event, card.dataset.id);
  };
  const onToggle = (event) => D.onToggle(event);

  const inactive = () => T.el.win.hidden || T.onboarding.isOpen();
  const arrow = (delta) => {
    if (inactive()) return undefined;
    if (T.state.view.kind === 'doc') return T.el.content.scrollBy({ top: delta * 48 });
    return T.moveSelection(delta);
  };
  const dayKey = (delta) => {
    if (!inactive() && T.state.view.kind === 'day') T.stepDay(delta, { animate: false });
  };
  const currentSeries = () => {
    const t = T.peekTarget();
    if (t && t.series && t.series.tracked) return t.series;
    const next = T.nextUpId();
    const ev = next && T.eventById(next);
    return ev ? T.trackedSeriesOf(ev) : null;
  };
  T.editPurposeShortcut = () => {
    if (!T.state.onboarded) return undefined;
    T.showWindow();
    if (T.state.view.kind === 'doc') return D.focusPurpose();
    const s = currentSeries();
    if (s) return T.openDoc(s.id, { focusPurpose: true });
    return T.toast('Select a tracked meeting to edit its purpose', { icon: 'pencil' });
  };
  const onEscape = () => {
    if (T.onboarding.escape()) return undefined;
    const active = document.activeElement;
    if (active && active !== document.body && (active.isContentEditable || /^(INPUT|TEXTAREA)$/.test(active.tagName))) return active.blur();
    if (D.drawerOpen()) return D.closeDrawer();
    if (T.state.view.kind !== 'doc' && T.state.peekOpen) return T.peek.close();
    if (T.state.view.kind === 'doc' && T.state.view.from) return T.goBack();
    return undefined;
  };
  const onEnter = (event) => {
    if (event.key !== 'Enter' || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || event.isComposing) return;
    const active = document.activeElement;
    if (active && active !== document.body && active.closest('input, textarea, [contenteditable="true"], button, a')) return;
    if (hasLayer() || inactive() || T.state.view.kind === 'doc' || !T.state.selection || T.state.peekOpen) return;
    event.preventDefault();
    T.select(T.state.selection, { animate: false });
  };
  const wireKeys = () => {
    Kit.keys({
      up: () => arrow(-1),
      down: () => arrow(1),
      left: () => dayKey(-1),
      right: () => dayKey(1),
      'mod+r': () => T.toggleRecord(),
      'mod+alt+n': () => T.openNewSeries(),
      'mod+e': () => T.editPurposeShortcut(),
      'mod+f': () => T.openSearch(),
      'mod+[': () => T.goBack(),
      'mod+w': () => T.hideWindow(),
      'mod+0': () => T.summon(),
      'alt+space': () => T.summon(),
      'mod+shift+e': () => D.share(),
      'mod+o': () => D.pickFiles(),
      escape: onEscape
    });
    document.addEventListener('keydown', onEnter);
  };

  const navTo = (kind) => {
    T.showWindow();
    T.goView(kind);
  };
  const MENUS = {
    Telu: () => [
      { label: 'About Telu', onSelect: () => T.toast('Telu · a local-first companion for recurring conversations', { icon: 'info' }) },
      '-',
      { label: 'Hide Telu', kbd: '⌘W', onSelect: T.hideWindow }
    ],
    File: () => [
      { label: 'New Series…', icon: 'plus', kbd: '⌥⌘N', onSelect: () => T.openNewSeries() },
      '-',
      { label: 'Close Window', kbd: '⌘W', onSelect: T.hideWindow }
    ],
    Edit: () => [
      { label: 'Edit Purpose', icon: 'pencil', kbd: '⌘E', onSelect: () => { T.showWindow(); T.editPurposeShortcut(); } },
      { label: 'Find…', icon: 'search', kbd: '⌘F', onSelect: () => { T.showWindow(); T.openSearch(); } }
    ],
    View: () => [
      { label: 'Today', icon: 'sun', onSelect: () => navTo('day') },
      { label: 'Upcoming', icon: 'calendar', onSelect: () => navTo('upcoming') },
      { label: 'Review', icon: 'tray', onSelect: () => navTo('review') },
      { label: 'Found in Calendar', icon: 'sparkles', disabled: T.state.calendar !== 'connected', onSelect: () => navTo('found') }
    ],
    Meeting: () => [
      { label: T.state.recording ? 'Stop Recording' : 'Record', icon: T.state.recording ? 'stop' : 'record', kbd: '⌘R', onSelect: () => T.toggleRecord() },
      { label: 'Open Next Meeting', icon: 'calendar-check', disabled: !T.nextUpId(), onSelect: () => T.openMeeting({ meetingId: (T.eventById(T.nextUpId()) || {}).meeting }) }
    ],
    Window: () => [
      { label: 'Telu', icon: T.el.win.hidden ? undefined : 'check', kbd: '⌥Space', onSelect: T.summon },
      { label: 'Close Window', kbd: '⌘W', disabled: T.el.win.hidden, onSelect: T.hideWindow }
    ],
    Help: () => [{ label: 'Telu Help', icon: 'question', onSelect: () => T.toast('Everything Telu knows stays on this Mac', { icon: 'lock' }) }]
  };
  const openMenubarMenu = (item) => {
    const build = MENUS[item.textContent.trim()];
    if (!build) return;
    const api = Kit.menu(item, build(), { minWidth: 220 });
    if (!api) return;
    item.classList.add('active');
    const close = api.close;
    api.close = (instant) => {
      item.classList.remove('active');
      close(instant);
    };
  };
  const wireMenubar = () => {
    const bar = Kit.$('.menubar', T.el.desk);
    bar.addEventListener('click', (event) => {
      const item = event.target.closest('.mb-item');
      if (item && item.id === 'teluStatus') T.summon();
      else if (item && !item.closest('.mb-right')) openMenubarMenu(item);
    });
  };

  const wire = () => {
    T.el.win.addEventListener('click', onClick);
    T.el.win.addEventListener('contextmenu', onContext);
    T.el.win.addEventListener('toggle', onToggle);
    T.el.view.addEventListener('input', D.onInput);
    T.el.view.addEventListener('keydown', D.onKeydown);
    T.el.peek.addEventListener('keydown', D.onKeydown);
    T.el.content.addEventListener('scroll', D.onScroll, { passive: true });
    Kit.scrollEdge(T.el.content, T.el.toolbar);
    T.wirePeek();
    D.wireDrops();
    D.wireMeetingDrag();
    wireKeys();
    wireMenubar();
  };

  const boot = () => {
    const $ = (id) => document.getElementById(id);
    T.el = { desk: $('desk'), win: $('win'), sidebar: $('sidebar'), main: $('main'), toolbar: $('toolbar'), content: $('content'), view: $('view'), peek: $('peek'), scrubber: $('scrubber'), drawer: $('drawer') };
    const extras = '<span class="mb-item telu-status icon-only" id="teluStatus" role="button" aria-label="Telu"><img src="../kit/telu-menubar.png" class="template-img" alt=""><span class="ts-text"></span></span>';
    T.el.desk.insertAdjacentHTML('afterbegin', Kit.menubar({ app: 'Telu', menus: ['File', 'Edit', 'View', 'Meeting', 'Window', 'Help'], extras }));
    T.el.peek.innerHTML = '<div class="pk-scroll" id="pkScroll"><div class="pk-content" id="pkContent"></div></div>';
    T.state = T.scenarioState('before');
    T.onboarding.mount();
    wire();
    T.renderAll();
    T.ui.scenarios = Kit.scenarios(SCENARIOS, applyScenario, 'before');
    T.wireIsland();
    T.islandForScenario();
  };

  boot();
})();
