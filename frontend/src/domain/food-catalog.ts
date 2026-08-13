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

const ZERO_MACROS: MacrosPerUnit = { calories: 0, protein: 0, carbs: 0, fat: 0 };

/**
 * An entry as an editor can hold it, whatever the server sent. An AI-drafted entry
 * is the one entry that does not come from the store, so a field it omits would
 * otherwise reach the editor as `undefined` and take the screen down with it —
 * a missing value is an empty one the user can fill in.
 */
export function toEditableEntry(entry: Partial<CatalogEntry>): CatalogEntry {
  return {
    ...entry,
    id: entry.id ?? '',
    name: entry.name ?? '',
    synonyms: Array.isArray(entry.synonyms) ? entry.synonyms : [],
    unit: entry.unit === 'ml' ? 'ml' : 'g',
    macrosPer100: { ...ZERO_MACROS, ...entry.macrosPer100 },
  };
}
