import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, DollarSign, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { ResponsiveLine } from '@nivo/line';
import { ResponsivePie } from '@nivo/pie';
import { format, parseISO } from 'date-fns';
import { nivoTheme, CHART_COLORS, tooltipStyle } from '../lib/nivoTheme';
import type { MonthlyStats, CategoryBreakdown, SpendingTrend, Transaction } from '../types';
import SpendingHeatmap from '../components/dashboard/SpendingHeatmap';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SectionCard } from '@/components/ui/SectionCard';
import { Skeleton } from '@/components/ui/skeleton';

export default function Dashboard() {
  const [currentMonth, setCurrentMonth] = useState<MonthlyStats | null>(null);
  const [previousMonth, setPreviousMonth] = useState<MonthlyStats | null>(null);
  const [topCategories, setTopCategories] = useState<CategoryBreakdown[]>([]);
  const [trends, setTrends] = useState<SpendingTrend[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, [selectedMonth]);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      const data = await window.electron.invoke('analytics:dashboard', selectedMonth);
      setCurrentMonth(data.currentMonth);
      setPreviousMonth(data.previousMonth);
      setTopCategories(data.topExpenseCategories);
      setTrends(data.spendingTrends);
      setRecentTransactions(data.recentTransactions);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-6">
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!currentMonth) {
    return (
      <div className="p-4">
        <div className="bg-muted rounded-lg p-12 text-center">
          <p className="text-muted-foreground">No data available. Import some transactions to get started!</p>
        </div>
      </div>
    );
  }

  const calculatePercentChange = (current: number, previous: number): number | null => {
    if (previous === 0) return current !== 0 ? null : 0;
    return ((current - previous) / previous) * 100;
  };

  const incomeChange = previousMonth ? calculatePercentChange(currentMonth.income, previousMonth.income) : 0;
  const expenseChange = previousMonth ? calculatePercentChange(currentMonth.expenses, previousMonth.expenses) : 0;
  const netChange = previousMonth ? calculatePercentChange(currentMonth.net, previousMonth.net) : 0;

  const trendLineData = [
    {
      id: 'Income',
      color: '#10b981',
      data: trends.map((t) => ({ x: format(new Date(t.month + '-01'), 'MMM'), y: t.income })),
    },
    {
      id: 'Expenses',
      color: '#ef4444',
      data: trends.map((t) => ({ x: format(new Date(t.month + '-01'), 'MMM'), y: t.expenses })),
    },
  ];

  const pieData = topCategories.map((cat, i) => ({
    id: cat.category_name,
    label: cat.category_name,
    value: cat.amount,
    color: CHART_COLORS[i % CHART_COLORS.length],
    percentage: cat.percentage,
  }));

  const currentYear = format(new Date(), 'yyyy');
  const months = Array.from({ length: 12 }, (_, i) => {
    const monthNum = i + 1;
    const value = `${currentYear}-${monthNum.toString().padStart(2, '0')}`;
    return { value, label: format(new Date(currentYear, i, 1), 'MMM') };
  });

  return (
    <div className="flex flex-col h-full">
      {/* Month Tabs Header */}
      <div className="px-4 pt-4 flex-shrink-0">
        <Tabs value={selectedMonth} onValueChange={setSelectedMonth}>
          <TabsList className="w-full bg-muted">
            {months.map((month) => (
              <TabsTrigger key={month.value} value={month.value} className="flex-1 text-xs">
                {month.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 pt-4 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Income */}
          <div className="bg-card rounded-xl border border-border shadow-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-muted-foreground">Income</p>
              <div className="p-2 bg-success/10 rounded-lg">
                <TrendingUp className="w-5 h-5 text-success" />
              </div>
            </div>
            <p className="text-3xl font-bold text-foreground mb-2">
              ${currentMonth.income.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            {previousMonth && (
              <div className="flex items-center gap-1">
                {incomeChange === null ? (
                  <span className="text-sm font-medium text-muted-foreground">New data</span>
                ) : (
                  <>
                    {incomeChange >= 0 ? <ArrowUpRight className="w-4 h-4 text-success" /> : <ArrowDownRight className="w-4 h-4 text-destructive" />}
                    <span className={`text-sm font-medium ${incomeChange >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {Math.abs(incomeChange).toFixed(1)}% vs last month
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Expenses */}
          <div className="bg-card rounded-xl border border-border shadow-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-muted-foreground">Expenses</p>
              <div className="p-2 bg-destructive/10 rounded-lg">
                <TrendingDown className="w-5 h-5 text-destructive" />
              </div>
            </div>
            <p className="text-3xl font-bold text-foreground mb-2">
              ${currentMonth.expenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            {previousMonth && (
              <div className="flex items-center gap-1">
                {expenseChange === null ? (
                  <span className="text-sm font-medium text-muted-foreground">New data</span>
                ) : (
                  <>
                    {expenseChange >= 0 ? <ArrowUpRight className="w-4 h-4 text-destructive" /> : <ArrowDownRight className="w-4 h-4 text-success" />}
                    <span className={`text-sm font-medium ${expenseChange >= 0 ? 'text-destructive' : 'text-success'}`}>
                      {Math.abs(expenseChange).toFixed(1)}% vs last month
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Net */}
          <div className="bg-card rounded-xl border border-border shadow-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-muted-foreground">Net</p>
              <div className={`p-2 rounded-lg ${currentMonth.net >= 0 ? 'bg-success/10' : 'bg-destructive/10'}`}>
                <DollarSign className={`w-5 h-5 ${currentMonth.net >= 0 ? 'text-success' : 'text-destructive'}`} />
              </div>
            </div>
            <p className={`text-3xl font-bold mb-2 ${currentMonth.net >= 0 ? 'text-success' : 'text-destructive'}`}>
              {currentMonth.net >= 0 ? '+' : '-'}${Math.abs(currentMonth.net).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            {previousMonth && (
              <div className="flex items-center gap-1">
                {netChange === null ? (
                  <span className="text-sm font-medium text-muted-foreground">New data</span>
                ) : (
                  <>
                    {netChange >= 0 ? <ArrowUpRight className="w-4 h-4 text-success" /> : <ArrowDownRight className="w-4 h-4 text-destructive" />}
                    <span className={`text-sm font-medium ${netChange >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {Math.abs(netChange).toFixed(1)}% vs last month
                    </span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Spending Heatmap */}
        <SpendingHeatmap selectedMonth={selectedMonth} />

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SectionCard title="Spending Trends (6 Months)">
            <div style={{ height: 280 }}>
              <ResponsiveLine
                data={trendLineData}
                theme={nivoTheme}
                margin={{ top: 10, right: 16, bottom: 44, left: 60 }}
                xScale={{ type: 'point' }}
                yScale={{ type: 'linear', min: 0, max: 'auto', stacked: false }}
                curve="monotoneX"
                enableArea
                areaOpacity={0.08}
                colors={(d) => d.color}
                lineWidth={2.5}
                pointSize={6}
                pointColor={{ theme: 'background' }}
                pointBorderWidth={2}
                pointBorderColor={{ from: 'serieColor' }}
                enableGridX={false}
                axisLeft={{
                  tickSize: 0,
                  tickPadding: 8,
                  tickValues: 5,
                  format: (v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`,
                }}
                axisBottom={{ tickSize: 0, tickPadding: 8 }}
                useMesh
                tooltip={({ point }) => (
                  <div style={tooltipStyle}>
                    <span style={{ color: point.serieColor, marginRight: 6 }}>●</span>
                    <strong>{point.serieId}</strong>:{' '}
                    ${(point.data.y as number).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                )}
                legends={[{ anchor: 'bottom', direction: 'row', translateY: 40, itemWidth: 80, itemHeight: 14, symbolSize: 10, symbolShape: 'circle' }]}
              />
            </div>
          </SectionCard>

          <SectionCard title="Top Expense Categories">
            <div style={{ height: 280 }}>
              <ResponsivePie
                data={pieData}
                theme={nivoTheme}
                margin={{ top: 16, right: 16, bottom: 56, left: 16 }}
                innerRadius={0.6}
                padAngle={0.5}
                cornerRadius={3}
                colors={(d) => d.data.color}
                borderWidth={0}
                enableArcLabels={false}
                arcLinkLabelsSkipAngle={10}
                arcLinkLabelsTextColor="var(--muted-foreground)"
                arcLinkLabelsThickness={1}
                arcLinkLabelsColor={{ from: 'color' }}
                arcLinkLabel={(d) => `${(d.data as any).percentage.toFixed(1)}%`}
                tooltip={({ datum }) => (
                  <div style={tooltipStyle}>
                    <span style={{ color: datum.color, marginRight: 6 }}>●</span>
                    <strong>{datum.label}</strong>: ${datum.value.toFixed(2)}
                  </div>
                )}
                legends={[{ anchor: 'bottom', direction: 'row', translateY: 48, itemWidth: 90, itemHeight: 14, symbolSize: 10, symbolShape: 'circle' }]}
              />
            </div>
          </SectionCard>
        </div>

        {/* Recent Transactions */}
        <SectionCard title="Recent Transactions">
          <div className="divide-y divide-border">
            {recentTransactions.slice(0, 5).map((transaction) => {
              let dateDisplay = 'Invalid date';
              try {
                const parsed = parseISO(transaction.date);
                if (!isNaN(parsed.getTime())) dateDisplay = format(parsed, 'MMM d, yyyy');
              } catch (e) {}
              return (
                <div key={transaction.id} className="py-4 flex items-center justify-between hover:bg-muted/30 rounded px-2 -mx-2">
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{transaction.description}</p>
                    <p className="text-sm text-muted-foreground">
                      {dateDisplay} • {transaction.category_name || 'Uncategorized'}
                    </p>
                  </div>
                  <p className={`text-lg font-semibold ${transaction.type === 'income' ? 'text-success' : 'text-destructive'}`}>
                    {transaction.type === 'income' ? '+' : '-'}${transaction.amount.toFixed(2)}
                  </p>
                </div>
              );
            })}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
