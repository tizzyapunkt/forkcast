import type { Context } from 'hono';
import {
  saveScannedProduct,
  SaveScannedProductValidationError,
} from '../../domain/barcode-product-capture/save-scanned-product.use-case.ts';
import type { ScannedProductStore } from '../../domain/barcode-product-capture/types.ts';

export function makeSaveScannedProductHandler(store: ScannedProductStore) {
  return async (c: Context) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }

    try {
      const result = await saveScannedProduct(store, body);
      return c.json(result);
    } catch (err) {
      if (err instanceof SaveScannedProductValidationError) {
        return c.json({ error: err.message }, 400);
      }
      throw err;
    }
  };
}
