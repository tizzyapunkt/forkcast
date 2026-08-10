import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import {
  makeGetCatalogHandler,
  makeExportCatalogHandler,
  makeAddCatalogEntryHandler,
  makeUpdateCatalogEntryHandler,
  makeRemoveCatalogEntryHandler,
  makeDraftCatalogEntryHandler,
  makeUnconfiguredDraftCatalogEntryHandler,
} from './catalog.handlers.ts';
import { makeAuthMiddleware } from '../auth/auth.middleware.ts';
import { FakeCatalogStore } from '../../domain/food-catalog/catalog-store.fake.ts';
import { CatalogSearchService } from '../../infrastructure/food-catalog/catalog-search.service.ts';
import { CatalogDraftError, type CatalogEntryDrafter } from '../../domain/food-catalog/catalog-entry-drafter.ts';
import type { FoodEntry } from '../../domain/foods/types.ts';

const moehre: FoodEntry = {
  id: 'moehre',
  name: 'Möhre',
  synonyms: ['Karotte'],
  unit: 'g',
  macrosPer100: { calories: 41, protein: 0.9, carbs: 9.6, fat: 0.2 },
};

const balsamico = {
  name: 'Balsamicoessig',
  synonyms: ['Balsamico-Essig'],
  unit: 'ml' as const,
  macrosPer100: { calories: 88, protein: 0, carbs: 17, fat: 0 },
};

function makeApp(store: FakeCatalogStore, drafter?: CatalogEntryDrafter) {
  const app = new Hono();
  app.get('/catalog', makeGetCatalogHandler(store));
  app.get('/export-catalog', makeExportCatalogHandler(store));
  app.post('/add-catalog-entry', makeAddCatalogEntryHandler(store));
  app.post('/update-catalog-entry', makeUpdateCatalogEntryHandler(store));
  app.post('/remove-catalog-entry', makeRemoveCatalogEntryHandler(store));
  if (drafter) app.post('/draft-catalog-entry', makeDraftCatalogEntryHandler(drafter));
  else app.post('/draft-catalog-entry', makeUnconfiguredDraftCatalogEntryHandler());
  return app;
}

const post = (app: Hono, path: string, body: unknown) =>
  app.request(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

describe('GET /catalog', () => {
  it('returns every entry, unranked', async () => {
    const store = new FakeCatalogStore([moehre, { ...moehre, id: 'salz', name: 'Salz', synonyms: [] }]);
    const res = await makeApp(store).request('/catalog');

    expect(res.status).toBe(200);
    const body = (await res.json()) as { entries: FoodEntry[] };
    expect(body.entries.map((e) => e.id)).toEqual(['moehre', 'salz']);
  });
});

describe('POST /add-catalog-entry', () => {
  it('creates an entry, deriving its id from the canonical name', async () => {
    const store = new FakeCatalogStore();

    const res = await post(makeApp(store), '/add-catalog-entry', { entry: balsamico });

    expect(res.status).toBe(200);
    expect((await res.json()) as { entry: FoodEntry }).toMatchObject({ entry: { id: 'balsamicoessig' } });
    expect(store.findById('balsamicoessig')?.name).toBe('Balsamicoessig');
  });

  it('makes the new entry searchable immediately', async () => {
    const store = new FakeCatalogStore();
    const search = new CatalogSearchService(store);

    await post(makeApp(store), '/add-catalog-entry', { entry: balsamico });

    expect((await search.searchByName('balsamico')).map((r) => r.id)).toEqual(['balsamicoessig']);
  });

  it('400s an invalid payload and leaves the catalog unchanged', async () => {
    const store = new FakeCatalogStore([moehre]);

    const res = await post(makeApp(store), '/add-catalog-entry', {
      entry: { ...balsamico, untracked: true },
    });

    expect(res.status).toBe(400);
    expect(store.list()).toEqual([moehre]);
  });

  it('400s a duplicate and names the existing entry so the client can open it', async () => {
    const store = new FakeCatalogStore([moehre]);

    const res = await post(makeApp(store), '/add-catalog-entry', {
      entry: { name: 'möhre', unit: 'g', synonyms: [], macrosPer100: { calories: 1, protein: 0, carbs: 0, fat: 0 } },
    });

    expect(res.status).toBe(400);
    expect((await res.json()) as { code: string; existingId: string }).toMatchObject({
      code: 'catalog-entry-exists',
      existingId: 'moehre',
    });
    expect(store.list()).toEqual([moehre]);
  });

  it('400s a body without an entry', async () => {
    const res = await post(makeApp(new FakeCatalogStore()), '/add-catalog-entry', { nope: true });
    expect(res.status).toBe(400);
  });
});

describe('POST /update-catalog-entry', () => {
  it('applies a correction and keeps it searchable', async () => {
    const store = new FakeCatalogStore([moehre]);
    const search = new CatalogSearchService(store);

    const res = await post(makeApp(store), '/update-catalog-entry', {
      id: 'moehre',
      entry: { ...moehre, macrosPer100: { ...moehre.macrosPer100, calories: 25 } },
    });

    expect(res.status).toBe(200);
    expect(store.findById('moehre')?.macrosPer100.calories).toBe(25);
    expect((await search.searchByName('möhre'))[0]!.macrosPerUnit.calories).toBeCloseTo(0.25);
  });

  it('drops a synonym the user removed', async () => {
    const store = new FakeCatalogStore([moehre]);
    const search = new CatalogSearchService(store);

    await post(makeApp(store), '/update-catalog-entry', { id: 'moehre', entry: { ...moehre, synonyms: [] } });

    expect(await search.searchByName('karotte')).toHaveLength(0);
  });

  it('404s an unknown id', async () => {
    const res = await post(makeApp(new FakeCatalogStore()), '/update-catalog-entry', {
      id: 'gibtsnicht',
      entry: moehre,
    });
    expect(res.status).toBe(404);
  });

  it('400s an update that breaks validation and leaves the entry untouched', async () => {
    const store = new FakeCatalogStore([moehre]);

    const res = await post(makeApp(store), '/update-catalog-entry', {
      id: 'moehre',
      entry: { ...moehre, untracked: true },
    });

    expect(res.status).toBe(400);
    expect(store.findById('moehre')).toEqual(moehre);
  });
});

describe('POST /remove-catalog-entry', () => {
  it('deletes the entry and drops it from search', async () => {
    const store = new FakeCatalogStore([moehre]);
    const search = new CatalogSearchService(store);

    const res = await post(makeApp(store), '/remove-catalog-entry', { id: 'moehre' });

    expect(res.status).toBe(200);
    expect(store.list()).toEqual([]);
    expect(await search.searchByName('möhre')).toHaveLength(0);
  });

  it('404s an unknown id', async () => {
    const res = await post(makeApp(new FakeCatalogStore()), '/remove-catalog-entry', { id: 'gibtsnicht' });
    expect(res.status).toBe(404);
  });
});

describe('GET /export-catalog', () => {
  it('returns the full catalog without draining it', async () => {
    const store = new FakeCatalogStore([moehre, { ...moehre, id: 'salz', name: 'Salz', synonyms: [] }]);
    const app = makeApp(store);

    const first = await app.request('/export-catalog');
    expect(first.status).toBe(200);
    const firstBody = (await first.json()) as FoodEntry[];
    expect(firstBody).toHaveLength(2);
    expect(store.list()).toHaveLength(2);

    const second = await app.request('/export-catalog');
    expect((await second.json()) as FoodEntry[]).toEqual(firstBody);
  });
});

describe('POST /draft-catalog-entry', () => {
  const drafted: FoodEntry = { id: 'balsamicoessig', ...balsamico };

  it('returns one drafted entry for a name', async () => {
    const drafter: CatalogEntryDrafter = {
      draft: vi.fn<(n: string) => Promise<FoodEntry>>().mockResolvedValue(drafted),
    };

    const res = await post(makeApp(new FakeCatalogStore(), drafter), '/draft-catalog-entry', {
      name: 'Balsamicoessig',
    });

    expect(res.status).toBe(200);
    expect((await res.json()) as { entry: FoodEntry }).toEqual({ entry: drafted });
    expect(drafter.draft).toHaveBeenCalledWith('Balsamicoessig');
  });

  it('does not persist the draft', async () => {
    const store = new FakeCatalogStore();
    const drafter: CatalogEntryDrafter = {
      draft: vi.fn<(n: string) => Promise<FoodEntry>>().mockResolvedValue(drafted),
    };

    await post(makeApp(store, drafter), '/draft-catalog-entry', { name: 'Balsamicoessig' });

    expect(store.list()).toEqual([]);
  });

  it('502s when the AI provider fails, mirroring the resolve flow', async () => {
    const drafter: CatalogEntryDrafter = {
      draft: vi.fn<(n: string) => Promise<FoodEntry>>().mockRejectedValue(new CatalogDraftError('provider down')),
    };

    const res = await post(makeApp(new FakeCatalogStore(), drafter), '/draft-catalog-entry', { name: 'X' });

    expect(res.status).toBe(502);
    expect((await res.json()) as { error: string }).toMatchObject({ error: 'ai-resolution-failed' });
  });

  it('503s when no AI key is configured', async () => {
    const res = await post(makeApp(new FakeCatalogStore()), '/draft-catalog-entry', { name: 'X' });

    expect(res.status).toBe(503);
    expect((await res.json()) as { error: string }).toMatchObject({ error: 'ai-import-not-configured' });
  });

  it('400s a body without a name', async () => {
    const drafter: CatalogEntryDrafter = {
      draft: vi.fn<(n: string) => Promise<FoodEntry>>().mockResolvedValue(drafted),
    };

    const res = await post(makeApp(new FakeCatalogStore(), drafter), '/draft-catalog-entry', { name: '  ' });

    expect(res.status).toBe(400);
    expect(drafter.draft).not.toHaveBeenCalled();
  });
});

describe('catalog endpoints behind the session guard', () => {
  it('401s unauthenticated reads and writes, leaving the catalog unchanged', async () => {
    const store = new FakeCatalogStore([moehre]);
    const app = new Hono();
    app.use('*', makeAuthMiddleware('test-jwt-secret-long-enough-for-hs256'));
    app.get('/catalog', makeGetCatalogHandler(store));
    app.get('/export-catalog', makeExportCatalogHandler(store));
    app.post('/add-catalog-entry', makeAddCatalogEntryHandler(store));
    app.post('/update-catalog-entry', makeUpdateCatalogEntryHandler(store));
    app.post('/remove-catalog-entry', makeRemoveCatalogEntryHandler(store));

    expect((await app.request('/catalog')).status).toBe(401);
    expect((await app.request('/export-catalog')).status).toBe(401);
    expect((await post(app, '/add-catalog-entry', { entry: balsamico })).status).toBe(401);
    expect((await post(app, '/update-catalog-entry', { id: 'moehre', entry: moehre })).status).toBe(401);
    expect((await post(app, '/remove-catalog-entry', { id: 'moehre' })).status).toBe(401);
    expect(store.list()).toEqual([moehre]);
  });
});
