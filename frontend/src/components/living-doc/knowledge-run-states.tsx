'use client';

import type { ReactNode } from 'react';
import { CircleX, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { EmptyState } from '@/components/telu-ui/empty-state';
import { Icon } from '@/components/telu-ui/icon';
import { KnowledgeType } from '@/components/telu-ui/knowledge-type';
import { Spinner } from '@/components/telu-ui/indicators';
import type { KnowledgeItemView, KnowledgeRunView } from '@/lib/knowledge-service';

export const KNOWLEDGE_COPY = {
  notRunHeading: 'No knowledge yet',
  notRunBody:
    'Telu can pull decisions, commitments, open questions and facts from this transcript. Each one links to the exact words it came from.',
  gapLine: "This meeting has gaps in its transcript. Items from the missing parts can't be found.",
  noEvidenceHeading: 'Knowledge needs an evidence transcript',
  noEvidenceBody:
    "This meeting was recorded or imported before Telu kept word-level evidence, so there's nothing it can quote.",
  nothingHeading: 'Nothing to review',
  nothingBody: 'Telu found no decisions, commitments, questions or facts it could quote.',
  abstainedHeading: 'Nothing Telu could quote',
  abstainedBody:
    "Telu found possible items but couldn't match them word for word to the transcript, so it left them out.",
  running: 'Reading the transcript…',
  malformed: "Telu couldn't use the model's answer. Your transcript is unchanged.",
  generic: "Telu couldn't finish reading this meeting. Your transcript is unchanged.",
  abstentionTooltip: 'Telu only shows items it can quote word for word from this transcript.',
};

export function abstentionLine(skipped: number): string {
  return skipped === 1
    ? '1 possible item skipped — not enough evidence'
    : `${skipped} possible items skipped — not enough evidence`;
}

export function failureCopy(code: string | null): string {
  return code === 'MALFORMED_OUTPUT' || code === 'PARTIAL_MALFORMED_OUTPUT' ? KNOWLEDGE_COPY.malformed : KNOWLEDGE_COPY.generic;
}

function SunkenCard({ children }: { children: ReactNode }) {
  return <div className="space-y-2 rounded-card bg-surface-sunken p-3.5">{children}</div>;
}

export function ExplicitStartCard({ gapMeeting, notice }: { gapMeeting: boolean; notice: ReactNode }) {
  return (
    <SunkenCard>
      <h3 className="m-0 text-[13px] font-semibold text-label">{KNOWLEDGE_COPY.notRunHeading}</h3>
      <p className="m-0 text-[13px] text-label-2">{KNOWLEDGE_COPY.notRunBody}</p>
      {gapMeeting && <p className="m-0 text-[13px] text-label-2">{KNOWLEDGE_COPY.gapLine}</p>}
      {notice}
    </SunkenCard>
  );
}

export function NoEvidenceCard() {
  return (
    <SunkenCard>
      <h3 className="m-0 text-[13px] font-semibold text-label">{KNOWLEDGE_COPY.noEvidenceHeading}</h3>
      <p className="m-0 text-[13px] text-label-2">{KNOWLEDGE_COPY.noEvidenceBody}</p>
    </SunkenCard>
  );
}

export function RunningRow({ onStop }: { onStop?: () => void }) {
  return (
    <div role="status" className="flex items-center gap-2 text-[13px] text-label-2">
      <Spinner active />
      <span>{KNOWLEDGE_COPY.running}</span>
      {onStop && (
        <Button variant="plain" size="sm" onClick={onStop}>
          Stop
        </Button>
      )}
    </div>
  );
}

export function FailedCard({ run, notice }: { run: KnowledgeRunView; notice: ReactNode }) {
  return (
    <SunkenCard>
      <p className="m-0 flex items-start gap-2 text-[13px] text-label">
        <Icon icon={CircleX} size={16} className="mt-px shrink-0 text-coral-ink" />
        <span>{failureCopy(run.failureCode)}</span>
      </p>
      {notice}
    </SunkenCard>
  );
}

export function AbstentionLine({ skipped }: { skipped: number }) {
  return (
    <p className="m-0 flex items-center gap-1.5 text-[12px] text-label-3">
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} aria-label={KNOWLEDGE_COPY.abstentionTooltip} className="inline-flex">
            <Icon icon={Info} size={13} />
          </span>
        </TooltipTrigger>
        <TooltipContent>{KNOWLEDGE_COPY.abstentionTooltip}</TooltipContent>
      </Tooltip>
      <span>{abstentionLine(skipped)}</span>
    </p>
  );
}

export function EmptyResult({ run }: { run: KnowledgeRunView }) {
  const abstained = run.skippedCount > 0;
  return (
    <div className="space-y-1">
      <EmptyState
        compact
        title={abstained ? KNOWLEDGE_COPY.abstainedHeading : KNOWLEDGE_COPY.nothingHeading}
        body={abstained ? KNOWLEDGE_COPY.abstainedBody : KNOWLEDGE_COPY.nothingBody}
      />
      {abstained && (
        <div className="flex justify-center">
          <AbstentionLine skipped={run.skippedCount} />
        </div>
      )}
    </div>
  );
}

function KnowledgeItem({ item }: { item: KnowledgeItemView }) {
  const quote = item.evidence[0]?.quoteText;
  return (
    <li className="space-y-1.5 rounded-card bg-surface-sunken px-3.5 py-3">
      <KnowledgeType type={item.itemType} />
      <p className="selectable m-0 text-[13px] text-label">{item.text}</p>
      {quote && (
        <blockquote className="selectable m-0 border-l-2 border-accent-soft pl-2.5 text-[13px] text-label-2">
          {quote}
        </blockquote>
      )}
    </li>
  );
}

export function KnowledgeItemList({ items }: { items: KnowledgeItemView[] }) {
  return (
    <ul className="m-0 list-none space-y-2 p-0">
      {items.map((item) => (
        <KnowledgeItem key={item.itemId} item={item} />
      ))}
    </ul>
  );
}
