import type { ExtractedProduct, ProductImage } from './types.ts';

/**
 * Port for extracting a packaged product (name, unit, per-100 macros) from one
 * or more photos of its packaging.
 */
export interface ProductDraftExtractor {
  extract(images: ProductImage[]): Promise<ExtractedProduct>;
}

export class ProductDraftExtractionError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'ProductDraftExtractionError';
  }
}
