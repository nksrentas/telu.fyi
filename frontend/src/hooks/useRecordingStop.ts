import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { listen } from '@tauri-apps/api/event';
import { toast } from 'sonner';
import { useTranscripts } from '@/contexts/TranscriptContext';
import { useSidebar } from '@/components/Sidebar/SidebarProvider';
import { useRecordingState, RecordingStatus } from '@/contexts/RecordingStateContext';
import { storageService } from '@/services/storageService';
import Analytics from '@/lib/analytics';
import {
  applyPinnedSummaryLanguageToMeeting,
  detectAndCacheSummaryLanguage,
} from '@/lib/summary-language-preferences';

type SummaryStatus = 'idle' | 'processing' | 'summarizing' | 'regenerating' | 'completed' | 'error';

interface QueueSnapshot {
  capacity: number;
  depth: number;
  active: number;
  oldest_age_ms: number | null;
  accepted: number;
  started: number;
  completed: number;
  failed: number;
  cancelled: number;
  superseded: number;
  rejected: number;
}

interface FinalizationSnapshot {
  meeting_id: string;
  lifecycle: 'complete' | 'incomplete';
  queue: QueueSnapshot;
  deadline_at_utc: string;
  deadline_ms: number;
  remaining_work_ids: string[];
  gap_count: number;
  reason_codes: string[];
}

interface RecordingStoppedPayload {
  message: string;
  folder_path?: string;
  meeting_name?: string;
  finalization: FinalizationSnapshot;
}

interface FinalizationProgressPayload {
  meeting_id: string;
  lifecycle: 'finalizing';
  queue: QueueSnapshot;
  deadline_at_utc: string;
  deadline_ms: number;
}

interface UseRecordingStopReturn {
  handleRecordingStop: (callApi: boolean) => Promise<void>;
  isStopping: boolean;
  isProcessingTranscript: boolean;
  isSavingTranscript: boolean;
  summaryStatus: SummaryStatus;
  setIsStopping: (value: boolean) => void;
}

/**
 * Projects the Rust-owned stop lifecycle into renderer state. The hook never
 * infers completion from quiet time, queue depth, or locally buffered text.
 */
export function useRecordingStop(
  setIsRecording: (value: boolean) => void,
  setIsRecordingDisabled: (value: boolean) => void
): UseRecordingStopReturn {
  const recordingState = useRecordingState();
  const {
    status,
    setStatus,
    isStopping,
    isProcessing: isProcessingTranscript,
    isSaving: isSavingTranscript,
  } = recordingState;
  const {
    transcriptsRef,
    clearTranscripts,
    meetingTitle,
    markMeetingAsSaved,
  } = useTranscripts();
  const {
    refetchMeetings,
    setCurrentMeeting,
    setIsMeetingActive,
  } = useSidebar();
  const router = useRouter();
  const stopInProgressRef = useRef(false);
  const recordingStoppedDataRef = useRef<RecordingStoppedPayload | null>(null);

  useEffect(() => {
    let unlistenStopped: (() => void) | undefined;
    let unlistenProgress: (() => void) | undefined;

    const setupListeners = async () => {
      unlistenProgress = await listen<FinalizationProgressPayload>(
        'recording-finalization-progress',
        ({ payload }) => {
          const remaining = payload.queue.depth;
          setStatus(
            RecordingStatus.PROCESSING_TRANSCRIPTS,
            remaining > 0
              ? `Finalizing ${remaining} accepted work item${remaining === 1 ? '' : 's'}…`
              : 'Finalizing durable meeting state…'
          );
        }
      );
      unlistenStopped = await listen<RecordingStoppedPayload>(
        'recording-stopped',
        ({ payload }) => {
          recordingStoppedDataRef.current = payload;
        }
      );
    };

    void setupListeners().catch((error) => {
      console.error('Failed to subscribe to recording finalization lifecycle:', error);
    });

    return () => {
      unlistenStopped?.();
      unlistenProgress?.();
    };
  }, [setStatus]);

  const handleRecordingStop = useCallback(async (isCallApi: boolean) => {
    if (stopInProgressRef.current) {
      return;
    }
    stopInProgressRef.current = true;
    setStatus(RecordingStatus.STOPPING);
    setIsRecording(false);
    setIsRecordingDisabled(true);

    try {
      const payload = recordingStoppedDataRef.current;
      if (!payload) {
        if (!isCallApi) {
          setStatus(RecordingStatus.IDLE);
          return;
        }
        throw new Error('Rust stop completed without an authoritative finalization snapshot');
      }

      const { finalization, meeting_name: savedMeetingName } = payload;
      await refetchMeetings();
      let title = savedMeetingName || meetingTitle || 'New Meeting';
      try {
        const meeting = await storageService.getMeeting(finalization.meeting_id);
        title = meeting?.title || title;
      } catch (error) {
        console.warn('Could not load finalized meeting title:', error);
      }
      setCurrentMeeting({ id: finalization.meeting_id, title });

      if (finalization.lifecycle === 'complete') {
        setStatus(RecordingStatus.SAVING, 'Confirming durable meeting state…');
        await markMeetingAsSaved();

        try {
          const shouldDetect = !(await applyPinnedSummaryLanguageToMeeting(
            finalization.meeting_id
          ));
          if (shouldDetect) {
            await detectAndCacheSummaryLanguage(
              finalization.meeting_id,
              transcriptsRef.current.map((transcript) => transcript.text)
            );
          }
        } catch (error) {
          console.warn('Could not apply summary language preference:', error);
        }

        setStatus(RecordingStatus.COMPLETED);
        toast.success('Recording finalized', {
          description: `${finalization.queue.completed} accepted work item${finalization.queue.completed === 1 ? '' : 's'} persisted.`,
          action: {
            label: 'View Meeting',
            onClick: () => router.push(`/meeting-details?id=${finalization.meeting_id}`),
          },
        });

        try {
          const transcripts = transcriptsRef.current;
          const lastTranscript = transcripts.at(-1);
          const durationSeconds = lastTranscript?.audio_end_time
            || lastTranscript?.audio_start_time
            || 0;
          const transcriptWordCount = transcripts.reduce(
            (total, transcript) => total + transcript.text.split(/\s+/).filter(Boolean).length,
            0
          );
          const meetingsToday = await Analytics.getMeetingsCountToday();
          await Analytics.trackMeetingCompleted(finalization.meeting_id, {
            duration_seconds: durationSeconds,
            transcript_segments: transcripts.length,
            transcript_word_count: transcriptWordCount,
            words_per_minute: durationSeconds > 0
              ? transcriptWordCount / (durationSeconds / 60)
              : 0,
            meetings_today: meetingsToday,
          });
          await Analytics.updateMeetingCount();
        } catch (error) {
          console.error('Failed to track finalized meeting analytics:', error);
        }

        router.push(`/meeting-details?id=${finalization.meeting_id}&source=recording`);
        clearTranscripts();
      } else {
        const reason = finalization.reason_codes.join(', ') || 'completion_not_verified';
        setStatus(RecordingStatus.ERROR, `Recording needs recovery: ${reason}`);
        toast.warning('Recording stopped with incomplete work', {
          description: `${finalization.gap_count} gap${finalization.gap_count === 1 ? '' : 's'} recorded for recovery.`,
          action: {
            label: 'View Meeting',
            onClick: () => router.push(`/meeting-details?id=${finalization.meeting_id}`),
          },
        });
      }

      setIsMeetingActive(false);
    } catch (error) {
      console.error('Error consuming recording finalization:', error);
      setStatus(
        RecordingStatus.ERROR,
        error instanceof Error ? error.message : 'Unknown finalization error'
      );
      toast.error('Recording finalization could not be verified', {
        description: error instanceof Error ? error.message : 'Unknown finalization error',
      });
    } finally {
      recordingStoppedDataRef.current = null;
      stopInProgressRef.current = false;
      setIsRecordingDisabled(false);
    }
  }, [
    clearTranscripts,
    markMeetingAsSaved,
    meetingTitle,
    refetchMeetings,
    router,
    setCurrentMeeting,
    setIsMeetingActive,
    setIsRecording,
    setIsRecordingDisabled,
    setStatus,
    transcriptsRef,
  ]);

  const handleRecordingStopRef = useRef(handleRecordingStop);
  useEffect(() => {
    handleRecordingStopRef.current = handleRecordingStop;
  });

  useEffect(() => {
    (window as typeof window & {
      handleRecordingStop?: (callApi?: boolean) => void;
    }).handleRecordingStop = (callApi = true) => {
      void handleRecordingStopRef.current(callApi);
    };
    return () => {
      delete (window as typeof window & {
        handleRecordingStop?: (callApi?: boolean) => void;
      }).handleRecordingStop;
    };
  }, []);

  const summaryStatus: SummaryStatus = status === RecordingStatus.PROCESSING_TRANSCRIPTS
    ? 'processing'
    : status === RecordingStatus.COMPLETED
      ? 'completed'
      : status === RecordingStatus.ERROR
        ? 'error'
        : 'idle';

  return {
    handleRecordingStop,
    isStopping,
    isProcessingTranscript,
    isSavingTranscript,
    summaryStatus,
    setIsStopping: (value: boolean) => {
      setStatus(value ? RecordingStatus.STOPPING : RecordingStatus.IDLE);
    },
  };
}
