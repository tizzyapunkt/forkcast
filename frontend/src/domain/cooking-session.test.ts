import {
  addToPot,
  buildPot,
  canLeaveOut,
  changeAmount,
  defaultSelection,
  extendSnapshot,
  leaveOut,
  recipeBatchesInWeek,
  restoreRow,
  snapshotRow,
  swapInPot,
  swapPrefill,
  type CookingBatch,
  type PotInput,
} from './cooking-session';
import type { DailyLog, FullIngredientEntry, LogEntry, MealSlot, MeasurementUnit, WeekLog } from './meal-log';
import type { Recipe, RecipeIngredient } from './recipes';

const KETCHUP_MACROS = { calories: 1, protein: 0, carbs: 0.25, fat: 0 };
const PASTA_MACROS = { calories: 3.6, protein: 0.12, carbs: 0.72, fat: 0.02 };

function food(name: string, amount: number, unit: MeasurementUnit = 'g', macros = PASTA_MACROS): FullIngredientEntry {
  return { type: 'full', name, unit, macrosPerUnit: macros, amount };
}

let n = 0;
function entry(
  date: string,
  batchId: string,
  ingredient: FullIngredientEntry,
  portions = 1,
  slot: MealSlot = 'dinner',
) {
  return {
    id: `e${++n}`,
    date,
    slot,
    loggedAt: '',
    recipeId: 'pasta',
    recipeBatchId: batchId,
    recipePortions: portions,
    ingredient,
  } satisfies LogEntry;
}

function batch(date: string, id: string, items: FullIngredientEntry[], portions = 1): CookingBatch {
  return {
    key: `${date}~${id}`,
    recipeBatchId: id,
    date,
    slot: 'dinner',
    portions,
    entries: items.map((i) => entry(date, id, i, portions)),
  };
}

const ketchup = (amount: number) => food('Ketchup', amount, 'ml', KETCHUP_MACROS);

/** Pasta on Monday and Wednesday, 1 portion each: Spaghetti 125 g, Ketchup 50 ml. */
const mo = batch('2026-10-12', 'mo', [food('Spaghetti', 125), ketchup(50)]);
const mi = batch('2026-10-14', 'mi', [food('Spaghetti', 125), ketchup(50)]);

function ing(name: string, amount: number, extra: Partial<RecipeIngredient> = {}): RecipeIngredient {
  return { name, unit: 'g', macrosPerUnit: PASTA_MACROS, amount, ...extra };
}

const recipe: Recipe = {
  id: 'pasta',
  name: 'Pasta',
  yield: 2,
  ingredients: [
    ing('Olivenöl', 15, { displayQuantity: { amount: 1, unitLabel: 'EL' } }),
    ing('Spaghetti', 250),
    { ...ing('Ketchup', 100), unit: 'ml', macrosPerUnit: KETCHUP_MACROS, note: 'die ganze Flasche' },
    ing('Zwiebel', 80, { pieceQuantity: { amount: 1, unitLabel: 'Stück', gramsPerPiece: 80 } }),
    ing('Salz', 4, { untracked: true, displayQuantity: { unitLabel: 'nach Geschmack' } }),
    ing('Oregano', 2, { untracked: true, displayQuantity: { amount: 1, unitLabel: 'TL' } }),
  ],
  steps: ['Kochen.'],
  createdAt: '',
  updatedAt: '',
};

function input(overrides: Partial<PotInput> = {}): PotInput {
  return { batches: [mo, mi], selected: [mo.key, mi.key], extraPortions: 2, recipe, ...overrides };
}

const row = (pot: ReturnType<typeof buildPot>, name: string) => pot.rows.find((r) => r.name === name)!;

describe('recipeBatchesInWeek', () => {
  it('collects the batches of one recipe in day and slot order', () => {
    const day = (date: string, entries: LogEntry[]): DailyLog => ({
      date,
      slots: (['breakfast', 'lunch', 'dinner', 'snack'] as const).map((slot) => ({
        slot,
        entries: entries.filter((e) => e.slot === slot),
        totals: { calories: 0, protein: 0, carbs: 0, fat: 0, macrosPartial: false },
      })),
      totals: { calories: 0, protein: 0, carbs: 0, fat: 0, macrosPartial: false },
    });
    const other = { ...entry('2026-10-12', 'x', food('Reis', 100)), recipeId: 'curry' };
    const week = {
      startDate: '2026-10-12',
      days: [
        day('2026-10-12', [
          entry('2026-10-12', 'b', ketchup(50), 1, 'dinner'),
          entry('2026-10-12', 'a', ketchup(50), 1, 'lunch'),
          other,
        ]),
        day('2026-10-13', []),
        day('2026-10-14', [entry('2026-10-14', 'c', ketchup(50)), entry('2026-10-14', 'c', food('Spaghetti', 125))]),
      ],
    } as unknown as WeekLog;

    const batches = recipeBatchesInWeek(week, 'pasta');

    expect(batches.map((b) => [b.key, b.slot, b.entries.length])).toEqual([
      ['2026-10-12~a', 'lunch', 1],
      ['2026-10-12~b', 'dinner', 1],
      ['2026-10-14~c', 'dinner', 2],
    ]);
  });
});

describe('defaultSelection', () => {
  const fr = batch('2026-10-16', 'fr', [ketchup(50)]);

  it('selects the batches dated today or later', () => {
    expect(defaultSelection([mo, mi, fr], '2026-10-14')).toEqual([mi.key, fr.key]);
  });

  it('selects everything when every batch is in the past', () => {
    expect(defaultSelection([mo, mi], '2026-10-20')).toEqual([mo.key, mi.key]);
  });
});

describe('buildPot', () => {
  it('cooks the selected portions plus the people eating along', () => {
    const pot = buildPot(input());

    expect(pot).toMatchObject({ loggedPortions: 2, extraPortions: 2, potPortions: 4, selectedBatches: 2 });
    expect(row(pot, 'Ketchup').potAmount).toBe(200);
    expect(row(pot, 'Spaghetti').potAmount).toBe(500);
  });

  it('recomputes the pot for the remaining selection', () => {
    const pot = buildPot(input({ selected: [mi.key] }));

    expect(pot.potPortions).toBe(3);
    expect(row(pot, 'Ketchup').potAmount).toBe(150);
  });

  it('says how many selected batches contain an ingredient', () => {
    const withParmesan = batch('2026-10-14', 'mi', [food('Spaghetti', 125), ketchup(50), food('Parmesan', 15)]);

    const pot = buildPot(input({ batches: [mo, withParmesan] }));

    expect(row(pot, 'Parmesan')).toMatchObject({ inBatches: 1, potAmount: 30 });
    expect(row(pot, 'Ketchup').inBatches).toBe(2);
  });

  it('follows the recipe order, notes and measures, with ingredients not in the recipe after', () => {
    const withTofu = batch('2026-10-14', 'mi', [
      food('Tofu', 100),
      ketchup(50),
      food('Spaghetti', 125),
      food('Zwiebel', 40),
    ]);

    const pot = buildPot(input({ batches: [withTofu], selected: [withTofu.key], extraPortions: 1 }));

    expect(pot.rows.map((r) => [r.name, r.added])).toEqual([
      ['Spaghetti', false],
      ['Ketchup', false],
      ['Zwiebel', false],
      ['Tofu', true],
    ]);
    expect(row(pot, 'Ketchup').note).toBe('die ganze Flasche');
    expect(row(pot, 'Zwiebel').measure).toEqual({ label: 'Stück', perUnit: 80 });
  });

  it("converts spoon measures at the recipe's own rate", () => {
    const withOil = batch('2026-10-14', 'mi', [food('Olivenöl', 7.5)]);

    const pot = buildPot(input({ batches: [withOil], selected: [withOil.key], extraPortions: 3 }));

    expect(row(pot, 'Olivenöl')).toMatchObject({ potAmount: 30, measure: { label: 'EL', perUnit: 15 } });
  });

  it('lists the untracked recipe ingredients scaled to the pot, qualitative ones by label only', () => {
    const pot = buildPot(input());

    expect(pot.untracked).toEqual([
      { name: 'Salz', unit: 'g', amount: null, label: 'nach Geschmack' },
      { name: 'Oregano', unit: 'g', amount: 4, label: 'TL', labelAmount: 2 },
    ]);
  });

  it('computes macros per logged portion, unaffected by people eating along', () => {
    const alone = buildPot(input({ extraPortions: 0 }));
    const withGuests = buildPot(input({ extraPortions: 5 }));

    expect(alone.macrosPerPortion.calories).toBeCloseTo(125 * 3.6 + 50 * 1);
    expect(withGuests.macrosPerPortion).toEqual(alone.macrosPerPortion);
  });

  it('falls back to the logged ingredients when the recipe is gone', () => {
    const pot = buildPot(input({ recipe: null }));

    expect(pot.recipeMissing).toBe(true);
    expect(pot.steps).toEqual([]);
    expect(pot.untracked).toEqual([]);
    expect(pot.rows.map((r) => [r.name, r.added])).toEqual([
      ['Spaghetti', false],
      ['Ketchup', false],
    ]);
  });
});

describe('edits', () => {
  it('sets a new pot amount by portion in every selected batch', () => {
    const changes = changeAmount(input(), ketchup(0), 400);

    expect(changes).toEqual([
      { recipeBatchId: 'mo', date: '2026-10-12', remove: [], set: [ketchup(100)] },
      { recipeBatchId: 'mi', date: '2026-10-14', remove: [], set: [ketchup(100)] },
    ]);
  });

  it('evens out batches that differed and scales by their logged portions', () => {
    const two = batch('2026-10-14', 'mi', [ketchup(140)], 2);

    const changes = changeAmount(
      input({ batches: [mo, two], selected: [mo.key, two.key], extraPortions: 0 }),
      ketchup(0),
      300,
    );

    expect(changes.map((c) => c.set[0]!.amount)).toEqual([100, 200]);
  });

  it('leaves unselected batches out of the write', () => {
    const changes = changeAmount(input({ selected: [mi.key] }), ketchup(0), 300);

    expect(changes.map((c) => c.recipeBatchId)).toEqual(['mi']);
  });

  it('adds a food to every selected batch by portion', () => {
    const sahne = food('Sahne', 0, 'ml');

    const changes = addToPot(input(), sahne, 200);

    expect(changes.map((c) => c.set[0])).toEqual([food('Sahne', 50, 'ml'), food('Sahne', 50, 'ml')]);
  });

  it('swaps one food for another', () => {
    const passata = food('Passata', 0, 'ml');

    const changes = swapInPot(input(), { name: 'Ketchup', unit: 'ml' }, passata, 400);

    expect(changes[0]).toEqual({
      recipeBatchId: 'mo',
      date: '2026-10-12',
      remove: [{ name: 'Ketchup', unit: 'ml' }],
      set: [food('Passata', 100, 'ml')],
    });
  });

  it('leaves an ingredient out of every selected batch', () => {
    expect(leaveOut(input(), { name: 'Ketchup', unit: 'ml' })).toEqual([
      { recipeBatchId: 'mo', date: '2026-10-12', remove: [{ name: 'Ketchup', unit: 'ml' }], set: [] },
      { recipeBatchId: 'mi', date: '2026-10-14', remove: [{ name: 'Ketchup', unit: 'ml' }], set: [] },
    ]);
  });

  it('does not offer leaving out the last ingredient of a batch', () => {
    const onlyKetchup = batch('2026-10-14', 'mi', [ketchup(50)]);
    const state = input({ batches: [mo, onlyKetchup], selected: [mo.key, onlyKetchup.key] });

    expect(canLeaveOut(state, { name: 'Ketchup', unit: 'ml' })).toBe(false);
    expect(canLeaveOut(state, { name: 'Spaghetti', unit: 'g' })).toBe(true);
  });
});

describe('swapPrefill', () => {
  const pot = buildPot(input());

  it('starts with the old pot amount when the units match', () => {
    expect(swapPrefill(pot, { name: 'Ketchup', unit: 'ml' }, { name: 'Passata', unit: 'ml' })).toBe(200);
  });

  it('starts empty for a different unit', () => {
    expect(swapPrefill(pot, { name: 'Ketchup', unit: 'ml' }, { name: 'Tomaten', unit: 'g' })).toBeNull();
  });

  it('adds the pot amount of a target that is already in the pot', () => {
    const both = batch('2026-10-14', 'mi', [ketchup(50), food('Passata', 75, 'ml')]);
    const withPassata = buildPot(input({ batches: [mo, both] }));

    expect(swapPrefill(withPassata, { name: 'Ketchup', unit: 'ml' }, { name: 'Passata', unit: 'ml' })).toBe(350);
  });
});

describe('undo', () => {
  it('restores uneven original amounts in exactly the snapshotted batches', () => {
    const uneven = batch('2026-10-14', 'mi', [food('Spaghetti', 125), ketchup(70)]);
    const state = input({ batches: [mo, uneven], selected: [mo.key, uneven.key] });

    const snapshot = snapshotRow(state, [{ name: 'Ketchup', unit: 'ml' }]);

    expect(restoreRow(snapshot)).toEqual([
      { recipeBatchId: 'mo', date: '2026-10-12', remove: [], set: [ketchup(50)] },
      { recipeBatchId: 'mi', date: '2026-10-14', remove: [], set: [ketchup(70)] },
    ]);
  });

  it('undoes a swap: the old food comes back and the new one goes', () => {
    const snapshot = snapshotRow(input(), [
      { name: 'Ketchup', unit: 'ml' },
      { name: 'Passata', unit: 'ml' },
    ]);

    expect(restoreRow(snapshot)[0]).toEqual({
      recipeBatchId: 'mo',
      date: '2026-10-12',
      remove: [{ name: 'Passata', unit: 'ml' }],
      set: [ketchup(50)],
    });
  });

  it('undoes an added food by removing it', () => {
    const snapshot = snapshotRow(input(), [{ name: 'Sahne', unit: 'ml' }]);

    expect(restoreRow(snapshot).map((c) => [c.remove, c.set])).toEqual([
      [[{ name: 'Sahne', unit: 'ml' }], []],
      [[{ name: 'Sahne', unit: 'ml' }], []],
    ]);
  });

  it('keeps the first snapshot when a changed row is swapped later', () => {
    const changedMo = batch('2026-10-12', 'mo', [food('Spaghetti', 125), ketchup(100), food('Passata', 30, 'ml')]);
    const first = snapshotRow(input(), [{ name: 'Ketchup', unit: 'ml' }]);

    const extended = extendSnapshot(input({ batches: [changedMo, mi], selected: [changedMo.key, mi.key] }), first, [
      { name: 'Ketchup', unit: 'ml' },
      { name: 'Passata', unit: 'ml' },
    ]);

    expect(restoreRow(extended)[0]).toEqual({
      recipeBatchId: 'mo',
      date: '2026-10-12',
      remove: [],
      set: [ketchup(50), food('Passata', 30, 'ml')],
    });
  });
});
