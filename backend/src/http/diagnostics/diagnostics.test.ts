import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { DiagnosticsLog } from '../../domain/diagnostics/diagnostics-log.ts';
import { makeRequestLogMiddleware } from './request-log.middleware.ts';
import { makeGetDebugLogsHandler } from './get-debug-logs.handler.ts';

function makeApp(log: DiagnosticsLog) {
  const app = new Hono();
  app.use('*', makeRequestLogMiddleware(log));
  app.get('/ok', (c) => c.json({ ok: true }));
  app.get('/missing-thing', (c) => c.json({ error: 'not found' }, 404));
  app.get('/explodes', () => {
    throw new Error('kaputt');
  });
  app.get('/debug/logs', makeGetDebugLogsHandler(log));
  return app;
}

describe('makeRequestLogMiddleware', () => {
  it('records method, path, status and duration of a handled request', async () => {
    const log = new DiagnosticsLog();
    await makeApp(log).request('/ok');

    const [entry] = log.recent();
    expect(entry.kind).toBe('http');
    expect(entry.message).toMatch(/^GET \/ok → 200 \(\d+ms\)$/);
  });

  it('records non-ok statuses', async () => {
    const log = new DiagnosticsLog();
    await makeApp(log).request('/missing-thing');

    expect(log.recent()[0].message).toContain('→ 404');
  });

  it('records a thrown handler error with its stack while the error response still reaches the client', async () => {
    const log = new DiagnosticsLog();
    const res = await makeApp(log).request('/explodes');

    expect(res.status).toBe(500);
    const errorEntry = log.recent().find((e) => e.kind === 'error');
    expect(errorEntry?.message).toContain('kaputt');
    expect(errorEntry?.detail).toMatch(/\n\s+at /);
  });

  it('does not record requests to /debug/logs', async () => {
    const log = new DiagnosticsLog();
    await makeApp(log).request('/debug/logs');

    expect(log.recent().filter((e) => e.kind === 'http')).toHaveLength(0);
  });
});

describe('makeGetDebugLogsHandler', () => {
  it('returns the buffered entries oldest-first', async () => {
    const log = new DiagnosticsLog();
    const app = makeApp(log);
    await app.request('/ok');
    await app.request('/missing-thing');

    const res = await app.request('/debug/logs');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { entries: { message: string }[] };
    expect(body.entries).toHaveLength(2);
    expect(body.entries[0].message).toContain('/ok');
    expect(body.entries[1].message).toContain('/missing-thing');
  });
});
