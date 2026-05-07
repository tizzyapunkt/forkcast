import { describe, it, expect } from 'vitest';
import { verifyPassword, signSession, verifySession } from './auth.service.ts';

const SECRET = 'test-secret-that-is-long-enough-for-hmac';

describe('verifyPassword', () => {
  it('returns true for correct password', () => {
    expect(verifyPassword('hunter2', 'hunter2')).toBe(true);
  });

  it('returns false for wrong password', () => {
    expect(verifyPassword('wrong', 'hunter2')).toBe(false);
  });

  it('returns false for empty input', () => {
    expect(verifyPassword('', 'hunter2')).toBe(false);
  });
});

describe('signSession / verifySession', () => {
  it('issues a JWT that verifies successfully', async () => {
    const token = await signSession(SECRET);
    const payload = await verifySession(token, SECRET);
    expect(payload).not.toBeNull();
    expect(payload?.sub).toBe('owner');
  });

  it('returns null for a tampered token', async () => {
    const token = await signSession(SECRET);
    const tampered = token.slice(0, -5) + 'XXXXX';
    const payload = await verifySession(tampered, SECRET);
    expect(payload).toBeNull();
  });

  it('returns null when verified with wrong secret', async () => {
    const token = await signSession(SECRET);
    const payload = await verifySession(token, 'wrong-secret');
    expect(payload).toBeNull();
  });

  it('returns null for an arbitrary string', async () => {
    const payload = await verifySession('not.a.jwt', SECRET);
    expect(payload).toBeNull();
  });
});
