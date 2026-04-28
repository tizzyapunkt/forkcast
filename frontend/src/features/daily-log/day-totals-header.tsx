import type { DayTotals } from '../../domain/meal-log';
import type { DailyGoal } from '../../domain/nutrition';
import { kcalStatus, macroStatus, type ProgressColor } from '../../domain/nutrition-progress';

interface DayTotalsHeaderProps {
  totals: DayTotals;
  goal: DailyGoal | null | undefined;
}

const TEXT_CLASS: Record<ProgressColor, string> = {
  green: 'text-success',
  yellow: 'text-warning',
  red: 'text-error',
  neutral: 'text-white/90',
};

const FILL_CLASS: Record<ProgressColor, string> = {
  green: 'bg-success',
  yellow: 'bg-warning',
  red: 'bg-error',
  neutral: 'bg-white/40',
};

function formatBadge(badge: NonNullable<ReturnType<typeof kcalStatus>['badge']>): string {
  if (badge.kind === 'reached') return '✓ erreicht';
  if (badge.kind === 'open') return `${badge.diff} kcal offen`;
  return `${badge.diff} kcal über Ziel`;
}

function MacroCell({ label, actual, goal }: { label: string; actual: number; goal: number | undefined }) {
  const { color } = macroStatus(actual, goal);
  const rounded = Math.round(actual);
  const valueText = goal !== undefined ? `${rounded} / ${goal} g` : `${rounded} g`;
  return (
    <div className="flex flex-col items-center text-xs">
      <span className="text-white/70">{label}</span>
      <span className={`font-medium ${TEXT_CLASS[color]}`}>{valueText}</span>
    </div>
  );
}

export function DayTotalsHeader({ totals, goal }: DayTotalsHeaderProps) {
  const kcal = kcalStatus(totals.calories, goal?.calories);
  const rounded = Math.round(totals.calories);
  const barWidth = kcal.pct === null ? 0 : Math.min(100, Math.max(0, kcal.pct));
  const kcalText = goal?.calories !== undefined ? `${rounded} / ${goal.calories} kcal` : `${rounded} kcal`;

  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className={`text-lg font-semibold ${TEXT_CLASS[kcal.color]}`}>{kcalText}</span>
        {kcal.badge && (
          <span className={`rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium ${TEXT_CLASS[kcal.color]}`}>
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
            className={`h-full rounded-full transition-all ${FILL_CLASS[kcal.color]}`}
            style={{ width: `${barWidth}%` }}
          />
        </div>
      )}

      <div className="flex justify-between gap-2">
        <MacroCell label="Protein" actual={totals.protein} goal={goal?.protein} />
        <MacroCell label="Carbs" actual={totals.carbs} goal={goal?.carbs} />
        <MacroCell label="Fat" actual={totals.fat} goal={goal?.fat} />
      </div>
    </div>
  );
}
