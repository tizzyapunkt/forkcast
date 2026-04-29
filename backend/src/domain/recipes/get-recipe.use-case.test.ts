import { describe, it, expect, vi } from 'vitest';
import { getRecipe } from './get-recipe.use-case.ts';
import type { RecipeRepository } from './recipe.repository.ts';
import type { Recipe } from './types.ts';

const sample: Recipe = {
  id: 'rec-1',
  name: 'Oats Bowl',
  yield: 1,
  ingredients: [
    { name: 'Oats', unit: 'g', macrosPerUnit: { calories: 3.7, protein: 0.13, carbs: 0.66, fat: 0.07 }, amount: 80 },
  ],
  steps: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const makeRepo = (found: Recipe | null): RecipeRepository => ({
  save: vi.fn<(r: Recipe) => Promise<void>>(),
  findAll: vi.fn<() => Promise<Recipe[]>>(),
  findById: vi.fn<(id: string) => Promise<Recipe | null>>().mockResolvedValue(found),
  update: vi.fn<(r: Recipe) => Promise<void>>(),
  remove: vi.fn<(id: string) => Promise<void>>(),
});

describe('getRecipe', () => {
  it('returns the recipe when found', async () => {
    const repo = makeRepo(sample);
    const result = await getRecipe(repo, 'rec-1');
    expect(result).toEqual(sample);
    expect(repo.findById).toHaveBeenCalledWith('rec-1');
  });

  it('returns null when not found', async () => {
    const repo = makeRepo(null);
    const result = await getRecipe(repo, 'missing');
    expect(result).toBeNull();
  });
});
