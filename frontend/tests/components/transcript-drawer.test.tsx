import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import { createRef, type ReactElement } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import type { TranscriptDrawerHandle } from '../../src/components/living-doc/transcript-drawer';

type TauriWindow = { __TAURI_INTERNALS__: { invoke: typeof ipcInvoke } };

const globalWithWindow = globalThis as typeof globalThis & { window?: TauriWindow };
const originalWindow = globalWithWindow.window;

let readEvidence: () => Promise<unknown[]> = async () => [];
let legacyLines: unknown[] = [];
const ipcInvoke = mock(async (command: string, args?: Record<string, unknown>): Promise<unknown> => {
  if (command === 'knowledge_list_evidence') return readEvidence();
  if (command === 'api_get_meeting_metadata') {
    return { id: args?.meetingId, title: 'Legacy', created_at: '', updated_at: '', lifecycle: 'complete', completeness: 'complete' };
  }
  if (command === 'api_get_meeting_transcripts') {
    return { transcripts: legacyLines, total_count: legacyLines.length, has_more: false };
  }
  throw new Error(`Unexpected command: ${command}`);
});
const { TranscriptDrawer } = await import('../../src/components/living-doc/transcript-drawer');

beforeAll(() => {
  globalWithWindow.window = { __TAURI_INTERNALS__: { invoke: ipcInvoke } };
});
afterAll(() => {
  globalWithWindow.window = originalWindow;
});

const segment = (sequence: number, text: string, captureCompleteness = 'complete') => ({
  evidenceId: `S${sequence}`,
  sequence,
  text,
  audioStartTime: sequence * 8,
  audioEndTime: sequence * 8 + 6,
  captureCompleteness,
});

function scrollElementMock() {
  const listeners: Array<() => void> = [];
  const defaultView = {
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
    requestAnimationFrame: (callback: () => void) => globalThis.setTimeout(callback, 0),
    cancelAnimationFrame: (id: ReturnType<typeof setTimeout>) => globalThis.clearTimeout(id),
  };
  const element = {
    scrollTop: 0,
    scrollLeft: 0,
    offsetWidth: 340,
    offsetHeight: 600,
    clientWidth: 340,
    clientHeight: 600,
    scrollWidth: 340,
    scrollHeight: 1_000_000,
    ownerDocument: { defaultView },
    addEventListener: (_type: string, listener: () => void) => listeners.push(listener),
    removeEventListener: () => {},
    scrollTo: ({ top }: { top: number }) => {
      element.scrollTop = top;
      listeners.forEach((listener) => listener());
    },
  };
  return element;
}

let renderer: ReactTestRenderer;

async function render(element: ReactElement) {
  const scroller = scrollElementMock();
  await act(async () => {
    renderer = create(element, {
      createNodeMock: (node) => (node.props['data-slot'] === 'transcript-scroll' ? scroller : null),
    });
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

const lines = () =>
  renderer.root.findAll((node: ReactTestInstance) => typeof node.type === 'string' && node.props['data-line'] !== undefined);
const content = () => JSON.stringify(renderer.toJSON());

const drawer = (props: Partial<Parameters<typeof TranscriptDrawer>[0]> = {}, ref = createRef<TranscriptDrawerHandle>()) => (
  <TranscriptDrawer ref={ref} meetingId="meeting-a" title="Weekly product sync" open onClose={() => {}} highlight={null} {...props} />
);

beforeEach(() => {
  ipcInvoke.mockClear();
  readEvidence = async () => [];
  legacyLines = [];
});

describe('TranscriptDrawer', () => {
  test('renders evidence lines with times and marks partial capture', async () => {
    readEvidence = async () => [segment(0, 'Good morning everyone'), segment(1, 'We ship on Friday', 'incomplete'), segment(2, 'Any questions?')];

    await render(drawer());

    expect(lines()).toHaveLength(3);
    expect(content()).toContain('00:08');
    expect(content()).toContain('Partial capture');
    expect(content()).toContain('Stored on this Mac · evidence highlighted');
    expect(renderer.root.findByProps({ role: 'complementary' }).props['aria-label']).toBe('Transcript');
  });

  test('falls back to legacy lines read-only, or shows the empty copy when both are empty', async () => {
    legacyLines = [{ id: 'legacy-1', text: 'Imported line', timestamp: '00:00', audio_start_time: 3 }];
    await render(drawer());
    expect(content()).toContain('Transcript only · no evidence');
    expect(content()).toContain('Imported line');

    legacyLines = [];
    await render(drawer());
    expect(content()).toContain('No transcript lines yet.');
  });

  test('shows skeleton lines while loading and a retry after a failure', async () => {
    let fail!: (error: Error) => void;
    readEvidence = () => new Promise((_resolve, reject) => { fail = reject; });
    await render(drawer());
    expect(renderer.root.findAll((node: ReactTestInstance) => node.props['aria-busy'] === true).length).toBeGreaterThan(0);

    await act(async () => fail(new Error('Evidence unavailable')));
    expect(content()).toContain("Couldn't load the transcript.");

    readEvidence = async () => [segment(0, 'Recovered line')];
    const retry = renderer.root.find((node: ReactTestInstance) => node.type === 'button' && node.props.children === 'Try again');
    await act(async () => retry.props.onClick());
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(content()).toContain('Recovered line');
  });

  test('highlights the cited line and wraps only the quoted characters in a mark', async () => {
    readEvidence = async () => [segment(0, 'Good morning'), segment(1, 'We decided to ship the beta on Friday.'), segment(2, 'Thanks')];

    await render(drawer({ highlight: { evidenceIds: ['S1'], spans: [{ evidenceId: 'S1', start: 3, end: 22 }] } }));

    const cited = lines().find((node) => node.props['data-line'] === 'S1')!;
    expect(String(cited.props.className)).toContain('bg-accent-soft');
    const mark = cited.findByType('mark');
    expect(mark.props.children).toBe('decided to ship the');
    expect(String(lines().find((node) => node.props['data-line'] === 'S0')!.props.className)).not.toContain('bg-accent-soft');
  });

  test('virtualizes long meetings and scrolls a cited line into the rendered window', async () => {
    readEvidence = async () => Array.from({ length: 1500 }, (_, index) => segment(index, `Line ${index}`));
    const ref = createRef<TranscriptDrawerHandle>();

    await render(drawer({}, ref));
    expect(lines().length).toBeLessThan(100);
    expect(lines().some((node) => node.props['data-line'] === 'S1200')).toBe(false);

    await act(async () => {
      ref.current!.scrollToEvidence('S1200');
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(lines().some((node) => node.props['data-line'] === 'S1200')).toBe(true);
  });
});
