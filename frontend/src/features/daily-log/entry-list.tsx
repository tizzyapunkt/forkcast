import { useState } from 'react';
import { BookOpen, Plus, X } from 'lucide-react';
import type { LogEntry } from '../../domain/meal-log';
import { useRecipes } from '../../queries/use-recipes';
import { useRemoveRecipeLog } from '../../queries/use-remove-recipe-log';
import { EntryRow } from './entry-row';
import { LogIngredientDrawer, type BatchTarget } from '../log-ingredient/log-ingredient-drawer';
import { CookedPortionsSheet } from './cooked-portions-sheet';
import { Button } from '../../components/ui/button';
import { de } from '../../i18n/de';

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
  if (!first) return null;

  // Name resolves live via recipeId; a deleted recipe degrades to a generic label, the group stays.
  const recipeName = first.recipeId ? recipes?.find((r) => r.id === first.recipeId)?.name : undefined;
  const label = recipeName ?? de.entryList.fallbackRecipeName;
  // Cooked portions only matter for the grocery list; unset means "cooked what was logged".
  const cooked = first.cookedPortions ?? first.recipePortions ?? 1;

  return (
    <div data-testid={`recipe-batch-${batchId}`} className="rounded-md border bg-accent/5 px-2.5 pb-0.5 pt-1.5">
      <div className="flex items-center gap-1.5">
        <BookOpen size={13} aria-hidden="true" className="shrink-0 text-primary" />
        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-primary">{label}</span>
        {first.recipePortions !== undefined && (
          <button
            type="button"
            onClick={() => setEditingCooked(true)}
            aria-label={de.entryList.cookedPortionsAria(label)}
            className="-my-1 flex shrink-0 items-center gap-1 rounded px-1 py-1 text-[11px] text-muted-foreground tabular-nums hover:text-foreground"
          >
            <span>{de.entryList.portions(first.recipePortions)}</span>
            {cooked !== first.recipePortions && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-medium text-primary">{de.entryList.cookedFor(cooked)}</span>
              </>
            )}
          </button>
        )}
        <Button
          variant="ghost"
          size="iconSm"
          onClick={() => setTarget({ kind: 'add', recipeBatchId: batchId, recipeName: label })}
          aria-label={de.entryList.addToGroupAria(label)}
          className="-my-1 text-primary"
        >
          <Plus size={14} aria-hidden="true" />
        </Button>
        <Button
          variant="quietDestructive"
          size="iconSm"
          onClick={() => removeMutation.mutate({ recipeBatchId: batchId, date: first.date })}
          disabled={removeMutation.isPending}
          aria-label={de.entryList.removeGroupAria(label)}
          className="-my-1"
        >
          <X size={14} aria-hidden="true" />
        </Button>
      </div>
      <div className="divide-y">
        {entries.map((entry) => (
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
