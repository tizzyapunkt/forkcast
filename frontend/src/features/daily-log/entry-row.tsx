import { useState } from 'react';
import type { FullIngredientEntry, LogEntry, QuickIngredientEntry } from '../../domain/meal-log';
import { useRecipes } from '../../queries/use-recipes';
import { EditEntryDrawer } from '../edit-remove/edit-entry-drawer';
import { RemoveEntryConfirm } from '../edit-remove/remove-entry-confirm';
import { InlineAmountInput } from './inline-amount-input';

interface EntryRowProps {
  entry: LogEntry;
}

export function EntryRow({ entry }: EntryRowProps) {
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const { ingredient } = entry;
  const { data: recipes } = useRecipes();
  const recipeName = entry.recipeId ? recipes?.find((r) => r.id === entry.recipeId)?.name : undefined;

  const label = ingredient.type === 'quick' ? ingredient.label : ingredient.name;
  const calories =
    ingredient.type === 'quick'
      ? ingredient.calories
      : Math.round(ingredient.macrosPerUnit.calories * ingredient.amount);

  return (
    <>
      <div className="flex items-center justify-between py-2 text-sm">
        <div className="flex flex-col gap-0.5">
          <span className="font-medium">{label}</span>
          {recipeName && (
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground" data-testid="recipe-hint">
              from {recipeName}
            </span>
          )}
          {ingredient.type === 'full' && (
            <InlineAmountInput entry={entry as LogEntry & { ingredient: FullIngredientEntry }} />
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-muted-foreground">{calories} kcal</span>
          {ingredient.type === 'quick' && (
            <button
              onClick={() => setEditing(true)}
              aria-label="Edit entry"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Edit
            </button>
          )}
          <button
            onClick={() => setRemoving(true)}
            aria-label="Remove entry"
            className="text-xs text-muted-foreground hover:text-destructive"
          >
            ✕
          </button>
        </div>
      </div>

      {editing && ingredient.type === 'quick' && (
        <EditEntryDrawer
          entry={entry as LogEntry & { ingredient: QuickIngredientEntry }}
          onClose={() => setEditing(false)}
        />
      )}
      {removing && (
        <RemoveEntryConfirm entry={entry} onConfirm={() => setRemoving(false)} onCancel={() => setRemoving(false)} />
      )}
    </>
  );
}
