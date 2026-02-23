import { ipcMain } from 'electron';
import * as budgetQueries from '../db/queries/budgets';
export function registerBudgetHandlers() {
    ipcMain.handle('budgets:get-by-month', async (_, month) => {
        try {
            return budgetQueries.getBudgetsByMonth(month);
        }
        catch (error) {
            console.error('Error getting budgets:', error);
            throw error;
        }
    });
    ipcMain.handle('budgets:create', async (_, data) => {
        try {
            return budgetQueries.createBudget(data);
        }
        catch (error) {
            console.error('Error creating budget:', error);
            throw error;
        }
    });
    ipcMain.handle('budgets:update', async (_, data) => {
        try {
            return budgetQueries.updateBudget(data);
        }
        catch (error) {
            console.error('Error updating budget:', error);
            throw error;
        }
    });
    ipcMain.handle('budgets:delete', async (_, id) => {
        try {
            budgetQueries.deleteBudget(id);
        }
        catch (error) {
            console.error('Error deleting budget:', error);
            throw error;
        }
    });
    ipcMain.handle('budgets:get-progress', async (_, month) => {
        try {
            return budgetQueries.getBudgetProgress(month);
        }
        catch (error) {
            console.error('Error getting budget progress:', error);
            throw error;
        }
    });
    ipcMain.handle('budgets:copy-to-next-month', async (_, data) => {
        try {
            return budgetQueries.copyBudgetsToNextMonth(data.from, data.to);
        }
        catch (error) {
            console.error('Error copying budgets:', error);
            throw error;
        }
    });
    console.log('Budget IPC handlers registered');
}
