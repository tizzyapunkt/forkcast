import { describe, it, expect, vi } from 'vitest';
import { logRecipe } from './log-recipe.use-case.ts';
import type { LogEntryRepository } from './log-entry.repository.ts';
import type { LogEntry } from './types.ts';
import type { RecipeRepository } from '../recipes/recipe.repository.ts';
import type { Recipe } from '../recipes/types.ts';

const baseRecipe: Recipe = {
  id: 'rec-1',
  name: 'Bolognese',
  yield: 4,
  ingredients: [
    { name: 'Rice', unit: 'g', macrosPerUnit: { calories: 1.3, protein: 0.027, carbs: 0.28, fat: 0.003 }, amount: 200 },
    { name: 'Beef', unit: 'g', macrosPerUnit: { calories: 2.5, protein: 0.26, carbs: 0, fat: 0.15 }, amount: 100 },
  ],
  steps: [],
  createdAt: '2026-04-01T00:00:00.000Z',
  updatedAt: '2026-04-01T00:00:00.000Z',
};

const makeRecipeRepo = (recipe: Recipe | null): RecipeRepository => ({
  save: vi.fn<(r: Recipe) => Promise<void>>(),
  findAll: vi.fn<() => Promise<Recipe[]>>(),
  findById: vi.fn<(id: string) => Promise<Recipe | null>>().mockResolvedValue(recipe),
  update: vi.fn<(r: Recipe) => Promise<void>>(),
  remove: vi.fn<(id: string) => Promise<void>>(),
});

const makeLogRepo = (
  opts: { saveManyImpl?: (entries: LogEntry[]) => Promise<void> } = {},
): { repo: LogEntryRepository; saved: LogEntry[][] } => {
  const saved: LogEntry[][] = [];
  return {
    saved,
    repo: {
      save: vi.fn<(e: LogEntry) => Promise<void>>(),
      saveMany: vi.fn<(entries: LogEntry[]) => Promise<void>>().mockImplementation(
        opts.saveManyImpl ??
          (async (entries) => {
            saved.push(entries);
          }),
      ),
      findAll: vi.fn<() => Promise<LogEntry[]>>(),
      findByDate: vi.fn<(date: string) => Promise<LogEntry[]>>(),
      findById: vi.fn<(id: string) => Promise<LogEntry | null>>(),
      update: vi.fn<(e: LogEntry) => Promise<void>>(),
      remove: vi.fn<(id: string) => Promise<void>>(),
    },
  };
};

describe('logRecipe', () => {
  it('produces one LogEntry per recipe ingredient, scaled by portions/yield', async () => {
    const recipeRepo = makeRecipeRepo(baseRecipe);
    const { repo: logRepo, saved } = makeLogRepo();

    const result = await logRecipe(recipeRepo, logRepo, {
      recipeId: 'rec-1',
      portions: 2,
      date: '2026-04-28',
      slot: 'lunch',
    });

    expect(result).toHaveLength(2);
    expect(saved).toHaveLength(1);
    expect(saved[0]).toEqual(result);

    const [rice, beef] = result;
    if (rice?.ingredient.type !== 'full' || beef?.ingredient.type !== 'full') throw new Error('expected full');
    expect(rice.ingredient.amount).toBe(100); // 200 * 2/4
    expect(beef.ingredient.amount).toBe(50); // 100 * 2/4
    expect(rice.ingredient.name).toBe('Rice');
    expect(beef.ingredient.name).toBe('Beef');
    expect(rice.recipeId).toBe('rec-1');
    expect(beef.recipeId).toBe('rec-1');
    expect(rice.date).toBe('2026-04-28');
    expect(rice.slot).toBe('lunch');
  });

  it('copies macrosPerUnit verbatim (no scaling on per-unit macros)', async () => {
    const recipeRepo = makeRecipeRepo(baseRecipe);
    const { repo: logRepo } = makeLogRepo();

    const result = await logRecipe(recipeRepo, logRepo, {
      recipeId: 'rec-1',
      portions: 2,
      date: '2026-04-28',
      slot: 'lunch',
    });

    if (result[0]?.ingredient.type !== 'full') throw new Error('expected full');
    expect(result[0].ingredient.macrosPerUnit).toEqual(baseRecipe.ingredients[0]?.macrosPerUnit);
  });

  it('handles non-integer portions', async () => {
    const recipe: Recipe = {
      ...baseRecipe,
      yield: 3,
      ingredients: [
        { name: 'Rice', unit: 'g', macrosPerUnit: { calories: 1.3, protein: 0, carbs: 0, fat: 0 }, amount: 300 },
      ],
    };
    const recipeRepo = makeRecipeRepo(recipe);
    const { repo: logRepo } = makeLogRepo();

    const result = await logRecipe(recipeRepo, logRepo, {
      recipeId: 'rec-1',
      portions: 1,
      date: '2026-04-28',
      slot: 'lunch',
    });

    if (result[0]?.ingredient.type !== 'full') throw new Error('expected full');
    expect(result[0].ingredient.amount).toBe(100);
  });

  it('assigns unique ids and a loggedAt to each produced entry', async () => {
    const recipeRepo = makeRecipeRepo(baseRecipe);
    const { repo: logRepo } = makeLogRepo();

    const result = await logRecipe(recipeRepo, logRepo, {
      recipeId: 'rec-1',
      portions: 1,
      date: '2026-04-28',
      slot: 'lunch',
    });

    expect(new Set(result.map((e) => e.id)).size).toBe(result.length);
    for (const e of result) expect(e.loggedAt).toBeTruthy();
  });

  it('rejects unknown recipe and persists nothing', async () => {
    const recipeRepo = makeRecipeRepo(null);
    const { repo: logRepo, saved } = makeLogRepo();

    await expect(
      logRecipe(recipeRepo, logRepo, { recipeId: 'missing', portions: 1, date: '2026-04-28', slot: 'lunch' }),
    ).rejects.toThrow(/not found/i);
    expect(saved).toEqual([]);
    expect(logRepo.saveMany).not.toHaveBeenCalled();
  });

  it('rejects non-positive portions and persists nothing', async () => {
    const recipeRepo = makeRecipeRepo(baseRecipe);
    const { repo: logRepo, saved } = makeLogRepo();

    await expect(
      logRecipe(recipeRepo, logRepo, { recipeId: 'rec-1', portions: 0, date: '2026-04-28', slot: 'lunch' }),
    ).rejects.toThrow(/portions/i);
    await expect(
      logRecipe(recipeRepo, logRepo, { recipeId: 'rec-1', portions: -2, date: '2026-04-28', slot: 'lunch' }),
    ).rejects.toThrow(/portions/i);
    expect(saved).toEqual([]);
  });

  it('does not write partially when saveMany rejects', async () => {
    const recipeRepo = makeRecipeRepo(baseRecipe);
    const { repo: logRepo } = makeLogRepo({
      saveManyImpl: async () => {
        throw new Error('disk full');
      },
    });

    await expect(
      logRecipe(recipeRepo, logRepo, { recipeId: 'rec-1', portions: 2, date: '2026-04-28', slot: 'lunch' }),
    ).rejects.toThrow('disk full');
    expect(logRepo.save).not.toHaveBeenCalled();
  });
});
