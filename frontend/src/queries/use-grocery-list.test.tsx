import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../test/msw/server';
import { renderWithProviders, createTestQueryClient } from '../test/harness';
import { useGroceryList } from './use-grocery-list';

function ListConsumer({ startDate }: { startDate: string }) {
  const { data } = useGroceryList(startDate);
  return <p>{data ? data.items.map((i) => `${i.name} ${i.amount}`).join(', ') || 'leer' : 'lädt'}</p>;
}

describe('useGroceryList', () => {
  it('loads the grocery list for the given week', async () => {
    server.use(
      http.get('/api/grocery-list/:startDate', ({ params }) =>
        HttpResponse.json({
          startDate: params['startDate'],
          items: [{ name: 'Reis', unit: 'g', amount: 300, untracked: false, dates: ['2026-09-29'] }],
          recipes: [],
          skippedQuickEntries: 0,
        }),
      ),
    );

    renderWithProviders(<ListConsumer startDate="2026-09-28" />, { queryClient: createTestQueryClient() });

    expect(await screen.findByText('Reis 300')).toBeInTheDocument();
  });
});
