(() => {
  const e = Kit.esc;
  const KICON = { decision: 'decision', commitment: 'commitment', question: 'question', fact: 'fact' };
  const PH = {
    why: 'Why does this conversation exist? One or two sentences.',
    outcomes: 'What should be true when it goes well?',
    agenda: 'A topic you cover every time',
    notFor: 'What belongs somewhere else?'
  };
  const CADENCES = ['None', 'Weekly', 'Every 2 weeks', 'Monthly'];
  const DAY_NAMES = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Weekdays: 'Weekdays' };

  const badge = (name) => Kit.fileBadge(String(name).replace(/[^\w.\- ]/g, ''));
  const docButton = (name, meta = '') => `<button class="doc-chip" data-act="doc" data-name="${e(name)}">${badge(name)}<span class="truncate">${e(name)}</span>${meta ? `<small>${e(meta)}</small>` : ''}</button>`;
  const dayLabel = (d) => (d ? DAY_NAMES[d] || d : 'Day');

  const ruleChip = (s) => (s.source === 'manual' || !s.rule
    ? `<button class="chip meta-chip" data-act="rule">${icon('folder')}${e(s.rule || 'Not linked to a calendar')}</button>`
    : `<button class="chip meta-chip" data-act="rule">${icon('repeat')}${e(s.rule)}</button>`);
  const peopleChip = (s) => (s.people.length
    ? `<button class="chip meta-chip" data-act="people"><span class="avatars">${s.people.slice(0, 3).map((n) => Kit.avatar(n)).join('')}</span><span>${s.people.length} ${s.people.length === 1 ? 'person' : 'people'}</span></button>`
    : '');
  const countChip = (s) => {
    if (s.count) return `<span class="chip meta-chip static">${s.count} meetings since ${e(s.since)}</span>`;
    const up = LD.upcomingOf(s);
    return up ? `<span class="chip meta-chip static">New · first meeting ${e(up.date)}</span>` : '';
  };
  const privateChip = (s) => (s.private
    ? `<span class="chip meta-chip static" data-tip="Recordings, transcripts and memory never leave this Mac">${icon('lock')}Private · this Mac only</span>`
    : '');

  const repeatsMarkup = (s) => {
    const off = s.cadence === 'None' ? 'disabled' : '';
    return `<div class="repeats" id="repeats">
      <span class="repeats-label">Repeats</span>
      <div class="seg" id="cadenceSeg">${CADENCES.map((c) => `<button data-value="${c}" aria-selected="${s.cadence === c}">${c}</button>`).join('')}</div>
      <button class="btn popup" data-act="pick-day" id="pickDay" ${off}>${e(dayLabel(s.day))}${icon('chevron-updown')}</button>
      <button class="btn popup" data-act="pick-time" id="pickTime" ${off}>${e(s.time || 'Time')}${icon('chevron-updown')}</button>
    </div>
    <div class="repeats-sub" id="repeatsSub">${repeatsSub(s)}</div>`;
  };
  const repeatsSub = (s) => `<button class="btn sm plain link-btn" data-act="link-event">${icon('calendar-plus')}${s.linked ? e(s.linked) : 'Link to a calendar event…'}</button>${peopleChip(s)}`;
  const metaMarkup = (s) => (s.draft ? repeatsMarkup(s) : `${ruleChip(s)}${peopleChip(s)}${countChip(s)}${privateChip(s)}`);
  const headerMarkup = (s) => `<header class="doc-head" id="sec-top">
      <div class="doc-title-row"><span id="docIcon">${Kit.seriesIcon(s, 'lg')}</span><h1 class="t-large doc-title" id="docTitle" contenteditable="true" spellcheck="false" data-placeholder="Name this conversation">${e(s.name)}</h1></div>
      <div class="doc-meta ${s.draft ? 'draft' : ''}" id="docMeta">${metaMarkup(s)}</div>
    </header>`;

  const purposeVersion = (s) => {
    const p = s.purpose;
    if (LD.state.edited[s.id]) return `v${(p.version || 0) + 1} · just now`;
    if (s.draft) return 'Draft';
    return p.drafted ? `v${p.version} · drafted just now` : `v${p.version} · edited ${e(p.edited)}`;
  };
  const outcomesMarkup = (list) => (list.length ? list.map((o) => `<li>${e(o)}</li>`).join('') : `<li data-placeholder="${PH.outcomes}"></li>`);
  const purposeAgendaRow = (a) => `<div class="ag-row"><span class="ag-t editable" contenteditable="true" spellcheck="false" data-placeholder="${PH.agenda}">${e(a.t)}</span><span class="ag-d num">${e(a.d || '')}</span></div>`;
  const agendaTotal = (list) => list.reduce((sum, a) => sum + (parseInt(a.d, 10) || 0), 0);
  const refChip = (d) => `<button class="doc-chip ref-chip" data-act="ref-doc" data-name="${e(d.name)}">${badge(d.name)}<span class="truncate">${e(d.name)}</span>${d.ver ? `<small>${e(d.ver)}</small>` : ''}<span class="inc-dot ${d.include ? '' : 'off'}" data-act="toggle-include" data-tip="${d.include ? 'Included in every brief' : 'Not included in briefs'}"></span></button>`;
  const referenceInner = (s) => `<span class="ref-label">Reference</span>${s.docs.map(refChip).join('')}<button class="doc-chip add-chip" data-act="add-ref">${icon('plus')}Add</button>`;
  const purposeHead = (s) => {
    const drafted = s.purpose.drafted && !LD.state.edited[s.id];
    return `<div class="sec-head">
        <span class="sec-eyebrow">Purpose</span><span class="sec-meta" id="purposeMeta">${purposeVersion(s)}</span>
        ${drafted ? `<span class="chip accent drafted" id="draftedChip">${icon('pencil')}Drafted from the calendar invite — make it yours</span>` : ''}
        <span class="spacer"></span>
        ${s.purpose.history.length ? `<button class="btn sm plain" data-act="purpose-history">${icon('history')}History</button>` : ''}
      </div>`;
  };
  const purposeMarkup = (s) => {
    const p = s.purpose;
    const agenda = p.agenda.length ? p.agenda : [{ t: '', d: '' }];
    const total = agendaTotal(p.agenda);
    return `<section class="doc-sec purpose" id="sec-purpose" data-mark="Purpose">
      ${purposeHead(s)}
      <div class="p-block"><div class="p-label">Why we meet</div><p class="p-why editable" contenteditable="true" data-field="why" data-placeholder="${PH.why}">${e(p.why)}</p></div>
      <div class="p-block"><div class="p-label">What good looks like</div><ul class="p-outcomes editable" contenteditable="true" data-field="outcomes">${outcomesMarkup(p.outcomes)}</ul></div>
      <div class="p-block"><div class="p-label">Standing agenda${total ? `<span class="p-total num">${total} min</span>` : ''}</div><div class="p-agenda" data-field="agenda">${agenda.map(purposeAgendaRow).join('')}</div></div>
      <div class="p-block"><div class="p-label">Not for this meeting</div><p class="p-notfor editable" contenteditable="true" data-field="notFor" data-placeholder="${PH.notFor}">${e(p.notFor)}</p></div>
      <div class="ref-row" id="refRow">${referenceInner(s)}</div>
      <div class="drop-hint">${icon('tray-down')}Drop to add to Reference</div>
    </section>`;
  };

  const MEM_GROUPS = [['decision', 'Decisions'], ['commitment', 'Open commitments'], ['question', 'Open questions'], ['fact', 'Facts']];
  const memStatus = (it) => (it.resolvedToday ? '<span class="status" data-s="completed">Resolved today</span>' : Kit.status(it.status));
  const memItem = (it) => `<div class="mem-item ${it.status === 'completed' ? 'done' : ''}" data-key="${e(it.id)}">
      <div class="mem-text">${e(it.text)}</div>
      <div class="mem-meta">${memStatus(it)}${it.owner ? `<span class="owner">${Kit.avatar(it.owner)}${e(LD.firstName(it.owner))}</span>` : ''}${it.due ? `<span class="due num">Due ${e(it.due)}</span>` : ''}${Kit.source(it.src)}</div>
      ${it.replaced ? `<div class="mem-replaced"><span>replaced ·</span><span class="superseded-text">${e(it.replaced)}</span></div>` : ''}
    </div>`;
  const memGroup = ([type, label], s) => {
    const items = s.memory.filter((it) => it.type === type).sort((a, b) => (a.status === 'completed') - (b.status === 'completed'));
    const open = items.filter((it) => it.status !== 'completed').length;
    return `<div class="mem-group" data-type="${type}">
      <div class="mem-group-head">${icon(KICON[type])}<span>${label}</span><span class="n num">${open || ''}</span></div>
      ${items.length ? items.map(memItem).join('') : '<div class="mem-empty">Nothing yet</div>'}
    </div>`;
  };
  const memoryBody = (s) => (s.memory.length
    ? `<div class="mem-grid">${MEM_GROUPS.map((g) => memGroup(g, s)).join('')}</div>`
    : `<div class="mem-none">${icon('lightbulb')}<span>Nothing remembered yet. After each meeting you accept what matters — it lands here and feeds every brief.</span></div>`);
  const memoryMarkup = (s) => `<section class="doc-sec memory" id="sec-memory" data-mark="Memory">
      <div class="sec-head"><span class="sec-eyebrow">Memory</span><span class="sec-caption">Only items you accepted</span></div>
      <div id="memBody">${memoryBody(s)}</div>
    </section>`;

  const whenLabel = (m) => (LD.dayOffset(m.date) === 0 ? `Today ${m.time}` : `${m.date} · ${m.time}`);
  const recordButtons = (m) => (LD.dayOffset(m.date) === 0
    ? `<button class="btn sm record" data-act="record">${icon('record')}Record<span class="kbd">⌘R</span></button>${/meet|zoom|teams/i.test(m.where || '') ? `<button class="btn sm" data-act="join" data-where="${e(m.where)}">Join</button>` : ''}`
    : '');
  const nextHead = (m) => `<div class="next-head">
      <div class="next-title"><span class="next-kicker">Next</span><span class="dot-sep">·</span><span>${e(whenLabel(m))}</span>${[m.title, m.where].filter(Boolean).map((x) => `<span class="dot-sep">·</span><span class="next-where">${e(x)}</span>`).join('')}</div>
      <span class="chip accent num countdown">${LD.countdown(m)}</span>
      <span class="spacer"></span>${recordButtons(m)}
    </div>`;
  const carryRow = (c) => `<div class="carry-row"><span class="k-ico" data-type="${c.type}">${icon(KICON[c.type])}</span><span class="carry-text">${e(c.text)}${c.owner ? `<span class="carry-owner"> · ${e(LD.firstName(c.owner))}</span>` : ''}</span>${c.note ? `<span class="carry-note">${e(c.note)}</span>` : ''}${Kit.source(c.src)}</div>`;
  const askInner = (asks) => `<div class="ask"><div class="ask-head">${icon('sparkle')}Worth asking</div>${asks.map((a, i) => `<div class="ask-row"><span class="ask-text">${e(a.text)}</span><span class="ask-side">${Kit.source(a.src)}<button class="btn sm icon plain ask-add" data-act="ask-to-agenda" data-i="${i}" data-tip="Add to agenda">${icon('plus')}</button></span></div>`).join('')}</div>`;
  const agendaItem = (a, i) => `<div class="agenda-item ${a.done ? 'done' : ''}" data-i="${i}"><button class="check" aria-checked="${!!a.done}" aria-label="Done">${Kit.checkSvg}</button><span class="ag-t">${e(a.t)}</span>${a.added ? `<span class="added-by">${a.fromAsk ? 'From Worth asking' : 'Added by Telu'}</span>` : ''}<span class="ag-d num">${e(a.d || '')}</span></div>`;
  const previewItem = (a) => `<div class="agenda-item preview"><span class="bullet"></span><span class="ag-t">${e(a.t)}</span><span class="ag-d num">${e(a.d || '')}</span></div>`;
  const agendaAdd = () => `<label class="agenda-add"><span class="add-ico">${icon('plus')}</span><input class="agenda-input" id="agendaInput" placeholder="Add item" aria-label="Add agenda item" spellcheck="false" autocomplete="off"></label>`;
  const nextDocs = (docs) => `<div class="nb-group next-docs" data-drop="meeting"><div class="nb-label">Docs for this meeting</div><div class="next-doc-list" id="nextDocList">${docs.map((d) => docButton(d)).join('')}</div><div class="drop-note">${icon('tray-down')}Drop files to attach</div></div>`;
  const provenance = (s, m) => {
    const docs = s.docs.filter((d) => d.include).length;
    const from = `your purpose, Memory${docs ? ` and ${LD.plural(docs, 'reference doc')}` : ''}`;
    return m.status === 'preparing'
      ? `<p class="next-from"><span class="spinner tiny"></span>Still preparing from ${from} — ready before ${e(LD.startTime(m))}</p>`
      : `<p class="next-from">${icon('doc')}Prepared last night from ${from}</p>`;
  };
  const briefInner = (s, m) => {
    const b = m.brief;
    return `${provenance(s, m)}<div class="nb-group"><div class="nb-label">Since last time</div>${b.carry.map(carryRow).join('')}</div>
      ${b.ask && b.ask.length ? askInner(b.ask) : ''}
      <div class="next-grid">
        <div class="nb-group"><div class="nb-label">Agenda</div><div class="agenda" id="agendaList">${b.agenda.map(agendaItem).join('')}</div>${agendaAdd()}</div>
        ${nextDocs(b.docs)}
      </div>`;
  };
  const carryForward = (s) => s.memory
    .filter((it) => (it.type === 'commitment' && it.status === 'open') || (it.type === 'question' && it.status === 'unresolved'))
    .slice(0, 4)
    .map((it) => ({ type: it.type, text: it.text, owner: it.owner, note: it.due ? `Due ${it.due}` : it.fresh ? 'New today' : '', src: it.src }));
  const pendingInner = (s, m) => {
    const carry = carryForward(s);
    const docs = [...s.docs.filter((d) => d.include).map((d) => d.name), ...(m.docs || [])];
    return `<p class="next-pending">${icon('clock')}Telu prepares this brief the evening before.</p>
      ${carry.length ? `<div class="nb-group"><div class="nb-label">Carry forward so far</div>${carry.map(carryRow).join('')}</div>` : ''}
      <div class="next-grid">
        <div class="nb-group"><div class="nb-label">Standing agenda</div><div class="agenda">${s.purpose.agenda.map(previewItem).join('') || '<div class="faint">Add topics to the purpose above</div>'}</div></div>
        ${nextDocs(docs)}
      </div>`;
  };
  const idleInner = (s) => `<div class="next-head"><div class="next-title"><span class="next-kicker">Next</span><span class="dot-sep">·</span><span class="muted">Not scheduled</span></div><span class="spacer"></span><button class="btn sm record" data-act="record">${icon('record')}Record<span class="kbd">⌘R</span></button></div>
    <p class="next-pending">${icon('info')}${s.draft ? 'Set how often it repeats above, or record any time — it files here.' : 'Nothing upcoming in your calendar. Record any time and it files here.'}</p>`;
  const liveInner = () => `<div class="live-strip"><span class="rec-dot"></span><b>Recording</b><span class="live-timer num" id="liveTimer">0:00</span><span class="wave live-wave"><i></i><i></i><i></i><i></i><i></i></span><span class="live-note">${icon('lock', 'sm')}Transcribing on this Mac</span><span class="spacer"></span><button class="btn sm" data-act="stop">${icon('stop')}Stop<span class="kbd">⌘R</span></button></div><div class="live-lines" id="liveLines"><div class="live-line listening">Listening…</div></div>`;
  const preparingInner = () => `<div class="next-head"><div class="next-title"><span class="spinner"></span><span>Preparing summary…</span></div><span class="spacer"></span><span class="live-note">${icon('lock', 'sm')}On this Mac</span></div><div class="prep-lines"><div class="shimmer"></div><div class="shimmer"></div><div class="shimmer short"></div></div>`;
  const nextParts = (s) => {
    const rec = LD.state.recording;
    if (rec && rec.sid === s.id) return { cls: 'live', inner: liveInner() };
    if (LD.state.preparing === s.id) return { cls: 'preparing', inner: preparingInner() };
    const m = LD.upcomingOf(s);
    if (!m) return { cls: 'idle', inner: idleInner(s) };
    return { cls: '', inner: `${nextHead(m)}${m.brief ? briefInner(s, m) : pendingInner(s, m)}` };
  };
  const nextMarkup = (s) => {
    const parts = nextParts(s);
    return `<section class="doc-sec next ${parts.cls}" id="sec-next" data-mark="Next">${parts.inner}</section>`;
  };

  Object.assign(LD, {
    badge, docButton, dayLabel, repeatsSub, metaMarkup, headerMarkup, purposeVersion, purposeAgendaRow, purposeMarkup,
    referenceInner, memoryBody, memoryMarkup, agendaItem, nextParts, nextMarkup
  });
})();
