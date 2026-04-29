import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../test/msw/server';
import { renderWithProviders, createTestQueryClient } from '../test/harness';
import { useLogRecipe } from './use-log-recipe';

function Consumer() {
  const { mutate, isPending, isSuccess } = useLogRecipe();
  return (
    <button onClick={() => mutate({ recipeId: 'r1', portions: 2, date: '2026-04-28', slot: 'lunch' })}>
      {isPending ? 'logging' : isSuccess ? 'logged' : 'log'}
    </button>
  );
}

describe('useLogRecipe', () => {
  it('POSTs /log-recipe and invalidates the daily log for the date', async () => {
    const queryClient = createTestQueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    server.use(http.post('/api/log-recipe', () => HttpResponse.json([], { status: 201 })));

    renderWithProviders(<Consumer />, { queryClient });
    await userEvent.click(screen.getByRole('button', { name: 'log' }));
    expect(await screen.findByText('logged')).toBeInTheDocument();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['daily-log', '2026-04-28'] });
  });
});
