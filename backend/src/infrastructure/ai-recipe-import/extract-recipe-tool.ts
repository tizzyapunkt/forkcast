import type { ExtractedDraft, RawIngredient } from '../../domain/ai-recipe-import/types.ts';
import type { MeasurementUnit, PieceQuantity } from '../../domain/recipes/types.ts';
import { PIECE_QUANTITY_TOLERANCE } from '../../domain/recipes/validate-piece-quantity.ts';

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
              description:
                'Numeric amount in mass (g) or volume (ml) units. When piece fields are populated, this MUST equal pieceAmount * gramsPerPiece. OMIT entirely if the recipe does not quantify the ingredient (e.g. "salt to taste").',
            },
            unit: {
              type: 'string',
              enum: SUPPORTED_UNITS,
              description:
                'Measurement unit. When piece fields are populated, MUST be "g" (or "ml" only if the recipe explicitly frames the piece as a liquid quantity, e.g. "juice of 1 lemon"). OMIT entirely if not shown or not in the supported set.',
            },
            pieceAmount: {
              type: 'number',
              description:
                'Count of pieces as written when the recipe states the ingredient by count rather than by mass (e.g. 1, 0.5, 2). Fractional values are permitted. OMIT when the recipe states the ingredient by mass directly.',
            },
            pieceUnitLabel: {
              type: 'string',
              description:
                'The noun the recipe uses for one piece, in the original language (e.g. "onion", "medium zucchini", "clove", "Knoblauchzehe"). MUST be present whenever pieceAmount is present.',
            },
            gramsPerPiece: {
              type: 'number',
              description:
                'Your best estimate of the typical mass of one such piece in grams (or ml for liquid pieces). MUST be present whenever pieceAmount is present.',
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

export const EXTRACT_RECIPE_INSTRUCTIONS = [
  'You will receive one or more images that all depict the same recipe. They may be different pages, angles, or screenshots of one Instagram post — interpret them in order and merge the content into a single recipe.',
  'Use the extract_recipe tool to return the result.',
  'Quantification rules:',
  '- If an ingredient amount or unit is not visible (e.g. "salt to taste"), omit those fields rather than guessing.',
  '- When an ingredient is given as a count rather than a mass (e.g. "1 onion", "½ medium zucchini", "2 cloves garlic", "1 medium tomato"), populate pieceAmount, pieceUnitLabel, and gramsPerPiece with your best estimate of a typical piece weight in grams. Always also populate amount and unit with the resulting total weight (amount = pieceAmount * gramsPerPiece, unit = "g"). Use unit = "ml" only when the recipe explicitly frames the piece as a liquid quantity (e.g. "juice of 1 lemon").',
  '- When the recipe is already given by mass directly (e.g. "200 g flour"), omit the piece fields.',
  'Keep the original language for names and steps.',
].join(' ');

interface RawToolInputIngredient {
  name?: unknown;
  amount?: unknown;
  unit?: unknown;
  pieceAmount?: unknown;
  pieceUnitLabel?: unknown;
  gramsPerPiece?: unknown;
}
interface RawToolInput {
  name?: unknown;
  yield?: unknown;
  ingredients?: unknown;
  steps?: unknown;
}

function isFinitePositive(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

function buildPieceQuantity(
  ing: RawToolInputIngredient,
  unit: MeasurementUnit | undefined,
  amount: number | undefined,
): { pieceQuantity?: PieceQuantity; resolvedAmount?: number } {
  const hasAny = ing.pieceAmount !== undefined || ing.pieceUnitLabel !== undefined || ing.gramsPerPiece !== undefined;
  if (!hasAny) return {};

  const pieceAmount = ing.pieceAmount;
  const pieceUnitLabel = ing.pieceUnitLabel;
  const gramsPerPiece = ing.gramsPerPiece;

  const allPresent =
    isFinitePositive(pieceAmount) &&
    typeof pieceUnitLabel === 'string' &&
    pieceUnitLabel.trim().length > 0 &&
    isFinitePositive(gramsPerPiece);
  if (!allPresent) return {};

  if (unit !== 'g' && unit !== 'ml') return {};

  const expected = pieceAmount * gramsPerPiece;
  const tolerance = expected * PIECE_QUANTITY_TOLERANCE;
  const resolvedAmount = amount !== undefined && Math.abs(amount - expected) <= tolerance ? amount : expected;

  return {
    pieceQuantity: {
      amount: pieceAmount,
      unitLabel: pieceUnitLabel.trim(),
      gramsPerPiece,
    },
    resolvedAmount,
  };
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
    let amount: number | undefined;
    if (typeof ing.amount === 'number' && Number.isFinite(ing.amount)) {
      amount = ing.amount;
    }
    let unit: MeasurementUnit | undefined;
    if (typeof ing.unit === 'string' && (SUPPORTED_UNITS as string[]).includes(ing.unit)) {
      unit = ing.unit as MeasurementUnit;
    }

    const piece = buildPieceQuantity(ing, unit, amount);
    if (piece.pieceQuantity) {
      result.pieceQuantity = piece.pieceQuantity;
      result.amount = piece.resolvedAmount;
    } else {
      if (amount !== undefined) result.amount = amount;
    }
    if (unit !== undefined) result.unit = unit;
    return result;
  });

  const steps: string[] = raw.steps
    .filter((s): s is string => typeof s === 'string')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  return { name: raw.name.trim(), yield: recipeYield, ingredients, steps };
}
