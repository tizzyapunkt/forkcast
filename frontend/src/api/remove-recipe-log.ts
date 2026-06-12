import { ApiError } from './client';

/** Removes every log entry of one recipe-log batch atomically. Returns the removed count. */
export async function removeRecipeLog(recipeBatchId: string): Promise<{ removed: number }> {
  const res = await fetch('/api/remove-recipe-log', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ recipeBatchId }),
  });
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
  return (await res.json()) as { removed: number };
}
