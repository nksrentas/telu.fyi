(() => {
  const T = window.T;
  const D = T.doc;
  const { esc } = Kit;
  const PREVIEW = [['title', 'Title'], ['cadence', 'Repeats'], ['day', 'Day'], ['time', 'Time'], ['people', 'With']];
  const clean = (text) => String(text || '').replace(/\s+/g, ' ').trim();
  const flyChip = (glyph, label) => `<div class="fly-chip">${glyph}<span>${esc(label)}</span></div>`;

  const trackNewFromProposal = (p, from) => {
    const s = T.seriesFromProposal(p);
    T.set({ series: [...T.state.series.filter((x) => x.id !== s.id), s] });
    T.revealSeriesRow(s.id, from);
    T.updateCounts();
    T.updateBanner();
    const undo = () => {
      T.set({ series: T.state.series.filter((x) => x.id !== s.id), proposals: [p, ...T.state.proposals] });
      T.dropSeriesRow(s.id);
      T.updateCounts();
      T.updateBanner();
      T.renderPageIfFound();
    };
    T.toast(`Created a living doc for ${esc(s.name)}`, { icon: 'check-circle', action: { label: 'Undo', onClick: undo } });
  };
  const PROPOSAL_EFFECTS = {
    'prop-track': (p, from) => (p.id === 'pr-standup' ? T.trackStandup(from) : trackNewFromProposal(p, from)),
    'prop-dismiss': (p) => T.toast(p.quiet ? `Telu will stop suggesting ${esc(p.title)}` : `Okay — ${esc(p.title)} stays a regular event`, { icon: 'check' }),
    'prop-join': (p, from) => T.joinProposal(p, from),
    'prop-separate': (p) => T.keepSeparate(p)
  };
  const decideProposal = (btn) => {
    const card = btn.closest('[data-proposal]');
    const p = T.state.proposals.find((x) => x.id === card.dataset.proposal);
    if (!p) return;
    const from = Kit.$('.a-pcard-main', card) || card;
    T.set({ proposals: T.state.proposals.filter((x) => x.id !== p.id) });
    PROPOSAL_EFFECTS[btn.dataset.act](p, from);
    card.style.pointerEvents = 'none';
    Kit.removeAnimated(card).then(() => {
      const holder = Kit.$('#pcards');
      if (holder && !T.state.proposals.length) {
        holder.innerHTML = T.pages.caughtUp();
        T.fx.fadeIn(holder, { duration: 220 });
      }
    });
    T.updateCounts();
    T.updateBanner();
  };
  const previewFor = (text, linked) => {
    if (linked) {
      const ev = T.LINKABLE.find((x) => x.id === linked.id) || { patch: {} };
      return { title: clean(text) || linked.title, cadence: linked.repeat || 'One-off', day: ev.patch.day || T.dayLabel(T.dayOf(linked.id)).split(' ')[0], time: linked.start, people: linked.people || ev.patch.people || [] };
    }
    return clean(text) ? Kit.parseSeries(text) : { title: '', cadence: null, day: null, time: null, people: [] };
  };
  const chipValue = (p, key) => (key === 'people' ? (p.people || []).map((n) => n.split(' ')[0]).join(', ') : p[key] || '');
  const newMarkup = (text) => `<div class="a-newser"><div class="a-new-head"><b>New series</b><span class="spacer"></span><span class="kbd">⌥⌘N</span></div>`
    + `<input class="field lg a-new-field" placeholder="Describe it — e.g. Weekly 1:1 with Priya, Thu 11am" value="${esc(text)}" spellcheck="false">`
    + `<div class="a-new-preview" id="newPreview">${PREVIEW.map(([key, label]) => `<span class="a-pchip is-empty" data-k="${key}"><small>${label}</small><b>—</b></span>`).join('')}</div>`
    + '<div class="collapsible collapsed" id="newLinkWrap"><div><div class="a-new-linked" id="newLinked"></div></div></div>'
    + `<div class="a-new-foot"><button class="btn sm plain" data-new="link">${icon('link')}or link a calendar event…</button><span class="spacer"></span>`
    + '<button class="btn sm primary" data-new="create" disabled>Create<span class="kbd">↩</span></button></div>'
    + `<p class="a-new-note">${icon('doc', 'sm')}Opens its living doc — purpose, memory and meetings in one place</p></div>`;
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
    return T.state.days.slice(T.TODAY).flatMap((d) => d.events).filter((ev) => {
      if (!['recurring', 'oneoff'].includes(T.kindOf(ev)) || seen.has(ev.title) || !T.LINKABLE.some((x) => x.title === ev.title)) return false;
      seen.add(ev.title);
      return true;
    });
  };
  const toastFor = (s) => {
    const up = T.upcomingOf(s);
    if (up) return `Created ${esc(s.name)} — first brief the evening before ${esc(up.date)}`;
    return `Created ${esc(s.name)} — add a purpose to shape its first brief`;
  };
  const createSeries = (text, linked, fromEl) => {
    const parsed = Kit.parseSeries(clean(text) || (linked ? linked.title : ''));
    const base = T.applyParsed(T.draftSeries(T.nextSeq()), parsed);
    const link = linked && T.LINKABLE.find((x) => x.id === linked.id);
    const s = link ? T.linkedSeries(base, link) : base;
    T.set({ series: [...T.state.series, s] });
    if (link) T.mapEvents((ev) => ev.title === link.title && !T.trackedSeriesOf(ev), (ev) => ({ ...ev, series: s.id }));
    T.renderSidebar();
    T.syncSidebarSelection();
    const row = Kit.$(`#sidebar [data-series="${s.id}"]`);
    if (row) row.classList.add('landing');
    const land = () => {
      if (row) row.classList.remove('landing');
      T.openDoc(s.id).then((ok) => ok && D.focusPurpose());
    };
    Kit.flyTo(fromEl, row, { markup: flyChip(Kit.seriesIcon(s), s.name) }).then(land, land);
    T.updateCounts();
    T.toast(toastFor(s), { icon: 'check-circle' });
  };
  const linkMenu = (btn, pop, onPick) => {
    const events = linkableEvents();
    const items = events.length
      ? [{ title: 'Not tracked yet' }, ...events.map((ev) => ({ label: esc(ev.title), icon: ev.repeat ? 'repeat' : 'calendar', kbd: esc(ev.repeat || `Today ${ev.start}`), onSelect: () => onPick(ev) }))]
      : [{ label: 'Every calendar event is tracked', disabled: true }];
    Kit.menu(btn, items, { container: pop.el, minWidth: 250 });
  };
  const linkedMarkup = (ev) => `${icon('link')}<span class="truncate">Linked to <b>${esc(ev.title)}</b> · ${esc(ev.calendar)} calendar</span><button class="btn sm plain icon" data-new="unlink" data-tip="Unlink">${icon('x')}</button>`;
  const wireNewSeries = (pop, link) => {
    let linked = link;
    let timer;
    const input = Kit.$('input', pop.el);
    const create = Kit.$('[data-new="create"]', pop.el);
    const refresh = () => {
      const p = previewFor(input.value, linked);
      updateChips(pop.el, p);
      create.disabled = !p.title;
      Kit.$('#newLinkWrap', pop.el).classList.toggle('collapsed', !linked);
      if (linked) Kit.$('#newLinked', pop.el).innerHTML = linkedMarkup(linked);
    };
    const commit = () => {
      const p = previewFor(input.value, linked);
      if (!p.title) return;
      const from = Kit.$('#newPreview', pop.el);
      if (linked && linked.title === 'Daily Standup') T.trackStandup(from);
      else createSeries(input.value, linked, from);
      pop.close();
    };
    input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(refresh, 90); });
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      refresh();
      if (!create.disabled) commit();
    });
    pop.el.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-new]');
      if (!btn) return;
      if (btn.dataset.new === 'create') commit();
      if (btn.dataset.new === 'unlink') { linked = null; refresh(); input.focus(); }
      if (btn.dataset.new === 'link') linkMenu(btn, pop, (ev) => { linked = ev; input.value = ev.title; refresh(); input.focus(); });
    });
    refresh();
    setTimeout(() => input.focus(), 40);
  };
  T.openNewSeries = (trigger, { text = '', link = null } = {}) => {
    T.showWindow();
    const anchor = trigger || Kit.$('#newBtn') || Kit.$('#tbDocGroup') || Kit.$('#sidebar .a-sb-add');
    if (!anchor) return;
    const align = anchor.closest('.sidebar, .a-first, .a-card, .peek, #tbDocGroup') || anchor.dataset.align === 'start' ? 'start' : 'end';
    const pop = Kit.popover(anchor, newMarkup(text), { align, width: 380, className: 'a-newpop' });
    if (pop) wireNewSeries(pop, link);
  };

  const seriesHit = (s) => `<div class="row hoverable a-hit" data-hit data-series="${s.id}">${Kit.seriesIcon(s)}<span class="truncate">${esc(s.name || 'Untitled')}</span><span class="spacer"></span><span class="faint truncate">${esc((s.rule || 'Manual').split(' · ')[0])}</span></div>`;
  const memoryHit = (s, k) => `<div class="row hoverable a-hit" data-hit data-series="${s.id}"><span class="ktype" data-type="${k.type}">${icon(k.type)}</span>`
    + `<span class="truncate">${esc(k.text)}</span><span class="spacer"></span><span class="faint truncate a-hit-meta">${esc(s.name)}</span></div>`;
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
  T.openSearch = (trigger) => {
    T.showWindow();
    const anchor = trigger || Kit.$('#searchBtn') || Kit.$('#tbDocGroup');
    const pop = Kit.popover(anchor, `<div class="a-search"><div class="search">${icon('search')}<input class="field" placeholder="Search series, people, decisions" spellcheck="false"></div><div class="a-search-results" id="searchResults"></div></div>`, { align: 'end', width: 400 });
    if (!pop) return;
    const input = Kit.$('input', pop.el);
    const results = Kit.$('#searchResults', pop.el);
    const render = () => { results.innerHTML = searchResults(input.value); };
    input.addEventListener('input', render);
    input.addEventListener('keydown', (e) => {
      const first = Kit.$('[data-hit]', results);
      if (e.key === 'Enter' && first) first.click();
    });
    results.addEventListener('click', (e) => {
      const hit = e.target.closest('[data-hit]');
      if (!hit) return;
      pop.close();
      T.openDoc(hit.dataset.series);
    });
    render();
    setTimeout(() => input.focus(), 40);
  };

  Object.assign(T.actions, {
    search: (el) => T.openSearch(el),
    'new-series': (el) => T.openNewSeries(el),
    'prop-track': decideProposal,
    'prop-dismiss': decideProposal,
    'prop-join': decideProposal,
    'prop-separate': decideProposal
  });
})();
