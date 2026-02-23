import { ipcMain } from 'electron';
import * as accountQueries from '../db/queries/accounts';
export function registerAccountHandlers() {
    ipcMain.handle('accounts:get-all', async () => {
        try {
            return accountQueries.getAllAccounts();
        }
        catch (error) {
            console.error('Error getting accounts:', error);
            throw error;
        }
    });
    ipcMain.handle('accounts:get-by-id', async (_, id) => {
        try {
            return accountQueries.getAccountById(id);
        }
        catch (error) {
            console.error('Error getting account:', error);
            throw error;
        }
    });
    ipcMain.handle('accounts:create', async (_, data) => {
        try {
            return accountQueries.createAccount(data);
        }
        catch (error) {
            console.error('Error creating account:', error);
            throw error;
        }
    });
    ipcMain.handle('accounts:update', async (_, data) => {
        try {
            return accountQueries.updateAccount(data);
        }
        catch (error) {
            console.error('Error updating account:', error);
            throw error;
        }
    });
    ipcMain.handle('accounts:delete', async (_, id) => {
        try {
            accountQueries.deleteAccount(id);
        }
        catch (error) {
            console.error('Error deleting account:', error);
            throw error;
        }
    });
    console.log('Account IPC handlers registered');
}
