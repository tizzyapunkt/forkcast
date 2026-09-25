import { describe, it, expect } from 'vitest';
import { removeRecipeLog } from './remove-recipe-log.use-case.ts';
import { FakeLogEntryRepository } from './log-entry-repository.fake.ts';
import type { LogEntry } from './types.ts';

function entry(id: string, batchId?: string, date = '2026-06-11'): LogEntry {
  return {
    id,
    date,
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

const ids = (repo: FakeLogEntryRepository) => repo.all().map((e) => e.id);

describe('removeRecipeLog', () => {
  it('removes every entry of the batch on that date and nothing else', async () => {
    const repo = new FakeLogEntryRepository([
      entry('a', 'batch-1'),
      entry('b', 'batch-1'),
      entry('c', 'batch-2'),
      entry('d'),
    ]);

    const removed = await removeRecipeLog(repo, { recipeBatchId: 'batch-1', date: '2026-06-11' });

    expect(removed).toBe(2);
    expect(ids(repo)).toEqual(['c', 'd']);
  });

  it('leaves the same batch id on another date untouched', async () => {
    const repo = new FakeLogEntryRepository([
      entry('mon-1', 'batch-1', '2026-06-08'),
      entry('mon-2', 'batch-1', '2026-06-08'),
      entry('tue-1', 'batch-1', '2026-06-09'),
      entry('tue-2', 'batch-1', '2026-06-09'),
    ]);

    await removeRecipeLog(repo, { recipeBatchId: 'batch-1', date: '2026-06-09' });

    expect(ids(repo)).toEqual(['mon-1', 'mon-2']);
  });

  it('rejects a batch with no entries on that date and removes nothing', async () => {
    const repo = new FakeLogEntryRepository([entry('a', 'batch-1', '2026-06-08')]);

    await expect(removeRecipeLog(repo, { recipeBatchId: 'batch-1', date: '2026-06-09' })).rejects.toThrow(/not found/i);
    expect(ids(repo)).toEqual(['a']);
  });

  it('rejects a blank batch id', async () => {
    const repo = new FakeLogEntryRepository([entry('a', 'batch-1')]);

    await expect(removeRecipeLog(repo, { recipeBatchId: '', date: '2026-06-11' })).rejects.toThrow(/batch/i);
    expect(ids(repo)).toEqual(['a']);
  });

  it.each([undefined, '', '11.06.2026'])('rejects date %s', async (date) => {
    const repo = new FakeLogEntryRepository([entry('a', 'batch-1')]);

    await expect(removeRecipeLog(repo, { recipeBatchId: 'batch-1', date: date as unknown as string })).rejects.toThrow(
      /date/i,
    );
    expect(ids(repo)).toEqual(['a']);
  });
});
