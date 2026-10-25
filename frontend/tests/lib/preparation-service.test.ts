import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import type { EffectiveRoute } from '../../src/services/providerRouteService';
import type { PreparationUpdatedEvent } from '../../src/lib/preparation-service';

type Listener = (event: { payload: PreparationUpdatedEvent }) => void;

const ipcInvoke = mock(async (_command: string, _args?: unknown): Promise<unknown> => null);
const unlisten = mock(() => {});
const listeners: Array<{ name: string; listener: Listener }> = [];
const ipcListen = mock(async (name: string, listener: Listener) => {
  listeners.push({ name, listener });
  return unlisten;
});
const originalCore = { ...await import('@tauri-apps/api/core') };
const originalEvent = { ...await import('@tauri-apps/api/event') };
mock.module('@tauri-apps/api/core', () => ({ ...originalCore, invoke: ipcInvoke }));
mock.module('@tauri-apps/api/event', () => ({ ...originalEvent, listen: ipcListen }));
const service = await import('../../src/lib/preparation-service');

const route: EffectiveRoute = {
  capability: 'summary',
  providerId: 'ollama',
  modelId: 'llama3',
  locationClass: 'local',
  sanitizedOrigin: 'This device',
  encrypted: true,
  validationState: 'validated',
  resolvedAddresses: [],
};

beforeAll(() => {
  mock.module('@tauri-apps/api/core', () => ({ ...originalCore, invoke: ipcInvoke }));
  mock.module('@tauri-apps/api/event', () => ({ ...originalEvent, listen: ipcListen }));
});

afterAll(() => {
  mock.module('@tauri-apps/api/core', () => originalCore);
  mock.module('@tauri-apps/api/event', () => originalEvent);
});

beforeEach(() => {
  ipcInvoke.mockReset();
  ipcInvoke.mockImplementation(async () => null);
  ipcListen.mockClear();
  unlisten.mockClear();
  listeners.length = 0;
});

function lastCall() {
  const [command, args] = ipcInvoke.mock.calls.at(-1) ?? [];
  return [command, args ?? {}];
}

describe('preparation-service', () => {
  test('each wrapper invokes its command with camelCase arguments', async () => {
    await service.generateBriefing('p-1', route);
    expect(lastCall()).toEqual(['prep_generate', { plannedMeetingId: 'p-1', expectedRoute: route }]);

    await service.cancelBriefing('p-1');
    expect(lastCall()).toEqual(['prep_cancel', { plannedMeetingId: 'p-1' }]);

    await service.getBriefing('p-1');
    expect(lastCall()).toEqual(['prep_get_briefing', { plannedMeetingId: 'p-1' }]);

    await service.listSelectedSources('p-1');
    expect(lastCall()).toEqual(['prep_list_sources', { plannedMeetingId: 'p-1' }]);

    const sources = [{ kind: 'document' as const, versionId: 'v-1' }];
    await service.selectSources('p-1', sources);
    expect(lastCall()).toEqual(['prep_select_sources', { plannedMeetingId: 'p-1', sources }]);
  });

  test('a refused generate rejects with the command error code', async () => {
    ipcInvoke.mockImplementation(async () => {
      throw 'PREP_ALREADY_RUNNING';
    });

    await expect(service.generateBriefing('p-1', route)).rejects.toBe('PREP_ALREADY_RUNNING');
  });

  test('updates reach the handler only for its planned meeting, and cleanup unsubscribes', async () => {
    const received: PreparationUpdatedEvent[] = [];

    const cleanup = await service.onPreparationUpdated('p-1', (event) => received.push(event));
    const [{ name, listener }] = listeners;
    listener({ payload: { plannedMeetingId: 'p-2', runId: 'r-9', status: 'running' } });
    listener({ payload: { plannedMeetingId: 'p-1', runId: 'r-1', status: 'stale' } });
    cleanup();

    expect(name).toBe('preparation-updated');
    expect(received).toEqual([{ plannedMeetingId: 'p-1', runId: 'r-1', status: 'stale' }]);
    expect(unlisten).toHaveBeenCalledTimes(1);
  });
});
