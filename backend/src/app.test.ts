import { describe, it, expect, beforeEach, vi } from 'vite-plus/test';
import { createApp, type AppDeps } from './app.ts';
import { InMemoryJsonDocument } from './infrastructure/json-document/in-memory-json-document.ts';
import { JsonLogEntryRepository } from './infrastructure/meal-log/json-log-entry.repository.ts';
import { JsonFavoriteIngredientRepository } from './infrastructure/favorite-ingredients/json-favorite-ingredient.repository.ts';
import { JsonNutritionGoalRepository } from './infrastructure/nutrition/json-nutrition-goal.repository.ts';
import { JsonBodyProfileRepository } from './infrastructure/body-profile/json-body-profile.repository.ts';
import { JsonWeightLogRepository } from './infrastructure/weight-log/json-weight-log.repository.ts';
import { JsonRecipeRepository } from './infrastructure/recipes/json-recipe.repository.ts';
import { JsonScannedProductStore } from './infrastructure/scanned-products/json-scanned-products.store.ts';
import { JsonCatalogStore } from './infrastructure/food-catalog/json-catalog.store.ts';
import { DiagnosticsLog } from './domain/diagnostics/diagnostics-log.ts';
import type { IngredientSearchService } from './domain/ingredient-search/ingredient-search.service.ts';
import type { FoodEntry } from './domain/foods/types.ts';

const PASSWORD = 'correct-horse-battery-staple';
const SECRET = 'test-jwt-secret-long-enough-for-hs256';

const moehre: FoodEntry = {
  id: 'moehre',
  name: 'Möhre',
  nameEn: 'Carrot',
  synonyms: ['Karotte'],
  unit: 'g',
  macrosPer100: { calories: 41, protein: 0.9, carbs: 9.6, fat: 0.2 },
};

const noOpenFoodFacts: IngredientSearchService = {
  searchByName: async () => [],
  searchByBarcode: async () => null,
};

/** The whole app over in-memory documents: nothing here touches the disk. */
async function inMemoryDeps(): Promise<AppDeps> {
  const doc = (label: string) => new InMemoryJsonDocument(null, label);
  const catalog = new JsonCatalogStore({
    document: doc('catalog'),
    seed: new InMemoryJsonDocument(JSON.stringify([moehre]), 'seed'),
  });
  await catalog.init();
  return {
    auth: { password: PASSWORD, jwtSecret: SECRET },
    logEntries: new JsonLogEntryRepository(doc('log-entries')),
    favoriteIngredients: new JsonFavoriteIngredientRepository(doc('favorite-ingredients')),
    nutritionGoal: new JsonNutritionGoalRepository(doc('nutrition-goal')),
    bodyProfile: new JsonBodyProfileRepository(doc('body-profile')),
    weightLog: new JsonWeightLogRepository(doc('weight-log')),
    recipes: new JsonRecipeRepository(doc('recipes')),
    scannedProducts: new JsonScannedProductStore(doc('scanned-products')),
    catalog,
    openFoodFacts: noOpenFoodFacts,
    diagnostics: new DiagnosticsLog(),
    ai: null,
  };
}

async function logIn(app: ReturnType<typeof createApp>): Promise<string> {
  const res = await app.request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: PASSWORD }),
  });
  expect(res.status).toBe(200);
  return res.headers.get('set-cookie')!.split(';')[0]!;
}

describe('createApp', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('rejects an unauthenticated request', async () => {
    const app = createApp(await inMemoryDeps());
    const res = await app.request('/daily-log/2026-10-12');
    expect(res.status).toBe(401);
  });

  it('logs an ingredient and reads it back from the daily log', async () => {
    const app = createApp(await inMemoryDeps());
    const cookie = await logIn(app);

    const logged = await app.request('/log-ingredient', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        date: '2026-10-12',
        slot: 'breakfast',
        ingredient: { type: 'quick', label: 'Coffee', calories: 5 },
      }),
    });
    expect(logged.status).toBe(201);

    const day = await app.request('/daily-log/2026-10-12', { headers: { Cookie: cookie } });
    expect(day.status).toBe(200);
    expect(JSON.stringify(await day.json())).toContain('Coffee');
  });

  it('finds a catalog food by its English name', async () => {
    const app = createApp(await inMemoryDeps());
    const cookie = await logIn(app);

    const res = await app.request('/search-ingredients?q=carrot&locale=en', { headers: { Cookie: cookie } });
    expect(res.status).toBe(200);
    const results = (await res.json()) as { name: string; source: string }[];
    expect(results[0]).toMatchObject({ name: 'Carrot', source: 'CATALOG' });
  });

  it('answers the AI routes as not configured when no AI is wired', async () => {
    const app = createApp(await inMemoryDeps());
    const cookie = await logIn(app);

    const res = await app.request('/import-recipe-from-photos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ images: [] }),
    });
    expect(res.status).toBe(503);
  });
});
