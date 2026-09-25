import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { makeRemoveRecipeLogHandler } from './remove-recipe-log.handler.ts';
import { FakeLogEntryRepository } from '../../domain/meal-log/log-entry-repository.fake.ts';
import type { LogEntry } from '../../domain/meal-log/types.ts';

function entry(id: string, batchId?: string, date = '2026-06-11'): LogEntry {
  return {
    id,
    date,
    slot: 'lunch',
    loggedAt: '2026-06-11T12:00:00.000Z',
    ...(batchId !== undefined ? { recipeId: 'rec-1', recipeBatchId: batchId, recipePortions: 1 } : {}),
    ingredient: {
      type: 'full',
      name: 'Rice',
      unit: 'g',
      macrosPerUnit: { calories: 1.3, protein: 0.027, carbs: 0.28, fat: 0.003 },
      amount: 100,
    },
  };
}

function makeApp(all: LogEntry[]) {
  const repo = new FakeLogEntryRepository(all);
  const app = new Hono();
  app.post('/remove-recipe-log', makeRemoveRecipeLogHandler(repo));
  const post = (body: unknown) =>
    app.request('/remove-recipe-log', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  return { repo, post, ids: () => repo.all().map((e) => e.id) };
}

describe('POST /remove-recipe-log', () => {
  it('removes the batch on that date and returns the removed count', async () => {
    const { post, ids } = makeApp([entry('a', 'batch-1'), entry('b', 'batch-1'), entry('c', 'batch-2')]);

    const res = await post({ recipeBatchId: 'batch-1', date: '2026-06-11' });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ removed: 2 });
    expect(ids()).toEqual(['c']);
  });

  it('only removes the batch entries on the given date', async () => {
    const { post, ids } = makeApp([entry('mon', 'batch-1', '2026-06-08'), entry('tue', 'batch-1', '2026-06-09')]);

    const res = await post({ recipeBatchId: 'batch-1', date: '2026-06-09' });

    expect(res.status).toBe(200);
    expect(ids()).toEqual(['mon']);
  });

  it('returns 404 for an unknown batch id and removes nothing', async () => {
    const { post, ids } = makeApp([entry('a', 'batch-1')]);
    const res = await post({ recipeBatchId: 'missing', date: '2026-06-11' });
    expect(res.status).toBe(404);
    expect(ids()).toEqual(['a']);
  });

  it('returns 400 when recipeBatchId is missing', async () => {
    const { post, ids } = makeApp([entry('a', 'batch-1')]);
    const res = await post({ date: '2026-06-11' });
    expect(res.status).toBe(400);
    expect(ids()).toEqual(['a']);
  });

  it('returns 400 when date is missing', async () => {
    const { post, ids } = makeApp([entry('a', 'batch-1')]);
    const res = await post({ recipeBatchId: 'batch-1' });
    expect(res.status).toBe(400);
    expect(ids()).toEqual(['a']);
  });
});
