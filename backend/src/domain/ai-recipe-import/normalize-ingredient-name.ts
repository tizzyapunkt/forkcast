/**
 * Strip trailing prep/quality modifiers so an ingredient name produced by the vision LLM
 * can be matched against the curated FOODS catalog.
 *
 * The strip is narrow on purpose: only TRAILING `, ...` clauses and TRAILING `(...)` parentheticals
 * are removed. Leading adjectives (e.g. "Zuckerfreier Ahornsirup", "Geräucherter Lachs") are kept,
 * because they often change the food's nutrition profile or identity and must not be silently
 * normalized into a different entry.
 *
 * If the strip would produce an empty string, the original (trimmed) name is returned.
 */
export function normalizeIngredientName(input: string): string {
  const original = input.trim();
  if (original.length === 0) return original;

  let working = original;
  // Strip a single trailing parenthetical, e.g. "Olivenöl (extra vergine)".
  working = working.replace(/\s*\([^()]*\)\s*$/u, '').trim();
  // Strip a single trailing ", <anything>" clause.
  const commaIdx = working.indexOf(',');
  if (commaIdx > 0) {
    working = working.slice(0, commaIdx).trim();
  }

  // Collapse internal whitespace.
  working = working.replace(/\s+/gu, ' ').trim();

  if (working.length === 0) return original;
  return working;
}
