import type { Context } from 'hono';
import type { IngredientSearchService } from '../../domain/ingredient-search/ingredient-search.service.ts';

export function makeSearchIngredientsByNameHandler(service: IngredientSearchService) {
  return async (c: Context) => {
    const q = c.req.query('q') ?? '';
    if (!q.trim()) return c.json({ error: 'Missing query parameter: q' }, 400);
    const results = await service.searchByName(q);
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
