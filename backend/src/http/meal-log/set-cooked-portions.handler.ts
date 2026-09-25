import type { Context } from 'hono';
import { setCookedPortions } from '../../domain/meal-log/set-cooked-portions.use-case.ts';
import type { LogEntryRepository } from '../../domain/meal-log/log-entry.repository.ts';

export function makeSetCookedPortionsHandler(logRepo: LogEntryRepository) {
  return async (c: Context) => {
    try {
      const body = await c.req.json();
      const entries = await setCookedPortions(logRepo, {
        recipeBatchId: body?.recipeBatchId,
        date: body?.date,
        cookedPortions: body?.cookedPortions,
      });
      return c.json(entries, 200);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      const status = message.includes('not found') ? 404 : 400;
      return c.json({ error: message }, status);
    }
  };
}
