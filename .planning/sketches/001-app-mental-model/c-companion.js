window.CC = (() => {
  const { $, $$, esc } = Kit;
  const SCENES = [
    { id: 'first', label: 'First run', clock: '9:41' },
    { id: 'before', label: 'Before · 9:41', clock: '9:41' },
    { id: 'starting', label: 'Starting · 10:00', clock: '10:00' },
    { id: 'live', label: 'Live · 10:12', clock: '10:12' },
    { id: 'after', label: 'After · 10:46', clock: '10:46' }
  ];
  const MENUS = ['File', 'Edit', 'Insert', 'Slide', 'Format', 'Arrange', 'View', 'Play', 'Window', 'Help'];
  const NEXT_CHAIN = ['ps-37', 'mc-32', 'ac-20'];
  const LATER_CHAIN = ['mc-32', 'ac-20'];
  const STATUS_FOR = { decision: 'current', commitment: 'open', question: 'unresolved', fact: 'current' };
  const KLABEL = { decision: 'Decision', commitment: 'Commitment', question: 'Open question', fact: 'Fact' };
  const NEW_COLORS = ['var(--series-teal)', 'var(--series-pink)', 'var(--series-purple)', 'var(--series-orange)', 'var(--series-green)', 'var(--series-blue)'];
  const DOC_EXCERPTS = {
    'Q4 Roadmap.pdf · p.7': 'Acme go-live: Nov 3. The security review has to close before any customer data moves.',
    'North-star metrics.docx · p.2': 'Activation (day 7) is 41% against a Q4 target of 45%.',
    'Staff Eng scorecard.docx · §1': 'The bar: owns a multi-team system end to end.'
  };
  const listeners = [];
  const effects = new Set();
  let state = null;
  let scenarioBar = null;
  let ticker = null;
  let notes = [];
  let statusCache = null;

  const get = () => state;
  const set = (patch) => { state = { ...state, ...patch }; };
  const sync = () => listeners.forEach((fn) => fn(state));
  const commit = (patch) => { set(patch); sync(); };
  const onSync = (fn) => listeners.push(fn);
  const later = (fn, ms) => {
    const id = setTimeout(() => { effects.delete(id); fn(); }, ms);
    effects.add(id);
    return id;
  };
  const clearEffects = () => { effects.forEach(clearTimeout); effects.clear(); };

  const findIn = (data, meetingId) => {
    for (const series of data.series) {
      const meeting = series.meetings.find((m) => m.id === meetingId);
      if (meeting) return { series, meeting };
    }
    return null;
  };
  const findMeeting = (id) => findIn(state.data, id);
  const seriesById = (id) => state.data.series.find((s) => s.id === id);
  const withSeries = (data, id, fn) => ({ ...data, series: data.series.map((s) => (s.id === id ? fn(s) : s)) });
  const withMeeting = (data, meetingId, fn) => ({
    ...data,
    series: data.series.map((s) => (s.meetings.some((m) => m.id === meetingId)
      ? { ...s, meetings: s.meetings.map((m) => (m.id === meetingId ? fn(m) : m)) }
      : s))
  });

  const toMinutes = (hhmm) => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  };
  const startOf = (meeting) => meeting.time.split('–')[0];
  const dayLabel = (meeting) => {
    const [d, mon] = (meeting.day || meeting.date).split(' ').slice(-2);
    return `${mon} ${d}`;
  };
  const shortName = (series) => (series.name.startsWith('1:1 · ') ? series.name.slice(6) : series.name);
  function untilShort(meeting) {
    if (meeting.date !== 'Today') return meeting.date;
    const diff = toMinutes(startOf(meeting)) - toMinutes(state.clock);
    if (diff <= 0) return 'now';
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    return h ? `${h}h${m ? ` ${m}m` : ''}` : `${m}m`;
  }
  const untilLabel = (meeting) => {
    const u = untilShort(meeting);
    return /^\d/.test(u) ? `in ${u}` : u;
  };
  function formatElapsed(total) {
    const s = Math.max(0, Math.floor(total));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const r = s % 60;
    return `${h ? `${h}:` : ''}${String(m).padStart(h ? 2 : 1, '0')}:${String(r).padStart(2, '0')}`;
  }
  const elapsed = () => {
    const lv = state.live;
    if (!lv) return 0;
    return lv.base + (lv.paused ? 0 : (Date.now() - lv.resumedAt) / 1000);
  };

  function focusMeeting() {
    const chain = ['skipped', 'done'].includes(state.phase) ? LATER_CHAIN : NEXT_CHAIN;
    const id = chain.find((mid) => findMeeting(mid));
    return id ? findMeeting(id) : null;
  }
  function upcoming() {
    const chain = ['filed', 'done', 'skipped'].includes(state.phase) ? LATER_CHAIN : NEXT_CHAIN;
    const id = chain.find((mid) => findMeeting(mid));
    return id ? findMeeting(id) : null;
  }
  const isNextMeeting = (meetingId) => {
    const f = focusMeeting();
    return Boolean(f && f.meeting.id === meetingId);
  };
  const canRecord = () => state.onboarded && ['upcoming', 'starting'].includes(state.phase) && isNextMeeting('ps-37');

  function briefDocs(series, names) {
    const meta = (name) => {
      const doc = series.docs.find((d) => d.name === name);
      return doc ? `${doc.ver} · ${doc.size}` : 'From the calendar invite';
    };
    const listed = names.map((name) => ({ name, meta: meta(name), include: true }));
    const extra = series.docs.filter((d) => !names.includes(d.name)).map((d) => ({ name: d.name, meta: `${d.ver} · ${d.size}`, include: false }));
    return [...listed, ...extra];
  }
  const normalizeDocs = (data) => ({
    ...data,
    series: data.series.map((s) => ({
      ...s,
      meetings: s.meetings.map((m) => (m.brief ? { ...m, brief: { ...m.brief, docs: briefDocs(s, m.brief.docs) } } : m))
    }))
  });
  const evLines = (items) => items.map((k) => ({ t: k.ev.t, who: k.ev.who, text: k.ev.quote })).sort((a, b) => a.t.localeCompare(b.t));
  const afterTranscript = () => [
    ...evLines(DATA.afterMeeting.candidates),
    { t: '11:58', ...DATA.live.transcript[0] },
    { t: '12:03', ...DATA.live.transcript[1] }
  ].sort((a, b) => a.t.localeCompare(b.t));

  function fileData(data) {
    const am = DATA.afterMeeting;
    return withMeeting(data, 'ps-37', (m) => ({
      ...m,
      status: 'done',
      time: `10:00–${am.ended}`,
      duration: am.duration,
      summary: am.summary,
      items: m.items || [],
      counts: { decisions: 2, actions: 2, questions: 0 },
      docs: m.brief.docs.filter((d) => d.include).map((d) => d.name),
      transcript: afterTranscript()
    }));
  }

  const QUEUES = {
    gomez: { key: 'gomez', meetingId: 'hi-5', seriesId: 'hiring', title: 'Interview · R. Gomez' },
    ps37: { key: 'ps37', meetingId: 'ps-37', seriesId: 'product-sync', title: 'Product Sync' }
  };
  const queue = (key) => ({ ...QUEUES[key], items: key === 'ps37' ? DATA.afterMeeting.candidates : DATA.review, verdicts: [] });
  const pending = () => state.review.items.length - state.review.verdicts.length;

  function world(sceneId) {
    const scene = SCENES.find((s) => s.id === sceneId);
    const seeded = withMeeting(normalizeDocs(structuredClone(DATA)), 'hi-5', (m) => ({ ...m, transcript: evLines(DATA.review) }));
    const base = { scene: sceneId, clock: scene.clock, data: seeded, onboarded: sceneId !== 'first', phase: 'upcoming', live: null, review: queue('gomez'), tracked: false };
    if (sceneId === 'starting') return { ...base, phase: 'starting' };
    if (sceneId === 'after') return { ...base, phase: 'filed', data: fileData(base.data), review: queue('ps37') };
    return base;
  }

  function enterScene(id) {
    clearEffects();
    stopTicker();
    dismissNotes();
    clearToasts();
    CC.panel.close(true);
    CC.palette.close();
    CC.onboarding.close(true);
    state = world(id);
    if (id === 'live') startLive(true);
    renderClock();
    CC.island.reset();
    CC.island.setHidden(id === 'first');
    sync();
    if (id === 'first') later(() => CC.onboarding.open(), 420);
    if (id === 'starting') later(notifyStarting, 320);
  }

  function renderClock() {
    const clock = $$('.menubar .mb-right > .mb-item.num').pop();
    if (clock) clock.textContent = `${DATA.now.day}  ${state.clock}`;
  }
  function setClock(value) {
    set({ clock: value });
    renderClock();
  }

  function statusMarkup() {
    if (!state.onboarded) return '';
    const f = focusMeeting();
    const { phase, live } = state;
    if (phase === 'live') return `<span class="rec-dot${live.paused ? ' paused' : ''}"></span><span class="num">${live.paused ? 'Paused' : 'Recording'} <span data-elapsed>${formatElapsed(elapsed())}</span></span>`;
    if (phase === 'filing') return '<span>Filing…</span>';
    if (phase === 'filed' && pending()) return `<span class="num">${pending()} to review</span>`;
    if (!f) return '';
    if (phase === 'starting') return `<span>${esc(shortName(f.series))} · now</span>`;
    return `<span class="num">${esc(shortName(f.series))} · ${untilShort(f.meeting)}</span>`;
  }
  function renderStatus() {
    const markup = statusMarkup();
    if (markup === statusCache) return;
    statusCache = markup;
    const item = $('#teluStatus');
    $('.ts-text', item).innerHTML = markup;
    item.classList.toggle('icon-only', !markup);
  }

  function notifyStarting() {
    const f = focusMeeting();
    if (!f || state.phase !== 'starting') return;
    notes.push(Kit.notify({
      title: `${f.series.name} is starting`,
      body: `${f.meeting.where} · ${f.series.people.length} people · brief ready`,
      time: 'now',
      duration: 14000,
      actions: [{ label: 'Record', primary: true, onClick: () => startRecording() }, { label: 'Not this time', onClick: () => skipMeeting() }],
      onClick: () => CC.palette.openAt('meeting', f.meeting.id)
    }));
  }
  const dismissNotes = () => {
    notes.forEach((n) => n.dismiss());
    notes = [];
  };

  function startLive(scripted) {
    const lines = scripted
      ? [{ ...DATA.live.transcript[0], seen: true }, { ...DATA.live.transcript[1], seen: false }]
      : [];
    set({ phase: 'live', live: { base: scripted ? DATA.live.elapsed : 0, resumedAt: Date.now(), paused: false, lines, suggestion: 'waiting' } });
    if (!scripted) {
      later(() => addLine(0), 2200);
      later(() => addLine(1), 4600);
    }
    later(arriveSuggestion, scripted ? 1200 : 6400);
    startTicker();
  }
  function startTicker() {
    stopTicker();
    ticker = setInterval(tick, 1000);
  }
  function stopTicker() {
    clearInterval(ticker);
    ticker = null;
  }
  function tick() {
    if (!state.live) return;
    const text = formatElapsed(elapsed());
    $$('[data-elapsed]').forEach((el) => { el.textContent = text; });
  }
  function addLine(index) {
    if (!state.live) return;
    commit({ live: { ...state.live, lines: [...state.live.lines, { ...DATA.live.transcript[index], seen: false }] } });
  }
  function markLinesSeen() {
    if (state.live) set({ live: { ...state.live, lines: state.live.lines.map((l) => ({ ...l, seen: true })) } });
  }
  function arriveSuggestion() {
    if (state.live && state.live.suggestion === 'waiting') commit({ live: { ...state.live, suggestion: 'shown' } });
  }
  function suggestionFeedback(kind) {
    if (!state.live) return;
    commit({ live: { ...state.live, suggestion: kind } });
    toast(kind === 'useful' ? 'Thanks — Telu will surface more like this' : 'Dismissed · Telu will hold back on similar ones', { icon: kind === 'useful' ? 'thumbs-up' : 'check' });
  }

  function startRecording() {
    if (!canRecord()) return toast('Nothing to record right now — Telu records with your next meeting', { icon: 'info' });
    dismissNotes();
    startLive(false);
    sync();
    return true;
  }
  function togglePause() {
    const lv = state.live;
    if (!lv) return;
    commit({ live: lv.paused ? { ...lv, paused: false, resumedAt: Date.now() } : { ...lv, base: elapsed(), paused: true } });
  }
  function stopRecording() {
    if (state.phase !== 'live') return;
    stopTicker();
    clearEffects();
    commit({ phase: 'filing', live: null });
    later(finishFiling, 1700);
  }
  function finishFiling() {
    set({ phase: 'filed', data: fileData(state.data), review: queue('ps37') });
    setClock('10:46');
    scenarioBar.set('after', false);
    sync();
  }
  function toggleRecording() {
    if (state.phase === 'live') return stopRecording();
    return startRecording();
  }
  function skipMeeting() {
    dismissNotes();
    commit({ phase: 'skipped' });
    CC.island.flash('skipped', 1700);
  }

  function remember(data, r, item, text) {
    const hit = findIn(data, r.meetingId);
    const day = dayLabel(hit.meeting);
    const entry = { type: item.type, text, owner: item.owner, due: item.due, status: STATUS_FOR[item.type], from: day, src: `${day} · ${item.ev.t}`, fresh: true };
    const resolve = (m) => (item.resolves && m.text === item.resolves ? { ...m, status: 'resolved' } : m);
    const withMemory = withSeries(data, r.seriesId, (s) => ({ ...s, memory: [entry, ...s.memory.map(resolve)] }));
    return withMeeting(withMemory, r.meetingId, (m) => ({ ...m, items: [...(m.items || []), entry] }));
  }
  function decide(id, verdict, text) {
    const r = state.review;
    const item = r.items.find((k) => k.id === id);
    if (!item || r.verdicts.some((v) => v.id === id)) return;
    const finalText = text && text.trim() ? text.trim() : item.text;
    const record = { id, verdict, edited: verdict === 'accepted' && finalText !== item.text };
    const data = verdict === 'accepted' ? remember(state.data, r, item, finalText) : state.data;
    set({ data, review: { ...r, verdicts: [...r.verdicts, record] } });
    if (!pending()) finishReview();
    sync();
  }
  function finishReview() {
    const r = state.review;
    if (r.key === 'gomez') set({ data: withMeeting(state.data, r.meetingId, (m) => ({ ...m, status: 'done', pending: 0 })) });
    if (r.key !== 'ps37') return;
    set({ phase: 'done' });
    later(() => CC.island.flash('updated', 1900), 240);
  }

  const safeFileName = (raw) => {
    const name = String(raw || '').trim();
    return /^[^\n\r\t<>]{1,120}\.[a-z0-9]{1,6}$/i.test(name) ? name : '';
  };
  function attachDoc(name) {
    const f = focusMeeting();
    if (!f) return false;
    const { meeting } = f;
    const done = meeting.status === 'done';
    const has = done ? (meeting.docs || []).includes(name) : meeting.brief.docs.some((d) => d.name === name);
    if (has) return false;
    const doc = { name, meta: 'Just now · from your Mac', include: true, fresh: true };
    set({ data: withMeeting(state.data, meeting.id, (m) => (done ? { ...m, docs: [...(m.docs || []), name] } : { ...m, brief: { ...m.brief, docs: [...m.brief.docs, doc] } })) });
    sync();
    return true;
  }
  function toggleDoc(meetingId, name, include) {
    set({ data: withMeeting(state.data, meetingId, (m) => ({ ...m, brief: { ...m.brief, docs: m.brief.docs.map((d) => (d.name === name ? { ...d, include } : d)) } })) });
  }
  function addAgenda(meetingId, text) {
    set({ data: withMeeting(state.data, meetingId, (m) => ({ ...m, brief: { ...m.brief, agenda: [...m.brief.agenda, { t: text, d: '5m', mine: true }] } })) });
  }
  function savePurpose(seriesId, fields, bump) {
    set({
      data: withSeries(state.data, seriesId, (s) => {
        const version = bump ? s.purpose.version + 1 : s.purpose.version;
        const history = bump ? [{ v: version, date: 'Today', note: 'Edited in place' }, ...s.purpose.history] : s.purpose.history;
        return { ...s, purpose: { ...s.purpose, ...fields, version, history, edited: 'just now', by: 'You' } };
      })
    });
  }

  const matchPerson = (name) => Object.keys(DATA.people).find((p) => p.toLowerCase() === name.toLowerCase() || p.toLowerCase().startsWith(`${name.toLowerCase()} `)) || name;
  function cadenceRule({ cadence, day, time }) {
    const when = [day, time].filter(Boolean).join(' · ');
    if (cadence === 'Every 2 weeks') return `Every other ${when}`;
    if (cadence === 'Monthly') return `Monthly${when ? ` · ${when}` : ''}`;
    if (cadence === 'Daily') return `Every day${time ? ` · ${time}` : ''}`;
    if (cadence === 'Weekly') return day ? `Every ${when}` : `Weekly${time ? ` · ${time}` : ''}`;
    return 'Grouped by you · no fixed time';
  }
  const blankPurpose = (note) => ({ version: 1, edited: 'just now', by: 'You', why: '', outcomes: [], agenda: [], notFor: '', history: [{ v: 1, date: 'Today', note }] });
  function nextColor() {
    const uses = (color) => state.data.series.filter((s) => s.color === color).length;
    return NEW_COLORS.reduce((best, color) => (uses(color) < uses(best) ? color : best), NEW_COLORS[0]);
  }
  function createSeries(parsed) {
    const id = `new-${state.data.series.length}-${Date.now().toString(36)}`;
    const people = parsed.people.map(matchPerson);
    const series = {
      id, name: parsed.title, color: nextColor(), icon: people.length === 1 ? 'person' : 'people', group: 'Other',
      cadence: parsed.cadence === 'One-off' ? 'Manual' : parsed.cadence, rule: cadenceRule(parsed), source: 'manual',
      count: 0, since: 'Sep 2026', next: [parsed.day, parsed.time].filter(Boolean).join(' ') || 'Not scheduled', people,
      purpose: blankPurpose('Created from ⌥Space'), docs: [], memory: [], meetings: []
    };
    set({ data: { ...state.data, series: [...state.data.series, series] } });
    return id;
  }
  const seriesFromProposal = (p) => ({
    id: p.id, name: p.title, color: nextColor(), icon: 'people', group: 'Team',
    cadence: /weekday/.test(p.rule) ? 'Daily' : 'Weekly', rule: p.rule, source: 'calendar', calendar: p.calendar,
    count: 0, since: 'Oct 2026', next: p.first || 'Tomorrow 09:00', people: p.people,
    purpose: blankPurpose('Remembered from your calendar'), docs: [], memory: [], meetings: []
  });
  function decideProposal(id, choice) {
    const p = state.data.proposals.find((x) => x.id === id);
    if (!p) return '';
    let data = { ...state.data, proposals: state.data.proposals.filter((x) => x.id !== id) };
    const target = p.target ? seriesById(p.target) : null;
    if (choice === 'accept' && p.kind === 'new') data = { ...data, series: [...data.series, seriesFromProposal(p)] };
    if (choice === 'accept' && p.kind === 'join' && target) {
      const joined = { id: 'ac-sso', n: target.count + 2, date: 'Wed 30 Sep', time: '13:00–13:45', title: p.title, status: 'upcoming', where: 'Zoom' };
      data = withSeries(data, p.target, (s) => ({ ...s, meetings: [joined, ...s.meetings] }));
    }
    set({ data });
    if (p.kind === 'join') return choice === 'accept' ? `${p.title} filed to ${target.name}` : `Kept ${p.title} as a one-off`;
    if (p.quiet) return choice === 'accept' ? `${p.title} is now a series` : `Telu won’t suggest ${p.title} again`;
    return choice === 'accept' ? `${p.title} is now a series · first brief ${p.first}` : `${p.title} stays a calendar event`;
  }
  function fileUnfiled(id, seriesId) {
    const u = state.data.unfiled.find((x) => x.id === id);
    const target = seriesById(seriesId);
    if (!u || !target) return '';
    const recording = { id: `${u.id}-filed`, n: 0, date: 'Mon 28 Sep', time: '16:40–16:48', duration: u.duration, title: 'Recording · Mon 28 Sep', status: 'done', summary: 'Quick call with Dana on SSO setup and audit-log retention.', counts: { decisions: 0, actions: 1, questions: 0 }, docs: [] };
    const insert = (meetings) => {
      const at = meetings.findIndex((m) => m.status !== 'upcoming' && m.status !== 'preparing');
      const index = at < 0 ? meetings.length : at;
      return [...meetings.slice(0, index), recording, ...meetings.slice(index)];
    };
    const doc = { name: u.title, ver: 'v1', size: '12 KB', added: 'Sep 27', include: false };
    const filed = withSeries(state.data, seriesId, (s) => (u.kind === 'doc' ? { ...s, docs: [...s.docs, doc] } : { ...s, meetings: insert(s.meetings) }));
    set({ data: { ...filed, unfiled: filed.unfiled.filter((x) => x.id !== id) } });
    return `Filed ${u.title} to ${target.name}`;
  }
  function track() {
    commit({ tracked: true });
  }
  function completeOnboarding({ picks, manual }) {
    const dropped = DATA.detected.filter((d, i) => d.series && !picks[i]).map((d) => d.series);
    const standup = picks[DATA.detected.findIndex((d) => d.title === 'Daily Standup')];
    const kept = state.data.series.filter((s) => !dropped.includes(s.id));
    set({ onboarded: true, scene: 'before', data: { ...state.data, series: kept } });
    if (standup) set({ data: { ...state.data, series: [...state.data.series, seriesFromProposal(DATA.proposals[2])], proposals: state.data.proposals.filter((p) => p.id !== 'pr-standup') } });
    manual.forEach((p) => createSeries(p));
    scenarioBar.set('before', false);
    sync();
  }

  const lowerFirst = (text) => (/^[A-Z][a-z]/.test(text) ? text[0].toLowerCase() + text.slice(1) : text);
  function synthQuote({ type, text }) {
    if (type === 'question') return text;
    if (type === 'commitment') return `I’ll ${lowerFirst(text)}.`;
    if (type === 'decision') return `So we’re agreed: ${text}.`;
    return `${text}.`;
  }
  function speaker(ctx) {
    if (ctx.owner) return ctx.owner;
    const s = ctx.seriesId && seriesById(ctx.seriesId);
    if (!s || !s.people.length) return 'You';
    return ctx.type === 'decision' && s.people.length === 1 ? 'You' : s.people[0];
  }
  function transcriptEvidence(label) {
    const match = label.match(/^([A-Z][a-z]{2}) (\d{1,2}) · (\d{1,2}:\d{2})$/);
    if (!match) return null;
    const [, mon, day, t] = match;
    for (const s of state.data.series) {
      for (const m of s.meetings) {
        const line = (m.transcript || []).find((l) => l.t === t);
        if (line && (m.day || m.date).endsWith(`${day} ${mon}`)) return { t, who: line.who, quote: esc(line.text), where: `${esc(s.name)} #${m.n}`, meetingId: m.id };
      }
    }
    return null;
  }
  function synthEvidence(label, ctx) {
    const [date, t = ''] = label.split(' · ');
    const s = ctx.seriesId && seriesById(ctx.seriesId);
    return { t, who: speaker(ctx), quote: esc(synthQuote(ctx)), where: s ? `${esc(s.name)} · ${date}` : date };
  }
  function docEvidence(trigger, doc, where, ctx) {
    const excerpt = DOC_EXCERPTS[`${doc} · ${where}`] || `${ctx.text || doc}.`;
    return Kit.popover(trigger, `<div class="evd">
      <div class="t-eyebrow">FROM THE DOC · ${esc(where)}</div>
      <div class="evd-quote">“${esc(excerpt)}”</div>
      <div class="row-flex evd-foot">${Kit.fileBadge(doc)}<span class="truncate muted">${esc(doc)}</span><span class="spacer"></span><span class="t-caption">On this Mac</span></div>
    </div>`, { width: 320 });
  }
  function evidence(trigger, label, ctx = {}) {
    const doc = label.match(/^(.+\.[a-z]{2,4}) · (.+)$/i);
    if (doc) return docEvidence(trigger, doc[1], doc[2], ctx);
    const ev = transcriptEvidence(label) || synthEvidence(label, ctx);
    const onOpen = ev.meetingId ? () => CC.palette.openAt('meeting', ev.meetingId, { line: ev.t }) : undefined;
    return Kit.evidence(trigger, ev, { where: ev.where, onOpen });
  }
  const src = (label, ctx = {}) => `<span class="ev" data-label="${esc(label)}" data-type="${ctx.type || ''}" data-text="${esc(ctx.text || '')}" data-owner="${esc(ctx.owner || '')}" data-sid="${ctx.seriesId || ''}">${Kit.source(esc(label))}</span>`;
  const kIcon = (type) => `<span class="ktype k-ico" data-type="${type}" data-tip="${KLABEL[type]}">${icon(type)}</span>`;
  const statusChip = (s) => (s === 'resolved' ? '<span class="status" data-s="completed">Resolved</span>' : Kit.status(s));
  const glyph = (name, tone = '') => `<span class="glyph ${tone}">${icon(name)}</span>`;

  const toasts = new Set();
  function toast(text, opts = {}) {
    const inPalette = CC.palette && CC.palette.isOpen();
    const handle = Kit.toast(esc(text), { container: inPalette ? $('#cmdk') : $('#desk'), ...opts });
    toasts.add(handle);
    setTimeout(() => toasts.delete(handle), (opts.duration || 4200) + 400);
    return handle;
  }
  const clearToasts = () => {
    toasts.forEach((t) => t.dismiss());
    toasts.clear();
  };

  function bindEvidence() {
    document.addEventListener('click', (event) => {
      const btn = event.target.closest('.ev .source');
      if (!btn) return;
      const wrap = btn.closest('.ev');
      const d = wrap.dataset;
      evidence(btn, d.label, { type: d.type, text: d.text, owner: d.owner, seriesId: d.sid });
    });
  }
  const kitLayerOpen = () => Boolean($('.popover.open') || $('.menu:not(.closing)') || $('.alert.open'));
  function bindOutside() {
    document.addEventListener('pointerdown', (event) => {
      const target = event.target;
      if (kitLayerOpen() || target.closest('.toast, .notif, .scenario, .popover, .menu, .alert')) return;
      CC.panel.outside(target);
      CC.palette.outside(target);
      CC.island.outside(target);
    }, true);
  }
  function onEscape(event) {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    const handled = CC.panel.escape() || CC.palette.escape() || CC.island.escape() || CC.onboarding.escape();
    if (handled) event.preventDefault();
  }
  function bindKeys() {
    Kit.keys({
      'alt+space': () => CC.palette.toggle(),
      'mod+k': () => CC.palette.toggle(),
      'mod+alt+r': () => toggleRecording(),
      'mod+e': () => CC.palette.editPurposeShortcut()
    });
    document.addEventListener('keydown', onEscape);
  }

  function buildMenubar() {
    const extras = '<span class="mb-item telu-status icon-only" id="teluStatus" role="button" aria-label="Telu"><img src="../kit/telu-menubar.png" class="template-img" alt=""><span class="ts-text"></span></span>';
    $('#desk').insertAdjacentHTML('afterbegin', Kit.menubar({ app: 'Keynote', menus: MENUS, extras }));
  }
  function boot() {
    buildMenubar();
    onSync(renderStatus);
    CC.island.mount();
    CC.panel.mount();
    CC.palette.mount();
    CC.onboarding.mount();
    bindEvidence();
    bindOutside();
    bindKeys();
    scenarioBar = Kit.scenarios(SCENES, enterScene, 'before');
    enterScene('before');
  }
  document.addEventListener('DOMContentLoaded', boot);

  return {
    get, set, sync, commit, onSync, later, toast, esc,
    findMeeting, seriesById, focusMeeting, upcoming, isNextMeeting, canRecord, pending,
    startOf, untilLabel, untilShort, formatElapsed, elapsed, shortName, dayLabel,
    startRecording, togglePause, stopRecording, toggleRecording, skipMeeting, markLinesSeen, suggestionFeedback,
    decide, safeFileName, attachDoc, toggleDoc, addAgenda, savePurpose, createSeries, nextColor, matchPerson, decideProposal, fileUnfiled, track, completeOnboarding,
    evidence, src, kIcon, statusChip, glyph, KLABEL
  };
})();
