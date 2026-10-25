import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import type { ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import type { DocumentSummary } from '../../src/lib/document-service';
import type { BriefingClaim, PreparationRun, StoredBriefing } from '../../src/lib/preparation-service';

type Responder = (args: Record<string, unknown>) => unknown;

let responses: Record<string, Responder> = {};
let reducedMotion = false;
const ipc = mock(async (command: string, args: Record<string, unknown> = {}): Promise<unknown> => {
  const respond = responses[command];
  if (!respond) throw new Error(`Unexpected command: ${command}`);
  return respond(args);
});

const originalNavigation = { ...await import('next/navigation') };
const originalDropdown = { ...await import('../../src/components/ui/dropdown-menu') };
const originalMotion = { ...await import('framer-motion') };
const Passthrough = ({ children }: { children?: ReactNode }) => <>{children}</>;
mock.module('next/navigation', () => ({ ...originalNavigation, useRouter: () => ({ push: () => {} }) }));
mock.module('../../src/components/ui/dropdown-menu', () => ({
  DropdownMenu: Passthrough,
  DropdownMenuTrigger: Passthrough,
  DropdownMenuContent: () => null,
  DropdownMenuSeparator: () => null,
  DropdownMenuItem: () => null,
}));
mock.module('framer-motion', () => ({ ...originalMotion, useReducedMotion: () => reducedMotion }));

const { PreparationPage } = await import('../../src/components/preparation/preparation-page');

const LONG_TITLE = `Quarterly roadmap review with design, research and the partner team ${'to settle scope '.repeat(9)}`.slice(0, 200);
const MEETING_TITLE = `Roadmap sync ${'and planning '.repeat(20)}`.slice(0, 200);

const DOCUMENTS: DocumentSummary[] = Array.from({ length: 12 }, (_, index) => ({
  id: `d-${index + 1}`,
  title: index === 0 ? LONG_TITLE : `Source ${index + 1}`,
  format: 'markdown',
  availability: 'available',
  createdUtc: '2026-10-24T08:00:00.000Z',
  latestVersionId: `v-${index + 1}`,
  latestVersion: 1,
  extractionStatus: 'extracted',
  failureCode: null,
  byteSize: 2048,
}));

function claim(document: DocumentSummary): BriefingClaim {
  return {
    text: `A statement from ${document.id}.`,
    status: 'cited',
    sourceRef: `S${document.id}#0`,
    source: { kind: 'document', versionId: document.latestVersionId },
    passageId: 'p-1',
    locatorJson: '{"start":0,"end":10}',
    quote: 'q',
  };
}

const BRIEFING: StoredBriefing = {
  id: 'brief-1',
  promptVersion: 'prep-briefing-v3',
  createdUtc: '2026-10-25T14:02:00.000Z',
  droppedCount: 0,
  droppedQuestionCount: 0,
  stale: false,
  nothingUsed: false,
  manifest: DOCUMENTS.map((document) => ({
    source: { kind: 'document', versionId: document.latestVersionId },
    status: 'included',
    reason: 'WITHIN_BUDGET',
    tokens: 100,
  })),
  claims: DOCUMENTS.map(claim),
  questions: [],
} as StoredBriefing;

const LOCAL_ROUTE = {
  capability: 'summary',
  providerId: 'builtin-ai',
  modelId: 'qwen3.5:4b',
  locationClass: 'local',
  sanitizedOrigin: 'This device',
  encrypted: false,
  validationState: 'validated',
  resolvedAddresses: [],
};

function run(status: PreparationRun['status']): PreparationRun {
  return {
    id: 'run-1',
    plannedMeetingId: 'plan-1',
    status,
    providerId: 'builtin-ai',
    modelId: 'qwen3.5:4b',
    locationClass: 'local',
    sanitizedOrigin: 'This device',
    promptVersion: 'prep-briefing-v3',
    briefingId: status === 'completed' ? 'brief-1' : null,
    failureCode: null,
    startedUtc: '2026-10-25T14:00:00.000Z',
    finishedUtc: status === 'running' ? null : '2026-10-25T14:02:00.000Z',
  };
}

let renderer: ReactTestRenderer | null = null;
const globals = globalThis as unknown as { window?: unknown; document?: unknown };
const originalDocument = globals.document;
const originalWindow = globals.window;

beforeAll(() => {
  globals.window = Object.assign(new EventTarget(), {
    location: { href: 'http://localhost/preparation?id=plan-1' },
    __TAURI_INTERNALS__: { invoke: ipc, transformCallback: () => 1 },
    __TAURI_EVENT_PLUGIN_INTERNALS__: { unregisterListener: () => {} },
  });
  globals.document = new EventTarget();
});

afterAll(() => {
  globals.window = originalWindow;
  globals.document = originalDocument;
  mock.module('next/navigation', () => originalNavigation);
  mock.module('../../src/components/ui/dropdown-menu', () => originalDropdown);
  mock.module('framer-motion', () => originalMotion);
});

beforeEach(() => {
  reducedMotion = false;
  responses = {
    planning_get: () => ({
      id: 'plan-1',
      title: MEETING_TITLE,
      startUtc: null,
      purpose: '',
      createdUtc: '2026-10-24T08:00:00.000Z',
      updatedUtc: '2026-10-24T08:00:00.000Z',
    }),
    documents_list: () => DOCUMENTS,
    prep_list_sources: () => DOCUMENTS.map((document) => ({ kind: 'document', versionId: document.latestVersionId })),
    api_get_meetings: () => [],
    get_current_provider_route: () => LOCAL_ROUTE,
    prep_get_briefing: () => ({ run: run('completed'), briefing: BRIEFING }),
    documents_get_version: (args) => {
      const document = DOCUMENTS.find((candidate) => candidate.latestVersionId === args.versionId)!;
      return { document, version: { id: args.versionId, documentId: document.id, version: 1 }, latestVersion: 1, passages: [] };
    },
    'plugin:event|listen': () => 1,
    'plugin:event|unlisten': () => null,
  };
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
});

async function renderPage() {
  await act(async () => {
    renderer = create(<PreparationPage id="plan-1" />);
  });
  for (let pass = 0; pass < 3; pass += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
  return renderer!.root;
}

function textOf(node: ReactTestInstance): string {
  return node.children.map((child) => (typeof child === 'string' ? child : textOf(child))).join('');
}

function nameOf(node: ReactTestInstance): string {
  return node.props['aria-label'] ?? textOf(node);
}

const FOCUSABLE = new Set(['button', 'input', 'textarea', 'select']);

function tabStops(root: ReactTestInstance): ReactTestInstance[] {
  return root.findAll(
    (node) => typeof node.type === 'string' && FOCUSABLE.has(node.type) && !node.props.disabled && node.props.tabIndex !== -1,
  );
}

function hasVisibleFocus(node: ReactTestInstance): boolean {
  const className = String(node.props.className ?? '');
  return !/(^|\s)outline-none(\s|$)/.test(className) || /(^|\s)focus(-visible)?:/.test(className);
}

function stopIndex(stops: ReactTestInstance[], matches: (node: ReactTestInstance) => boolean): number {
  const index = stops.findIndex(matches);
  expect(index).toBeGreaterThanOrEqual(0);
  return index;
}

describe('preparation page edges', () => {
  test('keyboard reaches Paste, Import, every include toggle, Prepare and every source chip in order', async () => {
    const stops = tabStops(await renderPage());
    const names = stops.map(nameOf);
    const paste = stopIndex(stops, (node) => nameOf(node) === 'Paste');
    const importAt = stopIndex(stops, (node) => nameOf(node) === 'Import');
    const toggles = DOCUMENTS.map((document) =>
      stopIndex(stops, (node) => nameOf(node) === `Included in the brief: ${document.title}`),
    );
    const prepare = stopIndex(stops, (node) => nameOf(node) === 'Prepare again');
    const chips = DOCUMENTS.map((document) =>
      stopIndex(stops, (node) => node.props.title === document.title && nameOf(node).startsWith('Source: ')),
    );

    expect(paste).toBeLessThan(importAt);
    expect(importAt).toBeLessThan(toggles[0]);
    expect(toggles).toEqual([...toggles].sort((a, b) => a - b));
    expect(toggles[11]).toBeLessThan(prepare);
    expect(prepare).toBeLessThan(chips[0]);
    expect(chips).toEqual([...chips].sort((a, b) => a - b));
    expect(names.filter((name) => name.startsWith('Source: '))).toHaveLength(12);
    const unringed = stops.filter((node) => !hasVisibleFocus(node)).map(nameOf);
    expect(unringed).toEqual([]);
  });

  test('Stop is reachable by keyboard with a visible focus ring while preparing', async () => {
    responses.prep_get_briefing = () => ({ run: run('running'), briefing: null });
    const stops = tabStops(await renderPage());
    const stop = stops[stopIndex(stops, (node) => nameOf(node) === 'Stop')];
    expect(hasVisibleFocus(stop)).toBe(true);
  });

  test('long titles truncate and keep the full title in a tooltip', async () => {
    const root = await renderPage();
    const row = root.find((node) => node.type === 'button' && textOf(node) === LONG_TITLE);
    expect(row.props.title).toBe(LONG_TITLE);
    expect(row.props.className).toContain('truncate');
    const chip = root.find((node) => node.type === 'button' && node.props.title === LONG_TITLE && nameOf(node).startsWith('Source: '));
    expect(chip.findAll((node) => String(node.props.className ?? '').includes('truncate'))).not.toHaveLength(0);
    const title = root.find((node) => node.type === 'input' && node.props['aria-label'] === 'Meeting title');
    expect(title.props.title).toBe(MEETING_TITLE);
    const provenance = root.find((node) => node.type === 'p' && textOf(node).startsWith('Prepared from'));
    expect(textOf(provenance)).not.toContain(LONG_TITLE);
    expect(textOf(provenance)).toContain(`${LONG_TITLE.slice(0, 40)}`);
    expect(textOf(provenance)).toContain('Source 12');
    expect(provenance.props.title).toContain(LONG_TITLE);
  });

  test('the preparing spinner animates, and stops animating under reduced motion', async () => {
    responses.prep_get_briefing = () => ({ run: run('running'), briefing: null });
    const spinner = (root: ReactTestInstance) => root.find((node) => node.props['data-slot'] === 'spinner');

    expect(spinner(await renderPage()).props.className).toContain('animate-spin-ring');
    act(() => renderer?.unmount());

    reducedMotion = true;
    expect(spinner(await renderPage()).props.className).not.toContain('animate-spin-ring');
  });
});
