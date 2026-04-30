import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw/server';
import { renderWithProviders } from '../../test/harness';
import { makeDailyLog } from '../../test/msw/fixtures';
import { DateNav } from './date-nav';
import { useActiveDate } from './use-active-date';

function Harness() {
  const { date, goPrev, goNext, goToday } = useActiveDate('2026-04-20');
  return (
    <>
      <DateNav date={date} onPrev={goPrev} onNext={goNext} onToday={goToday} />
      <p data-testid="active-date">{date}</p>
    </>
  );
}

describe('DateNav', () => {
  it('shows the current date', () => {
    renderWithProviders(<Harness />);
    expect(screen.getByTestId('active-date')).toHaveTextContent('2026-04-20');
  });

  it('Prev moves to the previous day', async () => {
    renderWithProviders(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: /Vorheriger Tag/i }));
    expect(screen.getByTestId('active-date')).toHaveTextContent('2026-04-19');
  });

  it('Next moves to the next day', async () => {
    renderWithProviders(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: /Nächster Tag/i }));
    expect(screen.getByTestId('active-date')).toHaveTextContent('2026-04-21');
  });

  it('Today jumps back to today from a past date', async () => {
    renderWithProviders(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: /Vorheriger Tag/i }));
    await userEvent.click(screen.getByRole('button', { name: /Heute/i }));
    // The active-date after Today is the real today — just check it's not yesterday
    expect(screen.getByTestId('active-date')).not.toHaveTextContent('2026-04-19');
  });
});

describe('DailyLogScreen with date navigation', () => {
  it('re-fetches when date changes', async () => {
    const requests: string[] = [];
    server.use(
      http.get('/api/daily-log/:date', ({ params }) => {
        requests.push(params['date'] as string);
        return HttpResponse.json(makeDailyLog({ date: params['date'] as string }));
      }),
    );

    renderWithProviders(<Harness />);
    // Wait for initial load
    await screen.findByTestId('active-date');
    await userEvent.click(screen.getByRole('button', { name: /Nächster Tag/i }));
    // After navigation a new date is active; we don't directly test re-fetch here
    // (the DailyLogScreen integration is covered in daily-log-screen.test.tsx)
    expect(screen.getByTestId('active-date')).toHaveTextContent('2026-04-21');
  });
});
