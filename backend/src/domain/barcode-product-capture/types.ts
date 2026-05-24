import type { RecipeImage } from '../ai-recipe-import/types.ts';

/** A packaged product captured from its barcode + packaging photos. */
export interface ScannedProduct {
  barcode: string;
  name: string;
  unit: 'g' | 'ml';
  macrosPer100: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  capturedAt: string; // ISO datetime string
}

/** The fields a client supplies when saving a reviewed product (the store sets `capturedAt`). */
export type SaveScannedProductInput = Omit<ScannedProduct, 'capturedAt'>;

/** A product as read from packaging photos, before the scanned barcode is attached. */
export interface ExtractedProduct {
  name: string;
  unit: 'g' | 'ml';
  macrosPer100: ScannedProduct['macrosPer100'];
}

/** A product draft returned to the client for review — the extracted fields plus the scanned barcode. */
export interface ProductDraft extends ExtractedProduct {
  barcode: string;
}

/** Decoded packaging images handed to the extractor (shares the AI vision image shape). */
export type ProductImage = RecipeImage;

/** Port: persistence for locally-captured products, keyed by barcode. */
export interface ScannedProductStore {
  findByBarcode(barcode: string): Promise<ScannedProduct | null>;
  upsert(product: ScannedProduct): Promise<void>;
}
