import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, DollarSign, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { format, startOfMonth, subMonths, parseISO } from 'date-fns';
import type { MonthlyStats, CategoryBreakdown, SpendingTrend, Transaction } from '../types';
import SpendingHeatmap from '../components/dashboard/SpendingHeatmap';

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
      <div className="p-4">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-base-300 rounded w-48"></div>
          <div className="grid grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-base-300 rounded"></div>
            ))}
          </div>
          <div className="h-96 bg-base-300 rounded"></div>
        </div>
      </div>
    );
  }

  if (!currentMonth) {
    return (
      <div className="p-4">
        <h1 className="text-3xl font-bold text-base-content mb-6">Dashboard</h1>
        <div className="bg-base-200 rounded-lg p-12 text-center">
          <p className="text-base-content/70">No data available. Import some transactions to get started!</p>
        </div>
      </div>
    );
  }

  const incomeChange = previousMonth
    ? ((currentMonth.income - previousMonth.income) / previousMonth.income) * 100
    : 0;

  const expenseChange = previousMonth
    ? ((currentMonth.expenses - previousMonth.expenses) / previousMonth.expenses) * 100
    : 0;

  const netChange = previousMonth
    ? ((currentMonth.net - previousMonth.net) / previousMonth.net) * 100
    : 0;

  // Colors for pie chart
  const COLORS = ['#0ea5e9', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444'];

  // Generate all months for current year
  const currentYear = format(new Date(), 'yyyy');
  const selectedMonthIndex = parseInt(selectedMonth.split('-')[1]) - 1; // 0-based index

  const months = Array.from({ length: 12 }, (_, i) => {
    const monthNum = i + 1;
    const value = `${currentYear}-${monthNum.toString().padStart(2, '0')}`;
    return {
      value,
      label: format(new Date(currentYear, i, 1), 'MMM'),
      index: i,
    };
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 flex-shrink-0">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-base-content">Dashboard</h1>
          <div className="text-3xl font-bold text-base-content">
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </div>
        </div>

        {/* Month Steps */}
        <ul className="steps steps-horizontal w-full">
          {months.map((month) => {
            const isSelected = month.value === selectedMonth;
            const isPast = month.index < selectedMonthIndex;
            const isActive = isPast || isSelected;

            return (
              <li
                key={month.value}
                data-content={isSelected ? '●' : ''}
                className={`step cursor-pointer transition-colors hover:text-primary ${
                  isActive ? 'step-primary' : 'step-neutral'
                } ${isSelected ? 'font-bold text-primary' : ''}`}
                onClick={() => setSelectedMonth(month.value)}
              >
                {month.label}
              </li>
            );
          })}
        </ul>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Income Card */}
        <div className="bg-base-100 rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-base-content/70">Income</p>
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-base-content mb-2">
            ${currentMonth.income.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          {previousMonth && (
            <div className="flex items-center gap-1">
              {incomeChange >= 0 ? (
                <ArrowUpRight className="w-4 h-4 text-green-600" />
              ) : (
                <ArrowDownRight className="w-4 h-4 text-red-600" />
              )}
              <span
                className={`text-sm font-medium ${
                  incomeChange >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {Math.abs(incomeChange).toFixed(1)}% vs last month
              </span>
            </div>
          )}
        </div>

        {/* Expenses Card */}
        <div className="bg-base-100 rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-base-content/70">Expenses</p>
            <div className="p-2 bg-red-100 rounded-lg">
              <TrendingDown className="w-5 h-5 text-red-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-base-content mb-2">
            ${currentMonth.expenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          {previousMonth && (
            <div className="flex items-center gap-1">
              {expenseChange >= 0 ? (
                <ArrowUpRight className="w-4 h-4 text-red-600" />
              ) : (
                <ArrowDownRight className="w-4 h-4 text-green-600" />
              )}
              <span
                className={`text-sm font-medium ${
                  expenseChange >= 0 ? 'text-red-600' : 'text-green-600'
                }`}
              >
                {Math.abs(expenseChange).toFixed(1)}% vs last month
              </span>
            </div>
          )}
        </div>

        {/* Net Card */}
        <div className="bg-base-100 rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-base-content/70">Net</p>
            <div className={`p-2 rounded-lg ${currentMonth.net >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
              <DollarSign className={`w-5 h-5 ${currentMonth.net >= 0 ? 'text-green-600' : 'text-red-600'}`} />
            </div>
          </div>
          <p className={`text-3xl font-bold mb-2 ${currentMonth.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {currentMonth.net >= 0 ? '+' : '-'}${Math.abs(currentMonth.net).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          {previousMonth && (
            <div className="flex items-center gap-1">
              {netChange >= 0 ? (
                <ArrowUpRight className="w-4 h-4 text-green-600" />
              ) : (
                <ArrowDownRight className="w-4 h-4 text-red-600" />
              )}
              <span
                className={`text-sm font-medium ${
                  netChange >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {Math.abs(netChange).toFixed(1)}% vs last month
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Spending Heatmap */}
      <div className="mb-8">
        <SpendingHeatmap selectedMonth={selectedMonth} />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Spending Trends */}
        <div className="bg-base-100 rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-base-content mb-4">Spending Trends (6 Months)</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
              <Legend />
              <Line type="monotone" dataKey="income" stroke="#10b981" strokeWidth={2} />
              <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Top Categories */}
        <div className="bg-base-100 rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-base-content mb-4">Top Expense Categories</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={topCategories}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ category_name, percentage }) =>
                  `${category_name}: ${percentage.toFixed(1)}%`
                }
                outerRadius={80}
                fill="#8884d8"
                dataKey="amount"
              >
                {topCategories.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-base-100 rounded-lg shadow-sm">
        <div className="px-6 py-4 border-b border-base-300">
          <h2 className="text-lg font-semibold text-base-content">Recent Transactions</h2>
        </div>
        <div className="divide-y divide-base-300">
          {recentTransactions.slice(0, 5).map((transaction) => {
            // Safely parse date with fallback
            let dateDisplay = 'Invalid date';
            try {
              const parsed = parseISO(transaction.date);
              if (!isNaN(parsed.getTime())) {
                dateDisplay = format(parsed, 'MMM d, yyyy');
              }
            } catch (e) {
              console.warn('Invalid date for transaction:', transaction.id, transaction.date);
            }

            return (
              <div key={transaction.id} className="px-6 py-4 flex items-center justify-between hover:bg-base-200">
                <div className="flex-1">
                  <p className="font-medium text-base-content">{transaction.description}</p>
                  <p className="text-sm text-base-content/70">
                    {dateDisplay} • {transaction.category_name || 'Uncategorized'}
                  </p>
                </div>
              <p
                className={`text-lg font-semibold ${
                  transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {transaction.type === 'income' ? '+' : '-'}$
                {transaction.amount.toFixed(2)}
              </p>
            </div>
            );
          })}
        </div>
      </div>
      </div>
    </div>
  );
}
