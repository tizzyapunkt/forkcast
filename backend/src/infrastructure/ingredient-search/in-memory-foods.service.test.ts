import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { InMemoryFoodsService } from './in-memory-foods.service.ts';
import type { FoodEntry } from '../../domain/foods/types.ts';

const tmpDir = mkdtempSync(join(tmpdir(), 'forkcast-foods-svc-'));
afterAll(() => rmSync(tmpDir, { recursive: true, force: true }));

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

function makeService(entries: unknown[]): { svc: InMemoryFoodsService; path: string } {
  const path = join(tmpDir, `foods-${Date.now()}-${Math.random()}.json`);
  writeFileSync(path, JSON.stringify(entries), 'utf-8');
  return { svc: new InMemoryFoodsService(path), path };
}

describe('InMemoryFoodsService', () => {
  describe('init', () => {
    it('loads valid entries', async () => {
      const { svc } = makeService([MOEHRE, KAESE, HAEHNCHEN]);
      await svc.init();
      const results = await svc.searchByName('möhre');
      expect(results).toHaveLength(1);
    });

    it('skips malformed entries and logs a single warning per bad entry', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const bad = { ...MOEHRE, id: 'bad', macrosPer100: { ...MOEHRE.macrosPer100, calories: -1 } };
      const { svc } = makeService([MOEHRE, bad, KAESE]);
      await svc.init();
      const all = await svc.searchByName('mo');
      const allKaese = await svc.searchByName('ka');
      expect(all.some((r) => r.id === 'moehre')).toBe(true);
      expect(allKaese.some((r) => r.id === 'camembert')).toBe(true);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('bad'));
      warn.mockRestore();
    });
  });

  describe('searchByName', () => {
    let svc: InMemoryFoodsService;
    beforeEach(async () => {
      svc = makeService([MOEHRE, KAESE, HAEHNCHEN, OLIVENOEL]).svc;
      await svc.init();
    });

    it('finds an entry by canonical name (case-insensitive)', async () => {
      const results = await svc.searchByName('möhre');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Möhre');
      expect(results[0].source).toBe('FOODS');
      expect(results[0].id).toBe('moehre');
    });

    it('matches diacritic-folded query against umlaut canonical names', async () => {
      const results = await svc.searchByName('mohre');
      expect(results.some((r) => r.name === 'Möhre')).toBe(true);
    });

    it('matches uppercase query case-insensitively', async () => {
      const results = await svc.searchByName('MÖHRE');
      expect(results.some((r) => r.id === 'moehre')).toBe(true);
    });

    it('returns canonical name when matching against a synonym', async () => {
      const results = await svc.searchByName('karotte');
      expect(results[0]?.name).toBe('Möhre');
      expect(results[0]?.id).toBe('moehre');
    });

    it('matches an English synonym against a German canonical entry', async () => {
      const results = await svc.searchByName('carrot');
      expect(results.some((r) => r.id === 'moehre')).toBe(true);
    });

    it('returns the entry unit on results (ml for liquids)', async () => {
      const [result] = await svc.searchByName('olivenöl');
      expect(result?.unit).toBe('ml');
    });

    it('returns empty array for query shorter than 2 characters', async () => {
      expect(await svc.searchByName('')).toHaveLength(0);
      expect(await svc.searchByName('k')).toHaveLength(0);
      expect(await svc.searchByName(' ')).toHaveLength(0);
    });

    it('returns empty array when nothing matches', async () => {
      expect(await svc.searchByName('zzznomatch')).toHaveLength(0);
    });

    it('ignores the sources param and still returns FOODS results', async () => {
      const results = await svc.searchByName('möhre', new Set(['OFF']));
      expect(results).toHaveLength(1);
      expect(results[0].source).toBe('FOODS');
    });

    it('macrosPerUnit are per-unit (divided by 100)', async () => {
      const [result] = await svc.searchByName('möhre');
      expect(result?.macrosPerUnit.calories).toBeCloseTo(0.41);
      expect(result?.macrosPerUnit.protein).toBeCloseTo(0.009);
    });

    it('caps results at 20 entries', async () => {
      const entries: FoodEntry[] = Array.from({ length: 30 }, (_, i) => ({
        id: `apfel-${i}`,
        name: `Apfelsaft Variante ${i}`,
        synonyms: [],
        unit: 'ml',
        macrosPer100: { calories: 50, protein: 0, carbs: 12, fat: 0 },
      }));
      const { svc: large } = makeService(entries);
      await large.init();
      const results = await large.searchByName('apfelsaft');
      expect(results).toHaveLength(20);
    });
  });

  describe('relevance ranking', () => {
    it('exact > whole-word > token-start > substring (canonical)', async () => {
      const EXACT: FoodEntry = { ...HAEHNCHEN, id: 'EXACT', name: 'Hähnchenbrust', synonyms: [] };
      const WHOLE: FoodEntry = { ...HAEHNCHEN, id: 'WHOLE', name: 'Hähnchenbrust, gegart', synonyms: [] };
      const TOKEN: FoodEntry = {
        ...HAEHNCHEN,
        id: 'TOKEN',
        name: 'Mit Hähnchenbrustkeule paniert und allerlei',
        synonyms: [],
      };
      const SUB: FoodEntry = { ...HAEHNCHEN, id: 'SUB', name: 'Suppenhähnchenbrustragout', synonyms: [] };
      const { svc } = makeService([SUB, TOKEN, WHOLE, EXACT]);
      await svc.init();
      const results = await svc.searchByName('Hähnchenbrust');
      expect(results.map((r) => r.id)).toEqual(['EXACT', 'WHOLE', 'TOKEN', 'SUB']);
    });

    it('canonical match outranks synonym exact match at the same query', async () => {
      const SYN_HIT: FoodEntry = {
        id: 'syn',
        name: 'Möhre',
        synonyms: ['Karotte'],
        unit: 'g',
        macrosPer100: { calories: 1, protein: 0, carbs: 0, fat: 0 },
      };
      const CANONICAL_HIT: FoodEntry = {
        id: 'canon',
        name: 'Karotte',
        synonyms: [],
        unit: 'g',
        macrosPer100: { calories: 1, protein: 0, carbs: 0, fat: 0 },
      };
      const { svc } = makeService([SYN_HIT, CANONICAL_HIT]);
      await svc.init();
      const results = await svc.searchByName('Karotte');
      expect(results[0]?.id).toBe('canon');
    });

    it('tie-break by canonical name length, then localeCompare', async () => {
      const SHORT: FoodEntry = { ...HAEHNCHEN, id: 'SHORT', name: 'Hähnchenbrust, roh', synonyms: [] };
      const LONG: FoodEntry = {
        ...HAEHNCHEN,
        id: 'LONG',
        name: 'Hähnchenbrust, gegart und mit Beilagen serviert',
        synonyms: [],
      };
      const { svc } = makeService([LONG, SHORT]);
      await svc.init();
      const results = await svc.searchByName('Hähnchenbrust');
      expect(results.map((r) => r.id)).toEqual(['SHORT', 'LONG']);
    });

    it('20-result cap selects the highest-scoring entries', async () => {
      const fillers: FoodEntry[] = Array.from({ length: 25 }, (_, i) => ({
        id: `FILL${i}`,
        name: `Suppenhähnchenbrustvariante ${i}`,
        synonyms: [],
        unit: 'g',
        macrosPer100: { calories: 50, protein: 0, carbs: 0, fat: 0 },
      }));
      const EXACT: FoodEntry = { ...HAEHNCHEN, id: 'EXACT', name: 'Hähnchenbrust', synonyms: [] };
      const { svc } = makeService([...fillers, EXACT]);
      await svc.init();
      const results = await svc.searchByName('Hähnchenbrust');
      expect(results).toHaveLength(20);
      expect(results[0]?.id).toBe('EXACT');
    });
  });

  describe('searchByBarcode', () => {
    it('returns null', async () => {
      const { svc } = makeService([MOEHRE]);
      await svc.init();
      expect(await svc.searchByBarcode('1234567890')).toBeNull();
    });
  });
});
