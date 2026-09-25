import type { Context } from 'hono';
import { replaceBatchIngredient } from '../../domain/meal-log/replace-batch-ingredient.use-case.ts';
import type { LogEntryRepository } from '../../domain/meal-log/log-entry.repository.ts';

export function makeReplaceBatchIngredientHandler(logRepo: LogEntryRepository) {
  return async (c: Context) => {
    try {
      const body = await c.req.json();
      const entry = await replaceBatchIngredient(logRepo, { entryId: body?.entryId, ingredient: body?.ingredient });
      return c.json(entry, 200);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      const status = message.includes('not found') ? 404 : 400;
      return c.json({ error: message }, status);
    }
  };
}
