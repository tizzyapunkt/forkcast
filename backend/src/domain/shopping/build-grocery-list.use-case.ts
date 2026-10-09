import type { LogEntryRepository } from '../meal-log/log-entry.repository.ts';
import type { LogEntry } from '../meal-log/types.ts';
import { addDaysIso } from '../meal-log/date-range.ts';
import type { RecipeRepository } from '../recipes/recipe.repository.ts';
import type { Recipe } from '../recipes/types.ts';
import type { CatalogStore } from '../food-catalog/types.ts';
import type { PieceWeight } from '../foods/types.ts';
import { fold } from '../ingredient-search/fold.ts';
import { foldContributions, type PieceSizeLookup } from './fold-contributions.ts';
import type { Contribution, GroceryList, GroceryRecipe } from './types.ts';

export interface GroceryListSources {
  logEntries: LogEntryRepository;
  recipes: RecipeRepository;
  catalog: CatalogStore;
}

const WEEK_DAYS = 7;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Portions cooked per recipe id, chosen when shopping. A recipe without a value cooks its logged portions. */
export type RecipePortions = Record<string, number>;

interface Batch {
  date: string;
  recipeId: string | undefined;
  portions: number; // logged portions of the batch
  entries: LogEntry[];
}

/**
 * What the planned week needs to be bought: every full entry of the seven days from `startDate`, each
 * recipe scaled from its logged portions to the portions cooked, plus the untracked recipe ingredients
 * (Salz, Gewürze) the meal log never records. Pure read — nothing is stored.
 */
export async function buildGroceryList(
  sources: GroceryListSources,
  startDate: string,
  portions: RecipePortions = {},
): Promise<GroceryList> {
  if (typeof startDate !== 'string' || !ISO_DATE.test(startDate)) {
    throw new Error('A start date (YYYY-MM-DD) is required');
  }
  for (const value of Object.values(portions)) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      throw new Error('Portions must be positive numbers');
    }
  }

  const contributions: Contribution[] = [];
  const batches: Batch[] = [];
  let skippedQuickEntries = 0;

  for (let i = 0; i < WEEK_DAYS; i++) {
    const date = addDaysIso(startDate, i);
    // A batch is grouped per date: days copied before copies got fresh ids share a batch id.
    const byBatchId = new Map<string, Batch>();

    for (const entry of await sources.logEntries.findByDate(date)) {
      if (entry.ingredient.type === 'quick') {
        skippedQuickEntries++;
        continue;
      }
      if (!entry.recipeBatchId) {
        const { name, unit, amount } = entry.ingredient;
        contributions.push({ name, unit, amount, date, untracked: false });
        continue;
      }
      let batch = byBatchId.get(entry.recipeBatchId);
      if (!batch) {
        batch = { date, recipeId: entry.recipeId, portions: entry.recipePortions ?? 1, entries: [] };
        byBatchId.set(entry.recipeBatchId, batch);
        batches.push(batch);
      }
      batch.entries.push(entry);
    }
  }

  const recipes: GroceryRecipe[] = [];
  const recipeBatches = Map.groupBy(batches, (b) => b.recipeId);

  for (const [recipeId, group] of recipeBatches) {
    const recipe = recipeId ? await sources.recipes.findById(recipeId) : null;
    const logged = group.reduce((sum, b) => sum + b.portions, 0);
    if (!recipe || logged <= 0) {
      // Nothing to scale against: the batches contribute what was logged.
      for (const b of group) contributions.push(...entryContributions(b, 1));
      continue;
    }

    const cooked = portions[recipe.id] ?? logged;
    recipes.push({ recipeId: recipe.id, name: recipe.name, loggedPortions: logged, portions: cooked });
    for (const b of group) {
      contributions.push(...entryContributions(b, cooked / logged));
      // The untracked tail counts once per recipe, split over its batches so each date shows up.
      if (recipe.yield > 0) contributions.push(...untrackedTail(recipe, b, (cooked * b.portions) / logged));
    }
  }

  recipes.sort((a, b) => a.name.localeCompare(b.name, 'de'));

  return {
    startDate,
    items: foldContributions(contributions, pieceSizeLookup(sources.catalog)),
    recipes,
    skippedQuickEntries,
  };
}

function entryContributions(batch: Batch, factor: number): Contribution[] {
  return batch.entries.flatMap((entry) =>
    entry.ingredient.type === 'full'
      ? [
          {
            name: entry.ingredient.name,
            unit: entry.ingredient.unit,
            amount: entry.ingredient.amount * factor,
            date: batch.date,
            untracked: false,
          },
        ]
      : [],
  );
}

/** The recipe's untracked ingredients, which logging a recipe never turns into entries. */
function untrackedTail(recipe: Recipe, batch: Batch, portions: number): Contribution[] {
  const factor = portions / recipe.yield;
  return recipe.ingredients
    .filter((ingredient) => ingredient.untracked === true)
    .map((ingredient) => ({
      name: ingredient.name,
      unit: ingredient.unit,
      amount: ingredient.amount * factor,
      date: batch.date,
      untracked: true,
    }));
}

/** A medium size: `mittel`, a qualified `Filet mittel`, or the egg size `M`. */
function isMedium(piece: PieceWeight): boolean {
  return piece.label === 'M' || piece.label.split(' ').at(-1) === 'mittel';
}

/**
 * The piece a shopper counts in: the medium one, else the largest — a whole head of broccoli,
 * not its florets.
 */
function shoppingPiece(pieces: PieceWeight[]): PieceWeight {
  return pieces.find(isMedium) ?? pieces.reduce((a, b) => (b.grams > a.grams ? b : a));
}

/** Catalog piece size by folded name or synonym (see `shoppingPiece`). Grams only. */
function pieceSizeLookup(catalog: CatalogStore): PieceSizeLookup {
  const byName = new Map<string, PieceWeight>();
  for (const food of catalog.indexed()) {
    if (food.unit !== 'g' || !food.pieces || food.pieces.length === 0) continue;
    const piece = shoppingPiece(food.pieces);
    const names = food.nameEnFolded !== undefined ? [food.nameFolded, food.nameEnFolded] : [food.nameFolded];
    for (const key of [...names, ...food.synonymsFolded]) {
      if (!byName.has(key)) byName.set(key, piece);
    }
  }
  return (name, unit) => (unit === 'g' ? (byName.get(fold(name)) ?? null) : null);
}
