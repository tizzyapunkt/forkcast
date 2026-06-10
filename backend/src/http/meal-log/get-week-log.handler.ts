import type { Context } from 'hono';
import { getWeekLog } from '../../domain/meal-log/get-week-log.use-case.ts';
import type { LogEntryRepository } from '../../domain/meal-log/log-entry.repository.ts';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function makeGetWeekLogHandler(repo: LogEntryRepository) {
  return async (c: Context) => {
    const startDate = c.req.param('startDate');
    if (!startDate || !ISO_DATE.test(startDate)) {
      return c.json({ error: 'startDate must be an ISO date (YYYY-MM-DD)' }, 400);
    }
    const week = await getWeekLog(repo, startDate);
    return c.json(week);
  };
}
