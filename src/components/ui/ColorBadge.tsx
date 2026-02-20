import * as React from 'react';
import { cn } from '@/lib/utils';

/** Returns black or white text depending on background luminance */
function getContrastColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  // Perceived luminance (WCAG formula)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

interface ColorBadgeProps {
  color: string;  // hex color string, e.g. "#3b82f6"
  label: string;
  size?: 'sm' | 'md';
  className?: string;
}

export function ColorBadge({ color, label, size = 'md', className }: ColorBadgeProps) {
  const textColor = getContrastColor(color);
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-0.5 text-xs',
        className
      )}
      style={{ backgroundColor: color, color: textColor }}
    >
      {label}
    </span>
  );
}
