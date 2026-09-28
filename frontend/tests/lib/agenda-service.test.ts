import { afterAll, describe, expect, mock, test } from 'bun:test';
import { listAgendaDay, localDayBounds } from '../../src/lib/agenda-service';

type TauriWindow = { __TAURI_INTERNALS__: { invoke: typeof ipcInvoke } };

const originalTimeZone = process.env.TZ;
const globalWithWindow = globalThis as typeof globalThis & { window?: TauriWindow };
const originalWindow = globalWithWindow.window;
const ipcInvoke = mock(async (_command: string, _args?: unknown, _options?: unknown): Promise<unknown> => []);

process.env.TZ = 'Europe/Istanbul';
globalWithWindow.window = { __TAURI_INTERNALS__: { invoke: ipcInvoke } };

afterAll(() => {
  process.env.TZ = originalTimeZone;
  globalWithWindow.window = originalWindow;
});

describe('agenda-service', () => {
  test('localDayBounds returns the local midnight-to-midnight range in UTC', () => {
    const bounds = localDayBounds(new Date(2026, 8, 28, 15, 30));

    expect(bounds).toEqual({
      fromUtc: '2026-09-27T21:00:00.000Z',
      toUtc: '2026-09-28T21:00:00.000Z',
    });
  });

  test('listAgendaDay invokes agenda_list_day with the UTC bounds', async () => {
    await listAgendaDay('2026-09-27T21:00:00.000Z', '2026-09-28T21:00:00.000Z');

    expect(ipcInvoke.mock.calls[0]?.slice(0, 2)).toEqual([
      'agenda_list_day',
      { fromUtc: '2026-09-27T21:00:00.000Z', toUtc: '2026-09-28T21:00:00.000Z' },
    ]);
  });
});
