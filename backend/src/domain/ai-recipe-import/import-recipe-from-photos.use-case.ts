import type { RecipeDraftExtractor } from './recipe-draft-extractor.ts';
import type {
  DraftIngredient,
  IngredientMatchProvenance,
  RawIngredient,
  RecipeDraft,
  RecipeImage,
  SearchCandidateProvenance,
} from './types.ts';
import type { IngredientSearchService, IngredientSource } from '../ingredient-search/ingredient-search.service.ts';
import type { IngredientSearchResult } from '../ingredient-search/types.ts';
import type { RecipeRepository } from '../recipes/recipe.repository.ts';
import { normalizeIngredientName } from './normalize-ingredient-name.ts';
import { buildMatchedRowWithFlags } from './build-matched-row.ts';

const PROVENANCE_CANDIDATE_CAP = 5;

/**
 * Import matching consults the user's own data in a strict cascade — the food
 * catalog first, then locally-scanned products. The first tier with a hit wins;
 * the lower tier is not consulted. Open Food Facts is deliberately excluded
 * (rate limits, packaged-product noise).
 */
const IMPORT_CASCADE: readonly IngredientSource[] = ['CATALOG', 'SCAN'];

export interface ImportRecipeFromPhotosDeps {
  extractor: RecipeDraftExtractor;
  search: IngredientSearchService;
  /** Accepted only so callers can pass it without the use case touching it — never mutated. */
  repo?: RecipeRepository;
}

interface MatchOutput {
  ingredient: DraftIngredient;
  provenance: IngredientMatchProvenance;
}

export async function importRecipeFromPhotos(
  deps: ImportRecipeFromPhotosDeps,
  images: RecipeImage[],
): Promise<RecipeDraft> {
  if (!images || images.length === 0) {
    throw new Error('At least one image is required');
  }

  const extracted = await deps.extractor.extract(images);

  const matched = await Promise.all(extracted.ingredients.map((raw) => matchIngredient(raw, deps.search)));

  return {
    name: extracted.name,
    yield: extracted.yield,
    ingredients: matched.map((m) => m.ingredient),
    steps: extracted.steps,
    provenance: { ingredients: matched.map((m) => m.provenance) },
  };
}

interface CascadeOutcome {
  /** The first confident candidate, if any tier had one. */
  chosen?: IngredientSearchResult;
  /** The tier results behind `chosen`, or — with no confident hit — the first tier's partial hits. */
  results: IngredientSearchResult[];
}

/**
 * The import picks a food without asking, so it only takes hits the search calls confident. A partial
 * hit (Honig → Honigmelone) is a fine search suggestion but names a different food. A result without
 * a confidence (a source that doesn't grade its hits) is taken as confident.
 */
function isConfident(result: IngredientSearchResult): boolean {
  return result.matchConfidence !== 'partial';
}

/**
 * Run the strict import cascade for a single name. The first tier with a confident candidate wins;
 * a tier with only partial hits does not stop the cascade, but its hits are kept for provenance.
 */
async function cascadeSearch(search: IngredientSearchService, name: string): Promise<CascadeOutcome> {
  let firstHits: IngredientSearchResult[] = [];
  for (const source of IMPORT_CASCADE) {
    const results = await search.searchByName(name, new Set([source]));
    const chosen = results.find(isConfident);
    if (chosen) return { chosen, results };
    if (firstHits.length === 0) firstHits = results;
  }
  return { results: firstHits };
}

async function matchIngredient(raw: RawIngredient, search: IngredientSearchService): Promise<MatchOutput> {
  let outcome = await cascadeSearch(search, raw.name);
  if (!outcome.chosen) {
    const normalized = normalizeIngredientName(raw.name);
    if (normalized !== raw.name) {
      const retry = await cascadeSearch(search, normalized);
      // Keep the raw name's near-misses for provenance unless the retry found something better.
      if (retry.chosen || outcome.results.length === 0) outcome = retry;
    }
  }
  const top = outcome.chosen;

  if (!top) {
    const unmatched: DraftIngredient = {
      matched: false,
      name: raw.name,
      amount: raw.amount ?? null,
      unit: raw.unit ?? null,
    };
    if (raw.pieceQuantity) unmatched.pieceQuantity = raw.pieceQuantity;
    if (raw.rawDisplayAmount !== undefined) unmatched.rawDisplayAmount = raw.rawDisplayAmount;
    if (raw.rawDisplayUnitLabel !== undefined) unmatched.rawDisplayUnitLabel = raw.rawDisplayUnitLabel;
    if (raw.gramsPerSpoon !== undefined) unmatched.gramsPerSpoon = raw.gramsPerSpoon;
    if (raw.note !== undefined) unmatched.note = raw.note;
    return {
      ingredient: unmatched,
      provenance: {
        raw,
        // Rejected near-misses (Honigmelone for Honig) stay visible for debugging.
        candidates: outcome.results.slice(0, PROVENANCE_CANDIDATE_CAP).map(toCandidateProvenance),
        chosen: null,
        flags: {
          unitOverridden: false,
          pieceQuantityDropped: false,
          untrackedInherited: false,
          missingAmount: false,
          spoonEstimated: false,
        },
      },
    };
  }

  const { row: matched, flags } = buildMatchedRowWithFlags(
    {
      name: top.name,
      unit: top.unit,
      macrosPerUnit: top.macrosPerUnit,
      untracked: top.untracked === true,
      density: top.density,
    },
    top.source,
    raw,
  );

  const candidates = outcome.results.slice(0, PROVENANCE_CANDIDATE_CAP).map(toCandidateProvenance);
  return {
    ingredient: matched,
    provenance: {
      raw,
      candidates,
      chosen: toCandidateProvenance(top),
      flags,
    },
  };
}

function toCandidateProvenance(r: IngredientSearchResult): SearchCandidateProvenance {
  return {
    name: r.name,
    source: r.source,
    unit: r.unit,
    untracked: r.untracked === true,
  };
}
