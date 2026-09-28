'use client';

import { useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useRecordingState } from '@/contexts/RecordingStateContext';
import { useTranscripts } from '@/contexts/TranscriptContext';
import { useAutoScroll } from '@/hooks/useAutoScroll';
import { formatElapsed } from '@/lib/format-elapsed';
import { EASE } from '@/lib/motion';

const LINE_ENTER = { duration: 0.28, ease: EASE.out };

export function useIsLiveMeeting(meetingId: string): boolean {
  const { currentMeetingId } = useTranscripts();
  const { isRecording, isStopping, isProcessing, isSaving } = useRecordingState();
  return currentMeetingId === meetingId && (isRecording || isStopping || isProcessing || isSaving);
}

export function LiveTranscript({ meetingId }: { meetingId: string }) {
  const { transcripts, currentMeetingId } = useTranscripts();
  const { isRecording, isPaused } = useRecordingState();
  const scrollRef = useRef<HTMLDivElement>(null);
  const lines = useMemo(() => (currentMeetingId === meetingId ? transcripts : []), [currentMeetingId, meetingId, transcripts]);
  const { autoScroll, scrollToBottom } = useAutoScroll({ scrollRef, segments: lines, isRecording, isPaused });

  return (
    <section aria-labelledby="live-transcript-heading" className="space-y-2">
      <h2 id="live-transcript-heading" className="sec-eyebrow m-0">
        LIVE TRANSCRIPT
      </h2>
      <div
        ref={scrollRef}
        aria-live="polite"
        className="max-h-[320px] space-y-1.5 overflow-y-auto rounded-card bg-surface-sunken px-3.5 py-3"
      >
        {lines.length === 0 && <p className="m-0 text-[12px] text-label-3">Listening…</p>}
        {lines.map((line) => (
          <motion.p
            key={line.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={LINE_ENTER}
            className="selectable m-0 grid grid-cols-[42px_minmax(0,1fr)] gap-2 text-[13px] leading-[1.4] text-label"
          >
            <span aria-hidden className="pt-px text-[11px] tabular-nums text-label-3">
              {formatElapsed(line.audio_start_time ?? 0)}
            </span>
            <span className="break-words">{line.text}</span>
          </motion.p>
        ))}
      </div>
      {!autoScroll && (
        <Button variant="plain" size="sm" onClick={scrollToBottom}>
          Jump to latest
        </Button>
      )}
    </section>
  );
}
