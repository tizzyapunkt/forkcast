import type { ExtractedDraft, RawIngredient } from '../../domain/ai-recipe-import/types.ts';
import type { MeasurementUnit, PieceQuantity } from '../../domain/recipes/types.ts';
import { PIECE_QUANTITY_TOLERANCE } from '../../domain/recipes/validate-piece-quantity.ts';

export const EXTRACT_RECIPE_TOOL_NAME = 'extract_recipe';

// Counts are represented via the piece fields (pieceAmount/pieceUnitLabel/gramsPerPiece),
// never as unit: 'piece'. Offering 'piece' here only tempts the model to emit "1 piece"
// and silently drop the weight estimate, so the extraction enum is restricted to real
// measures; a stray unit: 'piece' from the model is reconciled to grams in buildPieceQuantity.
const SUPPORTED_UNITS: MeasurementUnit[] = ['g', 'ml', 'oz', 'cup', 'tbsp', 'tsp'];

const NOTE_MAX_LENGTH = 80;

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
              description:
                'Ingredient name in the original language (e.g. "Olivenöl"). MUST be the food noun only — no preparation, cut, or quality modifiers (e.g. write "Ingwer" not "Ingwer, fein gehackt"; "Tomaten" not "Tomaten, geschält"). BUT qualifiers that change the food\'s identity or nutrition MUST be kept on the name: "Zuckerfreier Ahornsirup", "Geräucherter Lachs", and "getrocknete Tomaten in Öl" (sun-dried tomatoes in oil — a different food from fresh "Tomaten", with far higher calories). When unsure whether a qualifier is mere prep (→ note) or identity-changing (→ keep on name), keep it on the name. If the recipe text bundles a prep modifier into the ingredient line, move that prep instruction into the appropriate entry in steps.',
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
                'The bare COUNT NOUN for one piece, in the original language (e.g. "onion", "medium zucchini", "clove", "Knoblauchzehe", "Stück", "Scheibe", "Dose"). MUST be present whenever pieceAmount is present. It is ONLY a unit of count — it MUST NOT contain the food name or any quality/preparation modifier. E.g. for "2 EL getrocknete Tomaten in Öl" the qualifier "getrocknet in Öl" belongs on `name` (it changes the food), NOT here; and "EL" is a non-canonical spoon unit, so use rawDisplayUnitLabel, not pieceUnitLabel.',
            },
            gramsPerPiece: {
              type: 'number',
              description:
                'Your best estimate of the typical mass of one such piece in grams (or ml for liquid pieces). MUST be present whenever pieceAmount is present.',
            },
            rawDisplayAmount: {
              type: 'number',
              description:
                'Literal numeric amount as written in the recipe, when the recipe uses a unit outside the canonical enum (typical for seasonings/spices/herbs, e.g. "1 TL", "2 EL", "1/2 Prise"). Fractional values are permitted. OMIT when the recipe uses a canonical unit (g, ml, oz, cup, tbsp, tsp, piece).',
            },
            rawDisplayUnitLabel: {
              type: 'string',
              description:
                'Literal textual MEASURING unit as written in the recipe, when outside the canonical enum — spoons, pinches, splashes and the like (e.g. "TL", "EL", "Teelöffel", "Esslöffel", "Prise", "Schuss", "Spritzer", "n. Geschmack"). OMIT when the recipe uses a canonical unit. NEVER use this field for a counted food or for a size adjective like "mittelgroße"/"große"/"kleine" — a counted food (even one described by size) takes the piece fields above, not the raw-display fields. Capture the original language and casing.',
            },
            note: {
              type: 'string',
              description:
                'A short preparation, cut, or quality modifier that the source recipe bundled inline with this ingredient (e.g. "fein gehackt", "geschält", "in Scheiben", "frisch gewolft", "geröstet", "abgerieben"). In the original language of the recipe. OMIT when the source recipe states no such modifier on the ingredient line. Do NOT use this field for the ingredient name, brand, supplier, or general commentary. Keep it short — at most 80 characters.',
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
  '- When an ingredient is given as a COUNT of a food rather than a mass (e.g. "1 onion", "½ medium zucchini", "2 cloves garlic", "1 medium tomato", and the German equivalents "1 Zwiebel", "½ mittelgroße Zucchini", "2 Zehen Knoblauch", "1 Dose Kichererbsen"), populate pieceAmount, pieceUnitLabel, and gramsPerPiece with your best estimate of a typical piece weight in grams. Always also populate amount and unit with the resulting total weight (amount = pieceAmount * gramsPerPiece, unit = "g"). Use unit = "ml" only when the recipe explicitly frames the piece as a liquid quantity (e.g. "juice of 1 lemon").',
  '- A SIZE ADJECTIVE in front of a countable food ("mittelgroße", "große", "kleine", "medium", "large", "small") is NOT a unit — it is a hint for your gram estimate. The food noun is the count; the adjective only tunes gramsPerPiece. "½ mittelgroße Zucchini" → pieceAmount 0.5, pieceUnitLabel "Zucchini", gramsPerPiece ≈ 200, amount 100, unit "g". NEVER place a size adjective in rawDisplayUnitLabel, and NEVER leave a counted food without a gram estimate.',
  '- When the recipe is already given by mass directly (e.g. "200 g flour"), omit the piece fields.',
  '- rawDisplayAmount/rawDisplayUnitLabel are ONLY for MEASURING units that are not counts and fall outside the canonical enum — spoons, pinches, splashes and the like (e.g. "1 TL Salz", "2 EL Olivenöl", "Prise Pfeffer", "Schuss Zitronensaft", "Salz n. Geschmack"). Populate them with the literal numeric amount and textual unit as written in the original language. Still attempt to populate amount and unit with a sensible canonical conversion if obvious, but never guess if the conversion is uncertain — omit amount/unit in that case. Do NOT route a counted food or a size-described piece through these fields — those take the piece fields above.',
  '- When the recipe states no quantity at all for an ingredient ("Salz n. Geschmack"), you MAY populate rawDisplayUnitLabel alone with the qualitative phrase and omit rawDisplayAmount, amount, and unit.',
  'Worked examples — piece path (counted foods, incl. size-described): "½ mittelgroße Zucchini" → {name:"Zucchini", pieceAmount:0.5, pieceUnitLabel:"Zucchini", gramsPerPiece:200, amount:100, unit:"g"}; "¼ mittelgroße rote Zwiebel" → {name:"rote Zwiebel", pieceAmount:0.25, pieceUnitLabel:"Zwiebel", gramsPerPiece:120, amount:30, unit:"g"}; "1 Zehe Knoblauch" → {name:"Knoblauch", pieceAmount:1, pieceUnitLabel:"Zehe", gramsPerPiece:5, amount:5, unit:"g"}. Raw-display path (measuring units only): "2 EL Olivenöl" → {name:"Olivenöl", rawDisplayAmount:2, rawDisplayUnitLabel:"EL"}.',
  'Keep the original language for names and steps.',
  'Naming rules:',
  '- The ingredient name field is the food noun only. Preparation, cut, and quality modifiers (e.g. "fein gehackt", "geschält", "in Scheiben", "frisch gewolft") MUST NOT appear in name; populate the ingredient\'s `note` field with that modifier instead.',
  '- Leading adjectives that change the food itself (e.g. "Zuckerfreier Ahornsirup", "Geräucherter Lachs", "Gemahlener Zimt", "getrocknete Tomaten in Öl") MUST be preserved on name — they affect the nutrition profile and do not belong in `note`. "getrocknete Tomaten in Öl" is a different food from fresh "Tomaten"; keep the full phrase as the name.',
  '- pieceUnitLabel is a bare count noun only (e.g. "Stück", "Scheibe", "Zehe", "Dose"). NEVER put the food name or a quality/prep modifier in pieceUnitLabel — e.g. "getrocknet in Öl" is not a piece unit; it stays on the name.',
  '- The `note` field is for the inline prep/cut/quality modifier only. Omit `note` when the source recipe states no such modifier on the ingredient line. Do NOT duplicate a prep modifier into `steps` once it is on the ingredient `note`; `steps` carries the cooking process.',
].join(' ');

interface RawToolInputIngredient {
  name?: unknown;
  amount?: unknown;
  unit?: unknown;
  pieceAmount?: unknown;
  pieceUnitLabel?: unknown;
  gramsPerPiece?: unknown;
  rawDisplayAmount?: unknown;
  rawDisplayUnitLabel?: unknown;
  note?: unknown;
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
): { pieceQuantity?: PieceQuantity; resolvedAmount?: number; resolvedUnit?: MeasurementUnit } {
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

  // A count is always a mass: gramsPerPiece is the source of truth, so trust the piece
  // estimate even when the model omitted the unit or labelled it 'piece' (validation has
  // already dropped that to undefined). Only an explicit liquid piece resolves to ml.
  // An explicit *measuring* unit (oz/cup/tbsp/tsp) contradicts a piece count, so we keep
  // the legacy drop for those.
  if (unit !== undefined && unit !== 'g' && unit !== 'ml') return {};
  const resolvedUnit: MeasurementUnit = unit === 'ml' ? 'ml' : 'g';

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
    resolvedUnit,
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
      result.unit = piece.resolvedUnit;
    } else {
      if (amount !== undefined) result.amount = amount;
      if (unit !== undefined) result.unit = unit;
    }

    if (typeof ing.rawDisplayAmount === 'number' && Number.isFinite(ing.rawDisplayAmount)) {
      result.rawDisplayAmount = ing.rawDisplayAmount;
    }
    if (typeof ing.rawDisplayUnitLabel === 'string') {
      const trimmed = ing.rawDisplayUnitLabel.trim();
      if (trimmed.length > 0) result.rawDisplayUnitLabel = trimmed;
    }
    if (typeof ing.note === 'string') {
      const trimmed = ing.note.trim();
      if (trimmed.length > 0 && trimmed.length <= NOTE_MAX_LENGTH) {
        result.note = trimmed;
      }
    }
    return result;
  });

  const steps: string[] = raw.steps
    .filter((s): s is string => typeof s === 'string')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  return { name: raw.name.trim(), yield: recipeYield, ingredients, steps };
}
