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
    source: 'FOODS',
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
  it('defaults to OFF-only when sources param is absent', async () => {
    const svc = makeService();
    const res = await makeApp(svc).request('/search-ingredients?q=oat');
    expect(res.status).toBe(200);
    const [, sources] = svc.searchByName.mock.calls[0] as [string, Set<IngredientSource>];
    expect(sources).toEqual(new Set(['OFF']));
    expect(sources.has('FOODS')).toBe(false);
  });

  it('passes FOODS-only set when sources=foods', async () => {
    const svc = makeService();
    await makeApp(svc).request('/search-ingredients?q=oat&sources=foods');
    const [, sources] = svc.searchByName.mock.calls[0] as [string, Set<IngredientSource>];
    expect(sources).toEqual(new Set(['FOODS']));
  });

  it('passes both sources when sources=foods,off', async () => {
    const svc = makeService();
    await makeApp(svc).request('/search-ingredients?q=oat&sources=foods,off');
    const [, sources] = svc.searchByName.mock.calls[0] as [string, Set<IngredientSource>];
    expect(sources).toEqual(new Set(['FOODS', 'OFF']));
  });

  it('passes FOODS, USER, OFF when sources=foods,user,off', async () => {
    const svc = makeService();
    await makeApp(svc).request('/search-ingredients?q=oat&sources=foods,user,off');
    const [, sources] = svc.searchByName.mock.calls[0] as [string, Set<IngredientSource>];
    expect(sources).toEqual(new Set(['FOODS', 'USER', 'OFF']));
  });

  it('ignores unknown values in sources param', async () => {
    const svc = makeService();
    await makeApp(svc).request('/search-ingredients?q=oat&sources=foods,unknown');
    const [, sources] = svc.searchByName.mock.calls[0] as [string, Set<IngredientSource>];
    expect(sources).toEqual(new Set(['FOODS']));
    expect(sources.has('OFF')).toBe(false);
  });

  it('treats legacy "bls" as unknown and falls back to default OFF', async () => {
    const svc = makeService();
    await makeApp(svc).request('/search-ingredients?q=oat&sources=bls');
    const [, sources] = svc.searchByName.mock.calls[0] as [string, Set<IngredientSource>];
    expect(sources).toEqual(new Set(['OFF']));
  });

  it('returns 400 when q is missing', async () => {
    const svc = makeService();
    const res = await makeApp(svc).request('/search-ingredients');
    expect(res.status).toBe(400);
  });
});
