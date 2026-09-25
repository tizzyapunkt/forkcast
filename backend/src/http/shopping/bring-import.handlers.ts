import type { Context } from 'hono';
import { buildGroceryList, type GroceryListSources } from '../../domain/shopping/build-grocery-list.use-case.ts';
import { mintImportToken, verifyImportToken } from '../../domain/shopping/import-token.ts';
import { ingredientIdentityKey } from '../../domain/meal-log/ingredient-identity.ts';
import { renderBringImportPage } from './bring-import-page.ts';

/**
 * Public — Bring!'s servers fetch this without a session. The import token in the path is the only
 * authorisation, and it grants exactly one week's grocery list.
 */
export function makeBringImportPageHandler(sources: GroceryListSources, jwtSecret: string) {
  return async (c: Context) => {
    c.header('Cache-Control', 'no-store');
    c.header('X-Robots-Tag', 'noindex');

    const grant = await verifyImportToken(c.req.param('token') ?? '', jwtSecret);
    if (!grant) return c.text('Link abgelaufen oder ungültig', 401);

    const excluded = new Set(grant.excluded.map((key) => key.toLowerCase()));
    const list = await buildGroceryList(sources, grant.startDate);
    const items = list.items.filter((item) => !excluded.has(ingredientIdentityKey(item.name, item.unit)));
    return c.html(renderBringImportPage(grant.startDate, items));
  };
}

/** Authenticated — mints the short-lived token the Einkaufsliste sheet puts into the Bring! deeplink. */
export function makeMintBringImportTokenHandler(jwtSecret: string) {
  return async (c: Context) => {
    try {
      const body = await c.req.json();
      const token = await mintImportToken({ startDate: body?.startDate, excluded: body?.excluded }, jwtSecret);
      return c.json({ token });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : 'Invalid request' }, 400);
    }
  };
}
