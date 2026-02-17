import { create } from 'zustand';

export interface AutomationProgress {
  currentStep: number;
  totalSteps: number;
  status: string;
  color: string;
}

interface AutomationState {
  playingRecipeId: string | null;
  progress: Record<string, AutomationProgress>;

  setPlayingRecipe: (recipeId: string | null) => void;
  updateProgress: (recipeId: string, progress: AutomationProgress) => void;
  clearProgress: (recipeId: string) => void;
  clearAllProgress: () => void;
}

export const useAutomationStore = create<AutomationState>((set) => ({
  playingRecipeId: null,
  progress: {},

  setPlayingRecipe: (recipeId) => {
    console.log('[AutomationStore] setPlayingRecipe called with:', recipeId);
    set({ playingRecipeId: recipeId });
    console.log('[AutomationStore] New state:', { playingRecipeId: recipeId });
  },

  updateProgress: (recipeId, progress) => {
    console.log('[AutomationStore] updateProgress called with:', recipeId, progress);
    set((state) => {
      const newProgress = {
        ...state.progress,
        [recipeId]: progress
      };
      console.log('[AutomationStore] New progress state:', newProgress);
      return { progress: newProgress };
    });
  },

  clearProgress: (recipeId) =>
    set((state) => {
      const newProgress = { ...state.progress };
      delete newProgress[recipeId];
      return {
        progress: newProgress,
        playingRecipeId: state.playingRecipeId === recipeId ? null : state.playingRecipeId
      };
    }),

  clearAllProgress: () => set({ progress: {}, playingRecipeId: null })
}));
