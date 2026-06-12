import { describe, it, expect, vi } from 'vitest';
import { removeRecipeLog } from './remove-recipe-log.use-case.ts';
import type { LogEntryRepository } from './log-entry.repository.ts';
import type { LogEntry } from './types.ts';

function entry(id: string, batchId?: string): LogEntry {
  return {
    id,
    date: '2026-06-11',
    slot: 'lunch',
    loggedAt: '2026-06-11T12:00:00.000Z',
    ...(batchId !== undefined ? { recipeId: 'rec-1', recipeBatchId: batchId, recipePortions: 1 } : {}),
    ingredient: {
      type: 'full',
      name: 'Rice',
      unit: 'g',
      macrosPerUnit: { calories: 1.3, protein: 0.027, carbs: 0.28, fat: 0.003 },
      amount: 100,
    },
  };
}

function makeRepo(all: LogEntry[]): { repo: LogEntryRepository; removedBatches: string[][] } {
  const removedBatches: string[][] = [];
  const repo: LogEntryRepository = {
    save: vi.fn<(e: LogEntry) => Promise<void>>(),
    saveMany: vi.fn<(e: LogEntry[]) => Promise<void>>(),
    findAll: vi.fn<() => Promise<LogEntry[]>>().mockResolvedValue(all),
    findByDate: vi.fn<(d: string) => Promise<LogEntry[]>>(),
    findById: vi.fn<(id: string) => Promise<LogEntry | null>>(),
    update: vi.fn<(e: LogEntry) => Promise<void>>(),
    remove: vi.fn<(id: string) => Promise<void>>(),
    removeMany: vi.fn<(ids: string[]) => Promise<void>>().mockImplementation(async (ids) => {
      removedBatches.push(ids);
    }),
  };
  return { repo, removedBatches };
}

describe('removeRecipeLog', () => {
  it('removes every entry of the batch in a single removeMany call and nothing else', async () => {
    const { repo, removedBatches } = makeRepo([
      entry('a', 'batch-1'),
      entry('b', 'batch-1'),
      entry('c', 'batch-2'),
      entry('d'),
    ]);

    await removeRecipeLog(repo, 'batch-1');

    expect(removedBatches).toHaveLength(1);
    expect(removedBatches[0]).toEqual(['a', 'b']);
    expect(repo.remove).not.toHaveBeenCalled();
  });

  it('rejects an unknown batch id and removes nothing', async () => {
    const { repo, removedBatches } = makeRepo([entry('a', 'batch-1')]);

    await expect(removeRecipeLog(repo, 'missing')).rejects.toThrow(/not found/i);
    expect(removedBatches).toEqual([]);
  });

  it('rejects a blank batch id', async () => {
    const { repo, removedBatches } = makeRepo([entry('a', 'batch-1')]);

    await expect(removeRecipeLog(repo, '')).rejects.toThrow(/batch/i);
    expect(removedBatches).toEqual([]);
  });
});
