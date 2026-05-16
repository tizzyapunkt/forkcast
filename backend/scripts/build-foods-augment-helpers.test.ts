import { describe, it, expect } from 'vitest';
import { appendSynonym, appendSeedKey } from './build-foods-augment-helpers.ts';
import type { FoodEntry } from '../src/domain/foods/types.ts';

const moehre: FoodEntry = {
  id: 'moehre',
  name: 'Möhre',
  synonyms: ['Karotte', 'carrot'],
  unit: 'g',
  macrosPer100: { calories: 41, protein: 0.9, carbs: 9.6, fat: 0.2 },
};

describe('appendSynonym', () => {
  it('appends a new synonym to an existing entry', () => {
    const next = appendSynonym(moehre, 'Mohrrübe');
    expect(next.synonyms).toEqual(['Karotte', 'carrot', 'Mohrrübe']);
  });

  it('is case- and diacritic-insensitive — no duplicate is added when an equivalent synonym already exists', () => {
    const next = appendSynonym(moehre, 'KAROTTE');
    expect(next).toBe(moehre); // unchanged reference signals "no-op"
  });

  it('refuses to add a synonym that equals the canonical name', () => {
    expect(() => appendSynonym(moehre, 'mohre')).toThrowError(/canonical name/i);
  });

  it('trims the candidate before deciding', () => {
    const next = appendSynonym(moehre, '  Karotte  ');
    expect(next).toBe(moehre);
  });

  it('throws on empty/whitespace-only candidates', () => {
    expect(() => appendSynonym(moehre, '   ')).toThrowError(/empty/i);
  });
});

const SEED_FILE_SOURCE = `// Heading comment
export type FoodSeedKey = string | { key: string; untracked: true };

export const FOODS_SEED_KEYS: ReadonlyArray<FoodSeedKey> = [
  // Vegetables
  'spinat',
  'moehre',

  // Untracked
  { key: 'salz', untracked: true },
];
`;

describe('appendSeedKey', () => {
  it('appends a new tracked key as a plain string before the closing bracket, preserving the existing entries', () => {
    const next = appendSeedKey(SEED_FILE_SOURCE, [{ key: 'buchweizenmehl', untracked: false }]);
    expect(next).toContain("'spinat'");
    expect(next).toContain("'moehre'");
    expect(next).toContain("'buchweizenmehl'");
    expect(next).toContain("{ key: 'salz', untracked: true }");
    // The new entry sits before the closing bracket.
    expect(next.indexOf("'buchweizenmehl'")).toBeLessThan(next.lastIndexOf(']'));
  });

  it('appends an untracked key using the { key, untracked: true } form', () => {
    const next = appendSeedKey(SEED_FILE_SOURCE, [{ key: 'kreuzkuemmel', untracked: true }]);
    expect(next).toContain("{ key: 'kreuzkuemmel', untracked: true }");
  });

  it('appends multiple keys in one pass', () => {
    const next = appendSeedKey(SEED_FILE_SOURCE, [
      { key: 'buchweizenmehl', untracked: false },
      { key: 'kreuzkuemmel', untracked: true },
    ]);
    expect(next).toContain("'buchweizenmehl'");
    expect(next).toContain("{ key: 'kreuzkuemmel', untracked: true }");
  });

  it('refuses to append a key that already exists (tracked or untracked)', () => {
    expect(() => appendSeedKey(SEED_FILE_SOURCE, [{ key: 'spinat', untracked: false }])).toThrowError(
      /already exists/i,
    );
    expect(() => appendSeedKey(SEED_FILE_SOURCE, [{ key: 'salz', untracked: true }])).toThrowError(/already exists/i);
  });

  it('throws when the array literal cannot be located unambiguously', () => {
    const ambiguous = `export const FOODS_SEED_KEYS = [];
export const OTHER = ['x'];
`;
    expect(() => appendSeedKey(ambiguous, [{ key: 'x', untracked: false }])).toThrowError(/locate|parse/i);
  });
});
