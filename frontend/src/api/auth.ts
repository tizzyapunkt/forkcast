import { ApiError } from './client';

export async function checkSession(): Promise<boolean> {
  const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
  return res.ok;
}

export async function login(password: string): Promise<void> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    throw new ApiError(res.status, res.status === 401 ? 'Falsches Passwort' : res.statusText);
  }
}

export async function logout(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
}
