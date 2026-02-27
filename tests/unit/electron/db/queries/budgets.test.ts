import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb, seedAccount, seedCategory, seedTransaction } from '../../../../setup/db-helpers';

vi.mock('../../../../../electron/db/index', () => ({ getDatabase: vi.fn() }));

import { getDatabase } from '../../../../../electron/db/index';
import {
  createBudget,
  getSpentForCategory,
  getBudgetProgress,
} from '../../../../../electron/db/queries/budgets';
import type Database from 'better-sqlite3';

let db: Database.Database;
let accountId: number;
let categoryId: number;

beforeEach(() => {
  db = createTestDb();
  vi.mocked(getDatabase).mockReturnValue(db);
  accountId = seedAccount(db);
  categoryId = seedCategory(db, { name: 'Dining', type: 'expense' });
});

describe('getSpentForCategory', () => {
  it('returns 0 when no transactions exist', () => {
    expect(getSpentForCategory(categoryId, '2025-08')).toBe(0);
  });

  it('sums only expense transactions for the given category and month', () => {
    seedTransaction(db, {
      account_id: accountId,
      category_id: categoryId,
      date: '2025-08-10',
      amount: -40,
      type: 'expense',
      description: 'Dinner',
    });
    seedTransaction(db, {
      account_id: accountId,
      category_id: categoryId,
      date: '2025-08-20',
      amount: -25,
      type: 'expense',
      description: 'Lunch',
    });
    // Income transaction should not be counted
    seedTransaction(db, {
      account_id: accountId,
      category_id: categoryId,
      date: '2025-08-15',
      amount: 100,
      type: 'income',
      description: 'Refund',
    });

    const spent = getSpentForCategory(categoryId, '2025-08');
    expect(spent).toBe(-65);
  });

  it('does not include different months', () => {
    seedTransaction(db, {
      account_id: accountId,
      category_id: categoryId,
      date: '2025-07-31',
      amount: -50,
      type: 'expense',
      description: 'July dinner',
    });
    expect(getSpentForCategory(categoryId, '2025-08')).toBe(0);
  });
});

describe('getBudgetProgress', () => {
  it('calculates correct percentage of budget spent', () => {
    createBudget({ category_id: categoryId, month: '2025-09', amount: 200 });
    seedTransaction(db, {
      account_id: accountId,
      category_id: categoryId,
      date: '2025-09-05',
      amount: -100,
      type: 'expense',
      description: 'Restaurant',
    });

    const progress = getBudgetProgress('2025-09');
    expect(progress.total_budgeted).toBe(200);
    // Expenses are stored as negative amounts, so SUM = -100
    expect(progress.total_spent).toBe(-100);
    // percentage = (-100 / 200) * 100 = -50 (negative because expense amounts are negative)
    expect(progress.percentage).toBeCloseTo(-50, 1);
  });

  it('returns 0% when no transactions', () => {
    createBudget({ category_id: categoryId, month: '2025-10', amount: 300 });
    const progress = getBudgetProgress('2025-10');
    expect(progress.percentage).toBe(0);
  });
});
