import { fold } from '../ingredient-search/fold.ts';
import type { RawIngredient } from '../ai-recipe-import/types.ts';
import {
  UNMATCHED_INGREDIENT_SAMPLE_CAP,
  type UnmatchedIngredientEntry,
  type UnmatchedIngredientSample,
  type UnmatchedIngredientStore,
} from './types.ts';

export function recordUnmatched(
  store: UnmatchedIngredientStore,
  raw: RawIngredient,
  now: Date,
): UnmatchedIngredientStore {
  const foldedName = fold(raw.name);
  const timestamp = now.toISOString();
  const sample = toSample(raw);

  const existingIndex = store.entries.findIndex((e) => e.foldedName === foldedName);
  if (existingIndex === -1) {
    const created: UnmatchedIngredientEntry = {
      name: raw.name,
      foldedName,
      count: 1,
      firstSeenAt: timestamp,
      lastSeenAt: timestamp,
      samples: [sample],
    };
    return { entries: [...store.entries, created] };
  }

  const existing = store.entries[existingIndex]!;
  const nextSamples = [...existing.samples, sample];
  if (nextSamples.length > UNMATCHED_INGREDIENT_SAMPLE_CAP) {
    nextSamples.splice(0, nextSamples.length - UNMATCHED_INGREDIENT_SAMPLE_CAP);
  }
  const updated: UnmatchedIngredientEntry = {
    ...existing,
    count: existing.count + 1,
    lastSeenAt: timestamp,
    samples: nextSamples,
  };
  const entries = [...store.entries];
  entries[existingIndex] = updated;
  return { entries };
}

function toSample(raw: RawIngredient): UnmatchedIngredientSample {
  const sample: UnmatchedIngredientSample = { rawName: raw.name };
  if (raw.unit) sample.rawUnit = raw.unit;
  if (raw.rawDisplayUnitLabel) sample.rawDisplayUnitLabel = raw.rawDisplayUnitLabel;
  return sample;
}
