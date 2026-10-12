import type { FoodEntry, FoodIndexedEntry } from '../../domain/foods/types.ts';
import type { CatalogStore, CatalogWriteResult } from '../../domain/food-catalog/types.ts';
import {
  findCatalogCollision,
  isValidCatalogId,
  validateCatalogEntry,
} from '../../domain/food-catalog/validate-catalog-entry.ts';
import { slugifyName } from '../../domain/food-catalog/slugify-name.ts';
import { indexFoodEntry } from '../../domain/foods/index-food-entry.ts';
import { fold } from '../../domain/ingredient-search/fold.ts';
import type { JsonDocument } from '../json-document/json-document.ts';

/**
 * Re-derive an id that predates the catalog's ASCII kebab-case rule (e.g. the
 * hand-written `speisestärke`) from the entry's name. Nothing references catalog
 * ids across stores, so repairing one is safe — and far better than dropping a
 * food the user still has. An unusable name falls through to validation.
 */
function repairId(entry: FoodEntry): FoodEntry {
  if (isValidCatalogId(entry.id)) return entry;
  if (typeof entry.name !== 'string') return entry;
  const repaired = slugifyName(entry.name);
  if (repaired.length === 0) return entry;
  console.warn(`catalog: repairing non-conforming id "${String(entry.id)}" as "${repaired}"`);
  return { ...entry, id: repaired };
}

export interface JsonCatalogStoreOptions {
  /** The runtime catalog (inside the data directory, for the file-backed store). */
  document: JsonDocument;
  /**
   * Starting-point catalog, installed only when `document` is empty. Omitted in
   * tests that start from an empty catalog.
   */
  seed?: JsonDocument;
}

/**
 * Runtime-writable JSON store for the single food catalog. Holds the whole
 * catalog in memory (reads are synchronous), persists every accepted write
 * atomically, and rebuilds the search index from the persisted entries so the
 * index and the stored document can never disagree.
 */
export class JsonCatalogStore implements CatalogStore {
  private queue: Promise<unknown> = Promise.resolve();
  private entries: FoodEntry[] = [];
  private indexedEntries: FoodIndexedEntry[] = [];

  private readonly document: JsonDocument;
  private readonly seed?: JsonDocument;

  constructor(options: JsonCatalogStoreOptions) {
    this.document = options.document;
    this.seed = options.seed;
  }

  /**
   * Use the existing catalog unchanged, or install the starting point when there
   * is none. An existing catalog is never read against, merged with, or
   * overwritten by the starting point.
   */
  async init(): Promise<void> {
    let raw = await this.document.read();
    if (raw === null && this.seed !== undefined) {
      const seed = await this.seed.read();
      if (seed === null) {
        throw new Error(
          `catalog: no catalog at ${this.document.location} and no starting point at ${this.seed.location} — cannot seed an empty catalog`,
        );
      }
      await this.document.write(seed);
      raw = seed;
      console.log(`catalog: seeded ${this.document.location} from ${this.seed.location}`);
    }
    this.setEntries(this.parse(raw));
  }

  list(): FoodEntry[] {
    return this.entries;
  }

  indexed(): FoodIndexedEntry[] {
    return this.indexedEntries;
  }

  findById(id: string): FoodEntry | null {
    return this.entries.find((e) => e.id === id) ?? null;
  }

  async add(entry: FoodEntry): Promise<CatalogWriteResult> {
    return this.enqueue(async () => {
      const validation = validateCatalogEntry(entry);
      if (!validation.ok) return { ok: false, kind: 'invalid', reason: validation.reason };
      const collision = findCatalogCollision(this.entries, validation.entry);
      if (collision !== null) return { ok: false, kind: 'conflict', reason: collision };
      await this.commit([...this.entries, validation.entry]);
      return { ok: true, entry: validation.entry };
    });
  }

  async update(id: string, entry: FoodEntry): Promise<CatalogWriteResult> {
    return this.enqueue(async () => {
      if (!this.entries.some((e) => e.id === id)) {
        return { ok: false, kind: 'not-found', reason: `no catalog entry with id "${id}"` };
      }
      const validation = validateCatalogEntry({ ...entry, id });
      if (!validation.ok) return { ok: false, kind: 'invalid', reason: validation.reason };
      const collision = findCatalogCollision(this.entries, validation.entry, id);
      if (collision !== null) return { ok: false, kind: 'conflict', reason: collision };
      await this.commit(this.entries.map((e) => (e.id === id ? validation.entry : e)));
      return { ok: true, entry: validation.entry };
    });
  }

  async remove(id: string): Promise<CatalogWriteResult> {
    return this.enqueue(async () => {
      const existing = this.entries.find((e) => e.id === id);
      if (!existing) return { ok: false, kind: 'not-found', reason: `no catalog entry with id "${id}"` };
      await this.commit(this.entries.filter((e) => e.id !== id));
      return { ok: true, entry: existing };
    });
  }

  async addSynonym(id: string, synonym: string): Promise<CatalogWriteResult> {
    return this.enqueue(async () => {
      const existing = this.entries.find((e) => e.id === id);
      if (!existing) return { ok: false, kind: 'not-found', reason: `no catalog entry with id "${id}"` };
      const folded = fold(synonym);
      if (folded === fold(existing.name) || existing.synonyms.some((s) => fold(s) === folded)) {
        return { ok: true, entry: existing };
      }
      const updated: FoodEntry = { ...existing, synonyms: [...existing.synonyms, synonym] };
      await this.commit(this.entries.map((e) => (e.id === id ? updated : e)));
      return { ok: true, entry: updated };
    });
  }

  private parse(raw: string | null): FoodEntry[] {
    if (raw === null) return [];
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.warn(`catalog: failed to parse ${this.document.location}; treating as empty`);
      return [];
    }
    if (!Array.isArray(parsed)) {
      console.warn(`catalog: malformed top-level shape in ${this.document.location}; treating as empty`);
      return [];
    }
    const loaded: FoodEntry[] = [];
    for (const candidate of parsed) {
      const result = validateCatalogEntry(repairId(candidate as FoodEntry));
      if (!result.ok) {
        console.warn(`catalog: skipping invalid entry: ${result.reason}`);
        continue;
      }
      if (findCatalogCollision(loaded, result.entry) !== null) {
        console.warn(`catalog: skipping invalid entry: duplicate entry "${result.entry.id}"`);
        continue;
      }
      loaded.push(result.entry);
    }
    return loaded;
  }

  private setEntries(entries: FoodEntry[]): void {
    this.entries = [...entries].sort((a, b) => a.id.localeCompare(b.id));
    this.indexedEntries = this.entries.map(indexFoodEntry);
  }

  private async commit(entries: FoodEntry[]): Promise<void> {
    this.setEntries(entries);
    await this.document.write(JSON.stringify(this.entries, null, 2) + '\n');
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.queue.then(fn, fn);
    this.queue = next.catch(() => undefined);
    return next;
  }
}
