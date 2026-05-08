import { readFile } from 'node:fs/promises';
import type { IngredientSearchService } from '../../domain/ingredient-search/ingredient-search.service.ts';
import type { IngredientSearchResult } from '../../domain/ingredient-search/types.ts';
import type { FoodEntry, FoodIndexedEntry } from '../../domain/foods/types.ts';
import { validateFoodEntry } from '../../domain/foods/validate-food-entry.ts';
import { indexFoodEntry } from '../../domain/foods/index-food-entry.ts';
import { mapFoodEntry } from '../../domain/foods/map-food-entry.ts';
import { fold } from '../../domain/ingredient-search/fold.ts';
import { scoreFoodMatch } from '../../domain/ingredient-search/score-food-match.ts';

export class InMemoryFoodsService implements IngredientSearchService {
  private entries: FoodIndexedEntry[] = [];

  constructor(private readonly jsonPath: string) {}

  async init(): Promise<void> {
    const raw = await readFile(this.jsonPath, 'utf-8');
    const data = JSON.parse(raw) as FoodEntry[];
    const indexed: FoodIndexedEntry[] = [];
    for (const entry of data) {
      const result = validateFoodEntry(entry);
      if (!result.ok) {
        console.warn(`InMemoryFoodsService: skipping invalid entry: ${result.reason}`);
        continue;
      }
      indexed.push(indexFoodEntry(result.entry));
    }
    this.entries = indexed;
  }

  async searchByName(query: string, _sources?: Set<string>): Promise<IngredientSearchResult[]> {
    const trimmed = query.trim();
    if (trimmed.length < 2) return [];
    const q = fold(trimmed);
    const scored: { entry: FoodIndexedEntry; score: number }[] = [];
    for (const entry of this.entries) {
      const score = scoreFoodMatch(entry, q);
      if (score > 0) scored.push({ entry, score });
    }
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.entry.name.length !== b.entry.name.length) {
        return a.entry.name.length - b.entry.name.length;
      }
      return a.entry.name.localeCompare(b.entry.name);
    });
    return scored.slice(0, 20).map((s) => mapFoodEntry(s.entry));
  }

  async searchByBarcode(_barcode: string): Promise<IngredientSearchResult | null> {
    return null;
  }
}
