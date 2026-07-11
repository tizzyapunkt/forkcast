import type { Context, Next } from 'hono';
import type { DiagnosticsRecorder } from '../../domain/diagnostics/diagnostics-log.ts';

export function makeRequestLogMiddleware(recorder: DiagnosticsRecorder) {
  return async (c: Context, next: Next) => {
    if (c.req.path === '/debug/logs') return next();

    const startedAt = Date.now();
    await next();
    // Hono converts handler errors to a response via onError before the chain
    // unwinds; the thrown error is only observable here through c.error.
    if (c.error) {
      recorder.record({ kind: 'error', message: c.error.message, detail: c.error.stack });
    }
    recorder.record({
      kind: 'http',
      message: `${c.req.method} ${c.req.path} → ${c.res.status} (${Date.now() - startedAt}ms)`,
    });
  };
}
