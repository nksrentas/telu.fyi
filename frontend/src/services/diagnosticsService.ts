import { invoke } from '@tauri-apps/api/core';

export type DiagnosticStatus = 'pass' | 'fail' | 'unknown';
export type DiagnosticBundleStatus = 'complete' | 'interrupted' | 'invalid';

export interface DiagnosticRoute {
  capability: string;
  providerId: string;
  modelId: string;
  locationClass: string | null;
  sanitizedOrigin: string | null;
  encrypted: boolean | null;
  validationState: string;
}

export interface DiagnosticRunSummary {
  runId: string;
  meetingId: string | null;
  status: DiagnosticBundleStatus;
  validationErrors: string[];
  scenario: string | null;
  startedAtUtc: string | null;
  outcome: DiagnosticStatus;
  outcomeReason: string | null;
  route: DiagnosticRoute | null;
  durationMs: number | null;
}

export interface DiagnosticCheck {
  id: string;
  status: DiagnosticStatus;
  reason: string | null;
}

export interface DiagnosticResult {
  outcome: DiagnosticStatus;
  outcomeReason: string | null;
  checks: DiagnosticCheck[];
  limitations: string[];
  outliers: unknown[];
}

export interface DiagnosticEnvironmentFact {
  label: string;
  status: DiagnosticStatus;
  value: string | null;
  reason: string | null;
}

export interface DiagnosticStageRecord {
  sequence: number;
  stage: string;
  observedOffsetMicros: number;
  observedAtUtc: string;
  workId: string | null;
  evidenceId: string | null;
}

export interface DiagnosticQueueRecord {
  sequence: number;
  observedOffsetMicros: number;
  observedAtUtc: string;
  capacity: number;
  depth: number;
  active: number;
  oldestAgeMs: number | null;
  accepted: number;
  started: number;
  completed: number;
  failed: number;
  cancelled: number;
  superseded: number;
  rejected: number;
}

export interface DiagnosticResourceRecord {
  sequence: number;
  observedOffsetMicros: number;
  observedAtUtc: string;
  intervalMs: number;
  processCpuPercent: number | null;
  processMemoryBytes: number | null;
  systemCpuPercent: number | null;
  systemMemoryBytes: number | null;
  systemTotalMemoryBytes: number | null;
  powerSource: string | null;
  batteryPercent: number | null;
  energyImpact: number | null;
  uncertainty: string | null;
}

export interface DiagnosticRouteRecord {
  recordType: string;
  sequence: number;
  observedOffsetMicros: number;
  observedAtUtc: string;
  route: DiagnosticRoute;
  disposition: string | null;
  redactedCode: string | null;
}

export interface DiagnosticErrorRecord {
  sequence: number;
  observedOffsetMicros: number;
  observedAtUtc: string;
  component: string;
  redactedCode: string;
  workId: string | null;
  evidenceId: string | null;
}

export interface DiagnosticRunDetail {
  runId: string;
  meetingId: string;
  scenario: string;
  startedAtUtc: string;
  finalizedAtUtc: string;
  durationMs: number | null;
  result: DiagnosticResult;
  environment: DiagnosticEnvironmentFact[];
  stages: DiagnosticStageRecord[];
  queues: DiagnosticQueueRecord[];
  resources: DiagnosticResourceRecord[];
  routes: DiagnosticRouteRecord[];
  errors: DiagnosticErrorRecord[];
}

export interface DiagnosticCommandError {
  code: string;
}

export interface DiagnosticExportSelection {
  token: string;
  folderName: string;
}

export interface DiagnosticExportRequest {
  runId: string;
  destinationToken: string;
  includeTranscript: boolean;
  includeAudio: boolean;
}

export interface DiagnosticExportResult {
  runId: string;
  exportId: string;
  folderName: string;
  revealToken: string;
  transcriptRequested: boolean;
  transcriptIncluded: boolean;
  audioRequested: boolean;
  audioIncluded: boolean;
  localOnly: boolean;
}

function normalizeError(error: unknown): DiagnosticCommandError {
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') {
    return { code: error.code };
  }
  return { code: 'DIAGNOSTIC_UNAVAILABLE' };
}

async function invokeDiagnostic<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (error) {
    throw normalizeError(error);
  }
}

export const diagnosticsService = {
  listRuns(): Promise<DiagnosticRunSummary[]> {
    return invokeDiagnostic('list_diagnostic_runs');
  },

  readRun(runId: string): Promise<DiagnosticRunDetail> {
    return invokeDiagnostic('read_diagnostic_run', { runId });
  },

  selectExportFolder(): Promise<DiagnosticExportSelection | null> {
    return invokeDiagnostic('select_diagnostic_export_folder');
  },

  exportLocalCopy(request: DiagnosticExportRequest): Promise<DiagnosticExportResult> {
    return invokeDiagnostic('export_diagnostic_copy', { request });
  },

  showExportInFolder(revealToken: string): Promise<void> {
    return invokeDiagnostic('show_diagnostic_export_in_folder', { revealToken });
  },
};
