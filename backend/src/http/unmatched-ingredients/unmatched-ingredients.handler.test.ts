import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { signSession } from '../../domain/auth/auth.service.ts';
import { makeAuthMiddleware } from '../auth/auth.middleware.ts';
import {
  makeExportUnmatchedIngredientsHandler,
  makeClearUnmatchedIngredientsHandler,
} from './unmatched-ingredients.handler.ts';
import type {
  UnmatchedIngredientCleaner,
  UnmatchedIngredientEntry,
  UnmatchedIngredientReader,
} from '../../domain/unmatched-ingredients/types.ts';

const SECRET = 'test-jwt-secret-long-enough-for-hs256';

const sampleEntry = (overrides: Partial<UnmatchedIngredientEntry> = {}): UnmatchedIngredientEntry => ({
  name: 'Buchweizenmehl',
  foldedName: 'buchweizenmehl',
  count: 1,
  firstSeenAt: '2026-05-16T10:00:00.000Z',
  lastSeenAt: '2026-05-16T10:00:00.000Z',
  samples: [{ rawName: 'Buchweizenmehl', rawUnit: 'g' }],
  ...overrides,
});

function makeApp(reader: UnmatchedIngredientReader, cleaner: UnmatchedIngredientCleaner): Hono {
  const app = new Hono();
  app.use('*', makeAuthMiddleware(SECRET));
  app.get('/unmatched-ingredients/export', makeExportUnmatchedIngredientsHandler(reader));
  app.post('/unmatched-ingredients/clear', makeClearUnmatchedIngredientsHandler(cleaner));
  return app;
}

async function authedRequest(app: Hono, path: string, init: RequestInit = {}): Promise<Response> {
  const token = await signSession(SECRET);
  return app.request(path, {
    ...init,
    headers: { ...init.headers, Cookie: `session=${token}` },
  });
}

describe('GET /unmatched-ingredients/export', () => {
  it('returns the current entries without side effects', async () => {
    const entries = [sampleEntry({ name: 'Apfel', foldedName: 'apfel' }), sampleEntry()];
    const load = vi.fn<() => Promise<{ entries: UnmatchedIngredientEntry[] }>>().mockResolvedValue({ entries });
    const clear = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

    const app = makeApp({ load }, { clear });
    const res = await authedRequest(app, '/unmatched-ingredients/export');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ entries });
    expect(load).toHaveBeenCalledTimes(1);
    expect(clear).not.toHaveBeenCalled();
  });

  it('returns 200 with an empty entries list when the store is empty', async () => {
    const load = vi.fn<() => Promise<{ entries: UnmatchedIngredientEntry[] }>>().mockResolvedValue({ entries: [] });
    const clear = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

    const app = makeApp({ load }, { clear });
    const res = await authedRequest(app, '/unmatched-ingredients/export');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ entries: [] });
  });

  it('returns 401 when no session cookie is present', async () => {
    const load = vi.fn<() => Promise<{ entries: UnmatchedIngredientEntry[] }>>().mockResolvedValue({ entries: [] });
    const clear = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

    const app = makeApp({ load }, { clear });
    const res = await app.request('/unmatched-ingredients/export');

    expect(res.status).toBe(401);
    expect(load).not.toHaveBeenCalled();
  });
});

describe('POST /unmatched-ingredients/clear', () => {
  it('returns 204 and invokes clear() on the cleaner', async () => {
    const load = vi.fn<() => Promise<{ entries: UnmatchedIngredientEntry[] }>>().mockResolvedValue({ entries: [] });
    const clear = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

    const app = makeApp({ load }, { clear });
    const res = await authedRequest(app, '/unmatched-ingredients/clear', { method: 'POST' });

    expect(res.status).toBe(204);
    expect(clear).toHaveBeenCalledTimes(1);
  });

  it('is idempotent on an already-empty store', async () => {
    const load = vi.fn<() => Promise<{ entries: UnmatchedIngredientEntry[] }>>().mockResolvedValue({ entries: [] });
    const clear = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

    const app = makeApp({ load }, { clear });
    await authedRequest(app, '/unmatched-ingredients/clear', { method: 'POST' });
    const res = await authedRequest(app, '/unmatched-ingredients/clear', { method: 'POST' });

    expect(res.status).toBe(204);
    expect(clear).toHaveBeenCalledTimes(2);
  });

  it('returns 401 when no session cookie is present', async () => {
    const load = vi.fn<() => Promise<{ entries: UnmatchedIngredientEntry[] }>>().mockResolvedValue({ entries: [] });
    const clear = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

    const app = makeApp({ load }, { clear });
    const res = await app.request('/unmatched-ingredients/clear', { method: 'POST' });

    expect(res.status).toBe(401);
    expect(clear).not.toHaveBeenCalled();
  });
});
