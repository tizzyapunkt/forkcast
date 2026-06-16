import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JsonUserFoodsStore } from './json-user-foods.store.ts';
import { UserFoodsSearchService } from './user-foods-search.service.ts';
import type { FoodEntry } from '../../domain/foods/types.ts';

const KIRSCH: FoodEntry = {
  id: 'kirschtomaten',
  name: 'Kirschtomaten',
  synonyms: ['Cocktailtomaten'],
  unit: 'g',
  macrosPer100: { calories: 20, protein: 0.9, carbs: 3.9, fat: 0.2 },
};

describe('UserFoodsSearchService', () => {
  let dir: string;
  let store: JsonUserFoodsStore;
  let svc: UserFoodsSearchService;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'user-foods-search-'));
    store = new JsonUserFoodsStore(join(dir, 'user-foods.json'));
    await store.init();
    svc = new UserFoodsSearchService(store);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('returns empty when the overlay is empty', async () => {
    expect(await svc.searchByName('kirsch')).toEqual([]);
  });

  it('finds an overlay food with source USER and per-unit macros', async () => {
    await store.addFood(KIRSCH);
    const results = await svc.searchByName('kirschtomaten');
    expect(results).toHaveLength(1);
    expect(results[0]!.source).toBe('USER');
    expect(results[0]!.name).toBe('Kirschtomaten');
    expect(results[0]!.macrosPerUnit.calories).toBeCloseTo(0.2);
  });

  it('finds a food added at runtime without re-instantiating the service', async () => {
    expect(await svc.searchByName('kirsch')).toEqual([]);
    await store.addFood(KIRSCH);
    expect(await svc.searchByName('kirsch')).toHaveLength(1);
  });

  it('matches diacritic-folded synonyms', async () => {
    await store.addFood({ ...KIRSCH, id: 'gruene-oliven', name: 'Grüne Oliven', synonyms: [] });
    expect(await svc.searchByName('grune oliven')).toHaveLength(1);
  });

  it('ignores queries shorter than 2 characters', async () => {
    await store.addFood(KIRSCH);
    expect(await svc.searchByName('k')).toEqual([]);
  });
});
