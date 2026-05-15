import { useWeightLog } from '../../queries/use-weight-log';
import { useWeightTrend } from '../../queries/use-weight-trend';
import { WeightChart } from './weight-chart';
import { WeightStats } from './weight-stats';
import { WeightHistoryList } from './weight-history-list';
import { ErrorBanner } from '../../components/app/error-banner';
import { ListSkeleton } from '../../components/app/loading-skeleton';
import { de } from '../../i18n/de';
import { today } from '../../domain/date';

interface WeightTrackerScreenProps {
  onBack: () => void;
}

export function WeightTrackerScreen({ onBack }: WeightTrackerScreenProps) {
  const asOf = today();
  const entriesQuery = useWeightLog();
  const trendQuery = useWeightTrend();

  if (entriesQuery.isLoading || trendQuery.isLoading) {
    return (
      <div className="space-y-3 p-4">
        <ListSkeleton rows={4} />
      </div>
    );
  }

  const error = entriesQuery.error ?? trendQuery.error;
  if (error) {
    return (
      <div className="space-y-3 p-4">
        <BackBar onBack={onBack} />
        <ErrorBanner error={error} />
      </div>
    );
  }

  const entries = entriesQuery.data ?? [];
  const trend = trendQuery.data ?? {
    current: null,
    movingAverage7d: null,
    weeklyRatePercent: null,
    changePercent28d: null,
    totalChangePercent: null,
    firstEntryDate: null,
    lastEntryDate: null,
    totalEntries: 0,
  };

  return (
    <div className="space-y-4 p-4">
      <BackBar onBack={onBack} />
      <h2 className="text-base font-semibold">{de.weightLog.screenTitle}</h2>
      {trend.firstEntryDate && (
        <p className="text-xs text-muted-foreground">
          {de.weightLog.coverage(trend.totalEntries, trend.firstEntryDate)}
        </p>
      )}
      <WeightStats trend={trend} />
      <WeightChart entries={entries} asOf={asOf} />
      <WeightHistoryList entries={entries} />
    </div>
  );
}

function BackBar({ onBack }: { onBack: () => void }) {
  return (
    <button type="button" onClick={onBack} className="text-sm text-primary">
      ← {de.recipes.back}
    </button>
  );
}
