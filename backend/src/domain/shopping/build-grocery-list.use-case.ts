import type { LogEntryRepository } from '../meal-log/log-entry.repository.ts';
import type { LogEntry } from '../meal-log/types.ts';
import { addDaysIso } from '../meal-log/date-range.ts';
import type { RecipeRepository } from '../recipes/recipe.repository.ts';
import type { CatalogStore } from '../food-catalog/types.ts';
import type { PieceWeight } from '../foods/types.ts';
import { fold } from '../ingredient-search/fold.ts';
import { foldContributions, type PieceSizeLookup } from './fold-contributions.ts';
import type { Contribution, GroceryList } from './types.ts';

export interface GroceryListSources {
  logEntries: LogEntryRepository;
  recipes: RecipeRepository;
  catalog: CatalogStore;
}

const WEEK_DAYS = 7;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * What the planned week needs to be bought: every full entry of the seven days from `startDate`, recipe
 * batches scaled to the portions actually cooked, plus the untracked recipe ingredients (Salz, Gewürze)
 * the meal log never records. Pure read — nothing is stored.
 */
export async function buildGroceryList(sources: GroceryListSources, startDate: string): Promise<GroceryList> {
  if (typeof startDate !== 'string' || !ISO_DATE.test(startDate)) {
    throw new Error('A start date (YYYY-MM-DD) is required');
  }

  const contributions: Contribution[] = [];
  let skippedQuickEntries = 0;

  for (let i = 0; i < WEEK_DAYS; i++) {
    const date = addDaysIso(startDate, i);
    const entries = await sources.logEntries.findByDate(date);
    const batches = new Map<string, LogEntry[]>();

    for (const entry of entries) {
      if (entry.ingredient.type === 'quick') {
        skippedQuickEntries++;
        continue;
      }
      const { name, unit, amount } = entry.ingredient;
      if (entry.recipeBatchId) {
        const members = batches.get(entry.recipeBatchId) ?? [];
        members.push(entry);
        batches.set(entry.recipeBatchId, members);
        contributions.push({ name, unit, amount: amount * cookedFactor(entry), date, untracked: false });
      } else {
        contributions.push({ name, unit, amount, date, untracked: false });
      }
    }

    // A batch is grouped per date: days copied before copies got fresh ids share a batch id.
    for (const members of batches.values()) {
      contributions.push(...(await untrackedTail(sources.recipes, members[0]!, date)));
    }
  }

  return {
    startDate,
    items: foldContributions(contributions, pieceSizeLookup(sources.catalog)),
    skippedQuickEntries,
  };
}

function cookedPortionsOf(entry: LogEntry): number {
  return entry.cookedPortions ?? entry.recipePortions ?? 1;
}

/** Logged amounts are for the portions eaten; the pot holds the portions cooked. */
function cookedFactor(entry: LogEntry): number {
  const logged = entry.recipePortions ?? 1;
  return logged > 0 ? cookedPortionsOf(entry) / logged : 1;
}

/** The recipe's untracked ingredients, which logging a recipe never turns into entries. */
async function untrackedTail(recipes: RecipeRepository, member: LogEntry, date: string): Promise<Contribution[]> {
  if (!member.recipeId) return [];
  const recipe = await recipes.findById(member.recipeId);
  if (!recipe || recipe.yield <= 0) return [];

  const factor = cookedPortionsOf(member) / recipe.yield;
  return recipe.ingredients
    .filter((ingredient) => ingredient.untracked === true)
    .map((ingredient) => ({
      name: ingredient.name,
      unit: ingredient.unit,
      amount: ingredient.amount * factor,
      date,
      untracked: true,
    }));
}

/** Catalog piece size by folded name or synonym: the `mittel` piece, else the first one. Grams only. */
function pieceSizeLookup(catalog: CatalogStore): PieceSizeLookup {
  const byName = new Map<string, PieceWeight>();
  for (const food of catalog.indexed()) {
    if (food.unit !== 'g' || !food.pieces || food.pieces.length === 0) continue;
    const piece = food.pieces.find((p) => p.label === 'mittel') ?? food.pieces[0]!;
    for (const key of [food.nameFolded, ...food.synonymsFolded]) {
      if (!byName.has(key)) byName.set(key, piece);
    }
  }
  return (name, unit) => (unit === 'g' ? (byName.get(fold(name)) ?? null) : null);
}
