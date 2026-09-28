import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import { useEffect, type ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import type {
  EvidenceLinkView,
  KnowledgeItemHistory,
  KnowledgeItemView,
  KnowledgeRunView,
} from '../../src/lib/knowledge-service';

type Responder = (args: Record<string, unknown>) => unknown;
type TestWindow = Record<string, unknown>;

const globalWithWindow = globalThis as typeof globalThis & { window?: TestWindow };
const originalWindow = globalWithWindow.window;
const originalTimeZone = process.env.TZ;
let responses: Record<string, Responder> = {};

const ipc = mock(async (command: string, args: Record<string, unknown> = {}): Promise<unknown> => {
  const respond = responses[command];
  if (!respond) throw new Error(`Unexpected command: ${command}`);
  return respond(args);
});

const originalPopover = { ...await import('../../src/components/ui/popover') };
mock.module('../../src/components/ui/popover', () => ({
  Popover: ({ children, onOpenChange }: { children: ReactNode; onOpenChange?: (open: boolean) => void }) => {
    useEffect(() => onOpenChange?.(true), [onOpenChange]);
    return <>{children}</>;
  },
  PopoverTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  PopoverAnchor: ({ children }: { children: ReactNode }) => <>{children}</>,
  PopoverArrow: () => null,
  PopoverContent: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div data-popover="" className={className}>{children}</div>
  ),
}));

const { SourceChip } = await import('../../src/components/living-doc/source-chip');
const { EvidencePopover } = await import('../../src/components/living-doc/evidence-popover');
const { HistoryPopover } = await import('../../src/components/living-doc/history-popover');
const { EvidenceNavigationContext, useEvidenceDrawer } = await import('../../src/components/living-doc/meeting-page');

beforeAll(() => {
  process.env.TZ = 'UTC';
  globalWithWindow.window = { __TAURI_INTERNALS__: { invoke: ipc } };
});

afterAll(() => {
  process.env.TZ = originalTimeZone;
  globalWithWindow.window = originalWindow;
  mock.module('../../src/components/ui/popover', () => originalPopover);
});

const link = (overrides: Partial<EvidenceLinkView> = {}): EvidenceLinkView => ({
  linkId: 'link-1',
  evidenceId: 'evidence-1',
  role: 'claim',
  quoteText: 'We ship the beta on Friday',
  rawStart: 4,
  rawEnd: 30,
  sequence: 1,
  audioStartTime: 65,
  audioEndTime: 70,
  segmentCaptureIncomplete: false,
  ...overrides,
});

const item = (overrides: Partial<KnowledgeItemView> = {}): KnowledgeItemView => ({
  itemId: 'a1b2c3d4-0000-4000-8000-000000000001',
  meetingId: 'meeting-a',
  originRunId: 'run-1',
  itemType: 'decision',
  text: 'Ship the beta on Friday',
  ownerText: null,
  ownerSupport: 'not_stated',
  dueText: null,
  dueSupport: 'not_stated',
  reviewState: 'proposed',
  eligibility: false,
  evidenceStatus: 'valid',
  corrected: false,
  latestRevisionId: null,
  unresolved: false,
  createdAtUtc: '2026-09-27T10:46:00Z',
  evidence: [link()],
  ...overrides,
});

const run: KnowledgeRunView = {
  runId: 'run-1',
  meetingId: 'meeting-a',
  triggerKind: 'auto',
  status: 'succeeded',
  providerId: 'ollama',
  modelId: 'llama3',
  locationClass: 'lan',
  sanitizedOrigin: 'http://192.168.1.20:11434',
  promptVersion: 'v1',
  inputEvidenceCount: 12,
  proposedCount: 3,
  skippedCount: 0,
  suppressedCount: 0,
  reconfirmedCount: 0,
  duplicateCount: 0,
  failureCode: null,
  startedAtUtc: '2026-09-27T10:46:00Z',
  finishedAtUtc: '2026-09-27T10:47:00Z',
};

const openEvidence = mock((_links: EvidenceLinkView[]) => {});
let renderer: ReactTestRenderer;
const textOf = (node: ReactTestInstance): string =>
  node.children.map((child) => (typeof child === 'string' ? child : textOf(child))).join('');
const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });

async function render(element: ReactNode) {
  await act(async () => {
    renderer = create(
      <EvidenceNavigationContext.Provider value={{ meetingStartedAt: '2026-09-22T09:00:00Z', openEvidence }}>
        {element}
      </EvidenceNavigationContext.Provider>,
    );
  });
  await settle();
}

const chip = () => renderer.root.find((node) => node.type === 'button' && String(node.props['aria-label']).startsWith('Source:'));
const buttonNamed = (label: string) => renderer.root.find((node) => node.type === 'button' && textOf(node) === label);
const alerts = () => renderer.root.findAll((node) => node.type === 'svg' && node.props['data-evidence-alert'] !== undefined);

beforeEach(() => {
  ipc.mockClear();
  openEvidence.mockClear();
  responses = {};
});

describe('SourceChip', () => {
  test('formats the first claim link as m:ss or h:mm:ss and names the source', async () => {
    await render(<SourceChip item={item({ evidence: [link({ audioStartTime: 3723 })] })} />);
    expect(textOf(chip())).toBe('1:02:03');
    expect(chip().props['aria-label']).toBe('Source: Sep 22, 1:02:03');

    await render(<SourceChip item={item()} />);
    expect(textOf(chip())).toBe('1:05');

    await render(<SourceChip item={item({ evidence: [link(), link({ linkId: 'link-2', evidenceId: 'evidence-2', audioStartTime: 80 })] })} />);
    expect(textOf(chip())).toBe('1:05+1');
  });

  test('shows the alert glyph only for changed or missing evidence', async () => {
    await render(<SourceChip item={item({ evidenceStatus: 'changed' })} />);
    expect(alerts().map((node) => node.props['data-evidence-alert'])).toEqual(['changed']);

    await render(<SourceChip item={item({ evidenceStatus: 'missing' })} />);
    expect(alerts().map((node) => node.props['data-evidence-alert'])).toEqual(['missing']);

    await render(<SourceChip item={item()} />);
    expect(alerts()).toHaveLength(0);
  });
});

describe('EvidencePopover', () => {
  test('shows the verified quote, the run, gaps and changed evidence inside a scrolling 60vh popover', async () => {
    const longQuote = 'word '.repeat(120).trim();
    await render(
      <EvidencePopover
        item={item({ evidenceStatus: 'changed', evidence: [link({ quoteText: longQuote, segmentCaptureIncomplete: true })] })}
        run={run}
      >
        <SourceChip item={item()} />
      </EvidencePopover>,
    );
    const quote = renderer.root.findByType('blockquote');
    expect(textOf(quote)).toBe(`“${longQuote}”`);
    const text = textOf(renderer.root);
    expect(text).toContain('EVIDENCE · Sep 22 · 1:05');
    expect(text).toContain('Found Sep 27, 10:46 · LAN');
    expect(text).toContain('Captured with gaps around this line');
    expect(text).toContain('This line has changed since Telu quoted it.');
    const content = renderer.root.find((node) => node.props['data-popover'] === '');
    expect(content.props.className).toContain('max-h-[60vh]');
    expect(content.props.className).toContain('overflow-y-auto');
  });

  test('missing evidence is never shown as current and cannot open the transcript', async () => {
    await render(
      <EvidencePopover item={item({ evidenceStatus: 'missing' })} run={run}>
        <SourceChip item={item()} />
      </EvidencePopover>,
    );
    expect(textOf(renderer.root)).toContain('This line is no longer in the transcript.');
    expect(renderer.root.findAll((node) => node.type === 'button' && textOf(node) === 'Open transcript')).toHaveLength(0);
  });

  test('Open transcript opens the claim links; the page drawer highlights their spans and centres the first line', async () => {
    const claim = link();
    const second = link({ linkId: 'link-2', evidenceId: 'evidence-2', rawStart: 0, rawEnd: 9 });
    const owner = link({ linkId: 'link-3', evidenceId: 'evidence-3', role: 'owner' });
    await render(
      <EvidencePopover item={item({ evidence: [claim, second, owner] })} run={run}>
        <SourceChip item={item()} />
      </EvidencePopover>,
    );
    await act(async () => buttonNamed('Open transcript').props.onClick());
    expect(openEvidence).toHaveBeenCalledWith([claim, second]);

    let drawer!: ReturnType<typeof useEvidenceDrawer>;
    const scrollToEvidence = mock((_evidenceId: string) => {});
    function DrawerHarness() {
      drawer = useEvidenceDrawer(null);
      return null;
    }
    await act(async () => { renderer = create(<DrawerHarness />); });
    (drawer.drawerRef as { current: unknown }).current = { scrollToEvidence };
    expect(drawer.drawerOpen).toBe(false);

    await act(async () => drawer.openEvidence([claim, second]));
    expect(drawer.drawerOpen).toBe(true);
    expect(drawer.highlight).toEqual({
      evidenceIds: ['evidence-1', 'evidence-2'],
      spans: [
        { evidenceId: 'evidence-1', start: 4, end: 30 },
        { evidenceId: 'evidence-2', start: 0, end: 9 },
      ],
    });
    expect(scrollToEvidence).toHaveBeenCalledWith('evidence-1');
  });
});

describe('HistoryPopover', () => {
  const history = (overrides: Partial<KnowledgeItemHistory> = {}): KnowledgeItemHistory => ({
    itemId: 'a1b2c3d4-0000-4000-8000-000000000001',
    originRunId: 'run-1',
    runStartedAtUtc: '2026-09-27T10:46:00Z',
    original: { text: 'Ship the beta Friday', ownerText: null, dueText: null, createdAtUtc: '2026-09-27T10:46:00Z' },
    revisions: [
      { revisionId: 'rev-2', basedOnRevisionId: 'rev-1', text: 'Ship the beta on Friday', ownerText: 'Maria', dueText: 'by Friday', createdAtUtc: '2026-09-27T11:05:00Z' },
      { revisionId: 'rev-1', basedOnRevisionId: null, text: 'Ship the beta on Friday', ownerText: 'Maria', dueText: null, createdAtUtc: '2026-09-27T10:52:00Z' },
    ],
    reviews: [],
    evidence: [link()],
    ...overrides,
  });

  const renderHistory = (target = item({ corrected: true })) =>
    render(
      <HistoryPopover meetingId="meeting-a" item={target}>
        <button type="button">Corrected</button>
      </HistoryPopover>,
    );

  test('lists the proposal, each correction oldest first with field diffs, unchanged evidence and the item id', async () => {
    responses.knowledge_item_history = (args) => {
      expect(args).toEqual({ meetingId: 'meeting-a', itemId: 'a1b2c3d4-0000-4000-8000-000000000001' });
      return history();
    };
    await renderHistory();
    const entries = renderer.root.findAllByType('li').map(textOf);
    expect(entries).toEqual([
      'Proposed by Telu · Sep 27, 10:46Ship the beta Friday',
      'Corrected by you · Sep 27, 10:52Ship the beta on FridayOwner: Maria (was not stated)',
      'Corrected by you · Sep 27, 11:05Ship the beta on FridayDue: by Friday (was not stated)',
    ]);
    const text = textOf(renderer.root);
    expect(text).toContain('Evidence unchanged');
    expect(text).toContain('ID a1b2c3d4 · run of Sep 27, 10:46');
    expect(chip().props['aria-label']).toBe('Source: Sep 22, 1:05');
  });

  test('shows skeletons while loading and a retry after a failure', async () => {
    responses.knowledge_item_history = () => new Promise(() => {});
    await renderHistory();
    expect(renderer.root.findAll((node) => node.props['aria-busy'] === true)).toHaveLength(1);

    const error = console.error;
    console.error = () => {};
    let calls = 0;
    responses.knowledge_item_history = () => {
      calls += 1;
      if (calls === 1) throw 'database locked';
      return history({ revisions: [] });
    };
    await renderHistory();
    console.error = error;
    expect(textOf(renderer.root)).toContain("Couldn't load the history.");

    await act(async () => buttonNamed('Try again').props.onClick());
    await settle();
    expect(calls).toBe(2);
    expect(renderer.root.findAllByType('li').map(textOf)).toEqual(['Proposed by Telu · Sep 27, 10:46Ship the beta Friday']);
  });

  test('renders markup-looking history text verbatim', async () => {
    responses.knowledge_item_history = () =>
      history({
        original: { text: '<b>Ship</b> it', ownerText: '<img src=x onerror=alert(1)>', dueText: null, createdAtUtc: '2026-09-27T10:46:00Z' },
        revisions: [],
      });
    await renderHistory();
    const text = textOf(renderer.root);
    expect(text).toContain('<b>Ship</b> it');
    expect(text).toContain('Owner: <img src=x onerror=alert(1)>');
    expect(renderer.root.findAll((node) => node.type === 'b' || node.type === 'img')).toHaveLength(0);
  });
});
