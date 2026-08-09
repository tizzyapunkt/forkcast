import type { MacrosPerUnit } from './meal-log';

export interface CatalogPieceWeight {
  label: string;
  grams: number;
}

/** One food in the user's editable catalog — the same shape the backend persists. */
export interface CatalogEntry {
  id: string;
  name: string;
  synonyms: string[];
  unit: 'g' | 'ml';
  macrosPer100: MacrosPerUnit;
  pieces?: CatalogPieceWeight[];
  untracked?: boolean;
  /** Mass per millilitre (g/ml), used when a recipe states a spoon measure. Set by the AI fill only. */
  density?: number;
}

/** A new or edited entry as the editor holds it — the id is derived from the name by the backend. */
export type CatalogEntryDraft = Omit<CatalogEntry, 'id'> & { id?: string };
