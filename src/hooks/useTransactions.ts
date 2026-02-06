import { useStore } from '../store';
import type { CreateTransactionInput, UpdateTransactionInput, TransactionFilters } from '../types';

export function useTransactions() {
  const transactions = useStore((state) => state.transactions);
  const isLoading = useStore((state) => state.isLoading);
  const error = useStore((state) => state.error);
  const loadTransactions = useStore((state) => state.loadTransactions);
  const refreshTransactions = useStore((state) => state.refreshTransactions);
  const updateSingleTransaction = useStore((state) => state.updateSingleTransaction);

  const createTransaction = async (data: CreateTransactionInput) => {
    try {
      const transaction = await window.electron.invoke('transactions:create', data);
      await refreshTransactions();
      return transaction;
    } catch (error) {
      console.error('Failed to create transaction:', error);
      throw error;
    }
  };

  const updateTransaction = async (data: UpdateTransactionInput, skipRefresh = false) => {
    try {
      const transaction = await window.electron.invoke('transactions:update', data);
      if (skipRefresh) {
        updateSingleTransaction(transaction);
      } else {
        await refreshTransactions();
      }
      return transaction;
    } catch (error) {
      console.error('Failed to update transaction:', error);
      throw error;
    }
  };

  const deleteTransaction = async (id: number) => {
    try {
      await window.electron.invoke('transactions:delete', id);
      await refreshTransactions();
    } catch (error) {
      console.error('Failed to delete transaction:', error);
      throw error;
    }
  };

  return {
    transactions,
    isLoading,
    error,
    loadTransactions,
    refreshTransactions,
    createTransaction,
    updateTransaction,
    deleteTransaction,
  };
}
