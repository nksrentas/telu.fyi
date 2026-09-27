window.LD = (() => {
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const TODAY = new Date(2026, 8, 29);
  const AM = DATA.afterMeeting;

  const toMinutes = (hhmm) => {
    const [h, m] = String(hhmm).split(':').map(Number);
    return h * 60 + (m || 0);
  };
  const NOW = toMinutes(DATA.now.time);
  const toSeconds = (t) => {
    const [m, s] = String(t).split(':').map(Number);
    return m * 60 + (s || 0);
  };
  const parseDate = (label) => {
    const parts = String(label || '').split(' ');
    const month = MONTHS.indexOf(parts[2]);
    return month < 0 ? TODAY : new Date(2026, month, Number(parts[1]));
  };
  const dayOffset = (label) => Math.round((parseDate(label) - TODAY) / 86400000);
  const shortDate = (label) => {
    const parts = String(label || '').split(' ');
    return parts.length === 3 ? `${parts[2]} ${parts[1]}` : label;
  };
  const addDays = (n) => new Date(2026, 8, 29 + n);
  const formatDate = (date) => `${DAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
  const firstName = (name) => String(name).split(' ')[0];
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  const startTime = (m) => String(m.time || '').split('–')[0];
  const isUpcoming = (m) => m.status === 'upcoming' || m.status === 'preparing';
  const addMinutes = (hhmm, mins) => {
    const total = toMinutes(hhmm) + mins;
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  };

  const upcomingOf = (s) => s.meetings.find(isUpcoming) || null;
  const countdown = (m) => {
    const days = dayOffset(m.date);
    if (days > 0) return days === 1 ? 'Tomorrow' : `in ${days} days`;
    const diff = toMinutes(startTime(m)) - NOW;
    if (diff <= 0) return 'Now';
    if (diff < 60) return `in ${diff} min`;
    const rest = diff % 60;
    return `in ${Math.floor(diff / 60)} h${rest ? ` ${rest} min` : ''}`;
  };
  const nextHint = (s) => {
    const m = upcomingOf(s);
    if (!m) return '';
    const d = parseDate(m.date);
    return dayOffset(m.date) === 0 ? DAYS[d.getDay()] : `${DAYS[d.getDay()]} ${d.getDate()}`;
  };
  const nextToday = (series) => series
    .map((s) => ({ s, m: upcomingOf(s) }))
    .filter(({ m }) => m && dayOffset(m.date) === 0 && toMinutes(startTime(m)) > NOW)
    .sort((a, b) => toMinutes(startTime(a.m)) - toMinutes(startTime(b.m)))[0] || null;
  const soonLabel = (m) => {
    const diff = toMinutes(startTime(m)) - NOW;
    return diff < 60 ? `${diff}m` : `${Math.floor(diff / 60)}h`;
  };

  const SPOKEN = {
    'Sep 8 · 07:22': ['You', 'I’d like you to lead the Q4 onboarding revamp.'],
    'Sep 8 · 16:20': ['Maria Chen', 'Let’s run the pricing experiment until October first.'],
    'Sep 22 · 11:05': ['You', 'I’ll introduce you to Leo’s platform team this week.'],
    'Sep 15 · 19:40': ['Maria Chen', 'Do we know when the promotion packet has to be in?'],
    'Sep 1 · 04:50': ['Dana Whitfield', 'November third is the date we’re committing to.'],
    'Sep 22 · 33:10': ['Dana Whitfield', 'One year of audit-log retention works for our compliance team.'],
    'Sep 22 · 41:02': ['Dana Whitfield', 'I’ll get you the SAML metadata this week.'],
    'Sep 15 · 22:18': ['Sam Ortiz', 'Honestly, I don’t know if SOC 2 is a hard requirement before go-live.'],
    'Sep 17 · 14:02': ['Aisha Bello', 'Step three gets one primary action — everything else goes.'],
    'Sep 4 · 38:20': ['Priya Nair', 'I’ll pull cohort retention by segment for the next deck.']
  };
  const DOC_QUOTES = {
    'North-star metrics.docx · p.2': 'Activation (30-day): 41% · Target: 45%',
    'Q4 Roadmap.pdf · p.7': 'Acme go-live: Nov 3 · SOC 2 Type I: not yet scheduled',
    'Staff Eng scorecard.docx · §1': 'Bar: has owned a multi-team system end to end.'
  };
  const isDocSource = (src) => /\.\w{2,4}$/.test(String(src).split(' · ')[0]);
  const evidenceFor = (s, src, fallback = '') => {
    const [where, loc] = String(src).split(' · ');
    if (isDocSource(src)) return { kind: 'doc', doc: where, loc, quote: DOC_QUOTES[src] || fallback };
    const meeting = s ? s.meetings.find((m) => shortDate(m.date) === where) : null;
    const line = meeting && meeting.transcript ? meeting.transcript.find((l) => l.t === loc) : null;
    const spoken = SPOKEN[src];
    const who = line ? line.who : spoken ? spoken[0] : (s && s.people[0]) || 'You';
    const quote = line ? line.text : spoken ? spoken[1] : fallback;
    return { kind: 'speech', where, t: loc, who, quote, mid: meeting ? meeting.id : null };
  };

  const DERIVED = { 'ps-34': [{ type: 'decision', text: 'Pricing experiment runs until Oct 1', status: 'superseded', src: 'Sep 8 · 16:20' }] };
  const itemsOf = (s, m) => m.items || DERIVED[m.id] || s.memory
    .filter((it) => it.from === shortDate(m.date) && !it.fresh)
    .map((it) => ({ type: it.type, text: it.text, owner: it.owner, status: it.status, src: it.src }));
  const transcriptOf = (s, m) => {
    if (m.transcript && m.transcript.length) return m.transcript;
    return itemsOf(s, m)
      .map((it) => evidenceFor(s, it.src, it.text))
      .filter((ev) => ev.kind === 'speech' && ev.t)
      .map((ev) => ({ t: ev.t, who: ev.who, text: ev.quote }))
      .sort((a, b) => toSeconds(a.t) - toSeconds(b.t));
  };

  const withMemoryIds = (s) => ({ ...s, memory: s.memory.map((m, i) => ({ id: `${s.id}-m${i}`, ...m })) });
  const reviewTranscript = () => DATA.review
    .map((k) => ({ t: k.ev.t, who: k.ev.who, text: k.ev.quote }))
    .sort((a, b) => toSeconds(a.t) - toSeconds(b.t));
  const withHiringReview = (s) => (s.id !== 'hiring' ? s : {
    ...s,
    meetings: s.meetings.map((m) => (m.id !== 'hi-5' ? m : {
      ...m, candidates: DATA.review.map((k) => ({ ...k, state: 'pending' })), transcript: reviewTranscript()
    }))
  });
  const baseSeries = () => structuredClone(DATA.series).map(withMemoryIds).map(withHiringReview);

  const initial = () => ({
    series: baseSeries(),
    unfiled: structuredClone(DATA.unfiled),
    proposals: structuredClone(DATA.proposals),
    view: { kind: 'doc', id: 'product-sync' },
    expanded: { 'ps-36': true },
    edited: {},
    recording: null,
    preparing: null,
    seq: 0
  });
  const firstRun = () => ({ ...initial(), series: [], unfiled: [], proposals: [], view: { kind: 'welcome' }, expanded: {} });

  const api = {
    state: initial(),
    set(patch) {
      api.state = { ...api.state, ...patch };
      return api.state;
    },
    series(id) {
      return api.state.series.find((s) => s.id === id) || null;
    },
    current() {
      const v = api.state.view;
      return v.kind === 'doc' ? api.series(v.id) : null;
    },
    updateSeries(id, fn) {
      api.set({ series: api.state.series.map((s) => (s.id === id ? fn(s) : s)) });
      return api.series(id);
    },
    updateMeeting(sid, mid, fn) {
      return api.updateSeries(sid, (s) => ({ ...s, meetings: s.meetings.map((m) => (m.id === mid ? fn(m) : m)) }));
    },
    meeting(sid, mid) {
      const s = api.series(sid);
      return s ? s.meetings.find((m) => m.id === mid) || null : null;
    },
    nextSeq() {
      const seq = api.state.seq + 1;
      api.set({ seq });
      return seq;
    }
  };

  const liveTranscript = () => DATA.live.transcript.map((l, i) => ({ t: i ? '12:04' : '11:52', who: l.who, text: l.text }));
  const afterTranscript = () => [
    ...AM.candidates.map((c) => ({ t: c.ev.t, who: c.ev.who, text: c.ev.quote })),
    ...liveTranscript()
  ].sort((a, b) => toSeconds(a.t) - toSeconds(b.t));
  const rollForward = (s) => {
    const current = s.meetings.find((m) => m.id === AM.meeting);
    if (!current || !isUpcoming(current)) return s;
    const done = {
      ...current, status: 'review', duration: AM.duration, time: `10:00–${AM.ended}`, summary: AM.summary, where: null, brief: null,
      candidates: AM.candidates.map((c) => ({ ...c, state: 'pending' })), docs: current.brief ? current.brief.docs : [], transcript: afterTranscript()
    };
    const next = { id: 'ps-38', n: 38, date: 'Tue 6 Oct', time: '10:00–10:45', status: 'upcoming', where: 'Google Meet' };
    return { ...s, count: s.count + 1, meetings: [next, ...s.meetings.map((m) => (m.id === AM.meeting ? done : m))] };
  };
  const recordedInto = (s, seconds) => {
    const duration = `${Math.max(1, Math.round(seconds / 60))} min`;
    const summary = 'Recorded and transcribed on this Mac. Nothing here needed your review.';
    const up = upcomingOf(s);
    if (up && dayOffset(up.date) === 0) {
      const done = { ...up, status: 'done', date: 'Today', duration, summary, brief: null, counts: {}, docs: up.brief ? up.brief.docs : [] };
      const following = { ...up, id: `${up.id}-next`, n: up.n + 1, date: formatDate(addDays(7)), brief: null, status: 'upcoming' };
      return { ...s, count: s.count + 1, meetings: [following, ...s.meetings.map((m) => (m.id === up.id ? done : m))] };
    }
    const fresh = { id: `${s.id}-r${Date.now()}`, n: s.count + 1, date: 'Today', time: `${DATA.now.time}–${addMinutes(DATA.now.time, 1)}`, duration, status: 'done', summary, counts: {}, docs: [] };
    const upcoming = s.meetings.filter(isUpcoming);
    return { ...s, count: s.count + 1, meetings: [...upcoming, fresh, ...s.meetings.filter((m) => !isUpcoming(m))] };
  };

  const SUPERSEDES = { c5: 'Activation is 41% against a 45% target' };
  const STATUS_FOR = { commitment: 'open', question: 'unresolved' };
  const acceptCandidate = (s, m, c) => {
    const item = {
      id: `${s.id}-${c.id}`, type: c.type, text: c.text, owner: c.owner, due: c.due, status: STATUS_FOR[c.type] || 'current',
      from: shortDate(m.date), src: `${shortDate(m.date)} · ${c.ev.t}`, fresh: true
    };
    const old = SUPERSEDES[c.id] ? s.memory.find((it) => it.text === SUPERSEDES[c.id]) : null;
    const resolved = s.memory.map((it) => (c.resolves && it.text === c.resolves ? { ...it, status: 'completed', resolvedToday: true } : it));
    const kept = old ? resolved.filter((it) => it.id !== old.id) : resolved;
    return { ...s, memory: [old ? { ...item, replaced: `${old.text} · ${old.from}` } : item, ...kept] };
  };

  const insertByDate = (meetings, meeting) => {
    const when = parseDate(meeting.date);
    const index = meetings.findIndex((m) => !isUpcoming(m) && parseDate(m.date) <= when);
    return index < 0 ? [...meetings, meeting] : [...meetings.slice(0, index), meeting, ...meetings.slice(index)];
  };
  const withoutMeeting = (s, mid) => ({ ...s, count: Math.max(0, s.count - 1), meetings: s.meetings.filter((m) => m.id !== mid) });
  const withMeeting = (s, m) => ({ ...s, count: s.count + 1, meetings: insertByDate(s.meetings, m) });
  const moveMeeting = (state, mid, fromId, toId) => {
    const from = state.series.find((s) => s.id === fromId);
    const meeting = from ? from.meetings.find((m) => m.id === mid) : null;
    if (!meeting) return state;
    const home = meeting.homeId || fromId;
    const moved = { ...meeting, items: itemsOf(from, meeting), homeId: home, movedFrom: toId === home ? null : from.name };
    const series = state.series.map((s) => (s.id === fromId ? withoutMeeting(s, mid) : s.id === toId ? withMeeting(s, moved) : s));
    return { ...state, series };
  };
  const unfileMeeting = (state, mid, fromId) => {
    const from = state.series.find((s) => s.id === fromId);
    const m = from ? from.meetings.find((x) => x.id === mid) : null;
    if (!m) return state;
    const item = {
      id: `uf-${m.id}`, kind: 'recording', title: `${from.name} · ${m.date}`, when: `${m.date} · ${startTime(m)}`, duration: m.duration,
      suggestion: { series: fromId, why: 'Filed there until you removed it' }, meeting: { ...m, items: itemsOf(from, m) }
    };
    return { ...state, unfiled: [item, ...state.unfiled], series: state.series.map((s) => (s.id === fromId ? withoutMeeting(s, mid) : s)) };
  };
  const meetingFromUnfiled = (u) => {
    if (u.meeting) return u.meeting;
    const [date, time] = u.when.split(' · ');
    return {
      id: u.id, n: null, date, time: `${time}–${addMinutes(time, parseInt(u.duration, 10) || 0)}`, duration: u.duration, status: 'done',
      summary: 'Quick call — Dana, SSO and audit logs came up. Filed from Unfiled.', counts: {}, docs: [], filedFrom: 'Unfiled'
    };
  };
  const fileUnfiled = (state, uid, sid) => {
    const u = state.unfiled.find((x) => x.id === uid);
    if (!u) return state;
    const attach = (s) => (u.kind === 'doc'
      ? { ...s, docs: [...s.docs, { name: u.title, ver: 'v1', size: '8 KB', added: 'Sep 27', include: true }] }
      : withMeeting(s, meetingFromUnfiled(u)));
    return { ...state, unfiled: state.unfiled.filter((x) => x.id !== uid), series: state.series.map((s) => (s.id === sid ? attach(s) : s)) };
  };

  Object.assign(api, {
    DAYS, toMinutes, parseDate, dayOffset, shortDate, addDays, formatDate, firstName, plural, startTime,
    isUpcoming, addMinutes, upcomingOf, countdown, nextHint, nextToday, soonLabel, evidenceFor, itemsOf, transcriptOf,
    baseSeries, initial, firstRun, rollForward, recordedInto, acceptCandidate, moveMeeting, unfileMeeting, fileUnfiled
  });
  return api;
})();
