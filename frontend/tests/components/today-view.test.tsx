import { afterAll, beforeAll, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import { cloneElement, createContext, useContext, type ReactElement, type ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import type { AgendaMeeting } from '../../src/lib/agenda-service';
import type { FinalizationProgressSnapshot } from '../../src/services/transcriptService';

type EventHandler = (event: { event: string; id: number; payload: unknown }) => void;
type Responder = (args: Record<string, unknown>) => unknown;
type TestGlobals = typeof globalThis & {
  window?: Record<string, unknown>;
  document?: Record<string, unknown>;
  requestAnimationFrame?: (callback: (time: number) => void) => unknown;
  cancelAnimationFrame?: (handle: unknown) => void;
  getComputedStyle?: (node: unknown) => unknown;
  ResizeObserver?: unknown;
};

const globals = globalThis as TestGlobals;
const originalWindow = globals.window;
const originalDocument = globals.document;
const originalTimeZone = process.env.TZ;
const windowEvents = new EventTarget();
const callbacks = new Map<number, EventHandler>();
let nextId = 1;
let responses: Record<string, Responder> = {};
let recording = { status: 'idle', activeDuration: null as number | null, recordingDuration: null as number | null };
const push = mock((_href: string) => {});
const search = { searchTranscripts: mock(async (_query: string) => {}), searchResults: [] as Array<{ id: string; title: string; matchContext: string }>, isSearching: false };
const PopoverState = createContext<{ open: boolean; setOpen: (open: boolean) => void }>({ open: false, setOpen: () => {} });
const animate = mock((_frames: unknown, _options: unknown) => ({ cancel: () => {} }));

const ipc = mock(async (command: string, args: Record<string, unknown> = {}): Promise<unknown> => {
  if (command === 'plugin:event|listen') return nextId++;
  if (command === 'plugin:event|unlisten') return null;
  const respond = responses[command];
  if (!respond) throw new Error(`Unexpected command: ${command}`);
  return respond(args);
});

const originalCore = { ...await import('@tauri-apps/api/core') };
const originalNavigation = { ...await import('next/navigation') };
const originalRecordingState = { ...await import('../../src/contexts/RecordingStateContext') };
const originalSidebar = { ...await import('../../src/components/Sidebar/SidebarProvider') };
const originalPopover = { ...await import('../../src/components/ui/popover') };
const originalContextMenu = { ...await import('../../src/components/ui/context-menu') };
const originalRadix = { ...await import('radix-ui') };
const originalPageContent = { ...await import('../../src/app/meeting-details/page-content') };
const { useEvidenceNavigation } = await import('../../src/components/living-doc/meeting-page');
mock.module('@tauri-apps/api/core', () => ({ ...originalCore, invoke: ipc }));
mock.module('../../src/components/Sidebar/SidebarProvider', () => ({ ...originalSidebar, useSidebar: () => search }));
mock.module('../../src/components/ui/popover', () => ({
  Popover: ({ children, open, onOpenChange }: { children: ReactNode; open?: boolean; onOpenChange?: (open: boolean) => void }) => (
    <PopoverState.Provider value={{ open: Boolean(open), setOpen: (next) => onOpenChange?.(next) }}>{children}</PopoverState.Provider>
  ),
  PopoverTrigger: ({ children }: { children: ReactElement<{ onClick?: (event: unknown) => void }> }) => {
    const state = useContext(PopoverState);
    return cloneElement(children, { onClick: (event: unknown) => { children.props.onClick?.(event); state.setOpen(!state.open); } });
  },
  PopoverAnchor: ({ children }: { children: ReactNode }) => <>{children}</>,
  PopoverArrow: () => null,
  PopoverContent: ({ children }: { children: ReactNode }) => (useContext(PopoverState).open ? <div data-popover="">{children}</div> : null),
}));
mock.module('../../src/components/ui/context-menu', () => ({
  ContextMenu: ({ children }: { children: ReactNode }) => <>{children}</>,
  ContextMenuTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  ContextMenuContent: ({ children }: { children: ReactNode }) => <div data-context-menu="">{children}</div>,
  ContextMenuSeparator: () => <hr />,
  ContextMenuShortcut: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  ContextMenuItem: ({ children, onSelect, disabled, variant }: { children: ReactNode; onSelect?: () => void; disabled?: boolean; variant?: string }) => (
    <button type="button" data-menu-item="" data-variant={variant} disabled={disabled} onClick={() => onSelect?.()}>{children}</button>
  ),
}));
mock.module('radix-ui', () => ({
  ...originalRadix,
  AlertDialog: {
    Root: ({ open, children }: { open: boolean; children?: ReactNode }) => (open ? <>{children}</> : null),
    Portal: ({ children }: { children?: ReactNode }) => <>{children}</>,
    Overlay: () => null,
    Content: ({ children }: { children?: ReactNode }) => <div role="alertdialog">{children}</div>,
    Title: ({ children }: { children?: ReactNode }) => <h2>{children}</h2>,
    Description: ({ children }: { children?: ReactNode }) => <>{children}</>,
    Cancel: ({ children }: { children?: ReactNode }) => <>{children}</>,
  },
}));
function PageContentStub({ meeting, surface }: { meeting: { id: string; title: string }; surface: string }) {
  const navigation = useEvidenceNavigation();
  const link = { linkId: 'link-1', evidenceId: 'evidence-2', role: 'claim', quoteText: 'ship the beta', rawStart: 3, rawEnd: 16, sequence: 1, audioStartTime: 5, audioEndTime: 9, segmentCaptureIncomplete: false };
  return (
    <div data-page-content={surface} data-meeting={meeting.id}>
      {meeting.title}
      <button type="button" onClick={() => navigation.openEvidence([link as never])}>Open transcript</button>
    </div>
  );
}
mock.module('../../src/app/meeting-details/page-content', () => ({ ...originalPageContent, default: PageContentStub }));
mock.module('next/navigation', () => ({ ...originalNavigation, useRouter: () => ({ push }) }));
mock.module('../../src/contexts/RecordingStateContext', () => ({
  ...originalRecordingState,
  useRecordingState: () => recording,
}));

const { toast } = await import('sonner');
const { localDayBounds } = await import('../../src/lib/agenda-service');
const { EventCard } = await import('../../src/components/agenda/event-card');
const { TodayView } = await import('../../src/components/agenda/today-view');
const { DayStepper, dayHeading } = await import('../../src/components/app-shell/agenda-toolbar');
const { TooltipProvider } = await import('../../src/components/ui/tooltip');

beforeAll(() => {
  process.env.TZ = 'UTC';
  globals.requestAnimationFrame = (callback) => setTimeout(() => callback(Date.now()), 0);
  globals.cancelAnimationFrame = (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>);
  globals.getComputedStyle = () => ({ animationName: 'none', display: 'block' });
  globals.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  globals.window = {
    __TAURI_INTERNALS__: {
      invoke: ipc,
      transformCallback: (callback: EventHandler) => {
        const id = nextId++;
        callbacks.set(id, callback);
        return id;
      },
      unregisterCallback: (id: number) => callbacks.delete(id),
    },
    __TAURI_EVENT_PLUGIN_INTERNALS__: { unregisterListener: () => {} },
    addEventListener: windowEvents.addEventListener.bind(windowEvents),
    removeEventListener: windowEvents.removeEventListener.bind(windowEvents),
    dispatchEvent: windowEvents.dispatchEvent.bind(windowEvents),
    matchMedia: () => ({ matches: false }),
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
    location: { href: 'http://localhost/', origin: 'http://localhost', hash: '' },
  };
  globals.document = {
    activeElement: { hasAttribute: () => false, getAttribute: () => null },
    body: {},
    documentElement: {},
    querySelector: () => null,
    addEventListener: () => {},
    removeEventListener: () => {},
  };
});

afterAll(async () => {
  unmount();
  await new Promise((resolve) => setTimeout(resolve, 0));
  process.env.TZ = originalTimeZone;
  globals.window = originalWindow;
  globals.document = originalDocument;
  mock.module('@tauri-apps/api/core', () => originalCore);
  mock.module('next/navigation', () => originalNavigation);
  mock.module('../../src/components/Sidebar/SidebarProvider', () => originalSidebar);
  mock.module('../../src/components/ui/popover', () => originalPopover);
  mock.module('../../src/components/ui/context-menu', () => originalContextMenu);
  mock.module('radix-ui', () => originalRadix);
  mock.module('../../src/app/meeting-details/page-content', () => originalPageContent);
  mock.module('../../src/contexts/RecordingStateContext', () => originalRecordingState);
});

const meeting = (overrides: Partial<AgendaMeeting> = {}): AgendaMeeting => ({
  id: 'meeting-a',
  title: 'Weekly product sync',
  startedAtUtc: '2026-09-27T10:02:00Z',
  endedAtUtc: '2026-09-27T10:46:00Z',
  lifecycle: 'complete',
  completeness: 'complete',
  gapCount: 0,
  evidenceCount: 12,
  legacyTranscriptCount: 0,
  pendingCount: 3,
  acceptedCount: 2,
  rejectedCount: 0,
  latestRunStatus: 'succeeded',
  cardState: 'to_review',
  ...overrides,
});

let renderer: ReactTestRenderer | undefined;
const unmount = () => {
  act(() => renderer?.unmount());
  renderer = undefined;
};
const root = () => renderer!.root;
const textOf = (node: ReactTestInstance): string =>
  node.children.map((child) => (typeof child === 'string' ? child : textOf(child))).join('');
const settle = (ms = 0) => act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)); });
const options = () => root().findAll((node) => node.type === 'div' && node.props.role === 'option');
const dayCalls = () => ipc.mock.calls.filter(([command]) => command === 'agenda_list_day');
const hasClass = (node: ReactTestInstance, name: string) => String(node.props.className ?? '').split(/\s+/).includes(name);

async function renderElement(element: ReactElement) {
  unmount();
  await act(async () => {
    renderer = create(<TooltipProvider>{element}</TooltipProvider>, {
      createNodeMock: (node) => (node.type === 'div' ? { animate, contains: () => false, focus: () => {}, querySelector: () => null, querySelectorAll: () => [], setAttribute: () => {}, getAttribute: () => null, addEventListener: () => {}, removeEventListener: () => {} } : null),
    });
  });
  await settle();
}

const renderCard = (value: AgendaMeeting, extra: Partial<Parameters<typeof EventCard>[0]> = {}) =>
  renderElement(<EventCard meeting={value} selected={false} onOpen={() => {}} {...extra} />);

async function press(key: string) {
  const event = Object.assign(new Event('keydown', { cancelable: true }), { key, metaKey: false, ctrlKey: false, altKey: false });
  await act(async () => { windowEvents.dispatchEvent(event); });
  await settle();
}

const PEEK_RESPONSES: Record<string, Responder> = {
  api_get_meeting_metadata: (args) => ({ id: args.meetingId, title: 'Meeting', created_at: '2026-09-27T09:00:00Z', updated_at: '2026-09-27T09:15:00Z', lifecycle: 'complete', completeness: 'complete', gap_count: 0, gaps: [] }),
  api_get_meeting_transcripts: () => ({ transcripts: [], total_count: 0, has_more: false }),
  api_get_summary: (args) => ({ status: 'idle', meeting_id: args.meetingId, data: null }),
  knowledge_list_evidence: () => [],
  planning_list_upcoming: () => [],
};

beforeEach(() => {
  ipc.mockClear();
  push.mockClear();
  animate.mockClear();
  responses = { ...PEEK_RESPONSES };
  recording = { status: 'idle', activeDuration: null, recordingDuration: null };
});

describe('EventCard', () => {
  test('renders each Rust card state with its chip and meta', async () => {
    await renderCard(meeting());
    expect(textOf(root())).toContain('3 to review');
    expect(textOf(root())).toContain('Ended 10:46·44 min');
    await renderCard(meeting({ pendingCount: 1 }));
    expect(textOf(root())).toContain('1 to review');

    await renderCard(meeting({ cardState: 'reviewed' }));
    expect(textOf(root())).toContain('Reviewed');
    expect(textOf(root())).toContain('2 accepted');
    expect(root().findAll((node) => node.type === 'div' && hasClass(node, 'opacity-[0.55]'))).toHaveLength(1);

    await renderCard(meeting({ cardState: 'transcript_only' }));
    expect(textOf(root())).toContain('Transcript only');

    await renderCard(meeting({ cardState: 'incomplete', lifecycle: 'incomplete', completeness: 'incomplete', gapCount: 2 }));
    expect(textOf(root())).toContain('Incomplete · 2 gaps');
    await renderCard(meeting({ cardState: 'incomplete', lifecycle: 'recovered', completeness: 'recovered_with_gaps', gapCount: 1 }));
    expect(textOf(root())).toContain('Recovered with gaps · 1 gap');
  });

  test('recording and finalizing cards read the live timer and the Rust queue snapshot', async () => {
    await renderCard(meeting({ cardState: 'recording', endedAtUtc: null }), { recordingSeconds: 754 });
    expect(root().findAll((node) => node.props['data-slot'] === 'rec-dot')).toHaveLength(1);
    expect(textOf(root())).toContain('Recording12:34');
    expect(textOf(root())).toContain('Started 10:02');

    const snapshot = {
      meeting_id: 'meeting-a',
      lifecycle: 'finalizing',
      queue: { capacity: 8, depth: 3, active: 1, oldest_age_ms: 12_000, accepted: 9, started: 7, completed: 6, failed: 0, cancelled: 0, superseded: 0 },
      deadline_at_utc: '2026-09-27T10:50:00Z',
      deadline_ms: 120_000,
    } as FinalizationProgressSnapshot;
    await renderCard(meeting({ cardState: 'finalizing', endedAtUtc: null }), { finalization: snapshot });
    const status = root().find((node) => node.props.role === 'status');
    expect(textOf(status)).toBe('3 items remaining · oldest waiting 12s');
    expect(textOf(root())).toContain('Finalizing…');
  });

  test('long titles truncate on one line and chips never shrink', async () => {
    const title = 'A very long meeting title that keeps going past the card edge to test single line truncation ok';
    await renderCard(meeting({ title }));
    const titleNode = root().find((node) => node.type === 'span' && textOf(node) === title);
    expect(hasClass(titleNode, 'truncate')).toBe(true);
    const chip = root().find((node) => node.props['data-slot'] === 'chip');
    expect(hasClass(chip, 'shrink-0')).toBe(true);
  });
});

describe('AgendaToolbar', () => {
  test('names the day and disables the next day on today', async () => {
    const now = new Date(2026, 8, 27, 15, 0);
    expect(dayHeading(new Date(2026, 8, 27), now)).toEqual({ title: 'Today', subtitle: 'Sunday, 27 September' });
    expect(dayHeading(new Date(2026, 8, 26), now)).toEqual({ title: 'Yesterday', subtitle: 'Saturday, 26 September' });
    expect(dayHeading(new Date(2026, 8, 24), now)).toEqual({ title: 'Thursday', subtitle: '24 September 2026' });

    await renderElement(<DayStepper isToday onStep={() => {}} onToday={() => {}} />);
    const previous = root().find((node) => node.type === 'button' && node.props['aria-label'] === 'Previous day');
    const next = root().find((node) => node.type === 'button' && node.props['aria-label'] === 'Next day');
    expect(previous.props.disabled).toBeFalsy();
    expect(next.props.disabled).toBe(true);
  });
});

describe('TodayView', () => {
  const later = meeting({ id: 'meeting-b', title: 'Design review', startedAtUtc: '2026-09-27T14:00:00Z', endedAtUtc: '2026-09-27T14:30:00Z' });
  const earlier = meeting({ id: 'meeting-a', title: 'Standup', startedAtUtc: '2026-09-27T09:00:00Z', endedAtUtc: '2026-09-27T09:15:00Z' });

  test("requests today's local bounds and lists meetings in start order inside a listbox", async () => {
    responses.agenda_list_day = () => [later, earlier];
    await renderElement(<TodayView />);
    expect(dayCalls()[0]?.[1]).toEqual(localDayBounds(new Date()));
    expect(root().findAll((node) => node.props.role === 'listbox')).toHaveLength(1);
    expect(options().map((node) => node.props['data-card-state'] && textOf(node))).toEqual([
      expect.stringContaining('Standup'),
      expect.stringContaining('Design review'),
    ]);
    expect(root().findAll((node) => hasClass(node, 'grid-cols-[44px_minmax(0,1fr)]'))).toHaveLength(2);
  });

  test('empty days read the Today and past-day copy', async () => {
    responses.agenda_list_day = () => [];
    await renderElement(<TodayView />);
    expect(textOf(root())).toContain('No meetings recorded today');
    expect(textOf(root())).toContain('Press Record or ⌘R to start one. Recordings stay on this Mac.');

    await press('ArrowLeft');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const weekday = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][yesterday.getDay()];
    expect(textOf(root())).toContain(`No meetings recorded on ${weekday}`);
  });

  test('first load shows skeletons; a failed reload toasts Try again and keeps the cards', async () => {
    responses.agenda_list_day = () => new Promise(() => {});
    await renderElement(<TodayView />);
    expect(root().findAll((node) => node.props['aria-busy'] === true)).toHaveLength(1);

    responses.agenda_list_day = () => [earlier];
    await renderElement(<TodayView />);
    const error = spyOn(toast, 'error');
    const log = console.error;
    console.error = () => {};
    responses.agenda_list_day = () => { throw 'database locked'; };
    await act(async () => { windowEvents.dispatchEvent(new Event('telu:meetings-changed')); });
    await settle();
    console.error = log;
    expect(error.mock.calls[0]?.[0]).toBe("Couldn't load today's meetings.");
    expect((error.mock.calls[0]?.[1] as { action: { label: string } }).action.label).toBe('Try again');
    expect(options()).toHaveLength(1);
    error.mockRestore();
  });

  test('keyboard steps days instantly, moves selection and opens; meeting changes reload the day', async () => {
    responses.agenda_list_day = () => [earlier, later];
    await renderElement(<TodayView />);

    await press('ArrowDown');
    expect(options().map((node) => node.props['aria-selected'])).toEqual([true, false]);
    await press('ArrowDown');
    expect(options().map((node) => node.props['aria-selected'])).toEqual([false, true]);
    await press('ArrowUp');
    expect(options().map((node) => node.props['aria-selected'])).toEqual([true, false]);

    await press('Enter');
    expect(push).not.toHaveBeenCalled();
    expect(root().findAll((node) => node.props['aria-label'] === 'Side peek' && typeof node.type === 'string')).toHaveLength(1);
    await press('Escape');
    await settle(20);

    const calls = dayCalls().length;
    await act(async () => { windowEvents.dispatchEvent(new Event('telu:meetings-changed')); });
    await settle();
    expect(dayCalls().length).toBe(calls + 1);

    await press('ArrowLeft');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(dayCalls().at(-1)?.[1]).toEqual(localDayBounds(yesterday));
    expect(animate).not.toHaveBeenCalled();
  });

  test('Find knowledge opens the meeting at its Knowledge section', async () => {
    responses.agenda_list_day = () => [meeting({ cardState: 'no_knowledge' })];
    await renderElement(<TodayView />);
    const find = root().find((node) => node.type === 'button' && textOf(node) === 'Find knowledge');
    await act(async () => find.props.onClick({ stopPropagation: () => {} }));
    expect(push).toHaveBeenCalledWith('/meeting-details?id=meeting-a&from=Today#knowledge');
  });
});

describe('Planned meetings on Today', () => {
  const planned = (id: string, title: string, startUtc: string | null) => ({ id, title, startUtc, purpose: '', createdUtc: '2026-10-24T08:00:00.000Z', updatedUtc: '2026-10-24T08:00:00.000Z' });
  const button = (label: string) => root().find((node) => node.type === 'button' && textOf(node) === label);

  beforeEach(() => {
    responses.agenda_list_day = () => [];
  });

  test('upcoming planned meetings are listed from the start of the local day and open their page', async () => {
    responses.planning_list_upcoming = () => [planned('plan-a', 'Roadmap sync', '2026-10-27T10:00:00.000Z'), planned('plan-b', 'Hiring loop', null)];
    await renderElement(<TodayView />);
    expect(ipc).toHaveBeenCalledWith('planning_list_upcoming', { todayStartUtc: localDayBounds(new Date()).fromUtc });
    const section = root().find((node) => node.type === 'section' && node.props['aria-labelledby'] === 'planned-heading');
    expect(textOf(section)).toContain('Roadmap syncTue 27 Oct · 10:00');
    expect(textOf(section)).toContain('Hiring loopNo date yet');
    await act(async () => button('Hiring loopNo date yet').props.onClick());
    expect(push).toHaveBeenCalledWith('/preparation?id=plan-b');
  });

  test('a saved planned meeting refreshes the list', async () => {
    await renderElement(<TodayView />);
    responses.planning_list_upcoming = () => [planned('plan-a', 'Renamed sync', null)];
    await act(async () => { windowEvents.dispatchEvent(new Event('telu:planned-meetings-changed')); });
    await settle();
    expect(textOf(root())).toContain('Renamed syncNo date yet');
  });

  test('Plan a meeting creates a planned meeting and opens its preparation page', async () => {
    responses.planning_create = (args) => planned('plan-new', String(args.title), null);
    await renderElement(<TodayView />);
    expect(root().findAll((node) => node.type === 'section' && node.props['aria-labelledby'] === 'planned-heading')).toHaveLength(0);
    await act(async () => button('Plan a meeting').props.onClick());
    await settle();
    expect(ipc).toHaveBeenCalledWith('planning_create', { title: 'New meeting', startUtc: null, purpose: '' });
    expect(push).toHaveBeenCalledWith('/preparation?id=plan-new');
  });

  test('a failed create shows an error toast and stays on Today', async () => {
    const error = spyOn(toast, 'error');
    responses.planning_create = () => {
      throw 'PLANNED_MEETING_STORAGE_FAILED';
    };
    await renderElement(<TodayView />);
    await act(async () => button('Plan a meeting').props.onClick());
    await settle();
    expect(error).toHaveBeenCalledWith("Couldn't plan a meeting.");
    expect(push).not.toHaveBeenCalled();
    expect(button('Plan a meeting').props.disabled).toBe(false);
    error.mockRestore();
  });
});

describe('Side peek, search and card menu', () => {
  const first = meeting({ id: 'meeting-a', title: 'Standup', startedAtUtc: '2026-09-27T09:00:00Z', endedAtUtc: '2026-09-27T09:15:00Z' });
  const second = meeting({ id: 'meeting-b', title: 'Design review', startedAtUtc: '2026-09-27T14:00:00Z', endedAtUtc: '2026-09-27T14:30:00Z' });
  const peek = () => root().findAll((node) => node.type === 'aside' && node.props['aria-label'] === 'Side peek');
  const peekMeeting = () => root().findAll((node) => node.props['data-page-content'] === 'peek').map((node) => node.props['data-meeting']);
  const menuItem = (label: string) => root().findAll((node) => node.props['data-menu-item'] === '' && textOf(node).startsWith(label));

  async function pressMeta(key: string) {
    const event = Object.assign(new Event('keydown', { cancelable: true }), { key, metaKey: true, ctrlKey: false, altKey: false, shiftKey: false });
    await act(async () => { windowEvents.dispatchEvent(event); });
    await settle();
  }

  beforeEach(() => {
    search.searchTranscripts.mockClear();
    search.searchResults = [];
    search.isSearching = false;
    responses.agenda_list_day = () => [first, second];
    responses.api_get_meeting_metadata = (args) => ({
      id: args.meetingId,
      title: args.meetingId === 'meeting-a' ? 'Standup' : 'Design review',
      created_at: '2026-09-27T09:00:00Z',
      updated_at: '2026-09-27T09:15:00Z',
      lifecycle: 'complete',
      completeness: 'complete',
      gap_count: 0,
      gaps: [],
    });
    responses.api_get_meeting_transcripts = () => ({ transcripts: [], total_count: 0, has_more: false });
    responses.api_get_summary = (args) => ({ status: 'idle', meeting_id: args.meetingId, data: null });
    responses.knowledge_list_evidence = () => [
      { evidenceId: 'evidence-1', sequence: 0, text: 'Morning everyone', audioStartTime: 1, audioEndTime: 4, captureCompleteness: 'complete' },
      { evidenceId: 'evidence-2', sequence: 1, text: 'We ship the beta on Friday', audioStartTime: 5, audioEndTime: 9, captureCompleteness: 'complete' },
    ];
  });

  test('a card click opens the peek on that meeting; ↑ swaps it and Esc closes it', async () => {
    await renderElement(<TodayView />);
    await act(async () => options()[1].props.onClick());
    await settle(30);
    expect(peek()).toHaveLength(1);
    expect(peekMeeting()).toEqual(['meeting-b']);
    expect(push).not.toHaveBeenCalled();

    await press('ArrowUp');
    await settle(30);
    expect(peekMeeting()).toEqual(['meeting-a']);

    await press('Escape');
    await settle(20);
    expect(peek()).toHaveLength(0);
  });

  test('Open as page keeps the Today origin', async () => {
    await renderElement(<TodayView />);
    await act(async () => options()[1].props.onClick());
    await settle(10);
    const openPage = peek()[0].find((node) => node.type === 'button' && textOf(node) === 'Open as page');
    await act(async () => openPage.props.onClick());
    expect(push).toHaveBeenCalledWith('/meeting-details?id=meeting-b&from=Today');
  });

  test('Open transcript in the peek expands the inline transcript on the cited line, not the page drawer', async () => {
    await renderElement(<TodayView />);
    await act(async () => options()[0].props.onClick());
    await settle(10);
    const openTranscript = root().find((node) => node.type === 'button' && textOf(node) === 'Open transcript');
    await act(async () => openTranscript.props.onClick());
    await settle(10);
    const cited = root().findAll((node) => node.type === 'li' && node.props['data-cited'] === true);
    expect(cited.map((node) => node.props['data-line'])).toEqual(['evidence-2']);
    expect(root().findAllByType('mark').map(textOf)).toEqual(['ship the beta']);
    expect(root().findAll((node) => node.props.role === 'complementary')).toHaveLength(0);
  });

  test('⌘F opens search with the hint, debounces the query and renders results as text', async () => {
    await renderElement(<TodayView />);
    await pressMeta('f');
    const input = () => root().find((node) => node.type === 'input' && node.props.placeholder === 'Search meetings and transcripts');
    expect(input()).toBeDefined();
    expect(textOf(root())).toContain('Type to search meetings and transcripts');

    await act(async () => input().props.onChange({ target: { value: 'beta' } }));
    expect(search.searchTranscripts).not.toHaveBeenCalled();
    await settle(230);
    expect(search.searchTranscripts.mock.calls).toEqual([['beta']]);
    expect(textOf(root())).toContain('No matches for "beta"');

    search.searchResults = [{ id: 'meeting-b', title: 'Design review', matchContext: '…<b>ship</b> the beta…' }];
    await renderElement(<TodayView />);
    await pressMeta('f');
    await act(async () => input().props.onChange({ target: { value: 'beta' } }));
    expect(textOf(root())).toContain('…<b>ship</b> the beta…');
    expect(root().findAll((node) => node.type === 'b')).toHaveLength(0);
  });

  test('the card menu offers peek, page and a guarded delete; stop only while recording', async () => {
    responses.agenda_list_day = () => [
      first,
      meeting({ id: 'meeting-live', title: 'Live sync', cardState: 'recording', lifecycle: 'recording', endedAtUtc: null, startedAtUtc: '2026-09-27T15:00:00Z' }),
    ];
    responses.knowledge_deletion_impact = () => ({ accepted: 1, suggestions: 2, rejected: 0, runs: 1 });
    await renderElement(<TodayView />);
    expect(menuItem('Open in side peek')).toHaveLength(2);
    expect(menuItem('Open as page')).toHaveLength(2);
    expect(menuItem('Stop recording')).toHaveLength(1);
    const deletes = menuItem('Delete meeting…');
    expect(deletes.map((node) => node.props.disabled)).toEqual([false, true]);
    expect(deletes[0].props['data-variant']).toBe('danger');

    await act(async () => deletes[0].props.onClick());
    await settle();
    expect(root().findAll((node) => node.props.role === 'alertdialog')).toHaveLength(1);
    expect(ipc.mock.calls.some(([command]) => command === 'knowledge_deletion_impact')).toBe(true);
  });
});
