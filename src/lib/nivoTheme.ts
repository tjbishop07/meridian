import type { CSSProperties } from 'react';

// Shared Nivo chart theme (dark-mode optimised, matches DaisyUI "dark")
export const nivoTheme = {
  background: 'transparent',
  text: { fontSize: 11, fill: '#a6adba' },
  axis: {
    domain: { line: { stroke: 'transparent' } },
    ticks: {
      line: { stroke: 'transparent' },
      text: { fontSize: 11, fill: '#a6adba' },
    },
    legend: { text: { fontSize: 12, fill: '#a6adba' } },
  },
  grid: {
    line: { stroke: '#2a323c', strokeWidth: 1 },
  },
  legends: {
    text: { fontSize: 11, fill: '#a6adba' },
  },
  tooltip: {
    container: {
      background: '#1d232a',
      color: '#e2e8f0',
      fontSize: 12,
      borderRadius: 8,
      boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
      padding: '8px 12px',
    },
  },
};

export const CHART_COLORS = [
  '#0ea5e9', '#8b5cf6', '#ec4899', '#f59e0b',
  '#10b981', '#ef4444', '#6366f1', '#14b8a6',
  '#f97316', '#a855f7',
];

/** Reusable tooltip box styling (matches nivoTheme.tooltip.container) */
export const tooltipStyle: CSSProperties = {
  background: '#1d232a',
  color: '#e2e8f0',
  fontSize: 12,
  borderRadius: 8,
  boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
  padding: '8px 12px',
};
