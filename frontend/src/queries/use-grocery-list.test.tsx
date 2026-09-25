import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../test/msw/server';
import { renderWithProviders, createTestQueryClient } from '../test/harness';
import { useGroceryList } from './use-grocery-list';
import { useSetCookedPortions } from './use-set-cooked-portions';

function ListConsumer({ startDate }: { startDate: string }) {
  const { data } = useGroceryList(startDate);
  return <p>{data ? data.items.map((i) => `${i.name} ${i.amount}`).join(', ') || 'leer' : 'lädt'}</p>;
}

function SetConsumer() {
  const { mutate, isSuccess } = useSetCookedPortions();
  return (
    <button onClick={() => mutate({ recipeBatchId: 'batch-1', date: '2026-09-29', cookedPortions: 2 })}>
      {isSuccess ? 'done' : 'go'}
    </button>
  );
}

describe('useGroceryList', () => {
  it('loads the grocery list for the given week', async () => {
    server.use(
      http.get('/api/grocery-list/:startDate', ({ params }) =>
        HttpResponse.json({
          startDate: params['startDate'],
          items: [{ name: 'Reis', unit: 'g', amount: 300, untracked: false, dates: ['2026-09-29'] }],
          skippedQuickEntries: 0,
        }),
      ),
    );

    renderWithProviders(<ListConsumer startDate="2026-09-28" />, { queryClient: createTestQueryClient() });

    expect(await screen.findByText('Reis 300')).toBeInTheDocument();
  });
});

describe('useSetCookedPortions', () => {
  it('POSTs /set-cooked-portions and refreshes the day, the week and every grocery list', async () => {
    const queryClient = createTestQueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    let posted: unknown;
    server.use(
      http.post('/api/set-cooked-portions', async ({ request }) => {
        posted = await request.json();
        return HttpResponse.json([]);
      }),
    );

    renderWithProviders(<SetConsumer />, { queryClient });
    await userEvent.click(screen.getByRole('button', { name: 'go' }));

    expect(await screen.findByText('done')).toBeInTheDocument();
    expect(posted).toEqual({ recipeBatchId: 'batch-1', date: '2026-09-29', cookedPortions: 2 });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['daily-log', '2026-09-29'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['week-log'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['grocery-list'] });
  });
});
