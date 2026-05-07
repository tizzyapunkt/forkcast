import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw/server';
import { renderWithProviders } from '../../test/harness';
import { LoginPage } from './login-page';

describe('LoginPage', () => {
  it('renders the password field and submit button', () => {
    renderWithProviders(<LoginPage />);
    expect(screen.getByLabelText(/Passwort/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Anmelden/i })).toBeInTheDocument();
  });

  it('shows an error message on wrong password', async () => {
    server.use(http.post('/api/auth/login', () => HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })));

    renderWithProviders(<LoginPage />);
    await userEvent.type(screen.getByLabelText(/Passwort/i), 'wrong-password');
    await userEvent.click(screen.getByRole('button', { name: /Anmelden/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Falsches Passwort/i);
    expect(screen.getByLabelText(/Passwort/i)).toBeInTheDocument();
  });

  it('clears error after correcting and resubmitting', async () => {
    let callCount = 0;
    server.use(
      http.post('/api/auth/login', async ({ request }) => {
        callCount++;
        const body = (await request.json()) as { password?: string };
        if (callCount === 1 || body.password !== 'test-password') {
          return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        return HttpResponse.json({ ok: true });
      }),
    );

    renderWithProviders(<LoginPage />);
    const input = screen.getByLabelText(/Passwort/i);
    const btn = screen.getByRole('button', { name: /Anmelden/i });

    await userEvent.type(input, 'wrong');
    await userEvent.click(btn);
    await screen.findByRole('alert');

    await userEvent.clear(input);
    await userEvent.type(input, 'test-password');
    await userEvent.click(btn);

    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });
});
