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
  const res = await fetch(path, init);
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
    throw new ApiError(res.status, message, payload);
  }
  return res.json() as Promise<T>;
}
