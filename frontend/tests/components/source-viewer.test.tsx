import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import type { ReactElement } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import type { DocumentPassage, DocumentVersionView } from '../../src/lib/document-service';

type Responder = (args: Record<string, unknown>) => unknown;
type TauriWindow = { __TAURI_INTERNALS__: { invoke: typeof ipc } };

const globalWithDom = globalThis as { window?: TauriWindow; document?: unknown };
const originalWindow = globalWithDom.window;
const originalDocument = globalWithDom.document;
let openLayer: object | null = null;
const keyTarget = Object.assign(new EventTarget(), { querySelector: () => openLayer });

let responses: Record<string, Responder> = {};
const ipc = mock(async (command: string, args: Record<string, unknown> = {}): Promise<unknown> => {
  const respond = responses[command];
  if (!respond) throw new Error(`Unexpected command: ${command}`);
  return respond(args);
});

const { SourceViewer } = await import('../../src/components/preparation/source-viewer');

beforeAll(() => {
  globalWithDom.window = { __TAURI_INTERNALS__: { invoke: ipc } };
  globalWithDom.document = keyTarget;
});
afterAll(() => {
  globalWithDom.window = originalWindow;
  globalWithDom.document = originalDocument;
});

const passage = (ordinal: number, text: string, locator: Record<string, unknown>): DocumentPassage => ({
  id: `p-${ordinal}`,
  versionId: 'v-2',
  ordinal,
  locatorJson: JSON.stringify(locator),
  text,
  contentHash: `h-${ordinal}`,
});

const markdownView = (overrides: Partial<DocumentVersionView> = {}): DocumentVersionView => ({
  document: { id: 'd-1', title: 'Q1 roadmap', format: 'markdown', availability: 'available', createdUtc: '2026-10-24T08:00:00.000Z' },
  version: {
    id: 'v-2',
    documentId: 'd-1',
    version: 2,
    sha256: 'a'.repeat(64),
    byteSize: 120,
    charCount: 120,
    parserVersion: 'markdown-1',
    extractionStatus: 'extracted',
    failureCode: null,
    managedPath: null,
    createdUtc: '2026-10-24T08:00:00.000Z',
  },
  latestVersion: 2,
  passages: [
    passage(0, 'Ship the importer first.', { kind: 'section', heading_path: ['Goals'], paragraph: 0, start: 10, end: 34 }),
    passage(1, 'Hire two engineers by March.', { kind: 'section', heading_path: ['Goals', 'Hiring'], paragraph: 1, start: 46, end: 74 }),
    passage(2, 'Budget is flat.', { kind: 'section', heading_path: ['Risks'], paragraph: 2, start: 84, end: 99 }),
  ],
  ...overrides,
});

let renderer: ReactTestRenderer;

async function render(element: ReactElement) {
  await act(async () => {
    renderer = create(element, { createNodeMock: () => ({ scrollIntoView: () => {} }) });
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

const text = (node: ReactTestInstance): string =>
  node.children.map((child) => (typeof child === 'string' ? child : text(child))).join('');
const marks = () => renderer.root.findAll((node) => node.type === 'mark');
const content = () => JSON.stringify(renderer.toJSON());

function pressEscape() {
  const event = Object.assign(new Event('keydown', { cancelable: true }), { key: 'Escape' });
  act(() => {
    keyTarget.dispatchEvent(event);
  });
  return event;
}

beforeEach(() => {
  openLayer = null;
  ipc.mockClear();
  responses = { documents_get_version: () => markdownView() };
});

afterEach(() => {
  act(() => renderer.unmount());
});

describe('SourceViewer', () => {
  test('opening with a locator highlights exactly the passage text from documents_get_version', async () => {
    await render(<SourceViewer target={{ versionId: 'v-2', locator: { start: 46, end: 74 } }} onClose={() => {}} />);

    expect(ipc.mock.calls.map(([command, args]) => [command, args])).toEqual([['documents_get_version', { versionId: 'v-2' }]]);
    expect(marks().map(text)).toEqual(['Hire two engineers by March.']);
    expect(content()).toContain('Ship the importer first.');
    expect(content()).toContain('Budget is flat.');
  });

  test('a locator spanning two passages highlights both', async () => {
    await render(<SourceViewer target={{ versionId: 'v-2', locator: { start: 20, end: 60 } }} onClose={() => {}} />);

    expect(marks().map(text)).toEqual(['Ship the importer first.', 'Hire two engineers by March.']);
  });

  test('switching to another version never shows the previous one', async () => {
    let resolveSecond: (view: DocumentVersionView) => void = () => {};
    await render(<SourceViewer target={{ versionId: 'v-2' }} onClose={() => {}} />);
    responses.documents_get_version = () => new Promise<DocumentVersionView>((resolve) => (resolveSecond = resolve));

    await act(async () => {
      renderer.update(<SourceViewer target={{ versionId: 'v-1' }} onClose={() => {}} />);
    });
    expect(content()).not.toContain('Ship the importer first.');

    await act(async () => {
      resolveSecond(markdownView({ passages: [passage(0, 'Older plan.', { kind: 'section', heading_path: [], paragraph: 0, start: 0, end: 11 })] }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(content()).toContain('Older plan.');
  });

  test('reopening the same version reads it again', async () => {
    const onClose = () => {};
    await render(<SourceViewer target={{ versionId: 'v-2' }} onClose={onClose} />);
    await act(async () => {
      renderer.update(<SourceViewer target={null} onClose={onClose} />);
    });
    responses.documents_get_version = () => markdownView({ document: { ...markdownView().document, availability: 'deleted' } });

    await act(async () => {
      renderer.update(<SourceViewer target={{ versionId: 'v-2' }} onClose={onClose} />);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(ipc).toHaveBeenCalledTimes(2);
    expect(content()).toContain('This source was deleted');
    expect(content()).not.toContain('Ship the importer');
  });

  test('shows the section headings of a Markdown source', async () => {
    await render(<SourceViewer target={{ versionId: 'v-2' }} onClose={() => {}} />);

    const headings = renderer.root.findAll((node) => node.type === 'h3' || node.type === 'h4').map(text);
    expect(headings).toEqual(['Goals', 'Hiring', 'Risks']);
    expect(marks()).toHaveLength(0);
  });

  test('labels an older version with its number out of the latest', async () => {
    responses.documents_get_version = () =>
      markdownView({ version: { ...markdownView().version, id: 'v-1', version: 1 }, latestVersion: 3 });
    await render(<SourceViewer target={{ versionId: 'v-1' }} onClose={() => {}} />);

    expect(content()).toContain('Version 1 of 3');
  });

  test('the latest version has no version label', async () => {
    await render(<SourceViewer target={{ versionId: 'v-2' }} onClose={() => {}} />);

    expect(content()).not.toContain('Version 2 of 2');
  });

  test('a deleted source says so and shows no text', async () => {
    responses.documents_get_version = () =>
      markdownView({ document: { ...markdownView().document, availability: 'deleted' } });
    await render(<SourceViewer target={{ versionId: 'v-2', locator: { start: 46, end: 74 } }} onClose={() => {}} />);

    expect(content()).toContain('This source was deleted');
    expect(content()).not.toContain('Hire two engineers');
    expect(content()).not.toContain('Ship the importer');
  });

  test('a failed load offers a retry', async () => {
    let calls = 0;
    responses.documents_get_version = () => {
      calls += 1;
      if (calls === 1) throw 'STORAGE_FAILED';
      return markdownView();
    };
    await render(<SourceViewer target={{ versionId: 'v-2' }} onClose={() => {}} />);
    expect(content()).toContain("Couldn't open this source.");

    const retry = renderer.root.find((node) => node.type === 'button' && text(node) === 'Try again');
    await act(async () => {
      retry.props.onClick();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(content()).toContain('Ship the importer first.');
  });

  test('Escape closes only the drawer', async () => {
    const onClose = mock(() => {});
    const page = mock(() => {});
    await render(<SourceViewer target={{ versionId: 'v-2' }} onClose={onClose} />);
    keyTarget.addEventListener('keydown', page);

    const event = pressEscape();

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(page).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);
    keyTarget.removeEventListener('keydown', page);
  });

  test('Escape leaves the drawer open while a dialog above it is open', async () => {
    const onClose = mock(() => {});
    const dialog = mock(() => {});
    await render(<SourceViewer target={{ versionId: 'v-2' }} onClose={onClose} />);
    keyTarget.addEventListener('keydown', dialog);
    openLayer = {};

    pressEscape();

    expect(onClose).not.toHaveBeenCalled();
    expect(dialog).toHaveBeenCalledTimes(1);
    keyTarget.removeEventListener('keydown', dialog);
  });

  test('Escape does nothing while closed', async () => {
    const onClose = mock(() => {});
    const page = mock(() => {});
    await render(<SourceViewer target={null} onClose={onClose} />);
    keyTarget.addEventListener('keydown', page);

    pressEscape();

    expect(onClose).not.toHaveBeenCalled();
    expect(page).toHaveBeenCalledTimes(1);
    expect(ipc).not.toHaveBeenCalled();
    keyTarget.removeEventListener('keydown', page);
  });
});
