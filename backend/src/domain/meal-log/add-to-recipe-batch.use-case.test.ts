import { describe, it, expect } from 'vitest';
import { addToRecipeBatch } from './add-to-recipe-batch.use-case.ts';
import { FakeLogEntryRepository } from './log-entry-repository.fake.ts';
import type { FullIngredientEntry, LogEntry } from './types.ts';

function full(name: string, amount: number): FullIngredientEntry {
  return { type: 'full', name, unit: 'g', macrosPerUnit: { calories: 2, protein: 0.2, carbs: 0.1, fat: 0.1 }, amount };
}

function batchEntry(id: string, date: string, name: string): LogEntry {
  return {
    id,
    date,
    slot: 'dinner',
    loggedAt: '2026-09-25T08:00:00.000Z',
    recipeId: 'chili',
    recipeBatchId: 'batch-1',
    recipePortions: 2,
    ingredient: full(name, 250),
  };
}

const spinat = full('Spinat', 100);

describe('addToRecipeBatch', () => {
  it('creates an entry that joins the batch on that date', async () => {
    const repo = new FakeLogEntryRepository([batchEntry('hack', '2026-09-29', 'Hackfleisch')]);

    const added = await addToRecipeBatch(repo, { recipeBatchId: 'batch-1', date: '2026-09-29', ingredient: spinat });

    expect(added).toMatchObject({
      date: '2026-09-29',
      slot: 'dinner',
      recipeId: 'chili',
      recipeBatchId: 'batch-1',
      recipePortions: 2,
      ingredient: spinat,
    });
    expect(added.id).not.toBe('hack');
    expect(added.loggedAt > '2026-09-25T08:00:00.000Z').toBe(true);
    expect(await repo.findById(added.id)).toEqual(added);
  });

  it('leaves the existing batch entries unchanged', async () => {
    const existing = batchEntry('hack', '2026-09-29', 'Hackfleisch');
    const repo = new FakeLogEntryRepository([existing]);

    await addToRecipeBatch(repo, { recipeBatchId: 'batch-1', date: '2026-09-29', ingredient: spinat });

    expect(await repo.findById('hack')).toEqual(existing);
    expect(repo.all()).toHaveLength(2);
  });

  it('only touches the batch on the given date when the same batch id exists on another date', async () => {
    const monday = batchEntry('mon', '2026-09-28', 'Hackfleisch');
    const tuesday = { ...batchEntry('tue', '2026-09-29', 'Hackfleisch'), slot: 'lunch' as const };
    const repo = new FakeLogEntryRepository([monday, tuesday]);

    const added = await addToRecipeBatch(repo, { recipeBatchId: 'batch-1', date: '2026-09-29', ingredient: spinat });

    expect(added.date).toBe('2026-09-29');
    expect(added.slot).toBe('lunch');
    expect(repo.all().filter((e) => e.date === '2026-09-28')).toEqual([monday]);
    expect(repo.all()).toHaveLength(3);
  });

  it('rejects a batch with no entries on that date and creates nothing', async () => {
    const repo = new FakeLogEntryRepository([batchEntry('mon', '2026-09-28', 'Hackfleisch')]);

    await expect(
      addToRecipeBatch(repo, { recipeBatchId: 'batch-1', date: '2026-09-29', ingredient: spinat }),
    ).rejects.toThrow(/not found/i);
    expect(repo.all()).toHaveLength(1);
  });

  it('rejects a missing batch id instead of matching an ad-hoc entry', async () => {
    const adhoc = batchEntry('adhoc', '2026-09-29', 'Reis');
    delete adhoc.recipeId;
    delete adhoc.recipeBatchId;
    delete adhoc.recipePortions;
    const repo = new FakeLogEntryRepository([adhoc]);

    await expect(
      addToRecipeBatch(repo, { recipeBatchId: undefined as unknown as string, date: '2026-09-29', ingredient: spinat }),
    ).rejects.toThrow(/batch id/i);
    expect(repo.all()).toHaveLength(1);
  });

  it('rejects a quick ingredient and creates nothing', async () => {
    const repo = new FakeLogEntryRepository([batchEntry('hack', '2026-09-29', 'Hackfleisch')]);
    const quick = { type: 'quick', label: 'Snack', calories: 100 } as unknown as FullIngredientEntry;

    await expect(
      addToRecipeBatch(repo, { recipeBatchId: 'batch-1', date: '2026-09-29', ingredient: quick }),
    ).rejects.toThrow(/full ingredient/i);
    expect(repo.all()).toHaveLength(1);
  });

  it.each([0, -1])('rejects amount %s and creates nothing', async (amount) => {
    const repo = new FakeLogEntryRepository([batchEntry('hack', '2026-09-29', 'Hackfleisch')]);

    await expect(
      addToRecipeBatch(repo, { recipeBatchId: 'batch-1', date: '2026-09-29', ingredient: { ...spinat, amount } }),
    ).rejects.toThrow(/amount/i);
    expect(repo.all()).toHaveLength(1);
  });
});
