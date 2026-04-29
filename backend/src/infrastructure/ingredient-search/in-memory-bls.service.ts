import { readFile } from 'node:fs/promises';
import type { IngredientSearchService } from '../../domain/ingredient-search/ingredient-search.service.ts';
import type { IngredientSearchResult } from '../../domain/ingredient-search/types.ts';
import type { BlsEntry, BlsIndexedEntry } from '../../domain/bls/types.ts';
import { mapBlsEntry } from '../../domain/bls/map-bls-entry.ts';
import { fold } from '../../domain/ingredient-search/fold.ts';

export class InMemoryBlsService implements IngredientSearchService {
  private entries: BlsIndexedEntry[] = [];

  constructor(private readonly jsonPath: string) {}

  async init(): Promise<void> {
    const raw = await readFile(this.jsonPath, 'utf-8');
    const data = JSON.parse(raw) as BlsEntry[];
    this.entries = data.map((e) => ({
      ...e,
      name_de_folded: fold(e.name_de),
      name_en_folded: fold(e.name_en),
    }));
  }

  async searchByName(query: string): Promise<IngredientSearchResult[]> {
    const trimmed = query.trim();
    if (trimmed.length < 2) return [];
    const q = fold(trimmed);
    return this.entries
      .filter((e) => e.name_de_folded.includes(q) || e.name_en_folded.includes(q))
      .sort((a, b) => a.name_de.localeCompare(b.name_de))
      .slice(0, 20)
      .map(mapBlsEntry);
  }

  async searchByBarcode(_barcode: string): Promise<IngredientSearchResult | null> {
    return null;
  }
}
