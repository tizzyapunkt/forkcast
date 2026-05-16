import type { Context } from 'hono';
import type {
  UnmatchedIngredientCleaner,
  UnmatchedIngredientReader,
} from '../../domain/unmatched-ingredients/types.ts';

export function makeExportUnmatchedIngredientsHandler(reader: UnmatchedIngredientReader) {
  return async (c: Context) => {
    const store = await reader.load();
    return c.json({ entries: store.entries });
  };
}

export function makeClearUnmatchedIngredientsHandler(cleaner: UnmatchedIngredientCleaner) {
  return async (c: Context) => {
    await cleaner.clear();
    return c.body(null, 204);
  };
}
