import { http, HttpResponse } from 'msw';
import { server } from '../test/msw/server';
import { ApiError } from './client';
import { importRecipeFromPhotos, ImportNotConfiguredError } from './import-recipe-from-photos';

describe('importRecipeFromPhotos', () => {
  it('POSTs the images array and returns the parsed draft', async () => {
    server.use(
      http.post('/api/import-recipe-from-photos', async ({ request }) => {
        const body = (await request.json()) as { images: Array<{ mediaType: string }> };
        expect(body.images).toHaveLength(2);
        expect(body.images.map((i) => i.mediaType)).toEqual(['image/jpeg', 'image/png']);
        return HttpResponse.json({
          name: 'Pasta',
          yield: 2,
          ingredients: [],
          steps: [],
        });
      }),
    );

    const draft = await importRecipeFromPhotos([
      { data: 'aGVsbG8=', mediaType: 'image/jpeg' },
      { data: 'd29ybGQ=', mediaType: 'image/png' },
    ]);
    expect(draft.name).toBe('Pasta');
    expect(draft.yield).toBe(2);
  });

  it('maps 503 ai-import-not-configured to ImportNotConfiguredError', async () => {
    server.use(
      http.post('/api/import-recipe-from-photos', () =>
        HttpResponse.json({ error: 'ai-import-not-configured' }, { status: 503 }),
      ),
    );

    await expect(importRecipeFromPhotos([{ data: 'x', mediaType: 'image/jpeg' }])).rejects.toBeInstanceOf(
      ImportNotConfiguredError,
    );
  });

  it('surfaces 413 with the offending imageIndex via ApiError', async () => {
    server.use(
      http.post('/api/import-recipe-from-photos', () =>
        HttpResponse.json({ error: 'image too large', imageIndex: 1 }, { status: 413 }),
      ),
    );

    await expect(importRecipeFromPhotos([{ data: 'x', mediaType: 'image/jpeg' }])).rejects.toMatchObject({
      status: 413,
      message: 'image too large',
    });
  });

  it('surfaces 502 from the AI provider as a generic ApiError', async () => {
    server.use(
      http.post('/api/import-recipe-from-photos', () =>
        HttpResponse.json({ error: 'ai-extraction-failed' }, { status: 502 }),
      ),
    );

    const error = await importRecipeFromPhotos([{ data: 'x', mediaType: 'image/jpeg' }]).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(502);
  });
});
