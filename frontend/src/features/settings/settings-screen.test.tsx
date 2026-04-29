import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, createTestQueryClient } from '../../test/harness';
import { App } from '../../app';

describe('Settings navigation', () => {
  it('Settings tab in the bottom nav switches to the settings view', async () => {
    renderWithProviders(<App />, { queryClient: createTestQueryClient() });
    await userEvent.click(screen.getByRole('button', { name: /settings/i }));
    expect(await screen.findByRole('heading', { name: /nutrition goal/i })).toBeInTheDocument();
  });

  it('Log tab in the bottom nav returns to the daily log view', async () => {
    renderWithProviders(<App />, { queryClient: createTestQueryClient() });
    await userEvent.click(screen.getByRole('button', { name: /settings/i }));
    await screen.findByRole('heading', { name: /nutrition goal/i });
    await userEvent.click(screen.getByRole('button', { name: /log/i }));
    expect(screen.queryByRole('heading', { name: /nutrition goal/i })).not.toBeInTheDocument();
  });
});
