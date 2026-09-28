import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { EffectiveRoute } from '@/services/providerRouteService';

export type KnowledgeType = 'decision' | 'commitment' | 'question' | 'fact';
export type RunStatus = 'running' | 'succeeded' | 'failed' | 'cancelled';
export type TriggerKind = 'auto' | 'user' | 'regenerate';
export type Support = 'stated' | 'not_stated';
export type EvidenceRole = 'claim' | 'owner' | 'due';
export type ReviewState = 'proposed' | 'accepted' | 'rejected';
export type ReviewAction = 'accept' | 'correct' | 'reject' | 'restore' | 'reopen';
export type EvidenceStatus = 'valid' | 'changed' | 'missing';
export type FieldSupport = 'stated' | 'not_stated' | 'user';
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
  duplicateCount: number;
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
  ownerSupport: FieldSupport;
  dueText: string | null;
  dueSupport: FieldSupport;
  reviewState: ReviewState;
  eligibility: boolean;
  evidenceStatus: EvidenceStatus;
  corrected: boolean;
  latestRevisionId: string | null;
  unresolved: boolean;
  createdAtUtc: string;
  evidence: EvidenceLinkView[];
}

export interface MeetingKnowledgeView {
  meetingId: string;
  latestRun: KnowledgeRunView | null;
  items: KnowledgeItemView[];
  rejected: KnowledgeItemView[];
  pendingCount: number;
  acceptedCount: number;
  skippedCount: number;
}

export interface CorrectionInput {
  text: string;
  ownerText: string | null;
  dueText: string | null;
  basedOnRevisionId: string | null;
}

export interface OriginalProposalView {
  text: string;
  ownerText: string | null;
  dueText: string | null;
  createdAtUtc: string;
}

export interface RevisionView {
  revisionId: string;
  basedOnRevisionId: string | null;
  text: string;
  ownerText: string | null;
  dueText: string | null;
  createdAtUtc: string;
}

export interface ReviewEventView {
  reviewId: string;
  sequence: number;
  action: ReviewAction;
  revisionId: string | null;
  createdAtUtc: string;
}

export interface KnowledgeItemHistory {
  itemId: string;
  originRunId: string;
  runStartedAtUtc: string;
  original: OriginalProposalView;
  revisions: RevisionView[];
  reviews: ReviewEventView[];
  evidence: EvidenceLinkView[];
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

export function cancelKnowledgeExtraction(meetingId: string): Promise<boolean> {
  return invoke<boolean>('knowledge_cancel_extraction', { meetingId });
}

export function reviewKnowledgeItem(
  meetingId: string,
  itemId: string,
  action: ReviewAction,
): Promise<KnowledgeItemView> {
  return invoke<KnowledgeItemView>('knowledge_review_item', { meetingId, itemId, action });
}

export function correctKnowledgeItem(
  meetingId: string,
  itemId: string,
  correction: CorrectionInput,
): Promise<KnowledgeItemView> {
  return invoke<KnowledgeItemView>('knowledge_correct_item', { meetingId, itemId, correction });
}

export function acceptAllKnowledgeItems(meetingId: string, itemIds: string[]): Promise<MeetingKnowledgeView> {
  return invoke<MeetingKnowledgeView>('knowledge_accept_all', { meetingId, itemIds });
}

export function getKnowledgeItemHistory(meetingId: string, itemId: string): Promise<KnowledgeItemHistory> {
  return invoke<KnowledgeItemHistory>('knowledge_item_history', { meetingId, itemId });
}

export function listKnowledgeRuns(meetingId: string): Promise<KnowledgeRunView[]> {
  return invoke<KnowledgeRunView[]>('knowledge_list_runs', { meetingId });
}
