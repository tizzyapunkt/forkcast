import type { Context } from 'hono';
import { logRecipe } from '../../domain/meal-log/log-recipe.use-case.ts';
import type { LogEntryRepository } from '../../domain/meal-log/log-entry.repository.ts';
import type { RecipeRepository } from '../../domain/recipes/recipe.repository.ts';

export function makeLogRecipeHandler(recipeRepo: RecipeRepository, logRepo: LogEntryRepository) {
  return async (c: Context) => {
    try {
      const body = await c.req.json();
      const entries = await logRecipe(recipeRepo, logRepo, body);
      return c.json(entries, 201);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      const status = message.includes('not found') ? 404 : 400;
      return c.json({ error: message }, status);
    }
  };
}
