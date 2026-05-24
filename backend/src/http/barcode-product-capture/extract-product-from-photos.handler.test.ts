import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { Buffer } from 'node:buffer';
import {
  makeExtractProductFromPhotosHandler,
  makeUnconfiguredExtractProductFromPhotosHandler,
} from './extract-product-from-photos.handler.ts';
import { ProductDraftExtractionError } from '../../domain/barcode-product-capture/product-draft-extractor.ts';
import type { ExtractedProduct, ProductImage } from '../../domain/barcode-product-capture/types.ts';
import type { ImageDecodeLimits } from '../ai-images/decode-image-payloads.ts';

const LIMITS: ImageDecodeLimits = { maxImages: 4, maxImageBytes: 5 * 1024 * 1024, maxTotalBytes: 20 * 1024 * 1024 };

const extracted: ExtractedProduct = {
  name: 'Himbeer-Heidelbeer-Mix',
  unit: 'g',
  macrosPer100: { calories: 54, protein: 0.9, carbs: 8.4, fat: 0.7 },
};

function makeApp(opts: { extract?: (images: ProductImage[]) => Promise<ExtractedProduct>; unconfigured?: boolean }) {
  const app = new Hono();
  if (opts.unconfigured) {
    app.post('/extract-product-from-photos', makeUnconfiguredExtractProductFromPhotosHandler());
    return { app, extract: vi.fn<(images: ProductImage[]) => Promise<ExtractedProduct>>() };
  }
  const extract = vi.fn<(images: ProductImage[]) => Promise<ExtractedProduct>>(opts.extract ?? (async () => extracted));
  app.post(
    '/extract-product-from-photos',
    makeExtractProductFromPhotosHandler({ extractor: { extract }, limits: LIMITS }),
  );
  return { app, extract };
}

const jpeg = (size = 50) => ({ data: Buffer.alloc(size, 0xab).toString('base64'), mediaType: 'image/jpeg' as const });

async function post(app: Hono, body: unknown) {
  return app.request('/extract-product-from-photos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /extract-product-from-photos', () => {
  it('returns 200 with a draft carrying the scanned barcode', async () => {
    const { app } = makeApp({});
    const res = await post(app, { barcode: '4337256176103', images: [jpeg()] });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { barcode: string; name: string; unit: string; macrosPer100: unknown };
    expect(body.barcode).toBe('4337256176103');
    expect(body.name).toBe('Himbeer-Heidelbeer-Mix');
    expect(body.unit).toBe('g');
    expect(body.macrosPer100).toEqual(extracted.macrosPer100);
  });

  it('returns 400 and does not call the extractor when the barcode is missing', async () => {
    const { app, extract } = makeApp({});
    const res = await post(app, { images: [jpeg()] });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/barcode/i);
    expect(extract).not.toHaveBeenCalled();
  });

  it('returns 400 when images is empty', async () => {
    const { app } = makeApp({});
    const res = await post(app, { barcode: '111', images: [] });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/at least one image/i);
  });

  it('returns 400 when too many images are submitted', async () => {
    const { app } = makeApp({});
    const res = await post(app, { barcode: '111', images: [jpeg(), jpeg(), jpeg(), jpeg(), jpeg()] });
    expect(res.status).toBe(400);
    expect((await res.json()).maxImages).toBe(4);
  });

  it('returns 413 when an image exceeds the per-image limit', async () => {
    const app = new Hono();
    app.post(
      '/extract-product-from-photos',
      makeExtractProductFromPhotosHandler({
        extractor: { extract: vi.fn<(images: ProductImage[]) => Promise<ExtractedProduct>>(async () => extracted) },
        limits: { maxImages: 4, maxImageBytes: 100, maxTotalBytes: 1000 },
      }),
    );
    const res = await post(app, { barcode: '111', images: [jpeg(500)] });
    expect(res.status).toBe(413);
  });

  it('returns 502 when extraction fails', async () => {
    const { app } = makeApp({
      extract: async () => {
        throw new ProductDraftExtractionError('boom');
      },
    });
    const res = await post(app, { barcode: '111', images: [jpeg()] });
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe('ai-extraction-failed');
  });

  it('the unconfigured handler returns 503 ai-import-not-configured', async () => {
    const { app } = makeApp({ unconfigured: true });
    const res = await post(app, { barcode: '111', images: [jpeg()] });
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe('ai-import-not-configured');
  });
});
