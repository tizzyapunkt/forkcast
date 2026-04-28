import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../test/msw/server';
import { renderWithProviders, createTestQueryClient } from '../test/harness';
import { useSetNutritionGoal } from './use-set-nutrition-goal';
import { makeGoal } from '../test/msw/fixtures';

function Consumer() {
  const { mutate, isSuccess } = useSetNutritionGoal();
  return <button onClick={() => mutate(makeGoal({ calories: 1800 }))}>{isSuccess ? 'done' : 'save'}</button>;
}

describe('useSetNutritionGoal', () => {
  it('calls PUT and invalidates nutrition-goal query', async () => {
    const queryClient = createTestQueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    server.use(http.put('/api/nutrition-goal', () => HttpResponse.json(makeGoal({ calories: 1800 }))));

    renderWithProviders(<Consumer />, { queryClient });
    await userEvent.click(screen.getByRole('button', { name: 'save' }));
    expect(await screen.findByText('done')).toBeInTheDocument();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['nutrition-goal'] });
  });
});
