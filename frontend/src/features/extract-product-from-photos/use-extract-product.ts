import { useMutation } from '@tanstack/react-query';
import { extractProductFromPhotos, type CaptureImagePayload } from '../../api/extract-product-from-photos';
import { fileToBase64 } from '../ai-recipe-import/file-to-base64';
import type { StagedPhoto } from '../ai-recipe-import/photo-staging';

export function useExtractProduct() {
  return useMutation({
    mutationFn: async ({ barcode, photos }: { barcode: string; photos: StagedPhoto[] }) => {
      const payload: CaptureImagePayload[] = await Promise.all(
        photos.map(async (p) => ({ data: await fileToBase64(p.file), mediaType: p.mediaType })),
      );
      return extractProductFromPhotos(barcode, payload);
    },
  });
}
