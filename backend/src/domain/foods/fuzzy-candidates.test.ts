import { describe, it, expect } from 'vitest';
import { rankFuzzyCandidates, tokenize } from './fuzzy-candidates.ts';
import { indexFoodEntry } from './index-food-entry.ts';
import type { FoodEntry } from './types.ts';

const idx = (over: Partial<FoodEntry>) =>
  indexFoodEntry({
    id: 'x',
    name: 'X',
    synonyms: [],
    unit: 'g',
    macrosPer100: { calories: 1, protein: 0, carbs: 0, fat: 0 },
    ...over,
  });

describe('tokenize', () => {
  it('splits on whitespace and separators', () => {
    expect(tokenize('grune oliven')).toEqual(['grune', 'oliven']);
    expect(tokenize('kichererbsen (aus der dose)')).toEqual(['kichererbsen', 'aus', 'der', 'dose']);
  });
});

describe('rankFuzzyCandidates', () => {
  it('surfaces a singular entry for a plural query (Olive ↔ Oliven)', () => {
    const olive = idx({ id: 'olive', name: 'Grüne Olive' });
    const out = rankFuzzyCandidates([olive], 'grüne Oliven', 8);
    expect(out.map((e) => e.id)).toEqual(['olive']);
  });

  it('surfaces a single-word entry shared with a multi-word query', () => {
    const oliven = idx({ id: 'oliven', name: 'Oliven' });
    const out = rankFuzzyCandidates([oliven], 'grüne Oliven', 8);
    expect(out.map((e) => e.id)).toEqual(['oliven']);
  });

  it('matches via a synonym token', () => {
    const entry = idx({ id: 'moehre', name: 'Möhre', synonyms: ['Karotte'] });
    const out = rankFuzzyCandidates([entry], 'karotten', 8);
    expect(out.map((e) => e.id)).toEqual(['moehre']);
  });

  it('does not surface unrelated entries', () => {
    const fish = idx({ id: 'lachs', name: 'Lachs' });
    expect(rankFuzzyCandidates([fish], 'grüne Oliven', 8)).toEqual([]);
  });

  it('surfaces a base food for a head-final compound (Meersalz → Salz, Kirschtomaten → Tomaten)', () => {
    const salz = idx({
      id: 'salz',
      name: 'Salz',
      untracked: true,
      macrosPer100: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    });
    const tomaten = idx({ id: 'tomaten', name: 'Tomaten' });
    expect(rankFuzzyCandidates([salz], 'Meersalz', 8).map((e) => e.id)).toEqual(['salz']);
    expect(rankFuzzyCandidates([tomaten], 'Kirschtomaten', 8).map((e) => e.id)).toEqual(['tomaten']);
  });

  it('surfaces a base food for a head-initial compound (Apfelmus → Apfel)', () => {
    const apfel = idx({ id: 'apfel', name: 'Apfel' });
    expect(rankFuzzyCandidates([apfel], 'Apfelmus', 8).map((e) => e.id)).toEqual(['apfel']);
  });

  it('does not surface a food whose name only appears mid-word (Preiselbeere ↛ Reis)', () => {
    const reis = idx({ id: 'reis', name: 'Reis' });
    expect(rankFuzzyCandidates([reis], 'Preiselbeere', 8)).toEqual([]);
  });

  it('does not surface on a sub-4-char boundary overlap', () => {
    const ei = idx({ id: 'ei', name: 'Ei' });
    expect(rankFuzzyCandidates([ei], 'Eisbergsalat', 8)).toEqual([]);
  });

  it('ranks a closer (plural) match above a mere shared-stem match', () => {
    const olive = idx({ id: 'olive', name: 'Olive' }); // near-identical to "oliven"
    const olivenoel = idx({ id: 'olivenoel', name: 'Olivenöl' }); // shares prefix "olive"
    const out = rankFuzzyCandidates([olivenoel, olive], 'Oliven', 8);
    expect(out[0]!.id).toBe('olive');
  });

  it('caps the result count', () => {
    const entries = Array.from({ length: 20 }, (_, i) => idx({ id: `oliven-${i}`, name: `Oliven ${i}` }));
    expect(rankFuzzyCandidates(entries, 'oliven', 5)).toHaveLength(5);
  });

  it('returns nothing for an empty query', () => {
    expect(rankFuzzyCandidates([idx({ id: 'a', name: 'Apfel' })], '   ', 8)).toEqual([]);
  });
});
