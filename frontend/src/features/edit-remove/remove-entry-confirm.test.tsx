import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw/server';
import { renderWithProviders, createTestQueryClient } from '../../test/harness';
import { makeLogEntry } from '../../test/msw/fixtures';
import { RemoveEntryConfirm } from './remove-entry-confirm';

describe('RemoveEntryConfirm', () => {
  it('calls DELETE and onConfirm on confirm click', async () => {
    const entry = makeLogEntry();
    server.use(http.delete('/api/log-entry/:id', () => new HttpResponse(null, { status: 204 })));
    const onConfirm = vi.fn<() => void>();
    renderWithProviders(<RemoveEntryConfirm entry={entry} onConfirm={onConfirm} onCancel={() => {}} />, {
      queryClient: createTestQueryClient(),
    });
    await userEvent.click(screen.getByRole('button', { name: /remove/i }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalled());
  });

  it('calls onCancel without deleting when Cancel is clicked', async () => {
    let deleted = false;
    server.use(
      http.delete('/api/log-entry/:id', () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const onCancel = vi.fn<() => void>();
    renderWithProviders(<RemoveEntryConfirm entry={makeLogEntry()} onConfirm={() => {}} onCancel={onCancel} />, {
      queryClient: createTestQueryClient(),
    });
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
    expect(deleted).toBe(false);
  });
});
