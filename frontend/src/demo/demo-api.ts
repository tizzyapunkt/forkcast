interface FetchHandler {
  fetch(request: Request): Response | Promise<Response>;
}

const API_PREFIX = '/api/';

async function serve(app: FetchHandler, url: URL, original: Request): Promise<Response> {
  const routed = new URL(url.pathname.slice(API_PREFIX.length - 1) + url.search, 'http://demo.local');
  const hasBody = original.method !== 'GET' && original.method !== 'HEAD';
  return app.fetch(
    new Request(routed, {
      method: original.method,
      headers: original.headers,
      body: hasBody ? await original.arrayBuffer() : undefined,
    }),
  );
}

/**
 * Serves the app's `/api/*` requests from `app` instead of the network, stripping `/api` as the dev
 * proxy and nginx do. Everything else, Open Food Facts included, still goes to the real `fetch`.
 * Returns a function that puts the original `fetch` back.
 */
export function installDemoApi(app: FetchHandler): () => void {
  const network = globalThis.fetch;

  globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input), location.href);
    if (url.origin !== location.origin || !url.pathname.startsWith(API_PREFIX)) return network(input, init);

    return serve(app, url, new Request(url, input instanceof Request ? input : init));
  };

  return () => {
    globalThis.fetch = network;
  };
}
