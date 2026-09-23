import type { MeasurementUnit } from '../recipes/types.ts';

/**
 * Deterministic volume of one spoon/cup measure in millilitres, keyed by the
 * recipe's literal unit label. A spoon is a fixed volume; converting it to a mass
 * needs the food's density or a per-spoon estimate (see convertSpoonMeasure). Anything not in this table
 * (Prise, Schuss, qualitative phrases, or canonical g/ml) is not a spoon measure.
 */
const SPOON_VOLUME_ML: Readonly<Record<string, number>> = {
  tl: 5,
  teelöffel: 5,
  teeloeffel: 5,
  tsp: 5,
  teaspoon: 5,
  el: 15,
  esslöffel: 15,
  essloeffel: 15,
  tbsp: 15,
  tablespoon: 15,
  tasse: 240,
  cup: 240,
};

function normalizeLabel(label: string): string {
  return label.trim().replace(/\.+$/, '').toLowerCase();
}

/** The volume of one such spoon/cup in ml, or undefined when the label is not a spoon measure. */
export function spoonVolumeMl(label: string): number | undefined {
  if (typeof label !== 'string' || label.trim().length === 0) return undefined;
  return SPOON_VOLUME_ML[normalizeLabel(label)];
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function isPositiveFinite(n: number | undefined): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

export interface SpoonMeasure {
  /** Spoons as stated in the recipe; a missing count means one spoon. */
  count?: number;
  /** The recipe's literal unit label ("EL", "Teelöffel", "Tasse"). */
  label?: string;
  /** The matched food's catalog unit. */
  unit: MeasurementUnit;
  /** The matched food's mass per millilitre (g/ml), when the catalog knows it. */
  density?: number;
  /** The model's estimate of one spoon of this food in grams. */
  gramsPerSpoon?: number;
}

export interface SpoonConversion {
  amount: number;
  /** True when the amount rests on the model's per-spoon estimate rather than a fixed volume or density. */
  estimated: boolean;
}

/**
 * Convert a spoon/cup measure stated in a recipe to the matched food's `unit`, deterministic sources first:
 *
 * 1. ml-unit food: the spoon already is a volume (no density needed).
 * 2. g-unit food with a catalog density: volume × density.
 * 3. g-unit food without density: count × the model's `gramsPerSpoon`, marked as estimated.
 *
 * Returns undefined when the label is not a spoon measure, the count is non-positive, or a g-unit food
 * has neither a density nor a usable estimate — the caller surfaces that as a missing amount.
 */
export function convertSpoonMeasure(measure: SpoonMeasure): SpoonConversion | undefined {
  const { label, unit, density, gramsPerSpoon } = measure;
  if (label === undefined) return undefined;
  const perSpoon = spoonVolumeMl(label);
  if (perSpoon === undefined) return undefined;

  const count = measure.count ?? 1;
  if (!isPositiveFinite(count)) return undefined;

  const volumeMl = count * perSpoon;
  if (unit === 'ml') return { amount: round1(volumeMl), estimated: false };
  if (unit !== 'g') return undefined;
  if (isPositiveFinite(density)) return { amount: round1(volumeMl * density), estimated: false };
  if (isPositiveFinite(gramsPerSpoon)) return { amount: round1(count * gramsPerSpoon), estimated: true };
  return undefined;
}
