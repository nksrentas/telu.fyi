window.T = window.T || {};

(() => {
  const T = window.T;
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const BASE = new Date(2026, 8, 29);
  const TODAY = 1;

  const clone = (value) => structuredClone(value);
  const toMin = (time) => {
    const [h, m] = String(time).split(':').map(Number);
    return h * 60 + (m || 0);
  };
  const toSec = (time) => {
    const [m, s] = String(time).split(':').map(Number);
    return m * 60 + (s || 0);
  };
  const hhmm = (mins) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
  const fmtDuration = (mins) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (!h) return `${m} min`;
    return m ? `${h} h ${m} min` : `${h} h`;
  };
  const fmtSize = (bytes) => {
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
    if (bytes >= 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${bytes || 0} bytes`;
  };
  const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  const minutesOf = (d) => parseInt(d, 10) || 0;
  const shortDate = (label) => {
    const parts = String(label || '').split(' ');
    return parts.length === 3 ? `${parts[2]} ${parts[1]}` : label;
  };
  const parseDate = (label) => {
    const parts = String(label || '').split(' ');
    const month = MONTHS.indexOf(parts[2]);
    return month < 0 ? BASE : new Date(2026, month, Number(parts[1]));
  };
  const dayOffset = (label) => Math.round((parseDate(label) - BASE) / 86400000);
  const addDays = (n) => new Date(2026, 8, 29 + n);
  const formatDate = (date) => `${DAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
  const addMinutes = (time, mins) => hhmm(toMin(time) + mins);
  const firstName = (name) => String(name).split(' ')[0];
  const startTime = (m) => String(m.time || '').split('–')[0];
  const isUpcoming = (m) => m.status === 'upcoming' || m.status === 'preparing';

  T.TODAY = TODAY;
  T.util = {
    MONTHS, DAYS, clone, toMin, toSec, hhmm, fmtDuration, fmtSize, plural, minutesOf, shortDate, parseDate,
    dayOffset, addDays, formatDate, addMinutes, firstName, startTime, isUpcoming
  };
  T.ui = { timers: new Map(), pending: [], sheet: null, slideToken: 0, scenarios: null, peekKey: null };
  T.actions = {};

  T.later = (fn, ms) => {
    const id = setTimeout(() => {
      T.ui.pending = T.ui.pending.filter((x) => x !== id);
      fn();
    }, ms);
    T.ui.pending = [...T.ui.pending, id];
    return id;
  };
  T.clearLater = () => {
    T.ui.pending.forEach(clearTimeout);
    T.ui.pending = [];
  };

  T.set = (patch) => {
    T.state = { ...T.state, ...patch };
    return T.state;
  };
  T.mapSeries = (id, fn) => T.set({ series: T.state.series.map((s) => (s.id === id ? fn(s) : s)) });
  T.mapMeeting = (id, fn) => T.set({
    series: T.state.series.map((s) => (s.meetings.some((m) => m.id === id)
      ? { ...s, meetings: s.meetings.map((m) => (m.id === id ? fn(m) : m)) }
      : s))
  });
  T.mapEvents = (match, fn) => T.set({
    days: T.state.days.map((d) => ({ ...d, events: d.events.map((ev) => (match(ev) ? fn(ev) : ev)) }))
  });

  T.seriesById = (id) => T.state.series.find((s) => s.id === id) || null;
  T.tracked = () => T.state.series.filter((s) => s.tracked);
  T.findMeeting = (id) => {
    if (!id) return null;
    for (const s of T.state.series) {
      const meeting = s.meetings.find((m) => m.id === id);
      if (meeting) return { series: s, meeting };
    }
    return null;
  };

  T.EXTRA_DAYS = [
    { key: 'thu', label: 'Thursday', date: 'Thu 1 Oct', long: 'Thursday, 1 October' },
    { key: 'fri', label: 'Friday', date: 'Fri 2 Oct', long: 'Friday, 2 October' }
  ];
  T.extraEvents = () => {
    const tracked = (id) => {
      const s = T.seriesById(id);
      return s && s.tracked;
    };
    return [
      tracked('growth') && { id: 'x-growth', day: 3, start: '11:00', end: '11:45', title: 'Growth Review', calendar: 'Work', repeat: 'Weekly', series: 'growth', meeting: 'growth-1', state: 'ready', where: 'Room 3A' },
      tracked('design-review') && { id: 'x-dr-15', day: 3, start: '15:00', end: '16:00', title: 'Design Review', calendar: 'Work', repeat: 'Every 2 weeks', series: 'design-review', meeting: 'dr-15', state: 'ready', where: 'Studio' },
      tracked('board') && { id: 'x-bp-9', day: 4, start: '09:00', end: '10:00', title: 'Board Prep', calendar: 'Work', repeat: 'Monthly', series: 'board', meeting: 'bp-9', state: 'ready', where: 'Board room' }
    ].filter(Boolean);
  };
  T.allEvents = () => [...T.state.days.flatMap((d) => d.events), ...T.extraEvents()];
  T.eventById = (id) => T.allEvents().find((ev) => ev.id === id) || null;
  T.eventForMeeting = (meetingId) => (meetingId ? T.allEvents().find((ev) => ev.meeting === meetingId) || null : null);
  T.dayOf = (id) => {
    const index = T.state.days.findIndex((d) => d.events.some((ev) => ev.id === id));
    if (index >= 0) return index;
    const extra = T.extraEvents().find((ev) => ev.id === id);
    return extra ? extra.day : TODAY;
  };
  T.dayInfo = (dayIndex) => (dayIndex < T.state.days.length ? T.state.days[dayIndex] : T.EXTRA_DAYS[dayIndex - T.state.days.length]);
  T.dayLabel = (dayIndex) => (dayIndex < T.state.days.length ? T.state.days[dayIndex].label : T.EXTRA_DAYS[dayIndex - T.state.days.length].date);
  T.isPast = (ev, dayIndex) => dayIndex < TODAY || (dayIndex === TODAY && toMin(ev.end) <= T.state.nowMin);

  T.isPendingCand = (c) => c.state === 'pending' || c.state === 'editing';
  T.pendingOf = (m) => (m && m.candidates ? m.candidates.filter(T.isPendingCand).length : 0);
  T.pending = (meetingId) => {
    const found = T.findMeeting(meetingId);
    return found ? T.pendingOf(found.meeting) : 0;
  };
  T.isStarting = (meetingId) => !!meetingId && T.state.starting === meetingId && !T.state.recording;

  const trackedKind = (ev) => {
    const found = T.findMeeting(ev.meeting);
    if (!found) return 'tracking';
    const m = found.meeting;
    if (T.pendingOf(m) > 0) return 'review';
    if (['done', 'review', 'cancelled'].includes(m.status)) return 'filed';
    if (m.status === 'preparing') return 'preparing';
    return 'ready';
  };

  T.kindOf = (ev) => {
    const st = T.state;
    if (ev.state === 'personal') return 'personal';
    if (st.recording && st.recording.eventId === ev.id) return 'recording';
    if (st.summarizing && ev.meeting && st.summarizing.meetingId === ev.meeting) return 'summarizing';
    if (ev.state === 'unfiled') return ev.filedTo ? 'filed' : 'unfiled';
    const s = ev.series ? T.seriesById(ev.series) : null;
    if (s && s.tracked) return trackedKind(ev);
    if (ev.state === 'proposal' && st.proposals.some((p) => p.id === ev.proposal)) return 'proposal';
    return ev.repeat ? 'recurring' : 'oneoff';
  };
  T.trackedSeriesOf = (ev) => {
    const id = ev.state === 'unfiled' ? ev.filedTo : ev.series;
    const s = id ? T.seriesById(id) : null;
    return s && s.tracked ? s : null;
  };

  T.nextUpId = () => {
    const rec = T.state.recording;
    if (rec && rec.eventId && T.dayOf(rec.eventId) === TODAY) return rec.eventId;
    const ev = T.state.days[TODAY].events.find((e) => toMin(e.start) >= T.state.nowMin - 1 && ['ready', 'preparing', 'tracking'].includes(T.kindOf(e)));
    return ev ? ev.id : null;
  };
  T.todayCount = () => T.state.days[TODAY].events.filter((ev) => T.trackedSeriesOf(ev)).length;
  T.reviewCount = () => T.tracked().reduce((n, s) => n + s.meetings.reduce((k, m) => k + T.pendingOf(m), 0), 0) + T.state.unfiled.length;
  T.foundCount = () => T.state.proposals.length;

  T.upcomingOf = (s) => s.meetings.find(isUpcoming) || null;
  T.countdown = (m) => {
    const days = dayOffset(m.date);
    if (days > 0) return days === 1 ? 'Tomorrow' : `in ${days} days`;
    const diff = toMin(startTime(m)) - T.state.nowMin;
    if (diff <= 0) return 'Now';
    if (diff < 60) return `in ${diff} min`;
    const rest = diff % 60;
    return `in ${Math.floor(diff / 60)} h${rest ? ` ${rest} min` : ''}`;
  };
  T.shortCountdown = (m) => {
    const days = dayOffset(m.date);
    if (days > 0) return days === 1 ? 'Tomorrow' : `in ${days}d`;
    const diff = toMin(startTime(m)) - T.state.nowMin;
    if (diff <= 0) return 'Now';
    if (diff < 60) return `in ${diff}m`;
    return `in ${Math.floor(diff / 60)}h${diff % 60 ? ` ${diff % 60}m` : ''}`;
  };
  T.nextHint = (s) => {
    const rec = T.state.recording;
    if (rec && rec.seriesId === s.id) return '<span class="rec-dot"></span>';
    const m = T.upcomingOf(s);
    if (!m) return '';
    const off = dayOffset(m.date);
    if (off === 0) return startTime(m);
    const d = parseDate(m.date);
    return off > 0 && off < 7 ? DAYS[d.getDay()] : `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  };
  T.meetingTitle = (s, m, ev) => (m && m.title) || (ev && ev.title) || (s && s.name) || 'Meeting';

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

  T.evidenceFor = (s, src, fallback = '') => {
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
  T.itemsOf = (s, m) => m.items || DERIVED[m.id] || s.memory
    .filter((it) => it.from === shortDate(m.date) && !it.fresh)
    .map((it) => ({ type: it.type, text: it.text, owner: it.owner, status: it.status, src: it.src }));
  T.transcriptOf = (s, m) => {
    if (m.transcript && m.transcript.length) return m.transcript;
    return T.itemsOf(s, m)
      .map((it) => T.evidenceFor(s, it.src, it.text))
      .filter((ev) => ev.kind === 'speech' && ev.t)
      .map((ev) => ({ t: ev.t, who: ev.who, text: ev.quote }))
      .sort((a, b) => toSec(a.t) - toSec(b.t));
  };

  const params = new URLSearchParams(location.search);
  const themeLink = document.getElementById('theme');
  if (themeLink && !params.get('theme') && matchMedia('(prefers-color-scheme: dark)').matches) {
    themeLink.href = themeLink.href.replace(/[^/]+\.css(\?.*)?$/, 'dark.css');
  }
})();
