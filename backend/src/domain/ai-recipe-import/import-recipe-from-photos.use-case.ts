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

/** Run the strict import cascade for a single name; returns the first tier's non-empty results. */
async function cascadeSearch(search: IngredientSearchService, name: string): Promise<IngredientSearchResult[]> {
  for (const source of IMPORT_CASCADE) {
    const results = await search.searchByName(name, new Set([source]));
    if (results.length > 0) return results;
  }
  return [];
}

async function matchIngredient(raw: RawIngredient, search: IngredientSearchService): Promise<MatchOutput> {
  let results = await cascadeSearch(search, raw.name);
  if (results.length === 0) {
    const normalized = normalizeIngredientName(raw.name);
    if (normalized !== raw.name) {
      results = await cascadeSearch(search, normalized);
    }
  }
  const top = results[0];

  if (!top) {
    const unmatched: DraftIngredient = {
      matched: false,
      name: raw.name,
      amount: raw.amount ?? null,
      unit: raw.unit ?? null,
    };
    if (raw.pieceQuantity) unmatched.pieceQuantity = raw.pieceQuantity;
    if (raw.note !== undefined) unmatched.note = raw.note;
    return {
      ingredient: unmatched,
      provenance: {
        raw,
        candidates: [],
        chosen: null,
        flags: {
          unitOverridden: false,
          pieceQuantityDropped: false,
          untrackedInherited: false,
          missingAmount: false,
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

  const candidates = results.slice(0, PROVENANCE_CANDIDATE_CAP).map(toCandidateProvenance);
  return {
    ingredient: matched,
    provenance: {
      raw,
      candidates,
      chosen: candidates[0] ?? null,
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
