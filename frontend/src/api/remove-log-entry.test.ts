import { http, HttpResponse } from 'msw';
import { server } from '../test/msw/server';
import { removeLogEntry } from './remove-log-entry';

describe('removeLogEntry', () => {
  it('deletes an entry and returns void', async () => {
    server.use(http.delete('/api/log-entry/:id', () => new HttpResponse(null, { status: 204 })));
    await expect(removeLogEntry('abc')).resolves.toBeUndefined();
  });

  it('throws ApiError on 404', async () => {
    server.use(http.delete('/api/log-entry/:id', () => HttpResponse.json({ error: 'not found' }, { status: 404 })));
    await expect(removeLogEntry('missing')).rejects.toMatchObject({ status: 404 });
  });
});
