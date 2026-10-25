import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { EffectiveRoute } from '@/services/providerRouteService';

export type SelectedSource =
  | { kind: 'document'; versionId: string }
  | { kind: 'knowledge'; meetingId: string; itemId: string };

export type PreparationRunStatus = 'running' | 'completed' | 'failed' | 'cancelled' | 'stale';

export interface PreparationRun {
  id: string;
  plannedMeetingId: string;
  status: PreparationRunStatus;
  providerId: string;
  modelId: string;
  locationClass: 'local' | 'lan' | 'remote';
  sanitizedOrigin: string;
  promptVersion: string;
  briefingId: string | null;
  failureCode: string | null;
  startedUtc: string;
  finishedUtc: string | null;
}

export interface BriefingClaim {
  text: string;
  status: 'cited' | 'stale' | 'source_unavailable';
  sourceRef: string;
  source: SelectedSource;
  passageId: string | null;
  locatorJson: string | null;
  quote: string;
}

export interface BriefingQuestion {
  claim: BriefingClaim;
  rationale: string;
}

export interface ManifestEntry {
  source: SelectedSource;
  status: 'included' | 'truncated' | 'omitted' | 'deleted' | 'missing' | 'unavailable';
  kept?: number;
  total?: number;
  reason: string;
  tokens: number;
}

export interface StoredBriefing {
  id: string;
  promptVersion: string;
  createdUtc: string;
  droppedCount: number;
  droppedQuestionCount: number;
  stale: boolean;
  manifest: ManifestEntry[];
  claims: BriefingClaim[];
  questions: BriefingQuestion[];
}

export interface BriefingView {
  run: PreparationRun | null;
  briefing: StoredBriefing | null;
}

export interface PreparationUpdatedEvent {
  plannedMeetingId: string;
  runId: string;
  status: PreparationRunStatus;
}

export function listSelectedSources(plannedMeetingId: string): Promise<SelectedSource[]> {
  return invoke<SelectedSource[]>('prep_list_sources', { plannedMeetingId });
}

export function selectSources(plannedMeetingId: string, sources: SelectedSource[]): Promise<SelectedSource[]> {
  return invoke<SelectedSource[]>('prep_select_sources', { plannedMeetingId, sources });
}

export function generateBriefing(plannedMeetingId: string, expectedRoute: EffectiveRoute): Promise<PreparationRun> {
  return invoke<PreparationRun>('prep_generate', { plannedMeetingId, expectedRoute });
}

export function cancelBriefing(plannedMeetingId: string): Promise<boolean> {
  return invoke<boolean>('prep_cancel', { plannedMeetingId });
}

export function getBriefing(plannedMeetingId: string): Promise<BriefingView> {
  return invoke<BriefingView>('prep_get_briefing', { plannedMeetingId });
}

export function onPreparationUpdated(
  plannedMeetingId: string,
  handler: (event: PreparationUpdatedEvent) => void,
): Promise<UnlistenFn> {
  return listen<PreparationUpdatedEvent>('preparation-updated', (event) => {
    if (event.payload.plannedMeetingId === plannedMeetingId) handler(event.payload);
  });
}
