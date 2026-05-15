import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import type { ReactNode } from 'react';
import { WeightChart } from './weight-chart';
import { ASOF, DENSE_60_DAYS, EMPTY_LOG, THREE_IN_WINDOW } from '../../domain/weight-log-trend.fixtures';

// Recharts uses ResponsiveContainer which requires a non-zero container size.
// jsdom doesn't give us that, so stub it with a fixed-size box.
vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactNode }) => (
      <div style={{ width: 600, height: 240 }}>{children}</div>
    ),
  };
});

describe('WeightChart', () => {
  it('renders the empty state when no entries are visible in the window', () => {
    render(<WeightChart entries={EMPTY_LOG} asOf={ASOF} />);
    expect(screen.queryByTestId('weight-chart-container')).not.toBeInTheDocument();
    expect(screen.getByText(/Noch keine Einträge/i)).toBeInTheDocument();
  });

  it('exposes the count of raw entries when populated', () => {
    render(<WeightChart entries={DENSE_60_DAYS} asOf={ASOF} defaultRange="30d" />);
    const container = screen.getByTestId('weight-chart-container');
    expect(container.dataset['rawCount']).toBe('30');
  });

  it('reports a defined MA line when the window has enough entries', () => {
    render(<WeightChart entries={DENSE_60_DAYS} asOf={ASOF} defaultRange="90d" />);
    const container = screen.getByTestId('weight-chart-container');
    expect(container.dataset['hasMa']).toBe('true');
  });

  it('reports no MA line when the visible window has too few entries (gap not interpolated)', () => {
    render(<WeightChart entries={THREE_IN_WINDOW} asOf={ASOF} defaultRange="30d" />);
    const container = screen.getByTestId('weight-chart-container');
    expect(container.dataset['hasMa']).toBe('false');
    expect(container.dataset['rawCount']).toBe('3');
  });

  it('changing the range recomputes the chart', async () => {
    const user = userEvent.setup();
    render(<WeightChart entries={DENSE_60_DAYS} asOf={ASOF} defaultRange="90d" />);
    expect(screen.getByTestId('weight-chart-container').dataset['rawCount']).toBe('60');
    await user.click(screen.getByRole('radio', { name: '30T' }));
    expect(screen.getByTestId('weight-chart-container').dataset['rawCount']).toBe('30');
  });

  it('renders a responsive chart container (no fixed pixel width)', () => {
    render(<WeightChart entries={DENSE_60_DAYS} asOf={ASOF} />);
    const container = screen.getByTestId('weight-chart-container');
    expect(container).toHaveClass('w-full');
    expect(container).toHaveClass('h-56');
  });

  it('renders a radio for each range option', () => {
    render(<WeightChart entries={DENSE_60_DAYS} asOf={ASOF} />);
    const group = screen.getByRole('radiogroup');
    expect(within(group).getAllByRole('radio')).toHaveLength(5);
  });
});
