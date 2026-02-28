import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGoals } from '../../../../src/hooks/useGoals';

const mockInvoke = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  (window as any).electron = { invoke: mockInvoke };
});

describe('useGoals – loadGoals', () => {
  it('invokes goals:get-all with includeCompleted=false by default', async () => {
    mockInvoke.mockResolvedValue([]);
    const { result } = renderHook(() => useGoals());
    await act(async () => { await result.current.loadGoals(); });
    expect(mockInvoke).toHaveBeenCalledWith('goals:get-all', false);
  });

  it('forwards the includeCompleted flag when provided', async () => {
    mockInvoke.mockResolvedValue([]);
    const { result } = renderHook(() => useGoals());
    await act(async () => { await result.current.loadGoals(true); });
    expect(mockInvoke).toHaveBeenCalledWith('goals:get-all', true);
  });

  it('returns the goals resolved by the IPC channel', async () => {
    const goals = [{ id: 1, name: 'Emergency Fund' }];
    mockInvoke.mockResolvedValue(goals);
    const { result } = renderHook(() => useGoals());
    let returned: any;
    await act(async () => { returned = await result.current.loadGoals(); });
    expect(returned).toEqual(goals);
  });
});

describe('useGoals – getGoalById', () => {
  it('invokes goals:get-by-id with the goal id', async () => {
    mockInvoke.mockResolvedValue({ id: 4, name: 'Vacation' });
    const { result } = renderHook(() => useGoals());
    await act(async () => { await result.current.getGoalById(4); });
    expect(mockInvoke).toHaveBeenCalledWith('goals:get-by-id', 4);
  });

  it('returns null when the channel resolves null', async () => {
    mockInvoke.mockResolvedValue(null);
    const { result } = renderHook(() => useGoals());
    let returned: any;
    await act(async () => { returned = await result.current.getGoalById(999); });
    expect(returned).toBeNull();
  });
});

describe('useGoals – createGoal', () => {
  it('invokes goals:create with the provided data', async () => {
    const input = { name: 'New Car', target_amount: 20000 };
    mockInvoke.mockResolvedValue({ id: 1, ...input });
    const { result } = renderHook(() => useGoals());
    await act(async () => { await result.current.createGoal(input as any); });
    expect(mockInvoke).toHaveBeenCalledWith('goals:create', input);
  });
});

describe('useGoals – updateGoal', () => {
  it('invokes goals:update with the provided partial data including id', async () => {
    const update = { id: 2, target_amount: 25000 };
    mockInvoke.mockResolvedValue({ id: 2, name: 'New Car', target_amount: 25000 });
    const { result } = renderHook(() => useGoals());
    await act(async () => { await result.current.updateGoal(update as any); });
    expect(mockInvoke).toHaveBeenCalledWith('goals:update', update);
  });
});

describe('useGoals – deleteGoal', () => {
  it('invokes goals:delete with the goal id', async () => {
    mockInvoke.mockResolvedValue(undefined);
    const { result } = renderHook(() => useGoals());
    await act(async () => { await result.current.deleteGoal(7); });
    expect(mockInvoke).toHaveBeenCalledWith('goals:delete', 7);
  });
});

describe('useGoals – addContribution', () => {
  it('invokes goals:add-contribution with the contribution data', async () => {
    const contribution = { goalId: 3, amount: 500, date: '2025-06-01', notes: 'Birthday money' };
    mockInvoke.mockResolvedValue({ id: 1, goal_id: 3, amount: 500 });
    const { result } = renderHook(() => useGoals());
    await act(async () => { await result.current.addContribution(contribution); });
    expect(mockInvoke).toHaveBeenCalledWith('goals:add-contribution', contribution);
  });

  it('works without optional date and notes fields', async () => {
    const contribution = { goalId: 3, amount: 200 };
    mockInvoke.mockResolvedValue({ id: 2, goal_id: 3, amount: 200 });
    const { result } = renderHook(() => useGoals());
    await act(async () => { await result.current.addContribution(contribution); });
    expect(mockInvoke).toHaveBeenCalledWith('goals:add-contribution', contribution);
  });
});

describe('useGoals – getContributions', () => {
  it('invokes goals:get-contributions with the goal id', async () => {
    mockInvoke.mockResolvedValue([]);
    const { result } = renderHook(() => useGoals());
    await act(async () => { await result.current.getContributions(3); });
    expect(mockInvoke).toHaveBeenCalledWith('goals:get-contributions', 3);
  });

  it('returns the contributions resolved by the IPC channel', async () => {
    const contributions = [{ id: 1, goal_id: 3, amount: 500, date: '2025-06-01' }];
    mockInvoke.mockResolvedValue(contributions);
    const { result } = renderHook(() => useGoals());
    let returned: any;
    await act(async () => { returned = await result.current.getContributions(3); });
    expect(returned).toEqual(contributions);
  });
});
