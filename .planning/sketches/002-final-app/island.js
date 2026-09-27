window.Island = (() => {
  const MS = { hoverIn: 150, hoverOut: 300, type: 80, suggest: 1200, attached: 1200, dragIdle: 1000 };
  const PILL_H = 36;
  const RECORD_KBD = '⌘R';
  const FILE_TYPE = 'application/x-telu-file';
  const DESK_FILE = { name: 'Sprint 43 plan.pdf', size: 1258291 };
  const FILE_RE = /^[^\n\r\t<>]{1,120}\.[a-z0-9]{1,6}$/i;
  const COLOR_RE = /^(var\(--[a-z0-9-]+\)|#[0-9a-f]{3,8})$/i;
  const HEX_RE = /^#[0-9a-f]{3,8}$/i;
  const MODES = ['setup', 'before', 'starting', 'live', 'filing', 'after', 'hidden'];
  const EXPANDED = { before: 'brief', starting: 'brief', live: 'live-card', after: 'after-card' };
  const ATTACHABLE = ['before', 'starting', 'live'];
  const KLABEL = { decision: 'Decision', commitment: 'Commitment', question: 'Open question', fact: 'Fact' };
  const PLURAL = { decision: ['decision', 'decisions'], commitment: ['commitment', 'commitments'], question: ['open question', 'open questions'], fact: ['fact', 'facts'] };
  const MINT_DOT = '<span class="il-mint-dot" role="img" aria-label="Telu found something worth asking"></span>';
  const OUTSIDE_IGNORE = '.popover, .menu, .alert, .toast, .notif, .scenario';
  const KIT_LAYER = '.popover.open, .menu:not(.closing), .alert.open';
  const ISLAND_HTML = '<div class="island" id="island" role="region" aria-label="Telu" tabindex="0"></div>';
  const FILE_HTML = `<div class="il-file" id="islandFile" draggable="true" data-tip="Drag onto the Island to attach"><div class="il-file-badge"><span>PDF</span></div><div class="il-file-name">${DESK_FILE.name}</div></div>`;
  const timers = new Map();
  const warned = new Set();
  let ticker = null;
  let typing = null;
  let ui = {
    el: null, desk: null, bridge: null, bound: false, mode: 'before', hidden: false,
    variant: null, key: null, sig: null, w: 0, h: 0,
    expanded: false, pinned: false, suppress: false, drag: null, depth: 0, flash: null, flashInfo: {},
    live: null, lastName: '', pop: null
  };

  const put = (patch) => { ui = { ...ui, ...patch }; };
  const isObj = (value) => value !== null && typeof value === 'object';
  const has = (obj, key) => Boolean(obj) && Object.prototype.hasOwnProperty.call(obj, key);
  const text = (value) => (typeof value === 'string' ? value : '');
  const esc = (value) => Kit.esc(value == null ? '' : value);
  const strings = (list) => (Array.isArray(list) ? list.filter((s) => typeof s === 'string' && s) : []);
  const drop = (name) => { clearTimeout(timers.get(name)); timers.delete(name); };
  const clear = (...names) => names.forEach(drop);
  const later = (name, fn, ms) => {
    drop(name);
    timers.set(name, setTimeout(() => { timers.delete(name); fn(); }, ms));
  };
  const dispatch = (name, detail) => ui.desk.dispatchEvent(new CustomEvent(name, { detail }));

  function call(name, ...args) {
    const bridge = ui.bridge || window.TeluBridge;
    if (!bridge || typeof bridge[name] !== 'function') return null;
    try {
      return bridge[name](...args);
    } catch (error) {
      if (!warned.has(name)) console.warn(`Island: TeluBridge.${name}() failed`, error);
      warned.add(name);
      return null;
    }
  }
  const subject = (value) => (isObj(value) && isObj(value.series) && isObj(value.meeting) ? value : null);
  const readNext = () => subject(call('next'));
  const readAfter = () => subject(call('after'));
  const count = (value) => (Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0);
  function readLive() {
    const lv = subject(call('live'));
    if (!lv) return null;
    const sg = lv.suggestion;
    const suggestion = isObj(sg) && text(sg.text) ? { text: sg.text, sources: strings(sg.sources) } : null;
    const transcript = Array.isArray(lv.transcript) ? lv.transcript.filter((l) => isObj(l) && typeof l.text === 'string') : [];
    return { series: lv.series, meeting: lv.meeting, elapsed: count(lv.elapsed), transcript, suggestion };
  }
  const idOf = (hit) => (hit && hit.meeting.id != null ? String(hit.meeting.id) : 'none');

  const nameOf = (s) => esc(s && text(s.name) ? s.name : 'Telu');
  const timesOf = (m) => text(m.time).split('–');
  const startOf = (m) => esc(timesOf(m)[0]);
  const colorOf = (s) => (COLOR_RE.test(text(s.color)) ? s.color : 'var(--series-gray)');
  const iconOf = (s) => (has(window.ICONS, s.icon) ? s.icon : 'people');
  const seriesIcon = (s) => `<span class="series-icon" style="--c:${colorOf(s)}">${icon(iconOf(s))}</span>`;
  const numberTag = (m) => (Number.isFinite(m.n) ? ` <span class="faint">#${m.n}</span>` : '');
  function clock(total) {
    const s = Math.max(0, Math.floor(total));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h ? `${h}:` : ''}${String(m).padStart(h ? 2 : 1, '0')}:${String(s % 60).padStart(2, '0')}`;
  }
  function avatar(name) {
    const color = Kit.personColor(name);
    const tone = HEX_RE.test(String(color)) ? color : '#8E8E93';
    return `<span class="avatar" style="--c:${tone}" title="${esc(name)}">${name === 'You' ? '' : esc(Kit.initials(name))}</span>`;
  }
  function avatars(names, max = 4) {
    const list = strings(names);
    if (!list.length) return '';
    const more = list.length > max ? `<span class="more">+${list.length - max}</span>` : '';
    return `<span class="avatars">${list.slice(0, max).map(avatar).join('')}${more}</span>`;
  }
  function briefDocs(m) {
    const docs = isObj(m.brief) && Array.isArray(m.brief.docs) ? m.brief.docs : [];
    return docs
      .map((d) => (typeof d === 'string' ? { name: d, include: true } : { name: isObj(d) ? text(d.name) : '', include: isObj(d) && d.include !== false }))
      .filter((d) => d.name);
  }
  function docLabel(m) {
    const n = briefDocs(m).filter((d) => d.include).length;
    return `${n} doc${n === 1 ? '' : 's'}`;
  }

  const pill = (inner, cls = '') => `<div class="il-pill ${cls}">${inner}</div>`;
  const okMark = () => `<span class="il-ok">${icon('check')}</span>`;
  const glyph = (name) => `<span class="il-clip">${icon(name)}</span>`;
  const wave = (paused) => `<span class="wave il-wave${paused ? ' paused' : ''}"><i></i><i></i><i></i><i></i><i></i></span>`;
  const src = (label, seriesId) => `<span class="il-ev" data-src="${esc(label)}" data-sid="${esc(seriesId)}">${Kit.source(esc(label))}</span>`;
  const recordBtn = () => `<button class="btn sm record" data-act="record">${icon('record')}Record<span class="kbd">${RECORD_KBD}</span></button>`;
  const pauseLabel = (paused) => (paused ? `${icon('play')}Resume` : `${icon('pause')}Pause`);
  const isPaused = () => Boolean(ui.live && ui.live.paused);
  const elapsedNow = () => (ui.live ? ui.live.base + (ui.live.paused ? 0 : (Date.now() - ui.live.at) / 1000) : 0);
  const timer = () => `<span class="num il-timer" data-il-elapsed>${clock(elapsedNow())}</span>`;
  function kIcon(type) {
    const t = has(KLABEL, type) ? type : 'fact';
    return `<span class="ktype il-k" data-type="${t}" data-tip="${KLABEL[t]}">${icon(t)}</span>`;
  }

  const setupPill = () => pill(`<img class="template-img il-mark" src="../kit/telu-menubar.png" alt=""><b>Set up Telu</b><span class="faint il-chev">${icon('chevron-right')}</span>`, 'il-setup');
  function nextPill() {
    const nx = readNext();
    if (!nx) return pill(`${icon('calendar-check')}<span class="muted">Nothing else on your calendar today</span>`, 'il-none');
    const { series: s, meeting: m } = nx;
    return pill(`<span class="series-dot" style="--c:${colorOf(s)}"></span><b class="il-name truncate">${nameOf(s)}</b><span class="faint num">${startOf(m)}</span><span class="spacer"></span><span class="num il-until">${esc(text(nx.countdown))}</span>`, 'il-next');
  }
  function carryRow(c, s) {
    const meta = [c.owner, c.note].filter((v) => text(v)).map(esc).join(' · ');
    const chip = text(c.src) ? src(c.src, s.id) : '';
    return `<div class="il-row">${kIcon(c.type)}<div class="il-main"><div class="il-text">${esc(text(c.text))}</div><div class="il-meta"><span class="truncate">${meta}</span>${chip}</div></div></div>`;
  }
  function askSection(ask, s) {
    if (!isObj(ask) || !text(ask.text)) return '';
    const chip = text(ask.src) ? ` ${src(ask.src, s.id)}` : '';
    return `<div class="il-sec il-ask"><div class="t-eyebrow il-mint">${icon('sparkle')}Worth asking</div><div class="il-text il-ask-text">${esc(ask.text)}${chip}</div></div>`;
  }
  function briefFoot(m) {
    const skip = ui.mode === 'starting' ? '<button class="btn sm plain" data-act="skip">Skip</button>' : '';
    return `<div class="il-foot"><button class="chip il-docs" data-act="docs">${icon('paperclip')}<span data-docs>${docLabel(m)}</span></button><span class="spacer"></span><button class="btn sm" data-act="open-brief">Open brief</button>${skip}${recordBtn()}</div>`;
  }
  function briefCard() {
    const nx = readNext();
    if (!nx || !isObj(nx.meeting.brief)) return nextPill();
    const { series: s, meeting: m } = nx;
    const carry = (Array.isArray(m.brief.carry) ? m.brief.carry : []).filter(isObj).slice(0, 2);
    const asks = Array.isArray(m.brief.ask) ? m.brief.ask : [];
    const why = isObj(s.purpose) && text(s.purpose.why) ? s.purpose.why : 'No purpose yet — open the brief to write one.';
    const sub = [startOf(m), esc(text(m.where)), esc(text(nx.countdown))].filter(Boolean).join(' · ');
    const since = carry.length ? `<div class="il-sec"><div class="t-eyebrow">Since last time</div>${carry.map((c) => carryRow(c, s)).join('')}</div>` : '';
    return `<div class="il-card il-brief">
      <div class="il-head">${seriesIcon(s)}<div class="il-title"><b class="truncate">${nameOf(s)}${numberTag(m)}</b><span class="muted num truncate">${sub}</span></div>${avatars(s.people)}</div>
      <p class="il-why">${esc(why)}</p>${since}${askSection(asks[0], s)}${briefFoot(m)}
    </div>`;
  }
  const startingPill = () => pill(`<span class="il-coral"></span><b>Starting now</b><span class="muted">· Record?</span><span class="spacer"></span><button class="btn sm record" data-act="record">Record</button><button class="btn sm plain" data-act="skip">Skip</button>`, 'il-starting');

  const suggestionShown = () => Boolean(ui.live && ui.live.sug === 'shown' && (readLive() || {}).suggestion);
  function livePill() {
    const lv = readLive();
    const paused = isPaused();
    return pill(`<span class="rec-dot${paused ? ' paused' : ''}"></span><b class="il-name truncate">${lv ? nameOf(lv.series) : 'Recording'}</b>${timer()}${wave(paused)}${suggestionShown() ? MINT_DOT : ''}`, 'il-live');
  }
  function lineHtml(line, fresh) {
    const words = line.text.split(' ').map((w) => `<span class="w${fresh ? ' h' : ''}">${esc(w)} </span>`).join('');
    return `<div class="il-line${fresh ? ' typing' : ''}"><span class="il-who truncate">${esc(text(line.who) || 'Someone')}</span><span class="il-said">${words}</span></div>`;
  }
  function linesHtml(transcript) {
    if (!transcript.length) return '<div class="il-line il-listening"><span class="il-who">Listening</span><span class="il-said faint">Transcribing on this Mac — lines appear as people speak.</span></div>';
    const start = Math.max(0, transcript.length - 2);
    const typed = ui.live ? ui.live.typed : transcript.length;
    return transcript.slice(start).map((line, i) => lineHtml(line, start + i >= typed)).join('');
  }
  function suggestionCard(lv) {
    const sources = lv.suggestion.sources.map((label) => src(label, lv.series.id)).join('');
    return `<div class="il-sugg"><div class="il-sugg-head">${icon('sparkle')}<span>Worth asking now</span></div><p>${esc(lv.suggestion.text)}</p><div class="il-sugg-foot">${sources}<span class="spacer"></span><button class="btn sm plain" data-act="useful">${icon('thumbs-up')}Useful</button><button class="btn sm plain icon" data-act="dismiss" data-tip="Dismiss" aria-label="Dismiss">${icon('x')}</button></div></div>`;
  }
  function liveCard() {
    const lv = readLive();
    if (!lv) return livePill();
    const paused = isPaused();
    return `<div class="il-card il-live-card">
      <div class="il-head"><span class="rec-dot${paused ? ' paused' : ''}"></span><b class="truncate">${nameOf(lv.series)}</b>${numberTag(lv.meeting)}<span class="spacer"></span>${timer()}${wave(paused)}</div>
      <div class="il-lines" data-lines="${lv.transcript.length}">${linesHtml(lv.transcript)}</div>
      <div class="il-slot">${suggestionShown() ? suggestionCard(lv) : ''}</div>
      <div class="il-foot"><button class="btn sm" data-act="pause">${pauseLabel(paused)}</button><button class="btn sm" data-act="stop"><span class="il-stop"></span>Stop<span class="kbd">${RECORD_KBD}</span></button><span class="spacer"></span><span class="t-caption il-local">${icon('lock')}On this Mac</span></div>
    </div>`;
  }

  function filingPill() {
    const name = ui.lastName || text((readAfter() || { series: {} }).series.name);
    return pill(`<span class="spinner"></span><span>${name ? `Filing to <b>${esc(name)}</b>…` : 'Filing…'}</span>`, 'il-filing');
  }
  function afterPill() {
    const af = readAfter();
    const n = af ? Math.round(count(af.pending)) : 0;
    const tail = n ? `<span class="il-review num">· ${n} to review</span>` : '<span class="muted">· all reviewed</span>';
    return pill(`${okMark()}<span>Filed to <b>${af ? nameOf(af.series) : esc(ui.lastName || 'Telu')}</b></span>${tail}`, 'il-filed');
  }
  function countsOf(m) {
    const found = [m.candidates, m.items].find((list) => Array.isArray(list) && list.length);
    if (found) {
      const kept = found.filter((k) => isObj(k) && k.state !== 'rejected');
      return Object.keys(PLURAL).map((type) => [type, kept.filter((k) => k.type === type).length]);
    }
    if (isObj(m.counts)) return [['decision', m.counts.decisions], ['commitment', m.counts.actions], ['question', m.counts.questions]];
    return [];
  }
  function countChips(m) {
    const chip = ([type, n]) => `<span class="il-count">${kIcon(type)}${n} ${PLURAL[type][n === 1 ? 0 : 1]}</span>`;
    return countsOf(m).filter(([, n]) => Number.isFinite(n) && n > 0).map(chip).join('');
  }
  function afterFacts(m) {
    const end = text(m.ended) || timesOf(m)[1];
    const facts = [text(m.duration), end ? `ended ${end}` : '', 'transcribed on this Mac'].filter(Boolean).join(' · ');
    return esc(facts.charAt(0).toUpperCase() + facts.slice(1));
  }
  function afterCard() {
    const af = readAfter();
    if (!af) return afterPill();
    const { series: s, meeting: m } = af;
    const n = Math.round(count(af.pending));
    const chips = countChips(m);
    const review = n ? `<span class="t-caption">About 30 seconds</span><button class="btn sm primary" data-act="review">Review ${n}</button>` : '<span class="t-caption">All reviewed</span>';
    return `<div class="il-card il-filed-card">
      <div class="il-head">${okMark()}<div class="il-title"><b class="truncate">Filed to ${nameOf(s)}${numberTag(m)}</b><span class="muted num truncate">${afterFacts(m)}</span></div></div>
      ${text(m.summary) ? `<p class="il-why il-summary">${esc(m.summary)}</p>` : ''}${chips ? `<div class="il-counts">${chips}</div>` : ''}
      <div class="il-foot"><button class="btn sm" data-act="open-meeting">Open meeting</button><span class="spacer"></span>${review}</div>
    </div>`;
  }

  function hintPill() {
    const t = attachTarget();
    return pill(`${glyph('paperclip')}<span>Drop on Telu to attach to <b>${t ? nameOf(t.series) : 'Telu'}</b></span>`, 'il-hint');
  }
  function dropTarget() {
    const t = attachTarget();
    const when = t ? startOf(t.meeting) : '';
    const where = t && t.live ? 'Goes with this meeting' : 'Goes into the brief';
    return `<div class="il-drop drop-target"><span class="il-clip lg">${icon('paperclip')}</span><b>Attach to ${t ? nameOf(t.series) : 'Telu'}${when ? ` · ${when}` : ''}</b><span class="t-caption">${where} · stays on this Mac</span></div>`;
  }
  const whereLabel = () => (ui.flashInfo.live ? 'with this meeting' : 'in the brief');
  function attachedPill() {
    const n = ui.flashInfo.count || 1;
    return pill(`${okMark()}<b>${n > 1 ? `Attached ${n} files` : 'Attached'}</b><span class="muted">· ${whereLabel()}</span>`, 'il-attached');
  }
  const alreadyPill = () => pill(`${glyph('info')}<span>Already ${whereLabel()}</span>`);
  const invalidPill = () => pill(`${glyph('info')}<span>Telu attaches documents like “Plan.pdf”</span>`);
  const skippedPill = () => pill(`${glyph('x-circle')}<span>Not recording <b>${esc(ui.flashInfo.name)}</b></span>`);

  function patchBrief(layer) {
    const before = (layer.querySelector('[data-docs]') || {}).textContent;
    layer.innerHTML = briefCard();
    const after = layer.querySelector('[data-docs]');
    if (after && after.textContent !== before) after.closest('.chip').classList.add('bump');
  }
  const togglePaused = (layer, paused) => layer.querySelectorAll('.rec-dot, .il-wave').forEach((el) => el.classList.toggle('paused', paused));
  function patchLivePill(layer) {
    togglePaused(layer, isPaused());
    const row = layer.querySelector('.il-pill');
    const dot = row && row.querySelector('.il-mint-dot');
    if (row && suggestionShown() && !dot) row.insertAdjacentHTML('beforeend', MINT_DOT);
    if (dot && !suggestionShown()) dot.remove();
  }
  function patchLines(layer, lv) {
    const box = layer.querySelector('.il-lines');
    if (!box || Number(box.dataset.lines) === lv.transcript.length) return;
    box.dataset.lines = String(lv.transcript.length);
    box.innerHTML = linesHtml(lv.transcript);
    later('type', () => typeLines(layer), 120);
  }
  function patchSuggestion(layer, lv) {
    const slot = layer.querySelector('.il-slot');
    const card = slot && slot.querySelector('.il-sugg');
    if (slot && suggestionShown() && !card) {
      slot.innerHTML = suggestionCard(lv);
      slot.firstElementChild.classList.add('arrive');
    }
    if (card && !suggestionShown()) card.remove();
  }
  function patchLiveCard(layer) {
    const lv = readLive();
    if (!lv) return;
    togglePaused(layer, isPaused());
    const pause = layer.querySelector('[data-act="pause"]');
    if (pause) pause.innerHTML = pauseLabel(isPaused());
    patchLines(layer, lv);
    patchSuggestion(layer, lv);
  }
  const liveSig = () => `${isPaused()}|${suggestionShown()}`;
  const liveCardSig = () => `${liveSig()}|${(readLive() || { transcript: [] }).transcript.length}`;
  function markTyped() {
    const lv = readLive();
    if (ui.live) put({ live: { ...ui.live, typed: lv ? lv.transcript.length : 0 } });
  }
  function typeLines(layer) {
    clearInterval(typing);
    const words = [...layer.querySelectorAll('.il-line.typing .w.h')];
    if (!words.length) return;
    if (Kit.reduceMotion()) {
      words.forEach((w) => w.classList.remove('h'));
      markTyped();
      return;
    }
    let i = 0;
    typing = setInterval(() => {
      const alive = layer.isConnected && !layer.classList.contains('out');
      if (alive) words[i].classList.remove('h');
      i += 1;
      if (alive && i < words.length) return;
      clearInterval(typing);
      if (alive) markTyped();
    }, MS.type);
  }

  function beginLive() {
    const lv = readLive();
    const typed = lv ? Math.max(0, lv.transcript.length - 1) : 0;
    const sugText = lv && lv.suggestion ? lv.suggestion.text : '';
    put({ live: { id: idOf(lv), base: lv ? lv.elapsed : 0, at: Date.now(), paused: false, typed, sug: 'waiting', sugText }, lastName: lv ? text(lv.series.name) : ui.lastName });
    later('suggest', arriveSuggestion, MS.suggest);
    clearInterval(ticker);
    ticker = setInterval(tick, 1000);
  }
  function endLive() {
    clearInterval(ticker);
    clearInterval(typing);
    ticker = null;
    clear('suggest', 'type', 'leave');
    put({ live: null });
  }
  function arriveSuggestion() {
    const lv = readLive();
    if (!ui.live || ui.live.sug !== 'waiting' || !lv || !lv.suggestion) return;
    put({ live: { ...ui.live, sug: 'shown', sugText: lv.suggestion.text } });
    sync();
  }
  function reconcileLive() {
    const lv = readLive();
    if (!ui.live || !lv) return;
    if (idOf(lv) !== ui.live.id) return beginLive();
    const next = lv.suggestion ? lv.suggestion.text : '';
    if (next && next !== ui.live.sugText) put({ live: { ...ui.live, sug: timers.has('suggest') ? 'waiting' : 'shown', sugText: next } });
    if (lv.transcript.length < ui.live.typed) put({ live: { ...ui.live, typed: lv.transcript.length } });
  }
  function tick() {
    if (!ui.el || !ui.live) return;
    const label = clock(elapsedNow());
    const cells = [...ui.el.querySelectorAll('[data-il-elapsed]')];
    const grew = cells.some((cell) => cell.textContent.length !== label.length);
    cells.forEach((cell) => { cell.textContent = label; });
    if (grew) refit();
  }

  const currentLayer = () => [...ui.el.children].filter((layer) => !layer.classList.contains('out')).pop() || null;
  const radiusFor = (def, h) => def.radius || (h > PILL_H + 4 ? 22 : h / 2);
  function fix(layer, w) {
    layer.style.width = `${w}px`;
    layer.style.marginLeft = `${-w / 2}px`;
  }
  function resize(w, h, r, instant) {
    const el = ui.el;
    put({ w, h });
    if (instant) el.classList.add('instant');
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;
    el.style.borderRadius = `${r}px`;
    el.dataset.shape = h > PILL_H + 4 ? 'card' : 'pill';
    if (!instant) return;
    void el.offsetWidth;
    el.classList.remove('instant');
  }
  function retire(keep) {
    [...ui.el.children].forEach((layer) => {
      if (layer === keep || layer.classList.contains('out')) return;
      if (layer.classList.contains('pre')) layer.remove();
      else layer.classList.add('out');
      setTimeout(() => layer.remove(), 160);
    });
  }
  function morph(variant, key, instant) {
    const def = VIEWS[variant];
    const now = Boolean(instant) || !currentLayer();
    const layer = Kit.html(`<div class="il pre" data-variant="${variant}">${def.render()}</div>`);
    ui.el.appendChild(layer);
    const w = layer.offsetWidth;
    const h = layer.offsetHeight;
    fix(layer, w);
    const delay = !now && w * h < ui.w * ui.h ? 90 : 0;
    ui.el.style.setProperty('--morph-delay', `${delay}ms`);
    layer.style.setProperty('--in-delay', `${now ? 0 : delay + 80}ms`);
    ui.el.classList.toggle('bouncy', Boolean(def.bounce));
    retire(layer);
    resize(w, h, radiusFor(def, h), now);
    put({ variant, key, sig: def.sig ? def.sig() : '' });
    requestAnimationFrame(() => layer.classList.remove('pre'));
    if (def.mounted) def.mounted(layer);
  }
  function refit() {
    const layer = currentLayer();
    if (!layer) return;
    layer.style.width = '';
    layer.style.marginLeft = '';
    const w = layer.offsetWidth;
    const h = layer.offsetHeight;
    fix(layer, w);
    ui.el.style.setProperty('--morph-delay', '0ms');
    ui.el.classList.remove('bouncy');
    resize(w, h, radiusFor(VIEWS[ui.variant], h), false);
  }
  function patch(def) {
    const sig = def.sig ? def.sig() : '';
    const layer = currentLayer();
    if (sig === ui.sig || !layer) return;
    put({ sig });
    if (def.patch) def.patch(layer);
    else layer.innerHTML = def.render();
    refit();
  }
  function sync(opts = {}) {
    if (!ui.el || ui.hidden) return;
    const variant = variantFor();
    const def = VIEWS[variant];
    if (!def) return;
    const key = `${variant}|${def.key ? def.key() : ''}`;
    if (key !== ui.key) morph(variant, key, opts.instant);
    else patch(def);
    if (ui.pop && !ui.pop.trigger.closest('.il:not(.out)')) closePop();
  }
  function reveal() {
    ui.el.classList.toggle('gone', ui.hidden);
    ui.el.setAttribute('aria-hidden', String(ui.hidden));
  }

  function hasSubject(mode) {
    if (mode === 'before' || mode === 'starting') return isObj((readNext() || { meeting: {} }).meeting.brief);
    if (mode === 'live') return Boolean(readLive());
    return mode === 'after' && Boolean(readAfter());
  }
  const canExpand = () => Boolean(ui.el) && !ui.drag && !ui.flash && !ui.hidden && Boolean(EXPANDED[ui.mode]) && hasSubject(ui.mode);
  function variantFor() {
    if (ui.drag && attachTarget()) return ui.drag === 'over' ? 'drop' : 'hint';
    if (ui.flash) return ui.flash;
    if (ui.expanded && EXPANDED[ui.mode] && hasSubject(ui.mode)) return EXPANDED[ui.mode];
    return ui.mode;
  }
  function setExpanded(value) {
    clear('in', 'out');
    const expanded = Boolean(value) && canExpand();
    put({ expanded, pinned: expanded && ui.pinned });
    if (!expanded) closePop();
    sync();
  }
  function pin() {
    if (!canExpand()) return;
    put({ pinned: true });
    setExpanded(true);
  }
  function collapse() {
    clear('in', 'out');
    closePop();
    put({ pinned: false });
    if (ui.expanded) setExpanded(false);
  }
  function handOff() {
    put({ suppress: ui.el.matches(':hover') });
    collapse();
  }
  function intend(event) {
    if (ui.expanded || ui.suppress) return;
    if (event.target.closest('button')) clear('in');
    else if (!timers.has('in') && canExpand()) later('in', () => setExpanded(true), MS.hoverIn);
  }
  function onEnter(event) {
    clear('out');
    intend(event);
  }
  function onLeave() {
    clear('in');
    put({ suppress: false });
    if (ui.expanded && !ui.pinned) later('out', () => setExpanded(false), MS.hoverOut);
  }
  function flash(variant, ms, info = {}) {
    clear('in', 'out');
    closePop();
    put({ flash: variant, flashInfo: info, expanded: false, pinned: false });
    sync();
    later('flash', () => { put({ flash: null }); sync(); }, ms);
  }

  function record() {
    const nx = readNext();
    if (!nx) return;
    handOff();
    dispatch('island:record', { meetingId: nx.meeting.id });
  }
  function skip() {
    const nx = readNext();
    handOff();
    dispatch('island:skip', { meetingId: nx ? nx.meeting.id : null });
    if (nx) flash('skipped', 1700, { name: text(nx.series.name) });
  }
  function stop() {
    const lv = readLive();
    const anchored = ui.live && ui.live.id !== 'none' ? ui.live.id : null;
    handOff();
    if (lv) put({ lastName: text(lv.series.name) });
    dispatch('island:stop', { meetingId: lv ? lv.meeting.id : anchored });
    if (ui.mode === 'live') applyMode('filing');
  }
  function review() {
    const af = readAfter();
    handOff();
    dispatch('island:review', { meetingId: af ? af.meeting.id : null });
  }
  function openMeeting(hit) {
    if (!hit) return;
    handOff();
    dispatch('island:open', { seriesId: hit.series.id, meetingId: hit.meeting.id });
  }
  function togglePause() {
    const lv = ui.live;
    if (!lv) return;
    put({ live: lv.paused ? { ...lv, paused: false, at: Date.now() } : { ...lv, base: elapsedNow(), paused: true } });
    sync();
  }
  function feedback(kind, btn) {
    const card = btn.closest('.il-sugg');
    if (!card || card.classList.contains('leaving') || !ui.live) return;
    card.classList.add('leaving');
    dispatch('island:feedback', { kind });
    later('leave', () => {
      if (ui.live) put({ live: { ...ui.live, sug: kind } });
      sync();
    }, Kit.reduceMotion() ? 0 : 150);
  }
  const ACTIONS = {
    record, skip, stop, review, pause: togglePause,
    docs: () => openMeeting(readNext()),
    'open-brief': () => openMeeting(readNext()),
    'open-meeting': () => openMeeting(readAfter()),
    useful: (btn) => feedback('useful', btn),
    dismiss: (btn) => feedback('dismiss', btn)
  };
  function activate() {
    if (ui.mode === 'setup') dispatch('island:setup', {});
    else if (ui.mode === 'after') review();
    else pin();
  }
  function onClick(event) {
    const act = event.target.closest('[data-act]');
    if (act && ACTIONS[act.dataset.act]) return ACTIONS[act.dataset.act](act);
    const chip = event.target.closest('.il-ev .source');
    if (chip) openEvidence(chip);
    else if (!ui.drag && !ui.flash) activate();
  }
  function onKey(event) {
    const escape = event.key === 'Escape' && ui.expanded;
    const press = (event.key === 'Enter' || event.key === ' ') && event.target === ui.el;
    if (!escape && !press) return;
    event.preventDefault();
    event.stopPropagation();
    if (escape) collapse();
    else if (!ui.drag && !ui.flash) activate();
  }
  function onDocDown(event) {
    const t = event.target;
    const file = ui.desk.querySelector('#islandFile');
    if (file) file.classList.toggle('selected', file.contains(t));
    if (!ui.expanded || ui.el.contains(t)) return;
    if ((t.closest && t.closest(OUTSIDE_IGNORE)) || document.querySelector(KIT_LAYER)) return;
    collapse();
  }

  function seriesById(id) {
    const hit = [readNext(), readLive(), readAfter()].find((h) => h && String(h.series.id) === String(id));
    return hit ? hit.series : null;
  }
  function pastMeeting(series, label, ev) {
    const meetings = Array.isArray(series.meetings) ? series.meetings.filter((m) => isObj(m) && m.id != null) : [];
    if (ev.mid != null) return meetings.find((m) => String(m.id) === String(ev.mid)) || null;
    const hit = String(label).match(/^([A-Z][a-z]{2}) (\d{1,2}) · /);
    return hit ? meetings.find((m) => text(m.day || m.date).endsWith(`${hit[2]} ${hit[1]}`)) || null : null;
  }
  const quoteHtml = (ev) => (text(ev.quote) ? `<div class="il-evd-quote">“${esc(ev.quote)}”</div>` : '<div class="il-evd-quote muted">No excerpt saved for this source.</div>');
  function docEvidence(ev) {
    const doc = text(ev.doc);
    return `<div class="il-evd"><div class="t-eyebrow">FROM THE DOC${text(ev.loc) ? ` · ${esc(ev.loc)}` : ''}</div>${quoteHtml(ev)}
      <div class="row-flex il-evd-foot">${Kit.fileBadge(doc || 'doc.txt')}<span class="truncate muted">${esc(doc)}</span><span class="spacer"></span><span class="t-caption">On this Mac</span></div></div>`;
  }
  function speechEvidence(ev, label, series) {
    const past = series ? pastMeeting(series, label, ev) : null;
    const date = esc(String(label).split(' · ')[0]);
    const where = series ? `${nameOf(series)}${past && Number.isFinite(past.n) ? ` #${past.n}` : ` · ${date}`}` : date;
    const who = text(ev.who) ? `${avatar(ev.who)}<span class="muted truncate">${esc(ev.who)}</span>` : '';
    const action = past ? `<button class="btn sm plain" data-ev-open="${esc(past.id)}">Open meeting</button>` : '<span class="t-caption">On this Mac</span>';
    return `<div class="il-evd"><div class="t-eyebrow">EVIDENCE · ${where}${text(ev.t) ? ` · ${esc(ev.t)}` : ''}</div>${quoteHtml(ev)}
      <div class="row-flex il-evd-foot">${who}<span class="spacer"></span>${action}</div></div>`;
  }
  function evidenceFor(sid, label) {
    const ev = call('evidence', sid, label);
    if (isObj(ev)) return ev;
    const [where, loc] = String(label).split(' · ');
    return /\.[a-z0-9]{2,5}$/i.test(where) ? { kind: 'doc', doc: where, loc } : { kind: 'speech', t: loc };
  }
  function openEvidence(btn) {
    const wrap = btn.closest('.il-ev');
    const { sid, src: label } = wrap.dataset;
    const ev = evidenceFor(sid, label);
    const series = seriesById(sid);
    pin();
    const markup = ev.kind === 'doc' ? docEvidence(ev) : speechEvidence(ev, label, series);
    const onClose = () => { if (ui.pop === pop) put({ pop: null }); };
    const pop = Kit.popover(btn, markup, { width: 320, className: 'il-pop', container: ui.desk, onClose });
    put({ pop });
    if (pop) pop.el.addEventListener('click', (event) => onPopClick(event, series));
  }
  function onPopClick(event, series) {
    const btn = event.target.closest('[data-ev-open]');
    if (btn && series) openMeeting({ series, meeting: { id: btn.dataset.evOpen } });
  }
  function closePop() {
    const pop = ui.pop;
    put({ pop: null });
    if (pop) pop.close();
  }

  function attachTarget() {
    if (!ui.el || ui.hidden || !ATTACHABLE.includes(ui.mode)) return null;
    const live = ui.mode === 'live';
    const hit = live ? readLive() : readNext();
    return hit ? { series: hit.series, meeting: hit.meeting, live } : null;
  }
  const isFileDrag = (event) => Boolean(event.dataTransfer) && [...event.dataTransfer.types].some((t) => t === 'Files' || t === FILE_TYPE);
  const inEditable = (event) => Boolean(event.target && event.target.closest && event.target.closest('input, textarea, [contenteditable="true"]'));
  function inside(x, y) {
    const r = ui.el.getBoundingClientRect();
    return x >= r.left - 10 && x <= r.right + 10 && y >= r.top - 10 && y <= r.bottom + 12;
  }
  function setDrag(value) {
    if (ui.drag === value || !attachTarget()) return;
    clear('in', 'out');
    closePop();
    put({ drag: value, expanded: false, pinned: false });
    sync();
  }
  function endDrag() {
    clear('drag');
    if (!ui.drag) return;
    put({ drag: null });
    sync();
  }
  const finishDrag = () => { put({ depth: 0 }); endDrag(); };
  function accept(event) {
    const allowed = Boolean(attachTarget());
    const over = allowed && inside(event.clientX, event.clientY);
    if (over || !event.defaultPrevented) {
      event.preventDefault();
      event.dataTransfer.dropEffect = over ? 'copy' : 'none';
    }
    if (allowed) setDrag(over ? 'over' : 'hint');
    later('drag', endDrag, MS.dragIdle);
  }
  function onDragEnter(event) {
    if (!isFileDrag(event)) return;
    put({ depth: ui.depth + 1 });
    if (!inEditable(event)) accept(event);
  }
  function onDragLeave(event) {
    if (!isFileDrag(event)) return;
    put({ depth: Math.max(0, ui.depth - 1) });
    if (!ui.depth) endDrag();
  }
  function onDragOver(event) {
    if (isFileDrag(event) && !inEditable(event)) accept(event);
  }
  function droppedFiles(dt) {
    const real = [...(dt.files || [])].map((f) => ({ name: text(f.name).trim(), size: Math.round(count(f.size)) }));
    const own = dt.getData(FILE_TYPE);
    if (real.length) return real.filter((f) => FILE_RE.test(f.name));
    return own && FILE_RE.test(own) ? [{ name: own, size: DESK_FILE.size }] : [];
  }
  function attach(target, files) {
    const have = new Set(briefDocs(target.meeting).map((d) => d.name.toLowerCase()));
    const fresh = files.filter((f) => !have.has(f.name.toLowerCase()));
    const info = { live: target.live, count: fresh.length };
    if (!files.length) return flash('invalid', 1600, info);
    if (!fresh.length) return flash('already', 1400, info);
    flash('attached', MS.attached, info);
    return dispatch('island:attach', { meetingId: target.meeting.id, files: fresh });
  }
  function onDrop(event) {
    if (inEditable(event) || !isFileDrag(event)) return;
    const target = attachTarget();
    const onIsland = ui.el.contains(event.target) || (!event.defaultPrevented && inside(event.clientX, event.clientY));
    finishDrag();
    if (!target || !onIsland) return;
    event.preventDefault();
    attach(target, droppedFiles(event.dataTransfer));
  }
  function openDeskFile() {
    if (attachTarget()) flash('hint', 1600);
    else Kit.toast(`${esc(DESK_FILE.name)} · Telu attaches files before or during a meeting`, { icon: 'paperclip', container: ui.desk });
  }
  function mountFile(desk) {
    const file = desk.querySelector('#islandFile') || desk.appendChild(Kit.html(FILE_HTML));
    if (file.dataset.bound) return;
    file.dataset.bound = 'true';
    file.addEventListener('dragstart', (event) => {
      event.dataTransfer.setData(FILE_TYPE, DESK_FILE.name);
      event.dataTransfer.setData('text/plain', DESK_FILE.name);
      event.dataTransfer.effectAllowed = 'copy';
      file.classList.add('selected');
      setDrag('hint');
    });
    file.addEventListener('dragend', finishDrag);
    file.addEventListener('dblclick', openDeskFile);
  }
  function bindIsland(el) {
    if (el.dataset.bound) return;
    el.dataset.bound = 'true';
    const handlers = { pointerenter: onEnter, pointermove: intend, pointerleave: onLeave, click: onClick, keydown: onKey };
    Object.entries(handlers).forEach(([type, fn]) => el.addEventListener(type, fn));
  }
  function bindDocument() {
    if (ui.bound) return;
    put({ bound: true });
    const handlers = { dragenter: onDragEnter, dragleave: onDragLeave, dragover: onDragOver, drop: onDrop };
    Object.entries(handlers).forEach(([type, fn]) => document.addEventListener(type, fn));
    document.addEventListener('pointerdown', onDocDown, true);
  }

  const VIEWS = {
    setup: { render: setupPill },
    before: { key: () => idOf(readNext()), render: nextPill, sig: nextPill },
    brief: { key: () => idOf(readNext()), render: briefCard, sig: briefCard, patch: patchBrief, radius: 22 },
    starting: { key: () => idOf(readNext()), render: startingPill },
    live: { key: () => idOf(readLive()), render: livePill, sig: liveSig, patch: patchLivePill },
    'live-card': { key: () => idOf(readLive()), render: liveCard, sig: liveCardSig, patch: patchLiveCard, radius: 22, mounted: (layer) => later('type', () => typeLines(layer), 260) },
    filing: { render: filingPill, sig: filingPill },
    after: { key: () => idOf(readAfter()), render: afterPill, sig: afterPill },
    'after-card': { key: () => idOf(readAfter()), render: afterCard, sig: afterCard, radius: 22 },
    hint: { key: () => idOf(attachTarget()), render: hintPill },
    drop: { key: () => idOf(attachTarget()), render: dropTarget, radius: 20 },
    attached: { render: attachedPill, bounce: true },
    already: { render: alreadyPill },
    invalid: { render: invalidPill },
    skipped: { render: skippedPill }
  };

  function applyMode(mode) {
    const wasHidden = ui.hidden;
    const keep = ui.expanded && Boolean(EXPANDED[mode]) && ui.el.matches(':hover');
    closePop();
    clear('in', 'out', 'flash');
    put({ mode, hidden: mode === 'hidden', flash: null, expanded: keep, pinned: keep && ui.pinned, drag: mode === 'hidden' ? null : ui.drag });
    if (mode === 'live') beginLive();
    else if (ui.live) endLive();
    if (!ui.hidden) sync({ instant: wasHidden });
    reveal();
  }
  function set(mode) {
    if (!MODES.includes(mode)) return;
    if (!ui.el) put({ mode, hidden: mode === 'hidden' });
    else if (mode === ui.mode) refresh();
    else applyMode(mode);
  }
  function refresh() {
    if (!ui.el) return;
    if (ui.mode === 'live') reconcileLive();
    sync();
  }
  function mount(desk, bridge) {
    if (!desk || typeof desk.querySelector !== 'function') return;
    if (bridge) put({ bridge });
    if (ui.el && ui.el.isConnected && desk.contains(ui.el)) return refresh();
    const el = desk.querySelector('#island') || desk.appendChild(Kit.html(ISLAND_HTML));
    el.classList.add('island', 'gone');
    put({ el, desk, key: null, hidden: ui.mode === 'hidden' });
    bindIsland(el);
    mountFile(desk);
    bindDocument();
    if (ui.mode === 'live' && !ui.live) beginLive();
    requestAnimationFrame(() => { sync(); reveal(); });
  }

  return { mount, set, refresh };
})();
