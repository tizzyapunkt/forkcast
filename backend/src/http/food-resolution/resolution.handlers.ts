import type { Context } from 'hono';
import { proposeResolutions } from '../../domain/food-resolution/propose-resolutions.use-case.ts';
import {
  confirmResolution,
  type ConfirmResolutionInput,
  type SynonymRegistrar,
} from '../../domain/food-resolution/confirm-resolution.use-case.ts';
import {
  FoodResolutionError,
  type FoodResolutionProposer,
  type ResolutionCandidateFinder,
  type ResolutionItem,
} from '../../domain/food-resolution/types.ts';
import type { FoodEntry } from '../../domain/foods/types.ts';
import type { OriginalDraftFields } from '../../domain/ai-recipe-import/build-matched-row.ts';
import type { UserFoodsStore } from '../../domain/user-foods/types.ts';

// ── propose ──────────────────────────────────────────────────────────────────

export interface ProposeResolutionsHandlerDeps {
  candidates: ResolutionCandidateFinder;
  proposer: FoodResolutionProposer;
}

export function makeUnconfiguredProposeResolutionsHandler() {
  return (c: Context) => c.json({ error: 'ai-import-not-configured' }, 503);
}

function parseItems(raw: unknown): ResolutionItem[] | null {
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as { items?: unknown }).items)) return null;
  const items = (raw as { items: unknown[] }).items;
  const parsed: ResolutionItem[] = [];
  for (const it of items) {
    if (!it || typeof it !== 'object') return null;
    const o = it as Record<string, unknown>;
    if (typeof o.name !== 'string' || o.name.trim().length === 0) return null;
    const item: ResolutionItem = { name: o.name };
    if (typeof o.note === 'string') item.note = o.note;
    if (o.unit === 'g' || o.unit === 'ml' || o.unit === null) item.unit = o.unit;
    if (typeof o.amount === 'number' || o.amount === null) item.amount = o.amount as number | null;
    parsed.push(item);
  }
  return parsed;
}

export function makeProposeResolutionsHandler(deps: ProposeResolutionsHandlerDeps) {
  return async (c: Context) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }
    const items = parseItems(body);
    if (items === null) return c.json({ error: 'Body must be { items: [{ name, ... }] }' }, 400);
    if (items.length === 0) return c.json({ proposals: [] });

    try {
      const proposals = await proposeResolutions(deps, items);
      return c.json({ proposals });
    } catch (err) {
      if (err instanceof FoodResolutionError) {
        return c.json({ error: 'ai-resolution-failed', detail: err.message }, 502);
      }
      const message = err instanceof Error ? err.message : 'Unknown error';
      return c.json({ error: message }, 400);
    }
  };
}

// ── confirm ──────────────────────────────────────────────────────────────────

export interface ConfirmResolutionHandlerDeps {
  overlay: UserFoodsStore;
  curated: SynonymRegistrar;
}

function parseOriginal(raw: unknown): OriginalDraftFields {
  if (!raw || typeof raw !== 'object') return {};
  const o = raw as Record<string, unknown>;
  const fields: OriginalDraftFields = {};
  if (typeof o.amount === 'number' || o.amount === null) fields.amount = o.amount as number | null;
  if (o.unit === 'g' || o.unit === 'ml' || o.unit === null) fields.unit = o.unit;
  if (o.pieceQuantity && typeof o.pieceQuantity === 'object')
    fields.pieceQuantity = o.pieceQuantity as OriginalDraftFields['pieceQuantity'];
  if (typeof o.note === 'string') fields.note = o.note;
  if (typeof o.rawDisplayAmount === 'number') fields.rawDisplayAmount = o.rawDisplayAmount;
  if (typeof o.rawDisplayUnitLabel === 'string') fields.rawDisplayUnitLabel = o.rawDisplayUnitLabel;
  return fields;
}

function parseConfirmInput(raw: unknown): ConfirmResolutionInput | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const original = parseOriginal(o.original);
  if (o.kind === 'new-food') {
    if (!o.entry || typeof o.entry !== 'object') return null;
    return { kind: 'new-food', entry: o.entry as FoodEntry, original };
  }
  if (o.kind === 'synonym') {
    if (typeof o.foodId !== 'string' || typeof o.synonym !== 'string') return null;
    return { kind: 'synonym', foodId: o.foodId, synonym: o.synonym, original };
  }
  return null;
}

export function makeConfirmResolutionHandler(deps: ConfirmResolutionHandlerDeps) {
  return async (c: Context) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }
    const input = parseConfirmInput(body);
    if (input === null) {
      return c.json({ error: 'Body must be { kind: "new-food", entry } or { kind: "synonym", foodId, synonym }' }, 400);
    }
    const result = await confirmResolution(deps, input);
    if (!result.ok) return c.json({ error: result.error }, result.status);
    return c.json({ ingredient: result.ingredient });
  };
}

// ── export-and-clear ───────────────────────────────────────────────────────────

export interface ExportUserFoodsHandlerDeps {
  overlay: UserFoodsStore;
  /** The curated index whose learned synonyms must be dropped when the overlay drains. */
  curated: { clearLearnedSynonyms(): void };
}

export function makeExportUserFoodsHandler(deps: ExportUserFoodsHandlerDeps) {
  return async (c: Context) => {
    const content = await deps.overlay.exportAndClear();
    deps.curated.clearLearnedSynonyms();
    return c.json(content);
  };
}

/** Non-destructive read of the overlay, used by the settings panel to show the pending count. */
export function makeGetUserFoodsHandler(overlay: UserFoodsStore) {
  return async (c: Context) => c.json(await overlay.load());
}
