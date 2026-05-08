import type { ExtractedDraft, RawIngredient } from '../../domain/ai-recipe-import/types.ts';
import type { MeasurementUnit } from '../../domain/meal-log/types.ts';

export const EXTRACT_RECIPE_TOOL_NAME = 'extract_recipe';

const SUPPORTED_UNITS: MeasurementUnit[] = ['g', 'ml', 'oz', 'cup', 'tbsp', 'tsp', 'piece'];

export const EXTRACT_RECIPE_TOOL = {
  name: EXTRACT_RECIPE_TOOL_NAME,
  description:
    'Extract a single recipe drawn from one or more ordered images. Treat the images as different views or pages of the same recipe.',
  input_schema: {
    type: 'object' as const,
    required: ['name', 'ingredients', 'steps'],
    properties: {
      name: {
        type: 'string',
        description: 'Recipe title in the original language used in the images.',
      },
      yield: {
        type: 'integer',
        minimum: 1,
        description: 'Number of portions the recipe produces. Default to 1 if not visible.',
      },
      ingredients: {
        type: 'array',
        description: 'Ordered list of ingredients as written in the images.',
        items: {
          type: 'object',
          required: ['name'],
          properties: {
            name: {
              type: 'string',
              description: 'Ingredient name in the original language (e.g. "Olivenöl").',
            },
            amount: {
              type: 'number',
              description: 'Numeric amount. OMIT entirely if the amount is not shown.',
            },
            unit: {
              type: 'string',
              enum: SUPPORTED_UNITS,
              description: 'Measurement unit. OMIT entirely if not shown or not in the supported set.',
            },
          },
        },
      },
      steps: {
        type: 'array',
        description: 'Ordered cooking steps in the original language.',
        items: { type: 'string' },
      },
    },
  },
};

export const EXTRACT_RECIPE_INSTRUCTIONS =
  'You will receive one or more images that all depict the same recipe. They may be different pages, angles, or screenshots of one Instagram post — interpret them in order and merge the content into a single recipe. Use the extract_recipe tool to return the result. If an ingredient amount or unit is not visible, omit those fields rather than guessing. Keep the original language for names and steps.';

interface RawToolInputIngredient {
  name?: unknown;
  amount?: unknown;
  unit?: unknown;
}
interface RawToolInput {
  name?: unknown;
  yield?: unknown;
  ingredients?: unknown;
  steps?: unknown;
}

export function parseToolInput(input: unknown): ExtractedDraft {
  if (!input || typeof input !== 'object') {
    throw new Error('Tool input is not an object');
  }
  const raw = input as RawToolInput;

  if (typeof raw.name !== 'string' || raw.name.trim().length === 0) {
    throw new Error('Tool input is missing a recipe name');
  }
  if (!Array.isArray(raw.ingredients) || raw.ingredients.length === 0) {
    throw new Error('Tool input must contain at least one ingredient');
  }
  if (!Array.isArray(raw.steps)) {
    throw new Error('Tool input steps must be an array');
  }

  const recipeYield =
    typeof raw.yield === 'number' && Number.isFinite(raw.yield) && raw.yield >= 1 ? Math.floor(raw.yield) : 1;

  const ingredients: RawIngredient[] = raw.ingredients.map((item, idx) => {
    if (!item || typeof item !== 'object') {
      throw new Error(`Ingredient at index ${idx} is not an object`);
    }
    const ing = item as RawToolInputIngredient;
    if (typeof ing.name !== 'string' || ing.name.trim().length === 0) {
      throw new Error(`Ingredient at index ${idx} is missing a name`);
    }
    const result: RawIngredient = { name: ing.name.trim() };
    if (typeof ing.amount === 'number' && Number.isFinite(ing.amount)) {
      result.amount = ing.amount;
    }
    if (typeof ing.unit === 'string' && (SUPPORTED_UNITS as string[]).includes(ing.unit)) {
      result.unit = ing.unit as MeasurementUnit;
    }
    return result;
  });

  const steps: string[] = raw.steps
    .filter((s): s is string => typeof s === 'string')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  return { name: raw.name.trim(), yield: recipeYield, ingredients, steps };
}
