import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface PageSidebarProps {
  title: string;
  children?: ReactNode;
  className?: string;
}

export function PageSidebar({ title, children, className }: PageSidebarProps) {
  return (
    <aside className={cn(
      'w-52 flex-shrink-0 border-r border-sidebar-border flex flex-col bg-sidebar',
      className
    )}>
      <div className="px-4 pt-5 pb-4 border-b border-border/40">
        <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/35 mb-1">
          Workspace
        </p>
        <h1 className="text-sm font-semibold text-foreground">{title}</h1>
      </div>
      {children}
    </aside>
  );
}
