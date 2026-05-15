import { describe, it, expect, vi } from 'vitest';
import { logWeight } from './log-weight.use-case.ts';
import { listWeightEntries } from './list-weight-entries.use-case.ts';
import { removeWeight } from './remove-weight.use-case.ts';
import { getWeightTrend } from './get-weight-trend.use-case.ts';
import { WeightEntryValidationError } from './validate-weight-entry.ts';
import type { WeightEntry } from './types.ts';
import type { WeightLogRepository } from './weight-log.repository.ts';

const TODAY = '2026-05-15';

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

describe('logWeight', () => {
  it('upserts a valid entry and returns it with a fresh trend snapshot', async () => {
    const repo = makeRepo();
    const result = await logWeight(repo, { date: '2026-05-14', weightKg: 78.4 }, TODAY);
    expect(repo.upsert).toHaveBeenCalledWith({ date: '2026-05-14', weightKg: 78.4 });
    expect(result.entry).toEqual({ date: '2026-05-14', weightKg: 78.4 });
    expect(result.trend.totalEntries).toBe(1);
    expect(result.trend.lastEntryDate).toBe('2026-05-14');
  });

  it('rounds weightKg to 2 decimals on the persisted entry', async () => {
    const repo = makeRepo();
    const result = await logWeight(repo, { date: '2026-05-14', weightKg: 78.4567 }, TODAY);
    expect(repo.upsert).toHaveBeenCalledWith({ date: '2026-05-14', weightKg: 78.46 });
    expect(result.entry.weightKg).toBe(78.46);
  });

  it('replaces the prior entry when writing twice for the same date (last write wins)', async () => {
    const repo = makeRepo([{ date: '2026-05-14', weightKg: 78.4 }]);
    await logWeight(repo, { date: '2026-05-14', weightKg: 78.2 }, TODAY);
    const all = await repo.list();
    expect(all).toEqual([{ date: '2026-05-14', weightKg: 78.2 }]);
  });

  it('rejects an invalid entry without persisting', async () => {
    const repo = makeRepo();
    await expect(logWeight(repo, { date: '2026-05-14', weightKg: -1 }, TODAY)).rejects.toThrow(
      WeightEntryValidationError,
    );
    expect(repo.upsert).not.toHaveBeenCalled();
  });
});

describe('listWeightEntries', () => {
  const seed: WeightEntry[] = [
    { date: '2026-05-09', weightKg: 80 },
    { date: '2026-05-10', weightKg: 79.8 },
    { date: '2026-05-11', weightKg: 79.6 },
    { date: '2026-05-12', weightKg: 79.4 },
  ];

  it('returns all entries sorted ascending by date', async () => {
    const repo = makeRepo([...seed].reverse());
    const all = await listWeightEntries(repo, {});
    expect(all.map((e) => e.date)).toEqual(['2026-05-09', '2026-05-10', '2026-05-11', '2026-05-12']);
  });

  it('filters by [from, to] inclusive', async () => {
    const repo = makeRepo(seed);
    const filtered = await listWeightEntries(repo, { from: '2026-05-10', to: '2026-05-11' });
    expect(filtered.map((e) => e.date)).toEqual(['2026-05-10', '2026-05-11']);
  });

  it('returns an empty list when from > to', async () => {
    const repo = makeRepo(seed);
    const filtered = await listWeightEntries(repo, { from: '2026-05-12', to: '2026-05-09' });
    expect(filtered).toEqual([]);
  });
});

describe('removeWeight', () => {
  it('removes the entry for the given date', async () => {
    const repo = makeRepo([{ date: '2026-05-14', weightKg: 78 }]);
    await removeWeight(repo, '2026-05-14');
    expect(await repo.list()).toEqual([]);
  });

  it('is idempotent when the date does not exist', async () => {
    const repo = makeRepo([{ date: '2026-05-14', weightKg: 78 }]);
    await removeWeight(repo, '2026-05-10');
    expect(await repo.list()).toEqual([{ date: '2026-05-14', weightKg: 78 }]);
  });
});

describe('getWeightTrend', () => {
  it('delegates to computeTrend(entries, asOf) using the repo contents', async () => {
    const repo = makeRepo([
      { date: '2026-05-09', weightKg: 80 },
      { date: '2026-05-11', weightKg: 79.5 },
      { date: '2026-05-13', weightKg: 79 },
      { date: '2026-05-15', weightKg: 78.5 },
    ]);
    const snapshot = await getWeightTrend(repo, TODAY);
    expect(snapshot.totalEntries).toBe(4);
    expect(snapshot.movingAverage7d).toBeCloseTo((80 + 79.5 + 79 + 78.5) / 4, 5);
    expect(snapshot.current).toBe(78.5);
  });

  it('returns an empty snapshot when the log is empty', async () => {
    const snapshot = await getWeightTrend(makeRepo(), TODAY);
    expect(snapshot.totalEntries).toBe(0);
    expect(snapshot.movingAverage7d).toBeNull();
    expect(snapshot.current).toBeNull();
  });
});
