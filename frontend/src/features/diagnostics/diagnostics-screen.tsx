import { useState } from 'react';
import { RefreshCw, ClipboardCopy } from 'lucide-react';
import { AppHeader } from '../../components/app/app-header';
import { ErrorBanner } from '../../components/app/error-banner';
import { useDebugLogs } from '../../queries/use-debug-logs';
import { clientLogEntries } from '../../lib/client-log';
import type { ClientLogEntry } from '../../lib/client-log';
import type { ServerLogEntry } from '../../api/debug-logs';
import { buildDiagnosticsBundle } from './build-bundle';
import { t } from '../../i18n';
import { formatClockTime } from '../../i18n/format';
import { Button } from '../../components/ui/button';

interface DiagnosticsScreenProps {
  onBack: () => void;
}

function EntryList({ entries }: { entries: Array<ClientLogEntry | ServerLogEntry> }) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">{t.diagnostics.empty}</p>;
  }
  return (
    <ul className="space-y-1 font-mono text-xs">
      {entries.map((entry, i) => (
        <li key={`${entry.at}-${i}`} className="break-words">
          <span className="text-muted-foreground">{formatClockTime(entry.at)}</span>{' '}
          <span className={entry.kind === 'error' ? 'text-destructive' : ''}>
            [{entry.kind}] {entry.message}
          </span>
          {entry.detail && <div className="whitespace-pre-wrap pl-4 text-muted-foreground">{entry.detail}</div>}
        </li>
      ))}
    </ul>
  );
}

export function DiagnosticsScreen({ onBack }: DiagnosticsScreenProps) {
  const serverQuery = useDebugLogs();
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const clientEntries = clientLogEntries();

  const copy = async () => {
    const bundle = buildDiagnosticsBundle({
      context: { url: window.location.href, userAgent: navigator.userAgent, at: new Date().toISOString() },
      client: clientLogEntries(),
      server: serverQuery.data,
    });
    try {
      await navigator.clipboard.writeText(bundle);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  };

  return (
    <>
      <AppHeader title={t.diagnostics.screenTitle} onBack={onBack} backAria={t.recipes.back} />
      <div className="space-y-4 p-4">
        <Button onClick={() => void copy()} className="w-full">
          <ClipboardCopy className="h-4 w-4" aria-hidden="true" />
          {copyState === 'copied'
            ? t.diagnostics.copied
            : copyState === 'failed'
              ? t.diagnostics.copyError
              : t.diagnostics.copy}
        </Button>

        <section className="space-y-2">
          <h2 className="text-base font-semibold">
            {t.diagnostics.clientSection}{' '}
            <span className="text-xs font-normal text-muted-foreground">
              {t.diagnostics.entryCount(clientEntries.length)}
            </span>
          </h2>
          <EntryList entries={clientEntries} />
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">
              {t.diagnostics.serverSection}{' '}
              {serverQuery.data && (
                <span className="text-xs font-normal text-muted-foreground">
                  {t.diagnostics.entryCount(serverQuery.data.length)}
                </span>
              )}
            </h2>
            <button
              type="button"
              onClick={() => void serverQuery.refetch()}
              className="flex items-center gap-1 rounded-md border border-input px-2 py-1 text-xs hover:bg-accent"
            >
              <RefreshCw className="h-3 w-3" aria-hidden="true" />
              {t.diagnostics.refresh}
            </button>
          </div>
          {serverQuery.isError && <ErrorBanner error={new Error(t.diagnostics.serverError)} />}
          {serverQuery.data && <EntryList entries={serverQuery.data} />}
        </section>
      </div>
    </>
  );
}
