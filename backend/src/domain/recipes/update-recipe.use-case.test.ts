import { describe, it, expect, vi } from 'vitest';
import { updateRecipe } from './update-recipe.use-case.ts';
import type { RecipeRepository } from './recipe.repository.ts';
import type { Recipe } from './types.ts';

const base: Recipe = {
  id: 'rec-1',
  name: 'Oats Bowl',
  yield: 1,
  ingredients: [
    { name: 'Oats', unit: 'g', macrosPerUnit: { calories: 3.7, protein: 0.13, carbs: 0.66, fat: 0.07 }, amount: 80 },
  ],
  steps: ['cook'],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const makeRepo = (existing: Recipe | null): { repo: RecipeRepository; saved: Recipe[] } => {
  const saved: Recipe[] = [];
  return {
    saved,
    repo: {
      save: vi.fn<(r: Recipe) => Promise<void>>(),
      findAll: vi.fn<() => Promise<Recipe[]>>(),
      findById: vi.fn<(id: string) => Promise<Recipe | null>>().mockResolvedValue(existing),
      update: vi.fn<(r: Recipe) => Promise<void>>().mockImplementation(async (r) => {
        saved.push(r);
      }),
      remove: vi.fn<(id: string) => Promise<void>>(),
    },
  };
};

describe('updateRecipe', () => {
  it('renames a recipe and advances updatedAt', async () => {
    const { repo, saved } = makeRepo(base);
    const updated = await updateRecipe(repo, { id: 'rec-1', name: 'Rocket Bowl' });
    expect(updated.name).toBe('Rocket Bowl');
    expect(updated.yield).toBe(1);
    expect(updated.updatedAt).not.toBe(base.updatedAt);
    expect(updated.createdAt).toBe(base.createdAt);
    expect(saved).toEqual([updated]);
  });

  it('updates yield and ingredients atomically', async () => {
    const { repo, saved } = makeRepo(base);
    const newIngredients = [
      {
        name: 'Beef',
        unit: 'g' as const,
        macrosPerUnit: { calories: 2.5, protein: 0.26, carbs: 0, fat: 0.15 },
        amount: 200,
      },
    ];
    const updated = await updateRecipe(repo, { id: 'rec-1', yield: 2, ingredients: newIngredients });
    expect(updated.yield).toBe(2);
    expect(updated.ingredients).toEqual(newIngredients);
    expect(saved).toEqual([updated]);
  });

  it('throws and does not save on missing recipe', async () => {
    const { repo, saved } = makeRepo(null);
    await expect(updateRecipe(repo, { id: 'missing', name: 'x' })).rejects.toThrow(/not found/i);
    expect(saved).toEqual([]);
  });

  it('rejects yield <= 0', async () => {
    const { repo, saved } = makeRepo(base);
    await expect(updateRecipe(repo, { id: 'rec-1', yield: 0 })).rejects.toThrow(/yield/i);
    expect(saved).toEqual([]);
  });

  it('rejects empty ingredients update', async () => {
    const { repo, saved } = makeRepo(base);
    await expect(updateRecipe(repo, { id: 'rec-1', ingredients: [] })).rejects.toThrow(/at least one ingredient/i);
    expect(saved).toEqual([]);
  });

  it('rejects empty name update', async () => {
    const { repo, saved } = makeRepo(base);
    await expect(updateRecipe(repo, { id: 'rec-1', name: '   ' })).rejects.toThrow(/name/i);
    expect(saved).toEqual([]);
  });

  it('leaves omitted fields unchanged', async () => {
    const { repo } = makeRepo(base);
    const updated = await updateRecipe(repo, { id: 'rec-1', name: 'New name' });
    expect(updated.ingredients).toEqual(base.ingredients);
    expect(updated.steps).toEqual(base.steps);
    expect(updated.yield).toBe(base.yield);
  });

  it('updates ingredients with a piece quantity', async () => {
    const { repo, saved } = makeRepo(base);
    const onion = {
      name: 'Zwiebel',
      unit: 'g' as const,
      macrosPerUnit: { calories: 0.4, protein: 0.011, carbs: 0.093, fat: 0.001 },
      amount: 300,
      pieceQuantity: { amount: 2, unitLabel: 'Zwiebel', gramsPerPiece: 150 },
    };
    const updated = await updateRecipe(repo, { id: 'rec-1', ingredients: [onion] });
    expect(updated.ingredients[0]?.pieceQuantity).toEqual({ amount: 2, unitLabel: 'Zwiebel', gramsPerPiece: 150 });
    expect(saved).toEqual([updated]);
  });

  it('rejects update with inconsistent pieceQuantity', async () => {
    const { repo, saved } = makeRepo(base);
    const bad = {
      name: 'Zwiebel',
      unit: 'g' as const,
      macrosPerUnit: { calories: 0.4, protein: 0.011, carbs: 0.093, fat: 0.001 },
      amount: 200,
      pieceQuantity: { amount: 1, unitLabel: 'Zwiebel', gramsPerPiece: 150 },
    };
    await expect(updateRecipe(repo, { id: 'rec-1', ingredients: [bad] })).rejects.toThrow(
      /pieceQuantity|does not match/i,
    );
    expect(saved).toEqual([]);
  });

  it('passes legacy recipes (no pieceQuantity) through unchanged', async () => {
    const { repo } = makeRepo(base);
    const updated = await updateRecipe(repo, { id: 'rec-1', name: 'Renamed' });
    expect(updated.ingredients[0]?.pieceQuantity).toBeUndefined();
  });

  it('updates ingredients with the untracked flag', async () => {
    const { repo, saved } = makeRepo(base);
    const ingredients = [
      {
        name: 'Oats',
        unit: 'g' as const,
        macrosPerUnit: { calories: 3.7, protein: 0.13, carbs: 0.66, fat: 0.07 },
        amount: 80,
      },
      {
        name: 'Salz',
        unit: 'g' as const,
        macrosPerUnit: { calories: 0, protein: 0, carbs: 0, fat: 0 },
        amount: 5,
        untracked: true,
      },
    ];
    const updated = await updateRecipe(repo, { id: 'rec-1', ingredients });
    expect(updated.ingredients[0]?.untracked).toBeUndefined();
    expect(updated.ingredients[1]?.untracked).toBe(true);
    expect(saved).toEqual([updated]);
  });

  it('preserves untracked flag when toggling rows in subsequent updates', async () => {
    const seeded: Recipe = {
      ...base,
      ingredients: [
        { ...base.ingredients[0]! },
        {
          name: 'Salz',
          unit: 'g',
          macrosPerUnit: { calories: 0, protein: 0, carbs: 0, fat: 0 },
          amount: 5,
          untracked: true,
        },
      ],
    };
    const { repo, saved } = makeRepo(seeded);
    const ingredients = seeded.ingredients.map((i) => ({ ...i, untracked: !i.untracked }));
    const updated = await updateRecipe(repo, { id: 'rec-1', ingredients });
    expect(updated.ingredients[0]?.untracked).toBe(true);
    expect(updated.ingredients[1]?.untracked).toBe(false);
    expect(saved).toEqual([updated]);
  });

  it('passes legacy recipes (no untracked field) through unchanged when other fields change', async () => {
    const { repo } = makeRepo(base);
    const updated = await updateRecipe(repo, { id: 'rec-1', name: 'Renamed' });
    expect(updated.ingredients[0]?.untracked).toBeUndefined();
  });
});
