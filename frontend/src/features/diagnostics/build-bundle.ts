import type { ClientLogEntry } from '../../lib/client-log';
import type { ServerLogEntry } from '../../api/debug-logs';
import { t } from '../../i18n';
import { formatClockTime } from '../../i18n/format';

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

function renderEntries(entries: Array<ClientLogEntry | ServerLogEntry>): string[] {
  if (entries.length === 0) return [t.diagnostics.empty];
  return entries.flatMap((e) => {
    const line = `${formatClockTime(e.at)} [${e.kind}] ${e.message}`;
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
    `## ${t.diagnostics.clientSection} (${t.diagnostics.entryCount(client.length)})`,
    ...renderEntries(client),
    '',
    `## ${t.diagnostics.serverSection}${server ? ` (${t.diagnostics.entryCount(server.length)})` : ''}`,
    ...(server ? renderEntries(server) : [t.diagnostics.serverError]),
    '',
  ];
  return lines.join('\n');
}
