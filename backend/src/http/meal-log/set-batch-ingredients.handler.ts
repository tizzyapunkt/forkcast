import type { Context } from 'hono';
import { setBatchIngredients } from '../../domain/meal-log/set-batch-ingredients.use-case.ts';
import type { LogEntryRepository } from '../../domain/meal-log/log-entry.repository.ts';

export function makeSetBatchIngredientsHandler(logRepo: LogEntryRepository) {
  return async (c: Context) => {
    try {
      const body = await c.req.json();
      const entries = await setBatchIngredients(logRepo, { changes: body?.changes });
      return c.json(entries);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      const status = message.includes('not found') ? 404 : 400;
      return c.json({ error: message }, status);
    }
  };
}
