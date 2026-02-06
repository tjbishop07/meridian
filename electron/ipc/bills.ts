import { ipcMain } from 'electron';
import {
  getAllBills,
  getUpcomingBills,
  createBill,
  updateBill,
  deleteBill,
  recordPayment,
  getBillPayments,
} from '../db/queries/bills';
import type { BillInput } from '../../src/types';

export function registerBillHandlers() {
  ipcMain.handle('bills:get-all', async (_, activeOnly?: boolean) => {
    return getAllBills(activeOnly);
  });

  ipcMain.handle('bills:get-upcoming', async (_, days: number) => {
    return getUpcomingBills(days);
  });

  ipcMain.handle('bills:create', async (_, data: BillInput) => {
    return createBill(data);
  });

  ipcMain.handle('bills:update', async (_, data: Partial<BillInput> & { id: number }) => {
    return updateBill(data);
  });

  ipcMain.handle('bills:delete', async (_, id: number) => {
    deleteBill(id);
    return { success: true };
  });

  ipcMain.handle(
    'bills:record-payment',
    async (
      _,
      data: {
        bill_id: number;
        amount: number;
        date?: string;
        transaction_id?: number;
        notes?: string;
      }
    ) => {
      return recordPayment(data.bill_id, data.amount, data.date, data.transaction_id, data.notes);
    }
  );

  ipcMain.handle('bills:get-payments', async (_, billId: number) => {
    return getBillPayments(billId);
  });

  console.log('✅ Bill IPC handlers registered');
}
