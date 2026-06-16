import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JsonUserFoodsStore } from './json-user-foods.store.ts';
import type { FoodEntry } from '../../domain/foods/types.ts';

const food = (over: Partial<FoodEntry> = {}): FoodEntry => ({
  id: 'kirschtomaten',
  name: 'Kirschtomaten',
  synonyms: ['Cocktailtomaten'],
  unit: 'g',
  macrosPer100: { calories: 20, protein: 0.9, carbs: 3.9, fat: 0.2 },
  ...over,
});

describe('JsonUserFoodsStore', () => {
  let dir: string;
  let filePath: string;
  let store: JsonUserFoodsStore;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'user-foods-'));
    filePath = join(dir, 'user-foods.json');
    store = new JsonUserFoodsStore(filePath);
    await store.init();
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('treats a missing file as an empty overlay', async () => {
    expect(existsSync(filePath)).toBe(false);
    expect(await store.load()).toEqual({ foods: [], synonyms: [] });
  });

  it('persists an added food and reloads it', async () => {
    await store.addFood(food());
    const reloaded = await new JsonUserFoodsStore(filePath).load();
    expect(reloaded.foods).toEqual([food()]);
  });

  it('rejects an invalid food without writing', async () => {
    await expect(store.addFood(food({ untracked: true }))).rejects.toThrow(/untracked/);
    expect(await store.load()).toEqual({ foods: [], synonyms: [] });
  });

  it('rejects an overlay-internal collision', async () => {
    await store.addFood(food());
    await expect(store.addFood(food({ name: 'Andere', synonyms: [] }))).rejects.toThrow(/already/i);
  });

  it('persists a learned synonym and dedups repeats', async () => {
    await store.addSynonym({ foodId: 'oliven', synonym: 'grüne Oliven' });
    await store.addSynonym({ foodId: 'oliven', synonym: 'Grüne Oliven' });
    expect((await store.load()).synonyms).toEqual([{ foodId: 'oliven', synonym: 'grüne Oliven' }]);
  });

  it('exportAndClear returns content and empties the store atomically', async () => {
    await store.addFood(food());
    await store.addSynonym({ foodId: 'oliven', synonym: 'grüne Oliven' });
    const exported = await store.exportAndClear();
    expect(exported.foods).toHaveLength(1);
    expect(exported.synonyms).toHaveLength(1);
    expect(await store.load()).toEqual({ foods: [], synonyms: [] });
  });

  it('treats malformed JSON as empty rather than crashing', async () => {
    await writeFile(filePath, '{ not json', 'utf-8');
    expect(await store.load()).toEqual({ foods: [], synonyms: [] });
  });

  it('writes pretty JSON ending in a trailing newline', async () => {
    await store.addFood(food());
    const raw = await readFile(filePath, 'utf-8');
    expect(raw.endsWith('\n')).toBe(true);
    expect(raw).toContain('\n  "foods"');
  });

  it('serialises concurrent writes without losing entries', async () => {
    await Promise.all([
      store.addFood(food({ id: 'a', name: 'Aaa', synonyms: [] })),
      store.addFood(food({ id: 'b', name: 'Bbb', synonyms: [] })),
      store.addSynonym({ foodId: 'oliven', synonym: 'grün' }),
    ]);
    const loaded = await store.load();
    expect(loaded.foods).toHaveLength(2);
    expect(loaded.synonyms).toHaveLength(1);
  });
});
