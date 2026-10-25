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
  noneAccepted: 'Nothing was accepted — these items were already reviewed',
  undoStale: 'This item changed since. Nothing was undone.',
  undoPartial: 'Some items changed since. Only part of this was undone.',
};

const CHANGED_ELSEWHERE = new Set(['KNOWLEDGE_REVISION_CONFLICT', 'KNOWLEDGE_INVALID_TRANSITION', 'KNOWLEDGE_ITEM_NOT_FOUND']);

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

function useUndoShortcut(undoLatest: () => boolean) {
  const handler = useRef(undoLatest);
  useEffect(() => {
    handler.current = undoLatest;
  });
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.metaKey || event.shiftKey || event.altKey || event.ctrlKey || event.key.toLowerCase() !== 'z') return;
      if (event.defaultPrevented || isTextField(event.target)) return;
      if (handler.current()) event.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}

function nextPending(items: KnowledgeItemView[], itemId: string): KnowledgeItemView | undefined {
  const index = items.findIndex((item) => item.itemId === itemId);
  const pending = (item: KnowledgeItemView) => item.reviewState === 'proposed' && item.itemId !== itemId;
  return items.slice(index + 1).find(pending) ?? items.find(pending);
}

interface LiveUndo extends UndoEntry {
  toastId: string;
}

// Module-wide so a remounted block never reuses the id of a toast still on screen.
let undoToastCount = 0;

// Each Undo toast owns its entry; ⌘Z takes the newest. A toast whose undo no longer applies is dismissed.
function useUndo(meetingId: string, apply: (view: KnowledgeItemView) => void) {
  const live = useRef<LiveUndo[]>([]);
  const drop = useCallback((stale: (entry: LiveUndo) => boolean) => {
    live.current = live.current.filter((entry) => {
      if (!stale(entry)) return true;
      toast.dismiss(entry.toastId);
      return false;
    });
  }, []);
  const undo = useCallback(async (toastId: string) => {
    const entry = live.current.find((candidate) => candidate.toastId === toastId);
    if (!entry) return;
    drop((candidate) => candidate === entry);
    let undone = 0;
    try {
      for (const itemId of entry.itemIds) {
        apply(await reviewKnowledgeItem(meetingId, itemId, entry.action));
        undone += 1;
      }
    } catch (error) {
      if (typeof error === 'string' && CHANGED_ELSEWHERE.has(error)) {
        toast.info(undone === 0 ? REVIEW_TOAST.undoStale : REVIEW_TOAST.undoPartial);
        return;
      }
      console.error('Failed to undo the review action:', error);
      toast.error(REVIEW_ERROR);
    }
  }, [meetingId, apply, drop]);
  const remember = useCallback((entry: UndoEntry): string => {
    drop((candidate) => candidate.itemIds.some((itemId) => entry.itemIds.includes(itemId)));
    undoToastCount += 1;
    const toastId = `review-undo-${undoToastCount}`;
    live.current = [...live.current, { ...entry, toastId }];
    return toastId;
  }, [drop]);
  const forgetAll = useCallback(() => drop(() => true), [drop]);
  const expire = useCallback((toastId: string) => {
    live.current = live.current.filter((entry) => entry.toastId !== toastId);
  }, []);
  useUndoShortcut(() => {
    const latest: LiveUndo | undefined = live.current[live.current.length - 1];
    if (latest) void undo(latest.toastId);
    return latest !== undefined;
  });
  return { undo, remember, forgetAll, expire };
}

function useStaggeredApply(apply: (view: KnowledgeItemView) => void) {
  const pending = useRef(new Map<string, number>());
  const mounted = useRef(true);
  const cancel = useCallback((itemId: string) => {
    window.clearTimeout(pending.current.get(itemId));
    pending.current.delete(itemId);
  }, []);
  const applyNow = useCallback((view: KnowledgeItemView) => {
    cancel(view.itemId);
    apply(view);
  }, [apply, cancel]);
  const applyLater = useCallback((view: KnowledgeItemView, delayMs: number) => {
    if (!mounted.current) return;
    cancel(view.itemId);
    pending.current.set(view.itemId, window.setTimeout(() => {
      pending.current.delete(view.itemId);
      apply(view);
    }, delayMs));
  }, [apply, cancel]);
  useEffect(() => {
    const timers = pending.current;
    mounted.current = true;
    return () => {
      mounted.current = false;
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
    };
  }, []);
  return { applyNow, applyLater };
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

interface UndoToastOptions {
  id: string;
  action: { label: string; onClick: () => void };
  onDismiss: () => void;
  onAutoClose: () => void;
}

type UndoToast = (entry: UndoEntry) => UndoToastOptions;

function useAcceptAll(meetingId: string, items: KnowledgeItemView[], applyLater: (view: KnowledgeItemView, delayMs: number) => void, withUndo: UndoToast) {
  const [acceptingAll, setAcceptingAll] = useState(false);
  const acceptAll = async () => {
    const itemIds = items.filter((item) => item.reviewState === 'proposed').map((item) => item.itemId);
    setAcceptingAll(true);
    try {
      const result = await acceptAllKnowledgeItems(meetingId, itemIds);
      const stagger = prefersReducedMotion() ? 0 : ACCEPT_ALL_STAGGER_MS;
      const requested = new Set(itemIds);
      const views = result.items.filter((item) => requested.has(item.itemId));
      views.forEach((view, index) => applyLater(view, index * stagger));
      const acceptedIds = views.filter((view) => view.reviewState === 'accepted').map((view) => view.itemId);
      if (acceptedIds.length === 0) {
        toast.info(REVIEW_TOAST.noneAccepted);
        return;
      }
      toast.success(`Accepted ${acceptedIds.length} items`, withUndo({ itemIds: acceptedIds, action: 'reopen' }));
    } catch (error) {
      console.error('Failed to accept all knowledge items:', error);
      toast.error(REVIEW_ERROR);
    } finally {
      setAcceptingAll(false);
    }
  };
  return { acceptingAll, acceptAll };
}

function useDecisions(items: KnowledgeItemView[], apply: (view: KnowledgeItemView) => void, withUndo: UndoToast, forgetAll: () => void) {
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
      forgetAll();
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
  const { applyNow, applyLater } = useStaggeredApply(apply);
  const { undo, remember, forgetAll, expire } = useUndo(meetingId, applyNow);
  const withUndo: UndoToast = (entry) => {
    const id = remember(entry);
    return { id, action: { label: 'Undo', onClick: () => void undo(id) }, onDismiss: () => expire(id), onAutoClose: () => expire(id) };
  };
  const { acceptingAll, acceptAll } = useAcceptAll(meetingId, knowledge.items, applyLater, withUndo);
  const { rows, onDecided } = useDecisions(knowledge.items, applyNow, withUndo, forgetAll);
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
