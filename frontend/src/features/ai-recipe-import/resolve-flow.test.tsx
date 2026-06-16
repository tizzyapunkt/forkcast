import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw/server';
import { ReviewImportScreen } from './review-import-screen';
import type { RecipeDraft } from '../../domain/recipes';

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

const draftWithUnmatched: RecipeDraft = {
  name: 'Salat',
  yield: 1,
  steps: [],
  ingredients: [
    { matched: false, name: 'Kirschtomaten', amount: 50, unit: 'g', note: undefined },
    { matched: false, name: 'Balsamicoessig', amount: 5, unit: 'ml' },
  ],
};

describe('resolve flow on the review screen', () => {
  it('fires exactly one batch propose request on mount with every unmatched item', async () => {
    let calls = 0;
    let receivedItems: Array<{ name: string }> = [];
    server.use(
      http.post('/api/propose-ingredient-resolutions', async ({ request }) => {
        calls += 1;
        receivedItems = ((await request.json()) as { items: Array<{ name: string }> }).items;
        return HttpResponse.json({
          proposals: [
            { verdict: 'skip', reason: 'x' },
            { verdict: 'skip', reason: 'y' },
          ],
        });
      }),
    );

    renderWithProviders(
      <ReviewImportScreen draft={draftWithUnmatched} onSaved={vi.fn<() => void>()} onCancel={vi.fn<() => void>()} />,
    );

    await waitFor(() => expect(calls).toBe(1));
    expect(receivedItems.map((i) => i.name)).toEqual(['Kirschtomaten', 'Balsamicoessig']);
  });

  it('confirms a new-food proposal and moves the row into the ingredient list with its amount', async () => {
    server.use(
      http.post('/api/propose-ingredient-resolutions', () =>
        HttpResponse.json({
          proposals: [
            {
              verdict: 'new-food',
              confidence: 'high',
              entry: {
                id: 'kirschtomaten',
                name: 'Kirschtomaten',
                synonyms: [],
                unit: 'g',
                macrosPer100: { calories: 20, protein: 0.9, carbs: 3.9, fat: 0.2 },
              },
            },
            { verdict: 'skip', reason: 'y' },
          ],
        }),
      ),
      http.post('/api/confirm-ingredient-resolution', () =>
        HttpResponse.json({
          ingredient: {
            matched: true,
            name: 'Kirschtomaten',
            unit: 'g',
            macrosPerUnit: { calories: 0.2, protein: 0.009, carbs: 0.039, fat: 0.002 },
            amount: 50,
            unitOverridden: false,
            source: 'USER',
          },
        }),
      ),
    );

    renderWithProviders(
      <ReviewImportScreen draft={draftWithUnmatched} onSaved={vi.fn<() => void>()} onCancel={vi.fn<() => void>()} />,
    );

    // Open the proposal for Kirschtomaten once the prefetch lands.
    await userEvent.click(await screen.findByLabelText(/kirschtomaten.*zuordnen/i));
    // The editable new-food sheet shows; confirm it.
    await userEvent.click(await screen.findByRole('button', { name: /bestätigen & einfügen/i }));

    // Row left the unmatched panel and joined the ingredient list.
    await waitFor(() => expect(screen.queryByLabelText(/kirschtomaten.*zuordnen/i)).not.toBeInTheDocument());
  });

  it('keeps manual catalog + discard reachable when the proposal errors', async () => {
    server.use(
      http.post('/api/propose-ingredient-resolutions', () =>
        HttpResponse.json({ error: 'ai-resolution-failed' }, { status: 502 }),
      ),
    );

    renderWithProviders(
      <ReviewImportScreen draft={draftWithUnmatched} onSaved={vi.fn<() => void>()} onCancel={vi.fn<() => void>()} />,
    );

    // The row still exposes its resolve affordance (labelled for a11y) and opens the sheet.
    const rowButton = await screen.findByLabelText(/kirschtomaten.*zuordnen/i);
    expect(rowButton).toHaveTextContent(/erneut/i);
    await userEvent.click(rowButton);
    // The sheet shows the error fallback with a Katalog (manual) action and a Verwerfen action.
    expect(await screen.findByRole('button', { name: /^katalog$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^verwerfen$/i })).toBeInTheDocument();
  });
});
