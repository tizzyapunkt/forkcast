import type { ExtractedProduct } from '../../domain/barcode-product-capture/types.ts';

export const EXTRACT_PRODUCT_TOOL_NAME = 'extract_product';

export const EXTRACT_PRODUCT_TOOL = {
  name: EXTRACT_PRODUCT_TOOL_NAME,
  description:
    'Extract a single packaged food product from one or more photos of its packaging (front for the name, back for the nutrition table).',
  input_schema: {
    type: 'object' as const,
    required: ['name', 'unit', 'calories', 'protein', 'carbs', 'fat'],
    properties: {
      name: {
        type: 'string',
        description:
          'The product name as printed on the front of the package, in the original language (e.g. "Himbeer-Heidelbeer-Mix"). The food/product name only — not the brand slogan, marketing claims, or net weight.',
      },
      unit: {
        type: 'string',
        enum: ['g', 'ml'],
        description:
          'The base unit of the nutrition table\'s per-100 column: "g" for solids ("pro 100 g"), "ml" for liquids ("pro 100 ml").',
      },
      calories: {
        type: 'number',
        description:
          'Energy in kilocalories (kcal) per 100 g/ml, read from the per-100 column. If the table shows only kilojoules (kJ), convert with kcal = kJ / 4.184.',
      },
      protein: {
        type: 'number',
        description: 'Protein (Eiweiß) in grams per 100 g/ml, from the per-100 column.',
      },
      carbs: {
        type: 'number',
        description: 'Carbohydrates (Kohlenhydrate) in grams per 100 g/ml, from the per-100 column.',
      },
      fat: {
        type: 'number',
        description: 'Fat (Fett) in grams per 100 g/ml, from the per-100 column.',
      },
    },
  },
};

export const EXTRACT_PRODUCT_INSTRUCTIONS = [
  'You will receive one or more photos of the packaging of a single food product. They may show the front (with the product name) and the back (with the nutrition table). Interpret them together as one product.',
  'Use the extract_product tool to return the result.',
  'Reading rules:',
  '- Read the product name from the front of the package, in the original language. Use the food/product name, not the brand slogan or the net weight.',
  '- Transcribe the nutrition values exactly as printed in the per-100 column ("pro 100 g" or "pro 100 ml"). Do NOT use the per-portion column.',
  '- Set unit to "g" when the column is per 100 g, "ml" when it is per 100 ml.',
  '- Energy must be in kcal. If only kJ is shown, convert with kcal = kJ / 4.184.',
  '- Decimal separators may be commas in the original language ("0,7" means 0.7) — return numeric values with a dot.',
  '- Never invent values. Transcribe only what is legible on the packaging.',
].join(' ');

function toFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/**
 * Validates the `extract_product` tool output: a non-empty name, a `g`/`ml`
 * unit, a finite non-negative `calories`, and finite non-negative
 * protein/carbs/fat (defaulting to 0 only when the model omits them).
 */
export function parseProductToolInput(input: unknown): ExtractedProduct {
  if (!input || typeof input !== 'object') {
    throw new Error('Tool input is not an object');
  }
  const raw = input as Record<string, unknown>;

  if (typeof raw.name !== 'string' || raw.name.trim().length === 0) {
    throw new Error('Tool input is missing a product name');
  }
  if (raw.unit !== 'g' && raw.unit !== 'ml') {
    throw new Error('Tool input unit must be "g" or "ml"');
  }

  const calories = toFiniteNumber(raw.calories);
  if (calories === undefined || calories < 0) {
    throw new Error('Tool input calories must be a finite non-negative number');
  }

  const macro = (key: 'protein' | 'carbs' | 'fat'): number => {
    if (raw[key] === undefined || raw[key] === null) return 0;
    const n = toFiniteNumber(raw[key]);
    if (n === undefined || n < 0) {
      throw new Error(`Tool input ${key} must be a finite non-negative number`);
    }
    return n;
  };

  return {
    name: raw.name.trim(),
    unit: raw.unit,
    macrosPer100: {
      calories,
      protein: macro('protein'),
      carbs: macro('carbs'),
      fat: macro('fat'),
    },
  };
}
