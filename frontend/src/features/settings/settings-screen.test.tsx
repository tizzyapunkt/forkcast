import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, createTestQueryClient } from '../../test/harness';
import { App } from '../../app';

describe('Settings navigation', () => {
  it('Settings button switches to the settings view', async () => {
    renderWithProviders(<App />, { queryClient: createTestQueryClient() });
    await userEvent.click(screen.getByRole('button', { name: /settings/i }));
    expect(await screen.findByRole('heading', { name: /nutrition goal/i })).toBeInTheDocument();
  });

  it('Back button returns to the daily log view', async () => {
    renderWithProviders(<App />, { queryClient: createTestQueryClient() });
    await userEvent.click(screen.getByRole('button', { name: /settings/i }));
    await screen.findByRole('heading', { name: /nutrition goal/i });
    await userEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(await screen.findByRole('heading', { name: /forkcast/i })).toBeInTheDocument();
  });
});
