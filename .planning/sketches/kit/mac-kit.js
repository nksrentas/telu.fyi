window.Kit = (() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';
  const EASE_IN_OUT = 'cubic-bezier(0.77, 0, 0.175, 1)';
  const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const html = (markup) => {
    const tpl = document.createElement('template');
    tpl.innerHTML = markup.trim();
    return tpl.content.firstElementChild;
  };
  const esc = (text) => String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const windowEl = () => $('.window') || document.body;
  const desktopEl = () => $('.desktop') || document.body;

  const themeLink = document.getElementById('theme');
  const applyTheme = (name) => {
    if (themeLink && name) themeLink.href = themeLink.href.replace(/[^/]+\.css(\?.*)?$/, `${name}.css`);
  };
  applyTheme(new URLSearchParams(location.search).get('theme'));
  addEventListener('message', (event) => {
    if (event.data && event.data.type === 'theme') applyTheme(event.data.value);
  });

  const initials = (name) => name === 'You' ? 'YOU' : name.split(/[\s.]+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  const personColor = (name) => (window.DATA && DATA.people[name]) || '#8E8E93';
  const avatar = (name, cls = '') => `<span class="avatar ${cls}" style="--c:${personColor(name)}" title="${name}">${name === 'You' ? '' : initials(name)}</span>`;
  const avatars = (names, max = 4) => {
    const shown = names.slice(0, max).map((name) => avatar(name)).join('');
    const more = names.length > max ? `<span class="more">+${names.length - max}</span>` : '';
    return `<span class="avatars">${shown}${more}</span>`;
  };
  const series = (id) => DATA.series.find((s) => s.id === id);
  const meeting = (id) => {
    for (const s of DATA.series) {
      const m = s.meetings.find((mt) => mt.id === id);
      if (m) return { series: s, meeting: m };
    }
    return null;
  };
  const fileKind = (name) => (name.split('.').pop() || 'txt').toLowerCase();
  const fileBadge = (name) => {
    const kind = fileKind(name);
    const label = { docx: 'DOC', xlsx: 'XLS' }[kind] || kind.toUpperCase().slice(0, 3);
    return `<span class="ftype" data-kind="${esc(kind)}">${esc(label)}</span>`;
  };
  const docChip = (name, meta = '') => `<span class="doc-chip">${fileBadge(name)}<span class="truncate">${esc(name)}</span>${meta ? `<small>${esc(meta)}</small>` : ''}</span>`;
  const KTYPE = { decision: ['decision', 'Decision'], commitment: ['commitment', 'Commitment'], question: ['question', 'Open question'], fact: ['fact', 'Fact'] };
  const ktype = (type) => `<span class="ktype" data-type="${type}">${icon(KTYPE[type][0])}${KTYPE[type][1]}</span>`;
  const STATUS = { current: 'Current', superseded: 'Superseded', disputed: 'Disputed', unresolved: 'Unresolved', open: 'Open', completed: 'Done', cancelled: 'Cancelled' };
  const status = (s) => `<span class="status" data-s="${s}">${STATUS[s] || s}</span>`;
  const source = (label) => `<button class="source" data-src="${label}">${icon('quote')}${label}</button>`;
  const seriesIcon = (s, cls = '') => `<span class="series-icon ${cls}" style="--c:${s.color}">${icon(s.icon)}</span>`;

  function scrollEdge(scroller, toolbar) {
    const update = () => toolbar.classList.toggle('scrolled', scroller.scrollTop > 2);
    scroller.addEventListener('scroll', update, { passive: true });
    update();
  }

  function segmented(root, onChange) {
    let thumb = $('.seg-thumb', root);
    if (!thumb) {
      thumb = document.createElement('span');
      thumb.className = 'seg-thumb';
      root.prepend(thumb);
    }
    const buttons = $$(':scope > button', root);
    const place = (btn, animate) => {
      if (!animate) thumb.style.transition = 'none';
      thumb.style.width = `${btn.offsetWidth}px`;
      thumb.style.transform = `translateX(${btn.offsetLeft}px)`;
      if (!animate) {
        thumb.getBoundingClientRect();
        thumb.style.transition = '';
      }
    };
    const select = (btn, { animate = true, silent = false } = {}) => {
      buttons.forEach((b) => b.setAttribute('aria-selected', String(b === btn)));
      place(btn, animate);
      if (!silent && onChange) onChange(btn.dataset.value, btn);
    };
    buttons.forEach((btn) => btn.addEventListener('click', () => select(btn)));
    const initial = buttons.find((b) => b.getAttribute('aria-selected') === 'true') || buttons[0];
    requestAnimationFrame(() => select(initial, { animate: false, silent: true }));
    return {
      set: (value, opts) => {
        const btn = buttons.find((b) => b.dataset.value === value);
        if (btn) select(btn, opts);
      }
    };
  }

  let tooltipEl;
  let tooltipTimer;
  let lastTooltipHide = 0;
  function tooltips() {
    tooltipEl = tooltipEl || document.body.appendChild(html('<div class="tooltip"></div>'));
    document.addEventListener('pointerover', (event) => {
      const target = event.target.closest('[data-tip]');
      if (!target) return;
      clearTimeout(tooltipTimer);
      const warm = Date.now() - lastTooltipHide < 600 || tooltipEl.classList.contains('show');
      const show = () => {
        tooltipEl.textContent = target.dataset.tip;
        const rect = target.getBoundingClientRect();
        tooltipEl.classList.toggle('instant', warm);
        tooltipEl.style.left = `${Math.max(8, rect.left + rect.width / 2 - tooltipEl.offsetWidth / 2)}px`;
        tooltipEl.style.top = `${rect.bottom + 6}px`;
        tooltipEl.classList.add('show');
      };
      if (warm) show();
      else tooltipTimer = setTimeout(show, 650);
    });
    document.addEventListener('pointerout', (event) => {
      const target = event.target.closest('[data-tip]');
      if (!target || target.contains(event.relatedTarget)) return;
      clearTimeout(tooltipTimer);
      if (tooltipEl.classList.contains('show')) lastTooltipHide = Date.now();
      tooltipEl.classList.remove('show');
    });
    document.addEventListener('pointerdown', () => {
      clearTimeout(tooltipTimer);
      tooltipEl.classList.remove('show');
    });
  }

  const layers = [];
  const pushLayer = (layer) => layers.push(layer);
  const dropLayer = (layer) => {
    const index = layers.indexOf(layer);
    if (index >= 0) layers.splice(index, 1);
  };
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !layers.length) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    layers[layers.length - 1].close();
  }, true);

  function position(el, trigger, container, { side = 'bottom', align = 'start', offset = 8, point } = {}) {
    const c = container.getBoundingClientRect();
    const t = point ? { left: point.x, right: point.x, top: point.y, bottom: point.y, width: 0, height: 0 } : trigger.getBoundingClientRect();
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    let left = align === 'end' ? t.right - w : align === 'center' ? t.left + t.width / 2 - w / 2 : t.left;
    let top = side === 'top' ? t.top - h - offset : t.bottom + offset;
    if (side === 'bottom' && top + h > c.bottom - 8) top = t.top - h - offset;
    if (side === 'top' && top < c.top + 8) top = t.bottom + offset;
    left = Math.min(Math.max(left, c.left + 8), c.right - w - 8);
    top = Math.max(top, c.top + 8);
    el.style.left = `${left - c.left}px`;
    el.style.top = `${top - c.top}px`;
    const originX = Math.min(Math.max(t.left + t.width / 2 - left, 12), w - 12);
    el.style.setProperty('--origin', `${originX}px ${top >= t.bottom ? 0 : h}px`);
  }

  let openPopover = null;
  function popover(trigger, markup, opts = {}) {
    if (openPopover) {
      const same = openPopover.trigger === trigger;
      openPopover.close();
      if (same && !opts.force) return null;
    }
    const container = opts.container || trigger.closest('.window, .desktop, .panel-host') || desktopEl();
    const el = html(`<div class="popover ${opts.className || ''}" role="dialog">${markup}</div>`);
    if (opts.width) el.style.width = `${opts.width}px`;
    container.appendChild(el);
    position(el, trigger, container, opts);
    requestAnimationFrame(() => el.classList.add('open'));
    const onDown = (event) => {
      if (!el.contains(event.target) && !trigger.contains(event.target)) api.close();
    };
    const api = {
      el, trigger,
      close() {
        document.removeEventListener('pointerdown', onDown, true);
        dropLayer(api);
        if (openPopover === api) openPopover = null;
        el.classList.add('closing');
        el.classList.remove('open');
        setTimeout(() => el.remove(), 140);
        if (opts.onClose) opts.onClose();
      }
    };
    document.addEventListener('pointerdown', onDown, true);
    pushLayer(api);
    openPopover = api;
    return api;
  }

  let openMenu = null;
  function menu(trigger, items, opts = {}) {
    if (openMenu) {
      const same = openMenu.trigger === trigger;
      openMenu.close(true);
      if (same) return null;
    }
    const container = opts.container || (trigger && trigger.closest('.window, .desktop, .panel-host')) || desktopEl();
    const el = html('<div class="menu" role="menu" tabindex="-1"></div>');
    const entries = [];
    items.forEach((item) => {
      if (item === '-') return el.appendChild(html('<div class="menu-sep"></div>'));
      if (item.title) return el.appendChild(html(`<div class="menu-title">${item.title}</div>`));
      const row = html(`<div class="menu-item ${item.danger ? 'danger' : ''} ${item.disabled ? 'disabled' : ''}" role="menuitem">${item.icon ? icon(item.icon) : item.swatch ? `<span class="series-dot" style="--c:${item.swatch}"></span>` : ''}<span class="truncate">${item.label}</span>${item.kbd ? `<span class="kbd">${item.kbd}</span>` : ''}</div>`);
      entries.push({ row, item });
      row.addEventListener('pointerenter', () => setActive(entries.findIndex((e) => e.row === row)));
      row.addEventListener('click', () => choose(entries.find((e) => e.row === row)));
      el.appendChild(row);
    });
    let active = -1;
    const setActive = (index) => {
      active = index;
      entries.forEach((e, i) => e.row.classList.toggle('active', i === index));
    };
    const choose = (entry) => {
      if (!entry || entry.item.disabled) return;
      const row = entry.row;
      row.classList.remove('active');
      setTimeout(() => row.classList.add('active'), 60);
      setTimeout(() => {
        api.close();
        if (entry.item.onSelect) entry.item.onSelect();
      }, 130);
    };
    container.appendChild(el);
    if (opts.minWidth) el.style.minWidth = `${opts.minWidth}px`;
    position(el, trigger, container, { offset: 4, ...opts });
    el.style.setProperty('--origin', '0 0');
    el.focus({ preventScroll: true });
    const onKey = (event) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const dir = event.key === 'ArrowDown' ? 1 : -1;
        let next = active;
        do { next = (next + dir + entries.length) % entries.length; } while (entries[next].item.disabled && next !== active);
        setActive(next);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        choose(entries[active]);
      }
    };
    const onDown = (event) => {
      if (!el.contains(event.target) && !(trigger && trigger.contains(event.target))) api.close();
    };
    const api = {
      el, trigger,
      close(instant) {
        document.removeEventListener('pointerdown', onDown, true);
        el.removeEventListener('keydown', onKey);
        dropLayer(api);
        if (openMenu === api) openMenu = null;
        if (instant) return el.remove();
        el.classList.add('closing');
        setTimeout(() => el.remove(), 130);
      }
    };
    el.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown, true);
    pushLayer(api);
    openMenu = api;
    return api;
  }
  const contextMenu = (event, items, opts = {}) => {
    event.preventDefault();
    return menu(null, items, { ...opts, point: { x: event.clientX, y: event.clientY }, offset: 2, container: opts.container || event.target.closest('.window, .desktop') || desktopEl() });
  };

  function sheet(markup, opts = {}) {
    const container = opts.container || windowEl();
    const scrim = html('<div class="scrim"></div>');
    const el = html(`<div class="sheet ${opts.className || ''}" role="dialog" aria-modal="true">${markup}</div>`);
    if (opts.width) el.style.setProperty('--sheet-w', `${opts.width}px`);
    container.append(scrim, el);
    requestAnimationFrame(() => {
      scrim.classList.add('open');
      el.classList.add('open');
      const focusable = $('[autofocus], input, textarea', el);
      if (focusable) setTimeout(() => focusable.focus({ preventScroll: true }), 60);
    });
    let closed = false;
    const api = {
      el,
      close(result) {
        if (closed) return;
        closed = true;
        dropLayer(api);
        el.classList.add('closing');
        el.classList.remove('open');
        scrim.classList.remove('open');
        setTimeout(() => { el.remove(); scrim.remove(); }, 200);
        if (opts.onClose) opts.onClose(result);
      }
    };
    el.addEventListener('click', (event) => {
      const closer = event.target.closest('[data-close]');
      if (closer) api.close(closer.dataset.close || undefined);
    });
    if (opts.closeOnScrim) scrim.addEventListener('click', () => api.close());
    pushLayer(api);
    return api;
  }

  function alert({ title, message, buttons = [{ label: 'OK', value: 'ok', primary: true }], iconMarkup, container: host } = {}) {
    return new Promise((resolve) => {
      const container = host || desktopEl();
      const el = html(`<div class="alert" role="alertdialog">
        ${iconMarkup || '<div class="app-icon"><img src="../kit/telu-icon.png" alt=""></div>'}
        <h3>${title}</h3>${message ? `<p>${message}</p>` : ''}
        <div class="alert-actions">${buttons.map((b, i) => `<button class="btn ${b.primary ? 'primary' : ''}" data-i="${i}">${b.label}</button>`).join('')}</div>
      </div>`);
      container.appendChild(el);
      requestAnimationFrame(() => el.classList.add('open'));
      const finish = (value) => {
        dropLayer(api);
        document.removeEventListener('keydown', onKey, true);
        el.classList.add('closing');
        el.classList.remove('open');
        setTimeout(() => el.remove(), 160);
        resolve(value);
      };
      const cancel = buttons.find((b) => !b.primary) || buttons[0];
      const primary = buttons.find((b) => b.primary) || buttons[0];
      const api = { close: () => finish(cancel.value) };
      const onKey = (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          finish(primary.value);
        }
      };
      el.addEventListener('click', (event) => {
        const btn = event.target.closest('[data-i]');
        if (btn) finish(buttons[Number(btn.dataset.i)].value);
      });
      document.addEventListener('keydown', onKey, true);
      pushLayer(api);
    });
  }

  function toast(text, opts = {}) {
    const container = opts.container || windowEl();
    let stack = $(':scope > .toast-stack', container);
    if (!stack) stack = container.appendChild(html('<div class="toast-stack"></div>'));
    const el = html(`<div class="toast" role="status">${opts.icon ? icon(opts.icon) : ''}<span>${text}</span>${opts.action ? `<button class="btn sm tinted">${opts.action.label}</button>` : ''}</div>`);
    stack.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    let remaining = opts.duration || 4200;
    let started = Date.now();
    let timer = setTimeout(() => dismiss(), remaining);
    const dismiss = () => {
      clearTimeout(timer);
      el.classList.add('hide');
      setTimeout(() => el.remove(), 200);
    };
    el.addEventListener('pointerenter', () => {
      clearTimeout(timer);
      remaining -= Date.now() - started;
    });
    el.addEventListener('pointerleave', () => {
      started = Date.now();
      timer = setTimeout(dismiss, Math.max(remaining, 1200));
    });
    if (opts.action) {
      $('.btn', el).addEventListener('click', () => {
        opts.action.onClick();
        dismiss();
      });
    }
    return { dismiss };
  }

  function notify({ title, body, time = 'now', actions = [], duration = 7000, onClick, container } = {}) {
    const desk = container || desktopEl();
    let stack = $(':scope > .notif-stack', desk);
    if (!stack) stack = desk.appendChild(html('<div class="notif-stack"></div>'));
    const el = html(`<div class="notif" role="status">
      <div class="app-icon"><img src="../kit/telu-icon.png" alt=""></div>
      <div><b>${title}</b>${body ? `<p>${body}</p>` : ''}</div>
      <time>${time}</time>
      ${actions.length ? `<div class="notif-actions">${actions.map((a, i) => `<button class="btn sm ${a.primary ? 'primary' : ''}" data-i="${i}">${a.label}</button>`).join('')}</div>` : ''}
    </div>`);
    stack.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show')));
    let timer = setTimeout(() => dismiss(), duration);
    const dismiss = () => {
      clearTimeout(timer);
      el.classList.add('hide');
      el.classList.remove('show');
      setTimeout(() => el.remove(), 260);
    };
    el.addEventListener('pointerenter', () => clearTimeout(timer));
    el.addEventListener('pointerleave', () => { timer = setTimeout(dismiss, 2500); });
    el.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-i]');
      if (btn) actions[Number(btn.dataset.i)].onClick();
      else if (onClick) onClick();
      dismiss();
    });
    return { dismiss };
  }

  function scenarios(list, onSelect, initial) {
    const bar = html(`<div class="scenario"><b>Scenario</b>${list.map((s) => `<button data-id="${s.id}" aria-pressed="${s.id === initial}">${s.label}</button>`).join('')}</div>`);
    document.body.appendChild(bar);
    const set = (id, fire = true) => {
      $$('button', bar).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === id)));
      if (fire) onSelect(id);
    };
    bar.addEventListener('click', (event) => {
      const btn = event.target.closest('button');
      if (btn) set(btn.dataset.id);
    });
    return { set };
  }

  const CODE_NAMES = { Space: 'space', ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Enter: 'enter', Escape: 'escape', Backspace: 'backspace', Delete: 'delete', Tab: 'tab', BracketLeft: '[', BracketRight: ']', Slash: '/', Comma: ',' };
  const keyName = (event) => {
    const code = event.code;
    if (CODE_NAMES[code]) return CODE_NAMES[code];
    if (code.startsWith('Key')) return code.slice(3).toLowerCase();
    if (code.startsWith('Digit')) return code.slice(5);
    return event.key.toLowerCase();
  };
  const isTyping = (target) => target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
  function keys(map) {
    document.addEventListener('keydown', (event) => {
      const combo = [event.metaKey && 'mod', event.ctrlKey && 'ctrl', event.altKey && 'alt', event.shiftKey && 'shift', keyName(event)].filter(Boolean).join('+');
      const handler = map[combo];
      if (!handler) return;
      const hasModifier = event.metaKey || event.ctrlKey || event.altKey;
      if (isTyping(event.target) && !hasModifier && combo !== 'escape') return;
      if (layers.length && !hasModifier) return;
      event.preventDefault();
      handler(event);
    });
  }

  function flip(elements, mutate, { duration = 320, easing = EASE_OUT } = {}) {
    const first = new Map(elements.map((el) => [el, el.getBoundingClientRect()]));
    mutate();
    if (reduceMotion()) return;
    elements.forEach((el) => {
      if (!el.isConnected) return;
      const a = first.get(el);
      const b = el.getBoundingClientRect();
      const dx = a.left - b.left;
      const dy = a.top - b.top;
      if (!dx && !dy) return;
      el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration, easing });
    });
  }

  function flyTo(fromEl, toEl, { markup, duration = 560 } = {}) {
    if (!fromEl || !toEl) return Promise.resolve();
    const a = fromEl.getBoundingClientRect();
    const b = toEl.getBoundingClientRect();
    const receive = () => {
      toEl.classList.remove('receive');
      void toEl.offsetWidth;
      toEl.classList.add('receive');
      const bumpTarget = toEl.querySelector('.series-icon, .series-dot, img') || toEl;
      bumpTarget.classList.remove('bump');
      void bumpTarget.offsetWidth;
      bumpTarget.classList.add('bump');
    };
    if (reduceMotion()) {
      receive();
      return Promise.resolve();
    }
    const outer = document.createElement('div');
    const inner = document.createElement('div');
    inner.innerHTML = markup || fromEl.outerHTML;
    Object.assign(outer.style, { position: 'fixed', left: `${a.left}px`, top: `${a.top}px`, zIndex: 5000, pointerEvents: 'none' });
    Object.assign(inner.style, { transformOrigin: 'left center', borderRadius: '10px', boxShadow: cssVar('--shadow-float'), background: cssVar('--glass-strong'), width: markup ? 'auto' : `${a.width}px` });
    outer.appendChild(inner);
    document.body.appendChild(outer);
    const dx = b.left - a.left;
    const dy = b.top + b.height / 2 - (a.top + a.height / 2);
    const scale = Math.min(1, Math.max(0.4, b.height / a.height));
    outer.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${dx}px)` }], { duration, easing: 'cubic-bezier(0.45, 0, 0.2, 1)', fill: 'forwards' });
    const anim = inner.animate([
      { transform: 'translateY(0) scale(1)', opacity: 1 },
      { transform: `translateY(${dy}px) scale(${scale})`, opacity: 0.35 }
    ], { duration, easing: 'cubic-bezier(0.6, 0, 0.9, 0.7)', fill: 'forwards' });
    return anim.finished.then(() => {
      outer.remove();
      receive();
    });
  }

  function removeAnimated(el, { duration = 220 } = {}) {
    if (reduceMotion()) {
      el.remove();
      return Promise.resolve();
    }
    const style = getComputedStyle(el);
    el.style.overflow = 'hidden';
    return el.animate([
      { height: `${el.offsetHeight}px`, opacity: 1, marginTop: style.marginTop, marginBottom: style.marginBottom, paddingTop: style.paddingTop, paddingBottom: style.paddingBottom },
      { height: '0px', opacity: 0, marginTop: '0px', marginBottom: '0px', paddingTop: '0px', paddingBottom: '0px' }
    ], { duration, easing: EASE_OUT }).finished.then(() => el.remove());
  }

  function enterAnimated(el, { duration = 280 } = {}) {
    if (reduceMotion()) return;
    const height = el.offsetHeight;
    const overflow = el.style.overflow;
    el.style.overflow = 'hidden';
    el.animate([{ height: '0px', opacity: 0 }, { height: `${height}px`, opacity: 1 }], { duration, easing: EASE_OUT })
      .finished.then(() => { el.style.overflow = overflow; });
  }

  function viewTransition(update) {
    if (!document.startViewTransition || reduceMotion()) return update();
    return document.startViewTransition(update);
  }

  function stagger(container, selector = ':scope > *') {
    $$(selector, container).forEach((el, i) => {
      el.style.setProperty('--i', i);
      el.classList.remove('enter');
      void el.offsetWidth;
      el.classList.add('enter');
    });
  }

  function timer(el, from = 0) {
    let seconds = from;
    const render = () => {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = seconds % 60;
      el.textContent = `${h ? `${h}:` : ''}${String(m).padStart(h ? 2 : 1, '0')}:${String(s).padStart(2, '0')}`;
    };
    render();
    const id = setInterval(() => { seconds += 1; render(); }, 1000);
    return () => clearInterval(id);
  }

  const DAY_RE = /\b(mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)s?\b/;
  const STOP_RE = /\b(every|on|at|weekly|monthly|daily|biweekly|tomorrow|today|next|first|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)s?\b|\d/i;
  const DAY_LABEL = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };
  const titleCase = (text) => text.replace(/\s+/g, ' ').trim().replace(/(^|\s)([a-z])/g, (m, space, c) => space + c.toUpperCase());
  function parseSeries(raw) {
    const text = raw.trim();
    const blank = (m) => ' '.repeat(m.length);
    const lower = text.toLowerCase();
    const oneOnOne = /\b1:1\b|\b1-1\b|one on one/.test(lower);
    let scrubbed = lower.replace(/\b1:1\b|\b1-1\b|one on one/g, blank);
    let people = [];
    const withIdx = scrubbed.search(/\bwith\s/);
    if (withIdx >= 0) {
      const after = text.slice(withIdx + 5);
      const stopAt = after.search(STOP_RE);
      const span = stopAt >= 0 ? after.slice(0, stopAt) : after;
      people = span.split(/,|\band\b|&/i).map((p) => p.trim()).filter(Boolean).map(titleCase);
      scrubbed = scrubbed.slice(0, withIdx) + ' '.repeat(5 + span.length) + scrubbed.slice(withIdx + 5 + span.length);
    }
    let cadence = /every other|biweekly|fortnightly|every (2|two) weeks/.test(scrubbed) ? 'Every 2 weeks'
      : /monthly|every month|first (mon|tue|wed|thu|fri)/.test(scrubbed) ? 'Monthly'
      : /daily|every day|weekdays/.test(scrubbed) ? 'Daily'
      : /weekly|every week|every (mon|tue|wed|thu|fri|sat|sun)/.test(scrubbed) ? 'Weekly'
      : null;
    const dayMatch = scrubbed.match(DAY_RE);
    const day = dayMatch ? DAY_LABEL[dayMatch[1].slice(0, 3)] : null;
    if (day && !cadence) cadence = 'Weekly';
    let time = null;
    const timeMatch = scrubbed.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?(?![\d:])/);
    const dayThenNumber = new RegExp(DAY_RE.source + '\\s+\\d').test(scrubbed);
    if (timeMatch && (timeMatch[2] || timeMatch[3] || /\bat\s+\d/.test(scrubbed) || dayThenNumber)) {
      let hours = Number(timeMatch[1]);
      if (timeMatch[3] === 'pm' && hours < 12) hours += 12;
      if (timeMatch[3] === 'am' && hours === 12) hours = 0;
      if (!timeMatch[3] && hours < 8) hours += 12;
      if (hours < 24) time = `${String(hours).padStart(2, '0')}:${timeMatch[2] || '00'}`;
    }
    let title;
    if (oneOnOne && people[0]) title = `1:1 · ${people[0].split(' ')[0]}`;
    else {
      const rest = titleCase(scrubbed
        .replace(/every other|biweekly|fortnightly|every (2|two) weeks|monthly|every month|daily|every day|weekdays|weekly|every week|every|first|tomorrow|today|next week/g, ' ')
        .replace(new RegExp(DAY_RE.source, 'g'), ' ')
        .replace(/\b(?:at\s+)?\d{1,2}(?::\d{2})?\s*(am|pm)?\b/g, ' ')
        .replace(/\b(on|at|the|a|an)\b|[,.]/g, ' '));
      title = rest && rest.split(' ').length < 2 && people[0] ? `${rest} with ${people[0]}` : rest || (people[0] ? `Meeting with ${people[0]}` : '');
    }
    return { title, cadence: cadence || 'One-off', day, time, people };
  }

  function evidence(trigger, ev, { where = '', onOpen } = {}) {
    const pop = popover(trigger, `
      <div style="padding:8px 10px 10px;max-width:320px">
        <div class="t-eyebrow" style="margin-bottom:8px">EVIDENCE${where ? ` · ${where}` : ''} · ${ev.t}</div>
        <div style="font-size:14px;line-height:1.45;padding-left:10px;box-shadow:inset 2px 0 0 var(--accent-soft)">“${ev.quote}”</div>
        <div class="row-flex" style="margin-top:10px">${avatar(ev.who)}<span class="muted">${ev.who}</span><span class="spacer"></span>${onOpen ? '<button class="btn sm plain" data-open>Open transcript</button>' : ''}</div>
      </div>`, { width: 320 });
    if (pop && onOpen) $('[data-open]', pop.el).addEventListener('click', () => { pop.close(); onOpen(); });
    return pop;
  }

  document.addEventListener('click', (event) => {
    const toggle = event.target.closest('.switch, .check');
    if (!toggle || toggle.hasAttribute('data-manual')) return;
    const next = toggle.getAttribute('aria-checked') !== 'true';
    toggle.setAttribute('aria-checked', String(next));
    toggle.dispatchEvent(new CustomEvent('toggle', { bubbles: true, detail: { checked: next } }));
  });

  const checkSvg = '<svg viewBox="0 0 14 14"><path d="M3.2 7.4l2.4 2.4 5.2-5.6"/></svg>';

  function menubar({ app = 'Telu', menus = ['File', 'Edit', 'View', 'Window', 'Help'], extras = '' } = {}) {
    return `<header class="menubar">
      <span class="mb-item">${icon('apple')}</span>
      <span class="mb-item app">${app}</span>
      ${menus.map((m) => `<span class="mb-item">${m}</span>`).join('')}
      <span class="mb-right">${extras}
        <span class="mb-item">${icon('battery')}</span>
        <span class="mb-item">${icon('wifi')}</span>
        <span class="mb-item">${icon('search')}</span>
        <span class="mb-item">${icon('control')}</span>
        <span class="mb-item num">${DATA.now.menubar}</span>
      </span>
    </header>`;
  }

  tooltips();

  return {
    $, $$, html, esc, nextFrame, reduceMotion, cssVar, EASE_OUT, EASE_IN_OUT,
    initials, avatar, avatars, personColor, series, meeting, fileKind, fileBadge, docChip, ktype, status, source, seriesIcon, checkSvg,
    scrollEdge, segmented, popover, menu, contextMenu, sheet, alert, toast, notify, scenarios, keys,
    flip, flyTo, removeAnimated, enterAnimated, viewTransition, stagger, timer, parseSeries, evidence, menubar
  };
})();
