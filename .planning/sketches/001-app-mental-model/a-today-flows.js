(() => {
  const AT = window.AT;
  const { esc } = Kit;
  const { plural, clone } = AT.util;
  const PREVIEW = [['title', 'Title'], ['cadence', 'Repeats'], ['day', 'Day'], ['time', 'Time'], ['people', 'With']];
  const slug = (text) => String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-');

  const peSection = (label, body) => `<section class="a-pe-sec"><div class="t-eyebrow">${label}</div>${body}</section>`;

  const peAgendaRow = (a) => `<div class="a-pe-arow"><span class="a-pe-grip">${icon('grip')}</span>`
    + `<span class="a-pe-item" contenteditable="true" data-ph="Agenda item">${esc(a.t)}</span>`
    + `<span class="a-pe-dur num" contenteditable="true" data-ph="5 min">${esc(a.d)}</span>`
    + `<button class="btn sm plain icon a-pe-del" data-pe="del" data-tip="Remove">${icon('minus')}</button></div>`;

  const purposeMarkup = (s) => {
    const p = s.purpose;
    const outcomes = (p.outcomes.length ? p.outcomes : ['']).map((o) => `<li>${esc(o)}</li>`).join('');
    return `<div class="a-pe-head">${Kit.seriesIcon(s)}<div class="a-pe-titles"><h2>${esc(s.name)} · Purpose</h2>`
      + `<p class="num">v${p.version} · Edited ${esc(p.edited)} by ${esc(p.by)}</p></div><span class="spacer"></span><span class="a-save" id="peSave"></span>`
      + `<button class="btn sm" data-pe="history">${icon('history')}History</button><button class="btn sm primary" data-pe="done">Done</button></div>`
      + '<div class="a-pe-body">'
      + peSection('Why we meet', `<div class="a-pe-edit a-pe-why" contenteditable="true" data-field="why" data-ph="What is this meeting for? One or two sentences.">${esc(p.why)}</div>`)
      + peSection('What good looks like', `<ul class="a-pe-edit a-pe-list" contenteditable="true" data-field="outcomes">${outcomes}</ul>`)
      + peSection('Standing agenda', `<div class="a-pe-agenda" id="peAgenda">${p.agenda.map(peAgendaRow).join('')}</div><button class="btn sm plain a-pe-add" data-pe="add-row">${icon('plus')}Add item</button>`)
      + peSection('Not for this meeting', `<div class="a-pe-edit" contenteditable="true" data-field="notFor" data-ph="What belongs somewhere else?">${esc(p.notFor)}</div>`)
      + `</div><div class="a-pe-foot">${icon('lock', 'sm')}Stored on this Mac · the next brief uses the latest version</div>`;
  };

  const clean = (text) => String(text || '').replace(/\s+/g, ' ').trim();
  const normalizeDur = (d) => `${parseInt(d, 10) || 5} min`;

  const readPurpose = (root) => ({
    why: clean(Kit.$('[data-field="why"]', root).innerText),
    outcomes: Kit.$$('[data-field="outcomes"] li', root).map((li) => clean(li.innerText)).filter(Boolean),
    agenda: Kit.$$('.a-pe-arow', root).map((row) => ({ t: clean(Kit.$('.a-pe-item', row).innerText), d: normalizeDur(Kit.$('.a-pe-dur', row).innerText) })).filter((a) => a.t),
    notFor: clean(Kit.$('[data-field="notFor"]', root).innerText)
  });

  const historyMarkup = (p) => '<div class="a-hist"><div class="t-eyebrow">Versions</div>'
    + p.history.map((h, i) => `<div class="a-hist-row"><span class="a-hist-v num${i === 0 ? ' is-current' : ''}">v${h.v}</span>`
      + `<div><b>${esc(h.note)}</b><span>${esc(h.date)}${i === 0 ? ' · current' : ''}</span></div></div>`).join('') + '</div>';

  const commitPurpose = (id, next) => {
    const s = AT.seriesById(id);
    const v = s.purpose.version + 1;
    AT.mapSeries(id, (x) => ({
      ...x,
      purpose: { ...x.purpose, ...next, version: v, edited: 'Sep 29', by: 'You', history: [{ v, date: 'Sep 29', note: 'Edited in Telu' }, ...x.purpose.history] }
    }));
    Kit.toast(`Purpose saved as v${v} — the next brief uses it`, { icon: 'check-circle' });
    AT.renderInspector();
    if (AT.state.view === 'series') AT.renderMain({ keepScroll: true });
    AT.morphAll((ev) => ev.series === id);
    Kit.$$(`[data-purpose-ver="${id}"]`).forEach((el) => el.classList.add('receive'));
  };

  const peHandlers = (sheet) => ({
    history: (btn) => Kit.popover(btn, historyMarkup(AT.seriesById(sheet.seriesId).purpose), { align: 'end', width: 290, container: sheet.el }),
    done: () => sheet.close(),
    'add-row': () => {
      const row = Kit.html(peAgendaRow({ t: '', d: '5 min' }));
      Kit.$('#peAgenda', sheet.el).appendChild(row);
      Kit.enterAnimated(row);
      Kit.$('.a-pe-item', row).focus();
      sheet.markDirty();
    },
    del: (btn) => {
      Kit.removeAnimated(btn.closest('.a-pe-arow'));
      sheet.markDirty();
    }
  });

  const onPurposeKey = (event) => {
    const target = event.target;
    if (event.key !== 'Enter' || !target.matches('.a-pe-item, .a-pe-dur')) return;
    event.preventDefault();
    if (target.matches('.a-pe-item')) Kit.$('.a-pe-dur', target.closest('.a-pe-arow')).focus();
    else target.blur();
  };

  AT.openPurpose = (seriesId) => {
    const s = AT.seriesById(seriesId);
    if (!s) return Kit.toast('Select a tracked meeting to edit its purpose', { icon: 'pencil' });
    if (AT.ui.sheet) AT.ui.sheet.close();
    let dirty = false;
    let timer;
    const api = Kit.sheet(purposeMarkup(s), {
      width: 640, className: 'a-pe',
      onClose: () => {
        AT.ui.sheet = null;
        clearTimeout(timer);
        if (dirty) commitPurpose(seriesId, readPurpose(api.el));
      }
    });
    const sheet = {
      el: api.el, seriesId, close: () => api.close(),
      markDirty: () => {
        dirty = true;
        AT.saveIndicator(Kit.$('#peSave', api.el), 'saving');
        clearTimeout(timer);
        timer = setTimeout(() => AT.saveIndicator(Kit.$('#peSave', api.el), 'saved'), 800);
      }
    };
    AT.ui.sheet = api;
    const handlers = peHandlers(sheet);
    api.el.addEventListener('input', sheet.markDirty);
    api.el.addEventListener('keydown', onPurposeKey);
    api.el.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-pe]');
      if (btn) handlers[btn.dataset.pe](btn);
    });
  };

  const detectItems = () => DATA.detected.map((d) => ({ ...d, key: d.series || slug(d.title) }));

  const detectRow = (d) => {
    const s = d.series ? AT.seriesById(d.series) : null;
    const lead = s ? Kit.seriesIcon(s) : '<span class="a-det-dot"><i class="series-dot"></i></span>';
    const sub = d.ignored ? d.note : `${s ? s.rule : d.rule} · ${plural(d.found, 'meeting')}`;
    const note = !d.ignored && d.note ? `<span class="a-det-note">${esc(d.note)}</span>` : '';
    return `<div class="a-det-row${d.ignored ? ' is-off' : ''}">${lead}<div class="a-det-text"><b>${esc(s ? s.name : d.title)}</b><span>${esc(sub)}</span>${note}</div>`
      + `<button class="switch" aria-checked="${!!d.on && !d.ignored}" data-detect="${d.key}"${d.ignored ? ' disabled' : ''}></button></div>`;
  };

  const trackLabel = (n) => (n ? `Track ${plural(n, 'series', 'series')}` : 'Track series');

  const detectMarkup = (items, chosen) => `<div class="sheet-head a-det-head"><span class="a-det-icon">${icon('sparkles')}</span>`
    + `<div><h2>Telu found ${chosen.length} recurring meetings</h2><p>Choose which ones get a brief. You can change this anytime.</p></div></div>`
    + `<div class="sheet-body"><div class="a-det-list card">${items.map(detectRow).join('')}</div></div>`
    + `<div class="sheet-foot"><span class="a-local">${icon('lock', 'sm')}Read on this Mac</span><span class="spacer"></span>`
    + `<button class="btn" data-close="later">Not now</button><button class="btn primary" data-close="track" id="detTrack">${trackLabel(chosen.length)}</button></div>`;

  const openDetect = () => {
    const items = detectItems();
    let chosen = items.filter((d) => d.on && !d.ignored).map((d) => d.key);
    const sheet = Kit.sheet(detectMarkup(items, chosen), {
      width: 540, className: 'a-det',
      onClose: (result) => {
        AT.ui.sheet = null;
        if (result === 'track' && chosen.length) applyDetected(chosen);
        else deferDetect();
      }
    });
    AT.ui.sheet = sheet;
    sheet.el.addEventListener('toggle', (e) => {
      const key = e.target.dataset.detect;
      if (!key) return;
      chosen = e.detail.checked ? [...chosen, key] : chosen.filter((k) => k !== key);
      const btn = Kit.$('#detTrack', sheet.el);
      btn.textContent = trackLabel(chosen.length);
      btn.disabled = !chosen.length;
    });
  };

  const deferDetect = () => {
    AT.set({ detectLater: true });
    AT.updateCounts();
    Kit.toast('Okay — find them anytime in Found in Calendar', { icon: 'sparkles' });
  };

  const applyDetected = (keys) => {
    const ids = keys.filter((k) => AT.seriesById(k));
    AT.set({
      series: AT.state.series.map((s) => (ids.includes(s.id) ? { ...s, tracked: true } : s)),
      proposals: ids.includes('acme') ? clone(DATA.proposals.filter((p) => p.kind === 'join')) : [],
      detectLater: false
    });
    if (keys.includes('daily-standup')) AT.addStandupSeries();
    AT.renderSidebar();
    const list = Kit.$('#sbSeries');
    if (list) Kit.stagger(list, '.a-sb-row');
    Kit.$$('#sbSeries .a-sb-row').forEach((row, i) => setTimeout(() => row.classList.add('receive'), 160 + i * 45));
    AT.morphAll(() => true);
    AT.updateCounts();
    AT.updateToolbar();
    const next = AT.nextUpId();
    if (next) setTimeout(() => AT.select(next), 420);
    Kit.toast(`Tracking ${plural(keys.length, 'series', 'series')} — briefs are on the way`, { icon: 'check-circle' });
  };

  const allowCalendar = () => {
    AT.set({ calendar: 'connected', inspect: null });
    AT.renderSidebar();
    Kit.enterAnimated(Kit.$('#sidebar'));
    AT.updateToolbar();
    AT.renderMain({ stagger: true });
    AT.renderInspector({ animate: true });
    AT.runProgress(900).then(() => setTimeout(openDetect, 160));
  };

  const connect = async () => {
    const answer = await Kit.alert({
      title: '“Telu” Would Like to Access Your Calendars',
      message: 'Telu reads events on this Mac to find recurring meetings and prepare a brief before each one. Nothing is uploaded.',
      buttons: [{ label: 'Don’t Allow', value: 'deny' }, { label: 'Allow Full Access', value: 'allow', primary: true }]
    });
    if (answer === 'allow') return allowCalendar();
    AT.set({ calendar: 'denied' });
    AT.renderMain();
    AT.fx.fadeIn(AT.el.agendaInner, { duration: 200 });
  };

  const proposalCard = (p) => {
    const more = p.extra ? `<span class="a-more">+${p.extra}</span>` : '';
    if (p.kind === 'join') {
      const target = AT.seriesById(p.target);
      return `<article class="a-pcard card" data-proposal="${p.id}"><div class="a-pcard-kind">${icon('link')}Looks like part of ${esc(target.name)}</div>`
        + `<div class="a-pcard-main">${Kit.seriesIcon(target)}<div class="a-pcard-text"><b>${esc(p.title)}</b><span>${esc(p.when)}</span></div></div>`
        + `<p class="a-pcard-reason">${esc(p.reason)}</p><div class="a-pcard-actions"><button class="btn sm primary" data-prop="join">Add to ${esc(target.name)}</button>`
        + '<button class="btn sm" data-prop="separate">Keep separate</button></div></article>';
    }
    if (p.quiet) {
      return `<article class="a-pcard card is-quiet" data-proposal="${p.id}"><div class="a-pcard-main"><span class="a-pcard-icon">${icon('repeat')}</span>`
        + `<div class="a-pcard-text"><b>${esc(p.title)}</b><span>${esc(p.reason)}</span></div>`
        + '<div class="a-pcard-inline"><button class="btn sm" data-prop="track">Track anyway</button><button class="btn sm plain" data-prop="dismiss">Stop suggesting</button></div></div></article>';
    }
    return `<article class="a-pcard card" data-proposal="${p.id}"><div class="a-pcard-kind">${icon('sparkles')}New recurring meeting</div>`
      + `<div class="a-pcard-main"><span class="a-pcard-icon">${icon('repeat')}</span><div class="a-pcard-text"><b>${esc(p.title)}</b><span>${esc(p.rule)} · ${esc(p.calendar)}</span></div>`
      + `<span class="spacer"></span>${Kit.avatars(p.people, 3)}${more}</div><p class="a-pcard-reason">${esc(p.reason)}</p>`
      + '<div class="a-pcard-actions"><button class="btn sm primary" data-prop="track">Track as series</button><button class="btn sm" data-prop="dismiss">Not a series</button></div></article>';
  };

  const caughtUp = () => `<div class="empty a-caught"><span class="a-empty-badge">${icon('check-circle', 'xl')}</span><h3>You’re all caught up</h3><p>Telu will mention it when something new starts repeating.</p></div>`;

  const proposalsMarkup = () => {
    const list = AT.state.proposals;
    const loud = list.filter((p) => !p.quiet);
    const quiet = list.filter((p) => p.quiet);
    const body = list.length
      ? `${loud.map(proposalCard).join('')}${quiet.length ? `<div class="t-eyebrow a-pcards-sub">Less likely</div>${quiet.map(proposalCard).join('')}` : ''}`
      : caughtUp();
    return '<div class="sheet-head"><h2>Found in your calendar</h2><p>Telu noticed these patterns. Decide once — it won’t ask again.</p></div>'
      + `<div class="sheet-body a-pcards" id="pcards">${body}</div>`
      + `<div class="sheet-foot"><span class="a-local">${icon('lock', 'sm')}Read on this Mac</span><span class="spacer"></span><button class="btn" data-close>Done</button></div>`;
  };

  const trackNewFromProposal = (p, from) => {
    const s = AT.newSeriesTemplate('growth');
    AT.set({ series: [...AT.state.series.filter((x) => x.id !== s.id), s] });
    AT.revealSeriesRow(s.id, from);
    AT.updateCounts();
    const undo = () => {
      AT.set({ series: AT.state.series.filter((x) => x.id !== s.id), proposals: [p, ...AT.state.proposals] });
      AT.dropSeriesRow(s.id);
      AT.updateCounts();
      AT.updateBanner();
    };
    Kit.toast(`Telu will prepare briefs for ${esc(s.name)}`, { icon: 'check-circle', action: { label: 'Undo', onClick: undo } });
  };

  const PROPOSAL_EFFECTS = {
    track: (p, from) => (p.id === 'pr-standup' ? AT.trackStandup(from) : trackNewFromProposal(p, from)),
    dismiss: (p) => Kit.toast(p.quiet ? `Telu will stop suggesting ${esc(p.title)}` : `Okay — ${esc(p.title)} stays a regular event`, { icon: 'check' }),
    join: (p, from) => AT.joinProposal(p, from),
    separate: (p) => AT.keepSeparate(p)
  };

  const decideProposal = (sheetEl, btn) => {
    const card = btn.closest('[data-proposal]');
    const p = AT.state.proposals.find((x) => x.id === card.dataset.proposal);
    if (!p) return;
    const from = Kit.$('.a-pcard-main', card) || card;
    AT.set({ proposals: AT.state.proposals.filter((x) => x.id !== p.id) });
    PROPOSAL_EFFECTS[btn.dataset.prop](p, from);
    card.style.pointerEvents = 'none';
    Kit.removeAnimated(card).then(() => {
      const body = Kit.$('#pcards', sheetEl);
      if (body && !AT.state.proposals.length) {
        body.innerHTML = caughtUp();
        AT.fx.fadeIn(body, { duration: 220 });
      }
    });
    AT.updateCounts();
    AT.updateBanner();
  };

  AT.openProposals = () => {
    if (AT.ui.sheet) AT.ui.sheet.close();
    const sheet = Kit.sheet(proposalsMarkup(), { width: 560, className: 'a-props', onClose: () => { AT.ui.sheet = null; } });
    AT.ui.sheet = sheet;
    sheet.el.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-prop]');
      if (btn) decideProposal(sheet.el, btn);
    });
  };

  AT.openFound = () => (AT.state.detectLater ? openDetect() : AT.openProposals());

  const standupPeople = () => (DATA.proposals.find((p) => p.id === 'pr-standup') || { people: [] }).people;
  const WEEKDAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const dayShort = (ev) => WEEKDAY[AT.dayOf(ev.id)] || 'Tue';

  const previewFor = (text, linked) => {
    if (linked) {
      return {
        title: clean(text) || linked.title,
        cadence: linked.repeat || 'One-off',
        day: linked.repeat === 'Daily' ? 'Weekdays' : dayShort(linked),
        time: linked.start,
        people: linked.people || (linked.title === 'Daily Standup' ? standupPeople() : [])
      };
    }
    return clean(text) ? Kit.parseSeries(text) : { title: '', cadence: null, day: null, time: null, people: [] };
  };

  const chipValue = (p, key) => (key === 'people' ? (p.people || []).map((n) => n.split(' ')[0]).join(', ') : p[key] || '');

  const newMarkup = (text) => `<div class="a-newser"><div class="a-new-head"><b>New series</b><span class="spacer"></span><span class="kbd">⌥⌘N</span></div>`
    + `<input class="field lg a-new-field" placeholder="Describe it — e.g. Weekly 1:1 with Priya, Thu 11am" value="${esc(text)}" spellcheck="false">`
    + `<div class="a-new-preview" id="newPreview">${PREVIEW.map(([key, label]) => `<span class="a-pchip is-empty" data-k="${key}"><small>${label}</small><b>—</b></span>`).join('')}</div>`
    + '<div class="collapsible collapsed" id="newLinkWrap"><div><div class="a-new-linked" id="newLinked"></div></div></div>'
    + `<div class="a-new-foot"><button class="btn sm plain" data-new="link">${icon('link')}or link a calendar event…</button><span class="spacer"></span>`
    + '<button class="btn sm primary" data-new="create" disabled>Create<span class="kbd">↩</span></button></div></div>';

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
    return AT.state.days.slice(AT.TODAY).flatMap((d) => d.events).filter((ev) => {
      const kind = AT.kindOf(ev);
      if (!['recurring', 'oneoff'].includes(kind) || seen.has(ev.title)) return false;
      seen.add(ev.title);
      return true;
    });
  };

  const toastFor = (p) => {
    if (p.day || p.time) return `Created ${esc(p.title)} — first brief before ${esc([p.day, p.time].filter(Boolean).join(' '))}`;
    return `Created ${esc(p.title)} — add a purpose to shape its first brief`;
  };

  const createSeries = (p, linked, fromEl) => {
    if (linked && linked.title === 'Daily Standup') return AT.trackStandup(fromEl);
    const s = AT.makeManualSeries({ ...p, link: linked });
    AT.set({ series: [...AT.state.series, s] });
    if (linked) AT.mapEvents((e) => e.id === linked.id, (e) => ({ ...e, series: s.id }));
    AT.revealSeriesRow(s.id, fromEl);
    if (linked) AT.morphCard(linked.id);
    AT.updateCounts();
    if (linked && AT.inspectorShows(linked.id)) AT.renderInspector({ animate: true });
    Kit.toast(toastFor(p), { icon: 'check-circle' });
  };

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
      if (linked) Kit.$('#newLinked', pop.el).innerHTML = `${icon('link')}<span class="truncate">Linked to <b>${esc(linked.title)}</b> · ${esc(linked.calendar)} calendar</span><button class="btn sm plain icon" data-new="unlink" data-tip="Unlink">${icon('x')}</button>`;
    };
    const commit = () => {
      const p = previewFor(input.value, linked);
      if (!p.title) return;
      createSeries(p, linked, Kit.$('#newPreview', pop.el));
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

  const linkMenu = (btn, pop, onPick) => {
    const events = linkableEvents();
    const items = events.length
      ? [{ title: 'Not tracked yet' }, ...events.map((ev) => ({ label: esc(ev.title), icon: ev.repeat ? 'repeat' : 'calendar', kbd: esc(ev.repeat || `${dayShort(ev)} ${ev.start}`), onSelect: () => onPick(ev) }))]
      : [{ label: 'Every calendar event is tracked', disabled: true }];
    Kit.menu(btn, items, { container: pop.el, minWidth: 250 });
  };

  AT.openNewSeries = (trigger, { text = '', link = null } = {}) => {
    const anchor = trigger || Kit.$('#newBtn');
    const align = anchor.closest('.sidebar, .a-first, .a-card, .a-insp') || anchor.dataset.align === 'start' ? 'start' : 'end';
    const pop = Kit.popover(anchor, newMarkup(text), { align, width: 380, className: 'a-newpop' });
    if (pop) wireNewSeries(pop, link);
  };

  const seriesHit = (s) => `<div class="row hoverable a-hit" data-hit data-series="${s.id}">${Kit.seriesIcon(s)}<span class="truncate">${esc(s.name)}</span><span class="spacer"></span><span class="faint truncate">${esc(s.rule.split(' · ')[0])}</span></div>`;

  const memoryHit = (s, k) => `<div class="row hoverable a-hit" data-hit data-series="${s.id}"><span class="ktype" data-type="${k.type}">${icon(k.type)}</span>`
    + `<span class="truncate">${esc(k.text)}</span><span class="spacer"></span><span class="faint truncate a-hit-meta">${esc(s.name)}</span></div>`;

  const searchResults = (raw) => {
    const q = clean(raw).toLowerCase();
    const tracked = AT.tracked();
    if (!q) return `<div class="a-search-hint">Series</div>${tracked.slice(0, 5).map(seriesHit).join('')}`;
    const series = tracked.filter((s) => s.name.toLowerCase().includes(q) || s.people.some((n) => n.toLowerCase().includes(q)));
    const memory = tracked.flatMap((s) => s.memory.filter((k) => k.text.toLowerCase().includes(q)).map((k) => ({ s, k }))).slice(0, 5);
    if (!series.length && !memory.length) return `<div class="a-search-empty">No matches for “${esc(clean(raw))}”</div>`;
    return `${series.length ? `<div class="a-search-hint">Series</div>${series.map(seriesHit).join('')}` : ''}`
      + `${memory.length ? `<div class="a-search-hint">In memory</div>${memory.map(({ s, k }) => memoryHit(s, k)).join('')}` : ''}`;
  };

  const openSearch = (el) => {
    const pop = Kit.popover(el, `<div class="a-search"><div class="search">${icon('search')}<input class="field" placeholder="Search series, people, decisions" spellcheck="false"></div><div class="a-search-results" id="searchResults"></div></div>`, { align: 'end', width: 400 });
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
      AT.openSeries(hit.dataset.series);
    });
    render();
    setTimeout(() => input.focus(), 40);
  };

  Object.assign(AT.actions, {
    connect,
    search: openSearch,
    'new-series': (el) => AT.openNewSeries(el),
    'edit-purpose': (el) => AT.openPurpose(el.dataset.series),
    'open-proposals': () => AT.openProposals()
  });
})();
