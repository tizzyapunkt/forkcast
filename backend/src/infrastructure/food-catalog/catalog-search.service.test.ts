import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { JsonCatalogStore } from './json-catalog.store.ts';
import { CatalogSearchService } from './catalog-search.service.ts';
import type { FoodEntry } from '../../domain/foods/types.ts';

const MOEHRE: FoodEntry = {
  id: 'moehre',
  name: 'Möhre',
  synonyms: ['Karotte', 'carrot'],
  unit: 'g',
  macrosPer100: { calories: 41, protein: 0.9, carbs: 9.6, fat: 0.2 },
  pieces: [{ label: 'mittel', grams: 75 }],
};

const KAESE: FoodEntry = {
  id: 'camembert',
  name: 'Käse, Camembert',
  synonyms: ['Camembert cheese'],
  unit: 'g',
  macrosPer100: { calories: 300, protein: 19, carbs: 1, fat: 24 },
};

const HAEHNCHEN: FoodEntry = {
  id: 'huehnchenbrust',
  name: 'Hähnchenbrust',
  synonyms: ['chicken breast', 'Hühnerbrust'],
  unit: 'g',
  macrosPer100: { calories: 114, protein: 23, carbs: 0, fat: 2 },
};

const OLIVENOEL: FoodEntry = {
  id: 'olivenoel',
  name: 'Olivenöl',
  synonyms: ['olive oil'],
  unit: 'ml',
  macrosPer100: { calories: 884, protein: 0, carbs: 0, fat: 100 },
};

const SALZ: FoodEntry = {
  id: 'salz',
  name: 'Salz',
  synonyms: ['salt'],
  unit: 'g',
  untracked: true,
  macrosPer100: { calories: 0, protein: 0, carbs: 0, fat: 0 },
};

describe('CatalogSearchService', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'forkcast-catalog-search-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  async function serviceWith(entries: FoodEntry[]): Promise<{ search: CatalogSearchService; store: JsonCatalogStore }> {
    const path = join(dir, `catalog-${Math.random().toString(36).slice(2)}.json`);
    writeFileSync(path, JSON.stringify(entries), 'utf-8');
    const store = new JsonCatalogStore({ filePath: path });
    await store.init();
    return { search: new CatalogSearchService(store), store };
  }

  describe('matching', () => {
    it('finds an entry by canonical name, case-insensitively', async () => {
      const { search } = await serviceWith([MOEHRE, KAESE, HAEHNCHEN, OLIVENOEL]);
      const results = await search.searchByName('MÖHRE');
      expect(results).toHaveLength(1);
      expect(results[0]!.name).toBe('Möhre');
    });

    it('folds diacritics on both sides of the comparison', async () => {
      const { search } = await serviceWith([MOEHRE, KAESE]);
      expect((await search.searchByName('mohre')).some((r) => r.id === 'moehre')).toBe(true);
    });

    it('returns the canonical name when a synonym matched', async () => {
      const { search } = await serviceWith([MOEHRE]);
      const results = await search.searchByName('karotte');
      expect(results[0]!.name).toBe('Möhre');
      expect(results[0]!.id).toBe('moehre');
    });

    it('matches an English synonym against a German canonical name', async () => {
      const { search } = await serviceWith([MOEHRE]);
      expect((await search.searchByName('carrot')).some((r) => r.id === 'moehre')).toBe(true);
    });

    it('returns nothing for a query shorter than 2 characters', async () => {
      const { search } = await serviceWith([MOEHRE, KAESE]);
      expect(await search.searchByName('')).toHaveLength(0);
      expect(await search.searchByName('k')).toHaveLength(0);
      expect(await search.searchByName(' ')).toHaveLength(0);
    });

    it('returns nothing when no entry matches', async () => {
      const { search } = await serviceWith([MOEHRE]);
      expect(await search.searchByName('zzznomatch')).toHaveLength(0);
    });

    it('ignores the sources parameter, as a leaf service', async () => {
      const { search } = await serviceWith([MOEHRE]);
      const results = await search.searchByName('möhre', new Set(['OFF' as const]));
      expect(results).toHaveLength(1);
      expect(results[0]!.source).toBe('CATALOG');
    });
  });

  describe('result shape', () => {
    it('carries CATALOG source, id, and unit', async () => {
      const { search } = await serviceWith([OLIVENOEL]);
      const [result] = await search.searchByName('olivenöl');
      expect(result).toMatchObject({ source: 'CATALOG', id: 'olivenoel', unit: 'ml' });
    });

    it('derives per-unit macros from the per-100 values', async () => {
      const { search } = await serviceWith([MOEHRE]);
      const [result] = await search.searchByName('möhre');
      expect(result!.macrosPerUnit.calories).toBeCloseTo(0.41);
      expect(result!.macrosPerUnit.protein).toBeCloseTo(0.009);
    });

    it('passes the untracked flag through', async () => {
      const { search } = await serviceWith([SALZ]);
      const [result] = await search.searchByName('salz');
      expect(result!.untracked).toBe(true);
    });
  });

  describe('ranking', () => {
    it('orders exact > whole-word > token-start > substring on the canonical name', async () => {
      const { search } = await serviceWith([
        { ...HAEHNCHEN, id: 'sub', name: 'Suppenhähnchenbrustragout', synonyms: [] },
        { ...HAEHNCHEN, id: 'token', name: 'Mit Hähnchenbrustkeule paniert und allerlei', synonyms: [] },
        { ...HAEHNCHEN, id: 'whole', name: 'Hähnchenbrust, gegart', synonyms: [] },
        { ...HAEHNCHEN, id: 'exact', name: 'Hähnchenbrust', synonyms: [] },
      ]);
      const results = await search.searchByName('Hähnchenbrust');
      expect(results.map((r) => r.id)).toEqual(['exact', 'whole', 'token', 'sub']);
    });

    it('ranks a canonical match above a synonym match of the same tier', async () => {
      const { search } = await serviceWith([
        { ...MOEHRE, id: 'syn', name: 'Möhre', synonyms: ['Karotte'] },
        { ...MOEHRE, id: 'canon', name: 'Karotte', synonyms: [] },
      ]);
      expect((await search.searchByName('Karotte'))[0]!.id).toBe('canon');
    });

    it('breaks ties by canonical name length, then locale order', async () => {
      const { search } = await serviceWith([
        { ...HAEHNCHEN, id: 'lang', name: 'Hähnchenbrust, gegart und mit Beilagen serviert', synonyms: [] },
        { ...HAEHNCHEN, id: 'kurz', name: 'Hähnchenbrust, roh', synonyms: [] },
      ]);
      expect((await search.searchByName('Hähnchenbrust')).map((r) => r.id)).toEqual(['kurz', 'lang']);
    });

    it('caps at 20 results and keeps the highest-scoring one', async () => {
      const fillers: FoodEntry[] = Array.from({ length: 25 }, (_, i) => ({
        ...HAEHNCHEN,
        id: `fill-${i}`,
        name: `Suppenhähnchenbrustvariante ${i}`,
        synonyms: [],
      }));
      const { search } = await serviceWith([
        ...fillers,
        { ...HAEHNCHEN, id: 'exact', name: 'Hähnchenbrust', synonyms: [] },
      ]);
      const results = await search.searchByName('Hähnchenbrust');
      expect(results).toHaveLength(20);
      expect(results[0]!.id).toBe('exact');
    });
  });

  describe('index rebuild on write', () => {
    it('finds an entry added after the service was constructed', async () => {
      const { search, store } = await serviceWith([MOEHRE]);
      expect(await search.searchByName('balsamico')).toHaveLength(0);

      await store.add({
        id: 'balsamicoessig',
        name: 'Balsamicoessig',
        synonyms: ['Balsamico-Essig'],
        unit: 'ml',
        macrosPer100: { calories: 88, protein: 0, carbs: 17, fat: 0 },
      });

      const results = await search.searchByName('balsamico');
      expect(results.map((r) => r.id)).toEqual(['balsamicoessig']);
      expect(results[0]!.source).toBe('CATALOG');
    });

    it('returns corrected macros immediately after an update', async () => {
      const { search, store } = await serviceWith([MOEHRE]);
      await store.update('moehre', { ...MOEHRE, macrosPer100: { ...MOEHRE.macrosPer100, calories: 25 } });
      const [result] = await search.searchByName('möhre');
      expect(result!.macrosPerUnit.calories).toBeCloseTo(0.25);
    });

    it('stops returning a removed entry', async () => {
      const { search, store } = await serviceWith([MOEHRE]);
      await store.remove('moehre');
      expect(await search.searchByName('möhre')).toHaveLength(0);
    });

    it('matches a synonym added at runtime', async () => {
      const { search, store } = await serviceWith([MOEHRE]);
      expect(await search.searchByName('rübli')).toHaveLength(0);

      await store.addSynonym('moehre', 'Rübli');

      expect((await search.searchByName('rübli')).map((r) => r.id)).toEqual(['moehre']);
    });
  });

  describe('searchByBarcode', () => {
    it('never answers barcode lookups', async () => {
      const { search } = await serviceWith([MOEHRE]);
      expect(await search.searchByBarcode('1234567890')).toBeNull();
    });
  });

  describe('findFuzzyCandidates', () => {
    it('offers loose candidates for the resolution proposer', async () => {
      const { search } = await serviceWith([MOEHRE, KAESE, HAEHNCHEN]);
      const candidates = search.findFuzzyCandidates('Möhren', 5);
      expect(candidates.map((c) => c.id)).toContain('moehre');
    });
  });
});
