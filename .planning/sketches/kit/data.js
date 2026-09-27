window.DATA = {
  now: { day: 'Tue 29 Sep', long: 'Tuesday, 29 September', time: '9:41', menubar: 'Tue 29 Sep  9:41' },

  people: {
    You: '#6366E8',
    'Maria Chen': '#FF9F0A',
    'Jon Park': '#0A84FF',
    'Aisha Bello': '#AF52DE',
    'Leo Duarte': '#30B955',
    'Priya Nair': '#FF375F',
    'Dana Whitfield': '#2FA8C0',
    'Sam Ortiz': '#8E8E93',
    'Alex Kim': '#A2845E',
    'R. Gomez': '#8E8E93',
    'K. Osei': '#8E8E93',
    'M. Laurent': '#8E8E93'
  },

  calendars: [
    { id: 'work', name: 'Work', account: 'Google', color: '#0A84FF', watched: true },
    { id: 'personal', name: 'Personal', account: 'iCloud', color: '#30B955', watched: false }
  ],

  series: [
    {
      id: 'product-sync', name: 'Product Sync', color: 'var(--series-blue)', icon: 'people', group: 'Team',
      cadence: 'Weekly', rule: 'Every Tue · 10:00–10:45', source: 'calendar', calendar: 'Work',
      count: 36, since: 'Jan 2026', next: 'Today 10:00',
      people: ['Maria Chen', 'Jon Park', 'Aisha Bello', 'Leo Duarte', 'Priya Nair'],
      purpose: {
        version: 3, edited: 'Sep 18', by: 'You',
        why: 'Keep product, design and engineering pointed at the same three priorities — and catch cross-team blockers before they cost a sprint.',
        outcomes: ['Priorities for the week are explicit and agreed', 'Every blocker leaves with an owner and a date', 'Scope changes are decided here, not in DMs'],
        agenda: [{ t: 'Metrics pulse', d: '5 min' }, { t: 'Priorities & scope', d: '20 min' }, { t: 'Blockers', d: '15 min' }, { t: 'Decisions recap', d: '5 min' }],
        notFor: 'Status updates that fit in Slack. Deep design critique — that’s Design Review.',
        history: [
          { v: 3, date: 'Sep 18', note: 'Added “Not for this meeting”' },
          { v: 2, date: 'Jun 3', note: 'New outcomes after the re-org' },
          { v: 1, date: 'Jan 12', note: 'Drafted from the calendar invite' }
        ]
      },
      docs: [
        { name: 'Q4 Roadmap.pdf', ver: 'v2', size: '2.4 MB', added: 'Sep 14', include: true },
        { name: 'North-star metrics.docx', ver: 'v5', size: '180 KB', added: 'Sep 21', include: true },
        { name: 'Team charter.md', ver: 'v1', size: '6 KB', added: 'Jan 12', include: false }
      ],
      memory: [
        { type: 'decision', text: 'Ship offline mode behind a flag in 4.2', status: 'current', from: 'Sep 22', src: 'Sep 22 · 12:30' },
        { type: 'decision', text: 'Pricing experiment runs until Oct 15', status: 'current', from: 'Sep 22', src: 'Sep 22 · 24:10', replaced: 'Pricing experiment runs until Oct 1 · Sep 8' },
        { type: 'commitment', text: 'Share the API rate-limit plan', owner: 'Jon Park', due: 'Sep 29', status: 'open', from: 'Sep 22', src: 'Sep 22 · 18:42' },
        { type: 'commitment', text: 'Recruit 8 people for usability tests', owner: 'Aisha Bello', status: 'completed', from: 'Sep 15', src: 'Sep 15 · 09:12' },
        { type: 'question', text: 'Do we need SOC 2 Type I before the Acme rollout?', status: 'unresolved', from: 'Sep 15', src: 'Sep 15 · 31:10' },
        { type: 'fact', text: 'Activation is 41% against a 45% target', status: 'current', from: 'Sep 22', src: 'North-star metrics.docx · p.2' }
      ],
      meetings: [
        {
          id: 'ps-37', n: 37, date: 'Today', day: 'Tue 29 Sep', time: '10:00–10:45', status: 'upcoming', where: 'Google Meet',
          brief: {
            carry: [
              { type: 'commitment', text: 'Share the API rate-limit plan', owner: 'Jon Park', note: 'Due today', status: 'open', src: 'Sep 22 · 18:42' },
              { type: 'question', text: 'Do we need SOC 2 Type I before the Acme rollout?', note: 'Open for 2 meetings', status: 'unresolved', src: 'Sep 15 · 31:10' },
              { type: 'fact', text: 'Activation is 41% against a 45% target', status: 'current', src: 'North-star metrics.docx · p.2' }
            ],
            ask: [
              { text: 'Is Jon’s rate-limit plan ready to decide on today, or does it slip to Thursday?', src: 'Sep 22 · 18:42' },
              { text: 'Can SOC 2 timing be settled before Acme’s Nov 3 go-live?', src: 'Q4 Roadmap.pdf · p.7' }
            ],
            agenda: [{ t: 'Metrics pulse', d: '5m' }, { t: 'Rate-limit plan — decide', d: '15m', added: true }, { t: 'Priorities & scope', d: '15m' }, { t: 'Blockers', d: '10m' }],
            docs: ['Q4 Roadmap.pdf', 'North-star metrics.docx', 'Rate-limit plan v1.docx']
          }
        },
        {
          id: 'ps-36', n: 36, date: 'Tue 22 Sep', time: '10:00–10:43', duration: '43 min', status: 'done',
          summary: 'Offline mode ships behind a flag in 4.2. The pricing experiment was extended to Oct 15 to cover two billing cycles. Jon owns the rate-limit plan for next week.',
          counts: { decisions: 2, actions: 3, questions: 1 },
          items: [
            { type: 'decision', text: 'Ship offline mode behind a flag in 4.2', status: 'current', src: 'Sep 22 · 12:30' },
            { type: 'decision', text: 'Pricing experiment runs until Oct 15', status: 'current', src: 'Sep 22 · 24:10' },
            { type: 'commitment', text: 'Share the API rate-limit plan', owner: 'Jon Park', status: 'open', src: 'Sep 22 · 18:42' },
            { type: 'commitment', text: 'Draft the offline-mode migration note', owner: 'Leo Duarte', status: 'completed', src: 'Sep 22 · 27:55' }
          ],
          docs: ['Sprint 42 metrics.pdf', 'Offline mode spec.docx'],
          transcript: [
            { t: '12:30', who: 'Maria Chen', text: 'Okay, offline mode goes out in 4.2, but behind a flag until support is ready.' },
            { t: '18:42', who: 'Jon Park', text: 'I’ll have the rate-limit plan written up by next Tuesday.' },
            { t: '24:10', who: 'Maria Chen', text: 'Let’s keep the pricing experiment running until October fifteenth — we need two full billing cycles.' },
            { t: '27:55', who: 'Leo Duarte', text: 'I can write the migration note for offline mode this week.' }
          ]
        },
        {
          id: 'ps-35', n: 35, date: 'Tue 15 Sep', time: '10:00–10:38', duration: '38 min', status: 'done',
          summary: 'Usability testing approved for 8 participants. The SOC 2 question for Acme came up and was left open.',
          counts: { decisions: 1, actions: 2, questions: 1 }, docs: ['Usability plan.docx'],
          transcript: [
            { t: '09:12', who: 'Aisha Bello', text: 'I’ll recruit eight people for the usability round.' },
            { t: '31:10', who: 'Aisha Bello', text: 'We still don’t know if Acme needs SOC 2 before rollout.' }
          ]
        },
        {
          id: 'ps-34', n: 34, date: 'Tue 8 Sep', time: '10:00–10:45', duration: '45 min', status: 'done',
          summary: 'Pricing experiment approved to run until Oct 1. Q4 roadmap draft reviewed; three priorities agreed.',
          counts: { decisions: 2, actions: 2, questions: 0 }, docs: ['Q4 Roadmap.pdf']
        },
        { id: 'ps-33', n: 33, date: 'Tue 1 Sep', time: '10:00–10:45', status: 'cancelled', note: 'Cancelled in Calendar' }
      ]
    },
    {
      id: 'maria', name: '1:1 · Maria Chen', color: 'var(--series-orange)', icon: 'person', group: '1:1s',
      cadence: 'Weekly', rule: 'Every Tue · 14:00–14:30', source: 'calendar', calendar: 'Work',
      count: 31, since: 'Feb 2026', next: 'Today 14:00', people: ['Maria Chen'], private: true,
      purpose: {
        version: 2, edited: 'Aug 30', by: 'You',
        why: 'Help Maria grow into a staff-level scope, trade honest feedback both ways, and clear what’s blocking her team.',
        outcomes: ['One thing Maria wants to push on this week', 'Feedback given in both directions', 'Blockers leave with a next step'],
        agenda: [{ t: 'Her topics first', d: '15 min' }, { t: 'Feedback', d: '10 min' }, { t: 'Growth plan check-in', d: '5 min' }],
        notFor: 'Project status — that’s Product Sync.',
        history: [{ v: 2, date: 'Aug 30', note: 'Added growth plan check-in' }, { v: 1, date: 'Feb 4', note: 'Written by you' }]
      },
      docs: [{ name: 'Growth plan.docx', ver: 'v3', size: '92 KB', added: 'Aug 30', include: true }],
      memory: [
        { type: 'decision', text: 'Maria leads the Q4 onboarding revamp', status: 'current', from: 'Sep 8', src: 'Sep 8 · 07:22' },
        { type: 'commitment', text: 'Intro Maria to Leo’s platform team', owner: 'You', status: 'open', from: 'Sep 22', src: 'Sep 22 · 11:05' },
        { type: 'question', text: 'When does the promotion packet need to be in?', status: 'unresolved', from: 'Sep 15', src: 'Sep 15 · 19:40' }
      ],
      meetings: [
        {
          id: 'mc-32', n: 32, date: 'Today', day: 'Tue 29 Sep', time: '14:00–14:30', status: 'upcoming', where: 'Room 4B',
          brief: {
            carry: [
              { type: 'commitment', text: 'Intro Maria to Leo’s platform team', owner: 'You', note: 'Open for 1 week', status: 'open', src: 'Sep 22 · 11:05' },
              { type: 'question', text: 'When does the promotion packet need to be in?', note: 'Open for 2 meetings', status: 'unresolved', src: 'Sep 15 · 19:40' }
            ],
            ask: [{ text: 'How did the onboarding revamp kickoff go? It was her first big lead.', src: 'Sep 8 · 07:22' }],
            agenda: [{ t: 'Her topics first', d: '15m' }, { t: 'Feedback', d: '10m' }, { t: 'Growth plan check-in', d: '5m' }],
            docs: ['Growth plan.docx']
          }
        },
        { id: 'mc-31', n: 31, date: 'Tue 22 Sep', time: '14:00–14:29', duration: '29 min', status: 'done', summary: 'Maria wants more exposure to platform work. You offered an intro to Leo’s team. Feedback: her design reviews run long.', counts: { decisions: 0, actions: 1, questions: 0 }, docs: [] },
        { id: 'mc-30', n: 30, date: 'Tue 15 Sep', time: '14:00–14:30', duration: '30 min', status: 'done', summary: 'Promotion timeline discussed; packet deadline still unknown.', counts: { decisions: 0, actions: 0, questions: 1 }, docs: ['Growth plan.docx'] }
      ]
    },
    {
      id: 'acme', name: 'Acme · Implementation', color: 'var(--series-green)', icon: 'bolt', group: 'Clients',
      cadence: 'Weekly', rule: 'Every Tue · 15:30–16:30', source: 'calendar', calendar: 'Work',
      count: 19, since: 'May 2026', next: 'Today 15:30', people: ['Dana Whitfield', 'Sam Ortiz', 'Leo Duarte'], external: true,
      purpose: {
        version: 4, edited: 'Sep 25', by: 'You',
        why: 'Get Acme live on SSO and audit logs by Nov 3 — without letting scope creep in through side requests.',
        outcomes: ['Go-live risks named, each with an owner', 'Every new ask logged as in-scope or change request', 'Acme leaves knowing exactly what happens next'],
        agenda: [{ t: 'Timeline & risks', d: '15 min' }, { t: 'Open asks', d: '20 min' }, { t: 'Next steps', d: '10 min' }],
        notFor: 'Pricing or contract changes — those go to the account team.',
        history: [{ v: 4, date: 'Sep 25', note: 'Go-live moved into the purpose' }, { v: 3, date: 'Jul 9', note: 'Scope guard added' }]
      },
      docs: [
        { name: 'Acme SOW v3.pdf', ver: 'v3', size: '1.1 MB', added: 'Jul 9', include: true },
        { name: 'Security questionnaire.docx', ver: 'v2', size: '240 KB', added: 'Sep 16', include: true }
      ],
      memory: [
        { type: 'decision', text: 'Go-live date is Nov 3', status: 'current', from: 'Sep 1', src: 'Sep 1 · 04:50' },
        { type: 'decision', text: 'Audit-log retention is 1 year', status: 'current', from: 'Sep 22', src: 'Sep 22 · 33:10' },
        { type: 'commitment', text: 'Send SAML metadata', owner: 'Dana Whitfield', status: 'open', from: 'Sep 22', src: 'Sep 22 · 41:02' },
        { type: 'question', text: 'Does Acme require SOC 2 before go-live?', status: 'unresolved', from: 'Sep 15', src: 'Sep 15 · 22:18' }
      ],
      meetings: [
        {
          id: 'ac-20', n: 20, date: 'Today', day: 'Tue 29 Sep', time: '15:30–16:30', status: 'preparing', where: 'Zoom',
          brief: {
            carry: [
              { type: 'commitment', text: 'Send SAML metadata', owner: 'Dana Whitfield', note: 'Open for 1 week', status: 'open', src: 'Sep 22 · 41:02' },
              { type: 'question', text: 'Does Acme require SOC 2 before go-live?', note: 'Open for 2 meetings', status: 'unresolved', src: 'Sep 15 · 22:18' }
            ],
            ask: [{ text: 'Has Dana’s team sent the SAML metadata? SSO testing can’t start without it.', src: 'Sep 22 · 41:02' }],
            agenda: [{ t: 'Timeline & risks', d: '15m' }, { t: 'Open asks', d: '20m' }, { t: 'Next steps', d: '10m' }],
            docs: ['Acme SOW v3.pdf', 'Security questionnaire.docx']
          }
        },
        { id: 'ac-19', n: 19, date: 'Tue 22 Sep', time: '15:30–16:22', duration: '52 min', status: 'done', summary: 'SSO scope confirmed. Audit-log retention set to one year. Dana owes the SAML metadata.', counts: { decisions: 1, actions: 2, questions: 0 }, docs: ['Security questionnaire.docx'] },
        { id: 'ac-18', n: 18, date: 'Tue 15 Sep', time: '15:30–16:30', duration: '60 min', status: 'done', summary: 'Security questionnaire walkthrough. SOC 2 requirement raised; nobody could confirm.', counts: { decisions: 0, actions: 1, questions: 1 }, docs: [] }
      ]
    },
    {
      id: 'design-review', name: 'Design Review', color: 'var(--series-purple)', icon: 'eye', group: 'Team',
      cadence: 'Every 2 weeks', rule: 'Every other Thu · 15:00–16:00', source: 'calendar', calendar: 'Work',
      count: 14, since: 'Mar 2026', next: 'Thu 1 Oct', people: ['Aisha Bello', 'Maria Chen', 'Leo Duarte'],
      purpose: {
        version: 1, edited: 'Mar 4', by: 'Aisha Bello',
        why: 'Critique work in progress early enough that feedback can still change it.',
        outcomes: ['Each presenter leaves with the top three changes', 'Open design questions are named'],
        agenda: [{ t: 'Work in progress', d: '45 min' }, { t: 'Open questions', d: '15 min' }],
        notFor: 'Final sign-off.',
        history: [{ v: 1, date: 'Mar 4', note: 'Drafted from the calendar invite' }]
      },
      docs: [{ name: 'Onboarding flows.key', ver: 'v2', size: '18 MB', added: 'Sep 17', include: true }],
      memory: [{ type: 'decision', text: 'Onboarding step 3 gets a single primary action', status: 'current', from: 'Sep 17', src: 'Sep 17 · 14:02' }],
      meetings: [
        { id: 'dr-15', n: 15, date: 'Thu 1 Oct', time: '15:00–16:00', status: 'upcoming' },
        { id: 'dr-14', n: 14, date: 'Thu 17 Sep', time: '15:00–15:56', duration: '56 min', status: 'done', summary: 'Onboarding flows reviewed. Step 3 simplified to one primary action.', counts: { decisions: 1, actions: 2, questions: 1 }, docs: ['Onboarding flows.key'] }
      ]
    },
    {
      id: 'board', name: 'Board Prep', color: 'var(--series-teal)', icon: 'flag', group: 'Leadership',
      cadence: 'Monthly', rule: 'First Fri · 09:00–10:00', source: 'calendar', calendar: 'Work',
      count: 8, since: 'Feb 2026', next: 'Fri 2 Oct', people: ['Priya Nair', 'Maria Chen'],
      purpose: {
        version: 2, edited: 'Sep 4', by: 'Priya Nair',
        why: 'Agree the story and the numbers before they reach the board.',
        outcomes: ['One narrative, three metrics, no surprises'],
        agenda: [{ t: 'Metrics review', d: '20 min' }, { t: 'Narrative', d: '30 min' }, { t: 'Asks', d: '10 min' }],
        notFor: 'Team-level roadmap debates.',
        history: [{ v: 2, date: 'Sep 4', note: 'Tightened outcomes' }]
      },
      docs: [{ name: 'Board deck Q3.key', ver: 'v4', size: '32 MB', added: 'Sep 4', include: true }],
      memory: [{ type: 'commitment', text: 'Pull cohort retention by segment', owner: 'Priya Nair', status: 'open', from: 'Sep 4', src: 'Sep 4 · 38:20' }],
      meetings: [
        { id: 'bp-9', n: 9, date: 'Fri 2 Oct', time: '09:00–10:00', status: 'upcoming' },
        { id: 'bp-8', n: 8, date: 'Fri 4 Sep', time: '09:00–09:58', duration: '58 min', status: 'done', summary: 'Q3 narrative agreed. Retention by segment requested for the next deck.', counts: { decisions: 1, actions: 2, questions: 0 }, docs: ['Board deck Q3.key'] }
      ]
    },
    {
      id: 'hiring', name: 'Hiring · Staff Engineer', color: 'var(--series-pink)', icon: 'person', group: 'Other',
      cadence: 'Manual', rule: 'Grouped by you · no fixed time', source: 'manual',
      count: 5, since: 'Sep 2026', next: 'Wed 30 Sep 16:00', people: ['Leo Duarte', 'Jon Park'],
      purpose: {
        version: 1, edited: 'Sep 2', by: 'You',
        why: 'Run a consistent, fair loop for the Staff Engineer role — same questions, same bar, all notes in one place.',
        outcomes: ['A clear hire / no-hire signal per candidate', 'Evidence behind every signal'],
        agenda: [{ t: 'Intro', d: '5 min' }, { t: 'Deep dive: a system they built', d: '30 min' }, { t: 'Their questions', d: '15 min' }],
        notFor: 'Offer or compensation discussions.',
        history: [{ v: 1, date: 'Sep 2', note: 'Written by you' }]
      },
      docs: [{ name: 'Staff Eng scorecard.docx', ver: 'v2', size: '64 KB', added: 'Sep 2', include: true }],
      memory: [{ type: 'fact', text: 'Bar: owns a multi-team system end to end', status: 'current', from: 'Sep 2', src: 'Staff Eng scorecard.docx · §1' }],
      meetings: [
        { id: 'hi-6', n: 6, date: 'Wed 30 Sep', time: '16:00–17:00', title: 'Interview · K. Osei', status: 'upcoming' },
        { id: 'hi-5', n: 5, date: 'Mon 28 Sep', time: '11:00–11:58', title: 'Interview · R. Gomez', duration: '58 min', status: 'review', pending: 3, summary: 'Strong system-design depth; led a payments migration across four teams. Asked about relocation support.', counts: { decisions: 1, actions: 0, questions: 1 }, docs: ['Staff Eng scorecard.docx'] },
        { id: 'hi-4', n: 4, date: 'Thu 24 Sep', time: '16:00–16:55', title: 'Interview · M. Laurent', duration: '55 min', status: 'done', summary: 'Solid execution; limited cross-team scope. No-hire signal recorded.', counts: { decisions: 1, actions: 0, questions: 0 }, docs: [] }
      ]
    }
  ],

  days: [
    {
      key: 'mon', label: 'Yesterday', date: 'Mon 28 Sep', long: 'Monday, 28 September',
      events: [
        { id: 'm1', start: '09:00', end: '09:15', title: 'Daily Standup', calendar: 'Work', repeat: 'Daily', state: 'untracked' },
        { id: 'm2', start: '11:00', end: '12:00', title: 'Interview · R. Gomez', calendar: 'Work', series: 'hiring', meeting: 'hi-5', state: 'review', where: 'Room 2A' },
        { id: 'm3', start: '16:40', end: '16:48', title: 'Untitled recording', calendar: null, state: 'unfiled', unfiled: 'u-rec' }
      ]
    },
    {
      key: 'tue', label: 'Today', date: 'Tue 29 Sep', long: 'Tuesday, 29 September',
      events: [
        { id: 't1', start: '09:00', end: '09:15', title: 'Daily Standup', calendar: 'Work', repeat: 'Daily', state: 'untracked', past: true },
        { id: 't2', start: '10:00', end: '10:45', title: 'Product Sync', calendar: 'Work', repeat: 'Weekly', series: 'product-sync', meeting: 'ps-37', state: 'ready', where: 'Google Meet' },
        { id: 't3', start: '12:00', end: '12:45', title: 'Lunch', calendar: 'Personal', state: 'personal' },
        { id: 't4', start: '14:00', end: '14:30', title: '1:1 · Maria Chen', calendar: 'Work', repeat: 'Weekly', series: 'maria', meeting: 'mc-32', state: 'ready', where: 'Room 4B' },
        { id: 't5', start: '15:30', end: '16:30', title: 'Acme · Implementation', calendar: 'Work', repeat: 'Weekly', series: 'acme', meeting: 'ac-20', state: 'preparing', where: 'Zoom' },
        { id: 't6', start: '17:00', end: '17:30', title: 'Coffee with Alex Kim', calendar: 'Work', state: 'untracked', where: 'Blue Bottle', people: ['Alex Kim'] }
      ]
    },
    {
      key: 'wed', label: 'Tomorrow', date: 'Wed 30 Sep', long: 'Wednesday, 30 September',
      events: [
        { id: 'w1', start: '09:00', end: '09:15', title: 'Daily Standup', calendar: 'Work', repeat: 'Daily', state: 'untracked' },
        { id: 'w2', start: '13:00', end: '13:45', title: 'Acme · SSO deep-dive', calendar: 'Work', state: 'proposal', proposal: 'pr-acme-sso', where: 'Zoom' },
        { id: 'w3', start: '16:00', end: '17:00', title: 'Interview · K. Osei', calendar: 'Work', series: 'hiring', meeting: 'hi-6', state: 'ready', where: 'Room 2A' }
      ]
    }
  ],

  proposals: [
    { id: 'pr-growth', kind: 'new', title: 'Growth Review', rule: 'Every Thu · 11:00–11:45', calendar: 'Work', people: ['Priya Nair', 'Leo Duarte', 'Aisha Bello'], extra: 2, reason: 'New recurring event · created by Priya Nair yesterday', first: 'Thu 1 Oct' },
    { id: 'pr-acme-sso', kind: 'join', title: 'Acme · SSO deep-dive', when: 'Wed 30 Sep · 13:00', target: 'acme', reason: 'Same 3 attendees as Acme · Implementation' },
    { id: 'pr-standup', kind: 'new', title: 'Daily Standup', rule: 'Every weekday · 09:00–09:15', calendar: 'Work', people: ['Jon Park', 'Leo Duarte', 'Aisha Bello'], extra: 3, reason: 'You skipped it 3 times · short daily check-in', quiet: true }
  ],

  detected: [
    { series: 'product-sync', found: 36, on: true },
    { series: 'maria', found: 31, on: true },
    { series: 'acme', found: 19, on: true },
    { series: 'design-review', found: 14, on: true },
    { series: 'board', found: 8, on: true },
    { title: 'Daily Standup', rule: 'Every weekday · 09:00', found: 142, on: false, note: 'Short daily check-in' },
    { title: 'Lunch', rule: 'Every weekday · 12:00', found: 180, on: false, note: 'Personal calendar · ignored', ignored: true }
  ],

  unfiled: [
    { id: 'u-rec', kind: 'recording', title: 'Untitled recording', when: 'Mon 28 Sep · 16:40', duration: '8 min', suggestion: { series: 'acme', why: 'Mentions “Dana”, “SSO” and “audit logs”' } },
    { id: 'u-doc', kind: 'doc', title: 'Offsite notes.md', when: 'Sun 27 Sep', suggestion: { series: 'board', why: 'Mentions “Q4 plan” and “board deck”' } }
  ],

  review: [
    { id: 'k1', meeting: 'hi-5', type: 'decision', text: 'Move R. Gomez to the system-design round', ev: { t: '52:10', who: 'You', quote: 'I think we should move forward with the system design round.' } },
    { id: 'k2', meeting: 'hi-5', type: 'fact', text: 'Candidate is available from Nov 16', ev: { t: '55:02', who: 'R. Gomez', quote: 'My notice period ends mid-November, so the sixteenth works.' } },
    { id: 'k3', meeting: 'hi-5', type: 'question', text: 'Is relocation support in budget for this role?', ev: { t: '48:31', who: 'R. Gomez', quote: 'Would relocation be supported for this role?' } }
  ],

  afterMeeting: {
    meeting: 'ps-37', series: 'product-sync', duration: '44 min', ended: '10:44',
    summary: 'Rate-limit plan approved with per-workspace limits. SOC 2 Type I starts now and Acme’s go-live stays Nov 3. The activation dip traces back to onboarding step 3.',
    candidates: [
      { id: 'c1', type: 'decision', text: 'Adopt the token-bucket rate-limit plan, with per-workspace limits', ev: { t: '06:12', who: 'Maria Chen', quote: 'Let’s go with token bucket — but per workspace, not per user.' } },
      { id: 'c2', type: 'decision', text: 'Start SOC 2 Type I now; Acme go-live stays Nov 3', resolves: 'Do we need SOC 2 Type I before the Acme rollout?', ev: { t: '21:40', who: 'Priya Nair', quote: 'We start Type one now, and Acme doesn’t move.' } },
      { id: 'c3', type: 'commitment', text: 'Fix the onboarding step 3 copy', owner: 'Aisha Bello', due: 'Fri 2 Oct', ev: { t: '30:05', who: 'Aisha Bello', quote: 'I’ll own the step three copy, done by Friday.' } },
      { id: 'c4', type: 'commitment', text: 'Send the SOC 2 auditor shortlist', owner: 'Priya Nair', due: 'Thu 1 Oct', ev: { t: '23:15', who: 'Priya Nair', quote: 'I’ll send a shortlist of auditors by Thursday.' } },
      { id: 'c5', type: 'fact', text: 'Activation fell to 39% after the Sep 21 release', ev: { t: '27:18', who: 'Leo Duarte', quote: 'Activation is at thirty-nine since the twenty-first release.' } }
    ]
  },

  live: {
    meeting: 'ps-37', elapsed: 724,
    transcript: [
      { who: 'Jon Park', text: 'So the plan is token bucket, and we can ship it behind the flag next sprint.' },
      { who: 'Maria Chen', text: 'Does this change anything for the Acme rollout?' }
    ],
    suggestion: { text: 'Acme goes live Nov 3 and the SOC 2 question is still open — worth deciding now?', sources: ['Sep 15 · 31:10', 'Q4 Roadmap.pdf · p.7'] }
  }
};
