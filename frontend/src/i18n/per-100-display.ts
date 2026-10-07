import type { MeasurementUnit } from '../domain/meal-log';

// Picker rows display nutrient density per 100 for mass/volume units (g, ml), where
// nutrition labels are conventionally read. Other units (piece, oz, cup, …) fall back
// to per-unit display because "100piece" is not meaningful. Underlying storage stays
// per-unit either way — the multiplication is purely presentational.
export function per100Display(unit: MeasurementUnit): { mul: number; label: string } {
  if (unit === 'g' || unit === 'ml') return { mul: 100, label: `100${unit}` };
  return { mul: 1, label: unit };
}
