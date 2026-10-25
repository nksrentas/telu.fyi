import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import type { BriefingClaim, BriefingView, PreparationRun, StoredBriefing } from '../../src/lib/preparation-service';
import type { EffectiveRoute } from '../../src/services/providerRouteService';
import type { MeetingKnowledgeView } from '../../src/lib/knowledge-service';

type Responder = (args: Record<string, unknown>) => unknown;

let responses: Record<string, Responder> = {};
const callbacks = new Map<number, (event: unknown) => void>();
const ipc = mock(async (command: string, args: Record<string, unknown> = {}): Promise<unknown> => {
  const respond = responses[command];
  if (!respond) throw new Error(`Unexpected command: ${command}`);
  return respond(args);
});

const globals = globalThis as unknown as { window?: unknown };
const originalWindow = globals.window;
const tauriWindow = {
  addEventListener: () => {},
  removeEventListener: () => {},
  __TAURI_INTERNALS__: {
    invoke: ipc,
    transformCallback: (callback: (event: unknown) => void) => {
      const id = callbacks.size + 1;
      callbacks.set(id, callback);
      return id;
    },
    unregisterCallback: () => {},
  },
  __TAURI_EVENT_PLUGIN_INTERNALS__: { unregisterListener: () => {} },
};

beforeAll(() => {
  globals.window = tauriWindow;
});

afterAll(() => {
  globals.window = originalWindow;
});

const { toast } = await import('sonner');
const { BriefingBlock, BRIEFING_COPY } = await import('../../src/components/preparation/briefing-block');

const REMOTE_ROUTE: EffectiveRoute = {
  capability: 'summary',
  providerId: 'openrouter',
  modelId: 'claude',
  locationClass: 'remote',
  sanitizedOrigin: 'openrouter.ai',
  encrypted: true,
  validationState: 'validated',
  resolvedAddresses: [],
};

function run(status: PreparationRun['status'], failureCode: string | null = null): PreparationRun {
  return {
    id: 'run-1',
    plannedMeetingId: 'plan-1',
    status,
    providerId: 'openrouter',
    modelId: 'claude',
    locationClass: 'remote',
    sanitizedOrigin: 'openrouter.ai',
    promptVersion: 'prep-briefing-v2',
    briefingId: status === 'completed' ? 'brief-1' : null,
    failureCode,
    startedUtc: '2026-10-25T14:00:00.000Z',
    finishedUtc: status === 'running' ? null : '2026-10-25T14:02:00.000Z',
  };
}

const documentClaim: BriefingClaim = {
  text: 'The roadmap moves the launch to March.',
  status: 'cited',
  sourceRef: 'S1#2',
  source: { kind: 'document', versionId: 'd-1-v2' },
  passageId: 'p-3',
  locatorJson: '{"start":360,"end":438,"heading_path":["Launch"]}',
  quote: 'launch moves to March',
};

const knowledgeClaim: BriefingClaim = {
  text: 'Ana owns the hiring plan.',
  status: 'cited',
  sourceRef: 'S2',
  source: { kind: 'knowledge', meetingId: 'meeting-a', itemId: 'item-1' },
  passageId: null,
  locatorJson: null,
  quote: 'Ana will own the hiring plan',
};

function briefing(overrides: Partial<StoredBriefing> = {}): StoredBriefing {
  return {
    id: 'brief-1',
    promptVersion: 'prep-briefing-v2',
    createdUtc: '2026-10-25T14:02:00.000Z',
    droppedCount: 0,
    droppedQuestionCount: 0,
    stale: false,
    manifest: [
      { source: documentClaim.source, status: 'included', reason: 'WITHIN_BUDGET', tokens: 300 },
      { source: knowledgeClaim.source, status: 'included', reason: 'WITHIN_BUDGET', tokens: 20 },
      { source: { kind: 'document', versionId: 'd-9-v1' }, status: 'omitted', reason: 'TOTAL_BUDGET', tokens: 0 },
    ],
    claims: [documentClaim, knowledgeClaim],
    questions: [{ claim: { ...documentClaim, text: 'Is March still realistic?' }, rationale: 'The launch moved once already.' }],
    ...overrides,
  };
}

const knowledge: MeetingKnowledgeView = {
  meetingId: 'meeting-a',
  latestRun: null,
  items: [{
    itemId: 'item-1',
    meetingId: 'meeting-a',
    originRunId: 'run-k',
    itemType: 'commitment',
    text: 'Ana owns the hiring plan',
    ownerText: 'Ana',
    ownerSupport: 'stated',
    dueText: null,
    dueSupport: 'not_stated',
    reviewState: 'accepted',
    eligibility: true,
    evidenceStatus: 'valid',
    corrected: false,
    latestRevisionId: null,
    unresolved: false,
    createdAtUtc: '2026-09-27T09:10:00Z',
    evidence: [
      { linkId: 'l-1', evidenceId: 'ev-7', role: 'claim', quoteText: 'Ana will own', rawStart: 4, rawEnd: 16, sequence: 7, audioStartTime: 60, audioEndTime: 64, segmentCaptureIncomplete: false },
      { linkId: 'l-2', evidenceId: 'ev-8', role: 'owner', quoteText: 'Ana', rawStart: 0, rawEnd: 3, sequence: 8, audioStartTime: 64, audioEndTime: 66, segmentCaptureIncomplete: false },
    ],
  }],
  rejected: [],
  pendingCount: 0,
  acceptedCount: 1,
  skippedCount: 0,
};

let view: BriefingView = { run: null, briefing: null };
let renderer: ReactTestRenderer | null = null;
const openSource = mock(() => {});
const openTranscript = mock(() => {});
const originalTimeZone = process.env.TZ;

beforeEach(() => {
  process.env.TZ = 'UTC';
  ipc.mockClear();
  openSource.mockClear();
  openTranscript.mockClear();
  callbacks.clear();
  view = { run: null, briefing: null };
  responses = {
    get_current_provider_route: () => REMOTE_ROUTE,
    validate_provider_route: () => REMOTE_ROUTE,
    prep_get_briefing: () => view,
    prep_generate: () => run('running'),
    prep_cancel: () => true,
    'plugin:event|listen': () => 1,
    'plugin:event|unlisten': () => null,
    documents_get_version: (args) => ({
      document: { id: 'd-1', title: args.versionId === 'd-1-v2' ? 'Q1 roadmap' : 'Old notes', format: 'markdown', availability: 'available', createdUtc: '2026-09-27T06:00:00.000Z' },
      version: { id: args.versionId, documentId: 'd-1', version: 2 },
      latestVersion: 2,
      passages: [],
    }),
    api_get_meetings: () => [{ id: 'meeting-a', title: 'Hiring sync', created_at: '2026-09-27T09:00:00Z' }],
    knowledge_get_meeting: () => knowledge,
  };
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  process.env.TZ = originalTimeZone;
});

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function renderBlock() {
  await act(async () => {
    renderer = create(<BriefingBlock plannedMeetingId="plan-1" onOpenSource={openSource} onOpenTranscript={openTranscript} />);
  });
  await settle();
  await settle();
  return renderer!.root;
}

function textOf(node: ReactTestInstance): string {
  return node.children.map((child) => (typeof child === 'string' ? child : textOf(child))).join('');
}

function button(root: ReactTestInstance, label: string): ReactTestInstance {
  return root.find((node) => node.type === 'button' && (node.props['aria-label'] === label || textOf(node) === label));
}

function commands() {
  return ipc.mock.calls.map(([command]) => command);
}

describe('BriefingBlock', () => {
  test('a remote route shows its destination before prep_generate is called', async () => {
    const root = await renderBlock();
    expect(textOf(root)).toContain('Remote · openrouter.ai');
    expect(textOf(root)).toContain(BRIEFING_COPY.idle);
    expect(commands()).not.toContain('prep_generate');

    await act(async () => button(root, 'Prepare').props.onClick());
    await settle();

    const validateIndex = commands().indexOf('validate_provider_route');
    const generateIndex = commands().indexOf('prep_generate');
    expect(validateIndex).toBeGreaterThanOrEqual(0);
    expect(generateIndex).toBeGreaterThan(validateIndex);
    expect(ipc.mock.calls[generateIndex][1]).toEqual({ plannedMeetingId: 'plan-1', expectedRoute: REMOTE_ROUTE });
    expect(textOf(root)).toContain('Preparing the brief… · Remote · openrouter.ai');
  });

  test('a route that fails validation blocks Prepare and sends nothing', async () => {
    responses.validate_provider_route = () => ({ ...REMOTE_ROUTE, validationState: 'materially_changed' });
    const root = await renderBlock();
    await act(async () => button(root, 'Prepare').props.onClick());
    await settle();
    expect(commands()).not.toContain('prep_generate');
    expect(textOf(root)).toContain("couldn't be validated. Nothing was sent.");
  });

  test('Stop calls prep_cancel and a rejection shows a toast', async () => {
    view = { run: run('running'), briefing: null };
    responses.prep_cancel = () => {
      throw new Error('PREP_STORAGE_FAILED');
    };
    const error = spyOn(toast, 'error').mockImplementation(() => 1);
    const root = await renderBlock();
    await act(async () => button(root, 'Stop').props.onClick());
    await settle();
    expect(ipc).toHaveBeenCalledWith('prep_cancel', { plannedMeetingId: 'plan-1' }, undefined);
    expect(error).toHaveBeenCalledWith(BRIEFING_COPY.stopFailed);
    error.mockRestore();
  });

  test('a document chip opens the source viewer at the claim locator', async () => {
    view = { run: run('completed'), briefing: briefing() };
    const root = await renderBlock();
    const chips = root.findAll((node) => node.type === 'button' && textOf(node) === 'Source: Q1 roadmap');
    expect(chips).toHaveLength(2);
    await act(async () => chips[0].props.onClick());
    expect(openSource).toHaveBeenCalledWith({ versionId: 'd-1-v2', locator: { start: 360, end: 438 } });
  });

  test('a knowledge chip opens the transcript drawer on its claim evidence', async () => {
    view = { run: run('completed'), briefing: briefing() };
    const root = await renderBlock();
    await act(async () => button(root, 'Source: Hiring sync · Sep 27').props.onClick());
    await settle();
    expect(ipc).toHaveBeenCalledWith('knowledge_get_meeting', { meetingId: 'meeting-a' }, undefined);
    expect(openTranscript).toHaveBeenCalledWith({
      meetingId: 'meeting-a',
      title: 'Hiring sync',
      highlight: { evidenceIds: ['ev-7'], spans: [{ evidenceId: 'ev-7', start: 4, end: 16 }] },
    });
  });

  test('a knowledge item that is gone shows a toast instead of opening', async () => {
    view = { run: run('completed'), briefing: briefing() };
    responses.knowledge_get_meeting = () => ({ ...knowledge, items: [] });
    const error = spyOn(toast, 'error').mockImplementation(() => 1);
    const root = await renderBlock();
    await act(async () => button(root, 'Source: Hiring sync · Sep 27').props.onClick());
    await settle();
    expect(openTranscript).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(BRIEFING_COPY.itemGone);
    error.mockRestore();
  });

  test('the brief lists statements, questions and a provenance line', async () => {
    view = { run: run('completed'), briefing: briefing() };
    const root = await renderBlock();
    const text = textOf(root);
    expect(text).toContain('The roadmap moves the launch to March.');
    expect(text).toContain('Ana owns the hiring plan.');
    expect(text).toContain('Worth asking');
    expect(text).toContain('Is March still realistic?');
    expect(text).toContain('The launch moved once already.');
    expect(text).toContain('Prepared from your purpose, Q1 roadmap and 1 past-meeting item · Oct 25, 14:02 · 1 left out');
    expect(textOf(button(root, 'Prepare again'))).toBe('Prepare again');
  });

  test('a claim whose source was deleted has no chip to open', async () => {
    view = { run: run('completed'), briefing: briefing({ claims: [{ ...documentClaim, status: 'source_unavailable', quote: '' }], questions: [] }) };
    const root = await renderBlock();
    expect(textOf(root)).toContain('Source deleted');
    expect(root.findAll((node) => node.type === 'button' && textOf(node).startsWith('Source:'))).toHaveLength(0);
  });

  test('failed, cancelled and stale runs each say what happened', async () => {
    view = { run: run('failed', 'PREP_PARSE_FAILED'), briefing: null };
    let root = await renderBlock();
    expect(textOf(root)).toContain(BRIEFING_COPY.parseFailed);
    expect(textOf(button(root, 'Try again'))).toBe('Try again');
    act(() => renderer?.unmount());

    view = { run: run('cancelled'), briefing: null };
    root = await renderBlock();
    expect(textOf(root)).toContain(BRIEFING_COPY.cancelled);
    act(() => renderer?.unmount());

    view = { run: run('stale', 'SELECTION_CHANGED'), briefing: briefing() };
    root = await renderBlock();
    expect(textOf(root)).toContain(BRIEFING_COPY.stale);
    expect(textOf(root)).toContain('The roadmap moves the launch to March.');
  });

  test('a brief whose sources changed says so', async () => {
    view = { run: run('completed'), briefing: briefing({ stale: true }) };
    const root = await renderBlock();
    expect(textOf(root)).toContain(BRIEFING_COPY.briefStale);
  });

  test('a preparation-updated event reloads the brief', async () => {
    view = { run: run('running'), briefing: null };
    const root = await renderBlock();
    expect(textOf(root)).toContain('Preparing the brief…');
    view = { run: run('completed'), briefing: briefing() };
    const [handler] = callbacks.values();
    await act(async () => handler({ event: 'preparation-updated', id: 1, payload: { plannedMeetingId: 'plan-1', runId: 'run-1', status: 'completed' } }));
    await settle();
    await settle();
    expect(textOf(root)).toContain('The roadmap moves the launch to March.');
  });
});
