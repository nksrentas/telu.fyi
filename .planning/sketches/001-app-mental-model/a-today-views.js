(() => {
  const AT = window.AT;
  const { esc } = Kit;
  const { plural, toMin } = AT.util;
  const GROUPS = [['decision', 'Decisions'], ['commitment', 'Commitments'], ['question', 'Open questions'], ['fact', 'Facts']];
  const CADENCES = ['Weekly', 'Every 2 weeks', 'Monthly', 'Daily'];
  const COUNT_TIP = { decisions: 'decision', actions: 'action', questions: 'question' };
  const COUNT_TYPE = { decisions: 'decision', actions: 'commitment', questions: 'question' };

  const headerMarkup = (s) => {
    const linked = s.source === 'calendar' && s.calendar;
    const chips = `<span class="chip">${icon('repeat')}${esc(s.rule)}</span>`
      + (linked ? `<span class="chip">${icon('link')}Calendar · ${esc(s.calendar)}</span>` : `<span class="chip">${icon('pencil')}Manual series</span>`)
      + (s.count ? `<span class="chip num">${plural(s.count, 'meeting')} since ${esc(s.since)}</span>` : '<span class="chip">New</span>');
    const people = s.people.length ? `<div class="a-sv-people">${Kit.avatars(s.people, 6)}<span class="muted truncate">${esc(s.people.join(', '))}</span></div>` : '';
    return `<header class="a-sv-head">${Kit.seriesIcon(s, 'lg')}<div class="a-sv-titles"><h1 class="t-title1 a-sv-name" id="svName">${esc(s.name)}</h1>`
      + `<div class="a-sv-chips">${chips}</div>${people}</div>`
      + `<div class="a-sv-actions"><button class="btn" data-act="edit-purpose" data-series="${s.id}">${icon('pencil')}Edit purpose<span class="kbd">⌘E</span></button>`
      + `<button class="btn icon" data-act="series-menu" data-series="${s.id}" data-tip="More">${icon('ellipsis')}</button></div></header>`;
  };

  const purposeCard = (s) => {
    const p = s.purpose;
    const head = '<div class="a-sec-head"><span class="t-eyebrow">Purpose</span><span class="spacer"></span>'
      + `<span class="a-ver num">v${p.version} · Edited ${esc(p.edited)} by ${esc(p.by)}</span>`
      + `<button class="btn sm plain a-edit" data-act="edit-purpose" data-series="${s.id}">${icon('pencil')}Edit</button></div>`;
    if (!p.why && !p.outcomes.length) {
      return `<section class="card a-sv-purpose">${head}<p class="a-sv-empty">No purpose yet. Write why this meeting exists and Telu shapes every brief around it.</p></section>`;
    }
    const outcomes = p.outcomes.map((o) => `<li>${icon('check')}<span>${esc(o)}</span></li>`).join('');
    const agenda = p.agenda.map((a) => `<li><span class="truncate">${esc(a.t)}</span><span class="faint num">${esc(a.d)}</span></li>`).join('');
    return `<section class="card a-sv-purpose">${head}<p class="a-sv-why selectable">${esc(p.why)}</p><div class="a-sv-grid">`
      + `<div><div class="a-sv-label">What good looks like</div><ul class="a-sv-outcomes">${outcomes}</ul></div>`
      + `<div><div class="a-sv-label">Standing agenda</div><ol class="a-sv-agenda">${agenda}</ol></div></div>`
      + (p.notFor ? `<div class="a-sv-notfor"><div class="a-sv-label">Not for this meeting</div><p>${esc(p.notFor)}</p></div>` : '')
      + '</section>';
  };

  const memorySection = (s) => {
    const groups = GROUPS.map(([type, label]) => [label, s.memory.filter((k) => k.type === type)]).filter(([, items]) => items.length);
    const body = groups.length
      ? groups.map(([label, items]) => `<div class="a-mem-group"><div class="a-sv-label">${label}<span class="faint num">${items.length}</span></div><ul class="a-klist">${items.map((k) => AT.memoryItem(k, s)).join('')}</ul></div>`).join('')
      : '<p class="a-sv-empty">Nothing remembered yet. After the first meeting, decisions, commitments and open questions land here — each with its evidence.</p>';
    return `<section class="a-sv-sec"><div class="a-sv-sec-head"><h2>Memory</h2><span class="faint num">${s.memory.length || ''}</span><span class="spacer"></span>`
      + `<span class="a-local">${icon('lock', 'sm')}On this Mac</span></div><div class="card a-sv-card">${body}</div></section>`;
  };

  const compactCounts = (counts) => Object.keys(COUNT_TYPE).filter((key) => counts[key])
    .map((key) => `<span class="a-cc" data-tip="${plural(counts[key], COUNT_TIP[key])}"><span class="ktype" data-type="${COUNT_TYPE[key]}">${icon(COUNT_TYPE[key])}</span>${counts[key]}</span>`).join('');

  const rowStatus = (m) => {
    const pending = AT.pending(m.id);
    if (m.status === 'cancelled') return `<span class="a-mstatus">${esc(m.note || 'Cancelled')}</span>`;
    if (pending) return `<span class="chip amber num">${pending} to review</span>`;
    if (m.status === 'preparing') return '<span class="chip accent">Preparing</span>';
    if (m.status === 'upcoming') return '<span class="chip accent">Upcoming</span>';
    return `<span class="a-mstatus">${icon('check-circle')}Filed</span>`;
  };

  const meetingRow = (m) => {
    const insp = AT.state.inspect;
    const ev = AT.eventForMeeting(m.id);
    const selected = insp && ((insp.kind === 'meeting' && insp.id === m.id) || (ev && insp.kind === 'event' && insp.id === ev.id));
    const counts = m.counts && m.status !== 'cancelled' ? compactCounts(m.counts) : '';
    const title = m.title ? `<span class="a-mtitle truncate">${esc(m.title)}</span>` : '';
    return `<div class="a-mrow${m.status === 'cancelled' ? ' is-cancelled' : ''}${selected ? ' is-selected' : ''}" data-act="select-meeting" data-meeting="${m.id}">`
      + `<span class="a-mdate">${esc(m.date)}</span><span class="a-mnum num">${m.n ? `#${m.n}` : ''}</span>${title}`
      + `<span class="a-mdur num">${esc(m.duration || m.time)}</span><span class="a-mcounts">${counts}</span><span class="spacer"></span>${rowStatus(m)}</div>`;
  };

  const meetingsSection = (s) => `<section class="a-sv-sec"><div class="a-sv-sec-head"><h2>Meetings</h2><span class="faint num">${s.meetings.length || ''}</span></div>`
    + `<div class="card a-sv-card a-mlist">${s.meetings.length ? s.meetings.map(meetingRow).join('') : '<p class="a-sv-empty">No meetings yet — the first one shows up here.</p>'}</div></section>`;

  const seriesMarkup = (s) => `<div class="a-sv">${headerMarkup(s)}${purposeCard(s)}${memorySection(s)}${meetingsSection(s)}</div>`;

  const daySection = (title, sub, dayIndex, events, withDay = false) => `<section class="a-day"><div class="a-day-head"><h2>${esc(title)}</h2><span>${esc(sub)}</span></div>`
    + `<div class="a-timeline">${events.map((ev) => AT.agenda.rowMarkup(ev, dayIndex, { withDay })).join('')}</div></section>`;

  const emptyList = (iconName, title, text) => `<div class="a-first"><div class="empty"><span class="a-empty-badge">${icon(iconName, 'xl')}</span><h3>${title}</h3><p>${text}</p></div></div>`;

  const upcomingMarkup = () => {
    if (AT.state.calendar !== 'connected') return emptyList('calendar', 'Nothing upcoming yet', 'Connect your calendar and the next few days show up here.');
    const byStart = (a, b) => toMin(a.start) - toMin(b.start);
    const extras = AT.extraEvents();
    const days = [
      { title: 'Tomorrow', sub: AT.state.days[2].long, dayIndex: 2, events: AT.state.days[2].events },
      ...AT.EXTRA_DAYS.map((d, i) => ({ title: d.label, sub: d.long, dayIndex: 3 + i, events: extras.filter((e) => e.day === 3 + i).sort(byStart) }))
    ].filter((d) => d.events.length);
    return `<div class="a-list">${days.map((d) => daySection(d.title, d.sub, d.dayIndex, d.events)).join('')}</div>`;
  };

  const reviewMarkup = () => {
    const items = AT.state.days.flatMap((d, dayIndex) => d.events.map((ev) => ({ ev, dayIndex, kind: AT.kindOf(ev) })));
    const toReview = items.filter((x) => x.kind === 'review');
    const unfiled = items.filter((x) => x.kind === 'unfiled');
    if (!toReview.length && !unfiled.length) return emptyList('check-circle', 'All caught up', 'Everything Telu found has been reviewed and filed.');
    const section = (title, sub, list) => (list.length ? `<section class="a-day"><div class="a-day-head"><h2>${title}</h2><span>${sub}</span></div>`
      + `<div class="a-timeline">${list.map((x) => AT.agenda.rowMarkup(x.ev, x.dayIndex, { withDay: true })).join('')}</div></section>` : '');
    return `<div class="a-list">${section('To review', 'Accept, correct or reject what Telu found', toReview)}${section('Unfiled', 'Recordings that don’t belong to a series yet', unfiled)}</div>`;
  };

  const firstRunMarkup = () => {
    const denied = AT.state.calendar === 'denied';
    const primary = denied
      ? '<button class="btn primary" data-act="open-settings">Open System Settings</button>'
      : `<button class="btn primary" data-act="connect">${icon('calendar')}Connect Calendar</button>`;
    const copy = denied
      ? 'Telu can’t see your meetings, so it can’t prepare briefs. Turn access on in System Settings — or add a series by hand.'
      : 'Telu reads events on this Mac to prepare a brief for each recurring meeting. Nothing leaves your Mac.';
    return `<div class="a-first"><div class="empty"><span class="a-empty-badge a-badge-lg${denied ? ' is-off' : ''}">${icon('calendar', 'xl')}</span>`
      + `<h3>${denied ? 'Calendar access is off' : 'Bring in your calendar'}</h3><p>${copy}</p>`
      + `<div class="a-empty-actions">${primary}<button class="btn" data-act="new-series" data-align="start">Add a series manually</button></div>`
      + `<p class="a-local">${icon('lock', 'sm')}Processed on this Mac</p></div></div>`;
  };

  const ruleFor = (cadence, rule) => {
    const day = (rule.match(/\b(Mon|Tue|Wed|Thu|Fri)\b/) || [null, 'Tue'])[1];
    const time = rule.includes('·') ? rule.split('·').pop().trim() : '';
    const lead = { Weekly: `Every ${day}`, 'Every 2 weeks': `Every other ${day}`, Monthly: `First ${day}`, Daily: 'Every weekday' }[cadence];
    return time ? `${lead} · ${time}` : lead;
  };

  const refreshSeries = () => {
    AT.renderSidebar();
    AT.updateToolbar();
    AT.renderMain({ keepScroll: true });
    AT.renderInspector();
  };

  const startRename = (s) => {
    const el = Kit.$('#svName');
    if (!el) return;
    el.contentEditable = 'true';
    el.classList.add('is-editing');
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    getSelection().removeAllRanges();
    getSelection().addRange(range);
    const finish = (save) => {
      el.removeEventListener('keydown', onKey);
      el.removeEventListener('blur', onBlur);
      const name = el.textContent.replace(/\s+/g, ' ').trim();
      if (!save || !name || name === s.name) return refreshSeries();
      AT.mapSeries(s.id, (x) => ({ ...x, name }));
      refreshSeries();
      Kit.toast(`Renamed to ${esc(name)}`, { icon: 'pencil' });
    };
    const onKey = (e) => {
      if (e.key === 'Enter') { e.preventDefault(); finish(true); }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(false); }
    };
    const onBlur = () => finish(true);
    el.addEventListener('keydown', onKey);
    el.addEventListener('blur', onBlur);
  };

  const cadenceMenu = (trigger, s) => Kit.menu(trigger, [{ title: 'Repeats' }, ...CADENCES.map((c) => ({
    label: c, icon: c === s.cadence ? 'check' : undefined,
    onSelect: () => {
      AT.mapSeries(s.id, (x) => ({ ...x, cadence: c, rule: ruleFor(c, x.rule) }));
      refreshSeries();
      Kit.toast(`${esc(s.name)} now repeats ${esc(c.toLowerCase())}`, { icon: 'repeat' });
    }
  }))], { align: 'end' });

  const unlink = (s) => {
    const before = { source: s.source, calendar: s.calendar };
    AT.mapSeries(s.id, (x) => ({ ...x, source: 'manual', calendar: null }));
    refreshSeries();
    Kit.toast('Unlinked — new calendar events won’t join this series', {
      icon: 'link',
      action: { label: 'Undo', onClick: () => { AT.mapSeries(s.id, (x) => ({ ...x, ...before })); refreshSeries(); } }
    });
  };

  const merge = async (s, other) => {
    const answer = await Kit.alert({
      title: `Merge ${esc(s.name)} into ${esc(other.name)}?`,
      message: 'Meetings and memory move into one series. Future events from both land there.',
      buttons: [{ label: 'Cancel', value: 'cancel' }, { label: 'Merge', value: 'merge', primary: true }]
    });
    if (answer !== 'merge') return;
    AT.mapSeries(other.id, (x) => ({ ...x, memory: [...x.memory, ...s.memory], meetings: [...x.meetings, ...s.meetings], count: x.count + s.count }));
    AT.mapSeries(s.id, (x) => ({ ...x, tracked: false, memory: [], meetings: [] }));
    AT.mapEvents((e) => e.series === s.id, (e) => ({ ...e, series: other.id }));
    AT.set({ view: 'series', seriesId: other.id });
    refreshSeries();
    AT.updateCounts();
    Kit.toast(`Merged into ${esc(other.name)}`, { icon: 'check-circle' });
  };

  const mergeMenu = (trigger, s) => Kit.menu(trigger, [{ title: 'Merge into' }, ...AT.tracked().filter((x) => x.id !== s.id).map((x) => ({
    label: esc(x.name), swatch: x.color, onSelect: () => merge(s, x)
  }))], { align: 'end' });

  AT.confirmStopTracking = async (id) => {
    const s = AT.seriesById(id);
    if (!s) return;
    const answer = await Kit.alert({
      title: `Stop tracking ${esc(s.name)}?`,
      message: 'Telu keeps its memory and past meetings, but won’t prepare briefs for new ones.',
      buttons: [{ label: 'Cancel', value: 'cancel' }, { label: 'Stop Tracking', value: 'stop', primary: true }]
    });
    if (answer !== 'stop') return;
    AT.mapSeries(id, (x) => ({ ...x, tracked: false }));
    if (AT.state.view === 'series' && AT.state.seriesId === id) AT.set({ view: 'day', seriesId: null, dayIndex: AT.TODAY });
    AT.dropSeriesRow(id);
    AT.updateToolbar();
    AT.renderMain({ keepScroll: true });
    AT.renderInspector({ animate: true });
    AT.updateCounts();
    const undo = () => {
      AT.mapSeries(id, (x) => ({ ...x, tracked: true }));
      refreshSeries();
      AT.updateCounts();
    };
    Kit.toast(`Stopped tracking ${esc(s.name)}`, { icon: 'x-circle', action: { label: 'Undo', onClick: undo } });
  };

  Object.assign(AT.actions, {
    'select-meeting': (el) => AT.selectMeeting(el.dataset.meeting),
    'series-menu': (el) => {
      const s = AT.seriesById(el.dataset.series);
      Kit.menu(el, [
        { label: 'Rename…', icon: 'pencil', onSelect: () => startRename(s) },
        { label: 'Change cadence…', icon: 'repeat', onSelect: () => cadenceMenu(el, s) },
        { label: 'Unlink from calendar', icon: 'link', disabled: s.source !== 'calendar', onSelect: () => unlink(s) },
        { label: 'Merge with…', icon: 'folder', onSelect: () => mergeMenu(el, s) },
        '-',
        { label: 'Stop tracking', icon: 'x-circle', danger: true, onSelect: () => AT.confirmStopTracking(s.id) }
      ], { align: 'end', minWidth: 220 });
    },
    'open-settings': () => Kit.toast('Opens Privacy & Security › Calendars', { icon: 'lock' })
  });

  AT.views = { seriesMarkup, upcomingMarkup, reviewMarkup, firstRunMarkup, afterRender: () => {} };
})();
