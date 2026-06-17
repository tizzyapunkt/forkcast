import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { Buffer } from 'node:buffer';
import {
  makeImportRecipeFromPhotosHandler,
  makeUnconfiguredImportRecipeFromPhotosHandler,
  type ImportRecipeFromPhotosLimits,
} from './import-recipe-from-photos.handler.ts';
import { RecipeDraftExtractionError } from '../../domain/ai-recipe-import/recipe-draft-extractor.ts';
import type { ExtractedDraft, RecipeImage } from '../../domain/ai-recipe-import/types.ts';
import type { IngredientSearchService } from '../../domain/ingredient-search/ingredient-search.service.ts';
import type { IngredientSearchResult } from '../../domain/ingredient-search/types.ts';

const DEFAULT_LIMITS: ImportRecipeFromPhotosLimits = {
  maxImages: 8,
  maxImageBytes: 5 * 1024 * 1024,
  maxTotalBytes: 20 * 1024 * 1024,
};

function makeApp(opts: {
  extractor?: { extract: (images: RecipeImage[]) => Promise<ExtractedDraft> } | null;
  search?: IngredientSearchService;
  limits?: ImportRecipeFromPhotosLimits;
  includeDebug?: boolean;
}) {
  const app = new Hono();
  if (opts.extractor === null) {
    app.post('/import-recipe-from-photos', makeUnconfiguredImportRecipeFromPhotosHandler());
    return app;
  }
  const extractor = opts.extractor ?? {
    extract: vi.fn<(images: RecipeImage[]) => Promise<ExtractedDraft>>(async () => ({
      name: 'Pasta',
      yield: 1,
      ingredients: [{ name: 'olive oil', amount: 30, unit: 'ml' as const }],
      steps: ['Boil', 'Cook'],
    })),
  };
  const search: IngredientSearchService = opts.search ?? {
    searchByName: vi.fn<(q: string) => Promise<IngredientSearchResult[]>>().mockResolvedValue([
      {
        id: 'foods-1',
        source: 'FOODS',
        name: 'Olivenöl',
        unit: 'ml',
        macrosPerUnit: { calories: 9, protein: 0, carbs: 0, fat: 1 },
      },
    ]),
    searchByBarcode: vi.fn<(barcode: string) => Promise<IngredientSearchResult | null>>(async () => null),
  };
  app.post(
    '/import-recipe-from-photos',
    makeImportRecipeFromPhotosHandler({
      extractor,
      search,
      limits: opts.limits ?? DEFAULT_LIMITS,
      includeDebug: opts.includeDebug,
    }),
  );
  return app;
}

const tinyJpeg = (size = 100) => ({
  data: Buffer.alloc(size, 0xab).toString('base64'),
  mediaType: 'image/jpeg' as const,
});

describe('POST /import-recipe-from-photos', () => {
  it('returns 200 with a draft on a happy multi-image request', async () => {
    const app = makeApp({});
    const res = await app.request('/import-recipe-from-photos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ images: [tinyJpeg(50), tinyJpeg(60), tinyJpeg(70)] }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { name: string; ingredients: unknown[]; steps: unknown[] };
    expect(body.name).toBe('Pasta');
    expect(body.ingredients).toHaveLength(1);
    expect(body.steps).toEqual(['Boil', 'Cook']);
  });

  it('returns 400 when images is empty', async () => {
    const app = makeApp({});
    const res = await app.request('/import-recipe-from-photos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ images: [] }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/at least one image/i);
  });

  it('returns 400 when more images than the configured maximum are submitted', async () => {
    const app = makeApp({ limits: { maxImages: 2, maxImageBytes: 1024, maxTotalBytes: 1024 * 1024 } });
    const res = await app.request('/import-recipe-from-photos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ images: [tinyJpeg(10), tinyJpeg(10), tinyJpeg(10)] }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/at most 2/i);
  });

  it('returns 400 with offending index for an unsupported media type', async () => {
    const app = makeApp({});
    const res = await app.request('/import-recipe-from-photos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        images: [tinyJpeg(20), { data: 'aGVsbG8=', mediaType: 'image/gif' }],
      }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; imageIndex: number };
    expect(body.imageIndex).toBe(1);
    expect(body.error).toMatch(/image\/gif/i);
  });

  it('returns 413 with offending index when an image exceeds the per-image limit', async () => {
    const app = makeApp({ limits: { maxImages: 8, maxImageBytes: 100, maxTotalBytes: 1024 * 1024 } });
    const res = await app.request('/import-recipe-from-photos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ images: [tinyJpeg(50), tinyJpeg(500)] }),
    });
    expect(res.status).toBe(413);
    const body = (await res.json()) as { error: string; imageIndex: number };
    expect(body.imageIndex).toBe(1);
  });

  it('returns 413 when combined image size exceeds the total limit', async () => {
    const app = makeApp({ limits: { maxImages: 8, maxImageBytes: 1000, maxTotalBytes: 800 } });
    const res = await app.request('/import-recipe-from-photos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ images: [tinyJpeg(500), tinyJpeg(500)] }),
    });
    expect(res.status).toBe(413);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/total/i);
  });

  it('returns 502 when the adapter throws RecipeDraftExtractionError', async () => {
    const extractor = {
      extract: vi.fn<(images: RecipeImage[]) => Promise<ExtractedDraft>>(async () => {
        throw new RecipeDraftExtractionError('upstream boom');
      }),
    };
    const app = makeApp({ extractor });
    const res = await app.request('/import-recipe-from-photos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ images: [tinyJpeg(20)] }),
    });
    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('ai-extraction-failed');
  });

  it('returns 503 when the extractor is not configured', async () => {
    const app = makeApp({ extractor: null });
    const res = await app.request('/import-recipe-from-photos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ images: [tinyJpeg(20)] }),
    });
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('ai-import-not-configured');
  });

  it('returns 200 with pieceQuantity carried end-to-end on the response payload', async () => {
    const extractor = {
      extract: vi.fn<(images: RecipeImage[]) => Promise<ExtractedDraft>>(async () => ({
        name: 'Soup',
        yield: 1,
        ingredients: [
          {
            name: 'Zwiebel',
            amount: 150,
            unit: 'g' as const,
            pieceQuantity: { amount: 1, unitLabel: 'Zwiebel', gramsPerPiece: 150 },
          },
        ],
        steps: [],
      })),
    };
    const search: IngredientSearchService = {
      searchByName: vi.fn<(q: string) => Promise<IngredientSearchResult[]>>().mockResolvedValue([
        {
          id: 'foods-zwiebel',
          source: 'FOODS',
          name: 'Zwiebel',
          unit: 'g',
          macrosPerUnit: { calories: 0.4, protein: 0.011, carbs: 0.093, fat: 0.001 },
        },
      ]),
      searchByBarcode: vi.fn<(barcode: string) => Promise<IngredientSearchResult | null>>(async () => null),
    };
    const app = makeApp({ extractor, search });
    const res = await app.request('/import-recipe-from-photos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ images: [tinyJpeg(20)] }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ingredients: Array<{ pieceQuantity?: { amount: number; unitLabel: string; gramsPerPiece: number } }>;
    };
    expect(body.ingredients[0]?.pieceQuantity).toEqual({ amount: 1, unitLabel: 'Zwiebel', gramsPerPiece: 150 });
  });

  it('omits the debug field from the response by default', async () => {
    const app = makeApp({});
    const res = await app.request('/import-recipe-from-photos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ images: [tinyJpeg(20)] }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect('debug' in body).toBe(false);
  });

  it('includes a debug.ingredients array on the response when includeDebug is true', async () => {
    const app = makeApp({ includeDebug: true });
    const res = await app.request('/import-recipe-from-photos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ images: [tinyJpeg(20)] }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      debug?: {
        ingredients: Array<{
          raw: { name: string };
          candidates: Array<{ name: string }>;
          chosen: { name: string } | null;
          flags: {
            unitOverridden: boolean;
            pieceQuantityDropped: boolean;
            untrackedInherited: boolean;
            missingAmount: boolean;
          };
        }>;
      };
    };
    expect(body.debug).toBeDefined();
    expect(body.debug!.ingredients).toHaveLength(1);
    const entry = body.debug!.ingredients[0]!;
    expect(entry.raw.name).toBe('olive oil');
    expect(entry.candidates[0]?.name).toBe('Olivenöl');
    expect(entry.chosen?.name).toBe('Olivenöl');
    expect(entry.flags).toEqual({
      unitOverridden: false,
      pieceQuantityDropped: false,
      untrackedInherited: false,
      missingAmount: false,
    });
  });

  it('returns 400 on invalid JSON', async () => {
    const app = makeApp({});
    const res = await app.request('/import-recipe-from-photos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });
    expect(res.status).toBe(400);
  });
});
