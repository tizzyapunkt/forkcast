import type { IngredientMatchProvenance, RawIngredientProvenance } from '../../domain/recipes';
import { de } from '../../i18n/de';
import { fold } from '../../lib/fold';
import { formatPieceCount } from './scale-ingredient';

const p = de.recipeIngredientEditor.provenance;

/**
 * What the model read for this row, as one short line. The verbatim transcription wins; without
 * it the line is rebuilt in the recipe's own framing — the count ("1 Zwiebel"), then the literal
 * display quantity ("2 EL"), then a stated mass — because a piece row's `amount` is always the
 * AI's gram estimate and a spoon row's may be its conversion, and neither was ever printed.
 */
export function formatRawIngredient(raw: RawIngredientProvenance): string {
  if (raw.sourceText !== undefined) return raw.sourceText;

  const parts: string[] = [];
  if (raw.pieceQuantity) {
    const { amount, unitLabel } = raw.pieceQuantity;
    parts.push(formatPieceCount(amount), unitLabel);
    // "1 Zwiebel", not "1 Zwiebel Zwiebel": the count noun is often the food itself.
    if (fold(unitLabel) === fold(raw.name)) return parts.join(' ');
  } else if (raw.rawDisplayUnitLabel !== undefined) {
    if (raw.rawDisplayAmount !== undefined) parts.push(String(raw.rawDisplayAmount));
    parts.push(raw.rawDisplayUnitLabel);
  } else if (raw.amount !== undefined) {
    parts.push(String(raw.amount));
    if (raw.unit !== undefined) parts.push(raw.unit);
  }
  parts.push(raw.name);
  return parts.join(' ');
}

/**
 * Why this row's match deserves a look — derived at render time from the flags the matcher
 * raised plus the candidate count. A confident single-candidate match with no flags returns
 * `null` so the marker keeps meaning.
 */
export function deriveUncertaintyMarker(entry: IngredientMatchProvenance, matchedUnit: string): string | null {
  const reasons: string[] = [];

  if (entry.flags.unitOverridden) {
    reasons.push(
      entry.raw.unit !== undefined ? p.unitReplaced(entry.raw.unit, matchedUnit) : p.unitReplacedUnknown(matchedUnit),
    );
  }
  if (entry.flags.pieceQuantityDropped) reasons.push(p.pieceQuantityDropped);
  if (entry.flags.untrackedInherited) reasons.push(p.untrackedInherited);
  if (entry.flags.missingAmount) reasons.push(p.missingAmount);
  if (entry.chosen !== null && entry.candidates.length > 1) reasons.push(p.alternatives(entry.candidates.length));

  return reasons.length > 0 ? reasons.join(p.separator) : null;
}
