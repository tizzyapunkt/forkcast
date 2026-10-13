import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider, QueryCache } from '@tanstack/react-query';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app';
import { AuthGuard } from './features/auth/auth-guard';
import { ErrorBoundary } from './components/app/error-boundary';
import { ApiError } from './api/client';
import { SESSION_KEY } from './features/auth/use-auth';
import { installClientDiagnostics } from './lib/client-log';
import { applyDocumentLanguage, locale } from './i18n/locale';
import './index.css';

applyDocumentLanguage();
installClientDiagnostics();

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      if (error instanceof ApiError && error.status === 401) {
        queryClient.setQueryData(SESSION_KEY, false);
      }
    },
  }),
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

/** The demo starts its in-page backend first and has no login; the real app registers its service worker. */
async function shell(app: ReactNode): Promise<ReactNode> {
  // Spelled out rather than `isDemo`, so the bundler drops the demo chunk from the real build.
  if (import.meta.env.MODE !== 'demo') {
    registerSW({ immediate: true });
    return <AuthGuard>{app}</AuthGuard>;
  }
  const { startDemo, DemoShell } = await import('./demo/demo-entry');
  const { seededLocale } = await startDemo({ locale });
  return <DemoShell seededLocale={seededLocale}>{app}</DemoShell>;
}

void shell(<App />).then((content) =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <ErrorBoundary>{content}</ErrorBoundary>
      </QueryClientProvider>
    </StrictMode>,
  ),
);
