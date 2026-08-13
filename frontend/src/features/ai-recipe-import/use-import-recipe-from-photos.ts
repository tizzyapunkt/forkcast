import { useMutation } from '@tanstack/react-query';
import { importRecipeFromPhotos, type ImportImagePayload } from '../../api/import-recipe-from-photos';
import { fileToBase64 } from './file-to-base64';
import { ImportTimeoutError } from './import-failure';
import type { StagedPhoto } from './photo-staging';

/** A vision read of eight photos runs ~30–60s; past this the request is a hang, not slow work. */
export const IMPORT_TIMEOUT_MS = 150_000;

export interface ImportRequest {
  photos: StagedPhoto[];
  /** Aborts both the encoding loop and the in-flight request (user cancel, unmount, timeout). */
  signal?: AbortSignal;
}

export function useImportRecipeFromPhotos() {
  return useMutation({
    mutationFn: async ({ photos, signal }: ImportRequest) => {
      const payload: ImportImagePayload[] = [];
      for (const photo of photos) {
        throwIfAborted(signal);
        payload.push({ data: await fileToBase64(photo.file), mediaType: photo.mediaType });
      }
      throwIfAborted(signal);
      return importRecipeFromPhotos(payload, signal);
    },
  });
}

function throwIfAborted(signal: AbortSignal | undefined) {
  if (!signal?.aborted) return;
  throw signal.reason instanceof Error ? signal.reason : new ImportTimeoutError();
}
