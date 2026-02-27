import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb, seedAccount, seedCategory, seedTransaction } from '../../../../setup/db-helpers';

// Mock electron/db/index so getDatabase() returns our in-memory DB
vi.mock('../../../../../electron/db/index', () => ({ getDatabase: vi.fn() }));

import { getDatabase } from '../../../../../electron/db/index';
import {
  createTransaction,
  deleteTransaction,
  bulkCreateTransactions,
  findDuplicateTransactions,
  getAllTransactions,
  getTransactionById,
} from '../../../../../electron/db/queries/transactions';
import type Database from 'better-sqlite3';

let db: Database.Database;
let accountId: number;
let account2Id: number;
let categoryId: number;

beforeEach(() => {
  db = createTestDb();
  vi.mocked(getDatabase).mockReturnValue(db);
  accountId = seedAccount(db, { name: 'Checking' });
  account2Id = seedAccount(db, { name: 'Savings' });
  categoryId = seedCategory(db, { name: 'Groceries', type: 'expense' });
});

describe('createTransaction', () => {
  it('creates an income transaction', () => {
    const tx = createTransaction({
      account_id: accountId,
      date: '2025-03-01',
      description: 'Paycheck',
      amount: 3000,
      type: 'income',
    });
    expect(tx.id).toBeGreaterThan(0);
    expect(tx.type).toBe('income');
    expect(tx.amount).toBe(3000);
  });

  it('creates an expense transaction', () => {
    const tx = createTransaction({
      account_id: accountId,
      date: '2025-03-05',
      description: 'Grocery run',
      amount: -85.5,
      type: 'expense',
      category_id: categoryId,
    });
    expect(tx.amount).toBe(-85.5);
    expect(tx.category_id).toBe(categoryId);
  });

  it('creates a transfer and returns two linked transactions', () => {
    const outgoing = createTransaction({
      account_id: accountId,
      to_account_id: account2Id,
      date: '2025-03-10',
      description: 'Transfer to savings',
      amount: 500,
      type: 'transfer',
    });

    expect(outgoing.type).toBe('transfer');
    expect(outgoing.linked_transaction_id).toBeGreaterThan(0);

    const incoming = getTransactionById(outgoing.linked_transaction_id!);
    expect(incoming).not.toBeNull();
    expect(incoming!.account_id).toBe(account2Id);
    expect(incoming!.linked_transaction_id).toBe(outgoing.id);
  });

  it('throws when creating transfer without to_account_id', () => {
    expect(() =>
      createTransaction({
        account_id: accountId,
        date: '2025-03-10',
        description: 'Transfer',
        amount: 100,
        type: 'transfer',
      })
    ).toThrow('to_account_id is required');
  });

  it('throws on exact duplicate', () => {
    createTransaction({
      account_id: accountId,
      date: '2025-03-05',
      description: 'Duplicate',
      amount: -10,
      type: 'expense',
    });

    expect(() =>
      createTransaction({
        account_id: accountId,
        date: '2025-03-05',
        description: 'Duplicate',
        amount: -10,
        type: 'expense',
      })
    ).toThrow('Duplicate transaction');
  });
});

describe('deleteTransaction', () => {
  it('deletes a single transaction', () => {
    const txId = seedTransaction(db, { account_id: accountId });
    deleteTransaction(txId);
    expect(getTransactionById(txId)).toBeNull();
  });

  it('cascade-deletes both legs of a transfer', () => {
    const outgoing = createTransaction({
      account_id: accountId,
      to_account_id: account2Id,
      date: '2025-04-01',
      description: 'Transfer out',
      amount: 200,
      type: 'transfer',
    });
    const linkedId = outgoing.linked_transaction_id!;

    deleteTransaction(outgoing.id);

    expect(getTransactionById(outgoing.id)).toBeNull();
    expect(getTransactionById(linkedId)).toBeNull();
  });
});

describe('findDuplicateTransactions', () => {
  it('finds an exact match', () => {
    seedTransaction(db, {
      account_id: accountId,
      date: '2025-05-01',
      description: 'Starbucks',
      amount: -5,
    });

    const dupes = findDuplicateTransactions(accountId, '2025-05-01', -5, 'Starbucks');
    expect(dupes.length).toBe(1);
  });

  it('finds a normalized duplicate (pending prefix stripped)', () => {
    seedTransaction(db, {
      account_id: accountId,
      date: '2025-05-02',
      description: 'Starbucks',
      amount: -5.5,
    });

    // "Pending: Starbucks" normalizes to "starbucks"
    const dupes = findDuplicateTransactions(accountId, '2025-05-02', -5.5, 'Pending: Starbucks');
    expect(dupes.length).toBe(1);
  });

  it('finds a Levenshtein near-match within tolerance', () => {
    seedTransaction(db, {
      account_id: accountId,
      date: '2025-05-03',
      description: 'Netflix',
      amount: -15.99,
    });

    // 'Netflx' has Levenshtein distance 1 from 'netflix' — within maxDistance 3
    const dupes = findDuplicateTransactions(accountId, '2025-05-03', -15.99, 'Netflx');
    expect(dupes.length).toBe(1);
  });

  it('returns empty array when no duplicates', () => {
    const dupes = findDuplicateTransactions(accountId, '2025-06-01', -99.99, 'Wholly unique desc XYZ');
    expect(dupes).toEqual([]);
  });

  it('respects date tolerance of ±3 days', () => {
    seedTransaction(db, {
      account_id: accountId,
      date: '2025-05-04',
      description: 'Amazon',
      amount: -50,
    });

    // Same amount, ±2 days — should match
    const dupes = findDuplicateTransactions(accountId, '2025-05-06', -50, 'Amazon');
    expect(dupes.length).toBeGreaterThan(0);
  });

  it('respects amount tolerance of $2', () => {
    seedTransaction(db, {
      account_id: accountId,
      date: '2025-05-05',
      description: 'Restaurant',
      amount: -20.0,
    });

    // $1.50 difference — within $2 tolerance, same description
    const dupes = findDuplicateTransactions(accountId, '2025-05-05', -21.5, 'Restaurant');
    expect(dupes.length).toBeGreaterThan(0);
  });
});

describe('bulkCreateTransactions', () => {
  it('inserts new transactions and returns count', () => {
    const count = bulkCreateTransactions([
      {
        account_id: accountId,
        date: '2025-07-01',
        description: 'Bulk A',
        amount: -10,
        type: 'expense',
      },
      {
        account_id: accountId,
        date: '2025-07-02',
        description: 'Bulk B',
        amount: -20,
        type: 'expense',
      },
    ]);
    expect(count).toBe(2);
  });

  it('skips exact duplicates (returns 0 new)', () => {
    seedTransaction(db, {
      account_id: accountId,
      date: '2025-07-10',
      description: 'Already there',
      amount: -5,
    });

    const count = bulkCreateTransactions([
      {
        account_id: accountId,
        date: '2025-07-10',
        description: 'Already there',
        amount: -5,
        type: 'expense',
      },
    ]);
    expect(count).toBe(0);
  });

  it('updates a pending→posted transition', () => {
    // Insert pending with no category
    seedTransaction(db, {
      account_id: accountId,
      date: '2025-07-15',
      description: 'Pending coffee',
      amount: -4,
      status: 'pending',
    });

    // Import the same transaction but now posted with a category
    const count = bulkCreateTransactions([
      {
        account_id: accountId,
        date: '2025-07-15',
        description: 'Pending coffee',
        amount: -4,
        type: 'expense',
        category_id: categoryId,
        status: 'cleared',
      },
    ]);

    // count is 0 (skipped), but the existing row should now have the category
    expect(count).toBe(0);
    const all = getAllTransactions({ account_id: accountId });
    const updated = all.find((t) => t.description === 'Pending coffee');
    expect(updated?.category_id).toBe(categoryId);
  });
});
