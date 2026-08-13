/**
 * Phone cameras hand out 8–12 MP JPEGs of 4–12 MB. Sent as-is, eight of them blow past
 * the server's per-image and total-size limits and spend minutes on a mobile uplink for
 * detail the vision model never uses. Anything past ~1600px on the long edge is re-encoded
 * before it is ever staged, so every size shown in the UI is the size actually uploaded.
 */

/** Long-edge ceiling: keeps printed recipe text legible while cutting a 12 MP photo ~10x. */
export const MAX_UPLOAD_EDGE = 1600;
const JPEG_QUALITY = 0.82;
/** Below this, re-encoding costs more quality than it saves bytes. */
const RECOMPRESS_ABOVE_BYTES = 1024 * 1024;

export interface Fit {
  width: number;
  height: number;
}

/** Scales a size down to fit `maxEdge` on its long side. Never upscales. */
export function fitWithin(width: number, height: number, maxEdge: number): Fit {
  const longest = Math.max(width, height);
  if (longest <= maxEdge || longest === 0) return { width, height };
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * Returns a JPEG small enough to upload, or the original file when it is already small,
 * when the browser cannot decode/encode it, or when re-encoding would not actually help.
 * Never throws — a photo that resists processing is still a photo the user can send.
 */
export async function prepareImageForUpload(file: File, maxEdge: number = MAX_UPLOAD_EDGE): Promise<File> {
  if (typeof createImageBitmap !== 'function') return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }

  try {
    const target = fitWithin(bitmap.width, bitmap.height, maxEdge);
    const alreadySmall = target.width === bitmap.width && target.height === bitmap.height;
    if (alreadySmall && file.size <= RECOMPRESS_ABOVE_BYTES) return file;

    const blob = await encodeJpeg(bitmap, target);
    if (!blob || blob.size >= file.size) return file;

    return new File([blob], toJpegName(file.name), { type: 'image/jpeg', lastModified: file.lastModified });
  } catch {
    return file;
  } finally {
    bitmap.close?.();
  }
}

async function encodeJpeg(bitmap: ImageBitmap, target: Fit): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  if (typeof canvas.toBlob !== 'function') return null;
  canvas.width = target.width;
  canvas.height = target.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  // JPEG has no alpha — a transparent PNG would otherwise flatten onto black.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, target.width, target.height);
  ctx.drawImage(bitmap, 0, 0, target.width, target.height);

  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', JPEG_QUALITY);
  });
}

function toJpegName(name: string): string {
  const base = name.replace(/\.[^./\\]+$/, '');
  return `${base || 'foto'}.jpg`;
}
