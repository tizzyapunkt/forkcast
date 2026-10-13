/**
 * The `fetch` the demo hands to the Open Food Facts adapter. The SDK sends `credentials: 'include'`
 * and a `User-Agent` header; from a browser, the first is refused by OFF's `Access-Control-Allow-Origin: *`
 * and the second forces a preflight. Without both, OFF requests are CORS "simple requests".
 */
export const demoOffFetch: typeof fetch = (input, init) => {
  const request = input instanceof Request ? input : undefined;
  const url = request ? request.url : String(input);
  return globalThis.fetch(url, {
    method: init?.method ?? request?.method ?? 'GET',
    signal: init?.signal ?? request?.signal,
    credentials: 'omit',
  });
};
