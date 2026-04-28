import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement } from 'react';

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

interface WrapperProps {
  queryClient?: QueryClient;
}

export function renderWithProviders(ui: ReactElement, { queryClient, ...options }: WrapperProps & RenderOptions = {}) {
  const client = queryClient ?? createTestQueryClient();
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>, options);
}
