import type { FoodIndexedEntry } from '../foods/types.ts';

const BOUNDARY_CHARS = ' \t\n,()/-';

const CANONICAL_SCORES = {
  exact: 100,
  wholeWord: 80,
  prefix: 60,
  tokenStart: 40,
  substring: 20,
};
const SYNONYM_SCORES = {
  exact: 90,
  wholeWord: 70,
  prefix: 50,
  tokenStart: 30,
  substring: 10,
};

function isBoundary(ch: string | undefined): boolean {
  return ch === undefined || BOUNDARY_CHARS.includes(ch);
}

function scoreName(
  name: string,
  query: string,
  scores: { exact: number; wholeWord: number; prefix: number; tokenStart: number; substring: number },
): number {
  if (name.length === 0 || query.length === 0) return 0;
  const idx = name.indexOf(query);
  if (idx === -1) return 0;

  if (name === query) return scores.exact;

  let best = scores.substring;
  let pos = idx;
  while (pos !== -1) {
    const before = pos === 0 ? undefined : name[pos - 1];
    const afterIdx = pos + query.length;
    const after = afterIdx >= name.length ? undefined : name[afterIdx];
    const boundaryBefore = isBoundary(before);
    const boundaryAfter = isBoundary(after);

    let tier: number;
    if (boundaryBefore && boundaryAfter) tier = scores.wholeWord;
    else if (pos === 0) tier = scores.prefix;
    else if (boundaryBefore) tier = scores.tokenStart;
    else tier = scores.substring;

    if (tier > best) best = tier;
    if (best === scores.wholeWord) break;
    pos = name.indexOf(query, pos + 1);
  }
  return best;
}

/**
 * Whole-word match in the *opposite* direction: does `name` appear as a
 * boundary-delimited token inside `query`? Used to score recipe-importer
 * queries like "Kichererbsen (aus der Dose, abgetropft)" against canonical
 * "Kichererbsen". Only the whole-word tier is mirrored — looser tiers
 * (prefix/token-start/substring of query) are too noisy for short canonicals.
 */
function scoreNameInQuery(name: string, query: string, wholeWordScore: number): number {
  if (name.length === 0 || query.length === 0) return 0;
  if (name === query) return 0; // already covered by scoreName's exact tier
  if (name.length >= query.length) return 0;
  let pos = query.indexOf(name);
  while (pos !== -1) {
    const before = pos === 0 ? undefined : query[pos - 1];
    const afterIdx = pos + name.length;
    const after = afterIdx >= query.length ? undefined : query[afterIdx];
    if (isBoundary(before) && isBoundary(after)) return wholeWordScore;
    pos = query.indexOf(name, pos + 1);
  }
  return 0;
}

export function scoreFoodMatch(entry: FoodIndexedEntry, foldedQuery: string): number {
  let best = scoreName(entry.nameFolded, foldedQuery, CANONICAL_SCORES);
  const reverseCanonical = scoreNameInQuery(entry.nameFolded, foldedQuery, CANONICAL_SCORES.wholeWord);
  if (reverseCanonical > best) best = reverseCanonical;
  for (const syn of entry.synonymsFolded) {
    const s = scoreName(syn, foldedQuery, SYNONYM_SCORES);
    if (s > best) best = s;
    const sr = scoreNameInQuery(syn, foldedQuery, SYNONYM_SCORES.wholeWord);
    if (sr > best) best = sr;
  }
  return best;
}
