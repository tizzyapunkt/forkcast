/**
 * The single tool schema and guidance for having the model draft a catalog food
 * entry. Shared by the import resolve flow (which drafts entries as one verdict
 * among several) and the catalog manager's fill action (which drafts exactly
 * one), so the two entry points cannot drift apart.
 */
export const FOOD_ENTRY_SCHEMA = {
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

/** The entry-quality rules both drafting prompts state, so a drafted entry looks the same either way. */
export const FOOD_ENTRY_GUIDANCE = `Entry rules:
- Canonical German display name with proper umlauts and capitalisation; the synonyms list mixes German alternates and 1-2 common English equivalents and MUST NOT repeat the canonical name.
- macrosPer100 are per 100 g (or 100 ml) from authoritative nutrition tables, as plausible non-negative numbers. Use the raw, unprepared food unless the name says otherwise.
- unit is "g" for solids and "ml" for liquids only.
- pieces: 1-3 typical piece weights when the food is commonly counted by piece (vegetables, fruits, cuts of meat); omit for liquids, grains, oils, and powders.
- untracked: true ONLY for seasonings, herbs, and spices used in tiny amounts that should not count toward nutrition (Salz, Pfeffer, Sumach, Muskatnuss, …). An untracked entry MUST have every macrosPer100 value set to exactly 0. Omit the field for tracked foods.
- density (g/ml): only for g-unit dry staples that recipes measure by spoon (Speisestärke ≈ 0.55, Mehl ≈ 0.55, Zucker ≈ 0.85), so spoon amounts convert to grams.`;
