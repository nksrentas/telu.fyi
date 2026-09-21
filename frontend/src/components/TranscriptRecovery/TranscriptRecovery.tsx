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
import type { MeetingMetadata, RecoveryGap, StoredTranscript } from '@/services/indexedDBService';
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

function formatGapRange(gap: RecoveryGap): string {
  if (gap.audio_start_ms === null || gap.audio_end_ms === null) return 'Unknown';
  const start = (gap.audio_start_ms / 1000).toFixed(1);
  const end = (gap.audio_end_ms / 1000).toFixed(1);
  return `${start}s–${end}s`;
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
        <DialogContent className="flex h-[80vh] max-w-4xl flex-col p-0">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle className="text-2xl">Recover interrupted meetings</DialogTitle>
            <DialogDescription>
              Reconcile final transcript evidence with its original meeting. Recorded gaps remain visible.
            </DialogDescription>
          </DialogHeader>

          {recoverableMeetings.length === 0 ? (
            <div className="flex flex-1 items-center justify-center px-6 pb-6 text-center">
              <div className="max-w-md space-y-2">
                <h3 className="text-sm font-semibold">No interrupted meetings</h3>
                <p className="text-sm text-muted-foreground">
                  There are no interrupted recordings available to recover on this device.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-4 pb-4 min-[900px]:flex-row min-[900px]:px-6 min-[900px]:pb-6">
              <div className="flex min-h-0 flex-col min-[900px]:w-1/3">
                <h3 className="mb-2 text-sm font-semibold">Interrupted meetings</h3>
                <ScrollArea className="min-h-32 flex-1 rounded-lg border">
                  <div className="space-y-2 p-2">
                    {recoverableMeetings.map(meeting => (
                      <button
                        key={meeting.meetingId}
                        type="button"
                        onClick={() => void handleMeetingSelect(meeting.meetingId)}
                        disabled={isRecovering || isDeleting}
                        aria-pressed={selectedMeetingId === meeting.meetingId}
                        className={cn(
                          'w-full rounded-lg border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                          selectedMeetingId === meeting.meetingId
                            ? 'border-primary bg-primary/10'
                            : 'border-transparent hover:bg-muted',
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-2 text-sm font-semibold">{meeting.title}</p>
                            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" aria-hidden="true" />
                              {formatDistanceToNow(new Date(meeting.lastUpdated), { addSuffix: true })}
                            </p>
                            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                              <FileText className="h-3 w-3" aria-hidden="true" />
                              {meeting.transcriptCount} final {meeting.transcriptCount === 1 ? 'segment' : 'segments'}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {meeting.folderPath ? 'Audio available' : 'No audio available'}
                            </p>
                          </div>
                          {meeting.folderPath ? (
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                          ) : (
                            <AlertCircle className="h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              <div className="flex min-h-0 flex-1 flex-col">
                <h3 className="mb-2 text-sm font-semibold">Preview</h3>
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border">
                  {selectedMeeting ? (
                    <>
                      <div className="border-b bg-muted/50 p-4">
                        <h4 className="line-clamp-2 font-semibold">{selectedMeeting.title}</h4>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Started {new Date(selectedMeeting.startTime).toLocaleString()}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                          <span>{selectedMeeting.transcriptCount} final {selectedMeeting.transcriptCount === 1 ? 'segment' : 'segments'}</span>
                          <span>{selectedMeeting.folderPath ? 'Audio available' : 'No audio available'}</span>
                        </div>
                      </div>

                      <ScrollArea className="min-h-0 flex-1 p-4">
                        {isLoadingPreview ? (
                          <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
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
                              <div key={String(transcript.id)} className="text-sm">
                                <span className="break-words">{transcript.text}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
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
                        <div className="space-y-3 border-t p-4" role="status" aria-live="polite">
                          <p className="text-sm font-semibold">
                            {gapCount === 0
                              ? 'Meeting recovered. No recorded gaps remain.'
                              : `Meeting recovered with ${gapCount} ${gapCount === 1 ? 'gap' : 'gaps'}.`}
                          </p>
                          {showGaps && (
                            <div className="space-y-2 rounded-md border p-3">
                              {authoritativeResult.gaps.map(gap => (
                                <div key={gap.gap_id} className="text-xs">
                                  <p className="font-semibold">{gap.gap_kind || 'Unknown'}</p>
                                  <p className="text-muted-foreground">
                                    {formatGapRange(gap)} · {gap.reason_code || 'Unknown'}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      Select a meeting to preview.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 px-4 pb-4 min-[900px]:px-6 min-[900px]:pb-6 sm:space-x-0">
            {authoritativeResult ? (
              <>
                <Button variant="outline" onClick={viewMeeting}>View meeting</Button>
                {gapCount > 0 && (
                  <Button variant="outline" onClick={() => setShowGaps(value => !value)}>
                    Review gaps
                  </Button>
                )}
                <Button onClick={onClose}>Close recovery</Button>
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
          <DialogFooter className="gap-2 sm:space-x-0">
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
