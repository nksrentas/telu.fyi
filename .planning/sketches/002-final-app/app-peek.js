(() => {
  const T = window.T;
  const D = T.doc;
  const { esc } = Kit;
  const VIEW_FOR_KIND = {
    ready: 'next', preparing: 'next', recording: 'next', summarizing: 'next', tracking: 'tracking',
    review: 'past', filed: 'past', proposal: 'proposal', recurring: 'untracked', oneoff: 'untracked', unfiled: 'unfiled'
  };
  const UNFILED_LINES = [
    { t: '00:42', who: 'You', text: 'Quick one before I forget — Dana says the SSO metadata is almost ready.' },
    { t: '03:15', who: 'You', text: 'They also want the audit logs exported monthly, not weekly.' },
    { t: '06:50', who: 'You', text: 'Follow up with Sam on whether that changes the retention plan.' }
  ];

  const unfiledFor = (id) => T.state.unfiled.find((x) => x.id === id) || DATA.unfiled.find((x) => x.id === id) || null;
  const meetingTarget = (id) => {
    const found = T.findMeeting(id);
    if (!found) return null;
    const m = found.meeting;
    const live = D.isLive(found.series, m) || D.isPreparing(found.series, m);
    return { key: `m:${m.id}`, view: T.util.isUpcoming(m) || live ? 'next' : 'past', series: found.series, meeting: m, ev: T.eventForMeeting(m.id) };
  };
  const eventTarget = (id) => {
    const ev = T.eventById(id);
    if (!ev || ev.state === 'personal') return null;
    const kind = T.kindOf(ev);
    const found = T.findMeeting(ev.meeting);
    const isUnfiled = ev.state === 'unfiled';
    const series = found ? found.series : T.trackedSeriesOf(ev);
    const view = isUnfiled ? 'unfiled' : VIEW_FOR_KIND[kind] || 'untracked';
    const usable = (view === 'next' || view === 'past') && !(series && series.tracked && found) ? 'untracked' : view;
    return {
      key: `e:${ev.id}`, view: usable, kind: usable === 'untracked' && kind === 'recording' ? (ev.repeat ? 'recurring' : 'oneoff') : kind, ev, dayIndex: T.dayOf(ev.id),
      series, meeting: found ? found.meeting : null, u: isUnfiled ? unfiledFor(ev.unfiled) : null
    };
  };
  T.peekTarget = () => {
    const sel = T.state.selection;
    if (!sel) return null;
    if (sel.kind === 'unfiled') {
      const u = unfiledFor(sel.id);
      return u ? { key: `u:${u.id}`, view: 'unfiled', u, series: null, meeting: null, ev: null } : null;
    }
    return sel.kind === 'meeting' ? meetingTarget(sel.id) : eventTarget(sel.id);
  };

  const dayText = (t) => (t.ev ? T.dayLabel(t.dayIndex === undefined ? T.dayOf(t.ev.id) : t.dayIndex) : t.meeting ? t.meeting.date : '');
  const timeText = (t) => (t.ev ? `${t.ev.start}–${t.ev.end}` : t.meeting ? t.meeting.time : '');
  const peopleOf = (t) => {
    if (t.ev && t.ev.people) return t.ev.people;
    if (t.ev && t.ev.title === 'Daily Standup') return (DATA.proposals.find((p) => p.id === 'pr-standup') || { people: [] }).people;
    return t.series ? t.series.people : [];
  };
  const seriesLink = (t) => {
    const s = t.series;
    if (s && s.tracked) return `<button class="pk-series" data-act="open-doc" data-series="${s.id}">${Kit.seriesIcon(s, 'a-xs')}<span class="truncate">${esc(s.name)}</span>${icon('chevron-right')}</button>`;
    if (t.view === 'unfiled') return `<span class="pk-series static">${icon('tray')}<span>Needs filing</span></span>`;
    const cal = t.ev && t.ev.calendar;
    return `<span class="pk-series static">${icon('calendar')}<span>${esc(cal ? `${cal} calendar` : 'Calendar')}</span></span>`;
  };
  const headerMarkup = (t) => {
    const s = t.series;
    const canOpen = !!(s && s.tracked && t.view !== 'unfiled');
    const title = t.view === 'unfiled' ? t.u.title : T.meetingTitle(s, t.meeting, t.ev);
    const n = t.meeting && t.meeting.n && t.view !== 'unfiled' ? `<span class="pk-n num">#${t.meeting.n}</span>` : '';
    const where = (t.ev && t.ev.where) || (t.meeting && t.meeting.where);
    const meta = t.view === 'unfiled' ? [t.u.when, t.u.duration] : [dayText(t), timeText(t), where];
    const people = t.view === 'unfiled' ? [] : peopleOf(t);
    return `<div class="pk-bar">${seriesLink(t)}<span class="spacer"></span>`
      + (canOpen ? `<button class="btn sm plain pk-open" data-act="peek-open-page">${icon('arrow-up-right')}Open as page</button>` : '')
      + `<button class="btn sm plain icon" data-act="peek-close" data-tip="Close · esc">${icon('x')}</button></div>`
      + `<header class="pk-head"><h2 class="pk-title"><span>${esc(title)}</span>${n}</h2>`
      + `<div class="pk-meta"><span class="pk-when">${meta.filter(Boolean).map(esc).join('<span class="a-sep">·</span>')}</span>${people.length ? Kit.avatars(people, 4) : ''}</div></header>`;
  };

  const noteCard = (iconName, title, text, action = '') => `<div class="a-note-card">${icon(iconName)}<div><b>${title}</b><p>${text}</p>${action}</div></div>`;
  const trackingBody = (t) => noteCard('check-circle', `Telu is tracking ${esc(t.series.name)}`, 'The first brief arrives the evening before the next one. A purpose helps Telu know what matters.',
    `<button class="btn sm tinted pk-note-btn" data-act="open-doc" data-series="${t.series.id}">Open ${esc(t.series.name)}</button>`);
  const untrackedBody = (t) => {
    const ev = t.ev;
    const recurring = t.kind === 'recurring';
    const past = T.isPast(ev, t.dayIndex);
    const once = T.state.recordOnce[ev.id];
    const primary = recurring
      ? `<button class="btn primary" data-act="track" data-id="${ev.id}">${icon('plus')}Track this series</button>`
      : `<button class="btn primary" data-act="add-to-series" data-id="${ev.id}">Add to series…</button>`;
    const recordingNow = !!T.state.recording && T.state.recording.eventId === ev.id;
    const record = past || recordingNow ? '' : `<button class="btn" data-act="record-once" data-id="${ev.id}">${once ? 'Don’t record' : `${icon('record')}Record once`}</button>`;
    const copy = recurring
      ? `It repeats ${esc((ev.repeat || '').toLowerCase())} in your ${esc(ev.calendar || 'Work')} calendar. Track it and Telu prepares a brief before each one — and remembers what was decided.`
      : 'A one-off event. Add it to a series to get a brief, or record it once — nothing else is kept.';
    const live = recordingNow ? T.oneOffLiveMarkup() : '';
    return `${live}<div class="empty pk-empty"><span class="a-empty-badge">${icon(recurring ? 'repeat' : 'calendar', 'xl')}</span>`
      + `<h3>Telu isn’t tracking ${esc(ev.title)}</h3><p>${copy}</p>${once ? `<p class="a-once">${icon('record')}Records once at ${ev.start}</p>` : ''}<div class="a-empty-actions">${primary}${record}</div></div>`;
  };
  const proposalBody = (t) => {
    const p = T.state.proposals.find((x) => x.id === t.ev.proposal);
    const target = p && T.seriesById(p.target);
    if (!target) return untrackedBody({ ...t, kind: 'oneoff' });
    return `<div class="a-prop-card card"><div class="a-prop-kind">${icon('sparkles')}Telu found a likely match</div>`
      + `<div class="a-prop-target">${Kit.seriesIcon(target)}<div><b>${esc(target.name)}</b><span>${esc(target.rule)}</span></div></div>`
      + `<p class="muted">${esc(p.reason)}. Adding it gives this session the ${esc(target.name)} brief and files what’s decided into the same memory.</p>`
      + `<div class="a-empty-actions a-left"><button class="btn primary" data-act="proposal-add" data-id="${t.ev.id}">Add to ${esc(target.name)}</button>`
      + `<button class="btn" data-act="proposal-keep" data-id="${t.ev.id}">Keep separate</button></div></div>`;
  };
  const filingCard = (u) => {
    const target = u.suggestion ? T.seriesById(u.suggestion.series) : null;
    const suggest = target && target.tracked
      ? `<div class="uf-suggest">${Kit.seriesIcon(target)}<span>Telu thinks this belongs in <b>${esc(target.name)}</b> — ${esc(u.suggestion.why.charAt(0).toLowerCase() + u.suggestion.why.slice(1))}</span></div>` : '';
    const play = u.kind === 'recording' ? `<span class="spacer"></span><button class="btn sm plain" data-act="play">${icon('play')}Play</button>` : '';
    return `<div class="card uf-card pk-uf" data-uid="${esc(u.id)}">${suggest}<div class="uf-actions">${suggest ? `<button class="btn sm primary" data-act="file-there">${icon('tray-down')}File there</button>` : ''}<button class="btn sm" data-act="file-choose">Choose…</button>${play}</div></div>`;
  };
  const unfiledBody = (t) => {
    const u = t.u;
    const filedTo = t.ev && t.ev.filedTo ? T.seriesById(t.ev.filedTo) : null;
    const pending = T.state.unfiled.some((x) => x.id === u.id);
    const top = filedTo || !pending
      ? noteCard('check-circle', `Filed${filedTo ? ` to ${esc(filedTo.name)}` : ''}`, `Telu will use it in the next ${esc(filedTo ? filedTo.name : 'series')} brief.`)
      : filingCard(u);
    const lines = u.kind === 'recording'
      ? `<section class="pk-sec"><div class="sec-head"><span class="sec-eyebrow">Transcript</span><span class="sec-caption">${icon('lock', 'sm')}Transcribed on this Mac</span></div><div class="pk-tr-body">${D.transcriptLines(u.meeting ? T.transcriptOf(T.seriesById(u.suggestion.series) || { meetings: [], people: [] }, u.meeting) : UNFILED_LINES)}</div></section>`
      : `<section class="pk-sec"><div class="sec-head"><span class="sec-eyebrow">File</span></div>${D.docButton(u.title, u.when)}</section>`;
    return `<div class="pk-unfiled" data-uid="${esc(u.id)}">${top}${lines}</div>`;
  };
  const BODY = {
    next: (t) => D.nextMarkup(t.series, t.meeting, { surface: 'peek' }),
    past: (t) => D.peekPastMarkup(t.series, t.meeting),
    tracking: trackingBody,
    untracked: untrackedBody,
    proposal: proposalBody,
    unfiled: unfiledBody
  };

  const contentMarkup = (t) => `${headerMarkup(t)}<div class="pk-body doc-surface" data-surface="peek">${BODY[t.view](t)}</div>`;

  const openPanel = (animate) => {
    const el = T.el.peek;
    if (!animate || Kit.reduceMotion()) {
      el.classList.add('instant');
      el.classList.add('open');
      void el.offsetWidth;
      requestAnimationFrame(() => el.classList.remove('instant'));
    } else {
      el.classList.remove('instant');
      el.classList.add('open');
    }
    T.el.main.classList.add('peek-open');
  };
  const closePanel = (animate) => {
    const el = T.el.peek;
    el.classList.toggle('instant', !animate || Kit.reduceMotion());
    el.classList.remove('open');
    T.el.main.classList.remove('peek-open');
    if (!animate) requestAnimationFrame(() => el.classList.remove('instant'));
  };

  const maybePrepare = (t) => {
    const m = t.meeting;
    if (!m || m.status !== 'preparing' || T.state.prepared[m.id]) return;
    T.set({ prepared: { ...T.state.prepared, [m.id]: true } });
    T.later(() => {
      T.mapMeeting(m.id, (x) => ({ ...x, status: 'upcoming', preparedNow: true }));
      T.morphMeeting(m.id);
      Kit.$$(`#win .next[data-mid="${m.id}"]`).forEach((block) => D.paintNextBlock(block, { animate: true }));
      T.island('refresh');
    }, 2600);
  };

  const render = ({ crossfade = false, keepScroll = false } = {}) => {
    const t = T.peekTarget();
    if (!t) return false;
    const content = Kit.$('#pkContent');
    const scroller = Kit.$('#pkScroll');
    const scroll = scroller.scrollTop;
    const markup = contentMarkup(t);
    T.ui.peekKey = t.key;
    const after = () => {
      scroller.scrollTop = keepScroll ? scroll : 0;
      T.syncTimers();
    };
    if (crossfade && !Kit.reduceMotion()) T.fx.crossfade(content, markup, after);
    else {
      content.getAnimations().forEach((a) => a.cancel());
      content.innerHTML = markup;
      after();
    }
    maybePrepare(t);
    return true;
  };

  const show = ({ animate = true, crossfade = false } = {}) => {
    const t = T.peekTarget();
    if (!t) return close({ animate });
    const same = t.key === T.ui.peekKey && T.el.peek.classList.contains('open');
    render({ crossfade: crossfade && !same, keepScroll: same });
    T.set({ peekOpen: true });
    if (!T.el.peek.classList.contains('open')) openPanel(animate);
    return undefined;
  };
  const close = ({ animate = true } = {}) => {
    T.set({ peekOpen: false });
    closePanel(animate);
    T.ui.peekKey = null;
  };
  const hideForPage = () => {
    closePanel(false);
    T.ui.peekKey = null;
  };
  const refresh = ({ crossfade = false } = {}) => {
    if (!T.state.peekOpen || T.state.view.kind === 'doc' || !T.el.peek.classList.contains('open')) return;
    const t = T.peekTarget();
    if (!t) return close();
    render({ crossfade: crossfade || t.key !== T.ui.peekKey, keepScroll: t.key === T.ui.peekKey });
  };
  const shows = (id) => {
    if (!T.state.peekOpen || T.state.view.kind === 'doc') return false;
    const t = T.peekTarget();
    return !!t && ((t.meeting && t.meeting.id === id) || (t.ev && t.ev.id === id) || (t.u && t.u.id === id));
  };
  T.peek = { show, close, hideForPage, refresh, shows, render };

  T.wirePeek = () => {
    const scroller = Kit.$('#pkScroll');
    scroller.addEventListener('scroll', () => T.el.peek.classList.toggle('pk-scrolled', scroller.scrollTop > 2), { passive: true });
  };

  Object.assign(T.actions, {
    select: (el) => {
      const sel = T.state.selection;
      if (sel && sel.kind === 'event' && sel.id === el.dataset.id && T.state.peekOpen) return;
      T.select({ kind: 'event', id: el.dataset.id });
    },
    'select-unfiled': (el) => {
      const sel = T.state.selection;
      if (sel && sel.kind === 'unfiled' && sel.id === el.dataset.uid && T.state.peekOpen) return;
      T.select({ kind: 'unfiled', id: el.dataset.uid });
    },
    'peek-close': () => close(),
    'peek-open-page': () => {
      const t = T.peekTarget();
      if (!t || !t.series) return;
      const reveal = t.view === 'next' ? { next: true } : t.meeting ? { mid: t.meeting.id } : null;
      T.set({ peekOpen: false });
      T.openDoc(t.series.id, { reveal });
    },
    'open-review': (el) => T.select({ kind: 'event', id: el.dataset.id })
  });
})();
