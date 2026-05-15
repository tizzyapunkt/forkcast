import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { computeMovingAverage } from '../../domain/weight-log-trend';
import type { WeightEntry } from '../../domain/weight-log';
import { de } from '../../i18n/de';

type Range = '30d' | '90d' | '180d' | '365d' | 'all';

const RANGE_DAYS: Record<Range, number | null> = {
  '30d': 30,
  '90d': 90,
  '180d': 180,
  '365d': 365,
  all: null,
};

const RANGES: { value: Range; label: string }[] = [
  { value: '30d', label: de.weightLog.chartRange30 },
  { value: '90d', label: de.weightLog.chartRange90 },
  { value: '180d', label: de.weightLog.chartRange180 },
  { value: '365d', label: de.weightLog.chartRange365 },
  { value: 'all', label: de.weightLog.chartRangeAll },
];

interface WeightChartProps {
  entries: WeightEntry[];
  asOf: string;
  defaultRange?: Range;
}

interface ChartRow {
  date: string;
  ts: number;
  weightKg: number | null;
  ma: number | null;
}

export function WeightChart({ entries, asOf, defaultRange = '90d' }: WeightChartProps) {
  const [range, setRange] = useState<Range>(defaultRange);

  const rows = useMemo(() => buildRows(entries, asOf, range), [entries, asOf, range]);
  const rawCount = useMemo(() => rows.filter((r) => r.weightKg !== null).length, [rows]);
  const hasMa = useMemo(() => rows.some((r) => r.ma !== null), [rows]);

  return (
    <section aria-label={de.weightLog.chartLabel} className="space-y-3">
      <div className="flex gap-2" role="radiogroup" aria-label={de.weightLog.chartRangeAria}>
        {RANGES.map((r) => (
          <button
            key={r.value}
            type="button"
            role="radio"
            aria-checked={range === r.value}
            onClick={() => setRange(r.value)}
            className={`rounded-md border px-3 py-1 text-xs ${
              range === r.value ? 'border-primary bg-primary/10' : 'border-input'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {rawCount === 0 ? (
        <p className="rounded-md border border-dashed border-input p-6 text-center text-sm text-muted-foreground">
          {de.weightLog.chartEmpty}
        </p>
      ) : (
        <div
          data-testid="weight-chart-container"
          data-raw-count={rawCount}
          data-has-ma={hasMa ? 'true' : 'false'}
          className="h-56 w-full"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
              <CartesianGrid stroke="currentColor" strokeOpacity={0.08} vertical={false} />
              <XAxis
                dataKey="ts"
                type="number"
                domain={['dataMin', 'dataMax']}
                scale="time"
                tickFormatter={formatTick}
                tick={{ fontSize: 10, fill: 'currentColor', fillOpacity: 0.6 }}
                stroke="currentColor"
                strokeOpacity={0.2}
                tickLine={false}
                minTickGap={32}
              />
              <YAxis
                domain={['auto', 'auto']}
                tick={{ fontSize: 10, fill: 'currentColor', fillOpacity: 0.6 }}
                stroke="currentColor"
                strokeOpacity={0.2}
                tickLine={false}
                width={40}
                tickFormatter={(v: number) => v.toFixed(1)}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'currentColor', strokeOpacity: 0.15 }} />
              {/* Raw entry dots: line invisible, dots only */}
              <Line
                dataKey="weightKg"
                type="monotone"
                stroke="transparent"
                isAnimationActive={false}
                connectNulls={false}
                dot={{ r: 2.5, fill: 'currentColor', fillOpacity: 0.45, stroke: 'none' }}
                activeDot={{ r: 4 }}
              />
              {/* Moving-average line: no dots, gaps preserved */}
              <Line
                dataKey="ma"
                type="monotone"
                stroke="hsl(var(--primary, 222 47% 50%))"
                strokeWidth={2}
                isAnimationActive={false}
                connectNulls={false}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

interface TooltipPayloadItem {
  payload?: ChartRow;
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayloadItem[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="rounded-md border border-input bg-popover px-2 py-1 text-xs shadow-sm">
      <p className="font-medium tabular-nums">{shortDate(row.date)}</p>
      {row.weightKg !== null && <p className="tabular-nums">{row.weightKg.toFixed(1)} kg</p>}
      {row.ma !== null && <p className="tabular-nums text-muted-foreground">⌀ {row.ma.toFixed(1)} kg</p>}
    </div>
  );
}

const DAY_MS = 86_400_000;

function shiftDays(date: string, deltaDays: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  return new Date(d.getTime() + deltaDays * DAY_MS).toISOString().slice(0, 10);
}

function shortDate(date: string): string {
  return `${date.slice(8, 10)}.${date.slice(5, 7)}`;
}

function formatTick(ts: number): string {
  const iso = new Date(ts).toISOString().slice(0, 10);
  return shortDate(iso);
}

function buildRows(entries: WeightEntry[], asOf: string, range: Range): ChartRow[] {
  if (entries.length === 0) return [];
  const days = RANGE_DAYS[range];
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const start = days === null ? sorted[0]!.date : shiftDays(asOf, -(days - 1));
  const byDate = new Map(sorted.map((e) => [e.date, e.weightKg]));
  const inWindow = sorted.filter((e) => e.date >= start && e.date <= asOf);

  const rows: ChartRow[] = [];
  let cur = start;
  while (cur <= asOf) {
    const ma = computeMovingAverage(inWindow, cur);
    rows.push({
      date: cur,
      ts: new Date(`${cur}T00:00:00Z`).getTime(),
      weightKg: byDate.get(cur) ?? null,
      ma,
    });
    cur = shiftDays(cur, 1);
  }
  return rows;
}
