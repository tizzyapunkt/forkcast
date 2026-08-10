import { recordApiFailure } from '../lib/client-log';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    /** The parsed error payload, when the response had one — carries codes and hints beyond the message. */
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const method = init?.method?.toUpperCase() ?? 'GET';
  let res: Response;
  try {
    res = await fetch(path, init);
  } catch (err) {
    recordApiFailure(method, path, err instanceof Error ? err.message : String(err));
    throw err;
  }
  if (!res.ok) {
    let message = res.statusText;
    let payload: unknown;
    try {
      payload = await res.json();
      const body = payload as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // non-JSON body — keep statusText
    }
    recordApiFailure(method, path, `${res.status} ${message}`);
    throw new ApiError(res.status, message, payload);
  }
  return res.json() as Promise<T>;
}
