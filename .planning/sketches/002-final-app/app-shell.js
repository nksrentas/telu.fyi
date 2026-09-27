(() => {
  const T = window.T;
  const { esc } = Kit;
  const VIEW_TITLES = { upcoming: 'Upcoming', review: 'Review', found: 'Found in Calendar' };

  const viewKind = () => T.state.view.kind;
  const navItem = (view, iconName, label, count) => `<div class="sb-item a-nav${viewKind() === view ? ' selected' : ''}" data-act="nav" data-view="${view}">`
    + `${icon(iconName)}<span class="truncate">${label}</span><span class="count num" data-count="${view}">${count || ''}</span></div>`;

  const seriesRow = (s) => {
    const selected = viewKind() === 'doc' && T.state.view.seriesId === s.id;
    return `<div class="sb-item a-sb-row${selected ? ' selected' : ''}" data-act="open-doc" data-series="${s.id}">`
      + `${Kit.seriesIcon(s)}<span class="truncate a-sb-name">${esc(s.name || 'Untitled')}</span><span class="a-hint num">${T.nextHint(s)}</span></div>`;
  };
  const seriesSection = (list) => '<div id="sbSeriesSection">'
    + `<div class="sb-title a-sb-title"><span>Series</span><button class="btn plain icon a-sb-add" data-act="new-series" data-align="start" data-tip="New series">${icon('plus')}</button></div>`
    + `<div id="sbSeries">${list.map(seriesRow).join('')}</div></div>`;
  const calendarRow = (c) => `<div class="sb-item a-cal${c.watched ? '' : ' is-off'}" data-act="cal" data-cal="${c.id}">`
    + `<button class="check square a-cal-check" data-manual aria-checked="${c.watched}" style="--cal:${c.color}" tabindex="-1">${Kit.checkSvg}</button>`
    + `<span class="a-cal-text"><span class="truncate">${esc(c.name)} · ${esc(c.account)}</span><small class="a-cal-cap">Not watched</small></span></div>`;

  T.renderSidebar = () => {
    const connected = T.state.calendar === 'connected';
    const tracked = T.tracked();
    T.el.sidebar.innerHTML = [
      '<nav class="a-sb-group">',
      navItem('day', 'sun', 'Today', T.todayCount()),
      navItem('upcoming', 'calendar', 'Upcoming', 0),
      navItem('review', 'tray', 'Review', T.reviewCount()),
      connected ? navItem('found', 'sparkles', 'Found in Calendar', T.foundCount()) : '',
      '</nav>',
      tracked.length ? seriesSection(tracked) : '',
      connected ? `<div class="sb-title">Calendars</div>${T.state.calendars.map(calendarRow).join('')}` : '',
      `<div class="sb-foot">${icon('lock', 'sm')}On this Mac · processed locally</div>`
    ].join('');
  };

  const bump = (el) => {
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  };
  T.updateCounts = () => {
    const values = { day: T.todayCount(), upcoming: 0, review: T.reviewCount(), found: T.foundCount() };
    Kit.$$('#sidebar [data-count]').forEach((el) => {
      const next = values[el.dataset.count] ? String(values[el.dataset.count]) : '';
      if (el.textContent === next) return;
      el.textContent = next;
      bump(el);
    });
    Kit.$$('#sidebar .a-sb-row').forEach((row) => {
      const s = T.seriesById(row.dataset.series);
      const hint = Kit.$('.a-hint', row);
      const name = Kit.$('.a-sb-name', row);
      if (s && hint && hint.innerHTML !== T.nextHint(s)) hint.innerHTML = T.nextHint(s);
      if (s && name && name.textContent !== (s.name || 'Untitled')) name.textContent = s.name || 'Untitled';
    });
    if (['review', 'found'].includes(viewKind())) T.updateToolbar();
  };
  T.syncSidebarSelection = () => {
    Kit.$$('#sidebar .sb-item.selected').forEach((el) => el.classList.remove('selected'));
    const v = T.state.view;
    const el = Kit.$(v.kind === 'doc' ? `#sidebar [data-series="${v.seriesId}"]` : `#sidebar .a-nav[data-view="${v.kind}"]`);
    if (el) el.classList.add('selected');
  };

  T.flyMarkup = (s) => `<div class="a-fly">${Kit.seriesIcon(s)}<span>${esc(s.name || 'Untitled')}</span></div>`;
  T.revealSeriesRow = (id, fromEl) => {
    const hadSection = !!Kit.$('#sbSeries');
    T.renderSidebar();
    const row = Kit.$(`#sidebar [data-series="${id}"]`);
    if (!row) return Promise.resolve();
    Kit.enterAnimated(hadSection ? row : Kit.$('#sbSeriesSection'));
    return Kit.flyTo(fromEl, row, { markup: T.flyMarkup(T.seriesById(id)) });
  };
  T.pulseSeriesRow = (id, fromEl, markup) => {
    const row = Kit.$(`#sidebar [data-series="${id}"]`);
    const s = T.seriesById(id);
    if (!row || !s) return Promise.resolve();
    return Kit.flyTo(fromEl, row, { markup: markup || T.flyMarkup(s) });
  };
  T.dropSeriesRow = (id) => {
    const row = Kit.$(`#sidebar [data-series="${id}"]`);
    if (!row) return Promise.resolve(T.renderSidebar());
    return Kit.removeAnimated(row).then(() => T.renderSidebar());
  };

  const agendaToolbar = () => '<div class="toolbar-title a-tb-title" id="tbTitle"><b></b><span></span></div>'
    + '<div class="a-rec-slot" id="recSlot"></div><span class="spacer"></span>'
    + '<div class="glass-group" id="stepper">'
    + `<button class="btn icon" data-act="day-prev" data-tip="Previous day">${icon('chevron-left')}</button>`
    + '<button class="btn" data-act="day-today">Today</button>'
    + `<button class="btn icon" data-act="day-next" data-tip="Next day">${icon('chevron-right')}</button></div>`
    + '<div class="glass-group">'
    + `<button class="btn a-new-btn" data-act="new-series" id="newBtn">${icon('plus')}New<span class="kbd">⌥⌘N</span></button>`
    + `<span class="sep"></span><button class="btn icon" data-act="search" id="searchBtn" data-tip="Search">${icon('search')}</button></div>`
    + '<i class="a-progress" id="progress"></i>';
  const docToolbar = () => `<button class="btn sm plain tb-back" data-act="back" id="tbBack" data-tip="Back · ⌘[" hidden>${icon('chevron-left')}<span></span></button>`
    + '<div class="tb-title" id="tbDocTitle"></div><span class="spacer"></span><span class="save-state" id="saveState"></span>'
    + '<div class="glass-group" id="tbDocGroup">'
    + `<button class="btn icon" data-act="history" data-tip="History">${icon('history')}</button>`
    + `<button class="btn icon" data-act="share" data-tip="Export as Markdown">${icon('share')}</button><span class="sep"></span>`
    + '<button class="btn tb-record" data-act="tb-record" id="tbRecord"></button>'
    + `<button class="btn icon" data-act="tb-more" data-tip="More">${icon('ellipsis')}</button></div>`
    + `<div class="glass-group"><button class="btn icon" data-act="inspector" id="tbInspector" data-tip="Details">${icon('inspector')}</button></div>`
    + '<i class="a-progress" id="progress"></i>';

  const titleFor = () => {
    const st = T.state;
    const kind = st.view.kind;
    if (kind === 'review') {
      const n = T.reviewCount();
      return [VIEW_TITLES.review, n ? `${n} ${n === 1 ? 'item needs' : 'items need'} a look` : 'All caught up'];
    }
    if (kind === 'found') {
      const n = T.foundCount();
      return [VIEW_TITLES.found, n ? `${n} ${n === 1 ? 'suggestion' : 'suggestions'} · decide once` : 'Nothing new'];
    }
    if (kind === 'upcoming') return [VIEW_TITLES.upcoming, 'Next few days'];
    const day = st.days[st.view.dayIndex];
    return [day.label, day.long];
  };

  const recCapsule = () => {
    const rec = T.state.recording;
    const ev = rec.eventId ? T.eventById(rec.eventId) : null;
    const s = rec.seriesId ? T.seriesById(rec.seriesId) : null;
    const label = ev ? ev.title : s ? s.name : 'Recording';
    return `<div class="a-rec-capsule" id="recCapsule"><span class="rec-dot"></span><b class="truncate">${esc(label)}</b>`
      + `<span class="num a-rec-time" data-rec-timer>0:00</span><button class="btn sm a-rec-stop" data-act="stop">${icon('stop')}Stop</button></div>`;
  };
  const syncCapsule = (animate) => {
    const slot = Kit.$('#recSlot');
    if (!slot) return;
    const existing = Kit.$('#recCapsule', slot);
    if (T.state.recording && !existing) {
      slot.innerHTML = recCapsule();
      if (animate && !Kit.reduceMotion()) {
        Kit.$('#recCapsule', slot).animate([{ opacity: 0, transform: 'scale(0.96)', filter: 'blur(2px)' }, { opacity: 1, transform: 'none', filter: 'blur(0px)' }], { duration: 240, easing: Kit.EASE_OUT });
      }
    } else if (!T.state.recording && existing) {
      if (!animate || Kit.reduceMotion()) return existing.remove();
      existing.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(0.96)' }], { duration: 150, easing: 'ease-out', fill: 'forwards' })
        .finished.then(() => existing.remove());
    }
  };

  T.paintRecordButton = () => {
    const btn = Kit.$('#tbRecord');
    if (!btn) return;
    const live = !!T.state.recording;
    btn.classList.toggle('live', live);
    btn.innerHTML = live
      ? '<span class="rec-dot"></span><span class="num tb-timer" data-rec-timer>0:00</span><span>Stop</span>'
      : `<span class="rec-glyph"></span>Record<span class="kbd">⌘R</span>`;
  };
  T.setSaveState = (text, busy = false) => {
    const el = Kit.$('#saveState');
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('busy', busy);
  };
  const updateDocToolbar = () => {
    const v = T.state.view;
    const s = T.seriesById(v.seriesId);
    const back = Kit.$('#tbBack');
    back.hidden = !v.from;
    Kit.$('span', back).textContent = v.from ? v.from.label : '';
    Kit.$('#tbDocTitle').innerHTML = s ? `${Kit.seriesIcon(s)}<b>${esc(s.name || 'Untitled')}</b>` : '';
    T.paintRecordButton();
  };
  const updateAgendaToolbar = (animate) => {
    const [title, sub] = titleFor();
    const tb = Kit.$('#tbTitle');
    Kit.$('b', tb).textContent = title;
    Kit.$('span', tb).textContent = sub;
    const st = T.state;
    const dayView = st.view.kind === 'day' && st.calendar === 'connected';
    Kit.$('[data-act="day-prev"]').disabled = st.calendar !== 'connected' || (dayView && st.view.dayIndex === 0);
    Kit.$('[data-act="day-next"]').disabled = st.calendar !== 'connected' || (dayView && st.view.dayIndex === st.days.length - 1);
    syncCapsule(animate);
  };
  T.updateToolbar = ({ animate = false } = {}) => {
    if (T.ui.toolbarMode === 'doc') updateDocToolbar();
    else updateAgendaToolbar(animate);
    T.syncTimers();
  };
  T.renderToolbar = () => {
    const mode = viewKind() === 'doc' ? 'doc' : 'agenda';
    if (T.ui.toolbarMode !== mode) {
      T.el.toolbar.innerHTML = mode === 'doc' ? docToolbar() : agendaToolbar();
      T.el.toolbar.dataset.mode = mode;
      T.ui.toolbarMode = mode;
    }
    T.updateToolbar();
    if (mode === 'doc') T.setSaveState('Saved');
  };

  T.runProgress = (duration = 900) => {
    const bar = Kit.$('#progress');
    if (!bar) return Promise.resolve();
    bar.getAnimations().forEach((a) => a.cancel());
    const grow = bar.animate([{ transform: 'scaleX(0)', opacity: 1 }, { transform: 'scaleX(1)', opacity: 1 }], { duration, easing: 'linear', fill: 'forwards' });
    return grow.finished
      .then(() => bar.animate([{ opacity: 1, transform: 'scaleX(1)' }, { opacity: 0, transform: 'scaleX(1)' }], { duration: 220, easing: 'ease-out', fill: 'forwards' }).finished)
      .catch(() => {});
  };
  T.setClock = (time) => {
    const clock = Kit.$$('.menubar .mb-right > .mb-item.num').pop();
    if (clock) clock.textContent = `${DATA.now.day}  ${time}`;
  };

  T.toast = (text, opts = {}) => Kit.toast(text, { ...opts, container: T.el.win.hidden ? T.el.desk : T.el.win });

  const originLabel = (v) => (v.kind === 'day' ? T.state.days[v.dayIndex].label : VIEW_TITLES[v.kind]);
  T.agendaOrigin = () => {
    const v = T.state.view;
    if (v.kind === 'doc') return v.from;
    return { kind: v.kind, dayIndex: v.dayIndex, scroll: T.el.content.scrollTop, peekOpen: T.state.peekOpen, label: originLabel(v) };
  };

  T.goView = (kind, { dayIndex = T.TODAY, animate = true, restore = null } = {}) => {
    const prev = T.state.view;
    const same = prev.kind === kind && (kind !== 'day' || prev.dayIndex === dayIndex);
    const leavingDoc = prev.kind === 'doc';
    if (leavingDoc) T.doc.leavePage();
    if (!restore && T.state.peekOpen && !same) T.peek.close({ animate: !leavingDoc });
    T.set({ view: { kind, dayIndex: kind === 'day' ? dayIndex : prev.dayIndex || T.TODAY } });
    if (restore) T.set({ peekOpen: !!restore.peekOpen });
    T.syncSidebarSelection();
    T.renderToolbar();
    T.renderView({ scroll: restore ? restore.scroll : 0 });
    if (animate && (!same || leavingDoc)) T.fx.fadeIn(T.el.view, { duration: 200 });
    T.syncSelection();
    if (restore && restore.peekOpen) T.peek.show({ animate: false });
  };

  T.openDoc = (sid, { reveal = null, focusPurpose = false, animate = true } = {}) => {
    const s = T.seriesById(sid);
    if (!s) return Promise.resolve(false);
    const from = T.agendaOrigin();
    const same = viewKind() === 'doc' && T.state.view.seriesId === sid;
    if (viewKind() !== 'doc') T.peek.hideForPage();
    T.set({ view: { kind: 'doc', seriesId: sid, from } });
    T.syncSidebarSelection();
    T.renderToolbar();
    const painted = same ? Promise.resolve(true) : T.doc.paintPage({ animate });
    return painted.then((ok) => {
      if (ok && reveal) T.doc.revealInPage(reveal);
      if (ok && focusPurpose) T.doc.focusPurpose();
      return ok;
    });
  };

  T.goBack = () => {
    const v = T.state.view;
    if (v.kind !== 'doc' || !v.from) return;
    T.goView(v.from.kind, { dayIndex: v.from.dayIndex, restore: v.from });
  };

  T.stepDay = (delta, { animate = true } = {}) => {
    const st = T.state;
    if (st.calendar !== 'connected') return;
    const fromOther = st.view.kind !== 'day';
    const target = fromOther ? T.TODAY + delta : st.view.dayIndex + delta;
    if (target < 0 || target >= st.days.length) return;
    if (fromOther) return T.goView('day', { dayIndex: target, animate });
    const sel = T.state.selection;
    if (T.state.peekOpen && !(sel && sel.kind === 'event' && T.dayOf(sel.id) === target)) T.peek.close({ animate });
    T.set({ view: { kind: 'day', dayIndex: target } });
    T.syncSidebarSelection();
    T.updateToolbar();
    T.renderView({ direction: animate ? Math.sign(delta) : 0 });
  };
  T.goToday = () => {
    const v = T.state.view;
    if (v.kind === 'day' && v.dayIndex === T.TODAY) return;
    if (v.kind !== 'day') return T.goView('day', { dayIndex: T.TODAY });
    T.stepDay(T.TODAY - v.dayIndex);
  };

  T.hideWindow = () => {
    if (T.el.win.hidden) return;
    if (T.el.win.contains(document.activeElement)) document.activeElement.blur();
    T.el.win.hidden = true;
  };
  T.showWindow = () => {
    if (!T.el.win.hidden) return;
    T.el.win.hidden = false;
    T.syncTimers();
  };
  T.toggleZoom = () => T.el.win.classList.toggle('zoomed');

  Object.assign(T.actions, {
    nav: (el) => T.goView(el.dataset.view),
    'open-doc': (el) => T.openDoc(el.dataset.series),
    back: () => T.goBack(),
    'win-close': () => T.hideWindow(),
    'win-min': () => T.hideWindow(),
    'win-zoom': () => T.toggleZoom(),
    'day-prev': () => T.stepDay(-1),
    'day-next': () => T.stepDay(1),
    'day-today': () => T.goToday(),
    cal: (el) => {
      const id = el.dataset.cal;
      const cal = T.state.calendars.find((c) => c.id === id);
      const watched = !cal.watched;
      T.set({ calendars: T.state.calendars.map((c) => (c.id === id ? { ...c, watched } : c)) });
      Kit.$('.check', el).setAttribute('aria-checked', String(watched));
      el.classList.toggle('is-off', !watched);
      T.toast(watched ? `Watching ${esc(cal.name)} · ${esc(cal.account)} — read on this Mac only` : `Stopped watching ${esc(cal.name)} · ${esc(cal.account)}`, { icon: 'calendar' });
      T.refreshPersonal();
    }
  });
})();
