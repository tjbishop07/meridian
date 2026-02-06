import { create } from 'zustand';
import type { Transaction, Account, Category } from '../types';

interface AppState {
  // Data
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  selectedAccountId: number | null;

  // UI State
  isLoading: boolean;
  error: string | null;

  // Actions - Transactions
  setTransactions: (transactions: Transaction[]) => void;
  updateSingleTransaction: (updatedTransaction: Transaction) => void;
  loadTransactions: (filters?: any) => Promise<void>;
  refreshTransactions: () => Promise<void>;

  // Actions - Accounts
  setAccounts: (accounts: Account[]) => void;
  loadAccounts: () => Promise<void>;
  setSelectedAccount: (id: number | null) => void;

  // Actions - Categories
  setCategories: (categories: Category[]) => void;
  loadCategories: () => Promise<void>;

  // Actions - UI
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

export const useStore = create<AppState>((set, get) => ({
  // Initial State
  transactions: [],
  accounts: [],
  categories: [],
  selectedAccountId: null,
  isLoading: false,
  error: null,

  // Transaction Actions
  setTransactions: (transactions) => set({ transactions }),

  updateSingleTransaction: (updatedTransaction) =>
    set((state) => ({
      transactions: state.transactions.map((t) =>
        t.id === updatedTransaction.id ? updatedTransaction : t
      ),
    })),

  loadTransactions: async (filters = {}) => {
    set({ isLoading: true, error: null });
    try {
      const transactions = await window.electron.invoke('transactions:get-all', filters);
      set({ transactions, isLoading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load transactions';
      set({ error: errorMessage, isLoading: false });
      console.error('Error loading transactions:', error);
    }
  },

  refreshTransactions: async () => {
    const { selectedAccountId } = get();
    const filters = selectedAccountId ? { account_id: selectedAccountId } : {};
    await get().loadTransactions(filters);
  },

  // Account Actions
  setAccounts: (accounts) => set({ accounts }),

  loadAccounts: async () => {
    try {
      const accounts = await window.electron.invoke('accounts:get-all');
      set({ accounts });
    } catch (error) {
      console.error('Error loading accounts:', error);
    }
  },

  setSelectedAccount: (id) => {
    set({ selectedAccountId: id });
    // Reload transactions when account changes
    if (id !== null) {
      get().loadTransactions({ account_id: id });
    } else {
      get().loadTransactions();
    }
  },

  // Category Actions
  setCategories: (categories) => set({ categories }),

  loadCategories: async () => {
    try {
      const categories = await window.electron.invoke('categories:get-all');
      set({ categories });
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  },

  // UI Actions
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),
}));
