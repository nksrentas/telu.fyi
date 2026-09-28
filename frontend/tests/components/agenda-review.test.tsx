import { afterAll, beforeAll, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import type { ReactElement } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import type { AgendaMeeting } from '../../src/lib/agenda-service';

type EventHandler = (event: { event: string; id: number; payload: unknown }) => void;
type Responder = (args: Record<string, unknown>) => unknown;
type TestGlobals = typeof globalThis & { window?: Record<string, unknown>; document?: Record<string, unknown> };

const globals = globalThis as TestGlobals;
const original = { window: globals.window, document: globals.document, tz: process.env.TZ };
const windowEvents = new EventTarget();
const callbacks = new Map<number, EventHandler>();
const listeners = new Map<string, number[]>();
let nextId = 1;
let responses: Record<string, Responder> = {};
let pathname = '/review';
const push = mock((_href: string) => {});

const ipc = mock(async (command: string, args: Record<string, unknown> = {}): Promise<unknown> => {
  if (command === 'plugin:event|listen') {
    listeners.set(String(args.event), [...(listeners.get(String(args.event)) ?? []), Number(args.handler)]);
    return nextId++;
  }
  if (command === 'plugin:event|unlisten') return null;
  const respond = responses[command];
  if (!respond) throw new Error(`Unexpected command: ${command}`);
  return respond(args);
});

const originals = {
  core: { ...await import('@tauri-apps/api/core') },
  navigation: { ...await import('next/navigation') },
  recordingState: { ...await import('../../src/contexts/RecordingStateContext') },
  config: { ...await import('../../src/contexts/ConfigContext') },
  importDialog: { ...await import('../../src/contexts/ImportDialogContext') },
};
mock.module('@tauri-apps/api/core', () => ({ ...originals.core, invoke: ipc }));
mock.module('next/navigation', () => ({ ...originals.navigation, useRouter: () => ({ push }), usePathname: () => pathname }));
mock.module('../../src/contexts/RecordingStateContext', () => ({
  ...originals.recordingState,
  useRecordingState: () => ({ status: 'idle', activeDuration: null, recordingDuration: null }),
}));
mock.module('../../src/contexts/ConfigContext', () => ({ ...originals.config, useConfig: () => ({ betaFeatures: { importAndRetranscribe: false } }) }));
mock.module('../../src/contexts/ImportDialogContext', () => ({ ...originals.importDialog, useImportDialog: () => ({ openImportDialog: () => {} }) }));

const { toast } = await import('sonner');
const { ReviewView } = await import('../../src/components/agenda/review-view');
const { Sidebar } = await import('../../src/components/app-shell/sidebar');

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
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
  };
  globals.document = { activeElement: null, body: {}, documentElement: {} };
});

afterAll(async () => {
  unmount();
  await new Promise((resolve) => setTimeout(resolve, 0));
  process.env.TZ = original.tz;
  globals.window = original.window;
  globals.document = original.document;
  mock.module('@tauri-apps/api/core', () => originals.core);
  mock.module('next/navigation', () => originals.navigation);
  mock.module('../../src/contexts/RecordingStateContext', () => originals.recordingState);
  mock.module('../../src/contexts/ConfigContext', () => originals.config);
  mock.module('../../src/contexts/ImportDialogContext', () => originals.importDialog);
});

const meeting = (id: string, pendingCount: number, startedAtUtc: string, overrides: Partial<AgendaMeeting> = {}): AgendaMeeting => ({
  id,
  title: `Meeting ${id}`,
  startedAtUtc,
  endedAtUtc: startedAtUtc.replace('T10', 'T11'),
  lifecycle: 'complete',
  completeness: 'complete',
  gapCount: 0,
  evidenceCount: 10,
  legacyTranscriptCount: 0,
  pendingCount,
  acceptedCount: 0,
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

async function render(element: ReactElement) {
  unmount();
  await act(async () => { renderer = create(element); });
  await settle();
}

async function emit(event: string, payload: unknown) {
  await act(async () => {
    (listeners.get(event) ?? []).forEach((id) => callbacks.get(id)?.({ event, id, payload }));
  });
  await settle();
}

async function press(key: string) {
  const event = Object.assign(new Event('keydown', { cancelable: true }), { key, metaKey: false, ctrlKey: false, altKey: false });
  await act(async () => { windowEvents.dispatchEvent(event); });
  await settle();
}

const today = new Date().toISOString().slice(0, 10);
const reviewList = () => [
  meeting('a', 3, `${today}T10:00:00Z`),
  meeting('b', 1, '2026-09-24T10:00:00Z'),
  meeting('c', 1, '2026-08-02T10:00:00Z'),
];

beforeEach(() => {
  ipc.mockClear();
  push.mockClear();
  listeners.clear();
  pathname = '/review';
  responses = {};
});

describe('ReviewView', () => {
  test('lists meetings with pending candidates under To review with day labels and the item count', async () => {
    responses.agenda_list_review = () => reviewList();
    await render(<ReviewView />);
    expect(root().findAll((node) => node.type === 'h2' && textOf(node) === 'To review')).toHaveLength(1);
    expect(options()).toHaveLength(3);
    expect(textOf(root())).toContain('5 items need a look');
    expect(textOf(root())).toContain('5 items · accept, correct or reject what Telu found');
    expect(textOf(root())).toContain('Today');
    expect(textOf(root())).toContain('Aug 2');
    expect(textOf(root())).not.toContain('Needs filing');

    responses.agenda_list_review = () => [meeting('a', 1, `${today}T10:00:00Z`)];
    await render(<ReviewView />);
    expect(textOf(root())).toContain('1 item needs a look');
  });

  test('empty, loading and failed loads', async () => {
    responses.agenda_list_review = () => [];
    await render(<ReviewView />);
    expect(textOf(root())).toContain('All caught up');
    expect(textOf(root())).toContain('Nothing is waiting for a decision. New items appear here after Telu reads a meeting.');

    responses.agenda_list_review = () => new Promise(() => {});
    await render(<ReviewView />);
    expect(root().findAll((node) => node.props['aria-busy'] === true)).toHaveLength(1);

    responses.agenda_list_review = () => reviewList();
    await render(<ReviewView />);
    const error = spyOn(toast, 'error');
    const log = console.error;
    console.error = () => {};
    responses.agenda_list_review = () => { throw 'database locked'; };
    await act(async () => { windowEvents.dispatchEvent(new Event('telu:meetings-changed')); });
    await settle();
    console.error = log;
    expect(error.mock.calls[0]?.[0]).toBe("Couldn't load meetings to review.");
    expect((error.mock.calls[0]?.[1] as { action: { label: string } }).action.label).toBe('Try again');
    expect(options()).toHaveLength(3);
    error.mockRestore();
  });

  test('a decided meeting leaves after the beat; Enter opens the review from Review', async () => {
    responses.agenda_list_review = () => reviewList();
    await render(<ReviewView />);
    responses.agenda_list_review = () => reviewList().filter((entry) => entry.id !== 'b');
    await emit('knowledge-updated', { meetingId: 'b', runId: 'run', status: 'succeeded' });
    expect(options()).toHaveLength(3);
    expect(root().findAll((node) => node.props['data-leaving'] === true)).toHaveLength(1);
    await settle(760);
    expect(options()).toHaveLength(2);

    await press('ArrowDown');
    await press('Enter');
    expect(push).toHaveBeenCalledWith('/meeting-details?id=a&from=Review');
  });
});

describe('Sidebar Review row', () => {
  const reviewRow = () => root().find((node) => node.type === 'a' && textOf(node).startsWith('Review'));

  test('sits between Today and Settings with the pending total, hidden at zero, current on /review', async () => {
    responses.agenda_counts = () => ({ dayCount: 0, pendingTotal: 12 });
    await render(<Sidebar />);
    const labels = root().findAll((node) => node.type === 'a').map(textOf);
    expect(labels).toEqual(['Today', 'Review12', 'Settings⌘,']);
    expect(reviewRow().props['aria-current']).toBe('page');
    expect(reviewRow().props['aria-label']).toBe('Review, 12 items');

    pathname = '/';
    responses.agenda_counts = () => ({ dayCount: 0, pendingTotal: 0 });
    await render(<Sidebar />);
    expect(textOf(reviewRow())).toBe('Review');
    expect(reviewRow().props['aria-current']).toBeUndefined();
  });
});
