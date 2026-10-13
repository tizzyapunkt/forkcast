import { demoOffFetch } from './demo-off-fetch';

describe('demoOffFetch', () => {
  const realFetch = globalThis.fetch;
  let network: ReturnType<typeof vi.fn<typeof fetch>>;

  beforeEach(() => {
    network = vi.fn<typeof fetch>(async () => new Response('{}'));
    globalThis.fetch = network;
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('re-sends the SDK request without credentials or headers', async () => {
    const sdkRequest = new Request('https://search.openfoodfacts.org/search?q=skyr', {
      credentials: 'include',
      headers: { 'User-Agent': 'OFF-SDK' },
    });
    const signal = AbortSignal.timeout(8_000);

    await demoOffFetch(sdkRequest, { signal });

    const [url, init] = network.mock.calls[0]!;
    expect(url).toBe('https://search.openfoodfacts.org/search?q=skyr');
    expect(init).toEqual({ method: 'GET', signal, credentials: 'omit' });
  });

  it('accepts a plain URL', async () => {
    await demoOffFetch('https://world.openfoodfacts.org/api/v2/product/123.json');

    const [url, init] = network.mock.calls[0]!;
    expect(url).toBe('https://world.openfoodfacts.org/api/v2/product/123.json');
    expect(init).toMatchObject({ method: 'GET', credentials: 'omit' });
    expect(init).not.toHaveProperty('headers');
  });
});
