import type { IngredientSearchResult } from '../ingredient-search/types.ts';
import type { ScannedProductStore } from './types.ts';
import { mapScannedProduct } from './map-scanned-product.ts';
import { validateScannedProductInput } from './validate-scanned-product.ts';

export class SaveScannedProductValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SaveScannedProductValidationError';
  }
}

/**
 * Validates a reviewed product, upserts it to the store keyed by barcode
 * (stamping `capturedAt`), and returns it mapped to a `SCAN` search result so
 * the caller can log it through the existing select path.
 */
export async function saveScannedProduct(
  store: ScannedProductStore,
  payload: unknown,
  now: Date = new Date(),
): Promise<IngredientSearchResult> {
  const result = validateScannedProductInput(payload);
  if (!result.ok) {
    throw new SaveScannedProductValidationError(result.reason);
  }
  const product = { ...result.value, capturedAt: now.toISOString() };
  await store.upsert(product);
  return mapScannedProduct(product);
}
