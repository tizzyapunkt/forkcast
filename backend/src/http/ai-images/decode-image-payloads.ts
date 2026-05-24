import { Buffer } from 'node:buffer';
import type { RecipeImage, SupportedImageMediaType } from '../../domain/ai-recipe-import/types.ts';

const SUPPORTED_MEDIA_TYPES: SupportedImageMediaType[] = ['image/jpeg', 'image/png', 'image/webp'];

export interface ImageDecodeLimits {
  maxImages: number;
  maxImageBytes: number;
  maxTotalBytes: number;
}

/**
 * Decodes and validates an array of base64 image payloads shared by every
 * vision endpoint. On failure it returns the exact HTTP status + JSON body the
 * handlers respond with, so the limit semantics stay identical across features.
 */
export type ImageDecodeResult =
  | { ok: true; images: RecipeImage[] }
  | { ok: false; status: 400 | 413; body: Record<string, unknown> };

export function decodeImagePayloads(images: unknown, limits: ImageDecodeLimits): ImageDecodeResult {
  if (!Array.isArray(images)) {
    return { ok: false, status: 400, body: { error: 'images must be an array' } };
  }
  if (images.length === 0) {
    return { ok: false, status: 400, body: { error: 'At least one image is required' } };
  }
  if (images.length > limits.maxImages) {
    return {
      ok: false,
      status: 400,
      body: {
        error: `At most ${limits.maxImages} images per request, got ${images.length}`,
        maxImages: limits.maxImages,
        submitted: images.length,
      },
    };
  }

  const decoded: RecipeImage[] = [];
  let totalBytes = 0;
  for (let i = 0; i < images.length; i++) {
    const item = images[i] as { data?: unknown; mediaType?: unknown } | null | undefined;
    if (!item || typeof item !== 'object') {
      return { ok: false, status: 400, body: { error: 'Each image must be an object', imageIndex: i } };
    }
    if (typeof item.data !== 'string' || item.data.length === 0) {
      return { ok: false, status: 400, body: { error: 'Each image must have a base64 "data" string', imageIndex: i } };
    }
    if (typeof item.mediaType !== 'string' || !(SUPPORTED_MEDIA_TYPES as string[]).includes(item.mediaType)) {
      return {
        ok: false,
        status: 400,
        body: {
          error: `Unsupported mediaType "${String(item.mediaType)}"; allowed: ${SUPPORTED_MEDIA_TYPES.join(', ')}`,
          imageIndex: i,
        },
      };
    }
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(Buffer.from(item.data, 'base64'));
    } catch {
      return { ok: false, status: 400, body: { error: 'Image "data" is not valid base64', imageIndex: i } };
    }
    if (bytes.length === 0) {
      return { ok: false, status: 400, body: { error: 'Decoded image is empty', imageIndex: i } };
    }
    if (bytes.length > limits.maxImageBytes) {
      return {
        ok: false,
        status: 413,
        body: {
          error: `Image at index ${i} is ${bytes.length} bytes, exceeding the per-image limit of ${limits.maxImageBytes} bytes`,
          imageIndex: i,
          maxImageBytes: limits.maxImageBytes,
        },
      };
    }
    totalBytes += bytes.length;
    if (totalBytes > limits.maxTotalBytes) {
      return {
        ok: false,
        status: 413,
        body: {
          error: `Combined image size exceeds the total limit of ${limits.maxTotalBytes} bytes`,
          maxTotalBytes: limits.maxTotalBytes,
        },
      };
    }
    decoded.push({ mediaType: item.mediaType as SupportedImageMediaType, bytes });
  }

  return { ok: true, images: decoded };
}
