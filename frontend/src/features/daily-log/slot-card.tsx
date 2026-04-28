import type { SlotSummary } from '../../domain/meal-log';
import { LogIngredientDrawer } from '../log-ingredient/log-ingredient-drawer';
import { useLogIngredientDrawer } from '../log-ingredient/use-log-ingredient-drawer';
import { EntryRow } from './entry-row';

const SLOT_LABELS: Record<string, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};

interface SlotCardProps {
  summary: SlotSummary;
  date: string;
}

export function SlotCard({ summary, date }: SlotCardProps) {
  const { isOpen, slot, openDrawer, closeDrawer } = useLogIngredientDrawer();
  const { totals } = summary;
  const hasMacros =
    !totals.macrosPartial && totals.calories > 0 && (totals.protein > 0 || totals.carbs > 0 || totals.fat > 0);

  return (
    <>
      <section className="rounded-lg border bg-card p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">{SLOT_LABELS[summary.slot]}</h2>
          <div className="flex items-center gap-2">
            {totals.calories > 0 && (
              <span className="text-sm text-muted-foreground">
                {Math.round(totals.calories)} kcal
                {hasMacros && (
                  <span className="ml-1.5 text-xs">
                    · {Math.round(totals.protein)}g P · {Math.round(totals.carbs)}g C · {Math.round(totals.fat)}g F
                  </span>
                )}
              </span>
            )}
            <button
              onClick={() => openDrawer(summary.slot)}
              aria-label="Add"
              className="rounded-full px-1 text-xl leading-none text-muted-foreground hover:text-foreground"
            >
              +
            </button>
          </div>
        </div>
        {summary.entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing logged</p>
        ) : (
          <div className="divide-y">
            {summary.entries.map((entry) => (
              <EntryRow key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </section>

      <LogIngredientDrawer open={isOpen} slot={slot} date={date} onClose={closeDrawer} />
    </>
  );
}
