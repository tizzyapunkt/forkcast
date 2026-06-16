import type { FoodEntry } from '../src/domain/foods/types.ts';
import type { LearnedSynonym } from '../src/domain/user-foods/types.ts';
import { appendSynonym } from './build-foods-augment-helpers.ts';

export interface OverlayExport {
  foods: FoodEntry[];
  synonyms: LearnedSynonym[];
}

/**
 * Parse and shape-validate a user-foods overlay export `{ foods, synonyms }`.
 * Rejects the retired unmatched-ingredient export shape `{ entries }` with a
 * message naming the expected shape.
 */
export function parseOverlayExport(raw: unknown): OverlayExport {
  if (!raw || typeof raw !== 'object') {
    throw new Error('export file is not a JSON object');
  }
  const obj = raw as Record<string, unknown>;
  if ('entries' in obj && !('foods' in obj) && !('synonyms' in obj)) {
    throw new Error(
      'export file has the retired unmatched-ingredient shape { entries: [...] }; expected the user-foods overlay shape { foods: [...], synonyms: [...] }',
    );
  }
  if (obj.foods !== undefined && !Array.isArray(obj.foods)) {
    throw new Error('export "foods" must be an array');
  }
  if (obj.synonyms !== undefined && !Array.isArray(obj.synonyms)) {
    throw new Error('export "synonyms" must be an array');
  }
  const foods = (Array.isArray(obj.foods) ? obj.foods : []) as FoodEntry[];
  const synonyms: LearnedSynonym[] = [];
  for (const s of (Array.isArray(obj.synonyms) ? obj.synonyms : []) as unknown[]) {
    if (
      s &&
      typeof s === 'object' &&
      typeof (s as LearnedSynonym).foodId === 'string' &&
      typeof (s as LearnedSynonym).synonym === 'string'
    ) {
      synonyms.push({ foodId: (s as LearnedSynonym).foodId, synonym: (s as LearnedSynonym).synonym });
    } else {
      throw new Error('each synonym must be { foodId: string, synonym: string }');
    }
  }
  return { foods, synonyms };
}

export interface AppliedSynonym {
  foodId: string;
  synonym: string;
}

export interface ApplySynonymsResult {
  foods: FoodEntry[];
  applied: AppliedSynonym[];
  /** Synonyms whose foodId has no curated entry — surfaced for manual handling, skipped. */
  orphaned: LearnedSynonym[];
}

/**
 * Apply learned synonyms onto the curated foods by `foodId`. A synonym whose
 * target id is absent is added to `orphaned` and skipped (the run continues).
 * Duplicate synonyms are no-ops (not counted as applied).
 */
export function applySynonyms(
  foods: ReadonlyArray<FoodEntry>,
  synonyms: ReadonlyArray<LearnedSynonym>,
): ApplySynonymsResult {
  const working = [...foods];
  const applied: AppliedSynonym[] = [];
  const orphaned: LearnedSynonym[] = [];
  for (const syn of synonyms) {
    const idx = working.findIndex((f) => f.id === syn.foodId);
    if (idx === -1) {
      orphaned.push(syn);
      continue;
    }
    const before = working[idx]!;
    const updated = appendSynonym(before, syn.synonym);
    if (updated !== before) {
      working[idx] = updated;
      applied.push({ foodId: syn.foodId, synonym: syn.synonym });
    }
  }
  return { foods: working, applied, orphaned };
}

/**
 * Build the Opus drafting message for promoting a confirmed overlay food. The
 * phone-confirmed entry rides along as a hint so per-100 macros stay consistent
 * with the rest of the curated catalog while the model re-grounds the data.
 */
export function draftHintMessage(entry: FoodEntry): string {
  const requestLine = entry.untracked ? `- ${entry.id} (untracked)` : `- ${entry.id}`;
  const hint = JSON.stringify(
    {
      name: entry.name,
      synonyms: entry.synonyms,
      unit: entry.unit,
      macrosPer100: entry.macrosPer100,
      pieces: entry.pieces,
    },
    null,
    2,
  );
  return `Submit one food entry per id, in the same order:\n${requestLine}\n\nThe user already confirmed this entry on their phone; use it as a strong hint but re-ground the macros against authoritative tables:\n${hint}`;
}
