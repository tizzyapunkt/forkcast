import { http, HttpResponse } from 'msw';
import { server } from '../test/msw/server';
import { getDailyLog } from './daily-log';
import { makeDailyLog } from '../test/msw/fixtures';

describe('getDailyLog', () => {
  it('returns DailyLog for a given date', async () => {
    const fixture = makeDailyLog({ date: '2026-04-20' });
    server.use(http.get('/api/daily-log/:date', () => HttpResponse.json(fixture)));
    const result = await getDailyLog('2026-04-20');
    expect(result.date).toBe('2026-04-20');
    expect(result.slots).toHaveLength(4);
  });

  it('throws ApiError on server error', async () => {
    server.use(http.get('/api/daily-log/:date', () => HttpResponse.json({ error: 'fail' }, { status: 500 })));
    await expect(getDailyLog('2026-04-20')).rejects.toMatchObject({ status: 500 });
  });
});
