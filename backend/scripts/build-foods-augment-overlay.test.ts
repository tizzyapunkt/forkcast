import { describe, it, expect } from 'vitest';
import { parseOverlayExport, applySynonyms, draftHintMessage } from './build-foods-augment-overlay.ts';
import type { FoodEntry } from '../src/domain/foods/types.ts';

const oliven: FoodEntry = {
  id: 'oliven',
  name: 'Oliven',
  synonyms: ['olives'],
  unit: 'g',
  macrosPer100: { calories: 145, protein: 1, carbs: 6, fat: 15 },
};

describe('parseOverlayExport', () => {
  it('parses a well-formed overlay export', () => {
    const out = parseOverlayExport({ foods: [oliven], synonyms: [{ foodId: 'oliven', synonym: 'grüne Oliven' }] });
    expect(out.foods).toHaveLength(1);
    expect(out.synonyms).toEqual([{ foodId: 'oliven', synonym: 'grüne Oliven' }]);
  });

  it('defaults missing arrays to empty', () => {
    expect(parseOverlayExport({})).toEqual({ foods: [], synonyms: [] });
  });

  it('rejects the retired unmatched-ingredient { entries } shape', () => {
    expect(() => parseOverlayExport({ entries: [{ name: 'x' }] })).toThrow(/retired|entries|overlay/i);
  });

  it('rejects a non-object', () => {
    expect(() => parseOverlayExport('nope')).toThrow(/not a JSON object/i);
  });

  it('rejects a malformed synonym', () => {
    expect(() => parseOverlayExport({ synonyms: [{ foodId: 'x' }] })).toThrow(/synonym/);
  });
});

describe('applySynonyms', () => {
  it('applies a synonym to its curated entry', () => {
    const result = applySynonyms([oliven], [{ foodId: 'oliven', synonym: 'grüne Oliven' }]);
    expect(result.applied).toEqual([{ foodId: 'oliven', synonym: 'grüne Oliven' }]);
    expect(result.foods[0]!.synonyms).toContain('grüne Oliven');
    expect(result.orphaned).toHaveLength(0);
  });

  it('surfaces an orphaned synonym and skips it', () => {
    const result = applySynonyms([oliven], [{ foodId: 'ghost', synonym: 'x' }]);
    expect(result.orphaned).toEqual([{ foodId: 'ghost', synonym: 'x' }]);
    expect(result.applied).toHaveLength(0);
    expect(result.foods[0]!.synonyms).toEqual(['olives']);
  });

  it('treats a duplicate synonym as a no-op (not counted as applied)', () => {
    const result = applySynonyms([oliven], [{ foodId: 'oliven', synonym: 'Olives' }]);
    expect(result.applied).toHaveLength(0);
  });

  it('does not mutate the input foods', () => {
    const input = [oliven];
    applySynonyms(input, [{ foodId: 'oliven', synonym: 'grüne Oliven' }]);
    expect(input[0]!.synonyms).toEqual(['olives']);
  });
});

describe('draftHintMessage', () => {
  it('includes the id and the confirmed entry as a hint', () => {
    const msg = draftHintMessage(oliven);
    expect(msg).toContain('- oliven');
    expect(msg).toContain('"Oliven"');
    expect(msg).toContain('macrosPer100');
  });

  it('marks untracked ids', () => {
    const msg = draftHintMessage({
      ...oliven,
      id: 'salz',
      untracked: true,
      macrosPer100: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    });
    expect(msg).toContain('- salz (untracked)');
  });
});
