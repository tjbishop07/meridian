import { useEffect, useState } from 'react';
import { format, subMonths } from 'date-fns';
import { ResponsiveLine } from '@nivo/line';
import { ResponsiveBar } from '@nivo/bar';
import { ResponsivePie } from '@nivo/pie';
import type { SpendingTrend, CategoryBreakdown } from '../types';
import { nivoTheme, CHART_COLORS, tooltipStyle } from '../lib/nivoTheme';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { SectionCard } from '@/components/ui/SectionCard';
import { Skeleton } from '@/components/ui/skeleton';
import { PageSidebar } from '@/components/ui/PageSidebar';
import { usePageEntrance } from '../hooks/usePageEntrance';
import { cn } from '@/lib/utils';

export default function Analytics() {
  const { sidebarClass, contentClass } = usePageEntrance();
  const [trends, setTrends] = useState<SpendingTrend[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<CategoryBreakdown[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<CategoryBreakdown[]>([]);
  const [trendMonths, setTrendMonths] = useState(12);
  const [isLoading, setIsLoading] = useState(true);

  const [dateRange, setDateRange] = useState({
    start: format(subMonths(new Date(), 6), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd'),
  });

  useEffect(() => {
    loadTrends();
  }, [trendMonths]);

  useEffect(() => {
    loadCategoryBreakdowns();
  }, [dateRange]);

  const loadTrends = async () => {
    try {
      setIsLoading(true);
      const data = await window.electron.invoke('analytics:spending-trends', trendMonths);
      setTrends(data);
    } catch (err) {
      console.error('Error loading trends:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadCategoryBreakdowns = async () => {
    try {
      const [expenses, income] = await Promise.all([
        window.electron.invoke('analytics:category-breakdown', {
          start_date: dateRange.start,
          end_date: dateRange.end,
          type: 'expense',
        }),
        window.electron.invoke('analytics:category-breakdown', {
          start_date: dateRange.start,
          end_date: dateRange.end,
          type: 'income',
        }),
      ]);
      setExpenseCategories(expenses);
      setIncomeCategories(income);
    } catch (err) {
      console.error('Error loading category breakdowns:', err);
    }
  };

  const avgIncome = trends.length > 0 ? trends.reduce((s, t) => s + t.income, 0) / trends.length : 0;
  const avgExpenses = trends.length > 0 ? trends.reduce((s, t) => s + t.expenses, 0) / trends.length : 0;
  const avgSavings = avgIncome - avgExpenses;
  const savingsRate = avgIncome > 0 ? (avgSavings / avgIncome) * 100 : 0;

  if (isLoading) {
    return (
      <div className="p-4 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <PageSidebar title="Analytics" className={sidebarClass}>
        <div className="px-4 pt-4 pb-3">
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground/35 mb-2">
            Period
          </p>
          <Select value={String(trendMonths)} onValueChange={(v) => setTrendMonths(Number(v))}>
            <SelectTrigger className="h-8 text-xs w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="6">Last 6 months</SelectItem>
              <SelectItem value="12">Last 12 months</SelectItem>
              <SelectItem value="24">Last 24 months</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </PageSidebar>

      <div className={cn('flex-1 flex flex-col overflow-hidden', contentClass)}>
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-10 pt-8 pb-10 space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-card rounded-xl border border-border shadow-sm p-5">
            <p className="text-sm text-muted-foreground mb-1">Avg Monthly Income</p>
            <p className="text-2xl font-bold text-success">${avgIncome.toFixed(2)}</p>
          </div>
          <div className="bg-card rounded-xl border border-border shadow-sm p-5">
            <p className="text-sm text-muted-foreground mb-1">Avg Monthly Expenses</p>
            <p className="text-2xl font-bold text-destructive">${avgExpenses.toFixed(2)}</p>
          </div>
          <div className="bg-card rounded-xl border border-border shadow-sm p-5">
            <p className="text-sm text-muted-foreground mb-1">Avg Monthly Savings</p>
            <p className={`text-2xl font-bold ${avgSavings >= 0 ? 'text-primary' : 'text-destructive'}`}>
              ${Math.abs(avgSavings).toFixed(2)}
            </p>
          </div>
          <div className="bg-card rounded-xl border border-border shadow-sm p-5">
            <p className="text-sm text-muted-foreground mb-1">Savings Rate</p>
            <p className={`text-2xl font-bold ${savingsRate >= 0 ? 'text-primary' : 'text-destructive'}`}>
              {savingsRate.toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Income vs Expenses Line Chart */}
        <SectionCard title="Income vs Expenses Over Time">
          <div style={{ height: 320 }}>
            <ResponsiveLine
              data={[
                {
                  id: 'Income',
                  color: '#10b981',
                  data: trends.map((t) => ({
                    x: format(new Date(t.month + '-01'), trendMonths >= 24 ? 'MMM yy' : 'MMM'),
                    y: t.income,
                  })),
                },
                {
                  id: 'Expenses',
                  color: '#ef4444',
                  data: trends.map((t) => ({
                    x: format(new Date(t.month + '-01'), trendMonths >= 24 ? 'MMM yy' : 'MMM'),
                    y: t.expenses,
                  })),
                },
              ]}
              theme={nivoTheme}
              margin={{ top: 10, right: 16, bottom: 48, left: 64 }}
              xScale={{ type: 'point' }}
              yScale={{ type: 'linear', min: 0, max: 'auto', stacked: false }}
              curve="monotoneX"
              enableArea
              areaOpacity={0.08}
              colors={(d) => d.color}
              lineWidth={2.5}
              pointSize={5}
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
                  <span style={{ color: point.seriesColor, marginRight: 6 }}>●</span>
                  <strong>{point.seriesId}</strong>:{' '}
                  ${(point.data.y as number).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              )}
              legends={[{
                anchor: 'bottom',
                direction: 'row',
                translateY: 44,
                itemWidth: 80,
                itemHeight: 14,
                symbolSize: 10,
                symbolShape: 'circle',
              }]}
            />
          </div>
        </SectionCard>

        {/* Net Savings Bar Chart */}
        <SectionCard title="Monthly Net Savings">
          <div style={{ height: 280 }}>
            <ResponsiveBar
              data={trends.map((t) => ({
                month: format(new Date(t.month + '-01'), trendMonths >= 24 ? 'MMM yy' : 'MMM'),
                net: t.net,
              }))}
              theme={nivoTheme}
              keys={['net']}
              indexBy="month"
              margin={{ top: 10, right: 16, bottom: 44, left: 64 }}
              padding={0.35}
              colors={({ data }) => (data['net'] as number) >= 0 ? '#10b981' : '#ef4444'}
              enableLabel={false}
              enableGridX={false}
              borderRadius={3}
              axisLeft={{
                tickSize: 0,
                tickPadding: 8,
                tickValues: 5,
                format: (v) => `$${Math.abs(v) >= 1000 ? `${(Math.abs(v) / 1000).toFixed(0)}k` : v}`,
              }}
              axisBottom={{ tickSize: 0, tickPadding: 8 }}
              tooltip={({ value, color }) => (
                <div style={tooltipStyle}>
                  <span style={{ color, marginRight: 6 }}>●</span>
                  Net: ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              )}
            />
          </div>
        </SectionCard>

        {/* Category Breakdowns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Expense Categories */}
          <SectionCard
            title="Expense Categories"
            action={
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                  className="h-7 text-xs px-2 py-1 w-36"
                />
                <Input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                  className="h-7 text-xs px-2 py-1 w-36"
                />
              </div>
            }
          >
            {expenseCategories.length > 0 ? (
              <>
                <div style={{ height: 220 }}>
                  <ResponsivePie
                    data={expenseCategories.map((cat, i) => ({
                      id: cat.category_name,
                      label: cat.category_name,
                      value: cat.amount,
                      color: CHART_COLORS[i % CHART_COLORS.length],
                      percentage: cat.percentage,
                    }))}
                    theme={nivoTheme}
                    margin={{ top: 12, right: 12, bottom: 12, left: 12 }}
                    innerRadius={0.6}
                    padAngle={0.5}
                    cornerRadius={3}
                    colors={(d) => d.data.color}
                    borderWidth={0}
                    enableArcLabels={false}
                    enableArcLinkLabels={false}
                    tooltip={({ datum }) => (
                      <div style={tooltipStyle}>
                        <span style={{ color: datum.color, marginRight: 6 }}>●</span>
                        <strong>{datum.label}</strong>: ${datum.value.toFixed(2)} ({(datum.data as any).percentage.toFixed(1)}%)
                      </div>
                    )}
                  />
                </div>
                <div className="mt-4 space-y-2">
                  {expenseCategories.slice(0, 8).map((cat, i) => (
                    <div key={cat.category_id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                        <span className="text-foreground/80">{cat.category_name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground">{cat.percentage.toFixed(1)}%</span>
                        <span className="font-medium text-foreground">${cat.amount.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-muted-foreground text-center py-12">No expense data for this period</p>
            )}
          </SectionCard>

          {/* Income Categories */}
          <SectionCard title="Income Categories">
            {incomeCategories.length > 0 ? (
              <>
                <div style={{ height: 220 }}>
                  <ResponsivePie
                    data={incomeCategories.map((cat, i) => ({
                      id: cat.category_name,
                      label: cat.category_name,
                      value: cat.amount,
                      color: CHART_COLORS[i % CHART_COLORS.length],
                      percentage: cat.percentage,
                    }))}
                    theme={nivoTheme}
                    margin={{ top: 12, right: 12, bottom: 12, left: 12 }}
                    innerRadius={0.6}
                    padAngle={0.5}
                    cornerRadius={3}
                    colors={(d) => d.data.color}
                    borderWidth={0}
                    enableArcLabels={false}
                    enableArcLinkLabels={false}
                    tooltip={({ datum }) => (
                      <div style={tooltipStyle}>
                        <span style={{ color: datum.color, marginRight: 6 }}>●</span>
                        <strong>{datum.label}</strong>: ${datum.value.toFixed(2)} ({(datum.data as any).percentage.toFixed(1)}%)
                      </div>
                    )}
                  />
                </div>
                <div className="mt-4 space-y-2">
                  {incomeCategories.slice(0, 8).map((cat, i) => (
                    <div key={cat.category_id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                        <span className="text-foreground/80">{cat.category_name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground">{cat.percentage.toFixed(1)}%</span>
                        <span className="font-medium text-foreground">${cat.amount.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-muted-foreground text-center py-12">No income data for this period</p>
            )}
          </SectionCard>
        </div>

        {/* Monthly Comparison Table */}
        <SectionCard title="Monthly Comparison">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Month</th>
                  <th className="text-right py-3 px-4 font-semibold text-muted-foreground">Income</th>
                  <th className="text-right py-3 px-4 font-semibold text-muted-foreground">Expenses</th>
                  <th className="text-right py-3 px-4 font-semibold text-muted-foreground">Net</th>
                  <th className="text-right py-3 px-4 font-semibold text-muted-foreground">Savings Rate</th>
                </tr>
              </thead>
              <tbody>
                {[...trends].reverse().map((month) => {
                  const rate = month.income > 0 ? ((month.net / month.income) * 100) : 0;
                  return (
                    <tr key={month.month} className="border-b border-border/50 hover:bg-muted/50">
                      <td className="py-3 px-4 font-medium text-foreground">{month.month}</td>
                      <td className="py-3 px-4 text-right text-success">${month.income.toFixed(2)}</td>
                      <td className="py-3 px-4 text-right text-destructive">${month.expenses.toFixed(2)}</td>
                      <td className={`py-3 px-4 text-right font-semibold ${month.net >= 0 ? 'text-success' : 'text-destructive'}`}>
                        ${month.net.toFixed(2)}
                      </td>
                      <td className={`py-3 px-4 text-right ${rate >= 0 ? 'text-primary' : 'text-destructive'}`}>
                        {rate.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>
      </div>
    </div>
  );
}
