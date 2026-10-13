import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

const SESSION_EXPIRY = '30d';
const COOKIE_NAME = 'session';

export { COOKIE_NAME };

const encoder = new TextEncoder();

async function digest(key: CryptoKey, text: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(text)));
}

/** Compares HMAC digests of both strings byte by byte, so timing says nothing about the password. */
export async function verifyPassword(input: string, expected: string): Promise<boolean> {
  const key = await crypto.subtle.importKey('raw', encoder.encode('cmp'), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  const [a, b] = await Promise.all([digest(key, input), digest(key, expected)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
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
