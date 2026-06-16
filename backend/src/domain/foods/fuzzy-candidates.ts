import { fold } from '../ingredient-search/fold.ts';
import type { FoodIndexedEntry } from './types.ts';

const TOKEN_SPLIT = /[\s,()/-]+/;
const MIN_PREFIX = 4;

/** Split folded text into word tokens on whitespace and common separators. */
export function tokenize(foldedText: string): string[] {
  return foldedText.split(TOKEN_SPLIT).filter((t) => t.length > 0);
}

function commonPrefixLen(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i += 1;
  return i;
}

/**
 * Whether the shorter of two tokens (≥ MIN_PREFIX chars) sits at a word boundary
 * of the longer — i.e. the longer one starts or ends with it. Catches German
 * head-final compounds ("meersalz" ⊃ "salz", "kirschtomaten" ⊃ "tomaten") and
 * head-initial ones ("apfelmus" ⊃ "apfel") while rejecting mid-word coincidences
 * ("preiselbeere" does NOT match "reis", since "reis" is neither prefix nor suffix).
 */
function boundaryContains(a: string, b: string): boolean {
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (short.length < MIN_PREFIX || short.length === long.length) return false;
  return long.startsWith(short) || long.endsWith(short);
}

/**
 * A deliberately looser score than the strict substring matcher used for
 * auto-matching: it rewards shared and near-identical word tokens (e.g.
 * singular/plural "Olive"↔"Oliven", or a shared word in a multi-word name)
 * between the query and an entry's name + synonyms. Used only to surface
 * candidates for the AI resolution proposer so it can recognise a synonym the
 * strict search missed — never to auto-match an ingredient.
 */
export function scoreFuzzyCandidate(entry: FoodIndexedEntry, queryTokens: string[]): number {
  const entryTokens = [entry.nameFolded, ...entry.synonymsFolded].flatMap(tokenize);
  let score = 0;
  for (const qt of queryTokens) {
    let best = 0;
    for (const et of entryTokens) {
      if (qt === et) {
        best = Math.max(best, 10);
        continue;
      }
      const cp = commonPrefixLen(qt, et);
      if (cp >= MIN_PREFIX) {
        // Near-identical (one extra/missing trailing char, i.e. plural) scores higher than a mere shared stem.
        const near = cp >= Math.min(qt.length, et.length) - 1;
        best = Math.max(best, near ? 7 : 4);
      }
      // Boundary containment for compounds (e.g. "Meersalz" ⊃ "Salz", "Kirschtomaten" ⊃ "Tomaten").
      if (boundaryContains(qt, et)) {
        best = Math.max(best, 5);
      }
    }
    score += best;
  }
  return score;
}

/** Rank indexed entries by fuzzy token overlap with `query`; returns the top `limit` with score > 0. */
export function rankFuzzyCandidates(
  entries: ReadonlyArray<FoodIndexedEntry>,
  query: string,
  limit: number,
): FoodIndexedEntry[] {
  const queryTokens = tokenize(fold(query.trim()));
  if (queryTokens.length === 0) return [];
  const scored: { entry: FoodIndexedEntry; score: number }[] = [];
  for (const entry of entries) {
    const score = scoreFuzzyCandidate(entry, queryTokens);
    if (score > 0) scored.push({ entry, score });
  }
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.entry.name.length !== b.entry.name.length) return a.entry.name.length - b.entry.name.length;
    return a.entry.name.localeCompare(b.entry.name);
  });
  return scored.slice(0, limit).map((s) => s.entry);
}
