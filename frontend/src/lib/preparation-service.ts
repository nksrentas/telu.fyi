import { invoke } from '@tauri-apps/api/core';

export type SelectedSource =
  | { kind: 'document'; versionId: string }
  | { kind: 'knowledge'; meetingId: string; itemId: string };

export function listSelectedSources(plannedMeetingId: string): Promise<SelectedSource[]> {
  return invoke<SelectedSource[]>('prep_list_sources', { plannedMeetingId });
}

export function selectSources(plannedMeetingId: string, sources: SelectedSource[]): Promise<SelectedSource[]> {
  return invoke<SelectedSource[]>('prep_select_sources', { plannedMeetingId, sources });
}
