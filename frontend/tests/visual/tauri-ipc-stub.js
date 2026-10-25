(() => {
  const frozenNow = new Date('2026-09-27T10:46:00+03:00').getTime();
  const RealDate = Date;
  class FrozenDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) {
        super(frozenNow);
      } else {
        super(...args);
      }
    }

    static now() {
      return frozenNow;
    }
  }
  window.Date = FrozenDate;

  const callbacks = new Map();
  let nextId = 1;
  window.__TELU_UNMOCKED__ = [];

  const fillTemplate = (template, index) =>
    JSON.parse(JSON.stringify(template), (_key, value) => {
      if (typeof value !== 'string') return value;
      const numeric = /^\$i(?:\*(\d+(?:\.\d+)?))?(?:\+(\d+(?:\.\d+)?))?$/.exec(value);
      if (numeric) return index * Number(numeric[1] ?? 1) + Number(numeric[2] ?? 0);
      return value.split('$i').join(String(index));
    });

  const expand = (value) => {
    if (value && typeof value === 'object' && !Array.isArray(value) && '$repeat' in value) {
      return Array.from({ length: value.$repeat }, (_unused, index) => fillTemplate(value.template, index));
    }
    return value;
  };

  const state = {};
  const reviewedState = { accept: 'accepted', reject: 'rejected', restore: 'proposed', reopen: 'proposed' };

  const readState = (entry) => {
    if (!(entry.$state in state)) state[entry.$state] = expand(entry.initial);
    return state[entry.$state];
  };

  const reviewInState = (key, { itemId, action }) => {
    const meeting = state[key];
    const current = meeting && [...meeting.items, ...meeting.rejected].find((item) => item.itemId === itemId);
    if (!current) throw new Error(`unknown item in $review state ${key}: ${itemId}`);
    const reviewState = reviewedState[action];
    const view = { ...current, reviewState, eligibility: reviewState === 'accepted' && current.evidenceStatus === 'valid' };
    const others = (list) => list.filter((item) => item.itemId !== itemId);
    const upsert = (list) => (list.some((item) => item.itemId === itemId) ? list.map((item) => (item.itemId === itemId ? view : item)) : [...list, view]);
    const rejected = reviewState === 'rejected';
    const items = rejected ? others(meeting.items) : upsert(meeting.items);
    state[key] = {
      ...meeting,
      items,
      rejected: rejected ? upsert(meeting.rejected) : others(meeting.rejected),
      pendingCount: items.filter((item) => item.reviewState === 'proposed').length,
      acceptedCount: items.filter((item) => item.reviewState === 'accepted').length,
    };
    return view;
  };

  const isDirective = (entry, key) => entry && typeof entry === 'object' && !Array.isArray(entry) && key in entry;

  const resolveEntry = (entry, args) => {
    if (isDirective(entry, '$state')) return readState(entry);
    if (isDirective(entry, '$review')) return reviewInState(entry.$review, args || {});
    if (isDirective(entry, '$byArg')) {
      const key = String((args || {})[entry.$byArg]);
      return expand(key in entry.cases ? entry.cases[key] : entry.default);
    }
    return expand(entry);
  };

  const invoke = async (cmd, args) => {
    if (cmd === 'plugin:event|listen' || cmd === 'plugin:event|unlisten') {
      return nextId++;
    }
    const table = window.__TELU_IPC__ || {};
    if (Object.prototype.hasOwnProperty.call(table, cmd)) {
      const value = resolveEntry(table[cmd], args);
      if (value && typeof value === 'object' && '$pending' in value) return new Promise(() => {});
      if (value && typeof value === 'object' && '$error' in value) throw value.$error;
      return value === undefined ? null : JSON.parse(JSON.stringify(value));
    }
    window.__TELU_UNMOCKED__.push(cmd);
    throw new Error(`unmocked command: ${cmd}`);
  };

  const transformCallback = (callback, once = false) => {
    const id = nextId++;
    callbacks.set(id, (payload) => {
      if (once) {
        callbacks.delete(id);
      }
      return callback && callback(payload);
    });
    return id;
  };

  window.__TAURI_INTERNALS__ = {
    invoke,
    transformCallback,
    unregisterCallback: (id) => callbacks.delete(id),
    callbacks,
    convertFileSrc: (path) => path,
    metadata: {
      currentWindow: { label: 'main' },
      currentWebview: { windowLabel: 'main', label: 'main' },
    },
  };
  window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} };

  if (window.__TELU_THEME__ === 'dark') {
    const applyDark = () => {
      if (document.documentElement && !document.documentElement.classList.contains('dark')) {
        document.documentElement.classList.add('dark');
      }
    };
    applyDark();
    document.addEventListener('readystatechange', applyDark);
    new MutationObserver(applyDark).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  }
})();
