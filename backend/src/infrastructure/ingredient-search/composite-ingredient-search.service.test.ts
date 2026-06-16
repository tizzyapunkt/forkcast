import { describe, it, expect, vi } from 'vitest';
import { CompositeIngredientSearchService } from './composite-ingredient-search.service.ts';
import type { IngredientSearchService } from '../../domain/ingredient-search/ingredient-search.service.ts';
import type { IngredientSearchResult } from '../../domain/ingredient-search/types.ts';
import type { ScannedProduct, ScannedProductStore } from '../../domain/barcode-product-capture/types.ts';

function makeResult(id: string, source: 'FOODS' | 'USER' | 'OFF'): IngredientSearchResult {
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

  it('resolves a barcode from the scanned store first, without querying OFF', async () => {
    const stored: ScannedProduct = {
      barcode: '4337256176103',
      name: 'Himbeer-Heidelbeer-Mix',
      unit: 'g',
      macrosPer100: { calories: 54, protein: 0.9, carbs: 8.4, fat: 0.7 },
      capturedAt: '2026-05-24T12:00:00.000Z',
    };
    const scanned: ScannedProductStore = {
      findByBarcode: vi.fn<(b: string) => Promise<ScannedProduct | null>>().mockResolvedValue(stored),
      upsert: vi.fn<(p: ScannedProduct) => Promise<void>>(),
    };
    const foods = makeMockService([]);
    const off = makeMockService([], offResult);
    const svc = new CompositeIngredientSearchService(off, foods, scanned);

    const result = await svc.searchByBarcode('4337256176103');
    expect(result).toMatchObject({ id: '4337256176103', source: 'SCAN', name: 'Himbeer-Heidelbeer-Mix' });
    expect(off.searchByBarcode).not.toHaveBeenCalled();
  });

  it('falls back to OFF when the barcode is not in the scanned store', async () => {
    const scanned: ScannedProductStore = {
      findByBarcode: vi.fn<(b: string) => Promise<ScannedProduct | null>>().mockResolvedValue(null),
      upsert: vi.fn<(p: ScannedProduct) => Promise<void>>(),
    };
    const foods = makeMockService([]);
    const off = makeMockService([], offResult);
    const svc = new CompositeIngredientSearchService(off, foods, scanned);

    expect(await svc.searchByBarcode('1234567890')).toEqual(offResult);
    expect(scanned.findByBarcode).toHaveBeenCalledWith('1234567890');
    expect(off.searchByBarcode).toHaveBeenCalledWith('1234567890');
  });

  it('returns null when neither the scanned store nor OFF has the barcode', async () => {
    const scanned: ScannedProductStore = {
      findByBarcode: vi.fn<(b: string) => Promise<ScannedProduct | null>>().mockResolvedValue(null),
      upsert: vi.fn<(p: ScannedProduct) => Promise<void>>(),
    };
    const foods = makeMockService([]);
    const off = makeMockService([], null);
    const svc = new CompositeIngredientSearchService(off, foods, scanned);

    expect(await svc.searchByBarcode('0000')).toBeNull();
  });

  it('queries the USER source when requested and orders FOODS → USER → OFF', async () => {
    const foods = makeMockService([foodsResult]);
    const off = makeMockService([offResult]);
    const user = makeMockService([makeResult('U1', 'USER')]);
    const svc = new CompositeIngredientSearchService(off, foods, undefined, user);

    const results = await svc.searchByName('food', new Set(['FOODS', 'USER', 'OFF']));
    expect(results.map((r) => r.source)).toEqual(['FOODS', 'USER', 'OFF']);
  });

  it('does not query USER when the source is absent', async () => {
    const foods = makeMockService([foodsResult]);
    const off = makeMockService([offResult]);
    const user = makeMockService([makeResult('U1', 'USER')]);
    const svc = new CompositeIngredientSearchService(off, foods, undefined, user);

    await svc.searchByName('food', new Set(['FOODS']));
    expect(user.searchByName).not.toHaveBeenCalled();
  });

  it('name-searches scanned products when SCAN is requested', async () => {
    const products: ScannedProduct[] = [
      {
        barcode: '111',
        name: 'Skyr Natur',
        unit: 'g',
        macrosPer100: { calories: 63, protein: 11, carbs: 4, fat: 0 },
        capturedAt: '2026-05-24T12:00:00.000Z',
      },
      {
        barcode: '222',
        name: 'Cola',
        unit: 'ml',
        macrosPer100: { calories: 42, protein: 0, carbs: 10.6, fat: 0 },
        capturedAt: '2026-05-24T12:00:00.000Z',
      },
    ];
    const scanned: ScannedProductStore = {
      findByBarcode: vi.fn<(b: string) => Promise<ScannedProduct | null>>().mockResolvedValue(null),
      upsert: vi.fn<(p: ScannedProduct) => Promise<void>>(),
      list: vi.fn<() => Promise<ScannedProduct[]>>().mockResolvedValue(products),
    };
    const foods = makeMockService([]);
    const off = makeMockService([]);
    const svc = new CompositeIngredientSearchService(off, foods, scanned);

    const results = await svc.searchByName('skyr', new Set(['SCAN']));
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ id: '111', source: 'SCAN', name: 'Skyr Natur' });
  });

  it('does not name-search scanned products when SCAN is absent', async () => {
    const scanned: ScannedProductStore = {
      findByBarcode: vi.fn<(b: string) => Promise<ScannedProduct | null>>().mockResolvedValue(null),
      upsert: vi.fn<(p: ScannedProduct) => Promise<void>>(),
      list: vi.fn<() => Promise<ScannedProduct[]>>().mockResolvedValue([]),
    };
    const foods = makeMockService([foodsResult]);
    const off = makeMockService([]);
    const svc = new CompositeIngredientSearchService(off, foods, scanned);

    await svc.searchByName('food', new Set(['FOODS']));
    expect(scanned.list).not.toHaveBeenCalled();
  });
});
