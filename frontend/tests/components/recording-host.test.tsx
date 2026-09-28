import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import type { ReactElement } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import type { EffectiveRoute } from '../../src/services/providerRouteService';

type Responder = (args: Record<string, unknown>) => unknown;
type EventHandler = (event: { event: string; id: number; payload: unknown }) => void;
type TestGlobals = typeof globalThis & {
  window?: Record<string, unknown>;
  sessionStorage?: Record<string, unknown>;
};

const globals = globalThis as TestGlobals;
const original = { window: globals.window, sessionStorage: globals.sessionStorage };
const windowEvents = new EventTarget();
const calls: string[] = [];
const active = new Map<string, number>();
const handlers = new Map<string, EventHandler[]>();
let responses: Record<string, Responder> = {};

const recording = {
  isRecording: false,
  isPaused: false,
  isStopping: false,
  isProcessing: false,
  isSaving: false,
  isStartingRecording: false,
  status: 'idle',
  activeDuration: null as number | null,
  recordingDuration: null as number | null,
  setStatus: mock(() => {}),
};
const transcripts = {
  transcripts: [] as Array<{ id: string; text: string; audio_start_time?: number }>,
  currentMeetingId: null as string | null,
  meetingTitle: 'Weekly sync',
  transcriptsRef: { current: [] },
  setMeetingTitle: () => {},
  clearTranscripts: () => {},
  markMeetingAsSaved: async () => {},
};

const ipc = mock(async (command: string, args: Record<string, unknown> = {}): Promise<unknown> => {
  calls.push(command);
  const respond = responses[command];
  return respond ? respond(args) : null;
});

const listen = mock(async (event: string, handler: EventHandler) => {
  active.set(event, (active.get(event) ?? 0) + 1);
  handlers.set(event, [...(handlers.get(event) ?? []), handler]);
  return () => {
    active.set(event, (active.get(event) ?? 1) - 1);
    handlers.set(event, (handlers.get(event) ?? []).filter((entry) => entry !== handler));
  };
});

const originals = {
  core: { ...await import('@tauri-apps/api/core') },
  event: { ...await import('@tauri-apps/api/event') },
  navigation: { ...await import('next/navigation') },
  recordingState: { ...await import('../../src/contexts/RecordingStateContext') },
  transcripts: { ...await import('../../src/contexts/TranscriptContext') },
  config: { ...await import('../../src/contexts/ConfigContext') },
  sidebar: { ...await import('../../src/components/Sidebar/SidebarProvider') },
  settings: { ...await import('../../src/app/_components/SettingsModal') },
  recovery: { ...await import('../../src/components/TranscriptRecovery') },
  recoveryHook: { ...await import('../../src/hooks/useTranscriptRecovery') },
  notification: { ...await import('../../src/lib/recordingNotification') },
  indexedDB: { ...await import('../../src/services/indexedDBService') },
};
mock.module('@tauri-apps/api/core', () => ({ ...originals.core, invoke: ipc }));
mock.module('@tauri-apps/api/event', () => ({ ...originals.event, listen }));
mock.module('next/navigation', () => ({ ...originals.navigation, useRouter: () => ({ push: () => {} }), usePathname: () => '/' }));
mock.module('../../src/contexts/RecordingStateContext', () => ({ ...originals.recordingState, useRecordingState: () => recording }));
mock.module('../../src/contexts/TranscriptContext', () => ({ ...originals.transcripts, useTranscripts: () => transcripts }));
mock.module('../../src/contexts/ConfigContext', () => ({
  ...originals.config,
  useConfig: () => ({ transcriptModelConfig: { provider: 'parakeet', model: 'parakeet-tdt' }, selectedDevices: { micDevice: null, systemDevice: null }, betaFeatures: {} }),
}));
mock.module('../../src/components/Sidebar/SidebarProvider', () => ({
  ...originals.sidebar,
  useSidebar: () => ({ setIsMeetingActive: () => {}, refetchMeetings: async () => {}, setCurrentMeeting: () => {} }),
}));
mock.module('../../src/app/_components/SettingsModal', () => ({ ...originals.settings, SettingsModals: () => null }));
mock.module('../../src/components/TranscriptRecovery', () => ({ ...originals.recovery, TranscriptRecovery: () => null }));
mock.module('../../src/hooks/useTranscriptRecovery', () => ({
  ...originals.recoveryHook,
  useTranscriptRecovery: () => ({
    recoverableMeetings: [],
    checkForRecoverableTranscripts: async () => {},
    recoverMeeting: async () => null,
    loadMeetingTranscripts: async () => [],
    deleteRecoverableMeeting: async () => {},
  }),
}));
mock.module('../../src/lib/recordingNotification', () => ({ ...originals.notification, showRecordingNotification: async () => {} }));
mock.module('../../src/services/indexedDBService', () => ({
  ...originals.indexedDB,
  indexedDBService: { deleteOldMeetings: async () => {}, deleteSavedMeetings: async () => {} },
}));

const { RecordingHost, RecordingControlsContext } = await import('../../src/components/app-shell/recording-host');
const { RecordSlot } = await import('../../src/components/app-shell/recording-capsule');
const { LiveTranscript } = await import('../../src/components/living-doc/live-transcript');
const { useRecordingControls } = await import('../../src/hooks/use-recording-controls');
const { TodayView } = await import('../../src/components/agenda/today-view');

beforeAll(() => {
  globals.sessionStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  globals.window = {
    addEventListener: windowEvents.addEventListener.bind(windowEvents),
    removeEventListener: windowEvents.removeEventListener.bind(windowEvents),
    dispatchEvent: windowEvents.dispatchEvent.bind(windowEvents),
    matchMedia: () => ({ matches: true, addEventListener: () => {}, removeEventListener: () => {} }),
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
  };
});

afterAll(async () => {
  unmount();
  await new Promise((resolve) => setTimeout(resolve, 0));
  globals.window = original.window;
  globals.sessionStorage = original.sessionStorage;
  mock.module('@tauri-apps/api/core', () => originals.core);
  mock.module('@tauri-apps/api/event', () => originals.event);
  mock.module('next/navigation', () => originals.navigation);
  mock.module('../../src/contexts/RecordingStateContext', () => originals.recordingState);
  mock.module('../../src/contexts/TranscriptContext', () => originals.transcripts);
  mock.module('../../src/contexts/ConfigContext', () => originals.config);
  mock.module('../../src/components/Sidebar/SidebarProvider', () => originals.sidebar);
  mock.module('../../src/app/_components/SettingsModal', () => originals.settings);
  mock.module('../../src/components/TranscriptRecovery', () => originals.recovery);
  mock.module('../../src/hooks/useTranscriptRecovery', () => originals.recoveryHook);
  mock.module('../../src/lib/recordingNotification', () => originals.notification);
  mock.module('../../src/services/indexedDBService', () => originals.indexedDB);
});

const validatedRoute: EffectiveRoute = {
  capability: 'transcription',
  providerId: 'parakeet',
  modelId: 'parakeet-tdt',
  locationClass: 'local',
  sanitizedOrigin: 'This device',
  encrypted: false,
  validationState: 'validated',
  resolvedAddresses: [],
};

let renderer: ReactTestRenderer | undefined;
const unmount = () => {
  act(() => renderer?.unmount());
  renderer = undefined;
};
const root = () => renderer!.root;
const textOf = (node: ReactTestInstance): string =>
  node.children.map((child) => (typeof child === 'string' ? child : textOf(child))).join('');
const settle = (ms = 0) => act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)); });

async function render(element: ReactElement, createNodeMock?: (element: ReactElement) => unknown) {
  unmount();
  await act(async () => { renderer = create(element, createNodeMock ? { createNodeMock } : undefined); });
  await settle();
}

async function emit(event: string, payload: unknown) {
  await act(async () => {
    (handlers.get(event) ?? []).forEach((handler) => handler({ event, id: 1, payload }));
  });
  await settle();
}

const RECORDING_EVENTS = ['recording-stopped', 'recording-finalization-progress', 'transcript-error', 'transcription-error'];
const recordingListeners = () => Object.fromEntries(RECORDING_EVENTS.map((name) => [name, active.get(name) ?? 0]));

let controls: ReturnType<typeof useRecordingControls>;
const onRecordingStart = mock(async () => { calls.push('onRecordingStart'); });
function ControlsHarness() {
  controls = useRecordingControls({
    onRecordingStart,
    onRecordingStop: () => {},
    onStopInitiated: () => {},
    onTranscriptionError: () => {},
    isRecordingDisabled: false,
  });
  return null;
}

beforeEach(() => {
  calls.length = 0;
  ipc.mockClear();
  onRecordingStart.mockClear();
  responses = {
    get_current_provider_route: () => validatedRoute,
    validate_provider_route: () => validatedRoute,
    agenda_list_day: () => [],
  };
  Object.assign(recording, { isRecording: false, isStopping: false, isProcessing: false, isSaving: false, isStartingRecording: false, status: 'idle' });
});

describe('RecordingHost', () => {
  test('subscribes each recording event once per consumer and Today adds none', async () => {
    await render(<RecordingHost><span>child</span></RecordingHost>);
    const hostOnly = recordingListeners();
    expect(hostOnly['transcript-error']).toBe(1);
    expect(hostOnly['transcription-error']).toBe(2);
    expect(hostOnly['recording-stopped']).toBe(3);
    expect(hostOnly['recording-finalization-progress']).toBe(3);
    await act(async () => renderer!.update(<RecordingHost><span>child</span></RecordingHost>));
    await settle();
    expect(recordingListeners()).toEqual(hostOnly);

    await render(<RecordingHost><TodayView /></RecordingHost>);
    expect(recordingListeners()).toEqual(hostOnly);
  });

  test('start revalidates the transcription route before starting; an unvalidated route never starts', async () => {
    await render(<ControlsHarness />);
    await act(async () => controls.onRouteStateChange({ status: 'validated', route: validatedRoute, failure: null }));
    expect(controls.canRecord).toBe(true);
    await act(async () => controls.start());
    expect(calls.indexOf('validate_provider_route')).toBeGreaterThanOrEqual(0);
    expect(calls.indexOf('validate_provider_route')).toBeLessThan(calls.indexOf('onRecordingStart'));

    calls.length = 0;
    await render(<ControlsHarness />);
    const failure = { code: 'PROVIDER_ROUTE_UNAVAILABLE', capability: 'transcription', providerId: 'parakeet', modelId: 'parakeet-tdt', sanitizedOrigin: null, message: 'x' };
    await act(async () => controls.onRouteStateChange({ status: 'unavailable', route: null, failure } as never));
    expect(controls.canRecord).toBe(false);
    await act(async () => controls.start());
    expect(calls).not.toContain('onRecordingStart');
    expect(calls).not.toContain('validate_provider_route');
  });

  test('a route failure while recording continues locally, then stops; retry keeps the provider', async () => {
    recording.isRecording = true;
    await render(<ControlsHarness />);
    await act(async () => controls.onRouteStateChange({ status: 'validated', route: validatedRoute, failure: null }));
    await emit('transcription-error', {
      error: JSON.stringify({ code: 'PROVIDER_ROUTE_UNAVAILABLE', providerId: 'parakeet' }),
      userMessage: 'Transcription provider unavailable',
      actionable: true,
      phase: 'active',
    });
    expect(controls.routeFailure?.code).toBe('PROVIDER_ROUTE_UNAVAILABLE');
    expect(controls.captureOutcome).toBe('continues_locally');

    recording.isRecording = false;
    await act(async () => renderer!.update(<ControlsHarness />));
    await settle();
    expect(controls.captureOutcome).toBe('stopped');

    await act(async () => controls.retry());
    await settle();
    expect(calls).toContain('validate_provider_route');
    expect(calls.some((command) => /save_transcript_config|set_transcription_provider|api_save_model_config/.test(command))).toBe(false);
  });

  test('the tray start event starts exactly one recording', async () => {
    responses.api_get_transcript_config = () => ({ provider: 'parakeet' });
    responses.parakeet_has_available_models = () => true;
    responses.start_recording_with_devices_and_meeting = () => ({ meeting_id: 'meeting-a' });
    await render(<RecordingHost><span>child</span></RecordingHost>);
    await act(async () => { windowEvents.dispatchEvent(new Event('start-recording-from-sidebar')); });
    await settle(10);
    expect(calls.filter((command) => command === 'start_recording_with_devices_and_meeting')).toHaveLength(1);
  });
});

describe('RecordSlot', () => {
  const slotValue = (overrides: Record<string, unknown> = {}) => ({
    isRecording: false,
    isStarting: false,
    isStopping: false,
    canRecord: true,
    isRetryingRoute: false,
    routeRefreshKey: 0,
    title: 'Weekly sync',
    elapsedSeconds: 125,
    finalization: null,
    start: mock(async () => {}),
    stop: mock(async () => {}),
    ...overrides,
  }) as never;

  const renderSlot = (value: never) =>
    render(
      <RecordingControlsContext.Provider value={value}>
        <RecordSlot />
      </RecordingControlsContext.Provider>,
    );

  test('shows the transcription route before Record; starting shows a spinner and disables it', async () => {
    await renderSlot(slotValue());
    const text = textOf(root());
    expect(text.indexOf('Local')).toBeGreaterThanOrEqual(0);
    expect(text.indexOf('Local')).toBeLessThan(text.indexOf('Record'));
    const record = root().find((node) => node.type === 'button' && node.props['aria-keyshortcuts'] === 'Meta+R');
    expect(record.props.disabled).toBe(false);

    await renderSlot(slotValue({ isStarting: true }));
    const starting = root().find((node) => node.type === 'button' && node.props['aria-keyshortcuts'] === 'Meta+R');
    expect(starting.props.disabled).toBe(true);
    expect(root().findAll((node) => node.props['data-slot'] === 'spinner')).toHaveLength(1);
  });

  test('recording swaps Record for the capsule; stopping renders nothing', async () => {
    await renderSlot(slotValue({ isRecording: true }));
    const capsule = root().find((node) => node.props.role === 'status' && typeof node.type === 'string');
    expect(capsule.props['aria-label']).toBe('Recording Weekly sync, 2 minutes');
    expect(root().findAll((node) => node.props['aria-hidden'] === true && textOf(node) === '2:05')).toHaveLength(1);
    expect(root().findAll((node) => node.type === 'button' && node.props['aria-keyshortcuts'] === 'Meta+R')).toHaveLength(0);

    await renderSlot(slotValue({ isRecording: true, isStopping: true }));
    expect(renderer!.toJSON()).toBeNull();
  });
});

describe('LiveTranscript', () => {
  test('shows the live lines, offers Jump to latest after scrolling up and re-pins on click', async () => {
    recording.isRecording = true;
    transcripts.currentMeetingId = 'meeting-a';
    transcripts.transcripts = [
      { id: 'line-1', text: 'Good morning everyone', audio_start_time: 4 },
      { id: 'line-2', text: 'Let us start with the beta', audio_start_time: 9 },
    ];
    const scrollListeners: Array<() => void> = [];
    const scroller = {
      scrollTop: 700,
      scrollHeight: 1000,
      clientHeight: 300,
      addEventListener: (_type: string, handler: () => void) => scrollListeners.push(handler),
      removeEventListener: () => {},
    };
    await render(<LiveTranscript meetingId="meeting-a" />, (element) =>
      (element as ReactElement<{ 'aria-live'?: string }>).props['aria-live'] === 'polite' ? scroller : null,
    );
    expect(textOf(root())).toContain('LIVE TRANSCRIPT');
    expect(textOf(root())).toContain('Let us start with the beta');
    expect(root().findAll((node) => node.type === 'button' && textOf(node) === 'Jump to latest')).toHaveLength(0);

    scroller.scrollTop = 0;
    await act(async () => scrollListeners.forEach((handler) => handler()));
    await settle(150);
    const jump = root().find((node) => node.type === 'button' && textOf(node) === 'Jump to latest');
    await act(async () => jump.props.onClick());
    expect(scroller.scrollTop).toBe(1000);
    expect(root().findAll((node) => node.type === 'button' && textOf(node) === 'Jump to latest')).toHaveLength(0);
    transcripts.currentMeetingId = null;
    transcripts.transcripts = [];
  });
});
