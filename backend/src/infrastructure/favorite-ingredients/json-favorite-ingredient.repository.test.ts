import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JsonFavoriteIngredientRepository } from './json-favorite-ingredient.repository.ts';
import type { FavoriteIngredient } from '../../domain/favorite-ingredients/types.ts';

const tmpDirs: string[] = [];

afterEach(() => {
  while (tmpDirs.length) {
    const dir = tmpDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

function freshFile(): string {
  const dir = mkdtempSync(join(tmpdir(), 'forkcast-favorites-'));
  tmpDirs.push(dir);
  return join(dir, 'favorite-ingredients.json');
}

const macros = { calories: 0.63, protein: 0.11, carbs: 0.04, fat: 0.002 };

function favorite(name: string, unit: FavoriteIngredient['unit'] = 'g'): FavoriteIngredient {
  return { name, unit, macrosPerUnit: macros, favoritedAt: '2026-01-01T08:00:00.000Z' };
}

describe('JsonFavoriteIngredientRepository', () => {
  it('reads a missing file as an empty list', async () => {
    const repo = new JsonFavoriteIngredientRepository(freshFile());

    expect(await repo.findAll()).toEqual([]);
  });

  it('appends a favorite whose identity is new', async () => {
    const repo = new JsonFavoriteIngredientRepository(freshFile());
    await repo.init();

    await repo.upsert(favorite('Skyr'));
    await repo.upsert(favorite('Haferflocken'));

    expect((await repo.findAll()).map((f) => f.name)).toEqual(['Skyr', 'Haferflocken']);
  });

  it('replaces in place when the identity already exists', async () => {
    const repo = new JsonFavoriteIngredientRepository(freshFile());
    await repo.init();
    await repo.upsert(favorite('Skyr'));
    await repo.upsert(favorite('Haferflocken'));

    await repo.upsert({ ...favorite('skyr'), macrosPerUnit: { ...macros, calories: 0.7 } });

    const all = await repo.findAll();
    expect(all).toHaveLength(2);
    expect(all[0]).toMatchObject({ name: 'skyr', macrosPerUnit: { calories: 0.7 } });
    expect(all[1]?.name).toBe('Haferflocken');
  });

  it('keeps the same name under a different unit separate', async () => {
    const repo = new JsonFavoriteIngredientRepository(freshFile());
    await repo.init();

    await repo.upsert(favorite('Milch', 'ml'));
    await repo.upsert(favorite('Milch', 'g'));

    expect(await repo.findAll()).toHaveLength(2);
  });

  it('removes by case-insensitive name and unit', async () => {
    const repo = new JsonFavoriteIngredientRepository(freshFile());
    await repo.init();
    await repo.upsert(favorite('Skyr'));

    await repo.remove('sKyR', 'g');

    expect(await repo.findAll()).toEqual([]);
  });

  it('is a no-op when removing an absent identity', async () => {
    const repo = new JsonFavoriteIngredientRepository(freshFile());
    await repo.init();
    await repo.upsert(favorite('Skyr'));

    await repo.remove('Quark', 'g');

    expect((await repo.findAll()).map((f) => f.name)).toEqual(['Skyr']);
  });

  it('survives a reload from disk', async () => {
    const path = freshFile();
    const repo = new JsonFavoriteIngredientRepository(path);
    await repo.init();
    await repo.upsert({ ...favorite('Salz'), untracked: true });

    const reloaded = await new JsonFavoriteIngredientRepository(path).findAll();

    expect(reloaded).toEqual([{ ...favorite('Salz'), untracked: true }]);
  });
});
