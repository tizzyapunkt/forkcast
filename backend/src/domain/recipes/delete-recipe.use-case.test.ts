import { describe, it, expect, vi } from 'vitest';
import { deleteRecipe } from './delete-recipe.use-case.ts';
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

const makeRepo = (existing: Recipe | null): RecipeRepository => ({
  save: vi.fn<(r: Recipe) => Promise<void>>(),
  findAll: vi.fn<() => Promise<Recipe[]>>(),
  findById: vi.fn<(id: string) => Promise<Recipe | null>>().mockResolvedValue(existing),
  update: vi.fn<(r: Recipe) => Promise<void>>(),
  remove: vi.fn<(id: string) => Promise<void>>().mockResolvedValue(undefined),
});

describe('deleteRecipe', () => {
  it('removes an existing recipe', async () => {
    const repo = makeRepo(sample);
    await deleteRecipe(repo, 'rec-1');
    expect(repo.remove).toHaveBeenCalledWith('rec-1');
  });

  it('throws when the recipe does not exist', async () => {
    const repo = makeRepo(null);
    await expect(deleteRecipe(repo, 'missing')).rejects.toThrow(/not found/i);
    expect(repo.remove).not.toHaveBeenCalled();
  });
});
