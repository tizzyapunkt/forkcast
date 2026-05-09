import { describe, it, expect } from 'vitest';
import { chunkKeys, collectEntries, sortEntriesById, formatFoodsJson } from './build-foods-helpers.ts';
import type { FoodEntry } from '../src/domain/foods/types.ts';

const valid = (id: string, name: string): FoodEntry => ({
  id,
  name,
  synonyms: [],
  unit: 'g',
  macrosPer100: { calories: 1, protein: 0, carbs: 0, fat: 0 },
});

describe('chunkKeys', () => {
  it('chunks an array into fixed-size batches', () => {
    expect(chunkKeys(['a', 'b', 'c', 'd', 'e'], 2)).toEqual([['a', 'b'], ['c', 'd'], ['e']]);
  });

  it('returns a single chunk when array is smaller than batch size', () => {
    expect(chunkKeys(['a', 'b'], 20)).toEqual([['a', 'b']]);
  });

  it('returns empty array for empty input', () => {
    expect(chunkKeys([], 20)).toEqual([]);
  });

  it('throws on non-positive batch size', () => {
    expect(() => chunkKeys(['a'], 0)).toThrow();
    expect(() => chunkKeys(['a'], -1)).toThrow();
  });
});

describe('collectEntries', () => {
  it('returns entries in the order of requestedIds when all are present and valid', () => {
    const candidate = [valid('b', 'B'), valid('a', 'A')];
    const { entries, errors } = collectEntries(['a', 'b'], candidate);
    expect(entries.map((e) => e.id)).toEqual(['a', 'b']);
    expect(errors).toEqual([]);
  });

  it('reports a missing-id error for any requested id that has no candidate entry', () => {
    const { entries, errors } = collectEntries(['a', 'b'], [valid('a', 'A')]);
    expect(entries.map((e) => e.id)).toEqual(['a']);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/"b"/);
  });

  it('reports a validation error when an entry fails validation', () => {
    const bad: FoodEntry = { ...valid('a', 'A'), macrosPer100: { calories: -1, protein: 0, carbs: 0, fat: 0 } };
    const { entries, errors } = collectEntries(['a'], [bad]);
    expect(entries).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/calories/i);
  });

  it('collects multiple errors across the batch', () => {
    const bad = { ...valid('a', 'A'), id: '' };
    const { errors } = collectEntries(['a', 'b'], [bad as FoodEntry]);
    expect(errors).toHaveLength(2);
  });

  it('accepts an untracked entry when seed marks the key as untracked', () => {
    const untracked: FoodEntry = {
      id: 'salz',
      name: 'Salz',
      synonyms: ['salt'],
      unit: 'g',
      macrosPer100: { calories: 0, protein: 0, carbs: 0, fat: 0 },
      untracked: true,
    };
    const { entries, errors } = collectEntries(['salz'], [untracked], { untrackedKeys: new Set(['salz']) });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.untracked).toBe(true);
    expect(errors).toEqual([]);
  });

  it('errors when seed marks key untracked but AI omits the flag', () => {
    const noFlag: FoodEntry = {
      id: 'salz',
      name: 'Salz',
      synonyms: [],
      unit: 'g',
      macrosPer100: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    };
    const { entries, errors } = collectEntries(['salz'], [noFlag], { untrackedKeys: new Set(['salz']) });
    expect(entries).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/seed marks.*untracked/i);
  });

  it('errors when seed marks key untracked but AI returns non-zero macros', () => {
    const driftedMacros: FoodEntry = {
      id: 'salz',
      name: 'Salz',
      synonyms: [],
      unit: 'g',
      macrosPer100: { calories: 5, protein: 0, carbs: 0, fat: 0 },
      untracked: true,
    };
    const { entries, errors } = collectEntries(['salz'], [driftedMacros], { untrackedKeys: new Set(['salz']) });
    expect(entries).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/all-zero/i);
  });

  it('errors when AI sets untracked: true on a tracked seed key', () => {
    const drifted: FoodEntry = {
      id: 'moehre',
      name: 'Möhre',
      synonyms: [],
      unit: 'g',
      macrosPer100: { calories: 41, protein: 0.9, carbs: 9.6, fat: 0.2 },
      untracked: true,
    };
    const { entries, errors } = collectEntries(['moehre'], [drifted], { untrackedKeys: new Set() });
    expect(entries).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/untracked.*tracked/i);
  });
});

describe('sortEntriesById', () => {
  it('sorts entries by id ascending without mutating input', () => {
    const input = [valid('zwiebel', 'Zwiebel'), valid('apfel', 'Apfel'), valid('moehre', 'Möhre')];
    const sorted = sortEntriesById(input);
    expect(sorted.map((e) => e.id)).toEqual(['apfel', 'moehre', 'zwiebel']);
    expect(input.map((e) => e.id)).toEqual(['zwiebel', 'apfel', 'moehre']);
  });
});

describe('formatFoodsJson', () => {
  it('produces pretty-printed JSON ending with a single trailing newline', () => {
    const out = formatFoodsJson([valid('a', 'A')]);
    expect(out.endsWith('\n')).toBe(true);
    expect(out.endsWith('\n\n')).toBe(false);
    expect(out).toContain('  "id"');
  });
});
