import { describe, it, expect } from 'vitest';
import { replaceBatchIngredient } from './replace-batch-ingredient.use-case.ts';
import { FakeLogEntryRepository } from './log-entry-repository.fake.ts';
import { listRecentlyUsedIngredients } from './list-recently-used-ingredients.use-case.ts';
import type { FullIngredientEntry, LogEntry } from './types.ts';

function full(name: string, amount: number, unit: FullIngredientEntry['unit'] = 'g'): FullIngredientEntry {
  return { type: 'full', name, unit, macrosPerUnit: { calories: 2, protein: 0.2, carbs: 0.1, fat: 0.1 }, amount };
}

function batchEntry(id: string, ingredient: FullIngredientEntry): LogEntry {
  return {
    id,
    date: '2026-09-29',
    slot: 'dinner',
    loggedAt: '2026-09-25T08:00:00.000Z',
    recipeId: 'chili',
    recipeBatchId: 'batch-1',
    recipePortions: 1,
    ingredient,
  };
}

const tofu = {
  type: 'full',
  name: 'Tofu',
  unit: 'g',
  macrosPerUnit: { calories: 1.2, protein: 0.12, carbs: 0.02, fat: 0.07 },
  amount: 250,
} as const;

function chili() {
  return new FakeLogEntryRepository([
    batchEntry('hack', full('Hackfleisch', 250)),
    batchEntry('bohnen', full('Kidneybohnen', 200)),
    batchEntry('passata', full('Passata', 250)),
  ]);
}

describe('replaceBatchIngredient', () => {
  it('swaps the food but keeps the entry in its batch', async () => {
    const repo = chili();

    const updated = await replaceBatchIngredient(repo, { entryId: 'hack', ingredient: tofu });

    expect(updated).toMatchObject({
      id: 'hack',
      date: '2026-09-29',
      slot: 'dinner',
      recipeId: 'chili',
      recipeBatchId: 'batch-1',
      recipePortions: 1,
      ingredient: tofu,
    });
    expect(await repo.findById('hack')).toEqual(updated);
  });

  it('refreshes loggedAt so the new food counts as recently used', async () => {
    const repo = chili();

    const updated = await replaceBatchIngredient(repo, { entryId: 'hack', ingredient: tofu });

    expect(updated.loggedAt > '2026-09-25T08:00:00.000Z').toBe(true);
  });

  it('surfaces the replacement food first among recently used ingredients', async () => {
    const repo = chili();

    await replaceBatchIngredient(repo, { entryId: 'hack', ingredient: tofu });

    const recent = await listRecentlyUsedIngredients(repo);
    expect(recent[0]).toMatchObject({ name: 'Tofu', unit: 'g', lastAmount: 250 });
    expect(recent.map((r) => r.name)).not.toContain('Hackfleisch');
  });

  it('leaves the other entries of the batch untouched', async () => {
    const repo = chili();
    const before = repo.all().filter((e) => e.id !== 'hack');

    await replaceBatchIngredient(repo, { entryId: 'hack', ingredient: tofu });

    expect(repo.all().filter((e) => e.id !== 'hack')).toEqual(before);
  });

  it('rejects an unknown entry', async () => {
    const repo = chili();
    await expect(replaceBatchIngredient(repo, { entryId: 'nope', ingredient: tofu })).rejects.toThrow(/not found/i);
  });

  it('rejects an entry outside a recipe batch and leaves it unchanged', async () => {
    const adhoc: LogEntry = { ...batchEntry('adhoc', full('Reis', 100)) };
    delete adhoc.recipeId;
    delete adhoc.recipeBatchId;
    delete adhoc.recipePortions;
    const repo = new FakeLogEntryRepository([adhoc]);

    await expect(replaceBatchIngredient(repo, { entryId: 'adhoc', ingredient: tofu })).rejects.toThrow(/batch/i);
    expect(repo.all()).toEqual([adhoc]);
  });

  it('rejects a quick ingredient', async () => {
    const repo = chili();
    const before = repo.all();
    const quick = { type: 'quick', label: 'Snack', calories: 100 };

    await expect(
      replaceBatchIngredient(repo, { entryId: 'hack', ingredient: quick as unknown as FullIngredientEntry }),
    ).rejects.toThrow(/full ingredient/i);
    expect(repo.all()).toEqual(before);
  });

  it.each([0, -5, Number.NaN])('rejects amount %s and leaves the entry unchanged', async (amount) => {
    const repo = chili();
    const before = repo.all();

    await expect(replaceBatchIngredient(repo, { entryId: 'hack', ingredient: { ...tofu, amount } })).rejects.toThrow(
      /amount/i,
    );
    expect(repo.all()).toEqual(before);
  });
});
