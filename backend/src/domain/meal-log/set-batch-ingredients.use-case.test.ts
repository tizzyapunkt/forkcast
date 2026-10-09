import { describe, it, expect } from 'vite-plus/test';
import { setBatchIngredients, type BatchIngredientChange } from './set-batch-ingredients.use-case.ts';
import { FakeLogEntryRepository } from './log-entry-repository.fake.ts';
import type { FullIngredientEntry, LogEntry, MeasurementUnit } from './types.ts';

const MACROS = { calories: 1, protein: 0.1, carbs: 0.2, fat: 0.01 };

function food(name: string, amount: number, unit: MeasurementUnit = 'ml'): FullIngredientEntry {
  return { type: 'full', name, unit, macrosPerUnit: MACROS, amount };
}

function member(id: string, date: string, batchId: string, ingredient: FullIngredientEntry, portions = 1): LogEntry {
  return {
    id,
    date,
    slot: 'dinner',
    loggedAt: '2026-10-01T08:00:00.000Z',
    recipeId: 'pasta',
    recipeBatchId: batchId,
    recipePortions: portions,
    ingredient,
  };
}

/** Pasta planned Monday and Wednesday, each with Ketchup and Spaghetti, plus an unrelated ad-hoc entry. */
function week() {
  return new FakeLogEntryRepository([
    member('mo-k', '2026-10-12', 'mo', food('Ketchup', 50)),
    member('mo-s', '2026-10-12', 'mo', food('Spaghetti', 125, 'g')),
    member('mi-k', '2026-10-14', 'mi', food('Ketchup', 50)),
    member('mi-s', '2026-10-14', 'mi', food('Spaghetti', 125, 'g')),
    {
      id: 'adhoc',
      date: '2026-10-14',
      slot: 'snack',
      loggedAt: '2026-10-01T08:00:00.000Z',
      ingredient: food('Ketchup', 20),
    },
  ]);
}

const ketchup = { name: 'Ketchup', unit: 'ml' as const };

function setKetchup(amount: number): BatchIngredientChange[] {
  return [
    { recipeBatchId: 'mo', date: '2026-10-12', remove: [], set: [food('Ketchup', amount)] },
    { recipeBatchId: 'mi', date: '2026-10-14', remove: [], set: [food('Ketchup', amount)] },
  ];
}

const amounts = (repo: FakeLogEntryRepository, batchId: string) =>
  Object.fromEntries(
    repo
      .all()
      .filter((e) => e.recipeBatchId === batchId)
      .map((e) => [
        e.ingredient.type === 'full' ? e.ingredient.name : '',
        e.ingredient.type === 'full' ? e.ingredient.amount : 0,
      ]),
  );

describe('setBatchIngredients', () => {
  it('sets an ingredient in batches on several dates in one write', async () => {
    const repo = week();

    await setBatchIngredients(repo, { changes: setKetchup(100) });

    expect(amounts(repo, 'mo')).toEqual({ Ketchup: 100, Spaghetti: 125 });
    expect(amounts(repo, 'mi')).toEqual({ Ketchup: 100, Spaghetti: 125 });
    expect(repo.all().find((e) => e.id === 'adhoc')?.ingredient).toMatchObject({ amount: 20 });
  });

  it('keeps the id of an entry whose ingredient survives', async () => {
    const repo = week();

    await setBatchIngredients(repo, { changes: setKetchup(100) });

    expect(
      repo
        .all()
        .filter((e) => e.recipeBatchId === 'mo')
        .map((e) => e.id)
        .sort(),
    ).toEqual(['mo-k', 'mo-s']);
  });

  it('changes nothing further when the same command is sent twice', async () => {
    const repo = week();

    await setBatchIngredients(repo, { changes: setKetchup(100) });
    const once = repo.all();
    await setBatchIngredients(repo, { changes: setKetchup(100) });

    expect(repo.all()).toEqual(once);
  });

  it('swaps one ingredient for another, taking slot and recipe metadata from the batch', async () => {
    const repo = week();

    const [result] = await setBatchIngredients(repo, {
      changes: [{ recipeBatchId: 'mo', date: '2026-10-12', remove: [ketchup], set: [food('Passata', 100)] }],
    });

    expect(amounts(repo, 'mo')).toEqual({ Passata: 100, Spaghetti: 125 });
    const passata = repo.all().find((e) => e.ingredient.type === 'full' && e.ingredient.name === 'Passata')!;
    expect(passata).toMatchObject({
      date: '2026-10-12',
      slot: 'dinner',
      recipeId: 'pasta',
      recipeBatchId: 'mo',
      recipePortions: 1,
    });
    expect(passata.id).not.toBe('mo-k');
    expect(passata.loggedAt > '2026-10-01T08:00:00.000Z').toBe(true);
    expect(result).toBeDefined();
  });

  it('adds an ingredient to a batch that lacks it', async () => {
    const repo = week();

    await setBatchIngredients(repo, {
      changes: [{ recipeBatchId: 'mi', date: '2026-10-14', remove: [], set: [food('Sahne', 25)] }],
    });

    expect(amounts(repo, 'mi')).toEqual({ Ketchup: 50, Sahne: 25, Spaghetti: 125 });
  });

  it('removes an ingredient from a batch', async () => {
    const repo = week();

    await setBatchIngredients(repo, {
      changes: [{ recipeBatchId: 'mi', date: '2026-10-14', remove: [ketchup], set: [] }],
    });

    expect(amounts(repo, 'mi')).toEqual({ Spaghetti: 125 });
    expect(amounts(repo, 'mo')).toEqual({ Ketchup: 50, Spaghetti: 125 });
  });

  it('matches identities by case-insensitive name and unit', async () => {
    const repo = week();

    await setBatchIngredients(repo, {
      changes: [{ recipeBatchId: 'mo', date: '2026-10-12', remove: [{ name: 'KETCHUP', unit: 'ml' }], set: [] }],
    });

    expect(amounts(repo, 'mo')).toEqual({ Spaghetti: 125 });
  });

  it('collapses duplicate entries of one identity into the one it sets', async () => {
    const repo = new FakeLogEntryRepository([
      member('a', '2026-10-12', 'mo', food('Ketchup', 30)),
      member('b', '2026-10-12', 'mo', food('Ketchup', 20)),
    ]);

    await setBatchIngredients(repo, {
      changes: [{ recipeBatchId: 'mo', date: '2026-10-12', remove: [], set: [food('Ketchup', 80)] }],
    });

    expect(repo.all().map((e) => [e.id, e.ingredient.type === 'full' && e.ingredient.amount])).toEqual([['a', 80]]);
  });

  it('only touches the batch on its own date when an id recurs on another day', async () => {
    const repo = new FakeLogEntryRepository([
      member('mo', '2026-10-12', 'shared', food('Ketchup', 50)),
      member('di', '2026-10-13', 'shared', food('Ketchup', 50)),
    ]);

    await setBatchIngredients(repo, {
      changes: [{ recipeBatchId: 'shared', date: '2026-10-13', remove: [], set: [food('Ketchup', 90)] }],
    });

    expect(repo.all().map((e) => e.ingredient.type === 'full' && e.ingredient.amount)).toEqual([50, 90]);
  });

  it('rejects everything when one batch is unknown', async () => {
    const repo = week();

    await expect(
      setBatchIngredients(repo, {
        changes: [...setKetchup(100), { recipeBatchId: 'nope', date: '2026-10-14', remove: [], set: [] }],
      }),
    ).rejects.toThrow(/not found/);
    expect(amounts(repo, 'mo')).toEqual({ Ketchup: 50, Spaghetti: 125 });
  });

  it.each([
    ['a non-positive amount', food('Ketchup', 0), /amount/i],
    ['a missing name', food('', 50), /name/i],
    [
      'missing macros',
      { ...food('Ketchup', 50), macrosPerUnit: undefined } as unknown as FullIngredientEntry,
      /macros/i,
    ],
  ])('rejects %s and changes nothing', async (_label, ingredient, message) => {
    const repo = week();

    await expect(
      setBatchIngredients(repo, {
        changes: [{ recipeBatchId: 'mo', date: '2026-10-12', remove: [], set: [ingredient] }],
      }),
    ).rejects.toThrow(message);
    expect(amounts(repo, 'mo')).toEqual({ Ketchup: 50, Spaghetti: 125 });
  });

  it('rejects one identity set twice in a batch', async () => {
    await expect(
      setBatchIngredients(week(), {
        changes: [
          { recipeBatchId: 'mo', date: '2026-10-12', remove: [], set: [food('Ketchup', 50), food('ketchup', 60)] },
        ],
      }),
    ).rejects.toThrow(/twice/);
  });

  it('rejects a change that would leave a batch empty', async () => {
    const repo = week();

    await expect(
      setBatchIngredients(repo, {
        changes: [
          {
            recipeBatchId: 'mo',
            date: '2026-10-12',
            remove: [ketchup, { name: 'Spaghetti', unit: 'g' }],
            set: [],
          },
        ],
      }),
    ).rejects.toThrow(/empty/);
    expect(amounts(repo, 'mo')).toEqual({ Ketchup: 50, Spaghetti: 125 });
  });

  it('rejects a request without changes', async () => {
    await expect(setBatchIngredients(week(), { changes: [] })).rejects.toThrow(/change/);
  });
});
