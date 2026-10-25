import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import type { PlannedMeeting } from '../../src/lib/planning-service';

type Responder = (args: Record<string, unknown>) => unknown;

let responses: Record<string, Responder> = {};
const push = mock((_href: string) => {});
const ipc = mock(async (command: string, args: Record<string, unknown> = {}): Promise<unknown> => {
  const respond = responses[command];
  if (!respond) throw new Error(`Unexpected command: ${command}`);
  return respond(args);
});

const originalNavigation = { ...await import('next/navigation') };
mock.module('next/navigation', () => ({ ...originalNavigation, useRouter: () => ({ push }) }));

const { toast } = await import('sonner');
const { PreparationPage } = await import('../../src/components/preparation/preparation-page');

const AUTOSAVE_WAIT_MS = 800;
const PLANNED: PlannedMeeting = {
  id: 'plan-1',
  title: 'New meeting',
  startUtc: null,
  purpose: '',
  createdUtc: '2026-10-24T08:00:00.000Z',
  updatedUtc: '2026-10-24T08:00:00.000Z',
};

let renderer: ReactTestRenderer | null = null;
const originalTimeZone = process.env.TZ;
const globals = globalThis as unknown as { window?: unknown };
const originalWindow = globals.window;
const windowEvents = Object.assign(new EventTarget(), { __TAURI_INTERNALS__: { invoke: ipc } });
const changes = mock(() => {});

beforeAll(() => {
  process.env.TZ = 'UTC';
  globals.window = windowEvents;
  windowEvents.addEventListener('telu:planned-meetings-changed', changes);
});

afterAll(() => {
  process.env.TZ = originalTimeZone;
  globals.window = originalWindow;
  mock.module('next/navigation', () => originalNavigation);
});

beforeEach(() => {
  ipc.mockClear();
  responses = {
    planning_get: () => PLANNED,
    documents_list: () => [],
    prep_list_sources: () => [],
    api_get_meetings: () => [],
    planning_update: (args) => ({ ...PLANNED, title: args.title, startUtc: args.startUtc, purpose: args.purpose }),
  };
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
});

async function settle(ms = 0) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

async function renderPage() {
  await act(async () => {
    renderer = create(<PreparationPage id="plan-1" />);
  });
  await settle();
  return renderer!.root;
}

function field(root: ReactTestInstance, label: string): ReactTestInstance {
  return root.find((node) => typeof node.type === 'string' && (node.props['aria-label'] === label || node.props.id === label));
}

async function type(node: ReactTestInstance, value: string) {
  await act(async () => {
    node.props.onChange({ target: { value } });
  });
}

function button(root: ReactTestInstance, label: string): ReactTestInstance {
  return root.find((node) => node.type === 'button' && (node.props['aria-label'] === label || textOf(node) === label));
}

function updates() {
  return ipc.mock.calls.filter(([command]) => command === 'planning_update').map((call) => call.slice(0, 2));
}

function textOf(node: ReactTestInstance): string {
  return node.children.map((child) => (typeof child === 'string' ? child : textOf(child))).join('');
}

describe('PreparationPage', () => {
  test('loads the planned meeting into an editable title, date and purpose', async () => {
    responses.planning_get = () => ({ ...PLANNED, title: 'Roadmap sync', purpose: 'Agree the Q1 plan' });
    const root = await renderPage();
    expect(ipc).toHaveBeenCalledWith('planning_get', { id: 'plan-1' }, undefined);
    expect(field(root, 'Meeting title').props.value).toBe('Roadmap sync');
    expect(field(root, 'purpose-why').props.value).toBe('Agree the Q1 plan');
    expect(root.findAll((node) => node.type === 'input' && node.props.type === 'datetime-local')).toHaveLength(0);
    expect(textOf(button(root, 'Add date'))).toBe('Add date');
    expect(textOf(root)).toContain('Why we meet');
  });

  test('renaming autosaves the whole draft once typing stops', async () => {
    const root = await renderPage();
    await type(field(root, 'Meeting title'), 'Roadmap');
    await type(field(root, 'Meeting title'), 'Roadmap sync');
    expect(updates()).toHaveLength(0);
    expect(textOf(root)).toContain('Saving…');
    await settle(AUTOSAVE_WAIT_MS);
    expect(updates()).toEqual([['planning_update', { id: 'plan-1', title: 'Roadmap sync', startUtc: null, purpose: '' }]]);
    expect(textOf(root)).toContain('Saved');
    expect(changes).toHaveBeenCalled();
  });

  test('purpose and date save with the current title', async () => {
    const root = await renderPage();
    await type(field(root, 'purpose-why'), 'Decide the launch date');
    await act(async () => button(root, 'Add date').props.onClick());
    await type(field(root, 'Date and time'), '2026-10-27T10:00');
    await settle(AUTOSAVE_WAIT_MS);
    expect(updates()).toEqual([
      ['planning_update', { id: 'plan-1', title: 'New meeting', startUtc: '2026-10-27T10:00:00.000Z', purpose: 'Decide the launch date' }],
    ]);
  });

  test('a saved date shows in the field and can be removed', async () => {
    responses.planning_get = () => ({ ...PLANNED, startUtc: '2026-10-27T10:00:00.000Z' });
    const root = await renderPage();
    expect(field(root, 'Date and time').props.value).toBe('2026-10-27T10:00');
    await act(async () => button(root, 'Remove date').props.onClick());
    await settle(AUTOSAVE_WAIT_MS);
    expect(updates()).toEqual([['planning_update', { id: 'plan-1', title: 'New meeting', startUtc: null, purpose: '' }]]);
    expect(textOf(button(root, 'Add date'))).toBe('Add date');
  });

  test('a blank title is not saved and is explained next to the field', async () => {
    const root = await renderPage();
    await type(field(root, 'Meeting title'), '   ');
    await settle(AUTOSAVE_WAIT_MS);
    expect(updates()).toHaveLength(0);
    const title = field(root, 'Meeting title');
    expect(title.props['aria-invalid']).toBe(true);
    expect(textOf(root.find((node) => typeof node.type === 'string' && node.props.id === title.props['aria-describedby']))).toBe('Give the meeting a title.');
  });

  test('an edit made while the title is blank is saved once the title is back', async () => {
    const root = await renderPage();
    await type(field(root, 'purpose-why'), 'Agree the plan');
    await type(field(root, 'Meeting title'), '');
    await settle(AUTOSAVE_WAIT_MS);
    expect(updates()).toHaveLength(0);
    await type(field(root, 'Meeting title'), 'Plan review');
    await settle(AUTOSAVE_WAIT_MS);
    expect(updates()).toEqual([['planning_update', { id: 'plan-1', title: 'Plan review', startUtc: null, purpose: 'Agree the plan' }]]);
  });

  test('leaving while the title is blank still saves the other edits under the last title', async () => {
    const root = await renderPage();
    await type(field(root, 'purpose-why'), 'Agree the plan');
    await type(field(root, 'Meeting title'), '');
    act(() => renderer?.unmount());
    renderer = null;
    await settle();
    expect(updates()).toEqual([['planning_update', { id: 'plan-1', title: 'New meeting', startUtc: null, purpose: 'Agree the plan' }]]);
  });

  test('a later successful save after a failed one ends on Saved', async () => {
    let fail = true;
    responses.planning_update = (args) => {
      if (fail) {
        fail = false;
        throw 'PLANNED_MEETING_STORAGE_FAILED';
      }
      return { ...PLANNED, purpose: args.purpose };
    };
    const error = spyOn(toast, 'error');
    const root = await renderPage();
    await type(field(root, 'purpose-why'), 'first');
    await settle(AUTOSAVE_WAIT_MS);
    await type(field(root, 'purpose-why'), 'second');
    await settle(AUTOSAVE_WAIT_MS);
    expect(textOf(root)).toContain('Saved');
    error.mockRestore();
  });

  test('saves run one after another so an older draft never lands last', async () => {
    const stored: string[] = [];
    let release: () => void = () => {};
    responses.planning_update = async (args) => {
      if (args.purpose === 'first') await new Promise<void>((resolve) => { release = resolve; });
      stored.push(String(args.purpose));
      return { ...PLANNED, purpose: args.purpose };
    };
    const root = await renderPage();
    await type(field(root, 'purpose-why'), 'first');
    await settle(AUTOSAVE_WAIT_MS);
    await type(field(root, 'purpose-why'), 'second');
    await settle(AUTOSAVE_WAIT_MS);
    release();
    await settle();
    expect(stored).toEqual(['first', 'second']);
  });

  test('a failed save shows an error toast', async () => {
    const error = spyOn(toast, 'error');
    responses.planning_update = () => {
      throw 'PLANNED_MEETING_STORAGE_FAILED';
    };
    const root = await renderPage();
    await type(field(root, 'purpose-why'), 'Decide the launch date');
    await settle(AUTOSAVE_WAIT_MS);
    expect(error).toHaveBeenCalledWith("Couldn't save this meeting.");
    expect(textOf(root)).not.toContain('Saved');
    error.mockRestore();
  });

  test('a missing meeting shows a load error instead of the editor', async () => {
    responses.planning_get = () => {
      throw 'PLANNED_MEETING_NOT_FOUND';
    };
    const root = await renderPage();
    expect(textOf(root)).toContain('This planned meeting no longer exists.');
    expect(root.findAll((node) => typeof node.type === 'string' && node.props['aria-label'] === 'Meeting title')).toHaveLength(0);
  });

  test('a pending edit is saved when the page closes', async () => {
    const root = await renderPage();
    await type(field(root, 'purpose-why'), 'Close the loop');
    act(() => renderer?.unmount());
    renderer = null;
    await settle();
    expect(updates()).toEqual([['planning_update', { id: 'plan-1', title: 'New meeting', startUtc: null, purpose: 'Close the loop' }]]);
  });
});
