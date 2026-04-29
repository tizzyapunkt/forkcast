import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../test/msw/server';
import { renderWithProviders, createTestQueryClient } from '../test/harness';
import { useDeleteRecipe } from './use-delete-recipe';

function Consumer() {
  const { mutate, isPending, isSuccess } = useDeleteRecipe();
  return <button onClick={() => mutate('r1')}>{isPending ? 'deleting' : isSuccess ? 'deleted' : 'delete'}</button>;
}

describe('useDeleteRecipe', () => {
  it('DELETEs /recipe/:id and invalidates list + single', async () => {
    const queryClient = createTestQueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    server.use(http.delete('/api/recipe/r1', () => new HttpResponse(null, { status: 204 })));

    renderWithProviders(<Consumer />, { queryClient });
    await userEvent.click(screen.getByRole('button', { name: 'delete' }));
    expect(await screen.findByText('deleted')).toBeInTheDocument();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['recipes'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['recipe', 'r1'] });
  });
});
