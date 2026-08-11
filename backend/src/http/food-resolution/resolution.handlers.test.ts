import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import {
  makeProposeResolutionsHandler,
  makeUnconfiguredProposeResolutionsHandler,
  makeConfirmResolutionHandler,
} from './resolution.handlers.ts';
import {
  FoodResolutionError,
  type FoodResolutionProposer,
  type ResolutionCandidate,
  type ResolutionCandidateFinder,
  type ResolutionVerdict,
} from '../../domain/food-resolution/types.ts';
import type { FoodEntry } from '../../domain/foods/types.ts';
import { FakeCatalogStore } from '../../domain/food-catalog/catalog-store.fake.ts';

const emptyFinder: ResolutionCandidateFinder = {
  findCandidates: vi.fn<(q: string, limit: number) => Promise<ResolutionCandidate[]>>().mockResolvedValue([]),
};

function proposerReturning(verdicts: ResolutionVerdict[]): FoodResolutionProposer {
  return { propose: vi.fn<(r: unknown[]) => Promise<ResolutionVerdict[]>>().mockResolvedValue(verdicts) };
}

const kirsch: FoodEntry = {
  id: 'kirschtomaten',
  name: 'Kirschtomaten',
  synonyms: [],
  unit: 'g',
  macrosPer100: { calories: 20, protein: 0.9, carbs: 3.9, fat: 0.2 },
};

describe('POST /propose-ingredient-resolutions', () => {
  function app(proposer: FoodResolutionProposer, candidates: ResolutionCandidateFinder = emptyFinder) {
    const a = new Hono();
    a.post('/propose-ingredient-resolutions', makeProposeResolutionsHandler({ candidates, proposer }));
    return a;
  }

  it('returns one proposal per item', async () => {
    const proposer = proposerReturning([
      { verdict: 'new-food', entry: kirsch, confidence: 'medium' },
      { verdict: 'skip', reason: 'x' },
    ]);
    const res = await app(proposer).request('/propose-ingredient-resolutions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ items: [{ name: 'Kirschtomaten' }, { name: 'xyz' }] }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { proposals: unknown[] };
    expect(body.proposals).toHaveLength(2);
  });

  it('returns empty proposals for an empty item list without calling the proposer', async () => {
    const proposer = proposerReturning([]);
    const res = await app(proposer).request('/propose-ingredient-resolutions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ items: [] }),
    });
    expect(res.status).toBe(200);
    expect(proposer.propose).not.toHaveBeenCalled();
  });

  it('400s on a malformed body', async () => {
    const res = await app(proposerReturning([])).request('/propose-ingredient-resolutions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ items: [{ noName: true }] }),
    });
    expect(res.status).toBe(400);
  });

  it('502s when the proposer raises a FoodResolutionError', async () => {
    const proposer: FoodResolutionProposer = {
      propose: vi
        .fn<(r: unknown[]) => Promise<ResolutionVerdict[]>>()
        .mockRejectedValue(new FoodResolutionError('upstream 5xx')),
    };
    const res = await app(proposer).request('/propose-ingredient-resolutions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ items: [{ name: 'a' }] }),
    });
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe('ai-resolution-failed');
  });

  it('the unconfigured handler returns 503', async () => {
    const a = new Hono();
    a.post('/propose-ingredient-resolutions', makeUnconfiguredProposeResolutionsHandler());
    const res = await a.request('/propose-ingredient-resolutions', { method: 'POST' });
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe('ai-import-not-configured');
  });
});

const oliven: FoodEntry = {
  id: 'oliven',
  name: 'Oliven',
  synonyms: [],
  unit: 'g',
  macrosPer100: { calories: 145, protein: 1, carbs: 6, fat: 15 },
};

function confirmApp(catalog: FakeCatalogStore) {
  const a = new Hono();
  a.post('/confirm-ingredient-resolution', makeConfirmResolutionHandler({ catalog }));
  return a;
}

const post = (a: Hono, body: unknown) =>
  a.request('/confirm-ingredient-resolution', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('POST /confirm-ingredient-resolution', () => {
  it('appends a new food to the catalog and returns the matched ingredient', async () => {
    const catalog = new FakeCatalogStore();

    const res = await post(confirmApp(catalog), {
      kind: 'new-food',
      entry: kirsch,
      original: { amount: 50, unit: 'g' },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ingredient: { name: string; amount: number; source: string } };
    expect(body.ingredient).toMatchObject({ name: 'Kirschtomaten', amount: 50, source: 'CATALOG' });
    expect(catalog.findById('kirschtomaten')).not.toBeNull();
  });

  it('409s on an id collision with an existing catalog entry', async () => {
    const catalog = new FakeCatalogStore([kirsch]);

    const res = await post(confirmApp(catalog), { kind: 'new-food', entry: kirsch, original: { amount: 50 } });

    expect(res.status).toBe(409);
  });

  it('400s on a malformed body', async () => {
    const res = await post(confirmApp(new FakeCatalogStore()), { kind: 'wat' });
    expect(res.status).toBe(400);
  });

  it('stores an entry renamed in the resolve sheet under an id derived from the new name', async () => {
    const catalog = new FakeCatalogStore();

    const res = await post(confirmApp(catalog), {
      kind: 'new-food',
      entry: {
        id: 'duenne-reisnudeln',
        name: 'Reisnudeln',
        synonyms: ['dünne Reisnudeln'],
        unit: 'g',
        macrosPer100: { calories: 360, protein: 6, carbs: 82, fat: 0.5 },
      },
      original: { amount: 200, unit: 'g', note: 'dünne' },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ingredient: { name: string; amount: number; note?: string } };
    expect(body.ingredient).toMatchObject({ name: 'Reisnudeln', amount: 200, note: 'dünne' });
    expect(catalog.findById('duenne-reisnudeln')).toBeNull();
    expect(catalog.findById('reisnudeln')?.synonyms).toEqual(['dünne Reisnudeln']);
  });

  it('422s on an entry whose name yields no usable id', async () => {
    const catalog = new FakeCatalogStore();

    const res = await post(confirmApp(catalog), {
      kind: 'new-food',
      entry: { ...kirsch, name: '???' },
      original: { amount: 50 },
    });

    expect(res.status).toBe(422);
    expect(catalog.list()).toEqual([]);
  });

  it('confirms a synonym against a catalog entry', async () => {
    const catalog = new FakeCatalogStore([oliven]);

    const res = await post(confirmApp(catalog), {
      kind: 'synonym',
      foodId: 'oliven',
      synonym: 'grüne Oliven',
      original: { amount: 25 },
    });

    expect(res.status).toBe(200);
    expect(catalog.findById('oliven')?.synonyms).toEqual(['grüne Oliven']);
  });

  it('404s when the synonym targets a food the catalog does not have', async () => {
    const catalog = new FakeCatalogStore([oliven]);

    const res = await post(confirmApp(catalog), {
      kind: 'synonym',
      foodId: 'nicht-vorhanden',
      synonym: 'egal',
      original: {},
    });

    expect(res.status).toBe(404);
    expect(catalog.list()).toEqual([oliven]);
  });
});
