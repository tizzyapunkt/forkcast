import type { ClientLogEntry } from '../../lib/client-log';
import type { ServerLogEntry } from '../../api/debug-logs';
import { de } from '../../i18n/de';

interface BundleContext {
  url: string;
  userAgent: string;
  at: string;
}

interface BundleInput {
  context: BundleContext;
  client: ClientLogEntry[];
  server: ServerLogEntry[] | undefined;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleTimeString('de-DE', { hour12: false });
}

function renderEntries(entries: Array<ClientLogEntry | ServerLogEntry>): string[] {
  if (entries.length === 0) return [de.diagnostics.empty];
  return entries.flatMap((e) => {
    const line = `${formatTime(e.at)} [${e.kind}] ${e.message}`;
    return e.detail ? [line, `    ${e.detail.split('\n').join('\n    ')}`] : [line];
  });
}

export function buildDiagnosticsBundle({ context, client, server }: BundleInput): string {
  const lines = [
    '# forkcast Diagnose',
    `Zeit: ${context.at}`,
    `URL: ${context.url}`,
    `User-Agent: ${context.userAgent}`,
    '',
    `## ${de.diagnostics.clientSection} (${de.diagnostics.entryCount(client.length)})`,
    ...renderEntries(client),
    '',
    `## ${de.diagnostics.serverSection}${server ? ` (${de.diagnostics.entryCount(server.length)})` : ''}`,
    ...(server ? renderEntries(server) : [de.diagnostics.serverError]),
    '',
  ];
  return lines.join('\n');
}
