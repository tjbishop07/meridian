import { useCallback } from 'react';
import type { Bill, BillInput, BillPayment } from '../types';

export function useBills() {
  const loadBills = useCallback(async (activeOnly: boolean = true): Promise<Bill[]> => {
    return window.electron.invoke('bills:get-all', activeOnly);
  }, []);

  const getUpcoming = useCallback(async (days: number = 30): Promise<Bill[]> => {
    return window.electron.invoke('bills:get-upcoming', days);
  }, []);

  const createBill = useCallback(async (data: BillInput): Promise<Bill> => {
    return window.electron.invoke('bills:create', data);
  }, []);

  const updateBill = useCallback(async (data: Partial<BillInput> & { id: number }): Promise<Bill> => {
    return window.electron.invoke('bills:update', data);
  }, []);

  const deleteBill = useCallback(async (id: number): Promise<void> => {
    await window.electron.invoke('bills:delete', id);
  }, []);

  const recordPayment = useCallback(
    async (data: {
      bill_id: number;
      amount: number;
      date?: string;
      transaction_id?: number;
      notes?: string;
    }): Promise<BillPayment> => {
      return window.electron.invoke('bills:record-payment', data);
    },
    []
  );

  return {
    loadBills,
    getUpcoming,
    createBill,
    updateBill,
    deleteBill,
    recordPayment,
  };
}
