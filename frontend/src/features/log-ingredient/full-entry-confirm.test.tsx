import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw/server';
import { renderWithProviders, createTestQueryClient } from '../../test/harness';
import { FullEntryConfirm } from './full-entry-confirm';
import type { IngredientSearchResult } from '../../domain/ingredient-search';

const chicken: IngredientSearchResult = {
  offId: '2',
  name: 'Chicken breast',
  unit: 'g',
  macrosPerUnit: { calories: 1.65, protein: 0.31, carbs: 0, fat: 0.036 },
};

describe('FullEntryConfirm', () => {
  it('shows the selected ingredient name and unit', () => {
    renderWithProviders(
      <FullEntryConfirm result={chicken} date="2026-04-21" slot="lunch" onSuccess={() => {}} onBack={() => {}} />,
      { queryClient: createTestQueryClient() },
    );
    expect(screen.getByText('Chicken breast')).toBeInTheDocument();
    expect(screen.getByText(/per g/i)).toBeInTheDocument();
  });

  it('requires amount > 0', async () => {
    renderWithProviders(
      <FullEntryConfirm result={chicken} date="2026-04-21" slot="lunch" onSuccess={() => {}} onBack={() => {}} />,
      { queryClient: createTestQueryClient() },
    );
    await userEvent.click(screen.getByRole('button', { name: /log/i }));
    expect(await screen.findByText(/amount must be/i)).toBeInTheDocument();
  });

  it('submits a full entry with the correct shape and calls onSuccess', async () => {
    let posted: unknown;
    server.use(
      http.post('/api/log-ingredient', async ({ request }) => {
        posted = await request.json();
        return HttpResponse.json(
          { id: 'x', date: '2026-04-21', slot: 'lunch', ingredient: {}, loggedAt: '' },
          { status: 201 },
        );
      }),
    );
    const onSuccess = vi.fn<() => void>();
    renderWithProviders(
      <FullEntryConfirm result={chicken} date="2026-04-21" slot="lunch" onSuccess={onSuccess} onBack={() => {}} />,
      { queryClient: createTestQueryClient() },
    );

    await userEvent.type(screen.getByLabelText(/amount/i), '200');
    await userEvent.click(screen.getByRole('button', { name: /log/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    const ing = (posted as Record<string, unknown>)['ingredient'] as Record<string, unknown>;
    expect(ing['type']).toBe('full');
    expect(ing['name']).toBe('Chicken breast');
    expect(ing['amount']).toBe(200);
    expect(ing['macrosPerUnit']).toEqual(chicken.macrosPerUnit);
  });

  it('shows live calculated macros when amount is typed', async () => {
    renderWithProviders(
      <FullEntryConfirm result={chicken} date="2026-04-21" slot="lunch" onSuccess={() => {}} onBack={() => {}} />,
      { queryClient: createTestQueryClient() },
    );
    await userEvent.type(screen.getByLabelText(/amount/i), '200');
    // 1.65 * 200 = 330 kcal, 0.31 * 200 = 62g protein
    // Values are split across spans, so we look for them individually
    expect(await screen.findByText('330')).toBeInTheDocument();
    expect(screen.getByText('62g')).toBeInTheDocument();
  });

  it('hides calculated row when amount is empty', () => {
    renderWithProviders(
      <FullEntryConfirm result={chicken} date="2026-04-21" slot="lunch" onSuccess={() => {}} onBack={() => {}} />,
      { queryClient: createTestQueryClient() },
    );
    // no amount typed — should not see a "total" line
    expect(screen.queryByText(/total/i)).not.toBeInTheDocument();
  });

  it('calls onBack when back button is clicked', async () => {
    const onBack = vi.fn<() => void>();
    renderWithProviders(
      <FullEntryConfirm result={chicken} date="2026-04-21" slot="lunch" onSuccess={() => {}} onBack={onBack} />,
      { queryClient: createTestQueryClient() },
    );
    await userEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(onBack).toHaveBeenCalled();
  });
});
