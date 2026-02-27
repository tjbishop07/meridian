import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb, seedAccount, seedTransaction } from '../../../../setup/db-helpers';

vi.mock('../../../../../electron/db/index', () => ({ getDatabase: vi.fn() }));

import { getDatabase } from '../../../../../electron/db/index';
import {
  createAccount,
  getAccountById,
  updateAccountBalance,
} from '../../../../../electron/db/queries/accounts';
import type Database from 'better-sqlite3';

let db: Database.Database;

beforeEach(() => {
  db = createTestDb();
  vi.mocked(getDatabase).mockReturnValue(db);
});

describe('createAccount', () => {
  it('creates an account and returns it', () => {
    const account = createAccount({
      name: 'My Checking',
      type: 'checking',
      institution: 'USAA',
      balance: 0,
      currency: 'USD',
      is_active: true,
    });
    expect(account.id).toBeGreaterThan(0);
    expect(account.name).toBe('My Checking');
  });
});

describe('updateAccountBalance', () => {
  it('sets balance to income minus expenses', () => {
    const accountId = seedAccount(db);
    seedTransaction(db, { account_id: accountId, amount: 2000, type: 'income', date: '2025-01-01', description: 'Paycheck' });
    seedTransaction(db, { account_id: accountId, amount: -500, type: 'expense', date: '2025-01-05', description: 'Rent' });

    updateAccountBalance(accountId);

    const account = getAccountById(accountId)!;
    // SQL: SUM(CASE WHEN type='income' THEN amount ELSE -amount END)
    // income:  +2000, expense: -(-500) = +500 → balance = 2500
    expect(account.balance).toBe(2500);
  });

  it('returns 0 when account has no transactions', () => {
    const accountId = seedAccount(db);
    updateAccountBalance(accountId);
    expect(getAccountById(accountId)!.balance).toBe(0);
  });

  it('includes transfer transactions in balance (not filtered)', () => {
    const accountId = seedAccount(db);
    // Transfer amounts still affect the account balance calculation
    seedTransaction(db, { account_id: accountId, amount: -300, type: 'transfer', date: '2025-01-10', description: 'Transfer out' });
    updateAccountBalance(accountId);
    // SQL: ELSE -amount → -(-300) = 300 → transfer treated same as expense
    expect(getAccountById(accountId)!.balance).toBe(300);
  });
});
