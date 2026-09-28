'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ProviderBoundary, type ProviderRouteViewState } from '@/components/ProviderBoundary';
import {
  isProviderRouteFailureError,
  validateProviderRoute,
} from '@/services/providerRouteService';
import {
  getMeetingKnowledge,
  onKnowledgeUpdated,
  startKnowledgeExtraction,
  type KnowledgeItemView,
  type KnowledgeRunView,
  type KnowledgeType,
  type MeetingKnowledgeView,
} from '@/lib/knowledge-service';

const TYPE_LABELS: Record<KnowledgeType, string> = {
  decision: 'Decision',
  commitment: 'Commitment',
  question: 'Question',
  fact: 'Fact',
};

const COPY = {
  running: 'Reading the transcript…',
  notRun: 'No knowledge yet',
  nothingFound: 'Nothing to review',
  nothingFoundBody: 'Telu found no decisions, commitments, questions or facts it could quote.',
  allAbstained: 'Nothing Telu could quote',
  allAbstainedBody:
    "Telu found possible items but couldn't match them word for word to the transcript, so it left them out.",
  malformed: "Telu couldn't use the model's answer. Your transcript is unchanged.",
  generic: "Telu couldn't finish reading this meeting. Your transcript is unchanged.",
  route: "Your Summary provider couldn't be validated. Nothing was sent. Check it in Settings.",
};

const INITIAL_ROUTE_STATE: ProviderRouteViewState = { status: 'loading', route: null, failure: null };

function isRouteRejection(error: unknown) {
  return isProviderRouteFailureError(error)
    || (typeof error === 'string' && error.startsWith('PROVIDER_ROUTE_'));
}

function useMeetingKnowledge(meetingId: string) {
  const [knowledge, setKnowledge] = useState<MeetingKnowledgeView | null>(null);

  const reload = useCallback(async () => {
    try {
      setKnowledge(await getMeetingKnowledge(meetingId));
    } catch {
      toast.error(COPY.generic);
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

  return { knowledge, setKnowledge };
}

function RunMessage({ run }: { run: KnowledgeRunView | null }) {
  if (!run) {
    return <p className="text-sm font-semibold text-foreground">{COPY.notRun}</p>;
  }
  if (run.status === 'failed') {
    return (
      <p className="text-sm text-muted-foreground">
        {run.failureCode === 'MALFORMED_OUTPUT' ? COPY.malformed : COPY.generic}
      </p>
    );
  }
  const abstainedOnly = run.skippedCount > 0;
  return (
    <div className="space-y-1">
      <p className="text-sm font-semibold text-foreground">
        {abstainedOnly ? COPY.allAbstained : COPY.nothingFound}
      </p>
      <p className="text-sm text-muted-foreground">
        {abstainedOnly ? COPY.allAbstainedBody : COPY.nothingFoundBody}
      </p>
    </div>
  );
}

function KnowledgeItem({ item }: { item: KnowledgeItemView }) {
  const quote = item.evidence[0]?.quoteText;
  return (
    <li className="space-y-1 rounded-md border p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
        {TYPE_LABELS[item.itemType]}
      </p>
      <p className="text-sm text-foreground">{item.text}</p>
      {quote && (
        <blockquote className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          {quote}
        </blockquote>
      )}
    </li>
  );
}

export function KnowledgeSection({ meetingId }: { meetingId: string }) {
  const [routeState, setRouteState] = useState<ProviderRouteViewState>(INITIAL_ROUTE_STATE);
  const [isStarting, setIsStarting] = useState(false);
  const { knowledge, setKnowledge } = useMeetingKnowledge(meetingId);
  const latestRun = knowledge?.latestRun ?? null;
  const items = knowledge?.items ?? [];
  const isRunning = latestRun?.status === 'running';

  const findKnowledge = async () => {
    if (routeState.status !== 'validated') return;
    setIsStarting(true);
    try {
      const freshRoute = await validateProviderRoute(routeState.route);
      const run = await startKnowledgeExtraction(meetingId, freshRoute, 'user');
      setKnowledge((current) => ({ meetingId, items: current?.items ?? [], latestRun: run }));
    } catch (error) {
      toast.error(isRouteRejection(error) ? COPY.route : COPY.generic);
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <section aria-label="Knowledge" className="space-y-3 border-t p-3">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
        KNOWLEDGE
      </h2>
      <ProviderBoundary capability="summary" showUnavailableAlert={false} onRouteStateChange={setRouteState} />
      {isRunning ? (
        <p role="status" className="text-sm text-muted-foreground">{COPY.running}</p>
      ) : (
        <Button
          size="sm"
          onClick={() => void findKnowledge()}
          disabled={routeState.status !== 'validated' || isStarting}
        >
          Find knowledge
        </Button>
      )}
      {items.length > 0 ? (
        <ul className="space-y-2">
          {items.map((item) => <KnowledgeItem key={item.itemId} item={item} />)}
        </ul>
      ) : (
        !isRunning && <RunMessage run={latestRun} />
      )}
    </section>
  );
}
