import { invoke } from '@tauri-apps/api/core';

export interface KnowledgeDeletionImpact {
  accepted: number;
  suggestions: number;
  rejected: number;
  runs: number;
}

export function getDeletionImpact(meetingId: string): Promise<KnowledgeDeletionImpact> {
  return invoke<KnowledgeDeletionImpact>('knowledge_deletion_impact', { meetingId });
}

export function deleteMeeting(meetingId: string): Promise<unknown> {
  return invoke('api_delete_meeting', { meetingId });
}

export const MEETINGS_CHANGED_EVENT = 'telu:meetings-changed';
