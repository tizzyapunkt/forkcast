import { http, HttpResponse } from 'msw';
import { server } from '../test/msw/server';
import { editLogEntry } from './edit-log-entry';

describe('editLogEntry', () => {
  it('patches a quick entry and returns updated LogEntry', async () => {
    server.use(
      http.patch('/api/log-entry/:id', async ({ request }) => {
        const body = await request.json();
        return HttpResponse.json({ id: 'abc', date: '2026-04-20', slot: 'breakfast', ingredient: body, loggedAt: '' });
      }),
    );
    const result = await editLogEntry('abc', { type: 'quick', calories: 400 });
    expect(result.id).toBe('abc');
  });

  it('throws ApiError on 404', async () => {
    server.use(http.patch('/api/log-entry/:id', () => HttpResponse.json({ error: 'not found' }, { status: 404 })));
    await expect(editLogEntry('missing', { type: 'quick', calories: 1 })).rejects.toMatchObject({ status: 404 });
  });
});
