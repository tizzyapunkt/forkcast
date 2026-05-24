import { describe, it, expect } from 'vitest';
import { Buffer } from 'node:buffer';
import { decodeImagePayloads, type ImageDecodeLimits } from './decode-image-payloads.ts';

const LIMITS: ImageDecodeLimits = { maxImages: 3, maxImageBytes: 1000, maxTotalBytes: 2000 };
const jpeg = (size: number) => ({
  data: Buffer.alloc(size, 0xab).toString('base64'),
  mediaType: 'image/jpeg' as const,
});

describe('decodeImagePayloads', () => {
  it('rejects a non-array', () => {
    expect(decodeImagePayloads(undefined, LIMITS)).toMatchObject({
      ok: false,
      status: 400,
      body: { error: expect.stringMatching(/array/i) },
    });
  });

  it('rejects an empty array', () => {
    expect(decodeImagePayloads([], LIMITS)).toMatchObject({
      ok: false,
      status: 400,
      body: { error: expect.stringMatching(/at least one/i) },
    });
  });

  it('rejects too many images, naming the limit and the count submitted', () => {
    expect(decodeImagePayloads([jpeg(10), jpeg(10), jpeg(10), jpeg(10)], LIMITS)).toMatchObject({
      ok: false,
      status: 400,
      body: { maxImages: 3, submitted: 4 },
    });
  });

  it('rejects a non-object image entry with its index', () => {
    expect(decodeImagePayloads([jpeg(10), null], LIMITS)).toMatchObject({
      ok: false,
      status: 400,
      body: { imageIndex: 1 },
    });
  });

  it('rejects a missing base64 data string with its index', () => {
    expect(decodeImagePayloads([{ mediaType: 'image/jpeg' }], LIMITS)).toMatchObject({
      ok: false,
      status: 400,
      body: { imageIndex: 0, error: expect.stringMatching(/base64/i) },
    });
  });

  it('rejects an unsupported media type, naming the offending index and type', () => {
    expect(decodeImagePayloads([jpeg(10), { data: 'aGVsbG8=', mediaType: 'image/gif' }], LIMITS)).toMatchObject({
      ok: false,
      status: 400,
      body: { imageIndex: 1, error: expect.stringMatching(/image\/gif/) },
    });
  });

  it('rejects an image that decodes to zero bytes with its index', () => {
    expect(decodeImagePayloads([{ data: '!', mediaType: 'image/jpeg' }], LIMITS)).toMatchObject({
      ok: false,
      status: 400,
      body: { imageIndex: 0, error: expect.stringMatching(/empty/i) },
    });
  });

  it('rejects a per-image size overflow with 413 and the offending index', () => {
    expect(decodeImagePayloads([jpeg(10), jpeg(2000)], LIMITS)).toMatchObject({
      ok: false,
      status: 413,
      body: { imageIndex: 1, maxImageBytes: 1000 },
    });
  });

  it('rejects a combined size overflow with 413', () => {
    expect(decodeImagePayloads([jpeg(900), jpeg(900), jpeg(900)], LIMITS)).toMatchObject({
      ok: false,
      status: 413,
      body: { maxTotalBytes: 2000 },
    });
  });

  it('accepts a valid set and returns decoded bytes in order', () => {
    const r = decodeImagePayloads([jpeg(10), jpeg(20)], LIMITS);
    if (!r.ok) throw new Error('expected decode to succeed');
    expect(r.images).toHaveLength(2);
    expect(r.images[0]!.mediaType).toBe('image/jpeg');
    expect(r.images[0]!.bytes.length).toBe(10);
    expect(r.images[1]!.bytes.length).toBe(20);
  });
});
