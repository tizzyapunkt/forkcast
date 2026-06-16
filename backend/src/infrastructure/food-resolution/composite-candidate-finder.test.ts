import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CompositeResolutionCandidateFinder } from './composite-candidate-finder.ts';
import { InMemoryFoodsService } from '../ingredient-search/in-memory-foods.service.ts';
import { JsonUserFoodsStore } from '../user-foods/json-user-foods.store.ts';
import type { FoodEntry } from '../../domain/foods/types.ts';

const olive: FoodEntry = {
  id: 'olive',
  name: 'Grüne Olive',
  synonyms: [],
  unit: 'g',
  macrosPer100: { calories: 145, protein: 1, carbs: 6, fat: 15 },
};

describe('CompositeResolutionCandidateFinder', () => {
  let dir: string;
  let foods: InMemoryFoodsService;
  let overlay: JsonUserFoodsStore;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'cand-finder-'));
    await writeFile(join(dir, 'foods.json'), JSON.stringify([olive]), 'utf-8');
    foods = new InMemoryFoodsService(join(dir, 'foods.json'));
    await foods.init();
    overlay = new JsonUserFoodsStore(join(dir, 'user-foods.json'));
    await overlay.init();
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('surfaces a curated singular entry for a plural query (the grüne Oliven case)', async () => {
    const finder = new CompositeResolutionCandidateFinder(foods, overlay);
    const candidates = await finder.findCandidates('grüne Oliven', 8);
    expect(candidates.map((c) => c.id)).toContain('olive');
    expect(candidates[0]).toMatchObject({ id: 'olive', name: 'Grüne Olive', macrosPer100: { calories: 145 } });
  });

  it('includes overlay foods as candidates', async () => {
    await overlay.addFood({
      id: 'kirschtomaten',
      name: 'Kirschtomaten',
      synonyms: [],
      unit: 'g',
      macrosPer100: { calories: 20, protein: 0.9, carbs: 3.9, fat: 0.2 },
    });
    const finder = new CompositeResolutionCandidateFinder(foods, overlay);
    const candidates = await finder.findCandidates('Kirschtomate', 8);
    expect(candidates.map((c) => c.id)).toContain('kirschtomaten');
  });

  it('dedupes by id and caps at the limit', async () => {
    const finder = new CompositeResolutionCandidateFinder(foods, overlay);
    const candidates = await finder.findCandidates('grüne Oliven', 1);
    expect(candidates).toHaveLength(1);
  });

  it('returns nothing for an unrelated query', async () => {
    const finder = new CompositeResolutionCandidateFinder(foods, overlay);
    expect(await finder.findCandidates('Lachs', 8)).toEqual([]);
  });
});
