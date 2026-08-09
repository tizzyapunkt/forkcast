import { readFile, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import type { FoodEntry } from '../../domain/foods/types.ts';
import {
  mergeOverlayIntoCatalog,
  type LegacyLearnedSynonym,
  type LegacyUserFoodsOverlay,
} from '../../domain/food-catalog/merge-overlay.ts';
import type { JsonCatalogStore } from './json-catalog.store.ts';

export interface OverlayMigrationOutcome {
  migrated: boolean;
  warnings: string[];
}

function parseOverlay(raw: string): LegacyUserFoodsOverlay | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as { foods?: unknown; synonyms?: unknown };
  const foods = Array.isArray(obj.foods) ? (obj.foods as FoodEntry[]) : [];
  const synonyms: LegacyLearnedSynonym[] = [];
  if (Array.isArray(obj.synonyms)) {
    for (const s of obj.synonyms) {
      if (s && typeof s === 'object' && typeof s.foodId === 'string' && typeof s.synonym === 'string') {
        synonyms.push({ foodId: s.foodId, synonym: s.synonym });
      }
    }
  }
  return { foods, synonyms };
}

/**
 * One-time migration of the retired user-foods overlay into the catalog. The
 * legacy file's existence is the "not yet migrated" marker: it is folded in,
 * the catalog is written atomically, and only then is the file deleted. An
 * unparseable overlay is left in place — losing confirmations silently would be
 * worse than a warning on every boot.
 */
export async function migrateUserFoodsOverlay(
  store: JsonCatalogStore,
  overlayPath: string,
): Promise<OverlayMigrationOutcome> {
  if (!existsSync(overlayPath)) return { migrated: false, warnings: [] };

  const overlay = parseOverlay(await readFile(overlayPath, 'utf-8'));
  if (overlay === null) {
    console.warn(`catalog migration: could not parse ${overlayPath}; leaving it in place and skipping migration`);
    return { migrated: false, warnings: [] };
  }

  const { entries, warnings } = mergeOverlayIntoCatalog(store.list(), overlay);
  for (const warning of warnings) console.warn(warning);

  await store.replaceAll(entries);
  await unlink(overlayPath);
  console.log(
    `catalog migration: folded ${overlay.foods.length} food(s) and ${overlay.synonyms.length} synonym(s) from ${overlayPath} into the catalog`,
  );

  return { migrated: true, warnings };
}
