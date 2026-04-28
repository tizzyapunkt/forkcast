import { render, screen, within } from '@testing-library/react';
import type { DailyGoal } from '../../domain/nutrition';
import type { DayTotals } from '../../domain/meal-log';
import { DayTotalsHeader } from './day-totals-header';

const EMPTY_TOTALS: DayTotals = { calories: 0, protein: 0, carbs: 0, fat: 0, macrosPartial: false };
const GOAL: DailyGoal = { calories: 2000, protein: 150, carbs: 200, fat: 70 };

describe('DayTotalsHeader', () => {
  it('renders 0 / goal kcal and full-deficit badge for an empty log', () => {
    render(<DayTotalsHeader totals={EMPTY_TOTALS} goal={GOAL} />);
    expect(screen.getByText(/0\s*\/\s*2000\s*kcal/i)).toBeInTheDocument();
    expect(screen.getByText('2000 kcal offen')).toBeInTheDocument();
  });

  it('renders reached badge and green color when actual equals goal', () => {
    const totals: DayTotals = { calories: 2000, protein: 150, carbs: 200, fat: 70, macrosPartial: false };
    render(<DayTotalsHeader totals={totals} goal={GOAL} />);
    const badge = screen.getByText(/erreicht/);
    expect(badge).toBeInTheDocument();
    expect(badge.className).toMatch(/text-success|bg-success/);
  });

  it('renders over-goal badge when actual exceeds goal', () => {
    const totals: DayTotals = { calories: 2200, protein: 150, carbs: 200, fat: 70, macrosPartial: false };
    render(<DayTotalsHeader totals={totals} goal={GOAL} />);
    expect(screen.getByText('200 kcal über Ziel')).toBeInTheDocument();
  });

  it('progress bar width reflects pct and caps at 100 %', () => {
    const totals: DayTotals = { calories: 2400, protein: 0, carbs: 0, fat: 0, macrosPartial: false };
    render(<DayTotalsHeader totals={totals} goal={GOAL} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '120');
    const fill = within(bar).getByTestId('kcal-progress-fill');
    expect(fill.style.width).toBe('100%');
  });

  it('progress bar uses yellow color class at 80 %', () => {
    const totals: DayTotals = { calories: 1600, protein: 0, carbs: 0, fat: 0, macrosPartial: false };
    render(<DayTotalsHeader totals={totals} goal={GOAL} />);
    const fill = screen.getByTestId('kcal-progress-fill');
    expect(fill.className).toMatch(/bg-warning/);
  });

  it('progress bar uses red color class at 50 %', () => {
    const totals: DayTotals = { calories: 1000, protein: 0, carbs: 0, fat: 0, macrosPartial: false };
    render(<DayTotalsHeader totals={totals} goal={GOAL} />);
    const fill = screen.getByTestId('kcal-progress-fill');
    expect(fill.className).toMatch(/bg-error/);
  });

  it('renders each macro with Ist / Soll g', () => {
    const totals: DayTotals = { calories: 1500, protein: 120, carbs: 160, fat: 55, macrosPartial: false };
    render(<DayTotalsHeader totals={totals} goal={GOAL} />);
    expect(screen.getByText(/120\s*\/\s*150\s*g/)).toBeInTheDocument();
    expect(screen.getByText(/160\s*\/\s*200\s*g/)).toBeInTheDocument();
    expect(screen.getByText(/55\s*\/\s*70\s*g/)).toBeInTheDocument();
  });

  it('renders only Ist without slash when goal is null', () => {
    const totals: DayTotals = { calories: 1500, protein: 120, carbs: 160, fat: 55, macrosPartial: false };
    render(<DayTotalsHeader totals={totals} goal={null} />);
    expect(screen.getByText(/1500\s*kcal/)).toBeInTheDocument();
    expect(screen.queryByText(/\/\s*2000/)).not.toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryByText(/erreicht|offen|über Ziel/)).not.toBeInTheDocument();
  });

  it('rounds non-integer actuals', () => {
    const totals: DayTotals = { calories: 1499.6, protein: 89.4, carbs: 0, fat: 0, macrosPartial: false };
    render(<DayTotalsHeader totals={totals} goal={GOAL} />);
    expect(screen.getByText(/1500\s*\/\s*2000/)).toBeInTheDocument();
    expect(screen.getByText(/89\s*\/\s*150/)).toBeInTheDocument();
  });
});
