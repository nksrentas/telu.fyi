(() => {
  const T = window.T;
  const D = T.doc;
  const U = T.util;
  const e = Kit.esc;

  D.countsChips = (m) => {
    if (m.candidates) {
      const pending = T.pendingOf(m);
      return pending ? `<span class="chip amber num">${pending} to review</span>` : `<span class="chip">${icon('check')}Reviewed</span>`;
    }
    const c = m.counts || {};
    const docs = m.docs ? m.docs.length : 0;
    return [c.decisions && U.plural(c.decisions, 'decision'), c.actions && U.plural(c.actions, 'action'), docs && U.plural(docs, 'doc')]
      .filter(Boolean)
      .map((p) => `<span class="chip">${p}</span>`)
      .join('');
  };
  const firstSentence = (text) => String(text || '').split(/(?<=\.)\s/)[0];
  const meetingSub = (m) => (m.movedFrom ? `from ${m.movedFrom}` : m.filedFrom ? `from ${m.filedFrom}` : m.n ? `#${m.n}` : '');
  const meetingHead = (m, open) => `<div class="mtg-head" data-act="toggle-meeting">
      <span class="grip" draggable="true" data-tip="Drag onto another series">${icon('grip')}</span>
      ${icon('chevron-right', `disclosure${open ? ' open' : ''}`)}
      <span class="mtg-date">${e(m.date)}</span>
      <span class="mtg-n num">${e([meetingSub(m), m.duration].filter(Boolean).join(' · '))}</span>
      <span class="mtg-line">${e(m.title ? `${m.title} — ${firstSentence(m.summary)}` : firstSentence(m.summary))}</span>
      <span class="mtg-counts">${D.countsChips(m)}</span>
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
  D.candRow = (c) => `<div class="cand" data-cid="${e(c.id)}" data-state="${c.state}">
      ${Kit.ktype(c.type)}
      <div class="cand-main"><div class="cand-text" ${c.state === 'editing' ? 'contenteditable="true" spellcheck="false"' : ''}>${e(c.text)}</div><div class="cand-meta">${candMeta(c)}</div></div>
      <div class="cand-actions">${CAND_ACTIONS[c.state](c)}</div>
    </div>`;
  D.reviewHead = (m) => (T.pendingOf(m)
    ? `<div class="review-head"><span class="review-note">${icon('eye')}Review what Telu found — only what you accept reaches Memory.</span><span class="spacer"></span>${T.pendingOf(m) > 1 ? `<button class="btn sm plain" data-act="accept-all">${icon('check')}Accept all</button>` : ''}</div>`
    : `<div class="review-head"><span class="review-note done">${icon('check-circle')}Reviewed — Memory is up to date.</span></div>`);
  const reviewInner = (m) => `${D.reviewHead(m)}<div class="cand-list">${m.candidates.map(D.candRow).join('')}</div>`;

  D.transcriptLines = (lines, t) => (lines.length
    ? lines.map((l) => `<div class="tl ${l.t === t ? 'hl' : ''}" data-t="${e(l.t)}"><time>${e(l.t)}</time><b>${e(l.who)}</b><p>${e(l.text)}</p></div>`).join('')
    : `<div class="drawer-empty">${icon('waveform', 'xl')}<p>No highlighted moments in this meeting.</p></div>`);

  D.meetingBody = (s, m, { surface = 'page' } = {}) => {
    const items = m.candidates ? [] : T.itemsOf(s, m);
    const knowledge = m.candidates
      ? `<div class="review" data-review="${e(m.id)}">${reviewInner(m)}</div>`
      : items.length ? `<div class="k-list">${items.map(kRow).join('')}</div>` : '';
    const inline = surface === 'peek'
      ? `<div class="collapsible collapsed pk-transcript"><div><div class="pk-tr-body">${D.transcriptLines(T.transcriptOf(s, m))}</div></div></div>`
      : '';
    return `<div class="mtg-body">
      ${m.summary ? `<p class="mtg-summary">${e(m.summary)}</p>` : ''}
      ${knowledge}
      ${m.docs && m.docs.length ? `<div class="mtg-docs">${m.docs.map((d) => D.docButton(d)).join('')}</div>` : ''}
      <div class="mtg-foot"><button class="btn sm" data-act="transcript">${icon('quote')}Open transcript</button><span class="mtg-local">${icon('lock', 'sm')}Transcribed on this Mac</span></div>
      ${inline}
    </div>`;
  };
  const cancelledRow = (m) => `<div class="mtg cancelled" id="m-${e(m.id)}" data-mid="${e(m.id)}" data-mark="${e(U.shortDate(m.date))}"><div class="mtg-head static">${icon('x-circle')}<span>${e(m.date)} — ${e(m.note || 'Cancelled')}</span></div></div>`;
  D.meetingMarkup = (s, m) => {
    if (m.status === 'cancelled') return cancelledRow(m);
    const open = !!T.state.expanded[m.id];
    return `<div class="mtg ${open ? 'open' : ''}" id="m-${e(m.id)}" data-mid="${e(m.id)}" data-mark="${e(U.shortDate(m.date))}">${meetingHead(m, open)}<div class="collapsible ${open ? '' : 'collapsed'}"><div>${D.meetingBody(s, m)}</div></div></div>`;
  };
  D.pastList = (s) => {
    const past = s.meetings.filter((m) => !U.isUpcoming(m));
    return past.length
      ? past.map((m) => D.meetingMarkup(s, m)).join('')
      : `<div class="past-empty">${icon('calendar')}<span>Meetings file themselves here once they end.</span></div>`;
  };
  D.earlierButton = (s) => {
    const n = Math.max(0, s.count - s.meetings.length);
    return n ? `<button class="btn sm plain show-earlier" data-act="earlier" data-n="${n}">${icon('chevron-down')}Show ${n} earlier meetings</button>` : '';
  };
  const pastMarkup = (s) => `<section class="doc-sec past" id="sec-past">
      <div class="sec-head"><span class="sec-eyebrow">Meetings</span><span class="sec-caption">Newest first · filed by Telu</span></div>
      <div class="past-list" id="pastList">${D.pastList(s)}</div>
      <div id="earlierSlot">${D.earlierButton(s)}</div>
    </section>`;
  D.docMarkup = (s) => `<article class="doc doc-surface" data-surface="page" data-sid="${e(s.id)}">${D.headerMarkup(s)}${D.purposeMarkup(s)}${D.memoryMarkup(s)}${D.nextMarkup(s, D.pageNextMeeting(s))}${pastMarkup(s)}</article>`;

  D.peekPastMarkup = (s, m) => {
    if (m.status === 'cancelled') {
      return `<section class="doc-sec pk-note" data-sid="${e(s.id)}" data-mid="${e(m.id)}"><div class="past-empty">${icon('x-circle')}<span>${e(m.note || 'Cancelled in Calendar')}. Nothing was recorded; open items carried forward to the next meeting.</span></div></section>`;
    }
    return `<section class="doc-sec pk-past mtg open" data-sid="${e(s.id)}" data-mid="${e(m.id)}"><div class="pk-past-head"><span class="sec-eyebrow">Summary</span><span class="spacer"></span><span class="mtg-counts">${D.countsChips(m)}</span></div>${D.meetingBody(s, m, { surface: 'peek' })}</section>`;
  };

  D.drawerTranscript = (s, m, t) => `<div class="drawer-head"><div class="drawer-titles"><h3>Transcript · ${e(m.date)}</h3><p>${e(s.name)}${m.n ? ` · #${m.n}` : ''}${m.duration ? ` · ${e(m.duration)}` : ''}</p></div><button class="btn sm icon plain" data-act="close-drawer" aria-label="Close">${icon('x')}</button></div>
    <div class="drawer-note">${icon('lock', 'sm')}Transcribed on this Mac${t ? ' · evidence highlighted' : ''}</div>
    <div class="drawer-body" id="drawerBody">${D.transcriptLines(T.transcriptOf(s, m), t)}</div>`;
  const infoRow = (label, value) => `<div class="info-row"><span class="info-label">${label}</span><span class="info-value">${value}</span></div>`;
  D.drawerInfo = (s) => `<div class="drawer-head"><div class="drawer-titles"><h3>${e(s.name || 'Untitled')}</h3><p>Living doc details</p></div><button class="btn sm icon plain" data-act="close-drawer" aria-label="Close">${icon('x')}</button></div>
    <div class="drawer-body info">
      ${infoRow('Rhythm', e(s.rule || 'Not set'))}
      ${infoRow('Calendar', s.source === 'calendar' ? `${e(s.calendar || 'Work')} · “${e(s.name)}”` : 'Not linked')}
      ${infoRow('Meetings', s.count ? `${s.count} since ${e(s.since)}` : 'None yet')}
      ${infoRow('Reference', s.docs.length ? U.plural(s.docs.length, 'file') : 'None')}
      ${infoRow('Memory', s.memory.length ? `${U.plural(s.memory.length, 'accepted item')}` : 'Empty')}
      <div class="info-people">${s.people.map((p) => `<div class="info-person">${Kit.avatar(p, 'lg')}<span>${e(p)}</span></div>`).join('') || '<span class="faint">No attendees yet</span>'}</div>
      <div class="info-local">${icon('lock', 'sm')}Stored on this Mac. Transcription and summaries run locally.</div>
    </div>`;
})();
