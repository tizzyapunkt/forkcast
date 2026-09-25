import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { makeReplaceBatchIngredientHandler } from './replace-batch-ingredient.handler.ts';
import { makeAddToRecipeBatchHandler } from './add-to-recipe-batch.handler.ts';
import { FakeLogEntryRepository } from '../../domain/meal-log/log-entry-repository.fake.ts';
import type { LogEntry } from '../../domain/meal-log/types.ts';

function entry(id: string, over: Partial<LogEntry> = {}): LogEntry {
  return {
    id,
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
    ...over,
  };
}

const tofu = {
  type: 'full',
  name: 'Tofu',
  unit: 'g',
  macrosPerUnit: { calories: 1.2, protein: 0.12, carbs: 0.02, fat: 0.07 },
  amount: 250,
};

function makeApp(entries: LogEntry[]) {
  const repo = new FakeLogEntryRepository(entries);
  const app = new Hono();
  app.post('/replace-batch-ingredient', makeReplaceBatchIngredientHandler(repo));
  app.post('/add-to-recipe-batch', makeAddToRecipeBatchHandler(repo));
  const post = (path: string, body: unknown) =>
    app.request(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
  return { repo, post };
}

describe('POST /replace-batch-ingredient', () => {
  it('returns the updated entry, still in its batch', async () => {
    const { post } = makeApp([entry('hack')]);

    const res = await post('/replace-batch-ingredient', { entryId: 'hack', ingredient: tofu });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: 'hack', recipeBatchId: 'batch-1', ingredient: tofu });
  });

  it('returns 404 for an unknown entry', async () => {
    const { post } = makeApp([entry('hack')]);
    const res = await post('/replace-batch-ingredient', { entryId: 'nope', ingredient: tofu });
    expect(res.status).toBe(404);
  });

  it.each([
    ['an ad-hoc entry', { entryId: 'adhoc', ingredient: tofu }],
    ['a non-positive amount', { entryId: 'hack', ingredient: { ...tofu, amount: 0 } }],
    ['a missing ingredient', { entryId: 'hack' }],
    ['a malformed body', 'not json'],
  ])('returns 400 for %s and changes nothing', async (_label, body) => {
    const adhoc = entry('adhoc', { recipeId: undefined, recipeBatchId: undefined, recipePortions: undefined });
    const { repo, post } = makeApp([entry('hack'), adhoc]);
    const before = repo.all();

    const res = await post('/replace-batch-ingredient', body);

    expect(res.status).toBe(400);
    expect(repo.all()).toEqual(before);
  });
});

describe('POST /add-to-recipe-batch', () => {
  it('returns 201 with the created entry in the batch', async () => {
    const { repo, post } = makeApp([entry('hack')]);

    const res = await post('/add-to-recipe-batch', { recipeBatchId: 'batch-1', date: '2026-09-29', ingredient: tofu });

    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ recipeBatchId: 'batch-1', slot: 'dinner', ingredient: tofu });
    expect(repo.all()).toHaveLength(2);
  });

  it('returns 404 when the batch has no entries on that date', async () => {
    const { repo, post } = makeApp([entry('hack')]);

    const res = await post('/add-to-recipe-batch', { recipeBatchId: 'batch-1', date: '2026-09-30', ingredient: tofu });

    expect(res.status).toBe(404);
    expect(repo.all()).toHaveLength(1);
  });

  it.each([
    ['a non-positive amount', { recipeBatchId: 'batch-1', date: '2026-09-29', ingredient: { ...tofu, amount: -1 } }],
    ['a missing ingredient', { recipeBatchId: 'batch-1', date: '2026-09-29' }],
    ['a malformed body', 'not json'],
  ])('returns 400 for %s and creates nothing', async (_label, body) => {
    const { repo, post } = makeApp([entry('hack')]);

    const res = await post('/add-to-recipe-batch', body);

    expect(res.status).toBe(400);
    expect(repo.all()).toHaveLength(1);
  });
});
