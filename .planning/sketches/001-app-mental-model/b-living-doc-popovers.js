(() => {
  const { $, $$ } = Kit;
  const e = Kit.esc;
  const pop = (trigger, markup, opts) => Kit.popover(trigger, `<div class="pop">${markup}</div>`, opts);
  const on = (p, sel, fn) => {
    const el = p && p.el.querySelector(sel);
    if (el) el.addEventListener('click', fn);
  };
  const markDanger = () => {
    const alertEl = $$('.alert').pop();
    const btn = alertEl && alertEl.querySelector('.btn.primary');
    if (btn) btn.classList.add('danger');
  };
  const paintMeta = () => {
    const s = LD.current();
    const meta = $('#docMeta');
    if (s && meta && !s.draft) meta.innerHTML = LD.metaMarkup(s);
  };

  const unlink = (s) => {
    const before = { source: s.source, rule: s.rule };
    LD.updateSeries(s.id, (x) => ({ ...x, source: 'manual', rule: 'Grouped by you · no fixed time' }));
    paintMeta();
    Kit.toast('Unlinked from Calendar — recordings still file here', {
      icon: 'link',
      action: { label: 'Undo', onClick: () => { LD.updateSeries(s.id, (x) => ({ ...x, ...before })); paintMeta(); } }
    });
  };
  const changeMenu = (chip, s) => Kit.menu(chip, [
    { title: 'Follow a different event' },
    { label: e(s.name), icon: 'check', kbd: 'Current', disabled: true },
    ...LD.LINKABLE.map((ev) => ({ label: e(ev.title), icon: 'calendar', kbd: ev.label, onSelect: () => Kit.toast(`Now following “${e(ev.title)}” · earlier meetings stay in ${e(s.name)}`, { icon: 'calendar-check' }) }))
  ], { minWidth: 280 });
  LD.rulePopover = (chip) => {
    const s = LD.current();
    if (!s) return;
    if (s.source !== 'calendar') {
      pop(chip, `<div class="pop-row">${icon('folder')}<div><b>Grouped by you</b><div class="muted">Not tied to a calendar event. Meetings you record or file here stay together.</div></div></div>`, { width: 300 });
      return;
    }
    const p = pop(chip, `<div class="pop-row">${icon('calendar-check')}<div><b>Linked to Calendar</b><div class="muted">${e(s.calendar)} · “${e(s.name)}”</div></div></div>
      <div class="pop-sub num">${e(s.rule)}</div>
      <div class="pop-actions"><button class="btn sm" data-pop="change">Change…</button><button class="btn sm plain" data-pop="unlink">Unlink</button></div>`, { width: 300 });
    on(p, '[data-pop="change"]', () => { p.close(); changeMenu(chip, s); });
    on(p, '[data-pop="unlink"]', () => { p.close(); unlink(s); });
  };
  LD.peoplePopover = (chip) => {
    const s = LD.current();
    if (!s) return;
    pop(chip, `<div class="pop-title">${s.people.length} ${s.people.length === 1 ? 'person' : 'people'}</div>
      ${s.people.map((n) => `<div class="pop-person">${Kit.avatar(n)}<span>${e(n)}</span></div>`).join('')}
      <div class="pop-foot">${icon('calendar', 'sm')}${s.source === 'calendar' ? 'From the calendar invite' : 'Added by you'}</div>`, { width: 250 });
  };

  const histRow = (h) => `<div class="hist-row ${h.current ? 'current' : ''}"><span class="hist-v num">v${h.v}</span><div class="hist-main"><span>${e(h.note)}</span><span class="faint">${e(h.date)}</span></div>${h.current ? '<span class="chip accent">Current</span>' : ''}</div>`;
  LD.purposeHistoryPopover = (btn) => {
    const s = LD.current();
    if (!s) return;
    const p = s.purpose;
    const edited = LD.state.edited[s.id];
    const rows = [
      ...(edited ? [{ v: (p.version || 0) + 1, date: 'Just now', note: 'Edited by you', current: true }] : []),
      ...p.history.map((h, i) => ({ ...h, current: !edited && i === 0 }))
    ];
    pop(btn, `<div class="pop-title">Purpose history</div>${rows.map(histRow).join('')}<div class="pop-foot">${icon('lock', 'sm')}Every version stays on this Mac</div>`, { width: 310, align: 'end' });
  };
  const sortKey = (label) => {
    const [mon, day] = String(label).split(' ');
    return label === 'Now' || label === 'Today' ? Infinity : LD.parseDate(`x ${day} ${mon}`).getTime();
  };
  const activity = (s) => {
    const filed = s.meetings
      .filter((m) => !LD.isUpcoming(m) && m.status !== 'cancelled')
      .slice(0, 4)
      .map((m) => ({ when: LD.shortDate(m.date), note: `${m.date} filed${m.duration ? ` · ${m.duration}` : ''}`, ico: 'calendar-check' }));
    const purpose = s.purpose.history.map((h) => ({ when: h.date, note: `Purpose v${h.v} — ${h.note}`, ico: 'pencil' }));
    const now = LD.state.edited[s.id] ? [{ when: 'Now', note: 'Purpose edited by you', ico: 'pencil' }] : [];
    return [...now, ...filed, ...purpose].sort((a, b) => sortKey(b.when) - sortKey(a.when)).slice(0, 7);
  };
  LD.docHistoryPopover = (btn) => {
    const s = LD.current();
    if (!s) return;
    const rows = activity(s);
    pop(btn, `<div class="pop-title">History · ${e(s.name || 'Untitled')}</div>
      ${rows.length ? rows.map((r) => `<div class="act-row">${icon(r.ico)}<span class="act-note">${e(r.note)}</span><span class="faint num">${e(r.when)}</span></div>`).join('') : '<div class="pop-empty">Nothing yet — history starts with the first edit or meeting.</div>'}
      <div class="pop-foot">${icon('lock', 'sm')}Kept on this Mac</div>`, { width: 330, align: 'end' });
  };

  LD.share = () => {
    const s = LD.current();
    if (s) Kit.toast(`Exported ${e(s.name || 'Untitled')}.md to Downloads`, { icon: 'check-circle' });
  };
  const archive = async (s) => {
    const answer = Kit.alert({
      title: `Archive “${e(s.name || 'Untitled')}”?`,
      message: 'Telu stops filing new meetings into it. Everything already inside stays on this Mac.',
      buttons: [{ label: 'Cancel', value: 'cancel' }, { label: 'Archive', value: 'archive', primary: true }]
    });
    markDanger();
    if ((await answer) !== 'archive') return;
    const snap = { series: LD.state.series, view: LD.state.view };
    const row = $(`#sbNav .doc-row[data-doc="${s.id}"]`);
    LD.set({ series: LD.state.series.filter((x) => x.id !== s.id) });
    LD.openView('upnext', { animate: true });
    if (row) await Kit.removeAnimated(row);
    LD.paintSidebar();
    Kit.toast(`Archived ${e(s.name || 'Untitled')}`, {
      icon: 'archive',
      action: { label: 'Undo', onClick: () => { LD.set(snap); LD.paintSidebar(); LD.paintCanvas(); } }
    });
  };
  LD.docMenu = (btn) => {
    const s = LD.current();
    if (!s) return;
    Kit.menu(btn, [
      { title: e(s.name || 'Untitled') },
      { label: 'Rename', icon: 'pencil', onSelect: () => LD.selectAll($('#docTitle')) },
      { label: 'Edit purpose', icon: 'target', onSelect: () => { const why = $('.p-why'); if (why) { why.scrollIntoView({ block: 'center' }); why.focus(); } } },
      { label: 'Export as Markdown', icon: 'share', kbd: '⇧⌘E', onSelect: LD.share },
      '-',
      { label: 'Archive doc…', icon: 'archive', danger: true, onSelect: () => archive(s) }
    ], { align: 'end', minWidth: 220 });
  };
  LD.showEarlier = (btn) => {
    const s = LD.current();
    if (s) Kit.toast(`${btn.dataset.n} earlier meetings since ${e(s.since)} — all searchable, all on this Mac`, { icon: 'history' });
  };

  const chipFor = (name) => $$('#refRow .ref-chip').find((c) => c.dataset.name === name);
  const setInclude = (name, include) => {
    const s = LD.current();
    if (!s) return;
    const next = LD.updateSeries(s.id, (x) => ({ ...x, docs: x.docs.map((d) => (d.name === name ? { ...d, include } : d)) }));
    const dot = chipFor(name) && chipFor(name).querySelector('.inc-dot');
    if (dot) {
      dot.classList.toggle('off', !include);
      dot.dataset.tip = include ? 'Included in every brief' : 'Not included in briefs';
    }
    Kit.toast(include ? `${e(name)} is included in every brief` : `${e(name)} stays out of briefs`, { icon: include ? 'check-circle' : 'minus' });
    if (!LD.upcomingOf(next)?.brief && !LD.state.recording) LD.paintNext(next);
  };
  LD.toggleInclude = (name) => {
    const s = LD.current();
    const d = s && s.docs.find((x) => x.name === name);
    if (d) setInclude(name, !d.include);
  };
  const removeRef = (name) => {
    const s = LD.current();
    const before = s.docs;
    LD.updateSeries(s.id, (x) => ({ ...x, docs: x.docs.filter((d) => d.name !== name) }));
    const chip = chipFor(name);
    const done = () => chip && chip.remove();
    if (chip && !Kit.reduceMotion()) chip.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(0.95)' }], { duration: 150, easing: 'ease-out' }).finished.then(done);
    else done();
    Kit.toast(`Removed ${e(name)} from Reference`, {
      icon: 'minus',
      action: { label: 'Undo', onClick: () => { const next = LD.updateSeries(s.id, (x) => ({ ...x, docs: before })); $('#refRow').innerHTML = LD.referenceInner(next); } }
    });
  };
  LD.refPopover = (chip) => {
    const s = LD.current();
    const d = s && s.docs.find((x) => x.name === chip.dataset.name);
    if (!d) return;
    const meta = [d.ver, d.size, d.added && `added ${d.added}`].filter(Boolean).join(' · ');
    const p = pop(chip, `<div class="ref-pop-head">${LD.badge(d.name)}<div class="ref-pop-name"><b>${e(d.name)}</b><span class="muted num">${e(meta)}</span></div></div>
      <div class="pop-switch"><span>Include in every brief</span><button class="switch" aria-checked="${d.include}" aria-label="Include in every brief"></button></div>
      <div class="pop-actions"><button class="btn sm" data-pop="open">Open</button><span class="spacer"></span><button class="btn sm plain danger-text" data-pop="remove">Remove</button></div>`, { width: 300 });
    if (!p) return;
    p.el.addEventListener('toggle', (ev) => setInclude(d.name, ev.detail.checked));
    on(p, '[data-pop="open"]', () => { p.close(); Kit.toast(`Opening ${e(d.name)}…`, { icon: 'doc' }); });
    on(p, '[data-pop="remove"]', () => { p.close(); removeRef(d.name); });
  };
  const RECENT = [{ name: 'Rate-limit plan v1.docx', size: 96000 }, { name: 'Pricing experiment.xlsx', size: 310000 }, { name: 'Offsite notes.md', size: 8000 }];
  const pickFiles = LD.pickFiles = () => {
    const input = Object.assign(document.createElement('input'), { type: 'file', multiple: true });
    input.addEventListener('change', () => LD.attachFiles('purpose', [...input.files]));
    input.click();
  };
  LD.addRefMenu = (btn) => {
    const s = LD.current();
    if (!s) return;
    const available = RECENT.filter((r) => !s.docs.some((d) => d.name === r.name));
    Kit.menu(btn, [
      { title: 'Recent on this Mac' },
      ...available.map((r) => ({ label: e(r.name), icon: 'doc', onSelect: () => LD.attachFiles('purpose', [r]) })),
      ...(available.length ? ['-'] : []),
      { label: 'Choose File…', icon: 'folder', kbd: '⌘O', onSelect: pickFiles }
    ], { minWidth: 250 });
  };
})();
