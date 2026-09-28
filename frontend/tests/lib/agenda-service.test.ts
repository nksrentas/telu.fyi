import { afterAll, describe, expect, mock, test } from 'bun:test';

const originalTimeZone = process.env.TZ;
const originalCore = { ...await import('@tauri-apps/api/core') };
const ipcInvoke = mock(async (_command: string, _args?: unknown, _options?: unknown): Promise<unknown> => []);
mock.module('@tauri-apps/api/core', () => ({ ...originalCore, invoke: ipcInvoke }));
const { listAgendaDay, localDayBounds } = await import('../../src/lib/agenda-service');

process.env.TZ = 'Europe/Istanbul';

afterAll(() => {
  process.env.TZ = originalTimeZone;
  mock.module('@tauri-apps/api/core', () => originalCore);
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
