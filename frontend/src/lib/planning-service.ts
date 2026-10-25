import { invoke } from '@tauri-apps/api/core';

export interface PlannedMeeting {
  id: string;
  title: string;
  startUtc: string | null;
  purpose: string;
  createdUtc: string;
  updatedUtc: string;
}

export type PlannedMeetingDraft = Pick<PlannedMeeting, 'title' | 'startUtc' | 'purpose'>;

const ERROR_MESSAGES: Record<string, string> = {
  PLANNED_MEETING_INVALID_START: "That date and time couldn't be read.",
  PLANNED_MEETING_NOT_FOUND: 'This planned meeting no longer exists.',
};

export function planningErrorMessage(error: unknown, fallback: string): string {
  return ERROR_MESSAGES[String(error)] ?? fallback;
}

export const PLANNED_MEETINGS_CHANGED_EVENT = 'telu:planned-meetings-changed';

export function planningHref(id: string): string {
  return `/preparation?id=${encodeURIComponent(id)}`;
}

export function createPlannedMeeting(draft: PlannedMeetingDraft): Promise<PlannedMeeting> {
  return invoke<PlannedMeeting>('planning_create', draft);
}

export function listUpcomingPlanned(todayStartUtc: string): Promise<PlannedMeeting[]> {
  return invoke<PlannedMeeting[]>('planning_list_upcoming', { todayStartUtc });
}

export function getPlannedMeeting(id: string): Promise<PlannedMeeting> {
  return invoke<PlannedMeeting>('planning_get', { id });
}

export async function updatePlannedMeeting(id: string, draft: PlannedMeetingDraft): Promise<PlannedMeeting> {
  const updated = await invoke<PlannedMeeting>('planning_update', { id, ...draft });
  window.dispatchEvent(new Event(PLANNED_MEETINGS_CHANGED_EVENT));
  return updated;
}
