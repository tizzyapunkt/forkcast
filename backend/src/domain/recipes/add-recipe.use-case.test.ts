import { describe, it, expect, vi } from 'vitest';
import { addRecipe } from './add-recipe.use-case.ts';
import type { RecipeRepository } from './recipe.repository.ts';
import type { Recipe } from './types.ts';

const makeRepo = (): RecipeRepository => ({
  save: vi.fn<(r: Recipe) => Promise<void>>().mockResolvedValue(undefined),
  findAll: vi.fn<() => Promise<Recipe[]>>().mockResolvedValue([]),
  findById: vi.fn<(id: string) => Promise<Recipe | null>>().mockResolvedValue(null),
  update: vi.fn<(r: Recipe) => Promise<void>>().mockResolvedValue(undefined),
  remove: vi.fn<(id: string) => Promise<void>>().mockResolvedValue(undefined),
});

const validIngredient = {
  name: 'Oats',
  unit: 'g' as const,
  macrosPerUnit: { calories: 3.7, protein: 0.13, carbs: 0.66, fat: 0.07 },
  amount: 80,
};

describe('addRecipe', () => {
  it('persists a minimal recipe (one ingredient, no steps)', async () => {
    const repo = makeRepo();

    const recipe = await addRecipe(repo, {
      name: 'Oats Bowl',
      yield: 1,
      ingredients: [validIngredient],
      steps: [],
    });

    expect(recipe.id).toBeTruthy();
    expect(recipe.name).toBe('Oats Bowl');
    expect(recipe.yield).toBe(1);
    expect(recipe.ingredients).toHaveLength(1);
    expect(recipe.steps).toEqual([]);
    expect(recipe.createdAt).toBeTruthy();
    expect(recipe.updatedAt).toBe(recipe.createdAt);
    expect(repo.save).toHaveBeenCalledWith(recipe);
  });

  it('persists a recipe with multiple ingredients and steps in order', async () => {
    const repo = makeRepo();

    const recipe = await addRecipe(repo, {
      name: 'Bolognese',
      yield: 4,
      ingredients: [
        validIngredient,
        { ...validIngredient, name: 'Beef', macrosPerUnit: { calories: 2.5, protein: 0.26, carbs: 0, fat: 0.15 } },
      ],
      steps: ['Brown the beef', 'Add tomato', 'Simmer'],
    });

    expect(recipe.ingredients.map((i) => i.name)).toEqual(['Oats', 'Beef']);
    expect(recipe.steps).toEqual(['Brown the beef', 'Add tomato', 'Simmer']);
  });

  it('rejects empty name', async () => {
    const repo = makeRepo();
    await expect(addRecipe(repo, { name: '   ', yield: 1, ingredients: [validIngredient], steps: [] })).rejects.toThrow(
      /name/i,
    );
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('rejects empty ingredients list', async () => {
    const repo = makeRepo();
    await expect(addRecipe(repo, { name: 'X', yield: 1, ingredients: [], steps: [] })).rejects.toThrow(
      /at least one ingredient/i,
    );
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('rejects yield < 1', async () => {
    const repo = makeRepo();
    await expect(addRecipe(repo, { name: 'X', yield: 0, ingredients: [validIngredient], steps: [] })).rejects.toThrow(
      /yield/i,
    );
    await expect(addRecipe(repo, { name: 'X', yield: -1, ingredients: [validIngredient], steps: [] })).rejects.toThrow(
      /yield/i,
    );
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('rejects empty step strings', async () => {
    const repo = makeRepo();
    await expect(
      addRecipe(repo, { name: 'X', yield: 1, ingredients: [validIngredient], steps: ['ok', '   '] }),
    ).rejects.toThrow(/step/i);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('assigns a unique id per call', async () => {
    const repo = makeRepo();
    const a = await addRecipe(repo, { name: 'A', yield: 1, ingredients: [validIngredient], steps: [] });
    const b = await addRecipe(repo, { name: 'B', yield: 1, ingredients: [validIngredient], steps: [] });
    expect(a.id).not.toBe(b.id);
  });

  it('persists a recipe with a piece-tracked ingredient', async () => {
    const repo = makeRepo();
    const onion = {
      name: 'Zwiebel',
      unit: 'g' as const,
      macrosPerUnit: { calories: 0.4, protein: 0.011, carbs: 0.093, fat: 0.001 },
      amount: 150,
      pieceQuantity: { amount: 1, unitLabel: 'Zwiebel', gramsPerPiece: 150 },
    };
    const recipe = await addRecipe(repo, { name: 'Soup', yield: 1, ingredients: [onion], steps: [] });
    expect(recipe.ingredients[0]?.pieceQuantity).toEqual({ amount: 1, unitLabel: 'Zwiebel', gramsPerPiece: 150 });
    expect(repo.save).toHaveBeenCalledWith(recipe);
  });

  it('rejects an inconsistent piece-tracked ingredient', async () => {
    const repo = makeRepo();
    const inconsistent = {
      name: 'Zwiebel',
      unit: 'g' as const,
      macrosPerUnit: { calories: 0.4, protein: 0.011, carbs: 0.093, fat: 0.001 },
      amount: 200,
      pieceQuantity: { amount: 1, unitLabel: 'Zwiebel', gramsPerPiece: 150 },
    };
    await expect(addRecipe(repo, { name: 'Soup', yield: 1, ingredients: [inconsistent], steps: [] })).rejects.toThrow(
      /pieceQuantity|does not match/i,
    );
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('rejects piece-tracked ingredient with non-mass unit', async () => {
    const repo = makeRepo();
    const bad = {
      name: 'Olive Oil',
      unit: 'tbsp' as const,
      macrosPerUnit: { calories: 8.84, protein: 0, carbs: 0, fat: 1 },
      amount: 2,
      pieceQuantity: { amount: 2, unitLabel: 'tbsp', gramsPerPiece: 14 },
    };
    await expect(addRecipe(repo, { name: 'X', yield: 1, ingredients: [bad], steps: [] })).rejects.toThrow(/mass unit/i);
    expect(repo.save).not.toHaveBeenCalled();
  });
});
