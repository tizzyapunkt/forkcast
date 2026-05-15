export interface WeightEntry {
  date: string;
  weightKg: number;
}

export interface TrendSnapshot {
  current: number | null;
  movingAverage7d: number | null;
  weeklyRatePercent: number | null;
  changePercent28d: number | null;
  totalChangePercent: number | null;
  firstEntryDate: string | null;
  lastEntryDate: string | null;
  totalEntries: number;
}

export interface LogWeightResult {
  entry: WeightEntry;
  trend: TrendSnapshot;
}
