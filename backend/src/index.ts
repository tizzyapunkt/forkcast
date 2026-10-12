import { serve } from '@hono/node-server';
import Anthropic from '@anthropic-ai/sdk';
import { createApp, type AiDeps } from './app.ts';
import { bootstrap } from './bootstrap.ts';
import { loadAppConfig, type AppConfig } from './config/app-config.ts';
import { DotenvEnvSource } from './infrastructure/config/dotenv-env-source.ts';
import { FileJsonDocument } from './infrastructure/json-document/file-json-document.ts';
import { JsonLogEntryRepository } from './infrastructure/meal-log/json-log-entry.repository.ts';
import { JsonFavoriteIngredientRepository } from './infrastructure/favorite-ingredients/json-favorite-ingredient.repository.ts';
import { JsonNutritionGoalRepository } from './infrastructure/nutrition/json-nutrition-goal.repository.ts';
import { JsonBodyProfileRepository } from './infrastructure/body-profile/json-body-profile.repository.ts';
import { JsonWeightLogRepository } from './infrastructure/weight-log/json-weight-log.repository.ts';
import { JsonRecipeRepository } from './infrastructure/recipes/json-recipe.repository.ts';
import { JsonScannedProductStore } from './infrastructure/scanned-products/json-scanned-products.store.ts';
import { JsonCatalogStore } from './infrastructure/food-catalog/json-catalog.store.ts';
import { OpenFoodFactsService } from './infrastructure/ingredient-search/open-food-facts.service.ts';
import { AnthropicRecipeDraftExtractor } from './infrastructure/ai-recipe-import/anthropic-recipe-draft-extractor.ts';
import { AnthropicProductDraftExtractor } from './infrastructure/barcode-product-capture/anthropic-product-draft-extractor.ts';
import { AnthropicFoodResolutionProposer } from './infrastructure/food-resolution/anthropic-food-resolution-proposer.ts';
import { AnthropicCatalogEntryDrafter } from './infrastructure/food-catalog/anthropic-catalog-entry-drafter.ts';
import { DiagnosticsLog } from './domain/diagnostics/diagnostics-log.ts';

const envSource = new DotenvEnvSource();
let config;
try {
  config = loadAppConfig(envSource);
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}

if (!config.ai.anthropicApiKey) {
  console.warn(
    'ANTHROPIC_API_KEY is not set — POST /import-recipe-from-photos and POST /extract-product-from-photos will return 503 ai-import-not-configured',
  );
}

// The runtime catalog lives in the data volume; the image's copy is only a starting
// point, installed by the store when the volume has no catalog yet.
const catalogStore = new JsonCatalogStore({
  document: new FileJsonDocument(config.catalog.path),
  seed: new FileJsonDocument(config.catalog.seedPath),
});

try {
  await bootstrap([catalogStore]);
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}

const diagnostics = new DiagnosticsLog();

const app = createApp({
  auth: config.auth,
  logEntries: new JsonLogEntryRepository(new FileJsonDocument('./data/log-entries.json')),
  favoriteIngredients: new JsonFavoriteIngredientRepository(new FileJsonDocument('./data/favorite-ingredients.json')),
  nutritionGoal: new JsonNutritionGoalRepository(new FileJsonDocument('./data/nutrition-goal.json')),
  bodyProfile: new JsonBodyProfileRepository(new FileJsonDocument('./data/body-profile.json')),
  weightLog: new JsonWeightLogRepository(new FileJsonDocument('./data/weight-log.json')),
  recipes: new JsonRecipeRepository(new FileJsonDocument('./data/recipes.json')),
  scannedProducts: new JsonScannedProductStore(new FileJsonDocument('./data/scanned-products.json')),
  catalog: catalogStore,
  openFoodFacts: new OpenFoodFactsService(globalThis.fetch, diagnostics),
  diagnostics,
  ai: anthropicDeps(config),
});

serve({ fetch: app.fetch, port: 3000 }, () => {
  console.log('forkcast backend running on http://localhost:3000');
});

/** The Anthropic-backed AI adapters, or null when no API key is configured. */
function anthropicDeps(config: AppConfig): AiDeps | null {
  if (!config.ai.anthropicApiKey) return null;
  const client = new Anthropic({ apiKey: config.ai.anthropicApiKey });
  return {
    recipeDraftExtractor: new AnthropicRecipeDraftExtractor({ client, model: config.ai.model }),
    productDraftExtractor: new AnthropicProductDraftExtractor({ client, model: config.ai.model }),
    resolutionProposer: new AnthropicFoodResolutionProposer({ client, model: config.ai.resolutionModel }),
    catalogEntryDrafter: new AnthropicCatalogEntryDrafter({ client, model: config.ai.resolutionModel }),
    imageLimits: {
      maxImages: config.ai.recipeImport.maxImages,
      maxImageBytes: config.ai.recipeImport.maxImageBytes,
      maxTotalBytes: config.ai.recipeImport.maxTotalBytes,
    },
  };
}
