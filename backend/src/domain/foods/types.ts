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
}

export interface FoodIndexedEntry extends FoodEntry {
  nameFolded: string;
  synonymsFolded: string[];
}
