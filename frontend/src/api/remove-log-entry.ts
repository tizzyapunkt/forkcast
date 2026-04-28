import { ApiError } from './client';

export async function removeLogEntry(id: string): Promise<void> {
  const res = await fetch(`/api/log-entry/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // non-JSON body
    }
    throw new ApiError(res.status, message);
  }
}
