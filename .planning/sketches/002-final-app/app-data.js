(() => {
  const T = window.T;
  const U = T.util;
  const AM = DATA.afterMeeting;

  const withMemoryIds = (s) => ({ ...s, memory: s.memory.map((m, i) => ({ id: `${s.id}-m${i}`, ...m })) });
  const reviewTranscript = () => DATA.review
    .map((k) => ({ t: k.ev.t, who: k.ev.who, text: k.ev.quote }))
    .sort((a, b) => U.toSec(a.t) - U.toSec(b.t));
  const withHiringReview = (s) => (s.id !== 'hiring' ? s : {
    ...s,
    meetings: s.meetings.map((m) => (m.id !== 'hi-5' ? m : {
      ...m, candidates: DATA.review.map((k) => ({ ...k, state: 'pending' })), transcript: reviewTranscript()
    }))
  });
  T.baseSeries = () => U.clone(DATA.series).map(withMemoryIds).map(withHiringReview).map((s) => ({ ...s, tracked: true }));

  const liveTranscript = () => DATA.live.transcript.map((l, i) => ({ t: i ? '12:04' : '11:52', who: l.who, text: l.text }));
  const afterTranscript = () => [
    ...AM.candidates.map((c) => ({ t: c.ev.t, who: c.ev.who, text: c.ev.quote })),
    ...liveTranscript()
  ].sort((a, b) => U.toSec(a.t) - U.toSec(b.t));

  T.rollForward = (s) => {
    const current = s.meetings.find((m) => m.id === AM.meeting);
    if (!current || !U.isUpcoming(current)) return s;
    const done = {
      ...current, status: 'review', duration: AM.duration, ended: AM.ended, time: `10:00–${AM.ended}`, summary: AM.summary, where: null, brief: null,
      candidates: AM.candidates.map((c) => ({ ...c, state: 'pending' })), docs: current.brief ? current.brief.docs : [], transcript: afterTranscript()
    };
    const next = { id: 'ps-38', n: 38, date: 'Tue 6 Oct', time: '10:00–10:45', status: 'upcoming', where: 'Google Meet' };
    return { ...s, count: s.count + 1, meetings: [next, ...s.meetings.map((m) => (m.id === AM.meeting ? done : m))] };
  };

  const baseState = () => ({
    scenario: 'before', clock: DATA.now.time, nowMin: U.toMin('09:41'), calendar: 'connected',
    view: { kind: 'day', dayIndex: T.TODAY },
    selection: { kind: 'event', id: 't2' }, peekOpen: true,
    series: T.baseSeries(), days: U.clone(DATA.days), proposals: U.clone(DATA.proposals),
    unfiled: U.clone(DATA.unfiled), calendars: U.clone(DATA.calendars),
    recording: null, summarizing: null, starting: null, lastEnded: null,
    recordOnce: {}, bannerHidden: false, onboarded: true,
    expanded: { 'ps-36': true }, edited: {}, prepared: {}, seq: 0
  });

  const firstRun = (st) => ({
    ...st, scenario: 'first', calendar: 'none', onboarded: false, selection: null, peekOpen: false,
    series: st.series.map((s) => ({ ...s, tracked: false })),
    days: st.days.map((d) => ({ ...d, events: d.events.filter((ev) => ev.state !== 'unfiled') })),
    proposals: [], unfiled: [], expanded: {}
  });
  const starting = (st) => ({ ...st, scenario: 'starting', clock: '10:00', nowMin: U.toMin('10:00'), starting: AM.meeting });
  const live = (st) => ({
    ...st, scenario: 'live', clock: '10:12', nowMin: U.toMin('10:12'),
    recording: { eventId: 't2', meetingId: AM.meeting, seriesId: AM.series, startedAt: Date.now() - DATA.live.elapsed * 1000 }
  });
  const after = (st) => ({
    ...st, scenario: 'after', clock: '10:46', nowMin: U.toMin('10:46'), lastEnded: AM.meeting,
    series: st.series.map((s) => (s.id === AM.series ? T.rollForward(s) : s)),
    expanded: { ...st.expanded, [AM.meeting]: true }
  });
  const BUILDERS = { first: firstRun, starting, live, after };
  T.scenarioState = (id) => (BUILDERS[id] ? BUILDERS[id](baseState()) : baseState());

  T.draftedPurpose = (p) => ({
    ...p, version: 1, edited: 'Today', by: 'Telu', drafted: true,
    history: [{ v: 1, date: 'Today', note: 'Drafted from the calendar invite' }]
  });

  const DRAFTS = {
    'pr-growth': {
      icon: 'target', color: 'var(--series-teal)', group: 'Team',
      why: 'Review growth experiments and funnel metrics weekly, and decide what to double down on.',
      outcomes: ['Every running experiment gets a clear read', 'One bet to double down on, one to stop'],
      agenda: [{ t: 'Funnel metrics', d: '10 min' }, { t: 'Experiment readouts', d: '25 min' }, { t: 'Next bets', d: '10 min' }],
      notFor: 'Roadmap debates — that’s Product Sync.'
    },
    'pr-standup': {
      icon: 'sun', color: 'var(--series-gray)', group: 'Team',
      why: 'A short daily check-in to surface blockers before they grow.',
      outcomes: ['Every blocker has an owner by 09:15'],
      agenda: [{ t: 'Yesterday, today, blockers', d: '15 min' }],
      notFor: 'Problem-solving — take it offline.'
    }
  };
  const ruleTime = (rule) => (String(rule).match(/\d{1,2}:\d{2}(?:–\d{1,2}:\d{2})?/) || ['09:00'])[0];

  T.seriesFromProposal = (p) => {
    const d = DRAFTS[p.id];
    const id = p.id.replace('pr-', '');
    const time = ruleTime(p.rule);
    return {
      id, name: p.title, color: d.color, icon: d.icon, group: d.group, cadence: p.id === 'pr-standup' ? 'Daily' : 'Weekly', rule: p.rule,
      source: 'calendar', calendar: p.calendar, count: 0, since: 'Oct 2026', next: '', people: p.people, docs: [], memory: [], tracked: true,
      purpose: T.draftedPurpose({ why: d.why, outcomes: d.outcomes, agenda: d.agenda, notFor: d.notFor }),
      meetings: [{
        id: `${id}-1`, n: 1, date: p.first || U.formatDate(U.addDays(1)), status: 'upcoming', where: p.id === 'pr-growth' ? 'Room 3A' : null,
        time: time.includes('–') ? time : `${time}–${U.addMinutes(time, 15)}`
      }]
    };
  };

  T.draftSeries = (seq) => ({
    id: `new-${seq}`, name: '', draft: true, tracked: true, color: 'var(--series-gray)', icon: 'notes', group: 'Other', cadence: 'None', day: null, time: null,
    rule: '', source: 'manual', count: 0, since: '', people: [], docs: [], memory: [], meetings: [],
    purpose: { version: 0, why: '', outcomes: [], agenda: [], notFor: '', history: [] }
  });

  const TODAY_INDEX = U.DAYS.indexOf(DATA.now.day.split(' ')[0]);
  const CADENCE_RULE = {
    Weekly: (d) => (d === 'Weekdays' ? 'Every weekday' : `Every ${d}`),
    'Every 2 weeks': (d) => `Every other ${d}`,
    Monthly: (d) => `First ${d}`
  };
  const nextDateFor = (day) => {
    if (day === 'Weekdays') return U.formatDate(U.addDays(1));
    const offset = (U.DAYS.indexOf(day) - TODAY_INDEX + 7) % 7 || 7;
    return U.formatDate(U.addDays(offset));
  };
  const upcomingFor = (s) => {
    if (s.cadence !== 'None' && s.day && s.time) {
      return [{ id: `${s.id}-next`, n: s.count + 1, date: nextDateFor(s.day), time: `${s.time}–${U.addMinutes(s.time, 30)}`, status: 'upcoming', where: s.where || null }];
    }
    return s.oneOff ? [{ id: `${s.id}-next`, n: s.count + 1, status: 'upcoming', where: s.where || null, ...s.oneOff }] : [];
  };
  T.syncDraft = (s) => {
    const repeating = s.cadence !== 'None' && s.day && s.time;
    const rule = repeating ? `${CADENCE_RULE[s.cadence](s.day)} · ${s.time}–${U.addMinutes(s.time, 30)}` : '';
    return { ...s, rule, meetings: [...upcomingFor(s), ...s.meetings.filter((m) => !U.isUpcoming(m))] };
  };

  const matchPerson = (name) => Object.keys(DATA.people).find((p) => p.toLowerCase().startsWith(name.toLowerCase())) || name;
  const cadenceFrom = (parsed, fallback) => {
    if (!parsed.cadence || parsed.cadence === 'One-off') return fallback;
    return parsed.cadence === 'Daily' ? 'Weekly' : parsed.cadence;
  };
  T.applyParsed = (s, parsed) => {
    const people = parsed.people.map(matchPerson);
    const oneOnOne = parsed.title.startsWith('1:1');
    return T.syncDraft({
      ...s,
      name: parsed.title || s.name,
      cadence: cadenceFrom(parsed, s.cadence),
      day: parsed.cadence === 'Daily' ? 'Weekdays' : parsed.day || s.day,
      time: parsed.time || s.time,
      people: people.length ? people : s.people,
      icon: oneOnOne ? 'person' : people.length > 1 ? 'people' : s.icon,
      color: people.length && DATA.people[people[0]] ? DATA.people[people[0]] : s.color,
      group: oneOnOne ? '1:1s' : s.group
    });
  };
  T.parsedSummary = (p) => [
    p.cadence === 'One-off' ? '' : p.cadence,
    [p.day, p.time].filter(Boolean).join(' '),
    p.people.length ? `with ${p.people.join(', ')}` : ''
  ].filter(Boolean).join(' · ');

  T.LINKABLE = [
    { id: 't1', title: 'Daily Standup', label: 'Weekdays 09:00', patch: { cadence: 'Weekly', day: 'Weekdays', time: '09:00', icon: 'sun', people: ['Jon Park', 'Leo Duarte', 'Aisha Bello'] } },
    { id: 't6', title: 'Coffee with Alex Kim', label: 'Today 17:00', patch: { icon: 'person', color: DATA.people['Alex Kim'], where: 'Blue Bottle', people: ['Alex Kim'], oneOff: { date: DATA.now.day, time: '17:00–17:30' } } }
  ];
  T.linkedSeries = (s, ev) => T.syncDraft({
    ...s, ...ev.patch, name: s.name || ev.title, linked: `Linked to “${ev.title}”`, linkedEvent: ev.id, source: 'calendar', calendar: 'Work'
  });

  const SUPERSEDES = { c5: 'Activation is 41% against a 45% target' };
  const STATUS_FOR = { commitment: 'open', question: 'unresolved' };
  T.acceptCandidate = (s, m, c) => {
    const date = U.shortDate(m.date);
    const item = {
      id: `${s.id}-${c.id}`, type: c.type, text: c.text, owner: c.owner, due: c.due, status: STATUS_FOR[c.type] || 'current',
      from: date, src: `${date} · ${c.ev.t}`, fresh: true
    };
    const old = SUPERSEDES[c.id] ? s.memory.find((it) => it.text === SUPERSEDES[c.id]) : null;
    const resolved = s.memory.map((it) => (c.resolves && it.text === c.resolves ? { ...it, status: 'completed', resolvedToday: true } : it));
    const kept = old ? resolved.filter((it) => it.id !== old.id) : resolved;
    return { ...s, memory: [old ? { ...item, replaced: `${old.text} · ${old.from}` } : item, ...kept] };
  };

  const insertByDate = (meetings, meeting) => {
    const when = U.parseDate(meeting.date);
    const index = meetings.findIndex((m) => !U.isUpcoming(m) && U.parseDate(m.date) <= when);
    return index < 0 ? [...meetings, meeting] : [...meetings.slice(0, index), meeting, ...meetings.slice(index)];
  };
  T.insertUpcoming = (meetings, meeting) => [...meetings.filter(U.isUpcoming), meeting, ...meetings.filter((m) => !U.isUpcoming(m))];
  const withoutMeeting = (s, mid) => ({ ...s, count: Math.max(0, s.count - 1), meetings: s.meetings.filter((m) => m.id !== mid) });
  const withMeeting = (s, m) => ({ ...s, count: s.count + 1, meetings: insertByDate(s.meetings, m) });
  const relinkEvents = (days, match, fn) => days.map((d) => ({ ...d, events: d.events.map((ev) => (match(ev) ? fn(ev) : ev)) }));

  T.moveMeeting = (state, mid, fromId, toId) => {
    const from = state.series.find((s) => s.id === fromId);
    const meeting = from ? from.meetings.find((m) => m.id === mid) : null;
    if (!meeting) return state;
    const home = meeting.homeId || fromId;
    const moved = { ...meeting, items: T.itemsOf(from, meeting), homeId: home, movedFrom: toId === home ? null : from.name };
    const series = state.series.map((s) => (s.id === fromId ? withoutMeeting(s, mid) : s.id === toId ? withMeeting(s, moved) : s));
    return { ...state, series, days: relinkEvents(state.days, (ev) => ev.meeting === mid, (ev) => ({ ...ev, series: toId })) };
  };

  T.unfileMeeting = (state, mid, fromId) => {
    const from = state.series.find((s) => s.id === fromId);
    const m = from ? from.meetings.find((x) => x.id === mid) : null;
    if (!m) return state;
    const item = {
      id: `uf-${m.id}`, kind: 'recording', title: `${from.name} · ${m.date}`, when: `${m.date} · ${U.startTime(m)}`, duration: m.duration,
      suggestion: { series: fromId, why: 'Filed there until you removed it' }, meeting: { ...m, items: T.itemsOf(from, m) }
    };
    const days = relinkEvents(state.days, (ev) => ev.meeting === mid, ({ series, meeting, ...ev }) => ({ ...ev, state: 'unfiled', unfiled: item.id }));
    return { ...state, days, unfiled: [item, ...state.unfiled], series: state.series.map((s) => (s.id === fromId ? withoutMeeting(s, mid) : s)) };
  };

  const meetingFromUnfiled = (u) => {
    if (u.meeting) return u.meeting;
    const [date, time] = u.when.split(' · ');
    return {
      id: u.id, n: null, date, time: `${time}–${U.addMinutes(time, parseInt(u.duration, 10) || 0)}`, duration: u.duration, status: 'done',
      summary: 'Quick call — Dana, SSO and audit logs came up. Filed from Needs filing.', counts: {}, docs: [], filedFrom: 'Needs filing',
      transcript: [
        { t: '00:42', who: 'You', text: 'Quick one before I forget — Dana says the SSO metadata is almost ready.' },
        { t: '03:15', who: 'You', text: 'They also want the audit logs exported monthly, not weekly.' },
        { t: '06:50', who: 'You', text: 'Follow up with Sam on whether that changes the retention plan.' }
      ]
    };
  };
  T.withFiled = (state, uid, sid) => {
    const u = state.unfiled.find((x) => x.id === uid);
    if (!u) return state;
    const attach = (s) => (u.kind === 'doc'
      ? { ...s, docs: [...s.docs, { name: u.title, ver: 'v1', size: '8 KB', added: 'Sep 27', include: true }] }
      : withMeeting(s, meetingFromUnfiled(u)));
    const days = relinkEvents(state.days, (ev) => ev.unfiled === uid, (ev) => ({ ...ev, filedTo: sid }));
    return { ...state, days, unfiled: state.unfiled.filter((x) => x.id !== uid), series: state.series.map((s) => (s.id === sid ? attach(s) : s)) };
  };

  T.recordedInto = (s, { seconds, meetingId, clock, seq }) => {
    const duration = `${Math.max(1, Math.round(seconds / 60))} min`;
    const summary = 'Recorded and transcribed on this Mac. Nothing here needed your review.';
    const target = meetingId ? s.meetings.find((m) => m.id === meetingId) : null;
    if (target) {
      const done = { ...target, status: 'done', duration, ended: clock, summary, brief: null, counts: {}, docs: target.brief ? target.brief.docs : target.docs || [] };
      const following = { id: `${target.id}-next`, n: (target.n || s.count) + 1, date: U.formatDate(U.addDays(7)), time: target.time, status: 'upcoming', where: target.where || null };
      return { ...s, count: s.count + 1, meetings: [following, ...s.meetings.map((m) => (m.id === target.id ? done : m))] };
    }
    const hh = clock.padStart(5, '0');
    const fresh = { id: `${s.id}-r${seq}`, n: s.count + 1, date: 'Today', time: `${hh}–${U.addMinutes(hh, Math.max(1, Math.round(seconds / 60)))}`, duration, ended: clock, status: 'done', summary, counts: {}, docs: [] };
    return { ...s, count: s.count + 1, meetings: [...s.meetings.filter(U.isUpcoming), fresh, ...s.meetings.filter((m) => !U.isUpcoming(m))] };
  };

  T.nextSeq = () => {
    const seq = T.state.seq + 1;
    T.set({ seq });
    return seq;
  };
})();
