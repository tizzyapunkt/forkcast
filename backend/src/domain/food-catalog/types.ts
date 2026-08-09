import type { FoodEntry, FoodIndexedEntry } from '../foods/types.ts';

/**
 * Why a write was refused. The HTTP layer maps these to status codes — the same
 * `conflict` is a `400` on the catalog API and a `409` on resolution confirm, so
 * the status itself is deliberately not a domain concern.
 */
export type CatalogWriteFailureKind = 'invalid' | 'conflict' | 'not-found';

export type CatalogWriteResult =
  | { ok: true; entry: FoodEntry }
  | { ok: false; kind: CatalogWriteFailureKind; reason: string };

/**
 * Port for the single runtime-editable food catalog. Reads are synchronous
 * because the whole catalog (~190 entries) is held in memory; every accepted
 * write persists atomically and rebuilds the in-memory index, so a search issued
 * after a write never disagrees with the file.
 */
export interface CatalogStore {
  /** Every entry, unranked, ordered by id. */
  list(): FoodEntry[];
  /** Pre-folded entries for the search index. */
  indexed(): FoodIndexedEntry[];
  findById(id: string): FoodEntry | null;
  add(entry: FoodEntry): Promise<CatalogWriteResult>;
  update(id: string, entry: FoodEntry): Promise<CatalogWriteResult>;
  remove(id: string): Promise<CatalogWriteResult>;
  /** Add an alternate name to an existing entry, deduplicated case-insensitively. */
  addSynonym(id: string, synonym: string): Promise<CatalogWriteResult>;
}
