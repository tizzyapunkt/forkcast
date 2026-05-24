import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JsonScannedProductStore } from './json-scanned-products.store.ts';
import type { ScannedProduct } from '../../domain/barcode-product-capture/types.ts';

const sample = (overrides: Partial<ScannedProduct> = {}): ScannedProduct => ({
  barcode: '4337256176103',
  name: 'Himbeer-Heidelbeer-Mix',
  unit: 'g',
  macrosPer100: { calories: 54, protein: 0.9, carbs: 8.4, fat: 0.7 },
  capturedAt: '2026-05-24T12:00:00.000Z',
  ...overrides,
});

describe('JsonScannedProductStore', () => {
  let dir: string;
  let path: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'forkcast-scanned-'));
    path = join(dir, 'scanned-products.json');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('loads a missing file as empty', async () => {
    const store = new JsonScannedProductStore(path);
    expect(await store.load()).toEqual([]);
    expect(await store.findByBarcode('x')).toBeNull();
  });

  it('skips invalid entries on load and keeps valid ones', async () => {
    writeFileSync(
      path,
      JSON.stringify([
        sample(),
        { barcode: '', name: 'bad', unit: 'g', macrosPer100: { calories: 1, protein: 0, carbs: 0, fat: 0 } },
        { barcode: '999', name: 'no macros', unit: 'kg' },
      ]),
      'utf-8',
    );
    const store = new JsonScannedProductStore(path);
    const loaded = await store.load();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]!.barcode).toBe('4337256176103');
  });

  it('upserts a product, writing pretty JSON atomically', async () => {
    const store = new JsonScannedProductStore(path);
    await store.upsert(sample());
    expect(existsSync(path)).toBe(true);
    const onDisk = readFileSync(path, 'utf-8');
    expect(onDisk).toMatch(/\n {4}"barcode"/); // 2-space indentation, nested one level in the array
    expect(onDisk.endsWith('\n')).toBe(true);
    expect(await store.findByBarcode('4337256176103')).toMatchObject({ name: 'Himbeer-Heidelbeer-Mix' });
  });

  it('overwrites an existing barcode rather than duplicating it', async () => {
    const store = new JsonScannedProductStore(path);
    await store.upsert(sample({ macrosPer100: { calories: 54, protein: 0.9, carbs: 8.4, fat: 0.7 } }));
    await store.upsert(sample({ macrosPer100: { calories: 52, protein: 1, carbs: 8, fat: 0.6 } }));
    const loaded = await store.load();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]!.macrosPer100.calories).toBe(52);
  });

  it('returns null for an unknown barcode', async () => {
    const store = new JsonScannedProductStore(path);
    await store.upsert(sample());
    expect(await store.findByBarcode('0000000000000')).toBeNull();
  });
});
