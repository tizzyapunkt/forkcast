import { describe, it, expect, vi } from 'vitest';
import { listRecipes } from './list-recipes.use-case.ts';
import type { RecipeRepository } from './recipe.repository.ts';
import type { Recipe } from './types.ts';

const r = (name: string): Recipe => ({
  id: name,
  name,
  yield: 1,
  ingredients: [{ name: 'x', unit: 'g', macrosPerUnit: { calories: 1, protein: 0, carbs: 0, fat: 0 }, amount: 100 }],
  steps: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

const makeRepo = (recipes: Recipe[]): RecipeRepository => ({
  save: vi.fn<(r: Recipe) => Promise<void>>(),
  findAll: vi.fn<() => Promise<Recipe[]>>().mockResolvedValue(recipes),
  findById: vi.fn<(id: string) => Promise<Recipe | null>>(),
  update: vi.fn<(r: Recipe) => Promise<void>>(),
  remove: vi.fn<(id: string) => Promise<void>>(),
});

describe('listRecipes', () => {
  it('returns an empty list when there are no recipes', async () => {
    const result = await listRecipes(makeRepo([]));
    expect(result).toEqual([]);
  });

  it('sorts by name case-insensitively', async () => {
    const result = await listRecipes(makeRepo([r('Bolognese'), r('Apple Pie'), r('carrot soup')]));
    expect(result.map((x) => x.name)).toEqual(['Apple Pie', 'Bolognese', 'carrot soup']);
  });

  it('does not mutate the input array', async () => {
    const inputs = [r('B'), r('A')];
    const before = inputs.map((x) => x.name).join(',');
    await listRecipes(makeRepo(inputs));
    expect(inputs.map((x) => x.name).join(',')).toBe(before);
  });
});
