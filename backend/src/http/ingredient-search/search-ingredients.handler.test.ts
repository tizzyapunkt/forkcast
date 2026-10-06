import { describe, it, expect, vi } from 'vite-plus/test';
import { Hono } from 'hono';
import type {
  IngredientSearchService,
  IngredientSource,
} from '../../domain/ingredient-search/ingredient-search.service.ts';
import type { IngredientSearchResult } from '../../domain/ingredient-search/types.ts';
import { makeSearchIngredientsByNameHandler } from './search-ingredients.handler.ts';
import { FakeCatalogStore } from '../../domain/food-catalog/catalog-store.fake.ts';
import { CatalogSearchService } from '../../infrastructure/food-catalog/catalog-search.service.ts';
import type { FoodEntry } from '../../domain/foods/types.ts';

function makeResult(id: string): IngredientSearchResult {
  return {
    id,
    source: 'CATALOG',
    name: `Food ${id}`,
    unit: 'g',
    macrosPerUnit: { calories: 1, protein: 0, carbs: 0, fat: 0 },
  };
}

function makeService(): IngredientSearchService & { searchByName: ReturnType<typeof vi.fn> } {
  return {
    searchByName: vi
      .fn<(q: string, sources?: Set<IngredientSource>) => Promise<IngredientSearchResult[]>>()
      .mockResolvedValue([makeResult('1')]),
    searchByBarcode: vi.fn<(barcode: string) => Promise<IngredientSearchResult | null>>().mockResolvedValue(null),
  };
}

function makeApp(svc: IngredientSearchService) {
  const app = new Hono();
  app.get('/search-ingredients', makeSearchIngredientsByNameHandler(svc));
  return app;
}

describe('makeSearchIngredientsByNameHandler — sources param', () => {
  it('defaults to catalog-only when the sources param is absent', async () => {
    const svc = makeService();
    const res = await makeApp(svc).request('/search-ingredients?q=oat');
    expect(res.status).toBe(200);
    const [, sources] = svc.searchByName.mock.calls[0] as [string, Set<IngredientSource>];
    expect(sources).toEqual(new Set(['CATALOG']));
    expect(sources.has('OFF')).toBe(false);
  });

  it('defaults to catalog-only when the sources param is empty', async () => {
    const svc = makeService();
    await makeApp(svc).request('/search-ingredients?q=oat&sources=');
    const [, sources] = svc.searchByName.mock.calls[0] as [string, Set<IngredientSource>];
    expect(sources).toEqual(new Set(['CATALOG']));
  });

  it('passes a catalog-only set when sources=catalog', async () => {
    const svc = makeService();
    await makeApp(svc).request('/search-ingredients?q=oat&sources=catalog');
    const [, sources] = svc.searchByName.mock.calls[0] as [string, Set<IngredientSource>];
    expect(sources).toEqual(new Set(['CATALOG']));
  });

  it('passes both when sources=catalog,off', async () => {
    const svc = makeService();
    await makeApp(svc).request('/search-ingredients?q=oat&sources=catalog,off');
    const [, sources] = svc.searchByName.mock.calls[0] as [string, Set<IngredientSource>];
    expect(sources).toEqual(new Set(['CATALOG', 'OFF']));
  });

  it('accepts scan alongside the catalog', async () => {
    const svc = makeService();
    await makeApp(svc).request('/search-ingredients?q=oat&sources=catalog,scan');
    const [, sources] = svc.searchByName.mock.calls[0] as [string, Set<IngredientSource>];
    expect(sources).toEqual(new Set(['CATALOG', 'SCAN']));
  });

  it('silently ignores unknown values, including the retired foods and user', async () => {
    const svc = makeService();
    await makeApp(svc).request('/search-ingredients?q=oat&sources=catalog,foods,user,unknown');
    const [, sources] = svc.searchByName.mock.calls[0] as [string, Set<IngredientSource>];
    expect(sources).toEqual(new Set(['CATALOG']));
  });

  it('falls back to the catalog when every requested value is unknown', async () => {
    const svc = makeService();
    await makeApp(svc).request('/search-ingredients?q=oat&sources=foods,user,bls');
    const [, sources] = svc.searchByName.mock.calls[0] as [string, Set<IngredientSource>];
    expect(sources).toEqual(new Set(['CATALOG']));
  });

  it('returns 400 when q is missing', async () => {
    const svc = makeService();
    const res = await makeApp(svc).request('/search-ingredients');
    expect(res.status).toBe(400);
  });

  it('returns a 502 JSON error instead of hanging or a bare 500 when the service rejects', async () => {
    const svc = makeService();
    svc.searchByName.mockRejectedValueOnce(new Error('Ingredient search failed: all requested sources errored'));
    const res = await makeApp(svc).request('/search-ingredients?q=whey');
    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBeTruthy();
  });
});

describe('makeSearchIngredientsByNameHandler — locale param', () => {
  const food = (id: string, name: string, nameEn?: string): FoodEntry => ({
    id,
    name,
    ...(nameEn !== undefined ? { nameEn } : {}),
    synonyms: [],
    unit: 'g',
    macrosPer100: { calories: 52, protein: 0.3, carbs: 14, fat: 0.2 },
  });
  const app = () =>
    makeApp(
      new CatalogSearchService(new FakeCatalogStore([food('apfel', 'Apfel', 'Apple'), food('apfelmus', 'Apfelmus')])),
    );
  const names = async (path: string) =>
    ((await (await app().request(path)).json()) as IngredientSearchResult[]).map((r) => r.name);

  it('returns English names with locale=en, falling back to the canonical name', async () => {
    expect(await names('/search-ingredients?q=apfel&locale=en')).toEqual(['Apple', 'Apfelmus']);
  });

  it('matches the English name in the English locale', async () => {
    expect(await names('/search-ingredients?q=apple&locale=en')).toEqual(['Apple']);
  });

  it('returns canonical German names without a locale', async () => {
    expect(await names('/search-ingredients?q=apfel')).toEqual(['Apfel', 'Apfelmus']);
  });

  it('treats an unknown locale as German', async () => {
    expect(await names('/search-ingredients?q=apfel&locale=fr')).toEqual(['Apfel', 'Apfelmus']);
  });

  it('matches the English name in the German locale and returns the German name', async () => {
    expect(await names('/search-ingredients?q=apple&locale=de')).toEqual(['Apfel']);
  });
});
