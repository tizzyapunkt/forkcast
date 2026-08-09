/** German romanisation applied before diacritics are stripped, so `Möhre` slugs to `moehre`, not `mohre`. */
const ROMANISATION: [RegExp, string][] = [
  [/ä/g, 'ae'],
  [/ö/g, 'oe'],
  [/ü/g, 'ue'],
  [/ß/g, 'ss'],
];

/**
 * Derive a catalog entry's `id` from its canonical name: lowercase ASCII
 * kebab-case, German umlauts romanised. Returns `''` when the name has no
 * sluggable characters — callers reject that rather than inventing an id.
 */
export function slugifyName(name: string): string {
  let s = name.toLowerCase();
  for (const [pattern, replacement] of ROMANISATION) s = s.replace(pattern, replacement);
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
