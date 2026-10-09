import { describe, it, expect } from 'vite-plus/test';
import { buildGroceryList } from './build-grocery-list.use-case.ts';
import { FakeLogEntryRepository } from '../meal-log/log-entry-repository.fake.ts';
import { FakeCatalogStore } from '../food-catalog/catalog-store.fake.ts';
import type { RecipeRepository } from '../recipes/recipe.repository.ts';
import type { Recipe, RecipeIngredient } from '../recipes/types.ts';
import type { FoodEntry } from '../foods/types.ts';
import type { LogEntry, MealSlot } from '../meal-log/types.ts';

const MACROS = { calories: 1, protein: 0.1, carbs: 0.1, fat: 0.1 };
const WEEK = '2026-09-28'; // Monday

function recipes(...all: Recipe[]): RecipeRepository {
  return {
    save: async () => {},
    findAll: async () => all,
    findById: async (id) => all.find((r) => r.id === id) ?? null,
    update: async () => {},
    remove: async () => {},
  };
}

function recipe(id: string, yieldCount: number, ingredients: RecipeIngredient[]): Recipe {
  return { id, name: id, yield: yieldCount, ingredients, steps: [], createdAt: '', updatedAt: '' };
}

function ing(name: string, amount: number, untracked = false): RecipeIngredient {
  return { name, unit: 'g', macrosPerUnit: MACROS, amount, ...(untracked ? { untracked: true } : {}) };
}

let n = 0;
function adhoc(name: string, amount: number, date: string, unit: 'g' | 'ml' = 'g'): LogEntry {
  return {
    id: `e${++n}`,
    date,
    slot: 'lunch',
    loggedAt: '2026-09-25T08:00:00.000Z',
    ingredient: { type: 'full', name, unit, macrosPerUnit: MACROS, amount },
  };
}

function batch(
  recipeId: string,
  batchId: string,
  date: string,
  items: [string, number][],
  logged: number,
  slot: MealSlot = 'dinner',
): LogEntry[] {
  return items.map(([name, amount]) => ({
    id: `e${++n}`,
    date,
    slot,
    loggedAt: '2026-09-25T08:00:00.000Z',
    recipeId,
    recipeBatchId: batchId,
    recipePortions: logged,
    ingredient: { type: 'full', name, unit: 'g', macrosPerUnit: MACROS, amount },
  }));
}

function quick(date: string): LogEntry {
  return {
    id: `e${++n}`,
    date,
    slot: 'snack',
    loggedAt: '',
    ingredient: { type: 'quick', label: 'Kuchen', calories: 300 },
  };
}

const zwiebel: FoodEntry = {
  id: 'zwiebel',
  name: 'Zwiebel',
  synonyms: ['Speisezwiebel'],
  unit: 'g',
  macrosPer100: { calories: 40, protein: 1, carbs: 9, fat: 0 },
  pieces: [
    { label: 'klein', grams: 110 },
    { label: 'mittel', grams: 180 },
  ],
};

async function build(
  entries: LogEntry[],
  opts: { recipes?: Recipe[]; catalog?: FoodEntry[]; portions?: Record<string, number> } = {},
) {
  return buildGroceryList(
    {
      logEntries: new FakeLogEntryRepository(entries),
      recipes: recipes(...(opts.recipes ?? [])),
      catalog: new FakeCatalogStore(opts.catalog ?? []),
    },
    WEEK,
    opts.portions,
  );
}

const byName = (list: { items: { name: string; amount: number }[] }) =>
  Object.fromEntries(list.items.map((i) => [i.name, i.amount]));

describe('buildGroceryList', () => {
  it('sums ad-hoc entries across the week with their dates', async () => {
    const days = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02'];

    const list = await build(days.map((d) => adhoc('Haferflocken', 60, d)));

    expect(list.items).toEqual([{ name: 'Haferflocken', unit: 'g', amount: 300, untracked: false, dates: days }]);
  });

  it('scales a recipe by the portions passed for it', async () => {
    const chili = recipe('chili', 4, [ing('Hackfleisch', 1000)]);

    const list = await build(batch('chili', 'b1', '2026-09-29', [['Hackfleisch', 250]], 1), {
      recipes: [chili],
      portions: { chili: 2 },
    });

    expect(byName(list)).toEqual({ Hackfleisch: 500 });
  });

  it("scales a recipe's batches across the week by portions over the logged portions", async () => {
    const pasta = recipe('pasta', 2, [ing('Ketchup', 100)]);
    const entries = [
      ...batch('pasta', 'mo', '2026-09-28', [['Ketchup', 50]], 1),
      ...batch('pasta', 'mi', '2026-09-30', [['Ketchup', 50]], 1),
    ];

    const list = await build(entries, { recipes: [pasta], portions: { pasta: 4 } });

    expect(byName(list)).toEqual({ Ketchup: 200 });
    expect(list.recipes).toEqual([{ recipeId: 'pasta', name: 'pasta', loggedPortions: 2, portions: 4 }]);
  });

  it('uses the logged portions when no portions were passed', async () => {
    const list = await build(batch('chili', 'b1', '2026-09-29', [['Hackfleisch', 500]], 2), {
      recipes: [recipe('chili', 4, [ing('Hackfleisch', 1000)])],
    });

    expect(byName(list)).toEqual({ Hackfleisch: 500 });
    expect(list.recipes).toEqual([{ recipeId: 'chili', name: 'chili', loggedPortions: 2, portions: 2 }]);
  });

  it("lists the week's recipes by name", async () => {
    const entries = [
      ...batch('z', 'b1', '2026-09-28', [['Reis', 100]], 1),
      ...batch('a', 'b2', '2026-09-29', [['Reis', 100]], 1),
    ];

    const list = await build(entries, { recipes: [recipe('z', 1, []), recipe('a', 1, [])] });

    expect(list.recipes.map((r) => r.recipeId)).toEqual(['a', 'z']);
  });

  it('ignores portions passed for a recipe that has no batch in the week', async () => {
    const list = await build([adhoc('Reis', 100, '2026-09-28')], { portions: { elsewhere: 4 } });

    expect(byName(list)).toEqual({ Reis: 100 });
    expect(list.recipes).toEqual([]);
  });

  it('rejects a portion value that is not a positive number', async () => {
    await expect(build([], { portions: { pasta: 0 } })).rejects.toThrow(/portions/i);
    await expect(build([], { portions: { pasta: Number.NaN } })).rejects.toThrow(/portions/i);
  });

  it('scales replaced and added batch entries with the batch', async () => {
    // Hackfleisch was replaced by Tofu and Spinat added — both are ordinary members of the batch now.
    const entries = batch(
      'chili',
      'b1',
      '2026-09-29',
      [
        ['Tofu', 250],
        ['Spinat', 100],
      ],
      1,
    );

    const list = await build(entries, {
      recipes: [recipe('chili', 1, [ing('Hackfleisch', 250)])],
      portions: { chili: 2 },
    });

    expect(byName(list)).toEqual({ Spinat: 200, Tofu: 500 });
  });

  it("adds the recipe's untracked ingredients once per recipe, scaled by portions over the yield", async () => {
    const lachs = recipe('lachs', 2, [ing('Salz', 5, true), ing('Lachsfilet', 400)]);
    const entries = [
      ...batch('lachs', 'b1', '2026-09-28', [['Lachsfilet', 200]], 1),
      ...batch('lachs', 'b2', '2026-09-30', [['Lachsfilet', 200]], 1),
    ];

    const list = await build(entries, { recipes: [lachs], portions: { lachs: 4 } });

    expect(list.items).toEqual([
      { name: 'Lachsfilet', unit: 'g', amount: 800, untracked: false, dates: ['2026-09-28', '2026-09-30'] },
      { name: 'Salz', unit: 'g', amount: 10, untracked: true, dates: ['2026-09-28', '2026-09-30'] },
    ]);
  });

  it('counts the untracked tail once per batch, not once per entry', async () => {
    const r = recipe('r', 1, [ing('Salz', 5, true), ing('Reis', 100), ing('Huhn', 100)]);

    const list = await build(
      batch(
        'r',
        'b1',
        '2026-09-30',
        [
          ['Reis', 100],
          ['Huhn', 100],
        ],
        1,
      ),
      {
        recipes: [r],
      },
    );

    expect(byName(list)['Salz']).toBe(5);
  });

  it('counts batches sharing an id on different days separately (days copied before fresh ids)', async () => {
    const r = recipe('r', 1, [ing('Salz', 5, true), ing('Reis', 100)]);
    const entries = [
      ...batch('r', 'shared', '2026-09-28', [['Reis', 100]], 1),
      ...batch('r', 'shared', '2026-09-29', [['Reis', 100]], 1),
    ];

    const list = await build(entries, { recipes: [r] });

    expect(byName(list)).toEqual({ Reis: 200, Salz: 10 });
  });

  it('counts the logged entries of a batch whose recipe was deleted unchanged, without an untracked tail', async () => {
    const list = await build(batch('gone', 'b1', '2026-09-29', [['Reis', 100]], 1), { portions: { gone: 2 } });

    expect(list.items).toEqual([{ name: 'Reis', unit: 'g', amount: 100, untracked: false, dates: ['2026-09-29'] }]);
    expect(list.recipes).toEqual([]);
  });

  it('adds a piece hint from the catalog, matching names and synonyms case-insensitively', async () => {
    const list = await build([adhoc('zwiebel', 200, '2026-09-28'), adhoc('Speisezwiebel', 180, '2026-10-01')], {
      catalog: [zwiebel],
    });

    expect(list.items.find((i) => i.name === 'zwiebel')?.pieceHint).toEqual({ count: 2, label: 'mittel' });
    expect(list.items.find((i) => i.name === 'Speisezwiebel')?.pieceHint).toEqual({ count: 1, label: 'mittel' });
  });

  it('adds a piece hint for an entry logged under its English name', async () => {
    const list = await build([adhoc('Onion', 360, '2026-09-28')], { catalog: [{ ...zwiebel, nameEn: 'Onion' }] });

    expect(list.items[0]!.pieceHint).toEqual({ count: 2, label: 'mittel' });
  });

  it("uses a size-qualified medium piece ('Filet mittel', 'M') as the medium", async () => {
    const kabeljau: FoodEntry = {
      ...zwiebel,
      id: 'kabeljau',
      name: 'Kabeljau',
      synonyms: [],
      pieces: [
        { label: 'Filet klein', grams: 120 },
        { label: 'Filet mittel', grams: 160 },
        { label: 'Filet gross', grams: 220 },
      ],
    };
    const ei: FoodEntry = {
      ...zwiebel,
      id: 'ei',
      name: 'Ei',
      synonyms: [],
      pieces: [
        { label: 'S', grams: 48 },
        { label: 'M', grams: 58 },
        { label: 'L', grams: 68 },
      ],
    };

    const list = await build([adhoc('Kabeljau', 320, '2026-09-28'), adhoc('Ei', 348, '2026-09-28')], {
      catalog: [kabeljau, ei],
    });

    expect(list.items.find((i) => i.name === 'Kabeljau')?.pieceHint).toEqual({ count: 2, label: 'Filet mittel' });
    expect(list.items.find((i) => i.name === 'Ei')?.pieceHint).toEqual({ count: 6, label: 'M' });
  });

  it('falls back to the largest piece without a medium, so a whole head beats its florets', async () => {
    const brokkoli: FoodEntry = {
      ...zwiebel,
      id: 'brokkoli',
      name: 'Brokkoli',
      synonyms: [],
      pieces: [
        { label: 'Röschen', grams: 30 },
        { label: 'Kopf', grams: 500 },
      ],
    };

    const list = await build([adhoc('Brokkoli', 700, '2026-09-28')], { catalog: [brokkoli] });

    expect(list.items[0]!.pieceHint).toEqual({ count: 2, label: 'Kopf' });
  });

  it('gives no piece hint for ml amounts or foods without pieces', async () => {
    const milch: FoodEntry = { ...zwiebel, id: 'milch', name: 'Milch', unit: 'ml', synonyms: [] };

    const list = await build([adhoc('Milch', 500, '2026-09-28', 'ml'), adhoc('Reis', 100, '2026-09-28')], {
      catalog: [milch],
    });

    expect(list.items.every((i) => i.pieceHint === undefined)).toBe(true);
  });

  it('skips quick entries and counts them', async () => {
    const list = await build([quick('2026-09-28'), quick('2026-10-04'), adhoc('Reis', 100, '2026-09-28')]);

    expect(list.skippedQuickEntries).toBe(2);
    expect(byName(list)).toEqual({ Reis: 100 });
  });

  it('only counts the seven days of the requested week', async () => {
    const list = await build([
      adhoc('Vorher', 100, '2026-09-27'),
      adhoc('Montag', 100, '2026-09-28'),
      adhoc('Sonntag', 100, '2026-10-04'),
      adhoc('Danach', 100, '2026-10-05'),
    ]);

    expect(Object.keys(byName(list)).sort()).toEqual(['Montag', 'Sonntag']);
  });

  it('returns an empty list for an empty week', async () => {
    expect(await build([])).toEqual({ startDate: WEEK, items: [], recipes: [], skippedQuickEntries: 0 });
  });

  it('rejects a malformed start date', async () => {
    await expect(
      buildGroceryList(
        { logEntries: new FakeLogEntryRepository(), recipes: recipes(), catalog: new FakeCatalogStore() },
        'next-week',
      ),
    ).rejects.toThrow(/date/i);
  });
});
