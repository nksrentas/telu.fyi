'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Collapsible } from 'radix-ui';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { KnowledgeType } from '@/components/telu-ui/knowledge-type';
import { reviewKnowledgeItem, type KnowledgeItemView, type KnowledgeRunView } from '@/lib/knowledge-service';
import { cn } from '@/lib/utils';
import { REVIEW_ERROR, ROW_GRID, type CandidateDecision } from './candidate-row';
import { EvidencePopover } from './evidence-popover';
import { SourceChip } from './source-chip';

interface RejectedRowProps {
  meetingId: string;
  item: KnowledgeItemView;
  run: KnowledgeRunView | null;
  onRestored: (decision: CandidateDecision) => void;
}

function RejectedRow({ meetingId, item, run, onRestored }: RejectedRowProps) {
  const [busy, setBusy] = useState(false);
  const restore = async () => {
    setBusy(true);
    try {
      onRestored({ view: await reviewKnowledgeItem(meetingId, item.itemId, 'restore'), action: 'restore' });
    } catch (error) {
      console.error('Failed to restore knowledge item:', error);
      toast.error(REVIEW_ERROR);
    } finally {
      setBusy(false);
    }
  };
  return (
    <li data-item-id={item.itemId} className={cn(ROW_GRID, 'bg-surface-sunken')}>
      <KnowledgeType type={item.itemType} className="opacity-50" />
      <div className="min-w-0">
        <p className="superseded-text selectable m-0 whitespace-pre-wrap break-words leading-[1.4]">{item.text}</p>
        <div className="mt-[5px] flex items-center opacity-50">
          <span className="flex-1" />
          <EvidencePopover item={item} run={run}>
            <SourceChip item={item} />
          </EvidencePopover>
        </div>
      </div>
      <Button variant="plain" size="sm" disabled={busy} onClick={() => void restore()}>
        Restore
      </Button>
    </li>
  );
}

interface RejectedGroupProps {
  meetingId: string;
  items: KnowledgeItemView[];
  runFor: (item: KnowledgeItemView) => KnowledgeRunView | null;
  onRestored: (decision: CandidateDecision) => void;
}

export function RejectedGroup({ meetingId, items, runFor, onRestored }: RejectedGroupProps) {
  const [open, setOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    contentRef.current?.toggleAttribute?.('inert', !open);
  }, [open, items.length]);
  if (items.length === 0) return null;
  return (
    <Collapsible.Root open={open} onOpenChange={setOpen} className="pt-1">
      <Collapsible.Trigger asChild>
        <button type="button" className="inline-flex items-center gap-1 rounded-[6px] py-1 text-[12px] font-medium text-label-2">
          <ChevronRight
            aria-hidden
            className={cn('size-[13px] text-label-3 transition-transform duration-200 ease-out', open && 'rotate-90')}
            strokeWidth={1.8}
          />
          Rejected ({items.length})
        </button>
      </Collapsible.Trigger>
      <Collapsible.Content
        forceMount
        ref={contentRef}
        className="grid transition-[grid-template-rows,opacity] duration-[260ms] ease-out data-[state=closed]:grid-rows-[0fr] data-[state=open]:grid-rows-[1fr] data-[state=closed]:opacity-0"
      >
        <div className="min-h-0 overflow-hidden">
          <ul className="m-0 list-none space-y-2 p-0 pt-1.5">
            {items.map((item) => (
              <RejectedRow key={item.itemId} meetingId={meetingId} item={item} run={runFor(item)} onRestored={onRestored} />
            ))}
          </ul>
        </div>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}
