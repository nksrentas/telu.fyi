import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { usePaginatedTranscripts } from '@/hooks/usePaginatedTranscripts';
import { listMeetingEvidence } from '@/lib/knowledge-service';
import { parseSummaryContent } from '@/lib/summary-content';
import type {
  MeetingCompleteness,
  MeetingGap,
  MeetingLifecycle,
  MeetingSummary,
  SummaryProcessResponse,
  Transcript,
} from '@/types';

export interface MeetingDocumentMeeting {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  transcripts: Transcript[];
  folder_path?: string;
  lifecycle: MeetingLifecycle;
  completeness: MeetingCompleteness;
  completeness_reason?: string;
  gap_count: number;
  gaps: MeetingGap[];
}

interface EvidenceInfo {
  count: number | null;
  durationSeconds: number | null;
}

const NO_EVIDENCE_INFO: EvidenceInfo = { count: null, durationSeconds: null };

function useMeetingRecord(meetingId: string | null) {
  const pages = usePaginatedTranscripts({ meetingId: meetingId || '' });
  const { metadata, transcripts, isLoading } = pages;
  const [meeting, setMeeting] = useState<MeetingDocumentMeeting | null>(null);

  useEffect(() => {
    setMeeting(null);
  }, [meetingId]);

  useEffect(() => {
    if (isLoading || !meetingId || !metadata || metadata.id !== meetingId) return;
    setMeeting({
      id: metadata.id,
      title: metadata.title,
      created_at: metadata.created_at,
      updated_at: metadata.updated_at,
      transcripts,
      folder_path: metadata.folder_path,
      lifecycle: metadata.lifecycle,
      completeness: metadata.completeness,
      completeness_reason: metadata.completeness_reason,
      gap_count: metadata.gap_count,
      gaps: metadata.gaps,
    });
  }, [metadata, transcripts, meetingId, isLoading]);

  return { meeting, refetch: pages.refetch, transcriptError: pages.error };
}

function useSummaryAndEvidence(meetingId: string | null) {
  const [summaryResponse, setSummaryResponse] = useState<SummaryProcessResponse | null>(null);
  const [meetingSummary, setMeetingSummary] = useState<MeetingSummary | null>(null);
  const [evidenceInfo, setEvidenceInfo] = useState<EvidenceInfo>(NO_EVIDENCE_INFO);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setSummaryResponse(null);
    setMeetingSummary(null);
    setEvidenceInfo(NO_EVIDENCE_INFO);
    setIsLoading(true);
    if (!meetingId) return;
    let cancelled = false;
    const summary = invoke<SummaryProcessResponse>('api_get_summary', { meetingId })
      .then((response) => {
        if (cancelled) return;
        setSummaryResponse(response);
        setMeetingSummary(response.status === 'idle' ? null : parseSummaryContent(response.data));
      })
      .catch((error: unknown) => {
        if (!cancelled) console.error('Failed to load the meeting summary:', error);
      });
    const evidence = listMeetingEvidence(meetingId)
      .then((segments) => {
        if (cancelled) return;
        const durationSeconds = segments.length > 0 ? segments.reduce((longest, segment) => Math.max(longest, segment.audioEndTime), 0) : null;
        setEvidenceInfo({ count: segments.length, durationSeconds });
      })
      .catch((error: unknown) => {
        if (!cancelled) console.error('Failed to read transcript evidence for meeting:', error);
      });
    void Promise.all([summary, evidence]).finally(() => {
      if (!cancelled) setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [meetingId]);

  return { summaryResponse, meetingSummary, evidenceInfo, isLoading };
}

function legacyDuration(meeting: MeetingDocumentMeeting | null): number | null {
  const seconds = (meeting?.transcripts ?? []).reduce(
    (longest, transcript) => Math.max(longest, transcript.audio_end_time ?? transcript.audio_start_time ?? 0),
    0,
  );
  return seconds > 0 ? seconds : null;
}

export function useMeetingDocument(meetingId: string | null) {
  const record = useMeetingRecord(meetingId);
  const details = useSummaryAndEvidence(meetingId);
  const ready = !details.isLoading && record.meeting !== null && record.meeting.id === meetingId;
  return {
    meeting: ready ? record.meeting : null,
    summaryResponse: details.summaryResponse,
    meetingSummary: details.meetingSummary,
    evidenceCount: details.evidenceInfo.count,
    hasEvidence: details.evidenceInfo.count !== 0,
    durationSeconds: details.evidenceInfo.durationSeconds ?? legacyDuration(record.meeting),
    isLoading: !ready && !record.transcriptError,
    error: record.transcriptError,
    refetch: record.refetch,
  };
}
