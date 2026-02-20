import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  change?: string;
  changePositive?: boolean;
  className?: string;
}

export function StatCard({ label, value, icon, change, changePositive, className }: StatCardProps) {
  return (
    <Card className={cn('gap-0 py-4', className)}>
      <CardContent className="px-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <div className="text-muted-foreground">{icon}</div>
        </div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        {change !== undefined && (
          <div className={cn(
            'flex items-center gap-1 mt-1 text-xs font-medium',
            changePositive ? 'text-success' : 'text-destructive'
          )}>
            {changePositive
              ? <TrendingUp className="w-3 h-3" />
              : <TrendingDown className="w-3 h-3" />}
            <span>{change}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
