import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../test/msw/server';
import { renderWithProviders, createTestQueryClient } from '../test/harness';
import { useReplaceBatchIngredient } from './use-replace-batch-ingredient';
import { useAddToRecipeBatch } from './use-add-to-recipe-batch';
import type { MockInstance } from 'vitest';
import type { QueryClient } from '@tanstack/react-query';
import type { FullIngredientEntry } from '../domain/meal-log';

const tofu: FullIngredientEntry = {
  type: 'full',
  name: 'Tofu',
  unit: 'g',
  macrosPerUnit: { calories: 1.2, protein: 0.12, carbs: 0.02, fat: 0.07 },
  amount: 250,
};

function ReplaceConsumer() {
  const { mutate, isSuccess } = useReplaceBatchIngredient();
  return (
    <button onClick={() => mutate({ entryId: 'e1', date: '2026-09-29', ingredient: tofu })}>
      {isSuccess ? 'done' : 'go'}
    </button>
  );
}

function AddConsumer() {
  const { mutate, isSuccess } = useAddToRecipeBatch();
  return (
    <button onClick={() => mutate({ recipeBatchId: 'batch-1', date: '2026-09-29', ingredient: tofu })}>
      {isSuccess ? 'done' : 'go'}
    </button>
  );
}

function expectLogCachesInvalidated(invalidate: MockInstance<QueryClient['invalidateQueries']>) {
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['daily-log', '2026-09-29'] });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['week-log'] });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['recently-used-ingredients'] });
}

describe('useReplaceBatchIngredient', () => {
  it('POSTs /replace-batch-ingredient and refreshes the day, the week and recents', async () => {
    const queryClient = createTestQueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    let posted: unknown;
    server.use(
      http.post('/api/replace-batch-ingredient', async ({ request }) => {
        posted = await request.json();
        return HttpResponse.json({});
      }),
    );

    renderWithProviders(<ReplaceConsumer />, { queryClient });
    await userEvent.click(screen.getByRole('button', { name: 'go' }));

    expect(await screen.findByText('done')).toBeInTheDocument();
    expect(posted).toEqual({ entryId: 'e1', ingredient: tofu });
    expectLogCachesInvalidated(invalidate);
  });
});

describe('useAddToRecipeBatch', () => {
  it('POSTs /add-to-recipe-batch and refreshes the day, the week and recents', async () => {
    const queryClient = createTestQueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    let posted: unknown;
    server.use(
      http.post('/api/add-to-recipe-batch', async ({ request }) => {
        posted = await request.json();
        return HttpResponse.json({}, { status: 201 });
      }),
    );

    renderWithProviders(<AddConsumer />, { queryClient });
    await userEvent.click(screen.getByRole('button', { name: 'go' }));

    expect(await screen.findByText('done')).toBeInTheDocument();
    expect(posted).toEqual({ recipeBatchId: 'batch-1', date: '2026-09-29', ingredient: tofu });
    expectLogCachesInvalidated(invalidate);
  });
});
