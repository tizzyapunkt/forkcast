import type { Context } from 'hono';
import { Buffer } from 'node:buffer';
import { importRecipeFromPhotos } from '../../domain/ai-recipe-import/import-recipe-from-photos.use-case.ts';
import {
  RecipeDraftExtractionError,
  type RecipeDraftExtractor,
} from '../../domain/ai-recipe-import/recipe-draft-extractor.ts';
import type { RecipeImage, SupportedImageMediaType } from '../../domain/ai-recipe-import/types.ts';
import type { IngredientSearchService } from '../../domain/ingredient-search/ingredient-search.service.ts';

const SUPPORTED_MEDIA_TYPES: SupportedImageMediaType[] = ['image/jpeg', 'image/png', 'image/webp'];

export interface ImportRecipeFromPhotosLimits {
  maxImages: number;
  maxImageBytes: number;
  maxTotalBytes: number;
}

export interface ImportRecipeFromPhotosHandlerDeps {
  extractor: RecipeDraftExtractor;
  search: IngredientSearchService;
  limits: ImportRecipeFromPhotosLimits;
}

interface RequestBody {
  images?: Array<{ data?: unknown; mediaType?: unknown }>;
}

export function makeUnconfiguredImportRecipeFromPhotosHandler() {
  return (c: Context) => c.json({ error: 'ai-import-not-configured' }, 503);
}

export function makeImportRecipeFromPhotosHandler(deps: ImportRecipeFromPhotosHandlerDeps) {
  const { extractor, search, limits } = deps;
  return async (c: Context) => {
    let body: RequestBody;
    try {
      body = await c.req.json<RequestBody>();
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }

    if (!body || !Array.isArray(body.images)) {
      return c.json({ error: 'images must be an array' }, 400);
    }
    if (body.images.length === 0) {
      return c.json({ error: 'At least one image is required' }, 400);
    }
    if (body.images.length > limits.maxImages) {
      return c.json(
        {
          error: `At most ${limits.maxImages} images per request, got ${body.images.length}`,
          maxImages: limits.maxImages,
          submitted: body.images.length,
        },
        400,
      );
    }

    const decoded: RecipeImage[] = [];
    let totalBytes = 0;
    for (let i = 0; i < body.images.length; i++) {
      const item = body.images[i];
      if (!item || typeof item !== 'object') {
        return c.json({ error: 'Each image must be an object', imageIndex: i }, 400);
      }
      if (typeof item.data !== 'string' || item.data.length === 0) {
        return c.json({ error: 'Each image must have a base64 "data" string', imageIndex: i }, 400);
      }
      if (typeof item.mediaType !== 'string' || !(SUPPORTED_MEDIA_TYPES as string[]).includes(item.mediaType)) {
        return c.json(
          {
            error: `Unsupported mediaType "${String(item.mediaType)}"; allowed: ${SUPPORTED_MEDIA_TYPES.join(', ')}`,
            imageIndex: i,
          },
          400,
        );
      }
      let bytes: Uint8Array;
      try {
        bytes = new Uint8Array(Buffer.from(item.data, 'base64'));
      } catch {
        return c.json({ error: 'Image "data" is not valid base64', imageIndex: i }, 400);
      }
      if (bytes.length === 0) {
        return c.json({ error: 'Decoded image is empty', imageIndex: i }, 400);
      }
      if (bytes.length > limits.maxImageBytes) {
        return c.json(
          {
            error: `Image at index ${i} is ${bytes.length} bytes, exceeding the per-image limit of ${limits.maxImageBytes} bytes`,
            imageIndex: i,
            maxImageBytes: limits.maxImageBytes,
          },
          413,
        );
      }
      totalBytes += bytes.length;
      if (totalBytes > limits.maxTotalBytes) {
        return c.json(
          {
            error: `Combined image size exceeds the total limit of ${limits.maxTotalBytes} bytes`,
            maxTotalBytes: limits.maxTotalBytes,
          },
          413,
        );
      }
      decoded.push({ mediaType: item.mediaType as SupportedImageMediaType, bytes });
    }

    try {
      const draft = await importRecipeFromPhotos({ extractor, search }, decoded);
      return c.json(draft);
    } catch (err) {
      if (err instanceof RecipeDraftExtractionError) {
        return c.json({ error: 'ai-extraction-failed', detail: err.message }, 502);
      }
      const message = err instanceof Error ? err.message : 'Unknown error';
      return c.json({ error: message }, 400);
    }
  };
}
