import { describe, it, expect, vi } from 'vitest';
import { CatalogResolutionCandidateFinder } from './catalog-candidate-finder.ts';
import type { FoodEntry } from '../../domain/foods/types.ts';

const moehre: FoodEntry = {
  id: 'moehre',
  name: 'Möhre',
  synonyms: ['Karotte'],
  unit: 'g',
  macrosPer100: { calories: 41, protein: 0.9, carbs: 9.6, fat: 0.2 },
};

const salz: FoodEntry = {
  id: 'salz',
  name: 'Salz',
  synonyms: [],
  unit: 'g',
  untracked: true,
  macrosPer100: { calories: 0, protein: 0, carbs: 0, fat: 0 },
};

describe('CatalogResolutionCandidateFinder', () => {
  it('maps catalog entries to resolution candidates', async () => {
    const catalog = { findFuzzyCandidates: vi.fn<(q: string, l: number) => FoodEntry[]>().mockReturnValue([moehre]) };

    const candidates = await new CatalogResolutionCandidateFinder(catalog).findCandidates('Möhren', 5);

    expect(candidates).toEqual([{ id: 'moehre', name: 'Möhre', unit: 'g', macrosPer100: moehre.macrosPer100 }]);
    expect(catalog.findFuzzyCandidates).toHaveBeenCalledWith('Möhren', 5);
  });

  it('marks untracked candidates so the model does not invent macros for them', async () => {
    const catalog = { findFuzzyCandidates: vi.fn<(q: string, l: number) => FoodEntry[]>().mockReturnValue([salz]) };

    const [candidate] = await new CatalogResolutionCandidateFinder(catalog).findCandidates('salt', 5);

    expect(candidate!.untracked).toBe(true);
  });

  it('returns an empty list when the catalog has no near match', async () => {
    const catalog = { findFuzzyCandidates: vi.fn<(q: string, l: number) => FoodEntry[]>().mockReturnValue([]) };

    expect(await new CatalogResolutionCandidateFinder(catalog).findCandidates('zzz', 5)).toEqual([]);
  });
});
