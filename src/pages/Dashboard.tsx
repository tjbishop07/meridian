import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, DollarSign, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { ResponsiveBar } from '@nivo/bar';
import { ResponsivePie } from '@nivo/pie';
import { format, parseISO } from 'date-fns';
import { nivoTheme, CHART_COLORS, tooltipStyle } from '../lib/nivoTheme';
import { SunkenCard } from '@/components/ui/SunkenCard';
import { ChartEmpty } from '@/components/ui/ChartEmpty';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { FloatingBubbles } from '@/components/ui/FloatingBubbles';
import { EditTransactionDrawer } from '../components/transactions/EditTransactionDrawer';
import type { MonthlyStats, CategoryBreakdown, Transaction } from '../types';
import DailyPulse from '../components/dashboard/DailyPulse';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { PageSidebar } from '@/components/ui/PageSidebar';
import { usePageEntrance } from '../hooks/usePageEntrance';
import { useCountUp } from '../hooks/useCountUp';
import { cn } from '@/lib/utils';

export default function Dashboard() {
  const { sidebarClass, contentClass } = usePageEntrance();
  const [currentMonth, setCurrentMonth] = useState<MonthlyStats | null>(null);
  const [previousMonth, setPreviousMonth] = useState<MonthlyStats | null>(null);
  const [topCategories, setTopCategories] = useState<CategoryBreakdown[]>([]);
  const [prevCategories, setPrevCategories] = useState<CategoryBreakdown[]>([]);
  const [topTransactions, setTopTransactions] = useState<Transaction[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [isLoading, setIsLoading] = useState(true);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [disabledCategories, setDisabledCategories] = useState<Set<string>>(new Set());

  const toggleCategory = (name: string) => {
    setDisabledCategories(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

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
      setPrevCategories(data.prevMonthCategories);
      setTopTransactions(data.topTransactions);
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

  const animatedIncome = useCountUp(currentMonth?.income ?? 0);
  const animatedExpenses = useCountUp(currentMonth?.expenses ?? 0);
  const animatedNet = useCountUp(currentMonth?.net ?? 0);

  const categoryComparisonData = [...topCategories]
    .slice(0, 5)
    .map((cat) => {
      const prev = prevCategories.find((p) => p.category_name === cat.category_name);
      const name = cat.category_name.length > 10 ? cat.category_name.slice(0, 9) + '…' : cat.category_name;
      return { category: name, 'This Month': cat.amount, 'Last Month': prev?.amount ?? 0 };
    })
    .reverse();

  const pieData = topCategories.map((cat, i) => ({
    id: cat.category_name,
    label: cat.category_name,
    value: cat.amount,
    color: CHART_COLORS[i % CHART_COLORS.length],
    percentage: cat.percentage,
  }));

  const activePieData = pieData.filter(d => !disabledCategories.has(d.id));

  const currentYear = format(new Date(), 'yyyy');
  const currentMonthStr = format(new Date(), 'yyyy-MM');
  const months = Array.from({ length: 12 }, (_, i) => {
    const monthNum = i + 1;
    const value = `${currentYear}-${monthNum.toString().padStart(2, '0')}`;
    return { value, label: format(new Date(currentYear, i, 1), 'MMM'), isFuture: value > currentMonthStr };
  });

  return (
    <div className="flex h-full relative overflow-hidden">
      <PageSidebar title="Dashboard" className={sidebarClass}>
        <div className="px-4 pt-4 pb-4 space-y-8 border-t border-border/40">
          {isLoading ? (
            <div className="space-y-5 pt-1">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : currentMonth ? (
            <>
              {/* Income */}
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingUp className="w-3.5 h-3.5 text-success" />
                  <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground/50">Income</p>
                </div>
                <p className="text-xl font-semibold text-foreground tracking-tight">
                  ${animatedIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                {previousMonth && incomeChange !== null && (
                  <div className="flex items-center gap-1 mt-0.5">
                    {incomeChange >= 0
                      ? <ArrowUpRight className="w-3 h-3 text-success" />
                      : <ArrowDownRight className="w-3 h-3 text-destructive" />}
                    <span className={`text-[10px] ${incomeChange >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {Math.abs(incomeChange).toFixed(1)}% vs last month
                    </span>
                  </div>
                )}
              </div>

              {/* Expenses */}
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingDown className="w-3.5 h-3.5 text-destructive" />
                  <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground/50">Expenses</p>
                </div>
                <p className="text-xl font-semibold text-foreground tracking-tight">
                  ${animatedExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                {previousMonth && expenseChange !== null && (
                  <div className="flex items-center gap-1 mt-0.5">
                    {expenseChange >= 0
                      ? <ArrowUpRight className="w-3 h-3 text-destructive" />
                      : <ArrowDownRight className="w-3 h-3 text-success" />}
                    <span className={`text-[10px] ${expenseChange >= 0 ? 'text-destructive' : 'text-success'}`}>
                      {Math.abs(expenseChange).toFixed(1)}% vs last month
                    </span>
                  </div>
                )}
              </div>

              {/* Net */}
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
                  <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground/50">Net</p>
                </div>
                <p className={`text-xl font-semibold tracking-tight ${currentMonth.net >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {currentMonth.net >= 0 ? '+' : '-'}${Math.abs(animatedNet).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                {previousMonth && netChange !== null && (
                  <div className="flex items-center gap-1 mt-0.5">
                    {netChange >= 0
                      ? <ArrowUpRight className="w-3 h-3 text-success" />
                      : <ArrowDownRight className="w-3 h-3 text-destructive" />}
                    <span className={`text-[10px] ${netChange >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {Math.abs(netChange).toFixed(1)}% vs last month
                    </span>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </PageSidebar>

      <div className={cn('flex-1 flex flex-col overflow-hidden', contentClass)}>
      {/* Month Tabs — always mounted so animation only plays once */}
      <div className="px-6 pt-5 flex-shrink-0">
        <SunkenCard className="p-1">
          <Tabs value={selectedMonth} onValueChange={setSelectedMonth}>
            <TabsList className="w-full bg-transparent">
              {months.map((month, i) => {
                const isActive = selectedMonth === month.value;
                return (
                  <TabsTrigger
                    key={month.value}
                    value={month.value}
                    disabled={month.isFuture}
                    className={cn('flex-1 text-sm relative', month.isFuture && 'cursor-not-allowed')}
                    style={{
                      animation: `bounce-up 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both`,
                      animationDelay: `${i * 40}ms`,
                      ...(month.isFuture && { opacity: 0.15 }),
                      ...(isActive && { background: 'transparent', borderColor: 'transparent', color: 'var(--color-primary)', fontWeight: 600 }),
                    }}
                  >
                    {month.label}
                    {isActive && (
                      <span
                        className="pointer-events-none absolute bottom-0.5 left-1/2 -translate-x-1/2 rounded-full"
                        style={{
                          width: '20px',
                          height: '2px',
                          background: 'var(--color-primary)',
                        }}
                      />
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
        </SunkenCard>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-6 pb-6 pt-5 space-y-8">

        {isLoading && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              <Skeleton className="h-72" />
              <Skeleton className="h-72" />
            </div>
            <Skeleton className="h-40" />
            <Skeleton className="h-72" />
          </div>
        )}

        {!isLoading && !currentMonth && (
          <p className="text-muted-foreground text-center py-16">No data available. Import some transactions to get started!</p>
        )}

        {!isLoading && currentMonth && <>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <SunkenCard title="vs Last Month">
              <div key={selectedMonth} style={{ height: 260 }} className="animate-in fade-in slide-in-from-bottom-3 duration-500">
                {categoryComparisonData.length === 0
                  ? <ChartEmpty />
                  : <ResponsiveBar
                  key={selectedMonth}
                  data={categoryComparisonData}
                  keys={['This Month', 'Last Month']}
                  indexBy="category"
                  layout="vertical"
                  groupMode="grouped"
                  theme={nivoTheme}
                  margin={{ top: 10, right: 16, bottom: 10, left: 16 }}
                  colors={['var(--color-primary)', 'var(--color-muted-foreground)']}
                  colorBy="id"
                  borderRadius={2}
                  padding={0.3}
                  innerPadding={3}
                  enableGridX={false}
                  enableGridY={false}
                  axisLeft={null}
                  axisBottom={null}
                  enableLabel={false}
                  animate
                  motionConfig="gentle"
                  tooltip={({ id, value, color, indexValue }) => (
                    <div style={tooltipStyle}>
                      <span style={{ color, marginRight: 6 }}>●</span>
                      <strong>{indexValue}</strong> · {id}: ${(value as number).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  )}
                />}
              </div>
            </SunkenCard>

            <SunkenCard title="Top Categories">
              <div key={selectedMonth} className="animate-in fade-in slide-in-from-bottom-3 duration-700">
                <div style={{ height: 220 }}>
                  {pieData.length === 0
                    ? <ChartEmpty />
                    : activePieData.length === 0
                    ? <div className="h-full flex items-center justify-center text-sm text-muted-foreground">All categories hidden</div>
                    : <ResponsivePie
                    data={activePieData}
                    theme={nivoTheme}
                    margin={{ top: 16, right: 16, bottom: 16, left: 16 }}
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
                  />}
                </div>
                {pieData.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-1.5 px-2 pb-3 pt-1">
                    {pieData.map((item) => {
                      const isDisabled = disabledCategories.has(item.id);
                      return (
                        <button
                          key={item.id}
                          onClick={() => toggleCategory(item.id)}
                          className={cn(
                            'flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border transition-all',
                            isDisabled
                              ? 'border-border/30 text-muted-foreground/40 opacity-40'
                              : 'border-border/60 text-foreground hover:border-border'
                          )}
                        >
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0 transition-colors"
                            style={{ background: isDisabled ? 'var(--muted-foreground)' : item.color }}
                          />
                          {item.id}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </SunkenCard>
        </div>


        {/* Daily Spending Activity */}
        <SunkenCard title="Daily Pulse" className="relative overflow-hidden px-0 pb-0 bg-gradient-to-t from-primary/20 via-primary/5 via-25% to-black/10">
          <FloatingBubbles />
          <DailyPulse selectedMonth={selectedMonth} />
        </SunkenCard>


        {/* Bottom two-column: Biggest + Recent */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">

          {/* Biggest Transactions */}
          <div>
            <SectionLabel>Biggest Transactions</SectionLabel>
            <div className="divide-y divide-border/25">
              {topTransactions.length === 0
                ? <p className="text-sm text-muted-foreground py-4">No transactions this month.</p>
                : topTransactions.map((t, i) => {
                  let dateDisplay = '';
                  try {
                    const parsed = parseISO(t.date);
                    if (!isNaN(parsed.getTime())) dateDisplay = format(parsed, 'MMM d');
                  } catch (e) {}
                  return (
                    <div key={t.id} className="py-3 flex items-center gap-3 hover:bg-muted/20 rounded-md px-2 -mx-2 transition-colors cursor-pointer" onClick={() => setEditingTransaction(t)}>
                      <span className="text-xs font-bold text-muted-foreground/40 w-4 shrink-0 text-right">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground text-sm truncate">{t.description}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{dateDisplay} · {(t as any).category_name || 'Uncategorized'}</p>
                      </div>
                      <p className="text-sm font-semibold text-foreground shrink-0">${t.amount.toFixed(2)}</p>
                    </div>
                  );
                })
              }
            </div>
          </div>

          {/* Recent Transactions */}
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
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground text-sm truncate">{transaction.description}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {dateDisplay} · {transaction.category_name || 'Uncategorized'}
                      </p>
                    </div>
                    <p className={`text-sm font-semibold shrink-0 ml-3 ${transaction.type === 'income' ? 'text-success' : 'text-foreground'}`}>
                      {transaction.type === 'income' ? '+' : '-'}${transaction.amount.toFixed(2)}
                    </p>
                  </div>
                );
              })}
            </div>
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
    </div>
  );
}
