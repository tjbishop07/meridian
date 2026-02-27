import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb, seedAccount, seedCategory, seedTransaction } from '../../../../setup/db-helpers';

vi.mock('../../../../../electron/db/index', () => ({ getDatabase: vi.fn() }));

import { getDatabase } from '../../../../../electron/db/index';
import {
  getMonthlyStats,
  getCategoryBreakdown,
  getTotalsByType,
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
