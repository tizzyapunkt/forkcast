import type { IngredientMatchProvenance, RecipeDraft, RecipeIngredient } from '../../domain/recipes';

/** Provenance for one form row, or `undefined` for a row the user added after the draft loaded. */
export type RowProvenance = IngredientMatchProvenance | undefined;

/**
 * Pair each initially-matched row with its provenance entry by *draft* index — the review screen
 * drops unmatched rows into a separate panel, so a form row index is not a draft index. Resolving
 * once at load is the only moment where the correspondence is unambiguous.
 */
export function pairInitialRowProvenance(draft: RecipeDraft): RowProvenance[] {
  const entries = draft.provenance?.ingredients;
  const paired: RowProvenance[] = [];
  draft.ingredients.forEach((ing, draftIndex) => {
    if (!ing.matched) return;
    paired.push(entries?.[draftIndex]);
  });
  return paired;
}

/**
 * Carry the pairing across a row-list mutation from the ingredient editor.
 *
 * Replacements and in-place edits keep the list length, so provenance stays put — it records what
 * the model *read*, not what the user chose. Appends land with no provenance. Removals drop only
 * the removed row's entry, found by identity (the editor removes with `filter`, so every surviving
 * row keeps its object reference).
 */
export function syncRowProvenance(
  prev: readonly RecipeIngredient[],
  next: readonly RecipeIngredient[],
  provenance: readonly RowProvenance[],
): RowProvenance[] {
  if (next.length === prev.length) return provenance.slice(0, next.length);

  if (next.length > prev.length) {
    const carried = provenance.slice(0, prev.length);
    return [...carried, ...Array<RowProvenance>(next.length - prev.length).fill(undefined)];
  }

  const kept: RowProvenance[] = [];
  let cursor = 0;
  for (let i = 0; i < prev.length; i++) {
    if (cursor < next.length && next[cursor] === prev[i]) {
      kept.push(provenance[i]);
      cursor++;
    }
  }
  // Identity did not line up (an unexpected mutation shape) — drop provenance rather than mispair it.
  return kept.length === next.length ? kept : Array<RowProvenance>(next.length).fill(undefined);
}
