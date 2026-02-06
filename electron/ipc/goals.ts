import { ipcMain } from 'electron';
import {
  getAllGoals,
  getGoalById,
  createGoal,
  updateGoal,
  deleteGoal,
  addContribution,
  getGoalContributions,
} from '../db/queries/goals';
import type { GoalInput } from '../../src/types';

export function registerGoalHandlers() {
  ipcMain.handle('goals:get-all', async (_, includeCompleted?: boolean) => {
    return getAllGoals(includeCompleted);
  });

  ipcMain.handle('goals:get-by-id', async (_, id: number) => {
    return getGoalById(id);
  });

  ipcMain.handle('goals:create', async (_, data: GoalInput) => {
    return createGoal(data);
  });

  ipcMain.handle('goals:update', async (_, data: Partial<GoalInput> & { id: number }) => {
    return updateGoal(data);
  });

  ipcMain.handle('goals:delete', async (_, id: number) => {
    deleteGoal(id);
    return { success: true };
  });

  ipcMain.handle(
    'goals:add-contribution',
    async (
      _,
      data: {
        goalId: number;
        amount: number;
        date?: string;
        notes?: string;
      }
    ) => {
      return addContribution(data.goalId, data.amount, data.date, data.notes);
    }
  );

  ipcMain.handle('goals:get-contributions', async (_, goalId: number) => {
    return getGoalContributions(goalId);
  });

  console.log('✅ Goal IPC handlers registered');
}
