import { describe, it, expect, vi } from 'vitest';
import { confirmResolution, type ConfirmResolutionDeps, type SynonymRegistrar } from './confirm-resolution.use-case.ts';
import type { FoodEntry } from '../foods/types.ts';
import type { UserFoodsOverlay, UserFoodsStore } from '../user-foods/types.ts';
import type { MatchSourceFood } from '../ai-recipe-import/build-matched-row.ts';

function makeOverlay(initial: UserFoodsOverlay = { foods: [], synonyms: [] }): UserFoodsStore & {
  current: UserFoodsOverlay;
} {
  const state = { current: structuredClone(initial) };
  return {
    current: state.current,
    load: vi.fn<() => Promise<UserFoodsOverlay>>(async () => state.current),
    addFood: vi.fn<(entry: FoodEntry) => Promise<void>>(async (entry) => {
      state.current.foods.push(entry);
    }),
    addSynonym: vi.fn<(syn: { foodId: string; synonym: string }) => Promise<void>>(async (syn) => {
      state.current.synonyms.push(syn);
    }),
    exportAndClear: vi.fn<() => Promise<UserFoodsOverlay>>(async () => {
      const snapshot = state.current;
      state.current = { foods: [], synonyms: [] };
      return snapshot;
    }),
  };
}

function makeCurated(entries: Record<string, MatchSourceFood>): SynonymRegistrar & { added: Array<[string, string]> } {
  const added: Array<[string, string]> = [];
  return {
    added,
    addSynonym: vi.fn<(foodId: string, synonym: string) => boolean>((foodId, synonym) => {
      if (!entries[foodId]) return false;
      added.push([foodId, synonym]);
      return true;
    }),
    findById: vi.fn<(foodId: string) => MatchSourceFood | null>((foodId) => entries[foodId] ?? null),
  };
}

const kirsch: FoodEntry = {
  id: 'kirschtomaten',
  name: 'Kirschtomaten',
  synonyms: [],
  unit: 'g',
  macrosPer100: { calories: 20, protein: 0.9, carbs: 3.9, fat: 0.2 },
};

describe('confirmResolution — new-food', () => {
  it('persists the entry and returns a matched row with original amount and per-unit macros', async () => {
    const overlay = makeOverlay();
    const deps: ConfirmResolutionDeps = { overlay, curated: makeCurated({}) };

    const result = await confirmResolution(deps, {
      kind: 'new-food',
      entry: kirsch,
      original: { amount: 50, unit: 'g' },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(overlay.addFood).toHaveBeenCalledWith(kirsch);
    expect(result.ingredient).toMatchObject({
      matched: true,
      name: 'Kirschtomaten',
      unit: 'g',
      amount: 50,
      source: 'USER',
    });
    expect(result.ingredient.macrosPerUnit.calories).toBeCloseTo(0.2);
    expect(result.ingredient.macrosPerUnit.protein).toBeCloseTo(0.009);
  });

  it('preserves the note', async () => {
    const overlay = makeOverlay();
    const result = await confirmResolution(
      { overlay, curated: makeCurated({}) },
      { kind: 'new-food', entry: kirsch, original: { amount: 50, unit: 'g', note: 'halbiert' } },
    );
    expect(result.ok && result.ingredient.note).toBe('halbiert');
  });

  it('populates displayQuantity for an untracked entry with no amount', async () => {
    const overlay = makeOverlay();
    const untracked: FoodEntry = {
      id: 'sumach',
      name: 'Sumach',
      synonyms: [],
      unit: 'g',
      macrosPer100: { calories: 0, protein: 0, carbs: 0, fat: 0 },
      untracked: true,
    };
    const result = await confirmResolution(
      { overlay, curated: makeCurated({}) },
      { kind: 'new-food', entry: untracked, original: { amount: null, rawDisplayUnitLabel: 'Prise' } },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ingredient.untracked).toBe(true);
    expect(result.ingredient.amount).toBe(0);
    expect(result.ingredient.displayQuantity).toEqual({ amount: 1, unitLabel: 'Prise' });
  });

  it('rejects an invalid entry with 422 and does not persist', async () => {
    const overlay = makeOverlay();
    const result = await confirmResolution(
      { overlay, curated: makeCurated({}) },
      { kind: 'new-food', entry: { ...kirsch, untracked: true }, original: { amount: 50, unit: 'g' } },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(422);
    expect(overlay.addFood).not.toHaveBeenCalled();
  });

  it('rejects a 409 collision with a curated food id and does not persist', async () => {
    const overlay = makeOverlay();
    const curated = makeCurated({
      kirschtomaten: {
        name: 'Kirschtomaten',
        unit: 'g',
        macrosPerUnit: { calories: 0.2, protein: 0, carbs: 0, fat: 0 },
      },
    });
    const result = await confirmResolution(
      { overlay, curated },
      { kind: 'new-food', entry: kirsch, original: { amount: 50 } },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(409);
    expect(overlay.addFood).not.toHaveBeenCalled();
  });

  it('rejects a 409 collision with an existing overlay folded name', async () => {
    const overlay = makeOverlay({ foods: [{ ...kirsch, id: 'other', name: 'kirschtomaten' }], synonyms: [] });
    const result = await confirmResolution(
      { overlay, curated: makeCurated({}) },
      { kind: 'new-food', entry: kirsch, original: { amount: 50 } },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(409);
  });
});

describe('confirmResolution — synonym', () => {
  it('records the synonym, registers it on the curated index, and returns the curated row', async () => {
    const overlay = makeOverlay();
    const curated = makeCurated({
      oliven: { name: 'Oliven', unit: 'g', macrosPerUnit: { calories: 1.45, protein: 0.01, carbs: 0.06, fat: 0.15 } },
    });
    const result = await confirmResolution(
      { overlay, curated },
      {
        kind: 'synonym',
        foodId: 'oliven',
        synonym: 'grüne Oliven',
        original: { amount: 25, unit: 'g', note: 'große' },
      },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(overlay.addSynonym).toHaveBeenCalledWith({ foodId: 'oliven', synonym: 'grüne Oliven' });
    expect(curated.added).toEqual([['oliven', 'grüne Oliven']]);
    expect(result.ingredient).toMatchObject({ name: 'Oliven', unit: 'g', amount: 25, note: 'große', source: 'FOODS' });
  });

  it('rejects a synonym whose foodId is unknown to the curated index', async () => {
    const overlay = makeOverlay();
    const result = await confirmResolution(
      { overlay, curated: makeCurated({}) },
      { kind: 'synonym', foodId: 'ghost', synonym: 'x', original: { amount: 1 } },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(422);
    expect(overlay.addSynonym).not.toHaveBeenCalled();
  });
});
