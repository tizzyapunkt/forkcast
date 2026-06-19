import type { MeasurementUnit } from '../recipes/types.ts';

/**
 * Deterministic volume of one spoon/cup measure in millilitres, keyed by the
 * recipe's literal unit label. A spoon is a fixed volume; converting it to a mass
 * needs the food's density (see convertSpoonToAmount). Anything not in this table
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

/**
 * Convert a spoon/cup measure stated in a recipe to the matched food's mass `unit`.
 *
 * - ml-unit food: a spoon already is a volume, so the result is the volume in ml (no density).
 * - g-unit food: result is `volume × density`, and ONLY when a density is supplied — without it
 *   we cannot convert and return undefined rather than guess.
 *
 * A missing `rawDisplayAmount` defaults to one spoon; a non-positive stated amount yields undefined.
 * Returns undefined whenever the label is not a recognized spoon measure.
 */
export function convertSpoonToAmount(
  rawDisplayAmount: number | undefined,
  rawDisplayUnitLabel: string | undefined,
  unit: MeasurementUnit,
  density?: number,
): number | undefined {
  if (rawDisplayUnitLabel === undefined) return undefined;
  const perSpoon = spoonVolumeMl(rawDisplayUnitLabel);
  if (perSpoon === undefined) return undefined;

  let count = rawDisplayAmount;
  if (count === undefined) count = 1;
  else if (!Number.isFinite(count) || count <= 0) return undefined;

  const volumeMl = count * perSpoon;
  if (unit === 'ml') return round1(volumeMl);
  if (unit === 'g') {
    if (density === undefined || !Number.isFinite(density) || density <= 0) return undefined;
    return round1(volumeMl * density);
  }
  return undefined;
}
