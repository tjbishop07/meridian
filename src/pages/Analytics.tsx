import { useEffect, useState } from 'react';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { SpendingTrend, CategoryBreakdown } from '../types';

const COLORS = ['#0ea5e9', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#6366f1', '#14b8a6', '#f97316', '#a855f7'];

export default function Analytics() {
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

  // Calculate summary stats from trends
  const avgIncome = trends.length > 0 ? trends.reduce((s, t) => s + t.income, 0) / trends.length : 0;
  const avgExpenses = trends.length > 0 ? trends.reduce((s, t) => s + t.expenses, 0) / trends.length : 0;
  const avgSavings = avgIncome - avgExpenses;
  const savingsRate = avgIncome > 0 ? (avgSavings / avgIncome) * 100 : 0;

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-base-300 rounded w-48"></div>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-base-300 rounded"></div>
            ))}
          </div>
          <div className="h-80 bg-base-300 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 flex-shrink-0">
        <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-3xl font-bold text-base-content">Analytics</h1>
          <p className="text-base-content/70 mt-1">Detailed financial analysis and trends</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={trendMonths}
            onChange={(e) => setTrendMonths(Number(e.target.value))}
            className="px-3 py-2 border border-base-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm"
          >
            <option value={6}>Last 6 months</option>
            <option value={12}>Last 12 months</option>
            <option value={24}>Last 24 months</option>
          </select>
        </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {/* Average Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-base-100 rounded-lg shadow-sm p-5">
          <p className="text-sm text-base-content/70 mb-1">Avg Monthly Income</p>
          <p className="text-2xl font-bold text-green-600">${avgIncome.toFixed(2)}</p>
        </div>
        <div className="bg-base-100 rounded-lg shadow-sm p-5">
          <p className="text-sm text-base-content/70 mb-1">Avg Monthly Expenses</p>
          <p className="text-2xl font-bold text-red-600">${avgExpenses.toFixed(2)}</p>
        </div>
        <div className="bg-base-100 rounded-lg shadow-sm p-5">
          <p className="text-sm text-base-content/70 mb-1">Avg Monthly Savings</p>
          <p className={`text-2xl font-bold ${avgSavings >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
            ${Math.abs(avgSavings).toFixed(2)}
          </p>
        </div>
        <div className="bg-base-100 rounded-lg shadow-sm p-5">
          <p className="text-sm text-base-content/70 mb-1">Savings Rate</p>
          <p className={`text-2xl font-bold ${savingsRate >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
            {savingsRate.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Income vs Expenses Area Chart */}
      <div className="bg-base-100 rounded-lg shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-base-content mb-4">Income vs Expenses Over Time</h2>
        <ResponsiveContainer width="100%" height={350}>
          <AreaChart data={trends}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
            <Legend />
            <Area
              type="monotone"
              dataKey="income"
              stroke="#10b981"
              fill="#10b981"
              fillOpacity={0.1}
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="expenses"
              stroke="#ef4444"
              fill="#ef4444"
              fillOpacity={0.1}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Net Savings Bar Chart */}
      <div className="bg-base-100 rounded-lg shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-base-content mb-4">Monthly Net Savings</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={trends}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
            <Bar dataKey="net" fill="#6366f1">
              {trends.map((entry, index) => (
                <Cell key={index} fill={entry.net >= 0 ? '#10b981' : '#ef4444'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Category Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Expense Categories */}
        <div className="bg-base-100 rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-base-content">Expense Categories</h2>
            <div className="flex gap-2">
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="px-2 py-1 border border-base-300 rounded text-xs"
              />
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="px-2 py-1 border border-base-300 rounded text-xs"
              />
            </div>
          </div>
          {expenseCategories.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={expenseCategories}
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    fill="#8884d8"
                    dataKey="amount"
                    labelLine={false}
                  >
                    {expenseCategories.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => `$${value.toFixed(2)}`}
                    labelFormatter={(_, payload) =>
                      payload?.[0]?.payload?.category_name || ''
                    }
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 space-y-2">
                {expenseCategories.slice(0, 8).map((cat, i) => (
                  <div key={cat.category_id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: COLORS[i % COLORS.length] }}
                      />
                      <span className="text-base-content/80">{cat.category_name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-base-content/60">{cat.percentage.toFixed(1)}%</span>
                      <span className="font-medium text-base-content">${cat.amount.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-base-content/60 text-center py-12">No expense data for this period</p>
          )}
        </div>

        {/* Income Categories */}
        <div className="bg-base-100 rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-base-content mb-4">Income Categories</h2>
          {incomeCategories.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={incomeCategories}
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    fill="#8884d8"
                    dataKey="amount"
                    labelLine={false}
                  >
                    {incomeCategories.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => `$${value.toFixed(2)}`}
                    labelFormatter={(_, payload) =>
                      payload?.[0]?.payload?.category_name || ''
                    }
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 space-y-2">
                {incomeCategories.slice(0, 8).map((cat, i) => (
                  <div key={cat.category_id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: COLORS[i % COLORS.length] }}
                      />
                      <span className="text-base-content/80">{cat.category_name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-base-content/60">{cat.percentage.toFixed(1)}%</span>
                      <span className="font-medium text-base-content">${cat.amount.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-base-content/60 text-center py-12">No income data for this period</p>
          )}
        </div>
      </div>

      {/* Monthly Comparison Table */}
      <div className="bg-base-100 rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-semibold text-base-content mb-4">Monthly Comparison</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-base-300">
                <th className="text-left py-3 px-4 font-semibold text-base-content/70">Month</th>
                <th className="text-right py-3 px-4 font-semibold text-base-content/70">Income</th>
                <th className="text-right py-3 px-4 font-semibold text-base-content/70">Expenses</th>
                <th className="text-right py-3 px-4 font-semibold text-base-content/70">Net</th>
                <th className="text-right py-3 px-4 font-semibold text-base-content/70">Savings Rate</th>
              </tr>
            </thead>
            <tbody>
              {[...trends].reverse().map((month) => {
                const rate = month.income > 0 ? ((month.net / month.income) * 100) : 0;
                return (
                  <tr key={month.month} className="border-b border-base-200 hover:bg-base-200">
                    <td className="py-3 px-4 font-medium text-base-content">{month.month}</td>
                    <td className="py-3 px-4 text-right text-green-600">${month.income.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right text-red-600">${month.expenses.toFixed(2)}</td>
                    <td className={`py-3 px-4 text-right font-semibold ${month.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ${month.net.toFixed(2)}
                    </td>
                    <td className={`py-3 px-4 text-right ${rate >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                      {rate.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      </div>
    </div>
  );
}
