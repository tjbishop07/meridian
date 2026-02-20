import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * AccentButton — a vibrant CTA button with an emerald gradient.
 * Use for primary import / action triggers that need to stand out from default primary buttons.
 */
export function AccentButton({
  className,
  children,
  ...props
}: React.ComponentProps<'button'>) {
  return (
    <button
      {...props}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium',
        'bg-gradient-to-r from-primary to-primary/80 text-primary-foreground',
        'shadow-sm shadow-primary/20',
        'hover:from-primary/90 hover:to-primary/70',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:opacity-50 disabled:pointer-events-none',
        'transition-all duration-150',
        className
      )}
    >
      {children}
    </button>
  );
}
