import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import {
  makeProposeResolutionsHandler,
  makeUnconfiguredProposeResolutionsHandler,
  makeConfirmResolutionHandler,
  makeExportUserFoodsHandler,
} from './resolution.handlers.ts';
import {
  FoodResolutionError,
  type FoodResolutionProposer,
  type ResolutionCandidate,
  type ResolutionCandidateFinder,
  type ResolutionVerdict,
} from '../../domain/food-resolution/types.ts';
import type { FoodEntry } from '../../domain/foods/types.ts';
import type { UserFoodsOverlay, UserFoodsStore } from '../../domain/user-foods/types.ts';
import type { SynonymRegistrar } from '../../domain/food-resolution/confirm-resolution.use-case.ts';

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

function makeOverlay(initial: UserFoodsOverlay = { foods: [], synonyms: [] }) {
  let state = structuredClone(initial);
  const store: UserFoodsStore = {
    load: vi.fn<() => Promise<UserFoodsOverlay>>(async () => state),
    addFood: vi.fn<(e: FoodEntry) => Promise<void>>(async (e) => {
      state.foods.push(e);
    }),
    addSynonym: vi.fn<(s: { foodId: string; synonym: string }) => Promise<void>>(async (s) => {
      state.synonyms.push(s);
    }),
    exportAndClear: vi.fn<() => Promise<UserFoodsOverlay>>(async () => {
      const snap = state;
      state = { foods: [], synonyms: [] };
      return snap;
    }),
  };
  return store;
}

function curatedWith(ids: Record<string, boolean>): SynonymRegistrar {
  return {
    addSynonym: vi.fn<(foodId: string, synonym: string) => boolean>((foodId) => foodId in ids),
    findById: vi.fn<SynonymRegistrar['findById']>((foodId) =>
      foodId in ids
        ? { name: 'Oliven', unit: 'g' as const, macrosPerUnit: { calories: 1, protein: 0, carbs: 0, fat: 0 } }
        : null,
    ),
  };
}

describe('POST /confirm-ingredient-resolution', () => {
  it('persists a new food and returns the matched ingredient', async () => {
    const overlay = makeOverlay();
    const a = new Hono();
    a.post('/confirm-ingredient-resolution', makeConfirmResolutionHandler({ overlay, curated: curatedWith({}) }));
    const res = await a.request('/confirm-ingredient-resolution', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'new-food', entry: kirsch, original: { amount: 50, unit: 'g' } }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ingredient: { name: string; amount: number; source: string } };
    expect(body.ingredient).toMatchObject({ name: 'Kirschtomaten', amount: 50, source: 'USER' });
    expect(overlay.addFood).toHaveBeenCalled();
  });

  it('409s on a curated id collision', async () => {
    const overlay = makeOverlay();
    const a = new Hono();
    a.post(
      '/confirm-ingredient-resolution',
      makeConfirmResolutionHandler({ overlay, curated: curatedWith({ kirschtomaten: true }) }),
    );
    const res = await a.request('/confirm-ingredient-resolution', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'new-food', entry: kirsch, original: { amount: 50 } }),
    });
    expect(res.status).toBe(409);
  });

  it('400s on a malformed body', async () => {
    const a = new Hono();
    a.post(
      '/confirm-ingredient-resolution',
      makeConfirmResolutionHandler({ overlay: makeOverlay(), curated: curatedWith({}) }),
    );
    const res = await a.request('/confirm-ingredient-resolution', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'wat' }),
    });
    expect(res.status).toBe(400);
  });

  it('confirms a synonym against a curated entry', async () => {
    const overlay = makeOverlay();
    const a = new Hono();
    a.post(
      '/confirm-ingredient-resolution',
      makeConfirmResolutionHandler({ overlay, curated: curatedWith({ oliven: true }) }),
    );
    const res = await a.request('/confirm-ingredient-resolution', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'synonym', foodId: 'oliven', synonym: 'grüne Oliven', original: { amount: 25 } }),
    });
    expect(res.status).toBe(200);
    expect(overlay.addSynonym).toHaveBeenCalled();
  });
});

describe('POST /export-user-foods', () => {
  it('returns overlay content and clears learned synonyms', async () => {
    const overlay = makeOverlay({ foods: [kirsch], synonyms: [{ foodId: 'oliven', synonym: 'grüne Oliven' }] });
    const clearLearnedSynonyms = vi.fn<() => void>();
    const a = new Hono();
    a.post('/export-user-foods', makeExportUserFoodsHandler({ overlay, curated: { clearLearnedSynonyms } }));
    const res = await a.request('/export-user-foods', { method: 'POST' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as UserFoodsOverlay;
    expect(body.foods).toHaveLength(1);
    expect(body.synonyms).toHaveLength(1);
    expect(clearLearnedSynonyms).toHaveBeenCalled();
    expect((await overlay.load()).foods).toHaveLength(0);
  });
});
