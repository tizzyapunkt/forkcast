import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw/server';
import { renderWithProviders, createTestQueryClient } from '../../test/harness';
import { GroceryListSheet } from './grocery-list-sheet';

vi.mock('../../demo/is-demo', () => ({ isDemo: true }));

describe('GroceryListSheet in the demo', () => {
  it('offers copying but not Bring!', async () => {
    server.use(
      http.get('/api/grocery-list/:startDate', () =>
        HttpResponse.json({
          startDate: '2026-09-28',
          items: [{ name: 'Olivenöl', unit: 'ml', amount: 30, untracked: false, dates: ['2026-09-29'] }],
          recipes: [],
          skippedQuickEntries: 0,
        }),
      ),
    );
    renderWithProviders(
      <GroceryListSheet startDate="2026-09-28" rangeLabel="28. September – 4. Oktober" onClose={() => {}} />,
      { queryClient: createTestQueryClient() },
    );

    expect(await screen.findByText('Olivenöl')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /kopieren/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /bring/i })).not.toBeInTheDocument();
  });
});
