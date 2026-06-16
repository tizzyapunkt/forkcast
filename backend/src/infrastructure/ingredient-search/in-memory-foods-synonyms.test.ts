import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { InMemoryFoodsService } from './in-memory-foods.service.ts';
import type { FoodEntry } from '../../domain/foods/types.ts';

const tmpDir = mkdtempSync(join(tmpdir(), 'forkcast-foods-syn-'));
afterAll(() => rmSync(tmpDir, { recursive: true, force: true }));

const KIRSCH: FoodEntry = {
  id: 'kirschtomaten',
  name: 'Kirschtomaten',
  synonyms: [],
  unit: 'g',
  macrosPer100: { calories: 20, protein: 0.9, carbs: 3.9, fat: 0.2 },
};

function makeService(entries: FoodEntry[]): InMemoryFoodsService {
  const path = join(tmpDir, `foods-${Date.now()}-${Math.random()}.json`);
  writeFileSync(path, JSON.stringify(entries), 'utf-8');
  return new InMemoryFoodsService(path);
}

describe('InMemoryFoodsService learned synonyms', () => {
  let svc: InMemoryFoodsService;

  beforeEach(async () => {
    svc = makeService([KIRSCH]);
    await svc.init();
  });

  it('matches a learned synonym immediately and returns the curated entry', async () => {
    expect(await svc.searchByName('cocktailtomaten')).toHaveLength(0);
    const applied = svc.addSynonym('kirschtomaten', 'Cocktailtomaten');
    expect(applied).toBe(true);
    const results = await svc.searchByName('cocktailtomaten');
    expect(results).toHaveLength(1);
    expect(results[0]!.name).toBe('Kirschtomaten');
    expect(results[0]!.source).toBe('FOODS');
  });

  it('skips an orphaned synonym (unknown foodId) with a warning, returns false', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const applied = svc.addSynonym('does-not-exist', 'Whatever');
    expect(applied).toBe(false);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('does-not-exist'));
    warn.mockRestore();
  });

  it('applySynonyms reports applied count and orphans', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = svc.applySynonyms([
      { foodId: 'kirschtomaten', synonym: 'Cocktailtomaten' },
      { foodId: 'ghost', synonym: 'X' },
    ]);
    expect(result.applied).toBe(1);
    expect(result.orphaned).toEqual([{ foodId: 'ghost', synonym: 'X' }]);
    warn.mockRestore();
  });

  it('clearLearnedSynonyms removes all learned synonyms from the index', async () => {
    svc.addSynonym('kirschtomaten', 'Cocktailtomaten');
    expect(await svc.searchByName('cocktailtomaten')).toHaveLength(1);
    svc.clearLearnedSynonyms();
    expect(await svc.searchByName('cocktailtomaten')).toHaveLength(0);
    // the original entry is untouched
    expect(await svc.searchByName('kirschtomaten')).toHaveLength(1);
  });
});
