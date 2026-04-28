import { http, HttpResponse } from 'msw';
import { server } from '../test/msw/server';
import { logIngredient } from './log-ingredient';

describe('logIngredient', () => {
  it('posts a quick entry and returns LogEntry', async () => {
    server.use(
      http.post('/api/log-ingredient', async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          { id: 'abc', date: body['date'], slot: body['slot'], ingredient: body['ingredient'], loggedAt: '' },
          { status: 201 },
        );
      }),
    );
    const result = await logIngredient({
      date: '2026-04-20',
      slot: 'breakfast',
      ingredient: { type: 'quick', label: 'Oats', calories: 300 },
    });
    expect(result.id).toBe('abc');
    expect(result.slot).toBe('breakfast');
  });

  it('throws ApiError on server error', async () => {
    server.use(http.post('/api/log-ingredient', () => HttpResponse.json({ error: 'fail' }, { status: 500 })));
    await expect(
      logIngredient({ date: '2026-04-20', slot: 'breakfast', ingredient: { type: 'quick', label: 'x', calories: 1 } }),
    ).rejects.toMatchObject({ status: 500 });
  });
});
