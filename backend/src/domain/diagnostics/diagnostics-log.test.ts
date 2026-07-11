import { describe, it, expect } from 'vitest';
import { DiagnosticsLog } from './diagnostics-log.ts';

describe('DiagnosticsLog', () => {
  it('returns recorded entries oldest-first', () => {
    const log = new DiagnosticsLog(10);
    log.record({ kind: 'http', message: 'GET /a → 200 (3ms)' });
    log.record({ kind: 'off', message: 'search ok 200 (120ms)' });

    const entries = log.recent();
    expect(entries.map((e) => e.message)).toEqual(['GET /a → 200 (3ms)', 'search ok 200 (120ms)']);
    expect(entries[0].kind).toBe('http');
  });

  it('stamps each entry with an ISO timestamp', () => {
    const log = new DiagnosticsLog(10);
    log.record({ kind: 'error', message: 'boom' });

    const [entry] = log.recent();
    expect(new Date(entry.at).getTime()).not.toBeNaN();
  });

  it('keeps the optional detail', () => {
    const log = new DiagnosticsLog(10);
    log.record({ kind: 'error', message: 'boom', detail: 'stack trace here' });

    expect(log.recent()[0].detail).toBe('stack trace here');
  });

  it('evicts the oldest entries once capacity is reached', () => {
    const log = new DiagnosticsLog(3);
    for (const n of [1, 2, 3, 4, 5]) log.record({ kind: 'http', message: `req ${n}` });

    expect(log.recent().map((e) => e.message)).toEqual(['req 3', 'req 4', 'req 5']);
  });

  it('returns a copy, not the internal buffer', () => {
    const log = new DiagnosticsLog(3);
    log.record({ kind: 'http', message: 'req' });

    const entries = log.recent();
    entries.pop();
    expect(log.recent()).toHaveLength(1);
  });
});
