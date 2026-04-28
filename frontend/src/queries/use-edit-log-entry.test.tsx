import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../test/msw/server';
import { renderWithProviders, createTestQueryClient } from '../test/harness';
import { useEditLogEntry } from './use-edit-log-entry';
import { queryKeys } from './keys';
import type { DailyLog, LogEntry } from '../domain/meal-log';

const DATE = '2026-04-20';

function fullEntry(amount: number): LogEntry {
  return {
    id: 'entry-1',
    date: DATE,
    slot: 'lunch',
    loggedAt: '2026-04-20T12:00:00Z',
    ingredient: {
      type: 'full',
      name: 'Chicken breast',
      unit: 'g',
      macrosPerUnit: { calories: 1.65, protein: 0.31, carbs: 0, fat: 0.036 },
      amount,
    },
  };
}

function seedLog(amount: number): DailyLog {
  const entry = fullEntry(amount);
  const slot = {
    slot: 'lunch' as const,
    entries: [entry],
    totals: {
      calories: 1.65 * amount,
      protein: 0.31 * amount,
      carbs: 0,
      fat: 0.036 * amount,
      macrosPartial: false,
    },
  };
  const empty = (s: 'breakfast' | 'dinner' | 'snack') => ({
    slot: s,
    entries: [],
    totals: { calories: 0, protein: 0, carbs: 0, fat: 0, macrosPartial: false },
  });
  return {
    date: DATE,
    slots: [empty('breakfast'), slot, empty('dinner'), empty('snack')],
    totals: { ...slot.totals },
  };
}

function FullPatchConsumer({ amount, onSuccess }: { amount: number; onSuccess?: () => void }) {
  const { mutate, isSuccess } = useEditLogEntry();
  return (
    <button
      onClick={() =>
        mutate({ id: 'entry-1', date: DATE, patch: { type: 'full', amount } }, { onSuccess: () => onSuccess?.() })
      }
    >
      {isSuccess ? 'done' : 'edit'}
    </button>
  );
}

describe('useEditLogEntry', () => {
  it('calls PATCH and invalidates the daily-log query for the entry date', async () => {
    const queryClient = createTestQueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    server.use(
      http.patch('/api/log-entry/:id', () =>
        HttpResponse.json({
          id: 'entry-1',
          date: DATE,
          slot: 'breakfast',
          ingredient: { type: 'quick', label: 'x', calories: 200 },
          loggedAt: '',
        }),
      ),
    );

    function Consumer() {
      const { mutate, isSuccess } = useEditLogEntry();
      return (
        <button onClick={() => mutate({ id: 'entry-1', date: DATE, patch: { type: 'quick', calories: 200 } })}>
          {isSuccess ? 'done' : 'edit'}
        </button>
      );
    }

    renderWithProviders(<Consumer />, { queryClient });
    await userEvent.click(screen.getByRole('button', { name: 'edit' }));
    expect(await screen.findByText('done')).toBeInTheDocument();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.dailyLog(DATE) });
  });

  it('optimistically updates the cached daily-log before the server responds', async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(queryKeys.dailyLog(DATE), seedLog(100));

    let resolvePatch: () => void = () => {};
    server.use(
      http.patch('/api/log-entry/:id', async () => {
        await new Promise<void>((r) => {
          resolvePatch = r;
        });
        return HttpResponse.json({});
      }),
    );

    renderWithProviders(<FullPatchConsumer amount={200} />, { queryClient });
    await userEvent.click(screen.getByRole('button', { name: 'edit' }));

    await waitFor(() => {
      const cached = queryClient.getQueryData<DailyLog>(queryKeys.dailyLog(DATE));
      expect(cached?.slots[1].entries[0].ingredient).toMatchObject({ amount: 200 });
    });

    const cached = queryClient.getQueryData<DailyLog>(queryKeys.dailyLog(DATE));
    expect(cached?.slots[1].totals.calories).toBeCloseTo(1.65 * 200);
    expect(cached?.totals.calories).toBeCloseTo(1.65 * 200);

    resolvePatch();
  });

  it('rolls back the optimistic update when the server returns an error', async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(queryKeys.dailyLog(DATE), seedLog(100));

    server.use(http.patch('/api/log-entry/:id', () => HttpResponse.json({ error: 'boom' }, { status: 500 })));

    renderWithProviders(<FullPatchConsumer amount={999} />, { queryClient });
    await userEvent.click(screen.getByRole('button', { name: 'edit' }));

    await waitFor(() => {
      const cached = queryClient.getQueryData<DailyLog>(queryKeys.dailyLog(DATE));
      expect(cached?.slots[1].entries[0].ingredient).toMatchObject({ amount: 100 });
    });
  });
});
