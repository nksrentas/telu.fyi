(() => {
  const esc = Catalog.esc;
  const D = T.doc;
  const [EO, EIO, ED] = ['[0.23, 1, 0.32, 1]', '[0.77, 0, 0.175, 1]', '[0.32, 0.72, 0, 1]'];
  const SPR = "{ type: 'spring', duration: 0.4, bounce: 0.12 }";
  const SPRB = "{ type: 'spring', duration: 0.5, bounce: 0.28 }";
  const SPEC = ['trigger', 'element', 'properties', 'enter', 'exit', 'sequence', 'interruptible', 'keyboard', 'reduced', 'notes'];
  const STATUS = '<span class="mb-item telu-status icon-only"><img src="../kit/telu-menubar.png" class="template-img" alt=""><span class="ts-text"></span></span>';
  const FLY_ICON = '<div class="app-icon fly-icon"><img src="../kit/telu-icon.png" alt=""></div>';
  const PREV = [['title', 'Title'], ['cadence', 'Repeats'], ['day', 'Day'], ['time', 'Time'], ['people', 'With']];
  const q = (root, sel) => root.querySelector(sel);
  const qa = (root, sel) => [...root.querySelectorAll(sel)];
  const node = (markup) => Kit.html(markup);
  const sc = (id, fn) => Catalog.withScenario(id, fn);
  const reduced = () => Kit.reduceMotion();
  const memo = (fn) => { let value; return () => value || (value = fn()); };
  const [timers, clocks, tokens, state] = [new WeakMap(), new WeakMap(), new WeakMap(), new WeakMap()];
  const fail = (c, error) => c.insertAdjacentHTML('beforeend', `<div class="cat-error">${esc(error.message)}</div>`);
  const guard = (c, fn) => (...args) => { try { return fn(...args); } catch (error) { return fail(c, error); } };
  const safe = (fn) => { try { return fn(); } catch (error) { return `<div class="cat-error">${esc(error.message)}</div>`; } };
  const seq = (c, steps) => { (timers.get(c) || []).forEach(clearTimeout); timers.set(c, steps.map(([ms, fn]) => setTimeout(guard(c, fn), ms))); };
  const clock = (c, el, from = 0) => { const stop = clocks.get(c); if (stop) stop(); clocks.set(c, el ? Kit.timer(el, from) : null); };
  const restart = (el, cls) => { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
  const force = (el, name, on) => el && el.classList.toggle(`is-${name}`, on);
  const press = (el, ms = 240) => { force(el, 'active', true); setTimeout(() => force(el, 'active', false), ms); };

  const PS = memo(() => {
    const pick = (id) => T.scenarioState(id).series.find((s) => s.id === 'product-sync');
    const [s, sA] = [pick('before'), pick('after')];
    const m = (series, id) => series.meetings.find((x) => x.id === id);
    return { s, sA, next: m(s, 'ps-37'), m36: m(s, 'ps-36'), m35: m(s, 'ps-35'), m34: m(s, 'ps-34'), done: m(sA, 'ps-37') };
  });
  const SERIES = memo(() => T.scenarioState('before').series.filter((s) => s.tracked));
  const SUM = () => T.set({ recording: null, summarizing: { meetingId: 'ps-37', seriesId: 'product-sync' } });
  const cardM = (id, sid = 'before', day = 1, patch) => sc(sid, () => { if (patch) patch(); return T.agenda.cardMarkup(T.eventById(id), day); });
  const rowM = (id, sid = 'before', day = 1, patch) => sc(sid, () => { if (patch) patch(); return T.agenda.rowMarkup(T.eventById(id), day); });
  const dayM = (day, n = 99) => sc('before', () => T.agenda.timelineMarkup(T.state.days[day].events.slice(0, n), day));
  const agendaM = (day = 1, n = 99) => `<div class="agenda-inner mo-view"><div class="a-timeline">${dayM(day, n)}</div></div>`;
  const NAV = [['sun', 'Today', 3], ['calendar', 'Upcoming', 0], ['tray', 'Review', 5], ['sparkles', 'Found in Calendar', 3]];
  const navM = (sel = 'Today') => `<nav class="a-sb-group">${NAV.map(([ico, label, n]) => `<div class="sb-item a-nav${label === sel ? ' selected' : ''}" data-nav="${label}">${icon(ico)}<span class="truncate">${label}</span><span class="count num">${n || ''}</span></div>`).join('')}</nav>`;
  const hint = (s) => (s.meetings ? sc('before', () => T.nextHint(s)) : '');
  const sRow = (s, sel = false, h = hint(s)) => `<div class="sb-item a-sb-row${sel ? ' selected' : ''}" data-series="${esc(s.id)}">${Kit.seriesIcon(s)}<span class="truncate a-sb-name">${esc(s.name)}</span><span class="a-hint num">${h}</span></div>`;
  const sideM = (sel = '', n = 6) => `${navM(sel ? '' : 'Today')}<div class="sb-title a-sb-title"><span>Series</span></div><div class="mo-series">${SERIES().slice(0, n).map((s) => sRow(s, s.id === sel)).join('')}</div>`;
  const agTb = (title = 'Today', sub = 'Tuesday, 29 September', slot = '') => `<div class="toolbar-title a-tb-title"><b>${title}</b><span>${sub}</span></div><div class="a-rec-slot">${slot}</div><span class="spacer"></span>`
    + `<div class="glass-group"><button class="btn icon" data-step="-1" data-tip="Previous day">${icon('chevron-left')}</button><button class="btn" data-step="0">Today</button><button class="btn icon" data-step="1" data-tip="Next day">${icon('chevron-right')}</button></div>`
    + `<div class="glass-group"><button class="btn a-new-btn">${icon('plus')}New<span class="kbd">⌥⌘N</span></button><span class="sep"></span><button class="btn icon" data-tip="Search">${icon('search')}</button></div><i class="a-progress"></i>`;
  const docTb = (s, back = '', show = false) => `${back ? `<button class="btn sm plain tb-back">${icon('chevron-left')}<span>${back}</span></button>` : ''}<div class="tb-title${show ? ' show' : ''}">${Kit.seriesIcon(s)}<b>${esc(s.name)}</b></div><span class="spacer"></span><span class="save-state">Saved</span>`
    + `<div class="glass-group"><button class="btn icon" data-tip="History">${icon('history')}</button><button class="btn icon" data-tip="Export as Markdown">${icon('share')}</button><span class="sep"></span><button class="btn tb-record"><span class="rec-glyph"></span>Record<span class="kbd">⌘R</span></button><button class="btn icon" data-tip="More">${icon('ellipsis')}</button></div>`;
  const winM = ({ h = 300, side = '', tb = '', view = '', extra = '', bar = false, main = '' }) => `<div class="desktop cat-desk mo-desk${bar ? ' bar' : ''}" style="height:${h}px">${bar ? Kit.menubar({ menus: ['File', 'Edit', 'View'], extras: STATUS }) : ''}`
    + `<div class="window cat-window t-app mo-win">${side ? `<div class="traffic"><i></i><i></i><i></i></div><aside class="sidebar">${side}</aside>` : ''}<section class="main ${main}"><div class="toolbar">${tb}</div><div class="content">${view}</div>${extra}</section></div></div>`;
  const morph = (card, markup, onSwap) => {
    const fresh = q(node(`<div>${markup}</div>`), '.a-card');
    card.className = fresh.className;
    card.style.cssText = fresh.style.cssText;
    qa(fresh, '[data-part]').forEach((part) => { const t = q(card, `[data-part="${part.dataset.part}"]`); if (t && t.innerHTML !== part.innerHTML) T.fx.crossfade(t, part.innerHTML, onSwap); });
  };
  const flipRows = (host, mutate) => {
    const before = new Map(qa(host, '[data-row]').map((el) => [el.dataset.row, el.getBoundingClientRect().top]));
    mutate();
    if (reduced()) return;
    qa(host, '[data-row]').forEach((el) => {
      const top = before.get(el.dataset.row);
      const dy = top === undefined ? 0 : top - el.getBoundingClientRect().top;
      if (Math.abs(dy) > 0.5) el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 320, easing: Kit.EASE_IN_OUT });
    });
  };
  const BLUR_OUT = [{ opacity: 1, filter: 'blur(0px)' }, { opacity: 0, filter: 'blur(2px)' }];
  const RISE_IN = [{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }];
  const slideK = (dir, entering) => (entering ? [{ opacity: 0, transform: `translateX(${16 * dir}px)` }, { opacity: 1, transform: 'none' }] : [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${-16 * dir}px)` }]);
  const swap = (el, apply, [outK, outMs, outE], [inK, inMs]) => {
    el.getAnimations().forEach((a) => a.cancel());
    if (reduced()) return apply();
    const token = (tokens.get(el) || 0) + 1;
    tokens.set(el, token);
    const out = el.animate(outK, { duration: outMs, easing: outE, fill: 'forwards' });
    return out.finished.then(() => { if (tokens.get(el) !== token) return; apply(); out.cancel(); el.animate(inK, { duration: inMs, easing: Kit.EASE_OUT }); }, () => {});
  };
  const chipVal = (p, k) => (k === 'people' ? (p.people || []).map((n) => n.split(' ')[0]).join(', ') : p[k] || '');
  const newPop = (text = '') => {
    const p = text ? Kit.parseSeries(text) : {};
    const chips = PREV.map(([k, l]) => `<span class="a-pchip${chipVal(p, k) ? '' : ' is-empty'}" data-k="${k}"><small>${l}</small><b>${esc(chipVal(p, k) || '—')}</b></span>`).join('');
    return `<div class="cat-static"><div class="popover a-newpop open mo-newpop"><div class="a-newser"><div class="a-new-head"><b>New series</b><span class="spacer"></span><span class="kbd">⌥⌘N</span></div><input class="field lg a-new-field" value="${esc(text)}" placeholder="Describe it — e.g. Weekly 1:1 with Priya, Thu 11am" spellcheck="false">`
      + `<div class="a-new-preview">${chips}</div><div class="a-new-foot"><button class="btn sm plain">${icon('link')}or link a calendar event…</button><span class="spacer"></span><button class="btn sm primary"${p.title ? '' : ' disabled'}>Create<span class="kbd">↩</span></button></div><p class="a-new-note">${icon('doc', 'sm')}Opens its living doc — purpose, memory and meetings in one place</p></div></div></div>`;
  };
  const paintChips = (c, text) => {
    const p = text.trim() ? Kit.parseSeries(text) : {};
    PREV.forEach(([k]) => {
      const [chip, value] = [q(c, `[data-k="${k}"]`), chipVal(p, k)];
      const b = q(chip, 'b');
      if (b.textContent === (value || '—')) return;
      chip.classList.toggle('is-empty', !value);
      b.textContent = value || '—';
      if (!reduced()) b.animate([{ opacity: 0.2, filter: 'blur(2px)' }, { opacity: 1, filter: 'blur(0px)' }], { duration: 180, easing: Kit.EASE_OUT });
    });
    q(c, '.a-new-foot .primary').disabled = !p.title;
  };
  const typeChips = (c, text) => { clearTimeout(tokens.get(c)); tokens.set(c, setTimeout(() => paintChips(c, text), 90)); };
  const CAPSULE = `<div class="a-rec-capsule"><span class="rec-dot"></span><b class="truncate">Product Sync</b><span class="num a-rec-time" data-rec-timer>12:04</span><button class="btn sm a-rec-stop">${icon('stop')}Stop</button></div>`;

  const kindOf = (ease, intr) => (intr === 'loop' ? 'loop' : ease === '—' ? 'delay' : ease === 'instant' ? 'instant' : /spring/.test(ease) ? 'spring' : 'ease');
  const track = (rows) => {
    const list = rows.filter(([, ms, ease]) => !(ease === '—' && ms > 1500));
    const end = Math.max(100, ...list.map(([, ms, , , at = 0]) => ms + at));
    const span = end <= 400 ? 400 : end <= 1000 ? 1000 : Math.ceil(end / 1000) * 1000;
    const bar = ([name, ms, ease, intr, at = 0]) => `<div class="mo-tr"><span class="truncate" title="${esc(name)}">${esc(name)}</span><span class="mo-lane"><i data-k="${kindOf(ease, intr)}" style="left:${(at / span) * 100}%;width:${(ms / span) * 100}%"></i></span><span class="num">${at ? `+${at} ` : ''}${ms ? `${ms}ms` : 'instant'}</span></div>`;
    return { label: 'Timeline', note: `Phases to scale on a 0–${span}ms axis · hatched = wait, grey = loop period`, span: 2, align: 'stretch', html: `<div class="mo-track">${list.map(bar).join('')}</div>` };
  };
  const demo = ({ html, run, init, ctrls = [], low, ...tile }) => ({
    span: 2,
    ...tile,
    html: () => safe(() => `${typeof html === 'function' ? html() : html}${run || ctrls.length ? `<div class="mo-bar${(low ?? tile.flush) ? ' low' : ''}">${ctrls.map(([label], i) => `<button class="btn sm" data-ctrl="${i}">${label}</button>`).join('')}${run ? `<button class="btn sm" data-replay>${icon('play')}Replay</button>` : ''}</div>` : ''}`),
    mount: (c) => {
      qa(c, '.mo-win .main').forEach((m) => Kit.scrollEdge(q(m, '.content'), q(m, '.toolbar')));
      ctrls.forEach(([, fn], i) => q(c, `[data-ctrl="${i}"]`).addEventListener('click', guard(c, () => fn(c))));
      if (run) q(c, '[data-replay]').addEventListener('click', guard(c, () => run(c)));
      if (init) init(c);
    }
  });
  const E = (d) => ({ ...d, props: SPEC.filter((k) => d[k]).map((k) => [k, d[k], '']), stories: [...(d.stories || []), ...(d.timing ? [track(d.timing)] : [])] });

  const RULES = [
    ['Keyboard navigation is instant', '↑/↓ moves the selection ring and swaps the peek, ←/→ steps days, Enter opens the peek (.instant), ⌘W / ⌥Space hide and show the window — none of it animates. Keyboard commands that change state (⌘R) animate that change like a click.', 'Sliding the peek or the day on every arrow press.'],
    ['Enter with ease-out, 150–260ms', 'Popover 190 · alert 220 · capsule 240 · sheet 260 · onboarding 260 on --ease-out; panels 300 on --ease-drawer; list inserts 280.', 'ease-in or linear entrances; 400ms+ for UI the user just asked for.'],
    ['Exit faster than you enter', 'Popover 190→110 · alert 220→140 · sheet 260→160 · toast 340→180 · peek 300→200 · onboarding 260→160 · capsule 240→150 · Island content 90.', 'Symmetric exits that make dismissing feel slow.'],
    ['Springs only for morphs, landings and drag', 'Island shell (--spring ≈ duration 0.4 / bounce 0.12), notification arrival, switch knob and “Attached” (--spring-bounce ≈ 0.5 / 0.28).', 'Springing menus, toasts, page swaps or anything that only fades.'],
    ['Never from scale(0)', 'Start at 0.92–0.98 with opacity 0: popover and sheet 0.96, alert 0.95, toast 0.98, Island layer 0.97, onboarding 0.96; flights shrink no further than 0.4.', 'Growing a surface out of a point.'],
    ['Origin-aware popovers, instant menus', 'Kit.position puts --origin at the trigger’s centre on the edge facing it. Menus appear at full opacity and only fade out, after a 60ms selection blink.', 'Scaling popovers from their own centre, or animating menus in.'],
    ['Transform and opacity', 'Plus ≤ 2px blur to mask crossfades, grid-rows for collapsibles and height only inside Kit.enterAnimated / removeAnimated. The Island’s width/height spring is the one deliberate layout animation.', 'Animating top/left, margins, shadow spread or font size.'],
    ['Interruptible by default', 'State toggles are CSS transitions that retarget mid-flight (peek, drawer, popover, Island, collapsible). WAAPI one-shots cancel the running animation and a token drops stale swaps (day slide, page paint).', 'Queued animations that must finish before the next click counts.'],
    ['Stagger 30–50ms, never block', 'Agenda rows 40ms, morphAll 40ms, chip-in 40ms; Accept all uses 70ms so each item visibly lands in Memory. Input stays live throughout.', 'Staggers that delay the first item or lock the list until the last lands.'],
    ['Press feedback on everything pressable', 'The scale tightens as the target grows: check 0.88 · source 0.96 · buttons and chips 0.97 · sidebar rows 0.985 · cards 0.992. Hover styles only on (hover: hover) and (pointer: fine).', 'Hover-only feedback, or one scale for every size.'],
    ['Loops mean status', 'Rec dot, waveform, shimmer and spinner loop only while their state is true; a paused recording freezes them in place.', 'Decorative loops that compete with the content.'],
    ['Reduced motion keeps meaning, drops movement', 'The kit limits transitions to opacity and colour and turns off decorative keyframes; JS paths check Kit.reduceMotion(). Status loops keep running and receive highlights stay.', 'Removing every cue, or leaving slides and flights on.']
  ];
  const rulesHtml = () => `<div class="mo-rules">${RULES.map(([title, yes, no], i) => `<div class="mo-rule"><b><span class="num">${i + 1}</span>${esc(title)}</b><p>${icon('check')}<span>${esc(yes)}</span></p><p class="no">${icon('x')}<span>${esc(no)}</span></p></div>`).join('')}</div>`;
  const pairPop = (origin) => `<div class="cat-static"><div class="popover open mo-pop" style="transform-origin:${origin}"><div class="pop"><div class="pop-row">${icon('calendar-check')}<div><b>Linked to Calendar</b><div class="muted">Work · “Product Sync”</div></div></div></div></div></div>`;
  const LADDER = memo(() => [
    ['0.992 · card · 160ms', cardM('t4')], ['0.985 · sidebar row · 140ms', `<div class="t-app mo-sb">${sRow(PS().s)}</div>`], ['0.97 · chip · 140ms', `<button class="chip meta-chip">${icon('repeat')}Every Tue · 10:00</button>`],
    ['0.96 · source · 140ms', `<span class="doc-surface">${Kit.source('Sep 22 · 18:42')}</span>`], ['0.88 · check · 140ms', `<button class="check" data-manual aria-checked="true" aria-label="Done">${Kit.checkSvg}</button>`]
  ]);
  const calRow = (cal) => `<div class="sb-item a-cal${cal.watched ? '' : ' is-off'}"><button class="check square a-cal-check" data-manual aria-checked="${cal.watched}" style="--cal:${cal.color}" tabindex="-1">${Kit.checkSvg}</button><span class="a-cal-text"><span class="truncate">${esc(cal.name)} · ${esc(cal.account)}</span><small class="a-cal-cap">Not watched</small></span></div>`;
  const calToggle = (b) => { const on = b.getAttribute('aria-checked') !== 'true'; b.setAttribute('aria-checked', String(on)); b.closest('.a-cal').classList.toggle('is-off', !on); };
  const POP_RULE = `<div class="pop"><div class="pop-row">${icon('calendar-check')}<div><b>Linked to Calendar</b><div class="muted">Work · “Product Sync”</div></div></div><div class="pop-sub num">Every Tue · 10:00</div><div class="pop-actions"><button class="btn sm">Change…</button><button class="btn sm plain">Unlink</button></div></div>`;
  const popHist = () => `<div class="pop"><div class="pop-title">Purpose history</div>${PS().s.purpose.history.map((h, i) => `<div class="hist-row${i ? '' : ' current'}"><span class="hist-v num">v${h.v}</span><div class="hist-main"><span>${esc(h.note)}</span><span class="faint">${esc(h.date)}</span></div>${i ? '' : '<span class="chip accent">Current</span>'}</div>`).join('')}</div>`;
  const openPop = (c, right) => Kit.popover(q(c, right ? '.mo-pr' : '.mo-pl'), right ? popHist() : POP_RULE, { width: 300, align: right ? 'end' : 'start' });
  const MENU = () => [{ title: `${PS().m35.date} · #${PS().m35.n}` }, { label: 'Move to another series…', icon: 'folder' }, { label: 'Split into new doc', icon: 'doc-plus' }, { label: 'Open transcript', icon: 'quote' }, '-', { label: 'Remove from this doc', icon: 'tray' }, { label: 'Delete meeting…', icon: 'trash', danger: true }];
  const openMenu = (c) => Kit.menu(q(c, '.mtg-more'), MENU(), { align: 'end', minWidth: 230 });
  const menuKey = (c, key) => () => { const m = q(c, '.menu:not(.closing)'); if (m) m.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })); };
  const SHEET = '<div class="sheet-head"><h2>Export Product Sync</h2><p>A Markdown copy of the purpose, memory and every meeting, saved on this Mac.</p></div><div class="sheet-body"><input class="field lg mo-full" value="Product Sync.md" spellcheck="false"></div><div class="sheet-foot"><button class="btn" data-close>Cancel</button><button class="btn primary" data-close="ok">Export</button></div>';
  const openAlert = (c) => {
    const open = q(c, '.alert.open [data-i="0"]');
    if (open) open.click();
    Kit.alert({ title: 'Stop tracking Product Sync?', message: 'Telu keeps its memory and past meetings, but won’t prepare briefs for new ones.', buttons: [{ label: 'Cancel', value: 'cancel' }, { label: 'Stop Tracking', value: 'stop', primary: true }], container: q(c, '.window') });
  };
  const VIEWS = { Today: ['Tuesday, 29 September', () => `<div class="a-timeline">${dayM(1)}</div>`], Upcoming: ['Next few days', () => sc('before', () => T.pages.upcomingMarkup())], Review: ['5 items need a look', () => sc('before', () => T.pages.reviewMarkup())], 'Found in Calendar': ['3 suggestions · decide once', () => sc('before', () => T.pages.foundMarkup())] };
  const goView = (c, label) => {
    const host = q(c, '.mo-view');
    qa(c, '.a-nav').forEach((el) => el.classList.toggle('selected', el.dataset.nav === label));
    q(c, '.a-tb-title b').textContent = label;
    q(c, '.a-tb-title span').textContent = VIEWS[label][0];
    host.innerHTML = VIEWS[label][1]();
    q(c, '.content').scrollTop = 0;
    T.fx.fadeIn(host, { duration: 200 });
  };
  const DAYS = memo(() => sc('before', () => T.state.days.map((d, i) => ({ label: d.label, long: d.long, html: `<div class="a-timeline">${T.agenda.timelineMarkup(d.events, i)}</div>` }))));
  const stepDay = (c, delta, animate = true) => {
    const cur = state.has(c) ? state.get(c) : 1;
    const next = delta === 0 ? 1 : cur + delta;
    if (next < 0 || next > 2 || next === cur) return undefined;
    const [d, host, dir] = [DAYS()[next], q(c, '.mo-view'), Math.sign(next - cur)];
    state.set(c, next);
    q(c, '.a-tb-title b').textContent = d.label;
    q(c, '.a-tb-title span').textContent = d.long;
    q(c, '[data-step="-1"]').disabled = next === 0;
    q(c, '[data-step="1"]').disabled = next === 2;
    const apply = () => { host.innerHTML = d.html; q(c, '.content').scrollTop = 0; };
    if (animate) return swap(host, apply, [slideK(dir, false), 140, Kit.EASE_OUT], [slideK(dir, true), 220]);
    host.getAnimations().forEach((a) => a.cancel());
    return apply();
  };
  const progress = (c) => {
    const bar = q(c, '.a-progress');
    bar.getAnimations().forEach((a) => a.cancel());
    bar.animate([{ transform: 'scaleX(0)', opacity: 1 }, { transform: 'scaleX(1)', opacity: 1 }], { duration: 900, easing: 'linear', fill: 'forwards' }).finished
      .then(() => bar.animate([{ opacity: 1, transform: 'scaleX(1)' }, { opacity: 0, transform: 'scaleX(1)' }], { duration: 220, easing: 'ease-out', fill: 'forwards' }).finished).catch(() => {});
  };
  const CARD = memo(() => [['Before · 9:41', rowM('t2')], ['Starting · 10:00', rowM('t2', 'starting')], ['Recording · 10:12', rowM('t2', 'live')], ['Summarizing', rowM('t2', 'live', 1, SUM)], ['After · 10:46', rowM('t2', 'after')]]);
  const cardStep = (c, [label, markup], i) => () => {
    const host = q(c, '.mo-one');
    const tick = () => clock(c, q(c, '[data-rec-timer]'), 724);
    q(c, '.mo-state').textContent = label;
    if (i && i < 4) { morph(q(host, '.a-card'), markup, tick); return; }
    host.innerHTML = markup;
    tick();
    if (i) T.fx.fadeIn(q(host, '.a-card'), { duration: 240 });
  };
  const STANDUP = memo(() => [cardM('w1', 'before', 2), cardM('w1', 'before', 2, () => T.addStandupSeries())]);
  const capsuleOut = (c) => {
    const cap = q(c, '.a-rec-capsule');
    clock(c, null);
    if (cap && reduced()) cap.remove();
    else if (cap) cap.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(0.96)' }], { duration: 150, easing: 'ease-out', fill: 'forwards' }).finished.then(() => cap.remove());
  };
  const capsuleIn = (c) => {
    q(c, '.a-rec-slot').innerHTML = CAPSULE;
    const cap = q(c, '.a-rec-capsule');
    clock(c, q(cap, '[data-rec-timer]'), 0);
    if (!reduced()) cap.animate([{ opacity: 0, transform: 'scale(0.96)', filter: 'blur(2px)' }, { opacity: 1, transform: 'none', filter: 'blur(0px)' }], { duration: 240, easing: Kit.EASE_OUT });
  };

  const entries = [
    E({ id: 'button-press', name: 'Button · press', summary: 'The button answers the pointer the moment it goes down. Pressing is acknowledgement, so it is small (3%) and quick.',
      trigger: 'pointer down on any .btn (:active); hover background only on (hover: hover) and (pointer: fine)', element: '.btn — default, primary, record, tinted, plain, icon; buttons inside .glass-group', properties: 'transform scale(1) → scale(0.97) · background-color → --fill-3 on hover (primary → --accent-strong, record → --coral-ink)',
      enter: 'transform 140ms var(--ease-out) · background-color, box-shadow, color 150ms ease', exit: 'the same transition reverses on release', interruptible: 'yes — CSS transition, retargets mid-press', keyboard: 'Space / Enter activate with no scale; the focus ring (3px accent at 45%) appears instantly', reduced: 'scale applies without a tween; colours still fade',
      motion: 'scale(0.97) while pressed, 140ms --ease-out; hover background 150ms ease on fine pointers only', mapsTo: `shadcn Button (cva): transition-[transform,background-color,box-shadow,color] active:scale-[0.97], transform 140ms var(--ease-out) — framer-motion alternative: whileTap={{ scale: 0.97 }} transition={{ duration: 0.14, ease: ${EO} }}`,
      source: 'kit/mac-kit.css .btn, .btn:active, @media (hover: hover) .btn:hover', tokens: ['--ease-out', '--fill-3', '--accent-strong', '--coral-ink'], usedIn: ['Everywhere'], timing: [['press', 140, '--ease-out', 'yes'], ['hover background', 150, 'ease', 'yes']],
      stories: [demo({ label: 'Press any button', note: 'Replay presses each one through the real :active rule', height: 150,
        html: `<div class="row-flex mo-press"><button class="btn">Not now</button><button class="btn primary">Track 5 series</button><button class="btn record">${icon('record')}Record<span class="kbd">⌘R</span></button><button class="btn tinted">Review</button><div class="glass-group"><button class="btn icon" aria-label="Previous day">${icon('chevron-left')}</button><button class="btn">Today</button><button class="btn icon" aria-label="Next day">${icon('chevron-right')}</button></div></div>`,
        run: (c) => seq(c, qa(c, '.mo-press .btn').map((b, i) => [i * 220, () => press(b)])) })] }),
    E({ id: 'surface-press', name: 'Cards, rows & chips · press', summary: 'Bigger surfaces move less: the press scale tightens as the target grows, so a card and a checkbox feel equally responsive.',
      trigger: 'pointer down on any clickable surface', element: '.card.interactive / .a-card · .t-app .sb-item · button.meta-chip, button.doc-chip, .pk-series, .island button.chip · .source · .scrub-item · .check · .island[data-shape="pill"]', properties: 'transform scale → 0.992 card · 0.985 sidebar row · 0.97 chips, peek series link, Island pill · 0.96 doc source chip, scrubber item · 0.95 Island source chip · 0.88 checkbox; card hover → --shadow-card-hover',
      enter: 'cards 160ms var(--ease-out) · rows, chips, sources, check 140ms var(--ease-out) · Island pill 180ms var(--ease-out) · card hover shadow 200ms ease', exit: 'reverses on release', interruptible: 'yes — CSS transitions', keyboard: '↑/↓ moves the selection ring (.is-selected::after, 2px accent) instantly — no press, no fade', reduced: 'scale snaps; the hover shadow still fades',
      motion: 'press scale 0.992 → 0.88 from the largest to the smallest target, 140–160ms --ease-out', mapsTo: `whileTap={{ scale: 0.992 }} on cards, 0.985 on sidebar rows, 0.97 on chips, 0.96 on source chips, 0.88 on checkboxes, transition={{ duration: 0.14, ease: ${EO} }} (cards 0.16) — Tailwind active:scale-[0.992] transition-transform`,
      source: 'kit .card.interactive, .check:active · 002 app.css .t-app .sb-item, .pk-series · doc.css button.meta-chip, button.doc-chip, .scrub-item, .doc-surface .source · island.css .island[data-shape="pill"], .island .source', tokens: ['--ease-out', '--shadow-card-hover'], timing: [['card', 160, '--ease-out', 'yes'], ['row / chip / check', 140, '--ease-out', 'yes'], ['Island pill', 180, '--ease-out', 'yes'], ['card hover shadow', 200, 'ease', 'yes']],
      stories: [demo({ label: 'Press scale ladder', note: 'Replay presses each target in turn', span: 'full', height: 200,
        html: () => `<div class="mo-ladder">${LADDER().map(([label, markup]) => `<div class="mo-rung"><div class="mo-rung-t">${markup}</div><span class="t-caption">${label}</span></div>`).join('')}</div>`,
        run: (c) => seq(c, ['.a-card', '.sb-item', '.meta-chip', '.source', '.check'].map((sel, i) => [i * 340, () => press(q(c, sel), 280)])) })] }),
    E({ id: 'hover-reveal', name: 'Hover · reveal actions', summary: 'Secondary actions stay quiet until the pointer asks for them, then fade in place — nothing moves, so the layout never shifts.',
      trigger: 'pointer over the parent, only under (hover: hover) and (pointer: fine); touch shows the actions permanently (@media not all and (hover: hover))', element: '.a-card .a-hover (Track · Add to series · Review) · .a-sb-title .a-sb-add · .mtg-head .grip · .ask-row .ask-add · hover backgrounds on .btn, .source, .editable, .mtg-head', properties: 'opacity 0 → 1 (pointer-events none → auto) · background-color',
      enter: 'opacity 150ms ease', exit: 'opacity 150ms ease', interruptible: 'yes — CSS transitions', keyboard: 'focus-visible reveals .a-sb-add and .ask-add at once; a selected card (.is-selected) shows its actions without hover', reduced: 'unchanged — opacity only',
      motion: 'opacity 150ms ease on the revealed control; the parent’s hover background 150ms ease', mapsTo: 'Tailwind group: opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150, with future.hoverOnlyWhenSupported so touch never sticks',
      source: '002 app.css .a-hover, .a-sb-add, @media not all and (hover: hover) · doc.css .grip, .ask-add, .mtg-head:hover', tokens: ['--fill'], timing: [['reveal', 150, 'ease', 'yes']],
      stories: [demo({ label: 'Card actions · Series + · meeting grip', note: 'Replay forces the real :hover rules one after another', span: 'full', height: 170,
        html: () => `<div class="mo-hover"><div class="a-timeline">${rowM('w1', 'before', 2)}</div><div class="t-app mo-sb"><div class="sb-title a-sb-title"><span>Series</span><button class="btn plain icon a-sb-add" aria-label="New series">${icon('plus')}</button></div>${sRow(PS().s)}</div><div class="doc-surface mo-grip"><div class="past-list">${sc('before', () => D.meetingMarkup(PS().s, PS().m34))}</div></div></div>`,
        run: (c) => { const els = ['.a-card', '.a-sb-title', '.mtg-head'].map((s) => q(c, s)); seq(c, [...els.map((el, i) => [i * 450, () => force(el, 'hover', true)]), [2600, () => els.forEach((el) => force(el, 'hover', false))]]); } })] }),
    E({ id: 'segmented', name: 'Segmented control · thumb', summary: 'The selection indicator travels to the new option, so the eye follows the choice instead of hunting for it.',
      trigger: 'click a segment (Kit.segmented)', element: '.seg > .seg-thumb — Repeats (None / Weekly / Every 2 weeks / Monthly) in a draft doc; the catalog’s Light / Dark switch', properties: 'thumb transform translateX(button.offsetLeft) and width (button.offsetWidth) · label color --label-2 → --label',
      enter: 'transform + width 240ms var(--ease-out) · label color 160ms ease', interruptible: 'yes — retargets from the current position', keyboard: 'set(value, { animate: false }) places the thumb with transition: none (first paint); a parsed title updates it animated but silent', reduced: 'thumb jumps; label colour still fades', notes: 'width is the one layout property here — acceptable on a 24px-tall element; production can use a shared-layout thumb instead',
      motion: 'thumb slides + resizes 240ms --ease-out; label colour 160ms ease', mapsTo: `Radix ToggleGroup (type="single") + framer-motion shared layout: {selected && <motion.span layoutId="seg-thumb" transition={{ duration: 0.24, ease: ${EO} }} />} inside the active item`,
      source: 'kit/mac-kit.js Kit.segmented · mac-kit.css .seg-thumb · 002 doc-render.js repeatsMarkup, doc-organize.js D.mountDraft', tokens: ['--ease-out', '--content-bg'], timing: [['thumb', 240, '--ease-out', 'yes'], ['label color', 160, 'ease', 'yes']],
      stories: [demo({ label: 'Repeats', note: 'Click a segment or Replay', height: 150,
        html: `<div class="repeats"><span class="repeats-label">Repeats</span><div class="seg">${['None', 'Weekly', 'Every 2 weeks', 'Monthly'].map((v) => `<button data-value="${v}" aria-selected="${v === 'Weekly'}">${v}</button>`).join('')}</div></div>`,
        init: (c) => Kit.segmented(q(c, '.seg')), run: (c) => seq(c, [2, 3, 0, 1].map((i, n) => [n * 420, () => qa(c, '.seg > button')[i].click()])) })] }),
    E({ id: 'switch', name: 'Switch · knob spring', summary: 'The knob lands with a small overshoot — a physical “click” that confirms the setting took.',
      trigger: 'click (the kit’s global handler flips aria-checked and emits a toggle event)', element: '.switch::after (knob) and the .switch track — onboarding “which conversations” rows, Reference popover “Include in every brief”', properties: 'knob transform translateX(0 → 14px) · track background-color --fill-3 → --accent',
      enter: 'knob var(--spring-bounce-dur) var(--spring-bounce) — 600ms, bounce 0.28 (overshoots ≈ 3.8%) · track 200ms ease', exit: 'the same curve back', interruptible: 'yes — CSS transition', keyboard: 'Space toggles with the same spring — it is the state change itself, not navigation', reduced: 'knob jumps; track colour still fades',
      motion: 'knob springs 14px with --spring-bounce (600ms); track colour 200ms ease', mapsTo: `Radix Switch; thumb <motion.span layout transition={${SPRB}} /> — or CSS transform var(--spring-bounce-dur) var(--spring-bounce) on the thumb`,
      source: 'kit/mac-kit.css .switch, .switch::after · 002 app-onboard.js detectedRow · doc-popovers.js D.refPopover', tokens: ['--spring-bounce', '--spring-bounce-dur', '--accent', '--fill-3'], timing: [['knob', 600, '--spring-bounce', 'yes'], ['track', 200, 'ease', 'yes']],
      stories: [demo({ label: 'Onboarding rows', note: 'Click a switch or Replay · the third is disabled', height: 190,
        html: () => `<div class="mo-list">${['product-sync', 'maria', 'board'].map((id, i) => { const s = Kit.series(id); return `<div class="ob-row">${Kit.seriesIcon(s)}<div class="ob-row-main"><b class="truncate">${esc(s.name)}</b><span class="truncate">${esc(s.rule)}</span></div><button class="switch" aria-checked="${i !== 1}" aria-label="Remember ${esc(s.name)}"${i === 2 ? ' disabled' : ''}></button></div>`; }).join('')}</div>`,
        run: (c) => seq(c, qa(c, '.switch:not(:disabled)').map((b, i) => [i * 320, () => b.click()])) })] }),
    E({ id: 'checkbox', name: 'Checkbox · stroke draw', summary: 'The fill arrives first and the check mark draws itself a beat later, so “done” reads as an action completed.',
      trigger: 'click (.check flips aria-checked; data-manual rows own their state)', element: '.check (round), .check.square, .a-cal-check (calendar colour), .agenda-item.done', properties: 'background-color / inset ring → fill · svg stroke-dashoffset 14 → 0 · press scale(0.88) · agenda text colour → --label-3 and line-through (instant)',
      enter: 'fill 160ms ease · stroke 220ms var(--ease-out) after 40ms · press 140ms var(--ease-out)', exit: 'stroke retracts 220ms (40ms delay) while the fill clears 160ms', interruptible: 'yes — CSS transitions', keyboard: 'Space toggles the same way', reduced: 'the mark appears at once (stroke-dashoffset is not transitioned); the fill still fades',
      motion: 'fill 160ms ease, then the mark draws 220ms --ease-out (+40ms)', mapsTo: `Radix Checkbox + <motion.path initial={{ pathLength: 0 }} animate={{ pathLength: checked ? 1 : 0 }} transition={{ duration: 0.22, delay: 0.04, ease: ${EO} }} />`,
      source: 'kit/mac-kit.css .check, .check svg · 002 app.css .a-cal-check · doc.css .agenda-item.done · doc-edit.js D.onToggle', tokens: ['--accent', '--label-4', '--ease-out'], timing: [['fill', 160, 'ease', 'yes'], ['stroke draw', 220, '--ease-out', 'yes', 40], ['press', 140, '--ease-out', 'yes']],
      stories: [demo({ label: 'Round · square · calendar · agenda item', note: 'Click any box or Replay', height: 150,
        html: () => `<div class="mo-checks"><button class="check" aria-checked="false" aria-label="Done">${Kit.checkSvg}</button><button class="check square" aria-checked="false" aria-label="Done">${Kit.checkSvg}</button><div class="t-app mo-sb">${calRow(DATA.calendars[0])}</div><div class="doc-surface mo-agenda"><div class="agenda">${D.agendaItem({ t: 'Metrics pulse', d: '5m' }, 0)}</div></div></div>`,
        init: (c) => { c.addEventListener('toggle', (e) => { const item = e.target.closest('.agenda-item'); if (item) item.classList.toggle('done', e.detail.checked); }); q(c, '.a-cal-check').addEventListener('click', (e) => calToggle(e.currentTarget)); },
        run: (c) => seq(c, qa(c, '.check').map((b, i) => [i * 260, () => b.click()])) })] }),
    E({ id: 'tooltip', name: 'Tooltip · delay, then instant', summary: 'Tooltips wait long enough not to ambush a passing pointer; once one is open, neighbours answer immediately so scanning a toolbar is fast.',
      trigger: 'pointerover [data-tip]; first show after 650ms; while one is visible or within 600ms of the last hide (“warm”) the next shows instantly', element: '.tooltip — one global element, fixed, 6px below the target, origin top center', properties: 'opacity 0 → 1 · transform scale(0.97) → none',
      enter: 'cold: 125ms var(--ease-out) after the 650ms wait · warm: 0ms (.instant)', exit: '125ms var(--ease-out) on pointerout; hidden immediately on pointerdown', interruptible: 'yes — leaving before 650ms cancels the timer', keyboard: 'pointer-only in the prototype; labels also live in aria-label', reduced: 'scale snaps; opacity fades',
      motion: '650ms wait, 125ms --ease-out fade/scale from 0.97; warm tooltips appear with no delay and no transition', mapsTo: `Radix Tooltip with <TooltipProvider delayDuration={650} skipDelayDuration={600}>; content initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: warm ? 0 : 0.125, ease: ${EO} }} style={{ transformOrigin: 'top center' }}`,
      source: 'kit/mac-kit.js tooltips() · mac-kit.css .tooltip, .tooltip.show, .tooltip.instant', tokens: ['--glass-strong', '--shadow-float', '--ease-out'], timing: [['cold delay', 650, '—', 'cancels'], ['show / hide', 125, '--ease-out', 'yes', 650], ['warm window', 600, '—', '—'], ['warm show', 0, 'instant', '—']],
      stories: [demo({ label: 'Doc toolbar group', note: 'Hover, or Replay: cold → warm → warm', bg: 'wallpaper', height: 150,
        html: `<div class="glass-group">${[['history', 'History'], ['share', 'Export as Markdown'], ['ellipsis', 'More']].map(([i, tip]) => `<button class="btn icon" data-tip="${tip}" aria-label="${tip}">${icon(i)}</button>`).join('')}</div>`,
        run: (c) => { const [a, b, d] = qa(c, '[data-tip]'); const ev = (el, type) => el.dispatchEvent(new PointerEvent(type, { bubbles: true })); seq(c, [[0, () => ev(a, 'pointerover')], [1400, () => { ev(a, 'pointerout'); ev(b, 'pointerover'); }], [2100, () => { ev(b, 'pointerout'); ev(d, 'pointerover'); }], [2800, () => ev(d, 'pointerout')]]); } })] }),
    E({ id: 'popover', name: 'Popover · origin-aware scale', summary: 'The popover grows out of the control that opened it, so it is obviously “about” that control.',
      trigger: 'click a trigger (Kit.popover): New series, Search, rule and people chips, History, source chips (evidence), Island evidence', element: '.popover (glass) with transform-origin var(--origin) = trigger centre x (clamped 12px from the edges), y = 0 below or its height when flipped above', properties: 'opacity 0 → 1 · transform scale(0.96) → none',
      enter: 'opacity 150ms, transform 190ms var(--ease-out); .open is added on the next frame', exit: '.closing → opacity and transform 110ms; removed after 140ms; the same trigger toggles it closed', interruptible: 'yes — CSS transitions (outside click or Esc mid-open reverses)', keyboard: '⌥⌘N / ⌘F open the same popovers with the same 190ms scale (002 behaviour — production may open keyboard-summoned popovers instantly); Esc closes via the kit layer stack', reduced: 'opacity only',
      motion: 'scale 0.96 → 1 from the trigger, 190ms --ease-out; closes in 110ms', mapsTo: `Radix Popover + <motion.div style={{ transformOrigin: 'var(--radix-popover-content-transform-origin)' }} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.11 } }} transition={{ duration: 0.19, ease: ${EO}, opacity: { duration: 0.15 } }} />`,
      source: 'kit/mac-kit.js popover(), position() · mac-kit.css .popover, .popover.open, .popover.closing · 002 doc-popovers.js, app-flows.js', tokens: ['--ease-out', '--glass-strong', '--shadow-float'], timing: [['open', 190, '--ease-out', 'yes'], ['close', 110, '--ease-out', 'yes']],
      stories: [demo({ label: 'Two origins', note: 'From the left chip it grows from the left; from History it grows from the right', flush: true,
        html: `<div class="desktop cat-desk panel-host mo-desk" style="height:250px"><button class="chip meta-chip mo-pl">${icon('repeat')}Every Tue · 10:00</button><button class="btn sm plain mo-pr">${icon('history')}History</button></div>`,
        init: (c) => { q(c, '.mo-pl').addEventListener('click', () => openPop(c, false)); q(c, '.mo-pr').addEventListener('click', () => openPop(c, true)); },
        run: (c) => { let pop = null; seq(c, [[0, () => { pop = openPop(c, false); }], [1500, () => pop && pop.close()], [1900, () => { pop = openPop(c, true); }], [3400, () => pop && pop.close()]]); } })] }),
    E({ id: 'menu', name: 'Menu · instant open, blink, fade', summary: 'Menus are tools you open many times a day: they appear instantly, confirm the choice with a blink and get out of the way.',
      trigger: 'click a trigger or right-click (Kit.menu / Kit.contextMenu); menu-bar menus', element: '.menu (glass) · .menu-item.active', properties: 'open: none — full opacity at once · choose: the active row turns off, back on after 60ms · close: opacity 1 → 0',
      enter: 'instant (0ms)', exit: 'choose → blink at 60ms → close at 130ms (.closing, opacity 120ms ease), removed after 130ms; opening another menu closes this one instantly', interruptible: 'n/a — there is nothing to interrupt on open', keyboard: '↑/↓ move the highlight instantly (disabled rows skipped), Enter chooses with the same blink, Esc closes', reduced: 'unchanged (opacity only)',
      motion: 'no enter animation; selection blink 60ms; fade out 120ms ease', mapsTo: 'Radix DropdownMenu / ContextMenu with no enter animation; onSelect: preventDefault, toggle data-highlighted off → on at 60ms, close at 130ms; content exit={{ opacity: 0, transition: { duration: 0.12, ease: "easeInOut" } }}',
      source: 'kit/mac-kit.js menu(), choose(), contextMenu() · mac-kit.css .menu, .menu.closing · 002 doc-organize.js D.meetingMenu', tokens: ['--accent', '--glass-strong'], timing: [['open', 0, 'instant', '—'], ['select blink', 60, 'step', 'no'], ['close fade', 120, 'ease', 'no', 130]],
      stories: [demo({ label: 'Meeting ⋯ menu', note: 'Replay: open, ↓ ↓ (instant), Enter (blink + fade)', flush: true,
        html: () => `<div class="panel-host mo-host" style="--h:270px"><div class="doc-surface mo-doc"><div class="past-list">${sc('before', () => D.meetingMarkup(PS().s, PS().m35))}</div></div></div>`,
        init: (c) => q(c, '.mtg-more').addEventListener('click', () => openMenu(c)),
        run: (c) => seq(c, [[0, () => openMenu(c)], [700, menuKey(c, 'ArrowDown')], [1000, menuKey(c, 'ArrowDown')], [1700, menuKey(c, 'Enter')]]) })] }),
    E({ id: 'sheet', name: 'Sheet · scale in over a scrim', summary: 'A window-modal dialog: the scrim dims the window while the sheet settles from 96%, so focus clearly moves into it.',
      trigger: 'Kit.sheet(markup) — the kit’s window-modal dialog (002 flows use alerts; the content here is illustrative)', element: '.scrim (window-wide) + .sheet (centred glass)', properties: 'scrim opacity 0 → 1 · sheet opacity 0 → 1, transform translate(-50%, -50%) scale(0.96) → scale(1)',
      enter: 'scrim 220ms ease · sheet opacity 200ms, transform 260ms var(--ease-out); autofocus after 60ms', exit: '.closing → opacity 140ms, transform 160ms; scrim 220ms; removed after 200ms', interruptible: 'yes — CSS transitions', keyboard: 'Esc closes (kit layer stack); [data-close] buttons close with a result', reduced: 'opacity only',
      motion: 'sheet 0.96 → 1 in 260ms --ease-out over a 220ms scrim; exits in 160ms', mapsTo: `Radix Dialog: overlay <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }} />; content initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.16 } }} transition={{ duration: 0.26, ease: ${EO}, opacity: { duration: 0.2 } }}`,
      source: 'kit/mac-kit.js sheet() · mac-kit.css .scrim, .sheet, .sheet.closing', tokens: ['--scrim', '--glass-strong', '--shadow-window', '--ease-out'], timing: [['open', 260, '--ease-out', 'yes'], ['scrim', 220, 'ease', 'yes'], ['close', 160, '--ease-out', 'yes']],
      stories: [demo({ label: 'Window-modal sheet', note: 'Replay opens it and presses Cancel', flush: true, html: () => winM({ h: 300, tb: agTb(), view: agendaM(1, 3) }),
        run: (c) => { const api = Kit.sheet(SHEET, { container: q(c, '.window'), width: 380 }); seq(c, [[1800, () => api.close()]]); } })] }),
    E({ id: 'alert', name: 'Alert · appear & dismiss', summary: 'Confirmations for destructive or permission moments rise slightly less than sheets (95%) and leave quickly once answered.',
      trigger: 'Kit.alert(): Stop tracking…, Delete meeting…, the calendar permission prompt in onboarding', element: '.alert (centred glass at top 42%)', properties: 'opacity 0 → 1 · transform translate(-50%, -50%) scale(0.95) → scale(1)',
      enter: 'opacity 180ms, transform 220ms var(--ease-out)', exit: '.closing → opacity 120ms, transform 140ms; removed after 160ms', interruptible: 'yes — CSS transitions', keyboard: 'Enter = primary, Esc = cancel — both play the exit', reduced: 'opacity only',
      motion: 'scale 0.95 → 1 in 220ms --ease-out; closes in 140ms', mapsTo: `Radix AlertDialog: content initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.14 } }} transition={{ duration: 0.22, ease: ${EO}, opacity: { duration: 0.18 } }}`,
      source: 'kit/mac-kit.js alert() · mac-kit.css .alert, .alert.closing · 002 app-actions.js T.confirmStopTracking, doc-organize.js D.deleteMeetingFlow, app-onboard.js askCalendar', tokens: ['--glass-strong', '--shadow-window', '--ease-out'], timing: [['open', 220, '--ease-out', 'yes'], ['close', 140, '--ease-out', 'yes']],
      stories: [demo({ label: 'Stop tracking', note: 'Replay opens it and answers Cancel', flush: true, html: () => winM({ h: 320, tb: agTb(), view: agendaM(1, 3) }),
        run: (c) => { openAlert(c); seq(c, [[1900, () => { const b = q(c, '.alert.open [data-i="0"]'); if (b) b.click(); }]]); } })] }),
    E({ id: 'toast', name: 'Toast · enter, stack, exit', summary: 'Confirmations rise from the bottom edge, stack newest-at-bottom, wait while you read them and offer Undo.',
      trigger: 'T.toast / Kit.toast after an action (tracking, filing, saving, most Undo-able changes)', element: '.toast-stack (column-reverse, 8px gap) > .toast (glass capsule, optional Undo)', properties: 'opacity 0 → 1 · transform translateY(14px) scale(0.98) → none; exit → translateY(10px) scale(0.98), opacity 0',
      enter: 'opacity 220ms ease, transform 340ms var(--ease-out) (.show next frame)', exit: '.hide → opacity 160ms, transform 180ms; removed after 200ms; auto-dismiss after 4200ms', sequence: 'a new toast appends at the bottom; older ones shift up without animation', interruptible: 'yes — hover pauses the timer (remaining time kept); leaving resumes with max(remaining, 1200ms)', keyboard: 'none — role=status; the Undo button runs the action, then dismisses', reduced: 'opacity only',
      motion: 'rise 14px + 0.98 → 1 in 340ms --ease-out; leave 180ms; 4.2s lifetime, paused on hover', mapsTo: `sonner <Toaster position="bottom-center" gap={8} duration={4200} /> (pauses on hover natively); style enter translateY(14px) scale(0.98) 340ms ${EO}, exit 180ms`,
      source: 'kit/mac-kit.js toast() · mac-kit.css .toast-stack, .toast.show, .toast.hide · 002 app-shell.js T.toast', tokens: ['--glass-strong', '--shadow-float', '--ease-out'], timing: [['enter', 340, '--ease-out', 'yes'], ['exit', 180, '--ease-out', 'yes'], ['lifetime', 4200, '—', 'hover pauses'], ['resume minimum', 1200, '—', '—']],
      stories: [demo({ label: 'Two toasts, one with Undo', note: 'Hover a toast to pause it', flush: true, html: () => winM({ h: 260, tb: agTb(), view: agendaM(1, 3) }),
        run: (c) => { const win = q(c, '.window'); Kit.toast('Created a living doc for Growth Review', { icon: 'check-circle', container: win, duration: 3200, action: { label: 'Undo', onClick: () => {} } }); seq(c, [[500, () => Kit.toast('Added to Product Sync Memory', { icon: 'check-circle', container: win, duration: 2600 })]]); } })] }),
    E({ id: 'notification', name: 'Notification banner · slide in & out', summary: 'System-style banners slide in from the screen edge on a gentle spring and slide back out on ease-in-out — they come from outside the app.',
      trigger: 'Kit.notify(): “Product Sync is starting” (Starting, +600ms), “N items to review” (after filing, +250ms)', element: '.notif-stack (top-right, under the menu bar) > .notif', properties: 'transform translateX(calc(100% + 24px)) → none',
      enter: 'var(--spring-dur) var(--spring) — 490ms, bounce 0.12 (≈ 0.3% overshoot); .show after two frames', exit: '.hide → translateX(calc(100% + 24px)) 240ms var(--ease-in-out); removed after 260ms; auto-dismiss 7000ms', interruptible: 'yes — hover cancels the auto-dismiss; leaving dismisses after 2500ms', keyboard: 'none — click the body to open, action buttons act and dismiss', reduced: 'no slide — it appears and leaves in place (no opacity transition is declared)',
      motion: 'slides in 490ms on --spring, out 240ms --ease-in-out; 7s lifetime', mapsTo: `Production: native macOS notification (tauri-plugin-notification) — the system animates it. Prototype: <motion.div initial={{ x: 'calc(100% + 24px)' }} animate={{ x: 0 }} exit={{ x: 'calc(100% + 24px)', transition: { duration: 0.24, ease: ${EIO} } }} transition={${SPR}} />`,
      source: 'kit/mac-kit.js notify() · mac-kit.css .notif, .notif.show, .notif.hide · 002 app-record.js T.notifyStarting, T.notifyReview', tokens: ['--spring', '--spring-dur', '--ease-in-out'], timing: [['slide in', 490, '--spring', 'yes'], ['slide out', 240, '--ease-in-out', 'yes'], ['lifetime', 7000, '—', 'hover pauses'], ['after hover', 2500, '—', '—']],
      stories: [demo({ label: 'Product Sync is starting', note: 'Hover it to keep it', flush: true, html: `<div class="desktop cat-desk mo-desk" style="height:230px">${Kit.menubar({ menus: ['File', 'Edit', 'View'], extras: STATUS })}</div>`,
        run: (c) => Kit.notify({ title: 'Product Sync is starting', body: 'Google Meet · 10:00–10:45 · your brief is ready', actions: [{ label: 'Record', primary: true, onClick: () => {} }, { label: 'Not this time', onClick: () => {} }], container: q(c, '.mo-desk'), duration: 3000 }) })] }),
    E({ id: 'window', name: 'Window · hide & show', summary: 'The window disappears and returns instantly — macOS animates real windows, and the Island keeps working while it is closed.',
      trigger: 'red traffic light, ⌘W, Hide Telu · ⌥Space, the menu-bar item or the Island bring it back', element: '.window (hidden attribute)', properties: 'display none ↔ flex',
      enter: 'instant', exit: 'instant', interruptible: 'n/a', keyboard: '⌘W / ⌥Space — instant, like the pointer paths', reduced: 'same',
      motion: 'no animation in the app layer', mapsTo: 'Tauri getCurrentWindow().hide() / .show() + setFocus() — let the window server animate; never fake it in the webview',
      source: '002 app-shell.js T.hideWindow, T.showWindow · app-onboard.js T.summon', timing: [['hide / show', 0, 'instant', '—']],
      stories: [demo({ label: 'Hide · ⌘W, then show · ⌥Space', note: 'Replay toggles the hidden attribute', flush: true,
        html: () => `${winM({ h: 260, bar: true, side: sideM('', 3), tb: agTb(), view: agendaM(1, 3) })}<span class="mo-state mo-low">Shown</span>`,
        run: (c) => { const [win, label] = [q(c, '.window'), q(c, '.mo-state')]; seq(c, [[0, () => { win.hidden = true; label.textContent = 'Hidden · ⌘W'; }], [900, () => { win.hidden = false; label.textContent = 'Shown · ⌥Space'; }]]); } })] }),
    E({ id: 'scroll-edge', name: 'Toolbar · scroll-edge glass', summary: 'The toolbar turns to frosted glass only once content slides under it, so the resting state stays flat and calm.',
      trigger: 'content scrollTop > 2px (Kit.scrollEdge, passive scroll listener); in the side peek #pkScroll > 2px adds .pk-scrolled', element: '.toolbar.scrolled · .peek.pk-scrolled .pk-bar', properties: 'background-color transparent → color-mix(--content-bg 76% | 82%) · box-shadow 0 0.5px --separator; backdrop-filter blur(18px) saturate(1.6) switches on without a tween',
      enter: '200ms ease', exit: '200ms ease', interruptible: 'yes — CSS transitions', keyboard: '↑/↓ in the doc scroll 48px steps and cross the same threshold', reduced: 'unchanged',
      motion: 'background + hairline fade in 200ms ease when scrolled past 2px', mapsTo: "const { scrollY } = useScroll({ container: ref }); useMotionValueEvent(scrollY, 'change', (y) => setScrolled(y > 2)); CSS transition: background-color 200ms ease, box-shadow 200ms ease",
      source: 'kit/mac-kit.js Kit.scrollEdge · mac-kit.css .toolbar.scrolled · 002 app.css .peek.pk-scrolled .pk-bar · app-peek.js T.wirePeek', tokens: ['--content-bg', '--separator'], timing: [['glass on / off', 200, 'ease', 'yes']],
      stories: [demo({ label: 'Agenda toolbar', note: 'Scroll the agenda or Replay', flush: true, html: () => winM({ h: 280, tb: agTb(), view: agendaM(1) }),
        run: (c) => { const s = q(c, '.content'); seq(c, [[0, () => s.scrollTo({ top: 0 })], [200, () => s.scrollTo({ top: 150, behavior: 'smooth' })], [1800, () => s.scrollTo({ top: 0, behavior: 'smooth' })]]); } })] }),
    E({ id: 'large-title', name: 'Toolbar · large-title hand-off', summary: 'The doc’s large title scrolls away with the page; a compact title fades into the toolbar exactly when the large one is gone.',
      trigger: 'IntersectionObserver on #docTitle (root .content, rootMargin −toolbar-h): shows when the H1 has left above the toolbar', element: '.tb-title (series icon + name) in the doc toolbar', properties: 'opacity 0 → 1 · translateY(4px) → 0; the large title itself just scrolls (no scale)',
      enter: '180ms var(--ease-out)', exit: '180ms var(--ease-out)', interruptible: 'yes — CSS transition', keyboard: 'same — driven by scroll position', reduced: 'opacity only',
      motion: 'compact title rises 4px and fades in, 180ms --ease-out', mapsTo: `const show = !useInView(titleRef, { root: scrollRef, margin: '-52px 0px 0px 0px' }) && scrolledPast; <motion.div animate={{ opacity: show ? 1 : 0, y: show ? 0 : 4 }} transition={{ duration: 0.18, ease: ${EO} }} />`,
      source: '002 doc-page.js observeTitle · doc.css .tb-title, .tb-title.show', tokens: ['--ease-out', '--toolbar-h'], timing: [['compact title', 180, '--ease-out', 'yes']],
      stories: [demo({ label: 'Product Sync doc', note: 'Scroll the doc or Replay', flush: true,
        html: () => winM({ h: 300, tb: docTb(PS().s), view: `<div class="canvas-inner"><article class="doc doc-surface">${sc('before', () => D.headerMarkup(PS().s) + D.purposeMarkup(PS().s))}</article></div>` }),
        init: (c) => { const tb = q(c, '.tb-title'); new IntersectionObserver(([en]) => tb.classList.toggle('show', !en.isIntersecting && en.boundingClientRect.top < (en.rootBounds ? en.rootBounds.top : 0)), { root: q(c, '.content'), rootMargin: '-52px 0px 0px 0px', threshold: 0 }).observe(q(c, '.doc-title')); },
        run: (c) => { const s = q(c, '.content'); seq(c, [[0, () => s.scrollTo({ top: 0 })], [200, () => s.scrollTo({ top: 170, behavior: 'smooth' })], [1900, () => s.scrollTo({ top: 0, behavior: 'smooth' })]]); } })] }),
    E({ id: 'view-fade', name: 'View switch · fade', summary: 'Switching sidebar sections swaps the content and lets only the new view arrive — a soft blur-fade that says “new place”, without implying direction.',
      trigger: 'click Today / Upcoming / Review / Found in the sidebar; leaving a doc (Back, ⌘[)', element: '#view (the agenda content host)', properties: 'new content: opacity 0 → 1, filter blur(2px) → 0 (translateY 0); the old view is replaced instantly',
      enter: '200ms var(--ease-out) (WAAPI)', exit: 'none', interruptible: 'restart — a new fade replaces the running one', keyboard: 'View-menu items and ⌘[ use the same fade; a restored side peek reopens instantly', reduced: 'no fade',
      motion: 'arrival fade with 2px blur, 200ms --ease-out; no exit', mapsTo: `<AnimatePresence initial={false} mode="popLayout"><motion.div key={view} initial={{ opacity: 0, filter: 'blur(2px)' }} animate={{ opacity: 1, filter: 'blur(0px)' }} transition={{ duration: 0.2, ease: ${EO} }} /></AnimatePresence> — no exit prop`,
      source: '002 app-shell.js T.goView → T.fx.fadeIn(view, { duration: 200 }) · app-agenda.js fadeIn', tokens: ['--ease-out'], timing: [['fade in', 200, '--ease-out', 'restart']],
      stories: [demo({ label: 'Sidebar sections', note: 'Click a section or Replay', span: 'full', flush: true, html: () => winM({ h: 330, side: sideM('', 3), tb: agTb(), view: `<div class="agenda-inner mo-view">${VIEWS.Today[1]()}</div>` }),
        init: (c) => qa(c, '.a-nav').forEach((el) => el.addEventListener('click', guard(c, () => goView(c, el.dataset.nav)))),
        run: (c) => seq(c, [[0, () => goView(c, 'Review')], [1100, () => goView(c, 'Found in Calendar')], [2200, () => goView(c, 'Today')]]) })] }),
    E({ id: 'day-slide', name: 'Day stepper · directional slide', summary: 'Stepping days moves the agenda a short way in the direction of time, so yesterday feels to the left and tomorrow to the right.',
      trigger: 'click ‹ / › or Today in the toolbar stepper', element: '#view (agenda day)', properties: 'out: opacity 1 → 0, translateX(0 → −16px × dir) · swap + scrollTop 0 · in: opacity 0 → 1, translateX(16px × dir → 0)',
      enter: '220ms var(--ease-out)', exit: '140ms var(--ease-out), fill forwards', interruptible: 'restart — each step cancels running animations and a token drops stale swaps (the latest click wins)', keyboard: '← / → step days instantly (renderView with direction 0)', reduced: 'instant swap',
      motion: 'out 16px/140ms, in 16px/220ms, both --ease-out, in the direction of travel', mapsTo: `<AnimatePresence mode="wait" custom={dir} initial={false}><motion.div key={day} custom={dir} initial={{ opacity: 0, x: 16 * dir }} animate={{ opacity: 1, x: 0, transition: { duration: 0.22, ease: ${EO} } }} exit={{ opacity: 0, x: -16 * dir, transition: { duration: 0.14, ease: ${EO} } }} /></AnimatePresence> — skip it for key presses`,
      source: '002 app-agenda.js slideSwap, T.renderView({ direction }) · app-shell.js T.stepDay · app.js dayKey', tokens: ['--ease-out'], timing: [['day out', 140, '--ease-out', 'restart'], ['day in', 220, '--ease-out', 'restart', 140]],
      stories: [demo({ label: 'Yesterday · Today · Tomorrow', note: 'Use the stepper, the key buttons (instant) or Replay', span: 'full', flush: true, ctrls: [['← key · instant', (c) => stepDay(c, -1, false)], ['→ key · instant', (c) => stepDay(c, 1, false)]],
        html: () => winM({ h: 320, tb: agTb(), view: `<div class="agenda-inner mo-view">${DAYS()[1].html}</div>` }),
        init: (c) => qa(c, '[data-step]').forEach((b) => b.addEventListener('click', guard(c, () => stepDay(c, Number(b.dataset.step))))),
        run: (c) => seq(c, [[0, () => stepDay(c, 1)], [1000, () => stepDay(c, -1)], [2000, () => stepDay(c, -1)], [3000, () => stepDay(c, 0)]]) })] }),
    E({ id: 'agenda-stagger', name: 'Agenda · stagger in', summary: 'When a whole day appears at once (calendar just connected), rows cascade top to bottom so the eye reads the day in order.',
      trigger: 'T.renderView({ stagger: true }) — kept in 002 from sketch 001’s calendar-connect flow; 002’s onboarding path renders without it (dormant)', element: '.a-timeline > * (rows, gaps, now line) via Kit.stagger → .enter with --i', properties: 'opacity 0 → 1 · translateY(6px) → 0',
      enter: '280ms var(--ease-out), fill both, delay = i × 40ms', sequence: '40ms per row; input is never blocked', interruptible: 'restart — the class is re-applied', reduced: '.enter animation off — rows appear at once',
      motion: 'rows rise 6px and fade in 280ms --ease-out, 40ms apart', mapsTo: `<motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.04 } } }}> with children variants hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0, transition: { duration: 0.28, ease: ${EO} } }`,
      source: 'kit/mac-kit.js Kit.stagger · mac-kit.css .enter, @keyframes kit-enter · 002 app-agenda.js T.renderView({ stagger })', tokens: ['--ease-out'], timing: [['each row', 280, '--ease-out', 'restart'], ['next row', 280, '--ease-out', 'restart', 40], ['stagger step', 40, '—', '—']],
      stories: [demo({ label: 'Today', note: 'Replay runs Kit.stagger on the real timeline', flush: true, html: () => `<div class="mo-clip mo-fade" style="--h:310px">${agendaM(1)}</div>`, run: (c) => Kit.stagger(q(c, '.a-timeline'), ':scope > *') })] }),
    E({ id: 'progress', name: 'Progress hairline · grow & fade', summary: 'A 2px line along the toolbar’s bottom edge shows a determinate background job, then fades rather than snapping away.',
      trigger: 'T.runProgress(ms) — defined in 002 (sketch 001 ran it for 900ms while calendar events loaded); no 002 flow calls it yet (dormant)', element: '.a-progress (2px accent line, toolbar bottom edge, origin left)', properties: 'transform scaleX(0 → 1) · then opacity 1 → 0',
      enter: 'duration (default 900ms) linear, fill forwards', exit: '220ms ease-out fade', interruptible: 'restart — running animations are cancelled first', reduced: 'runs as is (it is information, not decoration)',
      motion: 'grows linearly over the job’s duration, fades 220ms', mapsTo: "<motion.i style={{ originX: 0 }} initial={{ scaleX: 0, opacity: 1 }} animate={{ scaleX: 1 }} transition={{ duration: 0.9, ease: 'linear' }} onAnimationComplete={() => fadeOut(0.22)} /> — bind to real sync progress when available",
      source: '002 app-shell.js T.runProgress · app.css .a-progress', tokens: ['--accent'], timing: [['grow', 900, 'linear', 'restart'], ['fade', 220, 'ease-out', 'restart', 900]],
      stories: [demo({ label: 'Toolbar progress', note: 'Replay runs the 900ms default', flush: true, html: () => winM({ h: 180, tb: agTb(), view: agendaM(1, 2) }), run: progress })] }),
    E({ id: 'card-morph', name: 'Event card · state morph', summary: 'A meeting card changes state in place: only the parts that changed blur-crossfade, so the card never jumps and the change is easy to spot.',
      trigger: 'state changes — track, record start/stop, starting, preparing → ready, review done, purpose saved (T.morphCard / T.morphAll)', element: '.a-card: class list swaps at once; each changed [data-part] (eyebrow, chip, purpose, meta, actions, extra) crossfades on its own', properties: 'part out: opacity → 0, blur → 2px · swap · part in: opacity 0 → 1, blur 2px → 0 · ::before accent bar scaleY(0.2) → 1 + opacity when tracked, → coral when live',
      enter: 'part in 190ms var(--ease-out) · bar transform 360ms var(--ease-out), opacity 200ms ease, colour 220ms ease', exit: 'part out 110ms ease-out, fill forwards', sequence: 'T.morphAll staggers cards 40ms apart; recording stop → summarizing (morph) → after (full re-render + card fadeIn 240ms)', interruptible: 'restart — running part animations are cancelled first', keyboard: '⌘R morphs exactly like clicking Record', reduced: 'parts swap instantly; the bar snaps',
      motion: 'per-part crossfade 110ms out / 190ms in with 2px blur; accent bar grows 360ms', mapsTo: `Per part: <AnimatePresence mode="wait" initial={false}><motion.div key={partKey} initial={{ opacity: 0, filter: 'blur(2px)' }} animate={{ opacity: 1, filter: 'blur(0px)', transition: { duration: 0.19, ease: ${EO} } }} exit={{ opacity: 0, filter: 'blur(2px)', transition: { duration: 0.11, ease: 'easeOut' } }} /></AnimatePresence>`,
      source: '002 app-agenda.js T.morphCard, crossfade, T.morphAll · app-record.js repaint, enterAfter · app.css .a-card::before', tokens: ['--ease-out', '--coral', '--c (series colour)'], timing: [['part out', 110, 'ease-out', 'restart'], ['part in', 190, '--ease-out', 'restart', 110], ['accent bar', 360, '--ease-out', 'yes'], ['after-state fade', 240, '--ease-out', 'restart'], ['morphAll step', 40, '—', '—']],
      stories: [demo({ label: 'Product Sync · before → starting → recording → summarizing → after', note: 'Replay walks the real scenario states', height: 230, low: true,
        html: () => `<span class="mo-state">Before · 9:41</span><div class="a-timeline mo-one">${CARD()[0][1]}</div>`, run: (c) => seq(c, CARD().map((step, i) => [i ? 400 + i * 1400 : 0, cardStep(c, step, i)])) }),
        demo({ label: 'Daily Standup · Not tracked → Tracking', note: 'Replay tracks, then undoes', height: 210, low: true,
          html: () => `<div class="a-timeline mo-one"><div class="a-row"><div class="a-time"><b class="num">09:00</b><span class="num">09:15</span></div>${STANDUP()[0]}</div></div>`,
          run: (c) => seq(c, [[0, () => morph(q(c, '.a-card'), STANDUP()[1])], [2000, () => morph(q(c, '.a-card'), STANDUP()[0])]]) })] }),
    E({ id: 'agenda-flip', name: 'Agenda rows · FLIP reflow', summary: 'When a card changes height, the rows below glide to their new place instead of jumping — you keep track of where everything went.',
      trigger: 'recording start/stop repaint (T.fx.flipRows around T.morphCard)', element: '#view [data-row] rows', properties: 'transform translateY(previous top − new top → 0)',
      enter: '320ms var(--ease-in-out) — on-screen movement uses ease-in-out', interruptible: 'restart', keyboard: '⌘R triggers the same repaint', reduced: 'no FLIP — rows jump',
      notes: 'the class swap is measured, but parts that empty after the 110ms crossfade shrink the card later, so rows finish the last few pixels with a jump — in production animate the card with layout so height and siblings move together. The sidebar never reorders in 002 (rows insert/remove with height); Kit.flip is the generic helper (x/y, 320ms, EASE_OUT)',
      motion: 'rows translate from their old position, 320ms --ease-in-out', mapsTo: `framer-motion layout: <motion.div layout="position" transition={{ duration: 0.32, ease: ${EIO} }} /> on each row, and layout on the card so its height animates with them`,
      source: '002 app-agenda.js flipRows (T.fx.flipRows) · app-record.js repaint · kit Kit.flip', tokens: ['--ease-in-out'], timing: [['rows move', 320, '--ease-in-out', 'restart']],
      stories: [demo({ label: 'Product Sync next ↔ summarizing', note: 'Replay changes the card’s height twice', flush: true, html: () => `<div class="mo-clip" style="--h:330px"><div class="agenda-inner"><div class="a-timeline">${rowM('t2')}${rowM('t4')}${rowM('t5')}</div></div></div>`,
        run: (c) => { const host = q(c, '.a-timeline'); const flip = (i) => () => flipRows(host, () => morph(q(host, '.a-card'), i ? rowM('t2', 'live', 1, SUM) : rowM('t2'))); seq(c, [[0, flip(1)], [1700, flip(0)]]); } })] }),
    E({ id: 'now-line', name: 'Now line · static by design', summary: 'The coral now line is placed, not animated: a line that crept every minute would pull the eye for no reason.',
      trigger: 'none — placed between rows by the clock (re-rendered on minute / scenario change)', element: '.a-now (time label + 1px coral line + 8px dot)', properties: 'none', enter: 'none', exit: 'none', interruptible: 'n/a', reduced: 'same',
      motion: 'no animation; the only moving thing near it is the starting card’s pulsing dot', mapsTo: 'Static element in the list; recompute its position on a 60s interval without transitions',
      source: '002 app-agenda.js nowMarkup, timelineMarkup · app.css .a-now', tokens: ['--coral'], timing: [['reposition', 0, 'instant', '—']],
      stories: [demo({ label: 'Today at 9:41', note: 'Nothing to replay — it never moves', flush: true, html: () => `<div class="mo-clip mo-fade" style="--h:250px">${agendaM(1, 3)}</div>` })] }),
    E({ id: 'rec-capsule', name: 'Recording capsule · in & out', summary: 'While recording, a coral capsule sits in the toolbar; it pops in softly and leaves faster, so starting feels deliberate and stopping feels done.',
      trigger: 'recording starts / stops while the agenda is showing (T.updateToolbar({ animate: true }))', element: '#recSlot .a-rec-capsule (rec dot · title · timer · Stop)', properties: 'in: opacity 0 → 1, scale(0.96) → none, blur 2px → 0 · out: opacity → 0, scale(0.96), then removed',
      enter: '240ms var(--ease-out)', exit: '150ms ease-out', interruptible: 'restart (a new capsule is inserted only when none exists)', keyboard: '⌘R — same', reduced: 'inserted and removed instantly',
      motion: 'in 240ms --ease-out from 0.96 + 2px blur; out 150ms', mapsTo: `<AnimatePresence>{recording && <motion.div initial={{ opacity: 0, scale: 0.96, filter: 'blur(2px)' }} animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }} exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15, ease: 'easeOut' } }} transition={{ duration: 0.24, ease: ${EO} }} />}</AnimatePresence>`,
      source: '002 app-shell.js syncCapsule, recCapsule · app.css .a-rec-capsule', tokens: ['--coral-soft', '--coral-ink', '--ease-out'], timing: [['out', 150, 'ease-out', 'no'], ['in', 240, '--ease-out', 'restart', 700]],
      stories: [demo({ label: 'Stop, then record again', note: 'Replay removes and re-inserts it', span: 'full', flush: true, html: () => winM({ h: 150, tb: agTb('Today', 'Tuesday, 29 September', CAPSULE) }),
        init: (c) => clock(c, q(c, '[data-rec-timer]'), 724), run: (c) => seq(c, [[0, () => capsuleOut(c)], [700, () => capsuleIn(c)]]) })] }),
    E({ id: 'parsed-chips', name: 'New series · parsed chips', summary: 'As you type a sentence, each understood part lights up in its chip with a quick blur-in — you can see Telu understanding you.',
      trigger: 'typing in the New series field (90ms debounce) → Kit.parseSeries → chip values', element: '.a-pchip b (Title, Repeats, Day, Time, With) · chip background', properties: 'value: opacity 0.2 → 1, blur 2px → 0 (only chips whose value changed) · chip .is-empty (--fill) → --accent-soft',
      enter: 'value 180ms var(--ease-out) · chip colours 180ms ease', interruptible: 'restart per chip', keyboard: 'typing is the trigger — subtle by design (opacity from 0.2, 2px blur); Enter creates', reduced: 'no blur-in; colours still fade',
      motion: 'changed values blur-in 180ms --ease-out; chip colour 180ms', mapsTo: `<motion.b key={value} initial={{ opacity: 0.2, filter: 'blur(2px)' }} animate={{ opacity: 1, filter: 'blur(0px)' }} transition={{ duration: 0.18, ease: ${EO} }} /> + a 90ms input debounce`,
      source: '002 app-flows.js updateChips, wireNewSeries, newMarkup · app.css .a-pchip', tokens: ['--accent-soft', '--accent-strong', '--fill'], timing: [['debounce', 90, '—', 'resets'], ['value in', 180, '--ease-out', 'restart', 90], ['chip colour', 180, 'ease', 'yes', 90]],
      stories: [demo({ label: 'Weekly 1:1 with Priya, Thu 11am', note: 'Type in the field or Replay', bg: 'wallpaper', height: 290, low: true, html: () => newPop(), init: (c) => q(c, 'input').addEventListener('input', (e) => typeChips(c, e.target.value)),
        run: (c) => { const input = q(c, 'input'); const text = 'Weekly 1:1 with Priya, Thu 11am'; input.value = ''; paintChips(c, ''); seq(c, [...text].map((ch, i) => [150 + i * 110, () => { input.value = text.slice(0, i + 1); typeChips(c, input.value); }])); } })] })
  ];

  const principles = E({ id: 'principles', name: 'Motion principles', summary: 'The rules every animation in Telu follows, each with where Telu applies it. Read these before adding motion anywhere; the entries below are the evidence.',
    motion: 'enter ease-out 150–260ms, exit faster, springs only for morphs and landings, never from scale(0), transform/opacity only, keyboard navigation instant, reduced motion = opacity only', mapsTo: `framer-motion at the root: <MotionConfig reducedMotion="user" transition={{ duration: 0.19, ease: ${EO} }}>; motion tokens --ease-out, --ease-in-out, --ease-drawer, --spring(-dur), --spring-bounce(-dur) in globals.css (see Foundations · Motion)`,
    source: 'kit/mac-kit.css :root motion tokens · every 002 call site listed in this section', tokens: ['--ease-out', '--ease-in-out', '--ease-drawer', '--spring', '--spring-bounce'],
    stories: [{ label: 'Twelve rules', note: '✓ where Telu does it · ✕ what it avoids', span: 'full', align: 'stretch', html: rulesHtml },
      demo({ label: 'Do vs don’t', note: 'Left: 0.96 → 1 in 190ms --ease-out from the trigger corner. Right: scale(0) → 1 in 400ms ease-in from the centre.', height: 200,
        html: `<div class="mo-pair"><div><span class="t-eyebrow">DO</span>${pairPop('16px 0')}</div><div><span class="t-eyebrow">DON’T</span>${pairPop('center')}</div></div>`,
        run: (c) => { const [a, b] = qa(c, '.mo-pop'); a.animate([{ opacity: 0, transform: 'scale(0.96)' }, { opacity: 1, transform: 'none' }], { duration: 190, easing: Kit.EASE_OUT }); b.animate([{ transform: 'scale(0)' }, { transform: 'none' }], { duration: 400, easing: 'ease-in' }); } })] });
  const components = [principles];
  const mapRows = () => components.flatMap((c) => (c.timing || []).map(([phase, ms, ease, intr, at]) => ({ name: `${c.name.split(' · ')[0]} · ${phase}`, full: `${c.name} · ${phase}`, ms, ease, intr, at })));
  const mapRow = (r) => `<div class="mo-map-r" title="${esc(r.full)}"><span class="truncate">${esc(r.name)}</span><span class="mo-lane"><i data-k="${kindOf(r.ease, r.intr)}" style="width:${Math.min(100, r.ms / 10)}%"></i></span><span class="num">${r.at ? `<small>+${r.at}</small>` : ''}${r.ms}</span><span class="truncate">${esc(r.ease)}</span><span class="truncate">${esc(r.intr)}</span></div>`;
  const mapHtml = () => {
    const rows = mapRows();
    const groups = [['One-shot motion · by duration', rows.filter((r) => r.intr !== 'loop' && r.ease !== '—')], ['Delays, dwell & debounce', rows.filter((r) => r.ease === '—')], ['Loops', rows.filter((r) => r.intr === 'loop')]];
    return `<div class="mo-map-legend"><span>animation · phase</span><span>0–1s</span><span>ms</span><span>easing</span><span>interrupt</span></div><div class="mo-map">${groups.map(([title, list]) => `<div class="mo-map-h">${title}<span class="num">${list.length}</span></div>${[...list].sort((a, b) => a.ms - b.ms).map(mapRow).join('')}`).join('')}</div>`;
  };
  const timingMap = { id: 'timing-map', name: 'Timing map',
    get summary() { return `Every timed phase in this section (${mapRows().length}), sorted by duration so the whole system reads at a glance: micro-feedback under 150ms, entrances and exits 150–260ms, layout and springs 280–600ms, flights and glows beyond.`; },
    motion: 'interrupt: yes = CSS transition retargets · restart = WAAPI/keyframes cancel and replay · no = runs to completion · cancels / resets = timers · +N = delay before the phase starts',
    mapsTo: 'Export these as constants next to the easing tokens (e.g. motion.ts: DURATION.popoverOpen = 0.19) so components never inline numbers', source: 'generated at render from the timing rows of every entry in this section (both files)',
    stories: [{ label: 'Durations, curves and interruptibility', note: 'Hover a row for the full entry name · the lane is the duration on a 0–1000ms scale', span: 'full', align: 'stretch', html: mapHtml }] };
  components.push(timingMap, ...entries);

  window.TeluMotion = {
    EO, EIO, ED, SPR, SPRB, STATUS, FLY_ICON, CAPSULE, BLUR_OUT, RISE_IN, q, qa, node, sc, reduced, memo, tokens, state, guard, safe, seq, clock, restart, force,
    PS, SERIES, SUM, rowM, dayM, agendaM, navM, sRow, sideM, agTb, docTb, winM, swap, newPop, demo, E,
    add: (list) => components.push(...list)
  };

  Catalog.section({
    id: 'motion', eyebrow: 'Layer 1 · Motion', title: 'Animations',
    intro: 'Every animation in the final app, one entry each: what triggers it, which properties move, exact durations and curves, whether it can be interrupted, what the keyboard and reduced-motion paths do, and the framer-motion or CSS it maps to. Replay runs the real kit and 002 code on real markup. Curves and springs are the Foundations motion tokens.',
    css: `
#motion .cat-meta .cat-chip { height: auto; min-height: 22px; padding: 3px 10px; border-radius: 11px; line-height: 1.45; white-space: normal; align-items: flex-start; }
#motion .cat-meta .cat-chip .i { margin-top: 2px; }
.mo-bar { position: absolute; top: 10px; right: 10px; z-index: 90; display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; max-width: calc(100% - 20px); pointer-events: none; }
.mo-bar > * { pointer-events: auto; }
.mo-bar.low { top: auto; bottom: 10px; }
.mo-bar .btn { background: var(--content-bg); box-shadow: 0 0 0 0.5px var(--hairline), 0 1px 3px rgba(23, 25, 31, 0.08); }
.mo-bar .btn .i { width: 12px; height: 12px; }
.mo-state { position: absolute; left: 14px; top: 12px; z-index: 5; font-size: 11px; font-weight: 600; color: var(--label-3); }
.mo-state.mo-low { top: auto; bottom: 16px; padding: 3px 8px; border-radius: 6px; background: var(--content-bg); }
.mo-clip, .mo-host { position: relative; width: 100%; height: var(--h); overflow: hidden; }
.mo-fade { -webkit-mask-image: linear-gradient(to bottom, #000 calc(100% - 64px), transparent); mask-image: linear-gradient(to bottom, #000 calc(100% - 64px), transparent); }
.cat-canvas .mo-desk .window.mo-win { width: calc(100% - 32px); height: calc(100% - 28px); margin: 14px 16px; }
.cat-canvas .mo-desk.bar .window.mo-win { margin-top: 40px; height: calc(100% - 54px); }
.mo-ob .onboard { top: 44px; height: 400px; }
.mo-hint { position: absolute; inset: 26px 0 0; display: grid; place-items: center; margin: 0; font-size: 12px; color: var(--label-3); pointer-events: none; }
.mo-isl.is-live .mo-hint { display: none; }
.mo-isl:not(.mo-attach) .il-file { display: none; }
.mo-doc { width: 100%; padding: 4px 20px; }
.mo-doc.mo-pad { padding: 18px 24px; }
.mo-doc > .doc-sec:first-child { margin-top: 0; }
.mo-one, .mo-list { width: 100%; }
.mo-list { max-width: 380px; }
.mo-sb { width: 100%; max-width: 240px; padding: 6px; border-radius: 12px; background: var(--sidebar); }
.mo-nav { width: 240px; }
.mo-ladder { display: grid; grid-template-columns: minmax(0, 1.8fr) minmax(0, 1.2fr) repeat(2, minmax(0, 0.9fr)) minmax(0, 0.7fr); gap: 20px; width: 100%; align-items: end; }
.mo-rung { display: grid; justify-items: center; gap: 12px; }
.mo-rung-t { width: 100%; display: grid; place-items: center; }
.mo-hover { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 0.8fr) minmax(0, 1.7fr); gap: 24px; width: 100%; align-items: center; }
.mo-grip { padding-left: 26px; }
.mo-checks { display: flex; align-items: center; gap: 24px; }
.mo-agenda { min-width: 200px; }
.mo-col { display: grid; justify-items: center; gap: 16px; }
.mo-waves { gap: 28px; }
.mo-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; width: 100%; align-self: start; }
.mo-pair > div { display: grid; gap: 10px; justify-items: start; }
.mo-full { width: 100%; }
.mo-pg { padding-top: 16px; }
.mo-flysrc { display: flex; justify-content: flex-end; padding: 8px 18px; }
.mo-newpop { width: 380px; }
.mo-drop { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr); gap: 36px; width: 100%; align-items: center; padding: 0 18px; }
.mo-rules { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px 36px; width: 100%; align-self: start; }
.mo-rule b { display: flex; gap: 8px; font-size: 13px; font-weight: 600; }
.mo-rule b .num { color: var(--label-3); min-width: 14px; }
.mo-rule p { display: flex; gap: 7px; margin: 5px 0 0 22px; font-size: 12px; line-height: 1.45; color: var(--label-2); }
.mo-rule p .i { width: 13px; height: 13px; margin-top: 2px; color: var(--accent); }
.mo-rule p.no, .mo-rule p.no .i { color: var(--label-3); }
.mo-track { display: grid; gap: 8px; width: 100%; align-self: center; }
.mo-tr { display: grid; grid-template-columns: minmax(0, 150px) minmax(0, 1fr) 92px; align-items: center; gap: 12px; font-size: 11.5px; color: var(--label-2); }
.mo-tr > .num { text-align: right; color: var(--label-3); }
.mo-lane { position: relative; height: 8px; border-radius: 4px; background: var(--fill); overflow: hidden; }
.mo-lane i { position: absolute; top: 0; bottom: 0; left: 0; min-width: 3px; border-radius: 4px; background: color-mix(in srgb, var(--accent) 75%, transparent); }
.mo-lane i[data-k="spring"] { background: var(--accent-strong); }
.mo-lane i[data-k="delay"] { background: repeating-linear-gradient(-45deg, var(--label-4) 0 3px, transparent 3px 6px); }
.mo-lane i[data-k="loop"] { background: var(--label-3); }
.mo-lane i[data-k="instant"] { background: var(--label-2); }
.mo-map-legend, .mo-map-r { display: grid; grid-template-columns: minmax(0, 1fr) 54px 64px 104px 72px; gap: 8px; align-items: center; }
.mo-map-legend { width: calc(50% - 18px); font-size: 10.5px; font-weight: 600; letter-spacing: 0.03em; text-transform: uppercase; color: var(--label-3); }
.mo-map { width: 100%; columns: 2; column-gap: 36px; margin-top: 6px; }
.mo-map-h { display: flex; justify-content: space-between; margin: 16px 0 4px; font-size: 11px; font-weight: 600; color: var(--accent-strong); break-after: avoid; }
.mo-map-h:first-child { margin-top: 0; }
.mo-map-r { height: 24px; font-size: 12px; break-inside: avoid; box-shadow: inset 0 -0.5px 0 var(--separator); }
.mo-map-r .mo-lane { height: 6px; }
.mo-map-r > .num { text-align: right; font-weight: 600; white-space: nowrap; }
.mo-map-r > .num small { margin-right: 4px; font-size: 10px; font-weight: 500; color: var(--label-3); }
.mo-map-r > span:nth-child(4), .mo-map-r > span:nth-child(5) { color: var(--label-2); font-size: 11.5px; }
.mo-rm { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; width: 100%; }
.mo-rm-col { display: grid; gap: 14px; justify-items: start; padding: 16px 18px; border-radius: 12px; background: var(--surface-sunken); }
.mo-rm-row { gap: 18px; }
.mo-rm-p { margin: 0; font-size: 12px; color: var(--label-2); }
.mo-reduced *, .mo-reduced *::before, .mo-reduced *::after { transition-property: opacity, background-color, color, box-shadow, border-color !important; }
.mo-reduced .enter, .mo-reduced .bump, .mo-reduced .wave i, .mo-reduced .shimmer { animation: none !important; }
.mo-reduced .rec-dot { animation-duration: 2.4s !important; }
`,
    components
  });
})();
