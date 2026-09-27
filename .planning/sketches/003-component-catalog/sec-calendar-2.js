(() => {
  const C = window.CatCal;
  const { esc } = Catalog;
  const { scene, ev, forceOn, col, replayBtn, onReplay, later, startTimers, morph, flipRows, menuMarkup, toolbar, titleBar, strip, frame, wireFrame, dayBody, wireDays, SET } = C;
  const section = Catalog.sections.find((s) => s.id === 'calendar');

  const timeline = (sc, dayIndex = 1, setup) => scene(sc, () => {
    const day = T.state.days[dayIndex];
    return `<div class="a-timeline" data-day="${day.key}">${T.agenda.timelineMarkup(day.events, dayIndex)}</div>`;
  }, setup);
  const agenda = (inner) => `<div class="cal-agenda">${inner}</div>`;
  const card = (canvas, id) => Kit.$(`.a-card[data-id="${id}"]`, canvas);
  const resetTimeline = (canvas, markup) => {
    Kit.$('.a-timeline', canvas).outerHTML = markup;
    startTimers(canvas);
  };
  const upcomingGroups = () => [...Kit.html(scene('before', () => T.pages.upcomingMarkup())).children].map((el) => el.outerHTML);

  const PREVIEW = [['title', 'Title'], ['cadence', 'Repeats'], ['day', 'Day'], ['time', 'Time'], ['people', 'With']];
  const BLANK = { title: '', cadence: null, day: null, time: null, people: [] };
  const clean = (text) => String(text || '').replace(/\s+/g, ' ').trim();
  const previewFor = (text, linked) => {
    if (linked) {
      const link = T.LINKABLE.find((x) => x.id === linked.id) || { patch: {} };
      return { title: clean(text) || linked.title, cadence: linked.repeat || 'One-off', day: link.patch.day || T.dayLabel(T.dayOf(linked.id)).split(' ')[0], time: linked.start, people: linked.people || link.patch.people || [] };
    }
    return clean(text) ? Kit.parseSeries(text) : BLANK;
  };
  const chipValue = (p, key) => (key === 'people' ? (p.people || []).map((n) => n.split(' ')[0]).join(', ') : p[key] || '');
  const linkedMarkup = (e) => `${icon('link')}<span class="truncate">Linked to <b>${esc(e.title)}</b> · ${esc(e.calendar)} calendar</span><button class="btn sm plain icon" data-new="unlink" data-tip="Unlink">${icon('x')}</button>`;
  const newMarkup = (text = '', linked = null) => {
    const p = previewFor(text, linked);
    return '<div class="a-newser"><div class="a-new-head"><b>New series</b><span class="spacer"></span><span class="kbd">⌥⌘N</span></div>'
      + `<input class="field lg a-new-field" placeholder="Describe it — e.g. Weekly 1:1 with Priya, Thu 11am" value="${esc(text)}" spellcheck="false">`
      + `<div class="a-new-preview">${PREVIEW.map(([key, label]) => { const v = chipValue(p, key); return `<span class="a-pchip${v ? '' : ' is-empty'}" data-k="${key}"><small>${label}</small><b>${esc(v || '—')}</b></span>`; }).join('')}</div>`
      + `<div class="collapsible${linked ? '' : ' collapsed'}"><div><div class="a-new-linked">${linked ? linkedMarkup(linked) : ''}</div></div></div>`
      + `<div class="a-new-foot"><button class="btn sm plain" data-new="link">${icon('link')}or link a calendar event…</button><span class="spacer"></span>`
      + `<button class="btn sm primary" data-new="create"${p.title ? '' : ' disabled'}>Create<span class="kbd">↩</span></button></div>`
      + `<p class="a-new-note">${icon('doc', 'sm')}Opens its living doc — purpose, memory and meetings in one place</p></div>`;
  };
  const newPopover = (text, linked, force = false) => `<div class="popover a-newpop open" role="dialog" style="width: 380px;">${force ? newMarkup(text, linked).replace('<input ', '<input data-force ') : newMarkup(text, linked)}</div>`;
  const updateChips = (root, p) => PREVIEW.forEach(([key]) => {
    const chip = Kit.$(`[data-k="${key}"]`, root);
    const b = Kit.$('b', chip);
    const value = chipValue(p, key);
    if (b.textContent === (value || '—')) return;
    chip.classList.toggle('is-empty', !value);
    b.textContent = value || '—';
    if (!Kit.reduceMotion()) b.animate([{ opacity: 0.2, filter: 'blur(2px)' }, { opacity: 1, filter: 'blur(0px)' }], { duration: 180, easing: Kit.EASE_OUT });
  });
  const linkableEvents = () => {
    const seen = new Set();
    return T.state.days.slice(T.TODAY).flatMap((d) => d.events).filter((e) => {
      if (!['recurring', 'oneoff'].includes(T.kindOf(e)) || seen.has(e.title) || !T.LINKABLE.some((x) => x.title === e.title)) return false;
      seen.add(e.title);
      return true;
    });
  };
  const linkItems = (events) => (events.length
    ? [{ title: 'Not tracked yet' }, ...events.map((e) => ({ label: esc(e.title), icon: e.repeat ? 'repeat' : 'calendar', kbd: esc(e.repeat || `Today ${e.start}`), event: e }))]
    : [{ label: 'Every calendar event is tracked', disabled: true }]);
  const flyChip = (glyph, label) => `<div class="fly-chip">${glyph}<span>${esc(label)}</span></div>`;
  const ghost = (inner) => `<div class="cal-ghost">${inner}</div>`;
  const createdSeries = (text, linked, seq) => scene('before', () => {
    const parsed = Kit.parseSeries(clean(text) || (linked ? linked.title : ''));
    const base = T.applyParsed(T.draftSeries(seq), parsed);
    const link = linked && T.LINKABLE.find((x) => x.id === linked.id);
    return link ? T.linkedSeries(base, link) : base;
  });
  const createdToast = (s) => {
    const up = T.upcomingOf(s);
    return up ? `Created ${esc(s.name)} — first brief the evening before ${esc(up.date)}` : `Created ${esc(s.name)} — add a purpose to shape its first brief`;
  };
  const seriesRow = (s, cls = '') => `<div class="sb-item a-sb-row${cls ? ` ${cls}` : ''}" data-series="${s.id}">${Kit.seriesIcon(s)}<span class="truncate a-sb-name">${esc(s.name || 'Untitled')}</span><span class="a-hint num">${T.nextHint(s)}</span></div>`;
  const miniSidebar = (ids) => scene('before', () => `<aside class="sidebar"><div class="sb-title a-sb-title"><span>Series</span><button class="btn plain icon a-sb-add" data-tip="New series">${icon('plus')}</button></div><div class="cal-sb-rows">${ids.map((id) => seriesRow(T.seriesById(id))).join('')}</div></aside>`);
  const miniWindow = (main, ids, height) => `<div class="desktop cat-desk panel-host" style="height: ${height}px;"><div class="window t-app cat-window"><div class="traffic"><i></i><i></i><i></i></div>${miniSidebar(ids)}<section class="main">${main}</section></div></div>`;

  const wireNewSeries = (pop, win, onCreate) => {
    let linked = null;
    let timer;
    const input = Kit.$('input', pop.el);
    const create = Kit.$('[data-new="create"]', pop.el);
    const refresh = () => {
      const p = previewFor(input.value, linked);
      updateChips(pop.el, p);
      create.disabled = !p.title;
      Kit.$('.collapsible', pop.el).classList.toggle('collapsed', !linked);
      if (linked) Kit.$('.a-new-linked', pop.el).innerHTML = linkedMarkup(linked);
    };
    const commit = () => {
      if (!previewFor(input.value, linked).title) return;
      onCreate(input.value, linked, Kit.$('.a-new-preview', pop.el));
      pop.close();
    };
    input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(refresh, 90); });
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      refresh();
      commit();
    });
    pop.el.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-new]');
      if (!btn) return;
      if (btn.dataset.new === 'create') commit();
      if (btn.dataset.new === 'unlink') { linked = null; refresh(); input.focus(); }
      if (btn.dataset.new === 'link') {
        const items = scene('before', () => linkItems(linkableEvents())).map((it) => (it.event ? { ...it, onSelect: () => { linked = it.event; input.value = it.event.title; refresh(); input.focus(); } } : it));
        Kit.menu(btn, items, { container: pop.el, minWidth: 250 });
      }
    });
    setTimeout(() => input.focus(), 40);
    return { input, refresh };
  };
  const newSeriesDemo = (canvas) => {
    const win = Kit.$('.window', canvas);
    const rows = Kit.$('.cal-sb-rows', canvas);
    let seq = 0;
    const onCreate = (text, linked, from) => {
      seq += 1;
      const s = createdSeries(text, linked, seq);
      rows.insertAdjacentHTML('beforeend', scene('before', () => seriesRow(s, 'landing')));
      const row = rows.lastElementChild;
      const land = () => row.classList.remove('landing');
      Kit.flyTo(from, row, { markup: flyChip(Kit.seriesIcon(s), s.name) }).then(land, land);
      Kit.toast(createdToast(s), { icon: 'check-circle', container: win });
    };
    const open = () => {
      const pop = Kit.popover(Kit.$('.a-new-btn', canvas), newMarkup(), { align: 'end', width: 380, className: 'a-newpop' });
      return pop ? { pop, ...wireNewSeries(pop, win, onCreate) } : null;
    };
    Kit.$('.a-new-btn', canvas).addEventListener('click', open);
    onReplay(canvas, async () => {
      Kit.$$('.cal-sb-rows > .sb-item', canvas).slice(3).forEach((el) => el.remove());
      const run = open();
      if (!run) return;
      await later(260);
      const text = 'Weekly 1:1 with Priya, Thu 11am';
      for (let i = 1; i <= text.length; i += 1) {
        run.input.value = text.slice(0, i);
        run.input.dispatchEvent(new Event('input'));
        await later(34);
      }
      await later(900);
      run.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    });
  };

  const seriesItems = (title, extra = []) => [{ title }, ...T.tracked().map((s) => ({ label: esc(s.name), swatch: s.color, series: s })), ...extra];
  const addToSeriesItems = () => seriesItems('Add to series', ['-', { label: 'New series…', icon: 'plus' }]);
  const staticMenu = (items, minWidth, activeAt = -1) => {
    let n = -1;
    return `<div class="cat-static">${menuMarkup(items.map((it) => {
      if (it === '-' || it.title) return it;
      n += 1;
      return n === activeAt ? { ...it, active: true } : it;
    }), minWidth)}</div>`;
  };
  const attachEvent = (id, sid) => {
    const e = ev(id);
    const meeting = { id: `${sid}-${e.id}`, n: null, title: e.title, date: T.dayInfo(T.dayOf(e.id)).date, time: `${e.start}–${e.end}`, status: 'upcoming', where: e.where || null };
    T.mapSeries(sid, (s) => ({ ...s, meetings: T.insertUpcoming(s.meetings.filter((m) => m.id !== meeting.id), meeting) }));
    T.mapEvents((x) => x.id === e.id, (x) => ({ ...x, series: sid, meeting: meeting.id }));
  };

  const capsule = (label) => `<div class="a-rec-capsule"><span class="rec-dot"></span><b class="truncate">${esc(label)}</b><span class="num a-rec-time" data-rec-timer>0:00</span><button class="btn sm a-rec-stop" data-act="stop">${icon('stop')}Stop</button></div>`;
  const capsuleIn = (label, force = '') => strip(`${titleBar('Today', 'Tuesday, 29 September')}<div class="a-rec-slot">${force ? forceOn(capsule(label), 'class="btn sm a-rec-stop"') : capsule(label)}</div><span class="spacer"></span>`);

  Object.assign(window.CatCal, { miniWindow, seriesRow, flyChip, ghost });

  section.components.push(
    {
      id: 'timeline',
      name: 'Timeline',
      summary: 'A whole day: rows in start order, the now line on today, free gaps of 45 minutes or more, and every card in the state the scenario puts it in. Tomorrow and yesterday have no now line; a day with no events shows “Nothing scheduled”.',
      mapsTo: 'Plain list (role="listbox") of EventRow · NowLine · FreeGap; framer-motion layout for re-flow',
      usedIn: ['Today', 'Yesterday', 'Tomorrow'],
      source: '002 app-agenda.js timelineMarkup · dayMarkup · T.renderView · T.fx.flipRows · Kit.stagger',
      props: [['events', 'CalendarEvent[] (sorted by start)', '—'], ['dayIndex', 'number', 'today'], ['now', 'minutes since midnight (today only)', '—']],
      states: ['before', 'starting', 'live', 'after', 'yesterday', 'tomorrow', 'empty'],
      tokens: ['--a-time-w', '--coral', '--separator'],
      motion: 'Record / Stop → the affected cards morph (see EventCard) and all rows FLIP: translateY(dy)→0 320ms --ease-in-out cubic-bezier(0.77, 0, 0.175, 1) (WAAPI, measured before the class swap). Stop → “Preparing summary…” for a 900ms beat, then the After view re-renders in place and the ended card fades in: opacity 0→1 + blur 2px→0 + translateY 0, 240ms --ease-out (T.fx.fadeIn, WAAPI). Navigating to a page fades the whole view in the same way at 200ms. Stagger (Kit.stagger): rows get .enter → kit-enter keyframes opacity 0 + translateY(6px) → none, 280ms --ease-out, fill both, delay index × 40ms (CSS keyframes, restartable by re-adding the class) — wired as T.renderView({stagger: true}) but never triggered in 002. Reduced motion: no FLIP, fade or stagger (rows appear in place). framer-motion: <LayoutGroup> with <motion.div layout transition={{duration: 0.32, ease: [0.77, 0, 0.175, 1]}}> per row; enter stagger via variants {hidden: {opacity: 0, y: 6}, show: (i) => ({opacity: 1, y: 0, transition: {delay: i * 0.04, duration: 0.28, ease: [0.23, 1, 0.32, 1]}})}.',
      a11y: 'role="listbox" aria-label="Tuesday, 29 September"; rows are options in time order; the now line is aria-hidden with a visually hidden “Now 9:41” marker; ↑/↓ move the selection and ←/→ change the day.',
      stories: [
        { label: 'Before · 9:41', note: 'Replay runs Kit.stagger on the rows (available, not triggered in 002)', span: 'full', html: () => agenda(timeline('before')) + replayBtn('Replay stagger'), mount: (canvas) => onReplay(canvas, () => Kit.stagger(Kit.$('.a-timeline', canvas), ':scope > *')) },
        {
          label: 'Starting · 10:00', note: 'Replay: Record — Product Sync morphs to Recording while rows FLIP', span: 'full',
          html: () => agenda(timeline('starting')) + replayBtn('Replay record'),
          mount: (canvas) => onReplay(canvas, async () => {
            resetTimeline(canvas, timeline('starting'));
            await later(500);
            const fresh = scene('live', () => T.agenda.cardMarkup(ev('t2'), 1));
            flipRows(canvas, () => morph(card(canvas, 't2'), fresh, 0));
          })
        },
        {
          label: 'Live · 10:12', note: 'Replay: Stop — Preparing summary for 900ms, then After fades in', span: 'full',
          html: () => agenda(timeline('live')) + replayBtn('Replay stop'),
          mount: (canvas) => {
            startTimers(canvas);
            onReplay(canvas, async () => {
              resetTimeline(canvas, timeline('live'));
              await later(600);
              flipRows(canvas, () => morph(card(canvas, 't2'), scene('live', () => T.agenda.cardMarkup(ev('t2'), 1), SET.summarizing)));
              await later(900);
              resetTimeline(canvas, timeline('after'));
              T.fx.fadeIn(card(canvas, 't2'), { duration: 240 });
            });
          }
        },
        { label: 'After · 10:46', note: 'Replay: the ended card fades in (T.fx.fadeIn 240ms)', span: 'full', html: () => agenda(timeline('after')) + replayBtn(), mount: (canvas) => onReplay(canvas, () => T.fx.fadeIn(card(canvas, 't2'), { duration: 240 })) },
        { label: 'Yesterday', note: 'Review and filing rows stay bright; no now line', span: 'full', html: () => agenda(timeline('before', 0)) },
        { label: 'Tomorrow', note: 'Untracked, proposal and tracked rows', span: 'full', html: () => agenda(timeline('before', 2)) },
        { label: 'Empty day', note: 'No events on the day', span: 2, html: agenda(`<div class="empty">${icon('sun', 'xl')}<h3>Nothing scheduled</h3></div>`) }
      ]
    },
    {
      id: 'upcoming-day',
      name: 'UpcomingDay',
      summary: 'A day group on the Upcoming page: the day’s name with its long date, then its rows. Only days with events appear (tomorrow, then Thursday and Friday). The same group, titled “To review”, heads the Review page.',
      mapsTo: 'Plain section (h2 + span header, list of EventRow)',
      usedIn: ['Upcoming', 'Review (To review)'],
      source: '002 app-pages.js daySection · upcomingMarkup · .a-day · .a-day-head',
      props: [['title', 'string (Tomorrow | weekday)', '—'], ['subtitle', 'string (long date)', '—'], ['rows', '{ event, dayIndex, withDay }[]', '—']],
      states: ['mixed kinds', 'tracked only', 'hidden when empty'],
      tokens: ['--a-time-w', '--label-3'],
      motion: 'None of its own: the Upcoming view fades in on navigation — opacity 0→1 + blur 2px→0, 200ms --ease-out (T.fx.fadeIn, WAAPI); reduced motion: no fade. framer-motion: <motion.div initial={{opacity: 0, filter: "blur(2px)"}} animate={{opacity: 1, filter: "blur(0px)"}} transition={{duration: 0.2, ease: [0.23, 1, 0.32, 1]}}> on the page.',
      a11y: 'section with an h2 (“Tomorrow”) and the long date as its description; rows follow the Timeline listbox pattern.',
      stories: [
        { label: 'Tomorrow', note: 'Untracked recurring · proposal · brief tonight', span: 'full', html: () => col(upcomingGroups()[0]) },
        { label: 'Thursday', note: 'Tracked, no brief yet', span: 2, html: () => col(upcomingGroups()[1]) },
        { label: 'Friday', note: 'Tracked, no brief yet', span: 2, html: () => col(upcomingGroups()[2]) },
        { label: 'Upcoming page · in context', note: 'Toolbar title “Upcoming · Next few days”', span: 'full', flush: true, html: () => scene('before', () => frame(toolbar({ b: 'Upcoming', span: 'Next few days' }), T.pages.upcomingMarkup(), 640)), mount: wireFrame }
      ]
    },
    {
      id: 'new-series-popover',
      name: 'NewSeriesPopover',
      summary: 'Create a series by describing it. As you type, Kit.parseSeries fills five chips (Title, Repeats, Day, Time, With); “or link a calendar event…” binds it to an untracked event instead. Create flies the new series into the sidebar and opens its living doc with the purpose focused.',
      mapsTo: 'Radix Popover (shadcn Popover) + shadcn Input + Radix DropdownMenu for the event picker · parser as a pure util · lucide Link, X, FileText, CornerDownLeft',
      usedIn: ['Toolbar New ⌥⌘N', 'Sidebar Series +', 'File menu › New Series…', 'Track on an unmatched event'],
      source: '002 app-flows.js newMarkup · updateChips · previewFor · linkMenu · linkedMarkup · createSeries · wireNewSeries · .a-newpop',
      props: [['text', 'string (prefill, e.g. an event title)', '""'], ['link', 'CalendarEvent | null (prefilled link)', 'null'], ['onCreate', '(series) => void', '—']],
      states: ['empty', 'typing · partial parse', 'typing · parsed', 'link menu open', 'linked', 'nothing to link', 'created'],
      tokens: ['--glass-strong', '--shadow-float', '--accent-soft', '--accent-strong', '--fill', '--label-3', '--separator'],
      motion: 'Open: opacity 0→1 150ms --ease-out + scale 0.96→1 190ms --ease-out from the trigger (transform-origin = --origin); close 110ms (CSS transitions via .open / .closing; interruptible). Typing: input debounced 90ms, then each chip whose value changed animates its value: opacity 0.2→1 + blur 2px→0, 180ms --ease-out (WAAPI). Link row: .collapsible grid-template-rows 0fr↔1fr 260ms --ease-out + opacity 200ms ease. Link menu: instant open, 120ms fade out. Create: the preview row flies to the new sidebar row (FlyChip in Overlays — Kit.flyTo 560ms — X on cubic-bezier(0.45, 0, 0.2, 1), Y + scale(≥0.4) + opacity→0.35 on cubic-bezier(0.6, 0, 0.9, 0.7); ghost = .fly-chip on glass), the row waits hidden (.landing, opacity 0) and lands with .receive (accent-soft wash 900ms --ease-out) + icon .bump (scale 1.18 at 40%, 420ms --ease-out) while .landing is removed (opacity 0→1, 150ms ease), then the living doc opens with the purpose focused. Reduced motion: no scale/blur/fly — the row just receives; chips swap instantly. framer-motion: PopoverContent as motion.div initial {opacity: 0, scale: 0.96} animate {opacity: 1, scale: 1} transition {opacity: {duration: 0.15}, scale: {duration: 0.19, ease: [0.23, 1, 0.32, 1]}} style {transformOrigin: "var(--radix-popover-content-transform-origin)"}; chip values <AnimatePresence mode="popLayout"> keyed by value; fly via a shared layoutId from the preview chip to the sidebar row.',
      a11y: 'role="dialog" aria-label="New series"; the input autofocuses and Enter creates; chips are an aria-live="polite" summary (“Weekly, Thursday 11:00, with Priya”); Create is disabled until a title parses; Esc closes; the event picker is a menu (↑/↓, Enter).',
      stories: [
        { label: 'Empty', note: 'Every chip —; Create disabled', bg: 'wallpaper', span: 2, height: 280, force: 'focus', html: () => `<div class="cat-static">${newPopover('', null, true)}</div>` },
        { label: 'Typing · partial parse', note: '“Coffee with Alex” — no day or time yet', bg: 'wallpaper', span: 2, height: 280, force: 'focus', html: () => `<div class="cat-static">${newPopover('Coffee with Alex', null, true)}</div>` },
        { label: 'Typing · parsed', note: '“Weekly 1:1 with Priya, Thu 11am”', bg: 'wallpaper', span: 2, height: 280, force: 'focus', html: () => `<div class="cat-static">${newPopover('Weekly 1:1 with Priya, Thu 11am', null, true)}</div>` },
        {
          label: 'Typing · replay', note: 'Replay types it; chips animate as they fill (180ms blur-in)', bg: 'wallpaper', span: 2, height: 280,
          html: () => `<div class="cat-static">${newPopover('', null)}</div>${replayBtn()}`,
          mount: (canvas) => onReplay(canvas, async () => {
            const input = Kit.$('input', canvas);
            const root = Kit.$('.popover', canvas);
            const text = 'Weekly 1:1 with Priya, Thu 11am';
            for (let i = 0; i <= text.length; i += 1) {
              input.value = text.slice(0, i);
              updateChips(root, previewFor(input.value, null));
              Kit.$('[data-new="create"]', root).disabled = !previewFor(input.value, null).title;
              await later(45);
            }
          })
        },
        { label: 'Link a calendar event…', note: 'Untracked events you can bind it to', bg: 'wallpaper', span: 2, height: 300, html: () => scene('before', () => `<div class="cat-static cal-stack">${newPopover('', null)}<div class="cal-over" style="left: 8px; top: 48px;">${menuMarkup(linkItems(linkableEvents()), 250)}</div></div>`) },
        { label: 'Linked', note: 'Bound to Daily Standup · chips from the event', bg: 'wallpaper', span: 2, height: 300, force: 'focus', html: () => scene('before', () => `<div class="cat-static">${newPopover('Daily Standup', ev('t1'), true)}</div>`) },
        { label: 'Nothing to link', note: 'Every event is tracked', bg: 'wallpaper', span: 2, height: 300, html: () => `<div class="cat-static cal-stack">${newPopover('', null)}<div class="cal-over" style="left: 8px; top: 120px;">${menuMarkup(linkItems([]), 250)}</div></div>` },
        {
          label: 'Created', note: 'The ghost that flies to the sidebar, then the toast', bg: 'wallpaper', span: 2, height: 200,
          html: () => { const s = createdSeries('Weekly 1:1 with Priya, Thu 11am', null, 1); return `<div class="cal-row-flex">${ghost(flyChip(Kit.seriesIcon(s), s.name))}<div class="cat-static"><div class="toast show" role="status">${icon('check-circle')}<span>${createdToast(s)}</span></div></div></div>`; }
        },
        {
          label: 'Live · create a series', note: 'Click New, type, press ↩ — or Replay the whole flow', span: 'full', flush: true,
          html: () => miniWindow(`<div class="toolbar" data-mode="agenda">${toolbar({ b: 'Today', span: 'Tuesday, 29 September' })}</div><div class="content"><div class="agenda-inner">${scene('before', () => dayBody(1))}</div></div>`, ['product-sync', 'maria', 'acme'], 440) + replayBtn(),
          mount: newSeriesDemo
        }
      ]
    },
    {
      id: 'series-picker-menu',
      name: 'SeriesPickerMenu',
      summary: 'A titled menu of tracked series (colour swatch + name) used wherever something is assigned to a series: Add to series… on an event, Choose… on an unfiled item, and the new-series event picker (icons + shortcut-style hints).',
      mapsTo: 'Radix DropdownMenu (shadcn DropdownMenu) with DropdownMenuLabel + items; swatch = series dot',
      usedIn: ['EventCard · Add to series…', 'UnfiledCard · Choose…', 'NewSeriesPopover · link'],
      source: '002 app-actions.js T.addToSeriesMenu · fileChoose · app-flows.js linkMenu · kit Kit.menu',
      props: [['title', 'string', '—'], ['items', '{ label, swatch | icon, kbd?, disabled? }[]', '—'], ['footer', 'New series… item', 'optional'], ['minWidth', 'number', '230']],
      states: ['rest', 'highlighted row', 'disabled row', 'with footer action'],
      tokens: ['--glass-strong', '--shadow-float', '--accent', '--label-2', '--label-3', '--separator'],
      motion: 'Open: instant (no enter animation, like native macOS menus). Choose: the row blinks (highlight off, back on after 60ms), the menu closes at 130ms and fades out over 120ms ease (.closing, CSS transition). Picking a series morphs the card (see EventCard) and flies a .fly-chip to the series row (FlyChip in Overlays). Reduced motion: same (opacity only). framer-motion: none on open; DropdownMenuContent exit {opacity: 0, transition: {duration: 0.12}}.',
      a11y: 'role="menu" with a menu-title label; items role="menuitem" (disabled ones aria-disabled); ↑/↓ move, Enter selects, Esc closes and returns focus to the trigger.',
      stories: [
        { label: 'Add to series', note: 'From a one-off · with New series…', bg: 'wallpaper', height: 300, html: () => scene('before', () => staticMenu(addToSeriesItems(), 230)) },
        { label: 'File to', note: 'Choose… on an unfiled item', bg: 'wallpaper', height: 300, html: () => scene('before', () => staticMenu(seriesItems('File to'), 230)) },
        { label: 'Link an event', note: 'New-series picker · icons + hints', bg: 'wallpaper', height: 300, html: () => scene('before', () => staticMenu(linkItems(linkableEvents()), 250)) },
        {
          label: 'Live · add a one-off to a series', note: 'Hover the card, Add to series…, pick one — the card morphs; Undo in the toast', span: 'full', flush: true,
          html: () => `<div class="desktop cat-desk panel-host" style="height: 380px;"><div class="cal-center">${col(scene('before', () => T.agenda.cardMarkup(ev('t6'), 1)))}</div></div>`,
          mount: (canvas) => {
            const stage = Kit.$('.desktop', canvas);
            const cardEl = () => card(canvas, 't6');
            stage.addEventListener('click', (e) => {
              const btn = e.target.closest('[data-act="add-to-series"]');
              if (!btn) return;
              const items = scene('before', () => addToSeriesItems()).map((it) => (it.series ? { ...it, onSelect: () => {
                morph(cardEl(), scene('before', () => T.agenda.cardMarkup(ev('t6'), 1), () => attachEvent('t6', it.series.id)));
                Kit.toast(`Added Coffee with Alex Kim to ${esc(it.series.name)}`, { icon: 'check-circle', container: stage, action: { label: 'Undo', onClick: () => morph(cardEl(), scene('before', () => T.agenda.cardMarkup(ev('t6'), 1))) } });
              } } : it));
              Kit.menu(btn, items, { minWidth: 230 });
            });
          }
        }
      ]
    },
    {
      id: 'recording-capsule',
      name: 'RecordingCapsule',
      summary: 'Coral capsule in the agenda toolbar while anything records: pulsing dot, what is being recorded, the running timer and Stop. Appears next to the day title and disappears on Stop. It has no paused state in 002 — pausing lives in the Island, and the capsule keeps counting.',
      mapsTo: 'Custom toolbar capsule (motion.div) with shadcn Button (Stop) · lucide Square',
      usedIn: ['Agenda toolbar (Today, Upcoming, Review, Found)'],
      source: '002 app-shell.js recCapsule · syncCapsule · .a-rec-capsule',
      props: [['label', 'event title | series name | "Recording"', 'Recording'], ['startedAt', 'timestamp (timer)', '—'], ['onStop', '() => void', '—']],
      states: ['live', 'hover Stop', 'pressed Stop', 'series recording', 'fallback label', 'truncated'],
      tokens: ['--coral-soft', '--coral-ink', '--coral', '--font'],
      motion: 'Enter (recording starts): opacity 0→1 + scale 0.96→1 + blur 2px→0, 240ms --ease-out (WAAPI). Exit (Stop): opacity 1→0 + scale 1→0.96, 150ms ease-out, fill forwards, then removed (WAAPI; not interrupted — a new recording while exiting renders a fresh capsule). Dot: kit-rec 1.4s ease-in-out infinite (opacity 1→0.3→1). Timer ticks each second (tabular numerals, min-width 30px so the capsule never jitters). Stop hover: background coral→coral-ink 150ms ease. Reduced motion: appears and disappears instantly; dot pulses at 2.4s. framer-motion: <AnimatePresence>{recording && <motion.div initial={{opacity: 0, scale: 0.96, filter: "blur(2px)"}} animate={{opacity: 1, scale: 1, filter: "blur(0px)", transition: {duration: 0.24, ease: [0.23, 1, 0.32, 1]}}} exit={{opacity: 0, scale: 0.96, transition: {duration: 0.15, ease: "easeOut"}}}/>}.',
      a11y: 'role="status" aria-label="Recording Product Sync, 12 minutes"; the timer text is aria-hidden (updated label every minute, not every second); Stop is a button (⌘R toggles too).',
      stories: [
        { label: 'Live', note: 'Timer running from 12:04', span: 2, html: () => capsuleIn('Product Sync'), mount: (canvas) => startTimers(canvas) },
        { label: 'Hover · Stop', note: 'coral → coral-ink', span: 2, force: 'hover', html: () => capsuleIn('Product Sync', 'hover'), mount: (canvas) => startTimers(canvas) },
        { label: 'Pressed · Stop', span: 2, force: 'active', html: () => capsuleIn('Product Sync', 'active'), mount: (canvas) => startTimers(canvas) },
        { label: 'Series recording', note: 'Started from a living doc without an event', span: 2, html: () => capsuleIn('Hiring · Staff Engineer'), mount: (canvas) => startTimers(canvas, 95) },
        { label: 'Fallback label', note: 'Neither event nor series', span: 2, html: () => capsuleIn('Recording'), mount: (canvas) => startTimers(canvas, 8) },
        { label: 'Truncated', note: 'max-width 300px', span: 2, html: () => capsuleIn('Product Sync — quarterly planning and roadmap review'), mount: (canvas) => startTimers(canvas) },
        {
          label: 'Enter / exit', note: 'Replay: exit 150ms, then enter 240ms', span: 2,
          html: () => capsuleIn('Product Sync') + replayBtn(),
          mount: (canvas) => {
            startTimers(canvas);
            onReplay(canvas, async () => {
              const el = Kit.$('.a-rec-capsule', canvas);
              await el.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(0.96)' }], { duration: 150, easing: 'ease-out', fill: 'forwards' }).finished;
              await later(350);
              el.getAnimations().forEach((a) => a.cancel());
              el.animate([{ opacity: 0, transform: 'scale(0.96)', filter: 'blur(2px)' }, { opacity: 1, transform: 'none', filter: 'blur(0px)' }], { duration: 240, easing: Kit.EASE_OUT });
            });
          }
        },
        { label: 'In the full toolbar', note: 'Live scenario', span: 'full', html: () => scene('live', () => strip(toolbar({ b: 'Today', span: 'Tuesday, 29 September', capsule: capsule('Product Sync') }))), mount: (canvas) => startTimers(canvas) }
      ]
    },
    {
      id: 'today-view',
      name: 'TodayView',
      summary: 'In context: the agenda page as it ships — toolbar (DayHeader, RecordingCapsule, DayStepper, New, search), the proposals banner and the day’s timeline. The Before tile is live: step days, hide the banner, click cards to select.',
      mapsTo: 'Page composition (Next.js route) of the components above',
      usedIn: ['Main window · Today'],
      source: '002 app-agenda.js dayMarkup · agendaMarkup · T.renderView · app-shell.js agendaToolbar',
      states: ['before', 'live', 'after'],
      tokens: ['--content-bg', '--toolbar-h'],
      motion: 'Composes the motions above. Scrolling content under the toolbar toggles .scrolled (scrollTop > 2): background-color → color-mix(content-bg 76%) and the 0.5px hairline shadow fade in over 200ms ease (CSS transition); the blur(18px) backdrop switches on instantly. Reduced motion: unchanged (colour and shadow transitions are allowed). framer-motion: none — a CSS class toggled from a scroll listener (or useScroll + useMotionValueEvent).',
      a11y: 'main landmark with the toolbar as a banner/toolbar role; the timeline is the primary listbox; the banner is a status region.',
      stories: [
        { label: 'Before · 9:41 · live', note: '‹ Today › slide, × hides the banner, click selects · Replay staggers the rows', span: 'full', flush: true, html: () => scene('before', () => frame(toolbar({ b: 'Today', span: 'Tuesday, 29 September' }), dayBody(1), 760)) + replayBtn('Replay stagger'), mount: (canvas) => { wireDays(canvas); onReplay(canvas, () => Kit.stagger(Kit.$('.a-timeline', canvas), ':scope > *')); } },
        { label: 'Live · 10:12', note: 'Capsule in the toolbar, card recording', span: 'full', flush: true, html: () => scene('live', () => frame(toolbar({ b: 'Today', span: 'Tuesday, 29 September', capsule: capsule('Product Sync') }), dayBody(1), 760)), mount: (canvas) => { wireFrame(canvas); startTimers(canvas); } },
        { label: 'After · 10:46', note: '5 to review, Maria is next up', span: 'full', flush: true, html: () => scene('after', () => frame(toolbar({ b: 'Today', span: 'Tuesday, 29 September' }), dayBody(1), 760)), mount: wireFrame }
      ]
    }
  );
})();
