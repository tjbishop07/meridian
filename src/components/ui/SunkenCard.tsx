import { cn } from '@/lib/utils';

export function SunkenCard({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('rounded-lg bg-black/10 shadow-[inset_0_2px_8px_rgba(0,0,0,0.12)] p-4', className)}>
      {children}
    </div>
  );
}
