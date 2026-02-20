import { ReactNode } from 'react';

interface PageHeaderProps {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children?: ReactNode;
}

export default function PageHeader({ title, subtitle, action, children }: PageHeaderProps) {
  return (
    <div className="px-6 flex-shrink-0 border-b border-border/60">
      {(title || action) && (
        <div className="flex justify-between items-center pt-5 pb-4">
          <div>
            {title && <h1 className="text-xl font-semibold text-foreground">{title}</h1>}
            {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      {children && <div className={title ? 'mt-4 pb-4' : 'py-2'}>{children}</div>}
    </div>
  );
}
