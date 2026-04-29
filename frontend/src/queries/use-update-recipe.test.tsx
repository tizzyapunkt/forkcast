import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../test/msw/server';
import { renderWithProviders, createTestQueryClient } from '../test/harness';
import { useUpdateRecipe } from './use-update-recipe';

function Consumer() {
  const { mutate, isPending, isSuccess } = useUpdateRecipe();
  return (
    <button onClick={() => mutate({ id: 'r1', patch: { name: 'New' } })}>
      {isPending ? 'saving' : isSuccess ? 'saved' : 'save'}
    </button>
  );
}

describe('useUpdateRecipe', () => {
  it('PATCHes /recipe/:id and invalidates list + single', async () => {
    const queryClient = createTestQueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    server.use(
      http.patch('/api/recipe/r1', () =>
        HttpResponse.json({
          id: 'r1',
          name: 'New',
          yield: 1,
          ingredients: [],
          steps: [],
          createdAt: '',
          updatedAt: '',
        }),
      ),
    );

    renderWithProviders(<Consumer />, { queryClient });
    await userEvent.click(screen.getByRole('button', { name: 'save' }));
    expect(await screen.findByText('saved')).toBeInTheDocument();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['recipes'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['recipe', 'r1'] });
  });
});
