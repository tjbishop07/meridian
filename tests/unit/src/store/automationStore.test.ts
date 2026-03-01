import { describe, it, expect, beforeEach } from 'vitest';
import { useAutomationStore } from '../../../../src/store/automationStore';

beforeEach(() => {
  useAutomationStore.getState().clearAllProgress();
});

describe('automationStore – setPlayingRecipe', () => {
  it('records the active recipe id', () => {
    useAutomationStore.getState().setPlayingRecipe('42');
    expect(useAutomationStore.getState().playingRecipeId).toBe('42');
  });

  it('clears the active recipe when passed null', () => {
    useAutomationStore.getState().setPlayingRecipe('42');
    useAutomationStore.getState().setPlayingRecipe(null);
    expect(useAutomationStore.getState().playingRecipeId).toBeNull();
  });
});

describe('automationStore – updateProgress', () => {
  it('stores progress under the recipe id key', () => {
    const progress = { currentStep: 2, totalSteps: 5, status: 'Running', color: '#3b82f6' };
    useAutomationStore.getState().updateProgress('42', progress);
    expect(useAutomationStore.getState().progress['42']).toEqual(progress);
  });

  it('overwrites previous progress for the same recipe', () => {
    useAutomationStore.getState().updateProgress('42', { currentStep: 1, totalSteps: 5, status: 'Step 1', color: '#3b82f6' });
    useAutomationStore.getState().updateProgress('42', { currentStep: 3, totalSteps: 5, status: 'Step 3', color: '#3b82f6' });
    expect(useAutomationStore.getState().progress['42'].currentStep).toBe(3);
  });
});

describe('automationStore – clearProgress', () => {
  it('removes the progress entry for the given recipe', () => {
    useAutomationStore.getState().updateProgress('42', { currentStep: 1, totalSteps: 3, status: 'Running', color: '#3b82f6' });
    useAutomationStore.getState().clearProgress('42');
    expect(useAutomationStore.getState().progress['42']).toBeUndefined();
  });

  it('resets playingRecipeId to null when it matches the cleared recipe', () => {
    useAutomationStore.getState().setPlayingRecipe('42');
    useAutomationStore.getState().clearProgress('42');
    expect(useAutomationStore.getState().playingRecipeId).toBeNull();
  });

  it('leaves playingRecipeId unchanged when a different recipe is cleared', () => {
    useAutomationStore.getState().setPlayingRecipe('99');
    useAutomationStore.getState().updateProgress('42', { currentStep: 1, totalSteps: 3, status: 'Running', color: '#3b82f6' });
    useAutomationStore.getState().clearProgress('42');
    expect(useAutomationStore.getState().playingRecipeId).toBe('99');
  });
});

describe('automationStore – clearAllProgress', () => {
  it('clears all progress entries and playingRecipeId', () => {
    useAutomationStore.getState().setPlayingRecipe('42');
    useAutomationStore.getState().updateProgress('42', { currentStep: 2, totalSteps: 5, status: 'Running', color: '#3b82f6' });
    useAutomationStore.getState().updateProgress('99', { currentStep: 1, totalSteps: 2, status: 'Done', color: '#10b981' });
    useAutomationStore.getState().clearAllProgress();
    expect(useAutomationStore.getState().playingRecipeId).toBeNull();
    expect(useAutomationStore.getState().progress).toEqual({});
  });
});
