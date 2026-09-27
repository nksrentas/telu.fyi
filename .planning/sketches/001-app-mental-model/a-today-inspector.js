(() => {
  const AT = window.AT;
  const { esc } = Kit;
  const { plural, minutesOf, fmtSize } = AT.util;
  const KLABEL = { decision: 'Decision', commitment: 'Commitment', question: 'Open question', fact: 'Fact' };
  const saveTimers = new WeakMap();

  const viewForEvent = (ev, kind) => {
    if (ev.state === 'unfiled') return 'unfiled';
    if (['ready', 'preparing', 'recording'].includes(kind)) return 'brief';
    if (kind === 'tracking') return 'tracking';
    if (['review', 'summarizing', 'filed'].includes(kind)) return 'past';
    if (kind === 'proposal') return 'proposal';
    return 'untracked';
  };

  const viewForMeeting = (m) => {
    if (m.status === 'cancelled') return 'cancelled';
    return ['done', 'review'].includes(m.status) ? 'past' : 'brief';
  };

  AT.inspTarget = () => {
    const st = AT.state;
    const insp = st.inspect;
    if (!insp) return { view: st.calendar === 'connected' ? 'none' : 'welcome' };
    if (insp.kind === 'event') {
      const ev = AT.eventById(insp.id);
      if (!ev) return { view: 'none' };
      const kind = AT.kindOf(ev);
      const found = AT.findMeeting(ev.meeting);
      return { key: `e:${ev.id}`, view: viewForEvent(ev, kind), ev, kind, dayIndex: AT.dayOf(ev.id), series: found ? found.series : AT.trackedSeriesOf(ev), meeting: found ? found.meeting : null };
    }
    const found = AT.findMeeting(insp.id);
    if (!found) return { view: 'none' };
    const kind = found.meeting.status === 'upcoming' ? 'ready' : 'filed';
    return { key: `m:${insp.id}`, view: viewForMeeting(found.meeting), kind, dayIndex: null, series: found.series, meeting: found.meeting };
  };

  const dayText = (t) => (t.dayIndex === null || t.dayIndex === undefined ? (t.meeting ? t.meeting.date : '') : AT.dayLabel(t.dayIndex));
  const timeText = (t) => (t.ev ? `${t.ev.start}–${t.ev.end}` : t.meeting ? t.meeting.time : '');
  const metaText = (parts) => parts.filter(Boolean).map(esc).join('<span class="a-sep">·</span>');
  const peopleLabel = (people) => (people.length <= 2 ? people.join(' & ') : `${people[0].split(' ')[0]}, ${people[1].split(' ')[0]} and ${people.length - 2} more`);
  const standupPeople = () => (DATA.proposals.find((p) => p.id === 'pr-standup') || { people: [] }).people;

  const peopleFor = (t) => {
    if (t.ev && t.ev.people) return t.ev.people;
    if (t.ev && t.ev.title === 'Daily Standup') return standupPeople();
    return t.series ? t.series.people : [];
  };

  const headerMarkup = (t, { title, n, meta }) => {
    const s = t.series;
    const back = AT.state.back ? `<button class="btn sm plain a-back" data-act="insp-back">${icon('chevron-left')}${esc(AT.state.back.label)}</button>` : '';
    const link = s ? `<button class="a-ih-series" data-act="open-series" data-series="${s.id}">${Kit.seriesIcon(s, 'a-xs')}<span class="truncate">${esc(s.name)}</span>${icon('chevron-right')}</button>` : '';
    const people = peopleFor(t);
    const avatars = people.length ? `<div class="a-ih-people">${Kit.avatars(people, 5)}<span class="truncate">${esc(peopleLabel(people))}</span></div>` : '';
    return `<header class="a-ih">${back}${link}<h2 class="a-ih-title"><span>${esc(title)}</span>${n ? `<span class="a-ih-n num">#${n}</span>` : ''}</h2>`
      + `<div class="a-ih-meta">${meta}</div>${avatars}</header>`;
  };

  const segMarkup = (items, current) => `<div class="seg a-seg" id="inspSeg">${items.map(([value, label]) => `<button data-value="${value}" aria-selected="${value === current}">${label}</button>`).join('')}</div>`;

  const purposeSection = (s) => {
    const p = s.purpose;
    const body = p.why
      ? `<p class="a-purpose-text selectable">${esc(p.why)}</p>`
      : '<p class="a-purpose-text a-purpose-empty">No purpose yet — a few lines here shape every brief.</p>';
    return '<section class="a-sec"><div class="a-sec-head"><span class="t-eyebrow">Purpose</span><span class="spacer"></span>'
      + `<span class="a-ver num" data-purpose-ver="${s.id}">v${p.version} · ${esc(p.edited)}</span>`
      + `<button class="btn sm plain a-edit" data-act="edit-purpose" data-series="${s.id}">${icon('pencil')}Edit</button></div>${body}</section>`;
  };

  const evAttrs = (s, k) => `data-ev-series="${s ? s.id : ''}" data-ev-who="${esc(k.owner || '')}" data-ev-text="${esc(k.text || '')}"`;

  const kIcon = (type) => `<span class="ktype a-kicon" data-type="${type}" data-tip="${KLABEL[type]}">${icon(type)}</span>`;

  const carryItem = (k, s) => {
    const note = k.note ? `<span class="chip${/^Due today/.test(k.note) ? ' amber' : ''}">${esc(k.note)}</span>` : '';
    const owner = k.owner ? `<span class="a-owner">${Kit.avatar(k.owner)}${esc(k.owner)}</span>` : '';
    return `<li class="a-kitem" ${evAttrs(s, k)}>${kIcon(k.type)}<div class="a-kbody"><p>${esc(k.text)}</p>`
      + `<div class="a-kmeta">${owner}${note}${k.src ? Kit.source(k.src) : ''}</div></div></li>`;
  };

  const carrySection = (items, s) => {
    if (!items.length) return '';
    return `<section class="a-sec"><div class="a-sec-head"><span class="t-eyebrow">Since last time</span><span class="spacer"></span><span class="faint num">${items.length}</span></div>`
      + `<ul class="a-klist">${items.map((k) => carryItem(k, s)).join('')}</ul></section>`;
  };

  const askSection = (asks, s) => '<section class="a-sec a-ask"><div class="a-sec-head">'
    + `<span class="a-ask-title">${icon('sparkle')}Worth asking</span></div>`
    + `<ul class="a-asklist">${asks.map((a) => `<li ${evAttrs(s, a)}><p>${esc(a.text)}</p><div class="a-kmeta">${[].concat(a.src || []).map(Kit.source).join('')}</div></li>`).join('')}</ul></section>`;

  const agendaRow = (a, i) => `<li class="a-arow"><span class="a-anum num">${i + 1}</span><span class="a-atext truncate">${esc(a.t)}</span>`
    + `${a.added ? '<span class="a-new">New</span>' : ''}<span class="spacer"></span><span class="chip num a-dur">${esc(a.d)}</span></li>`;

  const addButton = () => `<button class="btn sm plain a-add-btn" data-act="agenda-add">${icon('plus')}Add item</button>`;

  const agendaSection = (items, meetingId) => {
    const total = items.reduce((n, a) => n + minutesOf(a.d), 0);
    return `<section class="a-sec"><div class="a-sec-head"><span class="t-eyebrow">Agenda</span><span class="spacer"></span><span class="faint num" id="agendaTotal">${total} min</span></div>`
      + `<ol class="a-alist" id="agendaList">${items.map(agendaRow).join('')}</ol>`
      + `<div class="a-add-slot" id="agendaAdd" data-meeting="${meetingId}">${addButton()}</div></section>`;
  };

  const preparingNotice = (t) => {
    const docs = AT.docsFor(t.meeting.id).filter((d) => d.include);
    const doc = docs.length ? docs[docs.length - 1].name : 'last week’s notes';
    return `<div class="collapsible a-prep-wrap" id="prepNotice"><div><div class="a-prep"><span class="spinner"></span><span class="truncate">Preparing brief — reading ${esc(doc)}</span></div></div></div>`;
  };

  const briefTab = (t) => {
    const b = AT.briefFor(t.meeting.id);
    return [
      t.kind === 'preparing' ? preparingNotice(t) : '',
      purposeSection(t.series),
      carrySection(b.carry, t.series),
      b.ask.length ? askSection(b.ask, t.series) : '',
      agendaSection(b.agenda, t.meeting.id)
    ].join('');
  };

  const safeBadge = (name) => Kit.fileBadge(String(name).replace(/[^\w.\- ]/g, ''));

  const docRow = (d) => {
    const meta = [d.ver, d.size, d.from ? `from ${d.from}` : ''].filter(Boolean).map(esc).join(' · ');
    return `<div class="a-doc" data-doc="${esc(d.name)}">${safeBadge(d.name)}<div class="a-doc-body"><span class="truncate">${esc(d.name)}</span><small class="num">${meta}</small></div>`
      + `<button class="switch" aria-checked="${d.include}" data-doc-switch="${esc(d.name)}" data-tip="Include in brief"></button></div>`;
  };

  const emptyDocs = (text) => `<div class="a-docs-empty">${esc(text)}</div>`;

  const docsTab = (t) => {
    const docs = AT.docsFor(t.meeting.id);
    const seriesDocs = docs.filter((d) => d.scope === 'series');
    const meetingDocs = docs.filter((d) => d.scope === 'meeting');
    return `<div class="a-docs-head"><span class="t-eyebrow">${esc(t.series.name)} docs</span><span class="spacer"></span><span class="t-eyebrow">In brief</span></div>`
      + `<div class="a-docs card">${seriesDocs.map(docRow).join('') || emptyDocs('No series docs yet')}</div>`
      + '<div class="a-docs-head"><span class="t-eyebrow">This meeting</span></div>'
      + `<div class="a-docs card" id="meetingDocs">${meetingDocs.map(docRow).join('') || emptyDocs('Nothing attached yet')}</div>`
      + `<div class="a-drop" id="dropZone">${icon('tray-down', 'lg')}<span>Drop PDF, DOCX or text to attach to this meeting</span></div>`
      + `<div class="a-docs-actions"><button class="btn sm" data-act="paste-text">${icon('doc-plus')}Paste text…</button><span class="spacer"></span><span class="a-local">${icon('lock', 'sm')}Stays on this Mac</span></div>`;
  };

  const notesTab = (t) => {
    const text = AT.state.notes[t.meeting.id] || '';
    return '<div class="a-notes-head"><span class="t-eyebrow">Private notes</span><span class="spacer"></span><span class="a-save" id="notesSave"></span></div>'
      + `<div class="a-notes selectable" id="notesArea" contenteditable="true" data-placeholder="Private notes for this meeting…">${esc(text).replace(/\n/g, '<br>')}</div>`
      + `<p class="a-notes-cap">${icon('lock', 'sm')}Only on this Mac. Telu reads them when it builds the next brief.</p>`;
  };

  const BRIEF_TABS = { brief: briefTab, docs: docsTab, notes: notesTab };

  AT.footButton = (t) => {
    const today = t.ev && t.dayIndex === AT.TODAY && !AT.isPast(t.ev, AT.TODAY);
    if (!today) return '';
    return t.kind === 'recording'
      ? `<button class="btn record lg block" data-act="stop" data-id="${t.ev.id}">${icon('stop')}Stop recording<span class="num a-foot-time" data-rec-timer>0:00</span></button>`
      : `<button class="btn record lg block" data-act="record" data-id="${t.ev.id}">${icon('record')}Record<span class="kbd">⌘R</span></button>`;
  };

  const footerMarkup = (t) => {
    const src = AT.briefSources(t.meeting.id);
    const btn = AT.footButton(t);
    return `<footer class="a-foot">${btn ? `<div class="a-foot-btn" id="footBtn">${btn}</div>` : ''}<div class="a-foot-cap">`
      + `<span id="briefCaption">${captionText(src)}</span><button class="btn plain icon sm" data-act="brief-info" data-tip="What went into this brief">${icon('info')}</button></div></footer>`;
  };

  const captionText = (src) => `Brief built from ${plural(src.included.length, 'doc')} and ${plural(src.memory.length, 'remembered item')}`;

  const briefView = (t) => {
    const m = t.meeting;
    const tab = BRIEF_TABS[AT.state.tab] ? AT.state.tab : 'brief';
    const included = AT.docsFor(m.id).filter((d) => d.include).length;
    const title = m.title || (t.ev && t.ev.title) || t.series.name;
    const where = (t.ev && t.ev.where) || m.where;
    return headerMarkup(t, { title, n: m.n, meta: metaText([dayText(t), timeText(t), where]) })
      + segMarkup([['brief', 'Brief'], ['docs', `Docs<span class="a-seg-count num" id="docsCount">${included}</span>`], ['notes', 'Notes']], tab)
      + `<div class="a-tab" id="inspTab">${BRIEF_TABS[tab](t)}</div>${footerMarkup(t)}`;
  };

  const trackingView = (t) => {
    const s = t.series;
    return headerMarkup(t, { title: t.ev.title, meta: metaText([dayText(t), timeText(t), t.ev.where || `${t.ev.calendar} calendar`]) })
      + `<div class="a-note-card">${icon('check-circle')}<div><b>Telu is tracking ${esc(s.name)}</b>`
      + '<p>The first brief arrives before the next one. A purpose helps Telu know what matters.</p></div></div>'
      + purposeSection(s);
  };

  const untrackedView = (t) => {
    const ev = t.ev;
    const recurring = t.kind === 'recurring';
    const past = AT.isPast(ev, t.dayIndex);
    const once = AT.state.recordOnce[ev.id];
    const primary = recurring
      ? `<button class="btn primary" data-act="track" data-id="${ev.id}">${icon('plus')}Track this series</button>`
      : `<button class="btn primary" data-act="add-to-series" data-id="${ev.id}">Add to series…</button>`;
    const record = past ? '' : `<button class="btn" data-act="record-once" data-id="${ev.id}">${once ? 'Don’t record' : `${icon('record')}Record once`}</button>`;
    const copy = recurring
      ? `It repeats ${esc((ev.repeat || '').toLowerCase())} in your ${esc(ev.calendar)} calendar. Track it and Telu prepares a brief before each one — and remembers what was decided.`
      : 'A one-off event. Add it to a series to get a brief, or record it once — nothing else is kept.';
    return headerMarkup(t, { title: ev.title, meta: metaText([dayText(t), timeText(t), ev.where || `${ev.calendar} calendar`]) })
      + `<div class="empty a-insp-empty"><span class="a-empty-badge">${icon(recurring ? 'repeat' : 'calendar', 'xl')}</span>`
      + `<h3>Telu isn’t tracking ${esc(ev.title)}</h3><p>${copy}</p>${once ? `<p class="a-once">${icon('record')}Records once at ${ev.start}</p>` : ''}<div class="a-empty-actions">${primary}${record}</div></div>`;
  };

  const proposalView = (t) => {
    const ev = t.ev;
    const p = AT.state.proposals.find((x) => x.id === ev.proposal);
    const target = AT.seriesById(p.target);
    return headerMarkup(t, { title: ev.title, meta: metaText([dayText(t), timeText(t), ev.where]) })
      + `<div class="a-prop-card card"><div class="a-prop-kind">${icon('sparkles')}Telu found a likely match</div>`
      + `<div class="a-prop-target">${Kit.seriesIcon(target)}<div><b>${esc(target.name)}</b><span>${esc(target.rule)}</span></div></div>`
      + `<p class="muted">${esc(p.reason)}. Adding it gives this session the ${esc(target.name)} brief and files what’s decided into the same memory.</p>`
      + `<div class="a-empty-actions a-left"><button class="btn primary" data-act="proposal-add" data-id="${ev.id}">Add to ${esc(target.name)}</button>`
      + `<button class="btn" data-act="proposal-keep" data-id="${ev.id}">Keep separate</button></div></div>`;
  };

  const unfiledView = (t) => {
    const ev = t.ev;
    const u = DATA.unfiled.find((x) => x.id === ev.unfiled);
    const filed = ev.filedTo ? AT.seriesById(ev.filedTo) : null;
    const s = AT.seriesById(u.suggestion.series);
    const top = filed
      ? `<div class="a-note-card">${icon('check-circle')}<div><b>Filed to ${esc(filed.name)}</b><p>Telu will use it in the next ${esc(filed.name)} brief.</p></div></div>`
      : `<div class="a-prop-card card"><div class="a-prop-kind">${icon('sparkles')}Looks like ${esc(s.name)}</div><p class="muted">${esc(u.suggestion.why)}.</p>`
        + `<div class="a-empty-actions a-left"><button class="btn primary" data-act="file" data-id="${ev.id}">File to ${esc(s.name)}</button><button class="btn" data-act="file-other" data-id="${ev.id}">Choose series…</button></div></div>`;
    return headerMarkup({ ...t, series: filed }, { title: ev.title, meta: metaText([u.when, u.duration]) }) + top + AT.review.transcriptMarkup(AT.unfiledLines());
  };

  const cancelledView = (t) => headerMarkup(t, { title: t.series.name, n: t.meeting.n, meta: metaText([t.meeting.date, t.meeting.time]) })
    + `<div class="empty a-insp-empty"><span class="a-empty-badge">${icon('x-circle', 'xl')}</span><h3>Cancelled</h3><p>${esc(t.meeting.note || 'Cancelled in Calendar')}. Nothing was recorded; open items carried forward to the next meeting.</p></div>`;

  const noneView = () => {
    const next = AT.nextUpId();
    const ev = next && AT.eventById(next);
    const jump = ev ? `<button class="btn tinted" data-act="select-next">Next up · ${esc(ev.title)} at ${ev.start}</button>` : '';
    return `<div class="empty a-insp-empty a-none"><span class="a-empty-badge">${icon('sun', 'xl')}</span><h3>No meeting selected</h3><p>Pick a meeting to see its brief.</p>${jump}`
      + '<p class="a-keys"><span class="keycap">↑</span><span class="keycap">↓</span>to move<span class="keycap">⌘R</span>to record</p></div>';
  };

  const welcomeView = () => '<div class="a-welcome"><h2 class="a-ih-title">How Telu works</h2><ol class="a-steps">'
    + `<li><span class="a-step-icon">${icon('calendar')}</span><div><b>Reads your calendar on this Mac</b><p>Finds the conversations that repeat.</p></div></li>`
    + `<li><span class="a-step-icon">${icon('doc')}</span><div><b>Prepares a brief before each one</b><p>The purpose, what carried over, what’s worth asking.</p></div></li>`
    + `<li><span class="a-step-icon">${icon('sparkles')}</span><div><b>Remembers what was decided</b><p>Decisions, commitments and open questions — each with evidence.</p></div></li>`
    + `</ol><p class="a-local">${icon('lock', 'sm')}Nothing leaves your Mac.</p></div>`;

  const VIEWS = {
    welcome: welcomeView, none: noneView, brief: briefView, tracking: trackingView,
    past: (t) => AT.review.pastView(t, { headerMarkup, metaText, dayText, timeText }),
    untracked: untrackedView, proposal: proposalView, unfiled: unfiledView, cancelled: cancelledView
  };

  const maybePrepare = (t) => {
    if (t.kind !== 'preparing' || !t.meeting || AT.state.prepared[t.meeting.id]) return;
    const meetingId = t.meeting.id;
    AT.set({ prepared: { ...AT.state.prepared, [meetingId]: true } });
    AT.ui.pending.push(setTimeout(() => {
      AT.mapMeeting(meetingId, (m) => ({ ...m, status: 'upcoming' }));
      const ev = AT.eventForMeeting(meetingId);
      if (ev) AT.morphCard(ev.id);
      const notice = Kit.$('#prepNotice');
      if (notice && AT.inspTarget().meeting && AT.inspTarget().meeting.id === meetingId) notice.classList.add('collapsed');
    }, 2600));
  };

  const wireSeg = () => {
    const seg = Kit.$('#inspSeg');
    AT.ui.seg = seg ? Kit.segmented(seg, (value) => AT.switchTab(value)) : null;
  };

  const tabsFor = (t) => (t.view === 'brief' ? BRIEF_TABS : AT.review.PAST_TABS);

  AT.switchTab = (value, { animate = true, highlight = null } = {}) => {
    AT.set({ tab: value, highlight });
    const t = AT.inspTarget();
    const host = Kit.$('#inspTab');
    if (!host) return;
    host.innerHTML = tabsFor(t)[value](t);
    wireNotes(t);
    const hit = Kit.$('.a-tr-line.is-hit', host);
    if (hit) AT.reveal(hit, AT.el.inspScroll, { center: true });
    if (animate) AT.fx.fadeIn(host, { duration: 160 });
  };

  AT.saveIndicator = (el, mode) => {
    if (!el) return;
    clearTimeout(saveTimers.get(el));
    if (mode === 'saving') {
      el.innerHTML = '<span class="spinner a-spin-sm"></span>Saving…';
      el.className = 'a-save is-on';
      return;
    }
    el.innerHTML = `${icon('check')}Saved`;
    el.className = 'a-save is-on is-saved';
    saveTimers.set(el, setTimeout(() => el.classList.remove('is-on'), 1600));
  };

  const wireNotes = (t) => {
    const area = Kit.$('#notesArea');
    if (!area) return;
    let timer;
    area.addEventListener('input', () => {
      if (!area.innerText.trim()) area.innerHTML = '';
      AT.saveIndicator(Kit.$('#notesSave'), 'saving');
      clearTimeout(timer);
      timer = setTimeout(() => {
        AT.set({ notes: { ...AT.state.notes, [t.meeting.id]: area.innerText.trim() } });
        AT.saveIndicator(Kit.$('#notesSave'), 'saved');
      }, 700);
    });
  };

  AT.reveal = (el, scroller, { center = false, smooth = false } = {}) => {
    if (!el || !scroller) return;
    const r = el.getBoundingClientRect();
    const s = scroller.getBoundingClientRect();
    const top = s.top + (parseFloat(getComputedStyle(scroller).paddingTop) || 0);
    const foot = Kit.$('.a-foot', scroller);
    const bottom = s.bottom - (foot ? foot.offsetHeight : 0);
    const delta = center ? r.top - (top + (bottom - top) / 2 - r.height / 2)
      : r.top < top + 8 ? r.top - top - 8
      : r.bottom > bottom - 8 ? r.bottom - bottom + 8 : 0;
    if (delta) scroller.scrollBy({ top: delta, behavior: smooth && !Kit.reduceMotion() ? 'smooth' : 'auto' });
  };

  AT.renderInspector = ({ animate = false } = {}) => {
    const t = AT.inspTarget();
    const host = AT.el.inspBody;
    const key = t.key || t.view;
    const same = key === AT.ui.inspKey;
    const scroll = AT.el.inspScroll.scrollTop;
    AT.ui.inspKey = key;
    host.innerHTML = VIEWS[t.view](t);
    wireSeg();
    wireNotes(t);
    AT.el.inspScroll.scrollTop = same ? scroll : 0;
    const hit = Kit.$('.a-tr-line.is-hit', host);
    if (hit) AT.reveal(hit, AT.el.inspScroll, { center: true });
    if (animate) AT.fx.fadeIn(host, { duration: 180 });
    AT.syncTimers();
    maybePrepare(t);
  };

  AT.inspectorShows = (meetingOrEventId) => {
    const t = AT.inspTarget();
    return !!t && ((t.meeting && t.meeting.id === meetingOrEventId) || (t.ev && t.ev.id === meetingOrEventId));
  };

  const updateDocCounts = (meetingId) => {
    const included = AT.docsFor(meetingId).filter((d) => d.include).length;
    const count = Kit.$('#docsCount');
    if (count) count.textContent = included;
    const caption = Kit.$('#briefCaption');
    if (caption) caption.textContent = captionText(AT.briefSources(meetingId));
  };

  const attachItems = (items, verb) => {
    const t = AT.inspTarget();
    if (t.view !== 'brief' || !items.length) return;
    const id = t.meeting.id;
    AT.set({ attached: { ...AT.state.attached, [id]: [...(AT.state.attached[id] || []), ...items] } });
    if (AT.state.tab !== 'docs') {
      AT.set({ tab: 'docs' });
      if (AT.ui.seg) AT.ui.seg.set('docs', { animate: true, silent: true });
    }
    AT.switchTab('docs', { animate: false });
    items.forEach((item) => {
      const row = Kit.$(`#meetingDocs [data-doc="${CSS.escape(item.name)}"]`);
      if (row) Kit.enterAnimated(row);
    });
    updateDocCounts(id);
    const label = `${esc(t.meeting.title || t.series.name)}${t.meeting.n ? ` #${t.meeting.n}` : ''}`;
    Kit.toast(items.length > 1 ? `${verb} ${items.length} files to ${label}` : `${verb} to ${label}`, { icon: 'paperclip' });
  };

  const uniqueName = (name, id) => {
    const taken = new Set(AT.docsFor(id).map((d) => d.name));
    if (!taken.has(name)) return name;
    const [base, ext] = [name.replace(/\.[^.]+$/, ''), (name.match(/\.[^.]+$/) || [''])[0]];
    let n = 2;
    while (taken.has(`${base} ${n}${ext}`)) n += 1;
    return `${base} ${n}${ext}`;
  };

  AT.attachFiles = (files) => {
    const t = AT.inspTarget();
    if (t.view !== 'brief') return Kit.toast('Select an upcoming meeting to attach files', { icon: 'paperclip' });
    attachItems(files.map((f) => ({ name: uniqueName(f.name, t.meeting.id), ver: 'v1', size: fmtSize(f.size), added: 'Today' })), 'Attached');
  };

  AT.canAttach = () => AT.inspTarget().view === 'brief';

  const pasteSheet = () => Kit.sheet('<div class="sheet-head"><h2>Paste text</h2><p>Attach notes, an email or an excerpt. It stays on this Mac.</p></div>'
    + '<div class="sheet-body"><textarea class="field a-paste" rows="9" placeholder="Paste or type here…"></textarea></div>'
    + '<div class="sheet-foot"><button class="btn" data-close>Cancel</button><button class="btn primary" data-paste disabled>Attach</button></div>', { width: 520 });

  Object.assign(AT.actions, {
    'paste-text': () => {
      const t = AT.inspTarget();
      if (t.view !== 'brief') return;
      const sheet = pasteSheet();
      AT.ui.sheet = sheet;
      const area = Kit.$('textarea', sheet.el);
      const btn = Kit.$('[data-paste]', sheet.el);
      area.addEventListener('input', () => { btn.disabled = !area.value.trim(); });
      btn.addEventListener('click', () => {
        const size = new Blob([area.value]).size;
        sheet.close();
        attachItems([{ name: uniqueName('Pasted note.txt', t.meeting.id), ver: 'v1', size: fmtSize(size), added: 'Today' }], 'Attached');
      });
    },
    'agenda-add': (el) => {
      const slot = el.closest('#agendaAdd');
      slot.innerHTML = `<div class="a-add-field">${icon('plus')}<input class="a-add-input" placeholder="Add an agenda item" maxlength="80"><span class="kbd">↩</span></div>`;
      const input = Kit.$('input', slot);
      input.focus({ preventScroll: true });
      AT.reveal(slot, AT.el.inspScroll, { smooth: true });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commitAgenda(slot, input);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          slot.innerHTML = addButton();
        }
      });
      input.addEventListener('blur', () => {
        if (!input.value.trim() && input.isConnected) slot.innerHTML = addButton();
      });
    },
    'brief-info': (el) => {
      const t = AT.inspTarget();
      if (!t.meeting) return;
      Kit.popover(el.closest('.a-foot') || el, infoMarkup(AT.briefSources(t.meeting.id)), { side: 'top', align: 'end', width: 310 });
    },
    'insp-back': () => {
      const back = AT.state.back;
      if (!back) return;
      AT.set({ inspect: back.inspect, tab: back.tab, back: null, highlight: null });
      AT.syncSelection();
      AT.renderInspector({ animate: true });
    },
    'select-next': () => {
      const id = AT.nextUpId();
      if (id) AT.select(id);
    }
  });

  const commitAgenda = (slot, input) => {
    const text = input.value.trim();
    if (!text) return;
    const id = slot.dataset.meeting;
    const item = { t: text, d: '5m', mine: true };
    AT.set({ agendaAdds: { ...AT.state.agendaAdds, [id]: [...(AT.state.agendaAdds[id] || []), item] } });
    const list = Kit.$('#agendaList');
    const row = Kit.html(agendaRow(item, list.children.length));
    list.appendChild(row);
    Kit.enterAnimated(row);
    const total = AT.briefFor(id).agenda.reduce((n, a) => n + minutesOf(a.d), 0);
    const totalEl = Kit.$('#agendaTotal');
    totalEl.textContent = `${total} min`;
    totalEl.classList.remove('bump');
    void totalEl.offsetWidth;
    totalEl.classList.add('bump');
    input.value = '';
    setTimeout(() => AT.reveal(slot, AT.el.inspScroll, { smooth: true }), 290);
  };

  const infoList = (items, iconName) => items.map((x) => `<li>${iconName === 'file' ? safeBadge(x) : icon(iconName)}<span class="truncate">${esc(x)}</span></li>`).join('');

  const infoMarkup = (src) => '<div class="a-info"><div class="t-eyebrow">Included</div>'
    + `<ul>${infoList(src.included, 'file')}${infoList(src.memory, 'history')}</ul>`
    + (src.omittedDocs.length || src.omittedMemory.length
      ? `<div class="t-eyebrow">Left out</div><ul class="a-info-off">${infoList(src.omittedDocs, 'file')}${infoList(src.omittedMemory, 'minus')}</ul>` : '')
    + `<p class="a-local">${icon('lock', 'sm')}Built on this Mac. Toggle docs in the Docs tab.</p></div>`;

  AT.onDocToggle = (el, checked) => {
    const t = AT.inspTarget();
    if (!t.meeting) return;
    const name = el.dataset.docSwitch;
    AT.set({ docToggles: { ...AT.state.docToggles, [`${t.meeting.id}:${name}`]: checked } });
    updateDocCounts(t.meeting.id);
  };

  AT.inspectorParts = { headerMarkup, purposeSection, kIcon, evAttrs, segMarkup, safeBadge };
})();
