import { describe, it, expect } from 'vitest';
import { mapOffProduct } from './map-off-product.js';

const baseProduct = {
  code: '1234567890',
  product_name: 'Chicken Breast',
  nutriments: {
    'energy-kcal_100g': 165,
    proteins_100g: 31,
    carbohydrates_100g: 0,
    fat_100g: 3.6,
  },
};

describe('mapOffProduct', () => {
  it('maps a product to an IngredientSearchResult with per-gram macros', () => {
    const result = mapOffProduct(baseProduct);

    expect(result).not.toBeNull();
    expect(result!.offId).toBe('1234567890');
    expect(result!.name).toBe('Chicken Breast');
    expect(result!.unit).toBe('g');
    expect(result!.macrosPerUnit.calories).toBeCloseTo(1.65);
    expect(result!.macrosPerUnit.protein).toBeCloseTo(0.31);
    expect(result!.macrosPerUnit.carbs).toBeCloseTo(0);
    expect(result!.macrosPerUnit.fat).toBeCloseTo(0.036);
  });

  it('defaults missing nutriment values to 0', () => {
    const result = mapOffProduct({
      code: 'abc',
      product_name: 'Mystery food',
      nutriments: { 'energy-kcal_100g': 100 },
    });

    expect(result).not.toBeNull();
    expect(result!.macrosPerUnit.protein).toBe(0);
    expect(result!.macrosPerUnit.carbs).toBe(0);
    expect(result!.macrosPerUnit.fat).toBe(0);
  });

  it('falls back to product_name_en when product_name is absent', () => {
    const result = mapOffProduct({
      code: 'abc',
      product_name_en: 'Oat Milk',
      nutriments: { 'energy-kcal_100g': 45, proteins_100g: 1, carbohydrates_100g: 6.5, fat_100g: 1.5 },
    });

    expect(result!.name).toBe('Oat Milk');
  });

  it('returns null when the product has no name', () => {
    const result = mapOffProduct({
      code: 'abc',
      nutriments: { 'energy-kcal_100g': 100 },
    });

    expect(result).toBeNull();
  });

  it('returns null when the product has no nutritional data', () => {
    const result = mapOffProduct({
      code: 'abc',
      product_name: 'Empty product',
      nutriments: {},
    });

    expect(result).toBeNull();
  });
});
