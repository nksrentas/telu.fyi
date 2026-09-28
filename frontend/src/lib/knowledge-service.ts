import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { EffectiveRoute } from '@/services/providerRouteService';

export type KnowledgeType = 'decision' | 'commitment' | 'question' | 'fact';
export type RunStatus = 'running' | 'succeeded' | 'failed' | 'cancelled';
export type TriggerKind = 'auto' | 'user' | 'regenerate';
export type Support = 'stated' | 'not_stated';
export type EvidenceRole = 'claim' | 'owner' | 'due';
export type ReviewState = 'proposed';
export type CaptureCompleteness = 'complete' | 'incomplete';

export interface KnowledgeRunView {
  runId: string;
  meetingId: string;
  triggerKind: TriggerKind;
  status: RunStatus;
  providerId: string;
  modelId: string;
  locationClass: string;
  sanitizedOrigin: string;
  promptVersion: string;
  inputEvidenceCount: number;
  proposedCount: number;
  skippedCount: number;
  suppressedCount: number;
  reconfirmedCount: number;
  failureCode: string | null;
  startedAtUtc: string;
  finishedAtUtc: string | null;
}

export interface EvidenceLinkView {
  linkId: string;
  evidenceId: string;
  role: EvidenceRole;
  quoteText: string;
  rawStart: number;
  rawEnd: number;
  sequence: number;
  audioStartTime: number;
  audioEndTime: number;
  segmentCaptureIncomplete: boolean;
}

export interface KnowledgeItemView {
  itemId: string;
  meetingId: string;
  originRunId: string;
  itemType: KnowledgeType;
  text: string;
  ownerText: string | null;
  ownerSupport: Support;
  dueText: string | null;
  dueSupport: Support;
  reviewState: ReviewState;
  createdAtUtc: string;
  evidence: EvidenceLinkView[];
}

export interface MeetingKnowledgeView {
  meetingId: string;
  latestRun: KnowledgeRunView | null;
  items: KnowledgeItemView[];
}

export interface EvidenceSegmentView {
  evidenceId: string;
  sequence: number;
  text: string;
  audioStartTime: number;
  audioEndTime: number;
  captureCompleteness: CaptureCompleteness;
}

export interface KnowledgeUpdatedEvent {
  meetingId: string;
  runId: string;
  status: RunStatus;
}

export function startKnowledgeExtraction(
  meetingId: string,
  expectedRoute: EffectiveRoute,
  trigger: TriggerKind,
): Promise<KnowledgeRunView> {
  return invoke<KnowledgeRunView>('knowledge_start_extraction', { meetingId, expectedRoute, trigger });
}

export function getMeetingKnowledge(meetingId: string): Promise<MeetingKnowledgeView> {
  return invoke<MeetingKnowledgeView>('knowledge_get_meeting', { meetingId });
}

export function listMeetingEvidence(meetingId: string): Promise<EvidenceSegmentView[]> {
  return invoke<EvidenceSegmentView[]>('knowledge_list_evidence', { meetingId });
}

export function onKnowledgeUpdated(
  handler: (event: KnowledgeUpdatedEvent) => void,
): Promise<UnlistenFn> {
  return listen<KnowledgeUpdatedEvent>('knowledge-updated', (event) => handler(event.payload));
}
