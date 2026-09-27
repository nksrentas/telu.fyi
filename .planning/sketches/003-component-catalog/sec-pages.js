(() => {
  const { esc } = Catalog;
  const { scene, ev, forceOn, col, replayBtn, onReplay, later, toolbar, frame, wireFrame, titleFor, SET, miniWindow, flyChip } = window.CatCal;

  const pick = (markup, sel) => {
    const el = Kit.$(sel, Kit.html(`<div>${markup}</div>`));
    return el ? el.outerHTML : '';
  };
  const found = (setup) => scene('before', () => T.pages.foundMarkup(), setup);
  const review = (sc = 'before', setup) => scene(sc, () => T.pages.reviewMarkup(), setup);
  const pgc = (inner) => `<div class="pgc">${inner}</div>`;
  const unfiled = (id, patch = {}) => scene('before', () => T.pages.unfiledCard({ ...T.state.unfiled.find((u) => u.id === id), ...patch }));
  const cleared = () => {
    SET.reviewed('hi-5')();
    T.set({ unfiled: [] });
  };
  const noProposals = () => T.set({ proposals: [] });
  const reviewRow = (id, day, sc = 'before', setup) => scene(sc, () => T.agenda.rowMarkup(ev(id), day, { withDay: true }), setup);

  const seriesHit = (s) => `<div class="row hoverable a-hit" data-hit data-series="${s.id}">${Kit.seriesIcon(s)}<span class="truncate">${esc(s.name || 'Untitled')}</span><span class="spacer"></span><span class="faint truncate">${esc((s.rule || 'Manual').split(' · ')[0])}</span></div>`;
  const memoryHit = (s, k) => `<div class="row hoverable a-hit" data-hit data-series="${s.id}"><span class="ktype" data-type="${k.type}">${icon(k.type)}</span>`
    + `<span class="truncate">${esc(k.text)}</span><span class="spacer"></span><span class="faint truncate a-hit-meta">${esc(s.name)}</span></div>`;
  const clean = (text) => String(text || '').replace(/\s+/g, ' ').trim();
  const searchResults = (raw) => {
    const q = clean(raw).toLowerCase();
    const tracked = T.tracked();
    if (!q) return tracked.length ? `<div class="a-search-hint">Series</div>${tracked.slice(0, 6).map(seriesHit).join('')}` : '<div class="a-search-empty">Connect your calendar or add a series to search it</div>';
    const series = tracked.filter((s) => (s.name || '').toLowerCase().includes(q) || s.people.some((n) => n.toLowerCase().includes(q)));
    const memory = tracked.flatMap((s) => s.memory.filter((k) => k.text.toLowerCase().includes(q)).map((k) => ({ s, k }))).slice(0, 5);
    if (!series.length && !memory.length) return `<div class="a-search-empty">No matches for “${esc(clean(raw))}”</div>`;
    return `${series.length ? `<div class="a-search-hint">Series</div>${series.map(seriesHit).join('')}` : ''}`
      + `${memory.length ? `<div class="a-search-hint">In memory</div>${memory.map(({ s, k }) => memoryHit(s, k)).join('')}` : ''}`;
  };
  const searchMarkup = (q = '', focused = false) => `<div class="a-search"><div class="search">${icon('search')}<input class="field${focused ? ' is-focus' : ''}" placeholder="Search series, people, decisions" spellcheck="false" value="${esc(q)}"></div><div class="a-search-results">${searchResults(q)}</div></div>`;
  const searchPopover = (q, { sc = 'before', setup, hoverFirst = false } = {}) => scene(sc, () => {
    const markup = searchMarkup(q, true);
    return `<div class="cat-static"><div class="popover open" role="dialog" style="width: 400px;">${hoverFirst ? forceOn(markup, '<div class="row hoverable a-hit"') : markup}</div></div>`;
  }, setup);
  const searchDemo = (canvas) => {
    const stage = Kit.$('.desktop', canvas);
    const open = (btn) => {
      const pop = Kit.popover(btn, scene('before', () => `<div class="a-search"><div class="search">${icon('search')}<input class="field" placeholder="Search series, people, decisions" spellcheck="false"></div><div class="a-search-results"></div></div>`), { align: 'end', width: 400 });
      if (!pop) return;
      const input = Kit.$('input', pop.el);
      const results = Kit.$('.a-search-results', pop.el);
      const render = () => { results.innerHTML = scene('before', () => searchResults(input.value)); };
      input.addEventListener('input', render);
      input.addEventListener('keydown', (e) => {
        const first = Kit.$('[data-hit]', results);
        if (e.key === 'Enter' && first) first.click();
      });
      results.addEventListener('click', (e) => {
        const hit = e.target.closest('[data-hit]');
        if (!hit) return;
        pop.close();
        Kit.toast(`Opens ${esc(hit.querySelector('.truncate').textContent)} · its living doc`, { icon: 'doc', container: stage });
      });
      render();
      setTimeout(() => input.focus(), 40);
    };
    Kit.$('[data-act="search"]', canvas).addEventListener('click', (e) => open(e.currentTarget));
  };

  const PROPOSAL_TOAST = {
    'prop-track': (p) => (p.id === 'pr-standup' ? ['Telu will prepare briefs for Daily Standup', 'check-circle', true] : [`Created a living doc for ${esc(p.title)}`, 'check-circle', true]),
    'prop-dismiss': (p) => [p.quiet ? `Telu will stop suggesting ${esc(p.title)}` : `Okay — ${esc(p.title)} stays a regular event`, 'check', false],
    'prop-join': (p) => [`${esc(p.title)} now files into Acme · Implementation`, 'check-circle', true],
    'prop-separate': (p) => [`Kept separate — ${esc(p.title)} stays a one-off`, 'check', true]
  };
  const wireFound = (canvas) => {
    const main = Kit.$('.main', canvas);
    const setCount = () => {
      const n = Kit.$$('[data-proposal]:not([data-leaving])', canvas).length;
      Kit.$('.a-tb-title span', canvas).textContent = n ? `${n} ${n === 1 ? 'suggestion' : 'suggestions'} · decide once` : 'Nothing new';
    };
    const reset = () => {
      Kit.$('.agenda-inner', canvas).innerHTML = found();
      setCount();
      T.fx.fadeIn(Kit.$('.agenda-inner', canvas), { duration: 200 });
    };
    canvas.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-act^="prop-"]');
      if (!btn) return;
      const cardEl = btn.closest('[data-proposal]');
      const p = DATA.proposals.find((x) => x.id === cardEl.dataset.proposal);
      const [text, iconName, undo] = PROPOSAL_TOAST[btn.dataset.act](p);
      cardEl.style.pointerEvents = 'none';
      cardEl.dataset.leaving = 'true';
      setCount();
      Kit.removeAnimated(cardEl).then(() => {
        const holder = Kit.$('.a-pcards', canvas);
        if (holder && !Kit.$('[data-proposal]', holder)) {
          holder.innerHTML = T.pages.caughtUp();
          T.fx.fadeIn(holder, { duration: 220 });
        }
      });
      Kit.toast(text, { icon: iconName, container: main, ...(undo ? { action: { label: 'Undo', onClick: reset } } : {}) });
    });
    onReplay(canvas, reset);
    wireFrame(canvas);
  };
  const removeAndRestore = (canvas, sel, beat = 0) => onReplay(canvas, async () => {
    const el = Kit.$(sel, canvas);
    if (!el) return;
    await later(beat);
    const markup = el.outerHTML;
    const next = el.nextElementSibling;
    const parent = el.parentElement;
    await Kit.removeAnimated(el);
    await later(700);
    if (next) next.insertAdjacentHTML('beforebegin', markup);
    else parent.insertAdjacentHTML('beforeend', markup);
    Kit.enterAnimated(Kit.$(sel, canvas));
  });

  const flyStage = (inner, ids) => miniWindow(`<div class="content"><div class="agenda-inner pg-fly">${inner}</div></div>`, ids, 400) + replayBtn();
  const resettable = (canvas) => {
    const main = Kit.$('.pg-fly', canvas);
    const rows = Kit.$('.cal-sb-rows', canvas);
    const initial = [main.innerHTML, rows.innerHTML];
    return () => {
      Kit.$$('.toast', canvas).forEach((el) => el.remove());
      main.innerHTML = initial[0];
      rows.innerHTML = initial[1];
    };
  };
  const rowOf = (canvas, sid) => Kit.$(`.cal-sb-rows [data-series="${sid}"]`, canvas);
  const decideDemo = (canvas) => {
    const reset = resettable(canvas);
    const win = Kit.$('.window', canvas);
    const leave = (card) => {
      card.style.pointerEvents = 'none';
      return Kit.removeAnimated(card);
    };
    onReplay(canvas, async () => {
      reset();
      await later(450);
      const join = Kit.$('[data-proposal="pr-acme-sso"]', canvas);
      Kit.flyTo(Kit.$('.a-pcard-main', join), rowOf(canvas, 'acme'), { markup: flyChip(icon('link'), 'Acme · SSO deep-dive') });
      leave(join);
      Kit.toast('Acme · SSO deep-dive now files into Acme · Implementation', { icon: 'check-circle', container: win, action: { label: 'Undo', onClick: reset } });
      await later(1100);
      const track = Kit.$('[data-proposal="pr-growth"]', canvas);
      const s = scene('before', () => T.seriesFromProposal(DATA.proposals[0]));
      Kit.$('.cal-sb-rows', canvas).insertAdjacentHTML('beforeend', scene('before', () => window.CatCal.seriesRow(s)));
      const row = rowOf(canvas, s.id);
      Kit.enterAnimated(row);
      Kit.flyTo(Kit.$('.a-pcard-main', track), row, { markup: T.flyMarkup(s) });
      leave(track);
      Kit.toast('Created a living doc for Growth Review', { icon: 'check-circle', container: win, action: { label: 'Undo', onClick: reset } });
    });
  };
  const fileDemo = (canvas) => {
    const reset = resettable(canvas);
    const win = Kit.$('.window', canvas);
    onReplay(canvas, async () => {
      reset();
      await later(450);
      const card = Kit.$('.uf-card[data-uid="u-rec"]', canvas);
      Kit.flyTo(card, rowOf(canvas, 'acme'), { markup: flyChip(icon('waveform'), 'Untitled recording') });
      Kit.removeAnimated(card);
      Kit.toast('Filed to Acme · Implementation', { icon: 'folder', container: win, action: { label: 'Undo', onClick: reset } });
    });
  };

  Catalog.section({
    id: 'pages',
    eyebrow: 'Layer 3 · Review, Found in Calendar',
    title: 'Pages',
    intro: 'The sidebar’s other destinations: Review (meetings with items to accept, correct or reject, and recordings or files that need filing) and Found in Calendar (recurring patterns Telu noticed), plus search and the empty states. Rendered from 002’s T.pages functions.',
    css: `
      .pgc { width: min(720px, 100%); margin: 0 auto; }
      .pg-empty-box { width: 100%; min-height: 300px; display: flex; flex-direction: column; }
      .pg-glass { padding: 22px 28px; border-radius: 22px; background: var(--glass-strong); backdrop-filter: blur(34px) saturate(1.8); -webkit-backdrop-filter: blur(34px) saturate(1.8); box-shadow: var(--shadow-window); }
      .pg-toolbar-host { position: absolute; top: 14px; right: 16px; }
      .pg-fly { padding-top: 10px; }
      .pg-fly .a-pcards { margin-top: 0; }
    `,
    components: [
      {
        id: 'page-header',
        name: 'PageHeader',
        summary: 'Large page title with one line of explanation, on pages that read like a document (Found in Calendar).',
        mapsTo: 'Plain component (h1.t-large + p)',
        usedIn: ['Found in Calendar'],
        source: '002 app-pages.js pageHead · .pg-head',
        props: [['title', 'string', '—'], ['description', 'string', '—']],
        states: ['default', 'wrapped (narrow)'],
        tokens: ['--font-display', '--label', '--label-2'],
        motion: 'None of its own; the page fades in on navigation (opacity 0→1 + blur 2px→0, 200ms --ease-out, T.fx.fadeIn). Reduced motion: no fade. framer-motion: page-level motion.div fade.',
        a11y: 'The page’s h1; the description is its aria-describedby.',
        stories: [
          { label: 'Found in Calendar', span: 3, html: () => pgc(pick(found(), '.pg-head')) },
          { label: 'Narrow', note: 'Description wraps', span: 1, html: () => pick(found(), '.pg-head') }
        ]
      },
      {
        id: 'day-group-header',
        name: 'DayGroupHeader',
        summary: 'Inline section header aligned with the cards (past the time column): a bold title and a faint description that truncates. Heads each Upcoming day and the Review page’s two sections.',
        mapsTo: 'Plain component (h2 + span)',
        usedIn: ['Upcoming (days)', 'Review (To review, Needs filing)'],
        source: '002 app-pages.js daySection · reviewMarkup · .a-day-head',
        props: [['title', 'string', '—'], ['description', 'string (count · explanation or long date)', '—']],
        states: ['day', 'count', 'explanation', 'truncated'],
        tokens: ['--a-time-w', '--label', '--label-3'],
        motion: 'None. The To review count updates in place as items are decided (text swap, no animation). Reduced motion → n/a · framer-motion → none.',
        a11y: 'h2 with the description as plain text; count changes announced through the Review toolbar status.',
        stories: [
          { label: 'Upcoming day', span: 2, html: () => col(pick(scene('before', () => T.pages.upcomingMarkup()), '.a-day-head')) },
          { label: 'To review', note: 'Live item count', span: 2, html: () => col(pick(review(), '.a-day-head')) },
          { label: 'Needs filing', span: 2, html: () => col(pick(review(), '.pg-filing .a-day-head')) },
          { label: 'Truncated', note: 'Narrow column', span: 1, html: () => col(pick(review(), '.pg-filing .a-day-head')) }
        ]
      },
      {
        id: 'review-meeting-row',
        name: 'ReviewMeetingRow',
        summary: 'A meeting with items still to review, as it appears on the Review page: an EventRow with the day label above the time and the amber “N to review” chip. Selecting it opens the side peek on the review; once everything is decided the row leaves the list.',
        mapsTo: 'EventRow (withDay) in a list; peek opens the review',
        usedIn: ['Review'],
        source: '002 app-pages.js reviewItems · reviewMarkup · app-actions.js T.pagesAfterReview',
        props: [['event', 'CalendarEvent (kind review)', '—'], ['pending', 'number', '—'], ['withDay', 'true', 'true']],
        states: ['pending', 'hover (Review revealed)', 'selected', 'all reviewed (filed)', 'leaving'],
        tokens: ['--amber', '--amber-soft', '--a-time-w'],
        motion: 'After the last pending item is accepted or rejected: a 500ms beat, then Kit.removeAnimated — height, padding and margin collapse to 0 with opacity 1→0, 220ms --ease-out (WAAPI, overflow hidden during the collapse); when no rows remain the page re-renders to “All caught up”. The “N to review” chip crossfades as the count drops (T.morphCard). Reduced motion: the row is removed instantly. framer-motion: <AnimatePresence> around rows with exit={{height: 0, opacity: 0, marginTop: 0, marginBottom: 0, transition: {duration: 0.22, ease: [0.23, 1, 0.32, 1], delay: 0.5}}}.',
        a11y: 'Option in the Review listbox; the chip text (“3 to review”) is part of its accessible name; removal is announced by the toolbar count.',
        stories: [
          { label: 'Pending · yesterday', note: 'Interview · R. Gomez', span: 2, html: () => col(reviewRow('m2', 0)) },
          { label: 'Pending · today', note: 'After · Product Sync', span: 2, html: () => col(reviewRow('t2', 1, 'after')) },
          { label: 'Hover', note: 'Review revealed', span: 2, force: 'hover', html: () => col(forceOn(reviewRow('m2', 0))) },
          { label: 'Selected', note: 'Its review is open in the peek', span: 2, html: () => col(reviewRow('m2', 0, 'before', SET.select('m2'))) },
          { label: 'All reviewed', note: 'Filed — about to leave the list', span: 2, html: () => col(reviewRow('m2', 0, 'before', SET.reviewed('hi-5'))) },
          { label: 'Leaves the list', note: 'Replay: 500ms beat, then collapse (Kit.removeAnimated 220ms)', span: 2, html: () => col(`<div class="a-timeline">${reviewRow('m2', 0, 'before', SET.reviewed('hi-5'))}${reviewRow('t2', 1, 'after')}</div>`) + replayBtn(), mount: (canvas) => removeAndRestore(canvas, '.a-row', 500) },
          { label: 'To review group', note: 'After · two meetings', span: 'full', html: () => col(pick(review('after'), '.a-day')) }
        ]
      },
      {
        id: 'unfiled-card',
        name: 'UnfiledCard',
        summary: 'A recording or file Telu couldn’t place with confidence. Shows what it is and when, Telu’s best guess (“Telu thinks this belongs in … — why”) with File there, and Choose… for any other series. Recordings can be played.',
        mapsTo: 'Custom card (shadcn Card) + Buttons · Choose… opens SeriesPickerMenu · lucide AudioWaveform, FileText, Play, ArrowDownToLine',
        usedIn: ['Review · Needs filing', 'Side peek (unfiled item)'],
        source: '002 app-pages.js T.pages.unfiledCard · app-actions.js T.fileUnfiled · fileThere · fileChoose · .uf-card',
        props: [['item', 'Unfiled { kind: recording | doc, title, when, duration?, suggestion? { series, why } }', '—'], ['selected', 'boolean', 'false'], ['onFileThere / onChoose / onPlay', '() => void', '—']],
        states: ['recording + suggestion', 'document + suggestion', 'no confident match', 'hover', 'pressed', 'selected', 'hover File there', 'filed (leaving)'],
        tokens: ['--surface', '--shadow-card', '--shadow-card-hover', '--accent-softer', '--fill', '--label-2', '--accent'],
        motion: 'Hover: shadow → --shadow-card-hover 200ms ease; press scale(0.992) 160ms --ease-out (CSS). File there / Choose… → a .fly-chip (waveform or doc glyph + title) flies to the series row (FlyChip in Overlays: Kit.flyTo 560ms, the row then flashes and its icon bumps) while the card collapses: Kit.removeAnimated height/padding/margin → 0 + opacity → 0, 220ms --ease-out (WAAPI); the toast “Filed to …” offers Undo, which re-renders the list. When nothing is left to file the page re-renders. Reduced motion: removed instantly, no fly. framer-motion: <AnimatePresence> exit {height: 0, opacity: 0, transition: {duration: 0.22, ease: [0.23, 1, 0.32, 1]}} + FlyChip.',
        a11y: 'article with the title as heading; the suggestion is text, not a tooltip; buttons “File there”, “Choose…” (opens a menu) and an icon button aria-label="Play"; selection ring mirrors aria-selected in the Review listbox.',
        stories: [
          { label: 'Recording · suggestion', note: 'Untitled recording → Acme · Implementation', span: 2, html: () => col(unfiled('u-rec')) },
          { label: 'Document · suggestion', note: 'Offsite notes.md → Board Prep', span: 2, html: () => col(unfiled('u-doc')) },
          { label: 'No confident match', note: 'Only Choose…', span: 2, html: () => col(unfiled('u-rec', { suggestion: null })) },
          { label: 'Hover', span: 2, force: 'hover', html: () => col(forceOn(unfiled('u-rec'), '<div class="card interactive uf-card"')) },
          { label: 'Pressed', span: 2, force: 'active', html: () => col(forceOn(unfiled('u-doc'), '<div class="card interactive uf-card"')) },
          { label: 'Selected', note: 'Accent ring (peek open)', span: 2, html: () => col(unfiled('u-rec').replace('uf-card"', 'uf-card is-selected"')) },
          { label: 'Hover · File there', span: 2, force: 'hover', html: () => col(forceOn(unfiled('u-rec'), 'data-act="file-there"')) },
          { label: 'Filed · leaves the list', note: 'Replay: collapse (220ms) + toast', span: 2, html: () => `<div class="card-list cal-col">${unfiled('u-rec')}${unfiled('u-doc')}</div>${replayBtn()}`, mount: (canvas) => { removeAndRestore(canvas, '.uf-card'); onReplay(canvas, () => Kit.toast('Filed to Acme · Implementation', { icon: 'folder', container: canvas, action: { label: 'Undo', onClick: () => {} } })); } },
          { label: 'Needs filing group', note: 'Header + list, as on Review', span: 'full', html: () => col(pick(review(), '.pg-filing')) },
          { label: 'File there · lands in the series', note: 'Replay: the waveform chip flies to Acme · Implementation (receive + bump) while the card collapses; toast with Undo', span: 'full', flush: true, html: () => flyStage(`<div class="card-list">${unfiled('u-rec')}${unfiled('u-doc')}</div>`, ['product-sync', 'maria', 'acme', 'board']), mount: fileDemo }
        ]
      },
      {
        id: 'proposal-card',
        name: 'ProposalCard',
        summary: 'One pattern Telu noticed in the calendar, decided once: a new recurring meeting to track as a series, an event that looks like part of an existing series, or a quiet, less likely suggestion. Deciding removes the card for good.',
        mapsTo: 'Custom card (shadcn Card) + Buttons · lucide Sparkles, Link, Repeat · Avatar group',
        usedIn: ['Found in Calendar'],
        source: '002 app-pages.js proposalCard · app-flows.js decideProposal · PROPOSAL_EFFECTS · .a-pcard',
        props: [['proposal', 'Proposal { kind: new | join, title, rule | when, calendar, people, extra, reason, target?, quiet? }', '—'], ['onTrack / onDismiss / onJoin / onSeparate', '() => void', '—']],
        states: ['new series', 'join a series', 'quiet (less likely)', 'hover primary', 'pressed primary', 'decided (leaving)'],
        tokens: ['--surface', '--shadow-card', '--accent-strong', '--fill-2', '--label-2', '--label-3', '--hairline'],
        motion: 'Decide (any button) → the card stops taking pointer events and collapses: Kit.removeAnimated height/padding/margin → 0 + opacity 1→0, 220ms --ease-out (WAAPI). Track as series also grows the new sidebar row (height 0→h + opacity 0→1, 280ms --ease-out, Kit.enterAnimated) and flies a .a-fly series pill into it; Add to … flies a link .fly-chip to the target series row (FlyChip in Overlays: 560ms, x on cubic-bezier(0.45, 0, 0.2, 1), y/scale/opacity on cubic-bezier(0.6, 0, 0.9, 0.7), then the row flashes .receive 900ms and its icon bumps 420ms). When the last card goes, “You’re all caught up” replaces the list and fades in (opacity 0→1 + blur 2px→0, 220ms --ease-out). Each decision shows a toast (Undo where reversible). Reduced motion: removed instantly, no fly, no fade. framer-motion: <AnimatePresence> with exit={{height: 0, opacity: 0, transition: {duration: 0.22, ease: [0.23, 1, 0.32, 1]}}}; empty state initial={{opacity: 0, filter: "blur(2px)"}} animate={{opacity: 1, filter: "blur(0px)"}}.',
        a11y: 'article labelled by the title with the kind line as its description; primary action first in tab order; avatars have names as titles (use aria-label on the group, “+2 more”).',
        stories: [
          { label: 'New recurring meeting', note: 'Track as series · Not a series', span: 2, html: () => col(pick(found(), '[data-proposal="pr-growth"]')) },
          { label: 'Part of a series', note: 'Add to Acme · Implementation · Keep separate', span: 2, html: () => col(pick(found(), '[data-proposal="pr-acme-sso"]')) },
          { label: 'Quiet · less likely', note: 'Track anyway · Stop suggesting', span: 2, html: () => col(pick(found(), '[data-proposal="pr-standup"]')) },
          { label: 'Hover · Track as series', span: 2, force: 'hover', html: () => col(forceOn(pick(found(), '[data-proposal="pr-growth"]'), 'data-act="prop-track"')) },
          { label: 'Pressed · Add to series', span: 2, force: 'active', html: () => col(forceOn(pick(found(), '[data-proposal="pr-acme-sso"]'), 'data-act="prop-join"')) },
          { label: 'Decided · leaves the list', note: 'Replay: Kit.removeAnimated 220ms, then back', span: 2, html: () => `<div class="a-pcards cal-col">${pick(found(), '[data-proposal="pr-growth"]')}${pick(found(), '[data-proposal="pr-acme-sso"]')}</div>${replayBtn()}`, mount: (canvas) => removeAndRestore(canvas, '[data-proposal]') },
          { label: 'Decisions land in the sidebar', note: 'Replay: Add to Acme · Implementation (link chip → Acme row), then Track as series (new row grows in, series pill lands); cards collapse, toasts offer Undo', span: 'full', flush: true, html: () => flyStage(`<div class="a-pcards">${pick(found(), '[data-proposal="pr-acme-sso"]')}${pick(found(), '[data-proposal="pr-growth"]')}</div>`, ['product-sync', 'maria', 'acme']), mount: decideDemo }
        ]
      },
      {
        id: 'caught-up',
        name: 'CaughtUp',
        summary: 'Inline empty state that replaces the proposal list once every suggestion is decided.',
        mapsTo: 'Empty state component (icon badge + title + text)',
        usedIn: ['Found in Calendar'],
        source: '002 app-pages.js caughtUp · .a-caught',
        props: [['title', 'string', 'You’re all caught up'], ['text', 'string', '—']],
        states: ['shown', 'fading in'],
        tokens: ['--accent-soft', '--accent', '--label', '--label-2'],
        motion: 'Replaces the list after the last card collapses and fades in: opacity 0→1 + blur 2px→0, 220ms --ease-out (T.fx.fadeIn, WAAPI). Reduced motion: appears instantly. framer-motion: motion.div initial={{opacity: 0, filter: "blur(2px)"}} animate={{opacity: 1, filter: "blur(0px)"}} transition={{duration: 0.22, ease: [0.23, 1, 0.32, 1]}}.',
        a11y: 'role="status" so reaching zero is announced; the badge icon is decorative.',
        stories: [
          { label: 'Caught up', span: 2, html: () => T.pages.caughtUp() },
          { label: 'Fade in', note: 'Replay: T.fx.fadeIn 220ms', span: 2, html: () => T.pages.caughtUp() + replayBtn(), mount: (canvas) => onReplay(canvas, () => T.fx.fadeIn(Kit.$('.a-caught', canvas), { duration: 220 })) },
          { label: 'In the page', note: 'Found in Calendar after every decision', span: 'full', html: () => found(noProposals) }
        ]
      },
      {
        id: 'empty-page',
        name: 'EmptyPage',
        summary: 'Full-page empty states centred in the content area: a tinted icon badge, a title and one line of guidance, optionally with actions — Review with nothing left, Upcoming without a calendar, and the first-run welcome in the main window.',
        mapsTo: 'Empty state component (icon badge | app icon, h3, p, actions)',
        usedIn: ['Review', 'Upcoming', 'Today (first run)'],
        source: '002 app-pages.js emptyPage · firstRunMarkup · .a-first · .a-empty-badge · .pg-welcome',
        props: [['icon', 'lucide icon | app icon', '—'], ['title', 'string', '—'], ['text', 'string', '—'], ['actions', 'Button[]', '—'], ['note', 'PrivacyNote', '—']],
        states: ['all caught up', 'no calendar', 'welcome'],
        tokens: ['--accent-soft', '--accent', '--label', '--label-2', '--label-3'],
        motion: 'None of its own; arrives with the view fade (200ms). Reduced motion → no fade. framer-motion: page-level fade.',
        a11y: 'Heading level 3 inside the page; the primary action (Set up Telu) receives focus when the window opens on first run.',
        stories: [
          { label: 'Review · all caught up', span: 2, html: () => `<div class="pg-empty-box">${review('before', cleared)}</div>` },
          { label: 'Upcoming · no calendar', span: 2, html: () => `<div class="pg-empty-box">${scene('first', () => T.pages.upcomingMarkup())}</div>` },
          { label: 'Welcome · first run', note: 'Main window before setup', span: 2, html: () => `<div class="pg-empty-box">${T.pages.firstRunMarkup()}</div>` },
          { label: 'Welcome · hover Set up Telu', span: 2, force: 'hover', html: () => `<div class="pg-empty-box">${forceOn(T.pages.firstRunMarkup(), 'data-act="setup"')}</div>` },
          { label: 'In context · first run', note: 'Stepper disabled until a calendar is connected', span: 'full', flush: true, html: () => scene('first', () => frame(toolbar({ b: 'Today', span: 'Tuesday, 29 September', prev: false, next: false }), T.pages.firstRunMarkup(), 520)), mount: wireFrame }
        ]
      },
      {
        id: 'privacy-note',
        name: 'PrivacyNote',
        summary: 'The quiet “on this Mac” reassurance with a lock glyph, in three sizes: a centred page footnote, an inline caption under an action, and the onboarding panel’s footer line.',
        mapsTo: 'Small text component with lucide Lock',
        usedIn: ['Found in Calendar', 'Welcome', 'Onboarding welcome'],
        source: '002 app-pages.js .pg-foot · .a-local · app-onboard.js .ob-privacy',
        props: [['variant', 'footnote | caption | panel', 'footnote'], ['text', 'string', '—']],
        states: ['default'],
        tokens: ['--label-3'],
        motion: 'None. Reduced motion → n/a · framer-motion → none.',
        a11y: 'Plain text; the lock icon is aria-hidden.',
        stories: [
          { label: 'Footnote', note: 'Found in Calendar', span: 2, html: () => pick(found(), '.pg-foot') },
          { label: 'Caption', note: 'Welcome', span: 2, html: () => pick(T.pages.firstRunMarkup(), '.a-local') },
          { label: 'Panel', note: 'Onboarding welcome', bg: 'wallpaper', span: 2, html: `<div class="pg-glass"><div class="ob-privacy">${icon('lock')}Processed on this Mac · nothing is uploaded</div></div>` }
        ]
      },
      {
        id: 'search-popover',
        name: 'SearchPopover',
        summary: 'Agenda search from the toolbar (⌘F): with no query it lists the first six series; typing matches series by name or person and memory items by text (five at most), grouped under Series and In memory. Enter or a click opens the series’ living doc.',
        mapsTo: 'cmdk (Command inside a Radix Popover) · CommandGroup “Series” / “In memory” · CommandEmpty · lucide Search',
        usedIn: ['Agenda toolbar search', 'Living doc toolbar', 'Edit › Find… ⌘F'],
        source: '002 app-flows.js T.openSearch · searchResults · seriesHit · memoryHit · .a-search',
        props: [['query', 'string', '""'], ['series', 'Series[] (tracked)', '—'], ['onOpen', '(seriesId) => void', '—']],
        states: ['hint (no query)', 'series + memory hits', 'memory only', 'no matches', 'nothing to search', 'row hover', 'input focus'],
        tokens: ['--glass-strong', '--shadow-float', '--fill', '--label-3', '--accent (focus ring)', 'ktype colours'],
        motion: 'Open: opacity 0→1 150ms --ease-out + scale 0.96→1 190ms --ease-out from the trigger; close 110ms (CSS transitions). Results re-render on every keystroke with no animation; row hover background snaps (fine pointers). Reduced motion: opacity only. framer-motion: PopoverContent motion.div initial {opacity: 0, scale: 0.96} animate {opacity: 1, scale: 1}; cmdk list without item animation.',
        a11y: 'cmdk gives role="combobox" + listbox semantics: ↑/↓ move, Enter opens, Esc closes; the input is labelled “Search series, people, decisions”; group headings are cmdk group labels; the empty text is CommandEmpty (announced).',
        stories: [
          { label: 'Hint · no query', note: 'First six series', bg: 'wallpaper', span: 2, height: 340, html: () => searchPopover('') },
          { label: 'Series + memory', note: '“maria”', bg: 'wallpaper', span: 2, height: 340, html: () => searchPopover('maria') },
          { label: 'Memory only', note: '“soc”', bg: 'wallpaper', span: 2, height: 200, html: () => searchPopover('soc') },
          { label: 'No matches', note: '“roadmap zebra”', bg: 'wallpaper', span: 2, height: 200, html: () => searchPopover('roadmap zebra') },
          { label: 'Nothing to search', note: 'First run · no series yet', bg: 'wallpaper', span: 2, height: 200, html: () => searchPopover('', { sc: 'first' }) },
          { label: 'Row hover', bg: 'wallpaper', span: 2, height: 340, force: 'hover', html: () => searchPopover('', { hoverFirst: true }) },
          {
            label: 'Live · search', note: 'Click the search button and type (try “dana” or “pricing”)', span: 'full', flush: true,
            html: () => `<div class="desktop cat-desk panel-host" style="height: 420px;"><div class="pg-toolbar-host"><div class="glass-group"><button class="btn a-new-btn" data-act="new-series">${icon('plus')}New<span class="kbd">⌥⌘N</span></button><span class="sep"></span><button class="btn icon" data-act="search" data-tip="Search">${icon('search')}</button></div></div></div>`,
            mount: searchDemo
          }
        ]
      },
      {
        id: 'review-page',
        name: 'ReviewPage',
        summary: 'In context: the Review destination — meetings with items to review (with their day), then Needs filing. The toolbar title counts everything that needs a look.',
        mapsTo: 'Page composition (Next.js route): DayGroupHeader + ReviewMeetingRow list + UnfiledCard list',
        usedIn: ['Sidebar · Review'],
        source: '002 app-pages.js reviewMarkup · app-shell.js titleFor',
        states: ['before (5 items)', 'after (10 items)', 'all caught up'],
        tokens: ['--content-bg'],
        motion: 'Page fades in on navigation (200ms, T.fx.fadeIn); rows and cards leave with Kit.removeAnimated (220ms; rows after a 500ms beat); the page re-renders to All caught up when empty. Reduced motion: instant.',
        a11y: 'main landmark; two sections with h2; the toolbar subtitle is a polite live region for the count.',
        stories: [
          { label: 'Before · 9:41', span: 'full', flush: true, html: () => scene('before', () => { const [b, span] = titleFor('review'); return frame(toolbar({ b, span }), T.pages.reviewMarkup(), 620); }), mount: wireFrame },
          { label: 'After · 10:46', note: 'Product Sync joins with 5 items', span: 'full', flush: true, html: () => scene('after', () => { const [b, span] = titleFor('review'); return frame(toolbar({ b, span }), T.pages.reviewMarkup(), 720); }), mount: wireFrame },
          { label: 'All caught up', span: 'full', flush: true, html: () => scene('before', () => frame(toolbar({ b: 'Review', span: 'All caught up' }), T.pages.reviewMarkup(), 460), cleared), mount: wireFrame }
        ]
      },
      {
        id: 'found-page',
        name: 'FoundPage',
        summary: 'In context: Found in Calendar — the page header, loud proposals, a “Less likely” group and the privacy footnote. Live: decide any card to watch it collapse, then the caught-up state fade in; Replay restores the page.',
        mapsTo: 'Page composition (Next.js route): PageHeader + ProposalCard list + PrivacyNote',
        usedIn: ['Sidebar · Found in Calendar', 'ProposalsBanner · Review'],
        source: '002 app-pages.js foundMarkup · app-flows.js decideProposal',
        states: ['3 suggestions', 'deciding', 'caught up'],
        tokens: ['--content-bg'],
        motion: 'See ProposalCard and CaughtUp: collapse 220ms --ease-out, then caught-up fade 220ms; toolbar count text swaps instantly. Reduced motion: instant.',
        a11y: 'main landmark with h1; “Less likely” is a group label (t-eyebrow) for the quiet suggestions.',
        stories: [
          { label: 'Live · decide suggestions', note: 'Click any action · Replay restores', span: 'full', flush: true, html: () => scene('before', () => { const [b, span] = titleFor('found'); return frame(toolbar({ b, span }), T.pages.foundMarkup(), 700); }) + replayBtn(), mount: wireFound },
          { label: 'Caught up', span: 'full', flush: true, html: () => scene('before', () => frame(toolbar({ b: 'Found in Calendar', span: 'Nothing new' }), T.pages.foundMarkup(), 420), noProposals), mount: wireFrame }
        ]
      }
    ]
  });
})();
