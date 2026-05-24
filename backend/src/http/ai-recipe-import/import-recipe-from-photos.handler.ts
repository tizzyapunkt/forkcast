import type { Context } from 'hono';
import { importRecipeFromPhotos } from '../../domain/ai-recipe-import/import-recipe-from-photos.use-case.ts';
import {
  RecipeDraftExtractionError,
  type RecipeDraftExtractor,
} from '../../domain/ai-recipe-import/recipe-draft-extractor.ts';
import type { IngredientSearchService } from '../../domain/ingredient-search/ingredient-search.service.ts';
import type { UnmatchedIngredientRecorder } from '../../domain/unmatched-ingredients/types.ts';
import { decodeImagePayloads, type ImageDecodeLimits } from '../ai-images/decode-image-payloads.ts';

export type ImportRecipeFromPhotosLimits = ImageDecodeLimits;

export interface ImportRecipeFromPhotosHandlerDeps {
  extractor: RecipeDraftExtractor;
  search: IngredientSearchService;
  limits: ImportRecipeFromPhotosLimits;
  /** When true, the response includes a `debug` field describing per-ingredient matching. Defaults to false. */
  includeDebug?: boolean;
  /** Optional sink for strict-unmatched ingredient names. */
  recorder?: UnmatchedIngredientRecorder;
}

interface RequestBody {
  images?: Array<{ data?: unknown; mediaType?: unknown }>;
}

export function makeUnconfiguredImportRecipeFromPhotosHandler() {
  return (c: Context) => c.json({ error: 'ai-import-not-configured' }, 503);
}

export function makeImportRecipeFromPhotosHandler(deps: ImportRecipeFromPhotosHandlerDeps) {
  const { extractor, search, limits, includeDebug, recorder } = deps;
  return async (c: Context) => {
    let body: RequestBody;
    try {
      body = await c.req.json<RequestBody>();
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }

    const decodedResult = decodeImagePayloads(body?.images, limits);
    if (!decodedResult.ok) {
      return c.json(decodedResult.body, decodedResult.status);
    }
    const decoded = decodedResult.images;

    try {
      const draft = await importRecipeFromPhotos({ extractor, search, includeDebug, recorder }, decoded);
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
