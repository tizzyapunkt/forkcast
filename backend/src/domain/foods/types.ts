export interface PieceWeight {
  label: string;
  grams: number;
}

export interface FoodEntry {
  id: string;
  name: string;
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
  synonymsFolded: string[];
}
