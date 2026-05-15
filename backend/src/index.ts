import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { bootstrap } from './bootstrap.ts';
import { JsonLogEntryRepository } from './infrastructure/meal-log/json-log-entry.repository.ts';
import { JsonNutritionGoalRepository } from './infrastructure/nutrition/json-nutrition-goal.repository.ts';
import { JsonBodyProfileRepository } from './infrastructure/body-profile/json-body-profile.repository.ts';
import { JsonRecipeRepository } from './infrastructure/recipes/json-recipe.repository.ts';
import { makeLogIngredientHandler } from './http/meal-log/log-ingredient.handler.ts';
import { makeGetDailyLogHandler } from './http/meal-log/get-daily-log.handler.ts';
import { makeEditLogEntryHandler, makeRemoveLogEntryHandler } from './http/meal-log/edit-remove-log-entry.handler.ts';
import { makeListRecentlyUsedIngredientsHandler } from './http/meal-log/list-recently-used-ingredients.handler.ts';
import { makeLogRecipeHandler } from './http/meal-log/log-recipe.handler.ts';
import { makeSetNutritionGoalHandler, makeGetNutritionGoalHandler } from './http/nutrition/nutrition-goal.handler.ts';
import {
  makeGetBodyProfileHandler,
  makeSaveBodyProfileHandler,
  makeApplyBodyProfileAsGoalsHandler,
} from './http/body-profile/body-profile.handler.ts';
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
    'ANTHROPIC_API_KEY is not set — POST /import-recipe-from-photos will return 503 ai-import-not-configured',
  );
}

const logEntryRepo = new JsonLogEntryRepository('./data/log-entries.json');
const nutritionGoalRepo = new JsonNutritionGoalRepository('./data/nutrition-goal.json');
const bodyProfileRepo = new JsonBodyProfileRepository('./data/body-profile.json');
const recipeRepo = new JsonRecipeRepository('./data/recipes.json');
const foodsService = new InMemoryFoodsService('./data/foods.json');
const ingredientSearchService = new CompositeIngredientSearchService(new OpenFoodFactsService(), foodsService);

await bootstrap([logEntryRepo, nutritionGoalRepo, bodyProfileRepo, recipeRepo, foodsService]);

const app = new Hono();

app.post('/auth/login', makeLoginHandler(config.auth.password, config.auth.jwtSecret));
app.post('/auth/logout', makeLogoutHandler());
app.get('/auth/me', makeMeHandler(config.auth.jwtSecret));

app.use('*', makeAuthMiddleware(config.auth.jwtSecret));

app.post('/log-ingredient', makeLogIngredientHandler(logEntryRepo));
app.get('/daily-log/:date', makeGetDailyLogHandler(logEntryRepo));
app.patch('/log-entry/:id', makeEditLogEntryHandler(logEntryRepo));
app.delete('/log-entry/:id', makeRemoveLogEntryHandler(logEntryRepo));
app.get('/recently-used-ingredients', makeListRecentlyUsedIngredientsHandler(logEntryRepo));
app.put('/nutrition-goal', makeSetNutritionGoalHandler(nutritionGoalRepo));
app.get('/nutrition-goal', makeGetNutritionGoalHandler(nutritionGoalRepo));
app.get('/body-profile', makeGetBodyProfileHandler(bodyProfileRepo));
app.put('/body-profile', makeSaveBodyProfileHandler(bodyProfileRepo));
app.post('/body-profile/apply-as-goals', makeApplyBodyProfileAsGoalsHandler(bodyProfileRepo, nutritionGoalRepo));
app.get('/search-ingredients', makeSearchIngredientsByNameHandler(ingredientSearchService));
app.get('/search-ingredients/barcode/:barcode', makeSearchIngredientsByBarcodeHandler(ingredientSearchService));

app.post('/add-recipe', makeAddRecipeHandler(recipeRepo));
app.get('/recipes', makeListRecipesHandler(recipeRepo));
app.get('/recipes/:id', makeGetRecipeHandler(recipeRepo));
app.patch('/recipe/:id', makeUpdateRecipeHandler(recipeRepo));
app.delete('/recipe/:id', makeDeleteRecipeHandler(recipeRepo));
app.post('/log-recipe', makeLogRecipeHandler(recipeRepo, logEntryRepo));

if (config.ai.anthropicApiKey) {
  const anthropicClient = new Anthropic({ apiKey: config.ai.anthropicApiKey });
  const recipeDraftExtractor = new AnthropicRecipeDraftExtractor({
    client: anthropicClient,
    model: config.ai.model,
  });
  app.post(
    '/import-recipe-from-photos',
    makeImportRecipeFromPhotosHandler({
      extractor: recipeDraftExtractor,
      search: ingredientSearchService,
      limits: {
        maxImages: config.ai.recipeImport.maxImages,
        maxImageBytes: config.ai.recipeImport.maxImageBytes,
        maxTotalBytes: config.ai.recipeImport.maxTotalBytes,
      },
    }),
  );
} else {
  app.post('/import-recipe-from-photos', makeUnconfiguredImportRecipeFromPhotosHandler());
}

serve({ fetch: app.fetch, port: 3000 }, () => {
  console.log('forkcast backend running on http://localhost:3000');
});
