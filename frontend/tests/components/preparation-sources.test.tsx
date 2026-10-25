import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import type { ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import type { DocumentSummary, DocumentVersion } from '../../src/lib/document-service';
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

const originalDialog = { ...await import('../../src/components/ui/dialog') };
const Passthrough = ({ children }: { children?: ReactNode }) => <>{children}</>;
mock.module('../../src/components/ui/dialog', () => ({
  ...originalDialog,
  Dialog: ({ open, children }: { open: boolean; children?: ReactNode }) => (open ? <div role="dialog">{children}</div> : null),
  DialogContent: Passthrough,
  DialogHeader: Passthrough,
  DialogFooter: Passthrough,
  DialogTitle: ({ children }: { children?: ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children?: ReactNode }) => <p>{children}</p>,
}));

const { SourcesPanel } = await import('../../src/components/preparation/sources-panel');

const summary = (id: string, overrides: Partial<DocumentSummary> = {}): DocumentSummary => ({
  id,
  title: `Doc ${id}`,
  format: 'markdown',
  availability: 'available',
  createdUtc: '2026-10-24T08:00:00.000Z',
  latestVersionId: `${id}-v1`,
  latestVersion: 1,
  extractionStatus: 'extracted',
  failureCode: null,
  byteSize: 2048,
  ...overrides,
});

const version = (id: string, overrides: Partial<DocumentVersion> = {}): DocumentVersion => ({
  id,
  documentId: 'd-new',
  version: 1,
  sha256: 'a'.repeat(64),
  byteSize: 12,
  charCount: 12,
  parserVersion: 'paste-text-1',
  extractionStatus: 'extracted',
  failureCode: null,
  managedPath: null,
  createdUtc: '2026-10-24T08:00:00.000Z',
  ...overrides,
});

const KNOWLEDGE: SelectedSource = { kind: 'knowledge', meetingId: 'm-1', itemId: 'k-1' };
let renderer: ReactTestRenderer | null = null;
const openSource = mock((_versionId: string) => {});

beforeAll(() => {
  globalWithWindow.window = { __TAURI_INTERNALS__: { invoke: ipc } };
});

afterAll(() => {
  globalWithWindow.window = originalWindow;
  mock.module('../../src/components/ui/dialog', () => originalDialog);
});

beforeEach(() => {
  ipc.mockClear();
  openSource.mockClear();
  responses = {
    documents_list: () => [],
    prep_list_sources: () => [],
    api_get_meetings: () => [],
    prep_select_sources: (args) => args.sources,
  };
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
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
    renderer = create(<SourcesPanel plannedMeetingId="plan-1" onOpenSource={openSource} />);
  });
  await settle();
  return renderer!.root;
}

function button(root: ReactTestInstance, label: string): ReactTestInstance {
  return root.find((node) => node.type === 'button' && (node.props['aria-label'] === label || textOf(node).trim() === label));
}

function byId(root: ReactTestInstance, id: string): ReactTestInstance {
  return root.find((node) => typeof node.type === 'string' && node.props.id === id);
}

async function paste(root: ReactTestInstance, title: string, text: string) {
  await act(async () => button(root, 'Paste').props.onClick());
  await act(async () => byId(root, 'paste-source-title').props.onChange({ target: { value: title } }));
  await act(async () => byId(root, 'paste-source-text').props.onChange({ target: { value: text } }));
  await act(async () => root.find((node) => node.type === 'form').props.onSubmit({ preventDefault() {} }));
  await settle();
}

const commands = () => ipc.mock.calls.map(([command, args]) => [command, args]);

describe('SourcesPanel', () => {
  test('clicking a source title opens its latest version', async () => {
    responses.documents_list = () => [summary('a', { title: 'Roadmap notes', latestVersion: 2, latestVersionId: 'a-v2' })];
    const root = await renderPanel();
    await act(async () => button(root, 'Roadmap notes').props.onClick());
    expect(openSource.mock.calls).toEqual([['a-v2']]);
  });

  test('with no sources it explains how to add one', async () => {
    const root = await renderPanel();
    expect(ipc).toHaveBeenCalledWith('prep_list_sources', { plannedMeetingId: 'plan-1' }, undefined);
    expect(textOf(root)).toContain('No sources yet.');
    expect(root.findAll((node) => node.type === 'li')).toHaveLength(0);
  });

  test('lists available sources with format, size, version and extraction status', async () => {
    responses.documents_list = () => [
      summary('a', { title: 'Roadmap notes', latestVersion: 2, latestVersionId: 'a-v2' }),
      summary('b', { title: 'Brief.txt', format: 'text', byteSize: 512, extractionStatus: 'failed', failureCode: 'EXTRACTION_FAILED' }),
      summary('c', { title: 'Gone', availability: 'deleted' }),
    ];
    responses.prep_list_sources = () => [{ kind: 'document', versionId: 'a-v2' }];
    const root = await renderPanel();
    const rows = root.findAll((node) => node.type === 'li');
    expect(rows.map(textOf)).toEqual([
      'MDRoadmap notesMarkdown · 2 KB · v2 · Ready',
      "TXTBrief.txtText · 512 B · v1 · Couldn't read text",
    ]);
    expect(button(root, 'Included in the brief: Roadmap notes').props['aria-pressed']).toBe(true);
    expect(button(root, "Couldn't read the text of this source, so it can't be included.").props.disabled).toBe(true);
  });

  test('paste submits documents_paste then prep_select_sources with the new version added', async () => {
    responses.prep_list_sources = () => [KNOWLEDGE];
    responses.documents_paste = () => version('v-new');
    const root = await renderPanel();
    responses.documents_list = () => [summary('d-new', { latestVersionId: 'v-new' })];
    await paste(root, 'Notes', 'Agenda for Tuesday');
    const calls = commands();
    const pasteAt = calls.findIndex(([command]) => command === 'documents_paste');
    const selectAt = calls.findIndex(([command]) => command === 'prep_select_sources');
    expect(calls[pasteAt]).toEqual(['documents_paste', { title: 'Notes', text: 'Agenda for Tuesday' }]);
    expect(selectAt).toBeGreaterThan(pasteAt);
    expect(calls[selectAt]).toEqual([
      'prep_select_sources',
      { plannedMeetingId: 'plan-1', sources: [KNOWLEDGE, { kind: 'document', versionId: 'v-new' }] },
    ]);
    expect(root.findAll((node) => node.props.role === 'dialog')).toHaveLength(0);
    expect(button(root, 'Included in the brief: Doc d-new').props['aria-pressed']).toBe(true);
  });

  test('a pasted source that could not be read is listed but not selected', async () => {
    responses.documents_paste = () => version('v-bad', { extractionStatus: 'failed', failureCode: 'EXTRACTION_FAILED' });
    const root = await renderPanel();
    await paste(root, 'Notes', 'bad\u0000text');
    expect(commands().some(([command]) => command === 'prep_select_sources')).toBe(false);
  });

  test('SOURCE_TOO_LARGE keeps the dialog open with its plain-language message', async () => {
    responses.documents_paste = () => {
      throw 'SOURCE_TOO_LARGE:MAX_SOURCE_BYTES';
    };
    const root = await renderPanel();
    await paste(root, 'Notes', 'x');
    expect(root.findAll((node) => node.props.role === 'dialog')).toHaveLength(1);
    const alert = byId(root, 'paste-source-error');
    expect(alert.props.role).toBe('alert');
    expect(textOf(alert)).toBe('This source is over 1 MB. Split it or paste a shorter part.');
    expect(byId(root, 'paste-source-text').props['aria-describedby']).toBe('paste-source-error');
    expect(commands().some(([command]) => command === 'prep_select_sources')).toBe(false);
  });

  test('an unsupported import shows its format message', async () => {
    responses.documents_import = () => {
      throw 'UNSUPPORTED_FORMAT';
    };
    const root = await renderPanel();
    await act(async () => button(root, 'Import').props.onClick());
    await settle();
    expect(textOf(root.find((node) => node.props.role === 'alert'))).toBe('Telu reads Markdown and plain text files only.');
  });

  test('a cancelled import changes nothing', async () => {
    responses.documents_import = () => null;
    const root = await renderPanel();
    await act(async () => button(root, 'Import').props.onClick());
    await settle();
    expect(commands().filter(([command]) => command === 'prep_select_sources' || command === 'documents_list')).toHaveLength(1);
    expect(root.findAll((node) => node.props.role === 'alert')).toHaveLength(0);
  });

  test('an imported source is selected', async () => {
    responses.documents_import = () => version('v-imp', { parserVersion: 'import-markdown-1' });
    const root = await renderPanel();
    await act(async () => button(root, 'Import').props.onClick());
    await settle();
    expect(commands().at(-1)).toEqual(['prep_select_sources', { plannedMeetingId: 'plan-1', sources: [{ kind: 'document', versionId: 'v-imp' }] }]);
  });

  test('include toggles call prep_select_sources with the new set', async () => {
    responses.documents_list = () => [summary('a'), summary('b')];
    responses.prep_list_sources = () => [{ kind: 'document', versionId: 'a-v1' }, KNOWLEDGE];
    const root = await renderPanel();

    await act(async () => button(root, 'Not included in the brief: Doc b').props.onClick());
    await settle();
    expect(commands().at(-1)).toEqual([
      'prep_select_sources',
      { plannedMeetingId: 'plan-1', sources: [{ kind: 'document', versionId: 'a-v1' }, KNOWLEDGE, { kind: 'document', versionId: 'b-v1' }] },
    ]);

    await act(async () => button(root, 'Included in the brief: Doc a').props.onClick());
    await settle();
    expect(commands().at(-1)).toEqual([
      'prep_select_sources',
      { plannedMeetingId: 'plan-1', sources: [KNOWLEDGE, { kind: 'document', versionId: 'b-v1' }] },
    ]);
    expect(button(root, 'Not included in the brief: Doc a').props['aria-pressed']).toBe(false);
  });

  test('two quick toggles both land, each on top of the other', async () => {
    responses.documents_list = () => [summary('a'), summary('b')];
    const root = await renderPanel();
    await act(async () => {
      button(root, 'Not included in the brief: Doc a').props.onClick();
      button(root, 'Not included in the brief: Doc b').props.onClick();
    });
    await settle();
    expect(commands().at(-1)).toEqual([
      'prep_select_sources',
      { plannedMeetingId: 'plan-1', sources: [{ kind: 'document', versionId: 'a-v1' }, { kind: 'document', versionId: 'b-v1' }] },
    ]);
  });

  test('a refused selection keeps the previous set and explains why', async () => {
    responses.documents_list = () => [summary('a')];
    responses.prep_select_sources = () => {
      throw 'SELECTION_TOO_LARGE';
    };
    const root = await renderPanel();
    await act(async () => button(root, 'Not included in the brief: Doc a').props.onClick());
    await settle();
    expect(button(root, 'Not included in the brief: Doc a').props['aria-pressed']).toBe(false);
    expect(textOf(root.find((node) => node.props.role === 'alert'))).toBe('A meeting can include up to 12 documents.');
  });
});
