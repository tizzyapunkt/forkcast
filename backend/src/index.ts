import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { bootstrap } from './bootstrap.ts';
import { JsonLogEntryRepository } from './infrastructure/meal-log/json-log-entry.repository.ts';
import { JsonNutritionGoalRepository } from './infrastructure/nutrition/json-nutrition-goal.repository.ts';
import { JsonBodyProfileRepository } from './infrastructure/body-profile/json-body-profile.repository.ts';
import { JsonWeightLogRepository } from './infrastructure/weight-log/json-weight-log.repository.ts';
import { JsonRecipeRepository } from './infrastructure/recipes/json-recipe.repository.ts';
import { JsonScannedProductStore } from './infrastructure/scanned-products/json-scanned-products.store.ts';
import { JsonUserFoodsStore } from './infrastructure/user-foods/json-user-foods.store.ts';
import { UserFoodsSearchService } from './infrastructure/user-foods/user-foods-search.service.ts';
import { makeLogIngredientHandler } from './http/meal-log/log-ingredient.handler.ts';
import { makeGetDailyLogHandler } from './http/meal-log/get-daily-log.handler.ts';
import { makeGetWeekLogHandler } from './http/meal-log/get-week-log.handler.ts';
import { makeCopyLogDayHandler } from './http/meal-log/copy-log-day.handler.ts';
import { makeEditLogEntryHandler, makeRemoveLogEntryHandler } from './http/meal-log/edit-remove-log-entry.handler.ts';
import { makeListRecentlyUsedIngredientsHandler } from './http/meal-log/list-recently-used-ingredients.handler.ts';
import { makeLogRecipeHandler } from './http/meal-log/log-recipe.handler.ts';
import { makeRemoveRecipeLogHandler } from './http/meal-log/remove-recipe-log.handler.ts';
import { makeSetNutritionGoalHandler, makeGetNutritionGoalHandler } from './http/nutrition/nutrition-goal.handler.ts';
import {
  makeGetBodyProfileHandler,
  makeSaveBodyProfileHandler,
  makeApplyBodyProfileAsGoalsHandler,
} from './http/body-profile/body-profile.handler.ts';
import {
  makeLogWeightHandler,
  makeListWeightEntriesHandler,
  makeRemoveWeightHandler,
  makeGetWeightTrendHandler,
} from './http/weight-log/weight-log.handler.ts';
import { OpenFoodFactsService } from './infrastructure/ingredient-search/open-food-facts.service.ts';
import { InMemoryFoodsService } from './infrastructure/ingredient-search/in-memory-foods.service.ts';
import { CompositeIngredientSearchService } from './infrastructure/ingredient-search/composite-ingredient-search.service.ts';
import {
  makeSearchIngredientsByNameHandler,
  makeSearchIngredientsByBarcodeHandler,
} from './http/ingredient-search/search-ingredients.handler.ts';
import {
  makeAddRecipeHandler,
  makeListRecipesHandler,
  makeGetRecipeHandler,
  makeUpdateRecipeHandler,
  makeDeleteRecipeHandler,
} from './http/recipes/recipes.handler.ts';
import { makeLoginHandler } from './http/auth/login.handler.ts';
import { makeLogoutHandler } from './http/auth/logout.handler.ts';
import { makeMeHandler } from './http/auth/me.handler.ts';
import { makeAuthMiddleware } from './http/auth/auth.middleware.ts';
import Anthropic from '@anthropic-ai/sdk';
import { AnthropicRecipeDraftExtractor } from './infrastructure/ai-recipe-import/anthropic-recipe-draft-extractor.ts';
import {
  makeImportRecipeFromPhotosHandler,
  makeUnconfiguredImportRecipeFromPhotosHandler,
} from './http/ai-recipe-import/import-recipe-from-photos.handler.ts';
import { AnthropicProductDraftExtractor } from './infrastructure/barcode-product-capture/anthropic-product-draft-extractor.ts';
import {
  makeExtractProductFromPhotosHandler,
  makeUnconfiguredExtractProductFromPhotosHandler,
} from './http/barcode-product-capture/extract-product-from-photos.handler.ts';
import { makeSaveScannedProductHandler } from './http/barcode-product-capture/save-scanned-product.handler.ts';
import { AnthropicFoodResolutionProposer } from './infrastructure/food-resolution/anthropic-food-resolution-proposer.ts';
import { CompositeResolutionCandidateFinder } from './infrastructure/food-resolution/composite-candidate-finder.ts';
import {
  makeProposeResolutionsHandler,
  makeUnconfiguredProposeResolutionsHandler,
  makeConfirmResolutionHandler,
  makeExportUserFoodsHandler,
  makeGetUserFoodsHandler,
} from './http/food-resolution/resolution.handlers.ts';
import { loadAppConfig } from './config/app-config.ts';
import { DotenvEnvSource } from './infrastructure/config/dotenv-env-source.ts';

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

const logEntryRepo = new JsonLogEntryRepository('./data/log-entries.json');
const nutritionGoalRepo = new JsonNutritionGoalRepository('./data/nutrition-goal.json');
const bodyProfileRepo = new JsonBodyProfileRepository('./data/body-profile.json');
const weightLogRepo = new JsonWeightLogRepository('./data/weight-log.json');
const recipeRepo = new JsonRecipeRepository('./data/recipes.json');
const scannedProductStore = new JsonScannedProductStore('./data/scanned-products.json');
const userFoodsStore = new JsonUserFoodsStore('./data/user-foods.json');
const foodsService = new InMemoryFoodsService('./data/foods.json');
const userFoodsSearch = new UserFoodsSearchService(userFoodsStore);
const ingredientSearchService = new CompositeIngredientSearchService(
  new OpenFoodFactsService(),
  foodsService,
  scannedProductStore,
  userFoodsSearch,
);

await bootstrap([
  logEntryRepo,
  nutritionGoalRepo,
  bodyProfileRepo,
  weightLogRepo,
  recipeRepo,
  scannedProductStore,
  userFoodsStore,
  foodsService,
]);

// Re-apply learned synonyms from the overlay onto the curated index now that both have loaded.
const overlay = await userFoodsStore.load();
if (overlay.synonyms.length > 0) {
  const { orphaned } = foodsService.applySynonyms(overlay.synonyms);
  if (orphaned.length > 0) {
    console.warn(`user-foods: ${orphaned.length} learned synonym(s) skipped — their curated entry no longer exists`);
  }
}

const app = new Hono();

app.post('/auth/login', makeLoginHandler(config.auth.password, config.auth.jwtSecret));
app.post('/auth/logout', makeLogoutHandler());
app.get('/auth/me', makeMeHandler(config.auth.jwtSecret));

app.use('*', makeAuthMiddleware(config.auth.jwtSecret));

app.post('/log-ingredient', makeLogIngredientHandler(logEntryRepo));
app.get('/daily-log/:date', makeGetDailyLogHandler(logEntryRepo));
app.get('/week-log/:startDate', makeGetWeekLogHandler(logEntryRepo));
app.post('/copy-log-day', makeCopyLogDayHandler(logEntryRepo));
app.patch('/log-entry/:id', makeEditLogEntryHandler(logEntryRepo));
app.delete('/log-entry/:id', makeRemoveLogEntryHandler(logEntryRepo));
app.get('/recently-used-ingredients', makeListRecentlyUsedIngredientsHandler(logEntryRepo));
app.put('/nutrition-goal', makeSetNutritionGoalHandler(nutritionGoalRepo));
app.get('/nutrition-goal', makeGetNutritionGoalHandler(nutritionGoalRepo));
app.get('/body-profile', makeGetBodyProfileHandler(bodyProfileRepo));
app.put('/body-profile', makeSaveBodyProfileHandler(bodyProfileRepo));
app.post('/body-profile/apply-as-goals', makeApplyBodyProfileAsGoalsHandler(bodyProfileRepo, nutritionGoalRepo));
app.post('/weight-log', makeLogWeightHandler(weightLogRepo));
app.get('/weight-log', makeListWeightEntriesHandler(weightLogRepo));
app.get('/weight-log/trend', makeGetWeightTrendHandler(weightLogRepo));
app.delete('/weight-log/:date', makeRemoveWeightHandler(weightLogRepo));
app.get('/search-ingredients', makeSearchIngredientsByNameHandler(ingredientSearchService));
app.get('/search-ingredients/barcode/:barcode', makeSearchIngredientsByBarcodeHandler(ingredientSearchService));
app.post('/save-scanned-product', makeSaveScannedProductHandler(scannedProductStore));

app.post('/add-recipe', makeAddRecipeHandler(recipeRepo));
app.get('/recipes', makeListRecipesHandler(recipeRepo));
app.get('/recipes/:id', makeGetRecipeHandler(recipeRepo));
app.patch('/recipe/:id', makeUpdateRecipeHandler(recipeRepo));
app.delete('/recipe/:id', makeDeleteRecipeHandler(recipeRepo));
app.post('/log-recipe', makeLogRecipeHandler(recipeRepo, logEntryRepo));
app.post('/remove-recipe-log', makeRemoveRecipeLogHandler(logEntryRepo));

app.post(
  '/confirm-ingredient-resolution',
  makeConfirmResolutionHandler({ overlay: userFoodsStore, curated: foodsService }),
);
app.get('/user-foods', makeGetUserFoodsHandler(userFoodsStore));
app.post('/export-user-foods', makeExportUserFoodsHandler({ overlay: userFoodsStore, curated: foodsService }));

if (config.ai.anthropicApiKey) {
  const anthropicClient = new Anthropic({ apiKey: config.ai.anthropicApiKey });
  const aiImageLimits = {
    maxImages: config.ai.recipeImport.maxImages,
    maxImageBytes: config.ai.recipeImport.maxImageBytes,
    maxTotalBytes: config.ai.recipeImport.maxTotalBytes,
  };
  const recipeDraftExtractor = new AnthropicRecipeDraftExtractor({
    client: anthropicClient,
    model: config.ai.model,
  });
  app.post(
    '/import-recipe-from-photos',
    makeImportRecipeFromPhotosHandler({
      extractor: recipeDraftExtractor,
      search: ingredientSearchService,
      limits: aiImageLimits,
      includeDebug: config.ai.recipeImport.debug,
    }),
  );
  const resolutionProposer = new AnthropicFoodResolutionProposer({
    client: anthropicClient,
    model: config.ai.resolutionModel,
  });
  const candidateFinder = new CompositeResolutionCandidateFinder(foodsService, userFoodsStore);
  app.post(
    '/propose-ingredient-resolutions',
    makeProposeResolutionsHandler({ candidates: candidateFinder, proposer: resolutionProposer }),
  );
  const productDraftExtractor = new AnthropicProductDraftExtractor({
    client: anthropicClient,
    model: config.ai.model,
  });
  app.post(
    '/extract-product-from-photos',
    makeExtractProductFromPhotosHandler({ extractor: productDraftExtractor, limits: aiImageLimits }),
  );
  if (config.ai.recipeImport.debug) {
    console.warn(
      'RECIPE_IMPORT_DEBUG is enabled — POST /import-recipe-from-photos responses include a debug payload (dev only)',
    );
  }
} else {
  app.post('/import-recipe-from-photos', makeUnconfiguredImportRecipeFromPhotosHandler());
  app.post('/extract-product-from-photos', makeUnconfiguredExtractProductFromPhotosHandler());
  app.post('/propose-ingredient-resolutions', makeUnconfiguredProposeResolutionsHandler());
}

serve({ fetch: app.fetch, port: 3000 }, () => {
  console.log('forkcast backend running on http://localhost:3000');
});
