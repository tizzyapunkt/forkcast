import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw/server';
import { renderWithProviders } from '../../test/harness';
import { AuthGuard } from './auth-guard';

function Protected() {
  return <div>protected content</div>;
}

describe('AuthGuard', () => {
  it('renders children when session is valid', async () => {
    server.use(http.get('/api/auth/me', () => HttpResponse.json({ ok: true })));

    renderWithProviders(
      <AuthGuard>
        <Protected />
      </AuthGuard>,
    );

    expect(await screen.findByText('protected content')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Passwort/i)).not.toBeInTheDocument();
  });

  it('renders the login page when session is invalid', async () => {
    server.use(http.get('/api/auth/me', () => HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })));

    renderWithProviders(
      <AuthGuard>
        <Protected />
      </AuthGuard>,
    );

    expect(await screen.findByLabelText(/Passwort/i)).toBeInTheDocument();
    expect(screen.queryByText('protected content')).not.toBeInTheDocument();
  });

  it('shows login page when a query returns 401 during active session', async () => {
    server.use(http.get('/api/auth/me', () => HttpResponse.json({ ok: true })));

    const { queryClient } = renderWithProviders(
      <AuthGuard>
        <Protected />
      </AuthGuard>,
    );

    await screen.findByText('protected content');

    // Simulate a 401 from a downstream query by directly invalidating session state
    queryClient.setQueryData(['auth', 'session'], false);

    await waitFor(() => {
      expect(screen.queryByText('protected content')).not.toBeInTheDocument();
    });
    expect(screen.getByLabelText(/Passwort/i)).toBeInTheDocument();
  });
});
