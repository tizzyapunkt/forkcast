import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider, QueryCache } from '@tanstack/react-query';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app';
import { AuthGuard } from './features/auth/auth-guard';
import { ApiError } from './api/client';
import { SESSION_KEY } from './features/auth/use-auth';
import { installClientDiagnostics } from './lib/client-log';
import './index.css';

installClientDiagnostics();
registerSW({ immediate: true });

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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthGuard>
        <App />
      </AuthGuard>
    </QueryClientProvider>
  </StrictMode>,
);
