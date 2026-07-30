import { Plus } from 'lucide-react';
import type { SlotSummary } from '../../domain/meal-log';
import { de, slotLabelsDe } from '../../i18n/de';
import { LogIngredientDrawer } from '../log-ingredient/log-ingredient-drawer';
import { useLogIngredientDrawer } from '../log-ingredient/use-log-ingredient-drawer';
import { EntryList } from './entry-list';
import { Card } from '../../components/ui/card';

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
      <Card>
        <div className="mb-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{slotLabelsDe[summary.slot]}</h2>
            <div className="flex items-center gap-2">
              {totals.calories > 0 && (
                <span className="text-sm font-bold text-primary tabular-nums">
                  {Math.round(totals.calories)}
                  {de.dailyLog.kcalSuffix}
                </span>
              )}
              <button
                onClick={() => openDrawer(summary.slot)}
                aria-label={de.dailyLog.add}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-primary hover:bg-accent/20"
              >
                <Plus size={20} aria-hidden="true" />
              </button>
            </div>
          </div>
          {hasMacros && (
            <div className="text-xs text-muted-foreground">
              {de.dailyLog.macroInline(totals.protein, totals.carbs, totals.fat).replace(/^·\s*/, '')}
            </div>
          )}
        </div>
        {summary.entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">{de.dailyLog.nothingLogged}</p>
        ) : (
          <EntryList entries={summary.entries} />
        )}
      </Card>

      <LogIngredientDrawer open={isOpen} slot={slot} date={date} onClose={closeDrawer} />
    </>
  );
}
