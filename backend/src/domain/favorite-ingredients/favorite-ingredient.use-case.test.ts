import { describe, it, expect } from 'vitest';
import { favoriteIngredient } from './favorite-ingredient.use-case.ts';
import { FakeFavoriteIngredientRepository } from './favorite-ingredient.repository.fake.ts';
import type { FavoriteIngredient } from './types.ts';

const macros = { calories: 0.63, protein: 0.11, carbs: 0.04, fat: 0.002 };

function existing(overrides: Partial<FavoriteIngredient> = {}): FavoriteIngredient {
  return {
    name: 'Skyr',
    unit: 'g',
    macrosPerUnit: macros,
    favoritedAt: '2026-01-01T08:00:00.000Z',
    ...overrides,
  };
}

describe('favoriteIngredient', () => {
  it('stores a snapshot of the ingredient', async () => {
    const repo = new FakeFavoriteIngredientRepository();

    await favoriteIngredient(repo, { name: 'Skyr', unit: 'g', macrosPerUnit: macros });

    const [stored] = await repo.findAll();
    expect(stored).toMatchObject({ name: 'Skyr', unit: 'g', macrosPerUnit: macros });
    expect(stored?.favoritedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('carries the untracked flag into the snapshot', async () => {
    const repo = new FakeFavoriteIngredientRepository();

    await favoriteIngredient(repo, { name: 'Salz', unit: 'g', macrosPerUnit: macros, untracked: true });

    const [stored] = await repo.findAll();
    expect(stored?.untracked).toBe(true);
  });

  it('omits the untracked flag for a tracked ingredient', async () => {
    const repo = new FakeFavoriteIngredientRepository();

    await favoriteIngredient(repo, { name: 'Skyr', unit: 'g', macrosPerUnit: macros });

    const [stored] = await repo.findAll();
    expect(stored && 'untracked' in stored).toBe(false);
  });

  it('refreshes macros without duplicating and keeps the original favoritedAt', async () => {
    const repo = new FakeFavoriteIngredientRepository([existing()]);
    const refreshed = { calories: 0.7, protein: 0.12, carbs: 0.05, fat: 0.003 };

    await favoriteIngredient(repo, { name: 'Skyr', unit: 'g', macrosPerUnit: refreshed });

    const all = await repo.findAll();
    expect(all).toHaveLength(1);
    expect(all[0]?.macrosPerUnit).toEqual(refreshed);
    expect(all[0]?.favoritedAt).toBe('2026-01-01T08:00:00.000Z');
  });

  it('collapses casing differences onto one favorite, adopting the new name', async () => {
    const repo = new FakeFavoriteIngredientRepository([existing()]);

    await favoriteIngredient(repo, { name: 'skyr', unit: 'g', macrosPerUnit: macros });

    const all = await repo.findAll();
    expect(all).toHaveLength(1);
    expect(all[0]?.name).toBe('skyr');
  });

  it('keeps the same name under a different unit as a separate favorite', async () => {
    const repo = new FakeFavoriteIngredientRepository();

    await favoriteIngredient(repo, { name: 'Milch', unit: 'ml', macrosPerUnit: macros });
    await favoriteIngredient(repo, { name: 'Milch', unit: 'g', macrosPerUnit: macros });

    expect(await repo.findAll()).toHaveLength(2);
  });

  it.each([
    ['an empty name', { name: '  ', unit: 'g', macrosPerUnit: macros }],
    ['a unit outside g/ml', { name: 'Skyr', unit: 'kg', macrosPerUnit: macros }],
    ['a negative macro', { name: 'Skyr', unit: 'g', macrosPerUnit: { ...macros, calories: -1 } }],
    ['a non-finite macro', { name: 'Skyr', unit: 'g', macrosPerUnit: { ...macros, protein: Number.NaN } }],
  ])('rejects %s and leaves the set unchanged', async (_label, command) => {
    const repo = new FakeFavoriteIngredientRepository([existing()]);

    await expect(favoriteIngredient(repo, command as never)).rejects.toThrow(/invalid/i);

    expect(await repo.findAll()).toEqual([existing()]);
  });
});
