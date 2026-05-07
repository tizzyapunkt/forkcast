import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { signSession } from '../../domain/auth/auth.service.ts';
import { makeLoginHandler } from './login.handler.ts';
import { makeLogoutHandler } from './logout.handler.ts';
import { makeMeHandler } from './me.handler.ts';

const PASSWORD = 'correct-horse-battery-staple';
const SECRET = 'test-jwt-secret-long-enough-for-hs256';

function makeApp() {
  const app = new Hono();
  app.post('/auth/login', makeLoginHandler(PASSWORD, SECRET));
  app.post('/auth/logout', makeLogoutHandler());
  app.get('/auth/me', makeMeHandler(SECRET));
  return app;
}

describe('POST /auth/login', () => {
  it('returns 200 and sets cookie for correct password', async () => {
    const res = await makeApp().request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: PASSWORD }),
    });
    expect(res.status).toBe(200);
    const cookie = res.headers.get('set-cookie');
    expect(cookie).toContain('session=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
  });

  it('returns 401 for wrong password', async () => {
    const res = await makeApp().request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'wrong' }),
    });
    expect(res.status).toBe(401);
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('returns 400 when password field is missing', async () => {
    const res = await makeApp().request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });
});

describe('POST /auth/logout', () => {
  it('returns 200 and expires the cookie', async () => {
    const res = await makeApp().request('/auth/logout', { method: 'POST' });
    expect(res.status).toBe(200);
    const cookie = res.headers.get('set-cookie');
    expect(cookie).toContain('session=');
    expect(cookie).toMatch(/Max-Age=0/i);
  });

  it('returns 200 even without a session cookie', async () => {
    const res = await makeApp().request('/auth/logout', { method: 'POST' });
    expect(res.status).toBe(200);
  });
});

describe('GET /auth/me', () => {
  it('returns 200 with a valid session cookie', async () => {
    const token = await signSession(SECRET);
    const res = await makeApp().request('/auth/me', {
      headers: { Cookie: `session=${token}` },
    });
    expect(res.status).toBe(200);
  });

  it('returns 401 with no cookie', async () => {
    const res = await makeApp().request('/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 with a tampered token', async () => {
    const token = await signSession(SECRET);
    const tampered = token.slice(0, -5) + 'XXXXX';
    const res = await makeApp().request('/auth/me', {
      headers: { Cookie: `session=${tampered}` },
    });
    expect(res.status).toBe(401);
  });
});
