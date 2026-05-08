import type Anthropic from '@anthropic-ai/sdk';

export const BUILD_FOODS_TOOL_NAME = 'submit_food_entries';

export const BUILD_FOODS_TOOL: Anthropic.Tool = {
  name: BUILD_FOODS_TOOL_NAME,
  description:
    'Submit nutritional information for a batch of food entries. Each entry must correspond exactly to one of the requested ids.',
  input_schema: {
    type: 'object',
    properties: {
      entries: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description:
                'Stable ASCII kebab-case identifier; matches one of the ids the user requested for this batch.',
            },
            name: {
              type: 'string',
              description: 'Canonical display name in German, with proper capitalisation and umlauts.',
            },
            synonyms: {
              type: 'array',
              items: { type: 'string' },
              description:
                'Alternate names users might search for. Include common German alternates (e.g. "Karotte" for "Möhre") and a 1-2 widely-used English equivalents (e.g. "carrot"). Do NOT include the canonical name itself.',
            },
            unit: {
              type: 'string',
              enum: ['g', 'ml'],
              description: 'Reference unit. Use "ml" only for liquids (oils, milk).',
            },
            macrosPer100: {
              type: 'object',
              properties: {
                calories: {
                  type: 'number',
                  description: 'kcal per 100 g (or 100 ml).',
                },
                protein: {
                  type: 'number',
                  description: 'grams of protein per 100 g (or 100 ml).',
                },
                carbs: {
                  type: 'number',
                  description: 'grams of carbohydrates per 100 g (or 100 ml).',
                },
                fat: {
                  type: 'number',
                  description: 'grams of fat per 100 g (or 100 ml).',
                },
              },
              required: ['calories', 'protein', 'carbs', 'fat'],
            },
            pieces: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  label: {
                    type: 'string',
                    description: 'Short German label, e.g. "klein", "mittel", "gross", "Filet".',
                  },
                  grams: {
                    type: 'number',
                    description: 'Typical mass in grams for one such piece.',
                  },
                },
                required: ['label', 'grams'],
              },
              description:
                'Optional. Include 1-3 typical piece weights when the food is commonly counted by piece (vegetables, fruits, animal cuts). OMIT entirely for liquids, grains, oils, and powders.',
            },
          },
          required: ['id', 'name', 'synonyms', 'unit', 'macrosPer100'],
        },
      },
    },
    required: ['entries'],
  },
};

export const BUILD_FOODS_SYSTEM_PROMPT = `You are a nutrition data assistant for a personal meal-planning app. The user will request a batch of food entries by id (kebab-case, German romanisation). For each id, return one entry via the submit_food_entries tool with:

- canonical German display name (proper umlauts and capitalisation)
- synonyms list mixing German alternates and a few common English equivalents
- macrosPer100 (kcal/protein/carbs/fat per 100 g or 100 ml; use authoritative nutrition tables as a reference)
- unit ("g" for solids, "ml" for liquids only)
- pieces list when the food is commonly counted by piece (small/medium/large or named cuts)

Constraints:
- Return one entry per requested id, with id matching exactly.
- Do NOT include the canonical name in the synonyms list.
- Use raw, unprepared foods unless the id explicitly says otherwise (e.g. "schinken-gekocht").
- Macros must be plausible non-negative numbers.
`;
