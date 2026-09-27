(() => {
  const C = window.CatalogDoc;
  const section = Catalog.sections.find((s) => s.id === 'doc');
  if (!C || !section) return;
  const D = T.doc;
  const e = Catalog.esc;
  const { inState, viewDoc, series, fromProposal, draft, withDraft, page, compact, pick, edit, flag, addClass, capture, popover, menuFrom, docToolbar, replayBar, onReplay, restart, segs } = C;
  const AM = DATA.afterMeeting;

  const meeting = (sid, mid) => series(sid).meetings.find((m) => m.id === mid);
  const row = (scenario, sid, mid, setup, tweak) => inState(scenario, setup, () => {
    const markup = `<div class="past-list">${D.meetingMarkup(series(sid), meeting(sid, mid))}</div>`;
    return page(tweak ? edit(markup, tweak) : markup);
  });
  const expand = (mid) => () => T.set({ expanded: { ...T.state.expanded, [mid]: true } });
  const acceptAll = (mid) => () => T.mapMeeting(mid, (m) => ({ ...m, candidates: m.candidates.map((c) => ({ ...c, state: 'accepted' })) }));
  const pastSection = (scenario, s, setup) => inState(scenario, setup, () => page(pick(D.docMarkup(typeof s === 'string' ? series(s) : s), '#sec-past')));
  const toggleIn = (canvas, scenario = 'before') => canvas.addEventListener('click', (event) => {
    const head = event.target.closest('.mtg-head[data-act="toggle-meeting"]');
    if (!head || event.target.closest('.grip, .mtg-more')) return;
    Catalog.withScenario(scenario, () => D.toggleMeeting(head.closest('.mtg')));
  });
  const meetingMenus = () => inState('before', () => viewDoc('product-sync'), () => {
    const trigger = Kit.html('<div class="mtg" data-mid="ps-36"><button></button></div>').firstElementChild;
    const [main] = capture('menu', () => D.meetingMenu(trigger));
    const [move] = main ? capture('menu', () => main[1][1].onSelect()) : [];
    const [ask] = main ? capture('alert', () => main[1][main[1].length - 1].onSelect()) : [];
    return { main, move, ask };
  });
  const alertBox = ({ title, message, buttons }, danger) => `<div class="cat-static"><div class="alert open" role="alertdialog"><div class="app-icon"><img src="../kit/telu-icon.png" alt=""></div><h3>${title}</h3>${message ? `<p>${message}</p>` : ''}<div class="alert-actions">${buttons.map((b) => `<button class="btn ${b.primary ? `primary${danger ? ' danger' : ''}` : ''}">${b.label}</button>`).join('')}</div></div></div>`;
  const flyInner = 'transform-origin:left center;border-radius:10px;box-shadow:var(--shadow-float);background:var(--glass-strong);width:auto';

  const flyChip = (label) => `<div class="fly-chip">${icon('calendar')}<span>${e(label)}</span></div>`;
  const sidebarRow = (s, selected) => `<div class="sb-item a-sb-row${selected ? ' selected' : ''}" data-series="${s.id}">${Kit.seriesIcon(s)}<span class="truncate a-sb-name">${e(s.name)}</span><span class="a-hint num">${T.nextHint(s)}</span></div>`;
  const collapsedAll = () => T.set({ expanded: {} });
  const moveDemo = () => inState('before', collapsedAll, () => {
    const ps = series('product-sync');
    const rows = [ps, series('maria'), series('acme')].map((s, i) => sidebarRow(s, i === 0)).join('');
    const list = ['ps-36', 'ps-35', 'ps-34'].map((mid) => D.meetingMarkup(ps, meeting('product-sync', mid))).join('');
    return `<div class="window t-app cat-window cd-mini"><aside class="sidebar"><div class="sb-title">Series</div>${rows}</aside><section class="main"><div class="content">${page(`<div class="past-list">${list}</div>`)}</div></section></div>${replayBar(['Replay move', 'Replay insert']).replace('cd-replay', 'cd-replay cd-low')}`;
  });
  function mountMove(canvas) {
    const list = canvas.querySelector('.past-list');
    const target = canvas.querySelector('.a-sb-row[data-series="maria"]');
    const fresh = inState('after', collapsedAll, () => D.meetingMarkup(series('product-sync'), meeting('product-sync', 'ps-37')));
    const move = () => {
      const row = list.querySelector('.mtg[data-mid="ps-35"]');
      if (!row) return;
      const after = row.nextElementSibling;
      Kit.flyTo(row.querySelector('.mtg-head'), target, { markup: flyChip('Tue 15 Sep') });
      Kit.removeAnimated(row).then(() => setTimeout(() => {
        list.insertBefore(row, after);
        row.style.overflow = '';
        Kit.enterAnimated(row);
      }, 900));
    };
    const insert = () => {
      const old = list.querySelector('.mtg[data-mid="ps-37"]');
      if (old) old.remove();
      const el = Kit.html(fresh);
      list.prepend(el);
      Kit.enterAnimated(el);
      D.receive(el);
    };
    onReplay(move, insert)(canvas);
  }

  const candList = (list, scenario = 'after') => inState(scenario, null, () => page(`<div class="review"><div class="cand-list">${list.map(D.candRow).join('')}</div></div>`));
  const cands = (states = {}) => AM.candidates.map((c) => (states[c.id] === 'corrected' ? { ...c, state: 'accepted', corrected: true } : { ...c, state: states[c.id] || 'pending' }));
  const reviewMeeting = (states) => ({ candidates: cands(states) });

  function wireReview(root, initial, onReset) {
    let list = initial;
    const paint = (cid) => {
      const review = root.querySelector('.review');
      review.querySelector('.review-head').outerHTML = D.reviewHead({ candidates: list });
      root.querySelectorAll('.cd-counts, .mtg-counts').forEach((counts) => { counts.innerHTML = D.countsChips({ candidates: list }); });
      if (cid) review.querySelector(`.cand[data-cid="${cid}"]`).outerHTML = D.candRow(list.find((c) => c.id === cid));
    };
    const set = (cid, patch) => {
      list = list.map((c) => (c.id === cid ? { ...c, ...patch } : c));
      paint(cid);
    };
    const textOf = (cid) => root.querySelector(`.cand[data-cid="${cid}"] .cand-text`);
    const ACT = {
      accept: (cid) => set(cid, { state: 'accepted', corrected: false }),
      correct: (cid) => { set(cid, { state: 'editing' }); D.selectAll(textOf(cid)); },
      'cancel-correct': (cid) => set(cid, { state: 'pending' }),
      'save-correct': (cid) => {
        const text = textOf(cid).textContent.replace(/\s+/g, ' ').trim();
        const before = list.find((c) => c.id === cid).text;
        set(cid, { state: 'accepted', text: text || before, corrected: !!text && text !== before });
      },
      reject: (cid) => set(cid, { state: 'rejected' }),
      'undo-reject': (cid) => set(cid, { state: 'pending' })
    };
    root.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-act]');
      if (!btn || !btn.closest('.review')) return;
      if (btn.dataset.act === 'accept-all') {
        list.filter(T.isPendingCand).forEach((c, i) => setTimeout(() => ACT.accept(c.id), i * 70));
        return;
      }
      const cand = btn.closest('.cand');
      if (cand && ACT[btn.dataset.act]) ACT[btn.dataset.act](cand.dataset.cid);
    });
    root.addEventListener('keydown', (event) => {
      const text = event.target.closest('.cand-text');
      if (!text) return;
      const cid = text.closest('.cand').dataset.cid;
      if (event.key === 'Enter') { event.preventDefault(); ACT['save-correct'](cid); }
      if (event.key === 'Escape') { event.stopPropagation(); ACT['cancel-correct'](cid); }
    });
    return () => {
      list = initial;
      root.querySelector('.cand-list').innerHTML = list.map(D.candRow).join('');
      paint();
      if (onReset) onReset();
    };
  }
  function reviewDemo(canvas) {
    const reset = wireReview(canvas, cands());
    canvas.querySelector('.cd-reset').addEventListener('click', reset);
  }

  const drawer = (inner, cls = '') => `<div class="cd-drawer${cls}"><aside class="drawer open" aria-label="Details">${inner}</aside></div>`;
  const transcript = (sid, mid, t) => inState('before', null, () => drawer(D.drawerTranscript(series(sid), meeting(sid, mid), t)));
  const centerHighlight = (canvas) => {
    const body = canvas.querySelector('.drawer-body');
    const hl = body && body.querySelector('.tl.hl');
    if (hl) body.scrollTop = Math.max(0, hl.offsetTop - body.clientHeight / 2 + hl.offsetHeight / 2);
  };
  const slideDrawer = (canvas) => {
    const el = canvas.querySelector('.drawer');
    el.classList.remove('open');
    setTimeout(() => el.classList.add('open'), 520);
  };

  const marksOf = (markup) => {
    const root = document.createElement('div');
    root.innerHTML = markup;
    return [...root.querySelectorAll('[data-mark]')].map((el) => ({ id: el.id, mark: el.dataset.mark }));
  };
  const scrubItems = (marks, active) => marks.map((m, i) => `${i === 3 ? '<span class="scrub-gap"></span>' : ''}<button class="scrub-item${m.id === active ? ' active' : ''}" data-act="scrub" data-target="${e(m.id)}" aria-label="${e(m.mark)}"><span class="scrub-label">${e(m.mark)}</span><span class="scrub-tick"></span></button>`).join('');
  const scrubber = (marks, active) => `<nav class="scrubber" aria-label="Sections">${scrubItems(marks, active)}</nav>`;
  const scrub = (active, tweak) => inState('before', null, () => {
    const markup = `<div class="cd-scrub">${scrubber(marksOf(D.docMarkup(series('product-sync'))), active)}</div>`;
    return tweak ? edit(markup, tweak) : markup;
  });

  const repeats = (s) => inState('before', null, () => page(`<div class="doc-meta draft">${D.metaMarkup(s)}</div>`));
  const weekly = () => T.syncDraft({ ...draft(), cadence: 'Weekly', day: 'Tue', time: '10:00' });
  const draftMenu = (fn) => inState('before', () => { withDraft(); viewDoc('new-1'); }, () => menuFrom(capture('menu', () => fn(document.createElement('button')))[0], 1));

  function wireRepeats(canvas) {
    let s = draft();
    const paint = () => {
      const day = canvas.querySelector('[data-act="pick-day"]');
      const time = canvas.querySelector('[data-act="pick-time"]');
      const off = s.cadence === 'None';
      day.disabled = off;
      time.disabled = off;
      day.innerHTML = `${e(D.dayLabel(s.day))}${icon('chevron-updown')}`;
      time.innerHTML = `${e(s.time || 'Time')}${icon('chevron-updown')}`;
      canvas.querySelector('.repeats-sub').innerHTML = D.repeatsSub(s);
    };
    const update = (patch) => {
      s = T.syncDraft({ ...s, ...patch });
      paint();
    };
    Kit.segmented(canvas.querySelector('.seg'), (value) => update({ cadence: value }));
    const items = (list, key) => list.map((value) => ({ label: key === 'day' ? (value === 'Weekdays' ? 'Every weekday' : D.dayLabel(value)) : value, onSelect: () => update({ [key]: value }) }));
    canvas.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-act="pick-day"], [data-act="pick-time"]');
      if (!btn) return;
      const day = btn.dataset.act === 'pick-day';
      Kit.menu(btn, day ? items(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Weekdays'], 'day') : items(['08:30', '09:00', '09:30', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'], 'time'), { minWidth: day ? 170 : 120 });
    });
  }

  const OVERLAYS = { rule: 'rulePopover', people: 'peoplePopover', 'purpose-history': 'purposeHistoryPopover', history: 'docHistoryPopover', 'ref-doc': 'refPopover', 'add-ref': 'addRefMenu', 'meeting-menu': 'meetingMenu', 'tb-more': 'docMenu' };
  const inert = (items) => items.map((item) => (item && item.onSelect ? { ...item, onSelect: () => {} } : item));

  const toggleDot = (dot) => {
    const off = !dot.classList.contains('off');
    dot.classList.toggle('off', off);
    const meeting = dot.dataset.act === 'toggle-meeting-doc';
    dot.dataset.tip = meeting ? (off ? 'Left out of this brief' : 'Included in this brief') : (off ? 'Not included in briefs' : 'Included in every brief');
  };

  function pageDemo(canvas, scenarioRef) {
    const main = canvas.querySelector('.main');
    const content = canvas.querySelector('.content');
    const inner = canvas.querySelector('.canvas-inner');
    const toolbar = canvas.querySelector('.toolbar');
    const drawerEl = canvas.querySelector('.drawer');
    const nav = canvas.querySelector('.scrubber');
    const sid = 'product-sync';
    const s = () => Catalog.withScenario(scenarioRef.id, () => series(sid));
    Kit.scrollEdge(content, toolbar);
    const shift = (open) => {
      const doc = inner.querySelector('.doc');
      const box = main.getBoundingClientRect();
      const width = doc ? doc.getBoundingClientRect().width : 0;
      const left = (box.width - width) / 2;
      inner.style.setProperty('--shift', `${open && doc ? -Math.max(0, Math.min(left + width + 24 - (box.width - 366), left - 24)) : 0}px`);
    };
    const openDrawer = (markup) => {
      drawerEl.innerHTML = markup;
      drawerEl.classList.add('open');
      main.classList.add('drawer-open');
      shift(true);
      canvas.querySelector('#tbInspector').classList.add('on');
      const hl = drawerEl.querySelector('.tl.hl');
      const body = drawerEl.querySelector('.drawer-body');
      if (hl) body.scrollTop = Math.max(0, hl.offsetTop - body.clientHeight / 2 + hl.offsetHeight / 2);
    };
    const closeDrawer = () => {
      drawerEl.classList.remove('open');
      main.classList.remove('drawer-open');
      shift(false);
      canvas.querySelector('#tbInspector').classList.remove('on');
    };
    const openTranscript = (mid, t) => Catalog.withScenario(scenarioRef.id, () => {
      const m = series(sid).meetings.find((x) => x.id === mid);
      if (m) openDrawer(D.drawerTranscript(series(sid), m, t));
    });
    const scrollTo = (el) => content.scrollTo({ top: content.scrollTop + el.getBoundingClientRect().top - content.getBoundingClientRect().top - 72, behavior: Kit.reduceMotion() ? 'auto' : 'smooth' });
    const jumpTo = (mid) => {
      const el = inner.querySelector(`#m-${CSS.escape(mid)}`);
      if (!el) return;
      Catalog.withScenario(scenarioRef.id, () => D.toggleMeeting(el, true));
      scrollTo(el);
      setTimeout(() => D.receive(el), Kit.reduceMotion() ? 0 : 360);
    };
    const title = new IntersectionObserver(([entry]) => {
      const top = entry.rootBounds ? entry.rootBounds.top : 0;
      canvas.querySelector('.tb-title').classList.toggle('show', !entry.isIntersecting && entry.boundingClientRect.top < top);
    }, { root: content, rootMargin: '-52px 0px 0px 0px', threshold: 0 });
    const marks = new IntersectionObserver(() => {
      const hit = [...inner.querySelectorAll('[data-mark]')].find((el) => {
        const r = el.getBoundingClientRect();
        const c = content.getBoundingClientRect();
        return r.bottom > c.top + 64 && r.top < c.top + c.height / 2;
      });
      if (hit) nav.querySelectorAll('.scrub-item').forEach((b) => b.classList.toggle('active', b.dataset.target === hit.id));
    }, { root: content, rootMargin: '-64px 0px -50% 0px', threshold: 0 });
    const observe = () => {
      title.disconnect();
      marks.disconnect();
      const t = inner.querySelector('.doc-title');
      if (t) title.observe(t);
      inner.querySelectorAll('[data-mark]').forEach((el) => marks.observe(el));
    };
    const evidence = (btn) => {
      const got = {};
      Catalog.withScenario(scenarioRef.id, () => {
        viewDoc(sid);
        got.pop = capture('popover', () => { got.ev = capture('evidence', () => D.openEvidence(btn))[0]; })[0];
      });
      if (got.pop) return Kit.popover(btn, got.pop[1], got.pop[2]);
      if (!got.ev) return null;
      const [, ev, opts] = got.ev;
      const host = btn.closest('.mtg');
      const mid = host ? host.dataset.mid : (T.evidenceFor(s(), btn.dataset.src || '') || {}).mid;
      const pop = Kit.evidence(btn, ev, { where: opts.where, onOpen: mid ? () => (host ? openTranscript(mid, ev.t) : jumpTo(mid)) : null });
      const open = pop && mid && !host ? pop.el.querySelector('[data-open]') : null;
      if (open) open.textContent = `Jump to ${opts.where}`;
      return pop;
    };
    const ACT = {
      inspector: () => (drawerEl.classList.contains('open') ? closeDrawer() : openDrawer(D.drawerInfo(s()))),
      'close-drawer': closeDrawer,
      transcript: (el) => openTranscript(el.closest('[data-mid]').dataset.mid),
      scrub: (el) => { const target = inner.querySelector(`#${CSS.escape(el.dataset.target)}`); if (target) scrollTo(target); },
      doc: (el) => Kit.toast(`Opening ${e(el.dataset.name)} in Preview…`, { icon: 'doc', container: canvas.querySelector('.window') }),
      earlier: (el) => Kit.toast(`${e(el.dataset.n)} earlier meetings since Jan 2026 — all searchable, all on this Mac`, { icon: 'history', container: canvas.querySelector('.window') }),
      join: () => Kit.toast('Opening Google Meet…', { icon: 'video', container: canvas.querySelector('.window') }),
      'toggle-include': toggleDot,
      'toggle-meeting-doc': toggleDot
    };
    canvas.addEventListener('click', (event) => {
      const source = event.target.closest('.source');
      if (source && inner.contains(source)) return evidence(source);
      const el = event.target.closest('[data-act]');
      if (!el || el.disabled || el.closest('.cd-page-bar')) return undefined;
      if (el.dataset.act === 'toggle-meeting') {
        if (!event.target.closest('.grip')) Catalog.withScenario(scenarioRef.id, () => D.toggleMeeting(el.closest('.mtg')));
        return undefined;
      }
      if (OVERLAYS[el.dataset.act]) {
        const got = {};
        Catalog.withScenario(scenarioRef.id, () => {
          viewDoc(sid);
          got.pop = capture('popover', () => { got.menu = capture('menu', () => D[OVERLAYS[el.dataset.act]](el))[0]; })[0];
        });
        if (got.pop) Kit.popover(el, got.pop[1], got.pop[2]);
        else if (got.menu) Kit.menu(el, inert(got.menu[1]), got.menu[2]);
        return undefined;
      }
      if (ACT[el.dataset.act]) ACT[el.dataset.act](el);
      return undefined;
    });
    canvas.addEventListener('toggle', (event) => {
      const item = event.target.closest('.agenda-item');
      if (item) item.classList.toggle('done', event.detail.checked);
    });
    const render = () => {
      closeDrawer();
      Catalog.withScenario(scenarioRef.id, () => {
        viewDoc(sid);
        inner.innerHTML = D.docMarkup(series(sid));
        nav.innerHTML = scrubItems(marksOf(inner.innerHTML), 'sec-purpose');
        canvas.querySelector('.tb-record').classList.toggle('live', !!T.state.recording);
        canvas.querySelector('.tb-record').innerHTML = T.state.recording ? '<span class="rec-dot"></span><span class="num tb-timer" data-rec-timer>0:00</span><span>Stop</span>' : '<span class="rec-glyph"></span>Record<span class="kbd">⌘R</span>';
      });
      canvas.querySelectorAll('[data-rec-timer]').forEach((el) => Kit.timer(el, scenarioRef.id === 'live' ? DATA.live.elapsed : 0));
      const review = inner.querySelector('[data-review]');
      if (review) wireReview(review.closest('.mtg'), Catalog.withScenario(scenarioRef.id, () => T.findMeeting(review.dataset.review).meeting.candidates));
      content.scrollTop = 0;
      observe();
    };
    const seg = canvas.querySelector('.cd-page-bar .seg');
    Kit.segmented(seg, (value) => {
      scenarioRef.id = value;
      render();
    });
    render();
  }

  const pageStory = () => {
    const s = inState('before', null, () => series('product-sync'));
    return `<div class="window t-app cat-window cd-window"><section class="main">
        <div class="toolbar">${docToolbar(s)}</div>
        <div class="content"><div class="canvas-inner"></div></div>
        <nav class="scrubber"></nav>
        <aside class="drawer" aria-label="Details"></aside>
      </section></div>
      <div class="cd-page-bar"><div class="seg"><button data-value="before" aria-selected="true">Before · 9:41</button><button data-value="live" aria-selected="false">Live · 10:12</button><button data-value="after" aria-selected="false">After · 10:46</button></div></div>`;
  };

  document.head.insertAdjacentHTML('beforeend', `<style data-section="doc-2">
    .cd-drawer .drawer { position: relative; top: auto; right: auto; bottom: auto; width: 340px; height: 460px; }
    .cd-drawer.cd-short .drawer { height: 330px; }
    .cd-drawer.cd-tall .drawer { height: 580px; }
    .cd-scrub .scrubber { position: relative; top: auto; right: auto; transform: none; }
    .cd-window { height: 100%; min-height: 780px; }
    .cd-window .main { flex: 1; }
    .cd-page-bar { position: absolute; left: 14px; bottom: 14px; z-index: 60; padding: 4px; border-radius: 999px; background: var(--glass-strong); box-shadow: var(--shadow-float); -webkit-backdrop-filter: blur(16px); backdrop-filter: blur(16px); }
    .cd-fly { position: relative; }
    .cd-ghost .drag-ghost { position: relative; top: auto; left: auto; }
    .cd-reset { position: absolute; top: 10px; left: 10px; }
    .cd-counts-demo { display: flex; justify-content: flex-end; margin-bottom: 8px; }
    .cd-mini { height: 100%; }
    .cd-replay.cd-low { top: auto; bottom: 10px; }
    .cd-mini .main { flex: 1; }
    .cd-mini .content { padding-top: 0; }
    .cd-mini .cd-page { margin: 28px auto; }
    .cd-host { position: relative; display: grid; place-items: start center; }
  </style>`);

  const REVIEW_NOTE = 'Accept, Correct (edit inline, Enter saves, Esc cancels), Reject → Undo and Accept all (70ms stagger) all work here with the real row markup.';

  section.components.push(
    {
      id: 'past-meetings',
      name: 'PastMeetings',
      summary: 'Every past meeting, newest first, filed by Telu. Rows expand into the summary, knowledge, docs and transcript; a button reveals older meetings.',
      mapsTo: 'List of MeetingRow (Radix Collapsible) + Button',
      usedIn: ['Living doc page'],
      source: '002 doc-past.js pastMarkup / D.pastList / D.earlierButton · doc-page.js D.afterPastChange, D.insertNewest · doc.css .past-list, .past-empty, .show-earlier',
      props: [['meetings', 'Meeting[] (not upcoming)', '[]'], ['earlier', 'number — older meetings not loaded', '0'], ['expanded', 'Record<meetingId, boolean>', '{}']],
      states: ['filled (one expanded)', 'with review at the top', 'empty', 'show earlier'],
      tokens: ['--separator', '--surface-sunken', '--label-2', '--label-3'],
      motion: 'Newest meeting (after filing) is prepended with Kit.enterAnimated: WAAPI height 0→h + opacity 0→1, 280ms var(--ease-out), overflow hidden during the run. Removing (move / unfile / split / delete) uses Kit.removeAnimated: height, opacity, margins and paddings → 0 in 220ms var(--ease-out), then the node is dropped. Reduced motion: instant insert/remove. framer-motion: <AnimatePresence initial={false}> with motion.div layout, initial={{ height: 0, opacity: 0 }}, exit={{ height: 0, opacity: 0 }}.',
      a11y: 'Section with eyebrow heading “Meetings”; rows are disclosure buttons (aria-expanded); “Show 31 earlier meetings” is a button.',
      stories: [
        { label: 'Filled', note: 'Before · 9:41 — #36 expanded, #35 and #34 collapsed, #33 cancelled, Show 31 earlier meetings. Click a row to toggle it.', html: () => pastSection('before', 'product-sync'), span: 'full', mount: (c) => toggleIn(c) },
        { label: 'After a meeting', note: 'After · 10:46 — today’s meeting on top, expanded, waiting for review', html: () => pastSection('after', 'product-sync'), span: 'full', mount: (c) => toggleIn(c, 'after') },
        { label: 'Empty', note: 'Just-tracked series', html: () => pastSection('before', fromProposal('pr-growth')), span: 'full' }
      ]
    },
    {
      id: 'meeting-row',
      name: 'MeetingRow',
      summary: 'One past meeting: date, number · duration (or “from …” after a move), a one-line summary that fades when open, count chips, a ⋯ menu and a drag grip on hover. Expanded it shows the summary, knowledge or review, docs and Open transcript.',
      mapsTo: 'Radix Collapsible (Trigger = row head) + Radix DropdownMenu (⋯) + native drag source',
      usedIn: ['PastMeetings'],
      source: '002 doc-past.js meetingHead / D.meetingMarkup / D.meetingBody / cancelledRow · doc-page.js D.toggleMeeting, D.jumpToMeeting · doc-organize.js D.meetingMenu, moveMenu, D.deleteMeetingFlow, drag (onDragStart) · doc.css .mtg, .mtg-head, .grip, .mtg-line, .mtg-body, .drag-ghost, .fly-chip',
      props: [
        ['meeting', 'Meeting', '—'],
        ['open', 'boolean', 'false'],
        ['sub', '#n · duration | from <series> | from Needs filing', '—'],
        ['onMove / onSplit / onUnfile / onDelete', '(mid) => void', '—'],
        ['draggable', 'boolean (grip → sidebar row)', 'true']
      ],
      states: ['collapsed', 'expanded', 'hover (grip + fill)', 'pressed', 'needs review', 'reviewed', 'cancelled', 'interview title', 'moved from', 'filed from', 'dragging', 'received', '⋯ menu', 'move to', 'delete confirm', 'drag ghost', 'fly chip'],
      tokens: ['--fill', '--fill-2', '--label-2', '--label-3', '--separator', '--glass-strong', '--shadow-float', '--coral'],
      motion: 'Toggle: .collapsible grid-template-rows 0fr↔1fr 260ms var(--ease-out) + opacity 200ms ease; disclosure chevron rotate(0→90deg) 200ms var(--ease-out); .mtg-line opacity 1→0 180ms var(--ease-out) when open (CSS transitions, interruptible). Head: background-color 150ms ease (hover fill, :active fill-2); grip opacity 0→1 150ms ease on hover. Jump from evidence/peek: smooth scroll, then .receive (kit-receive 900ms var(--ease-out), accent-soft → transparent) after 360ms. Drag: row opacity 0.45 while dragging; the ghost is a static glass chip; sidebar targets get an inset accent ring, the hovered row accent-soft + scale(1.03). Move/unfile via menu: Kit.flyTo — a glass chip flies to the sidebar row in 560ms (outer translateX cubic-bezier(0.45,0,0.2,1); inner translateY + scale ≥0.4 + opacity→0.35 cubic-bezier(0.6,0,0.9,0.7)), then the row flashes .receive and its icon .bump (kit-bump 420ms, scale 1.18 at 40%); the row itself leaves with Kit.removeAnimated (220ms). Reduced motion: no fly (receive only), instant toggle. framer-motion: Collapsible → motion.div height auto; fly → layoutId shared between chip and sidebar row or an absolutely positioned motion.div with x/y/scale keyframes.',
      a11y: 'Row head is a button with aria-expanded and aria-controls; ⋯ has aria-label “More”; grip needs a keyboard alternative (“Move to another series…” in the menu). Cancelled rows are static text.',
      stories: [
        { label: 'Collapsed', note: '#35 · 38 min, one-line summary, counts, ⋯', html: () => row('before', 'product-sync', 'ps-35'), span: 'full', mount: (c) => toggleIn(c) },
        { label: 'Expanded', note: 'Summary, knowledge rows, docs, Open transcript · Transcribed on this Mac. Click the head to collapse.', html: () => row('before', 'product-sync', 'ps-36'), span: 'full', mount: (c) => toggleIn(c) },
        { label: 'Hover', note: 'Fill + drag grip in the gutter', html: () => row('before', 'product-sync', 'ps-35', null, flag('.mtg-head')), span: 'full', force: 'hover' },
        { label: 'Pressed', html: () => row('before', 'product-sync', 'ps-35', null, flag('.mtg-head')), span: 'full', force: 'active' },
        { label: 'Needs review · collapsed', note: 'Interview title + amber “3 to review”', html: () => row('before', 'hiring', 'hi-5'), span: 'full' },
        { label: 'Needs review · expanded', note: 'Review list instead of knowledge rows', html: () => row('after', 'product-sync', 'ps-37'), span: 'full', mount: (c) => toggleIn(c, 'after') },
        { label: 'Reviewed', note: 'All candidates handled → “Reviewed”', html: () => row('after', 'product-sync', 'ps-37', () => { acceptAll('ps-37')(); T.set({ expanded: { ...T.state.expanded, 'ps-37': false } }); }), span: 'full' },
        { label: 'Cancelled', note: 'Static row, no disclosure', html: () => row('before', 'product-sync', 'ps-33'), span: 'full' },
        { label: 'Moved from another series', note: '“from 1:1 · Maria Chen” replaces #n', html: () => row('before', 'product-sync', 'mc-31', () => { T.state = T.moveMeeting(T.state, 'mc-31', 'maria', 'product-sync'); }), span: 'full' },
        { label: 'Filed from Needs filing', html: () => row('before', 'acme', 'u-rec', () => { T.state = T.withFiled(T.state, 'u-rec', 'acme'); }), span: 'full' },
        { label: 'Dragging', note: 'Row at 45% while its grip is dragged to the sidebar', html: () => row('before', 'product-sync', 'ps-35', null, addClass('.mtg', 'dragging')), span: 'full' },
        { label: 'Received', note: 'Flash after “Jump to” or “Open as page”. Replay re-runs it.', html: () => `${row('before', 'product-sync', 'ps-35')}${replayBar()}`, span: 'full', mount: onReplay((c) => D.receive(c.querySelector('.mtg'))) },
        { label: '⋯ menu', note: 'Move to another series…, Split into new doc, Open transcript, Remove from this doc, Delete meeting…', html: () => menuFrom(meetingMenus().main, 1), bg: 'wallpaper', span: 2, height: 240 },
        { label: 'Move to', note: 'Tracked series with color swatches', html: () => menuFrom(meetingMenus().move, 2), bg: 'wallpaper', span: 2, height: 240 },
        { label: 'Delete confirm', note: 'Destructive primary (coral)', html: () => { const got = meetingMenus().ask; return got ? alertBox(got[0], true) : ''; }, bg: 'wallpaper', span: 2, height: 260 },
        { label: 'Move and insert', note: 'Replay move: the row’s head flies to “1:1 · Maria Chen” (Kit.flyTo 560ms), the row collapses away (Kit.removeAnimated 220ms), the target row flashes and its icon bumps. Replay insert: a newly filed meeting enters at the top (Kit.enterAnimated 280ms) and flashes.', html: moveDemo, span: 'full', flush: true, height: 330, bg: 'wallpaper', mount: mountMove },
        { label: 'Drag ghost · fly chip', note: 'Drag image while dragging the grip · chip that flies to the sidebar on Move/Remove', html: () => `<div class="cd-row"><div class="cd-ghost"><div class="drag-ghost">${icon('calendar')}Tue 15 Sep</div></div><div class="cd-fly" style="${flyInner}"><div class="fly-chip">${icon('calendar')}<span>Tue 15 Sep</span></div></div></div>`, bg: 'wallpaper', span: 2, height: 160 }
      ]
    },
    {
      id: 'knowledge-row',
      name: 'KnowledgeRow',
      summary: 'A filed meeting’s knowledge: type label, text, owner avatar, status and source. Superseded items are struck through.',
      mapsTo: 'Table-like list row (CSS grid 112px · 1fr · auto)',
      usedIn: ['MeetingRow (expanded)', 'PeekBody (past)'],
      source: '002 doc-past.js kRow / T.itemsOf · doc.css .k-list, .k-row, .k-side',
      props: [['type', 'decision | commitment | question | fact', '—'], ['status', 'current | open | completed | superseded | unresolved', '—'], ['owner', 'string', '—'], ['src', 'string', '—']],
      states: ['decision current', 'commitment open with owner', 'commitment done', 'superseded', 'compact (type on its own line)'],
      tokens: ['--separator', '--label-3', '--label-4', '--series-green', '--accent'],
      motion: 'None of its own.',
      a11y: 'Render as a list; status is text; avatar has a title with the owner’s name.',
      stories: [
        { label: 'Filed meeting', note: '#36: two decisions, an open commitment (Jon), a done one (Leo)', html: () => inState('before', null, () => page(pick(D.meetingBody(series('product-sync'), meeting('product-sync', 'ps-36')), '.k-list'))), span: 'full' },
        { label: 'Superseded', note: '#34: “runs until Oct 1” was replaced later', html: () => inState('before', null, () => page(pick(D.meetingBody(series('product-sync'), meeting('product-sync', 'ps-34')), '.k-list'))), span: 'full' },
        { label: 'Compact', note: 'Peek width', html: () => inState('before', null, () => compact(pick(D.meetingBody(series('product-sync'), meeting('product-sync', 'ps-36')), '.k-list'))), span: 2 }
      ]
    },
    {
      id: 'candidate-row',
      name: 'CandidateRow',
      summary: 'Something Telu found in the meeting, waiting for you: type, text, owner / due / “Resolves an open question”, the evidence chip and Accept · Correct · Reject. Only accepted items reach Memory.',
      mapsTo: 'List row with action buttons; Correct = inline contentEditable (BlockNote inline) · Undo via sonner toast',
      usedIn: ['MeetingRow (review)', 'PeekBody (needs review)'],
      source: '002 doc-past.js D.candRow (CAND_ACTIONS pending | editing | accepted | rejected) · doc-review.js D.setCandState, D.acceptCand, D.saveCorrection, D.acceptAll · doc.css .cand[data-state]',
      props: [
        ['candidate', '{ id, type, text, owner, due, resolves, ev: { t, who, quote } }', '—'],
        ['state', 'pending | editing | accepted | rejected', 'pending'],
        ['corrected', 'boolean', 'false'],
        ['onAccept / onCorrect / onReject / onUndo', '(id) => void', '—']
      ],
      states: ['pending', 'pending · owner and due', 'pending · resolves a question', 'correcting', 'accepted', 'accepted · corrected', 'rejected', 'compact'],
      tokens: ['--amber', '--surface-sunken', '--accent', '--accent-strong', '--content-bg', '--label-3', '--label-4', '--separator'],
      motion: 'State changes swap the row (outerHTML) instantly; .cand opacity transition 200ms ease covers fades. Correct: the text becomes editable with an accent ring and its text selected. Accept all accepts pending rows one by one every 70ms (setTimeout stagger), then one toast with Undo. Accepted items flash in Memory (.receive 1500ms) and the scrubber’s Memory tick bumps. Reduced motion: unchanged (no transforms). framer-motion: AnimatePresence mode="popLayout" keyed by state for the actions cell; stagger 0.07 for Accept all.',
      a11y: 'Actions are buttons (Reject is icon-only: aria-label “Reject”); the editable text needs role="textbox" and aria-label “Correct the text”; Enter saves, Esc cancels. After Accept, move focus to the next pending row.',
      stories: [
        { label: 'Review · interactive', note: REVIEW_NOTE, html: () => inState('after', null, () => `${page(`<div class="cd-counts-demo"><span class="mtg-counts cd-counts">${D.countsChips({ candidates: cands() })}</span></div><div class="review">${D.reviewHead({ candidates: cands() })}<div class="cand-list">${cands().map(D.candRow).join('')}</div></div>`)}<button class="btn sm cd-reset">${icon('undo')}Reset</button>`), span: 'full', mount: reviewDemo },
        { label: 'Pending', html: () => candList(cands().slice(0, 1)), span: 'full' },
        { label: 'Pending · owner and due', html: () => candList(cands().slice(2, 3)), span: 'full' },
        { label: 'Pending · resolves a question', html: () => candList(cands().slice(1, 2)), span: 'full' },
        { label: 'Correcting', note: 'Inline edit with accent ring; Save / Cancel', html: () => candList(cands({ c1: 'editing' }).slice(0, 1)), span: 'full' },
        { label: 'Accepted', note: '“In Memory”', html: () => candList(cands({ c4: 'accepted' }).slice(3, 4)), span: 'full' },
        { label: 'Accepted · corrected', note: '“Corrected · in Memory”', html: () => candList(cands({ c1: 'corrected' }).slice(0, 1)), span: 'full' },
        { label: 'Rejected', note: 'Struck through, faded meta, Undo', html: () => candList(cands({ c5: 'rejected' }).slice(4, 5)), span: 'full' },
        { label: 'Compact', note: 'Peek width: actions wrap under the text', html: () => inState('after', null, () => compact(`<div class="review"><div class="cand-list">${cands().slice(2, 3).map(D.candRow).join('')}</div></div>`)), span: 2 },
        { label: 'Compact · correcting', html: () => inState('after', null, () => compact(`<div class="review"><div class="cand-list">${cands({ c3: 'editing' }).slice(2, 3).map(D.candRow).join('')}</div></div>`)), span: 2 }
      ]
    },
    {
      id: 'review-head',
      name: 'ReviewHead',
      summary: 'Heads the review list: amber eye + “Review what Telu found — only what you accept reaches Memory.” with Accept all when more than one is pending; turns into “Reviewed — Memory is up to date.”',
      mapsTo: 'Header row + Button',
      usedIn: ['MeetingRow (review)', 'PeekBody (needs review)'],
      source: '002 doc-past.js D.reviewHead · doc.css .review-head, .review-note',
      props: [['pending', 'number', '0']],
      states: ['several pending (Accept all)', 'one pending', 'reviewed'],
      tokens: ['--amber', '--accent', '--label-2'],
      motion: 'Re-rendered in place when the pending count changes (instant).',
      a11y: 'Use role="status" so “Reviewed — Memory is up to date.” is announced.',
      stories: [
        { label: 'Several pending', html: () => page(`<div class="review">${D.reviewHead(reviewMeeting())}</div>`), span: 'full' },
        { label: 'One pending', note: 'No Accept all', html: () => page(`<div class="review">${D.reviewHead(reviewMeeting({ c1: 'accepted', c2: 'accepted', c3: 'rejected', c4: 'accepted' }))}</div>`), span: 'full' },
        { label: 'Reviewed', html: () => page(`<div class="review">${D.reviewHead(reviewMeeting({ c1: 'accepted', c2: 'accepted', c3: 'accepted', c4: 'accepted', c5: 'rejected' }))}</div>`), span: 'full' }
      ]
    },
    {
      id: 'counts-chips',
      name: 'CountsChips',
      summary: 'Right side of a meeting row: “N to review” (amber) while candidates are pending, “Reviewed” after, otherwise decision / action / doc counts.',
      mapsTo: 'Badge group',
      usedIn: ['MeetingRow', 'PeekBody (Summary head)'],
      source: '002 doc-past.js D.countsChips · kit .chip, .chip.amber',
      props: [['meeting', '{ candidates? | counts?, docs? }', '—']],
      states: ['to review', 'reviewed', 'counts', 'counts without docs', 'none'],
      tokens: ['--amber', '--amber-soft', '--fill-2', '--label-2'],
      motion: 'Re-rendered in place (instant) as candidates are handled.',
      a11y: 'Plain text chips; “5 to review” should be part of the row’s accessible name.',
      stories: [
        { label: 'To review', html: () => `<span class="mtg-counts">${D.countsChips(reviewMeeting())}</span>` },
        { label: 'Reviewed', html: () => `<span class="mtg-counts">${D.countsChips(reviewMeeting({ c1: 'accepted', c2: 'accepted', c3: 'accepted', c4: 'accepted', c5: 'rejected' }))}</span>` },
        { label: 'Counts', note: 'Decisions · actions · docs', html: () => `<span class="mtg-counts">${D.countsChips(DATA.series[0].meetings[1])}</span>` },
        { label: 'Counts without docs', html: () => `<span class="mtg-counts">${D.countsChips(DATA.series[1].meetings[1])}</span>` },
        { label: 'None', note: 'Nothing found (quick recording)', html: () => `<span class="mtg-counts">${D.countsChips({ counts: {}, docs: [] })}</span><span class="faint">(empty)</span>` }
      ]
    },
    {
      id: 'transcript-drawer',
      name: 'TranscriptDrawer',
      summary: 'Right-hand glass drawer with a meeting’s transcript: title, series · # · duration, “Transcribed on this Mac · evidence highlighted” and timestamped lines; the evidence line is highlighted and centred.',
      mapsTo: 'Custom side panel (non-modal) — Radix Dialog without overlay or Sheet (side="right", modal={false})',
      usedIn: ['Living doc page'],
      source: '002 doc-past.js D.drawerTranscript / D.transcriptLines · doc-page.js D.openDrawer, D.openTranscript, shiftCanvas · doc.css .drawer, .drawer.open, .tl, .tl.hl, .drawer-empty, .canvas-inner',
      props: [['series / meeting', 'Series, Meeting', '—'], ['highlight', 'string — timestamp to highlight', '—'], ['open', 'boolean', 'false'], ['onClose', '() => void', '—']],
      states: ['open', 'evidence highlighted', 'no highlight', 'empty', 'opening / closing'],
      tokens: ['--glass-strong', '--shadow-float', '--accent-soft', '--accent-strong', '--ease-drawer'],
      motion: 'Open: .drawer transform translateX(calc(100% + 24px)) → none in 300ms var(--ease-drawer), visibility immediate; close 200ms var(--ease-drawer) with visibility hidden after 200ms. The page column shifts left at the same time (.canvas-inner translateX(var(--shift)) 300ms / 200ms var(--ease-drawer)) so the doc stays readable; the scrubber fades out (opacity 200ms). Highlighted line: background-color 300ms ease; scrolled to the centre instantly on open. CSS transitions (interruptible). Reduced motion: slide and shift become instant. framer-motion: motion.aside animate={{ x: open ? 0 : "calc(100% + 24px)" }} transition={{ duration: open ? 0.3 : 0.2, ease: [0.32, 0.72, 0, 1] }}; animate the column x in sync.',
      a11y: 'role="complementary" aria-label “Transcript”; close button aria-label “Close”; Esc closes; lines are a list of <time> + speaker + text.',
      stories: [
        { label: 'Evidence highlighted', note: '#36 · 24:10 centred. Replay slides it out and back in.', html: () => `${transcript('product-sync', 'ps-36', '24:10')}${replayBar(['Replay slide'])}`, height: 500, span: 2, align: 'center start', mount: (c) => { centerHighlight(c); onReplay(slideDrawer)(c); } },
        { label: 'No highlight', note: 'Opened from “Open transcript”', html: () => transcript('product-sync', 'ps-35'), height: 500, span: 2 },
        { label: 'Empty', note: 'No highlighted moments', html: () => inState('before', null, () => drawer(D.drawerTranscript(series('hiring'), meeting('hiring', 'hi-4')), ' cd-short')), height: 370, span: 2 }
      ]
    },
    {
      id: 'drawer-info',
      name: 'DrawerInfo',
      summary: 'The same drawer showing living doc details (toolbar inspector): rhythm, calendar link, meetings, reference, memory, people and a privacy note.',
      mapsTo: 'Side panel content (definition list)',
      usedIn: ['Living doc page (toolbar · Details)'],
      source: '002 doc-past.js D.drawerInfo · doc-page.js D.toggleInspector · doc.css .drawer-body.info, .info-row, .info-people',
      props: [['series', 'Series', '—']],
      states: ['calendar series', 'grouped by you', 'new doc'],
      tokens: ['--glass-strong', '--separator', '--label-2', '--label-3'],
      motion: 'Trigger: the toolbar Details (inspector) button toggles it; ✕ or Esc closes. Same drawer slide as TranscriptDrawer — translateX(calc(100% + 24px)) → none 300ms open / 200ms close, var(--ease-drawer), CSS transition with the page column shifting in sync; the inspector button color → accent (150ms). Reduced motion: instant. framer-motion: shared with TranscriptDrawer (one Drawer component, two contents).',
      a11y: 'Render rows as <dl>; people list with names; close button labelled.',
      stories: [
        { label: 'Calendar series', html: () => inState('before', null, () => drawer(D.drawerInfo(series('product-sync')), ' cd-tall')), height: 620, span: 2 },
        { label: 'Grouped by you', note: 'Calendar: Not linked', html: () => inState('before', null, () => drawer(D.drawerInfo(series('hiring')), ' cd-tall')), height: 620, span: 2 },
        { label: 'New doc', note: 'Untitled, nothing yet', html: () => inState('before', null, () => drawer(D.drawerInfo(draft()), ' cd-short')), height: 370, span: 2 }
      ]
    },
    {
      id: 'scrubber',
      name: 'Scrubber',
      summary: 'Right-edge section index: ticks for Purpose, Memory, Next and each past meeting; the current one is long and accent. Hovering reveals labels on a glass pill; clicking scrolls there.',
      mapsTo: 'Custom nav (table of contents) — IntersectionObserver for the active item',
      usedIn: ['Living doc page'],
      source: '002 doc-page.js D.refreshMarks / D.updateActiveMark / D.scrubTo · doc.css .scrubber, .scrub-item, .scrub-label, .scrub-tick, .scrub-gap, tick-receive',
      props: [['marks', '{ id, label }[] (a gap after Next)', '[]'], ['active', 'string', '—']],
      states: ['rest', 'hover (labels)', 'item hover', 'active', 'tick received', 'hidden while the drawer is open'],
      tokens: ['--label-3', '--label-4', '--accent', '--accent-strong', '--glass-strong', '--shadow-float'],
      motion: 'Container: background + box-shadow + opacity 200ms ease (glass appears on hover; opacity 0 while the drawer is open). Labels: opacity 0→1 and translateX(4px)→0 in 150ms var(--ease-out) on hover. Tick: transform scaleX(0.56→1) + background (label-4 → accent) 200ms var(--ease-out) when active. Item: color 150ms ease, :active scale(0.96) 140ms. Receive (after accepting into Memory): tick-receive 900ms var(--ease-out) — scale(1.2, 2.4) and accent at 30%. Click scrolls smoothly (instant with reduced motion). Reduced motion: kit keeps only opacity/color transitions (ticks and labels jump), tick-receive still plays. framer-motion: whileHover on the nav for the glass; motion.span for ticks with animate={{ scaleX: active ? 1 : 0.56 }}.',
      a11y: '<nav aria-label="Sections"> with buttons named by their label (aria-label) and aria-current on the active one.',
      stories: [
        { label: 'Rest', note: 'Purpose active', html: () => scrub('sec-purpose'), height: 260 },
        { label: 'Hover', note: 'Labels on glass', html: () => scrub('sec-purpose', flag('.scrubber')), force: 'hover', height: 260 },
        { label: 'Item hover', note: '“Memory” darkens', html: () => scrub('sec-purpose', (r) => { flag('.scrubber')(r); r.querySelectorAll('.scrub-item')[1].setAttribute('data-force', ''); }), force: 'hover', height: 260 },
        { label: 'Received', note: 'Memory tick after Accept. Replay re-runs it.', html: () => `${scrub('sec-next')}${replayBar()}`, height: 260, mount: onReplay((c) => restart(c.querySelectorAll('.scrub-tick')[1], 'receive')) }
      ]
    },
    {
      id: 'repeats-control',
      name: 'RepeatsControl',
      summary: 'Replaces the header chips on a new doc: Repeats (None · Weekly · Every 2 weeks · Monthly), Day and Time pop-up buttons (disabled for None), then “Link to a calendar event…” and the people chip.',
      mapsTo: 'Radix ToggleGroup (single) + two Radix DropdownMenu pop-up buttons + link Button',
      usedIn: ['DocHeader (new doc)'],
      source: '002 doc-render.js repeatsMarkup / D.repeatsSub · doc-organize.js D.mountDraft, D.setDraft, D.pickDay, D.pickTime, D.linkEventMenu, D.linkEvent · app-data.js T.syncDraft',
      props: [['cadence', 'None | Weekly | Every 2 weeks | Monthly', 'None'], ['day', 'Mon…Fri | Weekdays', '—'], ['time', 'HH:MM', '—'], ['linked', 'string — “Linked to …”', '—'], ['people', 'string[]', '[]']],
      states: ['none (day/time disabled)', 'weekly', 'linked to an event', 'day menu', 'time menu', 'link menu'],
      tokens: ['--fill-2', '--content-bg', '--hairline', '--accent', '--label-2'],
      motion: 'Segmented thumb: transform translateX + width 240ms var(--ease-out) (Kit.segmented; placed without animation on mount). Pop-up buttons enable instantly (opacity 0.45 when disabled). Menus appear instantly and fade out 120ms. Picking a value repaints the buttons, the sidebar row and the Next block (NextBlock repaint). Reduced motion: the thumb jumps. framer-motion: layoutId thumb inside the ToggleGroup (spring or duration 0.24, ease [0.23,1,0.32,1]).',
      a11y: 'ToggleGroup with aria-label “Repeats”; pop-up buttons use aria-haspopup="menu" and are disabled (not hidden) when cadence is None; link button names the linked event.',
      stories: [
        { label: 'Interactive', note: 'Pick a cadence, then a day and a time (real Kit.segmented and menus)', html: () => `<div class="panel-host cd-host">${repeats(draft())}</div>`, span: 'full', height: 420, align: 'stretch', mount: wireRepeats },
        { label: 'Weekly', note: 'Tuesday · 10:00', html: () => repeats(weekly()), span: 'full', mount: segs },
        { label: 'Linked to an event', note: 'Link to a calendar event… → Daily Standup: cadence, time and people filled in', html: () => repeats(T.linkedSeries(draft(), T.LINKABLE[0])), span: 'full', mount: segs },
        { label: 'Day menu', html: () => draftMenu(D.pickDay), bg: 'wallpaper', span: 2, height: 230 },
        { label: 'Time menu', html: () => draftMenu(D.pickTime), bg: 'wallpaper', span: 2, height: 330 },
        { label: 'Link menu', note: 'Untracked events in the Work calendar', html: () => draftMenu(D.linkEventMenu), bg: 'wallpaper', span: 2, height: 160 }
      ]
    },
    {
      id: 'doc-menu',
      name: 'DocMenu',
      summary: 'The doc toolbar’s ⋯ menu: Rename, Edit purpose ⌘E, Export as Markdown ⇧⌘E and Stop tracking… (with its confirm).',
      mapsTo: 'Radix DropdownMenu + Radix AlertDialog',
      usedIn: ['Living doc toolbar'],
      source: '002 doc-popovers.js D.docMenu · app-actions.js T.confirmStopTracking',
      props: [['series', 'Series', '—']],
      states: ['menu', 'row active', 'stop tracking confirm'],
      tokens: ['--glass-strong', '--accent', '--coral-ink'],
      motion: 'Trigger: click ⋯. Menu appears instantly (no scale), rows highlight instantly on hover/arrows, choosing blinks the row (active off 60ms, on again) and closes after 130ms; the menu fades out 120ms (CSS transition). Alert: opacity 180ms + scale 0.95→1 220ms var(--ease-out), close 120/140ms. Reduced motion: opacity only. framer-motion: DropdownMenu.Content without enter animation (exit opacity 0.12s); AlertDialog.Content initial {opacity:0, scale:0.95}.',
      a11y: 'role="menu" with arrow-key navigation and ⌘ shortcuts shown; destructive row in coral; the alert is role="alertdialog" with Cancel as the default for Esc.',
      stories: [
        { label: 'Menu', html: () => inState('before', () => viewDoc('product-sync'), () => menuFrom(capture('menu', () => D.docMenu(document.createElement('button')))[0], 2)), bg: 'wallpaper', span: 2, height: 220 },
        { label: 'Stop tracking confirm', html: () => inState('before', null, () => { const [call] = capture('alert', () => T.confirmStopTracking('product-sync')); return call ? alertBox(call[0], false) : ''; }), bg: 'wallpaper', span: 2, height: 260 }
      ]
    },
    {
      id: 'living-doc-page',
      name: 'LivingDocPage',
      summary: 'The whole series page in context: doc toolbar, header, Purpose, Memory, Next, Meetings, the scrubber and the drawer. Scroll it, switch the scenario, open the inspector or a transcript, click chips and source chips.',
      mapsTo: 'Page composition (Next.js route /series/[id]) — BlockNote document with custom blocks',
      usedIn: ['Sidebar series rows', 'Side peek · Open as page'],
      source: '002 doc-past.js D.docMarkup · doc-page.js (paintPage, observeTitle, refreshMarks, openDrawer) · app-shell.js docToolbar',
      props: [['series', 'Series', '—'], ['reveal', '{ next } | { mid } — scroll target on open', '—']],
      states: ['before (brief)', 'live', 'after (review)', 'scrolled (toolbar glass + title in toolbar)', 'drawer open'],
      tokens: ['--content-bg', '--toolbar-h', '--ease-drawer', '--ease-out'],
      motion: 'Opening a series (sidebar, peek “Open as page”, island): WAAPI out 120ms ease-out (opacity 1→0, blur 2px, fill forwards) → swap → in 180ms var(--ease-out) (opacity 0→1, translateY 4px→0); then optional reveal (scroll to Next or a meeting + .receive). Scroll: toolbar glass + hairline (200ms ease) and large title into the toolbar (180ms). Details / transcript: drawer + column shift (300ms open / 200ms close, var(--ease-drawer)). Scenario switch in this tile re-renders instantly. Reduced motion: page swap and drawer are instant. framer-motion: AnimatePresence mode="wait" around the route with exit {opacity:0, filter:"blur(2px)"} 0.12s and initial {opacity:0, y:4}.',
      a11y: 'Main landmark with the doc; toolbar buttons have tooltips and shortcuts (⌘[ back, ⌘R record, ⌘E edit purpose, ⇧⌘E export); scrubber nav; drawer complementary region.',
      stories: [
        { label: 'Living doc · in context', note: 'Product Sync. Switch Before / Live / After at the bottom; try the inspector (right), Open transcript, source chips, chips and ⋯ menus.', html: pageStory, span: 'full', flush: true, height: 780, bg: 'window', mount: (c) => pageDemo(c, { id: 'before' }) }
      ]
    }
  );

  function evidenceStatic(host, surface, scenario = 'before') {
    return inState(scenario, () => viewDoc('product-sync'), () => {
      const root = document.body.appendChild(Kit.html(`<div class="panel-host" hidden${surface === 'peek' ? ' id="peek"' : ''}><div data-sid="product-sync">${host}</div></div>`));
      try {
        const [call] = capture('popover', () => D.openEvidence(root.querySelector('.source')));
        if (call) return popover(call[1], call[2]);
        const el = root.querySelector('.popover');
        if (!el) return '';
        const markup = `<div class="cat-static"><div class="popover open" role="dialog" style="width:${el.style.width}">${el.innerHTML}</div></div>`;
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        return markup;
      } finally {
        root.remove();
      }
    });
  }
})();
