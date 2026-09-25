import { createHmac } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';

/** What a Bring! import link may read: one week's grocery list, minus the items unticked in forkcast. */
export interface ImportGrant {
  startDate: string;
  excluded: string[]; // grocery item identities (case-insensitive name + unit)
}

const AUDIENCE = 'bring-import';
const LIFETIME_SECONDS = 60 * 60;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Import links are signed with a key derived from the session secret, never the session key itself:
 * session verification checks only signature and expiry, so a link signed with that key would work
 * as a login.
 */
export function importTokenKey(secret: string): Uint8Array {
  return new Uint8Array(createHmac('sha256', secret).update(AUDIENCE).digest());
}

function isGrant(value: unknown): value is ImportGrant {
  const g = value as Partial<ImportGrant> | null;
  return (
    !!g &&
    typeof g.startDate === 'string' &&
    ISO_DATE.test(g.startDate) &&
    Array.isArray(g.excluded) &&
    g.excluded.every((key) => typeof key === 'string')
  );
}

/** Mint a one-hour import link token for a week. Throws a validation error for a malformed grant. */
export async function mintImportToken(grant: ImportGrant, secret: string, now: Date = new Date()): Promise<string> {
  if (!isGrant(grant)) throw new Error('startDate (YYYY-MM-DD) and excluded (string[]) are required');
  const issuedAt = Math.floor(now.getTime() / 1000);
  return new SignJWT({ startDate: grant.startDate, excluded: grant.excluded })
    .setProtectedHeader({ alg: 'HS256' })
    .setAudience(AUDIENCE)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + LIFETIME_SECONDS)
    .sign(importTokenKey(secret));
}

/** The grant behind a valid, unexpired import token; `null` for anything else. */
export async function verifyImportToken(
  token: string,
  secret: string,
  now: Date = new Date(),
): Promise<ImportGrant | null> {
  try {
    const { payload } = await jwtVerify(token, importTokenKey(secret), { audience: AUDIENCE, currentDate: now });
    const grant = { startDate: payload['startDate'], excluded: payload['excluded'] };
    return isGrant(grant) ? grant : null;
  } catch {
    return null;
  }
}
