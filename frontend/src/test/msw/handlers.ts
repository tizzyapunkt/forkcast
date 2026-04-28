import { http, HttpResponse } from 'msw';
import { makeDailyLog, makeGoal } from './fixtures';

export { http };

export const handlers = [
  http.get('/api/daily-log/:date', () => {
    return HttpResponse.json(makeDailyLog());
  }),

  http.get('/api/nutrition-goal', () => {
    return HttpResponse.json(makeGoal());
  }),

  http.put('/api/nutrition-goal', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json(body);
  }),

  http.post('/api/log-ingredient', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      {
        id: crypto.randomUUID(),
        date: body['date'],
        slot: body['slot'],
        ingredient: body['ingredient'],
        loggedAt: new Date().toISOString(),
      },
      { status: 201 },
    );
  }),

  http.patch('/api/log-entry/:id', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json(body);
  }),

  http.delete('/api/log-entry/:id', () => {
    return new HttpResponse(null, { status: 204 });
  }),

  http.get('/api/search-ingredients', () => {
    return HttpResponse.json([]);
  }),

  http.get('/api/search-ingredients/barcode/:barcode', () => {
    return new HttpResponse(null, { status: 404 });
  }),

  http.get('/api/recently-used-ingredients', () => {
    return HttpResponse.json([]);
  }),
];
