import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, DollarSign, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { ResponsiveLine } from '@nivo/line';
import { ResponsivePie } from '@nivo/pie';
import { format, parseISO } from 'date-fns';
import { nivoTheme, CHART_COLORS, tooltipStyle } from '../lib/nivoTheme';
import { SunkenCard } from '@/components/ui/SunkenCard';
import { ChartEmpty } from '@/components/ui/ChartEmpty';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { FloatingBubbles } from '@/components/ui/FloatingBubbles';
import { EditTransactionDrawer } from '../components/transactions/EditTransactionDrawer';
import type { MonthlyStats, CategoryBreakdown, SpendingTrend, Transaction } from '../types';
import DailyPulse from '../components/dashboard/DailyPulse';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';

export default function Dashboard() {
  const [currentMonth, setCurrentMonth] = useState<MonthlyStats | null>(null);
  const [previousMonth, setPreviousMonth] = useState<MonthlyStats | null>(null);
  const [topCategories, setTopCategories] = useState<CategoryBreakdown[]>([]);
  const [trends, setTrends] = useState<SpendingTrend[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [isLoading, setIsLoading] = useState(true);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

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

  const calculatePercentChange = (current: number, previous: number): number | null => {
    if (previous === 0) return current !== 0 ? null : 0;
    return ((current - previous) / previous) * 100;
  };

  const incomeChange = currentMonth && previousMonth ? calculatePercentChange(currentMonth.income, previousMonth.income) : 0;
  const expenseChange = currentMonth && previousMonth ? calculatePercentChange(currentMonth.expenses, previousMonth.expenses) : 0;
  const netChange = currentMonth && previousMonth ? calculatePercentChange(currentMonth.net, previousMonth.net) : 0;

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
    <div className="relative flex flex-col h-full">
      {/* Month Tabs — always mounted so animation only plays once */}
      <div className="px-10 pt-8 flex-shrink-0">
        <SunkenCard className="p-1">
          <Tabs value={selectedMonth} onValueChange={setSelectedMonth}>
            <TabsList className="w-full bg-transparent">
              {months.map((month, i) => (
                <TabsTrigger
                  key={month.value}
                  value={month.value}
                  className="flex-1 text-xs"
                  style={{ animation: `bounce-up 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both`, animationDelay: `${i * 40}ms` }}
                >
                  {month.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </SunkenCard>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-10 pb-10 pt-8 space-y-8">

        {isLoading && (
          <div className="space-y-8">
            <div className="grid grid-cols-3 gap-8">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}
            </div>
            <Skeleton className="h-72" />
            <Skeleton className="h-40" />
            <Skeleton className="h-72" />
          </div>
        )}

        {!isLoading && !currentMonth && (
          <p className="text-muted-foreground text-center py-16">No data available. Import some transactions to get started!</p>
        )}

        {!isLoading && currentMonth && <>

        {/* Stats + Charts side by side */}
        <div className="flex gap-10 items-start">
          {/* Summary Stats — stacked vertically */}
          <div className="flex flex-col gap-11 flex-shrink-0 w-44">
            {/* Income */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-success" />
                <p className="text-sm text-muted-foreground">Income</p>
              </div>
              <p className="text-2xl font-semibold text-foreground tracking-tight">
                ${currentMonth.income.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              {previousMonth && incomeChange !== null && (
                <div className="flex items-center gap-1 mt-1">
                  {incomeChange >= 0
                    ? <ArrowUpRight className="w-3.5 h-3.5 text-success" />
                    : <ArrowDownRight className="w-3.5 h-3.5 text-destructive" />}
                  <span className={`text-xs ${incomeChange >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {Math.abs(incomeChange).toFixed(1)}% vs last month
                  </span>
                </div>
              )}
            </div>

            {/* Expenses */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="w-4 h-4 text-destructive" />
                <p className="text-sm text-muted-foreground">Expenses</p>
              </div>
              <p className="text-2xl font-semibold text-foreground tracking-tight">
                ${currentMonth.expenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              {previousMonth && expenseChange !== null && (
                <div className="flex items-center gap-1 mt-1">
                  {expenseChange >= 0
                    ? <ArrowUpRight className="w-3.5 h-3.5 text-destructive" />
                    : <ArrowDownRight className="w-3.5 h-3.5 text-success" />}
                  <span className={`text-xs ${expenseChange >= 0 ? 'text-destructive' : 'text-success'}`}>
                    {Math.abs(expenseChange).toFixed(1)}% vs last month
                  </span>
                </div>
              )}
            </div>

            {/* Net */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-4 h-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Net</p>
              </div>
              <p className={`text-2xl font-semibold tracking-tight ${currentMonth.net >= 0 ? 'text-success' : 'text-destructive'}`}>
                {currentMonth.net >= 0 ? '+' : '-'}${Math.abs(currentMonth.net).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              {previousMonth && netChange !== null && (
                <div className="flex items-center gap-1 mt-1">
                  {netChange >= 0
                    ? <ArrowUpRight className="w-3.5 h-3.5 text-success" />
                    : <ArrowDownRight className="w-3.5 h-3.5 text-destructive" />}
                  <span className={`text-xs ${netChange >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {Math.abs(netChange).toFixed(1)}% vs last month
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Charts */}
          <div className="flex-1 min-w-0 grid grid-cols-1 lg:grid-cols-2 gap-10">
            <SunkenCard title="Spending Trends">
              <div key={selectedMonth} style={{ height: 260 }} className="animate-in fade-in slide-in-from-bottom-3 duration-500">
                {trends.length < 2
                  ? <ChartEmpty />
                  : <ResponsiveLine
                  key={selectedMonth}
                  data={trendLineData}
                  theme={nivoTheme}
                  margin={{ top: 10, right: 16, bottom: 16, left: 16 }}
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
                  animate
                  motionConfig="gentle"
                  axisLeft={null}
                  axisBottom={null}
                  useMesh
                  tooltip={({ point }) => (
                    <div style={tooltipStyle}>
                      <span style={{ color: point.serieColor, marginRight: 6 }}>●</span>
                      <strong>{point.serieId}</strong>:{' '}
                      ${(point.data.y as number).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  )}
                  legends={[{ anchor: 'bottom', direction: 'row', translateY: 40, itemWidth: 80, itemHeight: 14, symbolSize: 10, symbolShape: 'circle' }]}
                />}
              </div>
            </SunkenCard>

            <SunkenCard title="Top Categories">
              <div key={selectedMonth} style={{ height: 260 }} className="animate-in fade-in slide-in-from-bottom-3 duration-700">
                {pieData.length === 0
                  ? <ChartEmpty />
                  : <ResponsivePie
                  key={selectedMonth}
                  data={pieData}
                  theme={nivoTheme}
                  margin={{ top: 16, right: 110, bottom: 16, left: 16 }}
                  innerRadius={0.6}
                  padAngle={0.5}
                  cornerRadius={3}
                  colors={(d) => d.data.color}
                  borderWidth={0}
                  animate
                  motionConfig="gentle"
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
                  legends={[{ anchor: 'right', direction: 'column', translateX: 100, translateY: 0, itemWidth: 90, itemHeight: 18, itemsSpacing: 6, symbolSize: 10, symbolShape: 'circle' }]}
                />}
              </div>
            </SunkenCard>
          </div>
        </div>


        {/* Daily Spending Activity */}
        <SunkenCard title="Daily Pulse" className="relative overflow-hidden px-0 pb-0 bg-gradient-to-t from-primary/20 via-primary/5 via-25% to-black/10">
          <FloatingBubbles />
          <DailyPulse selectedMonth={selectedMonth} />
        </SunkenCard>


        {/* Recent Transactions — plain list */}
        <div>
          <SectionLabel>Recent Transactions</SectionLabel>
          <div className="divide-y divide-border/25">
            {recentTransactions.slice(0, 5).map((transaction) => {
              let dateDisplay = 'Invalid date';
              try {
                const parsed = parseISO(transaction.date);
                if (!isNaN(parsed.getTime())) dateDisplay = format(parsed, 'MMM d, yyyy');
              } catch (e) {}
              return (
                <div key={transaction.id} className="py-3 flex items-center justify-between hover:bg-muted/20 rounded-md px-2 -mx-2 transition-colors cursor-pointer" onClick={() => setEditingTransaction(transaction)}>
                  <div className="flex-1">
                    <p className="font-medium text-foreground text-sm">{transaction.description}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {dateDisplay} · {transaction.category_name || 'Uncategorized'}
                    </p>
                  </div>
                  <p className={`text-sm font-semibold ${transaction.type === 'income' ? 'text-success' : 'text-foreground'}`}>
                    {transaction.type === 'income' ? '+' : '-'}${transaction.amount.toFixed(2)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        </>}

      </div>

      <EditTransactionDrawer
        transaction={editingTransaction}
        onClose={() => setEditingTransaction(null)}
        onSaved={loadDashboardData}
      />
    </div>
  );
}
