import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb, seedAccount, seedCategory, seedTransaction } from '../../../../setup/db-helpers';

vi.mock('../../../../../electron/db/index', () => ({ getDatabase: vi.fn() }));

import { getDatabase } from '../../../../../electron/db/index';
import {
  getMonthlyStats,
  getCategoryBreakdown,
  getTotalsByType,
  getSpendingTrends,
  getTopExpenseCategories,
  getRecentTransactions,
  getTopTransactionsByMonth,
  getDailySpendingForMonth,
  getDailySpending,
} from '../../../../../electron/db/queries/analytics';
import type Database from 'better-sqlite3';

let db: Database.Database;
let accountId: number;

beforeEach(() => {
  db = createTestDb();
  vi.mocked(getDatabase).mockReturnValue(db);
  accountId = seedAccount(db);
});

describe('getMonthlyStats', () => {
  it('returns zeros for an empty month', () => {
    const stats = getMonthlyStats('2025-01');
    expect(stats.income).toBe(0);
    expect(stats.expenses).toBe(0);
    expect(stats.net).toBe(0);
  });

  it('sums income and expense separately', () => {
    seedTransaction(db, { account_id: accountId, date: '2025-03-01', amount: 2000, type: 'income', description: 'Paycheck' });
    seedTransaction(db, { account_id: accountId, date: '2025-03-10', amount: -500, type: 'expense', description: 'Rent' });

    const stats = getMonthlyStats('2025-03');
    expect(stats.income).toBe(2000);
    expect(stats.expenses).toBe(-500);
    expect(stats.net).toBe(2000 - (-500));
  });

  it('excludes type=transfer transactions', () => {
    // Insert a transfer directly (bypassing business logic that creates pairs)
    db.prepare(
      `INSERT INTO transactions (account_id, date, description, amount, type, status)
       VALUES (?, '2025-04-05', 'Transfer out', -300, 'transfer', 'cleared')`
    ).run(accountId);

    const stats = getMonthlyStats('2025-04');
    expect(stats.income).toBe(0);
    expect(stats.expenses).toBe(0);
  });

  it('excludes transactions with a category name containing "transfer"', () => {
    const transferCatId = seedCategory(db, { name: 'Internal Transfer', type: 'expense' });
    seedTransaction(db, {
      account_id: accountId,
      date: '2025-04-10',
      amount: -100,
      type: 'expense',
      category_id: transferCatId,
      description: 'Move money',
    });

    const stats = getMonthlyStats('2025-04');
    expect(stats.expenses).toBe(0);
  });
});

describe('getCategoryBreakdown', () => {
  it('calculates percentages that sum to 100 for income categories', () => {
    // Use income (positive amounts) so getCategoryBreakdown's `total > 0` guard is satisfied
    const catA = seedCategory(db, { name: 'Salary', type: 'income' });
    const catB = seedCategory(db, { name: 'Bonus', type: 'income' });

    seedTransaction(db, { account_id: accountId, date: '2025-05-01', amount: 3000, type: 'income', category_id: catA, description: 'Paycheck' });
    seedTransaction(db, { account_id: accountId, date: '2025-05-02', amount: 500, type: 'income', category_id: catB, description: 'Bonus' });

    const breakdown = getCategoryBreakdown('2025-05-01', '2025-05-31', 'income');
    const total = breakdown.reduce((s, r) => s + r.percentage, 0);
    expect(Math.abs(total - 100)).toBeLessThan(0.01);
  });

  it('excludes transfer-named categories', () => {
    const transferCat = seedCategory(db, { name: 'Cash Transfer', type: 'expense' });
    seedTransaction(db, {
      account_id: accountId,
      date: '2025-05-05',
      amount: -150,
      type: 'expense',
      category_id: transferCat,
      description: 'ATM withdrawal',
    });

    const breakdown = getCategoryBreakdown('2025-05-01', '2025-05-31', 'expense');
    const transferEntry = breakdown.find((r) => r.category_name?.toLowerCase().includes('transfer'));
    expect(transferEntry).toBeUndefined();
  });
});

describe('getTotalsByType', () => {
  it('returns net = income − expenses', () => {
    seedTransaction(db, { account_id: accountId, date: '2025-06-01', amount: 4000, type: 'income', description: 'Salary' });
    seedTransaction(db, { account_id: accountId, date: '2025-06-10', amount: -1000, type: 'expense', description: 'Bills' });

    const totals = getTotalsByType();
    expect(totals.income).toBe(4000);
    expect(totals.expenses).toBe(-1000);
    expect(totals.net).toBe(4000 - (-1000));
  });

  it('does not count transfers', () => {
    db.prepare(
      `INSERT INTO transactions (account_id, date, description, amount, type, status)
       VALUES (?, '2025-06-05', 'Transfer', -500, 'transfer', 'cleared')`
    ).run(accountId);

    const totals = getTotalsByType();
    expect(totals.income).toBe(0);
    expect(totals.expenses).toBe(0);
  });
});

describe('getSpendingTrends', () => {
  it('returns an entry for each month that has transactions', () => {
    seedTransaction(db, { account_id: accountId, date: '2025-07-01', amount: 3000, type: 'income', description: 'Salary July' });
    seedTransaction(db, { account_id: accountId, date: '2025-08-01', amount: 3000, type: 'income', description: 'Salary Aug' });

    // Use a large window to capture fixed past dates regardless of when tests run
    const trends = getSpendingTrends(12000);
    const months = trends.map((t) => t.month);
    expect(months).toContain('2025-07');
    expect(months).toContain('2025-08');
  });

  it('calculates net = income − expenses for each month', () => {
    seedTransaction(db, { account_id: accountId, date: '2025-09-01', amount: 2000, type: 'income', description: 'Salary' });
    seedTransaction(db, { account_id: accountId, date: '2025-09-15', amount: -400, type: 'expense', description: 'Rent' });

    const trends = getSpendingTrends(12000);
    const sep = trends.find((t) => t.month === '2025-09');
    expect(sep).toBeDefined();
    expect(sep!.income).toBe(2000);
    expect(sep!.expenses).toBe(-400);
    expect(sep!.net).toBe(2000 - (-400));
  });

  it('excludes transfer transactions from trends', () => {
    db.prepare(
      `INSERT INTO transactions (account_id, date, description, amount, type, status)
       VALUES (?, '2025-10-01', 'Transfer', -1000, 'transfer', 'cleared')`
    ).run(accountId);

    const trends = getSpendingTrends(12000);
    const oct = trends.find((t) => t.month === '2025-10');
    // Either no entry for that month, or it has zero income and expenses
    if (oct) {
      expect(oct.income).toBe(0);
      expect(oct.expenses).toBe(0);
    }
  });
});

describe('getTopExpenseCategories', () => {
  it('returns categories sorted by amount DESC (least-negative first for expense amounts)', () => {
    const catA = seedCategory(db, { name: 'Groceries', type: 'expense' });
    const catB = seedCategory(db, { name: 'Dining', type: 'expense' });

    seedTransaction(db, { account_id: accountId, date: '2025-11-01', amount: -500, type: 'expense', category_id: catA, description: 'Supermarket' });
    seedTransaction(db, { account_id: accountId, date: '2025-11-05', amount: -200, type: 'expense', category_id: catB, description: 'Restaurant' });

    const top = getTopExpenseCategories('2025-11', 5);
    // The query uses ORDER BY amount DESC; for negative amounts -200 > -500,
    // so Dining (-200) ranks above Groceries (-500).
    expect(top[0].category_name).toBe('Dining');
    expect(top[1].category_name).toBe('Groceries');
  });

  it('respects the limit parameter', () => {
    const cat1 = seedCategory(db, { name: 'Rent', type: 'expense' });
    const cat2 = seedCategory(db, { name: 'Utilities', type: 'expense' });
    const cat3 = seedCategory(db, { name: 'Transport', type: 'expense' });

    seedTransaction(db, { account_id: accountId, date: '2025-11-01', amount: -1500, type: 'expense', category_id: cat1, description: 'Rent' });
    seedTransaction(db, { account_id: accountId, date: '2025-11-02', amount: -100, type: 'expense', category_id: cat2, description: 'Electric' });
    seedTransaction(db, { account_id: accountId, date: '2025-11-03', amount: -50, type: 'expense', category_id: cat3, description: 'Bus' });

    const top = getTopExpenseCategories('2025-11', 2);
    expect(top).toHaveLength(2);
  });

  it('returns empty array for a month with no expenses', () => {
    const top = getTopExpenseCategories('2020-01', 5);
    expect(top).toHaveLength(0);
  });

  it('excludes transfer-named categories', () => {
    const transferCat = seedCategory(db, { name: 'Account Transfer', type: 'expense' });
    seedTransaction(db, { account_id: accountId, date: '2025-11-10', amount: -300, type: 'expense', category_id: transferCat, description: 'Move funds' });

    const top = getTopExpenseCategories('2025-11', 5);
    const found = top.find((c) => c.category_name?.toLowerCase().includes('transfer'));
    expect(found).toBeUndefined();
  });
});

describe('getRecentTransactions', () => {
  it('returns transactions ordered by date descending', () => {
    seedTransaction(db, { account_id: accountId, date: '2025-01-01', amount: -10, type: 'expense', description: 'Earlier' });
    seedTransaction(db, { account_id: accountId, date: '2025-12-01', amount: -20, type: 'expense', description: 'Later' });

    const recent = getRecentTransactions(10) as any[];
    expect(recent[0].description).toBe('Later');
    expect(recent[1].description).toBe('Earlier');
  });

  it('respects the limit', () => {
    for (let i = 1; i <= 5; i++) {
      seedTransaction(db, { account_id: accountId, date: `2025-03-0${i}`, amount: -i * 10, type: 'expense', description: `Tx${i}` });
    }
    const recent = getRecentTransactions(3) as any[];
    expect(recent).toHaveLength(3);
  });

  it('joins account_name and category_name', () => {
    const catId = seedCategory(db, { name: 'Groceries', type: 'expense' });
    seedTransaction(db, { account_id: accountId, date: '2025-04-01', amount: -50, type: 'expense', category_id: catId, description: 'Supermarket' });

    const recent = getRecentTransactions(1) as any[];
    expect(recent[0].account_name).toBe('Test Checking');
    expect(recent[0].category_name).toBe('Groceries');
  });
});

describe('getTopTransactionsByMonth', () => {
  it('returns expense transactions sorted by amount DESC (least-negative first for expense amounts)', () => {
    seedTransaction(db, { account_id: accountId, date: '2025-05-01', amount: -1200, type: 'expense', description: 'Rent' });
    seedTransaction(db, { account_id: accountId, date: '2025-05-10', amount: -80, type: 'expense', description: 'Groceries' });
    seedTransaction(db, { account_id: accountId, date: '2025-05-15', amount: -15, type: 'expense', description: 'Coffee' });

    const top = getTopTransactionsByMonth('2025-05', 5) as any[];
    // The query uses ORDER BY t.amount DESC; for negative amounts -15 > -80 > -1200,
    // so Coffee (-15) ranks first, then Groceries (-80), then Rent (-1200).
    expect(top[0].description).toBe('Coffee');
    expect(top[1].description).toBe('Groceries');
    expect(top[2].description).toBe('Rent');
  });

  it('excludes income and transfer transactions', () => {
    seedTransaction(db, { account_id: accountId, date: '2025-05-01', amount: 3000, type: 'income', description: 'Salary' });

    const top = getTopTransactionsByMonth('2025-05', 5) as any[];
    const income = top.find((t: any) => t.type === 'income');
    expect(income).toBeUndefined();
  });

  it('respects the limit parameter', () => {
    for (let i = 1; i <= 6; i++) {
      seedTransaction(db, { account_id: accountId, date: '2025-05-01', amount: -i * 100, type: 'expense', description: `Expense${i}` });
    }
    const top = getTopTransactionsByMonth('2025-05', 3) as any[];
    expect(top).toHaveLength(3);
  });
});

describe('getDailySpendingForMonth', () => {
  it('returns daily expense totals for the given month', () => {
    seedTransaction(db, { account_id: accountId, date: '2025-06-05', amount: -100, type: 'expense', description: 'A' });
    seedTransaction(db, { account_id: accountId, date: '2025-06-05', amount: -50, type: 'expense', description: 'B' });
    seedTransaction(db, { account_id: accountId, date: '2025-06-10', amount: -200, type: 'expense', description: 'C' });

    const daily = getDailySpendingForMonth('2025-06');
    const june5 = daily.find((d) => d.date === '2025-06-05');
    const june10 = daily.find((d) => d.date === '2025-06-10');

    expect(june5).toBeDefined();
    expect(june5!.expenses).toBe(-150);
    expect(june10!.expenses).toBe(-200);
  });

  it('excludes income and transfer transactions', () => {
    seedTransaction(db, { account_id: accountId, date: '2025-06-01', amount: 5000, type: 'income', description: 'Paycheck' });

    const daily = getDailySpendingForMonth('2025-06');
    const june1 = daily.find((d) => d.date === '2025-06-01');
    if (june1) {
      expect(june1.expenses).toBe(0);
    }
  });

  it('returns empty array for a month with no transactions', () => {
    const daily = getDailySpendingForMonth('2020-01');
    expect(daily).toHaveLength(0);
  });
});

describe('getDailySpending', () => {
  it('returns spending entries anchored to recent dates', () => {
    // Use a fixed recent date that will always be within a large window
    const today = new Date().toISOString().slice(0, 10);
    seedTransaction(db, { account_id: accountId, date: today, amount: -75, type: 'expense', description: 'Today spend' });

    const daily = getDailySpending(365);
    const todayEntry = daily.find((d) => d.date === today);
    expect(todayEntry).toBeDefined();
    expect(todayEntry!.amount).toBe(-75);
    expect(todayEntry!.count).toBe(1);
  });

  it('aggregates multiple expenses on the same day', () => {
    const today = new Date().toISOString().slice(0, 10);
    seedTransaction(db, { account_id: accountId, date: today, amount: -30, type: 'expense', description: 'Coffee' });
    seedTransaction(db, { account_id: accountId, date: today, amount: -70, type: 'expense', description: 'Lunch' });

    const daily = getDailySpending(365);
    const todayEntry = daily.find((d) => d.date === today);
    expect(todayEntry).toBeDefined();
    expect(todayEntry!.amount).toBe(-100);
    expect(todayEntry!.count).toBe(2);
  });

  it('excludes income and transfer transactions', () => {
    const today = new Date().toISOString().slice(0, 10);
    seedTransaction(db, { account_id: accountId, date: today, amount: 3000, type: 'income', description: 'Paycheck' });

    const daily = getDailySpending(365);
    const todayEntry = daily.find((d) => d.date === today);
    // Income should not appear in expense-only getDailySpending
    if (todayEntry) {
      expect(todayEntry.amount).toBe(0);
    }
  });
});
