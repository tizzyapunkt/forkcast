import type { FoodEntry, FoodIndexedEntry } from '../foods/types.ts';
import type { CatalogStore, CatalogWriteResult } from './types.ts';
import { findCatalogCollision, validateCatalogEntry } from './validate-catalog-entry.ts';
import { indexFoodEntry } from '../foods/index-food-entry.ts';
import { fold } from '../ingredient-search/fold.ts';

/**
 * Test-only in-memory `CatalogStore`. Applies the same validation and collision
 * rules as the JSON adapter, without touching disk, so use-case tests can assert
 * behaviour rather than persistence (which `JsonCatalogStore`'s own tests cover).
 */
export class FakeCatalogStore implements CatalogStore {
  private entries: FoodEntry[];

  constructor(initial: FoodEntry[] = []) {
    this.entries = [...initial];
  }

  list(): FoodEntry[] {
    return this.entries;
  }

  indexed(): FoodIndexedEntry[] {
    return this.entries.map(indexFoodEntry);
  }

  findById(id: string): FoodEntry | null {
    return this.entries.find((e) => e.id === id) ?? null;
  }

  async add(entry: FoodEntry): Promise<CatalogWriteResult> {
    const validation = validateCatalogEntry(entry);
    if (!validation.ok) return { ok: false, kind: 'invalid', reason: validation.reason };
    const collision = findCatalogCollision(this.entries, validation.entry);
    if (collision !== null) return { ok: false, kind: 'conflict', reason: collision };
    this.entries = [...this.entries, validation.entry];
    return { ok: true, entry: validation.entry };
  }

  async update(id: string, entry: FoodEntry): Promise<CatalogWriteResult> {
    if (!this.entries.some((e) => e.id === id)) {
      return { ok: false, kind: 'not-found', reason: `no catalog entry with id "${id}"` };
    }
    const validation = validateCatalogEntry({ ...entry, id });
    if (!validation.ok) return { ok: false, kind: 'invalid', reason: validation.reason };
    const collision = findCatalogCollision(this.entries, validation.entry, id);
    if (collision !== null) return { ok: false, kind: 'conflict', reason: collision };
    this.entries = this.entries.map((e) => (e.id === id ? validation.entry : e));
    return { ok: true, entry: validation.entry };
  }

  async remove(id: string): Promise<CatalogWriteResult> {
    const existing = this.entries.find((e) => e.id === id);
    if (!existing) return { ok: false, kind: 'not-found', reason: `no catalog entry with id "${id}"` };
    this.entries = this.entries.filter((e) => e.id !== id);
    return { ok: true, entry: existing };
  }

  async addSynonym(id: string, synonym: string): Promise<CatalogWriteResult> {
    const existing = this.entries.find((e) => e.id === id);
    if (!existing) return { ok: false, kind: 'not-found', reason: `no catalog entry with id "${id}"` };
    const folded = fold(synonym);
    if (folded === fold(existing.name) || existing.synonyms.some((s) => fold(s) === folded)) {
      return { ok: true, entry: existing };
    }
    const updated: FoodEntry = { ...existing, synonyms: [...existing.synonyms, synonym] };
    this.entries = this.entries.map((e) => (e.id === id ? updated : e));
    return { ok: true, entry: updated };
  }
}
