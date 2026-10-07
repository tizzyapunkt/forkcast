import { describe, it, expect } from 'vite-plus/test';
import { readFileSync } from 'node:fs';
import type { FoodEntry } from '../../domain/foods/types.ts';
import { fold } from '../../domain/ingredient-search/fold.ts';
import { findCatalogCollision, validateCatalogEntry } from '../../domain/food-catalog/validate-catalog-entry.ts';

/** The tracked starting point a fresh data directory is seeded from. */
const SEED_URL = new URL('../../../data/catalog.json', import.meta.url);
const seed = JSON.parse(readFileSync(SEED_URL, 'utf-8')) as FoodEntry[];

describe('bundled catalog seed', () => {
  it('gives every entry a non-blank English name', () => {
    const missing = seed.filter((e) => typeof e.nameEn !== 'string' || e.nameEn.trim().length === 0).map((e) => e.id);
    expect(missing).toEqual([]);
  });

  it('never gives two entries the same English name', () => {
    const byName = new Map<string, string[]>();
    for (const e of seed) {
      if (typeof e.nameEn !== 'string') continue;
      const key = fold(e.nameEn);
      byName.set(key, [...(byName.get(key) ?? []), e.id]);
    }
    expect([...byName.values()].filter((ids) => ids.length > 1)).toEqual([]);
  });

  it('loads in full: every entry is valid and none collides with another', () => {
    const rejected: string[] = [];
    const loaded: FoodEntry[] = [];
    for (const e of seed) {
      const result = validateCatalogEntry(e);
      const reason = result.ok ? findCatalogCollision(loaded, e) : result.reason;
      if (reason === null) loaded.push(e);
      else rejected.push(`${e.id}: ${reason}`);
    }
    expect(rejected).toEqual([]);
  });
});
