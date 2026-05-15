import { useDailyLog } from '../../queries/use-daily-log';
import { ErrorBanner } from '../../components/app/error-banner';
import { ListSkeleton } from '../../components/app/loading-skeleton';
import { SlotCard } from './slot-card';
import { WeightLogCard } from '../weight-log/weight-log-card';
import { today } from '../../domain/date';

interface DailyLogScreenProps {
  date: string;
  onOpenWeightTracker: () => void;
}

export function DailyLogScreen({ date, onOpenWeightTracker }: DailyLogScreenProps) {
  const { data: log, isLoading, error } = useDailyLog(date);
  const isToday = date === today();

  if (isLoading) {
    return (
      <div data-testid="daily-log-skeleton" className="space-y-3 p-4">
        <ListSkeleton rows={4} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <ErrorBanner error={error} />
      </div>
    );
  }

  if (!log) return null;

  return (
    <div className="space-y-3 p-4">
      {isToday && <WeightLogCard onOpenTracker={onOpenWeightTracker} />}
      {log.slots.map((summary) => (
        <SlotCard key={summary.slot} summary={summary} date={date} />
      ))}
    </div>
  );
}
