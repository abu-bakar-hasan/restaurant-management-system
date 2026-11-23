import { create } from 'zustand';

interface NavigationState { compact: boolean; toggleCompact: () => void }
export const useNavigation = create<NavigationState>((set) => ({
  compact: false, toggleCompact: () => set((state) => ({ compact: !state.compact })),
}));
