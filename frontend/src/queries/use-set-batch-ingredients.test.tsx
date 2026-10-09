import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../test/msw/server';
import { renderWithProviders, createTestQueryClient } from '../test/harness';
import { useSetBatchIngredients } from './use-set-batch-ingredients';
import type { BatchIngredientChange } from '../domain/cooking-session';

const ketchup = {
  type: 'full' as const,
  name: 'Ketchup',
  unit: 'ml' as const,
  macrosPerUnit: { calories: 1, protein: 0, carbs: 0.25, fat: 0 },
  amount: 100,
};

const changes: BatchIngredientChange[] = [
  { recipeBatchId: 'mo', date: '2026-10-12', remove: [], set: [ketchup] },
  { recipeBatchId: 'mi', date: '2026-10-14', remove: [], set: [ketchup] },
];

function Consumer() {
  const { mutate, isSuccess } = useSetBatchIngredients();
  return <button onClick={() => mutate(changes)}>{isSuccess ? 'done' : 'go'}</button>;
}

describe('useSetBatchIngredients', () => {
  it('POSTs /set-batch-ingredients and refreshes each touched day, the week and the grocery lists', async () => {
    const queryClient = createTestQueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    let posted: unknown;
    server.use(
      http.post('/api/set-batch-ingredients', async ({ request }) => {
        posted = await request.json();
        return HttpResponse.json([]);
      }),
    );

    renderWithProviders(<Consumer />, { queryClient });
    await userEvent.click(screen.getByRole('button', { name: 'go' }));

    expect(await screen.findByText('done')).toBeInTheDocument();
    expect(posted).toEqual({ changes });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['daily-log', '2026-10-12'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['daily-log', '2026-10-14'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['week-log'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['grocery-list'] });
  });
});
