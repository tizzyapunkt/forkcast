import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, createTestQueryClient } from '../../test/harness';
import { App } from '../../app';

vi.mock('../../demo/is-demo', () => ({ isDemo: true }));

describe('Settings in the demo', () => {
  it('has no diagnostics link and no logout, but keeps the rest', async () => {
    renderWithProviders(<App />, { queryClient: createTestQueryClient() });
    await userEvent.click(screen.getByRole('button', { name: /Einstellungen/i }));
    await screen.findByRole('heading', { name: /ernährungsziel/i });

    expect(screen.queryByRole('button', { name: /Diagnose/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Abmelden' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Gewicht/i })).toBeInTheDocument();
  });
});
