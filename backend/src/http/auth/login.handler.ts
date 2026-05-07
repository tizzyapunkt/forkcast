import type { Context } from 'hono';
import { setCookie } from 'hono/cookie';
import { verifyPassword, signSession, COOKIE_NAME } from '../../domain/auth/auth.service.ts';

export function makeLoginHandler(password: string, jwtSecret: string) {
  return async (c: Context) => {
    let body: { password?: unknown };
    try {
      body = await c.req.json<{ password?: unknown }>();
    } catch {
      return c.json({ error: 'Invalid JSON' }, 400);
    }

    if (typeof body.password !== 'string' || !body.password) {
      return c.json({ error: 'password is required' }, 400);
    }

    if (!verifyPassword(body.password, password)) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const token = await signSession(jwtSecret);
    setCookie(c, COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'Strict',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
    return c.json({ ok: true });
  };
}
