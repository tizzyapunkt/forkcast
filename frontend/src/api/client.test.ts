import { http, HttpResponse } from 'msw';
import { server } from '../test/msw/server';
import { fetchJson, ApiError } from './client';
import { clearClientLog, clientLogEntries } from '../lib/client-log';

describe('fetchJson', () => {
  beforeEach(() => clearClientLog());

  it('returns parsed JSON on success', async () => {
    server.use(http.get('/api/test', () => HttpResponse.json({ ok: true })));
    const result = await fetchJson<{ ok: boolean }>('/api/test');
    expect(result).toEqual({ ok: true });
  });

  it('throws ApiError with status and message on non-ok response', async () => {
    server.use(http.get('/api/test', () => HttpResponse.json({ error: 'not found' }, { status: 404 })));
    await expect(fetchJson('/api/test')).rejects.toMatchObject({ status: 404, message: 'not found' });
  });

  it('throws ApiError with status on non-JSON error response', async () => {
    server.use(http.get('/api/test', () => new HttpResponse('Internal error', { status: 500 })));
    await expect(fetchJson('/api/test')).rejects.toBeInstanceOf(ApiError);
  });

  it('records a failed call in the client diagnostics log', async () => {
    server.use(http.get('/api/test', () => HttpResponse.json({ error: 'not found' }, { status: 404 })));
    await expect(fetchJson('/api/test')).rejects.toBeInstanceOf(ApiError);

    const [entry] = clientLogEntries();
    expect(entry.kind).toBe('api');
    expect(entry.message).toBe('GET /api/test — 404 not found');
  });

  it('records the request method of a failed call', async () => {
    server.use(http.post('/api/test', () => HttpResponse.json({ error: 'nope' }, { status: 400 })));
    await expect(fetchJson('/api/test', { method: 'POST' })).rejects.toBeInstanceOf(ApiError);

    expect(clientLogEntries()[0].message).toBe('POST /api/test — 400 nope');
  });

  it('records a network failure with its reason', async () => {
    server.use(http.get('/api/test', () => HttpResponse.error()));
    await expect(fetchJson('/api/test')).rejects.toThrow(/Failed to fetch|NetworkError|fetch failed/);

    const [entry] = clientLogEntries();
    expect(entry.kind).toBe('api');
    expect(entry.message).toMatch(/^GET \/api\/test — /);
  });

  it('records nothing on success', async () => {
    server.use(http.get('/api/test', () => HttpResponse.json({ ok: true })));
    await fetchJson('/api/test');

    expect(clientLogEntries()).toHaveLength(0);
  });
});
