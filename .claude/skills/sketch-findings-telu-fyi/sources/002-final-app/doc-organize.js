(() => {
  const T = window.T;
  const D = T.doc;
  const { $, $$ } = Kit;
  const e = Kit.esc;
  const rowFor = (sid) => $(`#sidebar .a-sb-row[data-series="${sid}"]`);
  const reviewRow = () => $('#sidebar .a-nav[data-view="review"]');
  const flyChip = (glyph, label) => `<div class="fly-chip">${glyph}<span>${e(label)}</span></div>`;
  const snapshot = () => ({ series: T.state.series, unfiled: T.state.unfiled, proposals: T.state.proposals, days: T.state.days });

  D.focusTitle = () => {
    const title = $('#docTitle');
    if (!title) return;
    title.focus({ preventScroll: true });
    const range = document.createRange();
    range.selectNodeContents(title);
    range.collapse(false);
    getSelection().removeAllRanges();
    getSelection().addRange(range);
  };
  D.mountDraft = () => {
    const seg = $('#cadenceSeg');
    T.ui.segApi = seg ? Kit.segmented(seg, (value) => D.setDraft({ cadence: value })) : null;
  };
  const paintDraftMeta = (s) => {
    const day = $('#pickDay');
    const time = $('#pickTime');
    if (!day || !time) return;
    const off = s.cadence === 'None';
    day.disabled = off;
    time.disabled = off;
    day.innerHTML = `${e(D.dayLabel(s.day))}${icon('chevron-updown')}`;
    time.innerHTML = `${e(s.time || 'Time')}${icon('chevron-updown')}`;
    $('#repeatsSub').innerHTML = D.repeatsSub(s);
    $('#docIcon').innerHTML = Kit.seriesIcon(s, 'lg');
  };
  const repaintDraft = (s) => {
    paintDraftMeta(s);
    D.paintNextFor(s.id);
    T.renderSidebar();
    T.syncSidebarSelection();
    T.updateToolbar();
  };
  D.setDraft = (patch) => {
    const s = D.current();
    if (!s || !s.draft) return;
    T.mapSeries(s.id, (x) => T.syncDraft({ ...x, ...patch }));
    repaintDraft(T.seriesById(s.id));
  };
  D.commitTitle = (el) => {
    const s = D.current();
    const text = el.textContent.trim();
    if (!s || !s.draft || !text) return el.blur();
    const parsed = Kit.parseSeries(text);
    T.mapSeries(s.id, (x) => T.applyParsed(x, parsed));
    const next = T.seriesById(s.id);
    el.textContent = next.name;
    if (T.ui.segApi) T.ui.segApi.set(next.cadence, { silent: true });
    repaintDraft(next);
    T.toast(e(T.parsedSummary(parsed) || `Named “${next.name}”`), { icon: 'check-circle' });
    const why = $('#view .p-why');
    if (why) why.focus();
    return undefined;
  };
  const DAY_OPTIONS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Weekdays'];
  const TIMES = ['08:30', '09:00', '09:30', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
  D.pickDay = (btn) => Kit.menu(btn, DAY_OPTIONS.map((d) => ({ label: d === 'Weekdays' ? 'Every weekday' : D.dayLabel(d), onSelect: () => D.setDraft({ day: d }) })), { minWidth: 170 });
  D.pickTime = (btn) => Kit.menu(btn, TIMES.map((t) => ({ label: t, onSelect: () => D.setDraft({ time: t }) })), { minWidth: 120 });
  D.linkEvent = (ev, { quiet = false } = {}) => {
    const s = D.current();
    if (!s) return;
    T.mapSeries(s.id, (x) => T.linkedSeries(x, ev));
    const next = T.seriesById(s.id);
    T.mapEvents((x) => x.title === ev.title && !T.trackedSeriesOf(x), (x) => ({ ...x, series: next.id }));
    $('#docTitle').textContent = next.name;
    if (T.ui.segApi) T.ui.segApi.set(next.cadence, { silent: true });
    repaintDraft(next);
    if (!quiet) T.toast(`Linked to “${e(ev.title)}” · Work calendar`, { icon: 'link' });
  };
  D.linkEventMenu = (btn) => Kit.menu(btn, [
    { title: 'Untracked events · Work' },
    ...T.LINKABLE.filter((ev) => !T.allEvents().some((x) => x.title === ev.title && T.trackedSeriesOf(x)))
      .map((ev) => ({ label: e(ev.title), icon: 'calendar', kbd: ev.label, onSelect: () => D.linkEvent(ev) }))
  ], { minWidth: 280 });

  const restore = (snap, focusId) => {
    T.set(snap);
    T.renderSidebar();
    T.syncSidebarSelection();
    T.renderView({ keepScroll: true });
    T.updateCounts();
    const el = focusId && document.getElementById(focusId);
    if (el) {
      Kit.enterAnimated(el);
      D.receive(el);
    }
  };
  const departing = (mid) => {
    const sid = T.state.view.seriesId;
    return { sid, from: T.seriesById(sid), m: (T.seriesById(sid) || { meetings: [] }).meetings.find((x) => x.id === mid), el: document.getElementById(`m-${mid}`) };
  };
  const leaveList = (el, sid, target, label) => {
    Kit.flyTo(el.querySelector('.mtg-head'), target, { markup: flyChip(icon('calendar'), label) });
    return Kit.removeAnimated(el).then(() => D.afterPastChange(sid));
  };
  D.moveMeetingFlow = (mid, toId, { dragged = false } = {}) => {
    const { sid, m, el } = departing(mid);
    const to = T.seriesById(toId);
    if (!m || !to || !el) return;
    const snap = snapshot();
    if (dragged) {
      D.receive(rowFor(toId));
      Kit.removeAnimated(el).then(() => D.afterPastChange(sid));
    } else leaveList(el, sid, rowFor(toId), m.date);
    T.set(T.moveMeeting(T.state, mid, sid, toId));
    T.updateCounts();
    T.toast(`Moved ${e(m.date)} to ${e(to.name || 'Untitled')}`, { icon: 'check-circle', action: { label: 'Undo', onClick: () => restore(snap, `m-${mid}`) } });
  };
  D.unfileMeetingFlow = (mid) => {
    const { sid, m, el } = departing(mid);
    if (!m || !el) return;
    const snap = snapshot();
    leaveList(el, sid, reviewRow(), m.date);
    T.set(T.unfileMeeting(T.state, mid, sid));
    T.later(() => T.updateCounts(), 560);
    T.toast(`Moved ${e(m.date)} to Review · Needs filing`, { icon: 'tray', action: { label: 'Undo', onClick: () => restore(snap, `m-${mid}`) } });
  };
  D.splitMeetingFlow = (mid) => {
    const { sid, from, m, el } = departing(mid);
    if (!m || !el) return;
    const doc = { ...T.draftSeries(T.nextSeq()), count: 1, meetings: [{ ...m, items: T.itemsOf(from, m), movedFrom: from.name, homeId: sid }] };
    const series = T.state.series.map((s) => (s.id === sid ? { ...s, count: Math.max(0, s.count - 1), meetings: s.meetings.filter((x) => x.id !== mid) } : s));
    T.set({ series: [...series, doc] });
    T.renderSidebar();
    T.syncSidebarSelection();
    const row = rowFor(doc.id);
    row.classList.add('landing');
    Kit.flyTo(el.querySelector('.mtg-head'), row, { markup: flyChip(icon('calendar'), m.date) }).then(() => row.classList.remove('landing'));
    Kit.removeAnimated(el).then(() => D.afterPastChange(sid));
    T.toast(`Split ${e(m.date)} into a new doc`, { icon: 'doc-plus', action: { label: 'Name it', onClick: () => T.openDoc(doc.id).then((ok) => ok && D.focusTitle()) } });
  };
  D.deleteMeetingFlow = async (mid) => {
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
    T.mapSeries(sid, (s) => ({ ...s, count: Math.max(0, s.count - 1), meetings: s.meetings.filter((x) => x.id !== mid) }));
    const el = document.getElementById(`m-${mid}`);
    if (el) await Kit.removeAnimated(el);
    D.afterPastChange(sid);
    T.toast(`Deleted ${e(m.date)} from this Mac`, { icon: 'trash' });
  };
  const moveMenu = (btn, mid) => {
    const others = T.tracked().filter((s) => s.id !== T.state.view.seriesId);
    Kit.menu(btn, [{ title: 'Move to' }, ...others.map((s) => ({ label: e(s.name || 'Untitled'), swatch: s.color, onSelect: () => D.moveMeetingFlow(mid, s.id) }))], { align: 'end', minWidth: 230 });
  };
  D.meetingMenu = (btn) => {
    const mid = btn.closest('.mtg').dataset.mid;
    const sid = T.state.view.seriesId;
    const m = (T.seriesById(sid) || { meetings: [] }).meetings.find((x) => x.id === mid);
    if (!m) return;
    Kit.menu(btn, [
      { title: e(`${m.date}${m.n ? ` · #${m.n}` : ''}`) },
      { label: 'Move to another series…', icon: 'folder', onSelect: () => moveMenu(btn, mid) },
      { label: 'Split into new doc', icon: 'doc-plus', onSelect: () => D.splitMeetingFlow(mid) },
      { label: 'Open transcript', icon: 'quote', onSelect: () => D.openTranscript(sid, mid) },
      '-',
      { label: 'Remove from this doc', icon: 'tray', onSelect: () => D.unfileMeetingFlow(mid) },
      { label: 'Delete meeting…', icon: 'trash', danger: true, onSelect: () => D.deleteMeetingFlow(mid) }
    ], { align: 'end', minWidth: 230 });
  };

  const MEETING_TYPE = 'application/x-telu-meeting';
  const hasMeeting = (ev) => [...ev.dataTransfer.types].includes(MEETING_TYPE);
  let dragMid = null;
  const setDropRow = (row) => {
    $$('#sidebar .drop-over').forEach((el) => el !== row && el.classList.remove('drop-over'));
    if (row) row.classList.add('drop-over');
  };
  const validRow = (ev) => {
    const row = ev.target.closest('.a-sb-row, .a-nav[data-view="review"]');
    return row && row.dataset.series !== T.state.view.seriesId ? row : null;
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
    T.el.sidebar.classList.add('dnd');
  };
  const endDrag = () => {
    $$('.mtg.dragging').forEach((el) => el.classList.remove('dragging'));
    T.el.sidebar.classList.remove('dnd');
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
    const mid = (ev.dataTransfer && ev.dataTransfer.getData(MEETING_TYPE)) || dragMid;
    endDrag();
    if (!row || !mid) return;
    ev.preventDefault();
    if (row.dataset.view === 'review') D.unfileMeetingFlow(mid);
    else D.moveMeetingFlow(mid, row.dataset.series, { dragged: true });
  };
  D.wireMeetingDrag = () => {
    T.el.view.addEventListener('dragstart', onDragStart);
    T.el.view.addEventListener('dragend', endDrag);
    T.el.sidebar.addEventListener('dragover', onSidebarDragOver);
    T.el.sidebar.addEventListener('dragleave', (ev) => { if (!T.el.sidebar.contains(ev.relatedTarget)) setDropRow(null); });
    T.el.sidebar.addEventListener('drop', onSidebarDrop);
  };

  Object.assign(T.actions, {
    'meeting-menu': (el) => D.meetingMenu(el),
    'pick-day': (el) => D.pickDay(el),
    'pick-time': (el) => D.pickTime(el),
    'link-event': (el) => D.linkEventMenu(el)
  });
})();
