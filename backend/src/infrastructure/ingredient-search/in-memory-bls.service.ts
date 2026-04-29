import { readFile } from 'node:fs/promises';
import type { IngredientSearchService } from '../../domain/ingredient-search/ingredient-search.service.ts';
import type { IngredientSearchResult } from '../../domain/ingredient-search/types.ts';
import type { BlsEntry, BlsIndexedEntry } from '../../domain/bls/types.ts';
import { mapBlsEntry } from '../../domain/bls/map-bls-entry.ts';
import { fold } from '../../domain/ingredient-search/fold.ts';
import { scoreBlsMatch } from '../../domain/ingredient-search/score-bls-match.ts';

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
    const scored: { entry: BlsIndexedEntry; score: number }[] = [];
    for (const entry of this.entries) {
      const score = scoreBlsMatch(entry, q);
      if (score > 0) scored.push({ entry, score });
    }
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.entry.name_de.length !== b.entry.name_de.length) {
        return a.entry.name_de.length - b.entry.name_de.length;
      }
      return a.entry.name_de.localeCompare(b.entry.name_de);
    });
    return scored.slice(0, 20).map((s) => mapBlsEntry(s.entry));
  }

  async searchByBarcode(_barcode: string): Promise<IngredientSearchResult | null> {
    return null;
  }
}
