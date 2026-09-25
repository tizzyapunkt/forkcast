import type { Context } from 'hono';
import { buildGroceryList, type GroceryListSources } from '../../domain/shopping/build-grocery-list.use-case.ts';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function makeGetGroceryListHandler(sources: GroceryListSources) {
  return async (c: Context) => {
    const startDate = c.req.param('startDate');
    if (!startDate || !ISO_DATE.test(startDate)) {
      return c.json({ error: 'startDate must be an ISO date (YYYY-MM-DD)' }, 400);
    }
    return c.json(await buildGroceryList(sources, startDate));
  };
}
