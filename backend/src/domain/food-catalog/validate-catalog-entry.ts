import type { FoodEntry } from '../foods/types.ts';
import { validateFoodEntry, type ValidationResult } from '../foods/validate-food-entry.ts';
import { fold } from '../ingredient-search/fold.ts';

/** Lowercase ASCII kebab-case: alphanumeric groups joined by single hyphens. */
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Whether `id` satisfies the catalog's identifier rule. */
export function isValidCatalogId(id: unknown): id is string {
  return typeof id === 'string' && ID_PATTERN.test(id);
}

/**
 * Validate a catalog entry: the shared food-entry shape rules plus the catalog's
 * own identifier rule. Ids are user-visible only as slugs, but they key every
 * runtime write, so they must stay stable, ASCII, and URL-safe.
 */
export function validateCatalogEntry(entry: FoodEntry): ValidationResult {
  if (!isValidCatalogId(entry.id)) {
    return { ok: false, reason: `entry ${String(entry.id)}: id must be lowercase ASCII kebab-case` };
  }
  return validateFoodEntry(entry);
}

/** The folded names an entry is known by: its canonical name and, when present, its English name. */
function foldedNames(entry: FoodEntry): Set<string> {
  const names = new Set([fold(entry.name)]);
  if (entry.nameEn !== undefined) names.add(fold(entry.nameEn));
  return names;
}

/**
 * Report why `entry` cannot join `catalog` — an id already taken, or a folded canonical or
 * English name equal to another entry's canonical or English name — or `null` when it is
 * free. `excludeId` skips the entry being updated so a rename never collides with itself.
 */
export function findCatalogCollision(catalog: FoodEntry[], entry: FoodEntry, excludeId?: string): string | null {
  const names = foldedNames(entry);
  for (const existing of catalog) {
    if (excludeId !== undefined && existing.id === excludeId) continue;
    if (existing.id === entry.id) return `an entry with id "${entry.id}" already exists`;
    for (const taken of foldedNames(existing)) {
      if (names.has(taken)) {
        const label =
          existing.nameEn !== undefined && fold(existing.nameEn) === taken ? existing.nameEn : existing.name;
        return `an entry named "${label}" already exists`;
      }
    }
  }
  return null;
}
