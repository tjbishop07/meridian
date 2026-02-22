import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

/**
 * Drives the sidebar-slides-left / content-slides-right entrance animation
 * used consistently across all pages. Uses a double-RAF to ensure the
 * initial hidden state is painted before the transition fires.
 */
export function usePageEntrance() {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setEntered(true)));
    return () => cancelAnimationFrame(raf);
  }, []);

  return {
    sidebarClass: cn(
      'transition-all duration-500 ease-out',
      entered ? 'translate-x-0 opacity-100' : '-translate-x-8 opacity-0',
    ),
    contentClass: cn(
      'transition-all duration-500 ease-out delay-[160ms]',
      entered ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0',
    ),
  };
}
