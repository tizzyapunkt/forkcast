import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '../ui/button';
import { de } from '../../i18n/de';

const t = de.errors;

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * The app's last line of defence. A throw during render unmounts the whole React
 * tree, which reads as a blank white screen with nothing to report — this catches
 * it, names the failure, and offers a way back. Placed at the root so no screen
 * can take the app down; the message is shown verbatim because the only person
 * reading it is the one who has to file the bug.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Goes through console.error so the client diagnostics log picks it up with
    // the component stack, and the Diagnose screen can hand it over.
    console.error('Unhandled render error:', error.message, info.componentStack);
  }

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
        <div role="alert" className="w-full max-w-md rounded-md border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-sm font-semibold text-destructive">{t.generic}</p>
          <p className="mt-2 break-words font-mono text-xs text-destructive">{error.message}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => this.setState({ error: null })}>{t.boundaryRetry}</Button>
          <Button variant="outline" onClick={() => window.location.reload()}>
            {t.boundaryReload}
          </Button>
        </div>
        <p className="max-w-md text-center text-xs text-muted-foreground">{t.boundaryHint}</p>
      </div>
    );
  }
}
