import { describe, it, expect } from 'vitest';
import { unfavoriteIngredient } from './unfavorite-ingredient.use-case.ts';
import { FakeFavoriteIngredientRepository } from './favorite-ingredient.repository.fake.ts';
import type { FavoriteIngredient } from './types.ts';

const macros = { calories: 0.63, protein: 0.11, carbs: 0.04, fat: 0.002 };

function favorite(name: string, unit: FavoriteIngredient['unit'] = 'g'): FavoriteIngredient {
  return { name, unit, macrosPerUnit: macros, favoritedAt: '2026-01-01T08:00:00.000Z' };
}

describe('unfavoriteIngredient', () => {
  it('removes the favorite matching name and unit', async () => {
    const repo = new FakeFavoriteIngredientRepository([favorite('Skyr'), favorite('Haferflocken')]);

    await unfavoriteIngredient(repo, { name: 'Skyr', unit: 'g' });

    expect(await repo.findAll()).toEqual([favorite('Haferflocken')]);
  });

  it('matches the name case-insensitively', async () => {
    const repo = new FakeFavoriteIngredientRepository([favorite('Skyr')]);

    await unfavoriteIngredient(repo, { name: 'sKyR', unit: 'g' });

    expect(await repo.findAll()).toEqual([]);
  });

  it('leaves the same name under another unit alone', async () => {
    const repo = new FakeFavoriteIngredientRepository([favorite('Milch', 'ml'), favorite('Milch', 'g')]);

    await unfavoriteIngredient(repo, { name: 'Milch', unit: 'ml' });

    expect(await repo.findAll()).toEqual([favorite('Milch', 'g')]);
  });

  it('succeeds and changes nothing when the identity is not favorited', async () => {
    const repo = new FakeFavoriteIngredientRepository([favorite('Skyr')]);

    await expect(unfavoriteIngredient(repo, { name: 'Quark', unit: 'g' })).resolves.toBeUndefined();

    expect(await repo.findAll()).toEqual([favorite('Skyr')]);
  });

  it('rejects a malformed payload and leaves the set unchanged', async () => {
    const repo = new FakeFavoriteIngredientRepository([favorite('Skyr')]);

    await expect(unfavoriteIngredient(repo, { name: '  ', unit: 'g' })).rejects.toThrow(/invalid/i);

    expect(await repo.findAll()).toEqual([favorite('Skyr')]);
  });
});
