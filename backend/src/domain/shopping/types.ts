import type { MeasurementUnit } from '../meal-log/types.ts';

/** "≈ 3 × mittel" — the grocery amount expressed in catalog piece sizes. */
export interface PieceHint {
  count: number;
  label: string;
}

/** One line on the grocery list: everything the week needs of one food (name + unit identity). */
export interface GroceryItem {
  name: string;
  unit: MeasurementUnit;
  amount: number; // rounded up to a whole number
  untracked: boolean; // every contribution came from an untracked recipe ingredient (Salz, Gewürze, …)
  dates: string[]; // ISO dates in the week that need it, ascending
  pieceHint?: PieceHint;
}

export interface GroceryList {
  startDate: string;
  items: GroceryItem[];
  skippedQuickEntries: number;
}

/** One food amount the week needs on one date, before foods are combined into items. */
export interface Contribution {
  name: string;
  unit: MeasurementUnit;
  amount: number;
  date: string;
  untracked: boolean;
}
