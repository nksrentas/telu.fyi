'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  acceptAllKnowledgeItems,
  reviewKnowledgeItem,
  type KnowledgeItemView,
  type MeetingKnowledgeView,
} from '@/lib/knowledge-service';
import { CandidateRow, REVIEW_ERROR, type CandidateDecision } from './candidate-row';
import { RejectedGroup } from './rejected-group';
import { ReviewHead } from './review-head';

const ACCEPT_ALL_STAGGER_MS = 70;

export const REVIEW_TOAST = {
  accepted: 'Accepted — eligible for later meetings',
  acceptedIneligible: 'Accepted',
  rejected: "Rejected — it won't come back unless you restore it",
  restored: "Restored — it's back in review",
  corrected: 'Correction saved — Telu keeps your wording',
};

interface UndoEntry {
  itemIds: string[];
  action: 'reopen' | 'restore';
}

type KnowledgeUpdate = (current: MeetingKnowledgeView) => MeetingKnowledgeView;

function upsert(list: KnowledgeItemView[], view: KnowledgeItemView): KnowledgeItemView[] {
  return list.some((item) => item.itemId === view.itemId)
    ? list.map((item) => (item.itemId === view.itemId ? view : item))
    : [...list, view];
}

export function withItem(knowledge: MeetingKnowledgeView, view: KnowledgeItemView): MeetingKnowledgeView {
  const without = (list: KnowledgeItemView[]) => list.filter((item) => item.itemId !== view.itemId);
  const rejectedView = view.reviewState === 'rejected';
  const items = rejectedView ? without(knowledge.items) : upsert(knowledge.items, view);
  const rejected = rejectedView ? upsert(knowledge.rejected, view) : without(knowledge.rejected);
  return {
    ...knowledge,
    items,
    rejected,
    pendingCount: items.filter((item) => item.reviewState === 'proposed').length,
    acceptedCount: items.filter((item) => item.reviewState === 'accepted').length,
  };
}

function isTextField(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element || typeof element.getAttribute !== 'function') return false;
  return element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.isContentEditable === true;
}

function useUndoShortcut(canUndo: () => boolean, undo: () => void) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.metaKey || event.shiftKey || event.altKey || event.ctrlKey || event.key.toLowerCase() !== 'z') return;
      if (event.defaultPrevented || isTextField(event.target) || !canUndo()) return;
      event.preventDefault();
      undo();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canUndo, undo]);
}

function nextPending(items: KnowledgeItemView[], itemId: string): KnowledgeItemView | undefined {
  const index = items.findIndex((item) => item.itemId === itemId);
  const pending = (item: KnowledgeItemView) => item.reviewState === 'proposed' && item.itemId !== itemId;
  return items.slice(index + 1).find(pending) ?? items.find(pending);
}

function useUndo(meetingId: string, apply: (view: KnowledgeItemView) => void) {
  const last = useRef<UndoEntry | null>(null);
  const undo = useCallback(async () => {
    const entry = last.current;
    last.current = null;
    if (!entry) return;
    try {
      for (const itemId of entry.itemIds) apply(await reviewKnowledgeItem(meetingId, itemId, entry.action));
    } catch (error) {
      console.error('Failed to undo the review action:', error);
      toast.error(REVIEW_ERROR);
    }
  }, [meetingId, apply]);
  const remember = useCallback((entry: UndoEntry | null) => {
    last.current = entry;
  }, []);
  const canUndo = useCallback(() => last.current !== null, []);
  useUndoShortcut(canUndo, () => void undo());
  return { undo, remember };
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

type UndoToast = (entry: UndoEntry) => { action: { label: string; onClick: () => void } };

function useAcceptAll(meetingId: string, items: KnowledgeItemView[], apply: (view: KnowledgeItemView) => void, withUndo: UndoToast) {
  const [acceptingAll, setAcceptingAll] = useState(false);
  const acceptAll = async () => {
    const itemIds = items.filter((item) => item.reviewState === 'proposed').map((item) => item.itemId);
    setAcceptingAll(true);
    try {
      const result = await acceptAllKnowledgeItems(meetingId, itemIds);
      const stagger = prefersReducedMotion() ? 0 : ACCEPT_ALL_STAGGER_MS;
      itemIds.forEach((itemId, index) => {
        const view = result.items.find((item) => item.itemId === itemId);
        if (view) window.setTimeout(() => apply(view), index * stagger);
      });
      toast.success(`Accepted ${itemIds.length} items`, withUndo({ itemIds, action: 'reopen' }));
    } catch (error) {
      console.error('Failed to accept all knowledge items:', error);
      toast.error(REVIEW_ERROR);
    } finally {
      setAcceptingAll(false);
    }
  };
  return { acceptingAll, acceptAll };
}

function useDecisions(items: KnowledgeItemView[], apply: (view: KnowledgeItemView) => void, withUndo: UndoToast, remember: (entry: UndoEntry | null) => void) {
  const rows = useRef(new Map<string, HTMLElement>());
  const onDecided = ({ view, action }: CandidateDecision) => {
    const next = action === 'accept' ? nextPending(items, view.itemId) : undefined;
    apply(view);
    if (action === 'accept') {
      toast.success(view.eligibility ? REVIEW_TOAST.accepted : REVIEW_TOAST.acceptedIneligible, withUndo({ itemIds: [view.itemId], action: 'reopen' }));
      if (next) rows.current.get(next.itemId)?.focus();
    } else if (action === 'reject') {
      toast.info(REVIEW_TOAST.rejected, withUndo({ itemIds: [view.itemId], action: 'restore' }));
    } else {
      remember(null);
      if (action === 'correct') toast.success(REVIEW_TOAST.corrected);
      if (action === 'restore') toast.success(REVIEW_TOAST.restored);
    }
  };
  return { rows, onDecided };
}

interface ReviewBlockProps {
  meetingId: string;
  knowledge: MeetingKnowledgeView;
  onChange: (update: KnowledgeUpdate) => void;
}

export function ReviewBlock({ meetingId, knowledge, onChange }: ReviewBlockProps) {
  const latestRun = knowledge.latestRun;
  const runFor = (item: KnowledgeItemView) => (latestRun?.runId === item.originRunId ? latestRun : null);
  const apply = useCallback((view: KnowledgeItemView) => onChange((current) => withItem(current, view)), [onChange]);
  const { undo, remember } = useUndo(meetingId, apply);
  const withUndo: UndoToast = (entry) => {
    remember(entry);
    return { action: { label: 'Undo', onClick: () => void undo() } };
  };
  const { acceptingAll, acceptAll } = useAcceptAll(meetingId, knowledge.items, apply, withUndo);
  const { rows, onDecided } = useDecisions(knowledge.items, apply, withUndo, remember);
  const skipped = latestRun?.status === 'succeeded' ? latestRun.skippedCount : 0;

  return (
    <div className="space-y-2">
      <ReviewHead pendingCount={knowledge.pendingCount} skippedCount={skipped} busy={acceptingAll} onAcceptAll={() => void acceptAll()} />
      {knowledge.items.map((item) => (
        <CandidateRow
          key={item.itemId}
          ref={(node) => {
            if (node) rows.current.set(item.itemId, node);
            else rows.current.delete(item.itemId);
          }}
          meetingId={meetingId}
          item={item}
          run={runFor(item)}
          onDecided={onDecided}
        />
      ))}
      <RejectedGroup meetingId={meetingId} items={knowledge.rejected} runFor={runFor} onRestored={onDecided} />
    </div>
  );
}
