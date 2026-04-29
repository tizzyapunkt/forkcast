import { describe, it, expect, vi } from 'vitest';
import { CompositeIngredientSearchService } from './composite-ingredient-search.service.ts';
import type { IngredientSearchService } from '../../domain/ingredient-search/ingredient-search.service.ts';
import type { IngredientSearchResult } from '../../domain/ingredient-search/types.ts';

function makeResult(id: string, source: 'BLS' | 'OFF'): IngredientSearchResult {
  return {
    id,
    source,
    name: `${source} food ${id}`,
    unit: 'g',
    macrosPerUnit: { calories: 1, protein: 0, carbs: 0, fat: 0 },
  };
}

const blsResult = makeResult('B1', 'BLS');
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
  it('merges results: BLS hits come before OFF hits', async () => {
    const bls = makeMockService([blsResult]);
    const off = makeMockService([offResult]);
    const svc = new CompositeIngredientSearchService(off, bls);

    const results = await svc.searchByName('food');
    expect(results[0].source).toBe('BLS');
    expect(results[1].source).toBe('OFF');
  });

  it('still returns BLS hits when OFF rejects', async () => {
    const bls = makeMockService([blsResult]);
    const off = makeMockService('reject');
    const svc = new CompositeIngredientSearchService(off, bls);

    const results = await svc.searchByName('food');
    expect(results).toHaveLength(1);
    expect(results[0].source).toBe('BLS');
  });

  it('still returns OFF hits when BLS rejects', async () => {
    const bls = makeMockService('reject');
    const off = makeMockService([offResult]);
    const svc = new CompositeIngredientSearchService(off, bls);

    const results = await svc.searchByName('food');
    expect(results).toHaveLength(1);
    expect(results[0].source).toBe('OFF');
  });

  it('returns empty when both sources return nothing', async () => {
    const bls = makeMockService([]);
    const off = makeMockService([]);
    const svc = new CompositeIngredientSearchService(off, bls);

    expect(await svc.searchByName('nomatch')).toHaveLength(0);
  });

  it('delegates barcode lookup to OFF only', async () => {
    const bls = makeMockService([]);
    const off = makeMockService([], offResult);
    const svc = new CompositeIngredientSearchService(off, bls);

    const result = await svc.searchByBarcode('1234567890');
    expect(result).toEqual(offResult);
    expect(bls.searchByBarcode).not.toHaveBeenCalled();
  });

  it('returns null for barcode when OFF has no match', async () => {
    const bls = makeMockService([]);
    const off = makeMockService([], null);
    const svc = new CompositeIngredientSearchService(off, bls);

    expect(await svc.searchByBarcode('9999')).toBeNull();
  });
});
