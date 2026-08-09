import type Anthropic from '@anthropic-ai/sdk';
import { FOOD_ENTRY_SCHEMA } from '../food-drafting/food-entry-schema.ts';

export const PROPOSE_RESOLUTIONS_TOOL_NAME = 'propose_resolutions';

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
