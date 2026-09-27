(() => {
  const T = window.T;
  const { esc } = Kit;
  const cardEl = (id) => Kit.$(`#view .a-card[data-id="${id}"]`);
  const flyChip = (glyph, label) => `<div class="fly-chip">${glyph}<span>${esc(label)}</span></div>`;
  const refreshFor = (id) => {
    if (T.peek.shows(id)) T.peek.refresh({ crossfade: true });
  };
  const ensureSelected = (id) => {
    const sel = T.state.selection;
    if (!sel || sel.kind !== 'event' || sel.id !== id) T.select({ kind: 'event', id }, { peek: T.state.peekOpen });
  };
  const withoutSeries = ({ series, meeting, ...rest }) => rest;
  const dayDate = (dayIndex) => T.dayInfo(dayIndex).date;

  const afterSeriesChange = () => {
    T.updateCounts();
    T.updateBanner();
    T.island('refresh');
  };

  const addStandupSeries = () => {
    const p = DATA.proposals.find((x) => x.id === 'pr-standup');
    const existing = T.seriesById('standup');
    if (existing) T.mapSeries('standup', (s) => ({ ...s, tracked: true }));
    else T.set({ series: [...T.state.series, T.seriesFromProposal(p)] });
    T.mapEvents((ev) => ev.title === 'Daily Standup', (ev) => ({ ...ev, series: 'standup', meeting: T.dayOf(ev.id) === 2 ? 'standup-1' : undefined }));
    T.set({ proposals: T.state.proposals.filter((x) => x.id !== 'pr-standup') });
  };
  T.addStandupSeries = addStandupSeries;
  const untrackStandup = (proposal, index) => {
    T.set({ series: T.state.series.filter((s) => s.id !== 'standup') });
    T.mapEvents((ev) => ev.series === 'standup', withoutSeries);
    if (proposal) {
      const list = [...T.state.proposals];
      list.splice(Math.min(index, list.length), 0, proposal);
      T.set({ proposals: list });
    }
    T.morphAll((ev) => ev.title === 'Daily Standup');
    T.dropSeriesRow('standup');
    afterSeriesChange();
    T.renderPageIfFound();
    T.peek.refresh({ crossfade: true });
  };
  T.trackStandup = (fromEl) => {
    const existing = T.seriesById('standup');
    if (existing && existing.tracked) return;
    const index = T.state.proposals.findIndex((p) => p.id === 'pr-standup');
    const proposal = index >= 0 ? T.state.proposals[index] : DATA.proposals.find((p) => p.id === 'pr-standup');
    addStandupSeries();
    T.morphAll((ev) => ev.title === 'Daily Standup');
    T.revealSeriesRow('standup', fromEl);
    afterSeriesChange();
    T.peek.refresh({ crossfade: true });
    T.toast('Telu will prepare briefs for Daily Standup', { icon: 'check-circle', action: { label: 'Undo', onClick: () => untrackStandup(proposal, Math.max(index, 0)) } });
  };

  const retrack = (seriesId, fromEl) => {
    const s = T.seriesById(seriesId);
    T.mapSeries(seriesId, (x) => ({ ...x, tracked: true }));
    T.morphAll((ev) => ev.series === seriesId);
    T.revealSeriesRow(seriesId, fromEl);
    afterSeriesChange();
    T.peek.refresh({ crossfade: true });
    const undo = () => {
      T.mapSeries(seriesId, (x) => ({ ...x, tracked: false }));
      T.morphAll((ev) => ev.series === seriesId);
      T.dropSeriesRow(seriesId);
      afterSeriesChange();
      T.peek.refresh({ crossfade: true });
    };
    T.toast(`Telu will prepare briefs for ${esc(s.name)}`, { icon: 'check-circle', action: { label: 'Undo', onClick: undo } });
  };
  T.trackEvent = (id, fromEl) => {
    const ev = T.eventById(id);
    if (!ev) return;
    const from = fromEl || cardEl(id);
    if (ev.title === 'Daily Standup') return T.trackStandup(from);
    if (ev.series && T.seriesById(ev.series)) return retrack(ev.series, from);
    return T.openNewSeries(fromEl, { text: ev.title, link: ev });
  };

  const meetingForEvent = (ev, target) => ({
    id: `${target.id}-${ev.id}`, n: null, title: ev.title, date: dayDate(T.dayOf(ev.id)), time: `${ev.start}–${ev.end}`, status: 'upcoming', where: ev.where || null
  });
  const attachEvent = (eventId, seriesId) => {
    const ev = T.eventById(eventId);
    const target = T.seriesById(seriesId);
    const meeting = meetingForEvent(ev, target);
    T.mapSeries(seriesId, (s) => ({ ...s, meetings: T.insertUpcoming(s.meetings.filter((m) => m.id !== meeting.id), meeting) }));
    T.mapEvents((x) => x.id === eventId, (x) => ({ ...x, series: seriesId, meeting: meeting.id }));
    return meeting;
  };
  const detachEvent = (eventId, seriesId, meetingId) => {
    T.mapSeries(seriesId, (s) => ({ ...s, meetings: s.meetings.filter((m) => m.id !== meetingId) }));
    T.mapEvents((x) => x.id === eventId, withoutSeries);
  };
  const addToSeries = (eventId, seriesId) => {
    const ev = T.eventById(eventId);
    const s = T.seriesById(seriesId);
    const meeting = attachEvent(eventId, seriesId);
    T.morphCard(eventId);
    if (cardEl(eventId)) T.pulseSeriesRow(seriesId, cardEl(eventId));
    afterSeriesChange();
    refreshFor(eventId);
    const undo = () => {
      detachEvent(eventId, seriesId, meeting.id);
      T.morphCard(eventId);
      afterSeriesChange();
      refreshFor(eventId);
    };
    T.toast(`Added ${esc(ev.title)} to ${esc(s.name)}`, { icon: 'check-circle', action: { label: 'Undo', onClick: undo } });
  };
  T.addToSeriesMenu = (anchor, eventId) => {
    const ev = T.eventById(eventId);
    const items = T.tracked().map((s) => ({ label: esc(s.name), swatch: s.color, onSelect: () => addToSeries(eventId, s.id) }));
    Kit.menu(anchor, [{ title: 'Add to series' }, ...items, '-', { label: 'New series…', icon: 'plus', onSelect: () => T.openNewSeries(anchor, { text: ev.title, link: ev }) }], { minWidth: 230 });
  };

  const toggleRecordOnce = (id) => {
    const ev = T.eventById(id);
    const on = !T.state.recordOnce[id];
    const apply = (value) => {
      T.set({ recordOnce: { ...T.state.recordOnce, [id]: value } });
      T.morphCard(id);
      refreshFor(id);
    };
    apply(on);
    T.toast(on ? `Telu will record ${esc(ev.title)} once, at ${ev.start}` : `Won’t record ${esc(ev.title)}`, { icon: 'clock', action: { label: 'Undo', onClick: () => apply(!on) } });
  };

  T.joinProposal = (p, fromEl) => {
    const ev = T.state.days.flatMap((d) => d.events).find((x) => x.proposal === p.id);
    const target = T.seriesById(p.target);
    if (!ev || !target) return;
    const meeting = attachEvent(ev.id, target.id);
    T.set({ proposals: T.state.proposals.filter((x) => x.id !== p.id) });
    T.morphCard(ev.id);
    T.pulseSeriesRow(target.id, fromEl || cardEl(ev.id), flyChip(icon('link'), p.title));
    afterSeriesChange();
    refreshFor(ev.id);
    const undo = () => {
      detachEvent(ev.id, target.id, meeting.id);
      T.set({ proposals: [...T.state.proposals, p] });
      T.morphCard(ev.id);
      afterSeriesChange();
      T.renderPageIfFound();
      refreshFor(ev.id);
    };
    T.toast(`${esc(ev.title)} now files into ${esc(target.name)}`, { icon: 'check-circle', action: { label: 'Undo', onClick: undo } });
  };
  T.keepSeparate = (p) => {
    const ev = T.state.days.flatMap((d) => d.events).find((x) => x.proposal === p.id);
    const apply = (list) => {
      T.set({ proposals: list });
      if (ev) {
        T.morphCard(ev.id);
        refreshFor(ev.id);
      }
      afterSeriesChange();
    };
    apply(T.state.proposals.filter((x) => x.id !== p.id));
    T.toast(`Kept separate — ${esc(p.title)} stays a one-off`, { icon: 'check', action: { label: 'Undo', onClick: () => { apply([...T.state.proposals, p]); T.renderPageIfFound(); } } });
  };
  const proposalOf = (eventId) => {
    const ev = T.eventById(eventId);
    return ev ? T.state.proposals.find((p) => p.id === ev.proposal) : null;
  };

  const snapshot = () => ({ series: T.state.series, unfiled: T.state.unfiled, days: T.state.days });
  const restoreFiling = (snap) => {
    T.set(snap);
    T.renderSidebar();
    T.syncSidebarSelection();
    T.renderView({ keepScroll: true });
    T.peek.refresh({ crossfade: true });
    T.updateCounts();
  };
  T.fileUnfiled = (uid, sid, fromEl) => {
    const u = T.state.unfiled.find((x) => x.id === uid);
    const s = T.seriesById(sid);
    if (!u || !s) return;
    const snap = snapshot();
    T.set(T.withFiled(T.state, uid, sid));
    if (fromEl) T.pulseSeriesRow(sid, fromEl, flyChip(icon(u.kind === 'recording' ? 'waveform' : 'doc'), u.title));
    const card = Kit.$(`#view .uf-card[data-uid="${uid}"]`);
    if (card && T.state.view.kind === 'review') Kit.removeAnimated(card).then(() => T.pagesAfterFiling());
    Kit.$$('#view .a-card').forEach((el) => {
      const ev = T.eventById(el.dataset.id);
      if (ev && ev.unfiled === uid) T.morphCard(ev.id);
    });
    T.updateCounts();
    T.peek.refresh({ crossfade: true });
    T.toast(`Filed to ${esc(s.name)}`, { icon: 'folder', action: { label: 'Undo', onClick: () => restoreFiling(snap) } });
  };
  const unfiledIdOf = (el) => {
    const host = el.closest('[data-uid]');
    if (host) return host.dataset.uid;
    const ev = el.dataset.id ? T.eventById(el.dataset.id) : null;
    return ev ? ev.unfiled : null;
  };
  const fileThere = (el) => {
    const uid = unfiledIdOf(el);
    const u = T.state.unfiled.find((x) => x.id === uid);
    if (u && u.suggestion) T.fileUnfiled(uid, u.suggestion.series, el.closest('.uf-card, .a-suggest, .a-card') || el);
  };
  const fileChoose = (el) => {
    const uid = unfiledIdOf(el);
    Kit.menu(el, [{ title: 'File to' }, ...T.tracked().map((s) => ({ label: esc(s.name), swatch: s.color, onSelect: () => T.fileUnfiled(uid, s.id, el.closest('.uf-card') || el) }))], { minWidth: 230 });
  };

  T.pagesAfterReview = (mid) => {
    const ev = T.eventForMeeting(mid);
    const row = ev && Kit.$(`#view .a-row[data-row="${ev.id}"]`);
    if (!row) return;
    T.later(() => Kit.removeAnimated(row).then(() => {
      if (!Kit.$('#view .pg-review .a-timeline .a-row')) T.renderView({ keepScroll: true });
    }), 500);
  };
  T.pagesAfterFiling = () => {
    if (T.state.view.kind === 'review' && !T.state.unfiled.length) T.renderView({ keepScroll: true });
  };
  T.renderPageIfFound = () => {
    if (T.state.view.kind === 'found') T.renderView({ keepScroll: true });
    T.updateToolbar();
  };

  T.confirmStopTracking = async (id) => {
    const s = T.seriesById(id);
    if (!s) return;
    const answer = await Kit.alert({
      title: `Stop tracking ${esc(s.name)}?`,
      message: 'Telu keeps its memory and past meetings, but won’t prepare briefs for new ones.',
      buttons: [{ label: 'Cancel', value: 'cancel' }, { label: 'Stop Tracking', value: 'stop', primary: true }]
    });
    if (answer !== 'stop') return;
    const inDoc = T.state.view.kind === 'doc' && T.state.view.seriesId === id;
    T.mapSeries(id, (x) => ({ ...x, tracked: false }));
    if (inDoc && T.state.view.from) T.goBack();
    else if (inDoc) T.goView('day');
    T.dropSeriesRow(id);
    if (!inDoc) T.renderView({ keepScroll: true });
    T.peek.refresh({ crossfade: true });
    afterSeriesChange();
    const undo = () => {
      T.mapSeries(id, (x) => ({ ...x, tracked: true }));
      T.renderSidebar();
      T.syncSidebarSelection();
      if (T.state.view.kind !== 'doc') T.renderView({ keepScroll: true });
      T.peek.refresh({ crossfade: true });
      afterSeriesChange();
    };
    T.toast(`Stopped tracking ${esc(s.name)}`, { icon: 'x-circle', action: { label: 'Undo', onClick: undo } });
  };

  T.cardMenu = (event, id) => {
    const ev = T.eventById(id);
    if (!ev || ev.state === 'personal') return;
    const kind = T.kindOf(ev);
    const s = T.trackedSeriesOf(ev);
    const live = kind === 'recording';
    const recordable = live || (T.dayOf(id) === T.TODAY && !T.isPast(ev, T.TODAY) && !T.state.recording && ['ready', 'preparing', 'tracking', 'recurring', 'oneoff'].includes(kind));
    ensureSelected(id);
    Kit.contextMenu(event, [
      { label: 'Open in side peek', icon: 'sidebar', kbd: '↩', onSelect: () => T.select({ kind: 'event', id }) },
      { label: 'Open as page', icon: 'arrow-up-right', disabled: !s, onSelect: () => T.openDoc(s.id, { reveal: ev.meeting ? (['ready', 'preparing', 'recording'].includes(kind) ? { next: true } : { mid: ev.meeting }) : null }) },
      { label: live ? 'Stop recording' : 'Record', icon: live ? 'stop' : 'record', kbd: '⌘R', disabled: !recordable, onSelect: () => T.toggleRecord({ eventId: id }) },
      { label: 'Edit purpose…', icon: 'pencil', kbd: '⌘E', disabled: !s, onSelect: () => T.openDoc(s.id, { focusPurpose: true }) },
      { label: 'Add to series…', icon: 'folder', disabled: !!s || ev.state === 'unfiled', onSelect: () => T.addToSeriesMenu(Kit.$('.a-chip-slot', cardEl(id)) || cardEl(id), id) },
      '-',
      { label: 'Stop tracking…', icon: 'x-circle', danger: true, disabled: !s || ev.state === 'unfiled', onSelect: () => T.confirmStopTracking(s.id) }
    ]);
  };

  Object.assign(T.actions, {
    track: (el) => T.trackEvent(el.dataset.id, el.closest('.a-card') || el),
    'add-to-series': (el) => {
      ensureSelected(el.dataset.id);
      T.addToSeriesMenu(el, el.dataset.id);
    },
    'record-once': (el) => toggleRecordOnce(el.dataset.id),
    'proposal-add': (el) => {
      const p = proposalOf(el.dataset.id);
      if (p) T.joinProposal(p, el.closest('.a-card, .a-prop-card') || el);
    },
    'proposal-keep': (el) => {
      const p = proposalOf(el.dataset.id);
      if (p) T.keepSeparate(p);
    },
    file: (el) => fileThere(el),
    'file-there': (el) => fileThere(el),
    'file-choose': (el) => fileChoose(el),
    play: (el) => {
      const uid = unfiledIdOf(el);
      const u = T.state.unfiled.find((x) => x.id === uid) || DATA.unfiled.find((x) => x.id === uid);
      T.toast(`Playing ${esc(u ? u.title : 'recording')} · on this Mac`, { icon: 'play' });
    },
    'hide-banner': () => {
      T.set({ bannerHidden: true });
      T.updateBanner();
      T.toast('Hidden — they’re waiting in Found in Calendar', { icon: 'sparkles' });
    },
    'open-found': () => T.goView('found'),
    'open-settings': () => T.toast('Opening System Settings › Privacy & Security › Calendars', { icon: 'sliders' })
  });
})();
