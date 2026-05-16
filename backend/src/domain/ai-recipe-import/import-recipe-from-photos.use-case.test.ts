import { describe, it, expect, vi } from 'vitest';
import { importRecipeFromPhotos } from './import-recipe-from-photos.use-case.ts';
import type { RecipeDraftExtractor } from './recipe-draft-extractor.ts';
import type { ExtractedDraft, RecipeImage } from './types.ts';
import type { IngredientSearchService } from '../ingredient-search/ingredient-search.service.ts';
import type { IngredientSearchResult } from '../ingredient-search/types.ts';
import type { RecipeRepository } from '../recipes/recipe.repository.ts';
import type { Recipe } from '../recipes/types.ts';

const oneImage = (): RecipeImage[] => [{ mediaType: 'image/jpeg', bytes: new Uint8Array([1, 2, 3]) }];

const threeImages = (): RecipeImage[] => [
  { mediaType: 'image/jpeg', bytes: new Uint8Array([1]) },
  { mediaType: 'image/png', bytes: new Uint8Array([2]) },
  { mediaType: 'image/webp', bytes: new Uint8Array([3]) },
];

function makeExtractor(draft: ExtractedDraft): RecipeDraftExtractor {
  return { extract: vi.fn<(images: RecipeImage[]) => Promise<ExtractedDraft>>().mockResolvedValue(draft) };
}

function makeSearch(map: Record<string, IngredientSearchResult[]>): IngredientSearchService {
  return {
    searchByName: vi
      .fn<(q: string) => Promise<IngredientSearchResult[]>>()
      .mockImplementation(async (q) => map[q.toLowerCase()] ?? []),
    searchByBarcode: vi.fn<(barcode: string) => Promise<IngredientSearchResult | null>>().mockResolvedValue(null),
  };
}

const foodsResult = (overrides: Partial<IngredientSearchResult> = {}): IngredientSearchResult => ({
  id: 'foods-1',
  source: 'FOODS',
  name: 'Olivenöl',
  unit: 'ml',
  macrosPerUnit: { calories: 9, protein: 0, carbs: 0, fat: 1 },
  ...overrides,
});

function makeRepo(): RecipeRepository {
  return {
    save: vi.fn<(r: Recipe) => Promise<void>>().mockResolvedValue(undefined),
    findAll: vi.fn<() => Promise<Recipe[]>>().mockResolvedValue([]),
    findById: vi.fn<(id: string) => Promise<Recipe | null>>().mockResolvedValue(null),
    update: vi.fn<(r: Recipe) => Promise<void>>().mockResolvedValue(undefined),
    remove: vi.fn<(id: string) => Promise<void>>().mockResolvedValue(undefined),
  };
}

describe('importRecipeFromPhotos', () => {
  it('rejects an empty image list', async () => {
    const extractor = makeExtractor({ name: 'X', yield: 1, ingredients: [], steps: [] });
    const search = makeSearch({});

    await expect(importRecipeFromPhotos({ extractor, search }, [])).rejects.toThrow(/at least one image/i);
    expect(extractor.extract).not.toHaveBeenCalled();
  });

  it('passes a single image through to the extractor and returns a draft', async () => {
    const extractor = makeExtractor({
      name: 'Pasta',
      yield: 2,
      ingredients: [{ name: 'olive oil', amount: 30, unit: 'ml' }],
      steps: ['Boil water', 'Cook pasta'],
    });
    const search = makeSearch({ 'olive oil': [foodsResult({ name: 'Olivenöl', unit: 'ml' })] });

    const draft = await importRecipeFromPhotos({ extractor, search }, oneImage());

    expect(extractor.extract).toHaveBeenCalledWith(oneImage());
    expect(draft.name).toBe('Pasta');
    expect(draft.yield).toBe(2);
    expect(draft.steps).toEqual(['Boil water', 'Cook pasta']);
    expect(draft.ingredients).toHaveLength(1);
    const [first] = draft.ingredients;
    expect(first?.matched).toBe(true);
  });

  it('forwards multiple images in order to the extractor', async () => {
    const extractor = makeExtractor({
      name: 'Bolognese',
      yield: 4,
      ingredients: [{ name: 'beef', amount: 500, unit: 'g' }],
      steps: ['Step 1', 'Step 2', 'Step 3'],
    });
    const search = makeSearch({ beef: [foodsResult({ name: 'Hackfleisch', unit: 'g' })] });

    const images = threeImages();
    await importRecipeFromPhotos({ extractor, search }, images);

    expect(extractor.extract).toHaveBeenCalledTimes(1);
    const passed = (extractor.extract as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as RecipeImage[];
    expect(passed).toHaveLength(3);
    expect(passed.map((i) => i.mediaType)).toEqual(['image/jpeg', 'image/png', 'image/webp']);
  });

  it('pins searchByName to the FOODS source (does not rely on the composite default)', async () => {
    const extractor = makeExtractor({
      name: 'X',
      yield: 1,
      ingredients: [{ name: 'olive oil', amount: 30, unit: 'ml' }],
      steps: [],
    });
    const search = makeSearch({ 'olive oil': [foodsResult()] });

    await importRecipeFromPhotos({ extractor, search }, oneImage());

    const calls = (search.searchByName as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls).toHaveLength(1);
    const [, sources] = calls[0] as [string, Set<'FOODS' | 'OFF'>];
    expect(sources).toEqual(new Set(['FOODS']));
  });

  it('uses catalog unit & macros for matched ingredient and keeps extracted amount', async () => {
    const extractor = makeExtractor({
      name: 'X',
      yield: 1,
      ingredients: [{ name: 'olive oil', amount: 25, unit: 'ml' }],
      steps: [],
    });
    const search = makeSearch({
      'olive oil': [
        foodsResult({ name: 'Olivenöl', unit: 'ml', macrosPerUnit: { calories: 9, protein: 0, carbs: 0, fat: 1 } }),
      ],
    });

    const draft = await importRecipeFromPhotos({ extractor, search }, oneImage());

    const [ing] = draft.ingredients;
    if (!ing || !ing.matched) throw new Error('expected matched ingredient');
    expect(ing.name).toBe('Olivenöl');
    expect(ing.unit).toBe('ml');
    expect(ing.amount).toBe(25);
    expect(ing.macrosPerUnit).toEqual({ calories: 9, protein: 0, carbs: 0, fat: 1 });
    expect(ing.unitOverridden).toBe(false);
    expect(ing.source).toBe('FOODS');
  });

  it('flags unitOverridden when extracted unit conflicts with catalog unit', async () => {
    const extractor = makeExtractor({
      name: 'X',
      yield: 1,
      ingredients: [{ name: 'tomato paste', amount: 2, unit: 'tbsp' }],
      steps: [],
    });
    const search = makeSearch({
      'tomato paste': [foodsResult({ name: 'Tomatenmark', unit: 'g' })],
    });

    const draft = await importRecipeFromPhotos({ extractor, search }, oneImage());

    const [ing] = draft.ingredients;
    if (!ing || !ing.matched) throw new Error('expected matched ingredient');
    expect(ing.unit).toBe('g');
    expect(ing.amount).toBe(2);
    expect(ing.unitOverridden).toBe(true);
  });

  it('returns an unmatched row when the catalog has no match', async () => {
    const extractor = makeExtractor({
      name: 'X',
      yield: 1,
      ingredients: [{ name: 'unicorn dust', amount: 1, unit: 'tsp' }],
      steps: [],
    });
    const search = makeSearch({});

    const draft = await importRecipeFromPhotos({ extractor, search }, oneImage());

    const [ing] = draft.ingredients;
    if (!ing || ing.matched) throw new Error('expected unmatched ingredient');
    expect(ing.name).toBe('unicorn dust');
    expect(ing.amount).toBe(1);
    expect(ing.unit).toBe('tsp');
  });

  it('preserves missing amount on matched ingredients (does not guess)', async () => {
    const extractor = makeExtractor({
      name: 'X',
      yield: 1,
      ingredients: [{ name: 'salt' }],
      steps: [],
    });
    const search = makeSearch({ salt: [foodsResult({ name: 'Salz', unit: 'g' })] });

    const draft = await importRecipeFromPhotos({ extractor, search }, oneImage());

    const [ing] = draft.ingredients;
    if (!ing || !ing.matched) throw new Error('expected matched ingredient');
    expect(ing.amount).toBeNull();
  });

  it('preserves missing amount and unit on unmatched ingredients', async () => {
    const extractor = makeExtractor({
      name: 'X',
      yield: 1,
      ingredients: [{ name: 'mystery herb' }],
      steps: [],
    });
    const search = makeSearch({});

    const draft = await importRecipeFromPhotos({ extractor, search }, oneImage());

    const [ing] = draft.ingredients;
    if (!ing || ing.matched) throw new Error('expected unmatched ingredient');
    expect(ing.amount).toBeNull();
    expect(ing.unit).toBeNull();
  });

  it('preserves pieceQuantity on matched mass-unit ingredient', async () => {
    const extractor = makeExtractor({
      name: 'Soup',
      yield: 1,
      ingredients: [
        {
          name: 'Zwiebel',
          amount: 150,
          unit: 'g',
          pieceQuantity: { amount: 1, unitLabel: 'Zwiebel', gramsPerPiece: 150 },
        },
      ],
      steps: [],
    });
    const search = makeSearch({ zwiebel: [foodsResult({ name: 'Zwiebel', unit: 'g' })] });

    const draft = await importRecipeFromPhotos({ extractor, search }, oneImage());
    const [ing] = draft.ingredients;
    if (!ing || !ing.matched) throw new Error('expected matched ingredient');
    expect(ing.unit).toBe('g');
    expect(ing.amount).toBe(150);
    expect(ing.pieceQuantity).toEqual({ amount: 1, unitLabel: 'Zwiebel', gramsPerPiece: 150 });
  });

  it('drops pieceQuantity when the matched catalog unit is non-mass', async () => {
    const extractor = makeExtractor({
      name: 'X',
      yield: 1,
      ingredients: [
        {
          name: 'Knoblauch',
          amount: 6,
          unit: 'g',
          pieceQuantity: { amount: 2, unitLabel: 'Zehe', gramsPerPiece: 3 },
        },
      ],
      steps: [],
    });
    const search = makeSearch({ knoblauch: [foodsResult({ name: 'Knoblauch', unit: 'tbsp' })] });

    const draft = await importRecipeFromPhotos({ extractor, search }, oneImage());
    const [ing] = draft.ingredients;
    if (!ing || !ing.matched) throw new Error('expected matched ingredient');
    expect(ing.unit).toBe('tbsp');
    expect(ing.unitOverridden).toBe(true);
    expect(ing.pieceQuantity).toBeUndefined();
  });

  it('preserves pieceQuantity on unmatched ingredient', async () => {
    const extractor = makeExtractor({
      name: 'X',
      yield: 1,
      ingredients: [
        {
          name: 'rare squash',
          amount: 200,
          unit: 'g',
          pieceQuantity: { amount: 1, unitLabel: 'rare squash', gramsPerPiece: 200 },
        },
      ],
      steps: [],
    });
    const search = makeSearch({});

    const draft = await importRecipeFromPhotos({ extractor, search }, oneImage());
    const [ing] = draft.ingredients;
    if (!ing || ing.matched) throw new Error('expected unmatched ingredient');
    expect(ing.pieceQuantity).toEqual({ amount: 1, unitLabel: 'rare squash', gramsPerPiece: 200 });
  });

  it('inherits untracked: true from a matched untracked FOODS entry', async () => {
    const extractor = makeExtractor({
      name: 'Pasta',
      yield: 1,
      ingredients: [{ name: 'salt', amount: 5, unit: 'g' }],
      steps: [],
    });
    const search = makeSearch({
      salt: [
        foodsResult({
          name: 'Salz',
          unit: 'g',
          macrosPerUnit: { calories: 0, protein: 0, carbs: 0, fat: 0 },
          untracked: true,
        }),
      ],
    });

    const draft = await importRecipeFromPhotos({ extractor, search }, oneImage());
    const [ing] = draft.ingredients;
    if (!ing || !ing.matched) throw new Error('expected matched ingredient');
    expect(ing.untracked).toBe(true);
  });

  it('omits untracked on a matched tracked FOODS entry', async () => {
    const extractor = makeExtractor({
      name: 'X',
      yield: 1,
      ingredients: [{ name: 'olive oil', amount: 25, unit: 'ml' }],
      steps: [],
    });
    const search = makeSearch({ 'olive oil': [foodsResult()] });

    const draft = await importRecipeFromPhotos({ extractor, search }, oneImage());
    const [ing] = draft.ingredients;
    if (!ing || !ing.matched) throw new Error('expected matched ingredient');
    expect(ing.untracked).toBeUndefined();
  });

  it('never sets untracked on an unmatched ingredient row', async () => {
    const extractor = makeExtractor({
      name: 'X',
      yield: 1,
      ingredients: [{ name: 'fresh thyme', amount: 5, unit: 'g' }],
      steps: [],
    });
    const search = makeSearch({});

    const draft = await importRecipeFromPhotos({ extractor, search }, oneImage());
    const [ing] = draft.ingredients;
    if (!ing || ing.matched) throw new Error('expected unmatched ingredient');
    expect('untracked' in ing).toBe(false);
  });

  it('populates displayQuantity on a matched-untracked row when rawDisplayUnitLabel is present', async () => {
    const extractor = makeExtractor({
      name: 'Pasta',
      yield: 1,
      ingredients: [{ name: 'salt', rawDisplayAmount: 1, rawDisplayUnitLabel: 'TL' }],
      steps: [],
    });
    const search = makeSearch({
      salt: [
        foodsResult({
          name: 'Salz',
          unit: 'g',
          macrosPerUnit: { calories: 0, protein: 0, carbs: 0, fat: 0 },
          untracked: true,
        }),
      ],
    });

    const draft = await importRecipeFromPhotos({ extractor, search }, oneImage());
    const [ing] = draft.ingredients;
    if (!ing || !ing.matched) throw new Error('expected matched ingredient');
    expect(ing.untracked).toBe(true);
    expect(ing.displayQuantity).toEqual({ amount: 1, unitLabel: 'TL' });
  });

  it('defaults displayQuantity.amount to 1 when only rawDisplayUnitLabel is present', async () => {
    const extractor = makeExtractor({
      name: 'Pasta',
      yield: 1,
      ingredients: [{ name: 'pepper', rawDisplayUnitLabel: 'Prise' }],
      steps: [],
    });
    const search = makeSearch({
      pepper: [
        foodsResult({
          name: 'Pfeffer',
          unit: 'g',
          macrosPerUnit: { calories: 0, protein: 0, carbs: 0, fat: 0 },
          untracked: true,
        }),
      ],
    });

    const draft = await importRecipeFromPhotos({ extractor, search }, oneImage());
    const [ing] = draft.ingredients;
    if (!ing || !ing.matched) throw new Error('expected matched ingredient');
    expect(ing.displayQuantity).toEqual({ amount: 1, unitLabel: 'Prise' });
  });

  it('matched-untracked row with no raw display fields produces no displayQuantity', async () => {
    const extractor = makeExtractor({
      name: 'X',
      yield: 1,
      ingredients: [{ name: 'salt', amount: 5, unit: 'g' }],
      steps: [],
    });
    const search = makeSearch({
      salt: [
        foodsResult({
          name: 'Salz',
          unit: 'g',
          macrosPerUnit: { calories: 0, protein: 0, carbs: 0, fat: 0 },
          untracked: true,
        }),
      ],
    });

    const draft = await importRecipeFromPhotos({ extractor, search }, oneImage());
    const [ing] = draft.ingredients;
    if (!ing || !ing.matched) throw new Error('expected matched ingredient');
    expect(ing.untracked).toBe(true);
    expect(ing.displayQuantity).toBeUndefined();
  });

  it('matched-tracked row drops raw display fields (no displayQuantity)', async () => {
    const extractor = makeExtractor({
      name: 'X',
      yield: 1,
      ingredients: [{ name: 'olive oil', amount: 30, unit: 'ml', rawDisplayAmount: 2, rawDisplayUnitLabel: 'EL' }],
      steps: [],
    });
    const search = makeSearch({ 'olive oil': [foodsResult()] });

    const draft = await importRecipeFromPhotos({ extractor, search }, oneImage());
    const [ing] = draft.ingredients;
    if (!ing || !ing.matched) throw new Error('expected matched ingredient');
    expect(ing.displayQuantity).toBeUndefined();
  });

  it('unmatched row never carries displayQuantity even when raw display fields are present', async () => {
    const extractor = makeExtractor({
      name: 'X',
      yield: 1,
      ingredients: [{ name: 'fresh thyme', rawDisplayAmount: 1, rawDisplayUnitLabel: 'sprig' }],
      steps: [],
    });
    const search = makeSearch({});

    const draft = await importRecipeFromPhotos({ extractor, search }, oneImage());
    const [ing] = draft.ingredients;
    if (!ing || ing.matched) throw new Error('expected unmatched ingredient');
    expect((ing as unknown as { displayQuantity?: unknown }).displayQuantity).toBeUndefined();
  });

  it('matched-untracked with no extracted amount sets canonical amount to 0', async () => {
    const extractor = makeExtractor({
      name: 'X',
      yield: 1,
      ingredients: [{ name: 'salt', rawDisplayUnitLabel: 'n. Geschmack' }],
      steps: [],
    });
    const search = makeSearch({
      salt: [
        foodsResult({
          name: 'Salz',
          unit: 'g',
          macrosPerUnit: { calories: 0, protein: 0, carbs: 0, fat: 0 },
          untracked: true,
        }),
      ],
    });

    const draft = await importRecipeFromPhotos({ extractor, search }, oneImage());
    const [ing] = draft.ingredients;
    if (!ing || !ing.matched) throw new Error('expected matched ingredient');
    expect(ing.amount).toBe(0);
    expect(ing.displayQuantity).toEqual({ amount: 1, unitLabel: 'n. Geschmack' });
  });

  describe('debug payload', () => {
    it('omits debug when includeDebug is not passed', async () => {
      const extractor = makeExtractor({
        name: 'X',
        yield: 1,
        ingredients: [{ name: 'olive oil', amount: 30, unit: 'ml' }],
        steps: [],
      });
      const search = makeSearch({ 'olive oil': [foodsResult()] });

      const draft = await importRecipeFromPhotos({ extractor, search }, oneImage());
      expect('debug' in draft).toBe(false);
    });

    it('populates raw, candidates, chosen, and unitOverridden flag for a matched ingredient', async () => {
      const extractor = makeExtractor({
        name: 'X',
        yield: 1,
        ingredients: [{ name: 'tomato paste', amount: 2, unit: 'tbsp' }],
        steps: [],
      });
      const search = makeSearch({
        'tomato paste': [
          foodsResult({ id: 'foods-tm', name: 'Tomatenmark', unit: 'g' }),
          foodsResult({ id: 'foods-tom', name: 'Tomaten', unit: 'g' }),
        ],
      });

      const draft = await importRecipeFromPhotos({ extractor, search, includeDebug: true }, oneImage());

      expect(draft.debug).toBeDefined();
      expect(draft.debug!.ingredients).toHaveLength(1);
      const entry = draft.debug!.ingredients[0]!;
      expect(entry.raw).toEqual({ name: 'tomato paste', amount: 2, unit: 'tbsp' });
      expect(entry.candidates).toHaveLength(2);
      expect(entry.candidates[0]).toEqual({ name: 'Tomatenmark', source: 'FOODS', unit: 'g', untracked: false });
      expect(entry.candidates[1]).toEqual({ name: 'Tomaten', source: 'FOODS', unit: 'g', untracked: false });
      expect(entry.chosen).toEqual(entry.candidates[0]);
      expect(entry.flags.unitOverridden).toBe(true);
      expect(entry.flags.pieceQuantityDropped).toBe(false);
      expect(entry.flags.untrackedInherited).toBe(false);
    });

    it('sets chosen=null, empty candidates, and all flags false for an unmatched ingredient', async () => {
      const extractor = makeExtractor({
        name: 'X',
        yield: 1,
        ingredients: [{ name: 'unicorn dust', amount: 1, unit: 'tsp' }],
        steps: [],
      });
      const search = makeSearch({});

      const draft = await importRecipeFromPhotos({ extractor, search, includeDebug: true }, oneImage());

      const entry = draft.debug!.ingredients[0]!;
      expect(entry.chosen).toBeNull();
      expect(entry.candidates).toEqual([]);
      expect(entry.flags.unitOverridden).toBe(false);
      expect(entry.flags.pieceQuantityDropped).toBe(false);
      expect(entry.flags.untrackedInherited).toBe(false);
    });

    it('flags pieceQuantityDropped when the catalog unit is non-mass', async () => {
      const extractor = makeExtractor({
        name: 'X',
        yield: 1,
        ingredients: [
          {
            name: 'Knoblauch',
            amount: 6,
            unit: 'g',
            pieceQuantity: { amount: 2, unitLabel: 'Zehe', gramsPerPiece: 3 },
          },
        ],
        steps: [],
      });
      const search = makeSearch({ knoblauch: [foodsResult({ name: 'Knoblauch', unit: 'tbsp' })] });

      const draft = await importRecipeFromPhotos({ extractor, search, includeDebug: true }, oneImage());

      const entry = draft.debug!.ingredients[0]!;
      expect(entry.flags.pieceQuantityDropped).toBe(true);
      expect(entry.flags.unitOverridden).toBe(true);
    });

    it('flags untrackedInherited when the FOODS match is untracked', async () => {
      const extractor = makeExtractor({
        name: 'Pasta',
        yield: 1,
        ingredients: [{ name: 'salt', amount: 5, unit: 'g' }],
        steps: [],
      });
      const search = makeSearch({
        salt: [
          foodsResult({
            name: 'Salz',
            unit: 'g',
            macrosPerUnit: { calories: 0, protein: 0, carbs: 0, fat: 0 },
            untracked: true,
          }),
        ],
      });

      const draft = await importRecipeFromPhotos({ extractor, search, includeDebug: true }, oneImage());

      const entry = draft.debug!.ingredients[0]!;
      expect(entry.flags.untrackedInherited).toBe(true);
      expect(entry.candidates[0]?.untracked).toBe(true);
    });

    it('caps candidates at 5 even when the search returns more', async () => {
      const extractor = makeExtractor({
        name: 'X',
        yield: 1,
        ingredients: [{ name: 'tomato', amount: 1, unit: 'g' }],
        steps: [],
      });
      const many: IngredientSearchResult[] = Array.from({ length: 9 }, (_, i) =>
        foodsResult({ id: `f-${i}`, name: `Tomate ${i}`, unit: 'g' }),
      );
      const search = makeSearch({ tomato: many });

      const draft = await importRecipeFromPhotos({ extractor, search, includeDebug: true }, oneImage());

      const entry = draft.debug!.ingredients[0]!;
      expect(entry.candidates).toHaveLength(5);
      expect(entry.candidates.map((c) => c.name)).toEqual(['Tomate 0', 'Tomate 1', 'Tomate 2', 'Tomate 3', 'Tomate 4']);
    });
  });

  it('does not write to the recipe repository', async () => {
    const extractor = makeExtractor({
      name: 'X',
      yield: 1,
      ingredients: [{ name: 'olive oil', amount: 10, unit: 'ml' }],
      steps: [],
    });
    const search = makeSearch({ 'olive oil': [foodsResult()] });
    const repo = makeRepo();

    await importRecipeFromPhotos({ extractor, search, repo }, oneImage());

    expect(repo.save).not.toHaveBeenCalled();
    expect(repo.update).not.toHaveBeenCalled();
    expect(repo.remove).not.toHaveBeenCalled();
  });

  describe('name normalization fallback', () => {
    it('retries the search with the normalized name when the raw name produces zero hits', async () => {
      const extractor = makeExtractor({
        name: 'X',
        yield: 1,
        ingredients: [{ name: 'Ingwer, fein gehackt', amount: 5, unit: 'g' }],
        steps: [],
      });
      const search = makeSearch({ ingwer: [foodsResult({ name: 'Ingwer', unit: 'g' })] });

      const draft = await importRecipeFromPhotos({ extractor, search }, oneImage());

      expect(search.searchByName).toHaveBeenCalledTimes(2);
      const [first, second] = (search.searchByName as ReturnType<typeof vi.fn>).mock.calls;
      expect((first as [string])[0]).toBe('Ingwer, fein gehackt');
      expect((second as [string])[0]).toBe('Ingwer');

      const [ing] = draft.ingredients;
      if (!ing || !ing.matched) throw new Error('expected matched ingredient');
      expect(ing.name).toBe('Ingwer');
      expect(ing.amount).toBe(5);
    });

    it('records the NORMALIZED name when both raw and normalized produce zero hits', async () => {
      const extractor = makeExtractor({
        name: 'X',
        yield: 1,
        ingredients: [{ name: 'Rindertatar, frisch gewolft', amount: 200, unit: 'g' }],
        steps: [],
      });
      const search = makeSearch({});
      const record = vi.fn<(r: { name: string }) => Promise<void>>().mockResolvedValue(undefined);

      await importRecipeFromPhotos({ extractor, search, recorder: { record } }, oneImage());

      expect(record).toHaveBeenCalledTimes(1);
      const [recorded] = (record as ReturnType<typeof vi.fn>).mock.calls[0] as [{ name: string }];
      expect(recorded.name).toBe('Rindertatar');
    });

    it('does not retry when the raw name already matches (single search call)', async () => {
      const extractor = makeExtractor({
        name: 'X',
        yield: 1,
        ingredients: [{ name: 'Ingwer', amount: 5, unit: 'g' }],
        steps: [],
      });
      const search = makeSearch({ ingwer: [foodsResult({ name: 'Ingwer', unit: 'g' })] });

      await importRecipeFromPhotos({ extractor, search }, oneImage());

      expect(search.searchByName).toHaveBeenCalledTimes(1);
    });

    it('does not retry when normalization yields the same string', async () => {
      const extractor = makeExtractor({
        name: 'X',
        yield: 1,
        ingredients: [{ name: 'unicorn dust', amount: 1, unit: 'tsp' }],
        steps: [],
      });
      const search = makeSearch({});

      await importRecipeFromPhotos({ extractor, search }, oneImage());

      // Only one search call: the normalized form equals the raw form, so no retry.
      expect(search.searchByName).toHaveBeenCalledTimes(1);
    });
  });

  describe('unmatched-ingredient recorder', () => {
    it('forwards the original RawIngredient to the recorder for a strict-unmatched row', async () => {
      const extractor = makeExtractor({
        name: 'X',
        yield: 1,
        ingredients: [{ name: 'unicorn dust', amount: 1, unit: 'tsp' }],
        steps: [],
      });
      const search = makeSearch({});
      const record = vi.fn<(r: { name: string }) => Promise<void>>().mockResolvedValue(undefined);

      await importRecipeFromPhotos({ extractor, search, recorder: { record } }, oneImage());

      expect(record).toHaveBeenCalledTimes(1);
      expect(record).toHaveBeenCalledWith({ name: 'unicorn dust', amount: 1, unit: 'tsp' });
    });

    it('does not invoke the recorder for matched rows (including unit-overridden, piece-dropped, untracked-inherited)', async () => {
      const extractor = makeExtractor({
        name: 'X',
        yield: 1,
        ingredients: [
          { name: 'tomato paste', amount: 2, unit: 'tbsp' }, // unit overridden
          {
            name: 'Knoblauch',
            amount: 6,
            unit: 'g',
            pieceQuantity: { amount: 2, unitLabel: 'Zehe', gramsPerPiece: 3 },
          }, // piece dropped
          { name: 'salt', amount: 5, unit: 'g' }, // untracked inherited
        ],
        steps: [],
      });
      const search = makeSearch({
        'tomato paste': [foodsResult({ name: 'Tomatenmark', unit: 'g' })],
        knoblauch: [foodsResult({ name: 'Knoblauch', unit: 'tbsp' })],
        salt: [
          foodsResult({
            name: 'Salz',
            unit: 'g',
            macrosPerUnit: { calories: 0, protein: 0, carbs: 0, fat: 0 },
            untracked: true,
          }),
        ],
      });
      const record = vi.fn<(r: { name: string }) => Promise<void>>().mockResolvedValue(undefined);

      await importRecipeFromPhotos({ extractor, search, recorder: { record } }, oneImage());

      expect(record).not.toHaveBeenCalled();
    });

    it('continues processing remaining ingredients when the recorder throws', async () => {
      const extractor = makeExtractor({
        name: 'X',
        yield: 1,
        ingredients: [
          { name: 'unicorn dust', amount: 1, unit: 'tsp' },
          { name: 'olive oil', amount: 30, unit: 'ml' },
        ],
        steps: [],
      });
      const search = makeSearch({ 'olive oil': [foodsResult()] });
      const record = vi.fn<(r: { name: string }) => Promise<void>>().mockRejectedValue(new Error('disk full'));
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      const draft = await importRecipeFromPhotos({ extractor, search, recorder: { record } }, oneImage());

      expect(draft.ingredients).toHaveLength(2);
      expect(draft.ingredients[0]?.matched).toBe(false);
      expect(draft.ingredients[1]?.matched).toBe(true);
      expect(record).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });

    it('does nothing recorder-related when deps.recorder is absent', async () => {
      const extractor = makeExtractor({
        name: 'X',
        yield: 1,
        ingredients: [{ name: 'unicorn dust', amount: 1, unit: 'tsp' }],
        steps: [],
      });
      const search = makeSearch({});

      const draft = await importRecipeFromPhotos({ extractor, search }, oneImage());

      expect(draft.ingredients[0]?.matched).toBe(false);
      // No throw, no side effect to assert beyond absence — passing without recorder is the contract.
    });
  });

  describe('ingredient note pass-through', () => {
    it('carries the note onto a matched ingredient', async () => {
      const extractor = makeExtractor({
        name: 'Soup',
        yield: 1,
        ingredients: [{ name: 'Ingwer', amount: 5, unit: 'g', note: 'fein gehackt' }],
        steps: [],
      });
      const search = makeSearch({
        ingwer: [
          foodsResult({ name: 'Ingwer', unit: 'g', macrosPerUnit: { calories: 1, protein: 0, carbs: 0, fat: 0 } }),
        ],
      });
      const draft = await importRecipeFromPhotos({ extractor, search }, oneImage());
      const ing = draft.ingredients[0]!;
      expect(ing.matched).toBe(true);
      expect(ing.note).toBe('fein gehackt');
    });

    it('carries the note onto an unmatched ingredient', async () => {
      const extractor = makeExtractor({
        name: 'Curry',
        yield: 1,
        ingredients: [{ name: 'Yuzu-Schale', amount: 2, unit: 'g', note: 'fein abgerieben' }],
        steps: [],
      });
      const search = makeSearch({});
      const draft = await importRecipeFromPhotos({ extractor, search }, oneImage());
      const ing = draft.ingredients[0]!;
      expect(ing.matched).toBe(false);
      expect(ing.note).toBe('fein abgerieben');
    });

    it('omits note from matched and unmatched rows when extractor did not supply one', async () => {
      const extractor = makeExtractor({
        name: 'Mix',
        yield: 1,
        ingredients: [
          { name: 'Olivenöl', amount: 30, unit: 'ml' }, // matched, no note
          { name: 'unicorn dust', amount: 1, unit: 'tsp' }, // unmatched, no note
        ],
        steps: [],
      });
      const search = makeSearch({ olivenöl: [foodsResult({ name: 'Olivenöl', unit: 'ml' })] });
      const draft = await importRecipeFromPhotos({ extractor, search }, oneImage());
      expect(draft.ingredients[0]!).not.toHaveProperty('note');
      expect(draft.ingredients[1]!).not.toHaveProperty('note');
    });

    it('note presence does not affect normalization fallback, recorder, or match flags', async () => {
      // raw name with comma suffix forces the normalize-and-retry path; recorder receives normalized name.
      const extractor = makeExtractor({
        name: 'X',
        yield: 1,
        ingredients: [
          {
            name: 'Rindertatar, frisch gewolft',
            amount: 200,
            unit: 'tbsp', // forces unitOverridden against a 'g' match below
            pieceAmount: 2,
            pieceUnitLabel: 'Stück',
            gramsPerPiece: 100,
            note: 'frisch',
          },
        ],
        steps: [],
      });
      // No match for the raw nor normalized name (test the recorder branch).
      const search = makeSearch({});
      const record = vi.fn<(raw: { name: string; note?: string }) => Promise<void>>().mockResolvedValue(undefined);
      const draft = await importRecipeFromPhotos({ extractor, search, recorder: { record } }, oneImage());
      const ing = draft.ingredients[0]!;
      expect(ing.matched).toBe(false);
      expect(ing.note).toBe('frisch');
      // Recorder received the *normalized* name and the note rides along verbatim.
      expect(record).toHaveBeenCalledTimes(1);
      const recorded = record.mock.calls[0]![0];
      expect(recorded.name).toBe('Rindertatar');
      expect(recorded.note).toBe('frisch');
    });

    it('matched row with note still carries unitOverridden and other flags as usual', async () => {
      const extractor = makeExtractor({
        name: 'X',
        yield: 1,
        ingredients: [{ name: 'tomato paste', amount: 2, unit: 'tbsp', note: 'doppelt konzentriert' }],
        steps: [],
      });
      const search = makeSearch({
        'tomato paste': [
          foodsResult({
            name: 'Tomatenmark',
            unit: 'g',
            macrosPerUnit: { calories: 0.82, protein: 0.044, carbs: 0.179, fat: 0.005 },
          }),
        ],
      });
      const draft = await importRecipeFromPhotos({ extractor, search }, oneImage());
      const ing = draft.ingredients[0]!;
      if (!ing.matched) throw new Error('expected matched ingredient');
      expect(ing.unitOverridden).toBe(true);
      expect(ing.note).toBe('doppelt konzentriert');
    });
  });
});
