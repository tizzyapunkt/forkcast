export interface BlsEntry {
  id: string;
  name_de: string;
  name_en: string;
  calories100: number;
  protein100: number;
  carbs100: number;
  fat100: number;
}

export interface BlsIndexedEntry extends BlsEntry {
  name_de_folded: string;
  name_en_folded: string;
}
