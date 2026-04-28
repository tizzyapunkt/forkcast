import type { Context } from 'hono';
import { getDailyLog } from '../../domain/meal-log/get-daily-log.use-case.ts';
import type { LogEntryRepository } from '../../domain/meal-log/log-entry.repository.ts';

export function makeGetDailyLogHandler(repo: LogEntryRepository) {
  return async (c: Context) => {
    const date = c.req.param('date') ?? new Date().toISOString().slice(0, 10);
    const log = await getDailyLog(repo, date);
    return c.json(log);
  };
}
