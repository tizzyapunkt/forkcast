import { describe, it, expect } from 'vitest';
import { SignJWT } from 'jose';
import { mintImportToken, verifyImportToken } from './import-token.ts';
import { signSession, verifySession } from '../auth/auth.service.ts';

const SECRET = 'test-jwt-secret-long-enough-for-hs256';
const grant = { startDate: '2026-09-28', excluded: ['olivenöl|ml', 'salz|g'] };
const t0 = new Date('2026-09-25T10:00:00Z');
const minutesLater = (m: number) => new Date(t0.getTime() + m * 60_000);

describe('import token', () => {
  it('roundtrips the week and the excluded items', async () => {
    const token = await mintImportToken(grant, SECRET, t0);

    expect(await verifyImportToken(token, SECRET, minutesLater(5))).toEqual(grant);
  });

  it('is valid for an hour and no longer', async () => {
    const token = await mintImportToken(grant, SECRET, t0);

    expect(await verifyImportToken(token, SECRET, minutesLater(59))).toEqual(grant);
    expect(await verifyImportToken(token, SECRET, minutesLater(61))).toBeNull();
  });

  it('rejects a tampered token', async () => {
    const token = await mintImportToken(grant, SECRET, t0);
    const [header, payload, signature] = token.split('.');
    const forged = JSON.parse(Buffer.from(payload!, 'base64url').toString());
    forged.startDate = '2026-10-05';
    const tampered = [header, Buffer.from(JSON.stringify(forged)).toString('base64url'), signature].join('.');

    expect(await verifyImportToken(tampered, SECRET, minutesLater(1))).toBeNull();
  });

  it('rejects a token signed with another secret', async () => {
    const token = await mintImportToken(grant, 'another-secret-that-is-long-enough', t0);
    expect(await verifyImportToken(token, SECRET, minutesLater(1))).toBeNull();
  });

  it('rejects garbage', async () => {
    expect(await verifyImportToken('not-a-token', SECRET)).toBeNull();
  });

  it('never passes as a session', async () => {
    const token = await mintImportToken(grant, SECRET);
    expect(await verifySession(token, SECRET)).toBeNull();
  });

  it('does not accept a session token as an import token', async () => {
    const session = await signSession(SECRET);
    expect(await verifyImportToken(session, SECRET)).toBeNull();
  });

  it('rejects a token with the right key but the wrong audience', async () => {
    const { importTokenKey } = await import('./import-token.ts');
    const wrongAudience = await new SignJWT({ startDate: grant.startDate, excluded: [] })
      .setProtectedHeader({ alg: 'HS256' })
      .setAudience('something-else')
      .setExpirationTime('1h')
      .sign(importTokenKey(SECRET));

    expect(await verifyImportToken(wrongAudience, SECRET)).toBeNull();
  });
});
