import { Hono } from 'hono';
import { CatalogSearchService } from './infrastructure/food-catalog/catalog-search.service.ts';
import { makeLogIngredientHandler } from './http/meal-log/log-ingredient.handler.ts';
import { makeGetDailyLogHandler } from './http/meal-log/get-daily-log.handler.ts';
import { makeGetWeekLogHandler } from './http/meal-log/get-week-log.handler.ts';
import { makeGetGroceryListHandler } from './http/shopping/get-grocery-list.handler.ts';
import { makeBringImportPageHandler, makeMintBringImportTokenHandler } from './http/shopping/bring-import.handlers.ts';
import { makeCopyLogDayHandler } from './http/meal-log/copy-log-day.handler.ts';
import { makeEditLogEntryHandler, makeRemoveLogEntryHandler } from './http/meal-log/edit-remove-log-entry.handler.ts';
import { makeListRecentlyUsedIngredientsHandler } from './http/meal-log/list-recently-used-ingredients.handler.ts';
import {
  makeListFavoriteIngredientsHandler,
  makeFavoriteIngredientHandler,
  makeUnfavoriteIngredientHandler,
} from './http/favorite-ingredients/favorite-ingredients.handler.ts';
import { makeLogRecipeHandler } from './http/meal-log/log-recipe.handler.ts';
import { makeRemoveRecipeLogHandler } from './http/meal-log/remove-recipe-log.handler.ts';
import { makeReplaceBatchIngredientHandler } from './http/meal-log/replace-batch-ingredient.handler.ts';
import { makeAddToRecipeBatchHandler } from './http/meal-log/add-to-recipe-batch.handler.ts';
import { makeSetBatchIngredientsHandler } from './http/meal-log/set-batch-ingredients.handler.ts';
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
import {
  makeImportRecipeFromPhotosHandler,
  makeUnconfiguredImportRecipeFromPhotosHandler,
} from './http/ai-recipe-import/import-recipe-from-photos.handler.ts';
import {
  makeExtractProductFromPhotosHandler,
  makeUnconfiguredExtractProductFromPhotosHandler,
} from './http/barcode-product-capture/extract-product-from-photos.handler.ts';
import { makeSaveScannedProductHandler } from './http/barcode-product-capture/save-scanned-product.handler.ts';
import { CatalogResolutionCandidateFinder } from './infrastructure/food-resolution/catalog-candidate-finder.ts';
import {
  makeProposeResolutionsHandler,
  makeUnconfiguredProposeResolutionsHandler,
  makeConfirmResolutionHandler,
} from './http/food-resolution/resolution.handlers.ts';
import {
  makeGetCatalogHandler,
  makeExportCatalogHandler,
  makeAddCatalogEntryHandler,
  makeUpdateCatalogEntryHandler,
  makeRemoveCatalogEntryHandler,
  makeDraftCatalogEntryHandler,
  makeUnconfiguredDraftCatalogEntryHandler,
} from './http/food-catalog/catalog.handlers.ts';
import { makeRequestLogMiddleware } from './http/diagnostics/request-log.middleware.ts';
import { makeGetDebugLogsHandler } from './http/diagnostics/get-debug-logs.handler.ts';
import type { LogEntryRepository } from './domain/meal-log/log-entry.repository.ts';
import type { FavoriteIngredientRepository } from './domain/favorite-ingredients/favorite-ingredient.repository.ts';
import type { NutritionGoalRepository } from './domain/nutrition/nutrition-goal.repository.ts';
import type { BodyProfileRepository } from './domain/body-profile/body-profile.repository.ts';
import type { WeightLogRepository } from './domain/weight-log/weight-log.repository.ts';
import type { RecipeRepository } from './domain/recipes/recipe.repository.ts';
import type { ScannedProductStore } from './domain/barcode-product-capture/types.ts';
import type { CatalogStore } from './domain/food-catalog/types.ts';
import type { IngredientSearchService } from './domain/ingredient-search/ingredient-search.service.ts';
import type { DiagnosticsLog } from './domain/diagnostics/diagnostics-log.ts';
import type { RecipeDraftExtractor } from './domain/ai-recipe-import/recipe-draft-extractor.ts';
import type { ProductDraftExtractor } from './domain/barcode-product-capture/product-draft-extractor.ts';
import type { FoodResolutionProposer } from './domain/food-resolution/types.ts';
import type { CatalogEntryDrafter } from './domain/food-catalog/catalog-entry-drafter.ts';
import type { ImageDecodeLimits } from './http/ai-images/decode-image-payloads.ts';

/** The AI adapters, already built; the app never constructs an AI client itself. */
export interface AiDeps {
  recipeDraftExtractor: RecipeDraftExtractor;
  productDraftExtractor: ProductDraftExtractor;
  resolutionProposer: FoodResolutionProposer;
  catalogEntryDrafter: CatalogEntryDrafter;
  imageLimits: ImageDecodeLimits;
}

/** Everything the HTTP app needs, built by the caller: file-backed for the server, in-memory in tests. */
export interface AppDeps {
  /** Absent in the in-browser demo: no login, no session check, no Bring! links (they need a public server). */
  auth?: { password: string; jwtSecret: string };
  logEntries: LogEntryRepository;
  favoriteIngredients: FavoriteIngredientRepository;
  nutritionGoal: NutritionGoalRepository;
  bodyProfile: BodyProfileRepository;
  weightLog: WeightLogRepository;
  recipes: RecipeRepository;
  scannedProducts: ScannedProductStore;
  /** Already initialised. */
  catalog: CatalogStore;
  openFoodFacts: IngredientSearchService;
  diagnostics: DiagnosticsLog;
  /** Null serves the AI routes as "not configured" (503). */
  ai: AiDeps | null;
}

/** Builds the forkcast HTTP app from its dependencies. Serving it is the caller's job. */
export function createApp(deps: AppDeps): Hono {
  const catalogSearch = new CatalogSearchService(deps.catalog);
  const ingredientSearchService = new CompositeIngredientSearchService(
    deps.openFoodFacts,
    catalogSearch,
    deps.scannedProducts,
  );

  const app = new Hono();

  app.use('*', makeRequestLogMiddleware(deps.diagnostics));

  const grocerySources = { logEntries: deps.logEntries, recipes: deps.recipes, catalog: deps.catalog };

  if (deps.auth) {
    const { password, jwtSecret } = deps.auth;
    app.post('/auth/login', makeLoginHandler(password, jwtSecret));
    app.post('/auth/logout', makeLogoutHandler());
    app.get('/auth/me', makeMeHandler(jwtSecret));

    // Public: Bring!'s servers fetch the import page without a session; its path token is the authorisation.
    app.get('/bring-import/:token', makeBringImportPageHandler(grocerySources, jwtSecret));

    app.use('*', makeAuthMiddleware(jwtSecret));
    app.post('/bring-import-token', makeMintBringImportTokenHandler(jwtSecret));
  }

  app.get('/debug/logs', makeGetDebugLogsHandler(deps.diagnostics));

  app.post('/log-ingredient', makeLogIngredientHandler(deps.logEntries));
  app.get('/daily-log/:date', makeGetDailyLogHandler(deps.logEntries));
  app.get('/week-log/:startDate', makeGetWeekLogHandler(deps.logEntries));
  app.get('/grocery-list/:startDate', makeGetGroceryListHandler(grocerySources));
  app.post('/copy-log-day', makeCopyLogDayHandler(deps.logEntries));
  app.patch('/log-entry/:id', makeEditLogEntryHandler(deps.logEntries));
  app.delete('/log-entry/:id', makeRemoveLogEntryHandler(deps.logEntries));
  app.get('/recently-used-ingredients', makeListRecentlyUsedIngredientsHandler(deps.logEntries));
  app.get('/favorite-ingredients', makeListFavoriteIngredientsHandler(deps.favoriteIngredients, deps.logEntries));
  app.post('/favorite-ingredient', makeFavoriteIngredientHandler(deps.favoriteIngredients));
  app.post('/unfavorite-ingredient', makeUnfavoriteIngredientHandler(deps.favoriteIngredients));
  app.put('/nutrition-goal', makeSetNutritionGoalHandler(deps.nutritionGoal));
  app.get('/nutrition-goal', makeGetNutritionGoalHandler(deps.nutritionGoal));
  app.get('/body-profile', makeGetBodyProfileHandler(deps.bodyProfile));
  app.put('/body-profile', makeSaveBodyProfileHandler(deps.bodyProfile));
  app.post('/body-profile/apply-as-goals', makeApplyBodyProfileAsGoalsHandler(deps.bodyProfile, deps.nutritionGoal));
  app.post('/weight-log', makeLogWeightHandler(deps.weightLog));
  app.get('/weight-log', makeListWeightEntriesHandler(deps.weightLog));
  app.get('/weight-log/trend', makeGetWeightTrendHandler(deps.weightLog));
  app.delete('/weight-log/:date', makeRemoveWeightHandler(deps.weightLog));
  app.get('/search-ingredients', makeSearchIngredientsByNameHandler(ingredientSearchService));
  app.get('/search-ingredients/barcode/:barcode', makeSearchIngredientsByBarcodeHandler(ingredientSearchService));
  app.post('/save-scanned-product', makeSaveScannedProductHandler(deps.scannedProducts));

  app.post('/add-recipe', makeAddRecipeHandler(deps.recipes));
  app.get('/recipes', makeListRecipesHandler(deps.recipes));
  app.get('/recipes/:id', makeGetRecipeHandler(deps.recipes));
  app.patch('/recipe/:id', makeUpdateRecipeHandler(deps.recipes));
  app.delete('/recipe/:id', makeDeleteRecipeHandler(deps.recipes));
  app.post('/log-recipe', makeLogRecipeHandler(deps.recipes, deps.logEntries));
  app.post('/remove-recipe-log', makeRemoveRecipeLogHandler(deps.logEntries));
  app.post('/replace-batch-ingredient', makeReplaceBatchIngredientHandler(deps.logEntries));
  app.post('/add-to-recipe-batch', makeAddToRecipeBatchHandler(deps.logEntries));
  app.post('/set-batch-ingredients', makeSetBatchIngredientsHandler(deps.logEntries));

  app.post('/confirm-ingredient-resolution', makeConfirmResolutionHandler({ catalog: deps.catalog }));

  app.get('/catalog', makeGetCatalogHandler(deps.catalog));
  app.get('/export-catalog', makeExportCatalogHandler(deps.catalog));
  app.post('/add-catalog-entry', makeAddCatalogEntryHandler(deps.catalog));
  app.post('/update-catalog-entry', makeUpdateCatalogEntryHandler(deps.catalog));
  app.post('/remove-catalog-entry', makeRemoveCatalogEntryHandler(deps.catalog));

  if (deps.ai) {
    const { recipeDraftExtractor, productDraftExtractor, resolutionProposer, catalogEntryDrafter, imageLimits } =
      deps.ai;
    app.post(
      '/import-recipe-from-photos',
      makeImportRecipeFromPhotosHandler({
        extractor: recipeDraftExtractor,
        search: ingredientSearchService,
        limits: imageLimits,
      }),
    );
    const candidateFinder = new CatalogResolutionCandidateFinder(catalogSearch);
    app.post(
      '/propose-ingredient-resolutions',
      makeProposeResolutionsHandler({ candidates: candidateFinder, proposer: resolutionProposer }),
    );
    app.post('/draft-catalog-entry', makeDraftCatalogEntryHandler(catalogEntryDrafter));
    app.post(
      '/extract-product-from-photos',
      makeExtractProductFromPhotosHandler({ extractor: productDraftExtractor, limits: imageLimits }),
    );
  } else {
    app.post('/import-recipe-from-photos', makeUnconfiguredImportRecipeFromPhotosHandler());
    app.post('/extract-product-from-photos', makeUnconfiguredExtractProductFromPhotosHandler());
    app.post('/propose-ingredient-resolutions', makeUnconfiguredProposeResolutionsHandler());
    app.post('/draft-catalog-entry', makeUnconfiguredDraftCatalogEntryHandler());
  }

  return app;
}
