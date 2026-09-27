window.AT = window.AT || {};

(() => {
  const AT = window.AT;
  const TODAY = 1;
  const clone = (value) => structuredClone(value);
  const toMin = (hhmm) => {
    const [h, m] = String(hhmm).split(':').map(Number);
    return h * 60 + (m || 0);
  };
  const toSec = (mmss) => {
    const [m, s] = String(mmss).split(':').map(Number);
    return m * 60 + (s || 0);
  };
  const fmtDuration = (mins) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (!h) return `${m} min`;
    return m ? `${h} h ${m} min` : `${h} h`;
  };
  const fmtSize = (bytes) => {
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
    if (bytes >= 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${bytes} bytes`;
  };
  const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  const minutesOf = (d) => parseInt(d, 10) || 0;
  const shortDate = (date) => {
    const parts = String(date).split(' ');
    return parts.length === 3 ? `${parts[2]} ${parts[1]}` : date;
  };
  const sameDate = (short, long) => {
    const [month, day] = String(short).split(' ');
    return String(long).includes(`${day} ${month}`);
  };

  AT.TODAY = TODAY;
  AT.util = { clone, toMin, toSec, fmtDuration, fmtSize, plural, minutesOf, shortDate, sameDate };
  AT.ui = { sheet: null, timers: new Map(), slideToken: 0, inspKey: null, pending: [] };
  AT.actions = {};

  const SYNTH = [
    { series: 'maria', src: 'Sep 8 · 07:22', who: 'You', quote: 'I’d like you to lead the Q4 onboarding revamp.' },
    { series: 'maria', src: 'Sep 22 · 11:05', who: 'You', quote: 'Let me introduce you to Leo’s platform team this week.' },
    { series: 'maria', src: 'Sep 15 · 19:40', who: 'Maria Chen', quote: 'Do we know when the promotion packet has to be in?' },
    { series: 'acme', src: 'Sep 1 · 04:50', who: 'Dana Whitfield', quote: 'November third works for us as the go-live date.' },
    { series: 'acme', src: 'Sep 22 · 33:10', who: 'Sam Ortiz', quote: 'One year of audit-log retention covers our policy.' },
    { series: 'acme', src: 'Sep 22 · 41:02', who: 'Dana Whitfield', quote: 'We’ll send over the SAML metadata this week.' },
    { series: 'acme', src: 'Sep 15 · 22:18', who: 'Sam Ortiz', quote: 'Our security team may ask for SOC 2 before we go live.' },
    { series: 'design-review', src: 'Sep 17 · 14:02', who: 'Aisha Bello', quote: 'Step three gets a single primary action — everything else is secondary.' },
    { series: 'board', src: 'Sep 4 · 38:20', who: 'Priya Nair', quote: 'I’ll pull cohort retention by segment for the next deck.' }
  ];

  const DOC_QUOTES = {
    'North-star metrics.docx · p.2': 'Activation (7-day): 41% — target 45% by the end of Q4.',
    'Q4 Roadmap.pdf · p.7': 'Acme go-live: Nov 3. SSO and audit logs must ship before the rollout.',
    'Staff Eng scorecard.docx · §1': 'Staff bar: has owned a multi-team system end to end.'
  };

  const DOC_META = {
    'Rate-limit plan v1.docx': { ver: 'v1', size: '48 KB', from: 'Jon Park' },
    'Sprint 42 metrics.pdf': { ver: 'v1', size: '1.2 MB' },
    'Offline mode spec.docx': { ver: 'v3', size: '310 KB' },
    'Usability plan.docx': { ver: 'v2', size: '88 KB' }
  };

  const EXTRA_LINES = {
    'hi-5': [
      { t: '02:05', who: 'You', text: 'Thanks for making time. Let’s start with a system you built end to end.' },
      { t: '14:40', who: 'R. Gomez', text: 'The payments migration touched four teams, so the hard part was sequencing the cut-over.' }
    ],
    'ps-37': [
      { t: '11:52', who: 'Jon Park', text: 'So the plan is token bucket, and we can ship it behind the flag next sprint.' },
      { t: '12:04', who: 'Maria Chen', text: 'Does this change anything for the Acme rollout?' }
    ]
  };

  const UNFILED_LINES = [
    { t: '00:42', who: 'You', text: 'Quick one before I forget — Dana says the SSO metadata is almost ready.' },
    { t: '03:15', who: 'You', text: 'They also want the audit logs exported monthly, not weekly.' },
    { t: '06:50', who: 'You', text: 'Follow up with Sam on whether that changes the retention plan.' }
  ];

  AT.set = (patch) => {
    AT.state = { ...AT.state, ...patch };
    return AT.state;
  };

  AT.mapSeries = (id, fn) => AT.set({ series: AT.state.series.map((s) => (s.id === id ? fn(s) : s)) });

  AT.mapMeeting = (id, fn) => AT.set({
    series: AT.state.series.map((s) => (s.meetings.some((m) => m.id === id)
      ? { ...s, meetings: s.meetings.map((m) => (m.id === id ? fn(m) : m)) }
      : s))
  });

  AT.mapEvents = (match, fn) => AT.set({
    days: AT.state.days.map((d) => ({ ...d, events: d.events.map((e) => (match(e) ? fn(e) : e)) }))
  });

  AT.seriesById = (id) => AT.state.series.find((s) => s.id === id) || null;
  AT.tracked = () => AT.state.series.filter((s) => s.tracked);

  AT.findMeeting = (id) => {
    if (!id) return null;
    for (const s of AT.state.series) {
      const meeting = s.meetings.find((m) => m.id === id);
      if (meeting) return { series: s, meeting };
    }
    return null;
  };

  AT.extraEvents = () => {
    const tracked = (id) => {
      const s = AT.seriesById(id);
      return s && s.tracked;
    };
    return [
      tracked('growth') && { id: 'x-growth', day: 3, start: '11:00', end: '11:45', title: 'Growth Review', calendar: 'Work', repeat: 'Weekly', series: 'growth', meeting: 'gr-1', state: 'ready', where: 'Room 3A' },
      tracked('design-review') && { id: 'x-dr-15', day: 3, start: '15:00', end: '16:00', title: 'Design Review', calendar: 'Work', repeat: 'Every 2 weeks', series: 'design-review', meeting: 'dr-15', state: 'ready', where: 'Studio' },
      tracked('board') && { id: 'x-bp-9', day: 4, start: '09:00', end: '10:00', title: 'Board Prep', calendar: 'Work', repeat: 'Monthly', series: 'board', meeting: 'bp-9', state: 'ready', where: 'Board room' }
    ].filter(Boolean);
  };

  AT.EXTRA_DAYS = [
    { key: 'thu', label: 'Thursday', date: 'Thu 1 Oct', long: 'Thursday, 1 October' },
    { key: 'fri', label: 'Friday', date: 'Fri 2 Oct', long: 'Friday, 2 October' }
  ];

  AT.eventById = (id) => {
    for (const d of AT.state.days) {
      const ev = d.events.find((e) => e.id === id);
      if (ev) return ev;
    }
    return AT.extraEvents().find((e) => e.id === id) || null;
  };

  AT.dayOf = (id) => {
    const index = AT.state.days.findIndex((d) => d.events.some((e) => e.id === id));
    if (index >= 0) return index;
    const extra = AT.extraEvents().find((e) => e.id === id);
    return extra ? extra.day : TODAY;
  };

  AT.dayLabel = (dayIndex) => {
    if (dayIndex < AT.state.days.length) return AT.state.days[dayIndex].label;
    return AT.EXTRA_DAYS[dayIndex - AT.state.days.length].date;
  };

  AT.eventForMeeting = (meetingId) => {
    for (const d of AT.state.days) {
      const ev = d.events.find((e) => e.meeting === meetingId);
      if (ev) return ev;
    }
    return AT.extraEvents().find((e) => e.meeting === meetingId) || null;
  };

  AT.isPast = (ev, dayIndex) => dayIndex < TODAY || (dayIndex === TODAY && toMin(ev.end) <= AT.state.nowMin);

  AT.pending = (meetingId) => (AT.state.review[meetingId] || []).length;

  const trackedKind = (ev) => {
    const found = AT.findMeeting(ev.meeting);
    if (!found) return 'tracking';
    const m = found.meeting;
    if (AT.pending(m.id) > 0) return 'review';
    if (m.status === 'done' || m.status === 'review') return 'filed';
    if (m.status === 'preparing') return 'preparing';
    return 'ready';
  };

  AT.kindOf = (ev) => {
    const st = AT.state;
    if (ev.state === 'personal') return 'personal';
    if (st.recording && st.recording.eventId === ev.id) return 'recording';
    if (st.summarizing === ev.id) return 'summarizing';
    if (ev.state === 'unfiled') return ev.filedTo ? 'filed' : 'unfiled';
    const s = ev.series ? AT.seriesById(ev.series) : null;
    if (s && s.tracked) return trackedKind(ev);
    if (ev.state === 'proposal' && st.proposals.some((p) => p.id === ev.proposal)) return 'proposal';
    return ev.repeat ? 'recurring' : 'oneoff';
  };

  AT.isTrackedKind = (kind) => ['ready', 'preparing', 'tracking', 'recording', 'review', 'summarizing', 'filed'].includes(kind);

  AT.trackedSeriesOf = (ev) => {
    const id = ev.state === 'unfiled' ? ev.filedTo : ev.series;
    const s = id ? AT.seriesById(id) : null;
    return s && s.tracked ? s : null;
  };

  AT.nextUpId = () => {
    const today = AT.state.days[TODAY].events;
    const ev = today.find((e) => toMin(e.start) >= AT.state.nowMin - 1 && ['ready', 'preparing', 'tracking', 'recording'].includes(AT.kindOf(e)));
    if (AT.state.recording && AT.dayOf(AT.state.recording.eventId) === TODAY) return AT.state.recording.eventId;
    return ev ? ev.id : null;
  };

  AT.todayCount = () => AT.state.days[TODAY].events.filter((e) => AT.trackedSeriesOf(e)).length;

  AT.unfiledEvents = () => AT.state.days.flatMap((d) => d.events).filter((e) => e.state === 'unfiled' && !e.filedTo);

  AT.reviewCount = () => Object.values(AT.state.review).reduce((n, list) => n + list.length, 0) + AT.unfiledEvents().length;

  AT.foundCount = () => (AT.state.detectLater ? DATA.detected.filter((d) => d.on && !d.ignored).length : AT.state.proposals.length);

  const fallbackBrief = (s) => {
    const open = s.memory.filter((k) => k.status === 'open' || k.status === 'unresolved');
    const facts = s.memory.filter((k) => k.type === 'fact' && k.status === 'current');
    const carry = [...open, ...facts].slice(0, 3).map((k) => ({
      ...k,
      note: k.type === 'question' ? 'Still open' : k.due ? `Due ${k.due}` : k.type === 'commitment' ? 'Open' : ''
    }));
    return {
      carry,
      ask: [],
      agenda: s.purpose.agenda.map((a) => ({ t: a.t, d: `${minutesOf(a.d)}m` })),
      docs: s.docs.filter((d) => d.include).map((d) => d.name),
      generated: true
    };
  };

  AT.briefFor = (meetingId) => {
    const found = AT.findMeeting(meetingId);
    if (!found) return null;
    const base = found.meeting.brief || fallbackBrief(found.series);
    const adds = AT.state.agendaAdds[meetingId] || [];
    return { ...base, agenda: [...base.agenda, ...adds] };
  };

  const includeOf = (meetingId, name, fallback) => {
    const key = `${meetingId}:${name}`;
    return key in AT.state.docToggles ? AT.state.docToggles[key] : fallback;
  };

  AT.docsFor = (meetingId) => {
    const { series: s } = AT.findMeeting(meetingId);
    const brief = AT.briefFor(meetingId);
    const seriesNames = new Set(s.docs.map((d) => d.name));
    const seriesDocs = s.docs.map((d) => ({ ...d, scope: 'series', include: includeOf(meetingId, d.name, d.include) }));
    const meetingDocs = (brief.docs || []).filter((n) => !seriesNames.has(n)).map((n) => ({
      name: n, ...(DOC_META[n] || { ver: 'v1', size: '—' }), scope: 'meeting', include: includeOf(meetingId, n, true)
    }));
    const attached = (AT.state.attached[meetingId] || []).map((d) => ({ ...d, scope: 'meeting', include: includeOf(meetingId, d.name, true) }));
    return [...seriesDocs, ...meetingDocs, ...attached];
  };

  AT.docMeta = (name) => DOC_META[name] || { ver: 'v1', size: '—' };

  AT.previousMeeting = (meetingId) => {
    const found = AT.findMeeting(meetingId);
    if (!found) return null;
    return found.series.meetings.find((m) => m.status === 'done' && m.id !== meetingId) || null;
  };

  AT.briefSources = (meetingId) => {
    const found = AT.findMeeting(meetingId);
    const brief = AT.briefFor(meetingId);
    const docs = AT.docsFor(meetingId);
    const prev = AT.previousMeeting(meetingId);
    const carryTexts = new Set(brief.carry.map((c) => c.text));
    const memory = [...brief.carry.map((c) => c.text), ...(prev ? [`${found.series.name} #${prev.n} summary`] : [])];
    const omittedMemory = found.series.memory.filter((k) => !carryTexts.has(k.text) && (k.status === 'completed' || k.replaced)).map((k) => (k.replaced ? k.replaced.split(' · ')[0] : k.text));
    return {
      included: docs.filter((d) => d.include).map((d) => d.name),
      omittedDocs: docs.filter((d) => !d.include).map((d) => d.name),
      memory,
      omittedMemory
    };
  };

  const findLine = (date, t, seriesId) => {
    const ordered = [...AT.state.series].sort((a, b) => (a.id === seriesId ? -1 : b.id === seriesId ? 1 : 0));
    for (const s of ordered) {
      for (const m of s.meetings) {
        if (!sameDate(date, m.day || m.date)) continue;
        const line = AT.transcriptFor(m.id).find((l) => l.t === t);
        if (line) return { ...line, meetingId: m.id };
      }
    }
    return null;
  };

  const meetingOn = (date, seriesId) => {
    const s = AT.seriesById(seriesId);
    const m = s && s.meetings.find((x) => sameDate(date, x.day || x.date));
    return m ? m.id : null;
  };

  AT.evidenceFor = (src, ctx = {}) => {
    const doc = src.match(/^(.+?\.(?:pdf|docx|md|key|xlsx|txt))\s·\s(.+)$/i);
    if (doc) return { kind: 'doc', name: doc[1], loc: doc[2], quote: DOC_QUOTES[src] || ctx.text || '' };
    const [date, t] = src.split(' · ');
    const line = findLine(date, t, ctx.seriesId);
    if (line) return { kind: 'line', t, who: line.who, quote: line.text, where: date, meetingId: line.meetingId };
    const synth = SYNTH.find((x) => x.src === src && (!ctx.seriesId || x.series === ctx.seriesId)) || SYNTH.find((x) => x.src === src);
    return {
      kind: 'line', t, where: date,
      who: synth ? synth.who : ctx.who || 'You',
      quote: synth ? synth.quote : ctx.text || '',
      meetingId: meetingOn(date, synth ? synth.series : ctx.seriesId)
    };
  };

  const candidateLines = (meetingId) => {
    if (meetingId === 'hi-5') return DATA.review.map((k) => ({ t: k.ev.t, who: k.ev.who, text: k.ev.quote, evidence: true }));
    const found = AT.findMeeting(meetingId);
    if (meetingId === DATA.afterMeeting.meeting && found && found.meeting.status !== 'upcoming') {
      return DATA.afterMeeting.candidates.map((c) => ({ t: c.ev.t, who: c.ev.who, text: c.ev.quote, evidence: true }));
    }
    return [];
  };

  AT.transcriptFor = (meetingId) => {
    const found = AT.findMeeting(meetingId);
    if (!found) return [];
    const { series: s, meeting: m } = found;
    const date = shortDate(m.day || m.date);
    const srcs = new Set([...s.memory.map((k) => k.src), ...(m.items || []).map((k) => k.src)]);
    const base = (m.transcript || []).map((l) => ({ ...l, evidence: srcs.has(`${date} · ${l.t}`) }));
    const synth = SYNTH.filter((x) => x.series === s.id && sameDate(x.src.split(' · ')[0], m.day || m.date))
      .map((x) => ({ t: x.src.split(' · ')[1], who: x.who, text: x.quote, evidence: true }));
    const extra = m.status === 'upcoming' ? [] : (EXTRA_LINES[meetingId] || []);
    const all = [...base, ...synth, ...candidateLines(meetingId), ...extra];
    const unique = all.filter((l, i) => all.findIndex((x) => x.t === l.t) === i);
    return unique.sort((a, b) => toSec(a.t) - toSec(b.t));
  };

  AT.unfiledLines = () => UNFILED_LINES;

  const NEW_SERIES = {
    standup: {
      id: 'standup', name: 'Daily Standup', color: 'var(--series-gray)', icon: 'repeat', group: 'Team',
      cadence: 'Daily', rule: 'Every weekday · 09:00–09:15', source: 'calendar', calendar: 'Work',
      count: 142, since: 'Jan 2026', next: 'Wed 30 Sep', people: ['Jon Park', 'Leo Duarte', 'Aisha Bello'],
      purpose: {
        version: 1, edited: 'Sep 29', by: 'Telu',
        why: 'A short daily check-in: what moved yesterday, what’s next, and anything blocked.',
        outcomes: ['Everyone knows what is blocked and who unblocks it'],
        agenda: [{ t: 'Round the room', d: '10 min' }, { t: 'Blockers', d: '5 min' }],
        notFor: 'Problem solving — take it to a follow-up.',
        history: [{ v: 1, date: 'Sep 29', note: 'Drafted from the calendar invite' }]
      },
      docs: [], memory: [], meetings: []
    },
    growth: {
      id: 'growth', name: 'Growth Review', color: 'var(--a-series-cyan)', icon: 'target', group: 'Team',
      cadence: 'Weekly', rule: 'Every Thu · 11:00–11:45', source: 'calendar', calendar: 'Work',
      count: 1, since: 'Oct 2026', next: 'Thu 1 Oct', people: ['Priya Nair', 'Leo Duarte', 'Aisha Bello'],
      purpose: {
        version: 1, edited: 'Sep 29', by: 'Telu',
        why: 'Review the week’s growth numbers and decide which experiments to run next.',
        outcomes: ['Next experiments agreed, each with an owner'],
        agenda: [{ t: 'Numbers', d: '10 min' }, { t: 'Experiments', d: '25 min' }, { t: 'Decisions', d: '10 min' }],
        notFor: 'Roadmap debates — that’s Product Sync.',
        history: [{ v: 1, date: 'Sep 29', note: 'Drafted from the calendar invite' }]
      },
      docs: [], memory: [],
      meetings: [{ id: 'gr-1', n: 1, date: 'Thu 1 Oct', time: '11:00–11:45', status: 'upcoming', where: 'Room 3A' }]
    }
  };

  AT.newSeriesTemplate = (id) => ({ ...clone(NEW_SERIES[id]), tracked: true, fresh: true });

  AT.makeManualSeries = ({ title, cadence, day, time, people, link }) => {
    const oneOnOne = /^1:1/.test(title);
    const rule = [cadence === 'One-off' ? 'One-off' : day ? `Every ${day}` : cadence, time].filter(Boolean).join(' · ');
    return {
      id: `s-${Date.now().toString(36)}`, name: title, color: 'var(--a-series-brown)', icon: oneOnOne ? 'person' : 'people', group: 'Other',
      cadence, rule, source: link ? 'calendar' : 'manual', calendar: link ? 'Work' : null,
      count: 0, since: 'Sep 2026', next: day ? `${day}${time ? ` ${time}` : ''}` : link ? 'Today 17:00' : '', people: people || [],
      purpose: { version: 1, edited: 'Sep 29', by: 'You', why: '', outcomes: [], agenda: [], notFor: '', history: [{ v: 1, date: 'Sep 29', note: 'Created by you' }] },
      docs: [], memory: [], meetings: [], tracked: true, fresh: true
    };
  };

  const baseState = () => ({
    scenario: 'everyday', clock: DATA.now.time, nowMin: toMin('09:41'), calendar: 'connected',
    view: 'day', dayIndex: TODAY, seriesId: null,
    inspect: { kind: 'event', id: 't2' }, back: null, tab: null, highlight: null,
    series: clone(DATA.series).map((s) => ({ ...s, tracked: true })),
    days: clone(DATA.days), proposals: clone(DATA.proposals),
    review: { 'hi-5': clone(DATA.review) }, accepted: {},
    notes: {}, attached: {}, docToggles: {}, agendaAdds: {}, recordOnce: {},
    calendars: clone(DATA.calendars), recording: null, summarizing: null,
    bannerHidden: false, detectLater: false, prepared: {}
  });

  const firstRun = (st) => ({
    ...st, scenario: 'first', calendar: 'none', inspect: null,
    series: st.series.map((s) => ({ ...s, tracked: false })),
    days: st.days.map((d) => ({ ...d, events: d.events.filter((e) => e.state !== 'unfiled') })),
    proposals: [], review: {}
  });

  const afterMeeting = (st) => {
    const am = DATA.afterMeeting;
    const withMeeting = st.series.map((s) => (s.id !== am.series ? s : {
      ...s,
      next: 'Tue 6 Oct',
      meetings: s.meetings.map((m) => (m.id === am.meeting ? { ...m, status: 'review', duration: am.duration, ended: am.ended, summary: am.summary } : m))
    }));
    return {
      ...st, scenario: 'after', clock: '10:46', nowMin: toMin('10:46'),
      inspect: { kind: 'event', id: 't4' },
      series: withMeeting,
      review: { ...st.review, [am.meeting]: clone(am.candidates) }
    };
  };

  AT.scenarioState = (id) => {
    if (id === 'first') return firstRun(baseState());
    if (id === 'after') return afterMeeting(baseState());
    return baseState();
  };
})();
