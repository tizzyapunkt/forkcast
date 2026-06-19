import type { FoodEntry } from './types.ts';

export type ValidationResult = { ok: true; entry: FoodEntry } | { ok: false; reason: string };

function isFiniteNonNegative(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0;
}

export function validateFoodEntry(entry: FoodEntry): ValidationResult {
  if (typeof entry.id !== 'string' || entry.id.trim().length === 0) {
    return { ok: false, reason: 'id missing or empty' };
  }
  if (typeof entry.name !== 'string' || entry.name.trim().length === 0) {
    return { ok: false, reason: `entry ${entry.id}: name missing or empty` };
  }
  if (!Array.isArray(entry.synonyms)) {
    return { ok: false, reason: `entry ${entry.id}: synonyms must be an array` };
  }
  const foldedName = entry.name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
  for (const syn of entry.synonyms) {
    if (typeof syn !== 'string' || syn.trim().length === 0) {
      return { ok: false, reason: `entry ${entry.id}: synonym empty or non-string` };
    }
    const foldedSyn = syn
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase();
    if (foldedSyn === foldedName) {
      return { ok: false, reason: `entry ${entry.id}: synonym "${syn}" duplicates canonical name` };
    }
  }
  if (entry.unit !== 'g' && entry.unit !== 'ml') {
    return { ok: false, reason: `entry ${entry.id}: unit must be "g" or "ml"` };
  }
  const m = entry.macrosPer100;
  if (!m || typeof m !== 'object') {
    return { ok: false, reason: `entry ${entry.id}: macrosPer100 missing` };
  }
  if (!isFiniteNonNegative(m.calories)) {
    return { ok: false, reason: `entry ${entry.id}: macrosPer100.calories must be a finite non-negative number` };
  }
  if (!isFiniteNonNegative(m.protein) || !isFiniteNonNegative(m.carbs) || !isFiniteNonNegative(m.fat)) {
    return {
      ok: false,
      reason: `entry ${entry.id}: macrosPer100 protein/carbs/fat must be finite non-negative numbers`,
    };
  }
  if (entry.pieces !== undefined) {
    if (!Array.isArray(entry.pieces)) {
      return { ok: false, reason: `entry ${entry.id}: pieces must be an array when present` };
    }
    const seen = new Set<string>();
    for (const p of entry.pieces) {
      if (!p || typeof p !== 'object') {
        return { ok: false, reason: `entry ${entry.id}: piece must be an object` };
      }
      if (typeof p.label !== 'string' || p.label.trim().length === 0) {
        return { ok: false, reason: `entry ${entry.id}: piece label missing or empty` };
      }
      if (typeof p.grams !== 'number' || !Number.isFinite(p.grams) || p.grams <= 0) {
        return { ok: false, reason: `entry ${entry.id}: piece "${p.label}" grams must be a positive finite number` };
      }
      if (seen.has(p.label)) {
        return { ok: false, reason: `entry ${entry.id}: duplicate piece label "${p.label}"` };
      }
      seen.add(p.label);
    }
  }
  if (entry.density !== undefined) {
    if (typeof entry.density !== 'number' || !Number.isFinite(entry.density) || entry.density <= 0) {
      return { ok: false, reason: `entry ${entry.id}: density must be a positive finite number when present` };
    }
  }
  if (entry.untracked !== undefined) {
    if (typeof entry.untracked !== 'boolean') {
      return { ok: false, reason: `entry ${entry.id}: untracked must be a boolean when present` };
    }
    if (entry.untracked === true) {
      if (m.calories !== 0 || m.protein !== 0 || m.carbs !== 0 || m.fat !== 0) {
        return {
          ok: false,
          reason: `entry ${entry.id}: untracked entries must have all-zero macrosPer100`,
        };
      }
    }
  }
  return { ok: true, entry };
}
