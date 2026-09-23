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

/**
 * Endings that turn a word into another form of the same food (Kichererbse → Kichererbsen,
 * Ei → Eier, Möhre → Möhren). Anything longer after a prefix hit is a new compound element
 * (Honig → Honigmelone, Reis → Reisnudeln) and makes the hit only partial.
 */
const INFLECTION_ENDINGS = new Set(['n', 'e', 'en', 's', 'es', 'er']);

export interface FoodMatch {
  /** Ranking score by tier — unchanged by confidence. */
  score: number;
  /**
   * The hit is safe to auto-accept: exact, a whole word not glued on as a compound modifier, or a
   * word start plus only an inflection ending. German compounds put the food last, so a hit that
   * only covers a modifier ("Honig" in "Honigmelone", "butter-" in "Peanut-butter-Pulver") is not.
   */
  confident: boolean;
}

const NO_MATCH: FoodMatch = { score: 0, confident: false };

function isBoundary(ch: string | undefined): boolean {
  return ch === undefined || BOUNDARY_CHARS.includes(ch);
}

/** The rest of the word in `text` that starts at `from`, up to the next boundary. */
function restOfWord(text: string, from: number): string {
  let end = from;
  while (end < text.length && !isBoundary(text[end])) end += 1;
  return text.slice(from, end);
}

function better(a: FoodMatch, b: FoodMatch): FoodMatch {
  return { score: Math.max(a.score, b.score), confident: a.confident || b.confident };
}

function matchName(
  name: string,
  query: string,
  scores: { exact: number; wholeWord: number; prefix: number; tokenStart: number; substring: number },
): FoodMatch {
  if (name.length === 0 || query.length === 0) return NO_MATCH;
  const idx = name.indexOf(query);
  if (idx === -1) return NO_MATCH;

  if (name === query) return { score: scores.exact, confident: true };

  let best = scores.substring;
  let confident = false;
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

    if (boundaryBefore) {
      // A whole word counts unless a hyphen glues it on as a modifier; a word start counts when
      // only an inflection ending follows it.
      if (boundaryAfter) confident ||= after !== '-';
      else confident ||= INFLECTION_ENDINGS.has(restOfWord(name, afterIdx));
    }

    if (tier > best) best = tier;
    if (best === scores.wholeWord && confident) break;
    pos = name.indexOf(query, pos + 1);
  }
  return { score: best, confident };
}

/**
 * Whole-word match in the *opposite* direction: does `name` appear as a
 * boundary-delimited token inside `query`? Used to score recipe-importer
 * queries like "Kichererbsen (aus der Dose, abgetropft)" against canonical
 * "Kichererbsen". Only the whole-word tier is mirrored — looser tiers
 * (prefix/token-start/substring of query) are too noisy for short canonicals.
 * The token is confident unless a hyphen follows it ("Peanut-butter-Pulver" is not "Butter").
 */
function matchNameInQuery(name: string, query: string, wholeWordScore: number): FoodMatch {
  if (name.length === 0 || query.length === 0) return NO_MATCH;
  if (name === query) return NO_MATCH; // already covered by matchName's exact tier
  if (name.length >= query.length) return NO_MATCH;
  let found = false;
  let pos = query.indexOf(name);
  while (pos !== -1) {
    const before = pos === 0 ? undefined : query[pos - 1];
    const afterIdx = pos + name.length;
    const after = afterIdx >= query.length ? undefined : query[afterIdx];
    if (isBoundary(before) && isBoundary(after)) {
      if (after !== '-') return { score: wholeWordScore, confident: true };
      found = true;
    }
    pos = query.indexOf(name, pos + 1);
  }
  return found ? { score: wholeWordScore, confident: false } : NO_MATCH;
}

/** Score an entry against a folded query for ranking, and say whether the hit is safe to auto-accept. */
export function matchFoodEntry(
  entry: Pick<FoodIndexedEntry, 'nameFolded' | 'synonymsFolded'>,
  foldedQuery: string,
): FoodMatch {
  let best = matchName(entry.nameFolded, foldedQuery, CANONICAL_SCORES);
  best = better(best, matchNameInQuery(entry.nameFolded, foldedQuery, CANONICAL_SCORES.wholeWord));
  for (const syn of entry.synonymsFolded) {
    best = better(best, matchName(syn, foldedQuery, SYNONYM_SCORES));
    best = better(best, matchNameInQuery(syn, foldedQuery, SYNONYM_SCORES.wholeWord));
  }
  return best;
}

export function scoreFoodMatch(
  entry: Pick<FoodIndexedEntry, 'nameFolded' | 'synonymsFolded'>,
  foldedQuery: string,
): number {
  return matchFoodEntry(entry, foldedQuery).score;
}
