import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { signSession } from '../../domain/auth/auth.service.ts';
import { makeAuthMiddleware } from './auth.middleware.ts';

const SECRET = 'test-jwt-secret-long-enough-for-hs256';

function makeApp() {
  const app = new Hono();
  app.use('*', makeAuthMiddleware(SECRET));
  app.get('/protected', (c) => c.json({ data: 'secret' }));
  return app;
}

describe('makeAuthMiddleware', () => {
  it('returns 401 when no cookie is present', async () => {
    const res = await makeApp().request('/protected');
    expect(res.status).toBe(401);
  });

  it('returns 200 when a valid session cookie is provided', async () => {
    const token = await signSession(SECRET);
    const res = await makeApp().request('/protected', {
      headers: { Cookie: `session=${token}` },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: 'secret' });
  });

  it('returns 401 for a tampered token', async () => {
    const token = await signSession(SECRET);
    const tampered = token.slice(0, -5) + 'XXXXX';
    const res = await makeApp().request('/protected', {
      headers: { Cookie: `session=${tampered}` },
    });
    expect(res.status).toBe(401);
  });
});
