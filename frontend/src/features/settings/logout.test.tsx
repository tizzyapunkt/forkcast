import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw/server';
import { renderWithProviders, createTestQueryClient } from '../../test/harness';
import { AuthGuard } from '../auth/auth-guard';
import { App } from '../../app';

describe('Logout', () => {
  it('clicking logout calls POST /auth/logout and shows the login page', async () => {
    const logoutRequests: Request[] = [];
    server.use(
      http.get('/api/auth/me', () => HttpResponse.json({ ok: true })),
      http.post('/api/auth/logout', ({ request }) => {
        logoutRequests.push(request);
        return HttpResponse.json({ ok: true });
      }),
    );

    const queryClient = createTestQueryClient();
    renderWithProviders(
      <AuthGuard>
        <App />
      </AuthGuard>,
      { queryClient },
    );

    // Navigate to settings
    await userEvent.click(await screen.findByRole('button', { name: /Einstellungen/i }));
    await screen.findByRole('heading', { name: /Ernährungsziel/i });

    // Click logout
    await userEvent.click(screen.getByRole('button', { name: /Abmelden/i }));

    // Should call the logout endpoint
    await waitFor(() => expect(logoutRequests).toHaveLength(1));

    // Should show the login page
    await screen.findByLabelText(/Passwort/i);
    expect(screen.queryByRole('button', { name: /Einstellungen/i })).not.toBeInTheDocument();
  });
});
