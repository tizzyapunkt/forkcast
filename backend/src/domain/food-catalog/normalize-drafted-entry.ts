import type { FoodEntry } from '../foods/types.ts';
import { fold } from '../ingredient-search/fold.ts';
import { slugifyName } from './slugify-name.ts';

const ZERO_MACROS = { calories: 0, protein: 0, carbs: 0, fat: 0 };

/**
 * Shape a model-drafted entry into the entry the rest of the app expects, before
 * it is validated: the id is derived from the canonical name rather than trusted,
 * an omitted synonyms list reads as none, aliases that only repeat the canonical
 * name (or each other) are dropped, and an untracked entry's macros are zeroed —
 * "untracked but with macros" is the model's most common slip and the entry is
 * otherwise fine. Everything else is left alone for validation to judge.
 */
export function normalizeDraftedEntry(drafted: Partial<FoodEntry>): FoodEntry {
  const name = typeof drafted.name === 'string' ? drafted.name : '';
  const seen = new Set<string>([fold(name)]);
  const synonyms = (Array.isArray(drafted.synonyms) ? drafted.synonyms : []).filter((s) => {
    if (typeof s !== 'string') return true; // let validation report the real problem
    const folded = fold(s);
    if (seen.has(folded)) return false;
    seen.add(folded);
    return true;
  });

  const entry = { ...(drafted as FoodEntry), id: slugifyName(name), synonyms };
  return entry.untracked === true ? { ...entry, macrosPer100: { ...ZERO_MACROS } } : entry;
}
