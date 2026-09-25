import { describe, it, expect } from 'vitest';
import { setCookedPortions } from './set-cooked-portions.use-case.ts';
import { FakeLogEntryRepository } from './log-entry-repository.fake.ts';
import type { LogEntry } from './types.ts';

function entry(id: string, date: string, over: Partial<LogEntry> = {}): LogEntry {
  return {
    id,
    date,
    slot: 'dinner',
    loggedAt: '2026-09-25T08:00:00.000Z',
    recipeId: 'chili',
    recipeBatchId: 'batch-1',
    recipePortions: 1,
    ingredient: {
      type: 'full',
      name: id,
      unit: 'g',
      macrosPerUnit: { calories: 2, protein: 0.2, carbs: 0, fat: 0.1 },
      amount: 100,
    },
    ...over,
  };
}

const cooked = (repo: FakeLogEntryRepository) => Object.fromEntries(repo.all().map((e) => [e.id, e.cookedPortions]));

describe('setCookedPortions', () => {
  it('sets cooked portions on every entry of the batch on that date', async () => {
    const repo = new FakeLogEntryRepository([entry('hack', '2026-09-29'), entry('bohnen', '2026-09-29')]);

    const updated = await setCookedPortions(repo, { recipeBatchId: 'batch-1', date: '2026-09-29', cookedPortions: 2 });

    expect(updated.map((e) => e.cookedPortions)).toEqual([2, 2]);
    expect(cooked(repo)).toEqual({ hack: 2, bohnen: 2 });
  });

  it('leaves the same batch id on another date and other entries untouched', async () => {
    const repo = new FakeLogEntryRepository([
      entry('mon', '2026-09-28'),
      entry('tue', '2026-09-29'),
      entry('adhoc', '2026-09-29', { recipeId: undefined, recipeBatchId: undefined, recipePortions: undefined }),
    ]);

    await setCookedPortions(repo, { recipeBatchId: 'batch-1', date: '2026-09-29', cookedPortions: 3 });

    expect(cooked(repo)).toEqual({ mon: undefined, tue: 3, adhoc: undefined });
  });

  it('accepts cooked portions equal to the logged portions', async () => {
    const repo = new FakeLogEntryRepository([entry('hack', '2026-09-29', { recipePortions: 2 })]);

    await setCookedPortions(repo, { recipeBatchId: 'batch-1', date: '2026-09-29', cookedPortions: 2 });

    expect(cooked(repo)).toEqual({ hack: 2 });
  });

  it.each([1, 0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects %s for a batch logged at 2 portions and changes nothing',
    async (value) => {
      const repo = new FakeLogEntryRepository([entry('hack', '2026-09-29', { recipePortions: 2 })]);

      await expect(
        setCookedPortions(repo, { recipeBatchId: 'batch-1', date: '2026-09-29', cookedPortions: value }),
      ).rejects.toThrow(/cooked portions/i);
      expect(cooked(repo)).toEqual({ hack: undefined });
    },
  );

  it('rejects a batch with no entries on that date', async () => {
    const repo = new FakeLogEntryRepository([entry('mon', '2026-09-28')]);

    await expect(
      setCookedPortions(repo, { recipeBatchId: 'batch-1', date: '2026-09-29', cookedPortions: 2 }),
    ).rejects.toThrow(/not found/i);
  });

  it('rejects a missing batch id instead of matching ad-hoc entries', async () => {
    const adhoc = entry('adhoc', '2026-09-29', {
      recipeId: undefined,
      recipeBatchId: undefined,
      recipePortions: undefined,
    });
    const repo = new FakeLogEntryRepository([adhoc]);

    await expect(
      setCookedPortions(repo, { recipeBatchId: undefined as unknown as string, date: '2026-09-29', cookedPortions: 2 }),
    ).rejects.toThrow(/batch id/i);
    expect(cooked(repo)).toEqual({ adhoc: undefined });
  });
});
