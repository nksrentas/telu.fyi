(() => {
  const frozenNow = new Date('2026-09-27T10:46:00').getTime();
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

  const resolveEntry = (entry, args) => {
    if (entry && typeof entry === 'object' && !Array.isArray(entry) && '$byArg' in entry) {
      const key = String((args || {})[entry.$byArg]);
      return key in entry.cases ? entry.cases[key] : entry.default;
    }
    return entry;
  };

  const invoke = async (cmd, args) => {
    if (cmd === 'plugin:event|listen' || cmd === 'plugin:event|unlisten') {
      return nextId++;
    }
    const table = window.__TELU_IPC__ || {};
    if (Object.prototype.hasOwnProperty.call(table, cmd)) {
      const value = resolveEntry(table[cmd], args);
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
