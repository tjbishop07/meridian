import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface PageSidebarProps {
  title: string;
  children?: ReactNode;
  className?: string;
}

const NOISE_TEXTURE = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.18'/%3E%3C/svg%3E")`;

export function PageSidebar({ title, children, className }: PageSidebarProps) {
  return (
    <aside
      className={cn(
        'w-52 flex-shrink-0 border-r border-sidebar-border/15 flex flex-col bg-sidebar',
        className
      )}
      style={{
        backgroundImage: NOISE_TEXTURE,
        boxShadow: 'inset -1px 0 0 0 rgba(0,0,0,0.12), inset -8px 0 16px -4px rgba(0,0,0,0.35)',
      }}
    >
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
