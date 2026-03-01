import * as React from 'react';
import { cn } from '@/lib/utils';

type SidebarButtonProps = React.ComponentProps<'button'> & {
  /** primary = gradient CTA; secondary = muted ghost action (default) */
  variant?: 'primary' | 'secondary';
};

/**
 * SidebarButton — full-width, left-aligned button for PageSidebar action sections.
 * Use `variant="primary"` for the main CTA (e.g. "New Tag"),
 * and `variant="secondary"` (default) for supporting actions.
 */
export function SidebarButton({
  variant = 'secondary',
  className,
  children,
  ...props
}: SidebarButtonProps) {
  return (
    <button
      {...props}
      className={cn(
        'w-full inline-flex items-center justify-start gap-1.5 rounded-md px-3 h-8 text-xs font-medium',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:opacity-50 disabled:pointer-events-none',
        'transition-all duration-150',
        variant === 'primary' && [
          'bg-gradient-to-r from-primary to-primary/80 text-primary-foreground',
          'shadow-sm shadow-primary/20',
          'hover:from-primary/90 hover:to-primary/70',
        ],
        variant === 'secondary' && 'text-muted-foreground/60 hover:text-foreground hover:bg-muted/40',
        className
      )}
    >
      {children}
    </button>
  );
}
