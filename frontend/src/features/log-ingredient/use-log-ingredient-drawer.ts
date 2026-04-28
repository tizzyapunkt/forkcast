import { useReducer } from 'react';
import type { MealSlot } from '../../domain/meal-log';

type Tab = 'quick' | 'search';

interface State {
  isOpen: boolean;
  tab: Tab;
  slot: MealSlot | null;
}

type Action = { type: 'open'; slot: MealSlot } | { type: 'close' } | { type: 'set-tab'; tab: Tab };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'open':
      return { isOpen: true, tab: 'quick', slot: action.slot };
    case 'close':
      return { ...state, isOpen: false, slot: null };
    case 'set-tab':
      return { ...state, tab: action.tab };
  }
}

export function useLogIngredientDrawer() {
  const [state, dispatch] = useReducer(reducer, { isOpen: false, tab: 'quick', slot: null });

  return {
    isOpen: state.isOpen,
    tab: state.tab,
    slot: state.slot,
    openDrawer: (slot: MealSlot) => dispatch({ type: 'open', slot }),
    closeDrawer: () => dispatch({ type: 'close' }),
    setTab: (tab: Tab) => dispatch({ type: 'set-tab', tab }),
  };
}
