import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw/server';
import { renderWithProviders, createTestQueryClient } from '../../test/harness';
import { makeLogEntry } from '../../test/msw/fixtures';
import type { LogEntry, QuickIngredientEntry } from '../../domain/meal-log';
import { EditEntryDrawer } from './edit-entry-drawer';

function makeQuickEntry(overrides: Partial<QuickIngredientEntry> = {}) {
  return makeLogEntry({
    ingredient: { type: 'quick', label: 'Oats', calories: 300, ...overrides },
  }) as LogEntry & { ingredient: QuickIngredientEntry };
}

describe('EditEntryDrawer — quick entry', () => {
  it('pre-fills calories and macros from the existing entry', () => {
    const entry = makeQuickEntry({ calories: 300, protein: 10 });
    renderWithProviders(<EditEntryDrawer entry={entry} onClose={() => {}} />, {
      queryClient: createTestQueryClient(),
    });
    expect((screen.getByLabelText(/kalorien/i) as HTMLInputElement).value).toBe('300');
    expect((screen.getByLabelText(/eiweiß/i) as HTMLInputElement).value).toBe('10');
  });

  it('PATCHes with type:quick payload and calls onClose', async () => {
    let patched: unknown;
    const entry = makeQuickEntry({ calories: 300 });
    server.use(
      http.patch('/api/log-entry/:id', async ({ request }) => {
        patched = await request.json();
        return HttpResponse.json({ ...entry, ingredient: { type: 'quick', label: 'Oats', calories: 400 } });
      }),
    );
    const onClose = vi.fn<() => void>();
    renderWithProviders(<EditEntryDrawer entry={entry} onClose={onClose} />, {
      queryClient: createTestQueryClient(),
    });

    const cal = screen.getByLabelText(/kalorien/i);
    await userEvent.clear(cal);
    await userEvent.type(cal, '400');
    await userEvent.click(screen.getByRole('button', { name: /änderungen speichern/i }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect((patched as Record<string, unknown>)['type']).toBe('quick');
    expect((patched as Record<string, unknown>)['calories']).toBe(400);
  });

  it('shows backend 400 error inline without closing', async () => {
    const entry = makeQuickEntry({ calories: 300 });
    server.use(http.patch('/api/log-entry/:id', () => HttpResponse.json({ error: 'Invalid' }, { status: 400 })));
    const onClose = vi.fn<() => void>();
    renderWithProviders(<EditEntryDrawer entry={entry} onClose={onClose} />, {
      queryClient: createTestQueryClient(),
    });

    const cal = screen.getByLabelText(/kalorien/i);
    await userEvent.clear(cal);
    await userEvent.type(cal, '400');
    await userEvent.click(screen.getByRole('button', { name: /änderungen speichern/i }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
