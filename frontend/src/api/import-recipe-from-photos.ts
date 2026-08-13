import { ApiError, fetchJson } from './client';
import type { RecipeDraft } from '../domain/recipes';

export class ImportNotConfiguredError extends Error {
  constructor() {
    super('AI recipe import is not configured on the server');
    this.name = 'ImportNotConfiguredError';
  }
}

export type SupportedImageMediaType = 'image/jpeg' | 'image/png' | 'image/webp';

export interface ImportImagePayload {
  data: string;
  mediaType: SupportedImageMediaType;
}

export async function importRecipeFromPhotos(images: ImportImagePayload[], signal?: AbortSignal): Promise<RecipeDraft> {
  try {
    return await fetchJson<RecipeDraft>('/api/import-recipe-from-photos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ images }),
      ...(signal ? { signal } : {}),
    });
  } catch (err) {
    if (err instanceof ApiError && err.status === 503 && err.message === 'ai-import-not-configured') {
      throw new ImportNotConfiguredError();
    }
    throw err;
  }
}
