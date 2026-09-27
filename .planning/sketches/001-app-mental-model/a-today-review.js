(() => {
  const AT = window.AT;
  const { esc } = Kit;
  const { plural, shortDate } = AT.util;
  const STATUS_FOR = { decision: 'current', commitment: 'open', question: 'unresolved', fact: 'current' };
  const COUNTS = [['decisions', 'decision', 'decision'], ['actions', 'commitment', 'action'], ['questions', 'question', 'question'], ['facts', 'fact', 'fact']];

  const parts = () => AT.inspectorParts;

  const countsFor = (m) => {
    if (m.counts) return m.counts;
    const source = m.id === DATA.afterMeeting.meeting ? DATA.afterMeeting.candidates : [...(AT.state.review[m.id] || []), ...(AT.state.accepted[m.id] || [])];
    const n = (type) => source.filter((c) => c.type === type).length;
    return { decisions: n('decision'), actions: n('commitment'), questions: n('question'), facts: n('fact') };
  };

  const countChips = (counts) => COUNTS.filter(([key]) => counts[key])
    .map(([key, type, label]) => `<span class="chip a-count"><span class="ktype" data-type="${type}">${icon(type)}</span>${plural(counts[key], label)}</span>`).join('');

  const statusMarkup = (k) => (k.status === 'resolved' ? '<span class="status" data-s="completed">Resolved</span>' : Kit.status(k.status));

  AT.memoryItem = (k, s) => {
    const owner = k.owner ? `<span class="a-owner">${Kit.avatar(k.owner)}${esc(k.owner)}</span>` : '';
    const due = k.due ? `<span class="a-due">Due ${esc(k.due)}</span>` : '';
    const replaced = k.replaced
      ? `<div class="a-mem-replaced"><span class="superseded-text">${esc(k.replaced.split(' · ')[0])}</span><span class="faint">replaced ${esc(k.from)}</span></div>` : '';
    return `<li class="a-kitem${k.isNew ? ' is-new' : ''}" ${parts().evAttrs(s, k)}>${parts().kIcon(k.type)}<div class="a-kbody">`
      + `<p>${esc(k.text)}${k.isNew ? '<span class="a-new">New</span>' : ''}</p>`
      + `<div class="a-kmeta">${statusMarkup(k)}${owner}${due}${k.src ? Kit.source(k.src) : ''}</div>${replaced}</div></li>`;
  };

  const memoryFrom = (cand, m) => {
    const date = shortDate(m.day || m.date);
    return { id: cand.id, type: cand.type, text: cand.text, owner: cand.owner, due: cand.due, status: STATUS_FOR[cand.type], from: date, src: `${date} · ${cand.ev.t}`, isNew: true };
  };

  const summarizing = () => '<section class="a-sec"><div class="a-sec-head"><span class="t-eyebrow">Summary</span></div>'
    + '<div class="a-skeleton"><i class="shimmer"></i><i class="shimmer"></i><i class="shimmer"></i></div>'
    + '<p class="a-local"><span class="spinner a-spin-sm"></span>Preparing summary on this Mac…</p></section>';

  const summaryTab = (t) => {
    const m = t.meeting;
    if (t.kind === 'summarizing') return summarizing();
    const filed = m.items || (AT.state.accepted[m.id] || []).map((c) => memoryFrom(c, m));
    const filedMarkup = filed.length
      ? `<section class="a-sec"><div class="a-sec-head"><span class="t-eyebrow">Filed to memory</span><span class="spacer"></span><span class="faint num">${filed.length}</span></div><ul class="a-klist">${filed.map((k) => AT.memoryItem(k, t.series)).join('')}</ul></section>`
      : '';
    return `<section class="a-sec"><div class="a-sec-head"><span class="t-eyebrow">Summary</span><span class="spacer"></span><span class="a-local">${icon('lock', 'sm')}Made on this Mac</span></div>`
      + `<p class="a-summary selectable">${esc(m.summary || 'No summary for this meeting.')}</p><div class="a-counts">${countChips(countsFor(m))}</div></section>${filedMarkup}`;
  };

  const candActions = () => `<button class="btn sm tinted" data-act="cand-accept">${icon('check')}Accept</button>`
    + `<button class="btn sm plain" data-act="cand-correct">${icon('pencil')}Correct</button><span class="spacer"></span>`
    + `<button class="btn sm plain a-reject" data-act="cand-reject">${icon('x')}Reject</button>`;

  const candMarkup = (c) => {
    const owner = c.owner ? `<div class="a-cand-owner">${Kit.avatar(c.owner)}<span>${esc(c.owner)}</span>${c.due ? `<span class="a-sep">·</span><span class="faint">Due ${esc(c.due)}</span>` : ''}</div>` : '';
    const resolves = c.resolves ? `<div class="a-cand-resolves">${icon('check-circle')}<span>Resolves: ${esc(c.resolves)}</span></div>` : '';
    return `<article class="a-cand card" data-cand="${c.id}"><div class="a-cand-top">${Kit.ktype(c.type)}<span class="spacer"></span>${c.edited ? '<span class="a-edited">Edited</span>' : ''}</div>`
      + `<p class="a-cand-text" data-cand-text>${esc(c.text)}</p>${owner}${resolves}`
      + `<button class="a-quote" data-act="quote" data-t="${c.ev.t}"><span class="a-quote-text">“${esc(c.ev.quote)}”</span><span class="a-quote-who">${esc(c.ev.who)} · <span class="num">${c.ev.t}</span></span></button>`
      + `<div class="a-cand-actions" data-cand-actions>${candActions()}</div></article>`;
  };

  const reviewDone = (t) => {
    const n = (AT.state.accepted[t.meeting.id] || []).length;
    return `<div class="empty a-insp-empty a-done"><span class="a-empty-badge">${icon('check-circle', 'xl')}</span><h3>All reviewed</h3>`
      + `<p>${n ? `${plural(n, 'item')} went to ${esc(t.series.name)} memory.` : `Nothing new went to ${esc(t.series.name)} memory.`}</p>`
      + `<button class="btn tinted" data-act="open-series" data-series="${t.series.id}">Open ${esc(t.series.name)}</button></div>`;
  };

  const reviewTab = (t) => {
    const list = AT.state.review[t.meeting.id] || [];
    if (!list.length) return reviewDone(t);
    return `<div class="a-sec-head a-rev-head"><span class="t-eyebrow" id="revHead">Telu found ${plural(list.length, 'item')} to review</span><span class="spacer"></span>`
      + '<button class="btn sm plain" data-act="accept-all">Accept all</button></div>'
      + `<div class="a-cands" id="cands">${list.map(candMarkup).join('')}</div>`;
  };

  const lineMarkup = (l) => `<li class="a-tr-line${l.evidence ? ' is-evidence' : ''}${AT.state.highlight === l.t ? ' is-hit' : ''}" data-t="${l.t}">${Kit.avatar(l.who)}`
    + `<div class="a-tr-body"><div class="a-tr-who"><b>${esc(l.who)}</b><span class="num">${l.t}</span></div><p class="selectable">${esc(l.text)}</p></div></li>`;

  const transcriptMarkup = (lines) => {
    if (!lines.length) return `<div class="empty a-insp-empty"><span class="a-empty-badge">${icon('waveform', 'xl')}</span><h3>No transcript</h3><p>This meeting wasn’t recorded.</p></div>`;
    return `<div class="a-sec-head a-tr-head"><span class="t-eyebrow">Transcript</span><span class="spacer"></span><span class="a-local">${icon('lock', 'sm')}Transcribed on this Mac</span></div>`
      + `<ol class="a-tr">${lines.map(lineMarkup).join('')}</ol>`;
  };

  const docsTab = (t) => {
    const docs = t.meeting.docs || [];
    if (!docs.length) return `<div class="empty a-insp-empty"><span class="a-empty-badge">${icon('doc', 'xl')}</span><h3>No documents</h3><p>Nothing was attached to this meeting.</p></div>`;
    const row = (name) => {
      const meta = AT.docMeta(name);
      return `<div class="a-doc">${parts().safeBadge(name)}<div class="a-doc-body"><span class="truncate">${esc(name)}</span><small class="num">${esc(meta.ver)} · ${esc(meta.size)}</small></div>`
        + `<button class="btn sm plain icon" data-act="open-doc" data-name="${esc(name)}" data-tip="Open">${icon('arrow-up-right')}</button></div>`;
    };
    return `<div class="a-docs-head"><span class="t-eyebrow">Used in this meeting</span></div><div class="a-docs card">${docs.map(row).join('')}</div>`;
  };

  const PAST_TABS = {
    summary: summaryTab,
    review: reviewTab,
    docs: docsTab,
    transcript: (t) => transcriptMarkup(AT.transcriptFor(t.meeting.id))
  };

  const pastView = (t, { headerMarkup, metaText, dayText, timeText }) => {
    const m = t.meeting;
    const hasReview = Array.isArray(AT.state.review[m.id]);
    const pending = AT.pending(m.id);
    const wanted = AT.state.tab;
    const tab = PAST_TABS[wanted] && (wanted !== 'review' || hasReview) ? wanted : pending ? 'review' : 'summary';
    const badge = pending ? `<span class="badge a-badge-amber num" id="reviewBadge">${pending}</span>` : '';
    const tabs = [['summary', 'Summary'], hasReview ? ['review', `Review${badge}`] : null, ['docs', 'Docs'], ['transcript', 'Transcript']].filter(Boolean);
    const title = m.title || (t.ev && t.ev.title) || t.series.name;
    const when = m.ended ? `Ended ${m.ended}` : timeText(t);
    return headerMarkup(t, { title, n: m.n, meta: metaText([dayText(t), when, m.duration]) })
      + parts().segMarkup(tabs, tab) + `<div class="a-tab" id="inspTab">${PAST_TABS[tab](t)}</div>`;
  };

  const applyVerdict = (meetingId, cand, verdict) => {
    const { series: s, meeting: m } = AT.findMeeting(meetingId);
    AT.set({ review: { ...AT.state.review, [meetingId]: (AT.state.review[meetingId] || []).filter((c) => c.id !== cand.id) } });
    if (verdict !== 'accept') return;
    AT.set({ accepted: { ...AT.state.accepted, [meetingId]: [...(AT.state.accepted[meetingId] || []), cand] } });
    AT.mapSeries(s.id, (x) => ({
      ...x,
      memory: [...x.memory.map((k) => (cand.resolves && k.text === cand.resolves ? { ...k, status: 'resolved', resolvedBy: cand.id } : k)), memoryFrom(cand, m)]
    }));
  };

  const revertVerdict = (meetingId, cand, index, verdict) => {
    const list = [...(AT.state.review[meetingId] || [])];
    list.splice(Math.min(index, list.length), 0, cand);
    AT.set({ review: { ...AT.state.review, [meetingId]: list } });
    if (verdict !== 'accept') return;
    const { series: s } = AT.findMeeting(meetingId);
    AT.set({ accepted: { ...AT.state.accepted, [meetingId]: (AT.state.accepted[meetingId] || []).filter((c) => c.id !== cand.id) } });
    AT.mapSeries(s.id, (x) => ({
      ...x,
      memory: x.memory.filter((k) => k.id !== cand.id).map((k) => (k.resolvedBy === cand.id ? { ...k, status: 'unresolved', resolvedBy: null } : k))
    }));
  };

  const bump = (el) => {
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  };

  const syncReviewUI = (meetingId) => {
    const pending = AT.pending(meetingId);
    const badge = Kit.$('#reviewBadge');
    if (badge && pending) {
      badge.textContent = pending;
      bump(badge);
    } else if (badge) {
      badge.remove();
      if (AT.ui.seg) AT.ui.seg.set(AT.state.tab || 'review', { animate: true, silent: true });
    }
    const head = Kit.$('#revHead');
    if (head && pending) head.textContent = `Telu found ${plural(pending, 'item')} to review`;
    const ev = AT.eventForMeeting(meetingId);
    if (ev) AT.morphCard(ev.id);
    AT.updateCounts();
    if (['series', 'review'].includes(AT.state.view)) AT.renderMain({ keepScroll: true });
  };

  const showDone = (meetingId) => {
    if (!AT.inspectorShows(meetingId) || AT.pending(meetingId)) return;
    AT.set({ tab: 'review' });
    AT.switchTab('review');
  };

  const restoreUI = (meetingId, ids) => {
    if (AT.inspectorShows(meetingId)) {
      AT.set({ tab: 'review' });
      AT.renderInspector();
      ids.forEach((id) => {
        const card = Kit.$(`#cands [data-cand="${id}"]`);
        if (card) Kit.enterAnimated(card);
      });
    }
    syncReviewUI(meetingId);
  };

  const decide = (card, verdict) => {
    const m = AT.inspTarget().meeting;
    const list = AT.state.review[m.id] || [];
    const index = list.findIndex((c) => c.id === card.dataset.cand);
    if (index < 0) return;
    const cand = list[index];
    const s = AT.findMeeting(m.id).series;
    applyVerdict(m.id, cand, verdict);
    card.classList.add('is-leaving');
    Kit.removeAnimated(card).then(() => showDone(m.id));
    syncReviewUI(m.id);
    const undo = () => {
      revertVerdict(m.id, cand, index, verdict);
      restoreUI(m.id, [cand.id]);
    };
    const accepted = verdict === 'accept';
    Kit.toast(accepted ? `Added to ${esc(s.name)} memory` : 'Rejected — Telu won’t remember it', { icon: accepted ? 'check-circle' : 'x-circle', action: { label: 'Undo', onClick: undo } });
  };

  const acceptAll = () => {
    const m = AT.inspTarget().meeting;
    const list = [...(AT.state.review[m.id] || [])];
    if (!list.length) return;
    const s = AT.findMeeting(m.id).series;
    list.forEach((c) => applyVerdict(m.id, c, 'accept'));
    const cards = Kit.$$('#cands [data-cand]');
    cards.forEach((card, i) => setTimeout(() => Kit.removeAnimated(card), i * 45));
    setTimeout(() => showDone(m.id), cards.length * 45 + 260);
    syncReviewUI(m.id);
    const undo = () => {
      list.forEach((c, i) => revertVerdict(m.id, c, i, 'accept'));
      restoreUI(m.id, list.map((c) => c.id));
    };
    Kit.toast(`Added ${list.length} items to ${esc(s.name)} memory`, { icon: 'check-circle', action: { label: 'Undo', onClick: undo } });
  };

  const selectAll = (el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const selection = getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  };

  const endEdit = (card, value) => {
    const text = Kit.$('[data-cand-text]', card);
    text.contentEditable = 'false';
    text.classList.remove('is-editing');
    text.textContent = value;
    text.removeEventListener('keydown', onEditKey);
    Kit.$('[data-cand-actions]', card).innerHTML = candActions();
  };

  const saveCorrect = (card) => {
    const text = Kit.$('[data-cand-text]', card);
    const value = text.textContent.replace(/\s+/g, ' ').trim();
    const original = text.dataset.original;
    if (!value || value === original) return endEdit(card, original);
    const m = AT.inspTarget().meeting;
    AT.set({ review: { ...AT.state.review, [m.id]: AT.state.review[m.id].map((c) => (c.id === card.dataset.cand ? { ...c, text: value, edited: true } : c)) } });
    endEdit(card, value);
    const top = Kit.$('.a-cand-top', card);
    if (!Kit.$('.a-edited', top)) top.insertAdjacentHTML('beforeend', '<span class="a-edited">Edited</span>');
    AT.fx.fadeIn(Kit.$('.a-edited', top));
    Kit.toast('Correction saved — Telu keeps your wording', { icon: 'pencil' });
  };

  function onEditKey(event) {
    const card = event.target.closest('[data-cand]');
    if (event.key === 'Enter') {
      event.preventDefault();
      saveCorrect(card);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      endEdit(card, Kit.$('[data-cand-text]', card).dataset.original);
    }
  }

  const startCorrect = (card) => {
    const text = Kit.$('[data-cand-text]', card);
    if (text.isContentEditable) return;
    text.dataset.original = text.textContent;
    text.contentEditable = 'true';
    text.classList.add('is-editing');
    text.focus();
    selectAll(text);
    text.addEventListener('keydown', onEditKey);
    Kit.$('[data-cand-actions]', card).innerHTML = '<button class="btn sm primary" data-act="cand-save">Save</button>'
      + '<button class="btn sm plain" data-act="cand-cancel">Cancel</button><span class="spacer"></span><span class="a-keys-hint">↩ save · esc cancel</span>';
  };

  Object.assign(AT.actions, {
    'cand-accept': (el) => decide(el.closest('[data-cand]'), 'accept'),
    'cand-reject': (el) => decide(el.closest('[data-cand]'), 'reject'),
    'cand-correct': (el) => startCorrect(el.closest('[data-cand]')),
    'cand-save': (el) => saveCorrect(el.closest('[data-cand]')),
    'cand-cancel': (el) => {
      const card = el.closest('[data-cand]');
      endEdit(card, Kit.$('[data-cand-text]', card).dataset.original);
    },
    'accept-all': acceptAll,
    quote: (el) => {
      if (AT.ui.seg) AT.ui.seg.set('transcript', { animate: true, silent: true });
      AT.switchTab('transcript', { highlight: el.dataset.t });
    },
    'open-doc': (el) => Kit.toast(`Opening ${esc(el.dataset.name)} in Preview…`, { icon: 'doc' })
  });

  AT.review = { PAST_TABS, pastView, transcriptMarkup, countChips, statusMarkup };
})();
