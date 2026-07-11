import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw/server';
import { renderWithProviders } from '../../test/harness';
import { clearClientLog, recordApiFailure } from '../../lib/client-log';
import { DiagnosticsScreen } from './diagnostics-screen';

const SERVER_ENTRIES = [
  { at: '2026-07-11T18:28:59.000Z', kind: 'off', message: 'search failed 403 Forbidden (120ms)' },
  { at: '2026-07-11T18:29:01.000Z', kind: 'http', message: 'GET /search-ingredients → 502 (130ms)' },
];

describe('DiagnosticsScreen', () => {
  beforeEach(() => {
    clearClientLog();
    server.use(http.get('/api/debug/logs', () => HttpResponse.json({ entries: SERVER_ENTRIES })));
  });

  it('shows client and server entries with timestamps', async () => {
    recordApiFailure('GET', '/api/search-ingredients', '502 kaputt');
    renderWithProviders(<DiagnosticsScreen onBack={() => {}} />);

    expect(await screen.findByText(/search failed 403 Forbidden/)).toBeInTheDocument();
    expect(screen.getByText(/GET \/api\/search-ingredients — 502 kaputt/)).toBeInTheDocument();
  });

  it('shows an error state when the server log cannot be fetched, client entries stay visible', async () => {
    server.use(http.get('/api/debug/logs', () => HttpResponse.json({ error: 'nope' }, { status: 500 })));
    renderWithProviders(<DiagnosticsScreen onBack={() => {}} />);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    // the failed /api/debug/logs call itself lands in the client log
    expect(screen.getByText(/GET \/api\/debug\/logs — 500/)).toBeInTheDocument();
  });

  it('copies the diagnostics bundle to the clipboard and confirms', async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    recordApiFailure('GET', '/api/search-ingredients', '502 kaputt');
    renderWithProviders(<DiagnosticsScreen onBack={() => {}} />);
    await screen.findByText(/search failed 403 Forbidden/);

    await userEvent.click(screen.getByRole('button', { name: 'Diagnose kopieren' }));

    await waitFor(() => expect(screen.getByText('Kopiert ✓')).toBeInTheDocument());
    const bundle = writeText.mock.calls[0][0];
    expect(bundle).toContain('# forkcast Diagnose');
    expect(bundle).toContain('GET /api/search-ingredients — 502 kaputt');
    expect(bundle).toContain('search failed 403 Forbidden (120ms)');
  });

  it('refetches the server log on refresh', async () => {
    let calls = 0;
    server.use(
      http.get('/api/debug/logs', () => {
        calls += 1;
        return HttpResponse.json({ entries: SERVER_ENTRIES });
      }),
    );
    renderWithProviders(<DiagnosticsScreen onBack={() => {}} />);
    await screen.findByText(/search failed 403 Forbidden/);

    await userEvent.click(screen.getByRole('button', { name: 'Aktualisieren' }));

    await waitFor(() => expect(calls).toBe(2));
  });
});
