(() => {
  const { $, $$ } = Kit;
  const e = Kit.esc;
  const AM = DATA.afterMeeting;
  let saveTimer = null;

  const focusEnd = (el) => {
    if (!el) return;
    el.focus({ preventScroll: true });
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    getSelection().removeAllRanges();
    getSelection().addRange(range);
  };
  const selectAll = (el) => {
    if (!el) return;
    el.focus({ preventScroll: true });
    const range = document.createRange();
    range.selectNodeContents(el);
    getSelection().removeAllRanges();
    getSelection().addRange(range);
  };
  LD.selectAll = selectAll;

  const readPurpose = (root) => {
    const text = (sel) => (root.querySelector(sel) ? root.querySelector(sel).textContent.trim() : '');
    return {
      why: text('[data-field="why"]'),
      notFor: text('[data-field="notFor"]'),
      outcomes: $$('.p-outcomes li', root).map((li) => li.textContent.trim()).filter(Boolean),
      agenda: $$('.p-agenda .ag-row', root)
        .map((row) => ({ t: row.querySelector('.ag-t').textContent.trim(), d: row.querySelector('.ag-d').textContent.trim() }))
        .filter((a) => a.t)
    };
  };
  const dropDraftedChip = () => {
    const chip = $('#draftedChip');
    if (!chip) return;
    if (Kit.reduceMotion()) return chip.remove();
    chip.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(0.96)' }], { duration: 160, easing: 'ease-out' }).finished.then(() => chip.remove());
  };
  const markEdited = (s) => {
    if (LD.state.edited[s.id]) return;
    LD.set({ edited: { ...LD.state.edited, [s.id]: true } });
    const meta = $('#purposeMeta');
    if (meta) {
      meta.textContent = LD.purposeVersion(LD.series(s.id));
      meta.classList.remove('ver-bump');
      void meta.offsetWidth;
      meta.classList.add('ver-bump');
    }
    dropDraftedChip();
  };
  LD.flushSave = () => {
    if (!saveTimer) return;
    clearTimeout(saveTimer);
    saveTimer = null;
    savePurpose();
  };
  const announced = new Set();
  const announceFirstSave = (s) => {
    if (announced.has(s.id)) return;
    announced.add(s.id);
    Kit.toast(`Purpose ${e(LD.purposeVersion(s).split(' · ')[0])} saved — Telu builds every brief from it`, { icon: 'check-circle' });
  };
  const savePurpose = () => {
    const doc = $('#canvasInner .doc');
    const root = $('#sec-purpose');
    const sid = doc && doc.dataset.sid;
    if (root && LD.series(sid)) announceFirstSave(LD.updateSeries(sid, (s) => ({ ...s, purpose: { ...s.purpose, ...readPurpose(root) } })));
    LD.setSaveState('Saved');
  };
  const scheduleSave = () => {
    LD.setSaveState('Editing…', true);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      savePurpose();
    }, 700);
  };
  const renameLive = (s, name) => {
    LD.updateSeries(s.id, (x) => ({ ...x, name }));
    const row = $(`#sbNav .doc-row[data-doc="${s.id}"] .name`);
    if (row) row.textContent = name || 'Untitled';
    const tb = $('#tbTitle b');
    if (tb) tb.textContent = name || 'Untitled';
    LD.setSaveState('Editing…', true);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      LD.setSaveState('Saved');
    }, 700);
  };
  LD.onCanvasInput = (ev) => {
    const s = LD.current();
    const t = ev.target;
    if (!s || !t.isContentEditable) return;
    if (t.id === 'docTitle') return renameLive(s, t.textContent.trim());
    if (t.closest('#sec-purpose')) {
      markEdited(s);
      scheduleSave();
    }
  };

  const titleKey = (ev, t) => {
    if (ev.key === 'Enter' && !ev.isComposing) {
      ev.preventDefault();
      LD.commitTitle(t);
    }
    if (ev.key === 'Escape') t.blur();
  };
  const agendaInputKey = (ev, input) => {
    if (ev.key === 'Escape') {
      input.value = '';
      input.blur();
      return;
    }
    if (ev.key !== 'Enter' || ev.isComposing) return;
    ev.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    LD.addAgendaItem({ t: text, d: '' });
    input.value = '';
  };
  const purposeAgendaKey = (ev, t) => {
    const row = t.closest('.ag-row');
    if (ev.key === 'Enter' && !ev.isComposing) {
      ev.preventDefault();
      const fresh = Kit.html(LD.purposeAgendaRow({ t: '', d: '5 min' }));
      row.after(fresh);
      Kit.enterAnimated(fresh);
      focusEnd(fresh.querySelector('.ag-t'));
      return;
    }
    if (ev.key === 'Backspace' && !t.textContent && row.parentElement.children.length > 1) {
      ev.preventDefault();
      const prev = row.previousElementSibling || row.nextElementSibling;
      row.remove();
      focusEnd(prev.querySelector('.ag-t'));
      markEdited(LD.current());
      scheduleSave();
    }
  };
  const correctionKey = (ev, t) => {
    const cid = t.closest('.cand').dataset.cid;
    if (ev.key === 'Enter' && !ev.isComposing) {
      ev.preventDefault();
      LD.saveCorrection(cid);
    }
    if (ev.key === 'Escape') LD.setCandState(cid, 'pending');
  };
  LD.onCanvasKeydown = (ev) => {
    const t = ev.target;
    if (t.id === 'docTitle') return titleKey(ev, t);
    if (t.classList.contains('agenda-input')) return agendaInputKey(ev, t);
    if (t.classList.contains('ag-t') && t.closest('.p-agenda')) return purposeAgendaKey(ev, t);
    if (t.classList.contains('cand-text')) return correctionKey(ev, t);
    const single = t.dataset.field === 'why' || t.dataset.field === 'notFor' || t.classList.contains('ag-d');
    if (single && ev.key === 'Enter' && !ev.shiftKey) {
      ev.preventDefault();
      t.blur();
    }
    if (ev.key === 'Escape' && t.isContentEditable) t.blur();
  };

  const upcomingBrief = () => {
    const s = LD.current();
    const m = s && LD.upcomingOf(s);
    return m && m.brief ? { s, m } : null;
  };
  LD.addAgendaItem = (item) => {
    const found = upcomingBrief();
    const list = $('#agendaList');
    if (!found || !list) return null;
    const next = LD.updateMeeting(found.s.id, found.m.id, (x) => ({ ...x, brief: { ...x.brief, agenda: [...x.brief.agenda, item] } }));
    const agenda = LD.upcomingOf(next).brief.agenda;
    const el = Kit.html(LD.agendaItem(item, agenda.length - 1));
    list.appendChild(el);
    Kit.enterAnimated(el);
    return el;
  };
  LD.askToAgenda = (i, btn) => {
    const found = upcomingBrief();
    const ask = found && found.m.brief.ask[i];
    if (!ask) return;
    if (found.m.brief.agenda.some((a) => a.askIndex === i)) return Kit.toast('Already on the agenda', { icon: 'check' });
    const el = LD.addAgendaItem({ t: ask.text, d: '5m', added: true, fromAsk: true, askIndex: i });
    if (!el) return;
    LD.receive(el);
    btn.disabled = true;
    Kit.toast('Added to the agenda', { icon: 'check-circle' });
  };
  const toggleAgenda = (item, done) => {
    const found = upcomingBrief();
    if (!found) return;
    const i = Number(item.dataset.i);
    LD.updateMeeting(found.s.id, found.m.id, (x) => ({ ...x, brief: { ...x.brief, agenda: x.brief.agenda.map((a, idx) => (idx === i ? { ...a, done } : a)) } }));
    item.classList.toggle('done', done);
  };
  LD.onToggle = (ev) => {
    const det = ev.target.closest('.det-row');
    if (det) return LD.onDetectToggle(Number(det.dataset.i), ev.detail.checked);
    const item = ev.target.closest('#agendaList .agenda-item');
    if (item) toggleAgenda(item, ev.detail.checked);
  };

  const isFileDrag = (ev) => !!ev.dataTransfer && [...ev.dataTransfer.types].includes('Files');
  let zone = null;
  const setZone = (next) => {
    if (zone === next) return;
    if (zone) zone.classList.remove('drop-target');
    zone = next;
    if (zone) zone.classList.add('drop-target');
  };
  const formatSize = (bytes) => (bytes >= 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round((bytes || 0) / 1e3))} KB`);
  const animateNewChips = (selector, names) => $$(selector)
    .filter((el) => names.includes(el.dataset.name))
    .forEach((el, i) => {
      el.style.animationDelay = `${i * 40}ms`;
      el.classList.add('chip-in');
    });
  const nextDocNames = (s) => {
    const up = LD.upcomingOf(s);
    if (!up) return [];
    return up.brief ? up.brief.docs : [...s.docs.filter((d) => d.include).map((d) => d.name), ...(up.docs || [])];
  };
  const attachToPurpose = (s, files) => {
    const docs = files.map((f) => ({ name: f.name, ver: 'v1', size: formatSize(f.size), added: 'Today', include: true }));
    const next = LD.updateSeries(s.id, (x) => ({ ...x, docs: [...x.docs, ...docs] }));
    $('#refRow').innerHTML = LD.referenceInner(next);
    animateNewChips('#refRow .ref-chip', docs.map((d) => d.name));
    const what = docs.length === 1 ? docs[0].name : `${docs.length} files`;
    Kit.toast(`${e(what)} added to ${e(next.name || 'this doc')} · Reference`, { icon: 'paperclip' });
    if (!LD.upcomingOf(next)?.brief) LD.paintNext(next);
  };
  const attachToMeeting = (s, files) => {
    const up = LD.upcomingOf(s);
    if (!up) return;
    const names = files.map((f) => f.name);
    const next = LD.updateMeeting(s.id, up.id, (x) => (x.brief
      ? { ...x, brief: { ...x.brief, docs: [...x.brief.docs, ...names] } }
      : { ...x, docs: [...(x.docs || []), ...names] }));
    $('#nextDocList').innerHTML = nextDocNames(next).map((d) => LD.docButton(d)).join('');
    animateNewChips('#nextDocList .doc-chip', names);
    const when = LD.dayOffset(up.date) === 0 ? 'today’s meeting' : `the ${up.date} meeting`;
    Kit.toast(`Attached ${e(names.length === 1 ? names[0] : `${names.length} files`)} to ${e(when)}`, { icon: 'paperclip' });
  };
  LD.attachFiles = (target, files) => {
    const s = LD.current();
    if (!s || !files.length) return;
    if (target === 'purpose') attachToPurpose(s, files);
    else attachToMeeting(s, files);
  };
  LD.wireDrops = () => {
    const inner = $('#canvasInner');
    inner.addEventListener('dragover', (ev) => {
      if (!isFileDrag(ev)) return;
      ev.preventDefault();
      const target = ev.target.closest('#sec-purpose, .next-docs');
      ev.dataTransfer.dropEffect = target ? 'copy' : 'none';
      setZone(target);
    });
    inner.addEventListener('dragleave', (ev) => {
      if (!inner.contains(ev.relatedTarget)) setZone(null);
    });
    inner.addEventListener('drop', (ev) => {
      if (!isFileDrag(ev)) return;
      ev.preventDefault();
      const target = zone;
      setZone(null);
      if (target) LD.attachFiles(target.id === 'sec-purpose' ? 'purpose' : 'meeting', [...ev.dataTransfer.files]);
    });
    window.addEventListener('dragover', (ev) => { if (isFileDrag(ev)) ev.preventDefault(); });
    window.addEventListener('drop', (ev) => {
      if (!isFileDrag(ev)) return;
      ev.preventDefault();
      setZone(null);
    });
  };

  LD.paintNext = (s, { animate = false } = {}) => {
    const sec = $('#sec-next');
    const doc = $('#canvasInner .doc');
    if (!sec || !doc || doc.dataset.sid !== s.id) return;
    const parts = LD.nextParts(s);
    const apply = () => {
      sec.className = `doc-sec next ${parts.cls}`;
      sec.innerHTML = parts.inner;
    };
    if (!animate || Kit.reduceMotion()) return apply();
    const out = sec.animate([{ opacity: 1, filter: 'blur(0px)' }, { opacity: 0, filter: 'blur(2px)' }], { duration: 120, easing: 'ease-out', fill: 'forwards' });
    out.finished.then(() => {
      apply();
      out.cancel();
      sec.animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 200, easing: Kit.EASE_OUT });
    }).catch(apply);
  };
  LD.paintRowBadge = (sid) => {
    const row = $(`#sbNav .doc-row[data-doc="${sid}"]`);
    const s = LD.series(sid);
    if (!row || !s) return;
    const n = LD.pendingCount(s);
    const fresh = Kit.html(n ? `<span class="count review num">${n}</span>` : `<span class="hint">${LD.nextHint(s)}</span>`);
    const old = row.querySelector('.count, .hint');
    if (old) old.replaceWith(fresh);
    else row.appendChild(fresh);
  };

  const findCand = (cid) => {
    const s = LD.current();
    if (!s) return null;
    const m = s.meetings.find((x) => x.candidates && x.candidates.some((c) => c.id === cid));
    return m ? { s, m, c: m.candidates.find((c) => c.id === cid) } : null;
  };
  const paintReviewChrome = (sid, mid) => {
    const m = LD.meeting(sid, mid);
    const head = $(`#review-${mid} .review-head`);
    if (head) head.outerHTML = LD.reviewHead(m);
    const counts = $(`#m-${mid} .mtg-counts`);
    if (counts) counts.innerHTML = LD.countsChips(m);
    LD.paintRowBadge(sid);
  };
  const paintCand = (sid, mid, cid) => {
    const c = LD.meeting(sid, mid).candidates.find((x) => x.id === cid);
    const row = $(`.cand[data-cid="${cid}"]`);
    if (row) row.outerHTML = LD.candRow(c);
    paintReviewChrome(sid, mid);
  };
  const setCand = (found, patch) => LD.updateMeeting(found.s.id, found.m.id, (m) => ({
    ...m, candidates: m.candidates.map((c) => (c.id === found.c.id ? { ...c, ...patch } : c))
  }));
  LD.setCandState = (cid, state) => {
    const found = findCand(cid);
    if (!found) return;
    setCand(found, { state });
    paintCand(found.s.id, found.m.id, cid);
    if (state === 'editing') selectAll($(`.cand[data-cid="${cid}"] .cand-text`));
  };
  const flushMemory = (sid, keys) => {
    const s = LD.series(sid);
    const body = $('#memBody');
    if (!s || !body) return;
    body.innerHTML = LD.memoryBody(s);
    keys.forEach((key) => LD.receive(body.querySelector(`.mem-item[data-key="${key}"]`)));
    const tick = $('#scrubber [data-target="sec-memory"] .scrub-tick');
    if (tick) LD.receive(tick);
    if (!LD.upcomingOf(s)?.brief) LD.paintNext(s);
  };
  const acceptOne = (cid, text) => {
    const found = findCand(cid);
    if (!found || found.c.state === 'accepted') return null;
    const c = { ...found.c, text: text || found.c.text };
    setCand(found, { text: c.text, state: 'accepted', corrected: !!text });
    const s = LD.updateSeries(found.s.id, (x) => LD.acceptCandidate(x, found.m, c));
    paintCand(s.id, found.m.id, cid);
    const resolved = c.resolves ? s.memory.find((it) => it.text === c.resolves) : null;
    return { sid: s.id, mid: found.m.id, keys: [`${s.id}-${cid}`, resolved ? resolved.id : null].filter(Boolean) };
  };
  const reviewDone = (sid, mid) => {
    if (LD.pendingOf(LD.meeting(sid, mid))) return;
    Kit.toast('All reviewed · Memory is up to date', { icon: 'check-circle' });
  };
  LD.acceptCand = (cid, { text } = {}) => {
    const done = acceptOne(cid, text);
    if (!done) return;
    flushMemory(done.sid, done.keys);
    reviewDone(done.sid, done.mid);
  };
  LD.saveCorrection = (cid) => {
    const t = $(`.cand[data-cid="${cid}"] .cand-text`);
    const text = t ? t.textContent.trim() : '';
    if (!text) return LD.setCandState(cid, 'pending');
    LD.acceptCand(cid, { text });
  };
  LD.acceptAll = (mid) => {
    const m = LD.meeting(LD.state.view.id, mid);
    if (!m) return;
    const ids = m.candidates.filter((c) => c.state === 'pending').map((c) => c.id);
    const keys = [];
    ids.forEach((cid, i) => LD.later(() => {
      const done = acceptOne(cid);
      if (done) keys.push(...done.keys);
      if (i < ids.length - 1 || !done) return;
      flushMemory(done.sid, keys);
      reviewDone(done.sid, done.mid);
    }, i * 70));
  };

  const nearText = (btn) => {
    const host = btn.closest('.mem-item, .carry-row, .ask-row, .k-row');
    const t = host && host.querySelector('.mem-text, .carry-text, .ask-text, .k-text');
    return t ? `${t.textContent.trim()}.` : '';
  };
  const docEvidence = (btn, ev) => {
    const pop = Kit.popover(btn, `<div class="ev-pop"><div class="t-eyebrow">EVIDENCE · ${e(ev.doc)} · ${e(ev.loc || '')}</div><div class="ev-quote">“${e(ev.quote)}”</div><div class="row-flex ev-foot">${LD.badge(ev.doc)}<span class="muted truncate">${e(ev.doc)}</span><span class="spacer"></span><button class="btn sm plain" data-pop="open">Open</button></div></div>`, { width: 320 });
    const open = pop && pop.el.querySelector('[data-pop="open"]');
    if (open) open.addEventListener('click', () => {
      pop.close();
      Kit.toast(`Opening ${e(ev.doc)}…`, { icon: 'doc' });
    });
  };
  const candidateEvidence = (btn, s) => {
    const found = findCand(btn.dataset.cand);
    if (!found) return;
    const { m, c } = found;
    Kit.evidence(btn, { t: c.ev.t, who: c.ev.who, quote: e(c.ev.quote) }, { where: LD.shortDate(m.date), onOpen: () => LD.openTranscript(s.id, m.id, c.ev.t) });
  };
  LD.openEvidence = (btn) => {
    const s = LD.current();
    if (!s) return;
    if (btn.dataset.cand) return candidateEvidence(btn, s);
    const inMeeting = !!btn.closest('.mtg');
    const ev = LD.evidenceFor(s, btn.dataset.src, nearText(btn));
    if (ev.kind === 'doc') return docEvidence(btn, ev);
    const onOpen = ev.mid ? () => (inMeeting ? LD.openTranscript(s.id, ev.mid, ev.t) : LD.jumpToMeeting(ev.mid)) : null;
    const pop = Kit.evidence(btn, { t: ev.t, who: ev.who, quote: e(ev.quote) }, { where: e(ev.where), onOpen });
    const open = pop && onOpen && !inMeeting ? pop.el.querySelector('[data-open]') : null;
    if (open) open.textContent = `Jump to ${ev.where}`;
  };

  LD.toggleMeeting = (mtg, force) => {
    if (!mtg || mtg.classList.contains('cancelled')) return;
    const open = typeof force === 'boolean' ? force : !mtg.classList.contains('open');
    LD.set({ expanded: { ...LD.state.expanded, [mtg.dataset.mid]: open } });
    mtg.classList.toggle('open', open);
    mtg.querySelector('.disclosure').classList.toggle('open', open);
    mtg.querySelector('.collapsible').classList.toggle('collapsed', !open);
  };
  LD.jumpToMeeting = (mid) => {
    const el = document.getElementById(`m-${mid}`);
    if (!el) return;
    LD.toggleMeeting(el, true);
    const smooth = !Kit.reduceMotion();
    el.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
    LD.later(() => LD.receive(el), smooth ? 360 : 0);
  };
  LD.jumpMeeting = (dir) => {
    const list = $$('#canvasInner #sec-next, #canvasInner .mtg');
    if (!list.length) return;
    const line = $('#canvas').getBoundingClientRect().top + 80;
    const tops = list.map((el) => el.getBoundingClientRect().top);
    const target = dir > 0
      ? list.find((el, i) => tops[i] > line + 2)
      : list.filter((el, i) => tops[i] < line - 10).pop();
    if (target) target.scrollIntoView({ block: 'start' });
  };

  let liveStops = [];
  let tbStop = null;
  const elapsed = () => (LD.state.recording ? Math.round((Date.now() - LD.state.recording.started) / 1000) : 0);
  const clearLive = () => {
    liveStops.forEach((stop) => stop());
    liveStops = [];
  };
  LD.stopLive = () => {
    clearLive();
    if (tbStop) tbStop();
    tbStop = null;
  };
  LD.paintRecordButton = () => {
    const btn = $('#tbRecord');
    if (!btn) return;
    if (tbStop) tbStop();
    tbStop = null;
    const live = !!LD.state.recording;
    btn.classList.toggle('live', live);
    btn.innerHTML = live
      ? '<span class="rec-dot"></span><span class="num tb-timer">0:00</span><span>Stop</span>'
      : `<span class="rec-glyph"></span>Record<span class="kbd">⌘R</span>`;
    if (live) tbStop = Kit.timer(btn.querySelector('.tb-timer'), elapsed());
  };
  const LIVE_SCRIPT = [[1400, 0], [3800, 1], [5800, 'ask']];
  const liveAsk = () => `<div class="ask live-ask enter"><div class="ask-head">${icon('sparkle')}Worth asking now</div><div class="ask-row"><span class="ask-text">${e(DATA.live.suggestion.text)}</span><span class="ask-side">${DATA.live.suggestion.sources.map((src) => Kit.source(src)).join('')}</span></div></div>`;
  const liveLine = (i) => (i === 'ask' ? liveAsk() : `<div class="live-line enter"><b>${e(DATA.live.transcript[i].who)}</b><span>${e(DATA.live.transcript[i].text)}</span></div>`);
  const addLine = (i) => {
    const box = $('#liveLines');
    if (!box || !LD.state.recording) return;
    const listening = box.querySelector('.listening');
    if (listening) listening.remove();
    box.insertAdjacentHTML('beforeend', liveLine(i));
  };
  LD.resumeLive = () => {
    const timer = $('#liveTimer');
    const rec = LD.state.recording;
    if (!timer || !rec) return;
    clearLive();
    liveStops.push(Kit.timer(timer, elapsed()));
    if (rec.sid !== AM.series) return;
    const since = Date.now() - rec.started;
    LIVE_SCRIPT.forEach(([at, i]) => {
      if (at <= since) return addLine(i);
      const id = setTimeout(() => addLine(i), at - since);
      liveStops.push(() => clearTimeout(id));
    });
  };
  const recordTarget = () => {
    const s = LD.current();
    if (s) return s.id;
    const next = LD.nextToday(LD.state.series);
    return next ? next.s.id : null;
  };
  const startRecording = async () => {
    const sid = recordTarget();
    if (!sid) {
      await LD.newDoc();
      return startRecording();
    }
    if (LD.state.view.kind !== 'doc' || LD.state.view.id !== sid) await LD.openDoc(sid);
    LD.set({ recording: { sid, started: Date.now() } });
    LD.paintNext(LD.series(sid));
    LD.paintRecordButton();
    LD.resumeLive();
    const next = $('#sec-next');
    const canvas = $('#canvas').getBoundingClientRect();
    if (next && (next.getBoundingClientRect().top > canvas.bottom - 80 || next.getBoundingClientRect().bottom < canvas.top + 60)) next.scrollIntoView({ block: 'start' });
  };
  const insertNewest = (s, mid) => {
    const doc = $('#canvasInner .doc');
    if (!doc || doc.dataset.sid !== s.id) {
      LD.paintRowBadge(s.id);
      return LD.receive($(`#sbNav .doc-row[data-doc="${s.id}"]`));
    }
    const m = mid ? s.meetings.find((x) => x.id === mid) : s.meetings.find((x) => !LD.isUpcoming(x));
    LD.set({ expanded: { ...LD.state.expanded, [m.id]: true } });
    const list = $('#pastList');
    const empty = list.querySelector('.past-empty');
    if (empty) empty.remove();
    const existing = document.getElementById(`m-${m.id}`);
    if (existing) existing.remove();
    const el = Kit.html(LD.meetingMarkup(s, m));
    list.prepend(el);
    Kit.enterAnimated(el);
    $('#earlierSlot').innerHTML = LD.earlierButton(s);
    LD.refreshMarks();
    LD.paintRowBadge(s.id);
    return el;
  };
  const finishRecording = (sid, seconds) => {
    LD.set({ preparing: null });
    const s = LD.series(sid);
    if (!s) return;
    const up = LD.upcomingOf(s);
    if (sid === AM.series && up && up.id === AM.meeting) return LD.rollForwardFlow({ fromRecording: true });
    const next = LD.updateSeries(sid, (x) => LD.recordedInto(x, seconds));
    LD.paintNext(next, { animate: true });
    insertNewest(next);
    Kit.toast(`Filed today’s recording to ${e(next.name || 'Untitled')}`, { icon: 'check-circle' });
  };
  const stopRecording = () => {
    const rec = LD.state.recording;
    if (!rec) return;
    clearLive();
    LD.set({ recording: null, preparing: rec.sid });
    LD.paintRecordButton();
    LD.paintNext(LD.series(rec.sid));
    const seconds = Math.round((Date.now() - rec.started) / 1000);
    LD.later(() => finishRecording(rec.sid, seconds), 1700);
  };
  LD.toggleRecording = () => (LD.state.recording ? stopRecording() : startRecording());
  LD.rollForwardFlow = async ({ fromRecording = false, scroll = false } = {}) => {
    if (!LD.series(AM.series)) return;
    if (LD.state.view.kind !== 'doc' || LD.state.view.id !== AM.series) await LD.openDoc(AM.series);
    const s = LD.updateSeries(AM.series, LD.rollForward);
    const next = $('#sec-next');
    if (scroll && next) next.scrollIntoView({ block: 'start' });
    LD.paintNext(s, { animate: true });
    insertNewest(s, AM.meeting);
    LD.paintSidebar();
    LD.receive($(`#sbNav .doc-row[data-doc="${AM.series}"]`));
    const open = () => LD.jumpToMeeting(AM.meeting);
    LD.later(() => Kit.notify({
      title: 'Product Sync — 5 items to review',
      body: `Today · ${AM.duration} · summary ready on this Mac`,
      actions: [{ label: 'Review', primary: true, onClick: open }],
      onClick: open
    }), fromRecording ? 250 : 700);
  };
})();
