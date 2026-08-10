import { describe, it, expect, vi } from 'vitest';
import { CompositeIngredientSearchService } from './composite-ingredient-search.service.ts';
import type { IngredientSearchService } from '../../domain/ingredient-search/ingredient-search.service.ts';
import type { IngredientSearchResult } from '../../domain/ingredient-search/types.ts';
import type { ScannedProduct, ScannedProductStore } from '../../domain/barcode-product-capture/types.ts';

function makeResult(id: string, source: 'CATALOG' | 'OFF'): IngredientSearchResult {
  return {
    id,
    source,
    name: `${source} food ${id}`,
    unit: 'g',
    macrosPerUnit: { calories: 1, protein: 0, carbs: 0, fat: 0 },
  };
}

const catalogResult = makeResult('C1', 'CATALOG');
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
  it('defaults to catalog-only when sources is omitted', async () => {
    const catalog = makeMockService([catalogResult]);
    const off = makeMockService([offResult]);
    const svc = new CompositeIngredientSearchService(off, catalog);

    const results = await svc.searchByName('food');
    expect(results).toHaveLength(1);
    expect(results[0].source).toBe('CATALOG');
    expect(off.searchByName).not.toHaveBeenCalled();
  });

  it('merges results: catalog hits come before OFF hits when both sources requested', async () => {
    const catalog = makeMockService([catalogResult]);
    const off = makeMockService([offResult]);
    const svc = new CompositeIngredientSearchService(off, catalog);

    const results = await svc.searchByName('food', new Set(['CATALOG', 'OFF']));
    expect(results[0].source).toBe('CATALOG');
    expect(results[1].source).toBe('OFF');
  });

  it('skips OFF when only the catalog is in sources', async () => {
    const catalog = makeMockService([catalogResult]);
    const off = makeMockService([offResult]);
    const svc = new CompositeIngredientSearchService(off, catalog);

    const results = await svc.searchByName('food', new Set(['CATALOG']));
    expect(results).toHaveLength(1);
    expect(results[0].source).toBe('CATALOG');
    expect(off.searchByName).not.toHaveBeenCalled();
  });

  it('still returns catalog hits when OFF rejects (both sources requested)', async () => {
    const catalog = makeMockService([catalogResult]);
    const off = makeMockService('reject');
    const svc = new CompositeIngredientSearchService(off, catalog);

    const results = await svc.searchByName('food', new Set(['CATALOG', 'OFF']));
    expect(results).toHaveLength(1);
    expect(results[0].source).toBe('CATALOG');
  });

  it('still returns OFF hits when the catalog rejects (both sources requested)', async () => {
    const catalog = makeMockService('reject');
    const off = makeMockService([offResult]);
    const svc = new CompositeIngredientSearchService(off, catalog);

    const results = await svc.searchByName('food', new Set(['CATALOG', 'OFF']));
    expect(results).toHaveLength(1);
    expect(results[0].source).toBe('OFF');
  });

  it('returns empty when both sources return nothing', async () => {
    const catalog = makeMockService([]);
    const off = makeMockService([]);
    const svc = new CompositeIngredientSearchService(off, catalog);

    expect(await svc.searchByName('nomatch', new Set(['CATALOG', 'OFF']))).toHaveLength(0);
  });

  it('throws instead of silently returning empty when the only requested source rejects', async () => {
    const catalog = makeMockService('reject');
    const off = makeMockService([offResult]);
    const svc = new CompositeIngredientSearchService(off, catalog);

    await expect(svc.searchByName('whey')).rejects.toThrow(/all requested sources/i);
  });

  it('throws when every requested source rejects', async () => {
    const catalog = makeMockService('reject');
    const off = makeMockService('reject');
    const svc = new CompositeIngredientSearchService(off, catalog);

    await expect(svc.searchByName('whey', new Set(['CATALOG', 'OFF']))).rejects.toThrow(/all requested sources/i);
  });

  it('delegates barcode lookup to OFF only', async () => {
    const catalog = makeMockService([]);
    const off = makeMockService([], offResult);
    const svc = new CompositeIngredientSearchService(off, catalog);

    const result = await svc.searchByBarcode('1234567890');
    expect(result).toEqual(offResult);
    expect(catalog.searchByBarcode).not.toHaveBeenCalled();
  });

  it('returns null for barcode when OFF has no match', async () => {
    const catalog = makeMockService([]);
    const off = makeMockService([], null);
    const svc = new CompositeIngredientSearchService(off, catalog);

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
    const catalog = makeMockService([]);
    const off = makeMockService([], offResult);
    const svc = new CompositeIngredientSearchService(off, catalog, scanned);

    const result = await svc.searchByBarcode('4337256176103');
    expect(result).toMatchObject({ id: '4337256176103', source: 'SCAN', name: 'Himbeer-Heidelbeer-Mix' });
    expect(off.searchByBarcode).not.toHaveBeenCalled();
  });

  it('falls back to OFF when the barcode is not in the scanned store', async () => {
    const scanned: ScannedProductStore = {
      findByBarcode: vi.fn<(b: string) => Promise<ScannedProduct | null>>().mockResolvedValue(null),
      upsert: vi.fn<(p: ScannedProduct) => Promise<void>>(),
    };
    const catalog = makeMockService([]);
    const off = makeMockService([], offResult);
    const svc = new CompositeIngredientSearchService(off, catalog, scanned);

    expect(await svc.searchByBarcode('1234567890')).toEqual(offResult);
    expect(scanned.findByBarcode).toHaveBeenCalledWith('1234567890');
    expect(off.searchByBarcode).toHaveBeenCalledWith('1234567890');
  });

  it('returns null when neither the scanned store nor OFF has the barcode', async () => {
    const scanned: ScannedProductStore = {
      findByBarcode: vi.fn<(b: string) => Promise<ScannedProduct | null>>().mockResolvedValue(null),
      upsert: vi.fn<(p: ScannedProduct) => Promise<void>>(),
    };
    const catalog = makeMockService([]);
    const off = makeMockService([], null);
    const svc = new CompositeIngredientSearchService(off, catalog, scanned);

    expect(await svc.searchByBarcode('0000')).toBeNull();
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
    const catalog = makeMockService([]);
    const off = makeMockService([]);
    const svc = new CompositeIngredientSearchService(off, catalog, scanned);

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
    const catalog = makeMockService([catalogResult]);
    const off = makeMockService([]);
    const svc = new CompositeIngredientSearchService(off, catalog, scanned);

    await svc.searchByName('food', new Set(['CATALOG']));
    expect(scanned.list).not.toHaveBeenCalled();
  });
});
