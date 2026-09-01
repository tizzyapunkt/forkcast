import { http, HttpResponse } from 'msw';
import { server } from './server';

export interface StoredFavorite {
  name: string;
  unit: string;
  macrosPerUnit: { calories: number; protein: number; carbs: number; fat: number };
  untracked?: boolean;
  favoritedAt: string;
  lastAmount?: number;
  lastUsedAt?: string;
}

const identity = (name: string, unit: string) => `${name.toLowerCase()}|${unit}`;

/**
 * A favorites endpoint that actually remembers what was written, so the settle
 * refetch after a toggle sees the result of the write. A stub returning a fixed
 * list would revert every optimistic update and hide the behaviour under test.
 *
 * Returns the request bodies the component sent, in order.
 */
export function serveFavorites(initial: StoredFavorite[] = []) {
  const list = [...initial];
  const posted: unknown[] = [];

  server.use(
    http.get('/api/favorite-ingredients', () => HttpResponse.json(list)),

    http.post('/api/favorite-ingredient', async ({ request }) => {
      const body = (await request.json()) as Omit<StoredFavorite, 'favoritedAt'>;
      posted.push(body);
      const stored: StoredFavorite = { ...body, favoritedAt: '2026-01-01T08:00:00.000Z' };
      const index = list.findIndex((f) => identity(f.name, f.unit) === identity(body.name, body.unit));
      if (index === -1) list.push(stored);
      else list[index] = { ...stored, favoritedAt: list[index]!.favoritedAt };
      return HttpResponse.json(stored);
    }),

    http.post('/api/unfavorite-ingredient', async ({ request }) => {
      const body = (await request.json()) as { name: string; unit: string };
      posted.push(body);
      const index = list.findIndex((f) => identity(f.name, f.unit) === identity(body.name, body.unit));
      if (index !== -1) list.splice(index, 1);
      return HttpResponse.json({ ok: true });
    }),
  );

  return { posted, list };
}
