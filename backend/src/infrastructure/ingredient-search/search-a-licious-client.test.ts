import { describe, expect, it } from 'vitest';
import { SearchALiciousClient, SearchALiciousHttpError } from './search-a-licious-client.ts';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function makeFetchStub(respond: (url: URL) => Response | Promise<Response>) {
  const requests: { url: URL; init: RequestInit | undefined }[] = [];
  const fetchStub: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    requests.push({ url: new URL(request.url), init });
    return respond(new URL(request.url));
  };
  return { fetchStub, requests };
}

const EMPTY_RESULT = {
  hits: [],
  page: 1,
  page_size: 20,
  page_count: 0,
  count: 0,
  is_count_exact: true,
  took: 1,
  timed_out: false,
};

describe('SearchALiciousClient.search', () => {
  it('issues a GET /search against search.openfoodfacts.org with the given parameters', async () => {
    const { fetchStub, requests } = makeFetchStub(() => jsonResponse(EMPTY_RESULT));
    const client = new SearchALiciousClient(fetchStub);

    await client.search({
      q: 'apfel lang:de countries_tags:"en:germany"',
      langs: 'de',
      page_size: 20,
      fields: 'code,product_name',
    });

    expect(requests).toHaveLength(1);
    const { url } = requests[0];
    expect(url.origin).toBe('https://search.openfoodfacts.org');
    expect(url.pathname).toBe('/search');
    expect(url.searchParams.get('q')).toBe('apfel lang:de countries_tags:"en:germany"');
    expect(url.searchParams.get('langs')).toBe('de');
    expect(url.searchParams.get('page_size')).toBe('20');
    expect(url.searchParams.get('fields')).toBe('code,product_name');
  });

  it('omits parameters that are not provided', async () => {
    const { fetchStub, requests } = makeFetchStub(() => jsonResponse(EMPTY_RESULT));
    const client = new SearchALiciousClient(fetchStub);

    await client.search({ q: 'apfel' });

    const { url } = requests[0];
    expect([...url.searchParams.keys()]).toEqual(['q']);
  });

  it('supports pagination via the page parameter', async () => {
    const { fetchStub, requests } = makeFetchStub(() => jsonResponse(EMPTY_RESULT));
    const client = new SearchALiciousClient(fetchStub);

    await client.search({ q: 'apfel', page: 3 });

    expect(requests[0].url.searchParams.get('page')).toBe('3');
  });

  it('identifies the app via User-Agent and requests JSON', async () => {
    const { fetchStub, requests } = makeFetchStub(() => jsonResponse(EMPTY_RESULT));
    const client = new SearchALiciousClient(fetchStub);

    await client.search({ q: 'apfel' });

    const headers = new Headers(requests[0].init?.headers);
    expect(headers.get('user-agent')).toMatch(/forkcast/);
    expect(headers.get('accept')).toBe('application/json');
  });

  it('attaches a timeout signal so hanging requests abort', async () => {
    const { fetchStub, requests } = makeFetchStub(() => jsonResponse(EMPTY_RESULT));
    const client = new SearchALiciousClient(fetchStub);

    await client.search({ q: 'apfel' });

    expect(requests[0].init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('returns the parsed response body on success', async () => {
    const body = { ...EMPTY_RESULT, hits: [{ code: '123', product_name: 'Apfelmus' }], count: 1 };
    const { fetchStub } = makeFetchStub(() => jsonResponse(body));
    const client = new SearchALiciousClient(fetchStub);

    await expect(client.search({ q: 'apfel' })).resolves.toEqual(body);
  });

  it('passes an error body answered with HTTP 200 through to the caller', async () => {
    const errorBody = { errors: [{ title: 'Invalid query' }], debug: {} };
    const { fetchStub } = makeFetchStub(() => jsonResponse(errorBody));
    const client = new SearchALiciousClient(fetchStub);

    await expect(client.search({ q: 'apfel' })).resolves.toEqual(errorBody);
  });

  it('throws SearchALiciousHttpError with status and body snippet on a non-ok response', async () => {
    const { fetchStub } = makeFetchStub(
      () => new Response('Host not in allowlist', { status: 403, statusText: 'Forbidden' }),
    );
    const client = new SearchALiciousClient(fetchStub);

    const failure = await client.search({ q: 'apfel' }).then(
      () => null,
      (err: unknown) => err,
    );

    expect(failure).toBeInstanceOf(SearchALiciousHttpError);
    const httpError = failure as SearchALiciousHttpError;
    expect(httpError.status).toBe(403);
    expect(httpError.statusText).toBe('Forbidden');
    expect(httpError.bodySnippet).toBe('Host not in allowlist');
    expect(httpError.message).toBe('Search-a-licious request failed: 403 Forbidden — Host not in allowlist');
  });

  it('truncates long error bodies in the snippet', async () => {
    const { fetchStub } = makeFetchStub(() => new Response('x'.repeat(500), { status: 500 }));
    const client = new SearchALiciousClient(fetchStub);

    const failure = (await client.search({ q: 'apfel' }).then(
      () => null,
      (err: unknown) => err,
    )) as SearchALiciousHttpError;

    expect(failure.bodySnippet).toHaveLength(300);
  });

  it('omits the snippet when the error body is empty', async () => {
    const { fetchStub } = makeFetchStub(() => new Response('', { status: 502, statusText: 'Bad Gateway' }));
    const client = new SearchALiciousClient(fetchStub);

    const failure = (await client.search({ q: 'apfel' }).then(
      () => null,
      (err: unknown) => err,
    )) as SearchALiciousHttpError;

    expect(failure.bodySnippet).toBeUndefined();
    expect(failure.message).toBe('Search-a-licious request failed: 502 Bad Gateway');
  });

  it('propagates timeout errors from fetch untouched', async () => {
    const fetchStub: typeof fetch = () => Promise.reject(new DOMException('The operation timed out.', 'TimeoutError'));
    const client = new SearchALiciousClient(fetchStub);

    await expect(client.search({ q: 'apfel' })).rejects.toThrow('The operation timed out.');
  });

  it('propagates network errors from fetch untouched', async () => {
    const fetchStub: typeof fetch = () => Promise.reject(new TypeError('fetch failed'));
    const client = new SearchALiciousClient(fetchStub);

    await expect(client.search({ q: 'apfel' })).rejects.toThrow('fetch failed');
  });
});
