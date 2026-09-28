import { useCallback, useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { appDataDir } from '@tauri-apps/api/path';
import { listen } from '@tauri-apps/api/event';
import Analytics from '@/lib/analytics';
import { useRecordingState } from '@/contexts/RecordingStateContext';
import {
  transcriptService,
  type FinalizationSnapshot,
  type TranscriptionErrorPayload,
} from '@/services/transcriptService';
import type { ProviderRouteViewState } from '@/components/ProviderBoundary';
import {
  isProviderRouteFailureError,
  isRouteAvailable,
  normalizeProviderRouteFailure,
  validateProviderRoute,
  type ProviderRouteFailure,
} from '@/services/providerRouteService';

export type CaptureOutcome = 'continues_locally' | 'stopped';

export interface DeviceError {
  title: string;
  message: string;
}

interface RecordingControlsOptions {
  onRecordingStart: () => Promise<void>;
  onRecordingStop: (callApi?: boolean) => void;
  onStopInitiated: () => void;
  onTranscriptionError: (message: string) => void;
  isRecordingDisabled: boolean;
}

const INITIAL_ROUTE_STATE: ProviderRouteViewState = { status: 'loading', route: null, failure: null };

export function deviceErrorFor(error: unknown): DeviceError {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('microphone') || message.includes('mic') || message.includes('input')) {
    return { title: 'Microphone not available', message: 'Check that your microphone is connected, Telu has microphone permission, and no other app is using it.' };
  }
  if (message.includes('system audio') || message.includes('speaker') || message.includes('output')) {
    return { title: 'System audio not available', message: 'Check that a virtual audio device is installed and Telu has screen recording permission.' };
  }
  if (message.includes('permission')) {
    return { title: 'Permission required', message: 'Grant microphone and screen recording access in System Settings, then restart Telu.' };
  }
  return { title: 'Recording failed', message: 'Telu couldn’t start recording. Check your audio devices and try again.' };
}

function isNoRecordingError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('No recording in progress');
}

function useRouteState() {
  const recordingState = useRecordingState();
  const [transcriptionRouteState, setTranscriptionRouteState] = useState<ProviderRouteViewState>(INITIAL_ROUTE_STATE);
  const [routeFailure, setRouteFailure] = useState<ProviderRouteFailure | null>(null);
  const [captureOutcome, setCaptureOutcome] = useState<CaptureOutcome | null>(null);
  const [isRetryingRoute, setIsRetryingRoute] = useState(false);
  const [routeRefreshKey, setRouteRefreshKey] = useState(0);

  const onRouteStateChange = useCallback((state: ProviderRouteViewState) => {
    setTranscriptionRouteState(state);
    if (state.status === 'loading') return;
    setRouteFailure(state.status === 'validated' ? null : state.failure);
    setCaptureOutcome(null);
    setIsRetryingRoute(false);
  }, []);

  const failRoute = useCallback((error: unknown, route: ProviderRouteViewState['route']) => {
    setRouteFailure(normalizeProviderRouteFailure(error, 'transcription', route));
    setCaptureOutcome(recordingState.isRecording ? 'continues_locally' : 'stopped');
  }, [recordingState.isRecording]);

  useEffect(() => {
    if (captureOutcome === 'continues_locally' && !recordingState.isRecording) setCaptureOutcome('stopped');
  }, [recordingState.isRecording, captureOutcome]);

  return {
    transcriptionRouteState,
    setTranscriptionRouteState,
    routeFailure,
    setRouteFailure,
    captureOutcome,
    setCaptureOutcome,
    isRetryingRoute,
    setIsRetryingRoute,
    routeRefreshKey,
    setRouteRefreshKey,
    onRouteStateChange,
    failRoute,
  };
}

function useTerminalFinalization() {
  const [awaitingTerminalFinalization, setAwaitingTerminalFinalization] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    void transcriptService
      .onRecordingStopped(({ finalization }) => {
        if (finalization.lifecycle === 'complete' || finalization.lifecycle === 'incomplete') setAwaitingTerminalFinalization(false);
      })
      .then((stop) => {
        if (cancelled) stop();
        else unlisten = stop;
      })
      .catch((error: unknown) => console.error('Failed to subscribe to terminal finalization state:', error));
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);
  return { awaitingTerminalFinalization, setAwaitingTerminalFinalization };
}

function useTranscriptionErrors(
  route: ReturnType<typeof useRouteState>,
  onRecordingStop: (callApi?: boolean) => void,
  onTranscriptionError: (message: string) => void,
) {
  const recordingState = useRecordingState();
  const { transcriptionRouteState, failRoute } = route;
  useEffect(() => {
    let cancelled = false;
    const stops: Array<() => void> = [];
    const keep = (stop: () => void) => (cancelled ? stop() : stops.push(stop));
    void listen<string>('transcript-error', (event) => {
      Analytics.trackTranscriptionError(event.payload);
      onRecordingStop(false);
      onTranscriptionError(event.payload);
    }).then(keep);
    void listen<TranscriptionErrorPayload>('transcription-error', (event) => {
      Analytics.trackTranscriptionError(event.payload.userMessage || event.payload.error);
      if (isProviderRouteFailureError(event.payload.error)) {
        failRoute(event.payload.error, transcriptionRouteState.route);
        if (!recordingState.isRecording && event.payload.phase === 'active') onRecordingStop(false);
        return;
      }
      if (event.payload.phase === 'active') onRecordingStop(false);
    }).then(keep);
    return () => {
      cancelled = true;
      stops.forEach((stop) => stop());
    };
  }, [failRoute, onRecordingStop, onTranscriptionError, recordingState.isRecording, transcriptionRouteState.route]);
}

type RouteControls = ReturnType<typeof useRouteState>;
type TerminalState = ReturnType<typeof useTerminalFinalization>;

function useStartAction(options: RecordingControlsOptions, route: RouteControls, terminal: TerminalState) {
  const recordingState = useRecordingState();
  const [deviceError, setDeviceError] = useState<DeviceError | null>(null);
  const { transcriptionRouteState, setTranscriptionRouteState, setRouteFailure, setCaptureOutcome, setIsRetryingRoute, failRoute } = route;
  const { onRecordingStart } = options;

  const start = useCallback(async () => {
    if (recordingState.isStartingRecording || terminal.awaitingTerminalFinalization || recordingState.isRecording) return;
    if (transcriptionRouteState.status !== 'validated') {
      if (transcriptionRouteState.failure) setRouteFailure(transcriptionRouteState.failure);
      return;
    }
    setIsRetryingRoute(true);
    try {
      const currentRoute = await validateProviderRoute(transcriptionRouteState.route);
      if (!isRouteAvailable(currentRoute)) throw currentRoute;
      setTranscriptionRouteState({ status: 'validated', route: currentRoute, failure: null });
      setRouteFailure(null);
      setCaptureOutcome(null);
    } catch (error) {
      setRouteFailure(normalizeProviderRouteFailure(error, 'transcription', transcriptionRouteState.route));
      setCaptureOutcome(recordingState.isRecording ? 'continues_locally' : null);
      return;
    } finally {
      setIsRetryingRoute(false);
    }
    try {
      setDeviceError(null);
      await onRecordingStart();
    } catch (error) {
      if (isProviderRouteFailureError(error)) return failRoute(error, transcriptionRouteState.route);
      console.error('Failed to start recording:', error);
      setDeviceError(deviceErrorFor(error));
    }
  }, [failRoute, onRecordingStart, recordingState.isRecording, recordingState.isStartingRecording, setCaptureOutcome, setIsRetryingRoute, setRouteFailure, setTranscriptionRouteState, terminal.awaitingTerminalFinalization, transcriptionRouteState]);

  return { start, deviceError, dismissDeviceError: () => setDeviceError(null) };
}

function useStopAction(options: RecordingControlsOptions, terminal: TerminalState) {
  const recordingState = useRecordingState();
  const [isStopping, setIsStopping] = useState(false);
  const { onRecordingStop, onStopInitiated } = options;
  const { setAwaitingTerminalFinalization } = terminal;

  const stop = useCallback(async () => {
    if (!recordingState.isRecording || recordingState.isStartingRecording || isStopping) return;
    onStopInitiated();
    setAwaitingTerminalFinalization(true);
    setIsStopping(true);
    try {
      const savePath = `${await appDataDir()}/recording-${new Date().toISOString().replace(/[:.]/g, '-')}.wav`;
      const result = await invoke<FinalizationSnapshot>('stop_recording', { args: { save_path: savePath } });
      if (result.lifecycle === 'complete' || result.lifecycle === 'incomplete') setAwaitingTerminalFinalization(false);
      Analytics.trackTranscriptionSuccess();
      onRecordingStop(true);
    } catch (error) {
      if (isNoRecordingError(error)) return;
      console.error('Failed to stop recording:', error);
      onRecordingStop(false);
    } finally {
      setIsStopping(false);
    }
  }, [isStopping, onRecordingStop, onStopInitiated, recordingState.isRecording, recordingState.isStartingRecording, setAwaitingTerminalFinalization]);

  return { stop, isStopping };
}

function useRetry(route: RouteControls, start: () => Promise<void>) {
  const retryAfterRefreshRef = useRef(false);
  const { transcriptionRouteState, setIsRetryingRoute, setRouteRefreshKey, setRouteFailure, setCaptureOutcome } = route;

  const retry = useCallback(() => {
    if (transcriptionRouteState.status === 'validated') {
      void start();
      return;
    }
    retryAfterRefreshRef.current = true;
    setIsRetryingRoute(true);
    setRouteRefreshKey((current) => current + 1);
  }, [setIsRetryingRoute, setRouteRefreshKey, start, transcriptionRouteState.status]);

  useEffect(() => {
    if (!retryAfterRefreshRef.current || transcriptionRouteState.status !== 'validated') return;
    retryAfterRefreshRef.current = false;
    void start();
  }, [start, transcriptionRouteState.status]);

  const dismissFailure = useCallback(() => {
    retryAfterRefreshRef.current = false;
    setRouteFailure(null);
    setCaptureOutcome(null);
  }, [setCaptureOutcome, setRouteFailure]);

  return { retry, dismissFailure };
}

export function useRecordingControls(options: RecordingControlsOptions) {
  const recordingState = useRecordingState();
  const route = useRouteState();
  const terminal = useTerminalFinalization();
  useTranscriptionErrors(route, options.onRecordingStop, options.onTranscriptionError);
  const { start, deviceError, dismissDeviceError } = useStartAction(options, route, terminal);
  const { stop, isStopping } = useStopAction(options, terminal);
  const { retry, dismissFailure } = useRetry(route, start);
  const isStarting = recordingState.isStartingRecording;
  const busy = isStarting || isStopping || route.isRetryingRoute || terminal.awaitingTerminalFinalization;

  return {
    isRecording: recordingState.isRecording,
    isStarting,
    isStopping: isStopping || recordingState.isStopping || recordingState.isProcessing || recordingState.isSaving,
    canRecord: route.transcriptionRouteState.status === 'validated' && !options.isRecordingDisabled && !busy,
    transcriptionRouteState: route.transcriptionRouteState,
    routeFailure: route.routeFailure,
    captureOutcome: route.captureOutcome,
    isRetryingRoute: route.isRetryingRoute,
    routeRefreshKey: route.routeRefreshKey,
    deviceError,
    onRouteStateChange: route.onRouteStateChange,
    start,
    stop,
    retry,
    dismissFailure,
    dismissDeviceError,
  };
}

export type RecordingControls = ReturnType<typeof useRecordingControls>;
