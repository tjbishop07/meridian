import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBills } from '../../../../src/hooks/useBills';

const mockInvoke = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  (window as any).electron = { invoke: mockInvoke };
});

describe('useBills – loadBills', () => {
  it('invokes bills:get-all with activeOnly=true by default', async () => {
    mockInvoke.mockResolvedValue([]);
    const { result } = renderHook(() => useBills());
    await act(async () => { await result.current.loadBills(); });
    expect(mockInvoke).toHaveBeenCalledWith('bills:get-all', true);
  });

  it('forwards the activeOnly flag when provided', async () => {
    mockInvoke.mockResolvedValue([]);
    const { result } = renderHook(() => useBills());
    await act(async () => { await result.current.loadBills(false); });
    expect(mockInvoke).toHaveBeenCalledWith('bills:get-all', false);
  });

  it('returns the value resolved by the IPC channel', async () => {
    const bills = [{ id: 1, name: 'Electricity' }];
    mockInvoke.mockResolvedValue(bills);
    const { result } = renderHook(() => useBills());
    let returned: any;
    await act(async () => { returned = await result.current.loadBills(); });
    expect(returned).toEqual(bills);
  });
});

describe('useBills – getUpcoming', () => {
  it('invokes bills:get-upcoming with days=30 by default', async () => {
    mockInvoke.mockResolvedValue([]);
    const { result } = renderHook(() => useBills());
    await act(async () => { await result.current.getUpcoming(); });
    expect(mockInvoke).toHaveBeenCalledWith('bills:get-upcoming', 30);
  });

  it('forwards a custom days value', async () => {
    mockInvoke.mockResolvedValue([]);
    const { result } = renderHook(() => useBills());
    await act(async () => { await result.current.getUpcoming(7); });
    expect(mockInvoke).toHaveBeenCalledWith('bills:get-upcoming', 7);
  });
});

describe('useBills – createBill', () => {
  it('invokes bills:create with the provided data', async () => {
    const billInput = { name: 'Internet', amount: 60, due_day: 1, frequency: 'monthly' as const, is_active: true };
    mockInvoke.mockResolvedValue({ id: 1, ...billInput });
    const { result } = renderHook(() => useBills());
    await act(async () => { await result.current.createBill(billInput as any); });
    expect(mockInvoke).toHaveBeenCalledWith('bills:create', billInput);
  });
});

describe('useBills – updateBill', () => {
  it('invokes bills:update with the provided data including id', async () => {
    const updateData = { id: 3, amount: 75 };
    mockInvoke.mockResolvedValue({ id: 3, name: 'Internet', amount: 75 });
    const { result } = renderHook(() => useBills());
    await act(async () => { await result.current.updateBill(updateData as any); });
    expect(mockInvoke).toHaveBeenCalledWith('bills:update', updateData);
  });
});

describe('useBills – deleteBill', () => {
  it('invokes bills:delete with the bill id', async () => {
    mockInvoke.mockResolvedValue(undefined);
    const { result } = renderHook(() => useBills());
    await act(async () => { await result.current.deleteBill(5); });
    expect(mockInvoke).toHaveBeenCalledWith('bills:delete', 5);
  });
});

describe('useBills – recordPayment', () => {
  it('invokes bills:record-payment with the payment data', async () => {
    const payment = { bill_id: 2, amount: 120, date: '2025-06-01' };
    mockInvoke.mockResolvedValue({ id: 10, ...payment });
    const { result } = renderHook(() => useBills());
    await act(async () => { await result.current.recordPayment(payment); });
    expect(mockInvoke).toHaveBeenCalledWith('bills:record-payment', payment);
  });

  it('returns the payment record resolved by the IPC channel', async () => {
    const payment = { bill_id: 1, amount: 50 };
    const serverResponse = { id: 99, bill_id: 1, amount: 50, date: '2025-06-01', notes: null };
    mockInvoke.mockResolvedValue(serverResponse);
    const { result } = renderHook(() => useBills());
    let returned: any;
    await act(async () => { returned = await result.current.recordPayment(payment); });
    expect(returned).toEqual(serverResponse);
  });
});
