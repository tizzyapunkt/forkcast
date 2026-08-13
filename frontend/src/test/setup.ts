import '@testing-library/jest-dom';
import { server } from './msw/server';

Object.defineProperty(window, 'scrollTo', {
  value: vi.fn(),
  writable: true,
});

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
  translateAbortSignals();
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/**
 * jsdom's `AbortSignal` is a different class from the one Node's `fetch` (which msw
 * intercepts) brand-checks against, so a request carrying one throws
 * "Expected signal to be an instance of AbortSignal" before it ever reaches a handler.
 * Browsers have no such split. Keep the abort semantics the app relies on by handling the
 * signal here instead of forwarding it: the request is raced against its own abort event.
 */
function translateAbortSignals() {
  const patched = globalThis.fetch;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const signal = init?.signal;
    if (!signal) return patched(input, init);

    const abortReason = () => (signal.reason instanceof Error ? signal.reason : new Error('Aborted'));
    if (signal.aborted) return Promise.reject(abortReason());

    const withoutSignal: RequestInit = { ...init };
    delete withoutSignal.signal;
    return Promise.race([
      patched(input, withoutSignal),
      new Promise<Response>((_, reject) => {
        signal.addEventListener('abort', () => reject(abortReason()), { once: true });
      }),
    ]);
  }) as typeof fetch;
}
