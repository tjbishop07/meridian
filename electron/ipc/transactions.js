import { ipcMain } from 'electron';
import * as transactionQueries from '../db/queries/transactions';
export function registerTransactionHandlers() {
    ipcMain.handle('transactions:get-all', async (_, filters) => {
        try {
            return transactionQueries.getAllTransactions(filters || {});
        }
        catch (error) {
            console.error('Error getting transactions:', error);
            throw error;
        }
    });
    ipcMain.handle('transactions:get-by-id', async (_, id) => {
        try {
            return transactionQueries.getTransactionById(id);
        }
        catch (error) {
            console.error('Error getting transaction:', error);
            throw error;
        }
    });
    ipcMain.handle('transactions:create', async (_, data) => {
        try {
            return transactionQueries.createTransaction(data);
        }
        catch (error) {
            console.error('Error creating transaction:', error);
            throw error;
        }
    });
    ipcMain.handle('transactions:update', async (_, data) => {
        try {
            return transactionQueries.updateTransaction(data);
        }
        catch (error) {
            console.error('Error updating transaction:', error);
            throw error;
        }
    });
    ipcMain.handle('transactions:delete', async (_, id) => {
        try {
            transactionQueries.deleteTransaction(id);
        }
        catch (error) {
            console.error('Error deleting transaction:', error);
            throw error;
        }
    });
    ipcMain.handle('transactions:bulk-create', async (_, data) => {
        try {
            return transactionQueries.bulkCreateTransactions(data);
        }
        catch (error) {
            console.error('Error bulk creating transactions:', error);
            throw error;
        }
    });
    ipcMain.handle('transactions:delete-all', async () => {
        try {
            return transactionQueries.deleteAllTransactions();
        }
        catch (error) {
            console.error('Error deleting all transactions:', error);
            throw error;
        }
    });
    console.log('Transaction IPC handlers registered');
}
