import { useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Copy, Plus, ShoppingCart } from 'lucide-react';
import { useWeekLog } from '../../queries/use-week-log';
import { useNutritionGoal } from '../../queries/use-nutrition-goal';
import { useCopyLogDay } from '../../queries/use-copy-log-day';
import { LogIngredientDrawer } from '../log-ingredient/log-ingredient-drawer';
import { GroceryListSheet } from '../grocery-list/grocery-list-sheet';
import { EntryList } from '../daily-log/entry-list';
import { AppHeader } from '../../components/app/app-header';
import { HeaderMacroCell } from '../../components/app/header-macro-cell';
import { ErrorBanner } from '../../components/app/error-banner';
import { ListSkeleton } from '../../components/app/loading-skeleton';
import { addDays, mondayOf, today } from '../../domain/date';
import { dayHasEntries, dayTone, plannedDaysCount, type DayTone } from './week-rollup';
import { t } from '../../i18n';
import { formatShortDate, formatWeekRange } from '../../i18n/format';
import type { DailyLog, MealSlot } from '../../domain/meal-log';
import type { DailyGoal } from '../../domain/nutrition';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';

const SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];

function r(n: number): number {
  return Math.round(n);
}

function weekdayIndexOf(iso: string): number {
  const jsDay = new Date(iso + 'T00:00:00').getDay(); // 0=Sun..6=Sat
  return jsDay === 0 ? 6 : jsDay - 1; // 0=Mo..6=So
}

function indexInWeek(iso: string, weekStart: string): number {
  const ms = new Date(iso + 'T00:00:00').getTime() - new Date(weekStart + 'T00:00:00').getTime();
  return Math.round(ms / 86_400_000);
}

const MACRO_BASE_CLASS = { p: 'bg-macro-p', c: 'bg-macro-c', f: 'bg-macro-f' } as const;

// TAG GESAMT cell on the light card background — base macro identity colors.
function DayMacroCell({
  macroKey,
  label,
  actual,
  goal,
}: {
  macroKey: 'p' | 'c' | 'f';
  label: string;
  actual: number;
  goal: number;
}) {
  const pct = goal > 0 ? Math.min(100, Math.max(0, (actual / goal) * 100)) : 0;
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1 text-xs">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${MACRO_BASE_CLASS[macroKey]}`} />
        {label}
      </span>
      <span className="font-medium tabular-nums">{`${Math.round(actual)} / ${goal} g`}</span>
      <span className="block h-1 overflow-hidden rounded-full bg-border/60">
        <span className={`block h-1 rounded-full ${MACRO_BASE_CLASS[macroKey]}`} style={{ width: `${pct}%` }} />
      </span>
    </div>
  );
}

function toneClass(tone: DayTone): string {
  switch (tone) {
    case 'empty':
      return 'text-muted-foreground';
    case 'onTarget':
      return 'text-success-ink';
    case 'over':
      return 'text-warning-ink';
    default:
      return 'text-primary';
  }
}

// The day's kcal bar follows the same tone as its kcal line, so an over-goal day stops looking on track.
function barClass(tone: DayTone): string {
  switch (tone) {
    case 'onTarget':
      return 'bg-success';
    case 'over':
      return 'bg-warning';
    default:
      return 'bg-primary';
  }
}

export function PlannerScreen() {
  const todayStr = today();
  const [weekStart, setWeekStart] = useState<string>(() => mondayOf(todayStr));
  const [expanded, setExpanded] = useState<number>(() => {
    const i = indexInWeek(todayStr, mondayOf(todayStr));
    return i >= 0 && i < 7 ? i : 0;
  });
  const [target, setTarget] = useState<{ date: string; slot: MealSlot } | null>(null);
  const [groceryListOpen, setGroceryListOpen] = useState(false);
  const [copyConfirm, setCopyConfirm] = useState<{ fromDate: string; toDate: string; dayLabel: string } | null>(null);

  const { data: week, isLoading, error } = useWeekLog(weekStart);
  const { data: goal } = useNutritionGoal();
  const copyMutation = useCopyLogDay();

  const weekEnd = addDays(weekStart, 6);

  function goPrevWeek() {
    setWeekStart((s) => addDays(s, -7));
  }
  function goNextWeek() {
    setWeekStart((s) => addDays(s, 7));
  }

  return (
    <>
      <AppHeader
        title={t.planner.title}
        bottom={
          week ? (
            <div className="mt-1.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs text-white/80 tabular-nums">
                  <span className="text-sm font-semibold text-white">
                    {t.planner.avgPerDay(r(week.averages.calories))}
                  </span>
                  <span>{t.planner.plannedDays(plannedDaysCount(week.days))}</span>
                </div>
                <Button
                  variant="onDark"
                  size="sm"
                  onClick={() => setGroceryListOpen(true)}
                  aria-label={t.planner.groceryListAria(formatWeekRange(weekStart, weekEnd))}
                  className="shrink-0"
                >
                  <ShoppingCart size={14} aria-hidden="true" />
                  {t.planner.groceryList}
                </Button>
              </div>
              {goal ? (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-white/60">
                    {t.planner.avgMacrosLabel}
                  </p>
                  <div className="mt-1 flex gap-4">
                    <HeaderMacroCell
                      macroKey="p"
                      label={t.dayTotals.protein}
                      valueText={`${r(week.averages.protein)} / ${goal.protein} g`}
                      pct={goal.protein > 0 ? (week.averages.protein / goal.protein) * 100 : 0}
                    />
                    <HeaderMacroCell
                      macroKey="c"
                      label={t.dayTotals.carbs}
                      valueText={`${r(week.averages.carbs)} / ${goal.carbs} g`}
                      pct={goal.carbs > 0 ? (week.averages.carbs / goal.carbs) * 100 : 0}
                    />
                    <HeaderMacroCell
                      macroKey="f"
                      label={t.dayTotals.fat}
                      valueText={`${r(week.averages.fat)} / ${goal.fat} g`}
                      pct={goal.fat > 0 ? (week.averages.fat / goal.fat) * 100 : 0}
                    />
                  </div>
                </div>
              ) : (
                <span className="text-xs text-white/80 tabular-nums">
                  {t.planner.avgMacrosLabel}:{' '}
                  {t.planner.macroLine(r(week.averages.protein), r(week.averages.carbs), r(week.averages.fat))}
                </span>
              )}
            </div>
          ) : null
        }
      >
        <div className="flex items-center gap-1">
          <Button variant="onDark" size="iconSm" onClick={goPrevWeek} aria-label={t.planner.prevWeek}>
            <ChevronLeft size={20} aria-hidden="true" />
          </Button>
          <span className="min-w-[7rem] text-center text-sm font-medium tabular-nums">
            {formatWeekRange(weekStart, weekEnd)}
          </span>
          <Button variant="onDark" size="iconSm" onClick={goNextWeek} aria-label={t.planner.nextWeek}>
            <ChevronRight size={20} aria-hidden="true" />
          </Button>
        </div>
      </AppHeader>
      <div className="space-y-3 p-4">
        {error && <ErrorBanner error={error} />}
        {isLoading && <ListSkeleton rows={7} />}

        {week && (
          <ul className="space-y-2">
            {week.days.map((day, i) => (
              <DaySection
                key={day.date}
                day={day}
                index={i}
                open={expanded === i}
                goal={goal ?? null}
                onToggle={() => setExpanded((cur) => (cur === i ? -1 : i))}
                onAdd={(slot) => setTarget({ date: day.date, slot })}
                onCopy={() =>
                  setCopyConfirm({
                    fromDate: day.date,
                    toDate: addDays(day.date, 1),
                    dayLabel: t.planner.weekdaysLong[weekdayIndexOf(day.date)] ?? formatShortDate(day.date),
                  })
                }
              />
            ))}
          </ul>
        )}

        {/* Mounted only while open, so ticks reset every time the list is reopened. */}
        {groceryListOpen && (
          <GroceryListSheet
            startDate={weekStart}
            rangeLabel={formatWeekRange(weekStart, weekEnd)}
            onClose={() => setGroceryListOpen(false)}
          />
        )}

        {copyConfirm && (
          <Card padding="sm">
            <p className="mb-1 text-sm font-medium">{t.planner.copyDayTitle(copyConfirm.dayLabel)}</p>
            <p className="mb-2 text-xs text-muted-foreground">{t.planner.copyDayBody}</p>
            {copyMutation.error && <ErrorBanner error={copyMutation.error} />}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setCopyConfirm(null)} className="flex-1 px-3">
                {t.recipeForm.cancel}
              </Button>
              <Button
                disabled={copyMutation.isPending}
                onClick={() =>
                  copyMutation.mutate(
                    { fromDate: copyConfirm.fromDate, toDate: copyConfirm.toDate },
                    { onSuccess: () => setCopyConfirm(null) },
                  )
                }
                className="flex-1 px-3"
              >
                {t.planner.copyDayConfirm(t.planner.weekdaysLong[weekdayIndexOf(copyConfirm.toDate)] ?? '')}
              </Button>
            </div>
          </Card>
        )}

        <LogIngredientDrawer
          open={target !== null}
          slot={target?.slot ?? null}
          date={target?.date ?? todayStr}
          onClose={() => setTarget(null)}
        />
      </div>
    </>
  );
}

interface DaySectionProps {
  day: DailyLog;
  index: number;
  open: boolean;
  goal: DailyGoal | null;
  onToggle: () => void;
  onAdd: (slot: MealSlot) => void;
  onCopy: () => void;
}

function DaySection({ day, open, goal, onToggle, onAdd, onCopy }: DaySectionProps) {
  const goalKcal = goal?.calories ?? 0;
  const tone = dayTone(day.totals.calories, goalKcal);
  const hasEntries = dayHasEntries(day);
  const label = formatShortDate(day.date);
  const pct = goalKcal > 0 ? Math.min(100, (day.totals.calories / goalKcal) * 100) : 0;

  return (
    <li className="overflow-hidden rounded-lg border bg-card">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-label={t.planner.expandDayAria(label)}
        className="flex w-full items-center gap-3 p-3 text-left"
      >
        <span className="w-12 shrink-0 text-center">
          <span className="block text-sm font-semibold">{t.planner.weekdays[weekdayIndexOf(day.date)]}</span>
          <span className="block whitespace-nowrap text-[11px] leading-tight text-muted-foreground">{label}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className={`text-sm font-medium tabular-nums ${toneClass(tone)}`}>
              {goalKcal > 0
                ? t.planner.goalLine(r(day.totals.calories), r(goalKcal))
                : `${r(day.totals.calories)} kcal`}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              {hasEntries
                ? t.planner.macroLine(r(day.totals.protein), r(day.totals.carbs), r(day.totals.fat))
                : t.planner.empty}
            </span>
          </span>
          <span className="mt-1 block h-1 overflow-hidden rounded-full bg-muted">
            <span className={`block h-1 rounded-full ${barClass(tone)}`} style={{ width: `${pct}%` }} />
          </span>
        </span>
        {open ? (
          <ChevronUp size={18} aria-hidden="true" className="shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown size={18} aria-hidden="true" className="shrink-0 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="border-t px-3 pb-3 pt-2">
          {hasEntries && goal && (
            <div className="mb-2 rounded-md bg-muted p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t.planner.dayTotal}
              </p>
              <div className="mt-1.5 flex gap-4">
                <DayMacroCell
                  macroKey="p"
                  label={t.dayTotals.protein}
                  actual={day.totals.protein}
                  goal={goal.protein}
                />
                <DayMacroCell macroKey="c" label={t.dayTotals.carbs} actual={day.totals.carbs} goal={goal.carbs} />
                <DayMacroCell macroKey="f" label={t.dayTotals.fat} actual={day.totals.fat} goal={goal.fat} />
              </div>
            </div>
          )}
          <ul className="divide-y">
            {SLOTS.map((slot) => {
              const summary = day.slots.find((s) => s.slot === slot);
              const entries = summary?.entries ?? [];
              return (
                <li key={slot} className="py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{t.slotLabels[slot]}</span>
                    <div className="flex items-center gap-2">
                      {entries.length > 0 && (
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {r(summary?.totals.calories ?? 0)} kcal
                        </span>
                      )}
                      <Button
                        variant="accent"
                        size="icon"
                        onClick={() => onAdd(slot)}
                        aria-label={t.planner.addToSlotAria(t.slotLabels[slot], label)}
                      >
                        <Plus size={20} aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                  {entries.length > 0 && (
                    <div className="mt-1">
                      <EntryList entries={entries} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={onCopy}
            className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-muted px-3 py-2 text-xs font-medium hover:bg-secondary"
          >
            <Copy size={14} aria-hidden="true" />
            {t.planner.copyDay}
          </button>
        </div>
      )}
    </li>
  );
}
