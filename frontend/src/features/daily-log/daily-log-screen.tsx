import { AppHeader } from '../../components/app/app-header';
import { ErrorBanner } from '../../components/app/error-banner';
import { ListSkeleton } from '../../components/app/loading-skeleton';
import { DateNav } from '../date-nav/date-nav';
import { useDailyLog } from '../../queries/use-daily-log';
import { useNutritionGoal } from '../../queries/use-nutrition-goal';
import { DayTotalsHeader } from './day-totals-header';
import { SlotCard } from './slot-card';
import { WeightLogCard } from '../weight-log/weight-log-card';
import { today } from '../../domain/date';
import type { DayTotals } from '../../domain/meal-log';

const ZERO_TOTALS: DayTotals = {
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  macrosPartial: false,
};

interface DailyLogScreenProps {
  date: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onOpenWeightTracker: () => void;
}

export function DailyLogScreen({ date, onPrev, onNext, onToday, onOpenWeightTracker }: DailyLogScreenProps) {
  const { data: log, isLoading, error } = useDailyLog(date);
  const { data: goal } = useNutritionGoal();
  const isToday = date === today();

  // Tagebuch keeps the "forkcast" wordmark as the home anchor (the one tab that does).
  const header = (
    <AppHeader bottom={<DayTotalsHeader totals={log?.totals ?? ZERO_TOTALS} goal={goal ?? null} />}>
      <DateNav date={date} onPrev={onPrev} onNext={onNext} onToday={onToday} />
    </AppHeader>
  );

  if (isLoading) {
    return (
      <>
        {header}
        <div data-testid="daily-log-skeleton" className="space-y-3 p-4">
          <ListSkeleton rows={4} />
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        {header}
        <div className="p-4">
          <ErrorBanner error={error} />
        </div>
      </>
    );
  }

  if (!log) return header;

  return (
    <>
      {header}
      <div className="space-y-3 p-4">
        {isToday && <WeightLogCard onOpenTracker={onOpenWeightTracker} />}
        {log.slots.map((summary) => (
          <SlotCard key={summary.slot} summary={summary} date={date} />
        ))}
      </div>
    </>
  );
}
