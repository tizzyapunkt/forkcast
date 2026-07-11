import { describe, it, expect } from 'vitest';
import { buildDiagnosticsBundle } from './build-bundle';

const CONTEXT = {
  url: 'https://forkcast.example/settings',
  userAgent: 'Mozilla/5.0 (iPhone)',
  at: '2026-07-11T18:30:00.000Z',
};

describe('buildDiagnosticsBundle', () => {
  it('renders app context, client section and server section', () => {
    const bundle = buildDiagnosticsBundle({
      context: CONTEXT,
      client: [{ at: '2026-07-11T18:29:00.000Z', kind: 'api', message: 'GET /api/search-ingredients — 502 kaputt' }],
      server: [{ at: '2026-07-11T18:28:59.000Z', kind: 'off', message: 'search failed 403 Forbidden (120ms)' }],
    });

    expect(bundle).toContain('# forkcast Diagnose');
    expect(bundle).toContain('URL: https://forkcast.example/settings');
    expect(bundle).toContain('User-Agent: Mozilla/5.0 (iPhone)');
    expect(bundle).toContain('## App-Log (1 Eintrag)');
    expect(bundle).toContain('[api] GET /api/search-ingredients — 502 kaputt');
    expect(bundle).toContain('## Server-Log (1 Eintrag)');
    expect(bundle).toContain('[off] search failed 403 Forbidden (120ms)');
  });

  it('indents entry details under their entry line', () => {
    const bundle = buildDiagnosticsBundle({
      context: CONTEXT,
      client: [],
      server: [
        { at: '2026-07-11T18:28:59.000Z', kind: 'off', message: 'search failed', detail: 'Host not in allowlist' },
      ],
    });

    expect(bundle).toContain('    Host not in allowlist');
  });

  it('marks the server section as unavailable when entries could not be fetched', () => {
    const bundle = buildDiagnosticsBundle({ context: CONTEXT, client: [], server: undefined });

    expect(bundle).toContain('Server-Log konnte nicht geladen werden');
  });

  it('shows empty sections explicitly', () => {
    const bundle = buildDiagnosticsBundle({ context: CONTEXT, client: [], server: [] });

    expect(bundle).toContain('## App-Log (0 Einträge)');
    expect(bundle).toContain('Keine Einträge');
  });
});
