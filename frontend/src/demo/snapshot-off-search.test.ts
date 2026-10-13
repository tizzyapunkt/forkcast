import type { IngredientSearchService } from '../../../backend/src/domain/ingredient-search/ingredient-search.service.ts';
import type { IngredientSearchResult } from '../../../backend/src/domain/ingredient-search/types.ts';
import { SnapshotOffSearch, type OffSnapshot } from './snapshot-off-search';

const kcal = (calories: number) => ({
  'energy-kcal_100g': calories,
  proteins_100g: 10,
  carbohydrates_100g: 20,
  fat_100g: 30,
});

/** Ordered most-scanned first, as the build script writes it. */
const snapshot: OffSnapshot = {
  source: 'test',
  license: 'ODbL',
  builtAt: '2026-10-13T00:00:00Z',
  countries: ['en:germany'],
  products: [
    { code: '1', product_name: 'Butter', product_name_de: 'Butter', nutriments: kcal(740) },
    { code: '2', product_name: 'Crunchy Peanut Butter', brands: ['Sun-Pat'], nutriments: kcal(600) },
    {
      code: '3',
      product_name: 'Peanut Butter',
      product_name_en: 'Peanut Butter',
      product_name_de: 'Erdnussbutter',
      nutriments: kcal(590),
    },
    { code: '4', product_name: 'Smooth Peanut Butter', nutriments: kcal(610) },
    { code: '5', product_name: 'Skyr Natur', brands: ['Arla'], nutriments: kcal(63) },
    { code: '6', product_name: 'Haferdrink', nutriments: kcal(45) },
  ],
};

function service(products = snapshot.products) {
  const load = vi.fn<() => Promise<OffSnapshot>>(async () => ({ ...snapshot, products }));
  const barcode: IngredientSearchService = {
    searchByName: vi.fn<IngredientSearchService['searchByName']>(async () => []),
    searchByBarcode: vi.fn<IngredientSearchService['searchByBarcode']>(async () => null),
  };
  return { search: new SnapshotOffSearch(load, barcode), load, barcode };
}

const codes = (results: IngredientSearchResult[]) => results.map((r) => r.id);

describe('SnapshotOffSearch', () => {
  it('finds products containing every query word, not products named after one of them', async () => {
    const { search } = service();
    expect(codes(await search.searchByName('peanut butter', undefined, 'en'))).toEqual(['3', '2', '4']);
  });

  it('ranks an exact name above a partial one, and equal matches by popularity', async () => {
    const { search } = service();
    const results = codes(await search.searchByName('peanut butter', undefined, 'en'));

    expect(results[0]).toBe('3');
    expect(results.slice(1)).toEqual(['2', '4']);
  });

  it('names results in the active locale and matches that name', async () => {
    const { search } = service();

    const de = await search.searchByName('erdnussbutter', undefined, 'de');
    expect(de.map((r) => r.name)).toEqual(['Erdnussbutter']);

    const en = await search.searchByName('peanut butter', undefined, 'en');
    expect(en.find((r) => r.id === '3')?.name).toBe('Peanut Butter');
  });

  it('finds a product by its brand', async () => {
    const { search } = service();
    expect(codes(await search.searchByName('arla', undefined, 'de'))).toEqual(['5']);
  });

  it('labels results as Open Food Facts with per-gram macros', async () => {
    const { search } = service();
    const [skyr] = await search.searchByName('skyr', undefined, 'de');

    expect(skyr).toMatchObject({ id: '5', source: 'OFF', name: 'Skyr Natur', brand: 'Arla', unit: 'g' });
    expect(skyr!.macrosPerUnit.calories).toBeCloseTo(0.63);
  });

  it('returns at most 20 results', async () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      code: String(100 + i),
      product_name: `Skyr ${i}`,
      nutriments: kcal(60),
    }));
    const { search } = service(many);
    expect(await search.searchByName('skyr', undefined, 'de')).toHaveLength(20);
  });

  it('returns nothing for a query under two characters', async () => {
    const { search, load } = service();
    expect(await search.searchByName('s', undefined, 'de')).toEqual([]);
    expect(load).not.toHaveBeenCalled();
  });

  it('loads the snapshot once across searches', async () => {
    const { search, load } = service();
    await search.searchByName('skyr', undefined, 'de');
    await search.searchByName('butter', undefined, 'en');
    expect(load).toHaveBeenCalledOnce();
  });

  it('looks barcodes up live', async () => {
    const { search, barcode } = service();
    await search.searchByBarcode('3017620422003');
    expect(barcode.searchByBarcode).toHaveBeenCalledWith('3017620422003');
  });
});
