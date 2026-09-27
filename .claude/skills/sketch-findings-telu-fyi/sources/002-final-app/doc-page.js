(() => {
  const T = window.T;
  const D = T.doc;
  const { $, $$ } = Kit;
  const e = Kit.esc;
  const DRAWER_SPACE = 366;

  D.current = () => (T.state.view.kind === 'doc' ? T.seriesById(T.state.view.seriesId) : null);
  D.pageRoot = () => $('#view .doc');
  D.receive = (el) => {
    if (!el) return;
    el.classList.remove('receive');
    void el.offsetWidth;
    el.classList.add('receive');
  };

  let titleObserver = null;
  const observeTitle = () => {
    if (titleObserver) titleObserver.disconnect();
    const tb = $('#tbDocTitle');
    const target = $('#docTitle');
    if (!tb || !target) return;
    tb.classList.remove('show');
    const offset = parseInt(Kit.cssVar('--toolbar-h'), 10) || 52;
    titleObserver = new IntersectionObserver(([entry]) => {
      const top = entry.rootBounds ? entry.rootBounds.top : 0;
      tb.classList.toggle('show', !entry.isIntersecting && entry.boundingClientRect.top < top);
    }, { root: T.el.content, rootMargin: `-${offset}px 0px 0px 0px`, threshold: 0 });
    titleObserver.observe(target);
  };

  let markObserver = null;
  const visibleMarks = new Set();
  const marks = () => $$('#view .doc [data-mark]');
  const pickActive = () => {
    const list = marks();
    const canvas = T.el.content;
    if (!list.length) return null;
    if (canvas.scrollTop + canvas.clientHeight >= canvas.scrollHeight - 4 && canvas.scrollTop > 0) {
      const bottom = canvas.getBoundingClientRect().bottom - 40;
      return list.filter((el) => el.getBoundingClientRect().top < bottom).pop() || list[list.length - 1];
    }
    return list.find((el) => visibleMarks.has(el)) || null;
  };
  D.updateActiveMark = () => {
    const active = pickActive();
    if (!active) return;
    $$('#scrubber .scrub-item').forEach((b) => b.classList.toggle('active', b.dataset.target === active.id));
  };
  D.refreshMarks = () => {
    if (markObserver) markObserver.disconnect();
    visibleMarks.clear();
    const list = marks();
    T.el.scrubber.innerHTML = list.map((el, i) => `${i === 3 ? '<span class="scrub-gap"></span>' : ''}<button class="scrub-item" data-act="scrub" data-target="${e(el.id)}" aria-label="${e(el.dataset.mark)}"><span class="scrub-label">${e(el.dataset.mark)}</span><span class="scrub-tick"></span></button>`).join('');
    if (!list.length) return;
    markObserver = new IntersectionObserver((entries) => {
      entries.forEach((en) => (en.isIntersecting ? visibleMarks.add(en.target) : visibleMarks.delete(en.target)));
      D.updateActiveMark();
    }, { root: T.el.content, rootMargin: '-64px 0px -50% 0px', threshold: 0 });
    list.forEach((el) => markObserver.observe(el));
  };
  D.clearMarks = () => {
    if (markObserver) markObserver.disconnect();
    if (titleObserver) titleObserver.disconnect();
    visibleMarks.clear();
    T.el.scrubber.innerHTML = '';
  };
  D.scrubTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: Kit.reduceMotion() ? 'auto' : 'smooth', block: 'start' });
  };
  let scrollFrame = 0;
  D.onScroll = () => {
    if (scrollFrame || T.state.view.kind !== 'doc') return;
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = 0;
      D.updateActiveMark();
    });
  };

  const mount = () => {
    const s = D.current();
    observeTitle();
    D.refreshMarks();
    if (s && s.draft) D.mountDraft();
    T.syncTimers();
  };
  const paint = () => {
    const s = D.current();
    D.flushSave();
    T.el.view.className = 'canvas-inner';
    T.el.view.innerHTML = s ? D.docMarkup(s) : '';
    T.el.content.scrollTop = 0;
    mount();
  };
  let swapToken = 0;
  D.paintPage = async ({ animate = false } = {}) => {
    const token = ++swapToken;
    const inner = T.el.view;
    inner.getAnimations().forEach((a) => a.cancel());
    if (!animate || Kit.reduceMotion() || inner.className !== 'canvas-inner' && !inner.innerHTML) {
      paint();
      return true;
    }
    const out = inner.animate([{ opacity: 1, filter: 'blur(0px)' }, { opacity: 0, filter: 'blur(2px)' }], { duration: 120, easing: 'ease-out', fill: 'forwards' });
    const finished = await out.finished.then(() => true, () => false);
    if (!finished || token !== swapToken || T.state.view.kind !== 'doc') return false;
    paint();
    out.cancel();
    inner.animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 180, easing: Kit.EASE_OUT });
    return true;
  };
  D.repaintPage = () => {
    if (T.state.view.kind !== 'doc') return;
    const scroll = T.el.content.scrollTop;
    paint();
    T.el.content.scrollTop = scroll;
  };
  D.leavePage = () => {
    D.flushSave();
    D.closeDrawer();
    D.clearMarks();
    swapToken += 1;
  };

  const shiftCanvas = (open) => {
    const main = T.el.main.getBoundingClientRect();
    const column = $('#view .doc');
    const width = column ? column.getBoundingClientRect().width : 0;
    const left = (main.width - width) / 2;
    const shift = open && column ? Math.max(0, Math.min(left + width + 24 - (main.width - DRAWER_SPACE), left - 24)) : 0;
    T.el.view.style.setProperty('--shift', `${-shift}px`);
  };
  D.drawerOpen = () => T.el.drawer.classList.contains('open');
  D.openDrawer = (markup) => {
    T.el.drawer.innerHTML = markup;
    T.el.drawer.classList.add('open');
    shiftCanvas(true);
    T.el.main.classList.add('drawer-open');
    const btn = $('#tbInspector');
    if (btn) btn.classList.add('on');
  };
  D.closeDrawer = () => {
    T.el.drawer.classList.remove('open');
    shiftCanvas(false);
    T.el.main.classList.remove('drawer-open');
    const btn = $('#tbInspector');
    if (btn) btn.classList.remove('on');
  };
  D.openTranscript = (sid, mid, t) => {
    const s = T.seriesById(sid);
    const m = s && s.meetings.find((x) => x.id === mid);
    if (!m) return;
    D.openDrawer(D.drawerTranscript(s, m, t));
    const body = $('#drawerBody');
    const hl = body && body.querySelector('.tl.hl');
    if (hl) body.scrollTop = Math.max(0, hl.offsetTop - body.clientHeight / 2 + hl.offsetHeight / 2);
  };
  D.toggleInspector = () => {
    if (D.drawerOpen()) return D.closeDrawer();
    const s = D.current();
    if (s) D.openDrawer(D.drawerInfo(s));
    return undefined;
  };

  D.toggleMeeting = (mtg, force) => {
    if (!mtg || mtg.classList.contains('cancelled') || mtg.classList.contains('pk-past')) return;
    const open = typeof force === 'boolean' ? force : !mtg.classList.contains('open');
    T.set({ expanded: { ...T.state.expanded, [mtg.dataset.mid]: open } });
    mtg.classList.toggle('open', open);
    mtg.querySelector('.disclosure').classList.toggle('open', open);
    mtg.querySelector('.collapsible').classList.toggle('collapsed', !open);
  };
  D.jumpToMeeting = (mid) => {
    const el = document.getElementById(`m-${mid}`);
    if (!el) return;
    D.toggleMeeting(el, true);
    const smooth = !Kit.reduceMotion();
    el.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
    T.later(() => D.receive(el), smooth ? 360 : 0);
  };
  D.revealInPage = (reveal) => {
    const el = reveal.next ? $('#sec-next') : document.getElementById(`m-${reveal.mid}`);
    if (!el) return;
    if (!reveal.next) D.toggleMeeting(el, true);
    el.scrollIntoView({ block: 'start' });
    T.later(() => D.receive(el), 80);
  };
  D.focusPurpose = () => {
    const why = $('#view .p-why');
    if (!why) return;
    why.scrollIntoView({ block: 'center' });
    why.focus({ preventScroll: true });
    const range = document.createRange();
    range.selectNodeContents(why);
    range.collapse(false);
    getSelection().removeAllRanges();
    getSelection().addRange(range);
  };

  D.paintPageMemory = (sid, keys = []) => {
    const s = T.seriesById(sid);
    const body = $('#memBody');
    const doc = D.pageRoot();
    if (!s || !body || !doc || doc.dataset.sid !== sid) return;
    body.innerHTML = D.memoryBody(s);
    keys.forEach((key) => D.receive(body.querySelector(`.mem-item[data-key="${CSS.escape(key)}"]`)));
    const tick = $('#scrubber [data-target="sec-memory"] .scrub-tick');
    if (tick) D.receive(tick);
  };
  D.afterPastChange = (sid) => {
    const s = D.current();
    if (!s || s.id !== sid) return;
    if (!s.meetings.some((m) => !T.util.isUpcoming(m))) $('#pastList').innerHTML = D.pastList(s);
    $('#earlierSlot').innerHTML = D.earlierButton(s);
    D.refreshMarks();
  };
  D.insertNewest = (sid, mid) => {
    const s = T.seriesById(sid);
    const doc = D.pageRoot();
    if (!s || !doc || doc.dataset.sid !== sid) return null;
    const m = mid ? s.meetings.find((x) => x.id === mid) : s.meetings.find((x) => !T.util.isUpcoming(x));
    if (!m) return null;
    T.set({ expanded: { ...T.state.expanded, [m.id]: true } });
    const list = $('#pastList');
    const empty = list.querySelector('.past-empty');
    if (empty) empty.remove();
    const existing = document.getElementById(`m-${m.id}`);
    if (existing) existing.remove();
    const el = Kit.html(D.meetingMarkup(s, m));
    list.prepend(el);
    Kit.enterAnimated(el);
    $('#earlierSlot').innerHTML = D.earlierButton(s);
    D.refreshMarks();
    return el;
  };
  D.paintPageMeta = () => {
    const s = D.current();
    const meta = $('#docMeta');
    if (s && meta && !s.draft) meta.innerHTML = D.metaMarkup(s);
  };

  Object.assign(T.actions, {
    scrub: (el) => D.scrubTo(el.dataset.target),
    inspector: () => D.toggleInspector(),
    'close-drawer': () => D.closeDrawer(),
    'toggle-meeting': (el, ev) => {
      if (!ev.target.closest('.grip')) D.toggleMeeting(el.closest('.mtg'));
    },
    transcript: (el) => {
      const host = el.closest('[data-mid]');
      const sid = D.sidOf(el);
      if (el.closest('#peek')) return D.togglePeekTranscript(el);
      if (host && sid) D.openTranscript(sid, host.dataset.mid);
      return undefined;
    }
  });

  D.sidOf = (el) => {
    const host = el.closest('[data-sid]');
    return host ? host.dataset.sid : null;
  };
  D.midOf = (el) => {
    const host = el.closest('[data-mid]');
    return host ? host.dataset.mid : null;
  };
  D.togglePeekTranscript = (el, t) => {
    const block = el.closest('.pk-past');
    const panel = block && block.querySelector('.pk-transcript');
    if (!panel) return;
    const open = t ? true : panel.classList.contains('collapsed');
    panel.classList.toggle('collapsed', !open);
    const btn = block.querySelector('[data-act="transcript"]');
    if (btn) btn.innerHTML = `${icon('quote')}${open ? 'Hide transcript' : 'Open transcript'}`;
    if (!open || !t) return;
    $$('.tl', panel).forEach((line) => line.classList.toggle('hl', line.dataset.t === t));
    const hit = $(`.tl[data-t="${CSS.escape(t)}"]`, panel);
    if (hit) T.later(() => T.reveal(hit, $('#pkScroll'), { center: true, smooth: true }), 280);
  };
})();
