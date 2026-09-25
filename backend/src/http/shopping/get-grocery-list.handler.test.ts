import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { makeGetGroceryListHandler } from './get-grocery-list.handler.ts';
import { FakeLogEntryRepository } from '../../domain/meal-log/log-entry-repository.fake.ts';
import { FakeCatalogStore } from '../../domain/food-catalog/catalog-store.fake.ts';
import type { RecipeRepository } from '../../domain/recipes/recipe.repository.ts';

const noRecipes: RecipeRepository = {
  save: async () => {},
  findAll: async () => [],
  findById: async () => null,
  update: async () => {},
  remove: async () => {},
};

function makeApp() {
  const logEntries = new FakeLogEntryRepository([
    {
      id: 'a',
      date: '2026-09-29',
      slot: 'lunch',
      loggedAt: '',
      ingredient: {
        type: 'full',
        name: 'Reis',
        unit: 'g',
        macrosPerUnit: { calories: 1.3, protein: 0, carbs: 0.3, fat: 0 },
        amount: 120,
      },
    },
    {
      id: 'b',
      date: '2026-09-29',
      slot: 'snack',
      loggedAt: '',
      ingredient: { type: 'quick', label: 'Keks', calories: 90 },
    },
  ]);
  const app = new Hono();
  app.get(
    '/grocery-list/:startDate',
    makeGetGroceryListHandler({ logEntries, recipes: noRecipes, catalog: new FakeCatalogStore() }),
  );
  return app;
}

describe('GET /grocery-list/:startDate', () => {
  it('returns the grocery list for the week', async () => {
    const res = await makeApp().request('/grocery-list/2026-09-28');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      startDate: '2026-09-28',
      items: [{ name: 'Reis', unit: 'g', amount: 120, untracked: false, dates: ['2026-09-29'] }],
      skippedQuickEntries: 1,
    });
  });

  it('returns 400 for a malformed date', async () => {
    const res = await makeApp().request('/grocery-list/next-week');
    expect(res.status).toBe(400);
  });
});
