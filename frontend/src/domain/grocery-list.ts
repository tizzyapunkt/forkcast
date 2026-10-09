import type { MeasurementUnit } from './meal-log';

/** "≈ 3 × mittel" — the grocery amount in catalog piece sizes. */
export interface PieceHint {
  count: number;
  label: string;
}

/** One line of the week's grocery list: everything needed of one food (name + unit). */
export interface GroceryItem {
  name: string;
  unit: MeasurementUnit;
  amount: number;
  untracked: boolean;
  dates: string[];
  pieceHint?: PieceHint;
}

/** A recipe planned in the week: the portions logged for it and the portions the list was built for. */
export interface GroceryRecipe {
  recipeId: string;
  name: string;
  loggedPortions: number;
  portions: number;
}

/** Portions cooked per recipe id, chosen in the sheet. A recipe without a value cooks its logged portions. */
export type RecipePortions = Record<string, number>;

export interface GroceryList {
  startDate: string;
  items: GroceryItem[];
  recipes: GroceryRecipe[];
  skippedQuickEntries: number;
}

/** Identity of an item on the list — case-insensitive name plus unit, as on the backend. */
export function groceryItemKey(item: Pick<GroceryItem, 'name' | 'unit'>): string {
  return `${item.name.toLowerCase()}|${item.unit}`;
}
