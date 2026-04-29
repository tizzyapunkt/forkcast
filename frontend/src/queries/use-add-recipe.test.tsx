import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../test/msw/server';
import { renderWithProviders, createTestQueryClient } from '../test/harness';
import { useAddRecipe } from './use-add-recipe';

function Consumer() {
  const { mutate, isPending, isSuccess } = useAddRecipe();
  return (
    <button
      onClick={() =>
        mutate({
          name: 'Oats',
          yield: 1,
          ingredients: [
            {
              name: 'Oats',
              unit: 'g',
              macrosPerUnit: { calories: 3.7, protein: 0.13, carbs: 0.66, fat: 0.07 },
              amount: 80,
            },
          ],
          steps: [],
        })
      }
    >
      {isPending ? 'saving' : isSuccess ? 'saved' : 'save'}
    </button>
  );
}

describe('useAddRecipe', () => {
  it('POSTs /add-recipe and invalidates the recipes list', async () => {
    const queryClient = createTestQueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    server.use(
      http.post('/api/add-recipe', () =>
        HttpResponse.json(
          { id: 'r1', name: 'Oats', yield: 1, ingredients: [], steps: [], createdAt: '', updatedAt: '' },
          { status: 201 },
        ),
      ),
    );

    renderWithProviders(<Consumer />, { queryClient });
    await userEvent.click(screen.getByRole('button', { name: 'save' }));
    expect(await screen.findByText('saved')).toBeInTheDocument();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['recipes'] });
  });
});
