import { installDemoApi } from './demo-api';

describe('installDemoApi', () => {
  const realFetch = globalThis.fetch;
  let network: ReturnType<typeof vi.fn<typeof fetch>>;
  let app: { fetch: ReturnType<typeof vi.fn<(request: Request) => Promise<Response>>> };
  let uninstall: () => void;

  beforeEach(() => {
    network = vi.fn<typeof fetch>(async () => new Response('network'));
    globalThis.fetch = network;
    app = { fetch: vi.fn<(request: Request) => Promise<Response>>(async () => new Response('app')) };
    uninstall = installDemoApi(app);
  });

  afterEach(() => {
    uninstall();
    globalThis.fetch = realFetch;
  });

  it('serves /api requests from the app, without the /api prefix', async () => {
    const res = await fetch('/api/recipes?limit=2');

    expect(await res.text()).toBe('app');
    const request = app.fetch.mock.calls[0]![0];
    expect(request.method).toBe('GET');
    expect(new URL(request.url).pathname).toBe('/recipes');
    expect(new URL(request.url).search).toBe('?limit=2');
    expect(network).not.toHaveBeenCalled();
  });

  it('keeps the method, headers and JSON body', async () => {
    await fetch('/api/log-ingredient', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: '2026-10-13' }),
    });

    const request = app.fetch.mock.calls[0]![0];
    expect(request.method).toBe('POST');
    expect(request.headers.get('content-type')).toBe('application/json');
    expect(await request.json()).toEqual({ date: '2026-10-13' });
  });

  it('accepts a Request as input', async () => {
    await fetch(new Request(new URL('/api/recipe/r1', location.href), { method: 'DELETE' }));

    const request = app.fetch.mock.calls[0]![0];
    expect(request.method).toBe('DELETE');
    expect(new URL(request.url).pathname).toBe('/recipe/r1');
  });

  it('passes other same-origin paths and other origins to the network', async () => {
    await fetch('/favicon.svg');
    await fetch('https://world.openfoodfacts.org/api/v2/product/123.json');

    expect(app.fetch).not.toHaveBeenCalled();
    expect(network).toHaveBeenCalledTimes(2);
  });

  it('restores the original fetch when uninstalled', () => {
    uninstall();
    expect(globalThis.fetch).toBe(network);
  });
});
