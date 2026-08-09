import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JsonCatalogStore } from './json-catalog.store.ts';
import { migrateUserFoodsOverlay } from './migrate-user-foods-overlay.ts';
import type { FoodEntry } from '../../domain/foods/types.ts';

const cherrytomate: FoodEntry = {
  id: 'cherrytomate',
  name: 'Cherrytomate',
  synonyms: ['cherry tomato'],
  unit: 'g',
  macrosPer100: { calories: 18, protein: 0.9, carbs: 3.9, fat: 0.2 },
};

const overlayContent = {
  foods: [
    {
      id: 'balsamicoessig',
      name: 'Balsamicoessig',
      synonyms: ['Balsamico-Essig'],
      unit: 'ml',
      macrosPer100: { calories: 88, protein: 0, carbs: 17, fat: 0 },
    },
  ],
  synonyms: [{ foodId: 'cherrytomate', synonym: 'Kirschtomaten' }],
};

describe('migrateUserFoodsOverlay', () => {
  let dir: string;
  let catalogPath: string;
  let overlayPath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'forkcast-migrate-'));
    catalogPath = join(dir, 'catalog.json');
    overlayPath = join(dir, 'user-foods.json');
    writeFileSync(catalogPath, JSON.stringify([cherrytomate], null, 2) + '\n', 'utf-8');
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  const openStore = async () => {
    const store = new JsonCatalogStore({ filePath: catalogPath });
    await store.init();
    return store;
  };

  it('folds overlay foods and synonyms into the catalog and retires the legacy file', async () => {
    writeFileSync(overlayPath, JSON.stringify(overlayContent, null, 2) + '\n', 'utf-8');
    const store = await openStore();

    const result = await migrateUserFoodsOverlay(store, overlayPath);

    expect(result.migrated).toBe(true);
    expect(store.list().map((e) => e.id)).toEqual(['balsamicoessig', 'cherrytomate']);
    expect(store.findById('cherrytomate')?.synonyms).toEqual(['cherry tomato', 'Kirschtomaten']);
    expect(existsSync(overlayPath)).toBe(false);

    const persisted = JSON.parse(readFileSync(catalogPath, 'utf-8')) as FoodEntry[];
    expect(persisted.map((e) => e.id)).toEqual(['balsamicoessig', 'cherrytomate']);
  });

  it('is a no-op when no legacy file is present', async () => {
    const store = await openStore();
    const before = readFileSync(catalogPath, 'utf-8');

    const result = await migrateUserFoodsOverlay(store, overlayPath);

    expect(result.migrated).toBe(false);
    expect(readFileSync(catalogPath, 'utf-8')).toBe(before);
  });

  it('does not run again on the next boot', async () => {
    writeFileSync(overlayPath, JSON.stringify(overlayContent, null, 2) + '\n', 'utf-8');
    const first = await openStore();
    await migrateUserFoodsOverlay(first, overlayPath);
    const afterFirst = readFileSync(catalogPath, 'utf-8');

    const second = await openStore();
    const result = await migrateUserFoodsOverlay(second, overlayPath);

    expect(result.migrated).toBe(false);
    expect(readFileSync(catalogPath, 'utf-8')).toBe(afterFirst);
    expect(second.findById('cherrytomate')?.synonyms).toEqual(['cherry tomato', 'Kirschtomaten']);
    expect(second.list().filter((e) => e.id === 'balsamicoessig')).toHaveLength(1);
  });

  it('warns about an orphaned synonym but still migrates the rest', async () => {
    writeFileSync(
      overlayPath,
      JSON.stringify({ foods: [], synonyms: [{ foodId: 'weg', synonym: 'egal' }] }, null, 2),
      'utf-8',
    );
    const store = await openStore();

    const result = await migrateUserFoodsOverlay(store, overlayPath);

    expect(result.migrated).toBe(true);
    expect(result.warnings).toEqual([expect.stringContaining('weg')]);
    expect(existsSync(overlayPath)).toBe(false);
  });

  it('keeps an unparseable legacy file in place instead of discarding it', async () => {
    writeFileSync(overlayPath, '{ not json', 'utf-8');
    const store = await openStore();

    const result = await migrateUserFoodsOverlay(store, overlayPath);

    expect(result.migrated).toBe(false);
    expect(existsSync(overlayPath)).toBe(true);
    expect(store.list().map((e) => e.id)).toEqual(['cherrytomate']);
  });
});
