import { BookOpen, X } from 'lucide-react';
import type { LogEntry } from '../../domain/meal-log';
import { useRecipes } from '../../queries/use-recipes';
import { useRemoveRecipeLog } from '../../queries/use-remove-recipe-log';
import { EntryRow } from './entry-row';
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
  if (!first) return null;

  // Name resolves live via recipeId; a deleted recipe degrades to a generic label, the group stays.
  const recipeName = first.recipeId ? recipes?.find((r) => r.id === first.recipeId)?.name : undefined;
  const label = recipeName ?? de.entryList.fallbackRecipeName;

  return (
    <div data-testid={`recipe-batch-${batchId}`} className="rounded-md border bg-accent/5 px-2.5 pb-0.5 pt-1.5">
      <div className="flex items-center gap-1.5">
        <BookOpen size={13} aria-hidden="true" className="shrink-0 text-primary" />
        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-primary">{label}</span>
        {first.recipePortions !== undefined && (
          <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
            {de.entryList.portions(first.recipePortions)}
          </span>
        )}
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
          <EntryRow key={entry.id} entry={entry} hideRecipeHint />
        ))}
      </div>
    </div>
  );
}
