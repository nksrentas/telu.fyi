(() => {
  const PREPARING = (st) => Object.fromEntries(st.series.flatMap((s) => s.meetings).filter((m) => m.status === 'preparing').map((m) => [m.id, true]));
  const LIVE_ELAPSED = { main: DATA.live.elapsed, once: 95 };

  function peekContent(scenario, selection, setup) {
    return Catalog.withScenario(scenario, () => {
      if (setup) setup();
      T.state = { ...T.state, selection, peekOpen: true, prepared: { ...T.state.prepared, ...PREPARING(T.state) } };
      const host = document.body.appendChild(Kit.html('<div hidden><div id="pkScroll"><div id="pkContent"></div></div></div>'));
      try {
        return T.peek.render() ? host.querySelector('#pkContent').innerHTML : '';
      } finally {
        host.remove();
      }
    });
  }

  const headOnly = (content) => content.split('<div class="pk-body')[0];
  const frame = (content, { cls = '', scrolled = false } = {}) => `<div class="cp-frame${cls}"><aside class="peek open${scrolled ? ' pk-scrolled' : ''}" aria-label="Side peek"><div class="pk-scroll"><div class="pk-content">${content}</div></div></aside></div>`;
  const forceOn = (markup, selectors) => selectors.reduce((acc, sel) => acc.replace(sel, `${sel} data-force`), markup);
  const replayBar = (buttons) => `<div class="cp-replay">${buttons.map(([key, label]) => `<button class="btn sm" data-replay="${key}">${icon('play')}${Catalog.esc(label)}</button>`).join('')}</div>`;
  const startTimers = (canvas, seconds) => canvas.querySelectorAll('[data-rec-timer]').forEach((el) => Kit.timer(el, seconds));

  const target = {
    upcoming: () => peekContent('before', { kind: 'event', id: 't2' }),
    pending: () => peekContent('before', { kind: 'event', id: 'x-bp-9' }),
    preparing: () => peekContent('before', { kind: 'event', id: 't5' }),
    starting: () => peekContent('starting', { kind: 'event', id: 't2' }),
    live: () => peekContent('live', { kind: 'event', id: 't2' }),
    summarizing: () => peekContent('live', { kind: 'event', id: 't2' }, () => T.set({ recording: null, summarizing: { meetingId: 'ps-37', seriesId: 'product-sync' } })),
    review: () => peekContent('after', { kind: 'event', id: 't2' }),
    past: () => peekContent('before', { kind: 'meeting', id: 'ps-36' }),
    cancelled: () => peekContent('before', { kind: 'meeting', id: 'ps-33' }),
    tracking: () => peekContent('before', { kind: 'event', id: 't1' }, () => T.addStandupSeries()),
    recurring: () => peekContent('before', { kind: 'event', id: 'w1' }),
    recordOnce: () => peekContent('before', { kind: 'event', id: 'w1' }, () => T.set({ recordOnce: { w1: true } })),
    recurringPast: () => peekContent('before', { kind: 'event', id: 't1' }),
    oneoff: () => peekContent('before', { kind: 'event', id: 't6' }),
    oneoffLive: () => peekContent('before', { kind: 'event', id: 't6' }, () => T.set({ recording: { eventId: 't6', meetingId: null, seriesId: null, startedAt: Date.now() - LIVE_ELAPSED.once * 1000 } })),
    proposal: () => peekContent('before', { kind: 'event', id: 'w2' }),
    unfiledRec: () => peekContent('before', { kind: 'unfiled', id: 'u-rec' }),
    unfiledDoc: () => peekContent('before', { kind: 'unfiled', id: 'u-doc' }),
    filed: () => peekContent('before', { kind: 'event', id: 'm3' }, () => { T.state = T.withFiled(T.state, 'u-rec', 'acme'); }),
    longTitle: () => peekContent('before', { kind: 'event', id: 't2' }, () => T.mapSeries('product-sync', (s) => ({ ...s, name: 'Product Sync — platform, growth and design priorities for Q4' })))
  };

  const agendaToolbar = () => '<div class="toolbar-title a-tb-title"><b>Today</b><span>Tuesday, 29 September</span></div>'
    + '<div class="a-rec-slot"></div><span class="spacer"></span>'
    + '<div class="glass-group">'
    + `<button class="btn icon" data-tip="Previous day">${icon('chevron-left')}</button>`
    + '<button class="btn">Today</button>'
    + `<button class="btn icon" data-tip="Next day">${icon('chevron-right')}</button></div>`
    + '<div class="glass-group">'
    + `<button class="btn a-new-btn">${icon('plus')}New<span class="kbd">⌥⌘N</span></button>`
    + `<span class="sep"></span><button class="btn icon" data-tip="Search">${icon('search')}</button></div>`
    + '<i class="a-progress"></i>';
  const agendaTimeline = () => Catalog.withScenario('before', () => `<div class="agenda-inner"><div class="a-timeline">${T.agenda.timelineMarkup(T.state.days[T.TODAY].events, T.TODAY)}</div></div>`);
  const composedPanel = () => `<div class="window t-app cat-window cp-window"><section class="main peek-open">
      <div class="toolbar">${agendaToolbar()}</div>
      <div class="content">${agendaTimeline()}</div>
      <aside class="peek open" aria-label="Side peek"><div class="pk-scroll"><div class="pk-content">${target.upcoming()}</div></div></aside>
    </section></div>${replayBar([['slide', 'Close and reopen'], ['swap', 'Swap meeting'], ['scroll', 'Scroll body']])}`;

  function mountComposed(canvas) {
    const main = canvas.querySelector('.main');
    const peek = canvas.querySelector('.peek');
    const content = peek.querySelector('.pk-content');
    const scroller = peek.querySelector('.pk-scroll');
    const alternate = [target.upcoming(), peekContent('before', { kind: 'event', id: 't4' })];
    let shown = 0;
    scroller.addEventListener('scroll', () => peek.classList.toggle('pk-scrolled', scroller.scrollTop > 2), { passive: true });
    const actions = {
      slide: () => {
        peek.classList.remove('open');
        main.classList.remove('peek-open');
        setTimeout(() => {
          peek.classList.add('open');
          main.classList.add('peek-open');
        }, 520);
      },
      swap: () => {
        shown = 1 - shown;
        T.fx.crossfade(content, alternate[shown], () => { scroller.scrollTop = 0; });
      },
      scroll: () => scroller.scrollBy({ top: scroller.scrollTop > 40 ? -scroller.scrollTop : 260, behavior: Kit.reduceMotion() ? 'auto' : 'smooth' })
    };
    canvas.querySelector('.cp-replay').addEventListener('click', (event) => {
      const btn = event.target.closest('[data-replay]');
      if (btn) actions[btn.dataset.replay]();
    });
  }

  function mountScrolled(canvas) {
    const scroller = canvas.querySelector('.pk-scroll');
    requestAnimationFrame(() => { scroller.scrollTop = 150; });
    scroller.addEventListener('scroll', () => canvas.querySelector('.peek').classList.toggle('pk-scrolled', scroller.scrollTop > 2), { passive: true });
  }

  function wireTranscript(canvas, highlight) {
    canvas.addEventListener('click', (event) => {
      const btn = event.target.closest('.pk-past [data-act="transcript"]');
      if (btn) T.doc.togglePeekTranscript(btn);
    });
    const btn = canvas.querySelector('.pk-past [data-act="transcript"]');
    if (btn && highlight) T.doc.togglePeekTranscript(btn, highlight);
  }

  const body = (label, note, key, extra = {}) => ({ label, note, html: () => frame(target[key]()), bg: 'window', span: 2, align: 'start center', ...extra });

  const CSS = `
    .cp-frame { width: 456px; max-width: 100%; }
    .cp-frame .peek { position: relative; inset: auto; width: 100%; }
    .cp-frame.cp-fixed .peek { height: 250px; }
    .cp-window .main { flex: 1; }
    .cp-replay { position: absolute; left: 12px; bottom: 12px; z-index: 60; display: flex; flex-wrap: wrap; gap: 6px; }
    .cp-replay .btn { background: var(--glass-strong); box-shadow: var(--shadow-float); -webkit-backdrop-filter: blur(16px); backdrop-filter: blur(16px); }
    .cp-replay .btn .i { width: 11px; height: 11px; }
  `;

  Catalog.section({
    id: 'peek',
    eyebrow: 'Layer 4 · Calendar → doc',
    title: 'Side peek',
    intro: 'Clicking a meeting in the agenda opens a Notion-style side peek. It renders the meeting with the living doc’s own blocks (Next, Summary, Review), plus peek-only states for untracked, proposed and unfiled items. “Open as page” jumps into the full doc at that meeting.',
    css: CSS,
    components: [
      {
        id: 'peek-panel',
        name: 'PeekPanel',
        summary: 'The right-hand panel that slides over the agenda. 44% of the main area (min 440px), under the toolbar, with a rounded top-left corner, a hairline edge and a soft left shadow. The agenda column pads itself so no card hides behind it.',
        mapsTo: 'Custom panel (not modal) — framer-motion slide; content switches with AnimatePresence',
        usedIn: ['Today', 'Upcoming', 'Review', 'Found in Calendar'],
        source: '002 app-peek.js T.peek (show / close / render) · app.css .peek, .peek.open, .peek.instant, .pk-scroll, .pk-content',
        props: [
          ['open', 'boolean', 'false'],
          ['target', '{ kind: event | meeting | unfiled, id }', '—'],
          ['instant', 'boolean — skip the slide (keyboard, scenario restore)', 'false'],
          ['width', 'max(440px, 44% of main)', '—'],
          ['onClose', '() => void (✕, Esc)', '—'],
          ['onOpenPage', '() => void (“Open as page”)', '—']
        ],
        states: ['closed', 'open', 'opening', 'closing', 'instant', 'content crossfade', 'scrolled'],
        tokens: ['--peek-w', '--content-bg', '--separator', '--toolbar-h', '--ease-drawer', '--ease-out'],
        motion: 'Open (pointer): .peek transform translateX(calc(100% + 48px)) → none, 300ms var(--ease-drawer) cubic-bezier(0.32,0.72,0,1); visibility switches at 0ms. Close: → translateX(calc(100% + 48px)) 200ms var(--ease-out), visibility hidden after 200ms. CSS transition (interruptible mid-flight); .instant removes the transition for keyboard/programmatic opens. Content swap while open: T.fx.crossfade WAAPI — out 110ms ease-out (opacity 1→0, blur 0→2px, fill forwards), swap innerHTML, in 190ms var(--ease-out) (opacity 0→1, blur 2→0); scroll resets to top. Scrolled bar: background + hairline 200ms ease once scrollTop > 2. Agenda padding-right switches instantly. Reduced motion: slide and crossfade become instant swaps. framer-motion: <AnimatePresence><motion.aside initial={{ x: "calc(100% + 48px)" }} animate={{ x: 0, transition: { duration: 0.3, ease: [0.32, 0.72, 0, 1] } }} exit={{ x: "calc(100% + 48px)", transition: { duration: 0.2, ease: [0.23, 1, 0.32, 1] } }} /> and an inner <AnimatePresence mode="wait"> keyed by target with opacity/filter keyframes.',
        a11y: '<aside aria-label="Side peek"> (complementary, not modal — focus stays in the agenda). Esc closes it (after blurring any field); ↑/↓ keep moving the agenda selection while it is open and swap content without animation; Enter re-opens the selected card. Close button has a tooltip “Close · esc”.',
        stories: [
          { label: 'Open over the agenda', note: 'Main area only (no sidebar), 1096px wide like the app at 1440px. Buttons replay the real slide, the pointer crossfade and the scrolled bar.', html: composedPanel, span: 'full', flush: true, height: 660, bg: 'window', mount: mountComposed }
        ]
      },
      {
        id: 'peek-header',
        name: 'PeekHeader',
        summary: 'Sticky bar with the series link, “Open as page” and close, then the meeting title, number, date · time · place and attendee avatars. Untracked items show their calendar; unfiled items show “Needs filing”.',
        mapsTo: 'Custom header · series link = Button (link variant) · close = Button icon + Radix Tooltip',
        usedIn: ['PeekPanel'],
        source: '002 app-peek.js headerMarkup · app.css .pk-bar, .pk-series, .pk-open, .pk-head, .pk-title, .pk-n, .pk-meta',
        props: [
          ['series', 'Series | null — tracked series link', '—'],
          ['source', 'series | calendar | needs-filing', 'series'],
          ['title', 'string (meeting title → event title → series name)', '—'],
          ['number', 'number | null (#37)', '—'],
          ['meta', '[day, time, place] or [when, duration]', '—'],
          ['people', 'string[] (max 4 avatars, +N)', '[]'],
          ['canOpenPage', 'boolean (tracked and not unfiled)', 'true'],
          ['scrolled', 'boolean', 'false']
        ],
        states: ['rest', 'series link hover', 'series link pressed', 'Open as page hover', 'close hover', 'scrolled (glass bar)', 'untracked (calendar)', 'needs filing', 'long title truncation'],
        tokens: ['--accent', '--accent-softer', '--label-2', '--label-3', '--content-bg', '--separator', '--font-display'],
        motion: 'Series link press: transform scale(0.97) 140ms var(--ease-out); hover background var(--accent-softer) 150ms ease (fine pointers only). Bar background (82% content-bg + blur 18px) and bottom hairline fade in 200ms ease when the body scrolls past 2px — CSS transition, interruptible. Reduced motion: unchanged (color-only). framer-motion: none needed; use a scroll listener toggling a data attribute.',
        a11y: 'Title is an <h2>; series link is a <button> naming the series (opens the doc); “Open as page” and ✕ are buttons (✕ has aria-label via tooltip text “Close · esc”). Avatars carry title attributes with full names.',
        stories: [
          { label: 'Tracked meeting', note: 'Series link · Open as page · close; #37; Today · 10:00–10:45 · Google Meet; 5 attendees (+1)', html: () => frame(headOnly(target.upcoming())), bg: 'window', span: 2 },
          { label: 'Hover', note: 'Series link, Open as page and close forced to :hover', html: () => frame(forceOn(headOnly(target.upcoming()), ['class="pk-series"', 'class="btn sm plain pk-open"', 'class="btn sm plain icon"'])), force: 'hover', bg: 'window', span: 2 },
          { label: 'Scrolled', note: 'Body scrolled under the sticky bar → glass bar with hairline', html: () => frame(target.upcoming(), { cls: ' cp-fixed', scrolled: true }), bg: 'window', span: 2, mount: mountScrolled },
          { label: 'Untracked · calendar source', note: 'No series yet: the calendar name replaces the link and there is no “Open as page”', html: () => frame(headOnly(target.recurring())), bg: 'window', span: 2 },
          { label: 'Needs filing', note: 'Unfiled recording: static “Needs filing”, when · duration, no avatars', html: () => frame(headOnly(target.unfiledRec())), bg: 'window', span: 2 },
          { label: 'Long title', note: 'Title and series link truncate with an ellipsis; the #number never wraps', html: () => frame(headOnly(target.longTitle())), bg: 'window', span: 2 }
        ]
      },
      {
        id: 'peek-body',
        name: 'PeekBody',
        summary: 'The peek’s body for every kind of meeting. Tracked meetings reuse the living doc blocks with surface="peek" (compact container layout ≤ 600px); untracked, proposed and unfiled items get peek-only cards with their next action.',
        mapsTo: 'Router component over NextBlock · PastSummary (MeetingBody surface="peek") · TrackingNote · UntrackedEmpty · ProposalMatchCard · FilingCard',
        usedIn: ['PeekPanel'],
        source: '002 app-peek.js BODY (next → T.doc.nextMarkup(s, m, { surface: "peek" }), past → T.doc.peekPastMarkup, trackingBody, untrackedBody, proposalBody, unfiledBody) · doc-past.js peekPastMarkup · app-record.js T.oneOffLiveMarkup',
        props: [
          ['view', 'next | past | tracking | untracked | proposal | unfiled', '—'],
          ['series / meeting', 'Series, Meeting', '—'],
          ['kind', 'ready | preparing | recording | summarizing | review | filed | recurring | oneoff | proposal | unfiled', '—'],
          ['recordOnce', 'boolean (untracked events)', 'false'],
          ['past', 'boolean (event already ended → no Record once)', 'false']
        ],
        states: ['upcoming · brief ready', 'upcoming · not prepared yet', 'preparing brief', 'starting now', 'live recording', 'preparing summary', 'needs review', 'past · filed', 'past · transcript open', 'cancelled', 'just tracked', 'untracked recurring', 'records once', 'untracked · already happened', 'one-off', 'one-off · recording', 'likely match (proposal)', 'unfiled recording', 'unfiled file', 'filed'],
        tokens: ['--accent-softer', '--coral', '--amber', '--mint', '--surface-sunken', '--shadow-card', '--r-card'],
        motion: 'Inline transcript (past): .collapsible grid-template-rows 0fr ↔ 1fr 260ms var(--ease-out) + opacity 200ms ease (CSS transition, interruptible); the button label swaps “Open transcript” ↔ “Hide transcript”; opening on evidence highlights the line (.tl background 300ms ease) and smooth-scrolls it to the centre after 280ms. Next block repaint (preparing → ready, live → preparing summary): WAAPI out 120ms ease-out (opacity→0, blur 2px) then in 200ms var(--ease-out) (opacity 0→1, translateY 4px→0). Recording: .rec-dot opacity pulse 1.4s ease-in-out infinite, .wave bars scaleY 0.3↔1 900ms ease-in-out infinite (staggered delays), timer ticks each second. Shimmer 1.3s linear infinite, spinner 700ms linear. Reduced motion: shimmer and wave stop, rec-dot slows to 2.4s, collapsible and repaint swap instantly. framer-motion: Collapsible → motion.div animate={{ height: open ? "auto" : 0, opacity }}; repaint → AnimatePresence mode="wait" with y: 4.',
        a11y: 'Everything is buttons: Record/Stop (⌘R), Skip, Join, Accept/Correct/Reject, Track this series, Record once / Don’t record, Add to series…, File there, Choose…, Play. Status text (“Starting now”, “Recording”, “Preparing summary…”) should be announced via aria-live="polite" on the block. Transcript lines are a list with <time> elements.',
        stories: [
          body('Upcoming · brief ready', 'Before · 9:41 — countdown, Join, Record ⌘R, Since last time, Worth asking, agenda, docs', 'upcoming'),
          body('Starting now', 'Starting · 10:00 — coral “Starting now” chip with a blinking dot, Skip before Join and Record', 'starting'),
          body('Live recording', 'Live · 10:12 — recording strip, ticking timer, wave, transcript lines and “Worth asking now”', 'live', { mount: (c) => startTimers(c, LIVE_ELAPSED.main) }),
          body('Preparing summary', 'Right after Stop: spinner, “On this Mac”, shimmer lines', 'summarizing'),
          body('Needs review', 'After · 10:46 — Summary, “5 to review”, Accept all, five candidates in compact layout', 'review'),
          body('Past · filed', 'Summary, counts, knowledge rows, docs, Open transcript (collapsed inline). Click Open transcript to toggle.', 'past', { mount: (c) => wireTranscript(c) }),
          body('Past · transcript open on evidence', 'Opened from a source chip: inline transcript expanded, 18:42 highlighted', 'past', { mount: (c) => wireTranscript(c, '18:42') }),
          body('Cancelled', 'Cancelled in Calendar — nothing recorded; items carried forward', 'cancelled'),
          body('Not prepared yet', 'Fri 2 Oct — “Telu prepares this brief the evening before”, carry forward so far, standing agenda preview, docs', 'pending'),
          body('Preparing brief', 'Acme 15:30 — brief shown while “Still preparing … ready before 15:30”', 'preparing'),
          body('Just tracked', 'Daily Standup right after “Track this series”: note card + Open Daily Standup', 'tracking'),
          body('Untracked recurring', 'Tomorrow’s Daily Standup: Track this series (primary) + Record once', 'recurring'),
          body('Untracked · records once', 'After “Record once”: coral “Records once at 09:00” and a Don’t record toggle', 'recordOnce'),
          body('Untracked · already happened', 'Today 09:00 standup is past: no Record once', 'recurringPast'),
          body('One-off', 'Coffee with Alex Kim: Add to series… + Record once', 'oneoff'),
          body('One-off · recording', 'Recording once: coral strip above the empty state; nothing is filed', 'oneoffLive', { mount: (c) => startTimers(c, LIVE_ELAPSED.once) }),
          body('Likely match (proposal)', 'Acme · SSO deep-dive: “Telu found a likely match” with the target series, Add / Keep separate', 'proposal'),
          body('Unfiled recording', 'Needs filing: suggestion (File there, Choose…, Play) + transcript', 'unfiledRec'),
          body('Unfiled file', 'Offsite notes.md: suggestion without Play + the file chip', 'unfiledDoc'),
          body('Filed', 'After filing: “Filed to Acme · Implementation” note card; transcript stays', 'filed')
        ]
      }
    ]
  });
})();
