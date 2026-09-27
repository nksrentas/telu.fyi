(() => {
  const section = Catalog.sections.find((s) => s.id === 'primitives');
  if (!section) return;
  const e = Catalog.esc;
  const motion = ({ trigger, props, duration, easing, runtime, reduced, framer }) => [
    `Trigger: ${trigger}`, `Animates: ${props}`, `Duration: ${duration}`, `Easing: ${easing}`, `Runtime: ${runtime}`, `Reduced motion: ${reduced}`, `framer-motion: ${framer}`
  ].join(' · ');
  const replayButton = (label = 'Replay') => `<button class="btn sm pm-replay" data-replay>${icon('play')}${label}</button>`;
  const onReplay = (fn) => (canvas) => {
    fn(canvas, true);
    canvas.querySelector('[data-replay]').addEventListener('click', () => fn(canvas, false));
  };
  const restart = (el, cls) => {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  };
  const cell = (markup, label) => `<div class="pm-cell">${markup}<small>${e(label)}</small></div>`;
  const series = (id) => DATA.series.find((s) => s.id === id);
  const EXTRA_SERIES = [
    { name: 'Untitled (draft)', color: 'var(--series-gray)', icon: 'notes' },
    { name: 'Daily Standup', color: 'var(--series-gray)', icon: 'sun' },
    { name: 'Growth Review', color: 'var(--series-teal)', icon: 'target' },
    { name: 'One-off recording', color: 'var(--series-gray)', icon: 'record' }
  ];
  const ALL_SERIES = [...DATA.series, ...EXTRA_SERIES];

  const PEOPLE = Object.keys(DATA.people);
  const ps = series('product-sync');
  const peopleChip = (s) => `<button class="chip meta-chip" data-act="people"><span class="avatars">${s.people.slice(0, 3).map((n) => Kit.avatar(n)).join('')}</span><span>${s.people.length} ${s.people.length === 1 ? 'person' : 'people'}</span></button>`;
  const standup = DATA.proposals.find((p) => p.id === 'pr-standup');

  const FILES = ['Q4 Roadmap.pdf', 'North-star metrics.docx', 'Team charter.md', 'Pasted note.txt', 'Pricing experiment.xlsx', 'Board deck Q3.key'];
  const docButton = (name, meta = '') => T.doc.docButton(name, meta);
  const refChip = (d) => `<button class="doc-chip ref-chip" data-name="${e(d.name)}">${T.doc.badge(d.name)}<span class="truncate">${e(d.name)}</span>${d.ver ? `<small>${e(d.ver)}</small>` : ''}<span class="inc-dot ${d.include ? '' : 'off'}" data-tip="${d.include ? 'Included in every brief' : 'Not included in briefs'}"></span></button>`;
  const DOC_STATES = [{ label: 'Rest' }, { label: 'Hover', force: 'hover' }, { label: 'Pressed', force: 'active' }];
  const replayChipIn = (canvas, first) => {
    if (!first) canvas.querySelectorAll('.doc-chip').forEach((chip, i) => setTimeout(() => restart(chip, 'chip-in'), i * 60));
  };

  const SHORTCUTS = [
    ['↑ ↓', 'Move selection in the agenda (no animation) · scroll the doc'], ['← →', 'Previous / next day (instant swap)'], ['↩', 'Open the selected meeting in the side peek'],
    ['⌘R', 'Record / stop'], ['⌥⌘N', 'New series'], ['⌘E', 'Edit purpose'], ['⌘F', 'Find'], ['⌘[', 'Back from a doc'], ['⌘W', 'Close window (Telu keeps running)'],
    ['⌥Space · ⌘0', 'Summon Telu'], ['⇧⌘E', 'Export as Markdown'], ['⌘O', 'Attach files'], ['esc', 'Close the top layer, blur, close drawer or peek, then go back']
  ];

  const miniDot = (live) => (live ? '<span class="chip coral countdown"><span class="mini-dot"></span>Starting now</span>' : '<span class="chip a-chip-once"><i class="a-mini-dot"></i>Records at 17:00</span>');
  const islandPill = (paused) => `<div class="cat-static"><div class="island" data-shape="pill" style="width:auto"><div class="il-pill il-live"><span class="rec-dot${paused ? ' paused' : ''}"></span><b class="il-name truncate">Product Sync</b><span class="num il-timer">12:04</span><span class="wave il-wave${paused ? ' paused' : ''}"><i></i><i></i><i></i><i></i><i></i></span></div></div></div>`;
  const wave = (cls = '') => `<span class="wave ${cls}"><i></i><i></i><i></i><i></i><i></i></span>`;

  const runProgress = (bar, duration = 900) => {
    bar.getAnimations().forEach((a) => a.cancel());
    const grow = bar.animate([{ transform: 'scaleX(0)', opacity: 1 }, { transform: 'scaleX(1)', opacity: 1 }], { duration, easing: 'linear', fill: 'forwards' });
    return grow.finished.then(() => bar.animate([{ opacity: 1, transform: 'scaleX(1)' }, { opacity: 0, transform: 'scaleX(1)' }], { duration: 220, easing: 'ease-out', fill: 'forwards' }).finished).catch(() => {});
  };
  const replayProgress = (canvas, first) => {
    const bar = canvas.querySelector('.a-progress');
    if (first) bar.animate([{ transform: 'scaleX(0.62)', opacity: 1 }], { duration: 0, fill: 'forwards' });
    else runProgress(bar);
  };

  const emptyBare = `<div class="empty">${icon('sun', 'xl')}<h3>Nothing scheduled</h3></div>`;
  const pages = () => T.pages;

  const cardBody = '<div class="pm2-card-body"><b>Product Sync</b><span class="muted">Every Tue · 10:00–10:45 · Google Meet</span></div>';
  const CARD_COLS = [{ label: 'Static' }, { label: 'Interactive · rest', interactive: true }, { label: 'Hover', interactive: true, force: 'hover' }, { label: 'Pressed', interactive: true, force: 'active' }];

  const seriesHit = (s) => `<div class="row hoverable a-hit" data-force>${Kit.seriesIcon(s)}<span class="truncate">${e(s.name)}</span><span class="spacer"></span><span class="faint truncate">${e(s.rule.split(' · ')[0])}</span></div>`;
  const memoryHit = (s, k) => `<div class="row hoverable a-hit" data-force><span class="ktype" data-type="${k.type}">${icon(k.type)}</span><span class="truncate">${e(k.text)}</span><span class="spacer"></span><span class="faint truncate a-hit-meta">${e(s.name)}</span></div>`;
  const selectedRow = (s) => `<div class="row selected a-hit">${Kit.seriesIcon(s)}<span class="truncate">${e(s.name)}</span><span class="spacer"></span><span class="faint truncate">${e(s.rule.split(' · ')[0])}</span></div>`;

  const collapsibleMarkup = (open) => `<div class="pm2-coll"><div class="pm2-coll-head" data-toggle>${icon('chevron-right', `disclosure${open ? ' open' : ''}`)}<span class="mtg-date">Tue 22 Sep</span><span class="mtg-n num">#36 · 43 min</span></div>`
    + `<div class="collapsible${open ? '' : ' collapsed'}"><div><p class="mtg-summary pm2-coll-body">${e(ps.meetings[1].summary)}</p></div></div></div>`;
  const toggleCollapsible = (root, force) => {
    const body = root.querySelector('.collapsible');
    const open = typeof force === 'boolean' ? force : body.classList.contains('collapsed');
    body.classList.toggle('collapsed', !open);
    root.querySelector('.disclosure').classList.toggle('open', open);
  };
  const wireCollapsible = (canvas, first) => {
    const root = canvas.querySelector('.pm2-coll');
    if (first) {
      root.querySelector('[data-toggle]').addEventListener('click', () => toggleCollapsible(root));
      return;
    }
    toggleCollapsible(root, false);
    setTimeout(() => toggleCollapsible(root, true), 420);
  };

  const nextDocs = (over) => `<div class="nb-group next-docs${over ? ' drop-target' : ''}"><div class="nb-label">Docs for this meeting</div><div class="next-doc-list">${docButton('Q4 Roadmap.pdf')}${docButton('North-star metrics.docx')}</div><div class="drop-note">${icon('tray-down')}Drop files to attach</div></div>`;
  const wireDrop = (canvas, first) => {
    const zone = canvas.querySelector('.next-docs');
    if (first) {
      ['dragenter', 'dragover'].forEach((type) => zone.addEventListener(type, (ev) => { ev.preventDefault(); zone.classList.add('drop-target'); }));
      ['dragleave', 'drop'].forEach((type) => zone.addEventListener(type, (ev) => { ev.preventDefault(); zone.classList.remove('drop-target'); }));
      return;
    }
    zone.classList.toggle('drop-target');
  };

  const CSS = `
.pm2-sizes { display: flex; align-items: flex-end; gap: 22px; flex-wrap: wrap; }
.pm2-people { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; width: 100%; }
.pm2-person { display: flex; align-items: center; gap: 8px; font-size: 12px; }
.pm2-list { width: 100%; max-width: 380px; }
.pm2-shortcuts { display: grid; grid-template-columns: 120px minmax(0, 1fr); gap: 7px 16px; width: 100%; font-size: 12.5px; color: var(--label-2); align-items: baseline; }
.pm2-shortcuts .kbd { font-size: 12px; color: var(--label); }
.pm2-card-body { display: flex; flex-direction: column; gap: 2px; padding: 12px 14px; width: 200px; font-size: 12px; }
.pm2-card-body b { font-size: 13px; font-weight: 600; }
.pm2-toolbar { position: relative; width: 100%; height: 52px; border-radius: 10px; background: var(--content-bg); box-shadow: inset 0 0 0 0.5px var(--separator); }
.pm2-toolbar .toolbar { border-radius: 10px; }
.pm2-coll { width: 100%; max-width: 520px; }
.pm2-coll-head { display: flex; align-items: center; gap: 10px; height: 40px; padding: 0 6px; border-radius: 10px; }
.pm2-coll-head .disclosure { width: 13px; height: 13px; color: var(--label-3); stroke-width: 2; }
.pm2-coll-body { padding: 2px 0 10px 29px; }
.pm2-drop { width: 100%; max-width: 360px; }
.pm2-box { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; width: 100%; max-width: 320px; height: 110px; border-radius: 12px; font-size: 12px; color: var(--label-2); }
.pm2-box .i { color: var(--accent); }
.pm2-wide { width: 100%; }
`;
  document.head.insertAdjacentHTML('beforeend', `<style data-section="primitives-2">${CSS}</style>`);

  const COMPONENTS = [
    {
      id: 'avatar',
      name: 'Avatar',
      summary: 'Initials on the person’s color with a content-colored ring so overlapping avatars stay separate. “You” is an empty accent disc.',
      mapsTo: 'shadcn Avatar (AvatarFallback with initials; no photos in 002)',
      usedIn: ['Agenda cards', 'Peek header', 'Living doc people chip', 'Memory owners', 'Review candidates', 'Evidence popover', 'Island'],
      source: 'kit Kit.avatar(name, cls) · Kit.initials · Kit.personColor (DATA.people) · .avatar (.lg)',
      props: [['name', 'string (initials derived; "You" renders empty)', '—'], ['size', '16 (meta) | 18 (agenda) | 20 (default) | 28 (lg)', '20'], ['ring', 'boolean (1.5px content-bg ring)', 'true']],
      tokens: ['--content-bg', '--surface', 'DATA.people colors'],
      motion: 'None.',
      a11y: 'title attribute carries the full name; decorative next to a visible name, otherwise aria-label on the stack.',
      stories: [
        { label: 'Sizes', note: 'lg 28 · 20 · 18 in agenda meta · 16 in doc meta', span: 2, html: `<div class="pm2-sizes">${cell(Kit.avatar('Maria Chen', 'lg'), '28 · lg')}${cell(Kit.avatar('Maria Chen'), '20')}${cell(`<span class="a-meta">${Kit.avatar('Maria Chen')}</span>`, '18 · agenda')}${cell(`<span class="mem-meta" style="margin:0"><span class="owner">${Kit.avatar('Maria Chen')}Maria</span></span>`, '16 · owner')}</div>` },
        { label: 'You', note: 'Empty accent disc — no initials', html: `<div class="pm2-sizes">${cell(Kit.avatar('You', 'lg'), 'lg')}${cell(Kit.avatar('You'), '20')}</div>` },
        { label: 'Every person', note: 'Color per DATA.people; initials from the name', span: 'full', html: `<div class="pm2-people">${PEOPLE.map((n) => `<span class="pm2-person">${Kit.avatar(n)}${e(n)}</span>`).join('')}</div>` }
      ]
    },
    {
      id: 'avatar-stack',
      name: 'AvatarStack',
      summary: 'Overlapping avatars with a “+n” overflow count. Agenda cards cap at 3; proposal cards add the invite’s extra count.',
      mapsTo: '<AvatarStack names max> built on shadcn Avatar',
      usedIn: ['Agenda cards', 'Peek header', 'Living doc people chip', 'Found in Calendar cards', 'Island brief'],
      source: 'kit Kit.avatars(names, max = 4) · .avatars .more · 002 app-agenda.js personLine (max 3) · app-pages.js proposalCard (.a-more)',
      props: [['names', 'string[]', '—'], ['max', 'number', '4'], ['extra', 'number (known attendees beyond names)', '0']],
      states: ['2', '4', 'overflow +n'],
      tokens: ['--label-2', '--content-bg'],
      motion: 'None.',
      a11y: 'Group label such as “5 people: Maria Chen, Jon Park, …”; the +n text is read.',
      stories: [
        { label: 'Counts', note: '2 · 4 · 5 with max 3 (+2) · 6 with max 4 (+2)', span: 2, html: `<div class="pm2-sizes">${cell(Kit.avatars(['Aisha Bello', 'Maria Chen']), '2')}${cell(Kit.avatars(ps.people.slice(0, 4)), '4')}${cell(Kit.avatars(ps.people, 3), '5 · max 3')}${cell(Kit.avatars(['You', ...ps.people], 4), '6 · max 4')}</div>` },
        { label: 'Proposal extra', note: 'Found in Calendar: 3 shown + “+3” invitees', html: cell(`<span class="row-flex">${Kit.avatars(standup.people, 3)}<span class="a-more">+${standup.extra}</span></span>`, 'Daily Standup') },
        { label: 'In context', note: 'Agenda meta (18px, −4px overlap) · doc people chip (16px)', span: 2, html: `<div class="pm-stack"><span class="a-meta"><span class="a-where">${icon('video')}Google Meet</span><span class="a-sep">·</span><span class="a-people">${Kit.avatars(ps.people, 3)}</span><span class="a-sep">·</span><span class="num">#37</span></span>${peopleChip(ps)}</div>` }
      ]
    },
    {
      id: 'file-badge',
      name: 'FileBadge',
      summary: 'Tiny document glyph with a folded corner and a three-letter type, colored per file kind.',
      mapsTo: '<FileBadge name> (derives kind from the extension)',
      usedIn: ['Doc chips', 'Reference popover', 'Evidence popover (document)', 'Brief docs'],
      source: 'kit Kit.fileBadge(name) · .ftype[data-kind] · 002 doc.css .ref-pop-head .ftype',
      props: [['name', 'string (extension → kind)', '—'], ['size', '16×20 | 22×28 (popover head)', '16×20']],
      states: ['pdf', 'docx', 'md', 'txt', 'xlsx', 'key', 'other'],
      tokens: ['fixed hex per kind (see SeriesColors)', '--content-bg (corner)'],
      motion: 'None.',
      a11y: 'Decorative — the file name is always next to it.',
      stories: [
        { label: 'Every kind', note: 'PDF · DOC · MD · TXT · XLS · KEY', span: 2, html: `<div class="pm2-sizes">${FILES.map((f) => cell(Kit.fileBadge(f), f.split('.').pop())).join('')}${cell(Kit.fileBadge('Recording.m4a'), 'other')}</div>` },
        { label: 'Popover size', note: '22×28 in the reference popover head', html: `<div class="ref-pop-head">${Kit.fileBadge('Q4 Roadmap.pdf')}<div class="ref-pop-name"><b>Q4 Roadmap.pdf</b><span class="muted num">v2 · 2.4 MB · added Sep 14</span></div></div>` }
      ]
    },
    {
      id: 'doc-chip',
      name: 'DocChip',
      summary: 'A document as a compact chip: badge, name (truncates) and optional meta. As a button it opens the document; in briefs it sits on cards.',
      mapsTo: 'shadcn Button variant="secondary" size="sm" with FileBadge (or a Badge when static)',
      usedIn: ['Living doc Reference', 'Next meeting docs', 'Past meetings', 'Peek'],
      source: 'kit Kit.docChip(name, meta) · 002 doc-render.js D.docButton · refChip (.inc-dot) · doc.css button.doc-chip, .next-docs .doc-chip, .add-chip, .chip-in',
      props: [['name', 'string', '—'], ['meta', 'string (version, size)', '—'], ['as', 'span | button', 'span'], ['include', 'boolean | undefined (shows the include dot)', 'undefined'], ['elevated', 'boolean (card chip in Next)', 'false']],
      states: ['rest', 'hover', 'pressed', 'included', 'excluded', 'entering (attached)'],
      tokens: ['--fill', '--fill-2', '--accent', '--label-3', '--shadow-card', '--shadow-card-hover'],
      motion: motion({ trigger: 'hover / press; a document is attached', props: 'background-color or box-shadow; transform scale(0.97); on attach opacity 0 → 1, translateY(3px) scale(0.95) → none', duration: 'hover 150ms; press 140ms; attach 280ms', easing: 'ease; --ease-out; --ease-out', runtime: 'CSS transitions + .chip-in keyframes (one-shot, restarts per chip)', reduced: 'press snaps; .chip-in still runs (not in the kit reduced list — gate it in React)', framer: 'initial={{ opacity: 0, y: 3, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}; whileTap={{ scale: 0.97 }}' }),
      a11y: 'Button chips announce the file name; the include dot is a separate control in 002 (data-act on a span) — make it a real toggle with aria-pressed.',
      stories: [
        { label: 'Static', note: 'Kit.docChip with and without meta', span: 2, html: `<div class="pm-stack">${Kit.docChip('Q4 Roadmap.pdf', 'v2')}${Kit.docChip('North-star metrics.docx')}</div>` },
        Catalog.table({ label: 'Button states', note: 'D.docButton; next-docs chips sit on cards', rows: [{ label: 'Quiet fill', ctx: '' }, { label: 'On card (Next)', ctx: 'next-docs' }], cols: DOC_STATES, render: (r, c) => `<div class="${r.ctx}" style="margin:0">${docButton('Q4 Roadmap.pdf').replace('<button class="doc-chip"', `<button class="doc-chip"${c.force ? ' data-force' : ''}`)}</div>` }),
        { label: 'Include dot', note: 'Reference chips: included in every brief / left out · Add chip', span: 2, html: `<div class="ref-row" style="margin:0">${refChip(ps.docs[0])}${refChip(ps.docs[2])}<button class="doc-chip add-chip">${icon('plus')}Add</button></div>` },
        { label: 'Truncation', note: 'Name truncates inside max-width 100%', html: `<div style="width:190px">${docButton('Security questionnaire v2 final.docx', 'v2')}</div>` },
        { label: 'Attach', note: 'Replay the .chip-in entrance', span: 2, height: 130, html: `${replayButton()}<div class="row-flex">${docButton('Rate-limit plan v1.docx')}${docButton('Pricing experiment.xlsx')}</div>`, mount: onReplay(replayChipIn) }
      ]
    },
    {
      id: 'series-icon',
      name: 'SeriesIcon',
      summary: 'A series’ identity: its glyph in white on its color, round. Sized per context.',
      mapsTo: '<SeriesIcon series size> (lucide glyph on a colored circle)',
      usedIn: ['Sidebar', 'Doc title', 'Toolbar compact title', 'Menus', 'Search', 'Found in Calendar', 'Peek', 'Island', 'Fly-to chips'],
      source: 'kit Kit.seriesIcon(series, cls) · .series-icon (.lg) · 002 app.css .a-sb-row .series-icon, .series-icon.a-xs, .a-pcard-main .series-icon · island.css .il-head',
      props: [['series', '{ color, icon }', '—'], ['size', '16 (xs) | 18 (sidebar) | 20 | 28 (Island) | 30 (cards) | 36 (lg, doc title)', '20']],
      states: ['rest', 'bump (receiving)'],
      tokens: ['--series-*', '#fff glyph'],
      motion: motion({ trigger: 'something lands in the series (Kit.flyTo receive)', props: 'transform scale(1 → 1.18 → 1) via .bump', duration: '420ms (peak at 40%)', easing: '--ease-out', runtime: 'CSS keyframes (kit-bump), restarted by toggling the class', reduced: 'disabled (.bump is in the kit reduced list)', framer: 'animate={{ scale: [1, 1.18, 1] }} transition={{ duration: 0.42, times: [0, 0.4, 1], ease: [0.23, 1, 0.32, 1] }}' }),
      a11y: 'Decorative next to the series name.',
      stories: [
        { label: 'Every series · 20 and lg 36', span: 'full', html: `<div class="pm-grid">${ALL_SERIES.map((s) => cell(`<span class="row-flex">${Kit.seriesIcon(s)}${Kit.seriesIcon(s, 'lg')}</span>`, s.name)).join('')}</div>` },
        { label: 'Context sizes', note: '16 xs · 18 sidebar · 20 · 30 card · 36 lg', span: 2, html: `<div class="pm2-sizes">${cell(Kit.seriesIcon(ps, 'a-xs'), '16')}${cell(`<span class="a-sb-row" style="display:inline-flex">${Kit.seriesIcon(ps)}</span>`, '18')}${cell(Kit.seriesIcon(ps), '20')}${cell(`<span class="a-pcard-main">${Kit.seriesIcon(ps)}</span>`, '30')}${cell(Kit.seriesIcon(ps, 'lg'), '36')}</div>` },
        { label: 'Bump', note: 'Replay the receive bump', height: 130, html: `${replayButton()}${Kit.seriesIcon(ps, 'lg')}`, mount: onReplay((c, first) => { if (!first) restart(c.querySelector('.series-icon'), 'bump'); }) }
      ]
    },
    {
      id: 'series-dot',
      name: 'SeriesDot',
      summary: '8px color dot for a series where a full icon is too heavy: menu swatches, the Island’s next pill.',
      mapsTo: '<SeriesDot color> (a span)',
      usedIn: ['Menus (Add to series, File to, Move to)', 'Island next pill', 'Found in Calendar detected rows'],
      source: 'kit .series-dot · Kit.menu swatch items · island.js nextPill · 002 app.css .a-det-dot',
      props: [['color', 'series color token', '--series-gray']],
      tokens: ['--series-*', '--label-4 (detected, not a series yet)'],
      motion: 'None.',
      a11y: 'Decorative; the label is always adjacent.',
      stories: [
        { label: 'Every series', span: 2, html: `<div class="pm2-sizes">${DATA.series.map((s) => cell(`<span class="series-dot" style="--c:${s.color}"></span>`, s.name.split(' · ')[0])).join('')}</div>` },
        { label: 'As menu swatches', note: 'Kit.menu items with swatch', bg: 'wallpaper', html: `<div class="cat-static"><div class="menu" style="min-width:230px"><div class="menu-title">Add to series</div>${DATA.series.slice(0, 3).map((s, i) => `<div class="menu-item${i === 1 ? ' active' : ''}"><span class="series-dot" style="--c:${s.color}"></span><span class="truncate">${e(s.name)}</span></div>`).join('')}</div></div>` }
      ]
    },
    {
      id: 'kbd',
      name: 'Kbd',
      summary: 'Inline keyboard shortcut text. Inherits the color of its button at 60%; in menus it right-aligns and turns white on the active row.',
      mapsTo: 'shadcn Kbd / DropdownMenuShortcut',
      usedIn: ['Buttons (Record ⌘R, New ⌥⌘N, Create ↩)', 'Menus', 'Tooltips (Back · ⌘[)', 'Island'],
      source: 'kit .kbd · .btn .kbd · .menu-item .kbd · 002 app.js Kit.keys map',
      props: [['keys', 'string (glyphs: ⌘ ⌥ ⇧ ⌃ ↩ ⌫ esc)', '—']],
      tokens: ['--label-3', 'currentColor'],
      motion: 'None.',
      a11y: 'Use aria-keyshortcuts on the control ("Meta+R"); the visible glyphs are aria-hidden duplicates.',
      stories: [
        { label: 'Contexts', note: 'Standalone · in a button · on Record · in a menu row · active menu row', span: 'full', html: `<div class="pm-row"><span class="kbd">⌥⌘N</span><button class="btn">${icon('plus')}New<span class="kbd">⌥⌘N</span></button><button class="btn record sm">${icon('record')}Record<span class="kbd">⌘R</span></button><div class="cat-static"><div class="menu" style="min-width:210px"><div class="menu-item">${icon('pencil')}<span class="truncate">Edit purpose…</span><span class="kbd">⌘E</span></div><div class="menu-item active">${icon('record')}<span class="truncate">Record</span><span class="kbd">⌘R</span></div></div></div></div>` },
        { label: 'Shortcut map', note: 'Every shortcut 002 registers (app.js Kit.keys)', span: 'full', align: 'stretch', html: `<div class="pm2-shortcuts">${SHORTCUTS.map(([k, v]) => `<span class="kbd">${e(k)}</span><span>${e(v)}</span>`).join('')}</div>` }
      ]
    },
    {
      id: 'keycap',
      name: 'Keycap',
      summary: 'A physical key drawn on content background with a hairline and bottom edge. Onboarding scales it up to teach ⌥ Space.',
      mapsTo: '<Keycap size> (styled kbd element)',
      usedIn: ['Onboarding · Summon Telu step'],
      source: 'kit .keycap · 002 app.css .ob-keys .keycap (.wide) · app-onboard.js summonStep',
      props: [['label', 'string', '—'], ['size', 'sm 22 | lg 48 (onboarding)', 'sm'], ['wide', 'boolean (Space)', 'false']],
      tokens: ['--content-bg', '--hairline'],
      motion: 'None.',
      a11y: 'Render as <kbd>; the pair reads “Option plus Space”.',
      stories: [
        { label: 'Default', note: '22px', html: '<div class="row-flex"><span class="keycap">⌥</span><span class="keycap">⌘</span><span class="keycap">esc</span></div>' },
        { label: 'Onboarding', note: '54×48 and a 150px Space bar', span: 2, bg: 'window', html: '<div class="ob-keys" style="margin:0"><span class="keycap">⌥</span><span class="ob-plus">+</span><span class="keycap wide">Space</span></div>' }
      ]
    },
    {
      id: 'spinner',
      name: 'Spinner',
      summary: 'Ring spinner for short, indeterminate local work (preparing, filing).',
      mapsTo: '<Spinner size> (CSS) — lucide loader-circle is an alternative',
      usedIn: ['Next · preparing summary', 'Next · still preparing', 'Island · filing'],
      source: 'kit .spinner · 002 doc.css .spinner.tiny · island.css .il-filing .spinner · doc-render.js preparingInner, next-from',
      props: [['size', '10 (tiny) | 13 (Island) | 14', '14']],
      tokens: ['--fill-3', '--label-2'],
      motion: motion({ trigger: 'mounted while work is pending', props: 'transform rotate(0 → 360deg)', duration: '700ms per turn, infinite', easing: 'linear', runtime: 'CSS keyframes (kit-spin)', reduced: 'keeps spinning (kit-spin is not in the reduced list) — prefer a static glyph + text in React', framer: 'animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.7, ease: "linear" }}' }),
      a11y: 'Pair with visible text (“Preparing summary…”); role="status" on the container.',
      stories: [
        { label: 'Sizes', note: 'tiny 10 · Island 13 · 14', html: `<div class="pm2-sizes">${cell('<span class="spinner tiny"></span>', '10 · tiny')}${cell('<span class="il-filing" style="display:inline-flex"><span class="spinner"></span></span>', '13 · Island')}${cell('<span class="spinner"></span>', '14')}</div>` },
        { label: 'In context', note: 'Next section while the summary is prepared, and while a brief is still preparing', span: 2, html: `<div class="pm-stack"><div class="next-title"><span class="spinner"></span><span>Preparing summary…</span></div><p class="next-from" style="margin:0"><span class="spinner tiny"></span>Still preparing from your purpose and 2 reference docs — ready before 15:30</p></div>` }
      ]
    },
    {
      id: 'skeleton',
      name: 'Skeleton',
      summary: 'Shimmer fill for content Telu is still preparing: a chip label or placeholder lines.',
      mapsTo: 'shadcn Skeleton with the kit shimmer gradient',
      usedIn: ['Agenda card chip (Preparing brief / summary)', 'Next · preparing'],
      source: 'kit .shimmer · 002 app-agenda.js chipMarkup (a-chip-prep) · doc.css .prep-lines',
      props: [['shape', 'chip | line | line-short', 'line']],
      tokens: ['--fill', '--fill-3'],
      motion: motion({ trigger: 'mounted while preparing', props: 'background-position 100% → −100% (200% wide gradient)', duration: '1.3s per sweep, infinite', easing: 'linear', runtime: 'CSS keyframes (kit-shimmer)', reduced: 'stops (static fill)', framer: 'animate={{ backgroundPositionX: ["100%", "-100%"] }} transition={{ repeat: Infinity, duration: 1.3, ease: "linear" }}' }),
      a11y: 'aria-busy on the region; the chip text (“Preparing brief”) stays readable.',
      stories: [
        { label: 'Chip', html: `<div class="pm-stack" style="align-items:center"><span class="chip shimmer a-chip-prep">Preparing brief</span><span class="chip shimmer a-chip-prep">Preparing summary…</span></div>` },
        { label: 'Lines', note: 'Two full lines and a 58% line', span: 2, html: '<div class="prep-lines pm2-wide" style="margin:0;max-width:420px"><div class="shimmer"></div><div class="shimmer"></div><div class="shimmer short"></div></div>' }
      ]
    },
    {
      id: 'rec-dot',
      name: 'RecDot',
      summary: 'Coral recording dot. Pulses while live; static variants mark “will record” and the Record affordance; the Island dims it when paused.',
      mapsTo: '<RecDot variant="live | static | glyph" paused>',
      usedIn: ['Menu bar status', 'Sidebar series row', 'Toolbar capsule and Record button', 'Agenda card eyebrow', 'Next · live', 'Island'],
      source: 'kit .rec-dot (kit-rec) · 002 app.css .a-mini-dot, .menubar .telu-status .rec-dot, .a-sb-row .rec-dot · doc.css .countdown .mini-dot, .tb-record .rec-glyph · island.css .island .rec-dot.paused',
      props: [['variant', 'live (8px, pulsing) | mini (6px) | glyph (9px with halo)', 'live'], ['pulsing', 'boolean', 'true for live'], ['paused', 'boolean (Island only in 002)', 'false'], ['size', '6 | 7 | 8', '8']],
      states: ['live', 'static', 'paused'],
      tokens: ['--coral', '--coral-soft'],
      motion: motion({ trigger: 'mounted while recording (or starting)', props: 'opacity 1 → 0.3 → 1', duration: '1.4s per cycle, infinite', easing: 'ease-in-out', runtime: 'CSS keyframes (kit-rec)', reduced: '.rec-dot slows to 2.4s; mini dots (.a-mini-dot, .countdown .mini-dot) keep 1.4s — gate both in React', framer: 'animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}' }),
      a11y: 'Never the only signal: always next to “Recording” text or a timer.',
      stories: [
        { label: 'Live', note: '8px · pulses 1.4s', html: '<span class="rec-dot"></span>' },
        { label: 'Sizes in context', note: 'Sidebar hint 7px · agenda eyebrow 8px', span: 2, bg: 'sidebar', html: `<div class="t-app"><div class="sb-item a-sb-row" style="width:224px">${Kit.seriesIcon(ps)}<span class="truncate a-sb-name">Product Sync</span><span class="a-hint num"><span class="rec-dot"></span></span></div></div>` },
        { label: 'Mini dots', note: 'Pulsing (starting now) · static (records once)', span: 2, html: `<div class="row-flex" style="gap:14px">${miniDot(true)}${miniDot(false)}</div>` },
        { label: 'Record glyph', note: 'Static dot with a 2.5px coral-soft halo', html: `<button class="btn tb-record"><span class="rec-glyph"></span>Record<span class="kbd">⌘R</span></button>` },
        { label: 'Paused (Island)', note: 'Only the Island pauses in 002: no pulse, 45% — the menu bar keeps counting', span: 2, bg: 'wallpaper', html: `<div class="row-flex" style="gap:16px">${islandPill(false)}${islandPill(true)}</div>` }
      ]
    },
    {
      id: 'waveform',
      name: 'Waveform',
      summary: 'Five bars that bounce while Telu is listening. Coral in recording contexts.',
      mapsTo: '<Waveform paused> (5 motion.i bars)',
      usedIn: ['Agenda card (recording)', 'Next · live', 'Peek one-off live strip', 'Island'],
      source: 'kit .wave (5 <i>) · 002 app.css .a-wave · doc.css .live-wave · island.css .il-wave (.paused)',
      props: [['size', '11 (agenda) | 13 (Island) | 14', '14'], ['color', 'currentColor | coral', 'currentColor'], ['paused', 'boolean (Island)', 'false']],
      states: ['listening', 'paused'],
      tokens: ['--coral', 'currentColor'],
      motion: motion({ trigger: 'mounted while recording', props: 'each bar transform scaleY(0.3 → 1 → 0.3)', duration: '900ms per cycle, infinite; bar delays 0, −200, −450, −650, −100ms', easing: 'ease-in-out', runtime: 'CSS keyframes (kit-wave)', reduced: 'stops (bars rest at 0.3)', framer: 'each bar animate={{ scaleY: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 0.9, delay, ease: "easeInOut" }}' }),
      a11y: 'Decorative (aria-hidden); the adjacent “Recording” text and timer carry meaning.',
      stories: [
        { label: 'Variants', note: 'kit (currentColor) · agenda 11px · doc live · Island 13px', span: 2, html: `<div class="pm2-sizes">${cell(wave(), 'kit')}${cell(wave('a-wave'), 'agenda')}${cell(wave('live-wave'), 'doc')}${cell(wave('il-wave'), 'Island')}</div>` },
        { label: 'Paused', note: 'Island only — bars rest at 0.3', bg: 'wallpaper', html: islandPill(true) }
      ]
    },
    {
      id: 'progress-hairline',
      name: 'ProgressHairline',
      summary: '2px accent line along the toolbar’s bottom edge for short local work. Present in both toolbars; T.runProgress exists but nothing in 002 triggers it yet.',
      mapsTo: 'framer-motion motion.i with scaleX, or NProgress-style bar',
      usedIn: ['Agenda toolbar', 'Doc toolbar'],
      source: '002 app-shell.js .a-progress + T.runProgress(duration = 900) · app.css .a-progress',
      props: [['duration', 'ms (grow time)', '900'], ['running', 'boolean', 'false']],
      states: ['idle (hidden)', 'growing', 'fading out'],
      tokens: ['--accent'],
      motion: motion({ trigger: 'T.runProgress(duration)', props: 'transform scaleX(0 → 1) from the left edge, then opacity 1 → 0', duration: 'grow = duration (default 900ms); fade 220ms', easing: 'grow linear; fade ease-out', runtime: 'WAAPI (Element.animate, fill forwards; previous runs are cancelled)', reduced: 'not gated in 002 — gate it (show a static bar or nothing)', framer: 'animate={{ scaleX: 1 }} transition={{ duration: 0.9, ease: "linear" }} then animate={{ opacity: 0 }} transition={{ duration: 0.22, ease: "easeOut" }}; style={{ originX: 0 }}' }),
      a11y: 'role="progressbar" without a value (indeterminate) or pair with a status message.',
      stories: [{ label: 'On a toolbar', note: 'Frozen mid-run at rest · Replay runs the real timing', span: 'full', height: 120, html: `${replayButton()}<div class="pm2-toolbar"><div class="toolbar"><div class="toolbar-title"><b>Today</b><span>Tuesday, 29 September</span></div><i class="a-progress"></i></div></div>`, mount: onReplay(replayProgress) }]
    },
    {
      id: 'empty-state',
      name: 'EmptyState',
      summary: 'Centered empty state: glyph (bare or in an accent badge), title, one line of help, optional actions and a privacy footnote.',
      mapsTo: '<EmptyState icon title description actions footnote badge>',
      usedIn: ['Agenda day', 'Upcoming', 'Review', 'Found in Calendar', 'Welcome (first run)', 'Side peek (untracked event)'],
      source: 'kit .empty · 002 app-pages.js emptyPage / caughtUp / firstRunMarkup (T.pages.*) · app-agenda.js dayMarkup · app.css .a-first .a-empty-badge .a-empty-actions .a-local',
      props: [['icon', 'IconName | "app"', '—'], ['badge', 'boolean (accent tile behind the glyph)', 'false'], ['title', 'string', '—'], ['description', 'string', '—'], ['actions', 'Button[]', '—'], ['footnote', 'string (local-processing cue)', '—']],
      states: ['bare', 'badge', 'with actions'],
      tokens: ['--accent-soft', '--accent', '--label', '--label-2', '--label-3'],
      motion: motion({ trigger: 'the page it belongs to is shown (view switch, last item decided)', props: 'container opacity 0 → 1 with filter blur(2px) → 0 (T.fx.fadeIn); the empty state itself is static', duration: '200ms (view switch) / 220ms (Found in Calendar emptied)', easing: '--ease-out', runtime: 'WAAPI (Element.animate)', reduced: 'no fade — appears instantly (fadeIn returns early)', framer: 'initial={{ opacity: 0, filter: "blur(2px)" }} animate={{ opacity: 1, filter: "blur(0px)" }} transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}' }),
      a11y: 'Title is an h3; actions are real buttons; glyphs are decorative.',
      stories: [
        { label: 'Bare', note: 'Agenda day with no events', html: emptyBare, height: 200 },
        { label: 'Badge + help', note: 'T.pages.emptyPage — Upcoming before a calendar', span: 2, height: 260, html: () => pages().emptyPage('calendar', 'Nothing upcoming yet', 'Connect your calendar and the next few days show up here.') },
        { label: 'All caught up', note: 'Review page emptied', span: 2, height: 260, html: () => pages().emptyPage('check-circle', 'All caught up', 'Everything Telu found has been reviewed and filed.') },
        { label: 'Caught up (inline)', note: 'Found in Calendar after the last decision', span: 2, html: () => pages().caughtUp() },
        { label: 'Welcome with action', note: 'T.pages.firstRunMarkup — app icon, primary action, local footnote', span: 2, height: 300, html: () => pages().firstRunMarkup() }
      ]
    },
    {
      id: 'card',
      name: 'Card',
      summary: 'Surface with a hairline ring and soft shadow. Interactive cards lift on hover and press in slightly.',
      mapsTo: 'shadcn Card (with an interactive variant)',
      usedIn: ['Agenda event cards', 'Found in Calendar cards', 'Needs filing cards', 'Peek proposal card'],
      source: 'kit .card (.interactive)',
      props: [['interactive', 'boolean', 'false'], ['padding', 'number', 'per use']],
      states: ['static', 'rest', 'hover', 'pressed', 'selected (agenda: 2px accent ring)'],
      tokens: ['--surface', '--r-card', '--shadow-card', '--shadow-card-hover'],
      motion: motion({ trigger: 'hover (fine pointers) / press', props: 'box-shadow card → card-hover; transform scale(0.992)', duration: 'shadow 200ms; press 160ms', easing: 'ease; --ease-out', runtime: 'CSS transition (interruptible)', reduced: 'press snaps; shadow still fades', framer: 'whileTap={{ scale: 0.992 }}; hover shadow in CSS' }),
      a11y: 'Interactive cards are selectable items (role="option" in a listbox, or a button); arrow keys move selection without animation.',
      stories: [Catalog.table({ label: 'Variants', bg: 'window', rows: [{ label: 'Card' }], cols: CARD_COLS, render: (r, c) => `<div class="card${c.interactive ? ' interactive' : ''}"${c.force ? ' data-force' : ''}>${cardBody}</div>` })]
    },
    {
      id: 'list-row',
      name: 'ListRow',
      summary: 'Compact list row for pickers and search results: leading glyph, truncating text, trailing meta. Selected rows invert to accent.',
      mapsTo: 'cmdk Command.Item (data-selected → accent)',
      usedIn: ['Search popover results'],
      source: 'kit .row (.hoverable .selected) · 002 app-flows.js seriesHit / memoryHit (.a-hit)',
      props: [['leading', 'SeriesIcon | KnowledgeType', '—'], ['text', 'string', '—'], ['meta', 'string', '—'], ['selected', 'boolean', 'false']],
      states: ['rest', 'hover', 'selected (kit; cmdk keyboard)'],
      tokens: ['--fill', '--accent', '--on-accent', '--r-control'],
      motion: 'None — hover background changes instantly; keyboard selection must not animate.',
      a11y: 'role="option" inside role="listbox" (cmdk); aria-selected mirrors the accent row.',
      stories: [
        { label: 'Series and memory hits', note: 'Rest', bg: 'wallpaper', span: 2, html: `<div class="cat-static"><div class="popover" style="width:400px"><div class="a-search-hint">Series</div>${seriesHit(ps)}<div class="a-search-hint">In memory</div>${memoryHit(ps, ps.memory[0])}</div></div>` },
        { label: 'Hover', bg: 'wallpaper', span: 2, force: 'hover', html: `<div class="cat-static"><div class="popover" style="width:400px">${seriesHit(series('acme'))}</div></div>` },
        { label: 'Selected', note: 'Kit variant — use for the cmdk keyboard row', bg: 'wallpaper', span: 2, html: `<div class="cat-static"><div class="popover" style="width:400px">${selectedRow(series('maria'))}</div></div>` }
      ]
    },
    {
      id: 'collapsible',
      name: 'Collapsible',
      summary: 'Height collapse with a rotating disclosure chevron. Rows collapse by animating grid rows to 0fr, so content never jumps.',
      mapsTo: 'Radix Collapsible (shadcn) + framer-motion height animation',
      usedIn: ['Past meetings', 'Banner hide', 'New series linked event', 'Peek transcript'],
      source: 'kit .collapsible (.collapsed) + .disclosure (.open) · 002 doc-page.js D.toggleMeeting · app-agenda.js bannerMarkup',
      props: [['open', 'boolean', 'false'], ['onOpenChange', '(open) => void', '—']],
      states: ['open', 'collapsed'],
      tokens: ['--label-3'],
      motion: motion({ trigger: 'click on the header (or programmatic toggle)', props: 'grid-template-rows 1fr ↔ 0fr + opacity 1 ↔ 0; chevron transform rotate(0 ↔ 90deg)', duration: 'rows 260ms; opacity 200ms; chevron 200ms (same in and out)', easing: 'rows --ease-out; opacity ease; chevron --ease-out', runtime: 'CSS transition (interruptible)', reduced: 'rows jump (grid-template-rows not in the reduced list); opacity still fades; chevron snaps', framer: '<motion.div animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }} transition={{ height: { duration: 0.26, ease: [0.23, 1, 0.32, 1] }, opacity: { duration: 0.2 } }} />' }),
      a11y: 'Header is a button with aria-expanded and aria-controls (002 uses a div with data-act).',
      stories: [
        { label: 'Open and collapsed', span: 2, html: `<div class="pm-stack pm2-wide">${collapsibleMarkup(true)}${collapsibleMarkup(false)}</div>` },
        { label: 'Interactive', note: 'Click the header · Replay collapses and reopens', span: 2, height: 170, align: 'start', html: `${replayButton()}${collapsibleMarkup(true)}`, mount: onReplay(wireCollapsible) }
      ]
    },
    {
      id: 'drop-target',
      name: 'DropTarget',
      summary: 'Where files can land: a dashed accent outline inset from the edge over an accent-softer wash.',
      mapsTo: 'A useDropzone-style hook that toggles data-drop-active; the style is a Tailwind variant',
      usedIn: ['Next meeting docs', 'Purpose (Reference)', 'Island drop pill'],
      source: 'kit .drop-target · 002 doc.css .next-docs.drop-target · doc-edit.js wireDrops',
      props: [['active', 'boolean (drag over)', 'false'], ['inset', 'px (outline-offset)', '-6'], ['hint', 'string', '"Drop files to attach"']],
      states: ['idle', 'drag over'],
      tokens: ['--accent (70%)', '--accent-softer'],
      motion: 'None — the outline and wash switch instantly on dragenter/dragleave (the purpose drop hint fades in 150ms; see Living doc).',
      a11y: 'Always offer a keyboard path (⌘O Attach files); announce “Attached …” in a status region.',
      stories: [
        { label: 'Kit default', note: 'outline-offset −6px', html: `<div class="pm2-box drop-target">${icon('tray-down')}Drop files to attach</div>` },
        { label: 'Next meeting docs', note: 'Drag a file over it, or Replay to toggle', span: 2, height: 180, html: `${replayButton('Toggle')}<div class="pm2-drop">${nextDocs(false)}</div>`, mount: onReplay(wireDrop) }
      ]
    }
  ];

  section.components = [...section.components, ...COMPONENTS];
})();
