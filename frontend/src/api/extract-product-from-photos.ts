import { ApiError, fetchJson } from './client';
import type { SupportedImageMediaType } from './import-recipe-from-photos';

export class ProductCaptureNotConfiguredError extends Error {
  constructor() {
    super('AI product capture is not configured on the server');
    this.name = 'ProductCaptureNotConfiguredError';
  }
}

export interface CaptureImagePayload {
  data: string;
  mediaType: SupportedImageMediaType;
}

export interface ProductMacros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface ProductDraft {
  barcode: string;
  name: string;
  unit: 'g' | 'ml';
  macrosPer100: ProductMacros;
}

export async function extractProductFromPhotos(barcode: string, images: CaptureImagePayload[]): Promise<ProductDraft> {
  try {
    return await fetchJson<ProductDraft>('/api/extract-product-from-photos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ barcode, images }),
    });
  } catch (err) {
    if (err instanceof ApiError && err.status === 503 && err.message === 'ai-import-not-configured') {
      throw new ProductCaptureNotConfiguredError();
    }
    throw err;
  }
}
