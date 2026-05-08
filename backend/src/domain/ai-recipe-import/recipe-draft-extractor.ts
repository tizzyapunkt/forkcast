import type { ExtractedDraft, RecipeImage } from './types.ts';

/**
 * Port for extracting a draft recipe from one or more ordered images of the
 * same recipe. Order matters — adapters MUST present the images to the
 * underlying model in the given order so multi-page recipes parse correctly.
 */
export interface RecipeDraftExtractor {
  extract(images: RecipeImage[]): Promise<ExtractedDraft>;
}

export class RecipeDraftExtractionError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'RecipeDraftExtractionError';
  }
}
