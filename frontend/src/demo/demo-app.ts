import { createApp } from '../../../backend/src/app.ts';
import type { JsonDocument } from '../../../backend/src/infrastructure/json-document/json-document.ts';
import { InMemoryJsonDocument } from '../../../backend/src/infrastructure/json-document/in-memory-json-document.ts';
import { JsonLogEntryRepository } from '../../../backend/src/infrastructure/meal-log/json-log-entry.repository.ts';
import { JsonFavoriteIngredientRepository } from '../../../backend/src/infrastructure/favorite-ingredients/json-favorite-ingredient.repository.ts';
import { JsonNutritionGoalRepository } from '../../../backend/src/infrastructure/nutrition/json-nutrition-goal.repository.ts';
import { JsonBodyProfileRepository } from '../../../backend/src/infrastructure/body-profile/json-body-profile.repository.ts';
import { JsonWeightLogRepository } from '../../../backend/src/infrastructure/weight-log/json-weight-log.repository.ts';
import { JsonRecipeRepository } from '../../../backend/src/infrastructure/recipes/json-recipe.repository.ts';
import { JsonScannedProductStore } from '../../../backend/src/infrastructure/scanned-products/json-scanned-products.store.ts';
import { JsonCatalogStore } from '../../../backend/src/infrastructure/food-catalog/json-catalog.store.ts';
import { OpenFoodFactsService } from '../../../backend/src/infrastructure/ingredient-search/open-food-facts.service.ts';
import { DiagnosticsLog } from '../../../backend/src/domain/diagnostics/diagnostics-log.ts';
import type { SeedCall } from './seed-demo-week';
import catalogSeed from '../../../backend/data/catalog.json?raw';

/**
 * The real backend app for the demo: every document comes from `documentFor`, the catalog starts
 * from the same seed a fresh server installs, and there is no auth and no AI.
 */
export async function buildDemoApp(
  documentFor: (name: string) => JsonDocument,
  offFetch: typeof fetch = globalThis.fetch,
): Promise<ReturnType<typeof createApp>> {
  const catalog = new JsonCatalogStore({
    document: documentFor('catalog'),
    seed: new InMemoryJsonDocument(catalogSeed, 'catalog-seed'),
  });
  await catalog.init();
  return createApp({
    logEntries: new JsonLogEntryRepository(documentFor('log-entries')),
    favoriteIngredients: new JsonFavoriteIngredientRepository(documentFor('favorite-ingredients')),
    nutritionGoal: new JsonNutritionGoalRepository(documentFor('nutrition-goal')),
    bodyProfile: new JsonBodyProfileRepository(documentFor('body-profile')),
    weightLog: new JsonWeightLogRepository(documentFor('weight-log')),
    recipes: new JsonRecipeRepository(documentFor('recipes')),
    scannedProducts: new JsonScannedProductStore(documentFor('scanned-products')),
    catalog,
    openFoodFacts: new OpenFoodFactsService(offFetch),
    diagnostics: new DiagnosticsLog(),
    ai: null,
  });
}

/** Seeds through the app the same way the seed script goes through HTTP. */
export function seedCallFor(app: ReturnType<typeof createApp>): SeedCall {
  return async (method, path, body) => {
    const res = await app.request(path, {
      method,
      headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Demo seed: ${method} ${path} → ${res.status}: ${text}`);
    return (text ? JSON.parse(text) : undefined) as never;
  };
}
