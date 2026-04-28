import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw/server';
import { renderWithProviders, createTestQueryClient } from '../../test/harness';
import { QuickEntryForm } from './quick-entry-form';

function render(onSuccess = () => {}) {
  renderWithProviders(<QuickEntryForm date="2026-04-21" slot="breakfast" onSuccess={onSuccess} />, {
    queryClient: createTestQueryClient(),
  });
}

describe('QuickEntryForm', () => {
  it('shows validation errors when submitting empty form', async () => {
    render();
    await userEvent.click(screen.getByRole('button', { name: /add entry/i }));
    expect(await screen.findByText(/label is required/i)).toBeInTheDocument();
    expect(screen.getByText(/calories is required/i)).toBeInTheDocument();
  });

  it('submits quick entry with required fields and calls onSuccess', async () => {
    let posted: unknown;
    server.use(
      http.post('/api/log-ingredient', async ({ request }) => {
        posted = await request.json();
        return HttpResponse.json(
          {
            id: 'x',
            date: '2026-04-21',
            slot: 'breakfast',
            ingredient: (posted as Record<string, unknown>)['ingredient'],
            loggedAt: '',
          },
          { status: 201 },
        );
      }),
    );
    const onSuccess = vi.fn<() => void>();
    renderWithProviders(<QuickEntryForm date="2026-04-21" slot="breakfast" onSuccess={onSuccess} />, {
      queryClient: createTestQueryClient(),
    });

    await userEvent.type(screen.getByLabelText(/label/i), 'Oats');
    await userEvent.type(screen.getByLabelText(/calories/i), '300');
    await userEvent.click(screen.getByRole('button', { name: /add entry/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect((posted as Record<string, unknown>)['slot']).toBe('breakfast');
    const ing = (posted as Record<string, unknown>)['ingredient'] as Record<string, unknown>;
    expect(ing['type']).toBe('quick');
    expect(ing['label']).toBe('Oats');
    expect(ing['calories']).toBe(300);
  });

  it('submits with optional macro fields when filled', async () => {
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
    renderWithProviders(<QuickEntryForm date="2026-04-21" slot="lunch" onSuccess={() => {}} />, {
      queryClient: createTestQueryClient(),
    });

    await userEvent.type(screen.getByLabelText(/label/i), 'Rice');
    await userEvent.type(screen.getByLabelText(/calories/i), '200');
    await userEvent.type(screen.getByLabelText(/protein/i), '4');
    await userEvent.click(screen.getByRole('button', { name: /add entry/i }));

    await waitFor(() => expect(posted).toBeDefined());
    const ing = (posted as Record<string, unknown>)['ingredient'] as Record<string, unknown>;
    expect(ing['protein']).toBe(4);
  });

  it('stays open and shows error banner on backend failure', async () => {
    server.use(http.post('/api/log-ingredient', () => HttpResponse.json({ error: 'Server error' }, { status: 500 })));
    render();
    await userEvent.type(screen.getByLabelText(/label/i), 'Fail');
    await userEvent.type(screen.getByLabelText(/calories/i), '100');
    await userEvent.click(screen.getByRole('button', { name: /add entry/i }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByLabelText(/label/i)).toBeInTheDocument();
  });
});
