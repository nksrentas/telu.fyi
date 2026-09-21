'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, FolderOpen } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  diagnosticsService,
  DiagnosticExportResult,
  DiagnosticExportSelection,
} from '@/services/diagnosticsService';

interface DiagnosticExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  runId: string;
}

const INCLUDED_CATEGORIES = [
  'Result and limitations',
  'Environment',
  'Stage timing',
  'Queue and terminal outcomes',
  'Resources',
  'Provider route and outbound attempts',
  'Redacted errors',
];

function errorCode(error: unknown): string {
  return error && typeof error === 'object' && 'code' in error
    ? String(error.code)
    : 'DIAGNOSTIC_EXPORT_FILESYSTEM_FAILED';
}

export function DiagnosticExportDialog({ open, onOpenChange, runId }: DiagnosticExportDialogProps) {
  const [includeTranscript, setIncludeTranscript] = useState(false);
  const [includeAudio, setIncludeAudio] = useState(false);
  const [destination, setDestination] = useState<DiagnosticExportSelection | null>(null);
  const [result, setResult] = useState<DiagnosticExportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const reset = useCallback(() => {
    setIncludeTranscript(false);
    setIncludeAudio(false);
    setDestination(null);
    setResult(null);
    setError(null);
    setChoosing(false);
    setExporting(false);
  }, []);

  useEffect(() => {
    if (open) reset();
  }, [open, reset, runId]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) reset();
    onOpenChange(nextOpen);
  };

  const chooseFolder = async () => {
    setChoosing(true);
    setError(null);
    setResult(null);
    try {
      const selected = await diagnosticsService.selectExportFolder();
      if (selected) setDestination(selected);
    } catch (cause) {
      setError(errorCode(cause));
    } finally {
      setChoosing(false);
    }
  };

  const exportCopy = async () => {
    if (!destination) return;
    setExporting(true);
    setError(null);
    setResult(null);
    try {
      setResult(await diagnosticsService.exportLocalCopy({
        runId,
        destinationToken: destination.token,
        includeTranscript,
        includeAudio,
      }));
    } catch (cause) {
      setError(errorCode(cause));
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Review diagnostic export</DialogTitle>
          <DialogDescription>Transcript text and audio are excluded unless you include them below.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 text-sm">
          <section className="space-y-2">
            <h3 className="font-semibold text-foreground">Included categories</h3>
            <ul className="space-y-1 text-muted-foreground">
              {INCLUDED_CATEGORIES.map((category) => <li key={category}>• {category}</li>)}
            </ul>
          </section>

          <Separator />

          <section className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-semibold text-foreground">Destination folder</h3>
                <p className="break-words text-muted-foreground">{destination?.folderName ?? 'Choose a local folder before export.'}</p>
              </div>
              <Button type="button" variant="outline" onClick={() => void chooseFolder()} disabled={choosing || exporting}>
                <FolderOpen aria-hidden="true" />
                {choosing ? 'Choosing folder…' : destination ? 'Choose another folder' : 'Choose folder'}
              </Button>
            </div>
          </section>

          <Separator />

          <section className="space-y-2">
            <h3 className="font-semibold text-foreground">Redaction policy</h3>
            <p className="text-muted-foreground">Credentials, request content, and sensitive full paths remain excluded. Telu revalidates the bundle and creates a new local copy without changing the source.</p>
          </section>

          <Separator />

          <section className="space-y-4" aria-label="Optional sensitive content">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <Label htmlFor="diagnostic-transcript">Transcript text</Label>
                <p className="text-xs text-muted-foreground">Requested only for this export and included only when the source bundle contains it.</p>
              </div>
              <Switch id="diagnostic-transcript" checked={includeTranscript} onCheckedChange={setIncludeTranscript} disabled={exporting || Boolean(result)} aria-label="Include transcript text in this export" />
            </div>
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <Label htmlFor="diagnostic-audio">Audio</Label>
                <p className="text-xs text-muted-foreground">Requested separately for this export and included only when the source bundle contains it.</p>
              </div>
              <Switch id="diagnostic-audio" checked={includeAudio} onCheckedChange={setIncludeAudio} disabled={exporting || Boolean(result)} aria-label="Include audio in this export" />
            </div>
          </section>

          {error && (
            <Alert variant="destructive">
              <AlertCircle aria-hidden="true" />
              <AlertTitle>Diagnostic copy could not be created</AlertTitle>
              <AlertDescription className="space-y-3">
                <p>Filesystem reason: {error}</p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => void exportCopy()} disabled={!destination || exporting}>Retry export</Button>
                  <Button type="button" variant="ghost" onClick={() => void chooseFolder()} disabled={choosing || exporting}>Choose another folder</Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {result && (
            <Alert>
              <CheckCircle2 aria-hidden="true" />
              <AlertTitle>Diagnostic copy exported locally</AlertTitle>
              <AlertDescription className="space-y-3">
                <p>{result.folderName}</p>
                {(result.transcriptRequested && !result.transcriptIncluded) || (result.audioRequested && !result.audioIncluded) ? (
                  <p>Requested sensitive content was not present in the source bundle, so it was not added.</p>
                ) : null}
                <Button type="button" variant="outline" onClick={() => void diagnosticsService.showExportInFolder(result.revealToken)}>Show in folder</Button>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>Close</Button>
          <Button type="button" onClick={() => void exportCopy()} disabled={!destination || exporting || Boolean(result)}>
            {exporting ? 'Exporting local copy…' : 'Export local copy'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
