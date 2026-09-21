'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, CircleHelp, Copy, RotateCcw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  diagnosticsService,
  DiagnosticRunDetail,
  DiagnosticRunSummary,
  DiagnosticStatus,
} from '@/services/diagnosticsService';

const UNKNOWN = 'Unknown';

function display(value: string | number | null | undefined): string {
  return value === null || value === undefined || value === '' ? UNKNOWN : String(value);
}

function formatDate(value: string | null): string {
  if (!value) return UNKNOWN;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? UNKNOWN : date.toLocaleString();
}

function formatDuration(value: number | null): string {
  if (value === null) return UNKNOWN;
  if (value < 1_000) return `${value} ms`;
  const seconds = value / 1_000;
  return seconds < 60 ? `${seconds.toFixed(1)} s` : `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
}

function formatBytes(value: number | null): string {
  if (value === null) return UNKNOWN;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KiB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MiB`;
}

function statusPresentation(status: DiagnosticStatus) {
  if (status === 'pass') return { label: 'Pass', Icon: CheckCircle2 };
  if (status === 'fail') return { label: 'Fail', Icon: AlertCircle };
  return { label: 'Unknown', Icon: CircleHelp };
}

function Status({ value }: { value: DiagnosticStatus }) {
  const { label, Icon } = statusPresentation(value);
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-xs font-semibold text-foreground">
      <Icon aria-hidden="true" className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

function CopyId({ label, value }: { label: string; value: string }) {
  const copy = () => navigator.clipboard?.writeText(value);
  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      <code className="select-all break-all text-xs tabular-nums text-muted-foreground">{value}</code>
      <Button type="button" variant="ghost" size="icon" className="h-11 w-11 shrink-0" onClick={copy} aria-label={`Copy ${label}`}>
        <Copy aria-hidden="true" />
      </Button>
    </span>
  );
}

function TechnicalTable({ headings, rows }: { headings: string[]; rows: Array<Array<string | number | null>> }) {
  return (
    <ScrollArea className="w-full rounded-md border border-border">
      <div className="overflow-x-auto">
        <table className="w-full min-w-max border-collapse text-left text-xs tabular-nums">
          <thead className="bg-muted text-muted-foreground">
            <tr>{headings.map((heading, index) => <th key={heading} className={`px-3 py-2 font-semibold ${index === 0 ? 'sticky left-0 bg-muted' : ''}`}>{heading}</th>)}</tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td className="px-3 py-3 text-muted-foreground" colSpan={headings.length}>No records</td></tr>
            ) : rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-t border-border">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="max-w-[28rem] break-words px-3 py-2 first:sticky first:left-0 first:bg-card">
                    {display(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3" aria-labelledby={`diagnostic-${title.toLowerCase().replaceAll(' ', '-')}`}>
      <h3 id={`diagnostic-${title.toLowerCase().replaceAll(' ', '-')}`} className="text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </section>
  );
}

function DiagnosticDetail({ detail, onClose }: { detail: DiagnosticRunDetail; onClose: () => void }) {
  return (
    <div className="space-y-6 rounded-lg border border-border bg-card p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-xs text-muted-foreground">Run ID</p>
          <CopyId label="run ID" value={detail.runId} />
          <p className="text-xs text-muted-foreground">Meeting ID</p>
          <CopyId label="meeting ID" value={detail.meetingId} />
        </div>
        <Button type="button" variant="outline" onClick={onClose}>Back to runs</Button>
      </div>

      <Separator />

      <Section title="Result and limitations">
        <div className="flex flex-wrap items-center gap-3"><Status value={detail.result.outcome} /><span className="text-sm">{display(detail.result.outcomeReason)}</span></div>
        <TechnicalTable headings={['Check', 'Result', 'Reason']} rows={detail.result.checks.map((item) => [item.id, statusPresentation(item.status).label, item.reason])} />
        <div className="space-y-1 text-sm">
          <p className="font-semibold">Limitations</p>
          {detail.result.limitations.length === 0 ? <p className="text-muted-foreground">None recorded</p> : detail.result.limitations.map((item) => <p key={item} className="break-words text-muted-foreground">{item}</p>)}
          <p className="pt-2 font-semibold">Outliers</p>
          {detail.result.outliers.length === 0 ? <p className="text-muted-foreground">None recorded</p> : detail.result.outliers.map((item, index) => <pre key={index} className="overflow-x-auto whitespace-pre-wrap break-words rounded-md bg-muted p-3 text-xs">{JSON.stringify(item, null, 2)}</pre>)}
        </div>
      </Section>

      <Separator />

      <Section title="Environment">
        <TechnicalTable headings={['Field', 'Status', 'Value', 'Reason']} rows={detail.environment.map((item) => [item.label, statusPresentation(item.status).label, item.value, item.reason])} />
      </Section>

      <Separator />

      <Section title="Stage timing">
        <TechnicalTable headings={['Stage', 'Offset (µs)', 'Observed', 'Work ID', 'Evidence ID']} rows={detail.stages.map((item) => [item.stage, item.observedOffsetMicros, item.observedAtUtc, item.workId, item.evidenceId])} />
      </Section>

      <Separator />

      <Section title="Queue and terminal outcomes">
        <TechnicalTable headings={['Sequence', 'Depth', 'Active', 'Oldest (ms)', 'Accepted', 'Started', 'Completed', 'Failed', 'Cancelled', 'Superseded', 'Rejected']} rows={detail.queues.map((item) => [item.sequence, item.depth, item.active, item.oldestAgeMs, item.accepted, item.started, item.completed, item.failed, item.cancelled, item.superseded, item.rejected])} />
      </Section>

      <Separator />

      <Section title="Resources">
        <TechnicalTable headings={['Observed', 'Process CPU %', 'Process memory', 'System CPU %', 'System memory', 'Power', 'Battery %', 'Energy impact', 'Uncertainty']} rows={detail.resources.map((item) => [item.observedAtUtc, item.processCpuPercent, formatBytes(item.processMemoryBytes), item.systemCpuPercent, formatBytes(item.systemMemoryBytes), item.powerSource, item.batteryPercent, item.energyImpact, item.uncertainty])} />
      </Section>

      <Separator />

      <Section title="Provider route and outbound attempts">
        <TechnicalTable headings={['Type', 'Capability', 'Provider', 'Boundary', 'Destination', 'Disposition', 'Code']} rows={detail.routes.map((item) => [item.recordType, item.route.capability, item.route.providerId, item.route.locationClass, item.route.sanitizedOrigin, item.disposition, item.redactedCode])} />
      </Section>

      <Separator />

      <Section title="Redacted errors">
        <TechnicalTable headings={['Observed', 'Component', 'Code', 'Work ID', 'Evidence ID']} rows={detail.errors.map((item) => [item.observedAtUtc, item.component, item.redactedCode, item.workId, item.evidenceId])} />
      </Section>
    </div>
  );
}

export function DiagnosticsPanel() {
  const [runs, setRuns] = useState<DiagnosticRunSummary[]>([]);
  const [detail, setDetail] = useState<DiagnosticRunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRuns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRuns(await diagnosticsService.listRuns());
    } catch (cause) {
      setError(cause && typeof cause === 'object' && 'code' in cause ? String(cause.code) : 'DIAGNOSTIC_UNAVAILABLE');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadRuns(); }, [loadRuns]);

  const openDetail = async (runId: string) => {
    setDetailLoading(true);
    setError(null);
    try {
      setDetail(await diagnosticsService.readRun(runId));
    } catch (cause) {
      setError(cause && typeof cause === 'object' && 'code' in cause ? String(cause.code) : 'DIAGNOSTIC_UNAVAILABLE');
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 py-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold text-foreground">Diagnostics</h2>
        <p className="text-sm text-muted-foreground">Inspect measured local evidence without adding detail to normal recording.</p>
      </div>

      <Alert>
        <CircleHelp aria-hidden="true" />
        <AlertTitle>Local diagnostic data</AlertTitle>
        <AlertDescription>Diagnostic data stays on this device unless you export a local copy.</AlertDescription>
      </Alert>

      {error && (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Diagnostics unavailable</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>Telu couldn’t load local diagnostic evidence. Code: {error}</span>
            <Button type="button" variant="outline" onClick={() => void loadRuns()}><RotateCcw aria-hidden="true" />Retry diagnostics</Button>
          </AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div role="status" className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">Loading diagnostic runs…</div>
      ) : detailLoading ? (
        <div role="status" className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">Loading diagnostic details…</div>
      ) : detail ? (
        <DiagnosticDetail detail={detail} onClose={() => setDetail(null)} />
      ) : runs.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <h3 className="text-sm font-semibold text-foreground">No diagnostic runs yet</h3>
          <p className="mt-2 text-sm text-muted-foreground">Run a baseline scenario, then return here to inspect its local results.</p>
        </div>
      ) : (
        <ScrollArea className="max-h-[60vh] rounded-lg border border-border bg-card">
          <div className="divide-y divide-border">
            {runs.map((run) => (
              <article key={run.runId} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-foreground">{display(run.scenario)}</h3>
                    <Status value={run.outcome} />
                  </div>
                  <dl className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground tabular-nums">
                    <div><dt className="sr-only">Started</dt><dd>{formatDate(run.startedAtUtc)}</dd></div>
                    <div><dt className="sr-only">Route</dt><dd>{display(run.route?.locationClass)} · {display(run.route?.sanitizedOrigin)}</dd></div>
                    <div><dt className="sr-only">Duration</dt><dd>{formatDuration(run.durationMs)}</dd></div>
                  </dl>
                  <CopyId label="run ID" value={run.runId} />
                  {run.validationErrors.length > 0 && <p className="break-words text-xs text-destructive">{run.validationErrors.join(' · ')}</p>}
                </div>
                <Button type="button" variant="outline" onClick={() => void openDetail(run.runId)} disabled={run.status !== 'complete'}>View details</Button>
              </article>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
