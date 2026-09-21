/**
 * useTranscriptRecovery Hook
 *
 * Orchestrates transcript recovery operations for interrupted meetings.
 * Provides functionality to detect, preview, and recover meetings from IndexedDB.
 */

import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  indexedDBService,
  type CanonicalStoredTranscript,
  type MeetingMetadata,
  type RecoveryResult,
  type StoredTranscript,
} from '@/services/indexedDBService';
import { applyPinnedSummaryLanguageToMeeting } from '@/lib/summary-language-preferences';

export interface AudioRecoveryStatus {
  status: string; // "success" | "partial" | "failed" | "none"
  chunk_count: number;
  estimated_duration_seconds: number;
  audio_file_path?: string;
  message: string;
}

export interface RecoveryOutcome {
  result: RecoveryResult;
  audioRecoveryStatus: AudioRecoveryStatus;
}

interface RecoveryCommandError {
  code?: string;
}

export interface UseTranscriptRecoveryReturn {
  recoverableMeetings: MeetingMetadata[];
  isLoading: boolean;
  isRecovering: boolean;
  checkForRecoverableTranscripts: () => Promise<void>;
  recoverMeeting: (meetingId: string) => Promise<RecoveryOutcome>;
  loadMeetingTranscripts: (meetingId: string) => Promise<StoredTranscript[]>;
  deleteRecoverableMeeting: (meetingId: string) => Promise<void>;
}

export function useTranscriptRecovery(): UseTranscriptRecoveryReturn {
  const [recoverableMeetings, setRecoverableMeetings] = useState<MeetingMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);

  /**
   * Check for recoverable meetings in IndexedDB
   */
  const checkForRecoverableTranscripts = useCallback(async () => {
    setIsLoading(true);
    try {
      const meetings = await indexedDBService.getAllMeetings();

      // Filter out meetings older than 7 days and newer than 15 seconds
      // The 15 seconds threshold prevents showing meetings from the current session(jus in case)
      // where recording just stopped but hasn't been fully saved yet
      const cutoffTime = Date.now() - (7 * 24 * 60 * 60 * 1000);
      const secondsAgo = Date.now() - (2 * 1000);

      const recentMeetings = meetings.filter(m => {
        const isWithinRetention = m.lastUpdated > cutoffTime; // Not older than 7 days
        const isOldEnough = m.lastUpdated < secondsAgo; // Older than 15 seconds
        return isWithinRetention && isOldEnough;
      });

      // Verify audio checkpoint availability for each meeting
      const meetingsWithAudioStatus = await Promise.all(
        recentMeetings.map(async (meeting) => {
          const finalEvidence = await indexedDBService.getFinalTranscripts(meeting.meetingId);
          if (meeting.folderPath) {
            try {
              const hasAudio = await invoke<boolean>('has_audio_checkpoints', {
                meetingFolder: meeting.folderPath
              });

              // If no audio files, clear folderPath to show "No audio" in UI
              return {
                ...meeting,
                transcriptCount: finalEvidence.length,
                folderPath: hasAudio ? meeting.folderPath : undefined
              };
            } catch (error) {
              console.warn('Failed to check audio for meeting:', error);
              // On error, assume no audio to be safe
              return { ...meeting, transcriptCount: finalEvidence.length, folderPath: undefined };
            }
          }
          return { ...meeting, transcriptCount: finalEvidence.length };
        })
      );


      setRecoverableMeetings(meetingsWithAudioStatus);
    } catch (error) {
      console.error('Failed to check for recoverable transcripts:', error);
      setRecoverableMeetings([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Load transcripts for preview
   */
  const loadMeetingTranscripts = useCallback(async (meetingId: string): Promise<StoredTranscript[]> => {
    try {
      const transcripts = await indexedDBService.getFinalTranscripts(meetingId);
      // Sort by sequence ID
      transcripts.sort((a, b) => (a.sequenceId || 0) - (b.sequenceId || 0));
      return transcripts;
    } catch (error) {
      console.error('Failed to load meeting transcripts:', error);
      return [];
    }
  }, []);

  /**
   * Recover a meeting from IndexedDB
   */
  const recoverMeeting = useCallback(async (meetingId: string): Promise<RecoveryOutcome> => {
    setIsRecovering(true);
    try {
      // 1. Load meeting metadata
      const metadata = await indexedDBService.getMeetingMetadata(meetingId);
      if (!metadata) {
        throw new Error('Meeting metadata not found');
      }

      // 2. Load all transcripts
      const transcripts = await indexedDBService.getFinalTranscripts(meetingId);

      // 3. Check for folder path
      let folderPath = metadata.folderPath;


      if (!folderPath) {
        // Try to get from backend (might exist if only app crashed, not system)
        try {
          folderPath = await invoke<string>('get_meeting_folder_path');
        } catch (error) {
          folderPath = undefined;
        }
      }

      // 4. Attempt audio recovery if folder path exists
      let audioRecoveryStatus: AudioRecoveryStatus;
      if (folderPath) {
        try {
          audioRecoveryStatus = await invoke<AudioRecoveryStatus>(
            'recover_audio_from_checkpoints',
            { meetingFolder: folderPath, sampleRate: 48000 }
          );
        } catch {
          audioRecoveryStatus = {
            status: 'failed',
            chunk_count: 0,
            estimated_duration_seconds: 0,
            message: 'Audio checkpoint recovery was unavailable'
          };
        }
      } else {
        audioRecoveryStatus = {
          status: 'none',
          chunk_count: 0,
          estimated_duration_seconds: 0,
          message: 'No folder path available'
        };
      }

      const evidence = transcripts
        .filter((transcript): transcript is CanonicalStoredTranscript => (
          transcript.meetingId === metadata.meetingId
          && transcript.isFinal
          && transcript.isCanonical
        ))
        .map(transcript => ({
          evidence_id: transcript.evidenceId,
          meeting_id: transcript.meetingId,
          source_track: transcript.source,
          source_segment_key: transcript.sourceSegmentKey,
          sequence: transcript.sequenceId,
          transcript: transcript.text,
          audio_start_time: transcript.audio_start_time,
          audio_end_time: transcript.audio_end_time,
          capture_completeness: transcript.captureCompleteness,
        }));

      const result = await invoke<RecoveryResult>('reconcile_meeting', {
        request: {
          meeting_id: metadata.meetingId,
          evidence,
          gaps: [],
        },
      });

      try {
        await applyPinnedSummaryLanguageToMeeting(result.meeting_id);
      } catch {
        console.warn('Failed to apply the default summary language to the recovered meeting');
      }

      await indexedDBService.applyRecoveryResult(result);
      setRecoverableMeetings(prev => prev.map(meeting => (
        meeting.meetingId === result.meeting_id
          ? {
              ...meeting,
              lifecycle: result.lifecycle,
              completeness: result.completeness,
              transcriptCount: result.evidence_count,
              lastUpdated: Date.parse(result.reconciled_at_utc) || meeting.lastUpdated,
            }
          : meeting
      )));


      // 8. Clean up checkpoint files
      if (folderPath) {
        try {
          await invoke('cleanup_checkpoints', { meetingFolder: folderPath });
        } catch (error) {
          // Non-fatal - don't fail recovery if cleanup fails
          console.warn('Checkpoint cleanup failed (non-fatal):', error);
        }
      }

      return {
        result,
        audioRecoveryStatus,
      };
    } catch (error) {
      const code = (error as RecoveryCommandError | null)?.code ?? 'RECOVERY_FAILED';
      console.error(`Meeting recovery failed: ${code}`);
      throw new Error(code);
    } finally {
      setIsRecovering(false);
    }
  }, []);

  /**
   * Delete a recoverable meeting
   */
  const deleteRecoverableMeeting = useCallback(async (meetingId: string): Promise<void> => {
    try {
      await indexedDBService.deleteMeeting(meetingId);
      setRecoverableMeetings(prev => prev.filter(m => m.meetingId !== meetingId));
    } catch (error) {
      console.error('Failed to delete meeting:', error);
      throw error;
    }
  }, []);

  return {
    recoverableMeetings,
    isLoading,
    isRecovering,
    checkForRecoverableTranscripts,
    recoverMeeting,
    loadMeetingTranscripts,
    deleteRecoverableMeeting
  };
}
