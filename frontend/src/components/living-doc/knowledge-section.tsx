'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ProviderBoundary, type ProviderRouteViewState } from '@/components/ProviderBoundary';
import { Skeleton } from '@/components/telu-ui/indicators';
import {
  isProviderRouteFailureError,
  isRouteAvailable,
  validateProviderRoute,
} from '@/services/providerRouteService';
import {
  cancelKnowledgeExtraction,
  getMeetingKnowledge,
  onKnowledgeUpdated,
  startKnowledgeExtraction,
  type KnowledgeRunView,
  type MeetingKnowledgeView,
  type TriggerKind,
} from '@/lib/knowledge-service';
import type { MeetingCompleteness } from '@/types';
import { RunNotice } from './run-notice';
import { RunDetailsPopover, alreadyDecided } from './run-details-popover';
import {
  AbstentionLine,
  EmptyResult,
  ExplicitStartCard,
  FailedCard,
  KNOWLEDGE_COPY,
  KnowledgeItemList,
  NoEvidenceCard,
  RunningRow,
} from './knowledge-run-states';

const INITIAL_ROUTE_STATE: ProviderRouteViewState = { status: 'loading', route: null, failure: null };
const GAP_COMPLETENESS: MeetingCompleteness[] = ['incomplete', 'recovered_with_gaps'];
const autoStartedMeetings = new Set<string>();

interface KnowledgeSectionProps {
  meetingId: string;
  completeness?: MeetingCompleteness;
  autoGenerate?: boolean;
  hasEvidence?: boolean;
  surface?: 'page' | 'peek';
}

function isRouteRejection(error: unknown) {
  return isProviderRouteFailureError(error) || (typeof error === 'string' && error.startsWith('PROVIDER_ROUTE_'));
}

function regenerateToast(run: KnowledgeRunView): string {
  const decided = alreadyDecided(run);
  if (run.proposedCount === 0) return `No new items · ${decided} already decided`;
  const noun = run.proposedCount === 1 ? 'item' : 'items';
  return `Found ${run.proposedCount} new ${noun} · ${decided} already decided`;
}

function useMeetingKnowledge(meetingId: string) {
  const [knowledge, setKnowledge] = useState<MeetingKnowledgeView | null>(null);
  const reload = useCallback(async () => {
    try {
      setKnowledge(await getMeetingKnowledge(meetingId));
    } catch (error) {
      console.error('Failed to load meeting knowledge:', error);
      toast.error(KNOWLEDGE_COPY.generic);
    }
  }, [meetingId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    let stopListening: (() => void) | undefined;
    let disposed = false;
    void onKnowledgeUpdated((event) => {
      if (event.meetingId === meetingId) void reload();
    }).then((unlisten) => {
      if (disposed) unlisten();
      else stopListening = unlisten;
    });
    return () => {
      disposed = true;
      stopListening?.();
    };
  }, [meetingId, reload]);

  return { knowledge, setKnowledge, reload };
}

interface RunStarterOptions {
  meetingId: string;
  routeState: ProviderRouteViewState;
  onStarted: (run: KnowledgeRunView) => void;
  onNoEvidence: () => void;
  reload: () => Promise<void>;
}

function useRunStarter({ meetingId, routeState, onStarted, onNoEvidence, reload }: RunStarterOptions) {
  const [starting, setStarting] = useState(false);
  const [routeBlocked, setRouteBlocked] = useState(false);

  const startRun = useCallback(async (trigger: TriggerKind) => {
    if (routeState.status !== 'validated') {
      setRouteBlocked(true);
      return null;
    }
    setStarting(true);
    try {
      const freshRoute = await validateProviderRoute(routeState.route);
      if (!isRouteAvailable(freshRoute)) {
        setRouteBlocked(true);
        return null;
      }
      const run = await startKnowledgeExtraction(meetingId, freshRoute, trigger);
      setRouteBlocked(false);
      onStarted(run);
      return run;
    } catch (error) {
      if (isRouteRejection(error)) setRouteBlocked(true);
      else if (error === 'KNOWLEDGE_NO_EVIDENCE') onNoEvidence();
      else if (error === 'KNOWLEDGE_RUN_IN_PROGRESS') await reload();
      else {
        console.error('Failed to start knowledge extraction:', error);
        toast.error(KNOWLEDGE_COPY.generic);
      }
      return null;
    } finally {
      setStarting(false);
    }
  }, [meetingId, routeState, onStarted, onNoEvidence, reload]);

  return { starting, routeBlocked, startRun };
}

interface KnowledgeHeadProps {
  meetingId: string;
  pendingCount: number;
  hasRun: boolean;
  running: boolean;
  onRegenerate: () => void;
}

function KnowledgeHead({ meetingId, pendingCount, hasRun, running, onRegenerate }: KnowledgeHeadProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const detailsRequested = useRef(false);
  return (
    <div className="flex items-center gap-2">
      <h2 id="knowledge-heading" className="sec-eyebrow m-0">Knowledge</h2>
      {pendingCount > 0 && <span className="text-[11px] font-medium text-amber">· {pendingCount} to review</span>}
      <div className="flex-1" />
      {hasRun && (
        <RunDetailsPopover meetingId={meetingId} open={detailsOpen} onOpenChange={setDetailsOpen}>
          <span className="inline-flex">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="plain" size="sm" icon aria-label="Knowledge actions">
                  <MoreHorizontal aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                onCloseAutoFocus={(event) => {
                  if (!detailsRequested.current) return;
                  detailsRequested.current = false;
                  event.preventDefault();
                }}
              >
                <DropdownMenuItem disabled={running} onSelect={onRegenerate}>Regenerate…</DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    detailsRequested.current = true;
                    setDetailsOpen(true);
                  }}
                >
                  Run details
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </span>
        </RunDetailsPopover>
      )}
    </div>
  );
}

function useLatch(value: boolean) {
  const latched = useRef(value);
  if (value) latched.current = true;
  return latched.current;
}

export function KnowledgeSection({
  meetingId,
  completeness = 'complete',
  autoGenerate = false,
  hasEvidence = true,
  surface = 'page',
}: KnowledgeSectionProps) {
  const [routeState, setRouteState] = useState<ProviderRouteViewState>(INITIAL_ROUTE_STATE);
  const [noEvidence, setNoEvidence] = useState(!hasEvidence);
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const regenerateRunId = useRef<string | null>(null);
  const { knowledge, setKnowledge, reload } = useMeetingKnowledge(meetingId);
  const onStarted = useCallback((run: KnowledgeRunView) => {
    setKnowledge((current) => (current ? { ...current, latestRun: run } : current));
  }, [setKnowledge]);
  const onNoEvidence = useCallback(() => setNoEvidence(true), []);
  const { starting, routeBlocked, startRun } = useRunStarter({ meetingId, routeState, onStarted, onNoEvidence, reload });
  const autoRequested = useLatch(autoGenerate);
  const latestRun = knowledge?.latestRun ?? null;
  const items = knowledge?.items ?? [];

  useEffect(() => {
    setNoEvidence(!hasEvidence);
  }, [hasEvidence]);

  const autoEligible = autoRequested && completeness === 'complete' && !noEvidence && !routeBlocked
    && routeState.status !== 'unavailable' && routeState.status !== 'materially_changed';

  useEffect(() => {
    if (!autoEligible || routeState.status !== 'validated' || !knowledge || knowledge.latestRun) return;
    if (autoStartedMeetings.has(meetingId)) return;
    autoStartedMeetings.add(meetingId);
    void startRun('auto');
  }, [autoEligible, routeState.status, knowledge, meetingId, startRun]);

  useEffect(() => {
    if (!latestRun || latestRun.runId !== regenerateRunId.current || latestRun.status === 'running') return;
    regenerateRunId.current = null;
    if (latestRun.status === 'succeeded') toast.success(regenerateToast(latestRun));
  }, [latestRun]);

  const regenerate = async () => {
    setRegenerateOpen(false);
    const run = await startRun('regenerate');
    if (run) regenerateRunId.current = run.runId;
  };

  const startButton = (label: string, trigger: TriggerKind) => (
    <Button
      variant="primary"
      size="sm"
      disabled={routeState.status !== 'validated' || routeBlocked || starting}
      onClick={() => void startRun(trigger)}
    >
      {label}
    </Button>
  );
  const notice = (action: ReactNode) => (
    <RunNotice routeState={routeState} blocked={routeBlocked} action={action} />
  );

  const running = latestRun?.status === 'running';
  const autoPending = autoEligible && !latestRun && (!autoStartedMeetings.has(meetingId) || starting);
  const gapMeeting = GAP_COMPLETENESS.includes(completeness);

  const statusBlock = () => {
    if (noEvidence) return <NoEvidenceCard />;
    if (!knowledge && !autoPending) {
      return (
        <div aria-busy className="space-y-2">
          <Skeleton active />
          <Skeleton active shape="line-short" />
        </div>
      );
    }
    if (running || autoPending) return <RunningRow onStop={running ? () => void cancelKnowledgeExtraction(meetingId) : undefined} />;
    if (latestRun?.status === 'failed') return <FailedCard run={latestRun} notice={notice(startButton('Try again', 'user'))} />;
    if (latestRun?.status === 'succeeded' && items.length === 0) return <EmptyResult run={latestRun} />;
    if (latestRun && latestRun.status !== 'cancelled') return null;
    if (items.length > 0 && latestRun) return null;
    return (
      <ExplicitStartCard
        gapMeeting={gapMeeting}
        notice={notice(startButton(gapMeeting ? 'Find knowledge anyway' : 'Find knowledge', 'user'))}
      />
    );
  };

  return (
    <section
      aria-labelledby="knowledge-heading"
      data-surface={surface}
      className="scroll-mt-[72px] space-y-3"
    >
      <ProviderBoundary
        capability="summary"
        className="hidden"
        showUnavailableAlert={false}
        onRouteStateChange={setRouteState}
      />
      <KnowledgeHead
        meetingId={meetingId}
        pendingCount={knowledge?.pendingCount ?? 0}
        hasRun={Boolean(latestRun)}
        running={running}
        onRegenerate={() => setRegenerateOpen(true)}
      />
      {regenerateOpen && !running && notice(
        <>
          <Button variant="primary" size="sm" disabled={routeState.status !== 'validated' || routeBlocked} onClick={() => void regenerate()}>
            Regenerate
          </Button>
          <Button variant="plain" size="sm" onClick={() => setRegenerateOpen(false)}>
            Keep current items
          </Button>
        </>
      )}
      {statusBlock()}
      {!noEvidence && latestRun?.status === 'succeeded' && items.length > 0 && latestRun.skippedCount > 0 && (
        <AbstentionLine skipped={latestRun.skippedCount} />
      )}
      {!noEvidence && items.length > 0 && <KnowledgeItemList items={items} />}
    </section>
  );
}
