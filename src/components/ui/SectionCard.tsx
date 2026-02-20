import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardAction } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface SectionCardProps {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

export function SectionCard({ title, children, action, className, contentClassName }: SectionCardProps) {
  return (
    <Card className={cn('gap-0', className)}>
      <CardHeader className="border-b border-border pb-4 mb-0">
        <CardTitle className="text-base">{title}</CardTitle>
        {action && <CardAction>{action}</CardAction>}
      </CardHeader>
      <CardContent className={cn('pt-4', contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
}
