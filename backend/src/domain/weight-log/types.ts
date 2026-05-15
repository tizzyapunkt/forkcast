export interface WeightEntry {
  /** Local civil date in YYYY-MM-DD format. Natural key — one entry per date. */
  date: string;
  /** Weight in kilograms. Rounded to two decimal places on write. */
  weightKg: number;
}

export interface TrendSnapshot {
  /** Raw weight on `asOf` if an entry exists for that date; null otherwise. */
  current: number | null;
  /** 7-day moving average ending on `asOf`. Null when the window has < 4 entries. */
  movingAverage7d: number | null;
  /** Percentage change of the 7d MA vs the 7d MA seven days ago. */
  weeklyRatePercent: number | null;
  /** Percentage change of the 7d MA vs the 7d MA twenty-eight days ago. */
  changePercent28d: number | null;
  /** Percentage change of the current 7d MA vs the earliest 7-day window with a defined MA. */
  totalChangePercent: number | null;
  firstEntryDate: string | null;
  lastEntryDate: string | null;
  totalEntries: number;
}
