import type { LogEntryRepository } from './log-entry.repository.ts';
import type { FullIngredientEntry, LogEntry, MeasurementUnit } from './types.ts';
import { assertFullIngredient } from './full-ingredient.ts';
import { ingredientIdentityKey } from './ingredient-identity.ts';

export interface IngredientIdentity {
  name: string;
  unit: MeasurementUnit;
}

/** What one recipe batch should hold afterwards: these identities gone, these ingredients at these amounts. */
export interface BatchIngredientChange {
  recipeBatchId: string;
  date: string;
  remove: IngredientIdentity[];
  set: FullIngredientEntry[];
}

export interface SetBatchIngredientsCommand {
  changes: BatchIngredientChange[];
}

/**
 * Write the cooking view's edits into several planned recipe batches at once. Per batch, every entry of an
 * identity named in `remove` or `set` is dropped and each `set` ingredient is written as one entry. The
 * amounts are absolute, so sending a command twice is harmless, and undo is the same command with the
 * earlier amounts. All batches change in one write, or none does.
 */
export async function setBatchIngredients(
  repo: LogEntryRepository,
  command: SetBatchIngredientsCommand,
): Promise<LogEntry[]> {
  const changes = command?.changes;
  if (!Array.isArray(changes) || changes.length === 0) throw new Error('At least one batch change is required');

  const removeIds: string[] = [];
  const written: LogEntry[] = [];
  const seen = new Set<string>();
  const byDate = new Map<string, LogEntry[]>();

  for (const change of changes) {
    assertChange(change);
    const batchKey = `${change.date}|${change.recipeBatchId}`;
    if (seen.has(batchKey)) throw new Error(`Recipe log batch listed twice: ${change.recipeBatchId}`);
    seen.add(batchKey);

    if (!byDate.has(change.date)) byDate.set(change.date, await repo.findByDate(change.date));
    // A batch id can recur on other dates (days copied before copies got fresh ids): look it up per date.
    const members = byDate.get(change.date)!.filter((e) => e.recipeBatchId === change.recipeBatchId);
    const first = members[0];
    if (!first) throw new Error(`Recipe log batch not found on ${change.date}: ${change.recipeBatchId}`);

    const touched = new Set([...change.remove, ...change.set].map((i) => ingredientIdentityKey(i.name, i.unit)));
    const dropped = members.filter(
      (e) => e.ingredient.type === 'full' && touched.has(ingredientIdentityKey(e.ingredient.name, e.ingredient.unit)),
    );
    if (members.length - dropped.length + change.set.length === 0) {
      throw new Error(`The change would leave the recipe log batch empty: ${change.recipeBatchId}`);
    }

    const now = new Date().toISOString();
    for (const { type, name, unit, macrosPerUnit, amount } of change.set) {
      // An identity that stays keeps its entry, so the planner's row and key survive the edit.
      const survivor = dropped.find(
        (e) =>
          e.ingredient.type === 'full' &&
          ingredientIdentityKey(e.ingredient.name, e.ingredient.unit) === ingredientIdentityKey(name, unit),
      );
      written.push({
        id: survivor?.id ?? crypto.randomUUID(),
        date: first.date,
        slot: first.slot,
        loggedAt: survivor?.loggedAt ?? now,
        recipeId: first.recipeId,
        recipeBatchId: first.recipeBatchId,
        recipePortions: first.recipePortions,
        ingredient: { type, name, unit, macrosPerUnit, amount },
      });
    }
    removeIds.push(...dropped.map((e) => e.id));
  }

  await repo.replaceMany(removeIds, written);
  return written;
}

function assertChange(change: BatchIngredientChange): void {
  if (!change || typeof change.recipeBatchId !== 'string' || change.recipeBatchId.trim().length === 0) {
    throw new Error('A recipe batch id is required');
  }
  if (typeof change.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(change.date)) {
    throw new Error('A date (YYYY-MM-DD) is required');
  }
  if (!Array.isArray(change.remove) || !Array.isArray(change.set)) {
    throw new Error('remove and set must be lists');
  }
  for (const identity of change.remove) {
    if (!identity || typeof identity.name !== 'string' || typeof identity.unit !== 'string') {
      throw new Error('Every removed ingredient needs a name and a unit');
    }
  }
  const keys = new Set<string>();
  for (const ingredient of change.set) {
    assertFullIngredient(ingredient);
    const key = ingredientIdentityKey(ingredient.name, ingredient.unit);
    if (keys.has(key)) throw new Error(`Ingredient set twice in one batch: ${ingredient.name}`);
    keys.add(key);
  }
}
