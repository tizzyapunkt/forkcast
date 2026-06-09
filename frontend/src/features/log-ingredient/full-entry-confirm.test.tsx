import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw/server';
import { renderWithProviders, createTestQueryClient } from '../../test/harness';
import { FullEntryConfirm } from './full-entry-confirm';
import type { IngredientSearchResult } from '../../domain/ingredient-search';

const chicken: IngredientSearchResult = {
  id: '2',
  source: 'OFF' as const,
  name: 'Chicken breast',
  unit: 'g',
  macrosPerUnit: { calories: 1.65, protein: 0.31, carbs: 0, fat: 0.036 },
};

describe('FullEntryConfirm', () => {
  it('shows the selected ingredient name and a per-100g readout', () => {
    renderWithProviders(
      <FullEntryConfirm result={chicken} date="2026-04-21" slot="lunch" onSuccess={() => {}} onBack={() => {}} />,
      { queryClient: createTestQueryClient() },
    );
    expect(screen.getByText('Chicken breast')).toBeInTheDocument();
    // chicken: 1.65 kcal/g, 0.31g/g P, 0g/g K, 0.036g/g F → ×100 + Math.round
    expect(screen.getByText('pro 100g — 165 kcal · 31g P · 0g K · 4g F')).toBeInTheDocument();
  });

  it('requires amount > 0', async () => {
    renderWithProviders(
      <FullEntryConfirm result={chicken} date="2026-04-21" slot="lunch" onSuccess={() => {}} onBack={() => {}} />,
      { queryClient: createTestQueryClient() },
    );
    await userEvent.click(screen.getByRole('button', { name: /erfassen/i }));
    expect(await screen.findByText(/menge muss/i)).toBeInTheDocument();
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

    await userEvent.type(screen.getByLabelText(/menge/i), '200');
    await userEvent.click(screen.getByRole('button', { name: /erfassen/i }));

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
    await userEvent.type(screen.getByLabelText(/menge/i), '200');
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
    expect(screen.queryByText(/gesamt/i)).not.toBeInTheDocument();
  });

  it('calls onBack when back button is clicked', async () => {
    const onBack = vi.fn<() => void>();
    renderWithProviders(
      <FullEntryConfirm result={chicken} date="2026-04-21" slot="lunch" onSuccess={() => {}} onBack={onBack} />,
      { queryClient: createTestQueryClient() },
    );
    await userEvent.click(screen.getByRole('button', { name: /zurück/i }));
    expect(onBack).toHaveBeenCalled();
  });

  it('renders the amount input pre-filled when defaultAmount is provided', () => {
    renderWithProviders(
      <FullEntryConfirm
        result={chicken}
        date="2026-04-21"
        slot="lunch"
        onSuccess={() => {}}
        onBack={() => {}}
        defaultAmount={80}
      />,
      { queryClient: createTestQueryClient() },
    );
    expect(screen.getByLabelText(/menge/i)).toHaveValue(80);
  });

  it('submits the pre-filled amount unchanged when the user just hits Erfassen', async () => {
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
      <FullEntryConfirm
        result={chicken}
        date="2026-04-21"
        slot="lunch"
        onSuccess={onSuccess}
        onBack={() => {}}
        defaultAmount={80}
      />,
      { queryClient: createTestQueryClient() },
    );

    await userEvent.click(screen.getByRole('button', { name: /erfassen/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    const ing = (posted as Record<string, unknown>)['ingredient'] as Record<string, unknown>;
    expect(ing['amount']).toBe(80);
  });

  it('submits the edited amount (not the pre-filled one) when the user changes the input', async () => {
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
      <FullEntryConfirm
        result={chicken}
        date="2026-04-21"
        slot="lunch"
        onSuccess={onSuccess}
        onBack={() => {}}
        defaultAmount={80}
      />,
      { queryClient: createTestQueryClient() },
    );

    await userEvent.clear(screen.getByLabelText(/menge/i));
    await userEvent.type(screen.getByLabelText(/menge/i), '120');
    await userEvent.click(screen.getByRole('button', { name: /erfassen/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    const ing = (posted as Record<string, unknown>)['ingredient'] as Record<string, unknown>;
    expect(ing['amount']).toBe(120);
  });

  it('leaves the amount input empty when defaultAmount is omitted', () => {
    renderWithProviders(
      <FullEntryConfirm result={chicken} date="2026-04-21" slot="lunch" onSuccess={() => {}} onBack={() => {}} />,
      { queryClient: createTestQueryClient() },
    );
    expect(screen.getByLabelText(/menge/i)).toHaveValue(null);
  });

  it('pre-fills the amount input with servingQuantity when no defaultAmount is given', () => {
    renderWithProviders(
      <FullEntryConfirm
        result={{ ...chicken, servingQuantity: 25 }}
        date="2026-04-21"
        slot="lunch"
        onSuccess={() => {}}
        onBack={() => {}}
      />,
      { queryClient: createTestQueryClient() },
    );
    expect(screen.getByLabelText(/menge/i)).toHaveValue(25);
  });

  it('prefers defaultAmount over servingQuantity', () => {
    renderWithProviders(
      <FullEntryConfirm
        result={{ ...chicken, servingQuantity: 25 }}
        date="2026-04-21"
        slot="lunch"
        onSuccess={() => {}}
        onBack={() => {}}
        defaultAmount={80}
      />,
      { queryClient: createTestQueryClient() },
    );
    expect(screen.getByLabelText(/menge/i)).toHaveValue(80);
  });

  it('leaves the amount input empty when neither defaultAmount nor servingQuantity is present', () => {
    renderWithProviders(
      <FullEntryConfirm result={chicken} date="2026-04-21" slot="lunch" onSuccess={() => {}} onBack={() => {}} />,
      { queryClient: createTestQueryClient() },
    );
    expect(screen.getByLabelText(/menge/i)).toHaveValue(null);
  });
});
