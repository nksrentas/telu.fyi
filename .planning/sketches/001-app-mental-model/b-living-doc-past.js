(() => {
  const e = Kit.esc;
  const isPending = (c) => c.state === 'pending' || c.state === 'editing';
  const pendingOf = (m) => (m.candidates ? m.candidates.filter(isPending).length : 0);

  const countsChips = (m) => {
    if (m.candidates) {
      const pending = pendingOf(m);
      return pending ? `<span class="chip amber">${pending} to review</span>` : `<span class="chip">${icon('check')}Reviewed</span>`;
    }
    const c = m.counts || {};
    const docs = m.docs ? m.docs.length : 0;
    return [c.decisions && LD.plural(c.decisions, 'decision'), c.actions && LD.plural(c.actions, 'action'), docs && LD.plural(docs, 'doc')]
      .filter(Boolean)
      .map((p) => `<span class="chip">${p}</span>`)
      .join('');
  };
  const firstSentence = (text) => String(text || '').split(/(?<=\.)\s/)[0];
  const meetingSub = (m) => (m.movedFrom ? `from ${m.movedFrom}` : m.filedFrom ? `from ${m.filedFrom}` : m.n ? `#${m.n}` : '');
  const meetingHead = (m, open) => `<div class="mtg-head" data-act="toggle-meeting">
      <span class="grip" draggable="true" data-tip="Drag onto another doc">${icon('grip')}</span>
      ${icon('chevron-right', `disclosure${open ? ' open' : ''}`)}
      <span class="mtg-date">${e(m.date)}</span>
      <span class="mtg-n num">${e([meetingSub(m), m.duration].filter(Boolean).join(' · '))}</span>
      <span class="mtg-line">${e(m.title ? `${m.title} — ${firstSentence(m.summary)}` : firstSentence(m.summary))}</span>
      <span class="mtg-counts">${countsChips(m)}</span>
      <button class="btn sm icon plain mtg-more" data-act="meeting-menu" aria-label="More">${icon('ellipsis')}</button>
    </div>`;

  const kRow = (it) => `<div class="k-row">${Kit.ktype(it.type)}<span class="k-text ${it.status === 'superseded' ? 'superseded-text' : ''}">${e(it.text)}</span><span class="k-side">${it.owner ? Kit.avatar(it.owner) : ''}${Kit.status(it.status)}${Kit.source(it.src)}</span></div>`;
  const candSource = (c) => `<button class="source" data-cand="${e(c.id)}">${icon('quote')}${e(c.ev.t)}</button>`;
  const CAND_ACTIONS = {
    pending: () => `<button class="btn sm tinted" data-act="accept">${icon('check')}Accept</button><button class="btn sm" data-act="correct">Correct</button><button class="btn sm icon plain" data-act="reject" data-tip="Reject">${icon('x')}</button>`,
    editing: () => '<button class="btn sm primary" data-act="save-correct">Save</button><button class="btn sm plain" data-act="cancel-correct">Cancel</button>',
    accepted: (c) => `<span class="cand-done">${icon('check-circle')}${c.corrected ? 'Corrected · in Memory' : 'In Memory'}</span>`,
    rejected: () => '<span class="cand-rejected">Rejected</span><button class="btn sm plain" data-act="undo-reject">Undo</button>'
  };
  const candMeta = (c) => [
    c.owner ? `<span class="owner">${Kit.avatar(c.owner)}${e(c.owner)}</span>` : '',
    c.due ? `<span>Due ${e(c.due)}</span>` : '',
    c.resolves ? '<span>Resolves an open question</span>' : '',
    candSource(c)
  ].join('');
  const candRow = (c) => `<div class="cand" data-cid="${e(c.id)}" data-state="${c.state}">
      ${Kit.ktype(c.type)}
      <div class="cand-main"><div class="cand-text" ${c.state === 'editing' ? 'contenteditable="true" spellcheck="false"' : ''}>${e(c.text)}</div><div class="cand-meta">${candMeta(c)}</div></div>
      <div class="cand-actions">${CAND_ACTIONS[c.state](c)}</div>
    </div>`;
  const reviewHead = (m) => (pendingOf(m)
    ? `<div class="review-head"><span class="review-note">${icon('eye')}Review what Telu found — only what you accept reaches Memory.</span><span class="spacer"></span>${pendingOf(m) > 1 ? `<button class="btn sm plain" data-act="accept-all">${icon('check')}Accept all</button>` : ''}</div>`
    : `<div class="review-head"><span class="review-note done">${icon('check-circle')}Reviewed — Memory is up to date.</span></div>`);
  const reviewInner = (m) => `${reviewHead(m)}<div class="cand-list">${m.candidates.map(candRow).join('')}</div>`;

  const meetingBody = (s, m) => {
    const items = m.candidates ? [] : LD.itemsOf(s, m);
    const knowledge = m.candidates
      ? `<div class="review" id="review-${e(m.id)}">${reviewInner(m)}</div>`
      : items.length ? `<div class="k-list">${items.map(kRow).join('')}</div>` : '';
    return `<div class="mtg-body">
      ${m.summary ? `<p class="mtg-summary">${e(m.summary)}</p>` : ''}
      ${knowledge}
      ${m.docs && m.docs.length ? `<div class="mtg-docs">${m.docs.map((d) => LD.docButton(d)).join('')}</div>` : ''}
      <div class="mtg-foot"><button class="btn sm" data-act="transcript">${icon('quote')}Open transcript</button><span class="mtg-local">${icon('lock', 'sm')}Transcribed on this Mac</span></div>
    </div>`;
  };
  const cancelledRow = (m) => `<div class="mtg cancelled" id="m-${e(m.id)}" data-mid="${e(m.id)}" data-mark="${e(LD.shortDate(m.date))}"><div class="mtg-head static">${icon('x-circle')}<span>${e(m.date)} — ${e(m.note || 'Cancelled')}</span></div></div>`;
  const meetingMarkup = (s, m) => {
    if (m.status === 'cancelled') return cancelledRow(m);
    const open = !!LD.state.expanded[m.id];
    return `<div class="mtg ${open ? 'open' : ''}" id="m-${e(m.id)}" data-mid="${e(m.id)}" data-mark="${e(LD.shortDate(m.date))}">${meetingHead(m, open)}<div class="collapsible ${open ? '' : 'collapsed'}"><div>${meetingBody(s, m)}</div></div></div>`;
  };
  const pastList = (s) => {
    const past = s.meetings.filter((m) => !LD.isUpcoming(m));
    return past.length
      ? past.map((m) => meetingMarkup(s, m)).join('')
      : `<div class="past-empty">${icon('calendar')}<span>Meetings file themselves here once they end.</span></div>`;
  };
  const earlierButton = (s) => {
    const n = Math.max(0, s.count - s.meetings.length);
    return n ? `<button class="btn sm plain show-earlier" data-act="earlier" data-n="${n}">${icon('chevron-down')}Show ${n} earlier meetings</button>` : '';
  };
  const pastMarkup = (s) => `<section class="doc-sec past" id="sec-past">
      <div class="sec-head"><span class="sec-eyebrow">Meetings</span><span class="sec-caption">Newest first · filed by Telu</span></div>
      <div class="past-list" id="pastList">${pastList(s)}</div>
      <div id="earlierSlot">${earlierButton(s)}</div>
    </section>`;
  const docMarkup = (s) => `<article class="doc" data-sid="${e(s.id)}">${LD.headerMarkup(s)}${LD.purposeMarkup(s)}${LD.memoryMarkup(s)}${LD.nextMarkup(s)}${pastMarkup(s)}</article>`;

  Object.assign(LD, { pendingOf, countsChips, meetingMarkup, candRow, reviewHead, pastList, earlierButton, docMarkup });
})();
