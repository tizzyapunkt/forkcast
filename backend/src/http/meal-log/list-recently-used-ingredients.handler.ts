import type { Context } from 'hono';
import { listRecentlyUsedIngredients } from '../../domain/meal-log/list-recently-used-ingredients.use-case.ts';
import type { LogEntryRepository } from '../../domain/meal-log/log-entry.repository.ts';

export function makeListRecentlyUsedIngredientsHandler(repo: LogEntryRepository) {
  return async (c: Context) => {
    const recents = await listRecentlyUsedIngredients(repo);
    return c.json(recents);
  };
}
