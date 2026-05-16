import type { RecipeDraftExtractor } from './recipe-draft-extractor.ts';
import type {
  DraftIngredient,
  IngredientMatchDebug,
  RawIngredient,
  RecipeDraft,
  RecipeDraftDebug,
  RecipeImage,
  SearchCandidateDebug,
} from './types.ts';
import type { IngredientSearchService } from '../ingredient-search/ingredient-search.service.ts';
import type { IngredientSearchResult } from '../ingredient-search/types.ts';
import type { RecipeRepository } from '../recipes/recipe.repository.ts';
import type { UnmatchedIngredientRecorder } from '../unmatched-ingredients/types.ts';
import { normalizeIngredientName } from './normalize-ingredient-name.ts';

const DEBUG_CANDIDATE_CAP = 5;

export interface ImportRecipeFromPhotosDeps {
  extractor: RecipeDraftExtractor;
  search: IngredientSearchService;
  /** Accepted only so callers can pass it without the use case touching it — never mutated. */
  repo?: RecipeRepository;
  /** When true, the returned draft carries a `debug` payload describing the per-ingredient match. */
  includeDebug?: boolean;
  /** Optional sink that captures every strict-unmatched ingredient as a side effect. */
  recorder?: UnmatchedIngredientRecorder;
}

interface MatchOutput {
  ingredient: DraftIngredient;
  debug?: IngredientMatchDebug;
}

export async function importRecipeFromPhotos(
  deps: ImportRecipeFromPhotosDeps,
  images: RecipeImage[],
): Promise<RecipeDraft> {
  if (!images || images.length === 0) {
    throw new Error('At least one image is required');
  }

  const extracted = await deps.extractor.extract(images);

  const matched = await Promise.all(
    extracted.ingredients.map((raw) => matchIngredient(raw, deps.search, deps.includeDebug === true, deps.recorder)),
  );

  const draft: RecipeDraft = {
    name: extracted.name,
    yield: extracted.yield,
    ingredients: matched.map((m) => m.ingredient),
    steps: extracted.steps,
  };

  if (deps.includeDebug === true) {
    const debug: RecipeDraftDebug = {
      ingredients: matched.map((m) => m.debug!),
    };
    draft.debug = debug;
  }

  return draft;
}

async function matchIngredient(
  raw: RawIngredient,
  search: IngredientSearchService,
  includeDebug: boolean,
  recorder: UnmatchedIngredientRecorder | undefined,
): Promise<MatchOutput> {
  let results = await search.searchByName(raw.name, new Set(['FOODS']));
  let normalizedName: string | null = null;
  if (results.length === 0) {
    const normalized = normalizeIngredientName(raw.name);
    if (normalized !== raw.name) {
      normalizedName = normalized;
      results = await search.searchByName(normalized, new Set(['FOODS']));
    }
  }
  const top = results[0];

  if (!top) {
    if (recorder) {
      const toRecord: RawIngredient = normalizedName !== null ? { ...raw, name: normalizedName } : raw;
      try {
        await recorder.record(toRecord);
      } catch (err) {
        console.error('unmatched-ingredients: recorder failed', err);
      }
    }
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
      debug: includeDebug
        ? {
            raw,
            candidates: [],
            chosen: null,
            flags: { unitOverridden: false, pieceQuantityDropped: false, untrackedInherited: false },
          }
        : undefined,
    };
  }

  const unitOverridden = raw.unit !== undefined && raw.unit !== top.unit;
  const matchedUnitIsMass = top.unit === 'g' || top.unit === 'ml';
  const isUntracked = top.untracked === true;
  const pieceQuantityDropped = raw.pieceQuantity !== undefined && !matchedUnitIsMass;

  const matched: DraftIngredient = {
    matched: true,
    name: top.name,
    unit: top.unit,
    macrosPerUnit: top.macrosPerUnit,
    amount: raw.amount ?? null,
    unitOverridden,
    source: top.source,
  };
  if (raw.pieceQuantity && matchedUnitIsMass) matched.pieceQuantity = raw.pieceQuantity;
  if (raw.note !== undefined) matched.note = raw.note;
  if (isUntracked) {
    matched.untracked = true;
    const rawLabel = raw.rawDisplayUnitLabel?.trim();
    if (rawLabel && rawLabel.length > 0) {
      matched.displayQuantity = {
        amount: raw.rawDisplayAmount ?? 1,
        unitLabel: rawLabel,
      };
    }
    if (matched.amount === null && matched.pieceQuantity === undefined) {
      matched.amount = 0;
    }
  }

  if (!includeDebug) {
    return { ingredient: matched };
  }

  const candidates = results.slice(0, DEBUG_CANDIDATE_CAP).map(toCandidateDebug);
  return {
    ingredient: matched,
    debug: {
      raw,
      candidates,
      chosen: candidates[0] ?? null,
      flags: { unitOverridden, pieceQuantityDropped, untrackedInherited: isUntracked },
    },
  };
}

function toCandidateDebug(r: IngredientSearchResult): SearchCandidateDebug {
  return {
    name: r.name,
    source: r.source,
    unit: r.unit,
    untracked: r.untracked === true,
  };
}
