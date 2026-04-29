import type { BlsIndexedEntry } from '../bls/types.ts';

const BOUNDARY_CHARS = ' \t\n,()/-';

const DE_SCORES = {
  exact: 100,
  wholeWord: 80,
  prefix: 60,
  tokenStart: 40,
  substring: 20,
};
const EN_SCORES = {
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
  scores: {
    exact: number;
    wholeWord: number;
    prefix: number;
    tokenStart: number;
    substring: number;
  },
): number {
  if (name.length === 0 || query.length === 0) return 0;
  const idx = name.indexOf(query);
  if (idx === -1) return 0;

  if (name === query) return scores.exact;

  // Find every occurrence; compute the best tier across all.
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

export function scoreBlsMatch(entry: BlsIndexedEntry, foldedQuery: string): number {
  const de = scoreName(entry.name_de_folded, foldedQuery, DE_SCORES);
  const en = scoreName(entry.name_en_folded, foldedQuery, EN_SCORES);
  return de >= en ? de : en;
}
