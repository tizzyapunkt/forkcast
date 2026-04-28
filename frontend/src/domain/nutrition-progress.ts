export type ProgressColor = 'green' | 'yellow' | 'red' | 'neutral';

export type KcalBadge = { kind: 'open'; diff: number } | { kind: 'reached'; diff: 0 } | { kind: 'over'; diff: number };

export interface KcalStatus {
  pct: number | null;
  color: ProgressColor;
  badge: KcalBadge | null;
}

export interface MacroStatus {
  pct: number | null;
  color: ProgressColor;
}

export function kcalStatus(actual: number, goal: number | null | undefined): KcalStatus {
  if (!goal || goal <= 0) return { pct: null, color: 'neutral', badge: null };

  const rounded = Math.round(actual);
  const pct = (actual * 100) / goal;

  if (rounded === goal) {
    return { pct, color: 'green', badge: { kind: 'reached', diff: 0 } };
  }

  const color: ProgressColor = pct < 80 || pct > 120 ? 'red' : 'yellow';
  const badge: KcalBadge =
    rounded < goal ? { kind: 'open', diff: goal - rounded } : { kind: 'over', diff: rounded - goal };

  return { pct, color, badge };
}

export function macroStatus(actual: number, goal: number | null | undefined): MacroStatus {
  if (!goal || goal <= 0) return { pct: null, color: 'neutral' };

  const pct = (actual * 100) / goal;
  let color: ProgressColor;
  if (pct >= 90 && pct <= 110) color = 'green';
  else if (pct >= 80 && pct <= 120) color = 'yellow';
  else color = 'red';

  return { pct, color };
}
