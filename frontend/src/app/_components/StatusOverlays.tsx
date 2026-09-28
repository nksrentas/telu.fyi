'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle2, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRecordingState } from '@/contexts/RecordingStateContext';
import {
  transcriptService,
  type FinalizationProgressSnapshot,
  type FinalizationSnapshot,
  type RecordingStoppedPayload,
} from '@/services/transcriptService';

interface StatusOverlaysProps {
  isProcessing: boolean;
  isSaving: boolean;
}

type AuthoritativeFinalization = FinalizationProgressSnapshot | FinalizationSnapshot;

const ANNOUNCEMENT_THROTTLE_MS = 5_000;
export const WAITING_FOR_STATUS = 'Waiting for authoritative recording status';

function isTerminalSnapshot(
  snapshot: AuthoritativeFinalization | null,
): snapshot is FinalizationSnapshot {
  return snapshot?.lifecycle === 'complete' || snapshot?.lifecycle === 'incomplete';
}

function formatOldestAge(ageMs: number | null): string {
  if (ageMs === null) return 'Unknown';
  if (ageMs < 1_000) return '<1s';
  if (ageMs < 60_000) return `${Math.floor(ageMs / 1_000)}s`;

  const minutes = Math.floor(ageMs / 60_000);
  const seconds = Math.floor((ageMs % 60_000) / 1_000);
  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`; // 124s → 2m 04s
}

export function finalizationDetail(snapshot: FinalizationProgressSnapshot): string {
  const depth = snapshot.queue.depth;
  if (depth === 0) {
    return 'No transcript work pending · saving meeting';
  }

  const itemLabel = depth === 1 ? 'item' : 'items';
  return `${depth} ${itemLabel} remaining · oldest waiting ${formatOldestAge(snapshot.queue.oldest_age_ms)}`;
}

export function StatusOverlays({
  isProcessing,
  isSaving,
}: StatusOverlaysProps) {
  const router = useRouter();
  const recordingState = useRecordingState();
  const [snapshot, setSnapshot] = useState<AuthoritativeFinalization | null>(null);
  const [dismissedMeetingId, setDismissedMeetingId] = useState<string | null>(null);
  const [announcedText, setAnnouncedText] = useState('');
  const lastAnnouncementAtRef = useRef(0);
  const announcementTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    let unlistenProgress: (() => void) | undefined;
    let unlistenStopped: (() => void) | undefined;

    const subscribe = async () => {
      const progressListener = await transcriptService.onFinalizationProgress((progress) => {
        setDismissedMeetingId((dismissed) => (
          dismissed === progress.meeting_id ? null : dismissed
        ));
        setSnapshot(progress);
      });
      if (cancelled) {
        progressListener();
        return;
      }
      unlistenProgress = progressListener;

      const stoppedListener = await transcriptService.onRecordingStopped(
        (payload: RecordingStoppedPayload) => {
          setSnapshot(payload.finalization);
        },
      );
      if (cancelled) {
        stoppedListener();
        return;
      }
      unlistenStopped = stoppedListener;
    };

    void subscribe().catch((error) => {
      console.error('Failed to subscribe to authoritative finalization status:', error);
    });

    return () => {
      cancelled = true;
      unlistenProgress?.();
      unlistenStopped?.();
    };
  }, []);

  useEffect(() => {
    if (recordingState.isRecording) {
      setSnapshot(null);
      setDismissedMeetingId(null);
    }
  }, [recordingState.isRecording]);

  const isFinalizing = !isTerminalSnapshot(snapshot) && (
    recordingState.isStopping
    || isProcessing
    || isSaving
    || snapshot?.lifecycle === 'finalizing'
  );
  const visibleSnapshot = isTerminalSnapshot(snapshot)
    && dismissedMeetingId !== snapshot.meeting_id
    ? snapshot
    : null;
  const visibleFinalizingDetail = snapshot?.lifecycle === 'finalizing'
    ? finalizationDetail(snapshot)
    : WAITING_FOR_STATUS;

  const announcement = useMemo(() => {
    if (visibleSnapshot?.lifecycle === 'incomplete') {
      return `Meeting saved as incomplete. Incomplete · ${visibleSnapshot.gap_count} ${visibleSnapshot.gap_count === 1 ? 'gap' : 'gaps'}.`;
    }
    if (visibleSnapshot?.lifecycle === 'complete') {
      return 'Complete';
    }
    if (isFinalizing) {
      return `Finalizing recording. ${visibleFinalizingDetail}.`;
    }
    return '';
  }, [isFinalizing, visibleFinalizingDetail, visibleSnapshot]);

  useEffect(() => {
    if (!announcement) {
      setAnnouncedText('');
      return;
    }

    const now = Date.now();
    const isTerminal = visibleSnapshot !== null;
    const remaining = ANNOUNCEMENT_THROTTLE_MS - (now - lastAnnouncementAtRef.current);
    if (isTerminal || remaining <= 0) {
      if (announcementTimerRef.current) clearTimeout(announcementTimerRef.current);
      announcementTimerRef.current = null;
      lastAnnouncementAtRef.current = now;
      setAnnouncedText(announcement);
      return;
    }

    if (announcementTimerRef.current) clearTimeout(announcementTimerRef.current);
    announcementTimerRef.current = setTimeout(() => {
      lastAnnouncementAtRef.current = Date.now();
      setAnnouncedText(announcement);
      announcementTimerRef.current = null;
    }, remaining);

    return () => {
      if (announcementTimerRef.current) clearTimeout(announcementTimerRef.current);
      announcementTimerRef.current = null;
    };
  }, [announcement, visibleSnapshot]);

  if (!isFinalizing && !visibleSnapshot) return null;

  const navigateToMeeting = (reviewGaps = false) => {
    if (!visibleSnapshot) return;
    const suffix = reviewGaps ? '&review=gaps' : '';
    router.push(`/meeting-details?id=${visibleSnapshot.meeting_id}${suffix}`);
  };

  return (
    <div className="absolute inset-x-0 bottom-4 z-10 px-4">
      <div className="flex justify-center">
        <div className="flex w-full max-w-[750px] justify-center">
          <section className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground shadow-lg">
            <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
              {announcedText}
            </div>

            {isFinalizing && !visibleSnapshot ? (
              <div className="flex items-center gap-3">
                <LoaderCircle
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0 animate-spin text-primary motion-reduce:animate-none"
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Finalizing recording</p>
                  <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                    {visibleFinalizingDetail}
                  </p>
                </div>
              </div>
            ) : null}

            {visibleSnapshot?.lifecycle === 'complete' ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold">Complete</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={() => navigateToMeeting()}>View meeting</Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDismissedMeetingId(visibleSnapshot.meeting_id)}
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            ) : null}

            {visibleSnapshot?.lifecycle === 'incomplete' ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  <div>
                    <p className="text-sm font-semibold">Meeting saved as incomplete</p>
                    <p className="mt-1 text-xs font-semibold tabular-nums text-destructive">
                      Incomplete · {visibleSnapshot.gap_count}{' '}
                      {visibleSnapshot.gap_count === 1 ? 'gap' : 'gaps'}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Some audio or transcript content is missing. Review the recorded gaps before relying on this meeting.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 pl-7">
                  <Button size="sm" onClick={() => navigateToMeeting()}>View meeting</Button>
                  <Button size="sm" variant="outline" onClick={() => navigateToMeeting(true)}>Review gaps</Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDismissedMeetingId(visibleSnapshot.meeting_id)}
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
