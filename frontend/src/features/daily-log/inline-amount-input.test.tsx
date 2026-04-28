import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw/server';
import { renderWithProviders, createTestQueryClient } from '../../test/harness';
import { queryKeys } from '../../queries/keys';
import type { DailyLog, LogEntry } from '../../domain/meal-log';
import { InlineAmountInput } from './inline-amount-input';

const DATE = '2026-04-20';

function makeFullEntry(amount = 100): LogEntry {
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

function seedLog(entry: LogEntry): DailyLog {
  const emptyTotals = { calories: 0, protein: 0, carbs: 0, fat: 0, macrosPartial: false };
  return {
    date: DATE,
    slots: [
      { slot: 'breakfast', entries: [], totals: emptyTotals },
      { slot: 'lunch', entries: [entry], totals: emptyTotals },
      { slot: 'dinner', entries: [], totals: emptyTotals },
      { slot: 'snack', entries: [], totals: emptyTotals },
    ],
    totals: emptyTotals,
  };
}

function installPatchSpy() {
  const patchBodies: unknown[] = [];
  server.use(
    http.patch('/api/log-entry/:id', async ({ request }) => {
      patchBodies.push(await request.json());
      return HttpResponse.json({});
    }),
  );
  return patchBodies;
}

describe('InlineAmountInput', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders a number input pre-filled with the entry amount', () => {
    renderWithProviders(<InlineAmountInput entry={makeFullEntry(150) as never} />);
    const input = screen.getByRole('spinbutton');
    expect(input).toHaveValue(150);
    expect(input).toHaveAttribute('min', '1');
  });

  it('debounces the PATCH and sends exactly one request after 500ms', async () => {
    const patchBodies = installPatchSpy();
    const queryClient = createTestQueryClient();
    const entry = makeFullEntry(100);
    queryClient.setQueryData(queryKeys.dailyLog(DATE), seedLog(entry));

    renderWithProviders(<InlineAmountInput entry={entry as never} />, { queryClient });
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '250' } });

    expect(patchBodies).toHaveLength(0);
    vi.advanceTimersByTime(499);
    expect(patchBodies).toHaveLength(0);
    vi.advanceTimersByTime(2);
    await waitFor(() => expect(patchBodies).toHaveLength(1));
    expect(patchBodies[0]).toEqual({ type: 'full', amount: 250 });
  });

  it('coalesces rapid edits into a single PATCH with the latest value', async () => {
    const patchBodies = installPatchSpy();
    const queryClient = createTestQueryClient();
    const entry = makeFullEntry(100);
    queryClient.setQueryData(queryKeys.dailyLog(DATE), seedLog(entry));

    renderWithProviders(<InlineAmountInput entry={entry as never} />, { queryClient });
    const input = screen.getByRole('spinbutton');

    fireEvent.change(input, { target: { value: '150' } });
    vi.advanceTimersByTime(100);
    fireEvent.change(input, { target: { value: '200' } });
    vi.advanceTimersByTime(501);

    await waitFor(() => expect(patchBodies).toHaveLength(1));
    expect(patchBodies[0]).toEqual({ type: 'full', amount: 200 });
  });

  it('does not PATCH when the input is empty', () => {
    const patchBodies = installPatchSpy();
    renderWithProviders(<InlineAmountInput entry={makeFullEntry(100) as never} />);
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '' } });
    vi.advanceTimersByTime(1000);
    expect(patchBodies).toHaveLength(0);
  });

  it('does not PATCH when the value is below 1g', () => {
    const patchBodies = installPatchSpy();
    renderWithProviders(<InlineAmountInput entry={makeFullEntry(100) as never} />);
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '0' } });
    vi.advanceTimersByTime(1000);
    expect(patchBodies).toHaveLength(0);
  });
});
