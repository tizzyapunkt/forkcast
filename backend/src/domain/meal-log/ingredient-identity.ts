import type { FullIngredientEntry, LogEntry } from './types.ts';

/** A log entry narrowed to the full-ingredient case — the only kind that carries an identity. */
export type FullLogEntry = LogEntry & { ingredient: FullIngredientEntry };

/**
 * Identity of an ingredient across the log: case-insensitive name plus unit.
 * Recently-used ingredients and favorites share this one rule, so the star on a
 * Recent row and the star on a Search row agree without any id translation.
 */
export function ingredientIdentityKey(name: string, unit: string): string {
  return `${name.toLowerCase()}|${unit}`;
}

/**
 * Collapse log entries to the most recent full entry per ingredient identity.
 * Quick entries carry no ingredient identity and never contribute.
 */
export function latestFullEntryByIdentity(entries: LogEntry[]): Map<string, FullLogEntry> {
  const latest = new Map<string, FullLogEntry>();

  for (const entry of entries) {
    if (entry.ingredient.type !== 'full') continue;
    const full = entry as FullLogEntry;
    const key = ingredientIdentityKey(full.ingredient.name, full.ingredient.unit);
    const existing = latest.get(key);
    if (!existing || full.loggedAt > existing.loggedAt) {
      latest.set(key, full);
    }
  }

  return latest;
}
