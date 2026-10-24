import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import type { DocumentSummary } from '../../src/lib/document-service';

const ipcInvoke = mock(async (_command: string, _args?: unknown): Promise<unknown> => null);
const originalCore = { ...await import('@tauri-apps/api/core') };
mock.module('@tauri-apps/api/core', () => ({ ...originalCore, invoke: ipcInvoke }));
const service = await import('../../src/lib/document-service');

beforeAll(() => {
  mock.module('@tauri-apps/api/core', () => ({ ...originalCore, invoke: ipcInvoke }));
});

afterAll(() => {
  mock.module('@tauri-apps/api/core', () => originalCore);
});

beforeEach(() => {
  ipcInvoke.mockReset();
  ipcInvoke.mockImplementation(async () => null);
});

function lastCall() {
  const [command, args] = ipcInvoke.mock.calls.at(-1) ?? [];
  return [command, args ?? {}];
}

describe('document-service', () => {
  test('each wrapper invokes its command with camelCase arguments', async () => {
    await service.pasteDocument('Notes', 'Body');
    expect(lastCall()).toEqual(['documents_paste', { title: 'Notes', text: 'Body' }]);

    await service.importDocument();
    expect(lastCall()).toEqual(['documents_import', {}]);

    await service.listDocuments();
    expect(lastCall()).toEqual(['documents_list', {}]);

    await service.getDocumentVersion('v-1');
    expect(lastCall()).toEqual(['documents_get_version', { versionId: 'v-1' }]);

    await service.replaceDocument('d-1', { kind: 'paste', text: 'New' });
    expect(lastCall()).toEqual(['documents_replace', { documentId: 'd-1', source: { kind: 'paste', text: 'New' } }]);

    await service.replaceDocument('d-1', { kind: 'import' });
    expect(lastCall()).toEqual(['documents_replace', { documentId: 'd-1', source: { kind: 'import' } }]);

    await service.deleteDocument('d-1');
    expect(lastCall()).toEqual(['documents_delete', { documentId: 'd-1' }]);
  });

  test('a resolved command becomes an ok result with its value', async () => {
    const summaries: DocumentSummary[] = [{
      id: 'd-1',
      title: 'Notes',
      format: 'markdown',
      availability: 'available',
      createdUtc: '2026-10-25T08:00:00.000Z',
      latestVersionId: 'v-2',
      latestVersion: 2,
      extractionStatus: 'extracted',
      failureCode: null,
      byteSize: 120,
    }];
    ipcInvoke.mockImplementation(async () => summaries);

    expect(await service.listDocuments()).toEqual({ ok: true, value: summaries });
  });

  test('a rejected command becomes an error result carrying its code', async () => {
    ipcInvoke.mockImplementation(async () => {
      throw 'SOURCE_TOO_LARGE:MAX_SOURCE_BYTES';
    });

    expect(await service.pasteDocument('Notes', 'x')).toEqual({
      ok: false,
      code: 'SOURCE_TOO_LARGE:MAX_SOURCE_BYTES',
    });
  });
});
