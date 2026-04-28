import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../test/msw/server';
import { renderWithProviders, createTestQueryClient } from '../test/harness';
import { useRemoveLogEntry } from './use-remove-log-entry';

function Consumer() {
  const { mutate, isSuccess } = useRemoveLogEntry();
  return <button onClick={() => mutate({ id: 'abc', date: '2026-04-20' })}>{isSuccess ? 'done' : 'remove'}</button>;
}

describe('useRemoveLogEntry', () => {
  it('calls DELETE and invalidates the daily-log query', async () => {
    const queryClient = createTestQueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    server.use(http.delete('/api/log-entry/:id', () => new HttpResponse(null, { status: 204 })));

    renderWithProviders(<Consumer />, { queryClient });
    await userEvent.click(screen.getByRole('button', { name: 'remove' }));
    expect(await screen.findByText('done')).toBeInTheDocument();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['daily-log', '2026-04-20'] });
  });
});
