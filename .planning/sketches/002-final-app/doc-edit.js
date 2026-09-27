(() => {
  const T = window.T;
  const D = T.doc;
  const { $, $$ } = Kit;
  const e = Kit.esc;
  const U = T.util;
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
  D.selectAll = (el) => {
    if (!el) return;
    el.focus({ preventScroll: true });
    const range = document.createRange();
    range.selectNodeContents(el);
    getSelection().removeAllRanges();
    getSelection().addRange(range);
  };

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
    return undefined;
  };
  const markEdited = (s) => {
    if (T.state.edited[s.id]) return;
    T.set({ edited: { ...T.state.edited, [s.id]: true } });
    const meta = $('#purposeMeta');
    if (meta) {
      meta.textContent = D.purposeVersion(T.seriesById(s.id));
      meta.classList.remove('ver-bump');
      void meta.offsetWidth;
      meta.classList.add('ver-bump');
    }
    dropDraftedChip();
  };
  const announced = new Set();
  const announceFirstSave = (s) => {
    if (announced.has(s.id)) return;
    announced.add(s.id);
    T.toast(`Purpose ${e(D.purposeVersion(s).split(' · ')[0])} saved — Telu builds every brief from it`, { icon: 'check-circle' });
  };
  const savePurpose = () => {
    const doc = D.pageRoot();
    const root = $('#sec-purpose');
    const sid = doc && doc.dataset.sid;
    if (root && T.seriesById(sid)) {
      T.mapSeries(sid, (s) => ({ ...s, purpose: { ...s.purpose, ...readPurpose(root) } }));
      announceFirstSave(T.seriesById(sid));
      T.morphAll((ev) => ev.series === sid);
      T.island('refresh');
    }
    T.setSaveState('Saved');
  };
  D.flushSave = () => {
    if (!saveTimer) return;
    clearTimeout(saveTimer);
    saveTimer = null;
    savePurpose();
  };
  const scheduleSave = () => {
    T.setSaveState('Saving…', true);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      savePurpose();
    }, 700);
  };
  const renameLive = (s, name) => {
    T.mapSeries(s.id, (x) => ({ ...x, name }));
    const row = $(`#sidebar .a-sb-row[data-series="${s.id}"] .a-sb-name`);
    if (row) row.textContent = name || 'Untitled';
    const tb = $('#tbDocTitle b');
    if (tb) tb.textContent = name || 'Untitled';
    T.setSaveState('Saving…', true);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      T.setSaveState('Saved');
    }, 700);
  };
  D.onInput = (ev) => {
    const s = D.current();
    const t = ev.target;
    if (!s || !t.isContentEditable || !t.closest('#view')) return;
    if (t.id === 'docTitle') return renameLive(s, t.textContent.trim());
    if (t.closest('#sec-purpose')) {
      markEdited(s);
      scheduleSave();
    }
    return undefined;
  };

  const titleKey = (ev, t) => {
    if (ev.key === 'Enter' && !ev.isComposing) {
      ev.preventDefault();
      D.commitTitle(t);
    }
    if (ev.key === 'Escape') {
      ev.stopPropagation();
      t.blur();
    }
  };
  const agendaInputKey = (ev, input) => {
    if (ev.key === 'Escape') {
      ev.stopPropagation();
      input.value = '';
      input.blur();
      return;
    }
    if (ev.key !== 'Enter' || ev.isComposing) return;
    ev.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    D.addAgendaItem(input.closest('.next'), { t: text, d: '' });
    input.value = '';
  };
  const purposeAgendaKey = (ev, t) => {
    const row = t.closest('.ag-row');
    if (ev.key === 'Enter' && !ev.isComposing) {
      ev.preventDefault();
      const fresh = Kit.html(D.purposeAgendaRow({ t: '', d: '5 min' }));
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
      markEdited(D.current());
      scheduleSave();
    }
  };
  const correctionKey = (ev, t) => {
    const cid = t.closest('.cand').dataset.cid;
    if (ev.key === 'Enter' && !ev.isComposing) {
      ev.preventDefault();
      D.saveCorrection(cid);
    }
    if (ev.key === 'Escape') {
      ev.stopPropagation();
      D.setCandState(cid, 'pending');
    }
  };
  D.onKeydown = (ev) => {
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
    if (ev.key === 'Escape' && t.isContentEditable) {
      ev.stopPropagation();
      t.blur();
    }
    return undefined;
  };

  const briefOf = (block) => {
    const found = block && T.findMeeting(block.dataset.mid);
    return found && found.meeting.brief ? found : null;
  };
  D.addAgendaItem = (block, item) => {
    const found = briefOf(block);
    const list = block && $('[data-agenda-list]', block);
    if (!found || !list) return null;
    T.mapMeeting(found.meeting.id, (x) => ({ ...x, brief: { ...x.brief, agenda: [...x.brief.agenda, item] } }));
    const agenda = T.findMeeting(found.meeting.id).meeting.brief.agenda;
    const el = Kit.html(D.agendaItem(item, agenda.length - 1));
    list.appendChild(el);
    Kit.enterAnimated(el);
    T.island('refresh');
    return el;
  };
  D.askToAgenda = (i, btn) => {
    const block = btn.closest('.next');
    const found = briefOf(block);
    const ask = found && found.meeting.brief.ask[i];
    if (!ask) return;
    if (found.meeting.brief.agenda.some((a) => a.askIndex === i)) return T.toast('Already on the agenda', { icon: 'check' });
    const el = D.addAgendaItem(block, { t: ask.text, d: '5m', added: true, fromAsk: true, askIndex: i });
    if (!el) return;
    D.receive(el);
    btn.disabled = true;
    T.toast('Added to the agenda', { icon: 'check-circle' });
  };
  const toggleAgenda = (item, done) => {
    const found = briefOf(item.closest('.next'));
    if (!found) return;
    const i = Number(item.dataset.i);
    T.mapMeeting(found.meeting.id, (x) => ({ ...x, brief: { ...x.brief, agenda: x.brief.agenda.map((a, idx) => (idx === i ? { ...a, done } : a)) } }));
    item.classList.toggle('done', done);
  };
  D.onToggle = (ev) => {
    const item = ev.target.closest('[data-agenda-list] .agenda-item');
    if (item) toggleAgenda(item, ev.detail.checked);
  };

  D.toggleMeetingDoc = (dot) => {
    const chip = dot.closest('.doc-chip');
    const found = briefOf(dot.closest('.next'));
    if (!chip || !found) return;
    const name = chip.dataset.name;
    const off = found.meeting.brief.off || [];
    const leaving = !off.includes(name);
    T.mapMeeting(found.meeting.id, (x) => ({ ...x, brief: { ...x.brief, off: leaving ? [...off, name] : off.filter((n) => n !== name) } }));
    dot.classList.toggle('off', leaving);
    dot.dataset.tip = leaving ? 'Left out of this brief' : 'Included in this brief';
    T.toast(leaving ? `${e(name)} stays out of this brief` : `${e(name)} is back in this brief`, { icon: leaving ? 'minus' : 'check-circle' });
    T.island('refresh');
  };

  const animateNewChips = (root, selector, names) => $$(selector, root)
    .filter((el) => names.includes(el.dataset.name))
    .forEach((el, i) => {
      el.style.animationDelay = `${i * 40}ms`;
      el.classList.add('chip-in');
    });
  const uniqueNames = (files, taken) => files.map((f) => {
    const name = String(f.name || 'Untitled');
    if (!taken.includes(name)) return { ...f, name };
    const base = name.replace(/\.[^.]+$/, '');
    const ext = (name.match(/\.[^.]+$/) || [''])[0];
    let n = 2;
    while (taken.includes(`${base} ${n}${ext}`)) n += 1;
    return { ...f, name: `${base} ${n}${ext}` };
  });
  D.attachToPurpose = (s, files) => {
    const docs = uniqueNames(files, s.docs.map((d) => d.name)).map((f) => ({ name: f.name, ver: 'v1', size: U.fmtSize(f.size), added: 'Today', include: true }));
    T.mapSeries(s.id, (x) => ({ ...x, docs: [...x.docs, ...docs] }));
    const next = T.seriesById(s.id);
    $('#refRow').innerHTML = D.referenceInner(next);
    animateNewChips(document, '#refRow .ref-chip', docs.map((d) => d.name));
    const what = docs.length === 1 ? docs[0].name : `${docs.length} files`;
    T.toast(`${e(what)} added to ${e(next.name || 'this doc')} · Reference`, { icon: 'paperclip' });
    const up = T.upcomingOf(next);
    if (!up || !up.brief) D.paintNextFor(next.id);
  };
  const meetingDocNames = (s, m) => (m.brief ? m.brief.docs : [...s.docs.filter((d) => d.include).map((d) => d.name), ...(m.docs || [])]);
  T.attachToMeeting = (meetingId, files, { quiet = false } = {}) => {
    const found = T.findMeeting(meetingId);
    if (!found || !files || !files.length) return;
    const { series: s, meeting: m } = found;
    const names = uniqueNames(files, meetingDocNames(s, m)).map((f) => f.name);
    T.mapMeeting(m.id, (x) => (x.brief ? { ...x, brief: { ...x.brief, docs: [...x.brief.docs, ...names] } } : { ...x, docs: [...(x.docs || []), ...names] }));
    const fresh = T.findMeeting(m.id);
    $$(`#win .next[data-mid="${CSS.escape(m.id)}"] [data-doc-list]`).forEach((list) => {
      list.innerHTML = D.nextDocsInner(fresh.series, fresh.meeting);
      animateNewChips(list, '.doc-chip', names);
    });
    const label = `${T.meetingTitle(s, m)}${m.n ? ` #${m.n}` : ''}`;
    if (!quiet) T.toast(`Attached ${e(names.length === 1 ? names[0] : `${names.length} files`)} to ${e(label)}`, { icon: 'paperclip' });
    T.island('refresh');
  };

  const isFileDrag = (ev) => !!ev.dataTransfer && [...ev.dataTransfer.types].includes('Files');
  let zone = null;
  const setZone = (next) => {
    if (zone === next) return;
    if (zone) zone.classList.remove('drop-target');
    zone = next;
    if (zone) zone.classList.add('drop-target');
  };
  const dropInto = (target, files) => {
    if (target.id === 'sec-purpose') {
      const s = D.current();
      if (s) D.attachToPurpose(s, files);
      return;
    }
    const block = target.closest('.next');
    if (block && block.dataset.mid) T.attachToMeeting(block.dataset.mid, files);
  };
  const wireZone = (root) => {
    root.addEventListener('dragover', (ev) => {
      if (!isFileDrag(ev)) return;
      ev.preventDefault();
      const target = ev.target.closest('#sec-purpose, .next-docs');
      ev.dataTransfer.dropEffect = target ? 'copy' : 'none';
      setZone(target);
    });
    root.addEventListener('dragleave', (ev) => {
      if (!root.contains(ev.relatedTarget)) setZone(null);
    });
    root.addEventListener('drop', (ev) => {
      if (!isFileDrag(ev)) return;
      ev.preventDefault();
      const target = zone;
      setZone(null);
      if (target) dropInto(target, [...ev.dataTransfer.files].map((f) => ({ name: f.name, size: f.size })));
    });
  };
  D.wireDrops = () => {
    wireZone(T.el.view);
    wireZone(T.el.peek);
    window.addEventListener('dragover', (ev) => { if (isFileDrag(ev)) ev.preventDefault(); });
    window.addEventListener('drop', (ev) => {
      if (!isFileDrag(ev)) return;
      ev.preventDefault();
      setZone(null);
    });
  };

  Object.assign(T.actions, {
    'ask-to-agenda': (el) => D.askToAgenda(Number(el.dataset.i), el),
    'toggle-meeting-doc': (el) => D.toggleMeetingDoc(el),
    doc: (el) => T.toast(`Opening ${e(el.dataset.name)} in Preview…`, { icon: 'doc' }),
    join: (el) => {
      const ev = el.dataset.id ? T.eventById(el.dataset.id) : null;
      const where = el.dataset.where || (ev && ev.where) || 'the call';
      T.toast(`Opening ${e(/zoom/i.test(where) ? 'Zoom' : /meet/i.test(where) ? 'Google Meet' : where)}…`, { icon: 'video' });
    }
  });
})();
