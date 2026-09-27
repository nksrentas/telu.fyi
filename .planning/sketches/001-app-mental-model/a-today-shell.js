(() => {
  const AT = window.AT;
  const { esc } = Kit;

  const navSelected = (view) => AT.state.view === view;

  const navItem = (view, iconName, label, count) => `<div class="sb-item a-nav${navSelected(view) ? ' selected' : ''}" data-act="nav" data-view="${view}">`
    + `${icon(iconName)}<span class="truncate">${label}</span><span class="count num" data-count="${view}">${count || ''}</span></div>`;

  const nextHint = (s) => {
    const rec = AT.state.recording && AT.eventById(AT.state.recording.eventId);
    if (rec && rec.series === s.id) return '<span class="rec-dot"></span>';
    if (!s.next) return '';
    if (s.next.startsWith('Today')) return esc(s.next.split(' ')[1] || 'Today');
    return esc(s.next.split(' ')[0]);
  };

  const seriesRow = (s) => {
    const selected = AT.state.view === 'series' && AT.state.seriesId === s.id;
    return `<div class="sb-item a-sb-row${selected ? ' selected' : ''}" data-act="open-series" data-series="${s.id}">`
      + `${Kit.seriesIcon(s)}<span class="truncate">${esc(s.name)}</span><span class="a-hint num">${nextHint(s)}</span></div>`;
  };

  const seriesSection = (list) => '<div id="sbSeriesSection">'
    + `<div class="sb-title a-sb-title"><span>Series</span><button class="btn plain icon a-sb-add" data-act="new-series" data-align="start" data-tip="New series">${icon('plus')}</button></div>`
    + `<div id="sbSeries">${list.map(seriesRow).join('')}</div></div>`;

  const calendarRow = (c) => `<div class="sb-item a-cal${c.watched ? '' : ' is-off'}" data-act="cal" data-cal="${c.id}">`
    + `<button class="check square a-cal-check" data-manual aria-checked="${c.watched}" style="--cal:${c.color}" tabindex="-1">${Kit.checkSvg}</button>`
    + `<span class="a-cal-text"><span class="truncate">${esc(c.name)} · ${esc(c.account)}</span><small class="a-cal-cap">Not watched</small></span></div>`;

  const calendarsSection = () => `<div class="sb-title">Calendars</div>${AT.state.calendars.map(calendarRow).join('')}`;

  AT.renderSidebar = () => {
    const st = AT.state;
    const connected = st.calendar === 'connected';
    const tracked = AT.tracked();
    AT.el.sidebar.innerHTML = [
      '<nav class="a-sb-group">',
      navItem('day', 'sun', 'Today', AT.todayCount()),
      navItem('upcoming', 'calendar', 'Upcoming', 0),
      navItem('review', 'tray', 'Review', AT.reviewCount()),
      connected ? navItem('found', 'sparkles', 'Found in Calendar', AT.foundCount()) : '',
      '</nav>',
      tracked.length ? seriesSection(tracked) : '',
      connected ? calendarsSection() : '',
      `<div class="sb-foot">${icon('lock', 'sm')}On this Mac · processed locally</div>`
    ].join('');
  };

  AT.updateCounts = () => {
    const values = { day: AT.todayCount(), upcoming: 0, review: AT.reviewCount(), found: AT.foundCount() };
    Kit.$$('#sidebar [data-count]').forEach((el) => {
      const next = values[el.dataset.count] ? String(values[el.dataset.count]) : '';
      if (el.textContent === next) return;
      el.textContent = next;
      el.classList.remove('bump');
      void el.offsetWidth;
      el.classList.add('bump');
    });
    Kit.$$('#sidebar .a-sb-row').forEach((row) => {
      const s = AT.seriesById(row.dataset.series);
      const hint = Kit.$('.a-hint', row);
      if (s && hint && hint.innerHTML !== nextHint(s)) hint.innerHTML = nextHint(s);
    });
    if (AT.state.view === 'review') AT.updateToolbar();
  };

  AT.syncSidebarSelection = () => {
    Kit.$$('#sidebar .sb-item.selected').forEach((el) => el.classList.remove('selected'));
    const st = AT.state;
    const sel = st.view === 'series' ? `[data-series="${st.seriesId}"]` : `.a-nav[data-view="${st.view}"]`;
    const el = Kit.$(`#sidebar ${sel}`);
    if (el) el.classList.add('selected');
  };

  const flyMarkup = (s) => `<div class="a-fly">${Kit.seriesIcon(s)}<span>${esc(s.name)}</span></div>`;

  AT.revealSeriesRow = (id, fromEl) => {
    const hadSection = !!Kit.$('#sbSeries');
    AT.renderSidebar();
    const row = Kit.$(`#sidebar [data-series="${id}"]`);
    if (!row) return Promise.resolve();
    Kit.enterAnimated(hadSection ? row : Kit.$('#sbSeriesSection'));
    return Kit.flyTo(fromEl, row, { markup: flyMarkup(AT.seriesById(id)) });
  };

  AT.pulseSeriesRow = (id, fromEl) => {
    const row = Kit.$(`#sidebar [data-series="${id}"]`);
    const s = AT.seriesById(id);
    if (!row || !s) return Promise.resolve();
    return Kit.flyTo(fromEl, row, { markup: flyMarkup(s) });
  };

  AT.dropSeriesRow = (id) => {
    const row = Kit.$(`#sidebar [data-series="${id}"]`);
    if (!row) return AT.renderSidebar();
    return Kit.removeAnimated(row).then(() => AT.renderSidebar());
  };

  const titleFor = () => {
    const st = AT.state;
    const s = st.view === 'series' ? AT.seriesById(st.seriesId) : null;
    if (s) return [s.name, `${s.count} meetings · ${s.cadence}`];
    if (st.view === 'upcoming') return ['Upcoming', 'Next few days'];
    if (st.view === 'review') {
      const n = AT.reviewCount();
      return ['Review', n ? `${n} ${n === 1 ? 'item needs' : 'items need'} a look` : 'All caught up'];
    }
    const day = st.days[st.dayIndex];
    return [day.label, day.long];
  };

  const recCapsule = () => {
    const ev = AT.eventById(AT.state.recording.eventId);
    return `<div class="a-rec-capsule" id="recCapsule"><span class="rec-dot"></span><b class="truncate">${esc(ev ? ev.title : 'Recording')}</b>`
      + `<span class="num a-rec-time" data-rec-timer>0:00</span><button class="btn sm a-rec-stop" data-act="stop">${icon('stop')}Stop</button></div>`;
  };

  const syncCapsule = (animate) => {
    const slot = Kit.$('#recSlot');
    const existing = Kit.$('#recCapsule', slot);
    if (AT.state.recording && !existing) {
      slot.innerHTML = recCapsule();
      if (animate && !Kit.reduceMotion()) {
        Kit.$('#recCapsule', slot).animate([
          { opacity: 0, transform: 'scale(0.96)', filter: 'blur(2px)' },
          { opacity: 1, transform: 'none', filter: 'blur(0px)' }
        ], { duration: 240, easing: Kit.EASE_OUT });
      }
    } else if (!AT.state.recording && existing) {
      if (!animate || Kit.reduceMotion()) return existing.remove();
      existing.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(0.96)' }], { duration: 150, easing: 'ease-out', fill: 'forwards' })
        .finished.then(() => existing.remove());
    }
  };

  AT.updateToolbar = ({ animate = false } = {}) => {
    const [title, sub] = titleFor();
    const tb = Kit.$('#tbTitle');
    Kit.$('b', tb).textContent = title;
    Kit.$('span', tb).textContent = sub;
    const st = AT.state;
    const dayView = st.view === 'day' && st.calendar === 'connected';
    Kit.$('[data-act="day-prev"]').disabled = dayView && st.dayIndex === 0;
    Kit.$('[data-act="day-next"]').disabled = dayView && st.dayIndex === st.days.length - 1;
    syncCapsule(animate);
    AT.syncTimers();
  };

  AT.renderToolbar = () => {
    AT.el.toolbar.innerHTML = '<div class="toolbar-title a-tb-title" id="tbTitle"><b></b><span></span></div>'
      + '<div class="a-rec-slot" id="recSlot"></div><span class="spacer"></span>'
      + '<div class="glass-group" id="stepper">'
      + `<button class="btn icon" data-act="day-prev" data-tip="Previous day">${icon('chevron-left')}</button>`
      + '<button class="btn" data-act="day-today">Today</button>'
      + `<button class="btn icon" data-act="day-next" data-tip="Next day">${icon('chevron-right')}</button></div>`
      + '<div class="glass-group">'
      + `<button class="btn a-new-btn" data-act="new-series" id="newBtn">${icon('plus')}New<span class="kbd">⌥⌘N</span></button>`
      + `<span class="sep"></span><button class="btn icon" data-act="search" id="searchBtn" data-tip="Search">${icon('search')}</button></div>`
      + '<i class="a-progress" id="progress"></i>';
    AT.updateToolbar();
  };

  AT.runProgress = (duration = 900) => {
    const bar = Kit.$('#progress');
    if (!bar) return Promise.resolve();
    bar.getAnimations().forEach((a) => a.cancel());
    const grow = bar.animate([{ transform: 'scaleX(0)', opacity: 1 }, { transform: 'scaleX(1)', opacity: 1 }], { duration, easing: 'linear', fill: 'forwards' });
    return grow.finished
      .then(() => bar.animate([{ opacity: 1, transform: 'scaleX(1)' }, { opacity: 0, transform: 'scaleX(1)' }], { duration: 220, easing: 'ease-out', fill: 'forwards' }).finished)
      .catch(() => {});
  };

  AT.setClock = (time) => {
    const clock = Kit.$('.menubar .mb-right .num');
    if (clock) clock.textContent = `${DATA.now.day}  ${time}`;
  };

  AT.refreshPersonal = () => {
    Kit.$$('#agenda [data-personal]').forEach((el) => {
      const ev = AT.eventById(el.dataset.personal);
      const cal = AT.state.calendars.find((c) => c.name === ev.calendar);
      const label = cal && cal.watched ? `${esc(ev.title)} · Personal` : 'Personal · Busy';
      AT.fx.crossfade(el, `${icon('lock')}<span>${label}</span>`);
    });
  };

  Object.assign(AT.actions, {
    nav: (el) => {
      const view = el.dataset.view;
      if (view === 'found') return AT.openFound();
      AT.goView(view);
    },
    'open-series': (el) => AT.openSeries(el.dataset.series),
    cal: (el) => {
      const id = el.dataset.cal;
      const cal = AT.state.calendars.find((c) => c.id === id);
      const watched = !cal.watched;
      AT.set({ calendars: AT.state.calendars.map((c) => (c.id === id ? { ...c, watched } : c)) });
      Kit.$('.check', el).setAttribute('aria-checked', String(watched));
      el.classList.toggle('is-off', !watched);
      Kit.toast(watched ? `Watching ${esc(cal.name)} · ${esc(cal.account)} — read on this Mac only` : `Stopped watching ${esc(cal.name)} · ${esc(cal.account)}`, { icon: 'calendar' });
      AT.refreshPersonal();
    }
  });

  AT.goView = (view, { seriesId = null } = {}) => {
    const same = AT.state.view === view && AT.state.seriesId === seriesId && (view !== 'day' || AT.state.dayIndex === AT.TODAY);
    AT.set({ view, seriesId, dayIndex: view === 'day' ? AT.TODAY : AT.state.dayIndex });
    AT.syncSidebarSelection();
    AT.updateToolbar();
    AT.renderMain();
    if (!same) AT.fx.fadeIn(AT.el.agendaInner, { duration: 200 });
    AT.syncSelection();
  };

  AT.openSeries = (id) => {
    if (!AT.seriesById(id)) return;
    AT.goView('series', { seriesId: id });
  };

  AT.stepDay = (delta, { animate = true } = {}) => {
    const st = AT.state;
    if (st.calendar !== 'connected') return;
    const target = st.view === 'day' ? st.dayIndex + delta : AT.TODAY + delta;
    if (target < 0 || target >= st.days.length) return;
    const fromOther = st.view !== 'day';
    AT.set({ view: 'day', seriesId: null, dayIndex: target });
    AT.syncSidebarSelection();
    AT.updateToolbar();
    AT.renderMain({ direction: animate && !fromOther ? Math.sign(delta) : 0 });
    if (fromOther && animate) AT.fx.fadeIn(AT.el.agendaInner, { duration: 200 });
  };

  AT.goToday = ({ animate = true } = {}) => {
    const st = AT.state;
    if (st.view === 'day' && st.dayIndex === AT.TODAY) return;
    if (st.view !== 'day') {
      AT.set({ dayIndex: AT.TODAY });
      return AT.goView('day');
    }
    AT.stepDay(AT.TODAY - st.dayIndex, { animate });
  };
})();
