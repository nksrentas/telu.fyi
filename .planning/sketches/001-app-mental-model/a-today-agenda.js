(() => {
  const AT = window.AT;
  const { esc } = Kit;
  const { toMin, fmtDuration } = AT.util;
  const TODAY = AT.TODAY;
  const VIRTUAL = /meet|zoom|teams/i;

  const crossfade = (el, markup, onSwap) => {
    if (Kit.reduceMotion()) {
      el.innerHTML = markup;
      if (onSwap) onSwap();
      return;
    }
    el.getAnimations().forEach((a) => a.cancel());
    const out = el.animate([{ opacity: 1, filter: 'blur(0px)' }, { opacity: 0, filter: 'blur(2px)' }], { duration: 110, easing: 'ease-out', fill: 'forwards' });
    out.onfinish = () => {
      el.innerHTML = markup;
      out.cancel();
      if (onSwap) onSwap();
      el.animate([{ opacity: 0, filter: 'blur(2px)' }, { opacity: 1, filter: 'blur(0px)' }], { duration: 190, easing: Kit.EASE_OUT });
    };
  };

  const fadeIn = (el, { duration = 180, y = 0 } = {}) => {
    if (!el || Kit.reduceMotion()) return;
    el.animate([
      { opacity: 0, filter: 'blur(2px)', transform: `translateY(${y}px)` },
      { opacity: 1, filter: 'blur(0px)', transform: 'none' }
    ], { duration, easing: Kit.EASE_OUT });
  };

  const flipRows = (mutate) => {
    const before = new Map(Kit.$$('#agenda [data-row]').map((el) => [el.dataset.row, el.getBoundingClientRect().top]));
    mutate();
    if (Kit.reduceMotion()) return;
    Kit.$$('#agenda [data-row]').forEach((el) => {
      const top = before.get(el.dataset.row);
      if (top === undefined) return;
      const dy = top - el.getBoundingClientRect().top;
      if (Math.abs(dy) > 0.5) el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 320, easing: Kit.EASE_IN_OUT });
    });
  };

  AT.fx = { crossfade, fadeIn, flipRows };

  const isSelected = (id) => AT.state.inspect && AT.state.inspect.kind === 'event' && AT.state.inspect.id === id;
  const isNext = (ev, dayIndex) => dayIndex === TODAY && ev.id === AT.nextUpId();
  const personLine = (names) => (names && names.length ? Kit.avatars(names, 3) : '');
  const standupPeople = () => (DATA.proposals.find((p) => p.id === 'pr-standup') || { people: [] }).people;

  const countdown = (ev) => {
    const mins = toMin(ev.start) - AT.state.nowMin;
    if (mins <= 0) return 'now';
    return `in ${fmtDuration(mins)}`;
  };

  const eyebrowMarkup = (ev, kind) => {
    if (kind === 'recording') {
      return `<span class="rec-dot"></span><span class="a-live-label">Recording</span><span class="num a-live-time" data-rec-timer>0:00</span><span class="wave a-wave"><i></i><i></i><i></i><i></i><i></i></span>`;
    }
    return `<span class="a-next-label">Next up</span><span class="a-sep">·</span><span class="num">${countdown(ev)}</span>`;
  };

  const recordOnceChip = (ev) => `<span class="chip a-chip-once"><i class="a-mini-dot"></i>Records at ${ev.start}</span>`;

  const chipMarkup = (ev, kind) => {
    if ((kind === 'recurring' || kind === 'oneoff') && AT.state.recordOnce[ev.id]) return recordOnceChip(ev);
    const proposal = AT.state.proposals.find((p) => p.id === ev.proposal);
    const target = proposal && proposal.target ? AT.seriesById(proposal.target) : null;
    const chips = {
      ready: '<span class="chip accent">Brief ready</span>',
      preparing: '<span class="chip shimmer a-chip-prep">Preparing brief</span>',
      tracking: `<span class="chip accent">${icon('check')}Tracking</span>`,
      review: `<span class="chip amber num">${AT.pending(ev.meeting)} to review</span>`,
      summarizing: '<span class="chip shimmer a-chip-prep">Preparing summary…</span>',
      filed: `<span class="chip a-chip-filed">${icon('check-circle')}Filed</span>`,
      recurring: `<span class="chip dashed">${icon('repeat')}${esc(ev.repeat || '')} · Not tracked</span>`,
      oneoff: '<span class="chip dashed">One-off</span>',
      proposal: `<span class="chip accent">Part of ${esc(target ? target.name : 'a series')}?</span>`,
      unfiled: '<span class="chip amber">Unfiled</span>'
    };
    return chips[kind] || '';
  };

  const whereMarkup = (where) => {
    if (!where) return '';
    return `<span class="a-where">${VIRTUAL.test(where) ? icon('video') : ''}${esc(where)}</span>`;
  };

  const joinMeta = (bits) => bits.filter(Boolean).join('<span class="a-sep">·</span>');

  const trackedMeta = (ev, kind, s) => {
    const found = AT.findMeeting(ev.meeting);
    const m = found ? found.meeting : null;
    const n = m && m.n ? `<span class="num">#${m.n}</span>` : '';
    if (m && (kind === 'review' || kind === 'filed' || kind === 'summarizing') && m.ended) {
      return joinMeta([`<span>Ended ${esc(m.ended)}</span>`, m.duration ? `<span class="num">${esc(m.duration)}</span>` : '', n]);
    }
    const where = whereMarkup(ev.where) || `<span>${esc(ev.calendar || 'Work')} calendar</span>`;
    if (m && (kind === 'review' || kind === 'filed') && m.duration) return joinMeta([where, `<span class="num">${esc(m.duration)}</span>`, n]);
    return joinMeta([where, personLine(ev.people || s.people), n]);
  };

  const metaMarkup = (ev, kind, s) => {
    if (kind === 'unfiled' || (kind === 'filed' && ev.state === 'unfiled')) {
      const u = DATA.unfiled.find((x) => x.id === ev.unfiled);
      const filed = ev.filedTo ? AT.seriesById(ev.filedTo) : null;
      return joinMeta([`<span class="num">${u ? esc(u.duration) : ''}</span>`, filed ? `<span>Filed to ${esc(filed.name)}</span>` : `<span>${icon('lock')}Recorded on this Mac</span>`]);
    }
    if (s) return trackedMeta(ev, kind, s);
    if (kind === 'proposal') {
      const p = AT.state.proposals.find((x) => x.id === ev.proposal);
      return joinMeta([whereMarkup(ev.where), p ? `<span class="truncate">${esc(p.reason)}</span>` : '']);
    }
    const mins = toMin(ev.end) - toMin(ev.start);
    const people = ev.title === 'Daily Standup' ? standupPeople() : ev.people;
    return joinMeta([whereMarkup(ev.where) || `<span>${esc(ev.calendar || 'Work')} calendar</span>`, `<span class="num">${fmtDuration(mins)}</span>`, personLine(people)]);
  };

  const recordBtn = (ev) => `<button class="btn record sm" data-act="record" data-id="${ev.id}">${icon('record')}Record<span class="kbd">⌘R</span></button>`;
  const stopBtn = (ev) => `<button class="btn record sm" data-act="stop" data-id="${ev.id}">${icon('stop')}Stop<span class="kbd">⌘R</span></button>`;
  const joinBtn = (ev) => (VIRTUAL.test(ev.where || '') ? `<button class="btn sm" data-act="join" data-id="${ev.id}">${icon('video')}Join</button>` : '');

  const actionsMarkup = (ev, kind, next, past) => {
    if (kind === 'recording') return `${joinBtn(ev)}${stopBtn(ev)}`;
    if (next && ['ready', 'preparing', 'tracking'].includes(kind)) return `${joinBtn(ev)}${recordBtn(ev)}`;
    if (kind === 'recurring') return `<span class="a-hover">${AT.state.recordOnce[ev.id] ? '' : `<button class="btn sm tinted" data-act="track" data-id="${ev.id}">${icon('plus')}Track</button>`}</span>`;
    if (kind === 'oneoff') {
      const once = past || AT.state.recordOnce[ev.id] ? '' : `<button class="btn sm" data-act="record-once" data-id="${ev.id}">${icon('record')}Record once</button>`;
      return `<span class="a-hover"><button class="btn sm tinted" data-act="add-to-series" data-id="${ev.id}">Add to series…</button>${once}</span>`;
    }
    if (kind === 'proposal') return `<button class="btn sm tinted" data-act="proposal-add" data-id="${ev.id}">Add</button><button class="btn sm plain" data-act="proposal-keep" data-id="${ev.id}">Keep separate</button>`;
    if (kind === 'review') return `<span class="a-hover"><button class="btn sm" data-act="open-review" data-id="${ev.id}">Review</button></span>`;
    return '';
  };

  const extraMarkup = (ev, kind) => {
    if (kind !== 'unfiled') return '';
    const u = DATA.unfiled.find((x) => x.id === ev.unfiled);
    const s = u && AT.seriesById(u.suggestion.series);
    if (!s || !s.tracked) return '';
    return `<div class="a-suggest">${Kit.seriesIcon(s, 'a-xs')}<span class="a-suggest-text">Looks like <b>${esc(s.name)}</b> — mentions Dana, SSO</span><button class="btn sm tinted" data-act="file" data-id="${ev.id}">File</button></div>`;
  };

  const cardClasses = (ev, kind, s, next, dayIndex) => [
    'a-card card interactive', `k-${kind}`,
    s ? 'is-tracked' : '',
    next ? 'is-next' : '',
    kind === 'recording' ? 'is-live' : '',
    kind === 'review' || kind === 'unfiled' ? 'is-attn' : '',
    isSelected(ev.id) ? 'is-selected' : '',
    AT.isPast(ev, dayIndex) ? 'is-past' : ''
  ].filter(Boolean).join(' ');

  const cardMarkup = (ev, dayIndex) => {
    const kind = AT.kindOf(ev);
    const s = AT.trackedSeriesOf(ev);
    const next = isNext(ev, dayIndex);
    const purpose = next && s && s.purpose.why ? `<p class="truncate">${esc(s.purpose.why)}</p>` : '';
    return `<article class="${cardClasses(ev, kind, s, next, dayIndex)}" data-id="${ev.id}" data-act="select" style="--c:${s ? s.color : 'transparent'}">`
      + `<div class="a-part a-eyebrow" data-part="eyebrow">${next ? eyebrowMarkup(ev, kind) : ''}</div>`
      + `<div class="a-card-top"><span class="a-title truncate">${esc(ev.title)}</span><span class="a-part a-chip-slot" data-part="chip">${chipMarkup(ev, kind)}</span></div>`
      + `<div class="a-part a-purpose" data-part="purpose">${purpose}</div>`
      + `<div class="a-meta-row"><span class="a-part a-meta" data-part="meta">${metaMarkup(ev, kind, s)}</span><span class="a-part a-actions" data-part="actions">${actionsMarkup(ev, kind, next, AT.isPast(ev, dayIndex))}</span></div>`
      + `<div class="a-part a-extra" data-part="extra">${extraMarkup(ev, kind)}</div>`
      + '</article>';
  };

  const personalMarkup = (ev) => {
    const cal = AT.state.calendars.find((c) => c.name === ev.calendar);
    const label = cal && cal.watched ? `${esc(ev.title)} · Personal` : 'Personal · Busy';
    return `<div class="a-personal" data-personal="${ev.id}">${icon('lock')}<span>${label}</span></div>`;
  };

  const timeMarkup = (ev, dayIndex, withDay) => {
    const top = withDay ? `<span class="a-time-day">${esc(AT.dayLabel(dayIndex).split(' ')[0])}</span>` : '';
    return `<div class="a-time">${top}<b class="num">${ev.start}</b><span class="num">${ev.end}</span></div>`;
  };

  const rowMarkup = (ev, dayIndex, { withDay = false } = {}) => {
    const personal = ev.state === 'personal';
    const past = AT.isPast(ev, dayIndex) && !['review', 'unfiled'].includes(AT.kindOf(ev));
    return `<div class="a-row${past ? ' is-past' : ''}${personal ? ' is-personal' : ''}" data-row="${ev.id}">${timeMarkup(ev, dayIndex, withDay)}${personal ? personalMarkup(ev) : cardMarkup(ev, dayIndex)}</div>`;
  };

  const gapMarkup = (mins) => `<div class="a-gap"><span>${fmtDuration(mins)} free</span></div>`;
  const nowMarkup = () => `<div class="a-now"><span class="a-now-time num">${esc(AT.state.clock)}</span><span class="a-now-line"></span></div>`;

  const timelineMarkup = (events, dayIndex) => {
    const now = AT.state.nowMin;
    const isToday = dayIndex === TODAY;
    const parts = [];
    events.forEach((ev, i) => {
      const prev = events[i - 1];
      if (prev) {
        const from = toMin(prev.end);
        const to = toMin(ev.start);
        const nowInGap = isToday && now >= from && now < to;
        if (to - from >= 45 && !nowInGap) parts.push(gapMarkup(to - from));
        if (nowInGap) parts.push(nowMarkup());
      } else if (isToday && now < toMin(ev.start)) {
        parts.push(nowMarkup());
      }
      parts.push(rowMarkup(ev, dayIndex));
    });
    if (isToday && events.length && now >= toMin(events[events.length - 1].end)) parts.push(nowMarkup());
    return parts.join('');
  };

  const bannerMarkup = () => {
    const fresh = AT.state.proposals.filter((p) => p.kind === 'new');
    if (AT.state.calendar !== 'connected' || AT.state.scenario === 'first') return '';
    const hidden = AT.state.bannerHidden || !fresh.length;
    return `<div class="a-banner-wrap collapsible${hidden ? ' collapsed' : ''}" id="banner"><div><div class="a-banner">`
      + `<span class="a-banner-icon">${icon('sparkles')}</span>`
      + `<div class="a-banner-text" id="bannerText">${bannerText(fresh)}</div>`
      + '<button class="btn sm tinted" data-act="open-proposals">Review</button>'
      + `<button class="btn sm plain icon" data-act="hide-banner" data-tip="Hide">${icon('x')}</button>`
      + '</div></div></div>';
  };

  const bannerText = (fresh) => {
    const lead = fresh.length === 1 ? 'a new recurring meeting' : `${fresh.length} new recurring meetings`;
    return `<b>Telu found ${lead} in your calendar</b><span class="truncate">${fresh.map((p) => esc(p.title)).join(' · ')}</span>`;
  };

  AT.updateBanner = () => {
    const banner = Kit.$('#banner');
    if (!banner) return;
    const fresh = AT.state.proposals.filter((p) => p.kind === 'new');
    const hide = AT.state.bannerHidden || !fresh.length;
    banner.classList.toggle('collapsed', hide);
    if (!hide) crossfade(Kit.$('#bannerText'), bannerText(fresh));
  };

  const dayMarkup = (dayIndex) => {
    const day = AT.state.days[dayIndex];
    const banner = dayIndex === TODAY ? bannerMarkup() : '';
    if (!day.events.length) return `${banner}<div class="empty">${icon('sun', 'xl')}<h3>Nothing scheduled</h3></div>`;
    return `${banner}<div class="a-timeline" data-day="${day.key}">${timelineMarkup(day.events, dayIndex)}</div>`;
  };

  const mainMarkup = () => {
    const st = AT.state;
    if (st.view === 'series' && AT.seriesById(st.seriesId)) return AT.views.seriesMarkup(AT.seriesById(st.seriesId));
    if (st.view === 'upcoming') return AT.views.upcomingMarkup();
    if (st.view === 'review') return AT.views.reviewMarkup();
    if (st.calendar !== 'connected') return AT.views.firstRunMarkup();
    return dayMarkup(st.dayIndex);
  };

  const slideSwap = (host, markup, direction) => {
    const token = ++AT.ui.slideToken;
    host.getAnimations().forEach((a) => a.cancel());
    const out = host.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${-16 * direction}px)` }], { duration: 140, easing: Kit.EASE_OUT, fill: 'forwards' });
    out.finished.then(() => {
      if (token !== AT.ui.slideToken) return;
      host.innerHTML = markup;
      AT.ui.scroller.scrollTop = 0;
      out.cancel();
      afterMain();
      host.animate([{ opacity: 0, transform: `translateX(${16 * direction}px)` }, { opacity: 1, transform: 'none' }], { duration: 220, easing: Kit.EASE_OUT });
    }, () => {});
  };

  const afterMain = () => {
    if (AT.views && AT.views.afterRender) AT.views.afterRender();
    AT.syncTimers();
  };

  AT.renderMain = ({ direction = 0, stagger = false, keepScroll = false } = {}) => {
    const host = AT.el.agendaInner;
    const markup = mainMarkup();
    if (direction && !Kit.reduceMotion()) return slideSwap(host, markup, direction);
    ++AT.ui.slideToken;
    host.getAnimations().forEach((a) => a.cancel());
    const scroll = AT.ui.scroller.scrollTop;
    host.innerHTML = markup;
    AT.ui.scroller.scrollTop = keepScroll ? scroll : 0;
    afterMain();
    if (stagger) {
      const timeline = Kit.$('.a-timeline', host);
      if (timeline) Kit.stagger(timeline, ':scope > *');
    }
  };

  AT.morphCard = (id, { animate = true } = {}) => {
    const old = Kit.$(`#agenda .a-card[data-id="${id}"]`);
    const ev = AT.eventById(id);
    if (!old || !ev) return;
    const fresh = Kit.html(cardMarkup(ev, AT.dayOf(id)));
    old.className = fresh.className;
    old.style.cssText = fresh.style.cssText;
    Kit.$$('[data-part]', fresh).forEach((part) => {
      const target = Kit.$(`[data-part="${part.dataset.part}"]`, old);
      if (!target || target.innerHTML === part.innerHTML) return;
      if (animate) crossfade(target, part.innerHTML, AT.syncTimers);
      else target.innerHTML = part.innerHTML;
    });
    AT.syncTimers();
  };

  AT.morphAll = (match) => {
    Kit.$$('#agenda .a-card[data-id]').forEach((card, i) => {
      const ev = AT.eventById(card.dataset.id);
      if (ev && match(ev)) setTimeout(() => AT.morphCard(ev.id), i * 40);
    });
  };

  AT.syncTimers = () => {
    const rec = AT.state.recording;
    const els = rec ? Kit.$$('[data-rec-timer]') : [];
    const same = els.length === AT.ui.timers.size && els.every((el) => AT.ui.timers.has(el));
    if (same) return;
    AT.ui.timers.forEach((stop) => stop());
    AT.ui.timers.clear();
    if (!rec) return;
    const elapsed = Math.floor((Date.now() - rec.startedAt) / 1000);
    els.forEach((el) => AT.ui.timers.set(el, Kit.timer(el, elapsed)));
  };

  AT.syncSelection = () => {
    Kit.$$('#agenda .a-card.is-selected, #agenda .a-mrow.is-selected').forEach((el) => el.classList.remove('is-selected'));
    const insp = AT.state.inspect;
    if (!insp) return;
    const ev = insp.kind === 'event' ? AT.eventById(insp.id) : null;
    const meetingId = insp.kind === 'meeting' ? insp.id : ev && ev.meeting;
    [
      ev ? Kit.$(`#agenda .a-card[data-id="${ev.id}"]`) : null,
      meetingId ? Kit.$(`#agenda .a-mrow[data-meeting="${meetingId}"]`) : null
    ].filter(Boolean).forEach((el) => el.classList.add('is-selected'));
  };

  AT.select = (id, { animate = true, tab = null } = {}) => {
    AT.set({ inspect: id ? { kind: 'event', id } : null, back: null, tab, highlight: null });
    AT.syncSelection();
    AT.renderInspector({ animate });
  };

  AT.selectMeeting = (meetingId, { animate = true, tab = null, highlight = null, back = null } = {}) => {
    const ev = AT.eventForMeeting(meetingId);
    const inspect = ev ? { kind: 'event', id: ev.id } : { kind: 'meeting', id: meetingId };
    AT.set({ inspect, tab, highlight, back });
    AT.syncSelection();
    AT.renderInspector({ animate });
  };

  AT.selectable = () => Kit.$$('#agenda .a-card[data-id], #agenda .a-mrow[data-meeting]');

  AT.moveSelection = (delta) => {
    const items = AT.selectable();
    if (!items.length) return;
    const current = items.findIndex((el) => el.classList.contains('is-selected'));
    const index = current < 0 ? (delta > 0 ? 0 : items.length - 1) : Math.min(items.length - 1, Math.max(0, current + delta));
    const target = items[index];
    if (target.dataset.id) AT.select(target.dataset.id, { animate: false });
    else AT.selectMeeting(target.dataset.meeting, { animate: false });
    AT.reveal(target, AT.ui.scroller);
  };

  AT.agenda = { rowMarkup, cardMarkup, timelineMarkup, chipMarkup };
})();
