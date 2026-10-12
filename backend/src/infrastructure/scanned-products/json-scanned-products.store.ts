import type { ScannedProduct, ScannedProductStore } from '../../domain/barcode-product-capture/types.ts';
import { validateScannedProduct } from '../../domain/barcode-product-capture/validate-scanned-product.ts';
import type { JsonDocument } from '../json-document/json-document.ts';

/**
 * Runtime-writable JSON store for products captured from packaging photos,
 * keyed by barcode. Mirrors the other JSON-store adapters: serialised writes,
 * atomic document writes, validate-and-skip on load.
 */
export class JsonScannedProductStore implements ScannedProductStore {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly document: JsonDocument) {}

  async load(): Promise<ScannedProduct[]> {
    const raw = await this.document.read();
    if (raw === null) return [];
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.warn(`scanned-products: failed to parse ${this.document.location}; treating as empty`);
      return [];
    }
    if (!Array.isArray(parsed)) {
      console.warn(`scanned-products: malformed top-level shape in ${this.document.location}; treating as empty`);
      return [];
    }
    const products: ScannedProduct[] = [];
    for (const entry of parsed) {
      const result = validateScannedProduct(entry);
      if (!result.ok) {
        console.warn(`scanned-products: skipping invalid entry: ${result.reason}`);
        continue;
      }
      products.push(result.product);
    }
    return products;
  }

  async list(): Promise<ScannedProduct[]> {
    return this.load();
  }

  async findByBarcode(barcode: string): Promise<ScannedProduct | null> {
    const products = await this.load();
    return products.find((p) => p.barcode === barcode) ?? null;
  }

  async upsert(product: ScannedProduct): Promise<void> {
    await this.enqueue(async () => {
      const current = await this.load();
      const next = current.filter((p) => p.barcode !== product.barcode);
      next.push(product);
      await this.writeAtomic(next);
    });
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.queue.then(fn, fn);
    this.queue = next.catch(() => undefined);
    return next;
  }

  private async writeAtomic(products: ScannedProduct[]): Promise<void> {
    const sorted = [...products].sort((a, b) => a.barcode.localeCompare(b.barcode));
    await this.document.write(JSON.stringify(sorted, null, 2) + '\n');
  }
}
