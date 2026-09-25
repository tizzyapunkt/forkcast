import { ingredientIdentityKey } from '../meal-log/ingredient-identity.ts';
import type { PieceWeight } from '../foods/types.ts';
import type { Contribution, GroceryItem, PieceHint } from './types.ts';

/** Catalog piece size for a food, when it has one — the fold stays free of catalog lookups. */
export type PieceSizeLookup = (name: string, unit: string) => PieceWeight | null;

// Scaled amounts carry float noise (250 × 3/3 = 250.00000000000003); don't let it round up a whole unit.
const EPSILON = 1e-9;

function roundUp(n: number): number {
  return Math.ceil(n - EPSILON);
}

/**
 * Combine per-date contributions into one grocery item per food identity (case-insensitive name + unit,
 * the meal log's identity rule). Tracked items come first, then untracked ones, each alphabetical.
 */
export function foldContributions(contributions: Contribution[], pieceSizeFor: PieceSizeLookup): GroceryItem[] {
  const groups = new Map<string, Contribution[]>();
  for (const contribution of contributions) {
    const key = ingredientIdentityKey(contribution.name, contribution.unit);
    const group = groups.get(key);
    if (group) group.push(contribution);
    else groups.set(key, [contribution]);
  }

  const items: GroceryItem[] = [];
  for (const group of groups.values()) {
    // Most recent spelling wins; among contributions on the same date, the later one.
    const latest = group.reduce((a, b) => (b.date >= a.date ? b : a));
    const amount = roundUp(group.reduce((sum, c) => sum + c.amount, 0));
    const item: GroceryItem = {
      name: latest.name,
      unit: latest.unit,
      amount,
      untracked: group.every((c) => c.untracked),
      dates: [...new Set(group.map((c) => c.date))].sort(),
    };
    const hint = pieceHint(amount, pieceSizeFor(latest.name, latest.unit));
    if (hint) item.pieceHint = hint;
    items.push(item);
  }

  return items.sort(
    (a, b) =>
      Number(a.untracked) - Number(b.untracked) ||
      a.name.localeCompare(b.name, 'de', { sensitivity: 'base' }) ||
      a.unit.localeCompare(b.unit),
  );
}

function pieceHint(amount: number, piece: PieceWeight | null): PieceHint | undefined {
  if (!piece || piece.grams <= 0 || amount <= 0) return undefined;
  return { count: roundUp(amount / piece.grams), label: piece.label };
}
