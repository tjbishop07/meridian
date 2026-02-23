import { ipcMain } from 'electron';
import { getAllGoals, getGoalById, createGoal, updateGoal, deleteGoal, addContribution, getGoalContributions, } from '../db/queries/goals';
export function registerGoalHandlers() {
    ipcMain.handle('goals:get-all', async (_, includeCompleted) => {
        return getAllGoals(includeCompleted);
    });
    ipcMain.handle('goals:get-by-id', async (_, id) => {
        return getGoalById(id);
    });
    ipcMain.handle('goals:create', async (_, data) => {
        return createGoal(data);
    });
    ipcMain.handle('goals:update', async (_, data) => {
        return updateGoal(data);
    });
    ipcMain.handle('goals:delete', async (_, id) => {
        deleteGoal(id);
        return { success: true };
    });
    ipcMain.handle('goals:add-contribution', async (_, data) => {
        return addContribution(data.goalId, data.amount, data.date, data.notes);
    });
    ipcMain.handle('goals:get-contributions', async (_, goalId) => {
        return getGoalContributions(goalId);
    });
    console.log('✅ Goal IPC handlers registered');
}
