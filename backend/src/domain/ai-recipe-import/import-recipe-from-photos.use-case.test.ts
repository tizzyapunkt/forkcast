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

type CascadeMap = Partial<Record<'FOODS' | 'USER' | 'SCAN' | 'OFF', Record<string, IngredientSearchResult[]>>>;

/** A search mock that honours the requested single-source set, for cascade-tier tests. */
function makeCascadeSearch(bySource: CascadeMap): IngredientSearchService {
  return {
    searchByName: vi
      .fn<(q: string, sources?: Set<string>) => Promise<IngredientSearchResult[]>>()
      .mockImplementation(async (q, sources) => {
        const src = sources ? [...sources][0] : 'OFF';
        const map = (bySource as Record<string, Record<string, IngredientSearchResult[]>>)[src as string] ?? {};
        return map[q.toLowerCase()] ?? [];
      }),
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

  it('searches the FOODS source first and stops once it hits (no USER/SCAN, no OFF)', async () => {
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
    const [, sources] = calls[0] as [string, Set<'FOODS' | 'USER' | 'SCAN' | 'OFF'>];
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

  it('leaves displayQuantity.amount unset when only rawDisplayUnitLabel is present', async () => {
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
    expect(ing.displayQuantity).toEqual({ unitLabel: 'Prise' });
  });

  it('seeds a "nach Geschmack" label for a bare untracked seasoning with no stated quantity', async () => {
    // "Salz"/"Pfeffer" with no amount and no raw-display text — must not render as "0 g".
    const extractor = makeExtractor({
      name: 'Pfanne',
      yield: 1,
      ingredients: [{ name: 'Salz' }],
      steps: [],
    });
    const search = makeSearch({
      salz: [
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
    expect(ing.amount).toBe(0);
    expect(ing.displayQuantity).toEqual({ unitLabel: 'nach Geschmack' });
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
    expect(ing.displayQuantity).toEqual({ unitLabel: 'n. Geschmack' });
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

    it('flags missingAmount when a tracked match resolves with no weight (rawDisplay misroute)', async () => {
      // Reproduces "½ mittelgroße Zucchini" landing on the raw-display path: a tracked
      // food matched with neither an amount nor a piece estimate — effectively 0 g.
      const extractor = makeExtractor({
        name: 'Pfanne',
        yield: 1,
        ingredients: [{ name: 'Zucchini', rawDisplayAmount: 0.5, rawDisplayUnitLabel: 'mittelgroße' }],
        steps: [],
      });
      const search = makeSearch({ zucchini: [foodsResult({ name: 'Zucchini', unit: 'g' })] });

      const draft = await importRecipeFromPhotos({ extractor, search, includeDebug: true }, oneImage());

      const entry = draft.debug!.ingredients[0]!;
      expect(entry.flags.missingAmount).toBe(true);
      const ing = draft.ingredients[0]!;
      if (!ing.matched) throw new Error('expected matched ingredient');
      expect(ing.amount).toBeNull();
    });

    it('does not flag missingAmount when a tracked match carries a weight', async () => {
      const extractor = makeExtractor({
        name: 'X',
        yield: 1,
        ingredients: [{ name: 'olive oil', amount: 30, unit: 'ml' }],
        steps: [],
      });
      const search = makeSearch({ 'olive oil': [foodsResult()] });

      const draft = await importRecipeFromPhotos({ extractor, search, includeDebug: true }, oneImage());

      expect(draft.debug!.ingredients[0]!.flags.missingAmount).toBe(false);
    });

    it('does not flag missingAmount for an untracked match (amount defaults to 0)', async () => {
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

      const draft = await importRecipeFromPhotos({ extractor, search, includeDebug: true }, oneImage());

      expect(draft.debug!.ingredients[0]!.flags.missingAmount).toBe(false);
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

  describe('name normalization fallback across the cascade', () => {
    it('retries the cascade with the normalized name when the raw name produces zero hits', async () => {
      const extractor = makeExtractor({
        name: 'X',
        yield: 1,
        ingredients: [{ name: 'Ingwer, fein gehackt', amount: 5, unit: 'g' }],
        steps: [],
      });
      const search = makeSearch({ ingwer: [foodsResult({ name: 'Ingwer', unit: 'g' })] });

      const draft = await importRecipeFromPhotos({ extractor, search }, oneImage());

      const queries = (search.searchByName as ReturnType<typeof vi.fn>).mock.calls.map((c) => (c as [string])[0]);
      // raw name misses every tier (3 calls), normalized name hits FOODS (1 call).
      expect(queries).toEqual(['Ingwer, fein gehackt', 'Ingwer, fein gehackt', 'Ingwer, fein gehackt', 'Ingwer']);

      const [ing] = draft.ingredients;
      if (!ing || !ing.matched) throw new Error('expected matched ingredient');
      expect(ing.name).toBe('Ingwer');
      expect(ing.amount).toBe(5);
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

      // One cascade attempt (FOODS, USER, SCAN); the normalized form equals the raw form, so no retry.
      expect(search.searchByName).toHaveBeenCalledTimes(3);
    });
  });

  describe('source cascade FOODS → USER → SCAN', () => {
    it('matches an overlay (USER) food when FOODS has no hit', async () => {
      const extractor = makeExtractor({
        name: 'X',
        yield: 1,
        ingredients: [{ name: 'Kirschtomaten', amount: 50, unit: 'g' }],
        steps: [],
      });
      const search = makeCascadeSearch({
        USER: { kirschtomaten: [foodsResult({ id: 'u1', name: 'Kirschtomaten', unit: 'g', source: 'USER' })] },
      });

      const draft = await importRecipeFromPhotos({ extractor, search }, oneImage());
      const [ing] = draft.ingredients;
      if (!ing || !ing.matched) throw new Error('expected matched ingredient');
      expect(ing.source).toBe('USER');
      expect(ing.amount).toBe(50);
    });

    it('matches a scanned (SCAN) product when FOODS and USER have no hit', async () => {
      const extractor = makeExtractor({
        name: 'X',
        yield: 1,
        ingredients: [{ name: 'Skyr', amount: 200, unit: 'g' }],
        steps: [],
      });
      const search = makeCascadeSearch({
        SCAN: { skyr: [foodsResult({ id: '111', name: 'Skyr Natur', unit: 'g', source: 'SCAN' })] },
      });

      const draft = await importRecipeFromPhotos({ extractor, search }, oneImage());
      const [ing] = draft.ingredients;
      if (!ing || !ing.matched) throw new Error('expected matched ingredient');
      expect(ing.source).toBe('SCAN');
    });

    it('prefers FOODS over USER/SCAN and does not consult lower tiers on a FOODS hit', async () => {
      const extractor = makeExtractor({
        name: 'X',
        yield: 1,
        ingredients: [{ name: 'Tomaten', amount: 100, unit: 'g' }],
        steps: [],
      });
      const search = makeCascadeSearch({
        FOODS: { tomaten: [foodsResult({ name: 'Tomaten', unit: 'g', source: 'FOODS' })] },
        USER: { tomaten: [foodsResult({ id: 'u', name: 'Tomaten USER', unit: 'g', source: 'USER' })] },
      });

      const draft = await importRecipeFromPhotos({ extractor, search }, oneImage());
      const [ing] = draft.ingredients;
      if (!ing || !ing.matched) throw new Error('expected matched ingredient');
      expect(ing.source).toBe('FOODS');
      // Only the FOODS tier was queried.
      expect(search.searchByName).toHaveBeenCalledTimes(1);
    });

    it('never queries OFF during import matching', async () => {
      const extractor = makeExtractor({
        name: 'X',
        yield: 1,
        ingredients: [{ name: 'unicorn dust', amount: 1, unit: 'tsp' }],
        steps: [],
      });
      const search = makeCascadeSearch({ OFF: { 'unicorn dust': [foodsResult({ source: 'FOODS' })] } });

      const draft = await importRecipeFromPhotos({ extractor, search }, oneImage());
      const queriedSources = (search.searchByName as ReturnType<typeof vi.fn>).mock.calls.map(
        (c) => [...((c as [string, Set<string>])[1] ?? [])][0],
      );
      expect(queriedSources).not.toContain('OFF');
      expect(draft.ingredients[0]?.matched).toBe(false);
    });

    it('leaves a row unmatched (no macros, no untracked) when every tier misses', async () => {
      const extractor = makeExtractor({
        name: 'X',
        yield: 1,
        ingredients: [{ name: 'unicorn dust', amount: 1, unit: 'tsp' }],
        steps: [],
      });
      const search = makeCascadeSearch({});

      const draft = await importRecipeFromPhotos({ extractor, search }, oneImage());
      const ing = draft.ingredients[0];
      if (!ing || ing.matched) throw new Error('expected an unmatched ingredient');
      expect(ing.name).toBe('unicorn dust');
      expect('macrosPerUnit' in ing).toBe(false);
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

    it('note rides along on an unmatched row even when the normalize-and-retry path runs', async () => {
      // raw name with comma suffix forces the normalize-and-retry path across the cascade.
      const extractor = makeExtractor({
        name: 'X',
        yield: 1,
        ingredients: [{ name: 'Rindertatar, frisch gewolft', amount: 200, unit: 'g', note: 'frisch' }],
        steps: [],
      });
      // No match for the raw nor normalized name in any tier.
      const search = makeSearch({});
      const draft = await importRecipeFromPhotos({ extractor, search }, oneImage());
      const ing = draft.ingredients[0]!;
      expect(ing.matched).toBe(false);
      expect(ing.note).toBe('frisch');
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

    it('converts a spoon measure on a tracked g-unit match using the food density', async () => {
      const extractor = makeExtractor({
        name: 'Sauce',
        yield: 1,
        ingredients: [{ name: 'Speisestärke', rawDisplayAmount: 2, rawDisplayUnitLabel: 'TL' }],
        steps: [],
      });
      const search = makeSearch({
        speisestärke: [
          foodsResult({
            name: 'Speisestärke',
            unit: 'g',
            macrosPerUnit: { calories: 3.81, protein: 0.006, carbs: 0.91, fat: 0.001 },
            density: 0.55,
          }),
        ],
      });
      const draft = await importRecipeFromPhotos({ extractor, search }, oneImage());
      const ing = draft.ingredients[0]!;
      if (!ing.matched) throw new Error('expected matched ingredient');
      expect(ing.unit).toBe('g');
      expect(ing.amount).toBeCloseTo(5.5); // 2 × 5 ml × 0.55 g/ml
      expect(ing.untracked).toBeUndefined();
      expect(ing.displayQuantity).toBeUndefined();
    });
  });
});
