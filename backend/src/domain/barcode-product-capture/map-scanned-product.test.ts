import { describe, it, expect } from 'vitest';
import { mapScannedProduct } from './map-scanned-product.ts';
import type { ScannedProduct } from './types.ts';

describe('mapScannedProduct', () => {
  it('maps a stored product to a SCAN search result with per-unit macros', () => {
    const product: ScannedProduct = {
      barcode: '4337256176103',
      name: 'Himbeer-Heidelbeer-Mix',
      unit: 'g',
      macrosPer100: { calories: 54, protein: 0.9, carbs: 8.4, fat: 0.7 },
      capturedAt: '2026-05-24T12:00:00.000Z',
    };

    const result = mapScannedProduct(product);
    expect(result).toMatchObject({
      id: '4337256176103',
      source: 'SCAN',
      name: 'Himbeer-Heidelbeer-Mix',
      unit: 'g',
    });
    expect(result.macrosPerUnit.calories).toBeCloseTo(0.54, 10);
    expect(result.macrosPerUnit.protein).toBeCloseTo(0.009, 10);
    expect(result.macrosPerUnit.carbs).toBeCloseTo(0.084, 10);
    expect(result.macrosPerUnit.fat).toBeCloseTo(0.007, 10);
  });

  it('carries the ml unit through', () => {
    const product: ScannedProduct = {
      barcode: '111',
      name: 'Hafermilch',
      unit: 'ml',
      macrosPer100: { calories: 45, protein: 1, carbs: 6.6, fat: 1.5 },
      capturedAt: '2026-05-24T12:00:00.000Z',
    };
    expect(mapScannedProduct(product).unit).toBe('ml');
    expect(mapScannedProduct(product).macrosPerUnit.calories).toBe(0.45);
  });
});
