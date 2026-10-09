import { createContext, useContext } from 'react';

/**
 * Lets a recipe batch's banner open the cooking view for its recipe. Only the planner provides it, so the
 * diary's banners stay without a "Kochen" action.
 */
export const CookLaunchContext = createContext<((recipeId: string) => void) | null>(null);

export function useCookLaunch(): ((recipeId: string) => void) | null {
  return useContext(CookLaunchContext);
}
