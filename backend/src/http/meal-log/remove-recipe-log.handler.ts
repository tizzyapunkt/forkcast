import type { Context } from 'hono';
import { removeRecipeLog } from '../../domain/meal-log/remove-recipe-log.use-case.ts';
import type { LogEntryRepository } from '../../domain/meal-log/log-entry.repository.ts';

export function makeRemoveRecipeLogHandler(logRepo: LogEntryRepository) {
  return async (c: Context) => {
    try {
      const body = await c.req.json();
      const removed = await removeRecipeLog(logRepo, body?.recipeBatchId);
      return c.json({ removed }, 200);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      const status = message.includes('not found') ? 404 : 400;
      return c.json({ error: message }, status);
    }
  };
}
