import { describe, it, expect, vi } from 'vitest';
import { saveScannedProduct, SaveScannedProductValidationError } from './save-scanned-product.use-case.ts';
import type { ScannedProduct, ScannedProductStore } from './types.ts';

function makeStore(): ScannedProductStore & { upsert: ReturnType<typeof vi.fn> } {
  return {
    findByBarcode: vi.fn<(b: string) => Promise<ScannedProduct | null>>().mockResolvedValue(null),
    upsert: vi.fn<(p: ScannedProduct) => Promise<void>>().mockResolvedValue(undefined),
  };
}

const validPayload = {
  barcode: '4337256176103',
  name: 'Himbeer-Heidelbeer-Mix',
  unit: 'g',
  macrosPer100: { calories: 54, protein: 0.9, carbs: 8.4, fat: 0.7 },
};

describe('saveScannedProduct', () => {
  it('upserts a stamped product and returns a SCAN search result', async () => {
    const store = makeStore();
    const now = new Date('2026-05-24T12:00:00.000Z');
    const result = await saveScannedProduct(store, validPayload, now);

    expect(store.upsert).toHaveBeenCalledWith({ ...validPayload, capturedAt: '2026-05-24T12:00:00.000Z' });
    expect(result).toMatchObject({ id: '4337256176103', source: 'SCAN', name: 'Himbeer-Heidelbeer-Mix', unit: 'g' });
    expect(result.macrosPerUnit.calories).toBeCloseTo(0.54, 10);
  });

  it('rejects a blank name without touching the store', async () => {
    const store = makeStore();
    await expect(saveScannedProduct(store, { ...validPayload, name: '  ' })).rejects.toBeInstanceOf(
      SaveScannedProductValidationError,
    );
    expect(store.upsert).not.toHaveBeenCalled();
  });

  it('rejects a unit outside g/ml', async () => {
    const store = makeStore();
    await expect(saveScannedProduct(store, { ...validPayload, unit: 'kg' })).rejects.toBeInstanceOf(
      SaveScannedProductValidationError,
    );
    expect(store.upsert).not.toHaveBeenCalled();
  });

  it('rejects a negative macro', async () => {
    const store = makeStore();
    await expect(
      saveScannedProduct(store, { ...validPayload, macrosPer100: { calories: -1, protein: 0, carbs: 0, fat: 0 } }),
    ).rejects.toBeInstanceOf(SaveScannedProductValidationError);
  });

  it('rejects a missing barcode', async () => {
    const store = makeStore();
    await expect(saveScannedProduct(store, { ...validPayload, barcode: '' })).rejects.toBeInstanceOf(
      SaveScannedProductValidationError,
    );
  });
});
