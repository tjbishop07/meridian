import { BarChart2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ChartEmpty({ message = 'Not enough data', className }: { message?: string; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center h-full gap-2 text-muted-foreground/50', className)}>
      <BarChart2 className="w-6 h-6" />
      <p className="text-xs">{message}</p>
    </div>
  );
}
