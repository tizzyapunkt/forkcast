import type { RecipeDraftExtractor } from './recipe-draft-extractor.ts';
import type { DraftIngredient, RawIngredient, RecipeDraft, RecipeImage } from './types.ts';
import type { IngredientSearchService } from '../ingredient-search/ingredient-search.service.ts';
import type { RecipeRepository } from '../recipes/recipe.repository.ts';

export interface ImportRecipeFromPhotosDeps {
  extractor: RecipeDraftExtractor;
  search: IngredientSearchService;
  /** Accepted only so callers can pass it without the use case touching it — never mutated. */
  repo?: RecipeRepository;
}

export async function importRecipeFromPhotos(
  deps: ImportRecipeFromPhotosDeps,
  images: RecipeImage[],
): Promise<RecipeDraft> {
  if (!images || images.length === 0) {
    throw new Error('At least one image is required');
  }

  const extracted = await deps.extractor.extract(images);

  const ingredients = await Promise.all(extracted.ingredients.map((raw) => matchIngredient(raw, deps.search)));

  return {
    name: extracted.name,
    yield: extracted.yield,
    ingredients,
    steps: extracted.steps,
  };
}

async function matchIngredient(raw: RawIngredient, search: IngredientSearchService): Promise<DraftIngredient> {
  const results = await search.searchByName(raw.name, new Set(['FOODS']));
  const top = results[0];

  if (!top) {
    const unmatched: DraftIngredient = {
      matched: false,
      name: raw.name,
      amount: raw.amount ?? null,
      unit: raw.unit ?? null,
    };
    if (raw.pieceQuantity) unmatched.pieceQuantity = raw.pieceQuantity;
    return unmatched;
  }

  const unitOverridden = raw.unit !== undefined && raw.unit !== top.unit;
  const matchedUnitIsMass = top.unit === 'g' || top.unit === 'ml';

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
  if (top.untracked === true) matched.untracked = true;
  return matched;
}
