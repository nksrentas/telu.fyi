(() => {
  const e = Kit.esc;
  const GROUPS = ['Team', '1:1s', 'Clients', 'Leadership', 'Other'];
  const lowerFirst = (t) => t.charAt(0).toLowerCase() + t.slice(1);
  const emptyState = (ico, title, text) => `<div class="empty">${icon(ico, 'xl')}<h3>${title}</h3><p>${text}</p></div>`;
  const pendingCount = (s) => s.meetings.reduce((n, m) => n + LD.pendingOf(m), 0);

  const docRow = (s, view) => {
    const pending = pendingCount(s);
    const selected = view.kind === 'doc' && view.id === s.id;
    const right = pending ? `<span class="count review num">${pending}</span>` : `<span class="hint">${LD.nextHint(s)}</span>`;
    return `<div class="sb-item doc-row ${selected ? 'selected' : ''}" data-act="open-doc" data-doc="${e(s.id)}">${Kit.seriesIcon(s)}<span class="name">${e(s.name || 'Untitled')}</span>${right}</div>`;
  };
  const smartRows = (st) => {
    const sel = (kind) => (st.view.kind === kind ? 'selected' : '');
    const next = LD.nextToday(st.series);
    return `<div class="sb-item smart ${sel('upnext')}" data-act="view" data-view="upnext">${icon('clock')}<span class="name">Up Next</span>${next ? `<span class="sb-right num">${LD.startTime(next.m)}<span class="soon">${LD.soonLabel(next.m)}</span></span>` : ''}</div>
      <div class="sb-item smart ${sel('suggestions')}" data-act="view" data-view="suggestions">${icon('sparkles')}<span class="name">Suggestions</span>${st.proposals.length ? `<span class="count">${st.proposals.length}</span>` : ''}</div>
      <div class="sb-item smart ${sel('unfiled')}" data-act="view" data-view="unfiled" data-unfiled>${icon('tray')}<span class="name">Unfiled</span>${st.unfiled.length ? `<span class="count">${st.unfiled.length}</span>` : ''}</div>`;
  };
  const sidebarNav = () => {
    const st = LD.state;
    const groups = GROUPS.map((g) => {
      const rows = st.series.filter((s) => s.group === g);
      return rows.length ? `<div class="sb-group" data-group="${g}"><div class="sb-title">${g}</div>${rows.map((s) => docRow(s, st.view)).join('')}</div>` : '';
    }).join('');
    return `${smartRows(st)}${groups}<div class="sb-nomatch" hidden></div>`;
  };

  const dayHeading = (date) => {
    const off = LD.dayOffset(date);
    return off === 0 ? 'Today' : off === 1 ? 'Tomorrow' : date;
  };
  const upNextItems = () => LD.state.series
    .map((s) => ({ s, m: LD.upcomingOf(s) }))
    .filter((x) => x.m)
    .sort((a, b) => LD.dayOffset(a.m.date) - LD.dayOffset(b.m.date) || LD.toMinutes(LD.startTime(a.m)) - LD.toMinutes(LD.startTime(b.m)));
  const briefState = (m) => (m.status === 'preparing'
    ? '<span class="chip"><span class="spinner tiny"></span>Preparing brief</span>'
    : m.brief ? '<span class="chip accent">Brief ready</span>' : '<span class="un-later">Brief the evening before</span>');
  const upRow = ({ s, m }) => `<button class="card interactive un-row" data-act="goto-next" data-doc="${e(s.id)}">
      <span class="un-time num">${LD.startTime(m)}</span>${Kit.seriesIcon(s)}
      <span class="un-main"><b>${e(s.name)}</b><span>${e([m.n ? `#${m.n}` : '', m.title || '', m.where || '', LD.countdown(m)].filter(Boolean).join(' · '))}</span></span>
      ${briefState(m)}${icon('chevron-right', 'un-chev')}
    </button>`;
  const untrackedRows = () => DATA.days[1].events
    .filter((ev) => ev.state === 'untracked' && !ev.past && !LD.state.series.some((s) => s.name === ev.title))
    .map((ev) => `<div class="un-row untracked"><span class="un-time num">${ev.start}</span><span class="un-cal">${icon('calendar')}</span><span class="un-main"><b>${e(ev.title)}</b><span>Not tracked${ev.where ? ` · ${e(ev.where)}` : ''}</span></span><button class="btn sm" data-act="track-event" data-event="${ev.id}">${icon('plus')}Living doc</button></div>`)
    .join('');
  const upNextMarkup = () => {
    const items = upNextItems();
    const days = [...new Set(items.map((x) => dayHeading(x.m.date)))];
    const sections = days.map((d) => `<div class="un-day"><div class="un-day-label">${e(d)}</div>${items.filter((x) => dayHeading(x.m.date) === d).map(upRow).join('')}${d === 'Today' ? untrackedRows() : ''}</div>`).join('');
    return `<div class="view"><h1 class="t-large view-title" id="viewTitle">Up Next</h1><p class="view-sub">${e(DATA.now.long)} · each brief lives inside its doc</p>
      ${items.length ? sections : emptyState('clock', 'Nothing coming up', 'Connect your calendar or create a living doc — its next meeting shows up here.')}</div>`;
  };

  const proposalActions = (p) => {
    if (p.kind === 'join') {
      const t = LD.series(p.target);
      return `<button class="btn sm tinted" data-act="join-proposal" ${t ? '' : 'disabled'}>${icon('link')}Add to ${e(t ? t.name : 'doc')}</button><button class="btn sm plain" data-act="dismiss-proposal" data-msg="Kept ${e(p.title)} separate">Keep separate</button>`;
    }
    if (p.quiet) return `<button class="btn sm" data-act="create-proposal">Track anyway</button><button class="btn sm plain" data-act="dismiss-proposal" data-msg="Telu won’t suggest ${e(p.title)} again">Stop suggesting</button>`;
    return `<button class="btn sm primary" data-act="create-proposal">${icon('doc-plus')}Create living doc</button><button class="btn sm plain" data-act="dismiss-proposal" data-msg="Got it — ${e(p.title)} isn’t a series">Not a series</button>`;
  };
  const proposalPeople = (p) => (p.people
    ? `<span class="avatars">${p.people.map((n) => Kit.avatar(n)).join('')}${p.extra ? `<span class="more">+${p.extra}</span>` : ''}</span>`
    : '');
  const proposalCard = (p) => {
    const target = p.kind === 'join' ? LD.series(p.target) : null;
    return `<div class="card sug-card ${p.quiet ? 'quiet' : ''}" data-pid="${e(p.id)}">
      <div class="sug-top"><span class="sug-ico">${icon(p.kind === 'join' ? 'link' : 'calendar-plus')}</span>
        <div class="sug-main"><div class="t-title3">${e(p.title)}</div><div class="muted num">${e(p.rule || p.when)}${p.calendar ? ` · ${e(p.calendar)} calendar` : ''}</div></div>
        ${target ? `<span class="sug-target">${Kit.seriesIcon(target)}${e(target.name)}</span>` : proposalPeople(p)}</div>
      <div class="sug-reason">${icon(p.quiet ? 'info' : 'calendar-check')}<span>${e(p.reason)}</span></div>
      <div class="sug-actions">${proposalActions(p)}</div>
    </div>`;
  };
  const suggestionsMarkup = () => {
    const list = LD.state.proposals;
    return `<div class="view"><h1 class="t-large view-title" id="viewTitle">Suggestions</h1><p class="view-sub">Telu watches your calendar for conversations that repeat. Nothing changes until you say so.</p>
      <div class="card-list" id="cardList">${list.length ? list.map(proposalCard).join('') : emptyState('sparkles', 'No suggestions', 'When a new recurring meeting shows up in your calendar, it appears here.')}</div></div>`;
  };

  const unfiledCard = (u) => {
    const target = u.suggestion ? LD.series(u.suggestion.series) : null;
    return `<div class="card uf-card" data-uid="${e(u.id)}">
      <div class="uf-top"><span class="uf-ico">${icon(u.kind === 'recording' ? 'waveform' : 'doc')}</span>
        <div class="uf-main"><div class="t-title3">${e(u.title)}</div><div class="muted num">${e([u.when, u.duration].filter(Boolean).join(' · '))}</div></div>
        ${u.kind === 'recording' ? `<button class="btn sm icon plain" data-act="play" data-tip="Play">${icon('play')}</button>` : ''}</div>
      ${target ? `<div class="uf-suggest">${Kit.seriesIcon(target)}<span>Telu thinks this belongs in <b>${e(target.name)}</b> — ${e(lowerFirst(u.suggestion.why))}</span></div>` : ''}
      <div class="uf-actions">${target ? `<button class="btn sm primary" data-act="file-there">${icon('tray-down')}File there</button>` : ''}<button class="btn sm" data-act="file-choose">Choose…</button></div>
    </div>`;
  };
  const unfiledEmpty = () => emptyState('tray', 'Nothing unfiled', 'Every meeting found its doc. Anything Telu can’t place lands here for you to file.');
  const unfiledMarkup = () => {
    const list = LD.state.unfiled;
    return `<div class="view"><h1 class="t-large view-title" id="viewTitle">Unfiled</h1><p class="view-sub">Recordings and files Telu couldn’t place with confidence.</p>
      <div class="card-list" id="cardList">${list.length ? list.map(unfiledCard).join('') : unfiledEmpty()}</div></div>`;
  };

  const heroArt = () => `<div class="hero-art" aria-hidden="true">
      <div class="ha-row ha-title enter" style="--i:0"><span class="series-icon" style="--c:var(--series-blue)">${icon('people')}</span><span class="ha-bar strong" style="width:46%"></span></div>
      ${[['Purpose', '88%'], ['Memory', '64%'], ['Next', '76%'], ['Sep 22', '52%'], ['Sep 15', '40%']].map(([l, w], i) => `<div class="ha-row enter ${l === 'Next' ? 'ha-next' : ''}" style="--i:${i + 1}"><span class="ha-lbl">${l}</span><span class="ha-bar" style="width:${w}"></span></div>`).join('')}
    </div>`;
  const welcomeMarkup = (denied) => `<div class="hero">
      ${heroArt()}
      <h1 class="t-large hero-title">${denied ? 'Calendar access is off' : 'Every recurring meeting becomes a living doc.'}</h1>
      <p class="hero-sub">${denied ? 'Telu can’t see your recurring meetings yet. Turn on calendar access in System Settings, or start a doc by hand — you can connect later.' : 'Connect your calendar and Telu drafts one for each recurring meeting — purpose on top, every meeting filed inside. Nothing leaves your Mac.'}</p>
      <div class="hero-actions">${denied ? `<button class="btn lg primary" data-act="open-settings">${icon('sliders')}Open System Settings</button>` : `<button class="btn lg primary" data-act="connect">${icon('calendar')}Connect Calendar</button>`}<button class="btn lg" data-act="scratch">Start from scratch</button></div>
      <div class="hero-foot">${icon('lock', 'sm')}Your calendar is read on this Mac. Recordings and notes stay here too.</div>
    </div>`;

  const detectedName = (d) => (d.series ? Kit.series(d.series).name : d.title);
  const detectRow = (d, i) => {
    const s = d.series ? Kit.series(d.series) : null;
    const ico = s ? Kit.seriesIcon(s) : `<span class="series-icon" style="--c:var(--series-gray)">${icon('calendar')}</span>`;
    const sub = [s ? s.rule : d.rule, d.note && !d.ignored ? d.note : ''].filter(Boolean).join(' · ');
    return `<div class="det-row enter ${d.ignored ? 'ignored' : ''}" data-i="${i}"><span class="det-ico">${ico}</span><div class="det-main"><b>${e(detectedName(d))}</b><span>${e(sub)}</span></div><span class="det-found num">${d.ignored ? e(d.note) : `${d.found} meetings`}</span><button class="switch" aria-checked="${d.on && !d.ignored}" data-i="${i}" ${d.ignored ? 'disabled' : ''} aria-label="Create a living doc for ${e(detectedName(d))}"></button></div>`;
  };
  const detectMarkup = () => `<div class="detect">
      <div class="detect-head"><h1 class="t-large view-title" id="viewTitle"><span class="spinner" id="detectSpin"></span><span id="detectTitle">Reading your calendar…</span></h1><p class="view-sub" id="detectSub">Looking for conversations that repeat. This happens on this Mac.</p></div>
      <div class="card detect-list" id="detectList"></div>
      <div class="detect-foot"><span class="faint">You can add or remove living docs any time.</span><span class="spacer"></span><button class="btn lg primary" data-act="create-detected" id="createDetected" disabled>Create living docs</button></div>
    </div>`;

  const transcriptLines = (lines, t) => (lines.length
    ? lines.map((l) => `<div class="tl ${l.t === t ? 'hl' : ''}"><time>${e(l.t)}</time><b>${e(l.who)}</b><p>${e(l.text)}</p></div>`).join('')
    : `<div class="drawer-empty">${icon('waveform', 'xl')}<p>No highlighted moments in this meeting.</p></div>`);
  const drawerTranscript = (s, m, t) => `<div class="drawer-head"><div class="drawer-titles"><h3>Transcript · ${e(m.date)}</h3><p>${e(s.name)}${m.n ? ` · #${m.n}` : ''}${m.duration ? ` · ${e(m.duration)}` : ''}</p></div><button class="btn sm icon plain" data-act="close-drawer" aria-label="Close">${icon('x')}</button></div>
    <div class="drawer-note">${icon('lock', 'sm')}Transcribed on this Mac${t ? ' · evidence highlighted' : ''}</div>
    <div class="drawer-body" id="drawerBody">${transcriptLines(LD.transcriptOf(s, m), t)}</div>`;
  const infoRow = (label, value) => `<div class="info-row"><span class="info-label">${label}</span><span class="info-value">${value}</span></div>`;
  const drawerInfo = (s) => `<div class="drawer-head"><div class="drawer-titles"><h3>${e(s.name || 'Untitled')}</h3><p>Living doc details</p></div><button class="btn sm icon plain" data-act="close-drawer" aria-label="Close">${icon('x')}</button></div>
    <div class="drawer-body info">
      ${infoRow('Rhythm', e(s.rule || 'Not set'))}
      ${infoRow('Calendar', s.source === 'calendar' ? `${e(s.calendar)} · “${e(s.name)}”` : 'Not linked')}
      ${infoRow('Meetings', s.count ? `${s.count} since ${e(s.since)}` : 'None yet')}
      ${infoRow('Reference', s.docs.length ? LD.plural(s.docs.length, 'file') : 'None')}
      ${infoRow('Memory', s.memory.length ? `${LD.plural(s.memory.length, 'accepted item')}` : 'Empty')}
      <div class="info-people">${s.people.map((p) => `<div class="info-person">${Kit.avatar(p, 'lg')}<span>${e(p)}</span></div>`).join('') || '<span class="faint">No attendees yet</span>'}</div>
      <div class="info-local">${icon('lock', 'sm')}Stored on this Mac. Transcription and summaries run locally.</div>
    </div>`;

  Object.assign(LD, {
    sidebarNav, upNextMarkup, suggestionsMarkup, unfiledMarkup, unfiledEmpty, emptyState,
    welcomeMarkup, detectMarkup, detectRow, drawerTranscript, drawerInfo, pendingCount
  });
})();
