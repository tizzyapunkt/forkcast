import { useState } from 'react';
import { BookOpen, ChevronRight, Plus, X } from 'lucide-react';
import type { LogEntry } from '../../domain/meal-log';
import { useRecipes } from '../../queries/use-recipes';
import { useRemoveRecipeLog } from '../../queries/use-remove-recipe-log';
import { EntryRow } from './entry-row';
import { LogIngredientDrawer, type BatchTarget } from '../log-ingredient/log-ingredient-drawer';
import { CookedPortionsSheet } from './cooked-portions-sheet';
import { Button } from '../../components/ui/button';
import { cn } from '../../lib/cn';
import { t } from '../../i18n';

interface EntryListProps {
  entries: LogEntry[];
}

type Item = { kind: 'flat'; entries: LogEntry[] } | { kind: 'batch'; batchId: string; entries: LogEntry[] };

/**
 * Partitions a slot's entries into recipe-log batches (grouped by `recipeBatchId`) and runs of
 * ungrouped entries, preserving first-appearance order. Legacy recipe-sourced entries (recipeId
 * without batch metadata) stay ungrouped and keep their per-row hint.
 */
function partition(entries: LogEntry[]): Item[] {
  const items: Item[] = [];
  const batches = new Map<string, Item>();
  for (const entry of entries) {
    if (entry.recipeBatchId) {
      const existing = batches.get(entry.recipeBatchId);
      if (existing) {
        existing.entries.push(entry);
      } else {
        const item: Item = { kind: 'batch', batchId: entry.recipeBatchId, entries: [entry] };
        batches.set(entry.recipeBatchId, item);
        items.push(item);
      }
    } else {
      const last = items[items.length - 1];
      if (last?.kind === 'flat') last.entries.push(entry);
      else items.push({ kind: 'flat', entries: [entry] });
    }
  }
  return items;
}

/** Summed kcal and macros of a recipe batch, for its collapsed summary. Macros are null when a quick entry lacks them. */
function batchTotals(entries: LogEntry[]) {
  let calories = 0;
  let macros: { protein: number; carbs: number; fat: number } | null = { protein: 0, carbs: 0, fat: 0 };
  for (const { ingredient } of entries) {
    if (ingredient.type === 'full') {
      calories += Math.round(ingredient.macrosPerUnit.calories * ingredient.amount);
      if (macros) {
        macros.protein += ingredient.macrosPerUnit.protein * ingredient.amount;
        macros.carbs += ingredient.macrosPerUnit.carbs * ingredient.amount;
        macros.fat += ingredient.macrosPerUnit.fat * ingredient.amount;
      }
    } else {
      calories += ingredient.calories;
      if (
        macros &&
        ingredient.protein !== undefined &&
        ingredient.carbs !== undefined &&
        ingredient.fat !== undefined
      ) {
        macros.protein += ingredient.protein;
        macros.carbs += ingredient.carbs;
        macros.fat += ingredient.fat;
      } else {
        macros = null;
      }
    }
  }
  return { calories, macros };
}

/** Shared entry list for the daily log and the planner — same rows, same grouping, same flows. */
export function EntryList({ entries }: EntryListProps) {
  const items = partition(entries);
  return (
    <div className="space-y-2">
      {items.map((item, i) =>
        item.kind === 'batch' ? (
          <BatchGroup key={item.batchId} batchId={item.batchId} entries={item.entries} />
        ) : (
          <div key={`flat-${item.entries[0]?.id ?? i}`} className="divide-y">
            {item.entries.map((entry) => (
              <EntryRow key={entry.id} entry={entry} />
            ))}
          </div>
        ),
      )}
    </div>
  );
}

function BatchGroup({ batchId, entries }: { batchId: string; entries: LogEntry[] }) {
  const first = entries[0];
  const { data: recipes } = useRecipes();
  const removeMutation = useRemoveRecipeLog();
  const [target, setTarget] = useState<BatchTarget | null>(null);
  const [editingCooked, setEditingCooked] = useState(false);
  // Collapsed by default: a logged recipe reads as one meal; its ingredients are a tap away.
  const [expanded, setExpanded] = useState(false);
  if (!first) return null;

  // Name resolves live via recipeId; a deleted recipe degrades to a generic label, the group stays.
  const recipeName = first.recipeId ? recipes?.find((r) => r.id === first.recipeId)?.name : undefined;
  const label = recipeName ?? t.entryList.fallbackRecipeName;
  // Cooked portions only matter for the grocery list; unset means "cooked what was logged".
  const cooked = first.cookedPortions ?? first.recipePortions ?? 1;
  const totals = batchTotals(entries);

  return (
    <div data-testid={`recipe-batch-${batchId}`} className="rounded-md border bg-accent/5 px-2.5 pb-0.5 pt-1.5">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
          aria-controls={`recipe-batch-${batchId}-entries`}
          aria-label={t.entryList.toggleIngredientsAria(label)}
          className="-my-1 flex min-w-0 flex-1 items-center gap-1.5 rounded-sm py-1 text-left text-primary"
        >
          <ChevronRight
            size={13}
            aria-hidden="true"
            className={cn('shrink-0 transition-transform', expanded && 'rotate-90')}
          />
          <BookOpen size={13} aria-hidden="true" className="shrink-0" />
          <span className="min-w-0 flex-1 truncate text-xs font-semibold">{label}</span>
        </button>
        {first.recipePortions !== undefined && (
          <button
            type="button"
            onClick={() => setEditingCooked(true)}
            aria-label={t.entryList.cookedPortionsAria(label)}
            className="-my-1 flex shrink-0 items-center gap-1 rounded-sm px-1 py-1 text-[11px] text-muted-foreground tabular-nums hover:text-foreground"
          >
            <span>{t.entryList.portions(first.recipePortions)}</span>
            {cooked !== first.recipePortions && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-medium text-primary">{t.entryList.cookedFor(cooked)}</span>
              </>
            )}
          </button>
        )}
        <Button
          variant="ghost"
          size="iconSm"
          onClick={() => setTarget({ kind: 'add', recipeBatchId: batchId, recipeName: label })}
          aria-label={t.entryList.addToGroupAria(label)}
          className="-my-1 text-primary"
        >
          <Plus size={14} aria-hidden="true" />
        </Button>
        <Button
          variant="quietDestructive"
          size="iconSm"
          onClick={() => removeMutation.mutate({ recipeBatchId: batchId, date: first.date })}
          disabled={removeMutation.isPending}
          aria-label={t.entryList.removeGroupAria(label)}
          className="-my-1"
        >
          <X size={14} aria-hidden="true" />
        </Button>
      </div>
      {!expanded && (
        <div className="flex items-baseline justify-between gap-2 py-2 text-sm">
          <span className="text-muted-foreground">{t.entryList.ingredientCount(entries.length)}</span>
          <span className="flex min-w-0 flex-wrap items-baseline justify-end gap-x-1.5 text-right text-muted-foreground">
            <span className="whitespace-nowrap">
              {totals.calories}
              {t.dailyLog.kcalSuffix}
            </span>
            {totals.macros && (
              <span className="whitespace-nowrap text-xs">
                {t.dailyLog.macroInline(totals.macros.protein, totals.macros.carbs, totals.macros.fat)}
              </span>
            )}
          </span>
        </div>
      )}
      <div id={`recipe-batch-${batchId}-entries`} hidden={!expanded} className="divide-y">
        {expanded &&
          entries.map((entry) => (
            <EntryRow
              key={entry.id}
              entry={entry}
              hideRecipeHint
              onReplace={
                entry.ingredient.type === 'full'
                  ? () => setTarget({ kind: 'replace', entry, recipeName: label })
                  : undefined
              }
            />
          ))}
      </div>

      {editingCooked && first.recipePortions !== undefined && (
        <CookedPortionsSheet
          open
          recipeBatchId={batchId}
          date={first.date}
          recipeName={label}
          loggedPortions={first.recipePortions}
          cookedPortions={cooked}
          onClose={() => setEditingCooked(false)}
        />
      )}

      <LogIngredientDrawer
        open={target !== null}
        slot={first.slot}
        date={first.date}
        target={target ?? undefined}
        onClose={() => setTarget(null)}
      />
    </div>
  );
}
