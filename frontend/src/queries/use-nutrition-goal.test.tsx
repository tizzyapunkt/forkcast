import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../test/msw/server';
import { renderWithProviders } from '../test/harness';
import { makeGoal } from '../test/msw/fixtures';
import { useNutritionGoal } from './use-nutrition-goal';

function Consumer() {
  const { data } = useNutritionGoal();
  if (data === undefined) return <p>loading</p>;
  if (data === null) return <p>no-goal</p>;
  return <p>calories:{data.calories}</p>;
}

describe('useNutritionGoal', () => {
  it('returns goal when set', async () => {
    server.use(http.get('/api/nutrition-goal', () => HttpResponse.json(makeGoal({ calories: 2000 }))));
    renderWithProviders(<Consumer />);
    expect(await screen.findByText('calories:2000')).toBeInTheDocument();
  });

  it('returns null (not an error) on 404', async () => {
    server.use(
      http.get('/api/nutrition-goal', () => HttpResponse.json({ error: 'No nutrition goal set' }, { status: 404 })),
    );
    renderWithProviders(<Consumer />);
    expect(await screen.findByText('no-goal')).toBeInTheDocument();
  });
});
