import { useEffect, useState } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  parseISO,
  subMonths
} from 'date-fns';

interface DailySpending {
  date: string;
  amount: number;
  count: number;
}

interface CellData {
  date: Date;
  amount: number;
  count: number;
  isCurrentMonth: boolean;
}

interface Props {
  selectedMonth: string; // Format: "YYYY-MM"
}

export default function SpendingHeatmap({ selectedMonth }: Props) {
  const [data, setData] = useState<DailySpending[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hoveredCell, setHoveredCell] = useState<CellData | null>(null);

  useEffect(() => {
    loadData();
  }, [selectedMonth]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      // Get data for the whole month (last 31 days covers any month)
      const result = await window.electron.invoke('analytics:daily-spending', 365);
      setData(result);
    } catch (error) {
      console.error('Error loading daily spending:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-base-100 rounded-lg shadow-sm p-4 sm:p-6">
        <h2 className="text-base sm:text-lg font-semibold text-base-content mb-4">
          Daily Spending Activity
        </h2>
        <div className="animate-pulse h-32 sm:h-40 bg-base-300 rounded"></div>
      </div>
    );
  }

  // Create a map for quick lookups
  const dataMap = new Map(
    data.map((item) => [item.date, { amount: item.amount, count: item.count }])
  );

  // Calculate max spending across all 6 months for consistent color scale
  const currentMonthDate = parseISO(selectedMonth + '-01');
  const sixMonthsData = data.filter((d) => {
    const date = parseISO(d.date);
    const fiveMonthsAgo = subMonths(currentMonthDate, 5);
    return date >= startOfMonth(fiveMonthsAgo) && date <= endOfMonth(currentMonthDate);
  });
  const maxSpending = Math.max(...sixMonthsData.map((d) => d.amount), 1);

  // Get color based on spending amount
  const getColor = (amount: number, isCurrentMonth: boolean): string => {
    if (!isCurrentMonth) return 'bg-base-200';
    if (amount === 0) return 'bg-base-300';
    const intensity = amount / maxSpending;
    if (intensity < 0.2) return 'bg-success/20';
    if (intensity < 0.4) return 'bg-success/40';
    if (intensity < 0.6) return 'bg-success/60';
    if (intensity < 0.8) return 'bg-success/80';
    return 'bg-success';
  };

  // Generate calendar grids for the last 3 months
  const generateMonthGrid = (monthDate: Date) => {
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthStart);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

    const weeks: CellData[][] = [];
    let currentDate = calendarStart;

    while (currentDate <= calendarEnd) {
      const week: CellData[] = [];
      for (let i = 0; i < 7; i++) {
        const dateStr = format(currentDate, 'yyyy-MM-dd');
        const dayData = dataMap.get(dateStr) || { amount: 0, count: 0 };
        const isCurrentMonth = isSameMonth(currentDate, monthStart);

        week.push({
          date: new Date(currentDate),
          amount: dayData.amount,
          count: dayData.count,
          isCurrentMonth,
        });

        currentDate = addDays(currentDate, 1);
      }
      weeks.push(week);
    }

    return { weeks, monthStart };
  };

  const months = [
    generateMonthGrid(subMonths(currentMonthDate, 5)),
    generateMonthGrid(subMonths(currentMonthDate, 4)),
    generateMonthGrid(subMonths(currentMonthDate, 3)),
    generateMonthGrid(subMonths(currentMonthDate, 2)),
    generateMonthGrid(subMonths(currentMonthDate, 1)),
    generateMonthGrid(currentMonthDate),
  ];

  return (
    <div className="bg-base-100 rounded-lg shadow-sm p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-base-content">
          Daily Spending Activity
        </h2>
      </div>

      <div className="flex justify-center">
        <div className="inline-block">
          {/* Six month calendars */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
            {months.map(({ weeks, monthStart }, monthIdx) => (
              <div key={monthIdx} className="inline-block">
                {/* Month label */}
                <div className="text-center mb-2">
                  <div className="text-sm font-semibold text-base-content">
                    {format(monthStart, 'MMMM yyyy')}
                  </div>
                </div>

                {/* Day of week headers */}
                <div className="grid grid-cols-7 gap-1 mb-1">
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
                    <div
                      key={idx}
                      className="w-4 text-xs font-medium text-base-content/70 text-center"
                    >
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar weeks */}
                <div className="space-y-1">
                  {weeks.map((week, weekIndex) => (
                    <div key={weekIndex} className="grid grid-cols-7 gap-1">
                      {week.map((cell, dayIndex) => (
                        <div
                          key={dayIndex}
                          className="relative group"
                        >
                          <div
                            className={`
                              w-4 h-4 rounded-sm transition-all cursor-pointer
                              ${cell.isCurrentMonth ? 'hover:ring-2 hover:ring-primary hover:ring-offset-1' : 'opacity-30'}
                              ${getColor(cell.amount, cell.isCurrentMonth)}
                            `}
                            onMouseEnter={() => setHoveredCell(cell)}
                            onMouseLeave={() => setHoveredCell(null)}
                          />

                          {/* Tooltip on hover */}
                          {hoveredCell?.date.getTime() === cell.date.getTime() && (
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-10 pointer-events-none hidden group-hover:block">
                              <div className="bg-base-300 text-base-content px-3 py-2 rounded-lg shadow-lg text-sm whitespace-nowrap">
                                <div className="font-semibold">
                                  {format(cell.date, 'EEE, MMM d')}
                                </div>
                                <div className="text-base-content/70">
                                  ${cell.amount.toFixed(2)}
                                  {cell.count > 0 && ` • ${cell.count} transaction${cell.count !== 1 ? 's' : ''}`}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-base-content/70">
            <span>Less</span>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm bg-base-300"></div>
              <div className="w-3 h-3 rounded-sm bg-success/20"></div>
              <div className="w-3 h-3 rounded-sm bg-success/40"></div>
              <div className="w-3 h-3 rounded-sm bg-success/60"></div>
              <div className="w-3 h-3 rounded-sm bg-success/80"></div>
              <div className="w-3 h-3 rounded-sm bg-success"></div>
            </div>
            <span>More</span>
          </div>
        </div>
      </div>
    </div>
  );
}
