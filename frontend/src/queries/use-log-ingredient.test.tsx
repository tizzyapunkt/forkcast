import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../test/msw/server';
import { renderWithProviders, createTestQueryClient } from '../test/harness';
import { useLogIngredient } from './use-log-ingredient';

function Consumer() {
  const { mutate, isPending, isSuccess } = useLogIngredient();
  return (
    <button
      onClick={() =>
        mutate({ date: '2026-04-20', slot: 'breakfast', ingredient: { type: 'quick', label: 'Test', calories: 100 } })
      }
    >
      {isPending ? 'saving' : isSuccess ? 'saved' : 'save'}
    </button>
  );
}

describe('useLogIngredient', () => {
  it('calls POST /api/log-ingredient and invalidates the daily-log query', async () => {
    const queryClient = createTestQueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    server.use(
      http.post('/api/log-ingredient', () =>
        HttpResponse.json(
          {
            id: 'x',
            date: '2026-04-20',
            slot: 'breakfast',
            ingredient: { type: 'quick', label: 'Test', calories: 100 },
            loggedAt: '',
          },
          { status: 201 },
        ),
      ),
    );

    renderWithProviders(<Consumer />, { queryClient });
    await userEvent.click(screen.getByRole('button', { name: 'save' }));
    expect(await screen.findByText('saved')).toBeInTheDocument();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['daily-log', '2026-04-20'] });
  });
});
