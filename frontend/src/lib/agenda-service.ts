import { invoke } from '@tauri-apps/api/core';
import type { RunStatus } from '@/lib/knowledge-service';

export type AgendaCardState =
  | 'recording'
  | 'finalizing'
  | 'extracting'
  | 'to_review'
  | 'incomplete'
  | 'reviewed'
  | 'no_knowledge'
  | 'transcript_only';

export type MeetingLifecycle =
  | 'preparing'
  | 'recording'
  | 'finalizing'
  | 'complete'
  | 'incomplete'
  | 'recovered'
  | 'legacy';

export type MeetingCompleteness =
  | 'pending'
  | 'complete'
  | 'incomplete'
  | 'recovered_with_gaps'
  | 'completion_not_verified';

export interface AgendaMeeting {
  id: string;
  title: string;
  startedAtUtc: string;
  endedAtUtc: string | null;
  lifecycle: MeetingLifecycle;
  completeness: MeetingCompleteness;
  gapCount: number;
  evidenceCount: number;
  legacyTranscriptCount: number;
  pendingCount: number;
  acceptedCount: number;
  rejectedCount: number;
  latestRunStatus: RunStatus | null;
  cardState: AgendaCardState;
}

export interface AgendaCounts {
  dayCount: number;
  pendingTotal: number;
}

export interface DayBounds {
  fromUtc: string;
  toUtc: string;
}

export function localDayBounds(date: Date): DayBounds {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  return { fromUtc: start.toISOString(), toUtc: end.toISOString() };
}

export function listAgendaDay(fromUtc: string, toUtc: string): Promise<AgendaMeeting[]> {
  return invoke<AgendaMeeting[]>('agenda_list_day', { fromUtc, toUtc });
}

export function listReviewMeetings(): Promise<AgendaMeeting[]> {
  return invoke<AgendaMeeting[]>('agenda_list_review');
}

export function getAgendaCounts(fromUtc: string, toUtc: string): Promise<AgendaCounts> {
  return invoke<AgendaCounts>('agenda_counts', { fromUtc, toUtc });
}
