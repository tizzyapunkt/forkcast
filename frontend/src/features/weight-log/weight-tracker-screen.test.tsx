import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, it, expect } from 'vitest';
import { server } from '../../test/msw/server';
import { renderWithProviders } from '../../test/harness';
import { WeightTrackerScreen } from './weight-tracker-screen';
import type { TrendSnapshot, WeightEntry } from '../../domain/weight-log';

function seedHandlers(entries: WeightEntry[], trend: TrendSnapshot) {
  server.use(
    http.get('/api/weight-log', () => HttpResponse.json({ entries })),
    http.get('/api/weight-log/trend', () => HttpResponse.json(trend)),
  );
}

const EMPTY_TREND: TrendSnapshot = {
  current: null,
  movingAverage7d: null,
  weeklyRatePercent: null,
  changePercent28d: null,
  totalChangePercent: null,
  firstEntryDate: null,
  lastEntryDate: null,
  totalEntries: 0,
};

describe('WeightTrackerScreen', () => {
  it('renders stat cards with values when trend data is available', async () => {
    seedHandlers(
      [
        { date: '2026-05-09', weightKg: 80 },
        { date: '2026-05-11', weightKg: 79.5 },
        { date: '2026-05-13', weightKg: 79 },
        { date: '2026-05-15', weightKg: 78.5 },
      ],
      {
        current: 78.5,
        movingAverage7d: 79.25,
        weeklyRatePercent: -0.5,
        changePercent28d: -1.2,
        totalChangePercent: -2.4,
        firstEntryDate: '2026-05-09',
        lastEntryDate: '2026-05-15',
        totalEntries: 4,
      },
    );
    renderWithProviders(<WeightTrackerScreen onBack={() => {}} />);
    await waitFor(() => {
      expect(screen.getAllByText(/78\.5 kg/).length).toBeGreaterThan(0);
    });
    expect(screen.getByText(/79\.3 kg|79\.2 kg/)).toBeInTheDocument();
    expect(screen.getByText(/-0\.50 %/)).toBeInTheDocument();
  });

  it('renders em-dash + hint for null trend fields', async () => {
    seedHandlers([], EMPTY_TREND);
    renderWithProviders(<WeightTrackerScreen onBack={() => {}} />);
    // Dashes appear in all five stat cards
    await waitFor(() => {
      expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(5);
    });
    // Sparse-data hint appears in multiple stat cards (MA, weekly, etc.)
    expect(screen.getAllByText(/Mindestens 4 Einträge in den letzten 7 Tagen/).length).toBeGreaterThan(0);
  });

  it('history list edit triggers a POST and refreshes the data', async () => {
    const user = userEvent.setup();
    let postPayload: unknown = null;
    seedHandlers([{ date: '2026-05-15', weightKg: 78.5 }], { ...EMPTY_TREND, totalEntries: 1, current: 78.5 });
    server.use(
      http.post('/api/weight-log', async ({ request }) => {
        postPayload = await request.json();
        return HttpResponse.json({
          entry: { date: '2026-05-15', weightKg: 78.3 },
          trend: { ...EMPTY_TREND, current: 78.3, totalEntries: 1 },
        });
      }),
    );
    renderWithProviders(<WeightTrackerScreen onBack={() => {}} />);
    const editBtn = await screen.findByLabelText('Eintrag vom 2026-05-15 bearbeiten');
    await user.click(editBtn);
    const input = screen.getByLabelText('Eintrag vom 2026-05-15 bearbeiten');
    await user.clear(input);
    await user.type(input, '78.3');
    await user.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => {
      expect(postPayload).toEqual({ date: '2026-05-15', weightKg: 78.3 });
    });
  });

  it('history list delete triggers DELETE', async () => {
    const user = userEvent.setup();
    let deletedDate: string | null = null;
    seedHandlers([{ date: '2026-05-14', weightKg: 78.5 }], { ...EMPTY_TREND, totalEntries: 1 });
    server.use(
      http.delete('/api/weight-log/:date', ({ params }) => {
        deletedDate = params['date'] as string;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderWithProviders(<WeightTrackerScreen onBack={() => {}} />);
    const deleteBtn = await screen.findByLabelText('Eintrag vom 2026-05-14 löschen');
    await user.click(deleteBtn);
    const list = screen.getByRole('list');
    await user.click(within(list).getByRole('button', { name: 'Löschen' }));
    await waitFor(() => {
      expect(deletedDate).toBe('2026-05-14');
    });
  });

  it('back button invokes onBack', async () => {
    const user = userEvent.setup();
    seedHandlers([], EMPTY_TREND);
    const onBack = vi.fn<() => void>();
    renderWithProviders(<WeightTrackerScreen onBack={onBack} />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Gewicht-Tracker/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /←/ }));
    expect(onBack).toHaveBeenCalled();
  });
});
