import { fold } from '../../lib/fold';

/** Leading/trailing punctuation, so `Reisnudeln,` compares (and reads) as `Reisnudeln`. */
const EDGE_PUNCTUATION = /^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu;

function tokenize(name: string): string[] {
  return name
    .split(/\s+/)
    .map((t) => t.replace(EDGE_PUNCTUATION, ''))
    .filter((t) => t.length > 0);
}

/**
 * The words a rename dropped from the raw ingredient name — `dünne` for
 * `dünne Reisnudeln` saved as `Reisnudeln`. Recipe-specific qualifiers belong on
 * the recipe row rather than in the catalog, so the sheet offers this as the
 * row's note.
 *
 * Only a *narrowing* qualifies: every word of the canonical name must still be
 * present in the raw name. A rename that swaps the food (`Glasnudeln`) is a
 * replacement, and the old wording is not a note about the new food.
 */
export function droppedQualifier(rawName: string, canonicalName: string): string {
  const rawTokens = tokenize(rawName);
  const rawFolded = new Set(rawTokens.map(fold));
  const canonicalTokens = tokenize(canonicalName);
  if (canonicalTokens.length === 0) return '';
  if (!canonicalTokens.every((t) => rawFolded.has(fold(t)))) return '';

  const kept = new Set(canonicalTokens.map(fold));
  return rawTokens.filter((t) => !kept.has(fold(t))).join(' ');
}
