'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { Skeleton } from '@/components/telu-ui/indicators';
import { listKnowledgeRuns, type KnowledgeRunView } from '@/lib/knowledge-service';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const LOCATION_LABEL: Record<string, string> = { local: 'Local', lan: 'LAN', remote: 'Remote' };

type RunsState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; runs: KnowledgeRunView[] };

export function formatRunTime(isoTime: string): string {
  const date = new Date(isoTime);
  if (Number.isNaN(date.getTime())) return isoTime;
  const time = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${time}`;
}

export function alreadyDecided(run: KnowledgeRunView): number {
  return run.suppressedCount + run.reconfirmedCount;
}

function RunSummary({ run, current }: { run: KnowledgeRunView; current: boolean }) {
  return (
    <div className={current ? 'space-y-1' : 'space-y-0.5 pt-2.5 shadow-[inset_0_0.5px_0_var(--separator)]'}>
      <p className={current ? 'm-0 text-[13px] font-semibold text-label' : 'm-0 text-[12px] font-medium text-label'}>
        Run of {formatRunTime(run.startedAtUtc)}
      </p>
      <p className="m-0 text-[12px] text-label-2">
        {run.providerId} · {run.modelId} · {LOCATION_LABEL[run.locationClass] ?? run.locationClass}
      </p>
      <p className="m-0 text-[12px] tabular-nums text-label-2">
        {run.proposedCount} proposed · {run.skippedCount} skipped (not enough evidence) · {alreadyDecided(run)} already decided
      </p>
    </div>
  );
}

function useRuns(meetingId: string, open: boolean) {
  const [state, setState] = useState<RunsState>({ status: 'loading' });
  useEffect(() => {
    if (!open) return;
    let current = true;
    setState({ status: 'loading' });
    listKnowledgeRuns(meetingId)
      .then((runs) => {
        const ordered = [...runs].sort((left, right) => right.startedAtUtc.localeCompare(left.startedAtUtc));
        if (current) setState({ status: 'ready', runs: ordered });
      })
      .catch((error: unknown) => {
        console.error('Failed to load knowledge runs:', error);
        if (current) setState({ status: 'error' });
      });
    return () => {
      current = false;
    };
  }, [meetingId, open]);
  return state;
}

interface RunDetailsPopoverProps {
  meetingId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

export function RunDetailsPopover({ meetingId, open, onOpenChange, children }: RunDetailsPopoverProps) {
  const state = useRuns(meetingId, open);
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverAnchor asChild>{children}</PopoverAnchor>
      <PopoverContent align="end" className="w-[330px] space-y-2.5 p-3.5">
        <p className="m-0 text-[11px] font-semibold text-label-3">Run details</p>
        {state.status === 'loading' && (
          <div aria-busy className="space-y-2">
            <Skeleton active />
            <Skeleton active shape="line-short" />
          </div>
        )}
        {state.status === 'error' && <p className="m-0 text-[12px] text-label-2">Couldn&apos;t load run details.</p>}
        {state.status === 'ready' &&
          state.runs.map((run, index) => <RunSummary key={run.runId} run={run} current={index === 0} />)}
      </PopoverContent>
    </Popover>
  );
}
