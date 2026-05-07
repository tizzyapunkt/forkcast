import type { Context } from 'hono';
import { setCookie } from 'hono/cookie';
import { COOKIE_NAME } from '../../domain/auth/auth.service.ts';

export function makeLogoutHandler() {
  return (c: Context) => {
    setCookie(c, COOKIE_NAME, '', {
      httpOnly: true,
      sameSite: 'Strict',
      path: '/',
      maxAge: 0,
    });
    return c.json({ ok: true });
  };
}
