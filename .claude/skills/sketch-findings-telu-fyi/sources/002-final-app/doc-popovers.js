(() => {
  const T = window.T;
  const D = T.doc;
  const { $, $$ } = Kit;
  const e = Kit.esc;
  const pop = (trigger, markup, opts) => Kit.popover(trigger, `<div class="pop">${markup}</div>`, opts);
  const on = (p, sel, fn) => {
    const el = p && p.el.querySelector(sel);
    if (el) el.addEventListener('click', fn);
  };

  const unlink = (s) => {
    const before = { source: s.source, rule: s.rule };
    T.mapSeries(s.id, (x) => ({ ...x, source: 'manual', rule: 'Grouped by you · no fixed time' }));
    D.paintPageMeta();
    T.toast('Unlinked from Calendar — recordings still file here', {
      icon: 'link',
      action: { label: 'Undo', onClick: () => { T.mapSeries(s.id, (x) => ({ ...x, ...before })); D.paintPageMeta(); } }
    });
  };
  const changeMenu = (chip, s) => Kit.menu(chip, [
    { title: 'Follow a different event' },
    { label: e(s.name), icon: 'check', kbd: 'Current', disabled: true },
    ...T.LINKABLE.map((ev) => ({ label: e(ev.title), icon: 'calendar', kbd: ev.label, onSelect: () => T.toast(`Now following “${e(ev.title)}” · earlier meetings stay in ${e(s.name)}`, { icon: 'calendar-check' }) }))
  ], { minWidth: 280 });
  D.rulePopover = (chip) => {
    const s = D.current();
    if (!s) return;
    if (s.source !== 'calendar') {
      pop(chip, `<div class="pop-row">${icon('folder')}<div><b>Grouped by you</b><div class="muted">Not tied to a calendar event. Meetings you record or file here stay together.</div></div></div>`, { width: 300 });
      return;
    }
    const p = pop(chip, `<div class="pop-row">${icon('calendar-check')}<div><b>Linked to Calendar</b><div class="muted">${e(s.calendar || 'Work')} · “${e(s.name)}”</div></div></div>
      <div class="pop-sub num">${e(s.rule)}</div>
      <div class="pop-actions"><button class="btn sm" data-pop="change">Change…</button><button class="btn sm plain" data-pop="unlink">Unlink</button></div>`, { width: 300 });
    on(p, '[data-pop="change"]', () => { p.close(); changeMenu(chip, s); });
    on(p, '[data-pop="unlink"]', () => { p.close(); unlink(s); });
  };
  D.peoplePopover = (chip) => {
    const s = D.current();
    if (!s) return;
    pop(chip, `<div class="pop-title">${s.people.length} ${s.people.length === 1 ? 'person' : 'people'}</div>
      ${s.people.map((n) => `<div class="pop-person">${Kit.avatar(n)}<span>${e(n)}</span></div>`).join('')}
      <div class="pop-foot">${icon('calendar', 'sm')}${s.source === 'calendar' ? 'From the calendar invite' : 'Added by you'}</div>`, { width: 250 });
  };

  const histRow = (h) => `<div class="hist-row ${h.current ? 'current' : ''}"><span class="hist-v num">v${h.v}</span><div class="hist-main"><span>${e(h.note)}</span><span class="faint">${e(h.date)}</span></div>${h.current ? '<span class="chip accent">Current</span>' : ''}</div>`;
  D.purposeHistoryPopover = (btn) => {
    const s = D.current();
    if (!s) return;
    const p = s.purpose;
    const edited = T.state.edited[s.id];
    const rows = [
      ...(edited ? [{ v: (p.version || 0) + 1, date: 'Just now', note: 'Edited by you', current: true }] : []),
      ...p.history.map((h, i) => ({ ...h, current: !edited && i === 0 }))
    ];
    pop(btn, `<div class="pop-title">Purpose history</div>${rows.map(histRow).join('')}<div class="pop-foot">${icon('lock', 'sm')}Every version stays on this Mac</div>`, { width: 310, align: 'end' });
  };
  const sortKey = (label) => {
    const [mon, day] = String(label).split(' ');
    return label === 'Now' || label === 'Today' ? Infinity : T.util.parseDate(`x ${day} ${mon}`).getTime();
  };
  const activity = (s) => {
    const filed = s.meetings
      .filter((m) => !T.util.isUpcoming(m) && m.status !== 'cancelled')
      .slice(0, 4)
      .map((m) => ({ when: T.util.shortDate(m.date), note: `${m.date} filed${m.duration ? ` · ${m.duration}` : ''}`, ico: 'calendar-check' }));
    const purpose = s.purpose.history.map((h) => ({ when: h.date, note: `Purpose v${h.v} — ${h.note}`, ico: 'pencil' }));
    const now = T.state.edited[s.id] ? [{ when: 'Now', note: 'Purpose edited by you', ico: 'pencil' }] : [];
    return [...now, ...filed, ...purpose].sort((a, b) => sortKey(b.when) - sortKey(a.when)).slice(0, 7);
  };
  D.docHistoryPopover = (btn) => {
    const s = D.current();
    if (!s) return;
    const rows = activity(s);
    pop(btn, `<div class="pop-title">History · ${e(s.name || 'Untitled')}</div>
      ${rows.length ? rows.map((r) => `<div class="act-row">${icon(r.ico)}<span class="act-note">${e(r.note)}</span><span class="faint num">${e(r.when)}</span></div>`).join('') : '<div class="pop-empty">Nothing yet — history starts with the first edit or meeting.</div>'}
      <div class="pop-foot">${icon('lock', 'sm')}Kept on this Mac</div>`, { width: 330, align: 'end' });
  };

  D.share = () => {
    const s = D.current();
    if (s) T.toast(`Exported ${e(s.name || 'Untitled')}.md to Downloads`, { icon: 'check-circle' });
  };
  D.docMenu = (btn) => {
    const s = D.current();
    if (!s) return;
    Kit.menu(btn, [
      { title: e(s.name || 'Untitled') },
      { label: 'Rename', icon: 'pencil', onSelect: () => D.selectAll($('#docTitle')) },
      { label: 'Edit purpose', icon: 'target', kbd: '⌘E', onSelect: () => D.focusPurpose() },
      { label: 'Export as Markdown', icon: 'share', kbd: '⇧⌘E', onSelect: D.share },
      '-',
      { label: 'Stop tracking…', icon: 'x-circle', danger: true, onSelect: () => T.confirmStopTracking(s.id) }
    ], { align: 'end', minWidth: 230 });
  };
  D.showEarlier = (btn) => {
    const s = D.current();
    if (s) T.toast(`${btn.dataset.n} earlier meetings since ${e(s.since)} — all searchable, all on this Mac`, { icon: 'history' });
  };

  const chipFor = (name) => $$('#refRow .ref-chip').find((c) => c.dataset.name === name);
  const setInclude = (name, include) => {
    const s = D.current();
    if (!s) return;
    T.mapSeries(s.id, (x) => ({ ...x, docs: x.docs.map((d) => (d.name === name ? { ...d, include } : d)) }));
    const dot = chipFor(name) && chipFor(name).querySelector('.inc-dot');
    if (dot) {
      dot.classList.toggle('off', !include);
      dot.dataset.tip = include ? 'Included in every brief' : 'Not included in briefs';
    }
    T.toast(include ? `${e(name)} is included in every brief` : `${e(name)} stays out of briefs`, { icon: include ? 'check-circle' : 'minus' });
    const up = T.upcomingOf(T.seriesById(s.id));
    if ((!up || !up.brief) && !T.state.recording) D.paintNextFor(s.id);
    T.island('refresh');
  };
  D.toggleInclude = (name) => {
    const s = D.current();
    const d = s && s.docs.find((x) => x.name === name);
    if (d) setInclude(name, !d.include);
  };
  const removeRef = (name) => {
    const s = D.current();
    const before = s.docs;
    T.mapSeries(s.id, (x) => ({ ...x, docs: x.docs.filter((d) => d.name !== name) }));
    const chip = chipFor(name);
    const done = () => chip && chip.remove();
    if (chip && !Kit.reduceMotion()) chip.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(0.95)' }], { duration: 150, easing: 'ease-out' }).finished.then(done);
    else done();
    T.toast(`Removed ${e(name)} from Reference`, {
      icon: 'minus',
      action: { label: 'Undo', onClick: () => { T.mapSeries(s.id, (x) => ({ ...x, docs: before })); const ref = $('#refRow'); if (ref) ref.innerHTML = D.referenceInner(T.seriesById(s.id)); } }
    });
  };
  D.refPopover = (chip) => {
    const s = D.current();
    const d = s && s.docs.find((x) => x.name === chip.dataset.name);
    if (!d) return;
    const meta = [d.ver, d.size, d.added && `added ${d.added}`].filter(Boolean).join(' · ');
    const p = pop(chip, `<div class="ref-pop-head">${D.badge(d.name)}<div class="ref-pop-name"><b>${e(d.name)}</b><span class="muted num">${e(meta)}</span></div></div>
      <div class="pop-switch"><span>Include in every brief</span><button class="switch" aria-checked="${d.include}" aria-label="Include in every brief"></button></div>
      <div class="pop-actions"><button class="btn sm" data-pop="open">Open</button><span class="spacer"></span><button class="btn sm plain danger-text" data-pop="remove">Remove</button></div>`, { width: 300 });
    if (!p) return;
    p.el.addEventListener('toggle', (ev) => setInclude(d.name, ev.detail.checked));
    on(p, '[data-pop="open"]', () => { p.close(); T.toast(`Opening ${e(d.name)} in Preview…`, { icon: 'doc' }); });
    on(p, '[data-pop="remove"]', () => { p.close(); removeRef(d.name); });
  };
  const RECENT = [{ name: 'Rate-limit plan v1.docx', size: 96000 }, { name: 'Pricing experiment.xlsx', size: 310000 }, { name: 'Offsite notes.md', size: 8000 }];
  D.pickFiles = () => {
    const s = D.current();
    if (!s) return;
    const input = Object.assign(document.createElement('input'), { type: 'file', multiple: true });
    input.addEventListener('change', () => D.attachToPurpose(T.seriesById(s.id), [...input.files].map((f) => ({ name: f.name, size: f.size }))));
    input.click();
  };
  D.addRefMenu = (btn) => {
    const s = D.current();
    if (!s) return;
    const available = RECENT.filter((r) => !s.docs.some((d) => d.name === r.name));
    Kit.menu(btn, [
      { title: 'Recent on this Mac' },
      ...available.map((r) => ({ label: e(r.name), icon: 'doc', onSelect: () => D.attachToPurpose(T.seriesById(s.id), [r]) })),
      ...(available.length ? ['-'] : []),
      { label: 'Choose File…', icon: 'folder', kbd: '⌘O', onSelect: D.pickFiles }
    ], { minWidth: 250 });
  };

  Object.assign(T.actions, {
    rule: (el) => D.rulePopover(el),
    people: (el) => D.peoplePopover(el),
    'purpose-history': (el) => D.purposeHistoryPopover(el),
    history: (el) => D.docHistoryPopover(el),
    share: () => D.share(),
    'tb-more': (el) => D.docMenu(el),
    earlier: (el) => D.showEarlier(el),
    'ref-doc': (el) => D.refPopover(el),
    'toggle-include': (el) => D.toggleInclude(el.closest('.ref-chip').dataset.name),
    'add-ref': (el) => D.addRefMenu(el),
    'tb-record': () => T.toggleRecord()
  });
})();
