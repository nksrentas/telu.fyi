/**
 * IndexedDB Service for Transcript Recovery
 * Provides browser-based persistence for meeting transcripts and metadata
 * to enable recovery after app crashes or unexpected closures.
 */

import type { MeetingLifecycle } from './recordingService';
import type { CaptureCompleteness, FinalTranscriptUpdate } from './transcriptService';

export type MeetingCompleteness =
  | 'pending'
  | 'complete'
  | 'incomplete'
  | 'recovered_with_gaps'
  | 'completion_not_verified';

export interface RecoveryGap {
  gap_id: string;
  meeting_id: string;
  gap_kind: string;
  reason_code: string;
  audio_start_ms: number | null;
  audio_end_ms: number | null;
}

export interface RecoveryResult {
  meeting_id: string;
  lifecycle: MeetingLifecycle;
  completeness: MeetingCompleteness;
  evidence_count: number;
  gap_count: number;
  gaps: RecoveryGap[];
  reconciled_at_utc: string;
}

// Database schema interfaces
export interface MeetingMetadata {
  meetingId: string;          // Primary key: canonical Rust UUID
  title: string;              // Meeting title
  startTime: number;          // Unix timestamp (ms)
  lastUpdated: number;        // Unix timestamp (ms)
  transcriptCount: number;    // Number of transcript segments
  savedToSQLite: boolean;     // Flag: saved to backend DB
  folderPath?: string;        // Path to recording folder
  lifecycle: MeetingLifecycle;
  completeness: MeetingCompleteness;
  completenessReason?: string;
  gapCount?: number;
}

export interface CanonicalStoredTranscript {
  id?: string | number;       // Compatibility projection for recovery consumers
  evidenceId: string;         // Primary key: canonical Rust evidence UUID
  meetingId: string;          // Foreign key to meetings store
  source: string;             // Stable Rust source/track identity
  sourceSegmentKey: string;   // Stable source-local segment identity
  text: string;               // Transcript text
  timestamp: string;          // ISO 8601 timestamp
  confidence: number;         // Whisper confidence score
  sequenceId: number;         // Sequence number for ordering
  storedAt: number;           // Unix timestamp when saved
  audio_start_time: number;   // Recording-relative start time in seconds
  audio_end_time: number;     // Recording-relative end time in seconds
  duration: number;           // Duration in seconds
  captureCompleteness: CaptureCompleteness;
  isFinal: true;
  isCanonical: true;
}

export interface LegacyStoredTranscript {
  id?: number;
  meetingId: string;
  text: string;
  timestamp: string;
  confidence: number;
  sequenceId: number;
  storedAt: number;
  audio_start_time?: number;
  audio_end_time?: number;
  duration?: number;
  [key: string]: unknown;
}

export type StoredTranscript = CanonicalStoredTranscript | LegacyStoredTranscript;

class IndexedDBService {
  private db: IDBDatabase | null = null;
  private readonly DB_NAME = 'MeetilyRecoveryDB';
  private readonly DB_VERSION = 3;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize database connection
   */
  async init(): Promise<void> {
    // Return existing promise if initialization is in progress
    if (this.initPromise) {
      return this.initPromise;
    }

    // Return immediately if already initialized
    if (this.db) {
      return Promise.resolve();
    }

    this.initPromise = new Promise((resolve, reject) => {
      try {
        const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

        request.onerror = () => {
          console.error('Failed to open IndexedDB:', request.error);
          reject(request.error);
        };

        request.onsuccess = () => {
          this.db = request.result;
          resolve();
        };

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;

          // Create meetings store
          if (!db.objectStoreNames.contains('meetings')) {
            const meetingsStore = db.createObjectStore('meetings', { keyPath: 'meetingId' });
            meetingsStore.createIndex('lastUpdated', 'lastUpdated', { unique: false });
            meetingsStore.createIndex('savedToSQLite', 'savedToSQLite', { unique: false });
          }

          // Create transcripts store
          if (!db.objectStoreNames.contains('transcripts')) {
            const transcriptsStore = db.createObjectStore('transcripts', {
              keyPath: 'id',
              autoIncrement: true
            });
            transcriptsStore.createIndex('meetingId', 'meetingId', { unique: false });
            transcriptsStore.createIndex('storedAt', 'storedAt', { unique: false });
          }

          // Version 3 adds canonical final evidence beside the legacy
          // auto-increment transcript cache. The old store is intentionally
          // retained: its rows cannot be promoted because they do not carry a
          // Rust evidence identity or a verified finality contract.
          if (event.oldVersion < 3 && !db.objectStoreNames.contains('transcriptEvidence')) {
            const transcriptEvidenceStore = db.createObjectStore('transcriptEvidence', { keyPath: 'evidenceId' });
            transcriptEvidenceStore.createIndex('meetingId', 'meetingId', { unique: false });
            transcriptEvidenceStore.createIndex('meetingSourceSegment', ['meetingId', 'source', 'sourceSegmentKey'], { unique: true });
            transcriptEvidenceStore.createIndex('storedAt', 'storedAt', { unique: false });
          }

          // Version 2 adds an honest durable-state projection without changing
          // the existing keyPath or rewriting any canonical meeting ID.
          if (event.oldVersion < 2 && db.objectStoreNames.contains('meetings')) {
            const transaction = (event.target as IDBOpenDBRequest).transaction;
            if (!transaction) {
              throw new Error('IndexedDB upgrade transaction is unavailable');
            }

            const meetingsStore = transaction.objectStore('meetings');
            const cursorRequest = meetingsStore.openCursor();
            cursorRequest.onsuccess = () => {
              const cursor = cursorRequest.result;
              if (!cursor) return;

              const metadata = cursor.value as Partial<MeetingMetadata> & {
                meetingId: string;
              };
              metadata.lifecycle ??= 'legacy';
              metadata.completeness ??= 'completion_not_verified';
              metadata.completenessReason ??= 'legacy_pre_phase1';
              cursor.update(metadata);
              cursor.continue();
            };
          }
        };
      } catch (error) {
        console.error('Exception during IndexedDB initialization:', error);
        reject(error);
      }
    });

    return this.initPromise;
  }

  // Meeting operations

  /**
   * Save or update meeting metadata
   */
  async saveMeetingMetadata(metadata: MeetingMetadata): Promise<void> {
    try {
      if (!this.db) await this.init();

      const transaction = this.db!.transaction(['meetings'], 'readwrite');
      const store = transaction.objectStore('meetings');

      await new Promise<void>((resolve, reject) => {
        const request = store.put(metadata);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.warn('Failed to save meeting metadata to IndexedDB:', error);
      // Fail silently - don't interrupt recording
    }
  }

  /**
   * Get meeting metadata by ID
   */
  async getMeetingMetadata(meetingId: string): Promise<MeetingMetadata | null> {
    try {
      if (!this.db) await this.init();

      const transaction = this.db!.transaction(['meetings'], 'readonly');
      const store = transaction.objectStore('meetings');

      return new Promise((resolve, reject) => {
        const request = store.get(meetingId);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to get meeting metadata from IndexedDB:', error);
      return null;
    }
  }

  /**
   * Get all unsaved meetings (savedToSQLite = false)
   */
  async getAllMeetings(): Promise<MeetingMetadata[]> {
    try {
      if (!this.db) await this.init();

      const transaction = this.db!.transaction(['meetings'], 'readonly');
      const store = transaction.objectStore('meetings');

      return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => {
          const allMeetings = request.result as MeetingMetadata[];
          // Filter for unsaved meetings (savedToSQLite = false)
          const unsavedMeetings = allMeetings.filter(m => m.savedToSQLite === false);

          // Sort by most recent first
          unsavedMeetings.sort((a, b) => b.lastUpdated - a.lastUpdated);
          resolve(unsavedMeetings);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to get meetings from IndexedDB:', error);
      return [];
    }
  }

  /**
   * Mark meeting as saved to SQLite
   */
  async markMeetingSaved(meetingId: string): Promise<void> {
    try {
      if (!this.db) await this.init();

      const transaction = this.db!.transaction(['meetings'], 'readwrite');
      const store = transaction.objectStore('meetings');

      return new Promise((resolve, reject) => {
        const getRequest = store.get(meetingId);
        getRequest.onsuccess = () => {
          const meeting = getRequest.result;
          if (meeting) {
            meeting.savedToSQLite = true;
            meeting.lastUpdated = Date.now();
            const putRequest = store.put(meeting);
            putRequest.onsuccess = () => resolve();
            putRequest.onerror = () => reject(putRequest.error);
          } else {
            resolve();
          }
        };
        getRequest.onerror = () => reject(getRequest.error);
      });
    } catch (error) {
      console.warn('Failed to mark meeting as saved:', error);
    }
  }

  /**
   * Mirror Rust's authoritative recovery projection onto the existing cache
   * candidate. The canonical key never changes and the row remains available
   * for an idempotent repeat reconciliation in the open recovery dialog.
   */
  async applyRecoveryResult(result: RecoveryResult): Promise<MeetingMetadata | null> {
    try {
      if (!this.db) await this.init();

      const transaction = this.db!.transaction(['meetings'], 'readwrite');
      const store = transaction.objectStore('meetings');
      const meeting = await new Promise<MeetingMetadata | null>((resolve, reject) => {
        const request = store.get(result.meeting_id);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });

      if (!meeting) return null;

      const reconciledAt = Date.parse(result.reconciled_at_utc);
      meeting.lifecycle = result.lifecycle;
      meeting.completeness = result.completeness;
      meeting.transcriptCount = result.evidence_count;
      meeting.gapCount = result.gap_count;
      meeting.lastUpdated = Number.isFinite(reconciledAt) ? reconciledAt : meeting.lastUpdated;
      const reasonCodes = result.gaps.map(gap => gap.reason_code);
      if (reasonCodes.length > 0) {
        meeting.completenessReason = [...new Set(reasonCodes)].sort().join(',');
      }

      await new Promise<void>((resolve, reject) => {
        const request = store.put(meeting);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
      return meeting;
    } catch (error) {
      console.warn('Failed to project recovery result into IndexedDB');
      return null;
    }
  }

  /**
   * Delete meeting and all its transcripts
   */
  async deleteMeeting(meetingId: string): Promise<void> {
    try {
      if (!this.db) await this.init();

      const transaction = this.db!.transaction(
        ['meetings', 'transcripts', 'transcriptEvidence'],
        'readwrite',
      );
      const meetingsStore = transaction.objectStore('meetings');
      const transcriptsStore = transaction.objectStore('transcripts');
      const transcriptEvidenceStore = transaction.objectStore('transcriptEvidence');

      // Delete transcripts
      await this.deleteTranscriptsForMeetingInternal(transcriptsStore, meetingId);
      await this.deleteTranscriptsForMeetingInternal(transcriptEvidenceStore, meetingId);

      // Delete meeting
      await new Promise<void>((resolve, reject) => {
        const request = meetingsStore.delete(meetingId);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to delete meeting from IndexedDB:', error);
      throw error;
    }
  }

  // Transcript operations

  /**
   * Mirror one already-durable final evidence segment for crash recovery.
   * Provisional updates are deliberately not accepted by this API.
   */
  async saveFinalTranscript(transcript: FinalTranscriptUpdate): Promise<void> {
    try {
      if (!this.db) await this.init();

      const storedTranscript: CanonicalStoredTranscript = {
        id: transcript.evidence_id,
        evidenceId: transcript.evidence_id,
        meetingId: transcript.meeting_id,
        source: transcript.source,
        sourceSegmentKey: transcript.source_segment_key,
        text: transcript.text,
        timestamp: transcript.timestamp,
        confidence: transcript.confidence,
        sequenceId: transcript.sequence_id,
        storedAt: Date.now(),
        audio_start_time: transcript.audio_start_time,
        audio_end_time: transcript.audio_end_time,
        duration: transcript.duration,
        captureCompleteness: transcript.capture_completeness,
        isFinal: true,
        isCanonical: true,
      };

      const transaction = this.db!.transaction(['transcriptEvidence', 'meetings'], 'readwrite');
      const transcriptEvidenceStore = transaction.objectStore('transcriptEvidence');
      const meetingsStore = transaction.objectStore('meetings');

      // Stable Rust evidence identity makes event redelivery an update/no-op.
      await new Promise<void>((resolve, reject) => {
        const request = transcriptEvidenceStore.put(storedTranscript);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      // Update meeting metadata
      const meeting = await new Promise<MeetingMetadata | null>((resolve, reject) => {
        const request = meetingsStore.get(transcript.meeting_id);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });

      if (meeting) {
        meeting.lastUpdated = Date.now();
        meeting.transcriptCount = await new Promise<number>((resolve, reject) => {
          const request = transcriptEvidenceStore.index('meetingId').count(transcript.meeting_id);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        await new Promise<void>((resolve, reject) => {
          const request = meetingsStore.put(meeting);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      }
    } catch (error) {
      console.warn('Failed to save transcript to IndexedDB:', error);
      // Fail silently - don't interrupt recording
    }
  }

  /**
   * Get all canonical final evidence for a meeting.
   */
  async getFinalTranscripts(meetingId: string): Promise<CanonicalStoredTranscript[]> {
    try {
      if (!this.db) await this.init();

      const transaction = this.db!.transaction(['transcriptEvidence'], 'readonly');
      const store = transaction.objectStore('transcriptEvidence');
      const index = store.index('meetingId');

      return new Promise((resolve, reject) => {
        const request = index.getAll(meetingId);
        request.onsuccess = () => {
          const transcripts = request.result as CanonicalStoredTranscript[];
          // Sort by sequence ID
          transcripts.sort((a, b) => a.sequenceId - b.sequenceId);
          resolve(transcripts);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to get transcripts from IndexedDB:', error);
      return [];
    }
  }

  /**
   * Recovery callers prefer canonical evidence. Historical version-1 cache
   * rows remain available only for meetings that have no canonical mirror.
   */
  async getTranscripts(meetingId: string): Promise<StoredTranscript[]> {
    const finalEvidence = await this.getFinalTranscripts(meetingId);
    if (finalEvidence.length > 0) return finalEvidence;

    try {
      if (!this.db) await this.init();
      const transaction = this.db!.transaction(['transcripts'], 'readonly');
      const index = transaction.objectStore('transcripts').index('meetingId');
      return new Promise((resolve, reject) => {
        const request = index.getAll(meetingId);
        request.onsuccess = () => {
          const transcripts = request.result as LegacyStoredTranscript[];
          transcripts.sort((a, b) => a.sequenceId - b.sequenceId);
          resolve(transcripts);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to get legacy transcripts from IndexedDB:', error);
      return [];
    }
  }

  /**
   * Get transcript count for a meeting
   */
  async getTranscriptCount(meetingId: string): Promise<number> {
    try {
      if (!this.db) await this.init();

      const transaction = this.db!.transaction(['transcripts'], 'readonly');
      const store = transaction.objectStore('transcripts');
      const index = store.index('meetingId');

      return new Promise((resolve, reject) => {
        const request = index.count(meetingId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to get transcript count from IndexedDB:', error);
      return 0;
    }
  }

  // Cleanup operations

  /**
   * Delete meetings older than specified days
   * @param daysOld Number of days threshold
   * @returns Number of meetings deleted
   */
  async deleteOldMeetings(daysOld: number): Promise<number> {
    try {
      if (!this.db) await this.init();

      const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
      const transaction = this.db!.transaction(
        ['meetings', 'transcripts', 'transcriptEvidence'],
        'readwrite',
      );
      const meetingsStore = transaction.objectStore('meetings');
      const transcriptsStore = transaction.objectStore('transcripts');
      const transcriptEvidenceStore = transaction.objectStore('transcriptEvidence');

      // Get all meetings
      const allMeetings = await new Promise<MeetingMetadata[]>((resolve, reject) => {
        const request = meetingsStore.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      let deletedCount = 0;

      for (const meeting of allMeetings) {
        if (meeting.lastUpdated < cutoffTime) {
          // Delete transcripts
          await this.deleteTranscriptsForMeetingInternal(transcriptsStore, meeting.meetingId);
          await this.deleteTranscriptsForMeetingInternal(transcriptEvidenceStore, meeting.meetingId);

          // Delete meeting
          await new Promise<void>((resolve, reject) => {
            const request = meetingsStore.delete(meeting.meetingId);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
          });

          deletedCount++;
        }
      }

      console.log(`Cleaned up ${deletedCount} old meetings`);
      return deletedCount;
    } catch (error) {
      console.error('Failed to delete old meetings:', error);
      return 0;
    }
  }

  /**
   * Delete saved meetings older than specified hours
   * @param hoursOld Number of hours threshold after save
   * @returns Number of meetings deleted
   */
  async deleteSavedMeetings(hoursOld: number): Promise<number> {
    try {
      if (!this.db) await this.init();

      const cutoffTime = Date.now() - (hoursOld * 60 * 60 * 1000);
      const transaction = this.db!.transaction(
        ['meetings', 'transcripts', 'transcriptEvidence'],
        'readwrite',
      );
      const meetingsStore = transaction.objectStore('meetings');
      const transcriptsStore = transaction.objectStore('transcripts');
      const transcriptEvidenceStore = transaction.objectStore('transcriptEvidence');

      // Get all meetings and filter for saved ones
      const allMeetings = await new Promise<MeetingMetadata[]>((resolve, reject) => {
        const request = meetingsStore.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      // Filter for saved meetings (savedToSQLite = true)
      const savedMeetings = allMeetings.filter(m => m.savedToSQLite === true);

      let deletedCount = 0;

      for (const meeting of savedMeetings) {
        if (meeting.lastUpdated < cutoffTime) {
          // Delete transcripts
          await this.deleteTranscriptsForMeetingInternal(transcriptsStore, meeting.meetingId);
          await this.deleteTranscriptsForMeetingInternal(transcriptEvidenceStore, meeting.meetingId);

          // Delete meeting
          await new Promise<void>((resolve, reject) => {
            const request = meetingsStore.delete(meeting.meetingId);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
          });

          deletedCount++;
        }
      }

      console.log(`Cleaned up ${deletedCount} saved meetings`);
      return deletedCount;
    } catch (error) {
      console.error('Failed to delete saved meetings:', error);
      return 0;
    }
  }

  /**
   * Helper to delete all transcripts for a meeting
   */
  private async deleteTranscriptsForMeetingInternal(
    transcriptsStore: IDBObjectStore,
    meetingId: string
  ): Promise<void> {
    const index = transcriptsStore.index('meetingId');

    return new Promise((resolve, reject) => {
      const request = index.openCursor(IDBKeyRange.only(meetingId));

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };

      request.onerror = () => reject(request.error);
    });
  }
}

// Export singleton instance
export const indexedDBService = new IndexedDBService();
