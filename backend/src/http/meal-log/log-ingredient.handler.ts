import type { Context } from 'hono';
import { logIngredient } from '../../domain/meal-log/log-ingredient.use-case.js';
import type { LogEntryRepository } from '../../domain/meal-log/log-entry.repository.js';

export function makeLogIngredientHandler(repo: LogEntryRepository) {
  return async (c: Context) => {
    const body = await c.req.json<{ date: string; slot: string; ingredient: unknown }>();
    const entry = await logIngredient(repo, body as Parameters<typeof logIngredient>[1]);
    return c.json(entry, 201);
  };
}
