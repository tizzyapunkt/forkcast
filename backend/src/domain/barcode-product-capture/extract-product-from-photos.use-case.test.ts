import { describe, it, expect, vi } from 'vitest';
import { extractProductFromPhotos } from './extract-product-from-photos.use-case.ts';
import type { ProductDraftExtractor } from './product-draft-extractor.ts';
import type { ExtractedProduct, ProductImage } from './types.ts';

const image: ProductImage = { mediaType: 'image/jpeg', bytes: new Uint8Array([1]) };
const extracted: ExtractedProduct = {
  name: 'Himbeer-Heidelbeer-Mix',
  unit: 'g',
  macrosPer100: { calories: 54, protein: 0.9, carbs: 8.4, fat: 0.7 },
};

function makeExtractor(): ProductDraftExtractor {
  return { extract: vi.fn<(i: ProductImage[]) => Promise<ExtractedProduct>>().mockResolvedValue(extracted) };
}

describe('extractProductFromPhotos', () => {
  it('attaches the scanned barcode to the extracted product', async () => {
    const extractor = makeExtractor();
    const draft = await extractProductFromPhotos({ extractor }, { barcode: '4337256176103', images: [image] });
    expect(draft).toEqual({ barcode: '4337256176103', ...extracted });
    expect(extractor.extract).toHaveBeenCalledWith([image]);
  });

  it('trims the barcode', async () => {
    const extractor = makeExtractor();
    const draft = await extractProductFromPhotos({ extractor }, { barcode: '  111 ', images: [image] });
    expect(draft.barcode).toBe('111');
  });

  it('rejects an empty or whitespace barcode without calling the extractor', async () => {
    const extractor = makeExtractor();
    await expect(extractProductFromPhotos({ extractor }, { barcode: '   ', images: [image] })).rejects.toThrow(
      /barcode/i,
    );
    expect(extractor.extract).not.toHaveBeenCalled();
  });

  it('rejects an empty image list', async () => {
    const extractor = makeExtractor();
    await expect(extractProductFromPhotos({ extractor }, { barcode: '111', images: [] })).rejects.toThrow(/image/i);
  });
});
