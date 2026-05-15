import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Hono } from 'hono';
import {
  makeLogWeightHandler,
  makeListWeightEntriesHandler,
  makeRemoveWeightHandler,
  makeGetWeightTrendHandler,
} from './weight-log.handler.ts';
import type { WeightLogRepository } from '../../domain/weight-log/weight-log.repository.ts';
import type { TrendSnapshot, WeightEntry } from '../../domain/weight-log/types.ts';

function makeRepo(stored: WeightEntry[] = []): WeightLogRepository {
  let entries = [...stored];
  return {
    list: vi.fn<() => Promise<WeightEntry[]>>().mockImplementation(async () => [...entries]),
    upsert: vi.fn<(e: WeightEntry) => Promise<void>>().mockImplementation(async (e) => {
      const idx = entries.findIndex((x) => x.date === e.date);
      if (idx >= 0) entries[idx] = e;
      else entries.push(e);
    }),
    remove: vi.fn<(date: string) => Promise<void>>().mockImplementation(async (date) => {
      entries = entries.filter((x) => x.date !== date);
    }),
  };
}

function makeApp(repo: WeightLogRepository) {
  const app = new Hono();
  app.post('/weight-log', makeLogWeightHandler(repo));
  app.get('/weight-log', makeListWeightEntriesHandler(repo));
  app.delete('/weight-log/:date', makeRemoveWeightHandler(repo));
  app.get('/weight-log/trend', makeGetWeightTrendHandler(repo));
  return app;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-05-15T10:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('POST /weight-log', () => {
  it('logs a valid entry and returns the entry + trend', async () => {
    const repo = makeRepo();
    const res = await makeApp(repo).request('/weight-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: '2026-05-14', weightKg: 78.4 }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { entry: WeightEntry; trend: TrendSnapshot };
    expect(body.entry).toEqual({ date: '2026-05-14', weightKg: 78.4 });
    expect(body.trend.totalEntries).toBe(1);
    expect(repo.upsert).toHaveBeenCalledWith({ date: '2026-05-14', weightKg: 78.4 });
  });

  it.each([
    [{ date: '2026-13-40', weightKg: 78.4 }, 'malformed date'],
    [{ date: '2026-05-16', weightKg: 78.4 }, 'future date'],
    [{ date: '2026-05-14', weightKg: 0 }, 'non-positive weight'],
    [{ date: '2026-05-14', weightKg: 501 }, 'weight > 500'],
  ])('returns 400 for %o (%s)', async (payload) => {
    const repo = makeRepo();
    const res = await makeApp(repo).request('/weight-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    expect(res.status).toBe(400);
    expect(repo.upsert).not.toHaveBeenCalled();
  });
});

describe('GET /weight-log', () => {
  const seed: WeightEntry[] = [
    { date: '2026-05-09', weightKg: 80 },
    { date: '2026-05-10', weightKg: 79.8 },
    { date: '2026-05-11', weightKg: 79.6 },
    { date: '2026-05-12', weightKg: 79.4 },
  ];

  it('returns all entries ascending by date', async () => {
    const res = await makeApp(makeRepo([...seed].reverse())).request('/weight-log');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { entries: WeightEntry[] };
    expect(body.entries.map((e) => e.date)).toEqual(['2026-05-09', '2026-05-10', '2026-05-11', '2026-05-12']);
  });

  it('honours from/to range', async () => {
    const res = await makeApp(makeRepo(seed)).request('/weight-log?from=2026-05-10&to=2026-05-11');
    const body = (await res.json()) as { entries: WeightEntry[] };
    expect(body.entries.map((e) => e.date)).toEqual(['2026-05-10', '2026-05-11']);
  });

  it('returns an empty list when from > to', async () => {
    const res = await makeApp(makeRepo(seed)).request('/weight-log?from=2026-05-12&to=2026-05-09');
    const body = (await res.json()) as { entries: WeightEntry[] };
    expect(body.entries).toEqual([]);
  });
});

describe('DELETE /weight-log/:date', () => {
  it('removes the entry (204)', async () => {
    const repo = makeRepo([{ date: '2026-05-14', weightKg: 78.4 }]);
    const res = await makeApp(repo).request('/weight-log/2026-05-14', { method: 'DELETE' });
    expect(res.status).toBe(204);
    expect(repo.remove).toHaveBeenCalledWith('2026-05-14');
  });

  it('is idempotent (204 even when absent)', async () => {
    const repo = makeRepo();
    const res = await makeApp(repo).request('/weight-log/2026-05-14', { method: 'DELETE' });
    expect(res.status).toBe(204);
  });

  it('rejects malformed dates with 400', async () => {
    const repo = makeRepo();
    const res = await makeApp(repo).request('/weight-log/not-a-date', { method: 'DELETE' });
    expect(res.status).toBe(400);
    expect(repo.remove).not.toHaveBeenCalled();
  });
});

describe('GET /weight-log/trend', () => {
  it('returns a trend snapshot for the given asOf', async () => {
    const repo = makeRepo([
      { date: '2026-05-09', weightKg: 80 },
      { date: '2026-05-11', weightKg: 79.5 },
      { date: '2026-05-13', weightKg: 79 },
      { date: '2026-05-15', weightKg: 78.5 },
    ]);
    const res = await makeApp(repo).request('/weight-log/trend?asOf=2026-05-15');
    expect(res.status).toBe(200);
    const body = (await res.json()) as TrendSnapshot;
    expect(body.totalEntries).toBe(4);
    expect(body.current).toBe(78.5);
    expect(body.movingAverage7d).toBeCloseTo((80 + 79.5 + 79 + 78.5) / 4, 5);
  });

  it("defaults asOf to today's date when omitted", async () => {
    const repo = makeRepo([{ date: '2026-05-15', weightKg: 78.5 }]);
    const res = await makeApp(repo).request('/weight-log/trend');
    const body = (await res.json()) as TrendSnapshot;
    expect(body.current).toBe(78.5);
    expect(body.lastEntryDate).toBe('2026-05-15');
  });

  it('returns an empty snapshot when the log is empty', async () => {
    const res = await makeApp(makeRepo()).request('/weight-log/trend');
    const body = (await res.json()) as TrendSnapshot;
    expect(body.totalEntries).toBe(0);
    expect(body.movingAverage7d).toBeNull();
  });
});
