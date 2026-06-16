import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw/server';
import { UserFoodsPanel } from './user-foods-panel';

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('UserFoodsPanel', () => {
  beforeEach(() => {
    // jsdom lacks URL.createObjectURL; stub the download plumbing.
    Object.defineProperty(URL, 'createObjectURL', { value: vi.fn<() => string>(() => 'blob:x'), configurable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn<() => void>(), configurable: true });
  });

  it('disables export when the overlay is empty', async () => {
    server.use(http.get('/api/user-foods', () => HttpResponse.json({ foods: [], synonyms: [] })));
    renderWithProviders(<UserFoodsPanel />);
    const button = await screen.findByRole('button', { name: /exportieren/i });
    await waitFor(() => expect(button).toBeDisabled());
  });

  it('shows the pending count and exports when the overlay has entries', async () => {
    let exported = false;
    server.use(
      http.get('/api/user-foods', () =>
        HttpResponse.json({
          foods: [
            {
              id: 'kirschtomaten',
              name: 'Kirschtomaten',
              synonyms: [],
              unit: 'g',
              macrosPer100: { calories: 20, protein: 0.9, carbs: 3.9, fat: 0.2 },
            },
          ],
          synonyms: [{ foodId: 'oliven', synonym: 'grüne Oliven' }],
        }),
      ),
      http.post('/api/export-user-foods', () => {
        exported = true;
        return HttpResponse.json({ foods: [], synonyms: [] });
      }),
    );
    renderWithProviders(<UserFoodsPanel />);

    // 1 food + 1 synonym = 2 pending.
    expect(await screen.findByText(/2 einträge offen/i)).toBeInTheDocument();
    const button = await screen.findByRole('button', { name: /exportieren/i });
    await waitFor(() => expect(button).toBeEnabled());
    await userEvent.click(button);
    await waitFor(() => expect(exported).toBe(true));
  });
});
