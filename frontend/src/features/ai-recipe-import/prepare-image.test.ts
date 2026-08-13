import { fitWithin, prepareImageForUpload } from './prepare-image';

function makeFile(name: string, type: string, size: number): File {
  const file = new File([new Uint8Array(1)], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

describe('fitWithin', () => {
  it('leaves a photo that already fits untouched', () => {
    expect(fitWithin(1200, 900, 1600)).toEqual({ width: 1200, height: 900 });
  });

  it('scales the long edge down and keeps the aspect ratio', () => {
    expect(fitWithin(4032, 3024, 1600)).toEqual({ width: 1600, height: 1200 });
  });

  it('scales by height when the photo is portrait', () => {
    expect(fitWithin(3024, 4032, 1600)).toEqual({ width: 1200, height: 1600 });
  });

  it('never collapses an extreme panorama to zero pixels', () => {
    expect(fitWithin(8000, 3, 1600).height).toBe(1);
  });

  it('tolerates a zero-sized image instead of dividing by it', () => {
    expect(fitWithin(0, 0, 1600)).toEqual({ width: 0, height: 0 });
  });
});

describe('prepareImageForUpload', () => {
  it('returns the original file when the browser cannot decode images', async () => {
    const original = makeFile('recipe.jpg', 'image/jpeg', 9 * 1024 * 1024);

    // jsdom ships no createImageBitmap — the same path an old browser takes.
    await expect(prepareImageForUpload(original)).resolves.toBe(original);
  });

  it('returns the original when decoding throws', async () => {
    const original = makeFile('broken.jpg', 'image/jpeg', 4 * 1024 * 1024);
    const decode = vi.fn<() => Promise<ImageBitmap>>(() => Promise.reject(new Error('decode failed')));
    vi.stubGlobal('createImageBitmap', decode);

    await expect(prepareImageForUpload(original)).resolves.toBe(original);

    vi.unstubAllGlobals();
  });

  it('keeps a small photo as-is without re-encoding it', async () => {
    const original = makeFile('small.png', 'image/png', 200 * 1024);
    const bitmap = { width: 800, height: 600, close: vi.fn<() => void>() } as unknown as ImageBitmap;
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn<() => Promise<ImageBitmap>>(() => Promise.resolve(bitmap)),
    );

    await expect(prepareImageForUpload(original)).resolves.toBe(original);

    vi.unstubAllGlobals();
  });
});
