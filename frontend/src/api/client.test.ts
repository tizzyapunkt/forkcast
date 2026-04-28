import { http, HttpResponse } from 'msw';
import { server } from '../test/msw/server';
import { fetchJson, ApiError } from './client';

describe('fetchJson', () => {
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
});
