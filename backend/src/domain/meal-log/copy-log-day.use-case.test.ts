import { describe, it, expect, vi } from 'vitest';
import { copyLogDay } from './copy-log-day.use-case.ts';
import type { LogEntryRepository } from './log-entry.repository.ts';
import type { LogEntry } from './types.ts';

function entry(id: string, date: string, over: Partial<LogEntry> = {}): LogEntry {
  return {
    id,
    date,
    slot: 'lunch',
    loggedAt: '2026-06-08T08:00:00.000Z',
    ingredient: {
      type: 'full',
      name: 'Reis',
      unit: 'g',
      macrosPerUnit: { calories: 1, protein: 0, carbs: 0, fat: 0 },
      amount: 100,
    },
    ...over,
  };
}

function repoWith(source: LogEntry[]) {
  const saveMany = vi.fn<(entries: LogEntry[]) => Promise<void>>();
  const remove = vi.fn<(id: string) => Promise<void>>();
  const repo: LogEntryRepository = {
    save: vi.fn<(e: LogEntry) => Promise<void>>(),
    saveMany,
    findAll: vi.fn<() => Promise<LogEntry[]>>().mockResolvedValue(source),
    findByDate: vi.fn<(date: string) => Promise<LogEntry[]>>().mockResolvedValue(source),
    findById: vi.fn<(id: string) => Promise<LogEntry | null>>().mockResolvedValue(null),
    update: vi.fn<(e: LogEntry) => Promise<void>>(),
    remove,
  };
  return { repo, saveMany, remove };
}

describe('copyLogDay', () => {
  it('clones each source entry onto toDate with a fresh id + loggedAt, preserving slot/ingredient/recipeId', async () => {
    const source = [
      entry('a', '2026-06-08', { slot: 'breakfast' }),
      entry('b', '2026-06-08', { slot: 'dinner', recipeId: 'rec-1' }),
    ];
    const { repo, saveMany } = repoWith(source);

    const clones = await copyLogDay(repo, { fromDate: '2026-06-08', toDate: '2026-06-09' });

    expect(clones).toHaveLength(2);
    expect(clones.map((c) => c.id).sort()).not.toEqual(['a', 'b']); // fresh ids
    for (const c of clones) {
      expect(c.date).toBe('2026-06-09');
    }
    expect(clones[0]!.slot).toBe('breakfast');
    expect(clones[1]!.slot).toBe('dinner');
    expect(clones[1]!.recipeId).toBe('rec-1');
    expect(clones[0]!.ingredient).toEqual(source[0]!.ingredient);
    // Persisted exactly the clones (additive — no removal of the target day).
    expect(saveMany).toHaveBeenCalledTimes(1);
    expect(saveMany).toHaveBeenCalledWith(clones);
  });

  it('does not mutate the source entries', async () => {
    const source = [entry('a', '2026-06-08')];
    const { repo } = repoWith(source);
    await copyLogDay(repo, { fromDate: '2026-06-08', toDate: '2026-06-09' });
    expect(source[0]!.id).toBe('a');
    expect(source[0]!.date).toBe('2026-06-08');
  });

  it('is a no-op when the source day is empty', async () => {
    const { repo, saveMany } = repoWith([]);
    const clones = await copyLogDay(repo, { fromDate: '2026-06-08', toDate: '2026-06-09' });
    expect(clones).toEqual([]);
    expect(saveMany).not.toHaveBeenCalled();
  });

  it('never removes anything from the target day (additive)', async () => {
    const { repo, remove } = repoWith([entry('a', '2026-06-08')]);
    await copyLogDay(repo, { fromDate: '2026-06-08', toDate: '2026-06-09' });
    expect(remove).not.toHaveBeenCalled();
  });
});
