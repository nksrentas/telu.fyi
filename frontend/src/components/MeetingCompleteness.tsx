'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, CircleHelp, RotateCcw } from 'lucide-react';

import type {
  MeetingCompleteness as MeetingCompletenessValue,
  MeetingGap,
  MeetingLifecycle,
} from '@/types';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

type MeetingCompletenessProps = {
  lifecycle: MeetingLifecycle;
  completeness: MeetingCompletenessValue;
  gapCount?: number;
  gaps?: MeetingGap[];
  variant?: 'compact' | 'detail';
  showStatus?: boolean;
  className?: string;
};

type StatusPresentation = {
  label: string;
  icon: typeof CheckCircle2;
  className: string;
};

function gapLabel(gapCount?: number): string {
  if (gapCount === undefined) return 'Unknown gaps';
  return `${gapCount} ${gapCount === 1 ? 'gap' : 'gaps'}`;
}

function statusPresentation(
  completeness: MeetingCompletenessValue,
  gapCount?: number,
): StatusPresentation {
  switch (completeness) {
    case 'complete':
      return {
        label: 'Complete',
        icon: CheckCircle2,
        className: 'bg-fill-2 text-label-2',
      };
    case 'recovered_with_gaps':
      return {
        label: `Recovered with gaps · ${gapLabel(gapCount)}`,
        icon: RotateCcw,
        className: 'bg-amber-soft text-amber',
      };
    case 'completion_not_verified':
      return {
        label: 'Completion not verified',
        icon: CircleHelp,
        className: 'bg-fill-2 text-label-2',
      };
    case 'pending':
    case 'incomplete':
      return {
        label: `Incomplete · ${gapLabel(gapCount)}`,
        icon: AlertTriangle,
        className: 'bg-amber-soft text-amber',
      };
  }
}

export function sortGapsByRelativeTime(gaps: MeetingGap[]): MeetingGap[] {
  return [...gaps].sort((left, right) => {
    if (left.audio_start_ms === null && right.audio_start_ms !== null) return 1;
    if (left.audio_start_ms !== null && right.audio_start_ms === null) return -1;
    if (left.audio_start_ms !== right.audio_start_ms) {
      return (left.audio_start_ms ?? 0) - (right.audio_start_ms ?? 0);
    }
    return left.gap_id.localeCompare(right.gap_id);
  });
}

function formatTimestamp(milliseconds: number | null): string {
  if (milliseconds === null) return 'Unknown';
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatFact(value: string | null | undefined): string {
  if (!value) return 'Unknown';
  return value.replaceAll('_', ' ');
}

function Status({
  completeness,
  gapCount,
  className,
}: Pick<MeetingCompletenessProps, 'completeness' | 'gapCount' | 'className'>) {
  const { label, icon: Icon, className: statusClassName } = statusPresentation(
    completeness,
    gapCount,
  );

  return (
    <span
      aria-label={label}
      className={cn(
        'inline-flex min-h-5 max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium leading-tight',
        statusClassName,
        className,
      )}
    >
      <Icon className="size-3 shrink-0" aria-hidden="true" />
      <span className="whitespace-normal">{label}</span>
    </span>
  );
}

export function MeetingGapList({ gaps }: { gaps: MeetingGap[] }) {
  const orderedGaps = useMemo(() => sortGapsByRelativeTime(gaps), [gaps]);

  if (orderedGaps.length === 0) {
    return (
      <div className="rounded-[10px] bg-fill p-4">
        <h3 className="text-body font-semibold">No recorded gaps</h3>
        <p className="mt-1 text-body text-label-2">
          Telu has no recorded audio or transcript gaps for this meeting. The meeting status above remains authoritative.
        </p>
      </div>
    );
  }

  return (
    <ol className="space-y-3">
      {orderedGaps.map(gap => (
        <li key={gap.gap_id} className="rounded-[10px] bg-surface-sunken p-4 text-body">
          <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-[7rem_1fr]">
            <dt className="font-medium text-label-2">Gap type</dt>
            <dd>{formatFact(gap.gap_kind)}</dd>
            <dt className="font-medium text-label-2">Source</dt>
            <dd>{formatFact(gap.source)}</dd>
            <dt className="font-medium text-label-2">Time range</dt>
            <dd className="tabular-nums">
              {formatTimestamp(gap.audio_start_ms)}–{formatTimestamp(gap.audio_end_ms)}
            </dd>
            <dt className="font-medium text-label-2">Reason</dt>
            <dd>{formatFact(gap.reason_code)}</dd>
          </dl>
        </li>
      ))}
    </ol>
  );
}

export function MeetingCompleteness({
  lifecycle,
  completeness,
  gapCount,
  gaps = [],
  variant = 'compact',
  showStatus = true,
  className,
}: MeetingCompletenessProps) {
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const orderedGaps = useMemo(() => sortGapsByRelativeTime(gaps), [gaps]);
  const isComplete = completeness === 'complete';
  const copy = completeness === 'recovered_with_gaps'
    ? 'Recovery preserved the available content, but some audio or transcript content is still missing.'
    : completeness === 'completion_not_verified'
      ? 'This meeting predates completeness tracking. Review its evidence before relying on it.'
      : 'Some audio or transcript content is missing. Review the recorded gaps before relying on this meeting.';

  if (variant === 'compact') {
    return (
      <Status
        className={className}
        completeness={completeness}
        gapCount={gapCount}
      />
    );
  }

  return (
    <div className={cn('space-y-3', className)} data-meeting-lifecycle={lifecycle}>
      {showStatus && <Status completeness={completeness} gapCount={gapCount} />}
      {!isComplete && (
        <Alert className="bg-surface-sunken text-label">
          {completeness === 'recovered_with_gaps' ? (
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
          ) : completeness === 'completion_not_verified' ? (
            <CircleHelp className="h-4 w-4" aria-hidden="true" />
          ) : (
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          )}
          <AlertTitle>{statusPresentation(completeness, gapCount).label}</AlertTitle>
          <AlertDescription className="space-y-3 text-label-2">
            <p>{copy}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => setIsReviewOpen(true)}>
              Review gaps
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Dialog open={isReviewOpen} onOpenChange={setIsReviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Recorded gaps</DialogTitle>
            <DialogDescription>
              Gaps are shown in recording-relative order. Unknown facts stay explicit.
            </DialogDescription>
          </DialogHeader>
          {orderedGaps.length === 0 ? (
            <MeetingGapList gaps={orderedGaps} />
          ) : (
            <ScrollArea className="max-h-[55vh] pr-3">
              <MeetingGapList gaps={orderedGaps} />
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
