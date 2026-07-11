import type { Context } from 'hono';
import type {
  IngredientSearchService,
  IngredientSource,
} from '../../domain/ingredient-search/ingredient-search.service.ts';

const SOURCE_MAP: Record<string, IngredientSource> = { foods: 'FOODS', user: 'USER', off: 'OFF' };
const VALID_SOURCES = new Set<string>(Object.keys(SOURCE_MAP));

function parseSources(param: string | undefined): Set<IngredientSource> {
  if (!param?.trim()) return new Set(['OFF']);
  const parsed = param
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => VALID_SOURCES.has(s))
    .map((s) => SOURCE_MAP[s]!);
  return parsed.length > 0 ? new Set(parsed) : new Set(['OFF']);
}

export function makeSearchIngredientsByNameHandler(service: IngredientSearchService) {
  return async (c: Context) => {
    const q = c.req.query('q') ?? '';
    if (!q.trim()) return c.json({ error: 'Missing query parameter: q' }, 400);
    const sources = parseSources(c.req.query('sources'));
    try {
      const results = await service.searchByName(q, sources);
      return c.json(results);
    } catch (err) {
      console.error('search-ingredients failed:', err);
      return c.json({ error: 'Ingredient search failed. Please try again.' }, 502);
    }
  };
}

export function makeSearchIngredientsByBarcodeHandler(service: IngredientSearchService) {
  return async (c: Context) => {
    const barcode = c.req.param('barcode') ?? '';
    try {
      const result = await service.searchByBarcode(barcode);
      if (!result) return c.json({ error: 'Product not found' }, 404);
      return c.json(result);
    } catch (err) {
      console.error('search-ingredients/barcode failed:', err);
      return c.json({ error: 'Ingredient search failed. Please try again.' }, 502);
    }
  };
}
