import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  clearClientLog,
  clientLogEntries,
  installClientDiagnostics,
  recordApiFailure,
  uninstallClientDiagnostics,
} from './client-log';

describe('client-log', () => {
  afterEach(() => {
    uninstallClientDiagnostics();
    clearClientLog();
    vi.restoreAllMocks();
  });

  it('captures console.error and still invokes the original', () => {
    const original = vi.spyOn(console, 'error').mockImplementation(() => {});
    installClientDiagnostics();

    console.error('boom', 42);

    expect(original).toHaveBeenCalledWith('boom', 42);
    const entries = clientLogEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].kind).toBe('console');
    expect(entries[0].message).toBe('boom 42');
  });

  it('captures console.warn', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    installClientDiagnostics();

    console.warn('achtung');

    expect(clientLogEntries()[0].message).toBe('achtung');
  });

  it('stringifies Error arguments with their message', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    installClientDiagnostics();

    console.error(new Error('kaputt'));

    expect(clientLogEntries()[0].message).toContain('kaputt');
  });

  it('captures window error events', () => {
    installClientDiagnostics();

    window.dispatchEvent(new ErrorEvent('error', { message: 'script exploded' }));

    const entries = clientLogEntries();
    expect(entries.some((e) => e.kind === 'error' && e.message.includes('script exploded'))).toBe(true);
  });

  it('captures unhandled promise rejections', () => {
    installClientDiagnostics();

    // jsdom has no PromiseRejectionEvent constructor — synthesize the event shape.
    const event = new Event('unhandledrejection') as Event & { reason?: unknown };
    event.reason = new Error('nobody caught me');
    window.dispatchEvent(event);

    const entries = clientLogEntries();
    expect(entries.some((e) => e.kind === 'error' && e.message.includes('nobody caught me'))).toBe(true);
  });

  it('records failed API calls with path and reason', () => {
    recordApiFailure('GET', '/api/search-ingredients', '502 Bad Gateway');

    const [entry] = clientLogEntries();
    expect(entry.kind).toBe('api');
    expect(entry.message).toBe('GET /api/search-ingredients — 502 Bad Gateway');
  });

  it('evicts the oldest entries beyond capacity', () => {
    for (let i = 0; i < 250; i++) recordApiFailure('GET', '/api/x', `fail ${i}`);

    const entries = clientLogEntries();
    expect(entries).toHaveLength(200);
    expect(entries[0].message).toContain('fail 50');
    expect(entries[199].message).toContain('fail 249');
  });

  it('installing twice does not double-record', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    installClientDiagnostics();
    installClientDiagnostics();

    console.error('once');

    expect(clientLogEntries()).toHaveLength(1);
  });
});
