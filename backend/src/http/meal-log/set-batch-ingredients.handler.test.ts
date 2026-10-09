import { describe, it, expect } from 'vite-plus/test';
import { Hono } from 'hono';
import { makeSetBatchIngredientsHandler } from './set-batch-ingredients.handler.ts';
import { FakeLogEntryRepository } from '../../domain/meal-log/log-entry-repository.fake.ts';

const MACROS = { calories: 1, protein: 0, carbs: 0.2, fat: 0 };

function makeApp() {
  const repo = new FakeLogEntryRepository([
    {
      id: 'mo-k',
      date: '2026-10-12',
      slot: 'dinner',
      loggedAt: '',
      recipeId: 'pasta',
      recipeBatchId: 'mo',
      recipePortions: 1,
      ingredient: { type: 'full', name: 'Ketchup', unit: 'ml', macrosPerUnit: MACROS, amount: 50 },
    },
  ]);
  const app = new Hono();
  app.post('/set-batch-ingredients', makeSetBatchIngredientsHandler(repo));
  return { app, repo };
}

const post = (app: Hono, body: unknown) =>
  app.request('/set-batch-ingredients', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

const ketchup = (amount: number) => ({ type: 'full', name: 'Ketchup', unit: 'ml', macrosPerUnit: MACROS, amount });

describe('POST /set-batch-ingredients', () => {
  it('writes the batches and returns the written entries', async () => {
    const { app, repo } = makeApp();

    const res = await post(app, {
      changes: [{ recipeBatchId: 'mo', date: '2026-10-12', remove: [], set: [ketchup(100)] }],
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject([{ id: 'mo-k', ingredient: { amount: 100 } }]);
    expect(repo.all()[0]!.ingredient).toMatchObject({ amount: 100 });
  });

  it('returns 404 for an unknown batch', async () => {
    const res = await post(makeApp().app, {
      changes: [{ recipeBatchId: 'nope', date: '2026-10-12', remove: [], set: [ketchup(100)] }],
    });
    expect(res.status).toBe(404);
  });

  it.each([
    ['no changes', { changes: [] }],
    [
      'a non-positive amount',
      { changes: [{ recipeBatchId: 'mo', date: '2026-10-12', remove: [], set: [ketchup(0)] }] },
    ],
    ['a missing date', { changes: [{ recipeBatchId: 'mo', remove: [], set: [ketchup(10)] }] }],
    ['a malformed body', 'nope'],
  ])('returns 400 for %s', async (_label, body) => {
    const res = await post(makeApp().app, body);
    expect(res.status).toBe(400);
  });
});
