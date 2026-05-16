import { http, HttpResponse } from 'msw';
import { makeDailyLog, makeGoal } from './fixtures';

export { http };

const CORRECT_PASSWORD = 'test-password';

export const handlers = [
  http.post('/api/auth/login', async ({ request }) => {
    const body = (await request.json()) as { password?: string };
    if (body.password === CORRECT_PASSWORD) {
      return HttpResponse.json({ ok: true });
    }
    return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }),

  http.post('/api/auth/logout', () => {
    return HttpResponse.json({ ok: true });
  }),

  http.get('/api/auth/me', () => {
    return HttpResponse.json({ ok: true });
  }),

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

  http.get('/api/body-profile', () => {
    return new HttpResponse(null, { status: 404 });
  }),

  http.put('/api/body-profile', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      profile: body,
      computed: {
        ree: 1800,
        tdee: 2790,
        targetCalories: 2790,
        proteinGrams: 160,
        fatGrams: 78,
        carbsGrams: 343,
        proteinFatExceedsTarget: false,
      },
    });
  }),

  http.post('/api/body-profile/apply-as-goals', () => {
    return HttpResponse.json({ calories: 2790, protein: 160, carbs: 343, fat: 78 });
  }),

  http.get('/api/weight-log', () => {
    return HttpResponse.json({ entries: [] });
  }),

  http.post('/api/weight-log', async ({ request }) => {
    const body = (await request.json()) as { date: string; weightKg: number };
    return HttpResponse.json({
      entry: { date: body.date, weightKg: body.weightKg },
      trend: {
        current: body.weightKg,
        movingAverage7d: null,
        weeklyRatePercent: null,
        changePercent28d: null,
        totalChangePercent: null,
        firstEntryDate: body.date,
        lastEntryDate: body.date,
        totalEntries: 1,
      },
    });
  }),

  http.get('/api/weight-log/trend', () => {
    return HttpResponse.json({
      current: null,
      movingAverage7d: null,
      weeklyRatePercent: null,
      changePercent28d: null,
      totalChangePercent: null,
      firstEntryDate: null,
      lastEntryDate: null,
      totalEntries: 0,
    });
  }),

  http.delete('/api/weight-log/:date', () => {
    return new HttpResponse(null, { status: 204 });
  }),

  http.get('/api/unmatched-ingredients/export', () => {
    return HttpResponse.json({ entries: [] });
  }),

  http.post('/api/unmatched-ingredients/clear', () => {
    return new HttpResponse(null, { status: 204 });
  }),
];
