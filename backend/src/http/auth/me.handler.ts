import type { Context } from 'hono';
import { getCookie } from 'hono/cookie';
import { verifySession, COOKIE_NAME } from '../../domain/auth/auth.service.ts';

export function makeMeHandler(jwtSecret: string) {
  return async (c: Context) => {
    const token = getCookie(c, COOKIE_NAME);
    if (!token) return c.json({ error: 'Unauthorized' }, 401);

    const payload = await verifySession(token, jwtSecret);
    if (!payload) return c.json({ error: 'Unauthorized' }, 401);

    return c.json({ ok: true });
  };
}
