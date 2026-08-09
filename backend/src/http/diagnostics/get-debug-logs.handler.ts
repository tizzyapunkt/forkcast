import type { Context } from 'hono';
import type { DiagnosticsLog } from '../../domain/diagnostics/diagnostics-log.ts';

export function makeGetDebugLogsHandler(log: DiagnosticsLog) {
  return (c: Context) => c.json({ entries: log.recent() });
}
