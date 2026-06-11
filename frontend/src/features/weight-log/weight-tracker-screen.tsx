import { useWeightLog } from '../../queries/use-weight-log';
import { useWeightTrend } from '../../queries/use-weight-trend';
import { WeightChart } from './weight-chart';
import { WeightStats } from './weight-stats';
import { WeightHistoryList } from './weight-history-list';
import { AppHeader } from '../../components/app/app-header';
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

  const header = <AppHeader title={de.weightLog.screenTitle} onBack={onBack} backAria={de.recipes.back} />;

  if (entriesQuery.isLoading || trendQuery.isLoading) {
    return (
      <>
        {header}
        <div className="space-y-3 p-4">
          <ListSkeleton rows={4} />
        </div>
      </>
    );
  }

  const error = entriesQuery.error ?? trendQuery.error;
  if (error) {
    return (
      <>
        {header}
        <div className="space-y-3 p-4">
          <ErrorBanner error={error} />
        </div>
      </>
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
    <>
      {header}
      <div className="space-y-4 p-4">
        {trend.firstEntryDate && (
          <p className="text-xs text-muted-foreground">
            {de.weightLog.coverage(trend.totalEntries, trend.firstEntryDate)}
          </p>
        )}
        <WeightStats trend={trend} />
        <WeightChart entries={entries} asOf={asOf} />
        <WeightHistoryList entries={entries} />
      </div>
    </>
  );
}
