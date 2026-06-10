import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../test/msw/server';
import { renderWithProviders, createTestQueryClient } from '../test/harness';
import { useCopyLogDay } from './use-copy-log-day';

function Consumer() {
  const { mutate, isSuccess } = useCopyLogDay();
  return (
    <button onClick={() => mutate({ fromDate: '2026-06-10', toDate: '2026-06-11' })}>
      {isSuccess ? 'copied' : 'copy'}
    </button>
  );
}

describe('useCopyLogDay', () => {
  it('POSTs /copy-log-day and invalidates the target daily log + the week log', async () => {
    const queryClient = createTestQueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    server.use(http.post('/api/copy-log-day', () => HttpResponse.json([], { status: 201 })));

    renderWithProviders(<Consumer />, { queryClient });
    await userEvent.click(screen.getByRole('button', { name: 'copy' }));

    expect(await screen.findByText('copied')).toBeInTheDocument();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['daily-log', '2026-06-11'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['week-log'] });
  });
});
