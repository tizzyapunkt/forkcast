import { useMutation } from '@tanstack/react-query';
import { importRecipeFromPhotos, type ImportImagePayload } from '../../api/import-recipe-from-photos';
import { fileToBase64 } from './file-to-base64';
import type { StagedPhoto } from './photo-staging';

export function useImportRecipeFromPhotos() {
  return useMutation({
    mutationFn: async (photos: StagedPhoto[]) => {
      const payload: ImportImagePayload[] = await Promise.all(
        photos.map(async (p) => ({ data: await fileToBase64(p.file), mediaType: p.mediaType })),
      );
      return importRecipeFromPhotos(payload);
    },
  });
}
