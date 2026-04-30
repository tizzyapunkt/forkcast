import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, createTestQueryClient } from '../../test/harness';
import { App } from '../../app';

describe('Settings navigation', () => {
  it('Settings tab in the bottom nav switches to the settings view', async () => {
    renderWithProviders(<App />, { queryClient: createTestQueryClient() });
    await userEvent.click(screen.getByRole('button', { name: /Einstellungen/i }));
    expect(await screen.findByRole('heading', { name: /ernährungsziel/i })).toBeInTheDocument();
  });

  it('Log tab in the bottom nav returns to the daily log view', async () => {
    renderWithProviders(<App />, { queryClient: createTestQueryClient() });
    await userEvent.click(screen.getByRole('button', { name: /Einstellungen/i }));
    await screen.findByRole('heading', { name: /ernährungsziel/i });
    await userEvent.click(screen.getByRole('button', { name: /Tagebuch/i }));
    expect(screen.queryByRole('heading', { name: /ernährungsziel/i })).not.toBeInTheDocument();
  });
});
