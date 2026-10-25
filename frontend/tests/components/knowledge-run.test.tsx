import { afterAll, beforeAll, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import type { ReactElement, ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { Cloud, Laptop, Network } from 'lucide-react';
import type { EffectiveRoute } from '../../src/services/providerRouteService';
import type { KnowledgeItemView, KnowledgeRunView, MeetingKnowledgeView } from '../../src/lib/knowledge-service';

type EventHandler = (event: { event: string; id: number; payload: unknown }) => void;
type Responder = (args: Record<string, unknown>) => unknown;
type TauriWindow = Record<string, unknown>;

const globalWithWindow = globalThis as typeof globalThis & { window?: TauriWindow };
const originalWindow = globalWithWindow.window;
const originalTimeZone = process.env.TZ;
const callbacks = new Map<number, EventHandler>();
const listeners = new Map<string, number[]>();
let nextId = 1;
let responses: Record<string, Responder> = {};

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

const originalDropdown = { ...await import('../../src/components/ui/dropdown-menu') };
const originalPopover = { ...await import('../../src/components/ui/popover') };
mock.module('../../src/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <>{children}</>,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <div data-menu="">{children}</div>,
  DropdownMenuItem: ({ children, onSelect, disabled }: { children: ReactNode; onSelect?: (event: Event) => void; disabled?: boolean }) => (
    <button type="button" data-menu-item="" disabled={disabled} onClick={() => onSelect?.(new Event('select'))}>{children}</button>
  ),
}));
mock.module('../../src/components/ui/popover', () => ({
  Popover: ({ children }: { children: ReactNode }) => <>{children}</>,
  PopoverAnchor: ({ children }: { children: ReactNode }) => <>{children}</>,
  PopoverTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  PopoverArrow: () => null,
  PopoverContent: ({ children }: { children: ReactNode }) => <div data-popover="">{children}</div>,
}));

const { toast } = await import('sonner');
const service = await import('../../src/lib/knowledge-service');
const { RunNotice } = await import('../../src/components/living-doc/run-notice');
const { KnowledgeSection } = await import('../../src/components/living-doc/knowledge-section');
const { TooltipProvider } = await import('../../src/components/ui/tooltip');

beforeAll(() => {
  process.env.TZ = 'UTC';
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
    addEventListener: () => {},
    removeEventListener: () => {},
  };
});

afterAll(() => {
  process.env.TZ = originalTimeZone;
  globalWithWindow.window = originalWindow;
  mock.module('../../src/components/ui/dropdown-menu', () => originalDropdown);
  mock.module('../../src/components/ui/popover', () => originalPopover);
});

const route = (locationClass: 'local' | 'lan' | 'remote', encrypted = true): EffectiveRoute => ({
  capability: 'summary',
  providerId: 'ollama',
  modelId: 'llama3',
  locationClass,
  sanitizedOrigin: locationClass === 'local' ? 'This device' : '192.168.1.20:11434',
  encrypted,
  validationState: 'validated',
  resolvedAddresses: [],
});

const unavailableRoute: EffectiveRoute = { ...route('local'), locationClass: null, sanitizedOrigin: null, validationState: 'unavailable' };

const run = (overrides: Partial<KnowledgeRunView> = {}): KnowledgeRunView => ({
  runId: 'run-1', meetingId: 'meeting', triggerKind: 'user', status: 'succeeded', providerId: 'ollama', modelId: 'llama3',
  locationClass: 'local', sanitizedOrigin: 'This device', promptVersion: 'knowledge-extract-v2', inputEvidenceCount: 4,
  proposedCount: 0, skippedCount: 0, suppressedCount: 0, reconfirmedCount: 0, duplicateCount: 0, failureCode: null,
  startedAtUtc: '2026-09-27T10:46:00Z', finishedAtUtc: '2026-09-27T10:47:00Z', ...overrides,
});

const item = (text: string): KnowledgeItemView => ({
  itemId: `item-${text}`, meetingId: 'meeting', originRunId: 'run-1', itemType: 'decision', text,
  ownerText: null, ownerSupport: 'not_stated', dueText: null, dueSupport: 'not_stated', reviewState: 'proposed',
  eligibility: false, evidenceStatus: 'valid', corrected: false, latestRevisionId: null, unresolved: true,
  createdAtUtc: '2026-09-27T10:47:00Z', evidence: [],
});

const view = (meetingId: string, overrides: Partial<MeetingKnowledgeView> = {}): MeetingKnowledgeView => ({
  meetingId, latestRun: null, items: [], rejected: [], pendingCount: 0, acceptedCount: 0, skippedCount: 0, ...overrides,
});

const textOf = (node: ReactTestInstance): string =>
  node.children.map((child) => (typeof child === 'string' ? child : textOf(child))).join('');

let renderer: ReactTestRenderer;
async function render(element: ReactElement) {
  await act(async () => {
    renderer = create(<TooltipProvider>{element}</TooltipProvider>);
  });
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
}
const content = () => textOf(renderer.root);
const button = (label: string) =>
  renderer.root.find((node) => node.type === 'button' && textOf(node) === label);
const hasButton = (label: string) =>
  renderer.root.findAll((node) => node.type === 'button' && textOf(node) === label).length > 0;
const calls = (command: string) => ipc.mock.calls.filter(([name]) => name === command);
async function click(label: string) {
  await act(async () => { button(label).props.onClick(); });
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
}
async function emit(event: string, payload: unknown) {
  await act(async () => {
    (listeners.get(event) ?? []).forEach((id) => callbacks.get(id)?.({ event, id, payload }));
  });
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
}

function useResponses(knowledge: MeetingKnowledgeView, currentRoute: EffectiveRoute = route('local')) {
  responses = {
    get_current_provider_route: () => currentRoute,
    validate_provider_route: () => currentRoute,
    knowledge_get_meeting: () => knowledge,
    knowledge_start_extraction: (args) => run({ runId: 'run-started', status: 'running', triggerKind: args.trigger as KnowledgeRunView['triggerKind'] }),
    knowledge_cancel_extraction: () => true,
  };
}

beforeEach(() => {
  ipc.mockClear();
  listeners.clear();
  callbacks.clear();
});

describe('RunNotice', () => {
  test('names the Summary route by location class before any start', async () => {
    await render(<RunNotice routeState={{ status: 'validated', route: route('local') as never, failure: null }} />);
    expect(renderer.root.findAllByType(Laptop)).toHaveLength(1);
    expect(content()).toContain('Uses your Summary model · Local · This device');

    await render(<RunNotice routeState={{ status: 'validated', route: route('lan', false) as never, failure: null }} />);
    expect(renderer.root.findAllByType(Network)).toHaveLength(1);
    expect(content()).toContain('Not encrypted');

    await render(<RunNotice routeState={{ status: 'validated', route: route('remote') as never, failure: null }} />);
    expect(renderer.root.findAllByType(Cloud)).toHaveLength(1);
    expect(content()).not.toContain('Not encrypted');
  });

  test('shows the unavailable copy with Open Settings when the route is not validated', async () => {
    const failure = { code: 'PROVIDER_ROUTE_UNAVAILABLE', capability: 'summary', providerId: 'ollama', modelId: 'llama3', sanitizedOrigin: null };
    await render(<RunNotice routeState={{ status: 'unavailable', route: null, failure: failure as never }} />);
    expect(content()).toContain("Your Summary provider couldn't be validated. Nothing was sent. Check it in Settings.");
    const link = renderer.root.find((node) => node.type === 'a' && textOf(node) === 'Open Settings');
    expect(link.props.href).toBe('/settings');
  });
});

describe('knowledge-service wrappers', () => {
  test('each wrapper invokes the matching knowledge command with camelCase arguments', async () => {
    responses = new Proxy({}, { get: () => () => null }) as Record<string, Responder>;
    const correction = { text: 'Ship Friday', ownerText: 'Maria', dueText: null, basedOnRevisionId: null };
    await service.cancelKnowledgeExtraction('m1');
    await service.reviewKnowledgeItem('m1', 'i1', 'accept');
    await service.correctKnowledgeItem('m1', 'i1', correction);
    await service.acceptAllKnowledgeItems('m1', ['i1', 'i2']);
    await service.getKnowledgeItemHistory('m1', 'i1');
    await service.listKnowledgeRuns('m1');
    expect(ipc.mock.calls.map(([name, args]) => [name, args])).toEqual([
      ['knowledge_cancel_extraction', { meetingId: 'm1' }],
      ['knowledge_review_item', { meetingId: 'm1', itemId: 'i1', action: 'accept' }],
      ['knowledge_correct_item', { meetingId: 'm1', itemId: 'i1', correction }],
      ['knowledge_accept_all', { meetingId: 'm1', itemIds: ['i1', 'i2'] }],
      ['knowledge_item_history', { meetingId: 'm1', itemId: 'i1' }],
      ['knowledge_list_runs', { meetingId: 'm1' }],
    ]);
  });
});

describe('KnowledgeSection runs', () => {
  test('Find knowledge is disabled while unvalidated and revalidates the route before starting', async () => {
    useResponses(view('meeting-start'), unavailableRoute);
    await render(<KnowledgeSection meetingId="meeting-start" />);
    expect(button('Find knowledge').props.disabled).toBe(true);

    useResponses(view('meeting-start'));
    await render(<KnowledgeSection meetingId="meeting-start" />);
    await click('Find knowledge');
    const names = ipc.mock.calls.map(([name]) => name);
    expect(names.indexOf('validate_provider_route')).toBeLessThan(names.indexOf('knowledge_start_extraction'));
    expect(calls('knowledge_start_extraction')[0][1]).toMatchObject({ meetingId: 'meeting-start', trigger: 'user' });
  });

  test('auto-starts once per meeting only for complete meetings with evidence', async () => {
    useResponses(view('meeting-auto'));
    await render(<KnowledgeSection meetingId="meeting-auto" autoGenerate completeness="complete" hasEvidence />);
    expect(calls('knowledge_start_extraction')).toHaveLength(1);
    expect(calls('knowledge_start_extraction')[0][1]).toMatchObject({ trigger: 'auto' });

    await act(async () => {
      renderer.update(<TooltipProvider><KnowledgeSection meetingId="meeting-auto" autoGenerate completeness="complete" hasEvidence /></TooltipProvider>);
    });
    await render(<KnowledgeSection meetingId="meeting-auto" autoGenerate completeness="complete" hasEvidence />);
    expect(calls('knowledge_start_extraction')).toHaveLength(1);

    useResponses(view('meeting-gap'));
    await render(<KnowledgeSection meetingId="meeting-gap" autoGenerate completeness="incomplete" hasEvidence />);
    expect(hasButton('Find knowledge anyway')).toBe(true);
    expect(content()).toContain("This meeting has gaps in its transcript. Items from the missing parts can't be found.");
    expect(calls('knowledge_start_extraction')).toHaveLength(1);
  });

  test('no-evidence and failed runs render their copy', async () => {
    useResponses(view('meeting-legacy'));
    responses.knowledge_start_extraction = () => { throw 'KNOWLEDGE_NO_EVIDENCE'; };
    await render(<KnowledgeSection meetingId="meeting-legacy" />);
    await click('Find knowledge');
    expect(content()).toContain('Knowledge needs an evidence transcript');
    expect(hasButton('Find knowledge')).toBe(false);

    useResponses(view('meeting-failed', { latestRun: run({ status: 'failed', failureCode: 'MALFORMED_OUTPUT' }) }));
    await render(<KnowledgeSection meetingId="meeting-failed" />);
    expect(content()).toContain("Telu couldn't use the model's answer. Your transcript is unchanged.");
    expect(hasButton('Try again')).toBe(true);
  });

  test('a running run shows Stop, which cancels it', async () => {
    useResponses(view('meeting-running', { latestRun: run({ status: 'running' }) }));
    await render(<KnowledgeSection meetingId="meeting-running" />);
    expect(content()).toContain('Reading the transcript…');
    await click('Stop');
    expect(calls('knowledge_cancel_extraction')[0][1]).toEqual({ meetingId: 'meeting-running' });
  });

  test('a route check that fails before a start clears once the next check succeeds', async () => {
    useResponses(view('meeting-flaky-route'));
    responses.validate_provider_route = () => unavailableRoute;
    await render(<KnowledgeSection meetingId="meeting-flaky-route" />);
    await click('Find knowledge');
    expect(calls('knowledge_start_extraction')).toHaveLength(0);
    expect(button('Find knowledge').props.disabled).toBe(true);

    responses.validate_provider_route = () => route('local');
    await click('Check again');
    expect(calls('get_current_provider_route')).toHaveLength(2);
    expect(button('Find knowledge').props.disabled).toBe(false);
    expect(hasButton('Check again')).toBe(false);
    await click('Find knowledge');
    expect(calls('knowledge_start_extraction')).toHaveLength(1);
  });

  test('Stop shows an error toast when the cancel is rejected', async () => {
    const error = spyOn(toast, 'error');
    const quiet = spyOn(console, 'error').mockImplementation(() => {});
    try {
      useResponses(view('meeting-stop-fails', { latestRun: run({ status: 'running' }) }));
      responses.knowledge_cancel_extraction = () => { throw 'KNOWLEDGE_INVALID_REQUEST'; };
      await render(<KnowledgeSection meetingId="meeting-stop-fails" />);
      await click('Stop');
      expect(error).toHaveBeenCalledWith("Couldn't stop reading this meeting.");
      expect(quiet).toHaveBeenCalledWith('Failed to stop knowledge extraction:', 'KNOWLEDGE_INVALID_REQUEST');
    } finally {
      error.mockRestore();
      quiet.mockRestore();
    }
  });

  test('Stop reloads the view when there was nothing to cancel', async () => {
    useResponses(view('meeting-stop-done', { latestRun: run({ status: 'running' }) }));
    responses.knowledge_cancel_extraction = () => false;
    await render(<KnowledgeSection meetingId="meeting-stop-done" />);
    responses.knowledge_get_meeting = () => view('meeting-stop-done', { latestRun: run() });
    await click('Stop');
    expect(calls('knowledge_get_meeting')).toHaveLength(2);
    expect(content()).toContain('Nothing to review');
  });

  test('succeeded runs without items explain nothing found or all abstained', async () => {
    useResponses(view('meeting-nothing', { latestRun: run() }));
    await render(<KnowledgeSection meetingId="meeting-nothing" />);
    expect(content()).toContain('Nothing to review');

    useResponses(view('meeting-abstained', { latestRun: run({ skippedCount: 2 }), skippedCount: 2 }));
    await render(<KnowledgeSection meetingId="meeting-abstained" />);
    expect(content()).toContain('Nothing Telu could quote');
    expect(content()).toContain('2 possible items skipped — not enough evidence');
  });

  test('regenerate keeps items visible and reports what was already decided', async () => {
    const success = spyOn(toast, 'success');
    useResponses(view('meeting-regen', { latestRun: run(), items: [item('Ship the beta on Friday')], pendingCount: 1 }));
    await render(<KnowledgeSection meetingId="meeting-regen" />);
    await click('Regenerate…');
    expect(hasButton('Keep current items')).toBe(true);
    await click('Regenerate');
    expect(calls('knowledge_start_extraction')[0][1]).toMatchObject({ trigger: 'regenerate' });
    expect(content()).toContain('Ship the beta on Friday');

    responses.knowledge_get_meeting = () => view('meeting-regen', {
      latestRun: run({ runId: 'run-started', status: 'succeeded', proposedCount: 2, suppressedCount: 1, reconfirmedCount: 2 }),
      items: [item('Ship the beta on Friday')],
    });
    await emit('knowledge-updated', { meetingId: 'meeting-regen', runId: 'run-started', status: 'succeeded' });
    expect(success).toHaveBeenCalledWith('Found 2 new items · 3 already decided');
    success.mockRestore();
  });

  test('run details lists the current run and earlier runs newest first', async () => {
    useResponses(view('meeting-details', { latestRun: run({ proposedCount: 3, skippedCount: 1, suppressedCount: 1, reconfirmedCount: 1 }) }));
    responses.knowledge_list_runs = () => [
      run({ runId: 'run-old', startedAtUtc: '2026-09-26T09:00:00Z', proposedCount: 1 }),
      run({ proposedCount: 3, skippedCount: 1, suppressedCount: 1, reconfirmedCount: 1 }),
    ];
    await render(<KnowledgeSection meetingId="meeting-details" />);
    await click('Run details');
    const text = content();
    expect(text).toContain('Run of Sep 27, 10:46');
    expect(text).toContain('ollama · llama3 · Local');
    expect(text).toContain('3 proposed · 1 skipped (not enough evidence) · 2 already decided');
    expect(text.indexOf('Run of Sep 27, 10:46')).toBeLessThan(text.indexOf('Run of Sep 26, 09:00'));
  });
});
