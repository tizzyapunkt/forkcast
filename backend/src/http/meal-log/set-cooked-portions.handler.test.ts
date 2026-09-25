import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { makeSetCookedPortionsHandler } from './set-cooked-portions.handler.ts';
import { FakeLogEntryRepository } from '../../domain/meal-log/log-entry-repository.fake.ts';
import type { LogEntry } from '../../domain/meal-log/types.ts';

const chili: LogEntry = {
  id: 'hack',
  date: '2026-09-29',
  slot: 'dinner',
  loggedAt: '2026-09-25T08:00:00.000Z',
  recipeId: 'chili',
  recipeBatchId: 'batch-1',
  recipePortions: 1,
  ingredient: {
    type: 'full',
    name: 'Hackfleisch',
    unit: 'g',
    macrosPerUnit: { calories: 2.5, protein: 0.2, carbs: 0, fat: 0.2 },
    amount: 250,
  },
};

function makeApp() {
  const repo = new FakeLogEntryRepository([chili]);
  const app = new Hono();
  app.post('/set-cooked-portions', makeSetCookedPortionsHandler(repo));
  const post = (body: unknown) =>
    app.request('/set-cooked-portions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
  return { repo, post };
}

describe('POST /set-cooked-portions', () => {
  it('returns 200 with the updated batch entries', async () => {
    const { post } = makeApp();

    const res = await post({ recipeBatchId: 'batch-1', date: '2026-09-29', cookedPortions: 2 });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject([{ id: 'hack', cookedPortions: 2 }]);
  });

  it('returns 404 for a batch with no entries on that date', async () => {
    const { post } = makeApp();
    const res = await post({ recipeBatchId: 'batch-1', date: '2026-09-30', cookedPortions: 2 });
    expect(res.status).toBe(404);
  });

  it.each([
    ['cooked below the logged portions', { recipeBatchId: 'batch-1', date: '2026-09-29', cookedPortions: 0.5 }],
    ['a missing value', { recipeBatchId: 'batch-1', date: '2026-09-29' }],
    ['a malformed body', 'nope'],
  ])('returns 400 for %s and changes nothing', async (_label, body) => {
    const { repo, post } = makeApp();

    const res = await post(body);

    expect(res.status).toBe(400);
    expect(repo.all()[0]).not.toHaveProperty('cookedPortions');
  });
});
