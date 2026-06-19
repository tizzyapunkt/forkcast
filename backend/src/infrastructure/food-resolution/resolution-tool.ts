import type Anthropic from '@anthropic-ai/sdk';

export const PROPOSE_RESOLUTIONS_TOOL_NAME = 'propose_resolutions';

const FOOD_ENTRY_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'Stable ASCII kebab-case id (German romanisation: ä→ae, ö→oe, ü→ue, ß→ss).' },
    name: { type: 'string', description: 'Canonical German display name with proper umlauts and capitalisation.' },
    synonyms: {
      type: 'array',
      items: { type: 'string' },
      description: 'Alternate names (German + 1-2 English). MUST NOT include the canonical name.',
    },
    unit: { type: 'string', enum: ['g', 'ml'], description: 'Reference unit. "ml" only for liquids.' },
    macrosPer100: {
      type: 'object',
      properties: {
        calories: { type: 'number' },
        protein: { type: 'number' },
        carbs: { type: 'number' },
        fat: { type: 'number' },
      },
      required: ['calories', 'protein', 'carbs', 'fat'],
    },
    pieces: {
      type: 'array',
      items: {
        type: 'object',
        properties: { label: { type: 'string' }, grams: { type: 'number' } },
        required: ['label', 'grams'],
      },
      description: 'Optional. 1-3 typical piece weights when commonly counted by piece. Omit for liquids/powders.',
    },
    untracked: {
      type: 'boolean',
      description:
        'Optional. true ONLY for seasonings/herbs/spices that should not count toward nutrition; then macrosPer100 MUST be all zeros.',
    },
    density: {
      type: 'number',
      description:
        'Optional. Mass per millilitre (g/ml). Include ONLY for g-unit dry staples commonly measured by spoon (e.g. Speisestärke ≈ 0.55, flour ≈ 0.55, sugar ≈ 0.85) so spoon amounts convert to grams. Omit for liquids and non-spoon foods.',
    },
  },
  required: ['id', 'name', 'synonyms', 'unit', 'macrosPer100'],
} as const;

export const PROPOSE_RESOLUTIONS_TOOL: Anthropic.Tool = {
  name: PROPOSE_RESOLUTIONS_TOOL_NAME,
  description:
    'Return exactly one resolution proposal per requested unmatched ingredient, in the same order, addressed by its zero-based index.',
  input_schema: {
    type: 'object',
    properties: {
      proposals: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            index: { type: 'number', description: 'Zero-based index of the unmatched item this proposal answers.' },
            verdict: {
              type: 'string',
              enum: ['synonym-of', 'new-food', 'skip'],
              description:
                '"synonym-of" when the name is a clear alternate of one of the provided candidates. "new-food" when it is a distinct food not among the candidates. "skip" only when truly ambiguous, garbled, or non-food.',
            },
            confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
            foodId: {
              type: 'string',
              description: 'REQUIRED for synonym-of: the id of the matching candidate. Forbidden otherwise.',
            },
            synonym: {
              type: 'string',
              description: 'REQUIRED for synonym-of: the unmatched name to learn as an alias. Forbidden otherwise.',
            },
            entry: {
              ...FOOD_ENTRY_SCHEMA,
              description: 'REQUIRED for new-food: the full food entry. Forbidden otherwise.',
            },
            reason: { type: 'string', description: 'REQUIRED for skip: one short sentence. Forbidden otherwise.' },
          },
          required: ['index', 'verdict', 'confidence'],
        },
      },
    },
    required: ['proposals'],
  },
};

export const PROPOSE_RESOLUTIONS_SYSTEM_PROMPT = `You resolve ingredient names that did not match a personal nutrition catalog during recipe import. For each unmatched item you are given its name, an optional preparation note, and a short list of catalog candidates (id, name, per-100 macros). Return exactly one proposal per item via the propose_resolutions tool, addressed by the item's zero-based index.

For each item pick one verdict:
- "synonym-of": the name is a clear alternate of one of the provided candidates (plural, alternate spelling, single-language translation, or a qualifier that does not change the food's identity/nutrition). Set foodId to that candidate's id and synonym to the unmatched name. PREFER this over new-food whenever a candidate plausibly fits — synonyms keep the catalog small.
- "new-food": the item is a distinct food not represented by any candidate. Provide a complete entry (canonical German name, synonyms, unit, macrosPer100 from authoritative nutrition tables, optional pieces, optional untracked). The preparation note is nutritionally load-bearing — "Tomaten, getrocknet in Öl" is oil-packed dried tomatoes (~10x the calories of fresh), not fresh tomatoes; reflect the note in the name and macros.
- "skip": only when the name is genuinely ambiguous, garbled, or not a food.

Untracked ingredients: if the item is a seasoning, herb, spice, or similar that is used in tiny amounts and should NOT count toward nutrition (e.g. Salz, Pfeffer, Sumach, Za'atar, Ras el Hanout, Muskatnuss, Vanilleschote, Lebkuchengewürz), set untracked: true on the new-food entry AND set every macrosPer100 value (calories, protein, carbs, fat) to exactly 0. For a tracked food, omit untracked and give real macros. When the item is a synonym of an untracked candidate (candidates marked ", untracked"), prefer synonym-of so it inherits the untracked status.

Always give an honest confidence (high/medium/low). Use the original recipe language for names and notes. macrosPer100 values must be plausible non-negative numbers; for untracked entries they are all 0.`;
