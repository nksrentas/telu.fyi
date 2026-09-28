'use client';

import { CircleCheck, Eye, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Icon } from '@/components/telu-ui/icon';

export const REVIEW_COPY = {
  pending: 'Review what Telu found — only items you accept are used later.',
  reviewed: 'Reviewed — every item has a decision.',
  abstentionTooltip: 'Telu only shows items it can quote word for word from this transcript.',
};

export function abstentionLine(skipped: number): string {
  return skipped === 1
    ? '1 possible item skipped — not enough evidence'
    : `${skipped} possible items skipped — not enough evidence`;
}

export function AbstentionLine({ skipped }: { skipped: number }) {
  return (
    <p className="m-0 flex items-center gap-1.5 text-[12px] text-label-3">
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} aria-label={REVIEW_COPY.abstentionTooltip} className="inline-flex">
            <Icon icon={Info} size={13} />
          </span>
        </TooltipTrigger>
        <TooltipContent>{REVIEW_COPY.abstentionTooltip}</TooltipContent>
      </Tooltip>
      <span>{abstentionLine(skipped)}</span>
    </p>
  );
}

interface ReviewHeadProps {
  pendingCount: number;
  skippedCount: number;
  onAcceptAll: () => void;
  busy?: boolean;
}

export function ReviewHead({ pendingCount, skippedCount, onAcceptAll, busy = false }: ReviewHeadProps) {
  const reviewed = pendingCount === 0;
  return (
    <div className="space-y-1">
      <div className="flex min-h-[30px] items-center gap-2.5">
        <p role="status" className="m-0 flex min-w-0 items-center gap-2 text-[12px] text-label-2">
          {reviewed ? (
            <CircleCheck aria-hidden className="size-[13px] shrink-0 text-label-3" strokeWidth={1.8} />
          ) : (
            <Eye aria-hidden className="size-[13px] shrink-0 text-amber" strokeWidth={1.8} />
          )}
          <span>{reviewed ? REVIEW_COPY.reviewed : REVIEW_COPY.pending}</span>
        </p>
        <span className="flex-1" />
        {pendingCount >= 2 && (
          <Button variant="plain" size="sm" disabled={busy} onClick={onAcceptAll}>
            Accept all
          </Button>
        )}
      </div>
      {skippedCount > 0 && <AbstentionLine skipped={skippedCount} />}
    </div>
  );
}
