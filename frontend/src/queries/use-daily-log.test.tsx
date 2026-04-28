import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../test/msw/server';
import { renderWithProviders } from '../test/harness';
import { makeDailyLog } from '../test/msw/fixtures';
import { useDailyLog } from './use-daily-log';

function Consumer({ date }: { date: string }) {
  const { data, isLoading } = useDailyLog(date);
  if (isLoading) return <p>loading</p>;
  return <p>{data?.date}</p>;
}

describe('useDailyLog', () => {
  it('returns daily log data for the given date', async () => {
    server.use(http.get('/api/daily-log/:date', () => HttpResponse.json(makeDailyLog({ date: '2026-04-20' }))));
    renderWithProviders(<Consumer date="2026-04-20" />);
    expect(await screen.findByText('2026-04-20')).toBeInTheDocument();
  });
});
