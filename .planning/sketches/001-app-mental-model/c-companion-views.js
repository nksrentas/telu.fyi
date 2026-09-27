CC.views = (() => {
  const { $, esc } = Kit;
  const pv = { saveTimer: null, root: null, bumped: false, cardEditing: null, cardOriginal: '', decidedAt: 0 };
  const detail = () => $('#cmdkDetail');
  const SEEN = new Set();
  const arrival = (key, fresh) => {
    if (!fresh || SEEN.has(key)) return '';
    SEEN.add(key);
    return ' receive';
  };
  const faces = (names, max = 4) => Kit.avatars(names.map(esc), max);
  const section = (title, body, attrs = '') => `<section class="dt-sec"${attrs}><div class="dt-h">${title}</div>${body}</section>`;
  const backLink = (label) => `<button class="dt-back" data-act="back">${icon('chevron-left', 'sm')}${esc(label)}</button>`;
  const emptyLine = (text) => `<div class="dt-empty">${esc(text)}</div>`;
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const dateLabel = (m) => (m.date === 'Today' ? 'Today' : m.date);
  const bumpEl = (el) => {
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  };
  function placeCaretAtEnd(node) {
    const range = document.createRange();
    range.selectNodeContents(node);
    range.collapse(false);
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function parsedChips(p) {
    const when = [p.day, p.time].filter(Boolean).join(' ');
    const parts = [p.cadence === 'One-off' ? 'No fixed rhythm' : p.cadence, when, p.people.length ? `with ${p.people.join(', ')}` : ''];
    return parts.filter(Boolean).map((t) => `<span class="chip">${esc(t)}</span>`).join('');
  }
  function parsedPreview(p) {
    const people = p.people.map(CC.matchPerson);
    return `<div class="pp">${icon('sparkles')}<b class="truncate">${esc(p.title)}</b>${parsedChips({ ...p, people })}</div>`;
  }

  function memRow(m, s) {
    const replaced = m.replaced ? `<div class="mem-replaced">Replaces <span class="superseded-text">${esc(m.replaced.split(' · ')[0])}</span> · ${esc(m.replaced.split(' · ')[1] || '')}</div>` : '';
    const meta = [CC.statusChip(m.status), m.owner ? `<span>${esc(m.owner)}</span>` : '', m.due ? `<span>due ${esc(m.due)}</span>` : '', m.from ? `<span>since ${esc(m.from)}</span>` : ''].filter(Boolean).join('');
    return `<div class="mem-row${arrival(`${s.id}:${m.text}`, m.fresh)}">${CC.kIcon(m.type)}<div class="mem-main"><div class="mem-text${m.status === 'superseded' ? ' superseded-text' : ''}">${esc(m.text)}</div>${replaced}<div class="mem-meta">${meta}</div></div>${CC.src(m.src, { type: m.type, text: m.text, owner: m.owner, seriesId: s.id })}</div>`;
  }
  function seriesHead(s) {
    const link = s.calendar
      ? `<button class="chip outline dt-link" data-act="calendar" data-id="${s.id}">${icon('calendar')}Calendar · ${esc(s.calendar)}</button>`
      : `<span class="chip dashed">${icon('pencil')}Added by you</span>`;
    const history = s.count ? `${s.count} meetings since ${s.since}` : 'New series';
    return `<header class="dt-head tall">${Kit.seriesIcon(s, 'lg')}<div class="dt-titles"><div class="dt-title-row"><h2 class="dt-title truncate">${esc(s.name)}</h2>${faces(s.people)}</div><div class="dt-sub muted"><span class="truncate">${esc(s.rule)}</span></div><div class="dt-chips"><span class="chip">${icon('repeat')}${esc(s.cadence)}</span>${link}<span class="t-caption truncate">${esc(history)}</span></div></div></header>`;
  }
  const puLines = (arr) => (arr.length ? arr : ['']).map((t) => `<div>${esc(t) || '<br>'}</div>`).join('');
  const agendaLines = (arr, editing) => (arr.length ? arr : [{ t: '', d: '' }]).map((a) => {
    if (!a.t) return '<div><br></div>';
    const d = a.d ? (editing ? ` · ${esc(a.d)}` : `<span class="faint"> · ${esc(a.d)}</span>`) : '';
    return `<div>${esc(a.t)}${d}</div>`;
  }).join('');
  function purposeFields(p, editing) {
    const ce = editing ? ' contenteditable="true" spellcheck="false"' : '';
    return `<div class="pu-h">Why we meet</div><div class="pu-b" data-field="why" data-ph="Why does this conversation exist?"${ce}>${esc(p.why)}</div>
      <div class="pu-h">What good looks like</div><div class="pu-b pu-list" data-field="outcomes"${ce}>${puLines(p.outcomes)}</div>
      <div class="pu-h">Standing agenda</div><div class="pu-b pu-list pu-agenda" data-field="agenda"${ce}>${agendaLines(p.agenda, editing)}</div>
      <div class="pu-h">Not for this meeting</div><div class="pu-b" data-field="notFor" data-ph="What belongs somewhere else?"${ce}>${esc(p.notFor)}</div>`;
  }
  function purposeEmpty(s) {
    return `<div class="pu-empty">${icon('target')}<div><b>No purpose yet</b><p>Why does ${esc(s.name)} exist? Telu uses the purpose to shape every brief — and drafts one after the first meeting if you don’t.</p></div><button class="btn sm tinted" data-act="purpose-edit" data-id="${s.id}">Write it<span class="kbd">⌘E</span></button></div>`;
  }
  function purposeBlock(s, editing) {
    const p = s.purpose;
    const empty = !p.why && !p.outcomes.length && !p.agenda.length && !p.notFor;
    const state = editing ? '<span class="pu-state" data-pu-state>Editing</span>' : `<span class="pu-state">Edited ${esc(p.edited)} by ${esc(p.by)}</span>`;
    const edit = empty ? '' : `<button class="btn sm" data-act="purpose-edit" data-id="${s.id}">${icon('pencil')}Edit<span class="kbd">⌘E</span></button>`;
    const button = editing ? '<button class="btn sm primary" data-act="purpose-done">Done</button>' : edit;
    return `<section class="pu${editing ? ' editing' : ''}" data-sid="${s.id}">
      <header class="pu-head"><span class="dt-h">Purpose</span><button class="chip pu-ver" data-act="purpose-history">v${p.version}</button>${state}<span class="spacer"></span>${button}</header>
      ${empty && !editing ? purposeEmpty(s) : purposeFields(p, editing)}
    </section>`;
  }
  function meetingChip(m) {
    const st = CC.get();
    if (m.id === 'ps-37' && st.phase === 'live') return '<span class="chip coral">Recording</span>';
    if (st.review.meetingId === m.id && CC.pending()) return `<span class="chip amber">${CC.pending()} to review</span>`;
    if (m.status === 'upcoming') return m.brief ? '<span class="chip accent">Brief ready</span>' : '<span class="chip outline">Upcoming</span>';
    if (m.status === 'preparing') return '<span class="chip">Preparing</span>';
    if (m.status === 'cancelled') return '<span class="chip outline">Cancelled</span>';
    const c = m.counts;
    return c ? `<span class="faint mt-counts">${plural(c.decisions, 'decision', 'decisions')} · ${plural(c.actions, 'action', 'actions')}</span>` : '';
  }
  function meetingRow(m) {
    const when = m.title ? `${dateLabel(m)} · ${m.time}` : m.time;
    const n = m.n ? `#${m.n}` : icon('waveform', 'sm');
    return `<button class="mt-row" data-act="open-meeting" data-id="${m.id}"><span class="mt-n num">${n}</span><span class="mt-date truncate">${esc(m.title || dateLabel(m))}</span><span class="muted num truncate">${esc(when)}</span><span class="spacer"></span>${meetingChip(m)}${icon('chevron-right', 'sm mt-chev')}</button>`;
  }
  function seriesView(t, ctx) {
    const s = CC.seriesById(t.id);
    if (!s) return missing();
    const editing = ctx.editing === s.id;
    const memory = s.memory.length ? `<div class="mem">${s.memory.map((m) => memRow(m, s)).join('')}</div>` : emptyLine('Nothing remembered yet — Telu fills this in after the first meeting.');
    const meetings = s.meetings.length ? `<div class="mt-list">${s.meetings.map(meetingRow).join('')}</div>` : emptyLine(`First meeting: ${s.next}. Telu prepares the brief the evening before.`);
    return {
      sig: `series:${JSON.stringify(s)}:${editing}:${ctx.back || ''}:${CC.pending()}`,
      html: `${ctx.back ? backLink(ctx.back) : ''}${seriesHead(s)}<div class="dt-body">${purposeBlock(s, editing)}${section(`Memory <span class="faint">${s.memory.length}</span>`, memory)}${section(`Meetings <span class="faint">${s.meetings.length}</span>`, meetings)}</div>`,
      mount: (el) => editing && focusPurpose(el)
    };
  }

  function carryRow(c, s) {
    const meta = [CC.statusChip(c.status), c.owner ? `<span>${esc(c.owner)}</span>` : '', c.note ? `<span>${esc(c.note)}</span>` : ''].filter(Boolean).join('');
    return `<div class="mem-row">${CC.kIcon(c.type)}<div class="mem-main"><div class="mem-text">${esc(c.text)}</div><div class="mem-meta">${meta}</div></div>${CC.src(c.src, { type: c.type, text: c.text, owner: c.owner, seriesId: s.id })}</div>`;
  }
  const askRow = (a, s) => `<div class="mem-row ask-row"><span class="ask-ico">${icon('sparkle')}</span><div class="mem-main"><div class="mem-text">${esc(a.text)}</div></div>${CC.src(a.src, { type: 'question', text: a.text, seriesId: s.id })}</div>`;
  const agRow = (a) => `<div class="ag-row${a.mine ? ' mine' : ''}"><span class="ag-t truncate">${esc(a.t)}</span>${a.added ? `<span class="chip ag-telu">${icon('sparkles')}Added by Telu</span>` : ''}<span class="spacer"></span><span class="faint num">${esc(a.d)}</span></div>`;
  function docRow(d, m) {
    return `<div class="doc-row${arrival(`${m.id}:${d.name}`, d.fresh)}">${Kit.fileBadge(d.name)}<div class="doc-main"><button class="doc-link truncate" data-act="open-doc" data-name="${esc(d.name)}">${esc(d.name)}</button><span class="t-caption truncate">${esc(d.meta)}</span></div><span class="t-caption doc-inc">${d.include ? 'In the brief' : 'Not included'}</span><button class="switch" data-doc="${esc(d.name)}" data-meeting="${m.id}" aria-checked="${d.include}" aria-label="Include ${esc(d.name)} in the brief"></button></div>`;
  }
  function briefBody(s, m) {
    const b = m.brief;
    const included = b.docs.filter((d) => d.include).length;
    const preparing = m.status === 'preparing' ? `<div class="dt-banner"><span class="shimmer dt-shim"></span>Telu is still preparing this brief — it keeps updating until ${CC.startOf(m)}.</div>` : '';
    return `${preparing}
      ${section('Since last time', b.carry.map((c) => carryRow(c, s)).join(''))}
      ${b.ask.length ? section(`<span class="dt-mint">${icon('sparkle')}Worth asking</span>`, b.ask.map((a) => askRow(a, s)).join('')) : ''}
      ${section('Agenda', `<div class="ag-list">${b.agenda.map(agRow).join('')}</div><label class="ag-add">${icon('plus', 'sm')}<input class="ag-input" data-meeting="${m.id}" maxlength="80" placeholder="Add to the agenda" autocomplete="off" spellcheck="false"></label>`)}
      ${section(`Docs <span class="faint" data-doc-count>${included} in the brief</span>`, `<div class="doc-list">${b.docs.map((d) => docRow(d, m)).join('')}</div><div class="dt-drop">${icon('paperclip', 'sm')}Drop a file on the Island to attach it</div>`, ' data-sec="docs"')}`;
  }
  function knowledgeRow(k, s) {
    const meta = [CC.statusChip(k.status), k.owner ? `<span>${esc(k.owner)}</span>` : '', k.due ? `<span>due ${esc(k.due)}</span>` : ''].filter(Boolean).join('');
    return `<div class="mem-row">${CC.kIcon(k.type)}<div class="mem-main"><div class="mem-text">${esc(k.text)}</div><div class="mem-meta">${meta}</div></div>${CC.src(k.src, { type: k.type, text: k.text, owner: k.owner, seriesId: s.id })}</div>`;
  }
  function reviewBanner(m) {
    const st = CC.get();
    if (st.review.meetingId !== m.id || !CC.pending()) return '';
    return `<div class="dt-banner amber">${icon('tray')}<span><b>${CC.pending()} to review.</b> Telu filed what it heard — confirm it in about 30 seconds.</span><span class="spacer"></span><button class="btn sm primary" data-act="open-review">Review</button></div>`;
  }
  function pastBody(s, m) {
    if (m.status === 'cancelled') return `<div class="dt-body">${emptyLine(m.note || 'Cancelled in Calendar')}</div>`;
    const items = m.items && m.items.length ? m.items.map((k) => knowledgeRow(k, s)).join('') : m.counts ? `<div class="dt-empty">${plural(m.counts.decisions, 'decision', 'decisions')} · ${plural(m.counts.actions, 'action', 'actions')} · ${plural(m.counts.questions, 'open question', 'open questions')}</div>` : emptyLine('Nothing filed yet.');
    const docs = (m.docs || []).length ? `<div class="doc-chips">${m.docs.map((d) => `<button class="doc-btn" data-act="open-doc" data-name="${esc(d)}">${Kit.docChip(d)}</button>`).join('')}</div>` : emptyLine('No docs attached.');
    const transcript = (m.transcript || []).length ? `<div class="tr">${m.transcript.map((l) => `<div class="tr-line" data-t="${l.t}"><span class="tr-t num">${l.t}</span><span class="tr-who">${esc(l.who)}</span><span class="tr-text">${esc(l.text)}</span></div>`).join('')}</div>` : emptyLine('No transcript — recorded before Telu kept one.');
    return `${reviewBanner(m)}
      ${m.summary ? section('Summary', `<p class="dt-summary">${esc(m.summary)}</p>`) : ''}
      ${section('Filed from this meeting', items)}
      ${section('Docs', docs, ' data-sec="docs"')}
      ${section('Transcript', transcript)}`;
  }
  function meetingActions(m) {
    const st = CC.get();
    if (m.id === 'ps-37' && st.phase === 'live') return `<span class="chip coral"><span class="rec-dot"></span><span class="num" data-elapsed>${CC.formatElapsed(CC.elapsed())}</span></span><button class="btn sm" data-act="stop">Stop</button>`;
    if (st.review.meetingId === m.id && CC.pending()) return `<button class="btn sm primary" data-act="open-review">Review ${CC.pending()}</button>`;
    if (m.id === 'ps-37' && CC.canRecord()) return `<button class="btn sm record" data-act="record">${icon('record')}Record<span class="kbd">⌥⌘R</span></button>`;
    return meetingChip(m);
  }
  function meetingView(t, ctx) {
    const hit = CC.findMeeting(t.id);
    if (!hit) return missing();
    const { series: s, meeting: m } = hit;
    const upcoming = m.brief && m.status !== 'done';
    const where = [dateLabel(m), m.time, m.where, m.duration].filter(Boolean).map(esc).join(' · ');
    const head = `<header class="dt-head">${Kit.seriesIcon(s, 'lg')}<div class="dt-titles"><h2 class="dt-title truncate">${esc(m.title || s.name)}${m.n ? ` <span class="faint">#${m.n}</span>` : ''}</h2><div class="dt-sub muted num">${where}</div></div><div class="dt-actions">${meetingActions(m)}</div></header>`;
    return {
      sig: `meeting:${JSON.stringify(m)}:${CC.get().phase}:${CC.pending()}:${ctx.back || ''}`,
      html: `${ctx.back ? backLink(ctx.back) : ''}${head}<div class="dt-body">${upcoming ? briefBody(s, m) : pastBody(s, m)}</div>`
    };
  }

  function progressText(r) {
    return `${Math.min(r.verdicts.length + 1, r.items.length)} of ${r.items.length}`;
  }
  function dotsHtml(r) {
    return r.items.map((k, i) => {
      const v = r.verdicts.find((x) => x.id === k.id);
      const cls = v ? (v.verdict === 'accepted' ? 'a' : 'r') : i === r.verdicts.length ? 'now' : '';
      return `<i class="${cls}"></i>`;
    }).join('');
  }
  function cardHtml(k, pos) {
    const owner = k.owner ? `<div class="rv-owner">${Kit.avatar(k.owner)}<span>${esc(k.owner)}</span>${k.due ? `<span class="faint">· due ${esc(k.due)}</span>` : ''}</div>` : '';
    const resolves = k.resolves ? `<div class="rv-resolves">${icon('check-circle', 'sm')}<span>Resolves <span class="superseded-text">${esc(k.resolves)}</span></span></div>` : '';
    return `<article class="rv-card" data-id="${k.id}" data-pos="${pos}">
      <div class="rv-top">${Kit.ktype(k.type)}<span class="spacer"></span><span class="t-caption num">Heard at ${k.ev.t}</span></div>
      <div class="rv-text" data-rv-text>${esc(k.text)}</div>${owner}${resolves}
      <blockquote class="rv-quote"><p>“${esc(k.ev.quote)}”</p><footer>${Kit.avatar(k.ev.who)}<span>${esc(k.ev.who)}</span><span class="faint num">· ${k.ev.t}</span></footer></blockquote>
      <div class="rv-actions"><button class="btn" data-act="rv-reject">${icon('x')}Reject<span class="kbd">⌫</span></button><button class="btn" data-act="rv-edit">${icon('pencil')}Edit<span class="kbd">E</span></button><span class="spacer"></span><button class="btn primary" data-act="rv-accept">${icon('check')}Accept<span class="kbd">↵</span></button></div>
    </article>`;
  }
  function doneHtml(r) {
    const accepted = r.verdicts.filter((v) => v.verdict === 'accepted');
    const edited = accepted.filter((v) => v.edited).length;
    const s = CC.seriesById(r.seriesId);
    const name = s ? s.name : r.title;
    return `<div class="rv-check">${icon('check')}</div><h3>All filed</h3>
      <p>${esc(name)} memory updated — ${accepted.length} accepted${edited ? ` (${edited} edited)` : ''}, ${r.verdicts.length - accepted.length} rejected.</p>
      <div class="rv-done-actions">${s ? `<button class="btn" data-act="open-series" data-id="${s.id}">Open ${esc(name)}</button>` : ''}<button class="btn primary" data-act="rv-close">Done</button></div>`;
  }
  function reviewView() {
    const r = CC.get().review;
    const hit = CC.findMeeting(r.meetingId);
    const remaining = r.items.filter((k) => !r.verdicts.some((v) => v.id === k.id));
    const meta = hit ? `${esc(hit.series.name)} #${hit.meeting.n} · ${esc(dateLabel(hit.meeting))}${hit.meeting.duration ? ` · ${esc(hit.meeting.duration)}` : ''}` : '';
    return {
      sig: `review:${r.key}`,
      html: `<div class="rv">
        <header class="rv-head"><div class="dt-titles"><div class="dt-h">Review</div><h2 class="dt-title">${esc(r.title)}</h2><div class="muted">${meta}</div></div><div class="rv-progress"><span class="num" data-rv-count>${progressText(r)}</span><span class="rv-dots" data-rv-dots>${dotsHtml(r)}</span></div></header>
        <div class="rv-stack" tabindex="-1" data-autofocus>${remaining.map((k, i) => cardHtml(k, Math.min(i, 3))).join('')}</div>
        <div class="rv-done${remaining.length ? '' : ' show'}"${remaining.length ? ' hidden' : ''}>${doneHtml(r)}</div>
      </div>`
    };
  }
  function restack(stack) {
    [...stack.querySelectorAll('.rv-card')].filter((c) => /^\d$/.test(c.dataset.pos)).forEach((c, i) => { c.dataset.pos = String(Math.min(i, 3)); });
  }
  function updateProgress() {
    const r = CC.get().review;
    const root = detail();
    const count = $('[data-rv-count]', root);
    if (count) count.textContent = CC.pending() ? progressText(r) : `${r.items.length} of ${r.items.length}`;
    const dots = $('[data-rv-dots]', root);
    if (dots) dots.innerHTML = dotsHtml(r);
  }
  function showDone() {
    const done = $('.rv-done', detail());
    if (!done) return;
    done.innerHTML = doneHtml(CC.get().review);
    setTimeout(() => {
      done.hidden = false;
      requestAnimationFrame(() => done.classList.add('show'));
      $('.rv-stack', detail()).classList.add('empty');
    }, 220);
  }
  function readCardEdit(front) {
    const text = $('[data-rv-text]', front);
    text.removeAttribute('contenteditable');
    front.classList.remove('editing');
    return text.innerText.replace(/\s+/g, ' ').trim().slice(0, 240);
  }
  function focusStack() {
    const stack = $('.rv-stack', detail());
    if (stack) stack.focus({ preventScroll: true });
  }
  function decideFront(verdict) {
    const stack = $('.rv-stack', detail());
    const front = stack && $('.rv-card[data-pos="0"]', stack);
    if (!front) return;
    const text = pv.cardEditing === front ? readCardEdit(front) : undefined;
    pv.cardEditing = null;
    front.dataset.pos = verdict === 'accepted' ? 'accept' : 'reject';
    restack(stack);
    setTimeout(() => front.remove(), Kit.reduceMotion() ? 0 : 260);
    pv.decidedAt = Date.now();
    CC.decide(front.dataset.id, verdict, text);
    updateProgress();
    if (!CC.pending()) showDone();
    focusStack();
  }
  function editFront() {
    const front = $('.rv-stack .rv-card[data-pos="0"]', detail());
    if (!front || pv.cardEditing === front) return;
    const text = $('[data-rv-text]', front);
    pv.cardEditing = front;
    pv.cardOriginal = text.textContent;
    front.classList.add('editing');
    text.setAttribute('contenteditable', 'true');
    text.focus({ preventScroll: true });
    placeCaretAtEnd(text);
  }
  function cancelCardEdit() {
    const front = pv.cardEditing;
    if (!front || !front.isConnected) {
      pv.cardEditing = null;
      return false;
    }
    $('[data-rv-text]', front).textContent = pv.cardOriginal;
    readCardEdit(front);
    pv.cardEditing = null;
    focusStack();
    return true;
  }
  function reviewKey(event) {
    const key = event.key;
    if (!$('.rv-stack .rv-card[data-pos="0"]', detail())) {
      if (key !== 'Enter' || Date.now() - pv.decidedAt < 700) return;
      event.preventDefault();
      CC.palette.close();
      return;
    }
    if (key === 'Enter') decideFront('accepted');
    else if (key === 'Backspace' || key === 'Delete') decideFront('rejected');
    else if (key === 'e' || key === 'E') editFront();
    else if (key !== 'ArrowDown' && key !== 'ArrowUp') return;
    event.preventDefault();
  }

  function proposalRow(p) {
    const target = p.target ? CC.seriesById(p.target) : null;
    const actions = p.kind === 'join'
      ? [['accept', `Add to ${target ? target.name : 'series'}`], ['decline', 'Keep separate']]
      : p.quiet ? [['accept', 'Track anyway'], ['decline', 'Stop suggesting']] : [['accept', 'Remember as series'], ['decline', 'Not a series']];
    const lead = target ? Kit.seriesIcon(target) : `<span class="series-icon" style="--c:var(--series-gray)">${icon('repeat')}</span>`;
    const people = p.people ? `${faces(p.people, 3)}${p.extra ? `<span class="faint sg-extra">+${p.extra}</span>` : ''}` : '';
    const buttons = actions.map(([choice, label], i) => `<button class="btn sm${i === 0 && !p.quiet ? ' primary' : ''}" data-act="proposal" data-choice="${choice}">${esc(label)}</button>`).join('');
    return `<div class="sg-row card" data-pid="${p.id}"><div class="sg-top">${lead}<div class="sg-main"><b class="truncate">${esc(p.title)}</b><span class="muted truncate">${esc(p.rule || p.when)}${p.calendar ? ` · ${esc(p.calendar)}` : ''}</span></div>${people}</div><div class="sg-reason">${icon('sparkles', 'sm')}<span>${esc(p.reason)}</span></div><div class="sg-actions">${buttons}</div></div>`;
  }
  function caughtUp(text) {
    return `<div class="empty dt-caught">${icon('calendar-check', 'xl')}<h3>You’re all caught up</h3><p>${esc(text)}</p></div>`;
  }
  function suggestionsView() {
    const ps = CC.get().data.proposals;
    const intro = '<header class="dt-head plain"><div class="dt-titles"><h2 class="dt-title">From your calendar</h2><div class="dt-sub muted">Telu watches your Work calendar on this Mac and suggests — it never files anything without you.</div></div></header>';
    return { sig: `sugg:${ps.map((p) => p.id).join(',')}`, html: `${intro}<div class="dt-body sg-list">${ps.length ? ps.map(proposalRow).join('') : caughtUp('Telu will suggest new series when your calendar changes.')}</div>` };
  }
  function unfiledRow(u) {
    const target = CC.seriesById(u.suggestion.series);
    const lead = u.kind === 'recording' ? `<span class="uf-lead">${icon('waveform')}</span>` : `<span class="uf-lead">${Kit.fileBadge(u.title)}</span>`;
    const file = target ? `<button class="btn sm primary" data-act="file" data-sid="${target.id}">File to ${esc(target.name)}</button>` : '';
    return `<div class="sg-row card" data-uid="${u.id}"><div class="sg-top">${lead}<div class="sg-main"><b class="truncate">${esc(u.title)}</b><span class="muted">${esc(u.when)}${u.duration ? ` · ${esc(u.duration)}` : ''}</span></div></div><div class="sg-reason">${icon('sparkles', 'sm')}<span>Telu suggests <b>${esc(target ? target.name : '')}</b> — ${esc(u.suggestion.why)}</span></div><div class="sg-actions">${file}<button class="btn sm" data-act="file-choose">Choose…</button></div></div>`;
  }
  function unfiledView() {
    const us = CC.get().data.unfiled;
    const intro = '<header class="dt-head plain"><div class="dt-titles"><h2 class="dt-title">Unfiled</h2><div class="dt-sub muted">Recordings and docs Telu couldn’t place with confidence.</div></div></header>';
    return { sig: `unfiled:${us.map((u) => u.id).join(',')}`, html: `${intro}<div class="dt-body sg-list">${us.length ? us.map(unfiledRow).join('') : caughtUp('Everything has a home.')}</div>` };
  }

  function personView(t, ctx) {
    const st = CC.get();
    const name = t.id;
    const series = st.data.series.filter((s) => s.people.includes(name));
    const owes = st.data.series.flatMap((s) => s.memory.filter((m) => m.owner === name && m.status === 'open').map((m) => memRow(m, s)));
    const rows = series.map((s) => `<button class="mt-row" data-act="open-series" data-id="${s.id}">${Kit.seriesIcon(s)}<span class="truncate">${esc(s.name)}</span><span class="spacer"></span><span class="faint">${esc(s.cadence)}</span>${icon('chevron-right', 'sm mt-chev')}</button>`).join('');
    return {
      sig: `person:${name}:${series.length}:${owes.length}:${ctx.back || ''}`,
      html: `${ctx.back ? backLink(ctx.back) : ''}<header class="dt-head"><span class="dt-avatar">${Kit.avatar(esc(name), 'lg')}</span><div class="dt-titles"><h2 class="dt-title">${esc(name)}</h2><div class="dt-sub muted">In ${plural(series.length, 'series', 'series')}${owes.length ? ` · ${plural(owes.length, 'open commitment', 'open commitments')}` : ''}</div></div></header>
        <div class="dt-body">${section('Series', rows ? `<div class="mt-list">${rows}</div>` : emptyLine('Not in any tracked series yet.'))}${section('Open commitments', owes.length ? `<div class="mem">${owes.join('')}</div>` : emptyLine('Nothing open.'))}</div>`
    };
  }
  function docPlaces(name) {
    const places = [];
    CC.get().data.series.forEach((s) => {
      if (s.docs.some((d) => d.name === name)) places.push(`<button class="mt-row" data-act="open-series" data-id="${s.id}">${Kit.seriesIcon(s)}<span class="truncate">${esc(s.name)}</span><span class="spacer"></span><span class="faint">Series docs</span>${icon('chevron-right', 'sm mt-chev')}</button>`);
      s.meetings.forEach((m) => {
        const inBrief = m.brief && m.status !== 'done' && m.brief.docs.some((d) => d.name === name && d.include);
        if (inBrief || (m.docs || []).includes(name)) places.push(`<button class="mt-row" data-act="open-meeting" data-id="${m.id}">${Kit.seriesIcon(s)}<span class="truncate">${esc(m.title || s.name)} #${m.n}</span><span class="spacer"></span><span class="faint">${inBrief ? 'In the brief' : esc(dateLabel(m))}</span>${icon('chevron-right', 'sm mt-chev')}</button>`);
      });
    });
    return places;
  }
  function docView(t, ctx) {
    const places = docPlaces(t.id);
    return {
      sig: `doc:${t.id}:${places.length}:${ctx.back || ''}`,
      html: `${ctx.back ? backLink(ctx.back) : ''}<header class="dt-head"><span class="dt-doc">${Kit.fileBadge(t.id)}</span><div class="dt-titles"><h2 class="dt-title truncate">${esc(t.id)}</h2><div class="dt-sub muted">${icon('lock', 'sm')} Stored on this Mac</div></div></header><div class="dt-body">${section('Where it’s used', places.length ? `<div class="mt-list">${places.join('')}</div>` : emptyLine('Not attached anywhere yet.'))}</div>`
    };
  }

  const EXAMPLES = ['Weekly 1:1 with Priya, Thu 11am', 'Growth sync every other Wednesday at 3pm with Leo and Aisha', 'Monthly investor update first Friday 9'];
  const examples = () => `<div class="cp-examples">${EXAMPLES.map((q) => `<button class="cp-example" data-act="example" data-q="${esc(q)}">${icon('arrow-right', 'sm')}<span>${esc(q)}</span></button>`).join('')}</div>`;
  function createPreview(it) {
    const p = it.parsed;
    const people = p.people.length ? faces(p.people, 3) : '';
    return `<div class="cp"><div class="dt-h">New series</div><div class="cp-card card"><div class="cp-top"><span class="series-icon lg" style="--c:${CC.nextColor()}">${icon(p.people.length === 1 ? 'person' : 'people')}</span><div class="dt-titles"><h2 class="dt-title truncate">${esc(p.title)}</h2><div class="cp-chips">${parsedChips(p)}</div></div>${people}</div>
      <p class="cp-note">Telu prepares a brief before each meeting and drafts the purpose after the first one. You can rewrite it anytime with ⌘E.</p>
      <div class="cp-foot"><span class="t-caption">${icon('lock', 'sm')} Saved on this Mac</span><span class="spacer"></span><button class="btn primary" data-act="run">Create series<span class="kbd">↵</span></button></div></div></div>`;
  }
  function commandView(it) {
    if (it.cmd === 'create') return { sig: `cmd:${it.title}:${it.sub}`, html: createPreview(it) };
    if (it.cmd === 'create-help') return { sig: 'cmd:help', html: `<div class="cp"><div class="dt-h">Create a series</div><p class="cp-note">Describe it the way you’d say it — Telu works out the rhythm and the people.</p>${examples()}</div>` };
    if (it.cmd === 'purpose') {
      const s = CC.seriesById(it.id);
      return { sig: `cmd:purpose:${it.id}`, html: `<div class="cp"><div class="dt-h">Edit purpose in place · press ↵</div>${purposeBlock(s, false)}</div>` };
    }
    if (it.cmd === 'attach') {
      const hit = CC.findMeeting(it.id);
      return { sig: `cmd:attach:${it.id}`, html: `<div class="cp"><div class="dt-h">Attach a file</div><div class="cp-drop drop-target">${icon('paperclip', 'lg')}<b>${esc(hit.series.name)} #${hit.meeting.n} · ${CC.startOf(hit.meeting)}</b><span class="muted">Choose a file, or drop one on the Island anytime.</span><button class="btn primary" data-act="run">Choose file…<span class="kbd">↵</span></button></div></div>` };
    }
    const u = CC.get().data.unfiled.find((x) => x.id === it.id);
    return { sig: `cmd:file:${it.id}`, html: `<div class="cp"><div class="dt-h">File to a series · press ↵ to choose</div>${u ? unfiledRow(u) : ''}</div>` };
  }
  function setupView() {
    return { sig: 'setup', html: `<div class="empty dt-caught"><div class="app-icon md"><img src="../kit/telu-icon.png" alt=""></div><h3>Telu isn’t set up yet</h3><p>Connect your calendar and Telu prepares a brief before each recurring meeting.</p><button class="btn primary" data-act="setup">Set up Telu</button></div>` };
  }
  function noneView() {
    return { sig: 'none', html: `<div class="cp"><div class="empty dt-caught">${icon('search', 'xl')}<h3>No matches</h3><p>Try a name, a person or a date — or create a series by describing it:</p></div>${examples()}</div>` };
  }
  function missing() {
    return { sig: 'missing', html: `<div class="empty dt-caught">${icon('info', 'xl')}<h3>Not found</h3><p>This item was removed.</p></div>` };
  }
  const RENDER = { series: seriesView, meeting: meetingView, review: reviewView, suggestions: suggestionsView, unfiled: unfiledView, person: personView, doc: docView, command: commandView, setup: setupView, none: noneView };
  function render(target, ctx = {}) {
    if (!target) return { sig: 'empty', html: '<div class="empty dt-caught"><h3>Nothing selected</h3></div>' };
    return (RENDER[target.kind] || noneView)(target, ctx);
  }

  function focusPurpose(el) {
    const block = $('.pu [data-field="why"]', el);
    if (!block) return;
    block.focus({ preventScroll: true });
    placeCaretAtEnd(block);
  }
  function readPurpose(root) {
    const block = (f) => $(`[data-field="${f}"]`, root);
    const lines = (f) => block(f).innerText.split('\n').map((t) => t.trim()).filter(Boolean).slice(0, 12);
    const agenda = lines('agenda').map((line) => {
      const m = line.match(/^(.*?)\s*·\s*(\d+\s*(?:min|m))$/);
      return m ? { t: m[1], d: m[2] } : { t: line, d: '' };
    });
    return { why: block('why').innerText.trim().slice(0, 600), outcomes: lines('outcomes'), agenda, notFor: block('notFor').innerText.trim().slice(0, 400) };
  }
  function setSaveState(root, saving) {
    const el = $('[data-pu-state]', root);
    if (el) el.innerHTML = saving ? '<span class="spinner pu-spin"></span>Saving…' : `${icon('check', 'sm')}Saved`;
    const foot = $('#cmdkFoot [data-save-state]');
    if (foot) foot.innerHTML = saving ? 'Saving…' : `${icon('check', 'sm')}Saved automatically`;
  }
  function beginPurpose() {
    clearTimeout(pv.saveTimer);
    Object.assign(pv, { saveTimer: null, root: null, bumped: false });
  }
  function flushPurpose() {
    if (!pv.saveTimer || !pv.root) return;
    clearTimeout(pv.saveTimer);
    pv.saveTimer = null;
    const root = pv.root;
    const sid = root.dataset.sid;
    const bump = !pv.bumped;
    pv.bumped = true;
    CC.savePurpose(sid, readPurpose(root), bump);
    const chip = $('.pu-ver', root);
    chip.textContent = `v${CC.seriesById(sid).purpose.version}`;
    if (bump) bumpEl(chip);
    setSaveState(root, false);
  }
  function purposeInput(root) {
    setSaveState(root, true);
    clearTimeout(pv.saveTimer);
    pv.root = root;
    pv.saveTimer = setTimeout(flushPurpose, 650);
  }
  function historyPopover(el) {
    const s = CC.seriesById(el.closest('.pu').dataset.sid);
    const rows = s.purpose.history.map((h) => `<div class="hist-row"><span class="chip">v${h.v}</span><span class="truncate">${esc(h.note)}</span><span class="faint">${esc(h.date)}</span></div>`).join('');
    Kit.popover(el, `<div class="hist"><div class="t-eyebrow">PURPOSE HISTORY</div>${rows}</div>`, { width: 300 });
  }
  function addAgenda(input) {
    const text = input.value.replace(/\s+/g, ' ').trim().slice(0, 80);
    if (!text) return;
    CC.addAgenda(input.dataset.meeting, text);
    const list = input.closest('.dt-sec').querySelector('.ag-list');
    list.insertAdjacentHTML('beforeend', agRow({ t: text, d: '5m', mine: true }));
    list.lastElementChild.classList.add('receive');
    input.value = '';
    CC.palette.adopt();
    CC.sync();
  }
  async function removeRow(row, apply) {
    if (!row || row.classList.contains('deciding')) return '';
    row.classList.add('deciding');
    const list = row.parentElement;
    await Kit.removeAnimated(row);
    const message = apply();
    if (list.querySelector('.sg-row')) CC.palette.adopt();
    CC.sync();
    return message;
  }
  async function proposal(btn) {
    const row = btn.closest('[data-pid]');
    const { pid } = row.dataset;
    const accept = btn.dataset.choice === 'accept';
    const message = await removeRow(row, () => CC.decideProposal(pid, btn.dataset.choice));
    if (!message) return;
    CC.toast(message, { icon: accept ? 'check-circle' : 'check' });
    if (accept) CC.palette.receive(`series:${pid}`);
  }
  async function fileRow(btn, seriesId) {
    const row = btn.closest('[data-uid]');
    const message = await removeRow(row, () => CC.fileUnfiled(row.dataset.uid, seriesId));
    if (message) CC.toast(message, { icon: 'tray-down' });
  }
  function chooseSeries(btn) {
    const items = CC.get().data.series.map((s) => ({ label: esc(s.name), swatch: s.color, onSelect: () => fileRow(btn, s.id) }));
    Kit.menu(btn, [{ title: 'File to…' }, ...items], { align: 'start', minWidth: 230 });
  }
  function chooseFirst() {
    const btn = $('[data-act="file-choose"]', detail());
    if (btn) chooseSeries(btn);
  }

  const ACTIONS = {
    back: () => CC.palette.back(),
    'open-meeting': (el) => CC.palette.push({ kind: 'meeting', id: el.dataset.id }),
    'open-series': (el) => CC.palette.navigate('series', el.dataset.id),
    'open-doc': (el) => CC.palette.push({ kind: 'doc', id: el.dataset.name, title: el.dataset.name }),
    'purpose-edit': (el) => CC.palette.startEditing(el.dataset.id || el.closest('.pu').dataset.sid),
    'purpose-done': () => CC.palette.finishEditing(),
    'purpose-history': (el) => historyPopover(el),
    calendar: (el) => {
      const s = CC.seriesById(el.dataset.id);
      CC.toast(`Linked to the recurring “${s.name}” event on your ${s.calendar} calendar`, { icon: 'calendar' });
    },
    record: () => {
      CC.palette.close();
      CC.startRecording();
    },
    stop: () => CC.stopRecording(),
    'open-review': () => CC.palette.openAt('review'),
    'rv-accept': () => decideFront('accepted'),
    'rv-reject': () => decideFront('rejected'),
    'rv-edit': () => editFront(),
    'rv-close': () => CC.palette.close(),
    proposal: (el) => proposal(el),
    file: (el) => fileRow(el, el.dataset.sid),
    'file-choose': (el) => chooseSeries(el),
    run: () => CC.palette.runCurrent(),
    example: (el) => CC.palette.setQuery(el.dataset.q),
    setup: () => {
      CC.palette.close();
      CC.onboarding.open();
    }
  };
  function onClick(event) {
    const el = event.target.closest('[data-act]');
    if (!el || !detail().contains(el) || !ACTIONS[el.dataset.act]) return;
    if (el.dataset.act.startsWith('rv-')) CC.palette.markDetailFocus();
    ACTIONS[el.dataset.act](el, event);
  }
  function onInput(event) {
    const block = event.target.closest('.pu-b');
    if (block) purposeInput(block.closest('.pu'));
  }
  function onKeydown(event) {
    const t = event.target;
    if (t.matches('.ag-input') && event.key === 'Enter') {
      event.preventDefault();
      addAgenda(t);
    } else if (t.matches('[data-rv-text][contenteditable]') && event.key === 'Enter') {
      event.preventDefault();
      decideFront('accepted');
    }
  }
  function onToggle(event) {
    const sw = event.target;
    if (!sw.dataset.doc) return;
    CC.toggleDoc(sw.dataset.meeting, sw.dataset.doc, event.detail.checked);
    $('.doc-inc', sw.closest('.doc-row')).textContent = event.detail.checked ? 'In the brief' : 'Not included';
    const hit = CC.findMeeting(sw.dataset.meeting);
    const count = $('[data-doc-count]', detail());
    if (count) count.textContent = `${hit.meeting.brief.docs.filter((d) => d.include).length} in the brief`;
    CC.palette.adopt();
    CC.sync();
  }
  function onPaste(event) {
    if (!event.target.closest('.pu-b, [data-rv-text]')) return;
    event.preventDefault();
    document.execCommand('insertText', false, (event.clipboardData.getData('text/plain') || '').slice(0, 1000));
  }

  return {
    render, parsedChips, parsedPreview, reviewKey, cancelCardEdit, beginPurpose, flushPurpose, chooseFirst,
    onClick, onInput, onKeydown, onToggle, onPaste
  };
})();
