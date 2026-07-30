import type { TrendSnapshot } from '../../domain/weight-log';
import { de } from '../../i18n/de';
import { Card } from '../../components/ui/card';

interface WeightStatsProps {
  trend: TrendSnapshot;
}

const DASH = '—';

function formatKg(value: number | null): string {
  return value === null ? DASH : `${value.toFixed(1)} kg`;
}

function formatPct(value: number | null): string {
  if (value === null) return DASH;
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)} %`;
}

export function WeightStats({ trend }: WeightStatsProps) {
  return (
    <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5" aria-label="Trend">
      <StatCard
        title={de.weightLog.statsCurrent}
        value={formatKg(trend.current)}
        hint={trend.current === null ? de.weightLog.statsHintCurrent : undefined}
      />
      <StatCard
        title={de.weightLog.statsMa7}
        value={formatKg(trend.movingAverage7d)}
        hint={trend.movingAverage7d === null ? de.weightLog.statsHintInsufficient : undefined}
      />
      <StatCard
        title={de.weightLog.statsWeekly}
        value={formatPct(trend.weeklyRatePercent)}
        hint={trend.weeklyRatePercent === null ? de.weightLog.statsHintInsufficient : undefined}
      />
      <StatCard
        title={de.weightLog.statsMonthly}
        value={formatPct(trend.changePercent28d)}
        hint={trend.changePercent28d === null ? de.weightLog.statsHint28d : undefined}
      />
      <StatCard
        title={de.weightLog.statsTotal}
        value={formatPct(trend.totalChangePercent)}
        hint={trend.totalChangePercent === null ? de.weightLog.statsHintTotal : undefined}
      />
    </section>
  );
}

function StatCard({ title, value, hint }: { title: string; value: string; hint?: string }) {
  return (
    <Card padding="sm">
      <p className="text-xs text-muted-foreground">{title}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-[10px] leading-tight text-muted-foreground">{hint}</p>}
    </Card>
  );
}
