import { describe, it, expect } from 'vitest';
import { mapBlsEntry } from './map-bls-entry.ts';
import type { BlsEntry } from './types.ts';

const baseEntry: BlsEntry = {
  id: 'G620100',
  name_de: 'Karotte/Möhre, roh',
  name_en: 'Carrot raw',
  calories100: 40,
  protein100: 0.84,
  carbs100: 6.471,
  fat100: 0.4,
};

describe('mapBlsEntry', () => {
  it('sets source to BLS', () => {
    expect(mapBlsEntry(baseEntry).source).toBe('BLS');
  });

  it('uses BLS code as id', () => {
    expect(mapBlsEntry(baseEntry).id).toBe('G620100');
  });

  it('uses German name', () => {
    expect(mapBlsEntry(baseEntry).name).toBe('Karotte/Möhre, roh');
  });

  it('sets unit to g', () => {
    expect(mapBlsEntry(baseEntry).unit).toBe('g');
  });

  it('divides per-100g macros by 100 for macrosPerUnit', () => {
    const result = mapBlsEntry(baseEntry);
    expect(result.macrosPerUnit.calories).toBeCloseTo(0.4);
    expect(result.macrosPerUnit.protein).toBeCloseTo(0.0084);
    expect(result.macrosPerUnit.carbs).toBeCloseTo(0.06471);
    expect(result.macrosPerUnit.fat).toBeCloseTo(0.004);
  });

  it('handles zero macros', () => {
    const zero: BlsEntry = { ...baseEntry, protein100: 0, carbs100: 0, fat100: 0 };
    const result = mapBlsEntry(zero);
    expect(result.macrosPerUnit.protein).toBe(0);
    expect(result.macrosPerUnit.carbs).toBe(0);
    expect(result.macrosPerUnit.fat).toBe(0);
  });
});
