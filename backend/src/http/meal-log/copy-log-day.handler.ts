import type { Context } from 'hono';
import { copyLogDay } from '../../domain/meal-log/copy-log-day.use-case.ts';
import type { LogEntryRepository } from '../../domain/meal-log/log-entry.repository.ts';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function makeCopyLogDayHandler(repo: LogEntryRepository) {
  return async (c: Context) => {
    try {
      const body = (await c.req.json()) as { fromDate?: unknown; toDate?: unknown };
      const { fromDate, toDate } = body;
      if (
        typeof fromDate !== 'string' ||
        !ISO_DATE.test(fromDate) ||
        typeof toDate !== 'string' ||
        !ISO_DATE.test(toDate)
      ) {
        return c.json({ error: 'fromDate and toDate must be ISO dates (YYYY-MM-DD)' }, 400);
      }
      const clones = await copyLogDay(repo, { fromDate, toDate });
      return c.json(clones, 201);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return c.json({ error: message }, 400);
    }
  };
}
