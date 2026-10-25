import { invoke } from '@tauri-apps/api/core';

export type DocumentFormat = 'text' | 'markdown';
export type DocumentAvailability = 'available' | 'deleted';
export type ExtractionStatus = 'pending' | 'extracted' | 'failed';

export interface DocumentInfo {
  id: string;
  title: string;
  format: DocumentFormat;
  availability: DocumentAvailability;
  createdUtc: string;
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  version: number;
  sha256: string;
  byteSize: number;
  charCount: number;
  parserVersion: string;
  extractionStatus: ExtractionStatus;
  failureCode: string | null;
  managedPath: string | null;
  createdUtc: string;
}

export interface DocumentSummary extends DocumentInfo {
  latestVersionId: string;
  latestVersion: number;
  extractionStatus: ExtractionStatus;
  failureCode: string | null;
  byteSize: number;
}

export interface DocumentPassage {
  id: string;
  versionId: string;
  ordinal: number;
  locatorJson: string;
  text: string;
  contentHash: string;
}

export interface DocumentVersionView {
  document: DocumentInfo;
  version: DocumentVersion;
  latestVersion: number;
  passages: DocumentPassage[];
}

export type ReplaceSource = { kind: 'paste'; text: string } | { kind: 'import' };

export type DocumentResult<T> = { ok: true; value: T } | { ok: false; code: string };

async function call<T>(command: string, args?: Record<string, unknown>): Promise<DocumentResult<T>> {
  try {
    return { ok: true, value: await invoke<T>(command, args) };
  } catch (error) {
    return { ok: false, code: String(error) };
  }
}

export function pasteDocument(title: string, text: string): Promise<DocumentResult<DocumentVersion>> {
  return call('documents_paste', { title, text });
}

export function importDocument(): Promise<DocumentResult<DocumentVersion | null>> {
  return call('documents_import');
}

export function listDocuments(): Promise<DocumentResult<DocumentSummary[]>> {
  return call('documents_list');
}

export function getDocumentVersion(versionId: string): Promise<DocumentResult<DocumentVersionView>> {
  return call('documents_get_version', { versionId });
}

export function replaceDocument(
  documentId: string,
  source: ReplaceSource,
): Promise<DocumentResult<DocumentVersion | null>> {
  return call('documents_replace', { documentId, source });
}

export function deleteDocument(documentId: string): Promise<DocumentResult<null>> {
  return call('documents_delete', { documentId });
}

export function deleteDocumentImpact(documentId: string): Promise<DocumentResult<number>> {
  return call('documents_delete_impact', { documentId });
}
