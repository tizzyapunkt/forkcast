import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { bootstrap } from './bootstrap.ts';
import { JsonLogEntryRepository } from './infrastructure/meal-log/json-log-entry.repository.ts';
import { JsonNutritionGoalRepository } from './infrastructure/nutrition/json-nutrition-goal.repository.ts';
import { makeLogIngredientHandler } from './http/meal-log/log-ingredient.handler.ts';
import { makeGetDailyLogHandler } from './http/meal-log/get-daily-log.handler.ts';
import { makeEditLogEntryHandler, makeRemoveLogEntryHandler } from './http/meal-log/edit-remove-log-entry.handler.ts';
import { makeListRecentlyUsedIngredientsHandler } from './http/meal-log/list-recently-used-ingredients.handler.ts';
import { makeSetNutritionGoalHandler, makeGetNutritionGoalHandler } from './http/nutrition/nutrition-goal.handler.ts';
import { OpenFoodFactsService } from './infrastructure/ingredient-search/open-food-facts.service.ts';
import {
  makeSearchIngredientsByNameHandler,
  makeSearchIngredientsByBarcodeHandler,
} from './http/ingredient-search/search-ingredients.handler.ts';

const logEntryRepo = new JsonLogEntryRepository('./data/log-entries.json');
const nutritionGoalRepo = new JsonNutritionGoalRepository('./data/nutrition-goal.json');
const ingredientSearchService = new OpenFoodFactsService();

await bootstrap([logEntryRepo, nutritionGoalRepo]);

const app = new Hono();

app.post('/log-ingredient', makeLogIngredientHandler(logEntryRepo));
app.get('/daily-log/:date', makeGetDailyLogHandler(logEntryRepo));
app.patch('/log-entry/:id', makeEditLogEntryHandler(logEntryRepo));
app.delete('/log-entry/:id', makeRemoveLogEntryHandler(logEntryRepo));
app.get('/recently-used-ingredients', makeListRecentlyUsedIngredientsHandler(logEntryRepo));
app.put('/nutrition-goal', makeSetNutritionGoalHandler(nutritionGoalRepo));
app.get('/nutrition-goal', makeGetNutritionGoalHandler(nutritionGoalRepo));
app.get('/search-ingredients', makeSearchIngredientsByNameHandler(ingredientSearchService));
app.get('/search-ingredients/barcode/:barcode', makeSearchIngredientsByBarcodeHandler(ingredientSearchService));

serve({ fetch: app.fetch, port: 3000 }, () => {
  console.log('forkcast backend running on http://localhost:3000');
});
