import type { Context } from 'hono';
import type {
  IngredientSearchService,
  IngredientSource,
} from '../../domain/ingredient-search/ingredient-search.service.ts';

const VALID_SOURCES = new Set<string>(['bls', 'off']);
const SOURCE_MAP: Record<string, IngredientSource> = { bls: 'BLS', off: 'OFF' };

function parseSources(param: string | undefined): Set<IngredientSource> {
  if (!param?.trim()) return new Set(['BLS']);
  const parsed = param
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => VALID_SOURCES.has(s))
    .map((s) => SOURCE_MAP[s]!);
  return parsed.length > 0 ? new Set(parsed) : new Set(['BLS']);
}

export function makeSearchIngredientsByNameHandler(service: IngredientSearchService) {
  return async (c: Context) => {
    const q = c.req.query('q') ?? '';
    if (!q.trim()) return c.json({ error: 'Missing query parameter: q' }, 400);
    const sources = parseSources(c.req.query('sources'));
    const results = await service.searchByName(q, sources);
    return c.json(results);
  };
}

export function makeSearchIngredientsByBarcodeHandler(service: IngredientSearchService) {
  return async (c: Context) => {
    const barcode = c.req.param('barcode') ?? '';
    const result = await service.searchByBarcode(barcode);
    if (!result) return c.json({ error: 'Product not found' }, 404);
    return c.json(result);
  };
}
