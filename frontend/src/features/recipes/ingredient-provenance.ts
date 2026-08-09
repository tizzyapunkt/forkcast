import type { IngredientMatchProvenance, RawIngredientProvenance } from '../../domain/recipes';
import { de } from '../../i18n/de';

const p = de.recipeIngredientEditor.provenance;

/**
 * What the model read for this row, as one short line: the extracted name with its amount and
 * unit when present. Falls back to the raw display quantity ("1 Prise") for qualitative rows,
 * which is what the model saw when it returned no numeric amount.
 */
export function formatRawIngredient(raw: RawIngredientProvenance): string {
  const parts: string[] = [];
  if (raw.amount !== undefined) {
    parts.push(String(raw.amount));
    if (raw.unit !== undefined) parts.push(raw.unit);
  } else if (raw.rawDisplayUnitLabel !== undefined) {
    if (raw.rawDisplayAmount !== undefined) parts.push(String(raw.rawDisplayAmount));
    parts.push(raw.rawDisplayUnitLabel);
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
