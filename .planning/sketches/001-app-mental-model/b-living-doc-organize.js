(() => {
  const { $, $$ } = Kit;
  const e = Kit.esc;
  const rowFor = (sid) => $(`#sbNav .doc-row[data-doc="${sid}"]`);
  const unfiledRow = () => $('#sbNav [data-view="unfiled"]');
  const flyChip = (glyph, label) => `<div class="fly-chip">${glyph}<span>${e(label)}</span></div>`;
  const snapshot = () => ({ series: LD.state.series, unfiled: LD.state.unfiled, proposals: LD.state.proposals });
  const receive = (el) => {
    if (!el) return;
    el.classList.remove('receive');
    void el.offsetWidth;
    el.classList.add('receive');
  };
  LD.receive = receive;

  LD.markSelection = () => {
    const v = LD.state.view;
    $$('#sbNav .sb-item').forEach((row) => {
      const on = v.kind === 'doc' ? row.dataset.doc === v.id : row.dataset.view === v.kind;
      row.classList.toggle('selected', on);
    });
  };
  LD.openDoc = (id, { animate = false } = {}) => {
    const v = LD.state.view;
    if (!LD.series(id)) return Promise.resolve(false);
    if (v.kind === 'doc' && v.id === id) return Promise.resolve(true);
    LD.closeDrawer();
    LD.set({ view: { kind: 'doc', id } });
    LD.markSelection();
    return LD.swapCanvas({ animate });
  };
  LD.openView = (kind, { animate = false, denied = false } = {}) => {
    const v = LD.state.view;
    if (v.kind === kind && !!v.denied === denied && kind !== 'detect') return Promise.resolve(true);
    LD.closeDrawer();
    LD.set({ view: { kind, denied } });
    LD.markSelection();
    return LD.swapCanvas({ animate });
  };
  LD.gotoNext = (id) => LD.openDoc(id, { animate: true }).then((ok) => {
    const next = ok && $('#sec-next');
    if (next) next.scrollIntoView({ block: 'start' });
  });

  const focusTitle = () => {
    const title = $('#docTitle');
    if (!title) return;
    title.focus({ preventScroll: true });
    const range = document.createRange();
    range.selectNodeContents(title);
    range.collapse(false);
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  };
  LD.newDoc = ({ animate = false } = {}) => {
    const s = LD.draftSeries(LD.nextSeq());
    LD.closeDrawer();
    LD.set({ series: [...LD.state.series, s], view: { kind: 'doc', id: s.id } });
    const fresh = LD.flipSidebar(() => LD.paintSidebar(), { animate });
    fresh.filter((el) => el.dataset.doc === s.id && animate).forEach((el) => {
      el.classList.add('enter');
      LD.later(() => receive(el), 200);
    });
    return LD.swapCanvas({ animate }).then((ok) => ok && focusTitle());
  };
  LD.mountDraft = () => {
    const seg = $('#cadenceSeg');
    LD.segApi = seg ? Kit.segmented(seg, (value) => LD.setDraft({ cadence: value })) : null;
    if (!LD.current().name) focusTitle();
  };
  const paintDraftMeta = (s) => {
    const day = $('#pickDay');
    const time = $('#pickTime');
    if (!day || !time) return;
    const off = s.cadence === 'None';
    day.disabled = off;
    time.disabled = off;
    day.innerHTML = `${e(LD.dayLabel(s.day))}${icon('chevron-updown')}`;
    time.innerHTML = `${e(s.time || 'Time')}${icon('chevron-updown')}`;
    $('#repeatsSub').innerHTML = LD.repeatsSub(s);
    $('#docIcon').innerHTML = Kit.seriesIcon(s, 'lg');
  };
  const repaintDraft = (s) => {
    paintDraftMeta(s);
    LD.paintNext(s);
    LD.flipSidebar(() => LD.paintSidebar());
    LD.paintToolbar();
  };
  LD.setDraft = (patch) => {
    const s = LD.current();
    if (!s || !s.draft) return;
    repaintDraft(LD.updateSeries(s.id, (x) => LD.syncDraft({ ...x, ...patch })));
  };
  LD.commitTitle = (el) => {
    const s = LD.current();
    const text = el.textContent.trim();
    if (!s || !s.draft || !text) return el.blur();
    const parsed = Kit.parseSeries(text);
    const next = LD.updateSeries(s.id, (x) => LD.applyParsed(x, parsed));
    el.textContent = next.name;
    if (LD.segApi) LD.segApi.set(next.cadence, { silent: true });
    repaintDraft(next);
    Kit.toast(e(LD.parsedSummary(parsed) || `Named “${next.name}”`), { icon: 'check-circle' });
    const why = $('.p-why');
    if (why) why.focus();
  };
  const DAY_OPTIONS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Weekdays'];
  const TIMES = ['08:30', '09:00', '09:30', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
  LD.pickDay = (btn) => Kit.menu(btn, DAY_OPTIONS.map((d) => ({ label: d === 'Weekdays' ? 'Every weekday' : LD.dayLabel(d), onSelect: () => LD.setDraft({ day: d }) })), { minWidth: 170 });
  LD.pickTime = (btn) => Kit.menu(btn, TIMES.map((t) => ({ label: t, onSelect: () => LD.setDraft({ time: t }) })), { minWidth: 120 });
  const linkEvent = (ev) => {
    const s = LD.current();
    if (!s) return;
    const next = LD.updateSeries(s.id, (x) => LD.linkedSeries(x, ev));
    $('#docTitle').textContent = next.name;
    if (LD.segApi) LD.segApi.set(next.cadence, { silent: true });
    repaintDraft(next);
    Kit.toast(`Linked to “${e(ev.title)}” · Work calendar`, { icon: 'link' });
  };
  LD.linkEventMenu = (btn) => Kit.menu(btn, [
    { title: 'Untracked events · Work' },
    ...LD.LINKABLE.map((ev) => ({ label: e(ev.title), icon: 'calendar', kbd: ev.label, onSelect: () => linkEvent(ev) }))
  ], { minWidth: 280 });
  LD.trackEvent = (eventId) => {
    const ev = LD.LINKABLE.find((x) => x.id === eventId);
    LD.newDoc({ animate: true }).then((ok) => ok && ev && linkEvent(ev));
  };

  const afterPastChange = (sid) => {
    const s = LD.current();
    if (!s || s.id !== sid) return;
    if (!s.meetings.some((m) => !LD.isUpcoming(m))) $('#pastList').innerHTML = LD.pastList(s);
    $('#earlierSlot').innerHTML = LD.earlierButton(s);
    LD.refreshMarks();
  };
  const restore = (snap, focusId) => {
    LD.set(snap);
    LD.paintSidebar();
    LD.paintCanvas();
    const el = focusId && document.getElementById(focusId);
    if (el) {
      Kit.enterAnimated(el);
      receive(el);
    }
  };
  const departing = (mid) => {
    const sid = LD.state.view.id;
    return { sid, from: LD.series(sid), m: LD.meeting(sid, mid), el: document.getElementById(`m-${mid}`) };
  };
  const leaveList = (el, sid, target) => {
    Kit.flyTo(el.querySelector('.mtg-head'), target, { markup: flyChip(icon('calendar'), LD.meeting(sid, el.dataset.mid)?.date || el.querySelector('.mtg-date').textContent) });
    return Kit.removeAnimated(el).then(() => afterPastChange(sid));
  };
  LD.moveMeetingFlow = (mid, toId, { dragged = false } = {}) => {
    const { sid, m, el } = departing(mid);
    const to = LD.series(toId);
    if (!m || !to || !el) return;
    const snap = snapshot();
    const target = rowFor(toId);
    if (dragged) {
      receive(target);
      Kit.removeAnimated(el).then(() => afterPastChange(sid));
    } else {
      leaveList(el, sid, target);
    }
    LD.set(LD.moveMeeting(LD.state, mid, sid, toId));
    Kit.toast(`Moved ${e(m.date)} to ${e(to.name || 'Untitled')}`, { icon: 'check-circle', action: { label: 'Undo', onClick: () => restore(snap, `m-${mid}`) } });
  };
  LD.unfileMeetingFlow = (mid) => {
    const { sid, m, el } = departing(mid);
    if (!m || !el) return;
    const snap = snapshot();
    leaveList(el, sid, unfiledRow());
    LD.set(LD.unfileMeeting(LD.state, mid, sid));
    LD.later(() => LD.syncSmartCounts(), 560);
    Kit.toast(`Moved ${e(m.date)} to Unfiled`, { icon: 'tray', action: { label: 'Undo', onClick: () => restore(snap, `m-${mid}`) } });
  };
  LD.splitMeetingFlow = (mid) => {
    const { sid, from, m, el } = departing(mid);
    if (!m || !el) return;
    const doc = { ...LD.draftSeries(LD.nextSeq()), count: 1, meetings: [{ ...m, items: LD.itemsOf(from, m), movedFrom: from.name, homeId: sid }] };
    const series = LD.state.series.map((s) => (s.id === sid ? { ...s, count: Math.max(0, s.count - 1), meetings: s.meetings.filter((x) => x.id !== mid) } : s));
    LD.set({ series: [...series, doc] });
    LD.flipSidebar(() => LD.paintSidebar());
    const row = rowFor(doc.id);
    row.classList.add('landing');
    Kit.flyTo(el.querySelector('.mtg-head'), row, { markup: flyChip(icon('calendar'), m.date) }).then(() => row.classList.remove('landing'));
    Kit.removeAnimated(el).then(() => afterPastChange(sid));
    Kit.toast(`Split ${e(m.date)} into a new doc`, { icon: 'doc-plus', action: { label: 'Name it', onClick: () => LD.openDoc(doc.id, { animate: true }).then((ok) => ok && focusTitle()) } });
  };
  LD.deleteMeetingFlow = async (mid) => {
    const { sid, m } = departing(mid);
    if (!m) return;
    const answer = Kit.alert({
      title: `Delete ${e(m.date)}?`,
      message: 'The recording, transcript and summary are removed from this Mac. Items already in Memory stay.',
      buttons: [{ label: 'Cancel', value: 'cancel' }, { label: 'Delete', value: 'delete', primary: true }]
    });
    const alertEl = $$('.alert').pop();
    if (alertEl) alertEl.querySelector('.btn.primary').classList.add('danger');
    if ((await answer) !== 'delete') return;
    LD.updateSeries(sid, (s) => ({ ...s, count: Math.max(0, s.count - 1), meetings: s.meetings.filter((x) => x.id !== mid) }));
    const el = document.getElementById(`m-${mid}`);
    if (el) await Kit.removeAnimated(el);
    afterPastChange(sid);
    Kit.toast(`Deleted ${e(m.date)} from this Mac`, { icon: 'trash' });
  };
  LD.meetingMenu = (btn) => {
    const mid = btn.closest('.mtg').dataset.mid;
    const sid = LD.state.view.id;
    const m = LD.meeting(sid, mid);
    Kit.menu(btn, [
      { title: e(`${m.date}${m.n ? ` · #${m.n}` : ''}`) },
      { label: 'Move to another doc…', icon: 'folder', onSelect: () => moveMenu(btn, mid) },
      { label: 'Split into new doc', icon: 'doc-plus', onSelect: () => LD.splitMeetingFlow(mid) },
      { label: 'Open transcript', icon: 'quote', onSelect: () => LD.openTranscript(sid, mid) },
      '-',
      { label: 'Remove from this doc', icon: 'tray', onSelect: () => LD.unfileMeetingFlow(mid) },
      { label: 'Delete meeting…', icon: 'trash', danger: true, onSelect: () => LD.deleteMeetingFlow(mid) }
    ], { align: 'end', minWidth: 220 });
  };
  const moveMenu = (btn, mid) => {
    const others = LD.state.series.filter((s) => s.id !== LD.state.view.id);
    Kit.menu(btn, [{ title: 'Move to' }, ...others.map((s) => ({ label: e(s.name || 'Untitled'), swatch: s.color, onSelect: () => LD.moveMeetingFlow(mid, s.id) }))], { align: 'end', minWidth: 230 });
  };

  LD.syncSmartCounts = () => {
    const set = (row, n) => {
      if (!row) return;
      const old = row.querySelector('.count');
      if (!n) return old && old.remove();
      const count = old || row.appendChild(Kit.html('<span class="count num"></span>'));
      count.textContent = n;
      count.classList.remove('bump');
      void count.offsetWidth;
      count.classList.add('bump');
    };
    set($('#sbNav [data-view="suggestions"]'), LD.state.proposals.length);
    set(unfiledRow(), LD.state.unfiled.length);
  };
  const emptyIfNone = (list, markup) => {
    if (list.length) return;
    const holder = $('#cardList');
    if (!holder) return;
    holder.innerHTML = markup;
    Kit.stagger(holder);
  };
  const fileInto = (card, u, sid) => {
    const s = LD.series(sid);
    if (!s) return;
    const snap = snapshot();
    LD.set(LD.fileUnfiled(LD.state, u.id, sid));
    Kit.flyTo(card.querySelector('.uf-top'), rowFor(sid), { markup: flyChip(icon(u.kind === 'recording' ? 'waveform' : 'doc'), u.title) });
    Kit.removeAnimated(card).then(() => emptyIfNone(LD.state.unfiled, LD.unfiledEmpty()));
    LD.syncSmartCounts();
    Kit.toast(`Filed to ${e(s.name)}`, { icon: 'check-circle', action: { label: 'Undo', onClick: () => restore(snap, null) } });
  };
  const unfiledOf = (card) => LD.state.unfiled.find((x) => x.id === card.dataset.uid);
  LD.fileThere = (card) => {
    const u = unfiledOf(card);
    if (u && u.suggestion) fileInto(card, u, u.suggestion.series);
  };
  LD.fileChoose = (btn) => {
    const card = btn.closest('.uf-card');
    const u = unfiledOf(card);
    Kit.menu(btn, [{ title: 'File into' }, ...LD.state.series.map((s) => ({ label: e(s.name || 'Untitled'), swatch: s.color, onSelect: () => fileInto(card, u, s.id) }))], { minWidth: 230 });
  };

  const proposalOf = (card) => LD.state.proposals.find((x) => x.id === card.dataset.pid);
  const dropProposal = (card, id) => {
    LD.set({ proposals: LD.state.proposals.filter((x) => x.id !== id) });
    LD.syncSmartCounts();
    return Kit.removeAnimated(card).then(() => emptyIfNone(LD.state.proposals, LD.emptyState('sparkles', 'No suggestions', 'When a new recurring meeting shows up in your calendar, it appears here.')));
  };
  LD.createProposalFlow = (card) => {
    const p = proposalOf(card);
    if (!p) return;
    const s = LD.seriesFromProposal(p);
    LD.set({ series: [...LD.state.series, s] });
    LD.flipSidebar(() => LD.paintSidebar());
    const row = rowFor(s.id);
    row.classList.add('landing');
    const flight = Kit.flyTo(card.querySelector('.sug-top'), row, { markup: flyChip(Kit.seriesIcon(s), s.name) });
    dropProposal(card, p.id);
    flight.then(() => {
      row.classList.remove('landing');
      LD.later(() => LD.openDoc(s.id, { animate: true }), 380);
    });
  };
  LD.joinProposalFlow = (card) => {
    const p = proposalOf(card);
    const target = p && LD.series(p.target);
    if (!target) return;
    const meeting = { id: 'ac-sso', n: null, title: 'SSO deep-dive', date: 'Wed 30 Sep', time: '13:00–13:45', status: 'upcoming', where: 'Zoom' };
    LD.updateSeries(target.id, (s) => ({ ...s, meetings: [...s.meetings.filter(LD.isUpcoming), meeting, ...s.meetings.filter((m) => !LD.isUpcoming(m))] }));
    Kit.flyTo(card.querySelector('.sug-top'), rowFor(target.id), { markup: flyChip(icon('link'), p.title) });
    dropProposal(card, p.id);
    Kit.toast(`${e(p.title)} now files into ${e(target.name)}`, { icon: 'check-circle' });
  };
  LD.dismissCard = (card, msg) => {
    const p = proposalOf(card);
    if (!p) return;
    dropProposal(card, p.id);
    Kit.toast(e(msg), { icon: 'check' });
  };

  const syncCreateButton = () => {
    const btn = $('#createDetected');
    const detected = LD.state.detected || [];
    const n = detected.filter((d) => d.on).length;
    if (!btn) return;
    const ready = !!LD.state.detectDone;
    btn.disabled = !n || !ready;
    btn.textContent = n && ready ? `Create ${n} living doc${n === 1 ? '' : 's'}` : 'Create living docs';
  };
  const finishDetection = () => {
    const found = LD.state.detected.filter((d) => !d.ignored).length;
    LD.set({ detectDone: true });
    const spin = $('#detectSpin');
    if (spin) spin.remove();
    $('#detectTitle').textContent = `Telu found ${found} recurring meetings`;
    $('#detectSub').textContent = 'Pick the ones worth a living doc. Personal calendars are ignored.';
    syncCreateButton();
  };
  const runDetection = () => {
    const detected = DATA.detected.map((d) => ({ ...d, on: d.on && !d.ignored }));
    LD.set({ detected, detectDone: false });
    syncCreateButton();
    detected.forEach((d, i) => LD.later(() => {
      const list = $('#detectList');
      if (!list) return;
      list.insertAdjacentHTML('beforeend', LD.detectRow(d, i));
      if (i === detected.length - 1) finishDetection();
    }, 420 + i * 240));
  };
  LD.onDetectToggle = (i, on) => {
    LD.set({ detected: LD.state.detected.map((d, idx) => (idx === i ? { ...d, on } : d)) });
    syncCreateButton();
  };
  LD.connectFlow = async () => {
    const answer = await Kit.alert({
      title: '“Telu” Would Like to Access Your Calendars',
      message: 'Telu reads events on this Mac to find recurring meetings and draft a living doc for each.',
      buttons: [{ label: 'Don’t Allow', value: 'no' }, { label: 'Allow Full Access', value: 'yes', primary: true }]
    });
    if (answer !== 'yes') return LD.openView('welcome', { animate: true, denied: true });
    const ok = await LD.openView('detect', { animate: true });
    if (ok) runDetection();
  };
  LD.createDetectedFlow = () => {
    const base = LD.baseSeries();
    const series = LD.state.detected.filter((d) => d.on).map((d) => LD.seriesFromDetected(d, base));
    if (!series.length) return;
    const proposals = structuredClone(DATA.proposals).filter((p) => p.id !== 'pr-standup' && (p.kind !== 'join' || series.some((s) => s.id === p.target)));
    LD.set({ series, proposals, unfiled: [], view: { kind: 'doc', id: series[0].id }, detected: null });
    LD.paintSidebar();
    $$('#sbNav .sb-item').forEach((row, i) => {
      row.style.setProperty('--i', i);
      row.classList.add('enter');
      if (row.dataset.doc) LD.later(() => receive(row), 300 + i * 40);
    });
    LD.swapCanvas({ animate: true });
    Kit.toast(`Created ${LD.plural(series.length, 'living doc')} · stored on this Mac`, { icon: 'check-circle' });
  };

  const MEETING_TYPE = 'application/x-telu-meeting';
  const hasMeeting = (ev) => [...ev.dataTransfer.types].includes(MEETING_TYPE);
  let dragMid = null;
  const setDropRow = (row) => {
    $$('#sbNav .drop-over').forEach((el) => el !== row && el.classList.remove('drop-over'));
    if (row) row.classList.add('drop-over');
  };
  const validRow = (ev) => {
    const row = ev.target.closest('.doc-row, [data-view="unfiled"]');
    return row && row.dataset.doc !== LD.state.view.id ? row : null;
  };
  const onDragStart = (ev) => {
    const grip = ev.target.closest('.grip');
    if (!grip) return;
    const mtg = grip.closest('.mtg');
    dragMid = mtg.dataset.mid;
    ev.dataTransfer.setData(MEETING_TYPE, dragMid);
    ev.dataTransfer.effectAllowed = 'move';
    const ghost = document.body.appendChild(Kit.html(`<div class="drag-ghost">${icon('calendar')}${e(mtg.querySelector('.mtg-date').textContent)}</div>`));
    ev.dataTransfer.setDragImage(ghost, 14, 15);
    setTimeout(() => ghost.remove(), 0);
    mtg.classList.add('dragging');
    $('#sidebar').classList.add('dnd');
  };
  const endDrag = () => {
    $$('.mtg.dragging').forEach((el) => el.classList.remove('dragging'));
    $('#sidebar').classList.remove('dnd');
    setDropRow(null);
    dragMid = null;
  };
  const onSidebarDragOver = (ev) => {
    if (!hasMeeting(ev)) return;
    const row = validRow(ev);
    setDropRow(row);
    if (!row) return;
    ev.preventDefault();
    ev.dataTransfer.dropEffect = 'move';
  };
  const onSidebarDrop = (ev) => {
    const row = validRow(ev);
    const mid = ev.dataTransfer.getData(MEETING_TYPE) || dragMid;
    endDrag();
    if (!row || !mid) return;
    ev.preventDefault();
    if (row.dataset.view === 'unfiled') LD.unfileMeetingFlow(mid);
    else LD.moveMeetingFlow(mid, row.dataset.doc, { dragged: true });
  };
  LD.wireMeetingDrag = () => {
    const inner = $('#canvasInner');
    const side = $('#sidebar');
    inner.addEventListener('dragstart', onDragStart);
    inner.addEventListener('dragend', endDrag);
    side.addEventListener('dragover', onSidebarDragOver);
    side.addEventListener('dragleave', (ev) => { if (!side.contains(ev.relatedTarget)) setDropRow(null); });
    side.addEventListener('drop', onSidebarDrop);
  };
})();
