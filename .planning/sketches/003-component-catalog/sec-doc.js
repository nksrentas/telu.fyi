(() => {
  const D = T.doc;
  const e = Catalog.esc;

  const inState = (scenario, setup, fn) => Catalog.withScenario(scenario, () => {
    if (setup) setup();
    return fn();
  });
  const viewDoc = (sid) => T.set({ view: { kind: 'doc', seriesId: sid, from: { kind: 'day', dayIndex: T.TODAY, label: 'Today' } } });
  const series = (sid) => T.seriesById(sid);
  const nextOf = (sid) => D.pageNextMeeting(series(sid));
  const fromProposal = (id) => T.seriesFromProposal(DATA.proposals.find((p) => p.id === id));
  const draft = () => T.draftSeries(1);
  const withDraft = () => T.set({ series: [...T.state.series, draft()] });

  const page = (inner, cls = '') => `<div class="doc-surface cd-page${cls}" data-surface="page">${inner}</div>`;
  const compact = (inner) => `<div class="doc-surface cd-compact" data-surface="peek">${inner}</div>`;
  const inNext = (inner, cls = '') => `<section class="doc-sec next${cls}">${inner}</section>`;
  const sandbox = (markup) => {
    const root = document.createElement('div');
    root.innerHTML = markup;
    return root;
  };
  const pick = (markup, selector) => (sandbox(markup).querySelector(selector) || { outerHTML: '' }).outerHTML;
  const edit = (markup, fn) => {
    const root = sandbox(markup);
    fn(root);
    return root.innerHTML;
  };
  const flag = (selector, attr = 'data-force') => (root) => root.querySelectorAll(selector).forEach((el) => el.setAttribute(attr, ''));
  const addClass = (selector, cls) => (root) => root.querySelectorAll(selector).forEach((el) => el.classList.add(cls));

  function capture(name, run) {
    const original = Kit[name];
    const calls = [];
    Kit[name] = (...args) => {
      calls.push(args);
      return null;
    };
    try {
      run();
    } finally {
      Kit[name] = original;
    }
    return calls;
  }
  const popover = (markup, opts = {}) => `<div class="cat-static"><div class="popover open ${opts.className || ''}" role="dialog"${opts.width ? ` style="width:${opts.width}px"` : ''}>${markup}</div></div>`;
  const menuRow = (item) => {
    if (item === '-') return '<div class="menu-sep"></div>';
    if (item.title) return `<div class="menu-title">${item.title}</div>`;
    const glyph = item.icon ? icon(item.icon) : item.swatch ? `<span class="series-dot" style="--c:${item.swatch}"></span>` : '';
    return `<div class="menu-item ${item.danger ? 'danger' : ''} ${item.disabled ? 'disabled' : ''}${item.active ? ' active' : ''}" role="menuitem">${glyph}<span class="truncate">${item.label}</span>${item.kbd ? `<span class="kbd">${item.kbd}</span>` : ''}</div>`;
  };
  const menu = (items, opts = {}) => `<div class="cat-static"><div class="menu" role="menu"${opts.minWidth ? ` style="min-width:${opts.minWidth}px"` : ''}>${items.map(menuRow).join('')}</div></div>`;
  const popFrom = (call) => (call ? popover(call[1], call[2]) : '');
  const menuFrom = (call, active) => (call ? menu(call[1].map((item, i) => (i === active ? { ...item, active: true } : item)), call[2]) : '');

  const recordInner = (live) => (live ? '<span class="rec-dot"></span><span class="num tb-timer" data-rec-timer>0:00</span><span>Stop</span>' : '<span class="rec-glyph"></span>Record<span class="kbd">⌘R</span>');
  const docToolbar = (s, { show = false, save = 'Saved', busy = false, live = false, inspector = false } = {}) => `<button class="btn sm plain tb-back" data-tip="Back · ⌘[">${icon('chevron-left')}<span>Today</span></button>`
    + `<div class="tb-title${show ? ' show' : ''}">${Kit.seriesIcon(s)}<b>${e(s.name || 'Untitled')}</b></div><span class="spacer"></span><span class="save-state${busy ? ' busy' : ''}">${save}</span>`
    + '<div class="glass-group">'
    + `<button class="btn icon" data-act="history" data-tip="History">${icon('history')}</button>`
    + `<button class="btn icon" data-act="share" data-tip="Export as Markdown">${icon('share')}</button><span class="sep"></span>`
    + `<button class="btn tb-record${live ? ' live' : ''}" data-act="tb-record">${recordInner(live)}</button>`
    + `<button class="btn icon" data-act="tb-more" data-tip="More">${icon('ellipsis')}</button></div>`
    + `<div class="glass-group"><button class="btn icon${inspector ? ' on' : ''}" data-act="inspector" id="tbInspector" data-tip="Details">${icon('inspector')}</button></div>`
    + '<i class="a-progress"></i>';
  const toolbarStrip = (s, opts) => `<div class="main cd-tb"><div class="toolbar${opts && opts.flat ? '' : ' scrolled'}">${docToolbar(s, opts)}</div></div>`;

  const replayBar = (labels = ['Replay']) => `<div class="cd-replay">${labels.map((label, i) => `<button class="btn sm" data-replay="${i}">${icon('play')}${e(label)}</button>`).join('')}</div>`;
  const onReplay = (...fns) => (canvas) => canvas.querySelector('.cd-replay').addEventListener('click', (event) => {
    const btn = event.target.closest('[data-replay]');
    if (btn) fns[Number(btn.dataset.replay)](canvas);
  });
  const restart = (el, cls) => {
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  };
  const segs = (canvas) => canvas.querySelectorAll('.seg').forEach((seg) => Kit.segmented(seg));
  const timers = (seconds) => (canvas) => canvas.querySelectorAll('[data-rec-timer]').forEach((el) => Kit.timer(el, seconds));
  const repaintOut = (block, markup) => {
    if (Kit.reduceMotion()) {
      block.innerHTML = markup;
      return;
    }
    const out = block.animate([{ opacity: 1, filter: 'blur(0px)' }, { opacity: 0, filter: 'blur(2px)' }], { duration: 120, easing: 'ease-out', fill: 'forwards' });
    out.finished.then(() => {
      block.innerHTML = markup;
      out.cancel();
      block.animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 200, easing: Kit.EASE_OUT });
    });
  };

  window.CatalogDoc = { inState, viewDoc, series, fromProposal, draft, withDraft, page, compact, pick, edit, flag, addClass, capture, popover, menuFrom, docToolbar, replayBar, onReplay, restart, segs };

  const header = (scenario, sid, tweak) => inState(scenario, null, () => page(tweak ? edit(D.headerMarkup(series(sid)), tweak) : D.headerMarkup(series(sid))));
  const docPop = (fn, sid, setup) => inState('before', () => { viewDoc(sid); if (setup) setup(); }, () => popFrom(capture('popover', () => fn(Kit.html('<button data-name="Q4 Roadmap.pdf"></button>')))[0]));
  const changeMenu = () => inState('before', () => viewDoc('product-sync'), () => {
    const host = document.body.appendChild(Kit.html('<div class="panel-host" hidden><button></button></div>'));
    try {
      return menuFrom(capture('menu', () => {
        D.rulePopover(host.firstElementChild);
        const change = host.querySelector('[data-pop="change"]');
        if (change) change.click();
      })[0], 2);
    } finally {
      host.remove();
    }
  });
  const purpose = (scenario, sid, setup, tweak) => inState(scenario, setup, () => {
    const markup = D.purposeMarkup(series(sid));
    return page(tweak ? edit(markup, tweak) : markup);
  });
  const growthPurpose = (tweak) => inState('before', () => T.set({ series: [...T.state.series, fromProposal('pr-growth')] }), () => page(tweak ? edit(D.purposeMarkup(series('growth')), tweak) : D.purposeMarkup(series('growth'))));
  const refRow = (s, tweak) => {
    const markup = `<div class="ref-row">${D.referenceInner(s)}</div>`;
    return page(tweak ? edit(markup, tweak) : markup);
  };
  const acceptSome = (ids) => () => {
    const found = T.findMeeting('ps-37');
    ids.forEach((cid) => T.mapSeries('product-sync', (s) => T.acceptCandidate(s, found.meeting, found.meeting.candidates.find((c) => c.id === cid))));
  };
  const memory = (scenario, sid, setup) => inState(scenario, setup, () => D.memoryMarkup(series(sid)));
  const group = (sid, type, setup, scenario = 'before') => inState(scenario, setup, () => `<div class="cd-col">${pick(D.memoryBody(series(sid)), `.mem-group[data-type="${type}"]`)}</div>`);
  const item = (sid, text, setup, scenario = 'before') => inState(scenario, setup, () => {
    const root = sandbox(D.memoryBody(series(sid)));
    const hit = [...root.querySelectorAll('.mem-item')].find((el) => el.querySelector('.mem-text').textContent === text);
    const type = hit ? hit.closest('.mem-group').dataset.type : 'decision';
    return `<div class="cd-col"><div class="mem-group" data-type="${type}">${hit ? hit.outerHTML : ''}</div></div>`;
  });
  const next = (scenario, sid, setup) => inState(scenario, setup, () => D.nextMarkup(series(sid), nextOf(sid)));
  const nextPart = (scenario, sid, selector, setup) => pick(next(scenario, sid, setup), selector);
  const nextGrid = (scenario, sid, setup) => pick(next(scenario, sid, setup), '.next-grid');
  const keepOnly = (...selectors) => (root) => root.querySelectorAll('.next > *').forEach((el) => { if (!selectors.some((sel) => el.matches(sel))) el.remove(); });
  const firstBlock = (root) => [...root.querySelectorAll('.p-block')].slice(1).concat([...root.querySelectorAll('.ref-row, .drop-hint')]).forEach((el) => el.remove());
  const both = (...fns) => (root) => fns.forEach((fn) => fn(root));
  const hiringIdle = () => T.mapSeries('hiring', (s) => ({ ...s, meetings: s.meetings.filter((m) => !T.util.isUpcoming(m)) }));
  const briefPatch = (patch) => () => T.mapMeeting('ps-37', (m) => ({ ...m, brief: { ...m.brief, ...patch(m.brief) } }));

  function wireAgenda(canvas) {
    canvas.addEventListener('toggle', (event) => {
      const row = event.target.closest('.agenda-item');
      if (row) row.classList.toggle('done', event.detail.checked);
    });
    canvas.addEventListener('keydown', (event) => {
      const input = event.target.closest('.agenda-input');
      if (!input || event.key !== 'Enter' || event.isComposing || !input.value.trim()) return;
      event.preventDefault();
      const list = canvas.querySelector('[data-agenda-list]');
      const row = Kit.html(D.agendaItem({ t: input.value.trim(), d: '' }, list.children.length));
      list.appendChild(row);
      Kit.enterAnimated(row);
      input.value = '';
    });
  }
  function wirePurposeAgenda(canvas) {
    canvas.addEventListener('keydown', (event) => {
      const t = event.target.closest('.p-agenda .ag-t');
      if (!t || event.isComposing) return;
      const row = t.closest('.ag-row');
      if (event.key === 'Enter') {
        event.preventDefault();
        const fresh = Kit.html(D.purposeAgendaRow({ t: '', d: '5 min' }));
        row.after(fresh);
        Kit.enterAnimated(fresh);
        fresh.querySelector('.ag-t').focus();
      }
      if (event.key === 'Backspace' && !t.textContent && row.parentElement.children.length > 1) {
        event.preventDefault();
        const prev = row.previousElementSibling || row.nextElementSibling;
        row.remove();
        prev.querySelector('.ag-t').focus();
      }
    });
  }
  const toggleReplay = (selector, cls, hold = 900) => onReplay((c) => {
    const el = c.querySelector(selector);
    el.classList.remove(cls);
    setTimeout(() => el.classList.add(cls), hold);
  });
  function wireDots(canvas) {
    canvas.addEventListener('click', (event) => {
      const dot = event.target.closest('.inc-dot');
      if (!dot) return;
      const off = !dot.classList.contains('off');
      dot.classList.toggle('off', off);
      const meeting = dot.dataset.act === 'toggle-meeting-doc';
      dot.dataset.tip = meeting ? (off ? 'Left out of this brief' : 'Included in this brief') : (off ? 'Not included in briefs' : 'Included in every brief');
    });
  }

  const CSS = `
    .cd-page { width: 720px; }
    .cd-page > .doc-sec:first-child, .cd-compact > .doc-sec:first-child { margin-top: 0; }
    .cd-compact { width: 408px; max-width: 100%; }
    .cd-col { width: 354px; max-width: 100%; }
    .cd-tb { width: 100%; height: 52px; flex: none; border-radius: 12px; overflow: hidden; }
    .cd-tb .toolbar { position: relative; }
    .cd-host { position: relative; }
    .cd-replay { position: absolute; top: 10px; right: 10px; z-index: 5; display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; }
    .cd-replay .btn .i { width: 11px; height: 11px; }
    .cd-stack { display: flex; flex-direction: column; gap: 14px; width: 100%; align-items: center; }
    .cd-row { display: flex; align-items: center; justify-content: center; gap: 28px; flex-wrap: wrap; }
  `;

  Catalog.section({
    id: 'doc',
    eyebrow: 'Layer 4 · Series page',
    title: 'Living doc',
    intro: 'Every series has one Notion-style living document: header, Purpose, Memory, the Next meeting and every past meeting. The same blocks render in the side peek with surface="peek"; below 600px of container width they switch to a compact layout.',
    css: CSS,
    components: [
      {
        id: 'doc-header',
        name: 'DocHeader',
        summary: 'Large editable title with the series icon, then meta chips: cadence link (opens the calendar-link popover), people (opens the attendee list), meeting count and a private lock. New docs show the Repeats control instead of chips.',
        mapsTo: 'Custom header · title = BlockNote heading or contentEditable · chips = Button (chip) + Radix Popover',
        usedIn: ['Living doc page'],
        source: '002 doc-render.js D.headerMarkup / D.metaMarkup (ruleChip, peopleChip, countChip, privateChip) · doc-popovers.js D.rulePopover, D.peoplePopover, changeMenu · doc.css .doc-head, .doc-title, .doc-meta, .meta-chip, .tb-title',
        props: [
          ['series', 'Series', '—'],
          ['source', 'calendar | manual', 'calendar'],
          ['private', 'boolean — lock chip', 'false'],
          ['count / since', 'number, string — or “New · first meeting …”', '—'],
          ['draft', 'boolean — Repeats control instead of chips', 'false'],
          ['onRename', '(name) => void (Enter commits; drafts parse cadence and people)', '—']
        ],
        states: ['calendar series', 'private', 'grouped by you', 'just tracked (new)', 'untitled draft', 'title focus', 'chip hover', 'chip pressed', 'calendar-link popover', 'people popover', 'follow a different event', 'title collapsed into toolbar'],
        tokens: ['--font-display', '--accent-softer', '--fill', '--fill-2', '--label-2', '--series-*'],
        motion: 'Title focus: background-color 150ms ease → var(--accent-softer). Chips: background/color 150ms ease on hover (fine pointers), :active scale(0.97) 140ms var(--ease-out); CSS transitions. Popovers: Kit.popover scale 0.96→1 190ms var(--ease-out) + opacity 150ms from the trigger (transform-origin = trigger centre); menus appear instantly, fade out 120ms. Large-title collapse: when #docTitle scrolls under the 52px toolbar (IntersectionObserver, rootMargin −toolbar-h) the toolbar title .tb-title goes opacity 0→1 and translateY(4px)→0 in 180ms var(--ease-out); reverse on the way back; CSS transition, interruptible. Reduced motion: transforms dropped, opacity only. framer-motion: <motion.div animate={{ opacity: show ? 1 : 0, y: show ? 0 : 4 }} transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }} /> driven by useInView on the title.',
        a11y: 'Title is an <h1> with contenteditable, spellcheck off, placeholder via data-placeholder (“Name this conversation”); Enter commits, Esc blurs. Chips are buttons that open popovers (aria-haspopup="dialog"); static chips are spans. Private chip carries a tooltip. Popovers are dialogs closed by Esc or outside click.',
        stories: [
          { label: 'Calendar series', note: 'Product Sync · repeat chip, 5 people, 36 meetings since Jan 2026', html: () => header('before', 'product-sync'), span: 'full' },
          { label: 'Private 1:1', note: 'Lock chip “Private · this Mac only” (hover for the tooltip)', html: () => header('before', 'maria'), span: 'full' },
          { label: 'Grouped by you', note: 'Manual series: folder chip instead of the calendar rule', html: () => header('before', 'hiring'), span: 'full' },
          { label: 'Just tracked', note: 'Growth Review from Found in Calendar: “New · first meeting Thu 1 Oct”', html: () => page(D.headerMarkup(fromProposal('pr-growth'))), span: 'full' },
          { label: 'Untitled draft', note: 'New doc: title placeholder and the Repeats control (see RepeatsControl)', html: () => inState('before', null, () => page(D.headerMarkup(draft()))), span: 'full', mount: segs },
          { label: 'Title editing', note: ':focus fill behind the title — click the title to type', html: () => header('before', 'product-sync', flag('.doc-title')), span: 'full', force: 'focus' },
          { label: 'Chip hover', note: 'Clickable chips on :hover (count and private chips are static)', html: () => header('before', 'product-sync', flag('button.meta-chip')), span: 'full', force: 'hover' },
          { label: 'Chip pressed', note: ':active scale 0.97', html: () => header('before', 'product-sync', flag('button.meta-chip')), span: 'full', force: 'active' },
          { label: 'Calendar link popover', note: 'Cadence chip → Linked to Calendar, rule, Change… / Unlink', html: () => docPop(D.rulePopover, 'product-sync'), bg: 'wallpaper', span: 2, height: 200 },
          { label: 'Grouped-by-you popover', note: 'Manual series explain themselves', html: () => docPop(D.rulePopover, 'hiring'), bg: 'wallpaper', span: 2, height: 200 },
          { label: 'People popover', note: 'Attendees with avatars; source in the footer', html: () => docPop(D.peoplePopover, 'product-sync'), bg: 'wallpaper', span: 2, height: 260 },
          { label: 'Follow a different event', note: 'Change… → menu of linkable calendar events (second row shown active)', html: changeMenu, bg: 'wallpaper', span: 2, height: 200 },
          { label: 'Title collapsed into the toolbar', note: 'Once the large title scrolls under the toolbar it fades into it. Replay toggles it.', html: () => inState('before', null, () => `${toolbarStrip(series('product-sync'), { show: true })}${replayBar(['Replay collapse'])}`), span: 'full', bg: 'window', height: 150, mount: onReplay((c) => {
            const title = c.querySelector('.tb-title');
            title.classList.remove('show');
            setTimeout(() => title.classList.add('show'), 700);
          }) }
        ]
      },
      {
        id: 'purpose-block',
        name: 'PurposeBlock',
        summary: 'The series’ purpose: Why we meet, What good looks like, Standing agenda (with minutes and total), Not for this meeting, then the Reference row. Every field is inline-editable; Telu builds every brief from it.',
        mapsTo: 'BlockNote custom blocks (purpose-why, outcomes list, agenda table, not-for) with autosave',
        usedIn: ['Living doc page'],
        source: '002 doc-render.js D.purposeMarkup / purposeHead / D.purposeVersion / D.purposeAgendaRow · doc-edit.js markEdited, scheduleSave, purposeAgendaKey, dropDraftedChip · doc.css .purpose, .p-block, .editable, .ver-bump, .drafted, .drop-hint',
        props: [
          ['purpose', '{ why, outcomes[], agenda[{ t, d }], notFor, version, edited, drafted, history[] }', '—'],
          ['edited', 'boolean — shows v(n+1) · just now', 'false'],
          ['dropTarget', 'boolean — files dragged over the block', 'false'],
          ['onChange', '(purpose) => void — autosave after 700ms', '—']
        ],
        states: ['read', 'field hover', 'editing (focus)', 'version bump', 'saving… / saved', 'drafted by Telu', 'empty (placeholders)', 'drop target'],
        tokens: ['--accent-softer', '--accent', '--fill', '--label-2', '--label-3', '--separator', '--shadow-float'],
        motion: 'Editable fields: background-color + box-shadow 150ms ease (hover fill, focus accent-softer + 1px inner ring). First keystroke: version meta text swaps to “v4 · just now” and plays .ver-bump — keyframes 420ms var(--ease-out) from opacity 0, translateY(3px) (one-shot; restart by re-adding the class); the drafted chip leaves via WAAPI opacity 1→0 + scale(0.96) in 160ms ease-out, then is removed. Save indicator: “Saving…” immediately (color label-2, 150ms ease), “Saved” 700ms after the last keystroke (debounced); the first save also toasts. Standing agenda: Enter inserts a row with Kit.enterAnimated (WAAPI height 0→auto + opacity, 280ms var(--ease-out)); Backspace on an empty row removes it instantly. File drag over the block: dashed accent outline (::after) opacity 150ms ease and the “Drop to add to Reference” pill opacity 150ms + translateY(4px) scale(0.97)→none 200ms var(--ease-out). Reduced motion: ver-bump and enter height skipped, drafted chip removed instantly. framer-motion: key the version label and use initial={{ opacity: 0, y: 3 }}; AnimatePresence for the drafted chip (exit scale 0.96); layout animation for agenda rows.',
        a11y: 'Each field is contenteditable with a visible label (“Why we meet” …) — expose aria-label and aria-multiline where relevant; Enter blurs single-line fields, Esc blurs any field. History is a button (opens a dialog). Save state should be an aria-live="polite" region in the toolbar.',
        stories: [
          { label: 'Read', note: 'Product Sync · v3 · edited Sep 18 · History. In the standing agenda, Enter adds a row (enter animation) and Backspace on an empty row removes it.', html: () => purpose('before', 'product-sync'), span: 'full', mount: wirePurposeAgenda },
          { label: 'Field hover', note: 'Editable fields get a fill on hover (first field shown)', html: () => purpose('before', 'product-sync', null, both(firstBlock, flag('.p-why'))), span: 'full', force: 'hover' },
          { label: 'Editing', note: 'Focused field (accent-softer + inner ring); meta already reads v4 · just now. Click any field to type.', html: () => purpose('before', 'product-sync', () => T.set({ edited: { 'product-sync': true } }), both(firstBlock, flag('.p-why'))), span: 'full', force: 'focus' },
          { label: 'Version bump', note: 'First edit bumps the version with a 420ms rise. Replay re-runs it.', html: () => `${purpose('before', 'product-sync', () => T.set({ edited: { 'product-sync': true } }), both(firstBlock, addClass('#purposeMeta', 'ver-bump')))}${replayBar(['Replay bump'])}`, span: 'full', mount: onReplay((c) => restart(c.querySelector('.sec-meta'), 'ver-bump')) },
          { label: 'Drafted by Telu', note: 'Tracked from Found in Calendar: v1 · drafted just now + “Drafted from the calendar invite — make it yours”. Replay plays the chip leaving on first edit.', html: () => `${growthPurpose()}${replayBar(['Replay dismiss'])}`, span: 'full', mount: onReplay((c) => {
            const chip = c.querySelector('.drafted');
            if (Kit.reduceMotion()) return;
            chip.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(0.96)' }], { duration: 160, easing: 'ease-out', fill: 'forwards' }).finished.then((a) => setTimeout(() => a.cancel(), 700));
          }) },
          { label: 'Empty', note: 'New doc: placeholder prompts in every field, “Draft”, Reference with only Add', html: () => inState('before', null, () => page(D.purposeMarkup(draft()))), span: 'full' },
          { label: 'Drop target', note: 'Files dragged over the block: dashed outline + “Drop to add to Reference”. Replay clears it and brings it back.', html: () => `${purpose('before', 'product-sync', null, addClass('#sec-purpose', 'drop-target'))}${replayBar()}`, span: 'full', height: 620, mount: toggleReplay('.purpose', 'drop-target') },
          { label: 'Autosave state', note: 'Toolbar indicator: “Saving…” while typing (busy), “Saved” 700ms after the last keystroke', html: () => inState('before', null, () => `<div class="cd-stack">${toolbarStrip(series('product-sync'), { save: 'Saving…', busy: true })}${toolbarStrip(series('product-sync'))}</div>`), span: 'full', bg: 'window' }
        ]
      },
      {
        id: 'history-popover',
        name: 'HistoryPopover',
        summary: 'Two history popovers. Purpose history lists versions (current one tagged). Doc history (toolbar clock) lists recent activity: filed meetings and purpose edits.',
        mapsTo: 'Radix Popover (align end)',
        usedIn: ['PurposeBlock · History', 'Doc toolbar · History'],
        source: '002 doc-popovers.js D.purposeHistoryPopover (histRow) · D.docHistoryPopover (activity) · doc.css .hist-row, .act-row, .pop-title, .pop-foot',
        props: [
          ['kind', 'purpose | doc', 'purpose'],
          ['rows', '{ v, date, note, current }[] | { when, note, icon }[]', '—'],
          ['width', '310 (purpose) · 330 (doc)', '—']
        ],
        states: ['versions', 'after an edit (v4 · Just now)', 'activity', 'empty'],
        tokens: ['--glass-strong', '--shadow-float', '--accent-strong', '--separator', '--label-3'],
        motion: 'Kit.popover: opacity 0→1 150ms var(--ease-out) + scale 0.96→1 190ms var(--ease-out) from the trigger; close 110ms (both). CSS transitions on .popover.open / .closing. Reduced motion: opacity only. framer-motion: Radix Popover.Content with motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} style={{ transformOrigin: "var(--radix-popover-content-transform-origin)" }}.',
        a11y: 'role="dialog" popover; Esc and outside click close; rows are static text (not focusable); the current version is marked with a “Current” chip (add aria-current).',
        stories: [
          { label: 'Purpose history', note: 'v3 current, v2, v1', html: () => docPop(D.purposeHistoryPopover, 'product-sync'), bg: 'wallpaper', span: 2, height: 250 },
          { label: 'After an edit', note: 'Unsaved-by-version edit shows as v4 · Just now · Edited by you', html: () => docPop(D.purposeHistoryPopover, 'product-sync', () => T.set({ edited: { 'product-sync': true } })), bg: 'wallpaper', span: 2, height: 280 },
          { label: 'Doc history', note: 'Toolbar clock: filed meetings and purpose versions, newest first', html: () => docPop(D.docHistoryPopover, 'product-sync'), bg: 'wallpaper', span: 2, height: 340 },
          { label: 'Doc history · empty', note: 'New doc', html: () => docPop(D.docHistoryPopover, 'new-1', withDraft), bg: 'wallpaper', span: 2, height: 180 }
        ]
      },
      {
        id: 'reference-row',
        name: 'ReferenceRow',
        summary: 'Reference files of the series. Each chip has an include dot (accent = included in every brief, ring = left out). Clicking a chip opens its popover; + Add opens recent files.',
        mapsTo: 'Chip list · Radix Popover (file) with Switch · Radix DropdownMenu (Add)',
        usedIn: ['PurposeBlock'],
        source: '002 doc-render.js D.referenceInner (refChip) · doc-popovers.js D.refPopover, D.addRefMenu, setInclude, removeRef · doc-edit.js D.attachToPurpose (chip-in) · doc.css .ref-row, .inc-dot, .add-chip, .chip-in',
        props: [
          ['docs', '{ name, ver, size, added, include }[]', '[]'],
          ['onToggleInclude', '(name, include) => void', '—'],
          ['onAdd', '(files) => void', '—'],
          ['onRemove', '(name) => void (Undo toast)', '—']
        ],
        states: ['included', 'left out', 'chip hover', 'chip pressed', 'new chip (chip-in)', 'empty', 'file popover · included', 'file popover · left out', 'add menu'],
        tokens: ['--accent', '--fill', '--fill-2', '--label-3', '--separator'],
        motion: 'Chips: :active scale(0.97) 140ms var(--ease-out); background 150ms ease on hover. Include dot: background-color + box-shadow 150ms ease (filled ↔ 1.3px ring). New chips: .chip-in keyframes 280ms var(--ease-out) both, from opacity 0 + translateY(3px) scale(0.95), staggered 40ms via animation-delay. Remove: WAAPI opacity→0 + scale(0.95) 150ms ease-out, then removed; Undo re-renders the row. Reduced motion: chip-in and remove are instant. framer-motion: AnimatePresence + motion.button initial={{ opacity: 0, y: 3, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} with staggerChildren 0.04.',
        a11y: 'Chips are buttons (open a dialog); the include dot is a nested toggle — in React make it a separate button with aria-pressed and a tooltip (“Included in every brief”). The popover switch is a Radix Switch labelled “Include in every brief”.',
        stories: [
          { label: 'Row', note: 'Two included, one left out (ring), + Add. Click a dot to toggle it.', html: () => inState('before', null, () => refRow(series('product-sync'))), span: 'full', mount: wireDots },
          { label: 'Chip hover', html: () => inState('before', null, () => refRow(series('product-sync'), flag('.ref-chip, .add-chip'))), span: 'full', force: 'hover' },
          { label: 'Chip pressed', html: () => inState('before', null, () => refRow(series('product-sync'), flag('.ref-chip, .add-chip'))), span: 'full', force: 'active' },
          { label: 'New chip', note: 'Added files enter with chip-in (280ms, 40ms stagger). Replay re-runs it.', html: () => `${inState('before', null, () => refRow(series('product-sync'), addClass('.ref-chip', 'chip-in')))}${replayBar(['Replay chip-in'])}`, span: 'full', height: 150, mount: onReplay((c) => c.querySelectorAll('.ref-chip').forEach((chip, i) => { chip.style.animationDelay = `${i * 40}ms`; restart(chip, 'chip-in'); })) },
          { label: 'Empty', note: 'New doc: only the label and Add', html: () => inState('before', null, () => refRow(draft())), span: 'full' },
          { label: 'File popover · included', note: 'Name, version · size · added, include switch (click it), Open, Remove', html: () => docPop(D.refPopover, 'product-sync'), bg: 'wallpaper', span: 2, height: 220 },
          { label: 'File popover · left out', html: () => inState('before', () => viewDoc('product-sync'), () => popFrom(capture('popover', () => D.refPopover(Kit.html('<button data-name="Team charter.md"></button>')))[0])), bg: 'wallpaper', span: 2, height: 220 },
          { label: 'Add menu', note: 'Recent on this Mac + Choose File… ⌘O', html: () => inState('before', () => viewDoc('product-sync'), () => menuFrom(capture('menu', () => D.addRefMenu(document.createElement('button')))[0], 1)), bg: 'wallpaper', span: 2, height: 200 }
        ]
      },
      {
        id: 'memory-grid',
        name: 'MemoryGrid',
        summary: 'Memory holds only what you accepted: a two-column grid of Decisions, Open commitments, Open questions and Facts. It feeds every brief.',
        mapsTo: 'CSS grid of MemoryGroup',
        usedIn: ['Living doc page'],
        source: '002 doc-render.js D.memoryMarkup / D.memoryBody · doc-page.js D.paintPageMemory · doc.css .mem-grid, .mem-none',
        props: [['memory', 'MemoryItem[]', '[]'], ['fresh', 'string[] — keys to flash after review', '[]']],
        states: ['filled', 'after review (new, resolved, replaced)', 'empty'],
        tokens: ['--surface-sunken', '--r-card', '--label-2', '--label-3'],
        motion: 'After Accept, the grid re-renders instantly and each new or resolved item flashes .receive for 1500ms (kit-receive: accent-soft held to 30%, then fades, var(--ease-out)); the Memory tick in the scrubber plays tick-receive. Reduced motion: flash kept (background only). framer-motion: animate={{ backgroundColor: [soft, soft, "transparent"] }} times [0, 0.3, 1].',
        a11y: 'Section with an eyebrow heading “Memory”; groups are lists; the caption “Only items you accepted” explains provenance.',
        stories: [
          { label: 'Filled', note: 'Product Sync before the meeting', html: () => page(memory('before', 'product-sync')), span: 'full' },
          { label: 'After review', note: 'Accepted c1, c2, c5: new decision, resolved question, fact replacing the old one. Replay flashes the fresh items.', html: () => `${page(memory('after', 'product-sync', acceptSome(['c1', 'c2', 'c5'])))}${replayBar(['Replay receive'])}`, span: 'full', mount: onReplay((c) => ['product-sync-c1', 'product-sync-c2', 'product-sync-c5', 'product-sync-m4'].forEach((key) => D.receive(c.querySelector(`.mem-item[data-key="${key}"]`)))) },
          { label: 'Empty', note: 'Nothing accepted yet', html: () => page(memory('before', 'new-1', withDraft)), span: 'full' }
        ]
      },
      {
        id: 'memory-group',
        name: 'MemoryGroup',
        summary: 'One knowledge type: colored icon, label and open count, then its items (done items sink to the bottom).',
        mapsTo: 'Card with list',
        usedIn: ['MemoryGrid'],
        source: '002 doc-render.js memGroup · doc.css .mem-group[data-type], .mem-group-head, .mem-empty',
        props: [['type', 'decision | commitment | question | fact', '—'], ['items', 'MemoryItem[]', '[]'], ['count', 'open items (hidden when 0)', '—']],
        states: ['decisions', 'open commitments', 'open questions', 'facts', 'empty'],
        tokens: ['--accent (decision)', '--series-orange (commitment)', '--amber (question)', '--series-teal (fact)', '--surface-sunken'],
        motion: 'None of its own; items flash on receive.',
        a11y: 'Heading per group; count is decorative text (announce as “2 open”).',
        stories: [
          { label: 'Decisions', html: () => group('product-sync', 'decision'), span: 2, align: 'start center' },
          { label: 'Open commitments', note: 'Open first, done last', html: () => group('product-sync', 'commitment'), span: 2, align: 'start center' },
          { label: 'Open questions', html: () => group('product-sync', 'question'), span: 2, align: 'start center' },
          { label: 'Facts', html: () => group('product-sync', 'fact'), span: 2, align: 'start center' },
          { label: 'Empty group', note: '“Nothing yet” when a type has no items', html: () => group('design-review', 'question'), span: 2, align: 'start center' }
        ]
      },
      {
        id: 'memory-item',
        name: 'MemoryItem',
        summary: 'One remembered item: text, status dot, owner, due date and the source chip that opens its evidence. Superseded decisions keep a struck-through “replaced ·” line.',
        mapsTo: 'List item',
        usedIn: ['MemoryGroup'],
        source: '002 doc-render.js memItem / memStatus · kit Kit.status, Kit.source · doc.css .mem-item, .mem-meta, .mem-replaced, .mem-item.receive',
        props: [
          ['type', 'decision | commitment | question | fact', '—'],
          ['status', 'current | open | completed | unresolved | superseded', '—'],
          ['owner / due', 'string', '—'],
          ['src', 'string — “Sep 22 · 18:42” or “Doc.docx · p.2”', '—'],
          ['replaced', 'string — superseded text · date', '—'],
          ['resolvedToday', 'boolean', 'false']
        ],
        states: ['current', 'with replaced line', 'open with owner and due', 'done', 'unresolved', 'resolved today', 'fact from a doc', 'received (flash)'],
        tokens: ['--series-green', '--accent', '--amber', '--label-4', '--label-2', '--accent-soft'],
        motion: 'Trigger: the item lands in Memory after Accept (or Accept all) → .mem-item.receive plays kit-receive keyframes for 1500ms (longer than the 900ms default): background accent-soft held to 30%, then fades to transparent, var(--ease-out); one-shot, restarted by re-adding the class. Source chip: background/color 150ms ease on hover, :active scale(0.96) 140ms var(--ease-out) (CSS transitions). Reduced motion: unchanged (background only). framer-motion: animate={{ backgroundColor: [softAccent, softAccent, "rgba(0,0,0,0)"] }} transition={{ duration: 1.5, times: [0, 0.3, 1], ease: [0.23, 1, 0.32, 1] }}.',
        a11y: 'Status is text next to a colored dot (never color alone). Source chip is a button: “Evidence, Sep 22 at 18:42”.',
        stories: [
          { label: 'Current decision', html: () => item('product-sync', 'Ship offline mode behind a flag in 4.2'), span: 2 },
          { label: 'Replaced', note: 'Superseded value kept, struck through', html: () => item('product-sync', 'Pricing experiment runs until Oct 15'), span: 2 },
          { label: 'Open · owner and due', html: () => item('product-sync', 'Share the API rate-limit plan'), span: 2 },
          { label: 'Done', html: () => item('product-sync', 'Recruit 8 people for usability tests'), span: 2 },
          { label: 'Unresolved question', html: () => item('product-sync', 'Do we need SOC 2 Type I before the Acme rollout?'), span: 2 },
          { label: 'Resolved today', note: 'Answered by an accepted decision', html: () => item('product-sync', 'Do we need SOC 2 Type I before the Acme rollout?', acceptSome(['c2']), 'after'), span: 2 },
          { label: 'Fact from a doc', html: () => item('product-sync', 'Activation is 41% against a 45% target'), span: 2 },
          { label: 'Received', note: '1500ms accent flash after Accept. Replay re-runs it.', html: () => `${item('product-sync', 'Adopt the token-bucket rate-limit plan, with per-workspace limits', acceptSome(['c1']), 'after')}${replayBar()}`, span: 2, mount: onReplay((c) => D.receive(c.querySelector('.mem-item'))) }
        ]
      },
      {
        id: 'next-block',
        name: 'NextBlock',
        summary: 'The next meeting’s brief: header (Next · when · where, countdown, Skip / Join / Record ⌘R), provenance, Since last time, Worth asking, agenda and docs. The same block becomes the live recording strip, “Preparing summary…”, a “prepares tonight” preview or an idle Record prompt.',
        mapsTo: 'Card block composed of CarryRow, WorthAsking, AgendaChecklist, MeetingDocs, LiveStrip',
        usedIn: ['Living doc page', 'PeekBody'],
        source: '002 doc-render.js D.nextMarkup / D.nextParts (nextHead, briefInner, pendingInner, idleInner, liveInner, preparingInner, provenance) · D.paintNextBlock · doc.css .next, .next.live, .next.preparing, .next.idle, .countdown',
        props: [
          ['series / meeting', 'Series, Meeting | null', '—'],
          ['surface', 'page | peek (peek hides when/where in the head)', 'page'],
          ['state', 'brief | pending | idle | starting | live | preparing', 'brief'],
          ['countdown', 'string — “in 19 min”, “Tomorrow”, “in 3 days”', '—'],
          ['onRecord / onSkip / onJoin / onStop', '() => void', '—']
        ],
        states: ['brief ready', 'starting now', 'live', 'live · listening', 'preparing summary', 'preparing brief', 'prepared just now', 'not prepared yet', 'later this week', 'idle (not scheduled)', 'idle draft'],
        tokens: ['--accent-softer', '--accent', '--coral', '--surface-sunken', '--label-4', '--mint'],
        motion: 'Trigger: the meeting changes state (brief prepared, starting, Record, Stop, filed) → the block repaints with WAAPI: out 120ms ease-out (opacity 1→0, blur 0→2px, fill forwards) → swap → in 200ms var(--ease-out) (opacity 0→1, translateY 4px→0). Countdown “Starting now” mini-dot: kit-rec 1.4s ease-in-out infinite (opacity 0.3 at 50%). Live: rec-dot pulse, wave bars scaleY(0.3→1) 900ms ease-in-out infinite with −200/−450/−650/−100ms delays, timer +1s; new transcript lines enter with .enter (kit-enter 280ms var(--ease-out) from opacity 0, translateY 6px). Preparing: spinner 700ms linear infinite, shimmer bars 1.3s linear infinite. Reduced motion: repaint is an instant swap; wave, shimmer and enter stop; rec-dot slows to 2.4s. framer-motion: AnimatePresence mode="wait" keyed by state with exit {opacity:0, filter:"blur(2px)"} 0.12s and initial {opacity:0, y:4}.',
        a11y: 'Section landmark “Next”. Record has the ⌘R shortcut (aria-keyshortcuts="Meta+R"); status changes (“Starting now”, “Recording”, “Preparing summary…”) announced via aria-live="polite". Join opens the call app.',
        stories: [
          { label: 'Brief ready', note: 'Before · 9:41 — in 19 min, Join, Record ⌘R; prepared last night from purpose, Memory and 2 reference docs', html: () => page(next('before', 'product-sync')), span: 'full', mount: wireAgenda },
          { label: 'Starting now', note: 'Head only (the rest equals Brief ready): coral chip with a blinking dot; Skip joins the actions', html: () => page(edit(next('starting', 'product-sync'), keepOnly('.next-head'))), span: 'full' },
          { label: 'Live', note: 'Recording strip replaces the brief; transcript lines and “Worth asking now” stream in', html: () => page(next('live', 'product-sync')), span: 'full', mount: timers(DATA.live.elapsed) },
          { label: 'Live · listening', note: 'Just started: nothing transcribed yet', html: () => page(next('live', 'product-sync', () => T.set({ recording: { ...T.state.recording, startedAt: Date.now() } }))), span: 'full', mount: timers(0) },
          { label: 'Preparing summary', note: 'Between Stop and filing (≈0.9s): spinner + shimmer', html: () => page(next('live', 'product-sync', () => T.set({ recording: null, summarizing: { meetingId: 'ps-37', seriesId: 'product-sync' } }))), span: 'full' },
          { label: 'Preparing brief', note: 'Acme · 15:30 — head and provenance: the brief shows while Telu still prepares it (spinner)', html: () => page(edit(next('before', 'acme'), keepOnly('.next-head', '.next-from'))), span: 'full' },
          { label: 'Prepared just now → repaint', note: 'When preparation finishes the block repaints (out 120ms blur, in 200ms rise). Replay runs the real sequence.', html: () => `${page(edit(next('before', 'acme', () => T.mapMeeting('ac-20', (m) => ({ ...m, status: 'upcoming', preparedNow: true }))), keepOnly('.next-head', '.next-from', '.nb-group:not(.next-docs)')))}${replayBar(['Replay repaint'])}`, span: 'full', mount: onReplay((c) => repaintOut(c.querySelector('.next'), c.querySelector('.next').innerHTML)) },
          { label: 'Not prepared yet', note: 'Board Prep · Fri: “Telu prepares this brief the evening before”, carry forward so far, standing agenda preview', html: () => page(next('before', 'board')), span: 'full' },
          { label: 'Later this week · no carry', note: 'Design Review · in 2 days, no open items to carry', html: () => page(next('before', 'design-review')), span: 'full' },
          { label: 'Idle', note: 'No upcoming meeting in the calendar: Next · Not scheduled + Record', html: () => page(next('before', 'hiring', hiringIdle)), span: 'full' },
          { label: 'Idle · new doc', note: 'Draft copy points to the Repeats control', html: () => inState('before', null, () => page(D.nextMarkup(draft(), null))), span: 'full' }
        ]
      },
      {
        id: 'carry-row',
        name: 'CarryRow',
        summary: 'A remembered item carried into the brief: type icon tile, text with owner, a note (Due today, Open for 2 meetings) and its source chip.',
        mapsTo: 'List item',
        usedIn: ['NextBlock · Since last time', 'NextBlock · Carry forward so far'],
        source: '002 doc-render.js carryRow / carryForward · doc.css .carry-row, .k-ico[data-type], .carry-note',
        props: [['type', 'commitment | question | fact | decision', '—'], ['text / owner', 'string', '—'], ['note', 'string', '—'], ['src', 'string', '—']],
        states: ['commitment with owner and note', 'question with note', 'fact from a doc', 'source hover', 'compact (peek)'],
        tokens: ['--series-orange', '--amber', '--series-teal', '--accent', '--separator'],
        motion: 'None; the source chip has the kit press/hover transitions.',
        a11y: 'Icon tile is decorative (type is also spoken by the list heading); source chip is a button.',
        stories: [
          { label: 'Since last time', note: 'Commitment · question · fact', html: () => page(inNext(nextPart('before', 'product-sync', '.nb-group'))), span: 'full' },
          { label: 'Source hover', html: () => page(inNext(edit(nextPart('before', 'product-sync', '.nb-group'), flag('.source')))), span: 'full', force: 'hover' },
          { label: 'Carry forward so far', note: 'Before the brief exists: open commitments and questions only', html: () => page(inNext(nextPart('before', 'board', '.nb-group'))), span: 'full' },
          { label: 'Compact', note: 'Peek width: side (note + source) wraps under the text', html: () => compact(inNext(nextPart('before', 'product-sync', '.nb-group'))), span: 2 }
        ]
      },
      {
        id: 'worth-asking',
        name: 'WorthAsking',
        summary: 'The one mint moment: questions Telu thinks are worth asking, each with its source and a + that adds it to the agenda. During recording it becomes “Worth asking now”.',
        mapsTo: 'Card with rows · add = Button icon + Tooltip',
        usedIn: ['NextBlock (brief)', 'NextBlock (live)', 'PeekBody'],
        source: '002 doc-render.js askInner · doc-edit.js D.askToAgenda · app-record.js liveAsk · doc.css .ask, .ask-head, .ask-row, .ask-add',
        props: [['asks', '{ text, src }[]', '[]'], ['live', 'boolean — “Worth asking now”, no add buttons', 'false'], ['onAddToAgenda', '(index) => void', '—']],
        states: ['rest', 'row hover (+ appears)', 'added (button disabled)', 'live', 'compact'],
        tokens: ['--mint', '--mint-ink', '--content-bg', '--shadow-card', '--separator'],
        motion: 'Add button: opacity 0→1 150ms ease on row hover or focus-visible (always visible on touch), :active scale 0.97. Adding: the new agenda row enters with Kit.enterAnimated (280ms) and flashes .receive (900ms); the button disables (opacity 0.45). Live card arrives with the transcript lines (.enter 280ms). Reduced motion: no enter/flash. framer-motion: whileHover on the row reveals the button (opacity), layout animation for the inserted agenda item.',
        a11y: 'Each + is a button with tooltip “Add to agenda” (give it aria-label with the question text). Mint is decorative; the heading “Worth asking” carries the meaning.',
        stories: [
          { label: 'Rest', note: 'Two questions with sources; + hidden until hover', html: () => page(inNext(nextPart('before', 'product-sync', '.ask'))), span: 'full' },
          { label: 'Row hover', note: '+ Add to agenda appears', html: () => page(inNext(edit(nextPart('before', 'product-sync', '.ask'), flag('.ask-row')))), span: 'full', force: 'hover' },
          { label: 'Added', note: 'After adding the first question: its + disables', html: () => page(inNext(edit(nextPart('before', 'product-sync', '.ask'), (r) => { r.querySelector('.ask-add').disabled = true; r.querySelector('.ask-row').setAttribute('data-force', ''); }))), span: 'full', force: 'hover' },
          { label: 'Live · Worth asking now', note: 'Suggestion during the recording (no add button)', html: () => page(inNext(nextPart('live', 'product-sync', '.live-ask'), ' live')), span: 'full' },
          { label: 'Compact', note: 'Peek width: source and + wrap under the question', html: () => compact(inNext(nextPart('before', 'product-sync', '.ask'))), span: 2 }
        ]
      },
      {
        id: 'agenda-checklist',
        name: 'AgendaChecklist',
        summary: 'This meeting’s agenda: round checkboxes, minutes, chips for items Telu added (“Added by Telu”, “From Worth asking”) and an inline Add item field. Before the brief exists it previews the standing agenda as bullets.',
        mapsTo: 'Radix Checkbox list + input (BlockNote checklist block)',
        usedIn: ['NextBlock'],
        source: '002 doc-render.js D.agendaItem / previewItem / agendaAdd · doc-edit.js D.addAgendaItem, toggleAgenda · doc.css .agenda-item, .added-by, .agenda-add, .agenda-input',
        props: [['items', '{ t, d, done, added, fromAsk }[]', '[]'], ['preview', 'boolean — bullets, no checkboxes', 'false'], ['onToggle', '(i, done) => void', '—'], ['onAdd', '(text) => void', '—']],
        states: ['unchecked', 'checked (done)', 'added by Telu', 'from Worth asking', 'add field', 'preview', 'empty preview'],
        tokens: ['--accent', '--label-3', '--label-4', '--accent-soft', '--accent-strong'],
        motion: 'Checkbox: background/box-shadow 160ms ease, press scale(0.88) 140ms var(--ease-out), check stroke draws (stroke-dashoffset 14→0) 220ms var(--ease-out) after 40ms; item text color 150ms ease with an instant line-through. Add: Enter appends the row with Kit.enterAnimated (height 0→auto + opacity, 280ms var(--ease-out)). Reduced motion: stroke and height animations off. framer-motion: motion.path pathLength 0→1 (0.22s, delay 0.04); layout + initial={{ height: 0, opacity: 0 }} for new rows.',
        a11y: 'Checkboxes are buttons with aria-checked and aria-label “Done”; the add field has aria-label “Add agenda item”; Enter adds, Esc clears and blurs.',
        stories: [
          { label: 'Brief agenda', note: 'Left column of the Next grid (docs on the right). Click a circle to check it; type in Add item and press Enter.', html: () => page(inNext(nextGrid('before', 'product-sync'))), span: 'full', mount: wireAgenda },
          { label: 'Done and added', note: 'Two items done; one added from Worth asking', html: () => page(inNext(nextGrid('before', 'product-sync', briefPatch((b) => ({ agenda: [...b.agenda.map((a, i) => (i < 2 ? { ...a, done: true } : a)), { t: b.ask[1].text, d: '5m', added: true, fromAsk: true }] }))))), span: 'full', mount: wireAgenda },
          { label: 'Standing agenda preview', note: 'Before the brief: bullets from the purpose', html: () => page(inNext(nextGrid('before', 'board'))), span: 'full' },
          { label: 'Empty preview', note: '“Add topics to the purpose”', html: () => page(inNext(nextGrid('before', 'board', () => T.mapSeries('board', (s) => ({ ...s, purpose: { ...s.purpose, agenda: [] } }))))), span: 'full' }
        ]
      },
      {
        id: 'meeting-docs',
        name: 'MeetingDocs',
        summary: '“Docs for this meeting”: files attached to this occurrence (reference docs marked Include plus anything dropped on it). Each chip’s dot includes or leaves it out of this brief.',
        mapsTo: 'Chip list with toggle + drop zone',
        usedIn: ['NextBlock', 'Island (drop on the Island attaches here)'],
        source: '002 doc-render.js D.nextDocsInner / meetingDocChip / nextDocs · doc-edit.js D.toggleMeetingDoc, T.attachToMeeting · doc.css .next-docs, .next-doc-list, .drop-note',
        props: [['docs', 'string[]', '[]'], ['off', 'string[] — left out of this brief', '[]'], ['dropTarget', 'boolean', 'false'], ['onAttach', '(files) => void', '—']],
        states: ['included', 'left out', 'without brief (plain chips)', 'chip hover', 'drop target', 'new chip (chip-in)'],
        tokens: ['--content-bg', '--shadow-card', '--shadow-card-hover', '--accent-softer', '--accent'],
        motion: 'Dot toggle (click): background-color + box-shadow 150ms ease, CSS transition. File drag over the group: kit .drop-target (2px dashed accent outline at −6px + accent-softer fill); background-color 150ms ease, outline appears instantly. Attach (drop here or on the Island): new chips run .chip-in keyframes 280ms var(--ease-out) from opacity 0 + translateY(3px) scale(0.95), 40ms stagger. Chip hover: shadow-card → shadow-card-hover 150ms ease; press scale 0.97 140ms var(--ease-out). Reduced motion: chip-in skipped (kit), colors still fade. framer-motion: AnimatePresence list with initial {opacity:0, y:3, scale:0.95}, staggerChildren 0.04; drop state via a data attribute (no animation needed).',
        a11y: 'Drop zone needs a keyboard alternative (Attach… button in the island/menu). Dots are toggles with tooltips “Included in this brief” / “Left out of this brief”.',
        stories: [
          { label: 'Included', note: 'Peek width (full width); on the page it is the right column of the Next grid. Click a dot to leave that file out.', html: () => compact(inNext(nextPart('before', 'product-sync', '.next-docs'))), span: 2, mount: wireDots },
          { label: 'One left out', html: () => compact(inNext(nextPart('before', 'product-sync', '.next-docs', briefPatch(() => ({ off: ['Rate-limit plan v1.docx'] }))))), span: 2 },
          { label: 'Without a brief', note: 'Plain chips from included references', html: () => compact(inNext(nextPart('before', 'board', '.next-docs'))), span: 2 },
          { label: 'Chip hover', html: () => compact(inNext(edit(nextPart('before', 'product-sync', '.next-docs'), flag('.doc-chip')))), span: 2, force: 'hover' },
          { label: 'Drop target', note: 'Files dragged over the docs group. Replay clears it and brings it back.', html: () => `${compact(inNext(edit(nextPart('before', 'product-sync', '.next-docs'), addClass('.next-docs', 'drop-target'))))}${replayBar()}`, span: 2, mount: toggleReplay('.next-docs', 'drop-target') },
          { label: 'Attached', note: 'New file enters with chip-in. Replay re-runs it.', html: () => `${compact(inNext(edit(nextPart('before', 'product-sync', '.next-docs', briefPatch((b) => ({ docs: [...b.docs, 'Sprint 43 plan.pdf'] }))), (r) => r.querySelector('.doc-chip:last-child').classList.add('chip-in'))))}${replayBar()}`, span: 2, mount: onReplay((c) => restart(c.querySelector('.doc-chip:last-child'), 'chip-in')) }
        ]
      },
      {
        id: 'live-strip',
        name: 'LiveStrip',
        summary: 'The recording row: coral dot, Recording (or Recording once), ticking timer, wave, “Transcribing on this Mac” and Stop ⌘R.',
        mapsTo: 'Status row inside NextBlock (live) and the one-off peek card',
        usedIn: ['NextBlock', 'PeekBody (one-off)'],
        source: '002 doc-render.js liveInner · app-record.js T.oneOffLiveMarkup · doc.css .live-strip, .live-timer, .live-wave, .live-note, .next.live',
        props: [['label', 'Recording | Recording once', 'Recording'], ['elapsed', 'seconds', '0'], ['onStop', '() => void', '—']],
        states: ['recording', 'recording once', 'compact (note hidden)'],
        tokens: ['--coral', '--coral-ink', '--label-3'],
        motion: 'Trigger: recording starts (Record, ⌘R, Island) — the strip replaces the brief via the NextBlock repaint. rec-dot: kit-rec 1.4s ease-in-out infinite (opacity 1→0.3→1); wave: 5 bars scaleY(0.3↔1) 900ms ease-in-out infinite, delays 0/−200/−450/−650/−100ms; timer text +1s (tabular numbers, min-width 36px so it never shifts). Reduced motion: wave stops, dot slows to 2.4s. framer-motion: animate={{ opacity: [1, 0.3, 1] }} repeat Infinity; bars animate scaleY with repeatType "mirror".',
        a11y: 'Timer should be aria-live="off" (announce start/stop only); Stop button has aria-keyshortcuts="Meta+R".',
        stories: [
          { label: 'Recording', note: 'Main meeting, 12:04 in', html: () => page(inNext(nextPart('live', 'product-sync', '.live-strip'), ' live')), span: 'full', mount: timers(DATA.live.elapsed) },
          { label: 'Recording once', note: 'One-off event (peek)', html: () => page(T.oneOffLiveMarkup()), span: 'full', mount: timers(95) },
          { label: 'Compact', note: '“Transcribing on this Mac” hides under 600px', html: () => compact(inNext(nextPart('live', 'product-sync', '.live-strip'), ' live')), span: 2, mount: timers(DATA.live.elapsed) }
        ]
      }
    ]
  });
})();
