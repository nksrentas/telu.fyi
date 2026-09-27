(() => {
  const T = window.T;
  const U = T.util;
  const SCENARIO_MODES = { first: 'setup', before: 'before', starting: 'starting', live: 'live', after: 'after' };

  const report = (error) => setTimeout(() => { throw error; });
  T.island = (method, ...args) => {
    const api = window.Island;
    if (api && typeof api[method] === 'function') {
      try {
        api[method](...args);
      } catch (error) {
        report(error);
      }
    }
    T.renderStatus();
  };
  T.islandForScenario = () => {
    const st = T.state;
    if (!st.onboarded) return T.island('set', T.onboarding.isOpen() ? 'hidden' : 'setup');
    if (st.recording) return T.island('set', 'live');
    if (st.starting) return T.island('set', 'starting');
    return T.island('set', SCENARIO_MODES[st.scenario] || 'before');
  };

  const todayNext = () => {
    const now = T.state.nowMin;
    const events = T.state.days[T.TODAY].events
      .filter((ev) => U.toMin(ev.end) > now && ['ready', 'preparing', 'recording'].includes(T.kindOf(ev)))
      .sort((a, b) => U.toMin(a.start) - U.toMin(b.start));
    const ev = events[0];
    return ev ? T.findMeeting(ev.meeting) : null;
  };
  const next = () => {
    const found = todayNext();
    if (!found) return null;
    return { series: found.series, meeting: found.meeting, countdown: T.isStarting(found.meeting.id) ? 'Now' : T.shortCountdown(found.meeting) };
  };

  const oneOffSubject = (rec) => {
    const ev = rec.eventId ? T.eventById(rec.eventId) : null;
    const title = ev ? ev.title : 'Recording';
    return {
      series: { id: null, name: title, color: 'var(--series-gray)', icon: 'record', people: (ev && ev.people) || [], purpose: { why: '' }, memory: [], docs: [], meetings: [] },
      meeting: { id: ev ? ev.id : null, n: null, title, date: 'Today', time: ev ? `${ev.start}–${ev.end}` : '', where: ev ? ev.where || null : null, status: 'upcoming' }
    };
  };
  const EMPTY_SUGGESTION = { text: '', sources: [] };
  const suggestionFor = (m, main) => {
    if (main) return T.liveRevealed().includes('ask') ? { text: DATA.live.suggestion.text, sources: [...DATA.live.suggestion.sources] } : { ...EMPTY_SUGGESTION };
    const ask = m && m.brief && m.brief.ask && m.brief.ask[0];
    return ask ? { text: ask.text, sources: [ask.src] } : { ...EMPTY_SUGGESTION };
  };
  const live = () => {
    const rec = T.state.recording;
    if (!rec) return null;
    const found = rec.meetingId ? T.findMeeting(rec.meetingId) : null;
    const subject = found || (rec.seriesId ? { series: T.seriesById(rec.seriesId), meeting: null } : oneOffSubject(rec));
    const main = rec.meetingId === DATA.afterMeeting.meeting;
    const shown = T.liveRevealed().filter((i) => i !== 'ask').map((i) => DATA.live.transcript[i]);
    return {
      series: subject.series,
      meeting: subject.meeting || oneOffSubject(rec).meeting,
      elapsed: Math.max(0, Math.round((Date.now() - rec.startedAt) / 1000)),
      transcript: shown.map(({ who, text }) => ({ who, text })),
      suggestion: suggestionFor(subject.meeting, main)
    };
  };
  const latestPending = () => {
    for (const s of T.tracked()) {
      const m = s.meetings.find((x) => T.pendingOf(x) > 0);
      if (m) return { series: s, meeting: m };
    }
    return null;
  };
  const after = () => {
    const found = (T.state.lastEnded && T.findMeeting(T.state.lastEnded)) || latestPending();
    return found ? { series: found.series, meeting: found.meeting, pending: T.pendingOf(found.meeting) } : null;
  };
  const evidence = (seriesId, src) => {
    const ev = T.evidenceFor(T.seriesById(seriesId), src);
    return ev.kind === 'doc'
      ? { kind: 'doc', doc: ev.doc, loc: ev.loc, quote: ev.quote }
      : { kind: 'speech', t: ev.t, who: ev.who, quote: ev.quote };
  };
  window.TeluBridge = { next, live, after, evidence };

  const shortName = (s) => (s.name.startsWith('1:1 · ') ? s.name.slice(6) : s.name);
  const untilShort = (m) => {
    if (U.dayOffset(m.date) !== 0) return m.date;
    const diff = U.toMin(U.startTime(m)) - T.state.nowMin;
    if (diff <= 0) return 'now';
    const h = Math.floor(diff / 60);
    const r = diff % 60;
    return h ? `${h}h${r ? ` ${r}m` : ''}` : `${r}m`;
  };
  const reviewMarkup = () => {
    const ended = T.state.lastEnded && T.findMeeting(T.state.lastEnded);
    const n = ended ? T.pendingOf(ended.meeting) : 0;
    return n ? `<span class="num">${n} to review</span>` : '';
  };
  const statusMarkup = () => {
    const st = T.state;
    if (!st.onboarded) return '';
    if (st.recording) return '<span class="rec-dot"></span><span class="num">Recording <span data-rec-timer>0:00</span></span>';
    if (st.summarizing) return '<span>Filing…</span>';
    const review = reviewMarkup();
    if (review) return review;
    const n = next();
    if (!n) return '';
    if (T.isStarting(n.meeting.id)) return `<span>${Kit.esc(shortName(n.series))} · now</span>`;
    return `<span class="num">${Kit.esc(shortName(n.series))} · ${untilShort(n.meeting)}</span>`;
  };
  let statusCache = null;
  T.renderStatus = () => {
    const item = document.getElementById('teluStatus');
    if (!item || !T.state) return;
    const markup = statusMarkup();
    if (markup === statusCache) return;
    statusCache = markup;
    item.querySelector('.ts-text').innerHTML = markup;
    item.classList.toggle('icon-only', !markup);
    T.syncTimers();
  };

  const toFiles = (files) => (Array.isArray(files) ? files : []).map((f) => ({ name: String((f && f.name) || 'Untitled'), size: Number((f && f.size) || 0) }));
  const attach = ({ meetingId, files }) => {
    const target = meetingId || (todayNext() && todayNext().meeting.id);
    if (!target || !T.findMeeting(target)) return;
    T.attachToMeeting(target, toFiles(files));
    T.island('refresh');
  };
  const HANDLERS = {
    'island:setup': () => {
      if (!T.state.onboarded) T.onboarding.open();
      else T.islandForScenario();
    },
    'island:open': ({ seriesId, meetingId }) => T.openMeeting({ seriesId, meetingId }),
    'island:record': ({ meetingId }) => {
      if (T.state.recording) return;
      T.startRecording(meetingId ? { meetingId } : undefined);
    },
    'island:skip': ({ meetingId }) => {
      if (T.state.starting) T.skipStarting(meetingId || T.state.starting);
      else T.island('set', 'before');
    },
    'island:stop': () => T.stopRecording(),
    'island:review': ({ meetingId }) => T.openReview(meetingId || (after() && after().meeting.id)),
    'island:attach': attach,
    'island:feedback': ({ kind }) => T.toast(kind === 'useful' ? 'Thanks — Telu will surface more like this' : 'Dismissed — Telu will ask less like this', { icon: kind === 'useful' ? 'thumbs-up' : 'x' })
  };
  T.wireIsland = () => {
    Object.entries(HANDLERS).forEach(([name, handler]) => {
      T.el.desk.addEventListener(name, (event) => handler((event && event.detail) || {}));
    });
    T.island('mount', T.el.desk, window.TeluBridge);
  };
})();
