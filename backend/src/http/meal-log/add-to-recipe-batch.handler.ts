import type { Context } from 'hono';
import { addToRecipeBatch } from '../../domain/meal-log/add-to-recipe-batch.use-case.ts';
import type { LogEntryRepository } from '../../domain/meal-log/log-entry.repository.ts';

export function makeAddToRecipeBatchHandler(logRepo: LogEntryRepository) {
  return async (c: Context) => {
    try {
      const body = await c.req.json();
      const entry = await addToRecipeBatch(logRepo, {
        recipeBatchId: body?.recipeBatchId,
        date: body?.date,
        ingredient: body?.ingredient,
      });
      return c.json(entry, 201);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      const status = message.includes('not found') ? 404 : 400;
      return c.json({ error: message }, status);
    }
  };
}
