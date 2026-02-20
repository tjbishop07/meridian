import { cn } from '@/lib/utils';

export function SectionLabel({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <p className={cn('text-sm font-bold text-muted-foreground mb-4', className)}>
      {children}
    </p>
  );
}
