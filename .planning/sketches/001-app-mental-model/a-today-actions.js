(() => {
  const AT = window.AT;
  const { esc } = Kit;
  const { clone } = AT.util;

  const cardEl = (id) => Kit.$(`#agenda .a-card[data-id="${id}"]`);
  const unique = (ids) => ids.filter((id, i) => id && ids.indexOf(id) === i);
  const refreshInspectorFor = (id) => {
    if (AT.inspectorShows(id)) AT.renderInspector({ animate: true });
  };
  const ensureSelected = (id) => {
    const insp = AT.state.inspect;
    if (!insp || insp.kind !== 'event' || insp.id !== id) AT.select(id, { animate: true });
  };
  const withoutSeries = ({ series, ...rest }) => rest;

  AT.addStandupSeries = () => {
    if (AT.seriesById('standup')) {
      AT.mapSeries('standup', (s) => ({ ...s, tracked: true }));
    } else {
      AT.set({ series: [...AT.state.series, AT.newSeriesTemplate('standup')] });
    }
    AT.mapEvents((e) => e.title === 'Daily Standup', (e) => ({ ...e, series: 'standup' }));
    AT.set({ proposals: AT.state.proposals.filter((p) => p.id !== 'pr-standup') });
  };

  const morphStandups = () => AT.morphAll((ev) => ev.title === 'Daily Standup');

  const untrackStandup = (proposal, index) => {
    AT.set({ series: AT.state.series.filter((s) => s.id !== 'standup') });
    AT.mapEvents((e) => e.series === 'standup', withoutSeries);
    if (proposal) {
      const list = [...AT.state.proposals];
      list.splice(Math.min(index, list.length), 0, proposal);
      AT.set({ proposals: list });
    }
    morphStandups();
    AT.dropSeriesRow('standup');
    AT.updateCounts();
    AT.updateBanner();
    const t = AT.inspTarget();
    if (t.ev && t.ev.title === 'Daily Standup') AT.renderInspector({ animate: true });
  };

  AT.trackStandup = (fromEl) => {
    const existing = AT.seriesById('standup');
    if (existing && existing.tracked) return;
    const index = AT.state.proposals.findIndex((p) => p.id === 'pr-standup');
    const proposal = index >= 0 ? AT.state.proposals[index] : DATA.proposals.find((p) => p.id === 'pr-standup');
    AT.addStandupSeries();
    morphStandups();
    AT.revealSeriesRow('standup', fromEl);
    AT.updateCounts();
    AT.updateBanner();
    const t = AT.inspTarget();
    if (t.ev && t.ev.title === 'Daily Standup') AT.renderInspector({ animate: true });
    Kit.toast('Telu will prepare briefs for Daily Standup', { icon: 'check-circle', action: { label: 'Undo', onClick: () => untrackStandup(proposal, Math.max(index, 0)) } });
  };

  const retrack = (seriesId, fromEl) => {
    const s = AT.seriesById(seriesId);
    AT.mapSeries(seriesId, (x) => ({ ...x, tracked: true }));
    AT.morphAll((ev) => ev.series === seriesId);
    AT.revealSeriesRow(seriesId, fromEl);
    AT.updateCounts();
    const undo = () => {
      AT.mapSeries(seriesId, (x) => ({ ...x, tracked: false }));
      AT.morphAll((ev) => ev.series === seriesId);
      AT.dropSeriesRow(seriesId);
      AT.updateCounts();
      AT.renderInspector();
    };
    AT.renderInspector({ animate: true });
    Kit.toast(`Telu will prepare briefs for ${esc(s.name)}`, { icon: 'check-circle', action: { label: 'Undo', onClick: undo } });
  };

  AT.trackEvent = (id, fromEl) => {
    const ev = AT.eventById(id);
    if (!ev) return;
    ensureSelected(id);
    const from = fromEl || cardEl(id);
    if (ev.title === 'Daily Standup') return AT.trackStandup(from);
    if (ev.series && AT.seriesById(ev.series)) return retrack(ev.series, from);
    AT.openNewSeries(fromEl, { text: ev.title, link: ev });
  };

  const addToSeries = (eventId, seriesId) => {
    const ev = AT.eventById(eventId);
    const s = AT.seriesById(seriesId);
    AT.mapEvents((e) => e.id === eventId, (e) => ({ ...e, series: seriesId }));
    AT.morphCard(eventId);
    const card = cardEl(eventId);
    if (card) AT.pulseSeriesRow(seriesId, card);
    AT.updateCounts();
    refreshInspectorFor(eventId);
    const undo = () => {
      AT.mapEvents((e) => e.id === eventId, withoutSeries);
      AT.morphCard(eventId);
      AT.updateCounts();
      refreshInspectorFor(eventId);
    };
    Kit.toast(`Added ${esc(ev.title)} to ${esc(s.name)}`, { icon: 'check-circle', action: { label: 'Undo', onClick: undo } });
  };

  AT.addToSeriesMenu = (anchor, eventId) => {
    const ev = AT.eventById(eventId);
    const items = AT.tracked().map((s) => ({ label: esc(s.name), swatch: s.color, onSelect: () => addToSeries(eventId, s.id) }));
    Kit.menu(anchor, [{ title: 'Add to series' }, ...items, '-', { label: 'New series…', icon: 'plus', onSelect: () => AT.openNewSeries(anchor, { text: ev.title, link: ev }) }], { minWidth: 230 });
  };

  const toggleRecordOnce = (id) => {
    const ev = AT.eventById(id);
    const on = !AT.state.recordOnce[id];
    AT.set({ recordOnce: { ...AT.state.recordOnce, [id]: on } });
    AT.morphCard(id);
    refreshInspectorFor(id);
    const undo = () => {
      AT.set({ recordOnce: { ...AT.state.recordOnce, [id]: !on } });
      AT.morphCard(id);
      refreshInspectorFor(id);
    };
    Kit.toast(on ? `Telu will record ${esc(ev.title)} once, at ${ev.start}` : `Won’t record ${esc(ev.title)}`, { icon: 'clock', action: { label: 'Undo', onClick: undo } });
  };

  AT.joinProposal = (p, fromEl) => {
    const ev = AT.state.days.flatMap((d) => d.events).find((e) => e.proposal === p.id);
    const target = AT.seriesById(p.target);
    if (!ev || !target) return;
    const meeting = { id: `${target.id}-${ev.id}`, n: null, title: ev.title, date: 'Wed 30 Sep', day: 'Wed 30 Sep', time: `${ev.start}–${ev.end}`, status: 'upcoming', where: ev.where };
    AT.mapSeries(target.id, (s) => ({ ...s, meetings: [meeting, ...s.meetings.filter((m) => m.id !== meeting.id)] }));
    AT.mapEvents((e) => e.id === ev.id, (e) => ({ ...e, series: target.id, meeting: meeting.id }));
    AT.set({ proposals: AT.state.proposals.filter((x) => x.id !== p.id) });
    AT.morphCard(ev.id);
    AT.pulseSeriesRow(target.id, fromEl || cardEl(ev.id));
    AT.updateCounts();
    refreshInspectorFor(ev.id);
    const undo = () => {
      AT.mapSeries(target.id, (s) => ({ ...s, meetings: s.meetings.filter((m) => m.id !== meeting.id) }));
      AT.mapEvents((e) => e.id === ev.id, ({ series, meeting: m, ...rest }) => rest);
      AT.set({ proposals: [...AT.state.proposals, p] });
      AT.morphCard(ev.id);
      AT.updateCounts();
      refreshInspectorFor(ev.id);
    };
    Kit.toast(`Added ${esc(ev.title)} to ${esc(target.name)}`, { icon: 'check-circle', action: { label: 'Undo', onClick: undo } });
  };

  AT.keepSeparate = (p) => {
    const ev = AT.state.days.flatMap((d) => d.events).find((e) => e.proposal === p.id);
    AT.set({ proposals: AT.state.proposals.filter((x) => x.id !== p.id) });
    if (ev) {
      AT.morphCard(ev.id);
      refreshInspectorFor(ev.id);
    }
    AT.updateCounts();
    const undo = () => {
      AT.set({ proposals: [...AT.state.proposals, p] });
      if (ev) {
        AT.morphCard(ev.id);
        refreshInspectorFor(ev.id);
      }
      AT.updateCounts();
    };
    Kit.toast(`Kept separate — ${esc(p.title)} stays a one-off`, { icon: 'check', action: { label: 'Undo', onClick: undo } });
  };

  const proposalOf = (eventId) => {
    const ev = AT.eventById(eventId);
    return ev ? AT.state.proposals.find((p) => p.id === ev.proposal) : null;
  };

  const fileTo = (eventId, seriesId, fromEl) => {
    const s = AT.seriesById(seriesId);
    AT.mapEvents((e) => e.id === eventId, (e) => ({ ...e, filedTo: seriesId }));
    AT.morphCard(eventId);
    AT.pulseSeriesRow(seriesId, fromEl || cardEl(eventId));
    AT.updateCounts();
    refreshInspectorFor(eventId);
    if (AT.state.view === 'review') AT.renderMain({ keepScroll: true });
    const undo = () => {
      AT.mapEvents((e) => e.id === eventId, ({ filedTo, ...rest }) => rest);
      AT.morphCard(eventId);
      AT.updateCounts();
      refreshInspectorFor(eventId);
      if (AT.state.view === 'review') AT.renderMain({ keepScroll: true });
    };
    Kit.toast(`Filed to ${esc(s.name)}`, { icon: 'folder', action: { label: 'Undo', onClick: undo } });
  };

  const recordTarget = () => {
    const insp = AT.state.inspect;
    if (insp && insp.kind === 'event') {
      const ev = AT.eventById(insp.id);
      const kind = ev && AT.kindOf(ev);
      if (ev && AT.dayOf(ev.id) === AT.TODAY && !AT.isPast(ev, AT.TODAY) && ['ready', 'preparing', 'tracking', 'recurring', 'oneoff'].includes(kind)) return ev.id;
    }
    return AT.nextUpId();
  };

  const swapFooter = (id) => {
    const slot = Kit.$('#footBtn');
    if (!slot || !AT.inspectorShows(id)) return;
    AT.fx.crossfade(slot, AT.footButton(AT.inspTarget()), AT.syncTimers);
  };

  AT.startRecording = (id) => {
    const ev = AT.eventById(id);
    if (!ev || AT.state.recording) return;
    const before = AT.nextUpId();
    AT.set({ recording: { eventId: id, startedAt: Date.now() } });
    AT.fx.flipRows(() => unique([before, id]).forEach((x) => AT.morphCard(x)));
    AT.updateToolbar({ animate: true });
    AT.updateCounts();
    if (AT.inspectorShows(id) && AT.inspTarget().view === 'brief') swapFooter(id);
    else if (AT.inspectorShows(id)) AT.renderInspector({ animate: true });
  };

  const shortSummary = (text) => {
    const firstTwo = text.split('. ').slice(0, 2).join('. ');
    return firstTwo.length > 120 ? `${firstTwo.slice(0, 117)}…` : `${firstTwo}${firstTwo.endsWith('.') ? '' : '.'}`;
  };

  AT.openReviewFor = (eventId) => {
    if (AT.state.view !== 'day' || AT.state.dayIndex !== AT.dayOf(eventId)) {
      AT.set({ view: 'day', seriesId: null, dayIndex: AT.dayOf(eventId) });
      AT.syncSidebarSelection();
      AT.updateToolbar();
      AT.renderMain();
    }
    AT.select(eventId, { animate: true, tab: 'review' });
    const card = cardEl(eventId);
    if (card) AT.reveal(card, AT.ui.scroller);
  };

  AT.notifyReview = (eventId) => {
    const ev = AT.eventById(eventId);
    const n = AT.pending(ev.meeting);
    Kit.notify({
      title: `${ev.title} — ${n} items to review`,
      body: esc(shortSummary(DATA.afterMeeting.summary)),
      actions: [{ label: 'Review', primary: true, onClick: () => AT.openReviewFor(eventId) }],
      onClick: () => AT.openReviewFor(eventId)
    });
  };

  const finishSummary = (eventId, elapsed) => {
    const ev = AT.eventById(eventId);
    const am = DATA.afterMeeting;
    const isMain = ev.meeting === am.meeting;
    const mins = Math.max(1, Math.round(elapsed / 60));
    AT.set({ summarizing: null });
    if (ev.meeting) {
      AT.mapMeeting(ev.meeting, (m) => ({ ...m, status: isMain ? 'review' : 'done', ended: AT.state.clock, duration: `${mins} min`, summary: isMain ? am.summary : 'Recorded and summarized on this Mac. Nothing new needed review.' }));
    }
    if (isMain) AT.set({ review: { ...AT.state.review, [ev.meeting]: clone(am.candidates) } });
    AT.morphCard(eventId);
    AT.updateCounts();
    refreshInspectorFor(eventId);
    if (isMain) AT.notifyReview(eventId);
    else Kit.toast(`${esc(ev.title)} saved — summary ready`, { icon: 'check-circle' });
  };

  AT.stopRecording = () => {
    const rec = AT.state.recording;
    if (!rec) return;
    const elapsed = Math.round((Date.now() - rec.startedAt) / 1000);
    const ev = AT.eventById(rec.eventId);
    const tracked = !!(ev && ev.meeting && AT.trackedSeriesOf(ev));
    AT.set({ recording: null, summarizing: tracked ? rec.eventId : null, recordOnce: { ...AT.state.recordOnce, [rec.eventId]: false } });
    AT.fx.flipRows(() => unique([rec.eventId, AT.nextUpId()]).forEach((x) => AT.morphCard(x)));
    AT.updateToolbar({ animate: true });
    AT.updateCounts();
    refreshInspectorFor(rec.eventId);
    if (tracked) AT.ui.pending.push(setTimeout(() => finishSummary(rec.eventId, elapsed), 1500));
    else Kit.toast(`Saved a one-off recording of ${esc(ev.title)} on this Mac`, { icon: 'check-circle' });
  };

  AT.toggleRecord = (id) => {
    if (AT.state.recording) return AT.stopRecording();
    const target = id || recordTarget();
    if (!target) return Kit.toast('Nothing left to record today', { icon: 'record' });
    AT.startRecording(target);
  };

  AT.cardMenu = (event, id) => {
    const ev = AT.eventById(id);
    if (!ev || ev.state === 'personal') return;
    const kind = AT.kindOf(ev);
    const s = AT.trackedSeriesOf(ev);
    const live = kind === 'recording';
    const recordable = live || (AT.dayOf(id) === AT.TODAY && !AT.isPast(ev, AT.TODAY) && !AT.state.recording && ['ready', 'preparing', 'tracking', 'recurring', 'oneoff'].includes(kind));
    ensureSelected(id);
    Kit.contextMenu(event, [
      { label: 'Open brief', icon: 'doc', disabled: !['ready', 'preparing', 'recording'].includes(kind), onSelect: () => AT.select(id, { tab: 'brief' }) },
      { label: live ? 'Stop recording' : 'Record', icon: live ? 'stop' : 'record', kbd: '⌘R', disabled: !recordable, onSelect: () => AT.toggleRecord(id) },
      { label: 'Edit purpose…', icon: 'pencil', kbd: '⌘E', disabled: !s, onSelect: () => AT.openPurpose(s.id) },
      { label: 'Add to series…', icon: 'folder', disabled: !!s || ev.state === 'unfiled', onSelect: () => AT.addToSeriesMenu(Kit.$('.a-chip-slot', cardEl(id)) || cardEl(id), id) },
      '-',
      { label: 'Stop tracking', icon: 'x-circle', danger: true, disabled: !s || ev.state === 'unfiled', onSelect: () => AT.confirmStopTracking(s.id) }
    ]);
  };

  AT.editPurposeShortcut = () => {
    if (AT.state.view === 'series') return AT.openPurpose(AT.state.seriesId);
    const t = AT.inspTarget();
    const s = t.series || (t.ev && AT.trackedSeriesOf(t.ev));
    if (s) return AT.openPurpose(s.id);
    Kit.toast('Select a tracked meeting to edit its purpose', { icon: 'pencil' });
  };

  const joinLabel = (where) => (/zoom/i.test(where) ? 'Zoom' : /meet/i.test(where) ? 'Google Meet' : where);

  Object.assign(AT.actions, {
    select: (el) => {
      const insp = AT.state.inspect;
      if (insp && insp.kind === 'event' && insp.id === el.dataset.id) return;
      AT.select(el.dataset.id, { animate: true });
    },
    track: (el) => AT.trackEvent(el.dataset.id, el.closest('.a-card')),
    'add-to-series': (el) => {
      ensureSelected(el.dataset.id);
      AT.addToSeriesMenu(el, el.dataset.id);
    },
    'record-once': (el) => {
      ensureSelected(el.dataset.id);
      toggleRecordOnce(el.dataset.id);
    },
    'proposal-add': (el) => {
      ensureSelected(el.dataset.id);
      const p = proposalOf(el.dataset.id);
      if (p) AT.joinProposal(p, el.closest('.a-card') || el);
    },
    'proposal-keep': (el) => {
      ensureSelected(el.dataset.id);
      const p = proposalOf(el.dataset.id);
      if (p) AT.keepSeparate(p);
    },
    file: (el) => {
      ensureSelected(el.dataset.id);
      const ev = AT.eventById(el.dataset.id);
      const u = DATA.unfiled.find((x) => x.id === ev.unfiled);
      fileTo(ev.id, u.suggestion.series, el.closest('.a-suggest, .a-prop-card') || el);
    },
    'file-other': (el) => {
      const ev = AT.eventById(el.dataset.id);
      Kit.menu(el, [{ title: 'File to' }, ...AT.tracked().map((s) => ({ label: esc(s.name), swatch: s.color, onSelect: () => fileTo(ev.id, s.id, el) }))], { minWidth: 230 });
    },
    join: (el) => {
      const ev = AT.eventById(el.dataset.id);
      Kit.toast(`Opening ${esc(joinLabel(ev.where))}…`, { icon: 'video' });
    },
    'hide-banner': () => {
      AT.set({ bannerHidden: true });
      AT.updateBanner();
      Kit.toast('Hidden — they’re waiting in Found in Calendar', { icon: 'sparkles' });
    },
    'open-review': (el) => AT.select(el.dataset.id, { animate: true, tab: 'review' }),
    record: (el) => AT.toggleRecord(el.dataset.id),
    stop: () => AT.stopRecording(),
    'day-prev': () => AT.stepDay(-1),
    'day-next': () => AT.stepDay(1),
    'day-today': () => AT.goToday()
  });
})();
