CC.palette = (() => {
  const { $, esc } = Kit;
  const CADENCE_SHORT = { Weekly: 'Weekly', 'Every 2 weeks': '2 weeks', Monthly: 'Monthly', Manual: 'Manual', Daily: 'Daily' };
  const ENTER_LABEL = { create: 'create', 'create-help': 'open', purpose: 'edit', attach: 'choose file', file: 'choose series' };
  const P = { open: false, query: '', sel: null, focus: 'list', stack: [], editing: null, groups: [], flat: [], sig: null, view: null };
  const els = {};
  const norm = (text) => String(text).toLowerCase();
  const matches = (text, q) => q.split(/\s+/).filter(Boolean).every((w) => norm(text).includes(w));
  const count = (n, tone = '') => `<span class="cl-count ${tone}">${n}</span>`;
  const isEditable = (t) => Boolean(t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)));

  function upNextMeta(st, m) {
    if (m.id === 'ps-37' && st.phase === 'live') return `<span class="cl-live"><span class="rec-dot"></span><span class="num" data-elapsed>${CC.formatElapsed(CC.elapsed())}</span></span>`;
    if (m.id === 'ps-37' && st.phase === 'filing') return '<span class="faint">Filing…</span>';
    return `<span class="num cl-until">${CC.untilLabel(m)}</span>`;
  }
  const meetingItem = ({ series: s, meeting: m }, key, meta) => ({
    key: key || `meeting:${m.id}`, kind: 'meeting', id: m.id, title: m.title || (key ? s.name : `${s.name} #${m.n}`),
    lead: Kit.seriesIcon(s), meta: meta || `<span class="faint num">${esc(m.date)}</span>`
  });
  const seriesItem = (s) => ({ key: `series:${s.id}`, kind: 'series', id: s.id, title: s.name, lead: Kit.seriesIcon(s), meta: `<span class="faint">${esc(CADENCE_SHORT[s.cadence] || s.cadence)}</span>` });
  const personItem = (name) => ({ key: `person:${name}`, kind: 'person', id: name, title: name, lead: Kit.avatar(esc(name)) });
  const docItem = (name) => ({ key: `doc:${name}`, kind: 'doc', id: name, title: name, lead: Kit.fileBadge(name) });

  function homeGroups(st) {
    if (!st.onboarded) return [{ title: 'Get started', items: [{ key: 'setup', kind: 'setup', title: 'Set up Telu', lead: CC.glyph('sparkles', 'accent') }] }];
    const groups = [];
    const next = CC.upcoming();
    if (next) groups.push({ title: ['live', 'filing'].includes(st.phase) ? 'Now' : 'Up next', items: [meetingItem(next, 'upnext', upNextMeta(st, next.meeting))] });
    const pending = CC.pending();
    if (pending || P.sel === 'review') groups.push({ title: 'Review', items: [{ key: 'review', kind: 'review', id: st.review.key, title: st.review.title, lead: CC.glyph('tray', 'amber'), meta: pending ? count(pending, 'amber') : `<span class="cl-done">${icon('check', 'sm')}</span>` }] });
    const proposals = st.data.proposals.length;
    if (proposals || P.sel === 'suggestions') groups.push({ title: 'Suggestions', items: [{ key: 'suggestions', kind: 'suggestions', title: 'From your calendar', lead: CC.glyph('calendar-plus', 'accent'), meta: count(proposals) }] });
    groups.push({ title: 'Series', count: st.data.series.length, items: st.data.series.map(seriesItem) });
    const unfiled = st.data.unfiled;
    if (unfiled.length || P.sel === 'unfiled') groups.push({ title: 'Unfiled', items: [{ key: 'unfiled', kind: 'unfiled', title: unfiled.length ? unfiled.map((u) => u.title).join(', ') : 'Everything filed', lead: CC.glyph('tray-down'), meta: count(unfiled.length) }] });
    return groups;
  }

  function createCommand(raw) {
    const text = raw.trim();
    const isNew = /^new\b/i.test(text);
    const parsed = Kit.parseSeries(isNew ? text.replace(/^new(\s+series)?\s*/i, '') : text);
    if (!isNew && parsed.cadence === 'One-off') return null;
    if (!parsed.title) return isNew ? { key: 'cmd:create', kind: 'command', cmd: 'create-help', title: 'Create a series…', lead: CC.glyph('plus', 'accent'), sub: '<span class="cl-hint">Name, rhythm and people</span>' } : null;
    const p = { ...parsed, people: parsed.people.map(CC.matchPerson) };
    return { key: 'cmd:create', kind: 'command', cmd: 'create', parsed: p, title: `Create series “${p.title}”`, lead: CC.glyph('plus', 'accent'), sub: CC.views.parsedChips(p) };
  }
  function purposeCommand(q, st) {
    const rest = q.replace(/^(edit\s+)?purp\w*\s*/, '').trim();
    const next = CC.upcoming() || CC.focusMeeting();
    const s = (rest && st.data.series.find((x) => matches(x.name, rest))) || (next && next.series) || st.data.series[0];
    return s ? { key: `cmd:purpose:${s.id}`, kind: 'command', cmd: 'purpose', id: s.id, title: `Edit purpose · ${s.name}`, lead: CC.glyph('pencil', 'accent'), meta: '<span class="kbd">⌘E</span>' } : null;
  }
  function attachCommand() {
    const f = CC.focusMeeting();
    if (!f) return null;
    return { key: 'cmd:attach', kind: 'command', cmd: 'attach', id: f.meeting.id, title: `Attach a file to ${f.series.name}${f.meeting.status === 'done' ? '' : ' (next)'}`, lead: CC.glyph('paperclip', 'accent') };
  }
  function fileCommand(st) {
    const u = st.data.unfiled[0];
    return u ? { key: `cmd:file:${u.id}`, kind: 'command', cmd: 'file', id: u.id, title: `File ${u.title} to…`, lead: CC.glyph('tray-down', 'accent') } : null;
  }
  const startsCmd = (q, word) => q.length >= 3 && (word.startsWith(q) || q.startsWith(`${word} `));
  function commandItems(raw, st) {
    if (!st.onboarded) return [];
    const q = norm(raw.trim());
    return [
      createCommand(raw),
      startsCmd(q, 'purpose') || q.startsWith('edit purpose') ? purposeCommand(q, st) : null,
      startsCmd(q, 'attach') ? attachCommand() : null,
      startsCmd(q, 'file') ? fileCommand(st) : null
    ].filter(Boolean);
  }
  const allMeetings = (st) => st.data.series.flatMap((series) => series.meetings.map((meeting) => ({ series, meeting })));
  function allDocs(st) {
    const names = new Set();
    st.data.series.forEach((s) => {
      s.docs.forEach((d) => names.add(d.name));
      s.meetings.forEach((m) => {
        (m.docs || []).forEach((n) => names.add(n));
        if (m.brief) m.brief.docs.forEach((d) => names.add(d.name));
      });
    });
    return [...names];
  }
  function searchGroups(raw, st) {
    const q = norm(raw.trim());
    const groups = [];
    const push = (title, items) => items.length && groups.push({ title, items });
    push('Commands', commandItems(raw, st));
    push('Series', st.data.series.filter((s) => matches(`${s.name} ${s.group}`, q)).map(seriesItem));
    push('Meetings', allMeetings(st).filter(({ series: s, meeting: m }) => matches(`${m.title || s.name} ${m.date} ${m.day || ''}`, q)).slice(0, 6).map((hit) => meetingItem(hit)));
    push('People', Object.keys(DATA.people).filter((p) => p !== 'You' && matches(p, q)).map(personItem));
    push('Docs', allDocs(st).filter((d) => matches(d, q)).slice(0, 5).map(docItem));
    return groups.length ? groups : [{ title: '', items: [{ key: 'none', kind: 'none', title: `No results for “${raw.trim()}”`, lead: CC.glyph('search') }] }];
  }

  const rowHtml = (it) => `<div class="row cl-row${it.sub ? ' tall' : ''}" role="option" data-key="${esc(it.key)}" aria-selected="false">${it.lead || ''}<div class="cl-main"><span class="truncate cl-title">${esc(it.title)}</span>${it.sub ? `<span class="cl-sub">${it.sub}</span>` : ''}</div>${it.meta ? `<span class="cl-meta">${it.meta}</span>` : ''}</div>`;
  const groupHtml = (g) => `${g.title ? `<div class="cl-group"><span>${g.title}</span>${g.count ? `<span class="num">${g.count}</span>` : ''}</div>` : ''}${g.items.map(rowHtml).join('')}`;
  const itemByKey = (key) => P.flat.find((it) => it.key === key) || null;
  const currentTarget = () => (P.stack.length ? P.stack[P.stack.length - 1] : itemByKey(P.sel));
  const rowFor = (key) => els.list.querySelector(`[data-key="${CSS.escape(key)}"]`);

  function build() {
    const st = CC.get();
    P.groups = P.query.trim() ? searchGroups(P.query, st) : homeGroups(st);
    P.flat = P.groups.flatMap((g) => g.items);
    els.list.innerHTML = P.groups.map(groupHtml).join('');
    markSelected(false);
  }
  function markSelected(scroll) {
    els.list.querySelectorAll('.cl-row').forEach((row) => {
      const on = row.dataset.key === P.sel;
      row.classList.toggle('selected', on);
      row.setAttribute('aria-selected', String(on));
      if (on && scroll) row.scrollIntoView({ block: 'nearest' });
    });
  }
  function backLabel() {
    const below = P.stack.length > 1 ? P.stack[P.stack.length - 2] : itemByKey(P.sel);
    if (!below) return 'Back';
    if (below.kind === 'series') return (CC.seriesById(below.id) || {}).name || 'Back';
    if (below.kind === 'meeting') return below.title || 'Meeting';
    return below.title || 'Back';
  }
  const viewCtx = () => ({ back: P.stack.length ? backLabel() : null, editing: P.editing });
  function renderDetail(force) {
    const target = currentTarget();
    const view = CC.views.render(target, viewCtx());
    if (!force && view.sig === P.sig) return;
    const keep = force ? 0 : els.detail.scrollTop;
    els.detail.innerHTML = view.html;
    els.detail.scrollTop = keep;
    P.sig = view.sig;
    P.view = target ? target.kind : null;
    if (view.mount) view.mount(els.detail);
    renderFoot();
  }
  function adopt() {
    P.sig = CC.views.render(currentTarget(), viewCtx()).sig;
  }

  const HINTS = {
    list: (it) => [['↑↓', 'navigate'], ['↵', it && it.kind === 'command' ? ENTER_LABEL[it.cmd] || 'run' : it && it.kind === 'review' ? 'start review' : 'open'], ['⌘E', 'edit purpose'], ['esc', P.query || P.stack.length ? 'back' : 'close']],
    review: () => (CC.pending() ? [['↵', 'accept'], ['⌫', 'reject'], ['E', 'edit'], ['esc', 'back']] : [['↵', 'done'], ['esc', 'back']]),
    detail: () => [['↑↓', 'scroll'], ['⌘E', 'edit purpose'], ['esc', 'back']],
    editing: () => [['⌘E', 'done'], ['esc', 'done']]
  };
  function seriesOf(t) {
    if (!t) return null;
    if (t.kind === 'series' || (t.kind === 'command' && t.cmd === 'purpose')) return t.id;
    if (t.kind === 'meeting') {
      const hit = CC.findMeeting(t.id);
      return hit ? hit.series.id : null;
    }
    return t.kind === 'review' ? CC.get().review.seriesId : null;
  }
  function renderFoot() {
    const it = currentTarget();
    const mode = P.editing ? 'editing' : P.focus === 'detail' ? (P.view === 'review' ? 'review' : 'detail') : 'list';
    const noPurpose = !P.editing && !seriesOf(it);
    const hints = HINTS[mode](it).map(([k, label]) => `<span class="cf-hint${k === '⌘E' && noPurpose ? ' off' : ''}"><span class="cf-key">${k}</span>${label}</span>`).join('<span class="cf-dot">·</span>');
    const saved = P.editing ? `<span class="cf-save" data-save-state>${icon('check', 'sm')}Saved automatically</span>` : '';
    els.root.classList.toggle('editing', Boolean(P.editing));
    els.foot.innerHTML = `${hints}<span class="spacer"></span>${saved}<span class="cf-local">${icon('lock', 'sm')}On this Mac</span>`;
  }

  function markDetailFocus() {
    P.focus = 'detail';
    els.root.classList.add('detail-focus');
    renderFoot();
  }
  function focusDetail() {
    const t = currentTarget();
    if (!t || ['command', 'none', 'setup'].includes(t.kind)) return;
    markDetailFocus();
    ($('[data-autofocus]', els.detail) || els.detail).focus({ preventScroll: true });
  }
  function leaveDetail(focusInput = true) {
    P.focus = 'list';
    els.root.classList.remove('detail-focus');
    if (focusInput) els.input.focus({ preventScroll: true });
    renderFoot();
  }
  function select(key, opts = {}) {
    const item = itemByKey(key) || P.flat.find((it) => it.kind !== 'none') || P.flat[0] || null;
    stopEditing(true);
    P.sel = item ? item.key : null;
    P.stack = opts.stack || [];
    if (P.focus === 'detail') leaveDetail(false);
    markSelected(opts.scroll !== false);
    renderDetail(true);
  }
  function move(delta) {
    const i = P.flat.findIndex((it) => it.key === P.sel);
    const next = P.flat[Math.min(P.flat.length - 1, Math.max(0, i + delta))];
    if (next && (next.key !== P.sel || P.stack.length)) select(next.key);
  }
  function push(entry) {
    stopEditing(true);
    const hit = entry.kind === 'meeting' ? CC.findMeeting(entry.id) : null;
    P.stack = [...P.stack, { ...entry, title: hit ? hit.meeting.title || `${hit.series.name} #${hit.meeting.n}` : entry.title }];
    renderDetail(true);
  }
  function back() {
    stopEditing(true);
    P.stack = P.stack.slice(0, -1);
    renderDetail(true);
  }
  function navigate(kind, id) {
    const key = `${kind}:${id}`;
    if (itemByKey(key)) return select(key);
    return push({ kind, id });
  }
  function receive(key) {
    const row = rowFor(key);
    if (!row) return;
    row.classList.remove('receive');
    void row.offsetWidth;
    row.classList.add('receive');
    row.scrollIntoView({ block: 'nearest' });
  }
  function startEditing(sid) {
    if (!sid || !CC.seriesById(sid)) return;
    if (seriesOf(currentTarget()) !== sid || currentTarget().kind !== 'series') navigate('series', sid);
    CC.views.beginPurpose();
    P.editing = sid;
    if (P.focus === 'detail') leaveDetail(false);
    renderDetail(true);
  }
  function stopEditing(silent) {
    if (!P.editing) return;
    CC.views.flushPurpose();
    P.editing = null;
    if (!silent) renderDetail(true);
  }
  function finishEditing() {
    stopEditing(false);
    els.input.focus({ preventScroll: true });
  }
  function clearQuery() {
    P.query = '';
    els.input.value = '';
  }
  function setQuery(text) {
    P.query = text;
    els.input.value = text;
    els.input.focus({ preventScroll: true });
    build();
    select(null);
  }

  function createFrom(parsed) {
    const id = CC.createSeries(parsed);
    clearQuery();
    P.sel = `series:${id}`;
    CC.sync();
    select(`series:${id}`);
    receive(`series:${id}`);
    CC.toast(`Created ${parsed.title} · Telu prepares a brief before each one`, { icon: 'check-circle' });
  }
  function runCommand(it) {
    if (it.cmd === 'create') return createFrom(it.parsed);
    if (it.cmd === 'purpose') {
      clearQuery();
      build();
      return startEditing(it.id);
    }
    if (it.cmd === 'attach') return els.pick.click();
    if (it.cmd === 'file') {
      clearQuery();
      build();
      select('unfiled');
      return CC.views.chooseFirst();
    }
    return null;
  }
  function runCurrent() {
    const it = currentTarget();
    if (it && it.kind === 'command') runCommand(it);
  }
  function primary() {
    const it = currentTarget();
    if (!it || it.kind === 'none') return;
    if (it.kind === 'command') return runCommand(it);
    if (it.kind === 'setup') {
      close();
      return CC.onboarding.open();
    }
    return focusDetail();
  }
  function onPick() {
    const file = els.pick.files && els.pick.files[0];
    els.pick.value = '';
    if (!file) return;
    const name = CC.safeFileName(file.name);
    if (!name) return CC.toast('Telu can attach documents with a file name like “Plan.pdf”', { icon: 'info' });
    const added = CC.attachDoc(name);
    CC.toast(added ? `Attached ${name} · in the brief` : `${name} is already in the brief`, { icon: added ? 'paperclip' : 'info' });
    if (!added) return;
    clearQuery();
    build();
    openAt('meeting', CC.focusMeeting().meeting.id, { section: 'docs' });
  }

  function open(opts = {}) {
    CC.panel.close(true);
    CC.island.collapse();
    if (!P.open) {
      P.open = true;
      els.root.hidden = false;
    }
    if (!opts.keep) {
      clearQuery();
      P.stack = [];
      P.editing = null;
      leaveDetail(false);
    }
    build();
    select(opts.key || P.flat[0] && P.flat[0].key);
    els.input.focus({ preventScroll: true });
  }
  function close() {
    if (!P.open) return;
    stopEditing(true);
    CC.views.cancelCardEdit();
    P.open = false;
    els.root.hidden = true;
    els.root.classList.remove('detail-focus');
    P.focus = 'list';
    if (els.root.contains(document.activeElement)) document.activeElement.blur();
  }
  const toggle = () => {
    if (P.open) return close();
    return CC.onboarding.isOpen() ? null : open();
  };
  function flashLine(t) {
    const line = els.detail.querySelector(`.tr-line[data-t="${CSS.escape(t)}"]`);
    if (!line) return;
    line.scrollIntoView({ block: 'center' });
    line.classList.add('receive');
  }
  function openAt(kind, id, opts = {}) {
    open();
    if (kind === 'review') {
      build();
      select('review');
      return focusDetail();
    }
    if (kind === 'suggestions' || kind === 'unfiled') return select(kind);
    if (kind === 'series') return navigate('series', id);
    const listed = P.flat.find((it) => it.kind === 'meeting' && it.id === id);
    const hit = CC.findMeeting(id);
    if (listed) select(listed.key);
    else if (hit) select(`series:${hit.series.id}`, { stack: [{ kind: 'meeting', id, title: `${hit.meeting.title || hit.series.name} #${hit.meeting.n}` }] });
    if (opts.line) flashLine(opts.line);
    const sec = opts.section && els.detail.querySelector(`[data-sec="${opts.section}"]`);
    if (sec) sec.scrollIntoView({ block: 'start' });
    return true;
  }
  function refresh() {
    if (!P.open) return;
    build();
    if (!itemByKey(P.sel)) return select(null, { scroll: false });
    if (!P.editing && P.view !== 'review') renderDetail(false);
    return renderFoot();
  }
  function escape() {
    if (!P.open) return false;
    if (CC.views.cancelCardEdit()) return true;
    if (P.editing) {
      finishEditing();
      return true;
    }
    const active = document.activeElement;
    if (active && els.detail.contains(active) && isEditable(active)) {
      active.blur();
      leaveDetail();
    } else if (P.focus === 'detail') leaveDetail();
    else if (P.stack.length) back();
    else if (P.query) {
      clearQuery();
      build();
      select(null);
    } else close();
    return true;
  }
  function outside(target) {
    if (!P.open || els.root.contains(target) || target.closest('#island, #mbPanel, #teluStatus')) return;
    close();
  }
  function editPurposeShortcut() {
    if (!CC.get().onboarded) return;
    if (P.editing && P.open) return finishEditing();
    if (!P.open) {
      const next = CC.upcoming() || CC.focusMeeting();
      if (!next) return;
      open();
      return startEditing(next.series.id);
    }
    return startEditing(seriesOf(currentTarget()));
  }

  function onKey(event) {
    if (!P.open || event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
    const t = event.target;
    if (t.closest && t.closest('.menu, .alert')) return;
    if (t !== els.input && isEditable(t)) return;
    if (P.focus === 'detail' && P.view === 'review') return CC.views.reviewKey(event);
    const key = event.key;
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      event.preventDefault();
      const dir = key === 'ArrowDown' ? 1 : -1;
      return P.focus === 'detail' ? els.detail.scrollBy(0, dir * 72) : move(dir);
    }
    if (key === 'Enter' && t.tagName !== 'BUTTON') {
      event.preventDefault();
      return primary();
    }
    if (key === 'Tab' && t === els.input && !event.shiftKey) {
      event.preventDefault();
      return focusDetail();
    }
    if (t !== els.input && key.length === 1 && P.focus === 'list') els.input.focus({ preventScroll: true });
    return null;
  }
  function onListClick(event) {
    const row = event.target.closest('.cl-row');
    if (!row) return;
    if (row.dataset.key !== P.sel || P.stack.length) select(row.dataset.key, { scroll: false });
    else if (P.focus === 'detail') leaveDetail();
    els.input.focus({ preventScroll: true });
  }
  function mount() {
    Object.assign(els, { root: $('#cmdk'), input: $('#cmdkInput'), list: $('#cmdkList'), detail: $('#cmdkDetail'), foot: $('#cmdkFoot'), pick: $('#filePick') });
    els.input.addEventListener('input', () => {
      P.query = els.input.value;
      build();
      select(null);
    });
    els.list.addEventListener('mousedown', (event) => event.preventDefault());
    els.list.addEventListener('click', onListClick);
    els.list.addEventListener('dblclick', (event) => event.target.closest('.cl-row') && primary());
    els.detail.addEventListener('click', (event) => CC.views.onClick(event));
    els.detail.addEventListener('input', (event) => CC.views.onInput(event));
    els.detail.addEventListener('keydown', (event) => CC.views.onKeydown(event));
    els.detail.addEventListener('toggle', (event) => CC.views.onToggle(event));
    els.detail.addEventListener('paste', (event) => CC.views.onPaste(event));
    els.pick.addEventListener('change', onPick);
    document.addEventListener('keydown', onKey);
    CC.onSync(refresh);
  }

  return {
    mount, open, close, toggle, openAt, escape, outside, editPurposeShortcut, isOpen: () => P.open,
    select, navigate, push, back, adopt, receive, startEditing, finishEditing, markDetailFocus, focusDetail, runCurrent, setQuery
  };
})();
