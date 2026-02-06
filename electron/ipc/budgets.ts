import { ipcMain } from 'electron';
import * as budgetQueries from '../db/queries/budgets';
import type { BudgetInput } from '../../src/types';

export function registerBudgetHandlers(): void {
  ipcMain.handle('budgets:get-by-month', async (_, month: string) => {
    try {
      return budgetQueries.getBudgetsByMonth(month);
    } catch (error) {
      console.error('Error getting budgets:', error);
      throw error;
    }
  });

  ipcMain.handle('budgets:create', async (_, data: BudgetInput) => {
    try {
      return budgetQueries.createBudget(data);
    } catch (error) {
      console.error('Error creating budget:', error);
      throw error;
    }
  });

  ipcMain.handle('budgets:update', async (_, data: Partial<BudgetInput> & { id: number }) => {
    try {
      return budgetQueries.updateBudget(data);
    } catch (error) {
      console.error('Error updating budget:', error);
      throw error;
    }
  });

  ipcMain.handle('budgets:delete', async (_, id: number) => {
    try {
      budgetQueries.deleteBudget(id);
    } catch (error) {
      console.error('Error deleting budget:', error);
      throw error;
    }
  });

  ipcMain.handle('budgets:get-progress', async (_, month: string) => {
    try {
      return budgetQueries.getBudgetProgress(month);
    } catch (error) {
      console.error('Error getting budget progress:', error);
      throw error;
    }
  });

  ipcMain.handle('budgets:copy-to-next-month', async (_, data: { from: string; to: string }) => {
    try {
      return budgetQueries.copyBudgetsToNextMonth(data.from, data.to);
    } catch (error) {
      console.error('Error copying budgets:', error);
      throw error;
    }
  });

  console.log('Budget IPC handlers registered');
}
