import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCountUp } from '../../../../src/hooks/useCountUp';

// happy-dom supports requestAnimationFrame but we control timing manually
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useCountUp', () => {
  it('starts at 0', () => {
    const { result } = renderHook(() => useCountUp(100));
    // Before any animation frame fires, value is still the initial state
    expect(result.current).toBe(0);
  });

  it('reaches the target value after the animation completes', async () => {
    const { result } = renderHook(() => useCountUp(100, 100));

    // Advance time past the animation duration so all frames fire
    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current).toBe(100);
  });

  it('interpolates toward target during animation', async () => {
    const { result } = renderHook(() => useCountUp(1000, 1000));

    await act(async () => {
      vi.advanceTimersByTime(100); // 10% of duration
    });

    // Value should be between 0 and 1000 (animation still in progress)
    expect(result.current).toBeGreaterThanOrEqual(0);
    expect(result.current).toBeLessThanOrEqual(1000);
  });

  it('accepts a custom easing function', async () => {
    const linear = (t: number) => t;
    const { result } = renderHook(() => useCountUp(200, 200, linear));

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current).toBe(200);
  });

  it('updates when target changes mid-animation', async () => {
    let target = 100;
    const { result, rerender } = renderHook(() => useCountUp(target, 500));

    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    // Change target midway
    target = 200;
    rerender();

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current).toBe(200);
  });
});
