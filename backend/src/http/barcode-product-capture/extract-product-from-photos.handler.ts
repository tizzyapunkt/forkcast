import type { Context } from 'hono';
import { extractProductFromPhotos } from '../../domain/barcode-product-capture/extract-product-from-photos.use-case.ts';
import {
  ProductDraftExtractionError,
  type ProductDraftExtractor,
} from '../../domain/barcode-product-capture/product-draft-extractor.ts';
import { decodeImagePayloads, type ImageDecodeLimits } from '../ai-images/decode-image-payloads.ts';

export interface ExtractProductFromPhotosHandlerDeps {
  extractor: ProductDraftExtractor;
  limits: ImageDecodeLimits;
}

interface RequestBody {
  barcode?: unknown;
  images?: unknown;
}

export function makeUnconfiguredExtractProductFromPhotosHandler() {
  return (c: Context) => c.json({ error: 'ai-import-not-configured' }, 503);
}

export function makeExtractProductFromPhotosHandler(deps: ExtractProductFromPhotosHandlerDeps) {
  const { extractor, limits } = deps;
  return async (c: Context) => {
    let body: RequestBody;
    try {
      body = await c.req.json<RequestBody>();
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }

    const barcode = typeof body?.barcode === 'string' ? body.barcode.trim() : '';
    if (!barcode) {
      return c.json({ error: 'barcode is required' }, 400);
    }

    const decoded = decodeImagePayloads(body?.images, limits);
    if (!decoded.ok) {
      return c.json(decoded.body, decoded.status);
    }

    try {
      const draft = await extractProductFromPhotos({ extractor }, { barcode, images: decoded.images });
      return c.json(draft);
    } catch (err) {
      if (err instanceof ProductDraftExtractionError) {
        return c.json({ error: 'ai-extraction-failed', detail: err.message }, 502);
      }
      const message = err instanceof Error ? err.message : 'Unknown error';
      return c.json({ error: message }, 400);
    }
  };
}
