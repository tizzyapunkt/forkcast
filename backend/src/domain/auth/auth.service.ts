import { createHmac, timingSafeEqual } from 'node:crypto';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

const SESSION_EXPIRY = '30d';
const COOKIE_NAME = 'session';

export { COOKIE_NAME };

export function verifyPassword(input: string, expected: string): boolean {
  const a = Buffer.from(createHmac('sha256', 'cmp').update(input).digest());
  const b = Buffer.from(createHmac('sha256', 'cmp').update(expected).digest());
  return timingSafeEqual(a, b);
}

function secretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signSession(secret: string): Promise<string> {
  return new SignJWT({ sub: 'owner' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(SESSION_EXPIRY)
    .sign(secretKey(secret));
}

export async function verifySession(token: string, secret: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(secret));
    return payload;
  } catch {
    return null;
  }
}
