import { useQuery } from '@tanstack/react-query';
import { ApiError } from '../../api/client';

/**
 * Probes whether AI product capture is configured server-side.
 * Sends an intentionally invalid request (no barcode, no images): a configured
 * server responds 400 (validation), an unconfigured one 503 ai-import-not-configured.
 */
export function useProductCaptureConfigured(enabled = true) {
  return useQuery({
    enabled,
    queryKey: ['barcode-product-capture', 'configured'],
    queryFn: async (): Promise<boolean> => {
      try {
        const res = await fetch('/api/extract-product-from-photos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ barcode: '', images: [] }),
        });
        return res.status !== 503;
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
