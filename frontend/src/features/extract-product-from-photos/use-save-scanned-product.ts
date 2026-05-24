import { useMutation } from '@tanstack/react-query';
import { saveScannedProduct, type SaveScannedProductPayload } from '../../api/save-scanned-product';

export function useSaveScannedProduct() {
  return useMutation({
    mutationFn: (payload: SaveScannedProductPayload) => saveScannedProduct(payload),
  });
}
