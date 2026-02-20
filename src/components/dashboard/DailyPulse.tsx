import { useEffect, useState } from 'react';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { ResponsiveLine } from '@nivo/line';
import { nivoTheme, tooltipStyle } from '../../lib/nivoTheme';
import { ChartEmpty } from '@/components/ui/ChartEmpty';

interface DailySpending {
  date: string;
  amount: number;
  count: number;
}

interface Props {
  selectedMonth: string;
}

export default function DailyPulse({ selectedMonth }: Props) {
  const [data, setData] = useState<DailySpending[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [selectedMonth]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const result = await window.electron.invoke('analytics:daily-spending', 365);
      setData(result);
    } catch (error) {
      console.error('Error loading daily spending:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div className="animate-pulse h-40 bg-muted/30 rounded-lg" />;
  }

  const monthDate = parseISO(selectedMonth + '-01');
  const days = eachDayOfInterval({ start: startOfMonth(monthDate), end: endOfMonth(monthDate) });
  const dataMap = new Map(data.map((d) => [d.date, d]));

  const monthData = days.map((day) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const dayData = dataMap.get(dateStr);
    return {
      x: format(day, 'd'),
      y: dayData?.amount ?? 0,
      count: dayData?.count ?? 0,
      date: dateStr,
    };
  });

  const hasData = monthData.some((d) => d.y > 0);

  const xTickValues = days
    .filter((_, i) => i === 0 || (i + 1) % 7 === 0 || i === days.length - 1)
    .map((d) => format(d, 'd'));

  return (
    <div style={{ height: 160 }}>
      {!hasData ? (
        <ChartEmpty />
      ) : (
        <ResponsiveLine
          key={selectedMonth}
          data={[{ id: 'spending', data: monthData }]}
          theme={nivoTheme}
          animate
          motionConfig="gentle"
          margin={{ top: 10, right: 0, bottom: 0, left: 0 }}
          xScale={{ type: 'point' }}
          yScale={{ type: 'linear', min: 0, max: 'auto' }}
          curve="monotoneX"
          enableArea
          areaOpacity={0.12}
          colors={['var(--primary)']}
          lineWidth={2}
          pointSize={0}
          enableGridX={false}
          enableGridY={false}
          axisLeft={null}
          axisBottom={null}
          useMesh
          tooltip={({ point }) => {
            const d = point.data as any;
            return (
              <div style={tooltipStyle}>
                <strong>{format(parseISO(d.date), 'EEE, MMM d')}</strong>
                <span style={{ marginLeft: 8 }}>${(point.data.y as number).toFixed(2)}</span>
                {d.count > 0 && (
                  <span style={{ marginLeft: 8, opacity: 0.6 }}>
                    {d.count} txn{d.count !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            );
          }}
          layers={[
            'grid',
            'axes',
            'areas',
            'lines',
            // Custom dots — only render on days with transactions
            ({ points, innerWidth, innerHeight }) =>
              points
                .filter((p) => (p.data as any).count > 0)
                .map((p) => (
                  <circle
                    key={p.id}
                    cx={p.x}
                    cy={p.y}
                    r={3}
                    fill="var(--background)"
                    stroke="var(--primary)"
                    strokeWidth={2}
                  />
                )),
            'mesh',
          ]}
        />
      )}
    </div>
  );
}
