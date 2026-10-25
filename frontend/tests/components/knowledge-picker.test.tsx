import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import type { KnowledgeItemView, KnowledgeType } from '../../src/lib/knowledge-service';
import type { SelectedSource } from '../../src/lib/preparation-service';

type Responder = (args: Record<string, unknown>) => unknown;

const globalWithWindow = globalThis as { window?: unknown };
const originalWindow = globalWithWindow.window;
let responses: Record<string, Responder> = {};
const ipc = mock(async (command: string, args: Record<string, unknown> = {}): Promise<unknown> => {
  const respond = responses[command];
  if (!respond) throw new Error(`Unexpected command: ${command}`);
  return respond(args);
});

const { toast } = await import('sonner');
const { SourcesPanel } = await import('../../src/components/preparation/sources-panel');

const MEETINGS = [
  { id: 'm-1', title: 'Weekly product sync', created_at: '2026-09-27T09:00:00Z' },
  { id: 'm-2', title: 'Design review', created_at: '2026-09-22T14:00:00Z' },
];

const item = (itemId: string, itemType: KnowledgeType, text: string, overrides: Partial<KnowledgeItemView> = {}): KnowledgeItemView => ({
  itemId,
  meetingId: 'm-1',
  originRunId: 'run-1',
  itemType,
  text,
  ownerText: null,
  ownerSupport: 'not_stated',
  dueText: null,
  dueSupport: 'not_stated',
  reviewState: 'accepted',
  eligibility: true,
  evidenceStatus: 'valid',
  corrected: false,
  latestRevisionId: null,
  unresolved: false,
  createdAtUtc: '2026-09-27T09:40:00Z',
  evidence: [],
  ...overrides,
});

const knowledge = (meetingId: string, items: KnowledgeItemView[]) => ({
  meetingId,
  latestRun: null,
  items,
  rejected: [],
  pendingCount: 0,
  acceptedCount: items.length,
  skippedCount: 0,
});

const M1_ITEMS = [
  item('k-dec', 'decision', 'Ship the beta on Oct 6'),
  item('k-com', 'commitment', 'Ana sends the pricing draft'),
  item('k-q', 'question', 'Do we need SSO for launch?'),
  item('k-proposed', 'decision', 'Maybe move standup', { reviewState: 'proposed', eligibility: false }),
  item('k-changed', 'commitment', 'Evidence went away', { evidenceStatus: 'missing', eligibility: false }),
  item('k-fact', 'fact', 'The team has six people'),
];

let renderer: ReactTestRenderer | null = null;
let toastError: ReturnType<typeof spyOn> | null = null;

beforeAll(() => {
  globalWithWindow.window = { __TAURI_INTERNALS__: { invoke: ipc } };
});

afterAll(() => {
  globalWithWindow.window = originalWindow;
});

beforeEach(() => {
  ipc.mockClear();
  responses = {
    documents_list: () => [],
    prep_list_sources: () => [],
    prep_select_sources: (args) => args.sources,
    api_get_meetings: () => MEETINGS,
    knowledge_get_meeting: (args) =>
      args.meetingId === 'm-1' ? knowledge('m-1', M1_ITEMS) : knowledge('m-2', [item('k-2', 'decision', 'Keep the dark sidebar', { meetingId: 'm-2' })]),
  };
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  toastError?.mockRestore();
  toastError = null;
});

const textOf = (node: ReactTestInstance): string =>
  node.children.map((child) => (typeof child === 'string' ? child : textOf(child))).join('');

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function renderPanel() {
  await act(async () => {
    renderer = create(<SourcesPanel plannedMeetingId="plan-1" onOpenSource={() => {}} onSourcesChanged={() => {}} />);
  });
  await settle();
  return renderer!.root;
}

function button(root: ReactTestInstance, label: string): ReactTestInstance {
  return root.find((node) => node.type === 'button' && (node.props['aria-label'] === label || textOf(node).trim() === label));
}

const meetingToggle = (root: ReactTestInstance, title: string) =>
  root.find((node) => node.type === 'button' && node.props['aria-expanded'] !== undefined && textOf(node).includes(title));

async function expand(root: ReactTestInstance, title: string) {
  await act(async () => meetingToggle(root, title).props.onClick());
  await settle();
}

const pickerItems = (root: ReactTestInstance) => root.findAll((node) => node.type === 'li' && node.props['data-knowledge-item'] !== undefined);
const commands = () => ipc.mock.calls.map(([command, args]) => [command, args]);

describe('Knowledge picker', () => {
  test('lists past meetings with their dates, collapsed', async () => {
    const root = await renderPanel();
    expect(meetingToggle(root, 'Weekly product sync').props['aria-expanded']).toBe(false);
    expect(textOf(meetingToggle(root, 'Weekly product sync'))).toContain('Sep 27');
    expect(textOf(meetingToggle(root, 'Design review'))).toContain('Sep 22');
    expect(commands().some(([command]) => command === 'knowledge_get_meeting')).toBe(false);
  });

  test('expanding a meeting offers only its eligible decisions, commitments and open questions with type and date', async () => {
    const root = await renderPanel();
    await expand(root, 'Weekly product sync');
    expect(ipc).toHaveBeenCalledWith('knowledge_get_meeting', { meetingId: 'm-1' }, undefined);
    expect(meetingToggle(root, 'Weekly product sync').props['aria-expanded']).toBe(true);
    expect(pickerItems(root).map(textOf)).toEqual([
      'Ship the beta on Oct 6Decision · Sep 27',
      'Ana sends the pricing draftCommitment · Sep 27',
      'Do we need SSO for launch?Open question · Sep 27',
    ]);
  });

  test('a meeting with nothing eligible says so', async () => {
    responses.knowledge_get_meeting = () => knowledge('m-1', [item('k-p', 'decision', 'Pending', { reviewState: 'proposed', eligibility: false })]);
    const root = await renderPanel();
    await expand(root, 'Weekly product sync');
    expect(pickerItems(root)).toHaveLength(0);
    expect(textOf(root)).toContain('No accepted decisions, commitments or open questions.');
  });

  test('including an item saves it through prep_select_sources next to the existing selection', async () => {
    const doc: SelectedSource = { kind: 'document', versionId: 'a-v1' };
    responses.prep_list_sources = () => [doc, { kind: 'knowledge', meetingId: 'm-1', itemId: 'k-dec' }];
    const root = await renderPanel();
    await expand(root, 'Weekly product sync');
    expect(button(root, 'Included in the brief: Ship the beta on Oct 6').props['aria-pressed']).toBe(true);

    await act(async () => button(root, 'Not included in the brief: Do we need SSO for launch?').props.onClick());
    await settle();
    expect(commands().at(-1)).toEqual([
      'prep_select_sources',
      {
        plannedMeetingId: 'plan-1',
        sources: [doc, { kind: 'knowledge', meetingId: 'm-1', itemId: 'k-dec' }, { kind: 'knowledge', meetingId: 'm-1', itemId: 'k-q' }],
      },
    ]);
    expect(button(root, 'Included in the brief: Do we need SSO for launch?').props['aria-pressed']).toBe(true);

    await act(async () => button(root, 'Included in the brief: Ship the beta on Oct 6').props.onClick());
    await settle();
    expect(commands().at(-1)).toEqual([
      'prep_select_sources',
      { plannedMeetingId: 'plan-1', sources: [doc, { kind: 'knowledge', meetingId: 'm-1', itemId: 'k-q' }] },
    ]);
  });

  test('items from two meetings are both saved', async () => {
    const root = await renderPanel();
    await expand(root, 'Weekly product sync');
    await expand(root, 'Design review');
    await act(async () => {
      button(root, 'Not included in the brief: Ship the beta on Oct 6').props.onClick();
      button(root, 'Not included in the brief: Keep the dark sidebar').props.onClick();
    });
    await settle();
    expect(commands().at(-1)).toEqual([
      'prep_select_sources',
      {
        plannedMeetingId: 'plan-1',
        sources: [
          { kind: 'knowledge', meetingId: 'm-1', itemId: 'k-dec' },
          { kind: 'knowledge', meetingId: 'm-2', itemId: 'k-2' },
        ],
      },
    ]);
  });

  test('SOURCE_NOT_ELIGIBLE shows a toast and refreshes the list', async () => {
    const error = (toastError = spyOn(toast, 'error'));
    const root = await renderPanel();
    await expand(root, 'Weekly product sync');
    responses.prep_select_sources = () => {
      throw 'SOURCE_NOT_ELIGIBLE';
    };
    responses.knowledge_get_meeting = () => knowledge('m-1', M1_ITEMS.filter((entry) => entry.itemId !== 'k-com'));

    await act(async () => button(root, 'Not included in the brief: Ana sends the pricing draft').props.onClick());
    await settle();

    expect(error).toHaveBeenCalledWith('That item can no longer be included. The list has been refreshed.');
    expect(commands().filter(([command]) => command === 'knowledge_get_meeting')).toHaveLength(2);
    expect(pickerItems(root).map(textOf)).toEqual([
      'Ship the beta on Oct 6Decision · Sep 27',
      'Do we need SSO for launch?Open question · Sep 27',
    ]);
    expect(root.findAll((node) => node.props.role === 'alert')).toHaveLength(0);
  });

  test('a selected item that is no longer eligible is dropped so the next save can land', async () => {
    toastError = spyOn(toast, 'error');
    const stale: SelectedSource = { kind: 'knowledge', meetingId: 'm-2', itemId: 'k-old' };
    responses.prep_list_sources = () => [stale];
    responses.prep_select_sources = (args) => {
      if ((args.sources as SelectedSource[]).some((source) => source.kind === 'knowledge' && source.itemId === 'k-old')) throw 'SOURCE_NOT_ELIGIBLE';
      return args.sources;
    };
    const root = await renderPanel();
    await expand(root, 'Weekly product sync');

    await act(async () => button(root, 'Not included in the brief: Ship the beta on Oct 6').props.onClick());
    await settle();

    expect(ipc).toHaveBeenCalledWith('knowledge_get_meeting', { meetingId: 'm-2' }, undefined);
    expect(commands().at(-1)).toEqual(['prep_select_sources', { plannedMeetingId: 'plan-1', sources: [] }]);

    await act(async () => button(root, 'Not included in the brief: Ship the beta on Oct 6').props.onClick());
    await settle();
    expect(commands().at(-1)).toEqual([
      'prep_select_sources',
      { plannedMeetingId: 'plan-1', sources: [{ kind: 'knowledge', meetingId: 'm-1', itemId: 'k-dec' }] },
    ]);
    expect(button(root, 'Included in the brief: Ship the beta on Oct 6').props['aria-pressed']).toBe(true);
  });

  test('a meeting whose knowledge fails to load shows an error in place', async () => {
    responses.knowledge_get_meeting = () => {
      throw 'STORAGE_FAILED';
    };
    const root = await renderPanel();
    await expand(root, 'Weekly product sync');
    expect(textOf(root)).toContain("Couldn't load what this meeting found.");
  });
});
