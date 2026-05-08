import { describe, it, expect, vi } from 'vitest';
import { CompositeIngredientSearchService } from './composite-ingredient-search.service.ts';
import type { IngredientSearchService } from '../../domain/ingredient-search/ingredient-search.service.ts';
import type { IngredientSearchResult } from '../../domain/ingredient-search/types.ts';

function makeResult(id: string, source: 'FOODS' | 'OFF'): IngredientSearchResult {
  return {
    id,
    source,
    name: `${source} food ${id}`,
    unit: 'g',
    macrosPerUnit: { calories: 1, protein: 0, carbs: 0, fat: 0 },
  };
}

const foodsResult = makeResult('F1', 'FOODS');
const offResult = makeResult('O1', 'OFF');

function makeMockService(
  searchByNameResult: IngredientSearchResult[] | 'reject',
  searchByBarcodeResult: IngredientSearchResult | null | 'reject' = null,
): IngredientSearchService {
  return {
    searchByName:
      searchByNameResult === 'reject'
        ? vi.fn<(q: string) => Promise<IngredientSearchResult[]>>().mockRejectedValue(new Error('network error'))
        : vi.fn<(q: string) => Promise<IngredientSearchResult[]>>().mockResolvedValue(searchByNameResult),
    searchByBarcode:
      searchByBarcodeResult === 'reject'
        ? vi.fn<(b: string) => Promise<IngredientSearchResult | null>>().mockRejectedValue(new Error('network error'))
        : vi.fn<(b: string) => Promise<IngredientSearchResult | null>>().mockResolvedValue(searchByBarcodeResult),
  };
}

describe('CompositeIngredientSearchService', () => {
  it('defaults to OFF-only when sources is omitted', async () => {
    const foods = makeMockService([foodsResult]);
    const off = makeMockService([offResult]);
    const svc = new CompositeIngredientSearchService(off, foods);

    const results = await svc.searchByName('food');
    expect(results).toHaveLength(1);
    expect(results[0].source).toBe('OFF');
    expect(foods.searchByName).not.toHaveBeenCalled();
  });

  it('merges results: FOODS hits come before OFF hits when both sources requested', async () => {
    const foods = makeMockService([foodsResult]);
    const off = makeMockService([offResult]);
    const svc = new CompositeIngredientSearchService(off, foods);

    const results = await svc.searchByName('food', new Set(['FOODS', 'OFF']));
    expect(results[0].source).toBe('FOODS');
    expect(results[1].source).toBe('OFF');
  });

  it('skips OFF when only FOODS is in sources', async () => {
    const foods = makeMockService([foodsResult]);
    const off = makeMockService([offResult]);
    const svc = new CompositeIngredientSearchService(off, foods);

    const results = await svc.searchByName('food', new Set(['FOODS']));
    expect(results).toHaveLength(1);
    expect(results[0].source).toBe('FOODS');
    expect(off.searchByName).not.toHaveBeenCalled();
  });

  it('still returns FOODS hits when OFF rejects (both sources requested)', async () => {
    const foods = makeMockService([foodsResult]);
    const off = makeMockService('reject');
    const svc = new CompositeIngredientSearchService(off, foods);

    const results = await svc.searchByName('food', new Set(['FOODS', 'OFF']));
    expect(results).toHaveLength(1);
    expect(results[0].source).toBe('FOODS');
  });

  it('still returns OFF hits when FOODS rejects (both sources requested)', async () => {
    const foods = makeMockService('reject');
    const off = makeMockService([offResult]);
    const svc = new CompositeIngredientSearchService(off, foods);

    const results = await svc.searchByName('food', new Set(['FOODS', 'OFF']));
    expect(results).toHaveLength(1);
    expect(results[0].source).toBe('OFF');
  });

  it('returns empty when both sources return nothing', async () => {
    const foods = makeMockService([]);
    const off = makeMockService([]);
    const svc = new CompositeIngredientSearchService(off, foods);

    expect(await svc.searchByName('nomatch', new Set(['FOODS', 'OFF']))).toHaveLength(0);
  });

  it('delegates barcode lookup to OFF only', async () => {
    const foods = makeMockService([]);
    const off = makeMockService([], offResult);
    const svc = new CompositeIngredientSearchService(off, foods);

    const result = await svc.searchByBarcode('1234567890');
    expect(result).toEqual(offResult);
    expect(foods.searchByBarcode).not.toHaveBeenCalled();
  });

  it('returns null for barcode when OFF has no match', async () => {
    const foods = makeMockService([]);
    const off = makeMockService([], null);
    const svc = new CompositeIngredientSearchService(off, foods);

    expect(await svc.searchByBarcode('9999')).toBeNull();
  });
});
