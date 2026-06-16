import type { FoodEntry } from '../../domain/foods/types.ts';
import { indexFoodEntry } from '../../domain/foods/index-food-entry.ts';
import { rankFuzzyCandidates } from '../../domain/foods/fuzzy-candidates.ts';
import type { ResolutionCandidate, ResolutionCandidateFinder } from '../../domain/food-resolution/types.ts';
import type { UserFoodsStore } from '../../domain/user-foods/types.ts';

interface FuzzyFoodsSource {
  findFuzzyCandidates(query: string, limit: number): FoodEntry[];
}

function toCandidate(entry: FoodEntry): ResolutionCandidate {
  const candidate: ResolutionCandidate = {
    id: entry.id,
    name: entry.name,
    unit: entry.unit,
    macrosPer100: entry.macrosPer100,
  };
  if (entry.untracked === true) candidate.untracked = true;
  return candidate;
}

/**
 * Gathers fuzzy candidates for the resolution proposer from the curated FOODS
 * index (incl. learned synonyms) and the user-foods overlay. Curated candidates
 * come first; duplicate ids are dropped; the merged set is capped at `limit`.
 */
export class CompositeResolutionCandidateFinder implements ResolutionCandidateFinder {
  constructor(
    private readonly foods: FuzzyFoodsSource,
    private readonly overlay: UserFoodsStore,
  ) {}

  async findCandidates(query: string, limit: number): Promise<ResolutionCandidate[]> {
    const curated = this.foods.findFuzzyCandidates(query, limit).map(toCandidate);
    const overlayFoods = (await this.overlay.load()).foods;
    const overlayMatches = rankFuzzyCandidates(overlayFoods.map(indexFoodEntry), query, limit).map(toCandidate);

    const seen = new Set<string>();
    const merged: ResolutionCandidate[] = [];
    for (const c of [...curated, ...overlayMatches]) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      merged.push(c);
      if (merged.length >= limit) break;
    }
    return merged;
  }
}
