import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

type EventHandler = (event: { event: string; id: number; payload: unknown }) => void;
type Responder = (args: Record<string, unknown>) => unknown;
type TestWindow = Record<string, unknown>;

const globalWithWindow = globalThis as typeof globalThis & { window?: TestWindow };
const originalWindow = globalWithWindow.window;
const windowEvents = new EventTarget();
const callbacks = new Map<number, EventHandler>();
const listeners = new Map<string, number[]>();
let nextId = 1;
let responses: Record<string, Responder> = {};
let pathname = '/';
let importFlag = false;
let recordingStatus = 'idle';
const push = mock((_href: string) => {});
const back = mock(() => {});
const router = { push, back };
const openImportDialog = mock(() => {});
const animate = mock((_frames: unknown, _options: unknown) => {});

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

const originalNavigation = { ...await import('next/navigation') };
const originalConfig = { ...await import('../../src/contexts/ConfigContext') };
const originalImportDialog = { ...await import('../../src/contexts/ImportDialogContext') };
const originalRecordingState = { ...await import('../../src/contexts/RecordingStateContext') };
mock.module('next/navigation', () => ({ ...originalNavigation, usePathname: () => pathname, useRouter: () => router }));
mock.module('../../src/contexts/ConfigContext', () => ({
  ...originalConfig,
  useConfig: () => ({ betaFeatures: { importAndRetranscribe: importFlag } }),
}));
mock.module('../../src/contexts/ImportDialogContext', () => ({ ...originalImportDialog, useImportDialog: () => ({ openImportDialog }) }));
mock.module('../../src/contexts/RecordingStateContext', () => ({
  ...originalRecordingState,
  useRecordingState: () => ({ status: recordingStatus }),
}));

const { Sidebar } = await import('../../src/components/app-shell/sidebar');
const { AppShell } = await import('../../src/components/app-shell/app-shell');

beforeAll(() => {
  globalWithWindow.window = {
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
});

afterAll(async () => {
  unmount();
  await new Promise((resolve) => setTimeout(resolve, 0));
  globalWithWindow.window = originalWindow;
  mock.module('next/navigation', () => originalNavigation);
  mock.module('../../src/contexts/ConfigContext', () => originalConfig);
  mock.module('../../src/contexts/ImportDialogContext', () => originalImportDialog);
  mock.module('../../src/contexts/RecordingStateContext', () => originalRecordingState);
});

let renderer: ReactTestRenderer | undefined;
const textOf = (node: ReactTestInstance): string =>
  node.children.map((child) => (typeof child === 'string' ? child : textOf(child))).join('');
const root = () => renderer!.root;
const unmount = () => {
  act(() => renderer?.unmount());
  renderer = undefined;
};
const row = (label: string) =>
  root().find((node) => (node.type === 'a' || node.type === 'button') && textOf(node).startsWith(label));
const countCalls = () => ipc.mock.calls.filter(([command]) => command === 'agenda_counts').length;
const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });

async function renderSidebar() {
  unmount();
  await act(async () => { renderer = create(<Sidebar />); });
  await settle();
}

async function emit(event: string, payload: unknown) {
  await act(async () => {
    (listeners.get(event) ?? []).forEach((id) => callbacks.get(id)?.({ event, id, payload }));
  });
  await settle();
}

async function pressMeta(key: string) {
  const event = Object.assign(new Event('keydown', { cancelable: true }), {
    key,
    metaKey: true,
    altKey: false,
    ctrlKey: false,
    shiftKey: false,
  });
  await act(async () => { windowEvents.dispatchEvent(event); });
}

beforeEach(() => {
  unmount();
  listeners.clear();
  ipc.mockClear();
  push.mockClear();
  back.mockClear();
  animate.mockClear();
  openImportDialog.mockClear();
  responses = { agenda_counts: () => ({ dayCount: 0, pendingTotal: 0 }) };
  pathname = '/';
  importFlag = false;
  recordingStatus = 'idle';
});

describe('Sidebar', () => {
  test('shows Today, Settings and the footer, with the Today count hidden at zero', async () => {
    await renderSidebar();
    expect(textOf(row('Today'))).toBe('Today');
    expect(textOf(row('Settings'))).toBe('Settings⌘,');
    expect(textOf(root())).toContain('Stored on this Mac');
    expect(textOf(root())).not.toMatch(/Upcoming|Found in Calendar|Series|Calendars|processed locally/);

    responses.agenda_counts = () => ({ dayCount: 3, pendingTotal: 0 });
    await renderSidebar();
    expect(textOf(row('Today'))).toBe('Today3');
    expect(row('Today').props['aria-label']).toBe('Today, 3 meetings');
  });

  test('marks the current route and shows Import audio only with the beta flag', async () => {
    await renderSidebar();
    expect(row('Today').props['aria-current']).toBe('page');
    expect(row('Settings').props['aria-current']).toBeUndefined();
    expect(root().findAll((node) => node.type === 'button' && textOf(node) === 'Import audio')).toHaveLength(0);

    pathname = '/settings';
    importFlag = true;
    await renderSidebar();
    expect(row('Settings').props['aria-current']).toBe('page');
    expect(row('Today').props['aria-current']).toBeUndefined();
    await act(async () => row('Import audio').props.onClick());
    expect(openImportDialog).toHaveBeenCalledTimes(1);
  });

  test('refetches the count once per knowledge update, meeting change or recording change', async () => {
    await renderSidebar();
    expect(countCalls()).toBe(1);
    expect(Object.keys(ipc.mock.calls.find(([command]) => command === 'agenda_counts')?.[1] ?? {})).toEqual(['fromUtc', 'toUtc']);

    await emit('knowledge-updated', { meetingId: 'meeting-a' });
    expect(countCalls()).toBe(2);

    await act(async () => { windowEvents.dispatchEvent(new CustomEvent('telu:meetings-changed')); });
    await settle();
    expect(countCalls()).toBe(3);

    recordingStatus = 'recording';
    await act(async () => renderer!.update(<Sidebar />));
    await settle();
    expect(countCalls()).toBe(4);
  });

  test('a failed count load keeps the row without a count', async () => {
    const error = console.error;
    console.error = () => {};
    responses.agenda_counts = () => { throw 'database locked'; };
    await renderSidebar();
    console.error = error;
    expect(textOf(row('Today'))).toBe('Today');
  });
});

describe('AppShell', () => {
  const page = () => (
    <AppShell>
      <p>page</p>
    </AppShell>
  );

  test('⌘, opens Settings and ⌘[ goes back instantly; only pointer navigation fades the view', async () => {
    pathname = '/meeting-details';
    await act(async () => {
      renderer = create(page(), { createNodeMock: (element) => (element.type === 'div' ? { animate } : null) });
    });
    await settle();

    await pressMeta(',');
    expect(push).toHaveBeenCalledWith('/settings');

    await pressMeta('[');
    expect(back).toHaveBeenCalledTimes(1);
    pathname = '/';
    await act(async () => renderer!.update(page()));
    expect(animate).not.toHaveBeenCalled();

    await act(async () => { windowEvents.dispatchEvent(new Event('pointerdown')); });
    pathname = '/settings';
    await act(async () => renderer!.update(page()));
    expect(animate).toHaveBeenCalledTimes(1);
  });

  test('a shortcut already handled by the page is left alone', async () => {
    await act(async () => { renderer = create(page()); });
    const handled = Object.assign(new Event('keydown', { cancelable: true }), { key: '[', metaKey: true });
    handled.preventDefault();
    await act(async () => { windowEvents.dispatchEvent(handled); });
    expect(back).not.toHaveBeenCalled();
  });
});
