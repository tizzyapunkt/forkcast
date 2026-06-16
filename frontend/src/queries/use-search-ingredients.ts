import { useQuery } from '@tanstack/react-query';
import { searchIngredients, searchBarcode } from '../api/search-ingredients';
import { queryKeys } from './keys';

export function useSearchIngredients(q: string, sources?: Array<'FOODS' | 'USER' | 'OFF'>) {
  return useQuery({
    queryKey: queryKeys.ingredientSearch(q, sources),
    queryFn: () => searchIngredients(q, sources),
    enabled: q.trim().length >= 2,
    staleTime: 5 * 60_000,
  });
}

export function useSearchBarcode(barcode: string) {
  return useQuery({
    queryKey: ['ingredient-search-barcode', barcode],
    queryFn: () => searchBarcode(barcode),
    enabled: barcode.length > 0,
    retry: false,
  });
}
