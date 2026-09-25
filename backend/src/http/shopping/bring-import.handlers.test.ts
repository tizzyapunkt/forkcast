import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { makeBringImportPageHandler, makeMintBringImportTokenHandler } from './bring-import.handlers.ts';
import { mintImportToken } from '../../domain/shopping/import-token.ts';
import { FakeLogEntryRepository } from '../../domain/meal-log/log-entry-repository.fake.ts';
import { FakeCatalogStore } from '../../domain/food-catalog/catalog-store.fake.ts';
import type { RecipeRepository } from '../../domain/recipes/recipe.repository.ts';
import type { LogEntry } from '../../domain/meal-log/types.ts';

const SECRET = 'test-jwt-secret-long-enough-for-hs256';

const noRecipes: RecipeRepository = {
  save: async () => {},
  findAll: async () => [],
  findById: async () => null,
  update: async () => {},
  remove: async () => {},
};

function adhoc(name: string, amount: number, unit: 'g' | 'ml' = 'g'): LogEntry {
  return {
    id: name,
    date: '2026-09-29',
    slot: 'lunch',
    loggedAt: '',
    ingredient: { type: 'full', name, unit, macrosPerUnit: { calories: 1, protein: 0, carbs: 0, fat: 0 }, amount },
  };
}

function makeApp(
  entries: LogEntry[] = [adhoc('Hähnchenbrust', 800), adhoc('Zwiebel', 380), adhoc('Olivenöl', 30, 'ml')],
) {
  const logEntries = new FakeLogEntryRepository(entries);
  const app = new Hono();
  app.get(
    '/bring-import/:token',
    makeBringImportPageHandler({ logEntries, recipes: noRecipes, catalog: new FakeCatalogStore() }, SECRET),
  );
  app.post('/bring-import-token', makeMintBringImportTokenHandler(SECRET));
  return { app, logEntries };
}

const ingredients = (html: string) => [...html.matchAll(/itemprop="ingredients">([^<]*)</g)].map((m) => m[1]);

describe('GET /bring-import/:token', () => {
  it('serves the week as a microdata page, minus excluded items (case-insensitive)', async () => {
    const token = await mintImportToken({ startDate: '2026-09-28', excluded: ['OLIVENÖL|ml'] }, SECRET);

    const res = await makeApp().app.request(`/bring-import/${token}`);

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/html/);
    expect(ingredients(await res.text())).toEqual(['800 g Hähnchenbrust', '380 g Zwiebel']);
  });

  it('reflects the plan at fetch time, not at mint time', async () => {
    const token = await mintImportToken({ startDate: '2026-09-28', excluded: [] }, SECRET);
    const { app, logEntries } = makeApp([]);
    await logEntries.save(adhoc('Reis', 250));

    const res = await app.request(`/bring-import/${token}`);

    expect(ingredients(await res.text())).toEqual(['250 g Reis']);
  });

  it('is not cached or indexed', async () => {
    const token = await mintImportToken({ startDate: '2026-09-28', excluded: [] }, SECRET);

    const res = await makeApp().app.request(`/bring-import/${token}`);

    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('x-robots-tag')).toBe('noindex');
  });

  it.each([
    [
      'expired',
      async () =>
        mintImportToken({ startDate: '2026-09-28', excluded: [] }, SECRET, new Date(Date.now() - 2 * 3600_000)),
    ],
    [
      'signed with another secret',
      async () => mintImportToken({ startDate: '2026-09-28', excluded: [] }, 'another-secret-long-enough-xx'),
    ],
    ['malformed', async () => 'garbage'],
  ])('returns 401 without list content for a token that is %s', async (_label, token) => {
    const res = await makeApp().app.request(`/bring-import/${await token()}`);

    expect(res.status).toBe(401);
    const body = await res.text();
    expect(body).not.toContain('Hähnchenbrust');
    expect(res.headers.get('cache-control')).toBe('no-store');
  });
});

describe('POST /bring-import-token', () => {
  const post = (app: Hono, body: unknown) =>
    app.request('/bring-import-token', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });

  it('mints a token that opens the page for that week', async () => {
    const { app } = makeApp();

    const res = await post(app, { startDate: '2026-09-28', excluded: ['zwiebel|g'] });

    expect(res.status).toBe(200);
    const { token } = (await res.json()) as { token: string };
    const page = await app.request(`/bring-import/${token}`);
    expect(ingredients(await page.text())).toEqual(['800 g Hähnchenbrust', '30 ml Olivenöl']);
  });

  it.each([
    ['a malformed date', { startDate: 'soon', excluded: [] }],
    ['missing excluded', { startDate: '2026-09-28' }],
    ['non-string excluded', { startDate: '2026-09-28', excluded: [1] }],
    ['a malformed body', 'nope'],
  ])('returns 400 for %s', async (_label, body) => {
    const res = await post(makeApp().app, body);
    expect(res.status).toBe(400);
  });
});
