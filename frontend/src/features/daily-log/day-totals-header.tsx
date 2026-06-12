import type { DayTotals } from '../../domain/meal-log';
import type { DailyGoal } from '../../domain/nutrition';
import { kcalStatus } from '../../domain/nutrition-progress';
import { HeaderMacroCell, type MacroKey } from '../../components/app/header-macro-cell';
import { de } from '../../i18n/de';

interface DayTotalsHeaderProps {
  totals: DayTotals;
  goal: DailyGoal | null | undefined;
}

function formatBadge(badge: NonNullable<ReturnType<typeof kcalStatus>['badge']>): string {
  if (badge.kind === 'reached') return de.dayTotals.reached;
  if (badge.kind === 'open') return de.dayTotals.kcalOpen(badge.diff);
  return de.dayTotals.kcalOver(badge.diff);
}

function MacroCell({
  macroKey,
  label,
  actual,
  goal,
}: {
  macroKey: MacroKey;
  label: string;
  actual: number;
  goal: number | undefined;
}) {
  const rounded = Math.round(actual);
  const valueText = goal !== undefined ? `${rounded} / ${goal} g` : `${rounded} g`;
  const pct = goal !== undefined && goal > 0 ? (actual / goal) * 100 : undefined;
  return <HeaderMacroCell macroKey={macroKey} label={label} valueText={valueText} pct={pct} />;
}

export function DayTotalsHeader({ totals, goal }: DayTotalsHeaderProps) {
  const kcal = kcalStatus(totals.calories, goal?.calories);
  const rounded = Math.round(totals.calories);
  const barWidth = kcal.pct === null ? 0 : Math.min(100, Math.max(0, kcal.pct));
  const kcalText = goal?.calories !== undefined ? `${rounded} / ${goal.calories} kcal` : `${rounded} kcal`;

  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-lg font-semibold text-white/90">{kcalText}</span>
        {kcal.badge && (
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium text-white/90">
            {formatBadge(kcal.badge)}
          </span>
        )}
      </div>

      {kcal.pct !== null && (
        <div
          role="progressbar"
          aria-valuenow={Math.round(kcal.pct)}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-1.5 overflow-hidden rounded-full bg-white/20"
        >
          <div
            data-testid="kcal-progress-fill"
            className="h-full rounded-full bg-white/40 transition-all"
            style={{ width: `${barWidth}%` }}
          />
        </div>
      )}

      <div className="flex gap-4">
        <MacroCell macroKey="p" label={de.dayTotals.protein} actual={totals.protein} goal={goal?.protein} />
        <MacroCell macroKey="c" label={de.dayTotals.carbs} actual={totals.carbs} goal={goal?.carbs} />
        <MacroCell macroKey="f" label={de.dayTotals.fat} actual={totals.fat} goal={goal?.fat} />
      </div>
    </div>
  );
}
