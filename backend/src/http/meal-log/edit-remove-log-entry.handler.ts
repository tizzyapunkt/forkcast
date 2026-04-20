import type { Context } from 'hono';
import { editLogEntry } from '../../domain/meal-log/edit-log-entry.use-case.js';
import { removeLogEntry } from '../../domain/meal-log/remove-log-entry.use-case.js';
import type { LogEntryRepository } from '../../domain/meal-log/log-entry.repository.js';

export function makeEditLogEntryHandler(repo: LogEntryRepository) {
  return async (c: Context) => {
    const entryId = c.req.param('id') ?? '';
    const body = await c.req.json();
    try {
      const updated = await editLogEntry(repo, { entryId, ...body });
      return c.json(updated);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      const status = message.includes('not found') ? 404 : 400;
      return c.json({ error: message }, status);
    }
  };
}

export function makeRemoveLogEntryHandler(repo: LogEntryRepository) {
  return async (c: Context) => {
    const entryId = c.req.param('id') ?? '';
    try {
      await removeLogEntry(repo, entryId);
      return c.body(null, 204);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return c.json({ error: message }, 404);
    }
  };
}
