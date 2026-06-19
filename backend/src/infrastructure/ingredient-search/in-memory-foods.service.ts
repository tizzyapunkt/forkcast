import { readFile } from 'node:fs/promises';
import type { IngredientSearchService } from '../../domain/ingredient-search/ingredient-search.service.ts';
import type { IngredientSearchResult } from '../../domain/ingredient-search/types.ts';
import type { FoodEntry, FoodIndexedEntry } from '../../domain/foods/types.ts';
import type { MacrosPerUnit } from '../../domain/recipes/types.ts';
import type { LearnedSynonym } from '../../domain/user-foods/types.ts';
import { validateFoodEntry } from '../../domain/foods/validate-food-entry.ts';
import { indexFoodEntry } from '../../domain/foods/index-food-entry.ts';
import { rankIndexedFoods } from '../../domain/foods/rank-food-entries.ts';
import { rankFuzzyCandidates } from '../../domain/foods/fuzzy-candidates.ts';
import { fold } from '../../domain/ingredient-search/fold.ts';

export class InMemoryFoodsService implements IngredientSearchService {
  /** Validated curated entries, as loaded from disk — never mutated by learned synonyms. */
  private baseEntries: FoodEntry[] = [];
  /** Learned synonyms registered at runtime / startup, keyed by curated entry id. */
  private learned = new Map<string, string[]>();
  /** Derived searchable index: base entries merged with learned synonyms. */
  private entries: FoodIndexedEntry[] = [];

  constructor(private readonly jsonPath: string) {}

  async init(): Promise<void> {
    const raw = await readFile(this.jsonPath, 'utf-8');
    const data = JSON.parse(raw) as FoodEntry[];
    const base: FoodEntry[] = [];
    for (const entry of data) {
      const result = validateFoodEntry(entry);
      if (!result.ok) {
        console.warn(`InMemoryFoodsService: skipping invalid entry: ${result.reason}`);
        continue;
      }
      base.push(result.entry);
    }
    this.baseEntries = base;
    this.rebuild();
  }

  /**
   * Register a learned synonym on the curated index. Returns `false` (with a
   * warning) when no curated entry has the given id — an orphaned synonym is
   * skipped rather than fatal.
   */
  addSynonym(foodId: string, synonym: string): boolean {
    if (!this.baseEntries.some((e) => e.id === foodId)) {
      console.warn(`InMemoryFoodsService: skipping learned synonym for unknown foodId "${foodId}"`);
      return false;
    }
    const list = this.learned.get(foodId) ?? [];
    const foldedSyn = fold(synonym);
    if (!list.some((s) => fold(s) === foldedSyn)) {
      list.push(synonym);
      this.learned.set(foodId, list);
      this.rebuild();
    }
    return true;
  }

  /** Apply a batch of learned synonyms (startup re-application). */
  applySynonyms(synonyms: LearnedSynonym[]): { applied: number; orphaned: LearnedSynonym[] } {
    let applied = 0;
    const orphaned: LearnedSynonym[] = [];
    for (const s of synonyms) {
      if (this.addSynonym(s.foodId, s.synonym)) applied += 1;
      else orphaned.push(s);
    }
    return { applied, orphaned };
  }

  /** Look up a curated entry by id, mapped to a match source (per-unit macros). Null when absent. */
  findById(
    foodId: string,
  ): { name: string; unit: 'g' | 'ml'; macrosPerUnit: MacrosPerUnit; untracked?: boolean; density?: number } | null {
    const entry = this.baseEntries.find((e) => e.id === foodId);
    if (!entry) return null;
    const m = entry.macrosPer100;
    return {
      name: entry.name,
      unit: entry.unit,
      macrosPerUnit: { calories: m.calories / 100, protein: m.protein / 100, carbs: m.carbs / 100, fat: m.fat / 100 },
      untracked: entry.untracked === true ? true : undefined,
      density: entry.density,
    };
  }

  /** Drop all learned synonyms from the index (used when the overlay is drained). */
  clearLearnedSynonyms(): void {
    if (this.learned.size === 0) return;
    this.learned.clear();
    this.rebuild();
  }

  private rebuild(): void {
    this.entries = this.baseEntries.map((entry) => {
      const extra = this.learned.get(entry.id);
      const merged = extra && extra.length > 0 ? { ...entry, synonyms: [...entry.synonyms, ...extra] } : entry;
      return indexFoodEntry(merged);
    });
  }

  async searchByName(query: string, _sources?: Set<string>): Promise<IngredientSearchResult[]> {
    return rankIndexedFoods(this.entries, query, 'FOODS');
  }

  /** Fuzzy (token/prefix-overlap) candidates for the AI resolution proposer — looser than searchByName. */
  findFuzzyCandidates(query: string, limit: number): FoodEntry[] {
    return rankFuzzyCandidates(this.entries, query, limit);
  }

  async searchByBarcode(_barcode: string): Promise<IngredientSearchResult | null> {
    return null;
  }
}
