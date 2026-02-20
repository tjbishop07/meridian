import { cn } from '@/lib/utils';

export function SunkenCard({ className, title, children }: { className?: string; title?: string; children: React.ReactNode }) {
  return (
    <div className={cn('rounded-lg bg-black/10 border border-border/20 shadow-[inset_0_2px_8px_rgba(0,0,0,0.12)] p-4', className)}>
      {title && (
        <p className="text-center text-xs text-muted-foreground/40 font-bold tracking-wide uppercase mb-3 animate-in slide-in-from-top-2 fade-in duration-500">{title}</p>
      )}
      {children}
    </div>
  );
}
