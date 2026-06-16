import type { IngredientResultSource } from '../ingredient-search/types.ts';
import type { MacrosPerUnit, MeasurementUnit, PieceQuantity } from '../recipes/types.ts';
import type { MatchedDraftIngredient } from './types.ts';

/** The resolved food a draft row is matched against (curated, overlay, or scanned). */
export interface MatchSourceFood {
  name: string;
  unit: MeasurementUnit;
  macrosPerUnit: MacrosPerUnit;
  untracked?: boolean;
}

/** The model-extracted (or unmatched-row) fields carried onto the matched row. */
export interface OriginalDraftFields {
  amount?: number | null;
  unit?: MeasurementUnit | null;
  pieceQuantity?: PieceQuantity;
  note?: string;
  rawDisplayAmount?: number;
  rawDisplayUnitLabel?: string;
}

export interface BuildMatchedRowFlags {
  unitOverridden: boolean;
  pieceQuantityDropped: boolean;
  untrackedInherited: boolean;
}

export interface BuildMatchedRowResult {
  row: MatchedDraftIngredient;
  flags: BuildMatchedRowFlags;
}

/**
 * Build a matched draft ingredient row from a resolved food plus the original
 * extracted/unmatched fields. Single source of truth for the post-match rules:
 * catalog unit wins (flagging `unitOverridden`), piece quantities survive only on
 * mass units, untracked is inherited and populates `displayQuantity` from raw
 * display fields, the note rides along verbatim, and an untracked row with no
 * amount persists as `0`. Shared by AI import matching and runtime confirm.
 */
export function buildMatchedRowWithFlags(
  food: MatchSourceFood,
  source: IngredientResultSource,
  raw: OriginalDraftFields,
): BuildMatchedRowResult {
  const unitOverridden = raw.unit !== undefined && raw.unit !== null && raw.unit !== food.unit;
  const matchedUnitIsMass = food.unit === 'g' || food.unit === 'ml';
  const isUntracked = food.untracked === true;
  const pieceQuantityDropped = raw.pieceQuantity !== undefined && !matchedUnitIsMass;

  const row: MatchedDraftIngredient = {
    matched: true,
    name: food.name,
    unit: food.unit,
    macrosPerUnit: food.macrosPerUnit,
    amount: raw.amount ?? null,
    unitOverridden,
    source,
  };
  if (raw.pieceQuantity && matchedUnitIsMass) row.pieceQuantity = raw.pieceQuantity;
  if (raw.note !== undefined) row.note = raw.note;
  if (isUntracked) {
    row.untracked = true;
    const rawLabel = raw.rawDisplayUnitLabel?.trim();
    if (rawLabel && rawLabel.length > 0) {
      row.displayQuantity = { amount: raw.rawDisplayAmount ?? 1, unitLabel: rawLabel };
    }
    if (row.amount === null && row.pieceQuantity === undefined) {
      row.amount = 0;
    }
  }

  return { row, flags: { unitOverridden, pieceQuantityDropped, untrackedInherited: isUntracked } };
}

/** Convenience wrapper returning just the row (the common case). */
export function buildMatchedRow(
  food: MatchSourceFood,
  source: IngredientResultSource,
  raw: OriginalDraftFields,
): MatchedDraftIngredient {
  return buildMatchedRowWithFlags(food, source, raw).row;
}
