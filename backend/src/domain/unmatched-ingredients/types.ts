import type { MeasurementUnit } from '../recipes/types.ts';
import type { RawIngredient } from '../ai-recipe-import/types.ts';

export interface UnmatchedIngredientSample {
  rawName: string;
  rawUnit?: MeasurementUnit;
  rawDisplayUnitLabel?: string;
}

export interface UnmatchedIngredientEntry {
  name: string;
  foldedName: string;
  count: number;
  firstSeenAt: string;
  lastSeenAt: string;
  samples: UnmatchedIngredientSample[];
}

export interface UnmatchedIngredientStore {
  entries: UnmatchedIngredientEntry[];
}

export interface UnmatchedIngredientRecorder {
  record(raw: RawIngredient): Promise<void>;
}

export interface UnmatchedIngredientReader {
  load(): Promise<UnmatchedIngredientStore>;
}

export interface UnmatchedIngredientCleaner {
  clear(): Promise<void>;
}

export const UNMATCHED_INGREDIENT_SAMPLE_CAP = 5;
