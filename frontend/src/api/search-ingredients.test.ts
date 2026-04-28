import { http, HttpResponse } from 'msw';
import { server } from '../test/msw/server';
import { searchIngredients, searchBarcode } from './search-ingredients';

describe('searchIngredients', () => {
  it('returns results array', async () => {
    server.use(
      http.get('/api/search-ingredients', () =>
        HttpResponse.json([
          {
            offId: '123',
            name: 'Oats',
            unit: 'g',
            macrosPerUnit: { calories: 3.89, protein: 0.17, carbs: 0.66, fat: 0.07 },
          },
        ]),
      ),
    );
    const results = await searchIngredients('oat');
    expect(results).toHaveLength(1);
    expect(results[0]?.name).toBe('Oats');
  });

  it('throws ApiError on 400', async () => {
    server.use(
      http.get('/api/search-ingredients', () =>
        HttpResponse.json({ error: 'Missing query parameter: q' }, { status: 400 }),
      ),
    );
    await expect(searchIngredients('')).rejects.toMatchObject({ status: 400 });
  });
});

describe('searchBarcode', () => {
  it('returns null on 404', async () => {
    server.use(
      http.get('/api/search-ingredients/barcode/:barcode', () =>
        HttpResponse.json({ error: 'not found' }, { status: 404 }),
      ),
    );
    const result = await searchBarcode('0000000');
    expect(result).toBeNull();
  });

  it('returns result when found', async () => {
    server.use(
      http.get('/api/search-ingredients/barcode/:barcode', () =>
        HttpResponse.json({
          offId: '456',
          name: 'Banana',
          unit: 'g',
          macrosPerUnit: { calories: 0.89, protein: 0.01, carbs: 0.23, fat: 0.003 },
        }),
      ),
    );
    const result = await searchBarcode('4011');
    expect(result?.name).toBe('Banana');
  });
});
