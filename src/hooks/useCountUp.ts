import { useEffect, useRef, useState } from 'react';

function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

/**
 * Animates a number from its previous value to `target` whenever `target` changes.
 * Interruption-safe: if `target` changes mid-animation the counter starts from
 * wherever it currently is, not from zero.
 */
export function useCountUp(
  target: number,
  duration = 900,
  easing: (t: number) => number = easeOutExpo,
): number {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    let startTime: number | null = null;

    const tick = (now: number) => {
      if (startTime === null) startTime = now;
      const t = Math.min((now - startTime) / duration, 1);
      const next = from + (target - from) * easing(t);
      fromRef.current = next;
      setValue(next);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };

    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return value;
}
