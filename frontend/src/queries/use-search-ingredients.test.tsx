import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../test/msw/server';
import { renderWithProviders } from '../test/harness';
import { useSearchIngredients } from './use-search-ingredients';
import type { IngredientSearchSource } from '../domain/ingredient-search';

function Consumer({ q, sources }: { q: string; sources?: IngredientSearchSource[] }) {
  const { data, isLoading } = useSearchIngredients(q, sources);
  if (isLoading) return <p>loading</p>;
  return (
    <ul>
      {data?.map((r) => (
        <li key={`${r.source}:${r.id}`}>{r.name}</li>
      ))}
    </ul>
  );
}

describe('useSearchIngredients', () => {
  it('fetches results for a query string', async () => {
    server.use(
      http.get('/api/search-ingredients', () =>
        HttpResponse.json([
          {
            id: '1',
            source: 'CATALOG',
            name: 'Oats',
            unit: 'g',
            macrosPerUnit: { calories: 3.89, protein: 0.17, carbs: 0.66, fat: 0.07 },
          },
        ]),
      ),
    );
    renderWithProviders(<Consumer q="oat" />);
    expect(await screen.findByText('Oats')).toBeInTheDocument();
  });

  it('does not fetch when query is shorter than 2 chars', async () => {
    let called = false;
    server.use(
      http.get('/api/search-ingredients', () => {
        called = true;
        return HttpResponse.json([]);
      }),
    );
    renderWithProviders(<Consumer q="o" />);
    await new Promise((r) => setTimeout(r, 50));
    expect(called).toBe(false);
  });

  it('includes sources=off in URL when sources is OFF-only', async () => {
    let capturedUrl = '';
    server.use(
      http.get('/api/search-ingredients', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json([]);
      }),
    );
    renderWithProviders(<Consumer q="oat" sources={['OFF']} />);
    await new Promise((r) => setTimeout(r, 50));
    expect(new URL(capturedUrl).searchParams.get('sources')).toBe('off');
  });

  it('includes sources=catalog,off in the URL when Open Food Facts is requested too', async () => {
    let capturedUrl = '';
    server.use(
      http.get('/api/search-ingredients', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json([]);
      }),
    );
    renderWithProviders(<Consumer q="oat" sources={['CATALOG', 'OFF']} />);
    await new Promise((r) => setTimeout(r, 50));
    expect(new URL(capturedUrl).searchParams.get('sources')).toBe('catalog,off');
  });
});
