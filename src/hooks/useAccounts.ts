import { useStore } from '../store';
import type { Account } from '../types';

export function useAccounts() {
  const accounts = useStore((state) => state.accounts);
  const selectedAccountId = useStore((state) => state.selectedAccountId);
  const loadAccounts = useStore((state) => state.loadAccounts);
  const setSelectedAccount = useStore((state) => state.setSelectedAccount);

  const createAccount = async (data: Omit<Account, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const account = await window.electron.invoke('accounts:create', data);
      await loadAccounts();
      return account;
    } catch (error) {
      console.error('Failed to create account:', error);
      throw error;
    }
  };

  const updateAccount = async (data: Partial<Account> & { id: number }) => {
    try {
      const account = await window.electron.invoke('accounts:update', data);
      await loadAccounts();
      return account;
    } catch (error) {
      console.error('Failed to update account:', error);
      throw error;
    }
  };

  const deleteAccount = async (id: number) => {
    try {
      await window.electron.invoke('accounts:delete', id);
      await loadAccounts();
    } catch (error) {
      console.error('Failed to delete account:', error);
      throw error;
    }
  };

  return {
    accounts,
    selectedAccountId,
    loadAccounts,
    setSelectedAccount,
    createAccount,
    updateAccount,
    deleteAccount,
  };
}
