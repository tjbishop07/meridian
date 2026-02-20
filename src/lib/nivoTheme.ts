import type { CSSProperties } from 'react';

// Shared Nivo chart theme — uses CSS variables so it responds to theme changes.
// CSS vars resolve at paint time in both SVG (via style attr) and div (tooltip) contexts.
export const nivoTheme = {
  background: 'transparent',
  text: { fontSize: 11, fill: 'var(--muted-foreground)' },
  axis: {
    domain: { line: { stroke: 'transparent' } },
    ticks: {
      line: { stroke: 'transparent' },
      text: { fontSize: 11, fill: 'var(--muted-foreground)' },
    },
    legend: { text: { fontSize: 12, fill: 'var(--muted-foreground)' } },
  },
  grid: {
    line: { stroke: 'var(--border)', strokeWidth: 1 },
  },
  legends: {
    text: { fontSize: 11, fill: 'var(--muted-foreground)' },
  },
  tooltip: {
    container: {
      background: 'var(--card)',
      color: 'var(--foreground)',
      fontSize: 12,
      borderRadius: 8,
      boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
      padding: '8px 12px',
    },
  },
};

/** Alias for components that call buildNivoTheme() at render time */
export function buildNivoTheme() {
  return nivoTheme;
}

export const CHART_COLORS = [
  '#0ea5e9', '#8b5cf6', '#ec4899', '#f59e0b',
  '#10b981', '#ef4444', '#6366f1', '#14b8a6',
  '#f97316', '#a855f7',
];

/** Reusable tooltip box styling — uses CSS variables for theme responsiveness */
export const tooltipStyle: CSSProperties = {
  background: 'var(--card)',
  color: 'var(--foreground)',
  fontSize: 12,
  borderRadius: 8,
  boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
  padding: '8px 12px',
};
