import { describe, it, expect } from 'vitest';
import { mapOffProduct } from './map-off-product.ts';

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
    expect(result!.id).toBe('1234567890');
    expect(result!.source).toBe('OFF');
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

  it('falls back to product_name_de when product_name is absent', () => {
    const result = mapOffProduct({
      code: 'abc',
      product_name_de: 'Hafermilch',
      nutriments: { 'energy-kcal_100g': 45, proteins_100g: 1, carbohydrates_100g: 6.5, fat_100g: 1.5 },
    });

    expect(result!.name).toBe('Hafermilch');
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

  it('maps serving_size and serving_quantity without affecting macros', () => {
    const result = mapOffProduct({
      ...baseProduct,
      serving_size: '1 slice (25g)',
      serving_quantity: 25,
    });

    expect(result!.servingSize).toBe('1 slice (25g)');
    expect(result!.servingQuantity).toBe(25);
    expect(result!.macrosPerUnit.calories).toBeCloseTo(1.65);
    expect(result!.macrosPerUnit.protein).toBeCloseTo(0.31);
  });

  it('coerces a numeric-string serving_quantity to a number', () => {
    const result = mapOffProduct({ ...baseProduct, serving_quantity: '25' });

    expect(result!.servingQuantity).toBe(25);
  });

  it('ignores _serving nutrient fields and reads calories from _100g', () => {
    const result = mapOffProduct({
      code: 'abc',
      product_name: 'Bread',
      nutriments: {
        'energy-kcal_100g': 250,
        'energy-kcal_serving': 999,
      },
    });

    expect(result!.macrosPerUnit.calories).toBeCloseTo(2.5);
  });

  it('leaves serving fields undefined when the product omits them', () => {
    const result = mapOffProduct(baseProduct);

    expect(result!.servingSize).toBeUndefined();
    expect(result!.servingQuantity).toBeUndefined();
  });

  it('leaves servingQuantity undefined for zero, negative, or non-numeric values', () => {
    expect(mapOffProduct({ ...baseProduct, serving_quantity: 0 })!.servingQuantity).toBeUndefined();
    expect(mapOffProduct({ ...baseProduct, serving_quantity: -5 })!.servingQuantity).toBeUndefined();
    expect(mapOffProduct({ ...baseProduct, serving_quantity: 'not-a-number' })!.servingQuantity).toBeUndefined();
  });

  it('leaves servingSize undefined when it is an empty string', () => {
    const result = mapOffProduct({ ...baseProduct, serving_size: '' });

    expect(result!.servingSize).toBeUndefined();
  });
});
