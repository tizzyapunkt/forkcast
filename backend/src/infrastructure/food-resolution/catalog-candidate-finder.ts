import type { FoodEntry } from '../../domain/foods/types.ts';
import type { ResolutionCandidate, ResolutionCandidateFinder } from '../../domain/food-resolution/types.ts';

interface FuzzyCatalogSource {
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
 * Gathers fuzzy candidates for the resolution proposer from the catalog, so the
 * model can recognise a synonym of a food the user already has instead of
 * inventing a duplicate entry.
 */
export class CatalogResolutionCandidateFinder implements ResolutionCandidateFinder {
  constructor(private readonly catalog: FuzzyCatalogSource) {}

  async findCandidates(query: string, limit: number): Promise<ResolutionCandidate[]> {
    return this.catalog.findFuzzyCandidates(query, limit).map(toCandidate);
  }
}
