(() => {
  const T = window.T;
  const { esc } = Kit;
  const { toMin, fmtDuration, dayOffset } = T.util;
  const TODAY = T.TODAY;
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
    const before = new Map(Kit.$$('#view [data-row]').map((el) => [el.dataset.row, el.getBoundingClientRect().top]));
    mutate();
    if (Kit.reduceMotion()) return;
    Kit.$$('#view [data-row]').forEach((el) => {
      const top = before.get(el.dataset.row);
      if (top === undefined) return;
      const dy = top - el.getBoundingClientRect().top;
      if (Math.abs(dy) > 0.5) el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 320, easing: Kit.EASE_IN_OUT });
    });
  };
  T.fx = { crossfade, fadeIn, flipRows };

  const isSelected = (id) => {
    const sel = T.state.selection;
    return !!sel && sel.kind === 'event' && sel.id === id;
  };
  const isNext = (ev, dayIndex) => dayIndex === TODAY && ev.id === T.nextUpId();
  const personLine = (names) => (names && names.length ? Kit.avatars(names, 3) : '');
  const standupPeople = () => (DATA.proposals.find((p) => p.id === 'pr-standup') || { people: [] }).people;
  const meetingOf = (ev) => {
    const found = T.findMeeting(ev.meeting);
    return found ? found.meeting : null;
  };
  const countdown = (ev) => {
    const mins = toMin(ev.start) - T.state.nowMin;
    return mins <= 0 ? 'now' : `in ${fmtDuration(mins)}`;
  };

  const eyebrowMarkup = (ev, kind) => {
    if (kind === 'recording') {
      return '<span class="rec-dot"></span><span class="a-live-label">Recording</span><span class="num a-live-time" data-rec-timer>0:00</span><span class="wave a-wave"><i></i><i></i><i></i><i></i><i></i></span>';
    }
    if (T.isStarting(ev.meeting)) return '<span class="a-mini-dot"></span><span class="a-start-label">Starting now</span>';
    return `<span class="a-next-label">Next up</span><span class="a-sep">·</span><span class="num">${countdown(ev)}</span>`;
  };

  const readyChip = (ev) => {
    const m = meetingOf(ev);
    if (m && m.brief) return '<span class="chip accent">Brief ready</span>';
    if (m && dayOffset(m.date) === 1) return '<span class="chip">Brief tonight</span>';
    return `<span class="chip accent">${icon('check')}Tracking</span>`;
  };
  const chipMarkup = (ev, kind) => {
    if ((kind === 'recurring' || kind === 'oneoff') && T.state.recordOnce[ev.id]) return `<span class="chip a-chip-once"><i class="a-mini-dot"></i>Records at ${ev.start}</span>`;
    const proposal = T.state.proposals.find((p) => p.id === ev.proposal);
    const target = proposal && proposal.target ? T.seriesById(proposal.target) : null;
    const chips = {
      ready: () => readyChip(ev),
      preparing: () => '<span class="chip shimmer a-chip-prep">Preparing brief</span>',
      tracking: () => `<span class="chip accent">${icon('check')}Tracking</span>`,
      review: () => `<span class="chip amber num">${T.pending(ev.meeting)} to review</span>`,
      summarizing: () => '<span class="chip shimmer a-chip-prep">Preparing summary…</span>',
      filed: () => `<span class="chip a-chip-filed">${icon('check-circle')}Filed</span>`,
      recurring: () => `<span class="chip dashed">${icon('repeat')}${esc(ev.repeat || '')} · Not tracked</span>`,
      oneoff: () => '<span class="chip dashed">One-off</span>',
      proposal: () => `<span class="chip accent">Part of ${esc(target ? target.name : 'a series')}?</span>`,
      unfiled: () => '<span class="chip amber">Unfiled</span>'
    };
    return chips[kind] ? chips[kind]() : '';
  };

  const whereMarkup = (where) => (where ? `<span class="a-where">${VIRTUAL.test(where) ? icon('video') : ''}${esc(where)}</span>` : '');
  const joinMeta = (bits) => bits.filter(Boolean).join('<span class="a-sep">·</span>');
  const trackedMeta = (ev, kind, s) => {
    const m = meetingOf(ev);
    const n = m && m.n ? `<span class="num">#${m.n}</span>` : '';
    if (m && ['review', 'filed', 'summarizing'].includes(kind) && m.ended) {
      return joinMeta([`<span>Ended ${esc(m.ended)}</span>`, m.duration ? `<span class="num">${esc(m.duration)}</span>` : '', n]);
    }
    const where = whereMarkup(ev.where) || `<span>${esc(ev.calendar || 'Work')} calendar</span>`;
    if (m && ['review', 'filed'].includes(kind) && m.duration) return joinMeta([where, `<span class="num">${esc(m.duration)}</span>`, n]);
    return joinMeta([where, `<span class="a-people">${personLine(ev.people || s.people)}</span>`, n]);
  };
  const unfiledOf = (ev) => T.state.unfiled.find((x) => x.id === ev.unfiled) || DATA.unfiled.find((x) => x.id === ev.unfiled);
  const metaMarkup = (ev, kind, s) => {
    if (kind === 'unfiled' || (kind === 'filed' && ev.state === 'unfiled')) {
      const u = unfiledOf(ev);
      const filed = ev.filedTo ? T.seriesById(ev.filedTo) : null;
      return joinMeta([`<span class="num">${u ? esc(u.duration || '') : ''}</span>`, filed ? `<span>Filed to ${esc(filed.name)}</span>` : `<span>${icon('lock')}Recorded on this Mac</span>`]);
    }
    if (s) return trackedMeta(ev, kind, s);
    if (kind === 'proposal') {
      const p = T.state.proposals.find((x) => x.id === ev.proposal);
      return joinMeta([whereMarkup(ev.where), p ? `<span class="truncate">${esc(p.reason)}</span>` : '']);
    }
    const mins = toMin(ev.end) - toMin(ev.start);
    const people = ev.title === 'Daily Standup' ? standupPeople() : ev.people;
    return joinMeta([whereMarkup(ev.where) || `<span>${esc(ev.calendar || 'Work')} calendar</span>`, `<span class="num">${fmtDuration(mins)}</span>`, `<span class="a-people">${personLine(people)}</span>`]);
  };

  const recordBtn = (ev) => `<button class="btn record sm" data-act="record" data-id="${ev.id}">${icon('record')}Record<span class="kbd">⌘R</span></button>`;
  const stopBtn = (ev) => `<button class="btn record sm" data-act="stop" data-id="${ev.id}">${icon('stop')}Stop<span class="kbd">⌘R</span></button>`;
  const joinBtn = (ev) => (VIRTUAL.test(ev.where || '') ? `<button class="btn sm" data-act="join" data-id="${ev.id}">${icon('video')}Join</button>` : '');
  const skipBtn = (ev) => `<button class="btn sm plain" data-act="skip" data-mid="${ev.meeting}">Skip</button>`;

  const actionsMarkup = (ev, kind, next, past) => {
    if (kind === 'recording') return `${joinBtn(ev)}${stopBtn(ev)}`;
    if (next && T.isStarting(ev.meeting)) return `${skipBtn(ev)}${recordBtn(ev)}`;
    if (next && ['ready', 'preparing', 'tracking'].includes(kind)) return `${joinBtn(ev)}${recordBtn(ev)}`;
    if (kind === 'recurring') return `<span class="a-hover">${T.state.recordOnce[ev.id] ? '' : `<button class="btn sm tinted" data-act="track" data-id="${ev.id}">${icon('plus')}Track</button>`}</span>`;
    if (kind === 'oneoff') {
      const once = past || T.state.recordOnce[ev.id] ? '' : `<button class="btn sm" data-act="record-once" data-id="${ev.id}">${icon('record')}Record once</button>`;
      return `<span class="a-hover"><button class="btn sm tinted" data-act="add-to-series" data-id="${ev.id}">Add to series…</button>${once}</span>`;
    }
    if (kind === 'proposal') return `<button class="btn sm tinted" data-act="proposal-add" data-id="${ev.id}">Add</button><button class="btn sm plain" data-act="proposal-keep" data-id="${ev.id}">Keep separate</button>`;
    if (kind === 'review') return `<span class="a-hover"><button class="btn sm" data-act="open-review" data-id="${ev.id}">Review</button></span>`;
    return '';
  };

  const extraMarkup = (ev, kind) => {
    if (kind !== 'unfiled') return '';
    const u = unfiledOf(ev);
    const s = u && u.suggestion && T.seriesById(u.suggestion.series);
    if (!s || !s.tracked) return '';
    return `<div class="a-suggest">${Kit.seriesIcon(s, 'a-xs')}<span class="a-suggest-text">Looks like <b>${esc(s.name)}</b> — ${esc(u.suggestion.why.charAt(0).toLowerCase() + u.suggestion.why.slice(1))}</span><button class="btn sm tinted" data-act="file" data-id="${ev.id}">File</button></div>`;
  };

  const cardClasses = (ev, kind, s, next, dayIndex) => [
    'a-card card interactive', `k-${kind}`,
    s ? 'is-tracked' : '',
    next ? 'is-next' : '',
    kind === 'recording' ? 'is-live' : '',
    next && T.isStarting(ev.meeting) ? 'is-starting' : '',
    isSelected(ev.id) ? 'is-selected' : '',
    T.isPast(ev, dayIndex) ? 'is-past' : ''
  ].filter(Boolean).join(' ');

  const cardMarkup = (ev, dayIndex) => {
    const kind = T.kindOf(ev);
    const s = T.trackedSeriesOf(ev);
    const next = isNext(ev, dayIndex);
    const purpose = next && s && s.purpose.why ? `<p class="truncate">${esc(s.purpose.why)}</p>` : '';
    return `<article class="${cardClasses(ev, kind, s, next, dayIndex)}" data-id="${ev.id}" data-act="select" style="--c:${s ? s.color : 'transparent'}">`
      + `<div class="a-part a-eyebrow" data-part="eyebrow">${next ? eyebrowMarkup(ev, kind) : ''}</div>`
      + `<div class="a-card-top"><span class="a-title truncate">${esc(ev.title)}</span><span class="a-part a-chip-slot" data-part="chip">${chipMarkup(ev, kind)}</span></div>`
      + `<div class="a-part a-purpose" data-part="purpose">${purpose}</div>`
      + `<div class="a-meta-row"><span class="a-part a-meta" data-part="meta">${metaMarkup(ev, kind, s)}</span><span class="a-part a-actions" data-part="actions">${actionsMarkup(ev, kind, next, T.isPast(ev, dayIndex))}</span></div>`
      + `<div class="a-part a-extra" data-part="extra">${extraMarkup(ev, kind)}</div>`
      + '</article>';
  };

  const personalLabel = (ev) => {
    const cal = T.state.calendars.find((c) => c.name === ev.calendar);
    return cal && cal.watched ? `${esc(ev.title)} · Personal` : 'Personal · Busy';
  };
  const personalMarkup = (ev) => `<div class="a-personal" data-personal="${ev.id}">${icon('lock')}<span>${personalLabel(ev)}</span></div>`;
  T.refreshPersonal = () => Kit.$$('#view [data-personal]').forEach((el) => {
    const ev = T.eventById(el.dataset.personal);
    crossfade(el, `${icon('lock')}<span>${personalLabel(ev)}</span>`);
  });

  const timeMarkup = (ev, dayIndex, withDay) => {
    const top = withDay ? `<span class="a-time-day">${esc(T.dayLabel(dayIndex).split(' ')[0])}</span>` : '';
    return `<div class="a-time">${top}<b class="num">${ev.start}</b><span class="num">${ev.end}</span></div>`;
  };
  const rowMarkup = (ev, dayIndex, { withDay = false } = {}) => {
    const personal = ev.state === 'personal';
    const past = T.isPast(ev, dayIndex) && !['review', 'unfiled'].includes(T.kindOf(ev));
    return `<div class="a-row${past ? ' is-past' : ''}${personal ? ' is-personal' : ''}" data-row="${ev.id}">${timeMarkup(ev, dayIndex, withDay)}${personal ? personalMarkup(ev) : cardMarkup(ev, dayIndex)}</div>`;
  };

  const gapMarkup = (mins) => `<div class="a-gap"><span>${fmtDuration(mins)} free</span></div>`;
  const nowMarkup = () => `<div class="a-now"><span class="a-now-time num">${esc(T.state.clock)}</span><span class="a-now-line"></span></div>`;
  const timelineMarkup = (events, dayIndex) => {
    const now = T.state.nowMin;
    const isToday = dayIndex === TODAY;
    const nowAt = isToday ? events.findIndex((ev) => toMin(ev.end) > now) : -2;
    const parts = [];
    events.forEach((ev, i) => {
      const prev = events[i - 1];
      if (prev && i !== nowAt) {
        const gap = toMin(ev.start) - toMin(prev.end);
        if (gap >= 45) parts.push(gapMarkup(gap));
      }
      if (i === nowAt) parts.push(nowMarkup());
      parts.push(rowMarkup(ev, dayIndex));
    });
    if (isToday && events.length && nowAt === -1) parts.push(nowMarkup());
    return parts.join('');
  };

  const bannerText = (fresh) => {
    const lead = fresh.length === 1 ? 'a new recurring meeting' : `${fresh.length} new recurring meetings`;
    return `<b>Telu found ${lead} in your calendar</b><span class="truncate">${fresh.map((p) => esc(p.title)).join(' · ')}</span>`;
  };
  const bannerMarkup = () => {
    if (T.state.calendar !== 'connected' || T.state.scenario === 'first') return '';
    const fresh = T.state.proposals.filter((p) => p.kind === 'new');
    const hidden = T.state.bannerHidden || !fresh.length;
    return `<div class="a-banner-wrap collapsible${hidden ? ' collapsed' : ''}" id="banner"><div><div class="a-banner">`
      + `<span class="a-banner-icon">${icon('sparkles')}</span><div class="a-banner-text" id="bannerText">${bannerText(fresh)}</div>`
      + '<button class="btn sm tinted" data-act="open-found">Review</button>'
      + `<button class="btn sm plain icon" data-act="hide-banner" data-tip="Hide">${icon('x')}</button></div></div></div>`;
  };
  T.updateBanner = () => {
    const banner = Kit.$('#banner');
    if (!banner) return;
    const fresh = T.state.proposals.filter((p) => p.kind === 'new');
    const hide = T.state.bannerHidden || !fresh.length;
    banner.classList.toggle('collapsed', hide);
    if (!hide) crossfade(Kit.$('#bannerText'), bannerText(fresh));
  };

  const dayMarkup = (dayIndex) => {
    const day = T.state.days[dayIndex];
    const banner = dayIndex === TODAY ? bannerMarkup() : '';
    if (!day.events.length) return `${banner}<div class="empty">${icon('sun', 'xl')}<h3>Nothing scheduled</h3></div>`;
    return `${banner}<div class="a-timeline" data-day="${day.key}">${timelineMarkup(day.events, dayIndex)}</div>`;
  };
  const agendaMarkup = () => {
    const v = T.state.view;
    if (v.kind === 'upcoming') return T.pages.upcomingMarkup();
    if (v.kind === 'review') return T.pages.reviewMarkup();
    if (v.kind === 'found') return T.pages.foundMarkup();
    if (T.state.calendar !== 'connected') return T.pages.firstRunMarkup();
    return dayMarkup(v.dayIndex);
  };

  const afterView = () => {
    T.syncTimers();
    T.syncSelection();
  };
  const slideSwap = (host, markup, direction) => {
    const token = ++T.ui.slideToken;
    host.getAnimations().forEach((a) => a.cancel());
    const out = host.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${-16 * direction}px)` }], { duration: 140, easing: Kit.EASE_OUT, fill: 'forwards' });
    out.finished.then(() => {
      if (token !== T.ui.slideToken) return;
      host.innerHTML = markup;
      T.el.content.scrollTop = 0;
      out.cancel();
      afterView();
      host.animate([{ opacity: 0, transform: `translateX(${16 * direction}px)` }, { opacity: 1, transform: 'none' }], { duration: 220, easing: Kit.EASE_OUT });
    }, () => {});
  };

  T.renderView = ({ direction = 0, stagger = false, keepScroll = false, scroll = 0 } = {}) => {
    if (T.state.view.kind === 'doc') return T.doc.paintPage({ animate: false });
    const host = T.el.view;
    host.className = 'agenda-inner';
    const markup = agendaMarkup();
    if (direction && !Kit.reduceMotion()) return slideSwap(host, markup, direction);
    ++T.ui.slideToken;
    host.getAnimations().forEach((a) => a.cancel());
    const prev = T.el.content.scrollTop;
    host.innerHTML = markup;
    T.el.content.scrollTop = keepScroll ? prev : scroll;
    afterView();
    const timeline = stagger && Kit.$('.a-timeline', host);
    if (timeline) Kit.stagger(timeline, ':scope > *');
    return undefined;
  };

  T.morphCard = (id, { animate = true } = {}) => {
    const old = Kit.$(`#view .a-card[data-id="${id}"]`);
    const ev = T.eventById(id);
    if (!old || !ev) return;
    const fresh = Kit.html(cardMarkup(ev, T.dayOf(id)));
    old.className = fresh.className;
    old.style.cssText = fresh.style.cssText;
    Kit.$$('[data-part]', fresh).forEach((part) => {
      const target = Kit.$(`[data-part="${part.dataset.part}"]`, old);
      if (!target || target.innerHTML === part.innerHTML) return;
      if (animate) crossfade(target, part.innerHTML, T.syncTimers);
      else target.innerHTML = part.innerHTML;
    });
    T.syncTimers();
  };
  T.morphAll = (match) => Kit.$$('#view .a-card[data-id]').forEach((card, i) => {
    const ev = T.eventById(card.dataset.id);
    if (ev && match(ev)) setTimeout(() => T.morphCard(ev.id), i * 40);
  });
  T.morphMeeting = (meetingId) => {
    const ev = T.eventForMeeting(meetingId);
    if (ev) T.morphCard(ev.id);
  };

  T.syncTimers = () => {
    const rec = T.state.recording;
    const els = rec ? Kit.$$('[data-rec-timer]') : [];
    const same = els.length === T.ui.timers.size && els.every((el) => T.ui.timers.has(el));
    if (same) return;
    T.ui.timers.forEach((stop) => stop());
    T.ui.timers.clear();
    if (!rec) return;
    const elapsed = Math.floor((Date.now() - rec.startedAt) / 1000);
    els.forEach((el) => T.ui.timers.set(el, Kit.timer(el, elapsed)));
  };

  T.syncSelection = () => {
    Kit.$$('#view .is-selected').forEach((el) => el.classList.remove('is-selected'));
    const sel = T.state.selection;
    if (!sel) return;
    const el = sel.kind === 'event' ? Kit.$(`#view .a-card[data-id="${sel.id}"]`)
      : sel.kind === 'unfiled' ? Kit.$(`#view .uf-card[data-uid="${sel.id}"]`)
        : Kit.$(`#view .a-card[data-meeting="${sel.id}"]`);
    if (el) el.classList.add('is-selected');
  };

  T.select = (selection, { peek = true, animate = true } = {}) => {
    const wasOpen = T.state.peekOpen;
    T.set({ selection, peekOpen: peek || wasOpen });
    T.syncSelection();
    if (T.state.peekOpen) T.peek.show({ animate: animate && !wasOpen, crossfade: animate && wasOpen });
  };
  const selectionOf = (el) => (el.dataset.id ? { kind: 'event', id: el.dataset.id } : { kind: 'unfiled', id: el.dataset.uid });
  T.selectable = () => Kit.$$('#view .a-card[data-id], #view .uf-card[data-uid]');
  T.moveSelection = (delta) => {
    const items = T.selectable();
    if (!items.length) return;
    const current = items.findIndex((el) => el.classList.contains('is-selected'));
    const index = current < 0 ? (delta > 0 ? 0 : items.length - 1) : Math.min(items.length - 1, Math.max(0, current + delta));
    T.select(selectionOf(items[index]), { peek: T.state.peekOpen, animate: false });
    T.reveal(items[index], T.el.content);
  };
  T.reveal = (el, scroller, { center = false, smooth = false } = {}) => {
    if (!el || !scroller) return;
    const r = el.getBoundingClientRect();
    const s = scroller.getBoundingClientRect();
    const top = s.top + (parseFloat(getComputedStyle(scroller).paddingTop) || 0);
    const delta = center ? r.top - (top + (s.bottom - top) / 2 - r.height / 2)
      : r.top < top + 8 ? r.top - top - 8
        : r.bottom > s.bottom - 8 ? r.bottom - s.bottom + 8 : 0;
    if (delta) scroller.scrollBy({ top: delta, behavior: smooth && !Kit.reduceMotion() ? 'smooth' : 'auto' });
  };

  T.agenda = { rowMarkup, cardMarkup, timelineMarkup, chipMarkup, selectionOf };
})();
