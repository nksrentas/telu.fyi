(() => {
  const T = window.T;
  const D = T.doc;
  const U = T.util;
  const { esc } = Kit;
  const AM = DATA.afterMeeting;
  const LIVE_SCRIPT = [[1400, 0], [3800, 1], [5800, 'ask']];
  const RECORDABLE = ['ready', 'preparing', 'tracking', 'recurring', 'oneoff'];
  const SUMMARY_BEAT = 900;
  let liveTimers = [];

  const elapsedMs = () => (T.state.recording ? Date.now() - T.state.recording.startedAt : 0);
  const isMain = () => !!T.state.recording && T.state.recording.meetingId === AM.meeting;
  const liveAsk = () => `<div class="ask live-ask"><div class="ask-head">${icon('sparkle')}Worth asking now</div><div class="ask-row"><span class="ask-text">${esc(DATA.live.suggestion.text)}</span><span class="ask-side">${DATA.live.suggestion.sources.map((src) => Kit.source(src)).join('')}</span></div></div>`;
  const lineMarkup = (i) => (i === 'ask' ? liveAsk() : `<div class="live-line"><b>${esc(DATA.live.transcript[i].who)}</b><span>${esc(DATA.live.transcript[i].text)}</span></div>`);
  T.liveRevealed = () => (isMain() ? LIVE_SCRIPT.filter(([at]) => at <= elapsedMs()).map(([, i]) => i) : []);
  T.liveLinesMarkup = () => {
    const shown = T.liveRevealed();
    return shown.length ? shown.map(lineMarkup).join('') : '<div class="live-line listening">Listening…</div>';
  };
  const clearLive = () => {
    liveTimers.forEach(clearTimeout);
    liveTimers = [];
  };
  const appendLine = (i) => {
    Kit.$$('[data-live-lines]').forEach((box) => {
      const listening = box.querySelector('.listening');
      if (listening) listening.remove();
      box.insertAdjacentHTML('beforeend', lineMarkup(i).replace('class="', 'class="enter '));
    });
    T.island('refresh');
  };
  T.scheduleLive = () => {
    clearLive();
    if (!isMain()) return;
    const since = elapsedMs();
    liveTimers = LIVE_SCRIPT.filter(([at]) => at > since).map(([at, i]) => setTimeout(() => appendLine(i), at - since));
  };
  T.stopLive = clearLive;
  T.oneOffLiveMarkup = () => `<section class="doc-sec next live pk-oneoff"><div class="live-strip"><span class="rec-dot"></span><b>Recording once</b><span class="live-timer num" data-rec-timer>0:00</span><span class="wave live-wave"><i></i><i></i><i></i><i></i><i></i></span><span class="spacer"></span><button class="btn sm" data-act="stop">${icon('stop')}Stop<span class="kbd">⌘R</span></button></div><p class="next-pending">${icon('lock', 'sm')}Kept on this Mac as a one-off — nothing is filed.</p></section>`;

  const selectedTarget = () => {
    const sel = T.state.selection;
    if (!sel || sel.kind !== 'event') return null;
    const ev = T.eventById(sel.id);
    return ev && T.dayOf(ev.id) === T.TODAY && !T.isPast(ev, T.TODAY) && RECORDABLE.includes(T.kindOf(ev)) ? { eventId: ev.id } : null;
  };
  const docTarget = () => {
    const s = D.current();
    if (!s) return null;
    const m = T.upcomingOf(s);
    return m && U.dayOffset(m.date) === 0 ? { meetingId: m.id } : { seriesId: s.id };
  };
  T.recordTarget = () => {
    if (T.state.view.kind === 'doc') return docTarget();
    const next = T.nextUpId();
    return selectedTarget() || (next ? { eventId: next } : null);
  };
  const resolve = ({ eventId = null, meetingId = null, seriesId = null } = {}) => {
    const ev = eventId ? T.eventById(eventId) : meetingId ? T.eventForMeeting(meetingId) : null;
    const found = T.findMeeting(meetingId || (ev && ev.meeting));
    const tracked = found && found.series.tracked ? found : null;
    return { eventId: ev ? ev.id : null, meetingId: tracked ? tracked.meeting.id : null, seriesId: seriesId || (tracked ? tracked.series.id : null) };
  };

  const repaint = ({ before = null, rec, animate = true, peekCrossfade = false }) => {
    const ids = [before, T.nextUpId(), rec.eventId].filter((id, i, all) => id && all.indexOf(id) === i);
    T.fx.flipRows(() => ids.forEach((id) => T.morphCard(id)));
    T.updateToolbar({ animate });
    T.updateCounts();
    if (rec.seriesId) D.paintNextFor(rec.seriesId, { animate, scope: peekCrossfade ? '#view' : '#win' });
    if (peekCrossfade || (rec.eventId && T.peek.shows(rec.eventId) && !rec.seriesId)) T.peek.refresh({ crossfade: peekCrossfade });
    T.syncTimers();
  };

  T.startRecording = (target) => {
    if (T.state.recording) return;
    const rec = resolve(target || T.recordTarget() || {});
    if (!rec.eventId && !rec.seriesId) {
      T.toast('Nothing left to record today', { icon: 'record' });
      return;
    }
    const before = T.nextUpId();
    dismissStarting();
    T.set({ recording: { ...rec, startedAt: Date.now() }, starting: null });
    repaint({ before, rec });
    T.scheduleLive();
    T.island('set', 'live');
  };

  const enterAfter = () => {
    T.set({
      scenario: 'after', clock: '10:46', nowMin: U.toMin('10:46'), lastEnded: AM.meeting,
      series: T.state.series.map((s) => (s.id === AM.series ? T.rollForward(s) : s)),
      expanded: { ...T.state.expanded, [AM.meeting]: true }
    });
    T.setClock(T.state.clock);
    if (T.ui.scenarios) T.ui.scenarios.set('after', false);
    if (T.state.view.kind !== 'doc') {
      T.renderView({ keepScroll: true });
      const ev = T.eventForMeeting(AM.meeting);
      const card = ev && Kit.$(`#view .a-card[data-id="${ev.id}"]`);
      if (card) T.fx.fadeIn(card, { duration: 240 });
    } else {
      D.paintNextFor(AM.series, { animate: true, scope: '#view' });
      D.insertNewest(AM.series, AM.meeting);
    }
    T.peek.refresh({ crossfade: true });
    T.updateCounts();
    T.updateToolbar();
    D.receive(Kit.$(`#sidebar .a-sb-row[data-series="${AM.series}"]`));
    T.island('set', 'after');
    T.later(T.notifyReview, 250);
  };
  const finishTracked = (rec, seconds) => {
    const seq = T.nextSeq();
    T.mapSeries(rec.seriesId, (s) => T.recordedInto(s, { seconds, meetingId: rec.meetingId, clock: T.state.clock, seq }));
    const doneId = rec.meetingId || `${rec.seriesId}-r${seq}`;
    T.set({ lastEnded: doneId });
    const s = T.seriesById(rec.seriesId);
    repaint({ rec, peekCrossfade: true });
    D.insertNewest(rec.seriesId, doneId);
    T.toast(`Filed today’s recording to ${esc(s.name || 'Untitled')}`, { icon: 'check-circle' });
    T.island('set', 'after');
  };
  const finishRecording = (rec, seconds) => {
    T.set({ summarizing: null });
    if (rec.meetingId === AM.meeting) return enterAfter();
    return finishTracked(rec, seconds);
  };

  T.stopRecording = () => {
    const rec = T.state.recording;
    if (!rec) return;
    const seconds = Math.round((Date.now() - rec.startedAt) / 1000);
    clearLive();
    const tracked = !!rec.seriesId;
    const recordOnce = rec.eventId ? { ...T.state.recordOnce, [rec.eventId]: false } : T.state.recordOnce;
    T.set({ recording: null, recordOnce, summarizing: tracked ? { meetingId: rec.meetingId, seriesId: rec.seriesId } : null });
    repaint({ rec });
    T.island('set', 'filing');
    if (tracked) {
      T.later(() => finishRecording(rec, seconds), SUMMARY_BEAT);
      return;
    }
    const ev = rec.eventId ? T.eventById(rec.eventId) : null;
    T.toast(`Saved a one-off recording${ev ? ` of ${esc(ev.title)}` : ''} on this Mac`, { icon: 'check-circle' });
    T.later(() => T.island('set', 'before'), SUMMARY_BEAT);
  };
  T.toggleRecord = (target) => (T.state.recording ? T.stopRecording() : T.startRecording(target));

  const paintStarting = (mid) => {
    T.morphMeeting(mid);
    const found = T.findMeeting(mid);
    if (found) D.paintNextFor(found.series.id);
  };
  T.skipStarting = (meetingId) => {
    const mid = meetingId || T.state.starting;
    if (!mid || T.state.starting !== mid) return;
    dismissStarting();
    T.set({ starting: null });
    paintStarting(mid);
    T.island('set', 'before');
    const found = T.findMeeting(mid);
    const undo = () => {
      T.set({ starting: mid });
      paintStarting(mid);
      T.island('set', 'starting');
    };
    T.toast(`Won’t record ${esc(found ? found.series.name : 'this meeting')} this time`, { icon: 'clock', action: { label: 'Undo', onClick: undo } });
  };

  T.openMeeting = ({ seriesId, meetingId } = {}) => {
    T.showWindow();
    const found = meetingId && T.findMeeting(meetingId);
    if (!found) {
      if (seriesId && T.seriesById(seriesId)) T.openDoc(seriesId);
      return;
    }
    const ev = T.eventForMeeting(meetingId);
    const dayIndex = ev ? T.dayOf(ev.id) : T.TODAY;
    const v = T.state.view;
    if (dayIndex >= T.state.days.length) T.goView('upcoming');
    else if (v.kind !== 'day' || v.dayIndex !== dayIndex) T.goView('day', { dayIndex });
    T.select(ev ? { kind: 'event', id: ev.id } : { kind: 'meeting', id: meetingId });
    const card = ev && Kit.$(`#view .a-card[data-id="${ev.id}"]`);
    if (card) T.reveal(card, T.el.content);
  };
  T.openReview = (meetingId) => {
    T.showWindow();
    const ev = T.eventForMeeting(meetingId);
    if (T.state.view.kind !== 'review') T.goView('review');
    T.select(ev ? { kind: 'event', id: ev.id } : { kind: 'meeting', id: meetingId });
    const card = ev && Kit.$(`#view .a-card[data-id="${ev.id}"]`);
    if (card) T.reveal(card, T.el.content);
  };

  const dismissStarting = () => {
    if (T.ui.startNotif) T.ui.startNotif.dismiss();
    T.ui.startNotif = null;
  };
  T.notifyStarting = () => {
    T.ui.startNotif = Kit.notify({
      title: 'Product Sync is starting',
      body: 'Google Meet · 10:00–10:45 · your brief is ready',
      actions: [
        { label: 'Record', primary: true, onClick: () => T.startRecording({ meetingId: AM.meeting }) },
        { label: 'Not this time', onClick: () => T.skipStarting(AM.meeting) }
      ],
      onClick: () => T.openMeeting({ meetingId: AM.meeting })
    });
  };
  T.notifyReview = () => {
    const n = T.pending(AM.meeting);
    if (!n) return;
    Kit.notify({
      title: `Product Sync — ${n} ${n === 1 ? 'item' : 'items'} to review`,
      body: `Today · ${AM.duration} · summary ready on this Mac`,
      actions: [{ label: 'Review', primary: true, onClick: () => T.openReview(AM.meeting) }],
      onClick: () => T.openReview(AM.meeting)
    });
  };

  Object.assign(T.actions, {
    record: (el) => {
      if (T.state.recording) return T.stopRecording();
      if (el.dataset.id) return T.startRecording({ eventId: el.dataset.id });
      if (el.dataset.mid) return T.startRecording({ meetingId: el.dataset.mid });
      return T.startRecording(el.dataset.sid ? { seriesId: el.dataset.sid } : undefined);
    },
    stop: () => T.stopRecording(),
    skip: (el) => T.skipStarting(el.dataset.mid)
  });
})();
