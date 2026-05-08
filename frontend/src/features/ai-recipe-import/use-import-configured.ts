import { useQuery } from '@tanstack/react-query';
import { ApiError } from '../../api/client';

/**
 * Probes whether AI recipe import is configured server-side.
 * Sends an intentionally invalid request: a configured server will respond with
 * 400 (validation), an unconfigured one with 503 ai-import-not-configured.
 */
export function useImportConfigured() {
  return useQuery({
    queryKey: ['ai-recipe-import', 'configured'],
    queryFn: async (): Promise<boolean> => {
      try {
        const res = await fetch('/api/import-recipe-from-photos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ images: [] }),
        });
        if (res.status === 503) return false;
        return true;
      } catch (err) {
        if (err instanceof ApiError && err.status === 503) return false;
        return true;
      }
    },
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });
}
