import type { Context } from 'hono';
import {
  buildGroceryList,
  type GroceryListSources,
  type RecipePortions,
} from '../../domain/shopping/build-grocery-list.use-case.ts';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** `pasta:4,chili:2.5` → `{ pasta: 4, chili: 2.5 }`; `null` when any pair is malformed or not positive. */
export function parseRecipePortions(raw: string | undefined): RecipePortions | null {
  if (raw === undefined || raw === '') return {};
  const portions: RecipePortions = {};
  for (const pair of raw.split(',')) {
    const separator = pair.lastIndexOf(':');
    const recipeId = pair.slice(0, separator);
    const value = Number(pair.slice(separator + 1));
    if (separator <= 0 || !Number.isFinite(value) || value <= 0) return null;
    portions[recipeId] = value;
  }
  return portions;
}

export function makeGetGroceryListHandler(sources: GroceryListSources) {
  return async (c: Context) => {
    const startDate = c.req.param('startDate');
    if (!startDate || !ISO_DATE.test(startDate)) {
      return c.json({ error: 'startDate must be an ISO date (YYYY-MM-DD)' }, 400);
    }
    const portions = parseRecipePortions(c.req.query('portions'));
    if (!portions) {
      return c.json({ error: 'portions must be recipeId:number pairs with positive numbers' }, 400);
    }
    return c.json(await buildGroceryList(sources, startDate, portions));
  };
}
