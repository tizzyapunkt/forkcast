import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, it, expect } from 'vitest';
import { server } from '../../test/msw/server';
import { renderWithProviders } from '../../test/harness';
import { WeightLogCard } from './weight-log-card';
import { today } from '../../domain/date';
import type { TrendSnapshot, WeightEntry } from '../../domain/weight-log';

function seedHandlers(entries: WeightEntry[], trend: TrendSnapshot) {
  server.use(
    http.get('/api/weight-log', () => HttpResponse.json({ entries })),
    http.get('/api/weight-log/trend', () => HttpResponse.json(trend)),
  );
}

const NULL_TREND: TrendSnapshot = {
  current: null,
  movingAverage7d: null,
  weeklyRatePercent: null,
  changePercent28d: null,
  totalChangePercent: null,
  firstEntryDate: null,
  lastEntryDate: null,
  totalEntries: 0,
};

describe('WeightLogCard', () => {
  it('renders the empty-state input when no entry exists for today', async () => {
    seedHandlers([], NULL_TREND);
    renderWithProviders(<WeightLogCard onOpenTracker={() => {}} />);
    await waitFor(() => {
      expect(screen.getByLabelText('Gewicht für heute eintragen')).toBeInTheDocument();
    });
    expect((screen.getByLabelText('Gewicht für heute eintragen') as HTMLInputElement).placeholder).toBe('z. B. 78,4');
  });

  it("renders the weight + MA + rate when today's entry exists", async () => {
    const dateStr = today();
    seedHandlers([{ date: dateStr, weightKg: 78.4 }], {
      ...NULL_TREND,
      current: 78.4,
      movingAverage7d: 78.2,
      weeklyRatePercent: -0.5,
      totalEntries: 1,
      firstEntryDate: dateStr,
      lastEntryDate: dateStr,
    });
    renderWithProviders(<WeightLogCard onOpenTracker={() => {}} />);
    expect(await screen.findByText(/78.4 kg/)).toBeInTheDocument();
    expect(screen.getByText(/7-Tage-Trend: 78\.2 kg/)).toBeInTheDocument();
    expect(screen.getByText(/-0\.50 %\/Wo\./)).toBeInTheDocument();
  });

  it('submitting the form posts to the API', async () => {
    const user = userEvent.setup();
    let postPayload: unknown = null;
    seedHandlers([], NULL_TREND);
    server.use(
      http.post('/api/weight-log', async ({ request }) => {
        postPayload = await request.json();
        return HttpResponse.json({
          entry: { date: today(), weightKg: 78.4 },
          trend: { ...NULL_TREND, current: 78.4, totalEntries: 1 },
        });
      }),
    );
    renderWithProviders(<WeightLogCard onOpenTracker={() => {}} />);
    const input = await screen.findByLabelText('Gewicht für heute eintragen');
    await user.type(input, '78.4');
    await user.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => {
      expect(postPayload).toEqual({ date: today(), weightKg: 78.4 });
    });
  });

  it('accepts a comma-delimited weight (German locale) and posts the parsed value', async () => {
    const user = userEvent.setup();
    let postPayload: unknown = null;
    seedHandlers([], NULL_TREND);
    server.use(
      http.post('/api/weight-log', async ({ request }) => {
        postPayload = await request.json();
        return HttpResponse.json({
          entry: { date: today(), weightKg: 78.4 },
          trend: { ...NULL_TREND, current: 78.4, totalEntries: 1 },
        });
      }),
    );
    renderWithProviders(<WeightLogCard onOpenTracker={() => {}} />);
    const input = await screen.findByLabelText('Gewicht für heute eintragen');
    await user.type(input, '78,4');
    await user.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => {
      expect(postPayload).toEqual({ date: today(), weightKg: 78.4 });
    });
  });

  it('uses a decimal text input so a locale comma can be typed', async () => {
    seedHandlers([], NULL_TREND);
    renderWithProviders(<WeightLogCard onOpenTracker={() => {}} />);
    const input = (await screen.findByLabelText('Gewicht für heute eintragen')) as HTMLInputElement;
    expect(input.getAttribute('inputmode')).toBe('decimal');
    expect(input.getAttribute('type')).toBe('text');
  });

  it('"Gewicht-Tracker" link invokes onOpenTracker', async () => {
    const user = userEvent.setup();
    const onOpenTracker = vi.fn<() => void>();
    seedHandlers([], NULL_TREND);
    renderWithProviders(<WeightLogCard onOpenTracker={onOpenTracker} />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Gewicht-Tracker' })).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: 'Gewicht-Tracker' }));
    expect(onOpenTracker).toHaveBeenCalled();
  });
});
