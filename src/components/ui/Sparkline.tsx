interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}

export function Sparkline({ data, width = 88, height = 32, color = 'var(--muted-foreground)' }: SparklineProps) {
  if (data.length < 2) return null;

  const pad = 2;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const toX = (i: number) => pad + (i / (data.length - 1)) * (width - pad * 2);
  const toY = (v: number) => pad + (1 - (v - min) / range) * (height - pad * 2);

  const points = data.map((v, i) => `${toX(i)},${toY(v)}`).join(' ');

  // Area path: line + close down to bottom
  const areaPath =
    `M ${toX(0)},${toY(data[0])} ` +
    data.slice(1).map((v, i) => `L ${toX(i + 1)},${toY(v)}`).join(' ') +
    ` L ${toX(data.length - 1)},${height - pad} L ${toX(0)},${height - pad} Z`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ overflow: 'visible' }}
    >
      {/* Area fill */}
      <path d={areaPath} fill={color} fillOpacity={0.1} />
      {/* Line */}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* End dot */}
      <circle
        cx={toX(data.length - 1)}
        cy={toY(data[data.length - 1])}
        r={2}
        fill={color}
      />
    </svg>
  );
}
