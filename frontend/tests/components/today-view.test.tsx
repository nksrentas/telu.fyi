import { afterAll, beforeAll, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import type { ReactElement } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import type { AgendaMeeting } from '../../src/lib/agenda-service';
import type { FinalizationProgressSnapshot } from '../../src/services/transcriptService';

type EventHandler = (event: { event: string; id: number; payload: unknown }) => void;
type Responder = (args: Record<string, unknown>) => unknown;
type TestGlobals = typeof globalThis & { window?: Record<string, unknown>; document?: Record<string, unknown> };

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
mock.module('@tauri-apps/api/core', () => ({ ...originalCore, invoke: ipc }));
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

beforeAll(() => {
  process.env.TZ = 'UTC';
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
  };
  globals.document = { activeElement: null, body: {}, documentElement: {} };
});

afterAll(async () => {
  unmount();
  await new Promise((resolve) => setTimeout(resolve, 0));
  process.env.TZ = originalTimeZone;
  globals.window = originalWindow;
  globals.document = originalDocument;
  mock.module('@tauri-apps/api/core', () => originalCore);
  mock.module('next/navigation', () => originalNavigation);
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
const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
const options = () => root().findAll((node) => node.type === 'div' && node.props.role === 'option');
const dayCalls = () => ipc.mock.calls.filter(([command]) => command === 'agenda_list_day');
const hasClass = (node: ReactTestInstance, name: string) => String(node.props.className ?? '').split(/\s+/).includes(name);

async function renderElement(element: ReactElement) {
  unmount();
  await act(async () => {
    renderer = create(element, {
      createNodeMock: (node) => (node.type === 'div' ? { animate, contains: () => false, focus: () => {} } : null),
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

beforeEach(() => {
  ipc.mockClear();
  push.mockClear();
  animate.mockClear();
  responses = {};
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
    expect(push).toHaveBeenCalledWith('/meeting-details?id=meeting-a&from=Today');

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
