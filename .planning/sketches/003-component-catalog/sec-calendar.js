(() => {
  const { esc } = Catalog;
  const U = T.util;
  const EASE = 'cubic-bezier(0.23, 1, 0.32, 1)';
  const timed = new WeakSet();

  const scene = (id, render, setup) => Catalog.withScenario(id, () => {
    T.set({ selection: null });
    if (setup) setup();
    return render();
  });
  const ev = (id) => T.eventById(id);
  const forceOn = (markup, needle = '<article') => markup.replace(needle, `${needle} data-force`);
  const col = (inner, cls = '') => `<div class="cal-col${cls ? ` ${cls}` : ''}">${inner}</div>`;
  const replayBtn = (label = 'Replay') => `<button class="btn sm cal-replay" data-replay>${icon('play')}${esc(label)}</button>`;
  const onReplay = (canvas, run) => canvas.querySelectorAll('[data-replay]').forEach((btn) => btn.addEventListener('click', () => run(btn)));
  const later = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const startTimers = (root, from = DATA.live.elapsed) => root.querySelectorAll('[data-rec-timer]').forEach((el) => {
    if (timed.has(el)) return;
    timed.add(el);
    Kit.timer(el, from);
  });

  const morph = (card, markup, from = DATA.live.elapsed) => {
    const fresh = Kit.html(markup);
    card.className = fresh.className;
    card.style.cssText = fresh.style.cssText;
    Kit.$$('[data-part]', fresh).forEach((part) => {
      const target = Kit.$(`[data-part="${part.dataset.part}"]`, card);
      if (!target || target.innerHTML === part.innerHTML) return;
      T.fx.crossfade(target, part.innerHTML, () => startTimers(card, from));
    });
  };
  const flipRows = (root, mutate) => {
    const rows = () => Kit.$$('[data-row]', root);
    const before = new Map(rows().map((el) => [el.dataset.row, el.getBoundingClientRect().top]));
    mutate();
    if (Kit.reduceMotion()) return;
    rows().forEach((el) => {
      const top = before.get(el.dataset.row);
      if (top === undefined) return;
      const dy = top - el.getBoundingClientRect().top;
      if (Math.abs(dy) > 0.5) el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 320, easing: Kit.EASE_IN_OUT });
    });
  };
  const slideSwap = (host, markup, direction, state, after) => {
    const token = ++state.token;
    host.getAnimations().forEach((a) => a.cancel());
    const swap = () => {
      host.innerHTML = markup;
      if (after) after();
    };
    if (!direction || Kit.reduceMotion()) return swap();
    const out = host.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${-16 * direction}px)` }], { duration: 140, easing: Kit.EASE_OUT, fill: 'forwards' });
    return out.finished.then(() => {
      if (token !== state.token) return;
      swap();
      out.cancel();
      host.animate([{ opacity: 0, transform: `translateX(${16 * direction}px)` }, { opacity: 1, transform: 'none' }], { duration: 220, easing: Kit.EASE_OUT });
    }, () => {});
  };

  const menuItem = (item) => {
    if (item === '-') return '<div class="menu-sep"></div>';
    if (item.title) return `<div class="menu-title">${item.title}</div>`;
    const lead = item.icon ? icon(item.icon) : item.swatch ? `<span class="series-dot" style="--c:${item.swatch}"></span>` : '';
    return `<div class="menu-item ${item.danger ? 'danger' : ''} ${item.disabled ? 'disabled' : ''}${item.active ? ' active' : ''}" role="menuitem">${lead}<span class="truncate">${item.label}</span>${item.kbd ? `<span class="kbd">${item.kbd}</span>` : ''}</div>`;
  };
  const menuMarkup = (items, minWidth) => `<div class="menu" role="menu" tabindex="-1"${minWidth ? ` style="min-width: ${minWidth}px;"` : ''}>${items.map(menuItem).join('')}</div>`;

  const titleBar = (b, span) => `<div class="toolbar-title a-tb-title"><b>${esc(b)}</b><span>${esc(span)}</span></div>`;
  const stepper = ({ prev = true, next = true, force = '' } = {}) => {
    const f = (key) => (force === key ? ' data-force' : '');
    return '<div class="glass-group">'
      + `<button class="btn icon" data-act="day-prev" data-tip="Previous day"${prev ? '' : ' disabled'}${f('prev')}>${icon('chevron-left')}</button>`
      + `<button class="btn" data-act="day-today"${f('today')}>Today</button>`
      + `<button class="btn icon" data-act="day-next" data-tip="Next day"${next ? '' : ' disabled'}${f('next')}>${icon('chevron-right')}</button></div>`;
  };
  const toolbar = ({ b, span, capsule = '', prev = true, next = true }) => `${titleBar(b, span)}<div class="a-rec-slot">${capsule}</div><span class="spacer"></span>${stepper({ prev, next })}`
    + `<div class="glass-group"><button class="btn a-new-btn" data-act="new-series">${icon('plus')}New<span class="kbd">⌥⌘N</span></button>`
    + `<span class="sep"></span><button class="btn icon" data-act="search" data-tip="Search">${icon('search')}</button></div><i class="a-progress"></i>`;
  const strip = (inner, cls = '') => `<div class="t-app cal-strip${cls ? ` ${cls}` : ''}"><section class="main"><div class="toolbar" data-mode="agenda">${inner}</div></section></div>`;
  const frame = (bar, body, height = 720) => `<div class="t-app cal-frame" style="height: ${height}px;"><section class="main"><div class="toolbar" data-mode="agenda">${bar}</div><div class="content"><div class="agenda-inner">${body}</div></div></section></div>`;
  const wireFrame = (canvas) => {
    const content = Kit.$('.content', canvas);
    if (content) Kit.scrollEdge(content, Kit.$('.toolbar', canvas));
  };

  const titleFor = (kind, dayIndex = T.TODAY) => {
    if (kind === 'review') {
      const n = T.reviewCount();
      return ['Review', n ? `${n} ${n === 1 ? 'item needs' : 'items need'} a look` : 'All caught up'];
    }
    if (kind === 'found') {
      const n = T.foundCount();
      return ['Found in Calendar', n ? `${n} ${n === 1 ? 'suggestion' : 'suggestions'} · decide once` : 'Nothing new'];
    }
    if (kind === 'upcoming') return ['Upcoming', 'Next few days'];
    return [T.state.days[dayIndex].label, T.state.days[dayIndex].long];
  };

  const bannerText = (fresh) => {
    const lead = fresh.length === 1 ? 'a new recurring meeting' : `${fresh.length} new recurring meetings`;
    return `<b>Telu found ${lead} in your calendar</b><span class="truncate">${fresh.map((p) => esc(p.title)).join(' · ')}</span>`;
  };
  const banner = (fresh, hidden = false) => `<div class="a-banner-wrap collapsible${hidden ? ' collapsed' : ''}"><div><div class="a-banner">`
    + `<span class="a-banner-icon">${icon('sparkles')}</span><div class="a-banner-text">${bannerText(fresh)}</div>`
    + '<button class="btn sm tinted" data-act="open-found">Review</button>'
    + `<button class="btn sm plain icon" data-act="hide-banner" data-tip="Hide">${icon('x')}</button></div></div></div>`;
  const freshNew = () => T.state.proposals.filter((p) => p.kind === 'new');
  const nowLine = (clock) => `<div class="a-now"><span class="a-now-time num">${esc(clock)}</span><span class="a-now-line"></span></div>`;
  const gapLine = (mins) => `<div class="a-gap"><span>${U.fmtDuration(mins)} free</span></div>`;
  const dayBody = (dayIndex, hidden = false) => {
    const day = T.state.days[dayIndex];
    const top = dayIndex === T.TODAY ? banner(freshNew(), hidden) : '';
    if (!day.events.length) return `${top}<div class="empty">${icon('sun', 'xl')}<h3>Nothing scheduled</h3></div>`;
    return `${top}<div class="a-timeline" data-day="${day.key}">${T.agenda.timelineMarkup(day.events, dayIndex)}</div>`;
  };

  const wireDays = (canvas, sc = 'before') => {
    const state = { day: T.TODAY, hidden: false, token: 0 };
    const host = Kit.$('.agenda-inner', canvas);
    const main = Kit.$('.main', canvas);
    const paint = () => scene(sc, () => {
      const [b, span] = titleFor('day', state.day);
      Kit.$('.a-tb-title b', canvas).textContent = b;
      Kit.$('.a-tb-title span', canvas).textContent = span;
      Kit.$('[data-act="day-prev"]', canvas).disabled = state.day === 0;
      Kit.$('[data-act="day-next"]', canvas).disabled = state.day === T.state.days.length - 1;
      return dayBody(state.day, state.hidden);
    });
    const step = (target) => {
      if (target === state.day || target < 0 || target > 2) return;
      const dir = Math.sign(target - state.day);
      state.day = target;
      slideSwap(host, paint(), dir, state, () => { Kit.$('.content', canvas).scrollTop = 0; });
    };
    const select = (card) => {
      Kit.$$('.a-card.is-selected', canvas).forEach((el) => el.classList.remove('is-selected'));
      card.classList.add('is-selected');
    };
    const ACTS = {
      'day-prev': () => step(state.day - 1),
      'day-next': () => step(state.day + 1),
      'day-today': () => step(T.TODAY),
      'hide-banner': (el) => {
        state.hidden = true;
        el.closest('.a-banner-wrap').classList.add('collapsed');
        Kit.toast('Hidden — they’re waiting in Found in Calendar', { icon: 'sparkles', container: main });
      },
      select
    };
    canvas.addEventListener('click', (event) => {
      const el = event.target.closest('[data-act]');
      if (el && !el.disabled && ACTS[el.dataset.act]) ACTS[el.dataset.act](el);
    });
    wireFrame(canvas);
    return { step, state };
  };

  const attachProposal = () => {
    const e = ev('w2');
    const meeting = { id: `acme-${e.id}`, n: null, title: e.title, date: T.dayInfo(2).date, time: `${e.start}–${e.end}`, status: 'upcoming', where: e.where || null };
    T.mapSeries('acme', (s) => ({ ...s, meetings: T.insertUpcoming(s.meetings, meeting) }));
    T.mapEvents((x) => x.id === e.id, (x) => ({ ...x, series: 'acme', meeting: meeting.id }));
    T.set({ proposals: T.state.proposals.filter((p) => p.id !== e.proposal) });
  };
  const SET = {
    standup: () => T.addStandupSeries(),
    summarizing: () => T.set({ recording: null, summarizing: { meetingId: 'ps-37', seriesId: 'product-sync' } }),
    reviewed: (mid) => () => T.mapMeeting(mid, (m) => ({ ...m, candidates: (m.candidates || []).map((c) => ({ ...c, state: 'accepted' })) })),
    once: (id) => () => T.set({ recordOnce: { ...T.state.recordOnce, [id]: true } }),
    select: (id) => () => T.set({ selection: { kind: 'event', id } }),
    clock: (time) => () => T.set({ clock: time, nowMin: U.toMin(time) }),
    joined: attachProposal,
    separate: () => T.set({ proposals: T.state.proposals.filter((p) => p.id !== 'pr-acme-sso') }),
    filed: () => T.set(T.withFiled(T.state, 'u-rec', 'acme')),
    noMatch: () => T.set({ unfiled: T.state.unfiled.map((u) => (u.id === 'u-rec' ? { ...u, suggestion: null } : u)) }),
    watched: () => T.set({ calendars: T.state.calendars.map((c) => ({ ...c, watched: true })) }),
    retitle: (id, title) => () => T.mapEvents((x) => x.id === id, (x) => ({ ...x, title })),
    skipped: () => T.set({ starting: null })
  };

  const cardHtml = ({ id, day = 1, sc = 'before', setup, row = false, withDay = false, force = false, needle }) => scene(sc, () => {
    const markup = row ? T.agenda.rowMarkup(ev(id), day, { withDay }) : T.agenda.cardMarkup(ev(id), day);
    return force ? forceOn(markup, needle) : markup;
  }, setup);
  const cardStory = (label, note, opts = {}) => ({
    label, note, span: opts.span || 2, force: opts.force, bg: opts.bg,
    html: () => col(cardHtml({ ...opts, force: Boolean(opts.force) }), opts.cls) + (opts.replay ? replayBtn(opts.replay) : ''),
    mount: opts.mount
  });
  const morphStory = (label, note, from, to) => ({
    label, note, span: 2,
    html: () => col(cardHtml(from)) + replayBtn(),
    mount: (canvas) => onReplay(canvas, async () => {
      const cardEl = () => Kit.$('.a-card', canvas);
      cardEl().outerHTML = cardHtml(from);
      startTimers(canvas);
      await later(420);
      morph(cardEl(), cardHtml(to));
    })
  });

  const CHIP_KINDS = [
    { label: 'ready', id: 't4' },
    { label: 'ready · tomorrow', id: 'w3' },
    { label: 'ready · later', id: 'x-dr-15' },
    { label: 'tracking', id: 't1', setup: SET.standup },
    { label: 'preparing', id: 't5' },
    { label: 'summarizing', id: 't2', sc: 'live', setup: SET.summarizing },
    { label: 'review', id: 'm2' },
    { label: 'filed', id: 'm3', setup: SET.filed },
    { label: 'recurring', id: 'w1' },
    { label: 'oneoff', id: 't6' },
    { label: 'record once', id: 't6', setup: SET.once('t6') },
    { label: 'proposal', id: 'w2' },
    { label: 'unfiled', id: 'm3' }
  ];
  const chipList = () => `<div class="cal-chips">${CHIP_KINDS.map((k) => scene(k.sc || 'before', () => {
    const e = ev(k.id);
    return `<small>${esc(k.label)}</small><span>${T.agenda.chipMarkup(e, T.kindOf(e))}</span>`;
  }, k.setup)).join('')}</div>`;

  const HEADER_ROWS = [
    { label: 'Today', note: 'Day view · the default', title: () => titleFor('day', 1) },
    { label: 'Yesterday', note: 'After ‹', title: () => titleFor('day', 0) },
    { label: 'Tomorrow', note: 'After ›', title: () => titleFor('day', 2) },
    { label: 'Upcoming', note: 'Upcoming page', title: () => titleFor('upcoming') },
    { label: 'Review', note: 'Review page · count of items that need a look', title: () => titleFor('review') },
    { label: 'Review · empty', note: 'Nothing left to review', title: () => ['Review', 'All caught up'] },
    { label: 'Found in Calendar', note: 'Found page · suggestion count', title: () => titleFor('found') },
    { label: 'Found · empty', note: 'Every suggestion decided', title: () => ['Found in Calendar', 'Nothing new'] }
  ];
  const STEP_ROWS = [
    { label: 'Today', prev: true, next: true },
    { label: 'Yesterday', prev: false, next: true },
    { label: 'Tomorrow', prev: true, next: false },
    { label: 'No calendar', prev: false, next: false }
  ];
  const STEP_COLS = [{ label: 'Rest' }, { label: 'Hover · Today', force: 'hover', on: 'today' }, { label: 'Pressed · Today', force: 'active', on: 'today' }, { label: 'Focus · Today', force: 'focus', on: 'today' }];

  window.CatCal = {
    scene, ev, forceOn, col, replayBtn, onReplay, later, startTimers, morph, flipRows, slideSwap, menuMarkup,
    titleBar, stepper, toolbar, strip, frame, wireFrame, titleFor, banner, bannerText, freshNew, nowLine, gapLine, dayBody, wireDays, cardHtml, SET, EASE
  };

  Catalog.section({
    id: 'calendar',
    eyebrow: 'Layer 3 · Today, Upcoming',
    title: 'Calendar',
    intro: 'The agenda: a day timeline of event cards with a time column, the now line and free gaps, the toolbar’s day header, stepper and recording capsule, the proposals banner, and the flows that start from a card. Every tile calls 002’s own markup functions against a scenario state.',
    css: `
      .cal-col { width: 100%; min-width: 0; }
      .cal-col.narrow { width: 400px; max-width: 100%; container: agenda / inline-size; }
      .cal-agenda { width: 100%; min-width: 0; container: agenda / inline-size; }
      .cal-strip { width: 100%; height: var(--toolbar-h); display: flex; border-radius: 10px; overflow: hidden; box-shadow: 0 0 0 0.5px var(--hairline); }
      .cal-strip.narrow { width: 300px; }
      .cal-strip > .main, .cal-frame > .main { box-shadow: none; }
      .cal-frame { display: flex; width: 100%; overflow: hidden; }
      .cat-canvas:has(> .cal-replay) { padding-top: 48px; }
      .cat-canvas.flush:has(> .cal-replay) { padding-top: 42px; }
      .cal-replay { position: absolute; top: 9px; right: 10px; z-index: 60; }
      .cal-chips { display: grid; grid-template-columns: max-content max-content; gap: 8px 18px; align-items: center; }
      .cal-chips > small { font: 11px var(--font-mono); color: var(--label-3); }
      .cal-stack { position: relative; }
      .cal-over { position: absolute; z-index: 200; }
      .cal-ghost { display: inline-block; border-radius: 10px; box-shadow: var(--shadow-float); background: var(--glass-strong); }
      .cal-row-flex { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: center; gap: 18px; }
      .cal-center { position: absolute; inset: 0; display: grid; align-content: center; justify-items: center; gap: 12px; padding: 24px 48px; }
      .cal-center > .cal-col { max-width: 560px; }
      .cal-fly-src { display: flex; flex-direction: column; gap: 12px; padding: 64px 28px 24px; }
    `,
    components: [
      {
        id: 'day-header',
        name: 'DayHeader',
        summary: 'The toolbar title of the agenda: the day’s relative name over its long date. The same two-line title names the Upcoming, Review and Found in Calendar pages with a live count.',
        mapsTo: 'Plain component in the toolbar (h1 + subtitle); text only',
        usedIn: ['Agenda toolbar · Today', 'Upcoming', 'Review', 'Found in Calendar'],
        source: '002 app-shell.js agendaToolbar · titleFor · .toolbar-title.a-tb-title',
        props: [['title', 'string (Yesterday | Today | Tomorrow | page name)', 'Today'], ['subtitle', 'string (long date | page count)', '—']],
        states: ['day', 'page with count', 'page empty', 'truncated'],
        tokens: ['--label', '--label-2', '--font'],
        motion: 'None of its own: the text swaps instantly on day change while the timeline below slides (see DayStepper). Trigger → n/a · Reduced motion → n/a · framer-motion → none.',
        a11y: 'Render the title as the page heading (h1) with the date as its description; announce day changes with an aria-live="polite" region on the title.',
        stories: [
          ...HEADER_ROWS.map((r) => ({
            label: r.label, note: r.note, span: 2,
            html: () => scene('before', () => { const [b, span] = r.title(); return strip(titleBar(b, span)); })
          })),
          { label: 'Truncation', note: 'Narrow toolbar · title and date ellipsize', span: 2, html: () => scene('before', () => { const [b, span] = titleFor('found'); return strip(`${titleBar(b, span)}<span class="spacer"></span>${stepper()}`, 'narrow'); }) }
        ]
      },
      {
        id: 'day-stepper',
        name: 'DayStepper',
        summary: 'Glass capsule group: previous day, Today, next day. The chevrons disable at the ends of the loaded range and when no calendar is connected; Today is always enabled.',
        mapsTo: 'Toolbar button group (shadcn Button × 3 in a glass container) with Radix Tooltip on the chevrons',
        usedIn: ['Agenda toolbar'],
        source: '002 app-shell.js agendaToolbar #stepper · T.stepDay · T.goToday · app-agenda.js slideSwap',
        props: [['canPrev', 'boolean', 'true'], ['canNext', 'boolean', 'true'], ['onPrev / onToday / onNext', '() => void', '—']],
        states: ['rest', 'hover', 'pressed', 'focus', 'prev disabled', 'next disabled', 'both disabled'],
        tokens: ['--glass-strong', '--glass-edge', '--glass-rim', '--fill-2', '--label'],
        motion: 'Trigger: ‹ / › / Today click (the ←/→ keys step without animation) → the agenda view slides. Properties: opacity + translateX; exit 1→0 and 0→−16px·dir, enter 0→1 and +16px·dir→0 (dir = +1 forward, −1 back). Duration: exit 140ms (fill forwards), enter 220ms. Easing: --ease-out cubic-bezier(0.23, 1, 0.32, 1) for both. Mechanism: WAAPI Element.animate on the view host; interruptible — each step cancels running animations and a slide token drops a stale swap; scroll resets to top on swap. Buttons: scale(0.97) on press, 140ms --ease-out (CSS transition). Reduced motion: instant swap, no slide. framer-motion: <AnimatePresence mode="wait" custom={dir}> keyed by day, variants enter {opacity: 0, x: 16 * dir} → center {opacity: 1, x: 0, transition: {duration: 0.22, ease: [0.23, 1, 0.32, 1]}} → exit {opacity: 0, x: -16 * dir, transition: {duration: 0.14, ease: [0.23, 1, 0.32, 1]}}.',
        a11y: 'role="group" aria-label="Day"; chevrons are icon buttons with aria-label "Previous day" / "Next day" (tooltips repeat them); disabled buttons use the disabled attribute; ←/→ step days when focus is not in a text field.',
        stories: [
          Catalog.table({
            label: 'Range × states', note: 'Hover, pressed and focus forced on Today; disabled chevrons at the range ends', bg: 'wallpaper', rowHead: 'Showing',
            rows: STEP_ROWS, cols: STEP_COLS,
            render: (r, c) => stepper({ prev: r.prev, next: r.next, force: c.on || '' })
          }),
          { label: 'Hover · chevron', note: 'Previous day with its tooltip trigger', bg: 'wallpaper', force: 'hover', html: stepper({ force: 'prev' }) },
          { label: 'In the toolbar', note: 'DayHeader · stepper · New · search', span: 3, html: () => scene('before', () => strip(toolbar({ b: 'Today', span: 'Tuesday, 29 September' }))) },
          {
            label: 'Live · slides between days', note: 'Click ‹ Today › · Replay steps forward and back', span: 'full', flush: true,
            html: () => scene('before', () => frame(toolbar({ b: 'Today', span: 'Tuesday, 29 September' }), dayBody(T.TODAY), 560)) + replayBtn(),
            mount: (canvas) => {
              const days = wireDays(canvas);
              onReplay(canvas, async () => {
                days.step(T.TODAY + 1);
                await later(900);
                days.step(T.TODAY);
              });
            }
          }
        ]
      },
      {
        id: 'proposals-banner',
        name: 'ProposalsBanner',
        summary: 'Accent-tinted banner at the top of Today when the calendar scan finds new recurring meetings. Review opens Found in Calendar; × hides it until something new appears.',
        mapsTo: 'Custom banner inside Radix Collapsible (shadcn Alert styling) · lucide Sparkles, X',
        usedIn: ['Today'],
        source: '002 app-agenda.js bannerMarkup · bannerText · T.updateBanner · .a-banner',
        props: [['proposals', 'Proposal[] (kind "new")', '—'], ['hidden', 'boolean', 'false'], ['onReview', '() => void', '—'], ['onHide', '() => void', '—']],
        states: ['several found', 'one found', 'hover Review', 'hover hide', 'collapsed', 'narrow (subtitle hidden)'],
        tokens: ['--accent-softer', '--accent-soft', '--accent', '--accent-strong', '--label-2'],
        motion: 'Hide (× or the last proposal decided) → .collapsible.collapsed: grid-template-rows 1fr→0fr 260ms --ease-out + opacity 1→0 200ms ease (CSS transition, reversible mid-flight). Count change → text crossfade: out opacity 1→0 + blur 0→2px 110ms ease-out (fill forwards), swap, in opacity 0→1 + blur 2px→0 190ms --ease-out (WAAPI via T.fx.crossfade; cancels a running crossfade). Hide also shows a toast. Reduced motion: rows snap (only opacity transitions survive), text swaps instantly. framer-motion: <AnimatePresence initial={false}>{show && <motion.div initial={{height: 0, opacity: 0}} animate={{height: "auto", opacity: 1}} exit={{height: 0, opacity: 0}} transition={{height: {duration: 0.26, ease: [0.23, 1, 0.32, 1]}, opacity: {duration: 0.2}}}/>}; text: <AnimatePresence mode="wait"> keyed by count with opacity + filter blur(2px).',
        a11y: 'role="status" so a new find is announced; Review is a button; × is an icon button aria-label="Hide" (tooltip "Hide"); the collapsed wrapper gets aria-hidden and inert.',
        stories: [
          { label: '2 found', note: 'Before · Growth Review · Daily Standup', span: 2, html: () => scene('before', () => col(banner(freshNew()))) },
          { label: '1 found', note: 'After Daily Standup was tracked', span: 2, html: () => scene('before', () => col(banner(freshNew())), SET.standup) },
          { label: 'Hover · Review', span: 2, force: 'hover', html: () => scene('before', () => col(forceOn(banner(freshNew()), 'data-act="open-found"'))) },
          { label: 'Hover · Hide', span: 2, force: 'hover', html: () => scene('before', () => col(forceOn(banner(freshNew()), 'data-act="hide-banner"'))) },
          {
            label: 'Hide · collapse', note: 'Replay toggles the real .collapsed class', span: 2, height: 120,
            html: () => scene('before', () => col(banner(freshNew()))) + replayBtn(),
            mount: (canvas) => onReplay(canvas, async () => {
              const wrap = Kit.$('.a-banner-wrap', canvas);
              wrap.classList.add('collapsed');
              await later(900);
              wrap.classList.remove('collapsed');
            })
          },
          {
            label: 'Count change · crossfade', note: 'Replay: 2 found → 1 found → back (T.fx.crossfade)', span: 2,
            html: () => scene('before', () => col(banner(freshNew()))) + replayBtn(),
            mount: (canvas) => onReplay(canvas, async () => {
              const text = Kit.$('.a-banner-text', canvas);
              T.fx.crossfade(text, scene('before', () => bannerText(freshNew()), SET.standup));
              await later(1200);
              T.fx.crossfade(text, scene('before', () => bannerText(freshNew())));
            })
          },
          { label: 'Narrow agenda', note: 'Container ≤ 520px hides the titles line', span: 2, html: () => scene('before', () => col(banner(freshNew()), 'narrow')) }
        ]
      },
      {
        id: 'now-line',
        name: 'NowLine',
        summary: 'Coral hairline with the current time in the time column. Sits above the first event that hasn’t ended yet (or after the last one) on today only.',
        mapsTo: 'Plain component (grid row aligned to the time column)',
        usedIn: ['Today timeline'],
        source: '002 app-agenda.js nowMarkup · timelineMarkup · .a-now',
        props: [['time', 'string (H:MM)', 'now']],
        states: ['before a meeting', 'at start', 'during', 'after'],
        tokens: ['--coral', '--a-time-w'],
        motion: 'None: re-renders in place when the clock or scenario changes (no transition). Reduced motion → n/a · framer-motion → none (optionally layout for position changes).',
        a11y: 'Decorative for sighted users; expose the time as visually hidden text “Now, 9:41” so screen readers get the position in the list.',
        stories: [
          ...[['Before · 9:41', '9:41'], ['Starting · 10:00', '10:00'], ['Live · 10:12', '10:12'], ['After · 10:46', '10:46']].map(([label, clock]) => ({ label, span: 2, html: col(nowLine(clock)) })),
          { label: 'In context', note: 'Between the past standup and the next meeting', span: 'full', html: () => scene('before', () => col(`<div class="a-timeline">${T.agenda.rowMarkup(ev('t1'), 1)}${nowLine(T.state.clock)}${T.agenda.rowMarkup(ev('t2'), 1)}</div>`)) }
        ]
      },
      {
        id: 'free-gap',
        name: 'FreeGap',
        summary: 'Dashed divider with the free time between two events. Only for gaps of 45 minutes or more, and never directly where the now line sits.',
        mapsTo: 'Plain component',
        usedIn: ['Today timeline', 'Yesterday', 'Tomorrow'],
        source: '002 app-agenda.js gapMarkup · timelineMarkup · .a-gap',
        props: [['minutes', 'number (≥ 45)', '—']],
        states: ['minutes', 'hours', 'hours + minutes'],
        tokens: ['--label-3', '--separator', '--a-time-w'],
        motion: 'None. Reduced motion → n/a · framer-motion → none.',
        a11y: 'Plain text (“1 h 15 min free”); the dashed rule is decorative (aria-hidden).',
        stories: [
          ...[45, 60, 75].map((mins) => ({ label: U.fmtDuration(mins), span: 2, html: col(gapLine(mins)) })),
          { label: 'In context', note: 'Product Sync · 1 h 15 min free · Lunch', span: 'full', html: () => scene('before', () => col(`<div class="a-timeline">${T.agenda.rowMarkup(ev('t2'), 1)}${gapLine(75)}${T.agenda.rowMarkup(ev('t3'), 1)}</div>`)) }
        ]
      },
      {
        id: 'event-card',
        name: 'EventCard',
        summary: 'One calendar event on the timeline. Its kind (derived from the event, its series and the scenario) drives the chip, meta line, actions and the series colour bar; the next tracked meeting grows an eyebrow, a purpose excerpt and primary actions. Hover-only actions reveal on fine pointers or when selected.',
        mapsTo: 'Custom card (motion.article with layout) · shadcn Button inside · Radix ContextMenu on right-click · lucide Video, Repeat, Check, CheckCircle, Lock, Plus, Circle (record), Square (stop)',
        usedIn: ['Today', 'Yesterday', 'Tomorrow', 'Upcoming', 'Review'],
        source: '002 app-agenda.js cardMarkup · chipMarkup · metaMarkup · actionsMarkup · extraMarkup · eyebrowMarkup · T.morphCard · .a-card',
        props: [
          ['event', 'CalendarEvent (title, start, end, where, calendar, repeat, people, series, meeting, state, proposal, unfiled, filedTo)', '—'],
          ['kind', 'ready | preparing | tracking | review | summarizing | filed | recording | recurring | oneoff | proposal | unfiled', 'derived (T.kindOf)'],
          ['series', 'Series | null (tracked → colour bar --c)', 'null'],
          ['next', 'boolean (eyebrow, purpose excerpt, Join / Record)', 'false'],
          ['starting', 'boolean (Starting now · Skip / Record)', 'false'],
          ['selected', 'boolean (accent ring, reveals hover actions)', 'false'],
          ['past', 'boolean (row dims it)', 'false'],
          ['recordOnce', 'boolean (chip “Records at HH:MM”)', 'false'],
          ['pending', 'number (“N to review”)', '0'],
          ['on…', 'select, join, record, stop, skip, track, addToSeries, recordOnce, proposalAdd, proposalKeep, review, file, contextMenu', '—']
        ],
        states: ['brief ready', 'preparing brief', 'brief tonight', 'tracking', 'next up', 'starting', 'next up · now', 'recording', 'preparing summary', 'ended · to review', 'filed', 'review', 'untracked recurring', 'one-off', 'records once', 'proposal', 'proposal added', 'kept separate', 'unfiled', 'unfiled filed', 'personal', 'past', 'selected', 'hover', 'pressed', 'narrow', 'truncated'],
        tokens: ['--surface', '--card-bg', '--shadow-card', '--shadow-card-hover', '--c (series colour)', '--accent', '--accent-strong', '--accent-soft', '--coral', '--coral-ink', '--amber', '--amber-soft', '--fill-2', '--fill-3', '--label-2', '--label-4', '--hairline', '--surface-sunken'],
        motion: 'Hover: box-shadow → --shadow-card-hover 200ms ease (CSS transition, fine pointers only). Press: scale(0.992) 160ms --ease-out (CSS transition). Hover actions (.a-hover): opacity 0→1 150ms ease (CSS transition); always visible when selected or on touch. Selection ring (::after, 2px accent): opacity snaps (no transition). Series bar (::before): on tracking scaleY(0.2)→1 360ms --ease-out + opacity 0→1 200ms ease; colour → coral while recording 220ms ease (CSS transitions, interruptible). State change (track, record, stop, skip, add, keep separate, file) → morph: the card’s classes and --c swap at once, then every [data-part] whose markup changed crossfades — out opacity 1→0 + blur 0→2px 110ms ease-out (fill forwards), swap, in opacity 0→1 + blur 2px→0 190ms --ease-out (WAAPI, cancels a running crossfade on that part). Rows re-flow with FLIP translateY(dy)→0 320ms --ease-in-out cubic-bezier(0.77, 0, 0.175, 1) (WAAPI) when a card changes height (record / stop). Loops: the Starting dot (.a-mini-dot) and the recording dot pulse kit-rec 1.4s ease-in-out infinite (opacity 1→0.3→1); wave bars kit-wave 900ms ease-in-out infinite scaleY 0.3→1 with −200/−450/−650/−100ms offsets; preparing chips kit-shimmer 1.3s linear infinite (CSS keyframes); timer ticks every 1s. After the meeting ends the card fades in: opacity 0→1 + blur 2px→0 240ms --ease-out (T.fx.fadeIn). Reduced motion: parts swap instantly, no FLIP, no fade; the bar fades in without the scaleY grow; wave and shimmer stop; the recording dot slows to 2.4s (the Starting dot keeps 1.4s). framer-motion: <motion.article layout transition={{layout: {duration: 0.32, ease: [0.77, 0, 0.175, 1]}}} whileTap={{scale: 0.992}}>; each part <AnimatePresence mode="wait" initial={false}><motion.div key={partKey} initial={{opacity: 0, filter: "blur(2px)"}} animate={{opacity: 1, filter: "blur(0px)", transition: {duration: 0.19, ease: [0.23, 1, 0.32, 1]}}} exit={{opacity: 0, filter: "blur(2px)", transition: {duration: 0.11, ease: "easeOut"}}}/>; bar: motion.span animate={{scaleY: tracked ? 1 : 0.2, opacity: tracked ? 1 : 0}} transition={{duration: 0.36, ease: [0.23, 1, 0.32, 1]}}.',
        a11y: 'In 002 the card is a clickable <article> (not focusable); ↑/↓ move the selection, Enter opens the side peek, ⌘R records the selection or next meeting, right-click opens the card menu. For React: timeline as role="listbox", cards role="option" with aria-selected and roving tabIndex; inner actions are real <button>s (Record announces aria-keyshortcuts="Meta+R"); hover-only actions must also appear on focus-within; the recording timer is aria-live="off" with an aria-label “Recording, 12 minutes”; the series colour bar is decorative.',
        stories: [
          cardStory('Tracked · brief ready', '1:1 · Maria Chen · series colour bar', { id: 't4' }),
          cardStory('Tracked · preparing brief', 'Shimmer chip while Telu prepares', { id: 't5' }),
          cardStory('Tracked · brief tonight', 'Tomorrow · prepared the evening before', { id: 'w3', day: 2 }),
          cardStory('Tracked · no brief yet', '“✓ Tracking” further out (Thursday)', { id: 'x-dr-15', day: 3 }),
          cardStory('Tracking · just switched on', 'Daily Standup right after Track', { id: 't1', setup: SET.standup }),
          cardStory('Next up', 'Countdown, purpose excerpt, Join · Record ⌘R', { id: 't2' }),
          cardStory('Starting now', 'Pulsing dot · Skip · Record ⌘R', { id: 't2', sc: 'starting' }),
          cardStory('Next up · now', 'After Skip at 10:00 (“Won’t record this time”)', { id: 't2', sc: 'starting', setup: SET.skipped }),
          cardStory('Recording', 'Timer, live wave, coral bar + ring · Join · Stop ⌘R', { id: 't2', sc: 'live', mount: (canvas) => startTimers(canvas) }),
          cardStory('Preparing summary', 'Right after Stop', { id: 't2', sc: 'live', setup: SET.summarizing }),
          cardStory('Ended · 5 to review', 'After · Ended 10:44 · 44 min', { id: 't2', sc: 'after' }),
          cardStory('Ended · hover', 'Review revealed on hover', { id: 't2', sc: 'after', force: 'hover' }),
          cardStory('Ended · filed', 'Every item reviewed', { id: 't2', sc: 'after', setup: SET.reviewed('ps-37') }),
          cardStory('Review · 3 to review', 'Yesterday’s interview', { id: 'm2', day: 0 }),
          cardStory('Untracked recurring', '“Daily · Not tracked” dashed chip', { id: 'w1', day: 2 }),
          cardStory('Untracked recurring · hover', 'Track revealed', { id: 'w1', day: 2, force: 'hover' }),
          cardStory('One-off', 'Dashed chip · where, duration, people', { id: 't6' }),
          cardStory('One-off · hover', 'Add to series… · Record once', { id: 't6', force: 'hover' }),
          cardStory('One-off · records once', 'Chip “Records at 17:00”', { id: 't6', setup: SET.once('t6') }),
          cardStory('One-off · past · hover', 'Record once is gone after the event', { id: 't6', setup: SET.clock('18:00'), force: 'hover' }),
          cardStory('Proposal', '“Part of Acme · Implementation?” · Add · Keep separate', { id: 'w2', day: 2 }),
          cardStory('Proposal → added', 'Joined the series · Brief tonight', { id: 'w2', day: 2, setup: SET.joined }),
          cardStory('Proposal → kept separate', 'Becomes a one-off', { id: 'w2', day: 2, setup: SET.separate }),
          cardStory('Unfiled recording', 'Telu’s filing suggestion · File', { id: 'm3', day: 0 }),
          cardStory('Unfiled · no confident match', 'No suggestion row', { id: 'm3', day: 0, setup: SET.noMatch }),
          cardStory('Unfiled → filed', 'Filed to Acme · Implementation', { id: 'm3', day: 0, setup: SET.filed }),
          cardStory('Personal · busy', 'Unwatched calendar → hatched block (EventRow)', { id: 't3', row: true }),
          cardStory('Personal · watched calendar', 'Title shows once the calendar is watched', { id: 't3', row: true, setup: SET.watched }),
          cardStory('Past', 'Dimmed by its row', { id: 't1', row: true }),
          cardStory('Selected', 'Accent ring', { id: 't4', setup: SET.select('t4') }),
          cardStory('Selected · untracked', 'Selection also reveals hover actions', { id: 't6', setup: SET.select('t6') }),
          cardStory('Hover', 'Shadow lift (fine pointers)', { id: 't4', force: 'hover' }),
          cardStory('Pressed', 'scale(0.992)', { id: 't4', force: 'active' }),
          cardStory('Long title', 'Title truncates; chip never shrinks', { id: 't4', setup: SET.retitle('t4', '1:1 · Maria Chen — growth plan, promotion packet and the Q4 onboarding revamp') }),
          cardStory('Narrow agenda (400px)', 'People, purpose and ⌘R hide; chips tighten', { id: 't2', cls: 'narrow' }),
          { label: 'Chip slot · every kind', note: 'T.agenda.chipMarkup per kind (recording shows no chip — the eyebrow carries it)', span: 2, html: chipList },
          morphStory('Morph · Track', 'Replay: Not tracked → ✓ Tracking, the bar grows in', { id: 't1' }, { id: 't1', setup: SET.standup }),
          morphStory('Morph · Record', 'Replay: Next up → Recording (eyebrow, bar, ring, actions)', { id: 't2' }, { id: 't2', sc: 'live' }),
          morphStory('Morph · Skip', 'Replay: Starting now → Next up · now (eyebrow and actions crossfade)', { id: 't2', sc: 'starting' }, { id: 't2', sc: 'starting', setup: SET.skipped }),
          morphStory('Morph · Record once', 'Replay: One-off → “Records at 17:00” chip', { id: 't6' }, { id: 't6', setup: SET.once('t6') }),
          morphStory('Morph · Proposal → added', 'Replay: joins Acme · Implementation — bar grows, chip and actions swap', { id: 'w2', day: 2 }, { id: 'w2', day: 2, setup: SET.joined }),
          morphStory('Morph · Unfiled → filed', 'Replay: suggestion row fades out, chip → Filed, bar grows', { id: 'm3', day: 0 }, { id: 'm3', day: 0, setup: SET.filed })
        ]
      },
      {
        id: 'event-row',
        name: 'EventRow',
        summary: 'A timeline row: the time column (start bold, end faint, optional day label) and the event’s card — or, for events on a personal calendar, a hatched busy block. Past rows dim, except rows that still need review or filing.',
        mapsTo: 'Plain grid row (time column + EventCard | PersonalBusyBlock)',
        usedIn: ['Today', 'Yesterday', 'Tomorrow', 'Upcoming', 'Review'],
        source: '002 app-agenda.js rowMarkup · timeMarkup · personalMarkup · .a-row · .a-time · .a-personal',
        props: [['event', 'CalendarEvent', '—'], ['dayIndex', 'number', 'today'], ['withDay', 'boolean (day label above the time)', 'false']],
        states: ['upcoming', 'past (dimmed)', 'past but needs review / filing (not dimmed)', 'personal busy', 'personal watched', 'with day label'],
        tokens: ['--a-time-w', '--label-3', '--content-bg', '--hairline', '--fill', '--separator'],
        motion: 'Rows re-flow with FLIP translateY(dy)→0 320ms --ease-in-out (WAAPI) when a card above changes height. The personal label crossfades (opacity + 2px blur, 110ms out / 190ms in, T.fx.crossfade) when the calendar is watched or unwatched. Review rows leave with Kit.removeAnimated (see ReviewMeetingRow). Kit.stagger (.enter: opacity 0 + translateY(6px) → none, 280ms --ease-out, 40ms per row, CSS keyframes) is wired in T.renderView({stagger}) but not triggered in 002 — see Timeline. Reduced motion: no FLIP, no crossfade. framer-motion: <motion.div layout> per row keyed by event id.',
        a11y: 'The time column is text (“10:00 to 10:45”); the busy block reads “Personal, busy, 12:00 to 12:45” and is not interactive.',
        stories: [
          cardStory('Tracked', '1:1 · Maria Chen', { id: 't4', row: true }),
          cardStory('Next up', 'Product Sync', { id: 't2', row: true }),
          cardStory('Past · dimmed', 'Title, meta and chip at 55%', { id: 't1', row: true }),
          cardStory('Past · still to review', 'Review rows never dim', { id: 'm2', day: 0, row: true }),
          cardStory('Past · still to file', 'Unfiled rows never dim', { id: 'm3', day: 0, row: true }),
          cardStory('Personal · busy', 'Hatched block', { id: 't3', row: true }),
          cardStory('Personal · watched', 'Crossfades to the title', { id: 't3', row: true, setup: SET.watched }),
          {
            label: 'Personal · watch toggle', note: 'Replay: busy ↔ titled via T.fx.crossfade (110ms out, 190ms in)', span: 2,
            html: () => col(cardHtml({ id: 't3', row: true })) + replayBtn(),
            mount: (canvas) => onReplay(canvas, async () => {
              const block = Kit.$('.a-personal', canvas);
              const inner = (setup) => Kit.$('.a-personal', Kit.html(cardHtml({ id: 't3', row: true, setup }))).innerHTML;
              T.fx.crossfade(block, inner(SET.watched));
              await later(1300);
              T.fx.crossfade(block, inner());
            })
          },
          cardStory('With day label', 'As on the Review page', { id: 'm2', day: 0, row: true, withDay: true }),
          cardStory('With day label · today', 'After · Product Sync on Review', { id: 't2', sc: 'after', row: true, withDay: true }),
          cardStory('Hover', 'Card lifts; the time column stays', { id: 't4', row: true, force: 'hover' })
        ]
      }
    ]
  });
})();
