import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { makeSaveScannedProductHandler } from './save-scanned-product.handler.ts';
import type { ScannedProduct, ScannedProductStore } from '../../domain/barcode-product-capture/types.ts';

function makeApp() {
  const products = new Map<string, ScannedProduct>();
  const store: ScannedProductStore = {
    findByBarcode: vi.fn<(b: string) => Promise<ScannedProduct | null>>(async (b) => products.get(b) ?? null),
    upsert: vi.fn<(p: ScannedProduct) => Promise<void>>(async (p) => {
      products.set(p.barcode, p);
    }),
  };
  const app = new Hono();
  app.post('/save-scanned-product', makeSaveScannedProductHandler(store));
  return { app, store, products };
}

const validPayload = {
  barcode: '4337256176103',
  name: 'Himbeer-Heidelbeer-Mix',
  unit: 'g',
  macrosPer100: { calories: 54, protein: 0.9, carbs: 8.4, fat: 0.7 },
};

async function post(app: Hono, body: unknown) {
  return app.request('/save-scanned-product', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /save-scanned-product', () => {
  it('saves a valid product and returns a SCAN search result', async () => {
    const { app, products } = makeApp();
    const res = await post(app, validPayload);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string; source: string; macrosPerUnit: { calories: number } };
    expect(body.id).toBe('4337256176103');
    expect(body.source).toBe('SCAN');
    expect(body.macrosPerUnit.calories).toBeCloseTo(0.54, 10);
    expect(products.get('4337256176103')).toMatchObject({ name: 'Himbeer-Heidelbeer-Mix' });
  });

  it('rejects an invalid payload with 400 and leaves the store untouched', async () => {
    const { app, store } = makeApp();
    const res = await post(app, { ...validPayload, unit: 'kg' });
    expect(res.status).toBe(400);
    expect(store.upsert).not.toHaveBeenCalled();
  });

  it('overwrites an existing barcode rather than duplicating it', async () => {
    const { app, products } = makeApp();
    await post(app, validPayload);
    await post(app, { ...validPayload, macrosPer100: { calories: 52, protein: 1, carbs: 8, fat: 0.6 } });
    expect(products.size).toBe(1);
    expect(products.get('4337256176103')!.macrosPer100.calories).toBe(52);
  });
});
