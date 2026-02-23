import { ipcMain } from 'electron';
import { getAllBills, getUpcomingBills, createBill, updateBill, deleteBill, recordPayment, getBillPayments, } from '../db/queries/bills';
export function registerBillHandlers() {
    ipcMain.handle('bills:get-all', async (_, activeOnly) => {
        return getAllBills(activeOnly);
    });
    ipcMain.handle('bills:get-upcoming', async (_, days) => {
        return getUpcomingBills(days);
    });
    ipcMain.handle('bills:create', async (_, data) => {
        return createBill(data);
    });
    ipcMain.handle('bills:update', async (_, data) => {
        return updateBill(data);
    });
    ipcMain.handle('bills:delete', async (_, id) => {
        deleteBill(id);
        return { success: true };
    });
    ipcMain.handle('bills:record-payment', async (_, data) => {
        return recordPayment(data.bill_id, data.amount, data.date, data.transaction_id, data.notes);
    });
    ipcMain.handle('bills:get-payments', async (_, billId) => {
        return getBillPayments(billId);
    });
    console.log('✅ Bill IPC handlers registered');
}
