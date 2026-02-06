import { useCallback } from 'react';
import type { Goal, GoalInput, GoalContribution } from '../types';

export function useGoals() {
  const loadGoals = useCallback(async (includeCompleted: boolean = false): Promise<Goal[]> => {
    return window.electron.invoke('goals:get-all', includeCompleted);
  }, []);

  const getGoalById = useCallback(async (id: number): Promise<Goal | null> => {
    return window.electron.invoke('goals:get-by-id', id);
  }, []);

  const createGoal = useCallback(async (data: GoalInput): Promise<Goal> => {
    return window.electron.invoke('goals:create', data);
  }, []);

  const updateGoal = useCallback(async (data: Partial<GoalInput> & { id: number }): Promise<Goal> => {
    return window.electron.invoke('goals:update', data);
  }, []);

  const deleteGoal = useCallback(async (id: number): Promise<void> => {
    await window.electron.invoke('goals:delete', id);
  }, []);

  const addContribution = useCallback(
    async (data: {
      goalId: number;
      amount: number;
      date?: string;
      notes?: string;
    }): Promise<GoalContribution> => {
      return window.electron.invoke('goals:add-contribution', data);
    },
    []
  );

  const getContributions = useCallback(async (goalId: number): Promise<GoalContribution[]> => {
    return window.electron.invoke('goals:get-contributions', goalId);
  }, []);

  return {
    loadGoals,
    getGoalById,
    createGoal,
    updateGoal,
    deleteGoal,
    addContribution,
    getContributions,
  };
}
