import { describe, expect, it } from 'vitest';
import { OpenFoodFactsService } from './open-food-facts.service.ts';
import type { DiagnosticsEntry } from '../../domain/diagnostics/diagnostics-log.ts';

function makeRecorderStub() {
  const entries: Omit<DiagnosticsEntry, 'at'>[] = [];
  return { entries, recorder: { record: (e: Omit<DiagnosticsEntry, 'at'>) => entries.push(e) } };
}

const OFF_PRODUCT = {
  code: '4311501659715',
  product_name: 'Apfelmus',
  nutriments: {
    'energy-kcal_100g': 80,
    proteins_100g: 0.3,
    carbohydrates_100g: 19,
    fat_100g: 0.2,
  },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function makeFetchStub(respond: (url: URL) => Response | Promise<Response>) {
  const requests: URL[] = [];
  const fetchStub: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    requests.push(url);
    return respond(url);
  };
  return { fetchStub, requests };
}

describe('OpenFoodFactsService.searchByName', () => {
  it('queries search-a-licious with German language and market filters', async () => {
    const { fetchStub, requests } = makeFetchStub(() => jsonResponse({ hits: [] }));
    const service = new OpenFoodFactsService(fetchStub);

    await service.searchByName('apfel');

    expect(requests).toHaveLength(1);
    const url = requests[0];
    expect(url.origin).toBe('https://search.openfoodfacts.org');
    expect(url.pathname).toBe('/search');
    expect(url.searchParams.get('q')).toBe('apfel lang:de countries_tags:"en:germany"');
    expect(url.searchParams.get('langs')).toBe('de');
    expect(url.searchParams.get('page_size')).toBe('20');
    expect(url.searchParams.get('fields')).toBe(
      'code,product_name,product_name_de,serving_size,serving_quantity,nutriments',
    );
  });

  it('maps hits and drops products that cannot be mapped', async () => {
    const unmappable = { code: '1', product_name: 'Ohne Nährwerte' };
    const { fetchStub } = makeFetchStub(() => jsonResponse({ hits: [OFF_PRODUCT, unmappable] }));
    const service = new OpenFoodFactsService(fetchStub);

    const results = await service.searchByName('apfel');

    expect(results).toEqual([
      {
        id: '4311501659715',
        source: 'OFF',
        name: 'Apfelmus',
        unit: 'g',
        macrosPerUnit: { calories: 0.8, protein: 0.003, carbs: 0.19, fat: 0.002 },
      },
    ]);
  });

  it('returns an empty list when the response carries no hits', async () => {
    const { fetchStub } = makeFetchStub(() => jsonResponse({}));
    const service = new OpenFoodFactsService(fetchStub);

    await expect(service.searchByName('apfel')).resolves.toEqual([]);
  });

  it('throws when the search request fails with a server error', async () => {
    const { fetchStub } = makeFetchStub(() => jsonResponse({ detail: 'boom' }, 500));
    const service = new OpenFoodFactsService(fetchStub);

    await expect(service.searchByName('apfel')).rejects.toThrow('Open Food Facts request failed: 500');
  });

  it('throws a timeout error when the request times out', async () => {
    const fetchStub: typeof fetch = () => Promise.reject(new DOMException('The operation timed out.', 'TimeoutError'));
    const service = new OpenFoodFactsService(fetchStub);

    await expect(service.searchByName('apfel')).rejects.toThrow('Open Food Facts request failed: timed out');
  });

  it('throws a network error when the request cannot be sent', async () => {
    const fetchStub: typeof fetch = () => Promise.reject(new TypeError('fetch failed'));
    const service = new OpenFoodFactsService(fetchStub);

    await expect(service.searchByName('apfel')).rejects.toThrow('Open Food Facts request failed: network error');
  });

  it('includes a snippet of the error response body in the thrown error', async () => {
    const { fetchStub } = makeFetchStub(
      () => new Response('Host not in allowlist: search.openfoodfacts.org', { status: 403, statusText: 'Forbidden' }),
    );
    const service = new OpenFoodFactsService(fetchStub);

    await expect(service.searchByName('apfel')).rejects.toThrow(
      'Open Food Facts request failed: 403 Forbidden — Host not in allowlist: search.openfoodfacts.org',
    );
  });

  it('records a successful search with status and duration', async () => {
    const { fetchStub } = makeFetchStub(() => jsonResponse({ hits: [] }));
    const { entries, recorder } = makeRecorderStub();
    const service = new OpenFoodFactsService(fetchStub, recorder);

    await service.searchByName('apfel');

    expect(entries).toHaveLength(1);
    expect(entries[0].kind).toBe('off');
    expect(entries[0].message).toMatch(/^search ok 200 \(\d+ms\)$/);
  });

  it('records a failed search with the body snippet as detail', async () => {
    const { fetchStub } = makeFetchStub(
      () => new Response('blocked by proxy', { status: 403, statusText: 'Forbidden' }),
    );
    const { entries, recorder } = makeRecorderStub();
    const service = new OpenFoodFactsService(fetchStub, recorder);

    await expect(service.searchByName('apfel')).rejects.toThrow('Open Food Facts request failed');

    expect(entries).toHaveLength(1);
    expect(entries[0].message).toMatch(/^search failed 403 Forbidden \(\d+ms\)$/);
    expect(entries[0].detail).toBe('blocked by proxy');
  });

  it('records a timed-out search with the failure reason', async () => {
    const fetchStub: typeof fetch = () => Promise.reject(new DOMException('The operation timed out.', 'TimeoutError'));
    const { entries, recorder } = makeRecorderStub();
    const service = new OpenFoodFactsService(fetchStub, recorder);

    await expect(service.searchByName('apfel')).rejects.toThrow('Open Food Facts request failed');

    expect(entries).toHaveLength(1);
    expect(entries[0].message).toMatch(/^search failed: timed out \(\d+ms\)$/);
  });
});

describe('OpenFoodFactsService.searchByBarcode', () => {
  it('looks the barcode up via the world v2 product API and maps the product', async () => {
    const { fetchStub, requests } = makeFetchStub(() =>
      jsonResponse({ code: OFF_PRODUCT.code, status: 1, product: OFF_PRODUCT }),
    );
    const service = new OpenFoodFactsService(fetchStub);

    const result = await service.searchByBarcode('4311501659715');

    expect(requests).toHaveLength(1);
    expect(requests[0].origin).toBe('https://world.openfoodfacts.org');
    expect(requests[0].pathname).toBe('/api/v2/product/4311501659715');
    expect(result).toMatchObject({ id: '4311501659715', source: 'OFF', name: 'Apfelmus' });
  });

  it('returns null when the product is unknown (HTTP 404)', async () => {
    const { fetchStub } = makeFetchStub(() =>
      jsonResponse({ code: '0000000000000', status: 0, status_verbose: 'product not found' }, 404),
    );
    const service = new OpenFoodFactsService(fetchStub);

    await expect(service.searchByBarcode('0000000000000')).resolves.toBeNull();
  });

  it('returns null when the response carries status 0 without a product', async () => {
    const { fetchStub } = makeFetchStub(() => jsonResponse({ code: '0000000000000', status: 0 }));
    const service = new OpenFoodFactsService(fetchStub);

    await expect(service.searchByBarcode('0000000000000')).resolves.toBeNull();
  });

  it('throws when the lookup fails with a server error', async () => {
    const { fetchStub } = makeFetchStub(() => jsonResponse({ detail: 'boom' }, 500));
    const service = new OpenFoodFactsService(fetchStub);

    await expect(service.searchByBarcode('4311501659715')).rejects.toThrow('Open Food Facts request failed: 500');
  });

  it('records a successful lookup with status and duration', async () => {
    const { fetchStub } = makeFetchStub(() =>
      jsonResponse({ code: OFF_PRODUCT.code, status: 1, product: OFF_PRODUCT }),
    );
    const { entries, recorder } = makeRecorderStub();
    const service = new OpenFoodFactsService(fetchStub, recorder);

    await service.searchByBarcode('4311501659715');

    expect(entries).toHaveLength(1);
    expect(entries[0].message).toMatch(/^barcode ok 200 \(\d+ms\)$/);
  });

  it('records an unknown barcode (404) without throwing', async () => {
    const { fetchStub } = makeFetchStub(() =>
      jsonResponse({ code: '0000000000000', status: 0, status_verbose: 'product not found' }, 404),
    );
    const { entries, recorder } = makeRecorderStub();
    const service = new OpenFoodFactsService(fetchStub, recorder);

    await expect(service.searchByBarcode('0000000000000')).resolves.toBeNull();

    expect(entries).toHaveLength(1);
    expect(entries[0].message).toMatch(/^barcode not-found 404 \(\d+ms\)$/);
  });
});
