/** The languages a catalog search can answer in. German is canonical; English falls back to it. */
export type CatalogLocale = 'de' | 'en';

export interface PieceWeight {
  label: string;
  grams: number;
}

export interface FoodEntry {
  id: string;
  /** Canonical German name: derives the id and is the key AI matching prompts use. */
  name: string;
  /** Optional English display name, shown when the UI runs in English. */
  nameEn?: string;
  synonyms: string[];
  unit: 'g' | 'ml';
  macrosPer100: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  pieces?: PieceWeight[];
  untracked?: boolean;
  /**
   * Optional mass per millilitre (g/ml). Present only on `g`-unit foods that are
   * realistically measured by volume (dry staples like Speisestärke, flours), so a
   * spoon measure stated in a recipe can be converted to grams. Omitted otherwise.
   */
  density?: number;
}

export interface FoodIndexedEntry extends FoodEntry {
  nameFolded: string;
  nameEnFolded?: string;
  synonymsFolded: string[];
}
