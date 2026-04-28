import { http, HttpResponse } from 'msw';
import { server } from '../test/msw/server';
import { getNutritionGoal, setNutritionGoal } from './nutrition-goal';
import { makeGoal } from '../test/msw/fixtures';

describe('getNutritionGoal', () => {
  it('returns goal when set', async () => {
    const fixture = makeGoal({ calories: 2500 });
    server.use(http.get('/api/nutrition-goal', () => HttpResponse.json(fixture)));
    const result = await getNutritionGoal();
    expect(result?.calories).toBe(2500);
  });

  it('returns null on 404', async () => {
    server.use(
      http.get('/api/nutrition-goal', () => HttpResponse.json({ error: 'No nutrition goal set' }, { status: 404 })),
    );
    const result = await getNutritionGoal();
    expect(result).toBeNull();
  });
});

describe('setNutritionGoal', () => {
  it('PUTs goal and returns it', async () => {
    const goal = makeGoal({ calories: 1800 });
    server.use(http.put('/api/nutrition-goal', () => HttpResponse.json(goal)));
    const result = await setNutritionGoal(goal);
    expect(result.calories).toBe(1800);
  });
});
