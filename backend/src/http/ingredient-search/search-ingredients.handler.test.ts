import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import type {
  IngredientSearchService,
  IngredientSource,
} from '../../domain/ingredient-search/ingredient-search.service.ts';
import type { IngredientSearchResult } from '../../domain/ingredient-search/types.ts';
import { makeSearchIngredientsByNameHandler } from './search-ingredients.handler.ts';

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
});
