(() => {
  const TODAY_INDEX = LD.DAYS.indexOf(DATA.now.day.split(' ')[0]);
  const DRAFTS = {
    'pr-growth': {
      group: 'Team', icon: 'target', color: 'var(--series-teal)',
      why: 'Review growth experiments and funnel metrics weekly, and decide what to double down on.',
      outcomes: ['Every running experiment gets a clear read', 'One bet to double down on, one to stop'],
      agenda: [{ t: 'Funnel metrics', d: '10 min' }, { t: 'Experiment readouts', d: '25 min' }, { t: 'Next bets', d: '10 min' }],
      notFor: 'Roadmap debates — that’s Product Sync.'
    },
    'pr-standup': {
      group: 'Team', icon: 'sun', color: 'var(--series-gray)',
      why: 'A short daily check-in to surface blockers before they grow.',
      outcomes: ['Every blocker has an owner by 09:15'],
      agenda: [{ t: 'Yesterday, today, blockers', d: '15 min' }],
      notFor: 'Problem-solving — take it offline.'
    }
  };
  const ruleTime = (rule) => (String(rule).match(/\d{1,2}:\d{2}(?:–\d{1,2}:\d{2})?/) || ['09:00'])[0];

  const seriesFromProposal = (p) => {
    const d = DRAFTS[p.id];
    const id = p.id.replace('pr-', '');
    const time = ruleTime(p.rule);
    return {
      id, name: p.title, color: d.color, icon: d.icon, group: d.group, cadence: 'Weekly', rule: p.rule, source: 'calendar', calendar: p.calendar,
      count: 0, since: 'Oct 2026', people: p.people, docs: [], memory: [],
      purpose: {
        version: 1, edited: 'Today', by: 'Telu', drafted: true, why: d.why, outcomes: d.outcomes, agenda: d.agenda, notFor: d.notFor,
        history: [{ v: 1, date: 'Today', note: 'Drafted from the calendar invite' }]
      },
      meetings: [{
        id: `${id}-1`, n: 1, date: p.first || LD.formatDate(LD.addDays(1)), status: 'upcoming', where: null,
        time: time.includes('–') ? time : `${time}–${LD.addMinutes(time, 15)}`
      }]
    };
  };
  const seriesFromDetected = (d, base) => (d.series
    ? base.find((s) => s.id === d.series)
    : seriesFromProposal(DATA.proposals.find((p) => p.id === 'pr-standup')));

  const draftSeries = (seq) => ({
    id: `new-${seq}`, name: '', draft: true, color: 'var(--series-gray)', icon: 'notes', group: 'Other', cadence: 'None', day: null, time: null,
    rule: '', source: 'manual', count: 0, since: '', people: [], docs: [], memory: [], meetings: [],
    purpose: { version: 0, why: '', outcomes: [], agenda: [], notFor: '', history: [] }
  });
  const CADENCE_RULE = {
    Weekly: (d) => (d === 'Weekdays' ? 'Every weekday' : `Every ${d}`),
    'Every 2 weeks': (d) => `Every other ${d}`,
    Monthly: (d) => `First ${d}`
  };
  const nextDateFor = (day) => {
    if (day === 'Weekdays') return LD.formatDate(LD.addDays(1));
    const offset = (LD.DAYS.indexOf(day) - TODAY_INDEX + 7) % 7 || 7;
    return LD.formatDate(LD.addDays(offset));
  };
  const upcomingFor = (s) => {
    const repeating = s.cadence !== 'None' && s.day && s.time;
    if (repeating) {
      const end = LD.addMinutes(s.time, 30);
      return [{ id: `${s.id}-next`, n: s.count + 1, date: nextDateFor(s.day), time: `${s.time}–${end}`, status: 'upcoming', where: s.where || null }];
    }
    return s.oneOff ? [{ id: `${s.id}-next`, n: s.count + 1, status: 'upcoming', where: s.where || null, ...s.oneOff }] : [];
  };
  const syncDraft = (s) => {
    const repeating = s.cadence !== 'None' && s.day && s.time;
    const rule = repeating ? `${CADENCE_RULE[s.cadence](s.day)} · ${s.time}–${LD.addMinutes(s.time, 30)}` : '';
    return { ...s, rule, meetings: [...upcomingFor(s), ...s.meetings.filter((m) => !LD.isUpcoming(m))] };
  };

  const matchPerson = (name) => Object.keys(DATA.people).find((p) => p.toLowerCase().startsWith(name.toLowerCase())) || name;
  const cadenceFrom = (parsed, fallback) => {
    if (parsed.cadence === 'One-off') return fallback;
    return parsed.cadence === 'Daily' ? 'Weekly' : parsed.cadence;
  };
  const applyParsed = (s, parsed) => {
    const people = parsed.people.map(matchPerson);
    const oneOnOne = parsed.title.startsWith('1:1');
    return syncDraft({
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
  const parsedSummary = (p) => [
    p.cadence === 'One-off' ? '' : p.cadence,
    [p.day, p.time].filter(Boolean).join(' '),
    p.people.length ? `with ${p.people.join(', ')}` : ''
  ].filter(Boolean).join(' · ');

  const LINKABLE = [
    { id: 't1', title: 'Daily Standup', label: 'Weekdays 09:00', patch: { cadence: 'Weekly', day: 'Weekdays', time: '09:00', icon: 'sun', people: ['Jon Park', 'Leo Duarte', 'Aisha Bello'] } },
    { id: 't6', title: 'Coffee with Alex Kim', label: 'Today 17:00', patch: { icon: 'person', color: DATA.people['Alex Kim'], where: 'Blue Bottle', people: ['Alex Kim'], oneOff: { date: DATA.now.day, time: '17:00–17:30' } } }
  ];
  const linkedSeries = (s, ev) => syncDraft({
    ...s, ...ev.patch, name: s.name || ev.title, linked: `Linked to “${ev.title}”`, source: 'calendar', calendar: 'Work'
  });

  Object.assign(LD, { seriesFromProposal, seriesFromDetected, draftSeries, syncDraft, applyParsed, parsedSummary, LINKABLE, linkedSeries });
})();
