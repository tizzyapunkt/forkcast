import type { Context } from 'hono';
import { addRecipe } from '../../domain/recipes/add-recipe.use-case.ts';
import { listRecipes } from '../../domain/recipes/list-recipes.use-case.ts';
import { getRecipe } from '../../domain/recipes/get-recipe.use-case.ts';
import { updateRecipe } from '../../domain/recipes/update-recipe.use-case.ts';
import { deleteRecipe } from '../../domain/recipes/delete-recipe.use-case.ts';
import type { RecipeRepository } from '../../domain/recipes/recipe.repository.ts';

export function makeAddRecipeHandler(repo: RecipeRepository) {
  return async (c: Context) => {
    try {
      const body = await c.req.json();
      const recipe = await addRecipe(repo, body);
      return c.json(recipe, 201);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return c.json({ error: message }, 400);
    }
  };
}

export function makeListRecipesHandler(repo: RecipeRepository) {
  return async (c: Context) => {
    const recipes = await listRecipes(repo);
    return c.json(recipes);
  };
}

export function makeGetRecipeHandler(repo: RecipeRepository) {
  return async (c: Context) => {
    const id = c.req.param('id') ?? '';
    const recipe = await getRecipe(repo, id);
    if (!recipe) return c.json({ error: `Recipe not found: ${id}` }, 404);
    return c.json(recipe);
  };
}

export function makeUpdateRecipeHandler(repo: RecipeRepository) {
  return async (c: Context) => {
    const id = c.req.param('id') ?? '';
    try {
      const body = await c.req.json();
      const updated = await updateRecipe(repo, { ...body, id });
      return c.json(updated);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      const status = message.includes('not found') ? 404 : 400;
      return c.json({ error: message }, status);
    }
  };
}

export function makeDeleteRecipeHandler(repo: RecipeRepository) {
  return async (c: Context) => {
    const id = c.req.param('id') ?? '';
    try {
      await deleteRecipe(repo, id);
      return c.body(null, 204);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return c.json({ error: message }, 404);
    }
  };
}
