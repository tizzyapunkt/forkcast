import type Anthropic from '@anthropic-ai/sdk';

export const CLASSIFY_UNMATCHED_TOOL_NAME = 'classify_unmatched_ingredient';

export const CLASSIFY_UNMATCHED_TOOL: Anthropic.Tool = {
  name: CLASSIFY_UNMATCHED_TOOL_NAME,
  description:
    'Decide whether an unmatched ingredient name is a synonym of an existing curated food entry, a brand-new food that should be added, or something to skip.',
  input_schema: {
    type: 'object',
    properties: {
      verdict: {
        type: 'string',
        enum: ['synonym-of', 'new-food', 'skip'],
        description:
          '"synonym-of" when the name is a clear alternate spelling/plural/translation of an existing entry. "new-food" when it represents a distinct food that does not yet exist. "skip" when uncertain or unhelpful.',
      },
      existingId: {
        type: 'string',
        description:
          'REQUIRED when verdict is "synonym-of". MUST exactly match one of the catalog ids the user provided in the request. Forbidden otherwise.',
      },
      confidence: {
        type: 'string',
        enum: ['high', 'medium', 'low'],
        description:
          'Subjective confidence in the chosen verdict. Use "high" for obvious calls, "low" when leaning toward a guess.',
      },
      proposedKey: {
        type: 'string',
        description:
          'REQUIRED when verdict is "new-food". Lowercase ASCII kebab-case, German romanisation (no umlauts), e.g. "buchweizenmehl". Forbidden otherwise.',
      },
      reason: {
        type: 'string',
        description:
          'REQUIRED when verdict is "skip". One short sentence explaining why this item should be skipped (e.g. "ambiguous — could be cinnamon or cassia").',
      },
    },
    required: ['verdict', 'confidence'],
  },
};

export const CLASSIFY_UNMATCHED_SYSTEM_PROMPT = `You are a triage assistant for a personal nutrition database. The user will give you one ingredient name that did not match any entry in the curated FOODS catalog, plus the full catalog (id, name, synonyms). For each request, pick exactly one of three verdicts via the classify_unmatched_ingredient tool:

- "synonym-of": the unmatched name is a clear alternate of an existing catalog entry (case-folded equal, plural, common alternate spelling, single-language translation). Set existingId to the matching catalog id. Prefer this when in doubt between synonym and new-food, since synonyms grow the catalog cheaply.
- "new-food": the unmatched name represents a food that genuinely does not exist in the catalog (e.g. "Buchweizenmehl" when no buckwheat-flour entry exists). Set proposedKey to a kebab-case ASCII identifier (German romanisation: ä→ae, ö→oe, ü→ue, ß→ss). Examples: "buchweizenmehl", "edamame", "tahini".
- "skip": only when truly ambiguous or out-of-scope (e.g. brand names, garbled text, non-food items).

Always include a confidence value: high / medium / low. Be honest about confidence — the human reviews each decision and "low" is a signal to scrutinize rather than a penalty.
`;
