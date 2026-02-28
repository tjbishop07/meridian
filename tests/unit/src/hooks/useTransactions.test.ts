import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTransactions } from '../../../../src/hooks/useTransactions';

// Mock the Zustand store so we control what each selector returns
vi.mock('../../../../src/store', () => ({
  useStore: vi.fn(),
}));

import { useStore } from '../../../../src/store';

const mockRefreshTransactions = vi.fn();
const mockUpdateSingleTransaction = vi.fn();
const mockLoadTransactions = vi.fn();

const mockStoreState = {
  transactions: [],
  isLoading: false,
  error: null,
  loadTransactions: mockLoadTransactions,
  refreshTransactions: mockRefreshTransactions,
  updateSingleTransaction: mockUpdateSingleTransaction,
};

beforeEach(() => {
  vi.clearAllMocks();
  // Apply the selector against mockStoreState so each useStore(selector) call
  // returns the right slice of state.
  vi.mocked(useStore).mockImplementation((selector: any) => selector(mockStoreState));
  (window as any).electron = { invoke: vi.fn() };
});

describe('useTransactions – createTransaction', () => {
  it('invokes the transactions:create channel with the provided data', async () => {
    const newTx = { id: 1, description: 'Coffee', amount: -5 };
    vi.mocked((window as any).electron.invoke).mockResolvedValue(newTx);

    const { result } = renderHook(() => useTransactions());
    await act(async () => {
      await result.current.createTransaction({
        account_id: 1,
        date: '2025-01-01',
        description: 'Coffee',
        amount: -5,
        type: 'expense',
        status: 'cleared',
      } as any);
    });

    expect((window as any).electron.invoke).toHaveBeenCalledWith(
      'transactions:create',
      expect.objectContaining({ description: 'Coffee' })
    );
  });

  it('calls refreshTransactions after creating a transaction', async () => {
    vi.mocked((window as any).electron.invoke).mockResolvedValue({ id: 1 });

    const { result } = renderHook(() => useTransactions());
    await act(async () => {
      await result.current.createTransaction({ description: 'Test' } as any);
    });

    expect(mockRefreshTransactions).toHaveBeenCalledOnce();
  });

  it('propagates errors thrown by the IPC channel', async () => {
    vi.mocked((window as any).electron.invoke).mockRejectedValue(new Error('IPC failure'));

    const { result } = renderHook(() => useTransactions());
    await expect(
      act(async () => {
        await result.current.createTransaction({ description: 'Bad' } as any);
      })
    ).rejects.toThrow('IPC failure');
  });
});

describe('useTransactions – updateTransaction', () => {
  it('invokes the transactions:update channel', async () => {
    const updated = { id: 7, description: 'Updated' };
    vi.mocked((window as any).electron.invoke).mockResolvedValue(updated);

    const { result } = renderHook(() => useTransactions());
    await act(async () => {
      await result.current.updateTransaction({ id: 7, description: 'Updated' } as any);
    });

    expect((window as any).electron.invoke).toHaveBeenCalledWith(
      'transactions:update',
      expect.objectContaining({ id: 7 })
    );
  });

  it('calls refreshTransactions when skipRefresh is false (default)', async () => {
    vi.mocked((window as any).electron.invoke).mockResolvedValue({ id: 7 });

    const { result } = renderHook(() => useTransactions());
    await act(async () => {
      await result.current.updateTransaction({ id: 7 } as any, false);
    });

    expect(mockRefreshTransactions).toHaveBeenCalledOnce();
    expect(mockUpdateSingleTransaction).not.toHaveBeenCalled();
  });

  it('calls updateSingleTransaction instead of refreshTransactions when skipRefresh is true', async () => {
    const updated = { id: 7, description: 'Optimistic' };
    vi.mocked((window as any).electron.invoke).mockResolvedValue(updated);

    const { result } = renderHook(() => useTransactions());
    await act(async () => {
      await result.current.updateTransaction({ id: 7 } as any, true);
    });

    expect(mockUpdateSingleTransaction).toHaveBeenCalledWith(updated);
    expect(mockRefreshTransactions).not.toHaveBeenCalled();
  });
});

describe('useTransactions – deleteTransaction', () => {
  it('invokes the transactions:delete channel with the transaction id', async () => {
    vi.mocked((window as any).electron.invoke).mockResolvedValue(undefined);

    const { result } = renderHook(() => useTransactions());
    await act(async () => {
      await result.current.deleteTransaction(42);
    });

    expect((window as any).electron.invoke).toHaveBeenCalledWith('transactions:delete', 42);
  });

  it('calls refreshTransactions after deletion', async () => {
    vi.mocked((window as any).electron.invoke).mockResolvedValue(undefined);

    const { result } = renderHook(() => useTransactions());
    await act(async () => {
      await result.current.deleteTransaction(42);
    });

    expect(mockRefreshTransactions).toHaveBeenCalledOnce();
  });
});

describe('useTransactions – exposed state', () => {
  it('exposes transactions, isLoading, and error from the store', () => {
    const { result } = renderHook(() => useTransactions());
    expect(result.current.transactions).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });
});
