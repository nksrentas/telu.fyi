import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import type { ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import type { EffectiveRoute } from '../../src/services/providerRouteService';
import type { MeetingKnowledgeView } from '../../src/lib/knowledge-service';

const originalToast = { ...await import('sonner') };
const originalEvent = { ...await import('@tauri-apps/api/event') };
const originalCore = { ...await import('@tauri-apps/api/core') };
const originalPopover = { ...await import('../../src/components/ui/popover') };
const globalWithWindow = globalThis as typeof globalThis & { window?: Record<string, unknown> };
const originalWindow = globalWithWindow.window;
beforeAll(() => {
  globalWithWindow.window = { addEventListener: () => {}, removeEventListener: () => {} };
});
afterAll(() => {
  globalWithWindow.window = originalWindow;
  mock.module('sonner', () => originalToast);
  mock.module('@tauri-apps/api/event', () => originalEvent);
  mock.module('@tauri-apps/api/core', () => originalCore);
  mock.module('../../src/components/ui/popover', () => originalPopover);
});
mock.module('../../src/components/ui/popover', () => ({
  Popover: ({ children }: { children: ReactNode }) => <>{children}</>,
  PopoverTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  PopoverAnchor: ({ children }: { children: ReactNode }) => <>{children}</>,
  PopoverArrow: () => null,
  PopoverContent: ({ children }: { children: ReactNode }) => <div data-popover="">{children}</div>,
}));

const notify = mock(() => {});
mock.module('sonner', () => ({ toast: { info: notify, error: notify, success: notify, warning: notify } }));
const listeners = new Map<string, (event: { payload: unknown }) => void>();
mock.module('@tauri-apps/api/event', () => ({
  listen: async (name: string, handler: (event: { payload: unknown }) => void) => {
    listeners.set(name, handler);
    return () => listeners.delete(name);
  },
}));

const route = (validationState: EffectiveRoute['validationState']): EffectiveRoute => ({
  capability: 'summary',
  providerId: 'ollama',
  modelId: 'llama3',
  locationClass: validationState === 'validated' ? 'local' : null,
  sanitizedOrigin: validationState === 'validated' ? 'This device' : null,
  encrypted: false,
  validationState,
  resolvedAddresses: [],
});

const knowledge: MeetingKnowledgeView = {
  meetingId: 'meeting-a',
  latestRun: null,
  items: [{
    itemId: 'item-1',
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
    unresolved: true,
    createdAtUtc: '2026-09-28T00:00:00Z',
    evidence: [{
      linkId: 'link-1',
      evidenceId: 'evidence-2',
      role: 'claim',
      quoteText: '<b>ship the beta on Friday</b>',
      rawStart: 13,
      rawEnd: 36,
      sequence: 1,
      audioStartTime: 5,
      audioEndTime: 9,
      segmentCaptureIncomplete: false,
    }],
  }],
  rejected: [],
  pendingCount: 1,
  acceptedCount: 0,
  skippedCount: 0,
};

let currentRoute = route('validated');
let getMeeting: () => Promise<MeetingKnowledgeView> = async () => knowledge;
const invoke = mock(async (command: string): Promise<unknown> => {
  if (command === 'get_current_provider_route') return currentRoute;
  if (command === 'knowledge_get_meeting') return getMeeting();
  if (command === 'knowledge_list_runs') return [];
  if (command === 'validate_provider_route') return currentRoute;
  if (command === 'knowledge_cancel_extraction') return true;
  throw new Error(`Unexpected command: ${command}`);
});
mock.module('@tauri-apps/api/core', () => ({ invoke }));
const { KnowledgeSection } = await import('../../src/components/living-doc/knowledge-section');

const textOf = (node: ReactTestInstance): string =>
  node.children.map((child) => (typeof child === 'string' ? child : textOf(child))).join('');

async function renderSection() {
  let renderer: ReactTestRenderer | undefined;
  await act(async () => {
    renderer = create(<KnowledgeSection meetingId="meeting-a" />);
  });
  await act(async () => {});
  return renderer!;
}

const findKnowledgeButton = (renderer: ReactTestRenderer) =>
  renderer.root.find((node) => node.type === 'button' && textOf(node) === 'Find knowledge');

describe('KnowledgeSection', () => {
  beforeEach(() => {
    invoke.mockClear();
    currentRoute = route('validated');
    getMeeting = async () => knowledge;
  });

  test('ignores an older knowledge reply that arrives after a newer one', async () => {
    const pending: Array<(view: MeetingKnowledgeView) => void> = [];
    getMeeting = () => new Promise((resolve) => pending.push(resolve));
    const stale = { ...knowledge, items: [{ ...knowledge.items[0], itemId: 'item-stale', text: 'Stale reply' }] };
    const fresh = { ...knowledge, items: [{ ...knowledge.items[0], itemId: 'item-fresh', text: 'Fresh reply' }] };

    const renderer = await renderSection();
    await act(async () => {
      listeners.get('knowledge-updated')?.({ payload: { meetingId: 'meeting-a' } });
    });
    expect(pending).toHaveLength(2);
    await act(async () => pending[1](fresh));
    await act(async () => pending[0](stale));

    const itemIds = renderer.root.findAll((node) => typeof node.type === 'string' && node.props['data-item-id'] !== undefined)
      .map((node) => node.props['data-item-id']);
    expect(itemIds).toContain('item-fresh');
    expect(itemIds).not.toContain('item-stale');
  });

  test('renders the candidate row text and its evidence quote as plain text', async () => {
    const renderer = await renderSection();

    const row = renderer.root.find((node) => node.props['data-item-id'] === 'item-1');
    expect(row.findAll((node) => node.type === 'p' && textOf(node) === 'Ship the beta on Friday')).toHaveLength(1);
    const quote = renderer.root.find((node) => node.props['data-popover'] === '').findByType('blockquote');
    expect(textOf(quote)).toBe('“<b>ship the beta on Friday</b>”');
    expect(quote.children).toContain('<b>ship the beta on Friday</b>');
    expect(renderer.root.findAll((node) => node.type === 'b')).toHaveLength(0);
    expect(findKnowledgeButton(renderer).props.disabled).toBe(false);
  });

  test('disables Find knowledge while the Summary route is not validated', async () => {
    currentRoute = route('unavailable');

    const renderer = await renderSection();

    expect(findKnowledgeButton(renderer).props.disabled).toBe(true);
  });
});
