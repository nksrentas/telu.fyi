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
        className: 'border-primary/25 bg-primary/10 text-primary',
      };
    case 'recovered_with_gaps':
      return {
        label: `Recovered with gaps · ${gapLabel(gapCount)}`,
        icon: RotateCcw,
        className: 'border-primary/25 bg-primary/10 text-foreground',
      };
    case 'completion_not_verified':
      return {
        label: 'Completion not verified',
        icon: CircleHelp,
        className: 'border-border bg-muted text-muted-foreground',
      };
    case 'pending':
    case 'incomplete':
      return {
        label: `Incomplete · ${gapLabel(gapCount)}`,
        icon: AlertTriangle,
        className: 'border-destructive/25 bg-destructive/10 text-foreground',
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
        'inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-medium leading-none',
        statusClassName,
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="whitespace-normal">{label}</span>
    </span>
  );
}

export function MeetingGapList({ gaps }: { gaps: MeetingGap[] }) {
  const orderedGaps = useMemo(() => sortGapsByRelativeTime(gaps), [gaps]);

  if (orderedGaps.length === 0) {
    return (
      <div className="rounded-lg border bg-muted/40 p-4">
        <h3 className="text-sm font-semibold">No recorded gaps</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Telu has no recorded audio or transcript gaps for this meeting. The meeting status above remains authoritative.
        </p>
      </div>
    );
  }

  return (
    <ol className="space-y-3">
      {orderedGaps.map(gap => (
        <li key={gap.gap_id} className="rounded-lg border bg-card p-4 text-sm">
          <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-[7rem_1fr]">
            <dt className="font-medium text-muted-foreground">Gap type</dt>
            <dd>{formatFact(gap.gap_kind)}</dd>
            <dt className="font-medium text-muted-foreground">Source</dt>
            <dd>{formatFact(gap.source)}</dd>
            <dt className="font-medium text-muted-foreground">Time range</dt>
            <dd className="tabular-nums">
              {formatTimestamp(gap.audio_start_ms)}–{formatTimestamp(gap.audio_end_ms)}
            </dd>
            <dt className="font-medium text-muted-foreground">Reason</dt>
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
        <Alert className="border-border bg-card text-card-foreground">
          {completeness === 'recovered_with_gaps' ? (
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
          ) : completeness === 'completion_not_verified' ? (
            <CircleHelp className="h-4 w-4" aria-hidden="true" />
          ) : (
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          )}
          <AlertTitle>{statusPresentation(completeness, gapCount).label}</AlertTitle>
          <AlertDescription className="space-y-3 text-muted-foreground">
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
