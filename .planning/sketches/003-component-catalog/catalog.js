window.Catalog = (() => {
  const sections = [];
  const FORCE = [[/:hover/g, '.is-hover'], [/:active/g, '.is-active'], [/:focus-visible/g, '.is-focus'], [/:focus(?![-\w])/g, '.is-focus']];
  const PSEUDO = /:hover|:active|:focus/;
  const mounted = [];

  const esc = (text) => String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const slug = (text) => String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  function cloneRules(list, parent) {
    [...list].forEach((rule) => {
      if (rule.cssRules && !(rule instanceof CSSStyleRule)) cloneRules(rule.cssRules, rule);
      if (!(rule instanceof CSSStyleRule) || !PSEUDO.test(rule.selectorText)) return;
      const selector = rule.selectorText.split(',').filter((s) => PSEUDO.test(s))
        .map((s) => FORCE.reduce((acc, [re, cls]) => acc.replace(re, cls), s)).join(',');
      try { parent.insertRule(`${selector} { ${rule.style.cssText} }`, parent.cssRules.length); } catch (error) { return; }
    });
  }
  function forcePseudoStates() {
    [...document.styleSheets].forEach((sheet) => {
      let rules;
      try { rules = sheet.cssRules; } catch (error) { return; }
      cloneRules(rules, sheet);
    });
  }

  function withScenario(id, render) {
    if (!window.T || !T.scenarioState) return render();
    const saved = T.state;
    T.state = T.scenarioState(id);
    try { return render(); } finally { T.state = saved; }
  }

  function matrix({ rows, cols, render, label = (r, c) => `${r.label} · ${c.label}`, ...rest }) {
    return rows.flatMap((r) => cols.map((c) => ({ label: label(r, c), force: c.force, html: render(r, c), ...rest })));
  }

  function table({ label, note, rows, cols, render, bg, rowHead = '' }) {
    const head = `<div class="cat-mx-h">${esc(rowHead)}</div>${cols.map((c) => `<div class="cat-mx-h">${esc(c.label)}</div>`).join('')}`;
    const body = rows.map((r) => `<div class="cat-mx-r">${esc(r.label)}</div>${cols.map((c) => `<div class="cat-mx-c"${c.force ? ` data-force-cell="${c.force}"` : ''}>${render(r, c)}</div>`).join('')}`).join('');
    return {
      label, note, bg, span: 'full', align: 'stretch',
      html: `<div class="cat-mx" style="grid-template-columns:max-content repeat(${cols.length}, minmax(0, 1fr))">${head}${body}</div>`,
      mount: (canvas) => canvas.querySelectorAll('[data-force-cell]').forEach((cell) => {
        const target = cell.querySelector('[data-force]') || cell.firstElementChild;
        if (target) target.classList.add(`is-${cell.dataset.forceCell}`);
      })
    };
  }

  const section = (def) => {
    if (def.css) document.head.insertAdjacentHTML('beforeend', `<style data-section="${def.id}">${def.css}</style>`);
    sections.push(def);
  };

  const specRows = (c) => [
    c.props && c.props.length ? `<tr><th>Props</th><td><table class="cat-props">${c.props.map(([name, values, def]) => `<tr><td><code>${esc(name)}</code></td><td>${esc(values)}</td><td class="faint">${esc(def ?? '')}</td></tr>`).join('')}</table></td></tr>` : '',
    c.states && c.states.length ? `<tr><th>States</th><td>${c.states.map((s) => `<span class="cat-pill">${esc(s)}</span>`).join('')}</td></tr>` : '',
    c.tokens && c.tokens.length ? `<tr><th>Tokens</th><td>${c.tokens.map((t) => `<code>${esc(t)}</code>`).join(' ')}</td></tr>` : '',
    c.motion ? `<tr><th>Motion</th><td>${esc(c.motion)}</td></tr>` : '',
    c.a11y ? `<tr><th>Accessibility</th><td>${esc(c.a11y)}</td></tr>` : '',
    c.source ? `<tr><th>Source</th><td><code>${esc(c.source)}</code></td></tr>` : ''
  ].join('');

  function tileMarkup(story, key) {
    const span = story.span === 'full' ? ' full' : story.span ? ` span-${story.span}` : '';
    const style = [story.height ? `min-height:${story.height}px` : '', story.align ? `place-items:${story.align}` : ''].filter(Boolean).join(';');
    return `<figure class="cat-tile${span}" data-bg="${story.bg || 'content'}" data-key="${key}">
      <div class="cat-canvas${story.flush ? ' flush' : ''}" style="${style}">${typeof story.html === 'function' ? story.html() : story.html || ''}</div>
      <figcaption><b>${esc(story.label)}</b>${story.note ? `<span>${esc(story.note)}</span>` : ''}</figcaption>
    </figure>`;
  }

  function componentMarkup(sec, c) {
    const id = `${sec.id}-${c.id || slug(c.name)}`;
    const meta = [
      c.mapsTo ? `<span class="cat-chip">${icon('arrow-right', 'sm')}Maps to ${esc(c.mapsTo)}</span>` : '',
      c.usedIn && c.usedIn.length ? `<span class="cat-chip faint">Used in ${esc(c.usedIn.join(' · '))}</span>` : ''
    ].join('');
    const stories = (c.stories || []).map((s, i) => tileMarkup(s, `${id}:${i}`)).join('');
    return `<article class="cat-comp" id="${id}" data-search="${esc(`${c.name} ${c.summary || ''} ${(c.usedIn || []).join(' ')} ${sec.title}`.toLowerCase())}">
      <header class="cat-comp-head"><h2>${esc(c.name)}</h2>${c.summary ? `<p>${esc(c.summary)}</p>` : ''}<div class="cat-meta">${meta}</div></header>
      <div class="cat-grid">${stories}</div>
      ${specRows(c) ? `<table class="cat-spec">${specRows(c)}</table>` : ''}
    </article>`;
  }

  function sectionMarkup(sec) {
    return `<section class="cat-section" id="${sec.id}"><header class="cat-sec-head"><span class="cat-eyebrow">${esc(sec.eyebrow || 'Section')}</span><h1>${esc(sec.title)}</h1>${sec.intro ? `<p>${esc(sec.intro)}</p>` : ''}</header>${sec.components.map((c) => componentMarkup(sec, c)).join('')}</section>`;
  }

  function navMarkup() {
    return sections.map((sec) => `<div class="cat-nav-sec"><a class="cat-nav-title" href="#${sec.id}">${esc(sec.title)}</a>${sec.components.map((c) => {
      const id = `${sec.id}-${c.id || slug(c.name)}`;
      return `<a class="cat-nav-link" href="#${id}" data-target="${id}">${esc(c.name)}</a>`;
    }).join('')}</div>`).join('');
  }

  function mountStories() {
    sections.forEach((sec) => sec.components.forEach((c) => {
      const id = `${sec.id}-${c.id || slug(c.name)}`;
      (c.stories || []).forEach((story, i) => {
        const tile = document.querySelector(`[data-key="${id}:${i}"]`);
        if (!tile) return;
        const canvas = tile.querySelector('.cat-canvas');
        if (story.force) canvas.querySelectorAll('[data-force]').forEach((el) => el.classList.add(`is-${story.force}`));
        if (story.force && !canvas.querySelector('[data-force]') && canvas.firstElementChild) canvas.firstElementChild.classList.add(`is-${story.force}`);
        if (story.mount) {
          try { story.mount(canvas); } catch (error) { canvas.insertAdjacentHTML('beforeend', `<div class="cat-error">${esc(error.message)}</div>`); }
        }
      });
    }));
  }

  function wireSearch() {
    const input = document.getElementById('catSearch');
    const count = document.getElementById('catCount');
    const apply = () => {
      const q = input.value.trim().toLowerCase();
      let shown = 0;
      document.querySelectorAll('.cat-comp').forEach((el) => {
        const hit = !q || el.dataset.search.includes(q);
        el.hidden = !hit;
        if (hit) shown += 1;
        const link = document.querySelector(`.cat-nav-link[data-target="${el.id}"]`);
        if (link) link.hidden = !hit;
      });
      document.querySelectorAll('.cat-section').forEach((sec) => { sec.hidden = !sec.querySelector('.cat-comp:not([hidden])'); });
      count.textContent = `${shown} components`;
    };
    input.addEventListener('input', apply);
    document.addEventListener('keydown', (event) => {
      if (event.key === '/' && document.activeElement !== input && !event.target.isContentEditable && !/INPUT|TEXTAREA/.test(event.target.tagName)) {
        event.preventDefault();
        input.focus();
      }
    });
    apply();
  }

  function wireTheme() {
    const link = document.getElementById('theme');
    const set = (name) => {
      link.href = link.href.replace(/[^/]+\.css(\?.*)?$/, `${name}.css`);
      document.documentElement.dataset.theme = name;
    };
    const initial = new URLSearchParams(location.search).get('theme') === 'dark' ? 'dark' : 'default';
    const root = document.getElementById('catTheme');
    root.querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.value === initial)));
    Kit.segmented(root, set);
    set(initial);
  }

  function wireSpy() {
    const links = new Map([...document.querySelectorAll('.cat-nav-link')].map((a) => [a.dataset.target, a]));
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        links.forEach((a) => a.classList.remove('active'));
        const link = links.get(entry.target.id);
        if (!link) return;
        link.classList.add('active');
        const nav = document.getElementById('catNav');
        const top = link.offsetTop;
        if (top < nav.scrollTop || top + link.offsetHeight > nav.scrollTop + nav.clientHeight) nav.scrollTop = top - nav.clientHeight / 3;
      });
    }, { rootMargin: '-20% 0px -70% 0px' });
    document.querySelectorAll('.cat-comp').forEach((el) => observer.observe(el));
  }

  function toMarkdown() {
    const lines = ['# Telu component inventory', '', 'Generated from sketch 003 (`.planning/sketches/003-component-catalog/`). Visual reference: open the catalog page. Source of truth for look and behavior: sketch 002.', ''];
    sections.forEach((sec) => {
      lines.push(`## ${sec.title}`, '');
      if (sec.intro) lines.push(sec.intro, '');
      sec.components.forEach((c) => {
        lines.push(`### ${c.name}`, '');
        if (c.summary) lines.push(c.summary, '');
        if (c.mapsTo) lines.push(`- **Maps to:** ${c.mapsTo}`);
        if (c.usedIn && c.usedIn.length) lines.push(`- **Used in:** ${c.usedIn.join(', ')}`);
        if (c.source) lines.push(`- **Source:** \`${c.source}\``);
        if (c.states && c.states.length) lines.push(`- **States:** ${c.states.join(', ')}`);
        if (c.tokens && c.tokens.length) lines.push(`- **Tokens:** ${c.tokens.map((t) => `\`${t}\``).join(', ')}`);
        if (c.motion) lines.push(`- **Motion:** ${c.motion}`);
        if (c.a11y) lines.push(`- **Accessibility:** ${c.a11y}`);
        if (c.props && c.props.length) {
          lines.push('', '| Prop | Values | Default |', '|---|---|---|');
          c.props.forEach(([name, values, def]) => lines.push(`| \`${name}\` | ${String(values).replace(/\|/g, '\\|')} | ${def ?? ''} |`));
        }
        const variants = (c.stories || []).map((s) => s.label);
        if (variants.length) lines.push('', `Shown: ${variants.join(' · ')}`);
        lines.push('');
      });
    });
    return lines.join('\n');
  }

  function render() {
    document.getElementById('catNav').innerHTML = navMarkup();
    document.getElementById('catMain').innerHTML = sections.map(sectionMarkup).join('');
    forcePseudoStates();
    mountStories();
    wireSearch();
    wireSpy();
    if (location.hash) {
      const target = document.getElementById(location.hash.slice(1));
      if (target) target.scrollIntoView();
    }
  }

  addEventListener('load', () => {
    wireTheme();
    render();
  });

  return { section, sections, matrix, table, withScenario, esc, toMarkdown };
})();
