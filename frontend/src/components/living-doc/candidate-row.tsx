'use client';

import { forwardRef, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { AlertTriangle, Clock, MoreHorizontal, User, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Chip } from '@/components/telu-ui/chip';
import { KnowledgeType } from '@/components/telu-ui/knowledge-type';
import {
  correctKnowledgeItem,
  reviewKnowledgeItem,
  type FieldSupport,
  type KnowledgeItemView,
  type KnowledgeRunView,
  type ReviewAction,
} from '@/lib/knowledge-service';
import { cn } from '@/lib/utils';
import { EvidencePopover } from './evidence-popover';
import { HistoryPopover } from './history-popover';
import { SourceChip } from './source-chip';

export const REVIEW_ERROR = "Couldn't save that. Nothing changed.";
export const EMPTY_TEXT_ERROR = "Text can't be empty.";
export const TEXT_LIMIT = 400;
export const FIELD_LIMIT = 80;
const IME_KEY_CODE = 229;

export const ROW_GRID =
  'grid grid-cols-1 items-center gap-1.5 rounded-[12px] py-2.5 pl-3.5 pr-3 @[601px]:grid-cols-[112px_minmax(0,1fr)_auto] @[601px]:gap-3';

export type RowDecision = ReviewAction | 'correct';

export interface CandidateDecision {
  view: KnowledgeItemView;
  action: RowDecision;
}

interface Draft {
  text: string;
  owner: string;
  due: string;
  basedOnRevisionId: string | null;
}

export function evidenceProblem(item: KnowledgeItemView): string | null {
  if (item.evidenceStatus === 'changed') return 'Evidence changed — not eligible';
  if (item.evidenceStatus === 'missing') return 'Evidence missing — not eligible';
  return null;
}

function draftFrom(item: KnowledgeItemView): Draft {
  return { text: item.text, owner: item.ownerText ?? '', due: item.dueText ?? '', basedOnRevisionId: item.latestRevisionId };
}

interface FieldValueProps {
  value: string | null;
  support: FieldSupport;
  emptyLabel: string;
  unresolved: boolean;
  icon: ReactNode;
}

function FieldValue({ value, support, emptyLabel, unresolved, icon }: FieldValueProps) {
  if (support === 'not_stated' || !value) {
    return (
      <Chip tone="dashed" className={cn(unresolved && 'text-amber')}>
        {emptyLabel}
      </Chip>
    );
  }
  return (
    <span className="inline-flex min-w-0 items-center gap-1 break-words">
      {icon}
      {value}
    </span>
  );
}

function AcceptedStatus({ meetingId, item }: { meetingId: string; item: KnowledgeItemView }) {
  const eligibility = item.eligibility ? 'eligible' : 'not eligible';
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[11px] font-medium text-label-2">
      <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-series-green" />
      {item.corrected ? (
        <span>
          {'✓ '}
          <HistoryPopover meetingId={meetingId} item={item}>
            <button type="button" className="font-medium text-label underline decoration-label-4 decoration-dotted underline-offset-2">
              Corrected
            </button>
          </HistoryPopover>
          {` · Accepted · ${eligibility}`}
        </span>
      ) : item.eligibility ? (
        '✓ Accepted · eligible'
      ) : (
        '✓ Accepted · not eligible'
      )}
    </span>
  );
}

interface CorrectionFormProps {
  draft: Draft;
  error: string | null;
  onChange: (draft: Draft) => void;
  onSave: () => void;
  onDiscard: () => void;
}

function isComposing(event: KeyboardEvent<HTMLElement>) {
  return event.nativeEvent.isComposing || event.nativeEvent.keyCode === IME_KEY_CODE;
}

function CorrectionForm({ draft, error, onChange, onSave, onDiscard }: CorrectionFormProps) {
  const textRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    textRef.current?.focus();
    textRef.current?.select();
  }, []);
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onDiscard();
    } else if (event.key === 'Enter' && !event.shiftKey && !isComposing(event)) {
      event.preventDefault();
      onSave();
    }
  };
  return (
    <div className="space-y-2">
      <Textarea
        ref={textRef}
        aria-label="Item text"
        value={draft.text}
        maxLength={TEXT_LIMIT}
        rows={2}
        onKeyDown={onKeyDown}
        onChange={(event) => onChange({ ...draft, text: event.target.value })}
        className="min-h-0 resize-none rounded-[6px] bg-content px-1.5 py-[3px] text-[13px] leading-[1.4] shadow-[inset_0_0_0_1px_var(--accent),0_0_0_3px_color-mix(in_srgb,var(--accent)_22%,transparent)]"
      />
      <p aria-live="polite" className="m-0 text-[12px] text-coral-ink">{error}</p>
      <div className="grid grid-cols-2 gap-2">
        {(['owner', 'due'] as const).map((field) => (
          <label key={field} className="space-y-1 text-[12px] text-label-2">
            <span>{field === 'owner' ? 'Owner' : 'Due'}</span>
            <Input
              value={draft[field]}
              maxLength={FIELD_LIMIT}
              placeholder="Not stated"
              onKeyDown={onKeyDown}
              onChange={(event) => onChange({ ...draft, [field]: event.target.value })}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

function useRowActions(meetingId: string, item: KnowledgeItemView, onDecided: (decision: CandidateDecision) => void) {
  const [busy, setBusy] = useState(false);
  const perform = async (action: RowDecision, request: () => Promise<KnowledgeItemView>) => {
    setBusy(true);
    try {
      const view = await request();
      onDecided({ view, action });
      return true;
    } catch (error) {
      console.error('Knowledge review action failed:', error);
      toast.error(REVIEW_ERROR);
      return false;
    } finally {
      setBusy(false);
    }
  };
  const review = (action: ReviewAction) => perform(action, () => reviewKnowledgeItem(meetingId, item.itemId, action));
  const correct = (draft: Draft) =>
    perform('correct', () =>
      correctKnowledgeItem(meetingId, item.itemId, {
        text: draft.text.trim(),
        ownerText: draft.owner.trim() || null,
        dueText: draft.due.trim() || null,
        basedOnRevisionId: draft.basedOnRevisionId,
      })
    );
  return { busy, review, correct };
}

function useCorrection(item: KnowledgeItemView, actions: ReturnType<typeof useRowActions>) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const begin = () => {
    setError(null);
    setDraft(draftFrom(item));
  };
  const discard = () => {
    setError(null);
    setDraft(null);
  };
  const save = async () => {
    if (!draft) return;
    if (!draft.text.trim()) {
      setError(EMPTY_TEXT_ERROR);
      return;
    }
    const original = draftFrom(item);
    const unchanged = draft.text.trim() === original.text && draft.owner.trim() === original.owner && draft.due.trim() === original.due;
    if (unchanged && item.reviewState === 'accepted') return discard();
    const saved = unchanged ? await actions.review('accept') : await actions.correct(draft);
    if (saved) discard();
  };
  return { draft, error, setDraft, begin, discard, save };
}

function PendingActions({ busy, onAccept, onCorrect, onReject }: { busy: boolean; onAccept: () => void; onCorrect: () => void; onReject: () => void }) {
  return (
    <div className="flex items-center gap-1">
      <Button variant="tinted" size="sm" disabled={busy} onClick={onAccept}>
        Accept
      </Button>
      <Button size="sm" disabled={busy} onClick={onCorrect}>
        Correct
      </Button>
      <Button variant="plain" size="sm" icon aria-label="Reject" disabled={busy} onClick={onReject}>
        <X aria-hidden />
      </Button>
    </div>
  );
}

interface AcceptedActionsProps {
  meetingId: string;
  item: KnowledgeItemView;
  busy: boolean;
  onCorrect: () => void;
  onReopen: () => void;
  onReject: () => void;
}

function AcceptedActions({ meetingId, item, busy, onCorrect, onReopen, onReject }: AcceptedActionsProps) {
  return (
    <div className="flex items-center gap-1.5">
      {evidenceProblem(item) ? (
        <Button variant="plain" size="sm" icon aria-label="Reject" disabled={busy} onClick={onReject}>
          <X aria-hidden />
        </Button>
      ) : (
        <AcceptedStatus meetingId={meetingId} item={item} />
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="plain" size="sm" icon aria-label="More" disabled={busy}>
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onCorrect}>Correct…</DropdownMenuItem>
          <DropdownMenuItem onSelect={onReopen}>Move back to review</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function RowMeta({ item, run, accepted }: { item: KnowledgeItemView; run: KnowledgeRunView | null; accepted: boolean }) {
  const problem = evidenceProblem(item);
  const unresolved = accepted && item.unresolved;
  return (
    <div className="mt-[5px] flex flex-wrap items-center gap-2 text-[11px] text-label-2">
      <FieldValue
        value={item.ownerText}
        support={item.ownerSupport}
        emptyLabel="Owner not stated"
        unresolved={unresolved}
        icon={<User aria-hidden className="size-3" strokeWidth={1.8} />}
      />
      <FieldValue
        value={item.dueText}
        support={item.dueSupport}
        emptyLabel="Due not stated"
        unresolved={unresolved}
        icon={<Clock aria-hidden className="size-3" strokeWidth={1.8} />}
      />
      {problem && (
        <span className="inline-flex items-center gap-1 font-medium text-label">
          <AlertTriangle aria-hidden className="size-3 text-amber" strokeWidth={1.8} />
          {problem}
        </span>
      )}
      <span className="flex-1" />
      <EvidencePopover item={item} run={run}>
        <SourceChip item={item} />
      </EvidencePopover>
    </div>
  );
}

interface CandidateRowProps {
  meetingId: string;
  item: KnowledgeItemView;
  run: KnowledgeRunView | null;
  onDecided: (decision: CandidateDecision) => void;
}

export const CandidateRow = forwardRef<HTMLDivElement, CandidateRowProps>(function CandidateRow(
  { meetingId, item, run, onDecided },
  ref
) {
  const actions = useRowActions(meetingId, item, onDecided);
  const correction = useCorrection(item, actions);
  const accepted = item.reviewState === 'accepted';
  const state = correction.draft ? 'editing' : accepted ? 'accepted' : 'pending';

  return (
    <div
      ref={ref}
      tabIndex={-1}
      data-item-id={item.itemId}
      data-state={state}
      className={cn(
        ROW_GRID,
        'relative outline-none',
        state === 'accepted'
          ? 'bg-transparent shadow-[inset_0_0_0_0.5px_var(--separator)]'
          : 'bg-surface-sunken before:absolute before:bottom-3 before:left-0 before:top-3 before:w-[2.5px] before:rounded-r-[2px] before:bg-amber'
      )}
    >
      <KnowledgeType type={item.itemType} />
      <div className="min-w-0">
        {correction.draft ? (
          <CorrectionForm
            draft={correction.draft}
            error={correction.error}
            onChange={correction.setDraft}
            onSave={() => void correction.save()}
            onDiscard={correction.discard}
          />
        ) : (
          <p className="selectable m-0 whitespace-pre-wrap break-words leading-[1.4] text-label">{item.text}</p>
        )}
        <RowMeta item={item} run={run} accepted={accepted} />
      </div>
      {correction.draft ? (
        <div className="flex items-center gap-1">
          <Button variant="primary" size="sm" disabled={actions.busy} onClick={() => void correction.save()}>
            Save correction
          </Button>
          <Button variant="plain" size="sm" onClick={correction.discard}>
            Discard edit
          </Button>
        </div>
      ) : accepted ? (
        <AcceptedActions
          meetingId={meetingId}
          item={item}
          busy={actions.busy}
          onCorrect={correction.begin}
          onReopen={() => void actions.review('reopen')}
          onReject={() => void actions.review('reject')}
        />
      ) : (
        <PendingActions
          busy={actions.busy}
          onAccept={() => void actions.review('accept')}
          onCorrect={correction.begin}
          onReject={() => void actions.review('reject')}
        />
      )}
    </div>
  );
});
