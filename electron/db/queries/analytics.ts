import { getDatabase } from '../index';
import type { MonthlyStats, CategoryBreakdown, SpendingTrend } from '../../../src/types';

export function getMonthlyStats(month: string): MonthlyStats {
  const db = getDatabase();

  const result = db
    .prepare(
      `
    SELECT
      ? as month,
      COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expenses,
      COUNT(*) as transaction_count
    FROM transactions
    WHERE strftime('%Y-%m', date) = ?
      AND type != 'transfer'
  `
    )
    .get(month, month) as any;

  return {
    month,
    income: result.income,
    expenses: result.expenses,
    net: result.income - result.expenses,
    transaction_count: result.transaction_count,
  };
}

export function getCategoryBreakdown(
  startDate: string,
  endDate: string,
  type: 'income' | 'expense'
): CategoryBreakdown[] {
  const db = getDatabase();

  const rows = db
    .prepare(
      `
    SELECT
      c.id as category_id,
      c.name as category_name,
      SUM(t.amount) as amount,
      COUNT(*) as count
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.type = ?
      AND LOWER(COALESCE(c.name, '')) != 'transfer'
      AND t.date >= ?
      AND t.date <= ?
    GROUP BY c.id, c.name
    ORDER BY amount DESC
  `
    )
    .all(type, startDate, endDate) as any[];

  const total = rows.reduce((sum, row) => sum + row.amount, 0);

  return rows.map((row) => ({
    category_id: row.category_id || 0,
    category_name: row.category_name || 'Uncategorized',
    amount: row.amount,
    count: row.count,
    percentage: total > 0 ? (row.amount / total) * 100 : 0,
  }));
}

export function getSpendingTrends(months: number): SpendingTrend[] {
  const db = getDatabase();

  const rows = db
    .prepare(
      `
    SELECT
      strftime('%Y-%m', date) as month,
      COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expenses
    FROM transactions
    WHERE date >= date('now', '-' || ? || ' months')
      AND type != 'transfer'
    GROUP BY strftime('%Y-%m', date)
    ORDER BY month ASC
  `
    )
    .all(months) as any[];

  return rows.map((row) => ({
    month: row.month,
    income: row.income,
    expenses: row.expenses,
    net: row.income - row.expenses,
  }));
}

export function getTopExpenseCategories(month: string, limit: number = 5): CategoryBreakdown[] {
  const db = getDatabase();

  const rows = db
    .prepare(
      `
    SELECT
      c.id as category_id,
      c.name as category_name,
      SUM(t.amount) as amount,
      COUNT(*) as count
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.type = 'expense'
      AND LOWER(COALESCE(c.name, '')) != 'transfer'
      AND strftime('%Y-%m', t.date) = ?
    GROUP BY c.id, c.name
    ORDER BY amount DESC
    LIMIT ?
  `
    )
    .all(month, limit) as any[];

  const total = rows.reduce((sum, row) => sum + row.amount, 0);

  return rows.map((row) => ({
    category_id: row.category_id || 0,
    category_name: row.category_name || 'Uncategorized',
    amount: row.amount,
    count: row.count,
    percentage: total > 0 ? (row.amount / total) * 100 : 0,
  }));
}

export function getRecentTransactions(limit: number = 10) {
  const db = getDatabase();

  return db
    .prepare(
      `
    SELECT
      t.*,
      a.name as account_name,
      c.name as category_name
    FROM transactions t
    LEFT JOIN accounts a ON t.account_id = a.id
    LEFT JOIN categories c ON t.category_id = c.id
    ORDER BY t.date DESC, t.id DESC
    LIMIT ?
  `
    )
    .all(limit);
}

export function getTotalsByType(): { income: number; expenses: number; net: number } {
  const db = getDatabase();

  const result = db
    .prepare(
      `
    SELECT
      COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expenses
    FROM transactions
    WHERE type != 'transfer'
  `
    )
    .get() as any;

  return {
    income: result.income,
    expenses: result.expenses,
    net: result.income - result.expenses,
  };
}

export function getTopTransactionsByMonth(month: string, limit = 5) {
  const db = getDatabase();
  return db.prepare(`
    SELECT t.*, a.name as account_name, c.name as category_name
    FROM transactions t
    LEFT JOIN accounts a ON t.account_id = a.id
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.type = 'expense'
      AND strftime('%Y-%m', t.date) = ?
    ORDER BY t.amount DESC
    LIMIT ?
  `).all(month, limit);
}

export function getDailySpendingForMonth(month: string): Array<{ date: string; expenses: number }> {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT
      date,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expenses
    FROM transactions
    WHERE strftime('%Y-%m', date) = ?
      AND type != 'transfer'
    GROUP BY date
    ORDER BY date ASC
  `).all(month) as any[];

  return rows.map((row) => ({ date: row.date, expenses: row.expenses }));
}

export function getDailySpending(days: number = 365): Array<{ date: string; amount: number; count: number }> {
  const db = getDatabase();

  const rows = db
    .prepare(
      `
    SELECT
      date,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as amount,
      COUNT(CASE WHEN type = 'expense' THEN 1 END) as count
    FROM transactions
    WHERE date >= date('now', '-' || ? || ' days')
      AND type = 'expense'
    GROUP BY date
    ORDER BY date ASC
  `
    )
    .all(days) as any[];

  return rows.map((row) => ({
    date: row.date,
    amount: row.amount,
    count: row.count,
  }));
}
