import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../test/msw/server';
import { renderWithProviders } from '../test/harness';
import { useSearchIngredients } from './use-search-ingredients';

function Consumer({ q }: { q: string }) {
  const { data, isLoading } = useSearchIngredients(q);
  if (isLoading) return <p>loading</p>;
  return (
    <ul>
      {data?.map((r) => (
        <li key={r.offId}>{r.name}</li>
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
            offId: '1',
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
});
