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
const originalDropdown = { ...await import('../../src/components/ui/dropdown-menu') };
const originalRadix = { ...await import('radix-ui') };
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
mock.module('../../src/components/ui/dropdown-menu', () => ({
  DropdownMenu: Passthrough,
  DropdownMenuTrigger: Passthrough,
  DropdownMenuContent: ({ children }: { children?: ReactNode }) => <div data-menu="">{children}</div>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuItem: ({ children, onSelect }: { children?: ReactNode; onSelect?: () => void }) => (
    <button type="button" data-menu-item="" onClick={() => onSelect?.()}>{children}</button>
  ),
}));
mock.module('radix-ui', () => ({
  ...originalRadix,
  AlertDialog: {
    Root: ({ open, children }: { open: boolean; children?: ReactNode }) => (open ? <>{children}</> : null),
    Portal: Passthrough,
    Overlay: () => null,
    Content: ({ children }: { children?: ReactNode }) => <div role="alertdialog">{children}</div>,
    Title: ({ children }: { children?: ReactNode }) => <h2>{children}</h2>,
    Description: Passthrough,
    Cancel: Passthrough,
  },
}));

const { SourcesPanel } = await import('../../src/components/preparation/sources-panel');
const { DELETE_SOURCE_COPY, deleteSourceBody } = await import('../../src/components/preparation/delete-source-alert');

const ROADMAP: DocumentSummary = {
  id: 'd-1',
  title: 'Roadmap',
  format: 'markdown',
  availability: 'available',
  createdUtc: '2026-10-24T08:00:00.000Z',
  latestVersionId: 'v-1',
  latestVersion: 1,
  extractionStatus: 'extracted',
  failureCode: null,
  byteSize: 2048,
};

const V2: DocumentVersion = {
  id: 'v-2',
  documentId: 'd-1',
  version: 2,
  sha256: 'b'.repeat(64),
  byteSize: 20,
  charCount: 20,
  parserVersion: 'paste-text-1',
  extractionStatus: 'extracted',
  failureCode: null,
  managedPath: null,
  createdUtc: '2026-10-25T08:00:00.000Z',
};

const KNOWLEDGE: SelectedSource = { kind: 'knowledge', meetingId: 'm-1', itemId: 'k-1' };
let renderer: ReactTestRenderer | null = null;
const sourcesChanged = mock(() => {});

beforeAll(() => {
  globalWithWindow.window = { __TAURI_INTERNALS__: { invoke: ipc }, location: { href: 'http://localhost/', origin: 'http://localhost' } };
});

afterAll(() => {
  globalWithWindow.window = originalWindow;
  mock.module('../../src/components/ui/dialog', () => originalDialog);
  mock.module('../../src/components/ui/dropdown-menu', () => originalDropdown);
  mock.module('radix-ui', () => originalRadix);
});

beforeEach(() => {
  ipc.mockClear();
  sourcesChanged.mockClear();
  responses = {
    documents_list: () => [ROADMAP],
    prep_list_sources: () => [{ kind: 'document', versionId: 'v-1' }, KNOWLEDGE],
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
    renderer = create(<SourcesPanel plannedMeetingId="plan-1" onOpenSource={() => {}} onSourcesChanged={sourcesChanged} />);
  });
  await settle();
  return renderer!.root;
}

function button(root: ReactTestInstance, label: string): ReactTestInstance {
  return root.find((node) => node.type === 'button' && (node.props['aria-label'] === label || textOf(node).trim() === label));
}

async function click(root: ReactTestInstance, label: string) {
  await act(async () => button(root, label).props.onClick());
  await settle();
}

const calls = (command: string) => ipc.mock.calls.filter(([name]) => name === command).map(([, args]) => args);
const alert = (root: ReactTestInstance) => root.findAll((node) => node.props.role === 'alertdialog');

describe('deleting a source', () => {
  test('the alert states how many briefs cite the source and that its text is removed', async () => {
    responses.documents_delete_impact = () => 2;
    const root = await renderPanel();
    await click(root, 'Delete…');
    expect(calls('documents_delete_impact')).toEqual([{ documentId: 'd-1' }]);
    const body = textOf(alert(root)[0]);
    expect(body).toContain('Delete “Roadmap”?');
    expect(body).toContain('2 briefs cite this source.');
    expect(body).toContain('Its text will be removed from this Mac.');
  });

  test('confirming deletes, drops it from the selection and refreshes sources and the brief', async () => {
    responses.documents_delete_impact = () => 1;
    let deleted = false;
    responses.documents_delete = () => {
      deleted = true;
      return null;
    };
    responses.documents_list = () => (deleted ? [] : [ROADMAP]);
    const root = await renderPanel();
    await click(root, 'Delete…');
    await click(root, 'Delete');
    expect(calls('documents_delete')).toEqual([{ documentId: 'd-1' }]);
    expect(calls('prep_select_sources')).toEqual([{ plannedMeetingId: 'plan-1', sources: [KNOWLEDGE] }]);
    expect(sourcesChanged).toHaveBeenCalledTimes(1);
    expect(alert(root)).toHaveLength(0);
    expect(textOf(root)).toContain('No sources yet.');
  });

  test('an older selected version of the deleted document is dropped too', async () => {
    responses.prep_list_sources = () => [{ kind: 'document', versionId: 'v-0' }, KNOWLEDGE];
    responses.documents_get_version = (args) => ({ document: { id: args.versionId === 'v-0' ? 'd-1' : 'd-9' } });
    responses.documents_delete_impact = () => 0;
    responses.documents_delete = () => null;
    const root = await renderPanel();
    await click(root, 'Delete…');
    await click(root, 'Delete');
    expect(calls('documents_get_version')).toEqual([{ versionId: 'v-0' }]);
    expect(calls('prep_select_sources')).toEqual([{ plannedMeetingId: 'plan-1', sources: [KNOWLEDGE] }]);
  });

  test('a selected version of another document is kept on delete', async () => {
    responses.prep_list_sources = () => [{ kind: 'document', versionId: 'other-v1' }, KNOWLEDGE];
    responses.documents_get_version = () => ({ document: { id: 'd-9' } });
    responses.documents_delete_impact = () => 0;
    responses.documents_delete = () => null;
    const root = await renderPanel();
    await click(root, 'Delete…');
    await click(root, 'Delete');
    expect(calls('prep_select_sources')).toHaveLength(0);
    expect(sourcesChanged).toHaveBeenCalledTimes(1);
  });

  test('a failed impact query shows Retry and blocks Delete until it loads', async () => {
    let attempts = 0;
    responses.documents_delete_impact = () => {
      attempts += 1;
      if (attempts === 1) throw new Error('DOCUMENT_STORAGE_FAILED');
      return 0;
    };
    const root = await renderPanel();
    await click(root, 'Delete…');
    expect(textOf(alert(root)[0])).toContain(DELETE_SOURCE_COPY.impactFailed);
    expect(button(root, 'Delete').props.disabled).toBe(true);
    await click(root, 'Retry');
    expect(attempts).toBe(2);
    expect(textOf(alert(root)[0])).toContain('No brief cites this source.');
    expect(button(root, 'Delete').props.disabled).toBe(false);
    expect(calls('documents_delete')).toHaveLength(0);
  });

  test('a failed delete keeps the alert open and removes nothing', async () => {
    responses.documents_delete_impact = () => 0;
    responses.documents_delete = () => {
      throw new Error('DOCUMENT_STORAGE_FAILED');
    };
    const root = await renderPanel();
    await click(root, 'Delete…');
    await click(root, 'Delete');
    expect(textOf(alert(root)[0])).toContain(DELETE_SOURCE_COPY.deleteFailed);
    expect(sourcesChanged).not.toHaveBeenCalled();
    expect(calls('prep_select_sources')).toHaveLength(0);
  });

  test('the body counts briefs in the singular and plural', () => {
    expect(deleteSourceBody(1)).toStartWith('1 brief cites this source.');
    expect(deleteSourceBody(3)).toStartWith('3 briefs cite this source.');
  });
});

describe('replacing a source', () => {
  test('pasted text adds a new version, moves the selection to it and refreshes the brief', async () => {
    responses.documents_replace = () => V2;
    const root = await renderPanel();
    await click(root, 'Replace with pasted text…');
    expect(textOf(root.find((node) => node.props.role === 'dialog'))).toContain('Adds version 2.');
    expect(root.findAll((node) => node.props.id === 'paste-source-title')).toHaveLength(0);
    const textarea = root.find((node) => node.props.id === 'paste-source-text');
    await act(async () => textarea.props.onChange({ target: { value: 'New plan' } }));
    await act(async () => root.find((node) => node.type === 'form').props.onSubmit({ preventDefault() {} }));
    await settle();
    expect(calls('documents_replace')).toEqual([{ documentId: 'd-1', source: { kind: 'paste', text: 'New plan' } }]);
    expect(calls('prep_select_sources')).toEqual([
      { plannedMeetingId: 'plan-1', sources: [{ kind: 'document', versionId: 'v-2' }, KNOWLEDGE] },
    ]);
    expect(sourcesChanged).toHaveBeenCalledTimes(1);
    expect(root.findAll((node) => node.props.role === 'dialog')).toHaveLength(0);
  });

  test('a replace collapses every selected version of the document into the new one', async () => {
    responses.prep_list_sources = () => [{ kind: 'document', versionId: 'v-0' }, KNOWLEDGE, { kind: 'document', versionId: 'v-1' }];
    responses.documents_get_version = () => ({ document: { id: 'd-1' } });
    responses.documents_replace = () => V2;
    const root = await renderPanel();
    await click(root, 'Replace from a file…');
    expect(calls('prep_select_sources')).toEqual([
      { plannedMeetingId: 'plan-1', sources: [{ kind: 'document', versionId: 'v-2' }, KNOWLEDGE] },
    ]);
  });

  test('importing a file replaces it, and a cancelled file picker changes nothing', async () => {
    let picked: DocumentVersion | null = null;
    responses.documents_replace = () => picked;
    const root = await renderPanel();
    await click(root, 'Replace from a file…');
    expect(calls('documents_replace')).toEqual([{ documentId: 'd-1', source: { kind: 'import' } }]);
    expect(sourcesChanged).not.toHaveBeenCalled();
    picked = V2;
    await click(root, 'Replace from a file…');
    expect(sourcesChanged).toHaveBeenCalledTimes(1);
    expect(calls('prep_select_sources')).toHaveLength(1);
  });

  test('a rejected replace shows its error and leaves the selection alone', async () => {
    responses.documents_replace = () => {
      throw 'UNSUPPORTED_FORMAT';
    };
    const root = await renderPanel();
    await click(root, 'Replace from a file…');
    expect(textOf(root)).toContain('Telu reads Markdown and plain text files only.');
    expect(sourcesChanged).not.toHaveBeenCalled();
    expect(calls('prep_select_sources')).toHaveLength(0);
  });
});
