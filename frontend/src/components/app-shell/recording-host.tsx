'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { toast } from 'sonner';
import { SettingsModals } from '@/app/_components/SettingsModal';
import { StatusOverlays } from '@/app/_components/StatusOverlays';
import { ProviderBoundary, ProviderRouteFailureAlert } from '@/components/ProviderBoundary';
import { useSidebar } from '@/components/Sidebar/SidebarProvider';
import { TranscriptRecovery } from '@/components/TranscriptRecovery';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useConfig } from '@/contexts/ConfigContext';
import { RecordingStatus, useRecordingState } from '@/contexts/RecordingStateContext';
import { useTranscripts } from '@/contexts/TranscriptContext';
import { useModalState } from '@/hooks/useModalState';
import { useRecordingControls, type DeviceError, type RecordingControls } from '@/hooks/use-recording-controls';
import { useRecordingStart } from '@/hooks/useRecordingStart';
import { useRecordingStateSync } from '@/hooks/useRecordingStateSync';
import { useRecordingStop } from '@/hooks/useRecordingStop';
import { useTranscriptRecovery } from '@/hooks/useTranscriptRecovery';
import { indexedDBService } from '@/services/indexedDBService';
import { transcriptService, type FinalizationProgressSnapshot } from '@/services/transcriptService';

export interface RecordingControlsValue extends RecordingControls {
  title: string;
  elapsedSeconds: number | null;
  finalization: FinalizationProgressSnapshot | null;
}

export const RecordingControlsContext = createContext<RecordingControlsValue | null>(null);

export function useRecordingControlsContext(): RecordingControlsValue | null {
  return useContext(RecordingControlsContext);
}

function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element || typeof element.getAttribute !== 'function') return false;
  return element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.isContentEditable === true;
}

function isLayerOpen(): boolean {
  return typeof document !== 'undefined' && typeof document.querySelector === 'function'
    && document.querySelector('[role="dialog"], [role="alertdialog"]') !== null;
}

function useRecordShortcut(controls: RecordingControls) {
  const latest = useRef(controls);
  latest.current = controls;
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.metaKey || event.altKey || event.ctrlKey || event.shiftKey || event.key.toLowerCase() !== 'r') return;
      if (event.defaultPrevented || event.repeat || isTypingTarget(event.target) || isLayerOpen()) return;
      event.preventDefault();
      const current = latest.current;
      if (current.isRecording) void current.stop();
      else if (current.canRecord) void current.start();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}

function useFinalizationSnapshot(): FinalizationProgressSnapshot | null {
  const [snapshot, setSnapshot] = useState<FinalizationProgressSnapshot | null>(null);
  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    void transcriptService
      .onFinalizationProgress(setSnapshot)
      .then((stop) => {
        if (cancelled) stop();
        else unlisten = stop;
      })
      .catch((error: unknown) => console.error('Failed to listen for finalization progress:', error));
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);
  return snapshot;
}

async function cleanUpRecoveryCache() {
  await indexedDBService.deleteOldMeetings(7).catch((error: unknown) => console.warn('Failed to clean up old meetings:', error));
  await indexedDBService.deleteSavedMeetings(24).catch((error: unknown) => console.warn('Failed to clean up saved meetings:', error));
}

function useStartupRecovery() {
  const { isRecording, status } = useRecordingState();
  const { refetchMeetings } = useSidebar();
  const recovery = useTranscriptRecovery();
  const { recoverableMeetings, checkForRecoverableTranscripts, recoverMeeting } = recovery;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const busy = isRecording || status === RecordingStatus.STOPPING
      || status === RecordingStatus.PROCESSING_TRANSCRIPTS || status === RecordingStatus.SAVING;
    if (busy) return;
    void cleanUpRecoveryCache()
      .then(() => checkForRecoverableTranscripts())
      .catch((error: unknown) => console.error('Failed to perform startup checks:', error));
  }, [checkForRecoverableTranscripts, isRecording, status]);

  useEffect(() => {
    if (recoverableMeetings.length === 0 || sessionStorage.getItem('recovery_dialog_shown')) return;
    setOpen(true);
    sessionStorage.setItem('recovery_dialog_shown', 'true');
  }, [recoverableMeetings]);

  const onRecover = async (meetingId: string) => {
    try {
      const result = await recoverMeeting(meetingId);
      await refetchMeetings();
      return result;
    } catch (error) {
      toast.error('Failed to recover meeting', {
        description: 'Telu could not reconcile this meeting. The recovery record is unchanged.',
      });
      throw error;
    }
  };

  const onClose = () => {
    setOpen(false);
    if (recoverableMeetings.length === 0) sessionStorage.removeItem('recovery_dialog_shown');
  };

  return { open, onClose, onRecover, recovery };
}

function DeviceErrorAlert({ error, onDismiss }: { error: DeviceError; onDismiss: () => void }) {
  return (
    <Alert variant="destructive" className="relative w-full max-w-[560px] shadow-float">
      <AlertCircle aria-hidden className="size-4" />
      <Button variant="plain" size="sm" icon aria-label="Close alert" className="absolute right-2 top-2" onClick={onDismiss}>
        <X aria-hidden />
      </Button>
      <AlertTitle>{error.title}</AlertTitle>
      <AlertDescription>{error.message}</AlertDescription>
    </Alert>
  );
}

function useHostControls() {
  const [isRecording, setIsRecording] = useState(false);
  const { transcriptModelConfig } = useConfig();
  const { setIsMeetingActive } = useSidebar();
  const modalState = useModalState(transcriptModelConfig);
  const { showModal } = modalState;
  const { isRecordingDisabled, setIsRecordingDisabled } = useRecordingStateSync(isRecording, setIsRecording, setIsMeetingActive);
  const { handleRecordingStart } = useRecordingStart(isRecording, setIsRecording, showModal);
  const { handleRecordingStop, setIsStopping } = useRecordingStop(setIsRecording, setIsRecordingDisabled);
  const onRecordingStop = useCallback((callApi = true) => void handleRecordingStop(callApi), [handleRecordingStop]);
  const onStopInitiated = useCallback(() => setIsStopping(true), [setIsStopping]);
  const onTranscriptionError = useCallback((message: string) => showModal('errorAlert', message), [showModal]);
  const controls = useRecordingControls({
    onRecordingStart: handleRecordingStart,
    onRecordingStop,
    onStopInitiated,
    onTranscriptionError,
    isRecordingDisabled,
  });
  return { controls, modalState };
}

function focusTranscriptionProvider(showModal: ReturnType<typeof useModalState>['showModal']) {
  showModal('modelSelector', 'Transcription model settings');
  window.setTimeout(() => document.getElementById('transcription-provider-control')?.focus(), 0);
}

export function RecordingHost({ children }: { children: ReactNode }) {
  const recordingState = useRecordingState();
  const { meetingTitle } = useTranscripts();
  const { controls, modalState } = useHostControls();
  const startup = useStartupRecovery();
  const finalization = useFinalizationSnapshot();
  useRecordShortcut(controls);
  const { status } = recordingState;
  const elapsedSeconds = recordingState.activeDuration ?? recordingState.recordingDuration ?? null;
  const value = useMemo(
    () => ({ ...controls, title: meetingTitle || 'Recording', elapsedSeconds, finalization }),
    [controls, meetingTitle, elapsedSeconds, finalization]
  );

  return (
    <RecordingControlsContext.Provider value={value}>
      <ProviderBoundary
        capability="transcription"
        className="hidden"
        refreshKey={controls.routeRefreshKey}
        showUnavailableAlert={false}
        onRouteStateChange={controls.onRouteStateChange}
      />
      {children}
      <SettingsModals modals={modalState.modals} messages={modalState.messages} onClose={modalState.hideModal} />
      <TranscriptRecovery
        isOpen={startup.open}
        onClose={startup.onClose}
        recoverableMeetings={startup.recovery.recoverableMeetings}
        onRecover={startup.onRecover}
        onDelete={startup.recovery.deleteRecoverableMeeting}
        onLoadPreview={startup.recovery.loadMeetingTranscripts}
      />
      <div className="pointer-events-none fixed bottom-4 left-[var(--sidebar-w)] right-0 z-40 flex flex-col items-center gap-2 px-4 [&>*]:pointer-events-auto">
        {controls.routeFailure && (
          <ProviderRouteFailureAlert
            capability="transcription"
            failure={controls.routeFailure}
            isRetrying={controls.isRetryingRoute}
            onRetry={controls.retry}
            onChangeProvider={() => focusTranscriptionProvider(modalState.showModal)}
            onCancel={controls.dismissFailure}
            captureOutcome={controls.captureOutcome}
            className="w-full max-w-[560px] shadow-float"
          />
        )}
        {controls.deviceError && <DeviceErrorAlert error={controls.deviceError} onDismiss={controls.dismissDeviceError} />}
        <StatusOverlays
          isProcessing={status === RecordingStatus.PROCESSING_TRANSCRIPTS && !recordingState.isRecording}
          isSaving={status === RecordingStatus.SAVING}
        />
      </div>
    </RecordingControlsContext.Provider>
  );
}
