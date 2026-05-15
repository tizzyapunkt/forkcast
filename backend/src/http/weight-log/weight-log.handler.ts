import type { Context } from 'hono';
import type { WeightLogRepository } from '../../domain/weight-log/weight-log.repository.ts';
import { logWeight } from '../../domain/weight-log/log-weight.use-case.ts';
import { listWeightEntries } from '../../domain/weight-log/list-weight-entries.use-case.ts';
import { removeWeight } from '../../domain/weight-log/remove-weight.use-case.ts';
import { getWeightTrend } from '../../domain/weight-log/get-weight-trend.use-case.ts';
import { WeightEntryValidationError } from '../../domain/weight-log/validate-weight-entry.ts';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function makeLogWeightHandler(repo: WeightLogRepository) {
  return async (c: Context) => {
    const body = await c.req.json();
    try {
      const result = await logWeight(repo, body, today());
      return c.json(result);
    } catch (err) {
      if (err instanceof WeightEntryValidationError) {
        return c.json({ error: err.message }, 400);
      }
      throw err;
    }
  };
}

export function makeListWeightEntriesHandler(repo: WeightLogRepository) {
  return async (c: Context) => {
    const from = c.req.query('from');
    const to = c.req.query('to');
    const entries = await listWeightEntries(repo, { from, to });
    return c.json({ entries });
  };
}

export function makeRemoveWeightHandler(repo: WeightLogRepository) {
  return async (c: Context) => {
    const date = c.req.param('date');
    if (!date || !DATE_PATTERN.test(date)) {
      return c.json({ error: 'date must match YYYY-MM-DD' }, 400);
    }
    await removeWeight(repo, date);
    return c.body(null, 204);
  };
}

export function makeGetWeightTrendHandler(repo: WeightLogRepository) {
  return async (c: Context) => {
    const asOf = c.req.query('asOf') ?? today();
    const trend = await getWeightTrend(repo, asOf);
    return c.json(trend);
  };
}
