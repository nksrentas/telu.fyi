(() => {
  const T = window.T;
  const D = T.doc;
  const { $, $$ } = Kit;
  const e = Kit.esc;

  const findCand = (cid) => {
    for (const s of T.state.series) {
      const m = s.meetings.find((x) => x.candidates && x.candidates.some((c) => c.id === cid));
      if (m) return { s, m, c: m.candidates.find((c) => c.id === cid) };
    }
    return null;
  };
  const setCand = (found, patch) => T.mapMeeting(found.m.id, (m) => ({
    ...m, candidates: m.candidates.map((c) => (c.id === found.c.id ? { ...c, ...patch } : c))
  }));

  const paintReviewChrome = (mid) => {
    const found = T.findMeeting(mid);
    if (!found) return;
    const m = found.meeting;
    $$(`#win [data-review="${CSS.escape(mid)}"] .review-head`).forEach((head) => { head.outerHTML = D.reviewHead(m); });
    $$(`#win [data-mid="${CSS.escape(mid)}"] .mtg-counts`).forEach((counts) => { counts.innerHTML = D.countsChips(m); });
  };
  const paintCand = (mid, cid) => {
    const found = T.findMeeting(mid);
    const c = found && found.meeting.candidates.find((x) => x.id === cid);
    if (!c) return;
    $$(`#win .cand[data-cid="${CSS.escape(cid)}"]`).forEach((row) => { row.outerHTML = D.candRow(c); });
    paintReviewChrome(mid);
  };
  const afterReview = (mid) => {
    T.morphMeeting(mid);
    T.updateCounts();
    T.island('refresh');
    if (T.state.view.kind !== 'review') return;
    T.pages.refreshReviewHead();
    if (!T.pending(mid)) T.pagesAfterReview(mid);
  };

  D.setCandState = (cid, state) => {
    const found = findCand(cid);
    if (!found) return;
    setCand(found, { state });
    paintCand(found.m.id, cid);
    afterReview(found.m.id);
    if (state === 'editing') D.selectAll($(`#win .cand[data-cid="${CSS.escape(cid)}"] .cand-text`));
  };

  const acceptOne = (cid, text) => {
    const found = findCand(cid);
    if (!found || found.c.state === 'accepted') return null;
    const c = { ...found.c, text: text || found.c.text };
    setCand(found, { text: c.text, state: 'accepted', corrected: !!text });
    T.mapSeries(found.s.id, (x) => T.acceptCandidate(x, found.m, c));
    paintCand(found.m.id, cid);
    const s = T.seriesById(found.s.id);
    const resolved = c.resolves ? s.memory.find((it) => it.text === c.resolves) : null;
    return { sid: s.id, mid: found.m.id, keys: [`${s.id}-${cid}`, resolved ? resolved.id : null].filter(Boolean) };
  };
  const restoreSeries = (snapshot, mid) => {
    T.set({ series: T.state.series.map((s) => (s.id === snapshot.id ? snapshot : s)) });
    const found = T.findMeeting(mid);
    if (found) found.meeting.candidates.forEach((c) => paintCand(mid, c.id));
    D.paintPageMemory(snapshot.id);
    afterReview(mid);
    if (T.state.view.kind === 'review') T.renderView({ keepScroll: true });
    T.peek.refresh();
  };
  const reviewDone = (mid) => {
    if (T.pending(mid)) return false;
    T.toast('All reviewed · Memory is up to date', { icon: 'check-circle' });
    return true;
  };
  D.acceptCand = (cid, { text } = {}) => {
    const before = findCand(cid);
    if (!before) return;
    const snapshot = before.s;
    const done = acceptOne(cid, text);
    if (!done) return;
    D.paintPageMemory(done.sid, done.keys);
    afterReview(done.mid);
    if (reviewDone(done.mid)) return;
    T.toast(text ? 'Correction saved — Telu keeps your wording' : `Added to ${e(snapshot.name)} Memory`, {
      icon: 'check-circle', action: { label: 'Undo', onClick: () => restoreSeries(snapshot, done.mid) }
    });
  };
  D.saveCorrection = (cid) => {
    const t = $(`#win .cand[data-cid="${CSS.escape(cid)}"] .cand-text`);
    const text = t ? t.textContent.replace(/\s+/g, ' ').trim() : '';
    const found = findCand(cid);
    if (!text || !found) return D.setCandState(cid, 'pending');
    D.acceptCand(cid, { text: text === found.c.text ? undefined : text });
    return undefined;
  };
  D.acceptAll = (mid) => {
    const found = T.findMeeting(mid);
    if (!found) return;
    const snapshot = found.series;
    const ids = found.meeting.candidates.filter((c) => c.state === 'pending').map((c) => c.id);
    const keys = [];
    ids.forEach((cid, i) => T.later(() => {
      const done = acceptOne(cid);
      if (done) keys.push(...done.keys);
      if (i < ids.length - 1) return;
      D.paintPageMemory(snapshot.id, keys);
      afterReview(mid);
      T.toast(`Added ${ids.length} items to ${e(snapshot.name)} Memory`, {
        icon: 'check-circle', action: { label: 'Undo', onClick: () => restoreSeries(snapshot, mid) }
      });
    }, i * 70));
  };

  const candidateEvidence = (btn) => {
    const found = findCand(btn.dataset.cand);
    if (!found) return;
    const { s, m, c } = found;
    const inPeek = !!btn.closest('#peek');
    const onOpen = () => (inPeek ? D.togglePeekTranscript(btn, c.ev.t) : D.openTranscript(s.id, m.id, c.ev.t));
    Kit.evidence(btn, { t: c.ev.t, who: c.ev.who, quote: e(c.ev.quote) }, { where: e(T.util.shortDate(m.date)), onOpen });
  };
  const nearText = (btn) => {
    const host = btn.closest('.mem-item, .carry-row, .ask-row, .k-row');
    const t = host && host.querySelector('.mem-text, .carry-text, .ask-text, .k-text');
    return t ? `${t.textContent.trim()}.` : '';
  };
  const docEvidence = (btn, ev) => {
    const pop = Kit.popover(btn, `<div class="ev-pop"><div class="t-eyebrow">EVIDENCE · ${e(ev.doc)} · ${e(ev.loc || '')}</div><div class="ev-quote">“${e(ev.quote)}”</div><div class="row-flex ev-foot">${D.badge(ev.doc)}<span class="muted truncate">${e(ev.doc)}</span><span class="spacer"></span><span class="a-local">${icon('lock', 'sm')}Read on this Mac</span><button class="btn sm plain" data-pop="open">Open</button></div></div>`, { width: 330 });
    const open = pop && pop.el.querySelector('[data-pop="open"]');
    if (open) open.addEventListener('click', () => {
      pop.close();
      T.toast(`Opening ${e(ev.doc)} in Preview…`, { icon: 'doc' });
    });
  };
  const speechOpen = (btn, s, ev) => {
    if (!ev.mid) return null;
    if (btn.closest('#peek')) return () => T.openDoc(s.id, { reveal: { mid: ev.mid } });
    if (btn.closest('.mtg')) return () => D.openTranscript(s.id, ev.mid, ev.t);
    return () => D.jumpToMeeting(ev.mid);
  };
  D.openEvidence = (btn) => {
    if (btn.dataset.cand) return candidateEvidence(btn);
    const s = T.seriesById(D.sidOf(btn));
    const ev = T.evidenceFor(s, btn.dataset.src, nearText(btn));
    if (ev.kind === 'doc') return docEvidence(btn, ev);
    const onOpen = s ? speechOpen(btn, s, ev) : null;
    const pop = Kit.evidence(btn, { t: ev.t, who: ev.who, quote: e(ev.quote) }, { where: e(ev.where), onOpen });
    const open = pop && onOpen && !btn.closest('.mtg') ? pop.el.querySelector('[data-open]') : null;
    if (open) open.textContent = btn.closest('#peek') ? `Open ${ev.where} in the doc` : `Jump to ${ev.where}`;
    return pop;
  };

  const candId = (el) => el.closest('.cand').dataset.cid;
  Object.assign(T.actions, {
    accept: (el) => D.acceptCand(candId(el)),
    'accept-all': (el) => D.acceptAll(D.midOf(el)),
    correct: (el) => D.setCandState(candId(el), 'editing'),
    'cancel-correct': (el) => D.setCandState(candId(el), 'pending'),
    'save-correct': (el) => D.saveCorrection(candId(el)),
    reject: (el) => {
      const cid = candId(el);
      D.setCandState(cid, 'rejected');
      const found = findCand(cid);
      if (found) reviewDone(found.m.id);
    },
    'undo-reject': (el) => D.setCandState(candId(el), 'pending')
  });
})();
