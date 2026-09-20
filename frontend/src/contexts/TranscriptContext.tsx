'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode, MutableRefObject } from 'react';
import { Transcript } from '@/types';
import { toast } from 'sonner';
import { useRecordingState } from './RecordingStateContext';
import {
  CaptureCompleteness,
  isCanonicalFinalTranscript,
  transcriptService,
  TranscriptUpdate,
} from '@/services/transcriptService';
import { recordingService, StartMeetingResult } from '@/services/recordingService';
import { indexedDBService } from '@/services/indexedDBService';

type EvidenceAwareTranscript = Transcript & {
  meeting_id: string;
  evidence_id?: string;
  source: string;
  source_segment_key: string;
  is_final: boolean;
  is_canonical: boolean;
  capture_completeness?: CaptureCompleteness;
  delivery_token?: string;
};

interface TranscriptContextType {
  transcripts: EvidenceAwareTranscript[];
  transcriptsRef: MutableRefObject<EvidenceAwareTranscript[]>
  addTranscript: (update: TranscriptUpdate) => void;
  copyTranscript: () => void;
  flushBuffer: () => void;
  transcriptContainerRef: React.RefObject<HTMLDivElement>;
  meetingTitle: string;
  setMeetingTitle: (title: string) => void;
  clearTranscripts: () => void;
  currentMeetingId: string | null;
  markMeetingAsSaved: () => Promise<void>;
}

const TranscriptContext = createContext<TranscriptContextType | undefined>(undefined);
const MEETING_IDENTITY_CONFLICT = 'MEETING_IDENTITY_CONFLICT';

function toDisplayTranscript(update: TranscriptUpdate): EvidenceAwareTranscript {
  const common = {
    text: update.text,
    timestamp: update.timestamp,
    sequence_id: update.sequence_id,
    chunk_start_time: update.chunk_start_time,
    is_partial: update.is_partial,
    confidence: update.confidence,
    audio_start_time: update.audio_start_time,
    audio_end_time: update.audio_end_time,
    duration: update.duration,
    meeting_id: update.meeting_id,
    source: update.source,
    source_segment_key: update.source_segment_key,
    is_final: update.is_final,
    is_canonical: update.is_canonical,
  };

  if (isCanonicalFinalTranscript(update)) {
    return {
      ...common,
      id: update.evidence_id,
      evidence_id: update.evidence_id,
      capture_completeness: update.capture_completeness,
      delivery_token: update.delivery_token,
    };
  }

  return {
    ...common,
    id: `provisional:${update.meeting_id}:${update.source_segment_key}:${update.sequence_id}`,
  };
}

export function TranscriptProvider({ children }: { children: ReactNode }) {
  const [transcripts, setTranscripts] = useState<EvidenceAwareTranscript[]>([]);
  const [meetingTitle, setMeetingTitle] = useState('+ New Call');
  const [currentMeetingId, setCurrentMeetingId] = useState<string | null>(null);

  // Recording state context - provides backend-synced state
  const recordingState = useRecordingState();

  // Refs for transcript management
  const transcriptsRef = useRef<EvidenceAwareTranscript[]>(transcripts);
  const isUserAtBottomRef = useRef<boolean>(true);
  const transcriptContainerRef = useRef<HTMLDivElement>(null);
  const finalFlushRef = useRef<(() => void) | null>(null);
  const currentMeetingIdRef = useRef<string | null>(null);

  // Keep ref updated with current transcripts
  useEffect(() => {
    transcriptsRef.current = transcripts;
  }, [transcripts]);

  const projectStartMeeting = useCallback(async (payload: StartMeetingResult) => {
    const projectedMeetingId = currentMeetingIdRef.current
      ?? sessionStorage.getItem('indexeddb_current_meeting_id');

    if (projectedMeetingId && projectedMeetingId !== payload.meeting_id) {
      console.error(`[${MEETING_IDENTITY_CONFLICT}] Rejected conflicting recording identity`, {
        projectedMeetingId,
        receivedMeetingId: payload.meeting_id,
      });
      toast.error('Recording identity conflict', {
        description: 'Meetily kept the active meeting unchanged. Reload the app before continuing.',
      });
      return false;
    }

    // Set the ref synchronously before persistence so duplicate command/event
    // delivery and listener races observe the same canonical identity.
    currentMeetingIdRef.current = payload.meeting_id;
    setCurrentMeetingId(payload.meeting_id);

    // This is a reload transport for the Rust-owned ID, never an identity source.
    sessionStorage.setItem('indexeddb_current_meeting_id', payload.meeting_id);

    const parsedStartTime = Date.parse(payload.started_at_utc);
    const startTime = Number.isNaN(parsedStartTime) ? Date.now() : parsedStartTime;
    const existingMetadata = await indexedDBService.getMeetingMetadata(payload.meeting_id);
    if (existingMetadata) {
      await indexedDBService.saveMeetingMetadata({
        ...existingMetadata,
        title: payload.title,
        lifecycle: payload.lifecycle,
        lastUpdated: Date.now(),
        transcriptCount: existingMetadata.transcriptCount,
      });
    } else {
      await indexedDBService.saveMeetingMetadata({
        meetingId: payload.meeting_id,
        title: payload.title,
        startTime,
        lastUpdated: Date.now(),
        transcriptCount: 0,
        savedToSQLite: false,
        folderPath: undefined,
        lifecycle: payload.lifecycle,
        completeness: 'pending',
        completenessReason: undefined,
      });
    }
    setMeetingTitle(payload.title);

    // Fetch folder path from backend and update metadata. The canonical ID is
    // already durable even when this optional recovery metadata lookup fails.
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const folderPath = await invoke<string>('get_meeting_folder_path');
      if (folderPath) {
        const metadata = await indexedDBService.getMeetingMetadata(payload.meeting_id);
        if (metadata) {
          metadata.folderPath = folderPath;
          await indexedDBService.saveMeetingMetadata(metadata);
        }
      }
    } catch (_error) {
      // Non-fatal: stop will update the recovery metadata if capture completes.
    }
    return true;
  }, []);

  // Smart auto-scroll: Track user scroll position
  useEffect(() => {
    const handleScroll = () => {
      const container = transcriptContainerRef.current;
      if (!container) return;

      const { scrollTop, scrollHeight, clientHeight } = container;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10; // 10px tolerance
      isUserAtBottomRef.current = isAtBottom;
    };

    const container = transcriptContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, []);

  // Auto-scroll when transcripts change (only if user is at bottom)
  useEffect(() => {
    // Only auto-scroll if user was at the bottom before new content
    if (isUserAtBottomRef.current && transcriptContainerRef.current) {
      // Wait for Framer Motion animation to complete (150ms) before scrolling
      // This ensures scrollHeight includes the full rendered height of the new transcript
      const scrollTimeout = setTimeout(() => {
        const container = transcriptContainerRef.current;
        if (container) {
          container.scrollTo({
            top: container.scrollHeight,
            behavior: 'smooth'
          });
        }
      }, 150); // Match Framer Motion transition duration

      return () => clearTimeout(scrollTimeout);
    }
  }, [transcripts]);

  // Initialize IndexedDB and listen for recording-started/stopped events
  useEffect(() => {
    let unlistenRecordingStarted: (() => void) | undefined;
    let unlistenRecordingStopped: (() => void) | undefined;

    const setupRecordingListeners = async () => {
      try {
        // Initialize IndexedDB
        await indexedDBService.init();

        // Listen for recording-started event
        unlistenRecordingStarted = await recordingService.onRecordingStarted(async (payload) => {
          try {
            await projectStartMeeting(payload);
          } catch (error) {
            console.error('Failed to initialize meeting in IndexedDB:', error);
          }
        });

        // Listen for recording-stopped event
        unlistenRecordingStopped = await recordingService.onRecordingStopped(async (payload) => {
          try {
            const meetingId = currentMeetingIdRef.current;
            if (meetingId) {
              // Update folder path in IndexedDB
              const metadata = await indexedDBService.getMeetingMetadata(meetingId);

              if (metadata && payload.folder_path) {
                metadata.folderPath = payload.folder_path;
                await indexedDBService.saveMeetingMetadata(metadata);
              }
            }
          } catch (error) {
            console.error('Failed to update meeting metadata on stop:', error);
          }
        });
      } catch (error) {
        console.error('Failed to setup recording listeners:', error);
      }
    };

    setupRecordingListeners();

    return () => {
      if (unlistenRecordingStarted) {
        unlistenRecordingStarted();
        console.log('🧹 Recording started listener cleaned up');
      }
      if (unlistenRecordingStopped) {
        unlistenRecordingStopped();
        console.log('🧹 Recording stopped listener cleaned up');
      }
    };
  }, [projectStartMeeting]);

  // Main transcript buffering logic with sequence_id ordering
  useEffect(() => {
    let unlistenFn: (() => void) | undefined;
    let transcriptBuffer = new Map<number, EvidenceAwareTranscript>();
    let lastProcessedSequence = 0;
    let processingTimer: NodeJS.Timeout | undefined;

    const processBufferedTranscripts = (forceFlush = false) => {
      const sortedTranscripts: EvidenceAwareTranscript[] = [];

      // Process all available sequential transcripts
      let nextSequence = lastProcessedSequence + 1;
      while (transcriptBuffer.has(nextSequence)) {
        const bufferedTranscript = transcriptBuffer.get(nextSequence)!;
        sortedTranscripts.push(bufferedTranscript);
        transcriptBuffer.delete(nextSequence);
        lastProcessedSequence = nextSequence;
        nextSequence++;
      }

      // Add any buffered transcripts that might be out of order
      const now = Date.now();
      const staleThreshold = 100;  // 100ms safety net only (serial workers = sequential order)
      const recentThreshold = 0;    // Show immediately - no delay needed with serial processing
      const staleTranscripts: EvidenceAwareTranscript[] = [];
      const recentTranscripts: EvidenceAwareTranscript[] = [];
      const forceFlushTranscripts: EvidenceAwareTranscript[] = [];

      for (const [sequenceId, transcript] of transcriptBuffer.entries()) {
        if (forceFlush) {
          // Force flush mode: process ALL remaining transcripts regardless of timing
          forceFlushTranscripts.push(transcript);
          transcriptBuffer.delete(sequenceId);
          console.log(`Force flush: processing transcript with sequence_id ${sequenceId}`);
        } else {
          const transcriptAge = now - parseInt(transcript.id.split('-')[0]);
          if (transcriptAge > staleThreshold) {
            // Process stale transcripts (>100ms old - safety net)
            staleTranscripts.push(transcript);
            transcriptBuffer.delete(sequenceId);
          } else if (transcriptAge >= recentThreshold) {
            // Process immediately (0ms threshold with serial workers)
            recentTranscripts.push(transcript);
            transcriptBuffer.delete(sequenceId);
            console.log(`Processing transcript with sequence_id ${sequenceId}, age: ${transcriptAge}ms`);
          }
        }
      }

      // Sort both stale and recent transcripts by chunk_start_time, then by sequence_id
      const sortTranscripts = (transcripts: EvidenceAwareTranscript[]) => {
        return transcripts.sort((a, b) => {
          const chunkTimeDiff = (a.chunk_start_time || 0) - (b.chunk_start_time || 0);
          if (chunkTimeDiff !== 0) return chunkTimeDiff;
          return (a.sequence_id || 0) - (b.sequence_id || 0);
        });
      };

      const sortedStaleTranscripts = sortTranscripts(staleTranscripts);
      const sortedRecentTranscripts = sortTranscripts(recentTranscripts);
      const sortedForceFlushTranscripts = sortTranscripts(forceFlushTranscripts);

      const allNewTranscripts = [...sortedTranscripts, ...sortedRecentTranscripts, ...sortedStaleTranscripts, ...sortedForceFlushTranscripts];

      if (allNewTranscripts.length > 0) {
        setTranscripts(prev => {
          const finalSourceKeys = new Set(
            allNewTranscripts
              .filter(transcript => transcript.is_canonical)
              .map(transcript => transcript.source_segment_key),
          );
          const retained = prev.filter(transcript => !(
            !transcript.is_canonical
            && finalSourceKeys.has(transcript.source_segment_key)
          ));
          const existingIds = new Set(retained.map(transcript => transcript.id));

          // Canonical redelivery is idempotent by Rust evidence identity. The
          // deterministic provisional key only deduplicates display updates.
          const uniqueNewTranscripts = allNewTranscripts.filter(
            transcript => !existingIds.has(transcript.id),
          );

          // Only combine if we have unique new transcripts
          if (uniqueNewTranscripts.length === 0) {
            console.log('No unique transcripts to add - all were duplicates');
            return retained;
          }

          console.log(`Adding ${uniqueNewTranscripts.length} unique transcripts out of ${allNewTranscripts.length} received`);

          // Merge with existing transcripts, maintaining chronological order
          const combined = [...retained, ...uniqueNewTranscripts];

          // Sort by chunk_start_time first, then by sequence_id
          return combined.sort((a, b) => {
            const chunkTimeDiff = (a.chunk_start_time || 0) - (b.chunk_start_time || 0);
            if (chunkTimeDiff !== 0) return chunkTimeDiff;
            return (a.sequence_id || 0) - (b.sequence_id || 0);
          });
        });

        // Log the processing summary
        const logMessage = forceFlush
          ? `Force flush processed ${allNewTranscripts.length} transcripts (${sortedTranscripts.length} sequential, ${forceFlushTranscripts.length} forced)`
          : `Processed ${allNewTranscripts.length} transcripts (${sortedTranscripts.length} sequential, ${recentTranscripts.length} recent, ${staleTranscripts.length} stale)`;
        console.log(logMessage);
      }
    };

    // Assign final flush function to ref for external access
    finalFlushRef.current = () => processBufferedTranscripts(true);

    const setupListener = async () => {
      try {
        console.log('🔥 Setting up MAIN transcript listener during component initialization...');
        unlistenFn = await transcriptService.onTranscriptUpdate((update) => {
          const now = Date.now();
          console.log('🎯 MAIN LISTENER: Received transcript update:', {
            sequence_id: update.sequence_id,
            is_partial: update.is_partial,
            is_canonical: update.is_canonical,
            evidence_id: update.evidence_id,
            transcript_length: update.text.length,
            received_at: new Date(now).toISOString(),
            buffer_size_before: transcriptBuffer.size
          });

          // Check for duplicate sequence_id before processing
          if (transcriptBuffer.has(update.sequence_id)) {
            console.log('🚫 MAIN LISTENER: Duplicate sequence_id, skipping buffer:', update.sequence_id);
            return;
          }

          const newTranscript = toDisplayTranscript(update);

          // Add to buffer
          transcriptBuffer.set(update.sequence_id, newTranscript);
          console.log(`✅ MAIN LISTENER: Buffered transcript with sequence_id ${update.sequence_id}. Buffer size: ${transcriptBuffer.size}, Last processed: ${lastProcessedSequence}`);

          // SQLite has already committed canonical finals before publication.
          // IndexedDB mirrors only that final evidence and cannot promote a
          // provisional event into recovery state.
          const activeMeetingId = currentMeetingIdRef.current;
          if (
            activeMeetingId === update.meeting_id
            && isCanonicalFinalTranscript(update)
          ) {
            indexedDBService.saveFinalTranscript(update)
              .catch(err => console.warn('IndexedDB save failed:', err));
          }

          // Clear any existing timer and set a new one
          if (processingTimer) {
            clearTimeout(processingTimer);
          }

          // Process buffer with minimal delay for immediate UI updates (serial workers = sequential order)
          processingTimer = setTimeout(processBufferedTranscripts, 10);
        });
        console.log('✅ MAIN transcript listener setup complete');
      } catch (error) {
        console.error('❌ Failed to setup MAIN transcript listener:', error);
        alert('Failed to setup transcript listener. Check console for details.');
      }
    };

    setupListener();
    console.log('Started enhanced listener setup');

    return () => {
      console.log('🧹 CLEANUP: Cleaning up MAIN transcript listener...');
      if (processingTimer) {
        clearTimeout(processingTimer);
        console.log('🧹 CLEANUP: Cleared processing timer');
      }
      if (unlistenFn) {
        unlistenFn();
        console.log('🧹 CLEANUP: MAIN transcript listener cleaned up');
      }
    };
  }, []);

  // Sync transcript history and meeting name from backend on reload
  // This fixes the issue where reloading during active recording causes state desync
  useEffect(() => {
    const syncFromBackend = async () => {
      if (recordingState.isRecording && !currentMeetingId) {
        try {
          const backendState = await recordingService.getRecordingState();
          if (
            backendState.meeting_id &&
            backendState.meeting_lifecycle &&
            backendState.meeting_title &&
            backendState.meeting_started_at_utc
          ) {
            await projectStartMeeting({
              meeting_id: backendState.meeting_id,
              lifecycle: backendState.meeting_lifecycle,
              title: backendState.meeting_title,
              started_at_utc: backendState.meeting_started_at_utc,
            });
          }
        } catch (error) {
          console.error('[Reload Sync] Failed to restore meeting identity:', error);
        }
      }

      // If recording is active and we have no local transcripts, sync from backend
      if (recordingState.isRecording && transcripts.length === 0) {
        try {
          console.log('[Reload Sync] Recording active after reload, syncing transcript history...');

          const meetingId = currentMeetingIdRef.current;
          const finalEvidence = meetingId
            ? await indexedDBService.getFinalTranscripts(meetingId)
            : [];
          console.log(`[Reload Sync] Retrieved ${finalEvidence.length} canonical evidence segments from recovery cache`);

          const formattedTranscripts: EvidenceAwareTranscript[] = finalEvidence.map(storedSegment => {
            const segment = {
              ...storedSegment,
              evidence_id: storedSegment.evidenceId,
              capture_completeness: storedSegment.captureCompleteness,
            };
            return {
              id: segment.evidence_id,
              evidence_id: segment.evidence_id,
              meeting_id: segment.meetingId,
              source: segment.source,
              source_segment_key: segment.sourceSegmentKey,
              text: segment.text,
              timestamp: segment.timestamp,
              sequence_id: segment.sequenceId,
              chunk_start_time: segment.audio_start_time,
              is_partial: false,
              is_final: true,
              is_canonical: true,
              capture_completeness: segment.capture_completeness,
              confidence: segment.confidence,
              audio_start_time: segment.audio_start_time,
              audio_end_time: segment.audio_end_time,
              duration: segment.duration,
            };
          });

          setTranscripts(formattedTranscripts);
          console.log('[Reload Sync] ✅ Transcript history synced successfully');

          // Fetch meeting name from backend
          const meetingName = await recordingService.getRecordingMeetingName();
          if (meetingName) {
            console.log('[Reload Sync] Retrieved meeting name:', meetingName);
            setMeetingTitle(meetingName);
            console.log('[Reload Sync] ✅ Meeting title synced successfully');
          }
        } catch (error) {
          console.error('[Reload Sync] Failed to sync from backend:', error);
        }
      }
    };

    syncFromBackend();
  }, [recordingState.isRecording, currentMeetingId, projectStartMeeting]); // Run when recording state changes

  // Manual transcript update handler (for RecordingControls component)
  const addTranscript = useCallback((update: TranscriptUpdate) => {
    console.log('🎯 addTranscript called with:', {
      sequence_id: update.sequence_id,
      is_partial: update.is_partial,
      is_canonical: update.is_canonical,
      transcript_length: update.text.length,
    });

    const newTranscript = toDisplayTranscript(update);

    setTranscripts(prev => {
      console.log('📊 Current transcripts count before update:', prev.length);

      // Check if this transcript already exists
      const exists = prev.some(t => t.id === newTranscript.id);
      if (exists) {
        console.log('🚫 Duplicate transcript identity detected, skipping:', newTranscript.id);
        return prev;
      }

      // Add new transcript and sort by sequence_id to maintain order
      const updated = [...prev, newTranscript];
      const sorted = updated.sort((a, b) => (a.sequence_id || 0) - (b.sequence_id || 0));

      console.log('✅ Added new transcript. New count:', sorted.length);
      console.log('📝 Latest transcript:', {
        id: newTranscript.id,
        transcript_length: newTranscript.text.length,
        sequence_id: newTranscript.sequence_id
      });

      return sorted;
    });
  }, []);

  // Copy transcript to clipboard with recording-relative timestamps
  const copyTranscript = useCallback(() => {
    // Format timestamps as recording-relative [MM:SS] instead of wall-clock time
    const formatTime = (seconds: number | undefined): string => {
      if (seconds === undefined) return '[--:--]';
      const totalSecs = Math.floor(seconds);
      const mins = Math.floor(totalSecs / 60);
      const secs = totalSecs % 60;
      return `[${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}]`;
    };

    const fullTranscript = transcripts
      .map(t => `${formatTime(t.audio_start_time)} ${t.text}`)
      .join('\n');
    navigator.clipboard.writeText(fullTranscript);

    toast.success("Transcript copied to clipboard");
  }, [transcripts]);

  // Force flush buffer (for final transcript processing)
  const flushBuffer = useCallback(() => {
    if (finalFlushRef.current) {
      console.log('🔄 Flushing transcript buffer...');
      finalFlushRef.current();
    }
  }, []);

  // Clear transcripts (used when starting new recording)
  const clearTranscripts = useCallback(() => {
    setTranscripts([]);
    // Don't clear currentMeetingId here - it will be set by recording-started event
  }, []);

  // Mark current meeting as saved in IndexedDB
  const markMeetingAsSaved = useCallback(async () => {
    // Try context state first, fallback to sessionStorage
    const meetingId = currentMeetingId || sessionStorage.getItem('indexeddb_current_meeting_id');

    if (!meetingId) {
      console.error('[IndexedDB] ❌ Cannot mark meeting as saved: No meeting ID available!');
      console.error('[IndexedDB] currentMeetingId:', currentMeetingId);
      console.error('[IndexedDB] sessionStorage:', sessionStorage.getItem('indexeddb_current_meeting_id'));
      return;
    }

    try {
      await indexedDBService.markMeetingSaved(meetingId);

      // Clear both sources
      currentMeetingIdRef.current = null;
      setCurrentMeetingId(null);
      sessionStorage.removeItem('indexeddb_current_meeting_id');
    } catch (error) {
      console.error('[IndexedDB] ❌ Failed to mark meeting as saved:', error);
    }
  }, [currentMeetingId]);

  const value: TranscriptContextType = {
    transcripts,
    transcriptsRef,
    addTranscript,
    copyTranscript,
    flushBuffer,
    transcriptContainerRef,
    meetingTitle,
    setMeetingTitle,
    clearTranscripts,
    currentMeetingId,
    markMeetingAsSaved,
  };

  return (
    <TranscriptContext.Provider value={value}>
      {children}
    </TranscriptContext.Provider>
  );
}

export function useTranscripts() {
  const context = useContext(TranscriptContext);
  if (context === undefined) {
    throw new Error('useTranscripts must be used within a TranscriptProvider');
  }
  return context;
}
