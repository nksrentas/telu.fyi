/**
 * TranscriptRecovery Component
 *
 * Reconciles interrupted IndexedDB candidates into the same canonical SQLite
 * meeting and keeps the authoritative result visible until the user acts.
 */

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  Trash2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { MeetingMetadata, StoredTranscript } from '@/services/indexedDBService';
import { MeetingCompleteness, MeetingGapList } from '@/components/MeetingCompleteness';
import type { RecoveryOutcome } from '@/hooks/useTranscriptRecovery';
import { cn } from '@/lib/utils';

interface TranscriptRecoveryProps {
  isOpen: boolean;
  onClose: () => void;
  recoverableMeetings: MeetingMetadata[];
  onRecover: (meetingId: string) => Promise<RecoveryOutcome>;
  onDelete: (meetingId: string) => Promise<void>;
  onLoadPreview: (meetingId: string) => Promise<StoredTranscript[]>;
}

export function TranscriptRecovery({
  isOpen,
  onClose,
  recoverableMeetings,
  onRecover,
  onDelete,
  onLoadPreview,
}: TranscriptRecoveryProps) {
  const router = useRouter();
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [previewTranscripts, setPreviewTranscripts] = useState<StoredTranscript[]>([]);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const [recoveryOutcome, setRecoveryOutcome] = useState<RecoveryOutcome | null>(null);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [showGaps, setShowGaps] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedMeetingId(null);
      setPreviewTranscripts([]);
      setRecoveryOutcome(null);
      setRecoveryError(null);
      setShowGaps(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (
      isOpen
      && recoverableMeetings.length > 0
      && !selectedMeetingId
      && !isRecovering
    ) {
      void handleMeetingSelect(recoverableMeetings[0].meetingId);
    }
  }, [isOpen, recoverableMeetings, selectedMeetingId, isRecovering]);

  const handleMeetingSelect = async (meetingId: string) => {
    if (isRecovering || isDeleting) return;
    setSelectedMeetingId(meetingId);
    setRecoveryOutcome(null);
    setRecoveryError(null);
    setShowGaps(false);
    setIsLoadingPreview(true);

    try {
      const transcripts = await onLoadPreview(meetingId);
      setPreviewTranscripts(transcripts.slice(0, 10));
    } catch {
      setPreviewTranscripts([]);
      setRecoveryError('Telu could not load the final evidence preview. The recovery record is unchanged.');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleRecover = async () => {
    if (!selectedMeetingId) return;

    setIsRecovering(true);
    setRecoveryError(null);
    setShowGaps(false);
    try {
      const result = await onRecover(selectedMeetingId);
      setRecoveryResult(result);
    } catch {
      setRecoveryError('Telu could not recover this meeting. The recovery record is unchanged.');
    } finally {
      setIsRecovering(false);
    }
  };

  const setRecoveryResult = (result: RecoveryOutcome) => {
    setRecoveryOutcome(result);
    setSelectedMeetingId(result.result.meeting_id);
  };

  const handleDelete = async () => {
    if (!selectedMeetingId) return;

    setIsDeleting(true);
    setRecoveryError(null);
    try {
      await onDelete(selectedMeetingId);
      setDeleteConfirmationOpen(false);
      setSelectedMeetingId(null);
      setPreviewTranscripts([]);
      setRecoveryOutcome(null);
      setShowGaps(false);
    } catch {
      setDeleteConfirmationOpen(false);
      setRecoveryError('Telu could not delete this recovery record. It remains on this device.');
    } finally {
      setIsDeleting(false);
    }
  };

  const selectedMeeting = recoverableMeetings.find(
    meeting => meeting.meetingId === selectedMeetingId,
  );
  const authoritativeResult = recoveryOutcome?.result ?? null;
  const gapCount = authoritativeResult?.gap_count ?? 0;

  const viewMeeting = () => {
    if (!authoritativeResult) return;
    router.push(`/meeting-details?id=${authoritativeResult.meeting_id}`);
    onClose();
  };

  return (
    <>
      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          if (!open && !isRecovering && !isDeleting) onClose();
        }}
      >
        <DialogContent className="flex h-[80vh] max-w-[520px] flex-col p-0">
          <DialogHeader className="px-[22px] pt-[22px]">
            <DialogTitle>Recover interrupted meetings</DialogTitle>
            <DialogDescription>
              Reconcile final transcript evidence with its original meeting. Recorded gaps remain visible.
            </DialogDescription>
          </DialogHeader>

          {recoverableMeetings.length === 0 ? (
            <div className="flex flex-1 items-center justify-center px-[22px] pb-[22px] text-center">
              <div className="max-w-md space-y-2">
                <h3 className="text-body font-semibold">No interrupted meetings</h3>
                <p className="text-body text-label-2">
                  There are no interrupted recordings available to recover on this device.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-[22px] pb-4">
              <div className="flex min-h-0 flex-col">
                <h3 className="mb-2 text-body font-semibold">Interrupted meetings</h3>
                <ScrollArea className="min-h-32 flex-1 rounded-[10px] bg-surface-sunken">
                  <div className="space-y-2 p-2">
                    {recoverableMeetings.map(meeting => (
                      <button
                        key={meeting.meetingId}
                        type="button"
                        onClick={() => void handleMeetingSelect(meeting.meetingId)}
                        disabled={isRecovering || isDeleting}
                        aria-pressed={selectedMeetingId === meeting.meetingId}
                        className={cn(
                          'w-full rounded-lg p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                          selectedMeetingId === meeting.meetingId
                            ? 'bg-surface shadow-card ring-2 ring-accent'
                            : 'hover:bg-fill',
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-2 text-body font-semibold">{meeting.title}</p>
                            <MeetingCompleteness
                              className="mt-2"
                              lifecycle={meeting.lifecycle}
                              completeness={meeting.completeness}
                              gapCount={meeting.gapCount}
                              variant="compact"
                            />
                            <p className="mt-1 flex items-center gap-1 text-xs text-label-2">
                              <Clock className="h-3 w-3" aria-hidden="true" />
                              {formatDistanceToNow(new Date(meeting.lastUpdated), { addSuffix: true })}
                            </p>
                            <p className="mt-1 flex items-center gap-1 text-xs text-label-2">
                              <FileText className="h-3 w-3" aria-hidden="true" />
                              {meeting.transcriptCount} final {meeting.transcriptCount === 1 ? 'segment' : 'segments'}
                            </p>
                            <p className="mt-1 text-xs text-label-2">
                              {meeting.folderPath ? 'Audio available' : 'No audio available'}
                            </p>
                          </div>
                          {meeting.folderPath ? (
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-label-2" aria-hidden="true" />
                          ) : (
                            <AlertCircle className="h-4 w-4 shrink-0 text-coral-ink" aria-hidden="true" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              <div className="flex min-h-0 flex-1 flex-col">
                <h3 className="mb-2 text-body font-semibold">Preview</h3>
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[10px] bg-surface-sunken">
                  {selectedMeeting ? (
                    <>
                      <div className="border-b border-separator p-4">
                        <h4 className="line-clamp-2 font-semibold">{selectedMeeting.title}</h4>
                        <MeetingCompleteness
                          className="mt-2"
                          lifecycle={selectedMeeting.lifecycle}
                          completeness={selectedMeeting.completeness}
                          gapCount={selectedMeeting.gapCount}
                          variant="compact"
                        />
                        <p className="mt-1 text-body text-label-2">
                          Started {new Date(selectedMeeting.startTime).toLocaleString()}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-body">
                          <span>{selectedMeeting.transcriptCount} final {selectedMeeting.transcriptCount === 1 ? 'segment' : 'segments'}</span>
                          <span>{selectedMeeting.folderPath ? 'Audio available' : 'No audio available'}</span>
                        </div>
                      </div>

                      <ScrollArea className="min-h-0 flex-1 p-4">
                        {isLoadingPreview ? (
                          <div className="flex h-full items-center justify-center gap-2 text-body text-label-2" role="status">
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                            Loading final evidence…
                          </div>
                        ) : previewTranscripts.length > 0 ? (
                          <div className="space-y-3">
                            <Alert>
                              <AlertDescription>
                                Showing {previewTranscripts.length} of {selectedMeeting.transcriptCount} final {selectedMeeting.transcriptCount === 1 ? 'segment' : 'segments'}.
                              </AlertDescription>
                            </Alert>
                            {previewTranscripts.map(transcript => (
                              <div key={String(transcript.id)} className="text-body">
                                <span className="break-words">{transcript.text}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex h-full items-center justify-center text-center text-body text-label-2">
                            No final transcript evidence is available. Recovery can still preserve the meeting and its recorded gaps.
                          </div>
                        )}
                      </ScrollArea>

                      {recoveryError && (
                        <Alert variant="destructive" role="alert" className="m-4 mt-0">
                          <AlertDescription>{recoveryError}</AlertDescription>
                        </Alert>
                      )}

                      {authoritativeResult && (
                        <div className="space-y-3 border-t border-separator p-4" role="status" aria-live="polite">
                          <p className="text-body font-semibold">
                            {gapCount === 0
                              ? 'Meeting recovered. No recorded gaps remain.'
                              : `Meeting recovered with ${gapCount} ${gapCount === 1 ? 'gap' : 'gaps'}.`}
                          </p>
                          <MeetingCompleteness
                            lifecycle={authoritativeResult.lifecycle}
                            completeness={authoritativeResult.completeness}
                            gapCount={authoritativeResult.gap_count}
                            variant="compact"
                          />
                          {showGaps && (
                            <div className="max-h-64 overflow-y-auto rounded-lg bg-surface p-3">
                              <MeetingGapList gaps={authoritativeResult.gaps} />
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex h-full items-center justify-center text-body text-label-2">
                      Select a meeting to preview.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex-wrap gap-2 px-[22px] pb-[22px]">
            {authoritativeResult ? (
              <>
                <Button variant="outline" onClick={viewMeeting}>View meeting</Button>
                {gapCount > 0 && (
                  <Button variant="outline" onClick={() => setShowGaps(value => !value)}>
                    Review gaps
                  </Button>
                )}
                <Button variant="primary" onClick={onClose}>Close recovery</Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={onClose}
                  disabled={isRecovering || isDeleting}
                >
                  Close recovery
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setDeleteConfirmationOpen(true)}
                  disabled={!selectedMeetingId || isRecovering || isDeleting}
                >
                  <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                  Delete meeting
                </Button>
                <Button
                  variant="primary"
                  onClick={() => void handleRecover()}
                  disabled={!selectedMeetingId || isRecovering || isDeleting}
                >
                  {isRecovering ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                      Recovering meeting…
                    </>
                  ) : (
                    'Recover meeting'
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteConfirmationOpen} onOpenChange={setDeleteConfirmationOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete interrupted meeting</DialogTitle>
            <DialogDescription>
              Delete “{selectedMeeting?.title ?? 'Unknown meeting'}”? Its local recovery data will be removed. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmationOpen(false)}
              disabled={isDeleting}
            >
              Keep meeting
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleDelete()}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting meeting…' : 'Delete meeting'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
