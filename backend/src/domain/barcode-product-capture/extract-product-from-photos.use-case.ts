import type { ProductDraftExtractor } from './product-draft-extractor.ts';
import type { ProductDraft, ProductImage } from './types.ts';

export interface ExtractProductFromPhotosDeps {
  extractor: ProductDraftExtractor;
}

export interface ExtractProductFromPhotosInput {
  barcode: string;
  images: ProductImage[];
}

/**
 * Reads a product draft from packaging photos and attaches the scanned
 * barcode. Persists nothing — the draft is returned for user review, then
 * saved via {@link saveScannedProduct}.
 */
export async function extractProductFromPhotos(
  deps: ExtractProductFromPhotosDeps,
  input: ExtractProductFromPhotosInput,
): Promise<ProductDraft> {
  const barcode = input.barcode?.trim();
  if (!barcode) {
    throw new Error('barcode is required');
  }
  if (!input.images || input.images.length === 0) {
    throw new Error('At least one image is required');
  }

  const extracted = await deps.extractor.extract(input.images);
  return { barcode, ...extracted };
}
