import type { FullIngredientEntry, LogEntry, MacrosPerUnit, MealSlot, MeasurementUnit, WeekLog } from './meal-log';
import type { Recipe } from './recipes';

/**
 * Cooking one planned recipe once for several of its planned meals (batches) in a week, plus portions for
 * people eating along. Everything here is pure: the pot is computed from the week's log entries and the
 * recipe, and every edit becomes a `SetBatchIngredients` payload with absolute amounts per batch.
 */

/** One planned instance of the recipe: the entries of one `recipeBatchId` on one date. */
export interface CookingBatch {
  key: string; // `${date}~${recipeBatchId}` — a batch id can recur on other dates
  recipeBatchId: string;
  date: string;
  slot: MealSlot;
  portions: number; // logged portions
  entries: LogEntry[];
}

export interface IngredientIdentity {
  name: string;
  unit: MeasurementUnit;
}

/** A food to put into the pot, as picked from search. */
export interface PotFood extends IngredientIdentity {
  macrosPerUnit: MacrosPerUnit;
}

/** The recipe's own measure for a row, e.g. 15 g per "EL" or 60 g per "Stück". */
export interface RecipeMeasure {
  label: string;
  perUnit: number; // amount in the row's unit per one label unit
}

export interface PotRow extends PotFood {
  key: string; // identity key
  potAmount: number;
  perPortion: number;
  inBatches: number; // selected batches that contain it
  measure?: RecipeMeasure;
  note?: string;
  added: boolean; // not in the (existing) recipe
}

export interface UntrackedRow {
  name: string;
  unit: MeasurementUnit;
  amount: number | null; // null for a qualitative label ("nach Geschmack")
  label?: string; // recipe display unit, e.g. "TL"
  labelAmount?: number;
}

export interface Pot {
  loggedPortions: number;
  extraPortions: number;
  potPortions: number;
  selectedBatches: number;
  rows: PotRow[];
  untracked: UntrackedRow[];
  macrosPerPortion: MacrosPerUnit;
  steps: string[];
  recipeMissing: boolean;
}

/** Per batch: these identities gone, these ingredients at these absolute amounts. */
export interface BatchIngredientChange {
  recipeBatchId: string;
  date: string;
  remove: IngredientIdentity[];
  set: FullIngredientEntry[];
}

const SLOT_ORDER: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export function identityKey(identity: IngredientIdentity): string {
  return `${identity.name.toLowerCase()}|${identity.unit}`;
}

export function batchKey(date: string, recipeBatchId: string): string {
  return `${date}~${recipeBatchId}`;
}

type FullEntry = LogEntry & { ingredient: FullIngredientEntry };

function fullEntries(batch: CookingBatch): FullEntry[] {
  return batch.entries.filter((e): e is FullEntry => e.ingredient.type === 'full');
}

/** The week's batches of one recipe, in day and slot order. */
export function recipeBatchesInWeek(week: WeekLog, recipeId: string): CookingBatch[] {
  const batches: CookingBatch[] = [];
  for (const day of week.days) {
    for (const slot of day.slots) {
      const byId = new Map<string, CookingBatch>();
      for (const entry of slot.entries) {
        if (entry.recipeId !== recipeId || !entry.recipeBatchId) continue;
        const key = batchKey(entry.date, entry.recipeBatchId);
        let batch = byId.get(key);
        if (!batch) {
          batch = {
            key,
            recipeBatchId: entry.recipeBatchId,
            date: entry.date,
            slot: entry.slot,
            portions: entry.recipePortions ?? 1,
            entries: [],
          };
          byId.set(key, batch);
          batches.push(batch);
        }
        batch.entries.push(entry);
      }
    }
  }
  return batches.sort((a, b) =>
    a.date === b.date ? SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot) : a.date.localeCompare(b.date),
  );
}

/** Batches dated today or later; all of them when every batch lies in the past. */
export function defaultSelection(batches: CookingBatch[], today: string): string[] {
  const upcoming = batches.filter((b) => b.date >= today);
  return (upcoming.length > 0 ? upcoming : batches).map((b) => b.key);
}

function recipeMeasure(ingredient: Recipe['ingredients'][number]): RecipeMeasure | undefined {
  if (ingredient.pieceQuantity && ingredient.pieceQuantity.gramsPerPiece > 0) {
    return { label: ingredient.pieceQuantity.unitLabel, perUnit: ingredient.pieceQuantity.gramsPerPiece };
  }
  const display = ingredient.displayQuantity;
  if (display?.amount !== undefined && display.amount > 0) {
    return { label: display.unitLabel, perUnit: ingredient.amount / display.amount };
  }
  return undefined;
}

export interface PotInput {
  batches: CookingBatch[];
  selected: string[]; // batch keys
  extraPortions: number;
  recipe: Recipe | null;
}

export function selectedBatches(input: Pick<PotInput, 'batches' | 'selected'>): CookingBatch[] {
  const keys = new Set(input.selected);
  return input.batches.filter((b) => keys.has(b.key));
}

/** The whole pot for the selected batches plus the people eating along. */
export function buildPot(input: PotInput): Pot {
  const batches = selectedBatches(input);
  const loggedPortions = batches.reduce((sum, b) => sum + b.portions, 0);
  const potPortions = loggedPortions + input.extraPortions;
  const recipe = input.recipe;

  const groups = new Map<string, { food: PotFood; sum: number; batches: Set<string> }>();
  for (const batch of batches) {
    for (const entry of fullEntries(batch)) {
      const { name, unit, macrosPerUnit, amount } = entry.ingredient;
      const key = identityKey(entry.ingredient);
      const group = groups.get(key) ?? { food: { name, unit, macrosPerUnit }, sum: 0, batches: new Set<string>() };
      group.sum += amount;
      group.batches.add(batch.key);
      groups.set(key, group);
    }
  }

  const tracked = (recipe?.ingredients ?? []).filter((i) => i.untracked !== true);
  const recipeIndex = new Map(tracked.map((ingredient, index) => [identityKey(ingredient), { ingredient, index }]));
  const macros: MacrosPerUnit = { calories: 0, protein: 0, carbs: 0, fat: 0 };

  const rows: (PotRow & { order: number })[] = [];
  let appearance = 0;
  for (const [key, group] of groups) {
    const perPortion = loggedPortions > 0 ? group.sum / loggedPortions : 0;
    for (const macro of ['calories', 'protein', 'carbs', 'fat'] as const) {
      macros[macro] += perPortion * group.food.macrosPerUnit[macro];
    }
    const match = recipeIndex.get(key);
    const measure = match ? recipeMeasure(match.ingredient) : undefined;
    rows.push({
      ...group.food,
      key,
      potAmount: perPortion * potPortions,
      perPortion,
      inBatches: group.batches.size,
      ...(measure ? { measure } : {}),
      ...(match?.ingredient.note ? { note: match.ingredient.note } : {}),
      added: recipe !== null && !match,
      order: match ? match.index : tracked.length + appearance++,
    });
  }
  rows.sort((a, b) => a.order - b.order);

  const untracked: UntrackedRow[] =
    recipe && recipe.yield > 0
      ? recipe.ingredients
          .filter((i) => i.untracked === true)
          .map((i) => {
            const factor = potPortions / recipe.yield;
            const display = i.displayQuantity;
            if (display && display.amount === undefined) {
              return { name: i.name, unit: i.unit, amount: null, label: display.unitLabel };
            }
            return {
              name: i.name,
              unit: i.unit,
              amount: i.amount * factor,
              ...(display?.amount !== undefined
                ? { label: display.unitLabel, labelAmount: display.amount * factor }
                : {}),
            };
          })
      : [];

  return {
    loggedPortions,
    extraPortions: input.extraPortions,
    potPortions,
    selectedBatches: batches.length,
    rows: rows.map(({ order: _order, ...row }) => row),
    untracked,
    macrosPerPortion: macros,
    steps: recipe?.steps ?? [],
    recipeMissing: recipe === null,
  };
}

function setIn(batch: CookingBatch, food: PotFood, perPortion: number): FullIngredientEntry {
  const { name, unit, macrosPerUnit } = food;
  return { type: 'full', name, unit, macrosPerUnit, amount: perPortion * batch.portions };
}

/** Set a row's pot amount: every selected batch gets the same amount per logged portion. */
export function changeAmount(input: PotInput, food: PotFood, potAmount: number): BatchIngredientChange[] {
  const pot = buildPot(input);
  const perPortion = potAmount / pot.potPortions;
  return selectedBatches(input).map((b) => ({
    recipeBatchId: b.recipeBatchId,
    date: b.date,
    remove: [],
    set: [setIn(b, food, perPortion)],
  }));
}

/** Add a food to the pot; the same write as changing the amount of a row that was not there yet. */
export const addToPot = changeAmount;

/** Replace one row by another food, the new pot amount split by portion. */
export function swapInPot(
  input: PotInput,
  from: IngredientIdentity,
  to: PotFood,
  potAmount: number,
): BatchIngredientChange[] {
  const fromKey = identityKey(from);
  const sameIdentity = fromKey === identityKey(to);
  return changeAmount(input, to, potAmount).map((change) => ({
    ...change,
    remove: sameIdentity ? [] : [{ name: from.name, unit: from.unit }],
  }));
}

/** Leave a row out of every selected batch. */
export function leaveOut(input: PotInput, identity: IngredientIdentity): BatchIngredientChange[] {
  return selectedBatches(input).map((b) => ({
    recipeBatchId: b.recipeBatchId,
    date: b.date,
    remove: [{ name: identity.name, unit: identity.unit }],
    set: [],
  }));
}

/** Leaving a row out must not empty a selected batch: a planned meal needs at least one ingredient. */
export function canLeaveOut(input: PotInput, identity: IngredientIdentity): boolean {
  const key = identityKey(identity);
  return selectedBatches(input).every((b) => fullEntries(b).some((e) => identityKey(e.ingredient) !== key));
}

/** The amount a swap starts with: the old pot amount (plus the target's, when it is already in the pot). */
export function swapPrefill(pot: Pot, from: IngredientIdentity, to: IngredientIdentity): number | null {
  if (from.unit !== to.unit) return null;
  const fromRow = pot.rows.find((r) => r.key === identityKey(from));
  if (!fromRow) return null;
  const toKey = identityKey(to);
  const existing = toKey === fromRow.key ? undefined : pot.rows.find((r) => r.key === toKey);
  return fromRow.potAmount + (existing?.potAmount ?? 0);
}

/** What a set of batches held for some identities, before a row's first change. */
export interface RowSnapshot {
  identities: IngredientIdentity[];
  batches: { recipeBatchId: string; date: string; entries: FullIngredientEntry[] }[];
}

export function snapshotRow(input: PotInput, identities: IngredientIdentity[]): RowSnapshot {
  const keys = new Set(identities.map(identityKey));
  return {
    identities: identities.map(({ name, unit }) => ({ name, unit })),
    batches: selectedBatches(input).map((b) => ({
      recipeBatchId: b.recipeBatchId,
      date: b.date,
      entries: fullEntries(b)
        .filter((e) => keys.has(identityKey(e.ingredient)))
        .map((e) => ({ ...e.ingredient })),
    })),
  };
}

/** Put the snapshot's identities back exactly as they were, in exactly those batches. */
export function restoreRow(snapshot: RowSnapshot): BatchIngredientChange[] {
  return snapshot.batches.map((b) => {
    const kept = new Map<string, FullIngredientEntry>();
    for (const ingredient of b.entries) {
      const key = identityKey(ingredient);
      const prior = kept.get(key);
      kept.set(key, prior ? { ...prior, amount: prior.amount + ingredient.amount } : ingredient);
    }
    return {
      recipeBatchId: b.recipeBatchId,
      date: b.date,
      remove: snapshot.identities.filter((i) => !kept.has(identityKey(i))),
      set: [...kept.values()],
    };
  });
}

/**
 * A row changed again under a new identity (a swap after an amount change): keep what the snapshot already
 * holds and add the new identities as they are now, so undo still returns to the state before the first change.
 */
export function extendSnapshot(input: PotInput, snapshot: RowSnapshot, identities: IngredientIdentity[]): RowSnapshot {
  const known = new Set(snapshot.identities.map(identityKey));
  const added = identities.filter((i) => !known.has(identityKey(i)));
  if (added.length === 0) return snapshot;
  const now = snapshotRow(input, added);
  return {
    identities: [...snapshot.identities, ...now.identities],
    batches: snapshot.batches.map((b) => {
      const current = now.batches.find((c) => c.recipeBatchId === b.recipeBatchId && c.date === b.date);
      return { ...b, entries: [...b.entries, ...(current?.entries ?? [])] };
    }),
  };
}
