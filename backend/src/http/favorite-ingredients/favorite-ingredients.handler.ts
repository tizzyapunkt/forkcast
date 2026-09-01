import type { Context } from 'hono';
import { favoriteIngredient } from '../../domain/favorite-ingredients/favorite-ingredient.use-case.ts';
import { unfavoriteIngredient } from '../../domain/favorite-ingredients/unfavorite-ingredient.use-case.ts';
import { listFavoriteIngredients } from '../../domain/favorite-ingredients/list-favorite-ingredients.use-case.ts';
import type { FavoriteIngredientRepository } from '../../domain/favorite-ingredients/favorite-ingredient.repository.ts';
import type { LogEntryRepository } from '../../domain/meal-log/log-entry.repository.ts';

export function makeListFavoriteIngredientsHandler(favorites: FavoriteIngredientRepository, logs: LogEntryRepository) {
  return async (c: Context) => {
    return c.json(await listFavoriteIngredients(favorites, logs));
  };
}

export function makeFavoriteIngredientHandler(repo: FavoriteIngredientRepository) {
  return async (c: Context) => {
    try {
      const body = await c.req.json();
      return c.json(await favoriteIngredient(repo, body));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return c.json({ error: message }, 400);
    }
  };
}

export function makeUnfavoriteIngredientHandler(repo: FavoriteIngredientRepository) {
  return async (c: Context) => {
    try {
      const body = await c.req.json();
      await unfavoriteIngredient(repo, body);
      return c.json({ ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return c.json({ error: message }, 400);
    }
  };
}
