import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

/**
 * Drives the page entrance animation:
 * - Content slides in from the right immediately
 * - Sidebar bounces in from the left after a 320ms delay (once content is underway)
 */
export function usePageEntrance() {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setEntered(true)));
    return () => cancelAnimationFrame(raf);
  }, []);

  return {
    // Pure CSS animation — fill-mode: backwards keeps it hidden during the delay
    sidebarClass: 'sidebar-entrance',
    contentClass: cn(
      'transition-all duration-500 ease-out',
      entered ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0',
    ),
  };
}
