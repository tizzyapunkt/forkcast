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
    source: 'BLS',
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
  it('defaults to BLS-only when sources param is absent', async () => {
    const svc = makeService();
    const res = await makeApp(svc).request('/search-ingredients?q=oat');
    expect(res.status).toBe(200);
    const [, sources] = svc.searchByName.mock.calls[0] as [string, Set<IngredientSource>];
    expect(sources).toEqual(new Set(['BLS']));
    expect(sources.has('OFF')).toBe(false);
  });

  it('passes BLS-only set when sources=bls', async () => {
    const svc = makeService();
    await makeApp(svc).request('/search-ingredients?q=oat&sources=bls');
    const [, sources] = svc.searchByName.mock.calls[0] as [string, Set<IngredientSource>];
    expect(sources).toEqual(new Set(['BLS']));
  });

  it('passes both sources when sources=bls,off', async () => {
    const svc = makeService();
    await makeApp(svc).request('/search-ingredients?q=oat&sources=bls,off');
    const [, sources] = svc.searchByName.mock.calls[0] as [string, Set<IngredientSource>];
    expect(sources).toEqual(new Set(['BLS', 'OFF']));
  });

  it('ignores unknown values in sources param', async () => {
    const svc = makeService();
    await makeApp(svc).request('/search-ingredients?q=oat&sources=bls,unknown');
    const [, sources] = svc.searchByName.mock.calls[0] as [string, Set<IngredientSource>];
    expect(sources).toEqual(new Set(['BLS']));
    expect(sources.has('OFF')).toBe(false);
  });

  it('returns 400 when q is missing', async () => {
    const svc = makeService();
    const res = await makeApp(svc).request('/search-ingredients');
    expect(res.status).toBe(400);
  });
});
