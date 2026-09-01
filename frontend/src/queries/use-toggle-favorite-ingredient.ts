import { useMutation, useQueryClient } from '@tanstack/react-query';
import { favoriteIngredient, unfavoriteIngredient } from '../api/favorite-ingredients';
import { favoriteIdentityKey, type FavoriteIngredient, type FavoriteUnit } from '../domain/favorite-ingredients';
import type { MacrosPerUnit } from '../domain/meal-log';
import { queryKeys } from './keys';

export interface ToggleFavoriteInput {
  name: string;
  unit: FavoriteUnit;
  macrosPerUnit: MacrosPerUnit;
  untracked?: boolean;
  /** The state to move to — `true` favorites, `false` unfavorites. */
  favorite: boolean;
}

/**
 * Toggles a favorite and updates the cached list optimistically, so the star
 * flips under the finger. A failed write rolls the cache back to the snapshot
 * taken before the mutation; the settle invalidation then reconciles ordering
 * and the derived `lastAmount` with the server.
 */
export function useToggleFavoriteIngredient() {
  const queryClient = useQueryClient();
  const key = queryKeys.favoriteIngredients();

  return useMutation({
    mutationFn: async ({ favorite, name, unit, macrosPerUnit, untracked }: ToggleFavoriteInput): Promise<void> => {
      // The response is discarded: the cache is already updated optimistically and
      // reconciled by the settle invalidation, which also brings back the derived
      // `lastAmount` a single write cannot know.
      if (favorite) {
        await favoriteIngredient({ name, unit, macrosPerUnit, ...(untracked ? { untracked } : {}) });
      } else {
        await unfavoriteIngredient({ name, unit });
      }
    },

    onMutate: async (input: ToggleFavoriteInput) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<FavoriteIngredient[]>(key);

      const identity = favoriteIdentityKey(input.name, input.unit);
      const without = (previous ?? []).filter((f) => favoriteIdentityKey(f.name, f.unit) !== identity);

      if (input.favorite) {
        // Appended rather than sorted in: order only matters in the Favoriten
        // tab, which cannot add, and the settle refetch restores the real order.
        queryClient.setQueryData<FavoriteIngredient[]>(key, [
          ...without,
          {
            name: input.name,
            unit: input.unit,
            macrosPerUnit: input.macrosPerUnit,
            ...(input.untracked ? { untracked: true } : {}),
            favoritedAt: new Date().toISOString(),
          },
        ]);
      } else {
        queryClient.setQueryData<FavoriteIngredient[]>(key, without);
      }

      return { previous };
    },

    onError: (_err, _input, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key });
    },
  });
}
