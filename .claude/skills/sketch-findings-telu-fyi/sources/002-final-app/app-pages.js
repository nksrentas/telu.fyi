(() => {
  const T = window.T;
  const { esc } = Kit;
  const { toMin, plural } = T.util;

  const daySection = (title, sub, list, extra = '') => `<section class="a-day"><div class="a-day-head"><h2>${esc(title)}</h2><span>${esc(sub)}</span>${extra}</div>`
    + `<div class="a-timeline">${list.map((x) => T.agenda.rowMarkup(x.ev, x.dayIndex, { withDay: x.withDay })).join('')}</div></section>`;
  const emptyPage = (iconName, title, text) => `<div class="a-first"><div class="empty"><span class="a-empty-badge">${icon(iconName, 'xl')}</span><h3>${title}</h3><p>${text}</p></div></div>`;
  const pageHead = (title, sub) => `<header class="pg-head"><h1 class="t-large">${esc(title)}</h1><p>${sub}</p></header>`;

  const upcomingMarkup = () => {
    if (T.state.calendar !== 'connected') return emptyPage('calendar', 'Nothing upcoming yet', 'Connect your calendar and the next few days show up here.');
    const byStart = (a, b) => toMin(a.start) - toMin(b.start);
    const extras = T.extraEvents();
    const days = [
      { title: 'Tomorrow', sub: T.state.days[2].long, dayIndex: 2, events: T.state.days[2].events },
      ...T.EXTRA_DAYS.map((d, i) => ({ title: d.label, sub: d.long, dayIndex: 3 + i, events: extras.filter((ev) => ev.day === 3 + i).sort(byStart) }))
    ].filter((d) => d.events.length);
    return `<div class="a-list">${days.map((d) => daySection(d.title, d.sub, d.events.map((ev) => ({ ev, dayIndex: d.dayIndex })))).join('')}</div>`;
  };

  const lowerFirst = (text) => text.charAt(0).toLowerCase() + text.slice(1);
  T.pages = T.pages || {};
  T.pages.unfiledCard = (u) => {
    const target = u.suggestion ? T.seriesById(u.suggestion.series) : null;
    const suggest = target && target.tracked
      ? `<div class="uf-suggest">${Kit.seriesIcon(target)}<span>Telu thinks this belongs in <b>${esc(target.name)}</b> — ${esc(lowerFirst(u.suggestion.why))}</span></div>` : '';
    return `<div class="card interactive uf-card" data-uid="${esc(u.id)}" data-act="select-unfiled">
      <div class="uf-top"><span class="uf-ico">${icon(u.kind === 'recording' ? 'waveform' : 'doc')}</span>
        <div class="uf-main"><div class="t-title3">${esc(u.title)}</div><div class="muted num">${esc([u.when, u.duration].filter(Boolean).join(' · '))}</div></div>
        ${u.kind === 'recording' ? `<button class="btn sm icon plain" data-act="play" data-tip="Play">${icon('play')}</button>` : ''}</div>
      ${suggest}
      <div class="uf-actions">${suggest ? `<button class="btn sm primary" data-act="file-there">${icon('tray-down')}File there</button>` : ''}<button class="btn sm" data-act="file-choose">Choose…</button></div>
    </div>`;
  };

  const reviewItems = () => T.state.days.flatMap((d, dayIndex) => d.events.map((ev) => ({ ev, dayIndex, withDay: true })))
    .filter((x) => T.kindOf(x.ev) === 'review');
  const reviewSub = () => `${plural(reviewItems().reduce((n, x) => n + T.pending(x.ev.meeting), 0), 'item')} · accept, correct or reject what Telu found`;
  T.pages.refreshReviewHead = () => {
    const head = Kit.$('#view .pg-review .a-day:not(.pg-filing) .a-day-head span');
    if (head) head.textContent = reviewSub();
  };
  const reviewMarkup = () => {
    const toReview = reviewItems();
    const unfiled = T.state.unfiled;
    if (!toReview.length && !unfiled.length) return emptyPage('check-circle', 'All caught up', 'Everything Telu found has been reviewed and filed.');
    const review = toReview.length ? daySection('To review', reviewSub(), toReview) : '';
    const filing = unfiled.length
      ? `<section class="a-day pg-filing"><div class="a-day-head"><h2>Needs filing</h2><span>Recordings and files Telu couldn’t place with confidence</span></div><div class="card-list" id="ufList">${unfiled.map(T.pages.unfiledCard).join('')}</div></section>`
      : '';
    return `<div class="a-list pg-review">${review}${filing}</div>`;
  };

  const proposalCard = (p) => {
    const more = p.extra ? `<span class="a-more">+${p.extra}</span>` : '';
    if (p.kind === 'join') {
      const target = T.seriesById(p.target);
      if (!target) return '';
      return `<article class="a-pcard card" data-proposal="${p.id}"><div class="a-pcard-kind">${icon('link')}Looks like part of ${esc(target.name)}</div>`
        + `<div class="a-pcard-main">${Kit.seriesIcon(target)}<div class="a-pcard-text"><b>${esc(p.title)}</b><span>${esc(p.when)}</span></div></div>`
        + `<p class="a-pcard-reason">${esc(p.reason)}</p><div class="a-pcard-actions"><button class="btn sm primary" data-act="prop-join">Add to ${esc(target.name)}</button>`
        + '<button class="btn sm" data-act="prop-separate">Keep separate</button></div></article>';
    }
    if (p.quiet) {
      return `<article class="a-pcard card is-quiet" data-proposal="${p.id}"><div class="a-pcard-main"><span class="a-pcard-icon">${icon('repeat')}</span>`
        + `<div class="a-pcard-text"><b>${esc(p.title)}</b><span>${esc(p.reason)}</span></div>`
        + '<div class="a-pcard-inline"><button class="btn sm" data-act="prop-track">Track anyway</button><button class="btn sm plain" data-act="prop-dismiss">Stop suggesting</button></div></div></article>';
    }
    return `<article class="a-pcard card" data-proposal="${p.id}"><div class="a-pcard-kind">${icon('sparkles')}New recurring meeting</div>`
      + `<div class="a-pcard-main"><span class="a-pcard-icon">${icon('repeat')}</span><div class="a-pcard-text"><b>${esc(p.title)}</b><span>${esc(p.rule)} · ${esc(p.calendar)}</span></div>`
      + `<span class="spacer"></span>${Kit.avatars(p.people, 3)}${more}</div><p class="a-pcard-reason">${esc(p.reason)}</p>`
      + '<div class="a-pcard-actions"><button class="btn sm primary" data-act="prop-track">Track as series</button><button class="btn sm" data-act="prop-dismiss">Not a series</button></div></article>';
  };
  const caughtUp = () => `<div class="empty a-caught"><span class="a-empty-badge">${icon('check-circle', 'xl')}</span><h3>You’re all caught up</h3><p>Telu will mention it when something new starts repeating.</p></div>`;

  const foundMarkup = () => {
    const list = T.state.proposals;
    const loud = list.filter((p) => !p.quiet);
    const quiet = list.filter((p) => p.quiet);
    const head = pageHead('Found in Calendar', 'Telu noticed these patterns in your calendar. Decide once — it won’t ask again.');
    const cards = list.length
      ? `<div class="a-pcards" id="pcards">${loud.map(proposalCard).join('')}${quiet.length ? `<div class="t-eyebrow a-pcards-sub">Less likely</div>${quiet.map(proposalCard).join('')}` : ''}</div>`
      : caughtUp();
    return `<div class="pg">${head}${cards}<p class="pg-foot">${icon('lock', 'sm')}Your calendar is read on this Mac. Nothing is uploaded.</p></div>`;
  };

  const firstRunMarkup = () => '<div class="a-first"><div class="empty pg-welcome"><div class="app-icon"><img src="../kit/telu-icon.png" alt=""></div>'
    + '<h3>Welcome to Telu</h3><p>Connect your calendar and Telu prepares a brief before each recurring meeting — on this Mac.</p>'
    + `<div class="a-empty-actions"><button class="btn primary" data-act="setup">Set up Telu</button></div><p class="a-local">${icon('lock', 'sm')}Processed on this Mac</p></div></div>`;

  Object.assign(T.pages, { upcomingMarkup, reviewMarkup, foundMarkup, firstRunMarkup, caughtUp, emptyPage });
})();
